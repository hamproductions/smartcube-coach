import { parseDeviceSession } from './deviceRecorder'
import type { CubeEvent } from './inputSource'
import { CubedexMoveTracker } from './cubedex/moveTracker'
import { CubedexSolveTracker } from './cubedex/solveTracker'
import { segmentCfop } from '../domain/reconstruction'
import { createId } from '../domain/ids'
import { repositories } from '../storage/database'
import { moveOffsets } from './recordCapture'
import { ANALYSIS_VERSION, type SolveRecord } from '../domain/models'

/**
 * Replays a recorded device session straight into storage.
 *
 * The old capture screen owned this path, and replacing it left no way to get a solve
 * into the database at all. It runs the same two trackers the live path uses, so what
 * lands here is exactly what a live capture would produce — no shortcut, no seeded data.
 * A session whose moves never reach the solved state saves nothing rather than a
 * fabricated result.
 */
export async function replaySessionIntoStorage(json: string, sessionId: string): Promise<SolveRecord | undefined> {
  const session = parseDeviceSession(json)
  const scramble = session.scramble ?? ''
  const solveTracker = new CubedexSolveTracker(scramble)
  const moveTracker = new CubedexMoveTracker(async (resolved) => { await solveTracker.onResolvedMove(resolved) })
  await moveTracker.reset()

  for (const entry of session.events) {
    await moveTracker.handleEvent(entry.event as CubeEvent)
  }
  await moveTracker.finish()

  const snapshot = solveTracker.snapshot()
  if (snapshot.status !== 'stopped' || snapshot.durationMs == null) return undefined

  const startedAt = Date.now() - snapshot.durationMs
  const timeline = solveTracker.solutionTimeline(startedAt)
  const moves = timeline.map((entry) => entry.move)
  const solveId = createId()

  const record: SolveRecord = {
    id: solveId,
    sessionId,
    puzzle: '3x3x3',
    scramble,
    scrambleGenerator: 'cubing.js-333',
    startedAt,
    endedAt: startedAt + snapshot.durationMs,
    penalty: 'none',
    deviceId: session.device?.mac ?? session.device?.name,
    analysisVersion: ANALYSIS_VERSION,
    rawEventIds: [],
    moves,
    moveOffsetsMs: moveOffsets(timeline),
    source: 'replay',
    stateVerified: true,
    verificationDetail: 'replayed device session'
  }

  const stages = await segmentCfop(scramble, timeline, solveId)
  await repositories.solves.put(record)
  await Promise.all(stages.map(repositories.stages.put))
  return record
}
