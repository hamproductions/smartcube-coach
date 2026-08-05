import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { simplifyRotationEvents, type TimestampedMove } from './reconstruction'

const asEvents = (moves: string[]): TimestampedMove[] =>
  moves.map((move, index) => ({ move, timestamp: index * 100 }))

const stateAfter = async (moves: string[]) => {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  return moves.reduce((pattern, move) => pattern.applyAlg(new Alg(move)), puzzle.defaultPattern())
}

describe('simplifyRotationEvents', () => {
  it('collapses a long rotation run to at most two rotations with identical final state', async () => {
    const original = ["R", 'x', 'y', 'x', 'y', 'x', "U'", 'F2']
    const events = simplifyRotationEvents(asEvents(original))
    const runStart = events.findIndex((event) => /^[xyz]/i.test(event.move))
    const run = events.filter((event) => /^[xyz]/i.test(event.move))

    expect(runStart).toBeGreaterThanOrEqual(0)
    expect(run.length).toBeLessThanOrEqual(2)

    const originalState = await stateAfter(original)
    const simplifiedState = await stateAfter(events.map((event) => event.move))
    expect(simplifiedState.isIdentical(originalState)).toBe(true)
  })

  it('leaves non-rotation moves untouched and in order', () => {
    const original = ['R', "U'", 'F2', 'L']
    const events = simplifyRotationEvents(asEvents(original))
    expect(events.map((event) => event.move)).toEqual(original)
  })

  it('drops a rotation run that cancels back to identity', async () => {
    const original = ["R", 'y', "y'", 'U']
    const events = simplifyRotationEvents(asEvents(original))
    expect(events.map((event) => event.move)).toEqual(['R', 'U'])

    const originalState = await stateAfter(original)
    const simplifiedState = await stateAfter(events.map((event) => event.move))
    expect(simplifiedState.isIdentical(originalState)).toBe(true)
  })

  it('preserves timestamps for untouched moves and assigns the run end timestamp to simplified rotations', () => {
    const original = ["R", 'x', 'x', 'x', 'x', "U'"]
    const events = simplifyRotationEvents(asEvents(original))
    expect(events[0]).toEqual({ move: 'R', timestamp: 0 })
    expect(events[events.length - 1]).toEqual({ move: "U'", timestamp: 500 })
  })

  it('handles multiple scrambled solves end to end with identical resulting state', async () => {
    const original = [
      "F2", "R2", "D", "U2", "B2", "D", "L2", "y", "y", "y'", "x2", "x'", "y",
      "R'", "F2", "U'", "R2", "D2", "R", "F'", "L'", "F'", "U'"
    ]
    const events = simplifyRotationEvents(asEvents(original))
    const originalState = await stateAfter(original)
    const simplifiedState = await stateAfter(events.map((event) => event.move))
    expect(simplifiedState.isIdentical(originalState)).toBe(true)
  })
})
