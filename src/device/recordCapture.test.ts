import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from '../storage/database'
import { recordCompletedCapture, subscribeSolveSaved, toWallClock } from './recordCapture'
import type { CompletedCapture } from './capture'

// This is the only path that persists a captured solve, and it runs from the connection
// provider rather than from a page, so nothing else covers it.
const capture = (): CompletedCapture => ({
  scramble: "R U R' U'",
  moves: ['U', 'R', "U'", "R'"],
  events: [
    { move: 'U', timestamp: 1_000 },
    { move: 'R', timestamp: 1_200 },
    { move: "U'", timestamp: 1_500 },
    { move: "R'", timestamp: 1_900 }
  ],
  startedAt: 1_000,
  endedAt: 1_900,
  penalty: 'none'
})

describe('recordCompletedCapture', () => {
  beforeEach(clearDatabase)
  afterEach(clearDatabase)

  it('persists the capture as a state-verified cube solve with its stages', async () => {
    const record = await recordCompletedCapture(capture())

    const stored = await repositories.solves.all()
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(record.id)
    expect(stored[0].source).toBe('cube')
    expect(stored[0].stateVerified).toBe(true)
    expect(stored[0].moves).toEqual(['U', 'R', "U'", "R'"])
    expect(stored[0].endedAt - stored[0].startedAt).toBe(900)

    const stages = await repositories.stages.all()
    expect(stages.length).toBeGreaterThan(0)
    for (const stage of stages) expect(stage.solveId).toBe(record.id)
  })

  it('notifies each saved-solve listener exactly once, and not after unsubscribing', async () => {
    const seen: string[] = []
    const unsubscribe = subscribeSolveSaved((solve) => seen.push(solve.id))

    const first = await recordCompletedCapture(capture())
    expect(seen).toEqual([first.id])

    unsubscribe()
    await recordCompletedCapture(capture())
    expect(seen).toEqual([first.id])
  })

  it('stores a monotonic-timestamped capture on the wall clock, not in 1970', async () => {
    // capture timestamps can come from performance.now(); stored raw, the session rail
    // showed the solve as "Thu, January 1".
    const record = await recordCompletedCapture(capture())
    const stored = (await repositories.solves.all())[0]
    expect(stored.id).toBe(record.id)
    expect(Math.abs(Date.now() - stored.endedAt)).toBeLessThan(10_000)
    expect(new Date(stored.endedAt).getFullYear()).toBeGreaterThan(2000)
    expect(stored.endedAt - stored.startedAt).toBe(900)
  })
})

describe('toWallClock', () => {
  it('leaves a genuine wall-clock pair untouched', () => {
    const startedAt = Date.now() - 5_000
    const endedAt = Date.now()
    expect(toWallClock(startedAt, endedAt)).toEqual({ startedAt, endedAt })
  })

  it('rebases when either end is monotonic, preserving the measured duration', () => {
    // Two clocks in one pair cannot produce a real duration; it is clamped rather than
    // stored as the decades-long span the subtraction would give.
    const mixed = toWallClock(5_000, Date.now())
    expect(mixed.endedAt - mixed.startedAt).toBeLessThanOrEqual(60 * 60 * 1000)
    expect(new Date(mixed.startedAt).getFullYear()).toBeGreaterThan(2000)

    const monotonic = toWallClock(1_000, 3_500)
    expect(monotonic.endedAt - monotonic.startedAt).toBe(2_500)
    expect(new Date(monotonic.startedAt).getFullYear()).toBeGreaterThan(2000)
  })
})
