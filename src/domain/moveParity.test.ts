import { describe, expect, it } from 'vitest'
import {
  IDENTITY,
  getSliceForPair,
  isSliceCandidate,
  remapMoveForPlayer,
  updateSliceOrientation,
} from './moveParity'

describe('moveParity (ported from cubedex smartcube-parity.ts)', () => {
  it('recognises single-face quarter/double turns as slice candidates', () => {
    expect(isSliceCandidate('R')).toBe(true)
    expect(isSliceCandidate("L'")).toBe(true)
    expect(isSliceCandidate('U2')).toBe(true)
    expect(isSliceCandidate('')).toBe(false)
    expect(isSliceCandidate('M')).toBe(false)
  })

  it('collapses an opposite-face pair into the slice move it represents', () => {
    expect(getSliceForPair("R'", 'L')).toBe("M'")
    expect(getSliceForPair('L', "R'")).toBe("M'")
    expect(getSliceForPair('R', "L'")).toBe('M')
    expect(getSliceForPair('R2', 'L2')).toBe('M2')
    expect(getSliceForPair("F'", 'B')).toBe('S')
    expect(getSliceForPair("D'", 'U')).toBe('E')
  })

  it('returns null for a pair that is not an opposite-face slice', () => {
    expect(getSliceForPair('R', 'U')).toBeNull()
    expect(getSliceForPair('R', 'R')).toBeNull()
  })

  it('accumulates slice orientation and remaps later single-face moves through it', () => {
    const afterM = updateSliceOrientation(IDENTITY, "M'")
    // M' rotates the cube like x: U->F face mapping.
    expect(afterM.U).toBe('F')
    const remapped = remapMoveForPlayer('U', afterM)
    // A "U" sensor reading after an M' slice visually means D was turned.
    expect(remapped[0]).not.toBe('U')
  })

  it('leaves non-face tokens (rotations already resolved) untouched by remap', () => {
    expect(remapMoveForPlayer("M'", IDENTITY)).toBe("M'")
  })
})
