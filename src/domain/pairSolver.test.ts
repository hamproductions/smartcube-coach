import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { optimalCrossPlusPairMoves } from './pairSolver'
import { simulateCfopSolve } from './cfopSimulation'
import { segmentCfop } from './reconstruction'

const state = async (alg: string) => {
  const solved = (await puzzles['3x3x3'].kpuzzle()).defaultPattern()
  return alg ? solved.applyAlg(new Alg(alg).invert()) : solved
}

describe('optimal cross plus one pair', () => {
  it('is zero when the cross and the pair are already solved', async () => {
    expect(await optimalCrossPlusPairMoves(await state(''), 'FR')).toBe(0)
  }, 60_000)

  it('matches the length of a known insert', async () => {
    expect(await optimalCrossPlusPairMoves(await state("R U R'"), 'FR')).toBe(3)
    expect(await optimalCrossPlusPairMoves(await state("U R U' R'"), 'FR')).toBe(4)
  }, 60_000)

  it('never exceeds the moves a real solver used, and never claims a shorter solve than exists', async () => {
    const longer = await optimalCrossPlusPairMoves(await state("R U' R' U R U' R'"), 'FR')

    expect(longer).toBeDefined()
    expect(longer!).toBeGreaterThan(0)
    expect(longer!).toBeLessThanOrEqual(7)
  }, 60_000)

  it('reports a pair optimum inside a simulated solve that never beats the moves used', async () => {
    const simulated = await simulateCfopSolve('pair-route')
    const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim')

    for (const stage of stages.filter((entry) => entry.name.startsWith('F2L') && entry.optimalMoveCount !== undefined)) {
      expect(stage.optimalMoveCount!, `${stage.name} optimum ≤ actual`).toBeLessThanOrEqual(stage.moveCount)
      expect(stage.optimalMoveCount!, `${stage.name} optimum ≥ 1`).toBeGreaterThanOrEqual(1)
    }
  }, 180_000)
})

describe('last-layer execution against the shipped repertoire', () => {
  it('reports the repertoire length for the recognised case', async () => {
    const { simulateCfopSolve: simulate } = await import('./cfopSimulation')
    const { ollCases, pllCases } = await import('./algorithmCatalogue')

    for (const seed of ['alg-a', 'alg-b', 'alg-c']) {
      const simulated = await simulate(seed)
      const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim')

      for (const stage of stages.filter((entry) => ['OLL', 'PLL'].includes(entry.name))) {
        if (!stage.caseId || stage.caseId.endsWith('skip')) continue
        const entry = [...ollCases, ...pllCases].find((item) => item.id === stage.caseId)!
        const expected = entry.algorithm.split(/\s+/).filter(Boolean).filter((move) => !/^[xyz]/i.test(move)).length

        expect(stage.optimalMoveCount, `${seed} ${stage.name}`).toBe(expected)
      }
    }
  }, 180_000)

  it('leaves a skipped last layer without a repertoire comparison', async () => {
    const { readFileSync } = await import('node:fs')
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: 1_000 + index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'reco')

    for (const stage of stages.filter((entry) => entry.caseId?.endsWith('skip'))) {
      expect(stage.optimalMoveCount, stage.name).toBeUndefined()
    }
  }, 60_000)
})
