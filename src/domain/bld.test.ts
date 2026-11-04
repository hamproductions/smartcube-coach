import { describe, expect, it } from 'vitest'
import { generateBldDrill, normalizeLetterScheme, traceMemo, validateCornerMemo } from './bld'

describe('BLD drill configuration', () => {
  it('maps generated cycles through a reproducible custom lettering scheme', () => {
    const scheme = normalizeLetterScheme('ZYXWVUTSRQPONMLKJIHGFEDC')
    const first = generateBldDrill('memo-42', 'Z', scheme)
    const second = generateBldDrill('memo-42', 'Z', scheme)

    expect(first).toEqual(second)
    expect(first.buffer).toBe('Z')
    expect(first.memo).not.toContain('Z')
    expect(first.letterScheme).toBe('ZYXWVUTSRQPONMLKJIHGFEDC')
  })

  it('rejects incomplete or duplicate lettering schemes', () => {
    expect(() => normalizeLetterScheme('ABCDEFGHIJKLMNOPQRSTUVW')).toThrow('24 unique letters')
    expect(() => normalizeLetterScheme('ABCDEFGHIJKLMNOPQRSTUVW A')).toThrow('24 unique letters')
  })

  it('derives memo cycles from a reproducible cubie scramble instead of shuffled letters', () => {
    const drill = generateBldDrill('edge-cycles', 'A')

    expect(drill.scramble.split(' ')).toHaveLength(25)
    expect(drill.permutation).toHaveLength(24)
    expect(drill.memo.replaceAll(/\s+/g, '').split('').every((letter) => drill.letterScheme.includes(letter))).toBe(true)
  })

  it('derives corner memo cycles from the same legal cubie state', () => {
    const drill = generateBldDrill('corner-cycles', 'A')

    expect(drill.cornerPermutation).toHaveLength(24)
    expect(validateCornerMemo(drill, drill.cornerMemo)).toBe(true)
  })

  it('derives edge flips and corner twists from the same cubie state', () => {
    const drill = generateBldDrill('orientation-cycles', 'A')

    expect(drill.flippedEdges).toBeGreaterThanOrEqual(0)
    expect(drill.twistedCorners).toBeGreaterThanOrEqual(0)
    expect(drill.flippedEdges).toBeLessThanOrEqual(12)
    expect(drill.twistedCorners).toBeLessThanOrEqual(8)
  })
})

function shoot(permutation: number[], perPiece: number, bufferSticker: number, targets: number[]) {
  const at = new Array<number>(permutation.length)
  permutation.forEach((location, home) => { at[location] = home })
  const pieceOf = (sticker: number) => Math.floor(sticker / perPiece)
  for (const target of targets) {
    for (let k = 0; k < perPiece; k += 1) {
      const from = pieceOf(bufferSticker) * perPiece + ((bufferSticker % perPiece) + k) % perPiece
      const to = pieceOf(target) * perPiece + ((target % perPiece) + k) % perPiece
      ;[at[from], at[to]] = [at[to], at[from]]
    }
  }
  return at
}

function randomPermutation(seed: number, pieces: number, perPiece: number) {
  let state = seed
  const next = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 2 ** 32 }
  const order = [...Array(pieces).keys()]
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1))
    ;[order[index], order[swap]] = [order[swap], order[index]]
  }
  const permutation = new Array<number>(pieces * perPiece)
  order.forEach((location, piece) => {
    const twist = Math.floor(next() * perPiece)
    for (let k = 0; k < perPiece; k += 1) permutation[piece * perPiece + k] = location * perPiece + ((k + twist) % perPiece)
  })
  return permutation
}

describe('memo tracing', () => {
  it('swapping the buffer with each memo target in order puts every piece home, leaving only the in-place twists it counted', () => {
    for (const [pieces, perPiece] of [[12, 2], [8, 3]]) {
      for (let seed = 1; seed <= 300; seed += 1) {
        const permutation = randomPermutation(seed * 7919 + pieces, pieces, perPiece)
        const buffer = (seed % pieces) * perPiece
        const trace = traceMemo(permutation, perPiece, buffer)
        const at = shoot(permutation, perPiece, buffer, trace.targets)
        const misplaced = [...Array(pieces).keys()].filter((piece) => Math.floor(at[piece * perPiece] / perPiece) !== piece)
        const twisted = [...Array(pieces).keys()].filter((piece) => piece !== buffer / perPiece && Math.floor(at[piece * perPiece] / perPiece) === piece && at[piece * perPiece] !== piece * perPiece)
        expect(misplaced).toEqual([])
        expect(twisted.length).toBe(trace.misoriented)
      }
    }
  })

  it('includes the first target of a cycle break and never memorises the buffer piece', () => {
    const permutation = randomPermutation(42, 12, 2)
    const trace = traceMemo(permutation, 2, 0)
    expect(trace.targets.every((sticker) => Math.floor(sticker / 2) !== 0)).toBe(true)
    for (const cycle of trace.cycles.slice(1)) expect(trace.targets).toContain(cycle[0])
  })
})

describe('memo parity', () => {
  it('reports parity exactly when the edge memo has an odd number of targets', () => {
    for (let round = 1; round <= 60; round += 1) {
      const drill = generateBldDrill(`parity-${round}`, 'A')
      const count = drill.memo.replaceAll(/\s+/g, '').length
      expect(drill.parity).toBe(count % 2 === 1)
    }
  })
})
