import { describe, expect, it } from 'vitest'
import { generateBldDrill, normalizeLetterScheme, validateCornerMemo } from './bld'

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
    expect(drill.cycles.every((cycle) => cycle[0] === cycle.at(-1))).toBe(true)
    expect(drill.memo.replaceAll(/\s+/g, '').split('').every((letter) => drill.letterScheme.includes(letter))).toBe(true)
  })

  it('derives corner memo cycles from the same legal cubie state', () => {
    const drill = generateBldDrill('corner-cycles', 'A')

    expect(drill.cornerPermutation).toHaveLength(24)
    expect(drill.cornerCycles.every((cycle) => cycle[0] === cycle.at(-1))).toBe(true)
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
