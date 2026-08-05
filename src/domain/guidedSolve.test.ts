import { describe, expect, it } from 'vitest'
import { areAlgsEquivalent, guidedMove, normalizeSolutionMoves, solveGuidedPosition } from './guidedSolve'

describe('guided solve plan', () => {
  it('normalizes a solver continuation into individual next moves', () => {
    expect(normalizeSolutionMoves("R U2 F'")).toEqual(['R', 'U2', "F'"])
  })

  it('reveals one move at a time without exposing later moves', () => {
    const moves = ['R', 'U2', "F'"]

    expect(guidedMove(moves, 0)).toEqual({ move: 'R', remaining: 3, complete: false })
    expect(guidedMove(moves, 2)).toEqual({ move: "F'", remaining: 1, complete: false })
    expect(guidedMove(moves, 3)).toEqual({ move: undefined, remaining: 0, complete: true })
  })

  it('solves the reconstructed 3x3 position instead of assuming an inverse scramble', async () => {
    await expect(solveGuidedPosition('R', [])).resolves.toEqual(["R'"])
    await expect(solveGuidedPosition('R', ["R'"])).resolves.toEqual([])
  })

  it('keeps whole-cube rotations explicit when comparing slice identities', async () => {
    await expect(areAlgsEquivalent("R L'", 'x M')).resolves.toBe(true)
    await expect(areAlgsEquivalent("R L'", "M'")).resolves.toBe(false)
    await expect(areAlgsEquivalent("U D'", 'y E')).resolves.toBe(true)
    await expect(areAlgsEquivalent("F B'", "z S'")).resolves.toBe(true)
  })
})
