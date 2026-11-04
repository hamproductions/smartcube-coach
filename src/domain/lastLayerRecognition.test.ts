import { readFileSync } from 'node:fs'
import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { ollCases, pllCases } from './algorithmCatalogue'
import { recognizeOll, recognizePll } from './caseRecognition'
import { caseStateOf } from './lastLayer'
import { segmentCfop } from './reconstruction'

/**
 * A real solve's last layer must be NAMED, not called a skip.
 *
 * Recognition used to be pointed at a layer chosen from the locked cross face and then rotated
 * again on top of the stage frame. On a solve whose cross is not on the raw D face that aimed
 * it at the CROSS layer, which is solved by definition by then — so every OLL and PLL of such a
 * solve came back "OLL skip" / "PLL skip", with a dozen moves in the stage.
 */
describe('last layer recognition on a real solve', () => {
  it('names the OLL the solver actually had', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'll-real')
    const oll = stages.find((stage) => stage.name === 'OLL')

    expect(oll, 'the solve has an OLL stage').toBeDefined()
    expect(oll!.moveCount, 'with real moves in it').toBeGreaterThan(0)
    // Nine moves of OLL is not a skip.
    expect(oll!.caseName, 'OLL is named').toBeDefined()
    expect(oll!.caseName).not.toBe('OLL skip')
    expect(oll!.caseId).toMatch(/^oll-\d+$/)
  }, 120_000)

  it('does not call a stage a skip while it is turning that layer', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }
    const events = solve.moves.map((move, index) => ({ move, timestamp: index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'll-skip')

    for (const stage of stages.filter((entry) => entry.name === 'OLL')) {
      if (stage.moveCount >= 5) expect(stage.caseName, `${stage.name} with ${stage.moveCount} moves`).not.toBe('OLL skip')
    }
  }, 120_000)
})

/**
 * On the D layer the corner ring and the edge ring run opposite ways round, so a recogniser that
 * rotates both arrays together stops being AUF-invariant there: one turn of the layer renamed an
 * Aa perm as an Ab perm on a real capture. Every case must read the same wherever the last layer
 * is and however it is aligned.
 */
describe('last layer recognition does not depend on the layer or its alignment', () => {
  const turns = ['', 'D', 'D2', "D'"]

  // The same position with the last layer on D and the centres still solved: conjugated by x2,
  // not rotated, because a rotation would move the centres and be undone on the way in.
  const onBottom = async (top: KPattern) => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const flip = puzzle.algToTransformation(new Alg('x2'))
    const conjugated = flip.invert().applyTransformation(top.experimentalToTransformation()!).applyTransformation(flip)
    return puzzle.defaultPattern().applyTransformation(conjugated)
  }

  it('names every PLL the same on the D layer, before and after any AUF', async () => {
    for (const entry of pllCases) {
      const top = await caseStateOf(entry.algorithm)
      const expected = await recognizePll(top, 'U')
      expect(expected?.name, `${entry.name} on the top layer`).toBe(entry.name)
      const flipped = await onBottom(top)
      for (const before of turns) {
        for (const after of turns) {
          const state = flipped.applyAlg(new Alg([before, after].filter(Boolean).join(' ')))
          expect((await recognizePll(state, 'D'))?.name, `${entry.name} with ${before || 'no'} AUF before and ${after || 'no'} after`).toBe(entry.name)
        }
      }
    }
  }, 120_000)

  it('names every OLL the same on the D layer, whichever way the layer is turned', async () => {
    for (const entry of ollCases) {
      const top = await caseStateOf(entry.algorithm)
      const expected = await recognizeOll(top, 'U')
      expect(expected?.name, `${entry.name} on the top layer`).toBe(entry.name)
      const flipped = await onBottom(top)
      for (const turn of turns) {
        const state = flipped.applyAlg(new Alg(turn))
        expect((await recognizeOll(state, 'D'))?.name, `${entry.name} turned ${turn || 'not at all'}`).toBe(entry.name)
      }
    }
  }, 120_000)
})
