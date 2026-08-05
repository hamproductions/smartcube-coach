import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { optimalCrossMoves } from './crossSolver'

const state = async (alg: string) => (await puzzles['3x3x3'].kpuzzle()).defaultPattern().applyAlg(new Alg(alg))

describe('optimal cross length', () => {
  it('reports zero for a solved cross', async () => {
    expect(await optimalCrossMoves(await state(''))).toBe(0)
  }, 30_000)

  it('matches the length of a known short setup', async () => {
    expect(await optimalCrossMoves(await state('D'))).toBe(1)
    expect(await optimalCrossMoves(await state('R2 D'))).toBe(2)
    expect(await optimalCrossMoves(await state("R U R' D2"))).toBe(1)
  }, 30_000)

  it('never exceeds eight moves, the known worst case for a cross', async () => {
    const scrambles = [
      "F2 R2 D U2 B2 D L2 U' R2 U F R' F2 U' R2 D2 R F' L' F' U'",
      "D2 L2 B2 F2 U L2 U2 B2 U' F2 R' B F2 D U R' F' D2 B'"
    ]

    for (const scramble of scrambles) {
      const depth = await optimalCrossMoves(await state(scramble))
      expect(depth, scramble).toBeDefined()
      expect(depth!, scramble).toBeLessThanOrEqual(8)
      expect(depth!, scramble).toBeGreaterThan(0)
    }
  }, 60_000)

  it('agrees that a solved-cross state stays solved after last-layer moves', async () => {
    expect(await optimalCrossMoves(await state("R U R' U R U2 R'"))).toBe(0)
  }, 30_000)
})

describe('optimal cross in the solver own frame', () => {
  it('never claims an optimum shorter than the moves actually used', async () => {
    const { simulateCfopSolve } = await import('./cfopSimulation')
    const { segmentCfop } = await import('./reconstruction')

    for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
      const simulated = await simulateCfopSolve(seed)
      const stages = await segmentCfop(simulated.scramble, simulated.events, `sim-${seed}`)
      const cross = stages.find((stage) => stage.name === 'Cross')!

      expect(cross.optimalMoveCount, `${seed} optimum present`).toBeDefined()
      expect(cross.optimalMoveCount!, `${seed} optimum ≤ actual`).toBeLessThanOrEqual(cross.moveCount)
      expect(cross.optimalMoveCount!, `${seed} optimum sane`).toBeGreaterThanOrEqual(0)
    }
  }, 180_000)

  it('matches the moves used when a real solve crossed optimally', async () => {
    const { readFileSync } = await import('node:fs')
    const { segmentCfop } = await import('./reconstruction')
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: 1_000 + index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'reco')
    const cross = stages.find((stage) => stage.name === 'Cross')!

    expect(cross.moveCount).toBe(5)
    expect(cross.optimalMoveCount).toBe(5)
  }, 60_000)
})
