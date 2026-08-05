import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { buildLastLayerRedo } from './lastLayerRedo'
import { simulateCfopSolve } from './cfopSimulation'
import { segmentCfop } from './reconstruction'

describe('redo a last-layer case from its exact state', () => {
  it('returns a trained algorithm that actually finishes the stage from that state', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = puzzle.defaultPattern()
    let checked = 0

    for (const seed of ['ll-a', 'll-b', 'll-c']) {
      const simulated = await simulateCfopSolve(seed)
      const solve = { scramble: simulated.scramble, moves: simulated.moves }
      const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim')

      for (const stage of stages.filter((entry) => ['OLL', 'PLL'].includes(entry.name))) {
        const redo = await buildLastLayerRedo(solve, stage)
        if (!redo) continue
        checked += 1

        const start = solved.applyAlg(new Alg(redo.setup))
        const transformation = start.experimentalToTransformation()
        const framed = stage.frame && transformation
          ? solved.applyAlg(new Alg(stage.frame).invert()).applyTransformation(transformation)
          : start
        const after = framed.applyAlg(new Alg(redo.trained))

        if (redo.stage === 'OLL') {
          expect([0, 1, 2, 3].every((index) => after.patternData.EDGES.orientation[index] === 0), `${seed} OLL edges`).toBe(true)
          expect([0, 1, 2, 3].every((index) => after.patternData.CORNERS.orientation[index] === 0), `${seed} OLL corners`).toBe(true)
        } else {
          expect(['', 'U', 'U2', "U'"].some((auf) => after.applyAlg(auf).isIdentical(solved)), `${seed} PLL solves`).toBe(true)
        }

        expect(redo.trainedMoves).toBeGreaterThan(0)
        expect(redo.saved).toBe(Math.max(0, redo.yourMoves - redo.trainedMoves))
      }
    }

    expect(checked, 'at least one last-layer redo was produced').toBeGreaterThan(0)
  }, 180_000)

  it('returns nothing for a skipped last layer or a non-last-layer stage', async () => {
    const simulated = await simulateCfopSolve('ll-a')
    const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim')
    const cross = stages.find((stage) => stage.name === 'Cross')!

    expect(await buildLastLayerRedo({ scramble: simulated.scramble, moves: simulated.moves }, cross)).toBeUndefined()
    expect(await buildLastLayerRedo({ scramble: simulated.scramble, moves: simulated.moves }, { ...cross, name: 'OLL', caseId: 'oll-skip' })).toBeUndefined()
  }, 60_000)
})
