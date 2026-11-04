import { createId } from '../domain/ids'
import { ANALYSIS_VERSION, type SolveRecord } from '../domain/models'
import { analyseSolve } from '../domain/analyseOffThread'
import { repositories } from '../storage/database'
import type { CompletedCapture } from './capture'

// Recording a finished solve belongs to the application, not to a page. While the solve
// route owned this, a solve finished on any other screen completed in the capture engine
// and was then thrown away — the cube is tracked app-wide, so its results must be too.
const savedListeners = new Set<(solve: SolveRecord) => void>()

export function subscribeSolveSaved(listener: (solve: SolveRecord) => void) {
  savedListeners.add(listener)
  return () => { savedListeners.delete(listener) }
}

/**
 * A solve whose stages were rewritten reaches the open screens the same way a fresh save
 * does. Without this the analysis upgrade lands in storage while the breakdown on screen
 * keeps showing what it read at mount, so the coaching only appears on the next reload.
 */
export function announceSolveUpdated(record: SolveRecord) {
  for (const listener of savedListeners) listener(record)
}

// Move timestamps can be monotonic (performance.now) rather than wall clock, depending on
// the source. Stored straight through, a solve then dates to January 1 1970 in the session
// rail. The duration is what the capture measured; only the epoch it sits on is fixed here.
const EARLIEST_PLAUSIBLE_EPOCH_MS = 1_000_000_000_000

export function toWallClock(startedAt: number, endedAt: number) {
  // Both ends must look like wall clock. Checking only the end let a solve whose first move
  // carried a monotonic timestamp and whose last move fell back to Date.now() through
  // unchanged — a duration of decades.
  if (startedAt >= EARLIEST_PLAUSIBLE_EPOCH_MS && endedAt >= EARLIEST_PLAUSIBLE_EPOCH_MS) {
    return { startedAt, endedAt }
  }
  // Clamped: a pair built from two different clocks yields a nonsense span, and a solve is
  // never an hour long. Better a bounded value than a duration of decades in the history.
  const durationMs = Math.min(Math.max(0, endedAt - startedAt), 60 * 60 * 1000)
  const now = Date.now()
  return { startedAt: now - durationMs, endedAt: now }
}

/**
 * Move timestamps can be the cube's own monotonic clock, so they are stored relative to the
 * first move rather than as absolute times. A stream whose clock runs backwards is dropped
 * rather than stored: a negative offset would replay as an instant jump and read as real.
 */
export function moveOffsets(events: Array<{ timestamp: number }>): number[] | undefined {
  if (events.length === 0) return undefined
  const first = events[0].timestamp
  const offsets = events.map((event) => Math.round(event.timestamp - first))
  if (offsets.some((offset, index) => offset < 0 || (index > 0 && offset < offsets[index - 1]))) return undefined
  return offsets
}

export async function recordCompletedCapture(completed: CompletedCapture) {
  const stages = await analyseSolve(completed.scramble, completed.events, createId())
  const { startedAt, endedAt } = toWallClock(completed.startedAt, completed.endedAt)
  const record: SolveRecord = {
    id: createId(),
    sessionId: 'default',
    puzzle: '3x3x3',
    scramble: completed.scramble,
    scrambleGenerator: 'cubing.js-333',
    startedAt,
    endedAt,
    penalty: completed.penalty,
    analysisVersion: ANALYSIS_VERSION,
    rawEventIds: [],
    moves: completed.moves,
    // The rhythm of the solve, kept as offsets from the first move so playback can run at
    // the speed it was actually turned. Raw events are not persisted, so without this the
    // real timing is gone the moment the capture ends.
    moveOffsetsMs: moveOffsets(completed.events),
    gyro: completed.gyro,
    gyroReference: completed.gyroReference,
    deviceId: completed.deviceName,
    source: 'cube',
    stateVerified: true,
    verificationDetail: 'state-verified capture'
  }
  await repositories.solves.put(record)
  await Promise.all(stages.map((stage) => repositories.stages.put({ ...stage, solveId: record.id })))
  for (const listener of savedListeners) listener(record)
  return record
}
