import { describe, expect, it } from 'vitest'
import { puzzles } from 'cubing/puzzles'
import type { AlgorithmRecord } from '../../../domain/models'
import { matchesCase, routeToCase, toHoldFrame } from './caseState'

const tPerm = { id: 't', set: 'PLL', name: 'T Perm', setup: "R U R' U' R' F R2 U' R' U' R U R' F'", algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'" } as unknown as AlgorithmRecord

describe('setting up a case from wherever the cube is', () => {
  it('routes from a scrambled cube to the case', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const from = puzzle.defaultPattern().applyAlg("R U F' L2 D B'")
    const route = await routeToCase(puzzle, tPerm, from)
    expect(route.length).toBeGreaterThan(0)
    expect(matchesCase(puzzle, tPerm, route, from)).toBe(true)
  })

  it('asks for nothing when the cube already shows the case', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const from = puzzle.defaultPattern().applyAlg(tPerm.setup)
    expect(await routeToCase(puzzle, tPerm, from)).toEqual([])
  })

  it('reads the tracked cube in the hold the solver uses', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const physical = puzzle.defaultPattern().applyAlg('R')
    expect(toHoldFrame(puzzle, physical, 'z2').isIdentical(puzzle.defaultPattern().applyAlg('L'))).toBe(true)
  })
})
