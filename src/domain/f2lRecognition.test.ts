import { readFileSync } from 'node:fs'
import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { f2lCatalogue } from './f2lCatalogue'
import { buildF2lIndex, recognizeF2l } from './f2lRecognition'
import { f2lCaseOfStage, segmentCfop } from './reconstruction'

describe('recognizeF2l', () => {
  it('names every catalogue case from the position it starts in', async () => {
    const kpuzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = kpuzzle.defaultPattern()

    for (const entry of f2lCatalogue) {
      const state = solved.applyAlg(new Alg(entry.algorithm).invert())
      const recognized = await recognizeF2l(state, entry.slot)
      expect(recognized, entry.name).toBeDefined()
      expect(recognized?.slot).toBe(entry.slot)
    }
  }, 60_000)

  it('reads through an AUF, because the same pair one U turn away is the same case', async () => {
    const kpuzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = kpuzzle.defaultPattern()
    const entry = f2lCatalogue.find((candidate) => candidate.caseNumber === 4 && candidate.slot === 'FR')!
    const state = solved.applyAlg(new Alg(entry.algorithm).invert())

    const base = await recognizeF2l(state, 'FR')
    expect(base?.id).toBe('f2l-fr-4')
    for (const auf of ['U', 'U2', "U'"]) {
      const recognized = await recognizeF2l(state.applyAlg(auf), 'FR')
      expect(recognized?.id, auf).toBe(base?.id)
    }
  }, 60_000)

  it('does not confuse one slot for another', async () => {
    const index = await buildF2lIndex()
    for (const [signature, recognized] of index) {
      expect(signature.startsWith(`${recognized.slot}|`)).toBe(true)
    }
  })

  it('scans forward when the pair is buried at stage entry', async () => {
    const kpuzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = kpuzzle.defaultPattern()
    const entry = f2lCatalogue.find((candidate) => candidate.caseNumber === 4 && candidate.slot === 'FR')!
    const caseState = solved.applyAlg(new Alg(entry.algorithm).invert())
    // B drags the pair out of the top layer and into the back slice, which no catalogued
    // case describes — the 41 cases only cover the pair in the top layer or its own slot.
    const buried = caseState.applyAlg('B')
    expect(await recognizeF2l(buried, 'FR')).toBeUndefined()

    const segment = ["B'", ...entry.algorithm.split(/\s+/)].map((move, index) => ({ move, timestamp: index * 100 }))
    const found = await f2lCaseOfStage(buried, 'FR', segment, '', [])
    expect(found?.id).toBe('f2l-fr-4')
  }, 60_000)

  it('names the F2L cases of a real solve', async () => {
    const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as {
      scramble: string
      moves: string[]
    }
    const events = solve.moves.map((move, index) => ({ move, timestamp: 1_000 + index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'reco-13444')
    const f2l = stages.filter((stage) => stage.name.startsWith('F2L') && stage.slot)
    expect(f2l.length).toBeGreaterThan(0)
    expect(f2l.filter((stage) => stage.caseName).length).toBeGreaterThan(0)
  }, 60_000)
})
