import { analyseSolve } from '../domain/analyseOffThread'
import { ANALYSIS_VERSION, type SolveRecord, type StageRecord } from '../domain/models'
import { repositories } from './database'

/**
 * Stages are written once, when the solve is recorded, and were never revisited. Every
 * analyser improvement since therefore stopped at the moment of recording: a solve captured
 * before the pair solver kept its solution has a stage saying "23 moves against an optimal 8"
 * and no moves to show for it, and one captured before F2L recognition has no case name at
 * all. The solve's own move list is still there, so the analysis can simply be run again.
 *
 * `ANALYSIS_VERSION` lives in `domain/models.ts` so the writers can stamp it without a
 * domain-to-storage import; bump it whenever `segmentCfop` learns to record something new.
 */

// Per-move timings are not stored anywhere — `rawEventIds` is always empty — so a re-run can
// only use synthetic timestamps. Stage boundaries do not depend on them (they come from the
// move-by-move state scan), but recognition/execution/TPS do, so the re-run's timings are
// discarded and the recorded ones kept.
const TIMING_KEYS = [
  'recognitionMs', 'executionMs', 'tps', 'pauseCount',
  'longestPauseMs', 'longestPauseAfter', 'longestPauseBefore', 'rotationMs'
] as const

const sameSegment = (left: StageRecord, right: StageRecord) =>
  left.startEvent === right.startEvent && left.endEvent === right.endEvent

function withRecordedTiming(fresh: StageRecord, previous: StageRecord | undefined): StageRecord {
  // Only a stage that covers exactly the same moves can keep the old numbers. When the
  // analyser's boundaries have moved, the recorded split belongs to a different span of the
  // solve, and carrying it over would attach real-looking timing to the wrong moves.
  if (!previous || !sameSegment(fresh, previous)) return fresh
  const merged: StageRecord = { ...fresh }
  for (const key of TIMING_KEYS) {
    const value = previous[key]
    if (value === undefined) delete merged[key]
    else Object.assign(merged, { [key]: value })
  }
  return merged
}

export async function reanalyseStoredSolves(version = ANALYSIS_VERSION): Promise<SolveRecord[]> {
  const solves = await repositories.solves.all()
  const stale = solves.filter((solve) => solve.analysisVersion !== version && solve.moves.length > 0)
  if (stale.length === 0) return []

  const allStages = await repositories.stages.all()
  const reanalysed: SolveRecord[] = []

  for (const solve of stale) {
    const previous = allStages.filter((stage) => stage.solveId === solve.id)
    try {
      const events = solve.moves.map((move, index) => ({ move, timestamp: index }))
      const fresh = await analyseSolve(solve.scramble, events, solve.id)
      // A solve whose stages cannot be recomputed keeps the ones it has; an empty result would
      // otherwise delete a breakdown the user can currently read.
      if (fresh.length === 0) continue
      const byName = new Map(previous.map((stage) => [stage.name, stage]))
      await Promise.all(fresh.map((stage) => repositories.stages.put(withRecordedTiming(stage, byName.get(stage.name)))))
      for (const stage of previous) {
        if (!fresh.some((entry) => entry.id === stage.id)) await repositories.stages.remove(stage.id)
      }
      const updated: SolveRecord = { ...solve, analysisVersion: version }
      await repositories.solves.put(updated)
      reanalysed.push(updated)
    } catch {
      // One unanalysable solve must not stop the rest, and must not lose what it already has.
    }
  }

  return reanalysed
}
