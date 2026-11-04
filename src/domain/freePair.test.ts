import { describe, expect, it } from 'vitest'
import type { KPattern, KPuzzle } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { generateFreePairPrompt, gradeFreePair, type FreePairMode, type FreePairPrompt, type FreePairSlot } from './freePair'
import { freePairCases } from './freePairCases'

const SLOT_PIECES: Record<FreePairSlot, { corner: number; edge: number }> = {
  FR: { corner: 4, edge: 8 },
  FL: { corner: 5, edge: 9 },
  BL: { corner: 6, edge: 11 },
  BR: { corner: 7, edge: 10 }
}
const ROTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((a) => ['', 'y', 'y2', "y'"].map((b) => `${a} ${b}`.trim()))
const ROTATION_FOR: Record<string, string> = { BR: 'y', BL: 'y2', FL: "y'" }
const UNDO_ROTATION: Record<string, string> = { y: "y'", y2: 'y2', "y'": 'y' }
const FINISHES: Record<FreePairMode, { aufs: string[]; inserts: string[] }> = {
  normal: { aufs: ['', 'U', 'U2', "U'"], inserts: ["R U R'", "R U' R'", "F' U F", "F' U' F"] },
  '2gen': { aufs: ['U', 'U2', "U'"], inserts: ["F' U F", "F' U' F"] }
}
const plain = (alg: string) => alg.replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ')
const centresHome = (pattern: KPattern) => pattern.patternData.CENTERS.pieces.every((piece, index) => piece === index)

const pairHome = (puzzle: KPuzzle, alg: string, slot: FreePairSlot) => {
  const moved = puzzle.defaultPattern().applyAlg(alg)
  const upright = ROTATIONS.map((rotation) => (rotation ? moved.applyAlg(rotation) : moved)).find(centresHome)
  if (!upright) return false
  const { corner, edge } = SLOT_PIECES[slot]
  const { CORNERS, EDGES } = upright.patternData
  return CORNERS.pieces[corner] === corner && CORNERS.orientation[corner] === 0 && EDGES.pieces[edge] === edge && EDGES.orientation[edge] === 0
}

const upright = (puzzle: KPuzzle, alg: string) => {
  const moved = puzzle.defaultPattern().applyAlg(alg)
  return ROTATIONS.find((rotation) => centresHome(rotation ? moved.applyAlg(rotation) : moved)) ?? ''
}

const afterOption = (puzzle: KPuzzle, prompt: FreePairPrompt, option: string) => {
  const played = `${prompt.setup} ${plain(option)}`
  return [played, upright(puzzle, played)].filter(Boolean).join(' ')
}

const freeAccordingToCubing = (puzzle: KPuzzle, prompt: FreePairPrompt, option: string, mode: FreePairMode) => {
  const rotation = ROTATION_FOR[prompt.slot]
  const start = afterOption(puzzle, prompt, option)
  return FINISHES[mode].aufs.some((auf) => FINISHES[mode].inserts.some((insert) =>
    pairHome(puzzle, [start, rotation, auf, insert, UNDO_ROTATION[rotation]].filter(Boolean).join(' '), prompt.slot)))
}

describe('free pair', () => {
  it('reproduces a prompt from its seed', () => {
    expect(generateFreePairPrompt('free-pair-001')).toEqual(generateFreePairPrompt('free-pair-001'))
    expect(generateFreePairPrompt('free-pair-001', '2gen')).toEqual(generateFreePairPrompt('free-pair-001', '2gen'))
  })

  it('offers a real case with at least one working and one failing alg', () => {
    for (const mode of ['normal', '2gen'] as const) {
      for (let round = 0; round < 40; round++) {
        const prompt = generateFreePairPrompt(`round-${round}`, mode)
        expect(prompt).toBeDefined()
        if (!prompt) continue
        expect(freePairCases.find((row) => row.name === prompt.caseName)).toBeDefined()
        expect(prompt.finishes.some((finish) => finish !== null)).toBe(true)
        expect(prompt.finishes.some((finish) => finish === null)).toBe(true)
        if (mode === '2gen') expect(prompt.slot).toBe('BR')
      }
    }
  })

  it('grades by whether the chosen alg leaves the pair free', () => {
    const prompt = generateFreePairPrompt('free-pair-001') as FreePairPrompt
    const right = prompt.finishes.findIndex((finish) => finish !== null)
    const wrong = prompt.finishes.findIndex((finish) => finish === null)
    expect(gradeFreePair(prompt, right)).toBe(true)
    expect(gradeFreePair(prompt, wrong)).toBe(false)
  })

  it('agrees with the cubing.js puzzle on every verdict, and leaves the centres home', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    for (const mode of ['normal', '2gen'] as const) {
      for (let round = 0; round < 25; round++) {
        const prompt = generateFreePairPrompt(`check-${round}`, mode) as FreePairPrompt
        expect(centresHome(puzzle.defaultPattern().applyAlg(prompt.setup))).toBe(true)
        prompt.options.forEach((option, index) => {
          expect(freeAccordingToCubing(puzzle, prompt, option, mode), `${prompt.seed} ${mode} ${option}`).toBe(prompt.finishes[index] !== null)
          expect(freeAccordingToCubing(puzzle, prompt, option, 'normal'), `${prompt.seed} normal ${option}`).toBe(prompt.normalFinishes[index] !== null)
        })
      }
    }
  }, 60_000)

  it('names a finish that really solves the pair', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const prompt = generateFreePairPrompt('free-pair-001') as FreePairPrompt
    prompt.options.forEach((option, index) => {
      const finish = prompt.finishes[index]
      if (finish === null) return
      const rotation = ROTATION_FOR[prompt.slot]
      expect(pairHome(puzzle, [afterOption(puzzle, prompt, option), plain(finish), UNDO_ROTATION[rotation]].join(' '), prompt.slot)).toBe(true)
    })
  })
})
