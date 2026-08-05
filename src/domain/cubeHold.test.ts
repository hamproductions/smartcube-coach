import { describe, expect, it } from 'vitest'
import { holdPermutation, viewRotationForHold } from './cubeHold'

// The rotation is applied AFTER the moves, purely to show the cube the way the solver holds
// it. Yellow on top with green in front is the usual CFOP hold: white cross on the bottom.
describe('viewRotationForHold', () => {
  it('needs no rotation for the scheme cubing.js already draws', () => {
    // White up, green front is the library's own orientation.
    expect(viewRotationForHold('white', 'green')).toBe('')
  })

  it('flips the cube over for a yellow top with green in front', () => {
    expect(viewRotationForHold('yellow', 'green')).toBe('z2')
  })

  it('handles a hold on any adjacent pair', () => {
    expect(viewRotationForHold('yellow', 'red')).toBe("z2 y'")
    expect(viewRotationForHold('red', 'white')).toBe("z' y'")
  })

  it('asks for nothing when the pair is not a hold a cube can take', () => {
    expect(viewRotationForHold('white', 'yellow')).toBe('')
  })
})

describe('holdPermutation', () => {
  it('is the identity when no rotation is needed', () => {
    expect(holdPermutation('')).toEqual({ U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' })
  })

  it('maps the faces a z2 flip swaps, so appended moves stay in the rotated frame', () => {
    const perm = holdPermutation('z2')
    expect(perm.U).toBe('D')
    expect(perm.D).toBe('U')
    expect(perm.R).toBe('L')
    expect(perm.L).toBe('R')
    // z2 spins about the F-B axis, so those two stay put.
    expect(perm.F).toBe('F')
    expect(perm.B).toBe('B')
  })
})

describe('holdPermutation on multi-token rotations', () => {
  // A single token folds the same either way, so only a two-token hold catches the order.
  it('matches the cube the rotation actually produces', async () => {
    const { puzzles } = await import('cubing/puzzles')
    const { Alg } = await import('cubing/alg')
    const { remapMoveForPlayer } = await import('./cubedex/smartcubeParity')
    const kpuzzle = await puzzles['3x3x3'].kpuzzle()

    // Every rotation the hold table can produce, against move sequences that include primes,
    // doubles and slices — a permutation that is right for face turns can still be wrong for
    // M/S/E, and holds differ by more than one token.
    const rotations = ['', 'y', "y'", 'y2', 'z2', "z2 y'", 'z2 y', 'z2 y2', 'z', 'z y2', 'z y',
      "z y'", "z'", "z' y2", "z' y'", "z' y", "x' y", "x' y'", "x'", "x' y2", 'x y', "x y'", 'x y2', 'x']
    for (const rotation of rotations) {
      const perm = holdPermutation(rotation)
      // Face turns only: a face permutation can relabel those, and they are all the cube
      // reports. Slice and wide moves need more than a relabel, so Cube3D re-seeds for them
      // rather than remapping (see its plainFaceTurns guard).
      const moves = ['R', 'U2', "R'", "U'", "F'", 'D', 'F', 'L2', "B'"]
      const remapped = moves.map((move) => remapMoveForPlayer(move, perm)).join(' ')

      // What the player shows: rotation first, then the remapped moves.
      const shown = kpuzzle.defaultPattern().applyAlg(Alg.fromString(`${rotation} ${remapped}`))
      // What the solver actually did, then simply viewed from the rotated angle.
      const truth = kpuzzle.defaultPattern().applyAlg(Alg.fromString(moves.join(' '))).applyAlg(Alg.fromString(rotation))

      expect(shown.isIdentical(truth), rotation).toBe(true)
    }
  })
})
