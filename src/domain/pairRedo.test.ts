import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { buildPairRedo } from './pairRedo'
import { simulateCfopSolve } from './cfopSimulation'
import { segmentCfop } from './reconstruction'
import type { StageRecord } from './models'

describe('redo an F2L pair from its exact state', () => {
  it('returns a shorter-or-equal route that actually solves the pair from the recorded state', async () => {
    const simulated = await simulateCfopSolve('redo-demo')
    const solve = { scramble: simulated.scramble, moves: simulated.moves }
    const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim')
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const slots: Record<string, { corner: number; edge: number }> = {
      FR: { corner: 4, edge: 8 }, FL: { corner: 5, edge: 9 }, BL: { corner: 6, edge: 11 }, BR: { corner: 7, edge: 10 }
    }
    let checked = 0

    for (const stage of stages.filter((entry): entry is StageRecord & { slot: string } => Boolean(entry.slot))) {
      const redo = await buildPairRedo(solve, stage)
      if (!redo) continue
      checked += 1

      expect(redo.optimalMoves, `${redo.slot} optimum ≤ yours`).toBeLessThanOrEqual(redo.yourMoves)
      expect(redo.optimalMoves, `${redo.slot} optimum positive`).toBeGreaterThan(0)
      expect(redo.saved).toBe(redo.yourMoves - redo.optimalMoves)

      const before = puzzle.defaultPattern().applyAlg(new Alg(redo.setup))
      const rotations = redo.yours.split(' ').filter((move) => /^[xyz]/i.test(move))
      const oriented = rotations.length ? before.applyAlg(new Alg(rotations.join(' '))) : before
      const framed = stage.frame
        ? puzzle.defaultPattern().applyAlg(new Alg(stage.frame).invert()).applyTransformation(oriented.experimentalToTransformation()!)
        : oriented
      const after = framed.applyAlg(new Alg(redo.optimal))
      const target = slots[redo.slot]

      expect(after.patternData.CORNERS.pieces[target.corner], `${redo.slot} corner placed`).toBe(target.corner)
      expect(after.patternData.CORNERS.orientation[target.corner], `${redo.slot} corner oriented`).toBe(0)
      expect(after.patternData.EDGES.pieces[target.edge], `${redo.slot} edge placed`).toBe(target.edge)
      expect(after.patternData.EDGES.orientation[target.edge], `${redo.slot} edge oriented`).toBe(0)
      for (const cross of [4, 5, 6, 7]) {
        expect(after.patternData.EDGES.pieces[cross], `${redo.slot} keeps cross`).toBe(cross)
        expect(after.patternData.EDGES.orientation[cross], `${redo.slot} keeps cross oriented`).toBe(0)
      }
    }

    expect(checked, 'at least one pair produced a redo').toBeGreaterThan(0)
  }, 180_000)

  it('returns nothing for a stage without a slot', async () => {
    const simulated = await simulateCfopSolve('redo-demo')
    const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim')
    const cross = stages.find((stage) => stage.name === 'Cross')!

    expect(await buildPairRedo({ scramble: simulated.scramble, moves: simulated.moves }, cross)).toBeUndefined()
  }, 60_000)
})
