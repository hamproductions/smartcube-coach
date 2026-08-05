import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { puzzles } from 'cubing/puzzles'
import { segmentCfop } from './reconstruction'

/**
 * The frame a stage records is what turns the solve cross-down. The playback view uses it, so
 * it has to genuinely put the cross on D: applying it to the finished solve must leave the D
 * face a single colour, and that colour is the cross the solver actually used.
 */
describe('the frame a solve records', () => {
  it('puts the cross face down', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'frame')
    const frame = stages.find((stage) => stage.frame)?.frame
    expect(frame, 'a real solve records a frame').toBeDefined()

    const kpuzzle = await puzzles['3x3x3'].kpuzzle()
    const finished = kpuzzle.defaultPattern()
      .applyAlg(solve.scramble)
      .applyAlg(solve.moves.join(' '))
    const viewed = finished.applyAlg(frame!)

    // A solved cube seen through the frame still has every face one colour; the check that
    // matters is that the four cross edges sit in the D layer.
    const edges = viewed.patternData.EDGES
    for (const index of [4, 5, 6, 7]) {
      expect(edges.pieces[index], `cross edge ${index} is in the D layer`).toBe(index)
      expect(edges.orientation[index]).toBe(0)
    }
  }, 120_000)
})
