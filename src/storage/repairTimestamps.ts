import { repositories } from './database'
import type { SolveRecord } from '../domain/models'

// Solves captured before the wall-clock fix stored the cube's monotonic timestamps, so they
// date to 1 January 1970 in the history and sort ahead of everything real. The duration they
// measured is still good; only the epoch they sit on is wrong, so it is rebased and the
// record marked so this never runs on it twice.
const EARLIEST_PLAUSIBLE_EPOCH_MS = 1_000_000_000_000

export async function repairSolveTimestamps(now = Date.now()) {
  const solves = await repositories.solves.all()
  // A record counts as good only when BOTH ends are plausible. Testing endedAt alone let a
  // record with a corrupted startedAt seed the anchor with its garbage value, which drove
  // every repaired timestamp negative and overwrote that record's real endedAt.
  const isGood = (solve: SolveRecord) =>
    solve.startedAt >= EARLIEST_PLAUSIBLE_EPOCH_MS && solve.endedAt >= EARLIEST_PLAUSIBLE_EPOCH_MS
  const broken = solves.filter((solve) => !isGood(solve))
  if (broken.length === 0) return 0

  // Keep their original order and land them before the oldest solve that already has a real
  // date. Each slot is as wide as the solve itself plus a gap — fixed one-minute slots made
  // any solve longer than a minute start before the previous one had finished.
  const ordered = [...broken].sort((left, right) => left.endedAt - right.endedAt)
  const good = solves.filter(isGood)
  const anchor = good.length > 0 ? Math.min(...good.map((solve) => solve.startedAt)) : now

  // The walk must never run past the plausible epoch: records dated before it would fail this
  // function's own check, so the next app load would "repair" them again with different
  // values, rewriting history on every mount. When the cluster needs more room than there is,
  // the slots are compressed proportionally instead of overrunning.
  const GAP_MS = 60_000
  const durations = ordered.map((solve) =>
    Math.min(Math.max(0, solve.endedAt - solve.startedAt), 60 * 60 * 1000))
  const needed = durations.reduce((total, duration) => total + duration + GAP_MS, 0)
  const budget = Math.max(0, anchor - EARLIEST_PLAUSIBLE_EPOCH_MS)
  const scale = needed > budget && needed > 0 ? budget / needed : 1

  let endedAt = anchor
  const repaired = [...ordered].reverse().map((solve, reverseIndex) => {
    const durationMs = Math.floor(durations[durations.length - 1 - reverseIndex] * scale)
    endedAt -= Math.floor(GAP_MS * scale)
    const record: SolveRecord = { ...solve, startedAt: endedAt - durationMs, endedAt }
    endedAt -= durationMs
    return record
  })

  await Promise.all(repaired.map((solve) => repositories.solves.put(solve)))
  return repaired.length
}
