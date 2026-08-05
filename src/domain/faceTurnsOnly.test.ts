import { describe, expect, it } from 'vitest'
import { puzzles } from 'cubing/puzzles'
import { faceTurnsOnly } from './faceTurnsOnly'
import { defaultAlgorithms } from './training'

const kpuzzle = await puzzles['3x3x3'].kpuzzle()
const solved = kpuzzle.defaultPattern()

const isFaceTurn = (move: string) => /^[URFDLB][2']?$/.test(move)

describe('faceTurnsOnly', () => {
  it('expands every slice and wide move to the face turns cubing.js agrees with', () => {
    for (const token of ['M', 'E', 'S', 'r', 'l', 'u', 'd', 'f', 'b']) {
      const { moves, rotations } = faceTurnsOnly(token)
      expect(solved.applyAlg([...moves, ...rotations].join(' '))).toEqual(solved.applyMove(token))
    }
  })

  it('expands inverted and doubled slice moves', () => {
    for (const token of ["M'", 'M2', "r'", 'r2', "S'", 'E2']) {
      const { moves, rotations } = faceTurnsOnly(token)
      expect(solved.applyAlg([...moves, ...rotations].join(' '))).toEqual(solved.applyAlg(token))
    }
  })

  it('folds rotations away so the remaining moves plus those rotations reproduce the original', () => {
    const alg = "F' L' U' L U F R U R' U' R U R' y' L2 D' R F' D2"
    const { moves, rotations } = faceTurnsOnly(alg)
    expect(rotations).toEqual(["y'"])
    expect(moves.every(isFaceTurn)).toBe(true)
    expect(solved.applyAlg([...moves, ...rotations].join(' '))).toEqual(solved.applyAlg(alg))
  })

  it('reduces every catalogued algorithm to face turns and stays state-equivalent', () => {
    for (const record of defaultAlgorithms) {
      const { moves, rotations } = faceTurnsOnly(record.algorithm)
      expect(moves.every(isFaceTurn), `${record.name}: ${moves.join(' ')}`).toBe(true)
      expect(
        solved.applyAlg([...moves, ...rotations].join(' ')),
        `${record.name}`
      ).toEqual(solved.applyAlg(record.algorithm))
    }
  })

  it('leaves an algorithm that is already face turns untouched', () => {
    const { moves, rotations } = faceTurnsOnly("R U R' U'")
    expect(moves).toEqual(['R', 'U', "R'", "U'"])
    expect(rotations).toEqual([])
  })
})
