import { describe, expect, it } from 'vitest'
import { readableReconstruction, readableTokens } from './reconstructionText'

const text = (moves: string[]) => readableTokens(moves).map((token) => token.text).join(' ')

describe('readableTokens', () => {
  it('condenses exactly like the reconstruction text does', () => {
    const streams = [
      ["L'", "L'", 'U', 'D', 'D', 'R'],
      ['F', "F'", 'R', 'R', 'R'],
      ['z2', "D'", 'L', 'R', 'D', "R'"],
      ["R'", 'y', "R'", 'U', 'U']
    ]
    for (const moves of streams) {
      expect(text(moves), moves.join(' ')).toBe(readableReconstruction(moves))
    }
  })

  it('keeps each token pointing at the raw moves it came from', () => {
    const tokens = readableTokens(["L'", "L'", 'U', 'D', 'D', 'R'])
    expect(tokens.map((token) => `${token.text}:${token.start}-${token.end}`))
      .toEqual(['L2:0-1', 'U:2-2', 'D2:3-4', 'R:5-5'])
  })

  it('never merges a correction away', () => {
    const tokens = readableTokens(['F', "F'"])
    expect(tokens.map((token) => token.text)).toEqual(['F', "F'"])
    expect(tokens.map((token) => token.end)).toEqual([0, 1])
  })

  it('passes rotations through and breaks the run around them', () => {
    const tokens = readableTokens(['R', 'y', 'R'])
    expect(tokens.map((token) => `${token.text}:${token.start}`)).toEqual(['R:0', 'y:1', 'R:2'])
  })

  it('covers every raw move exactly once, in order', () => {
    const moves = ['D', 'B', "D'", 'B', "B'", "D'", "R'", 'U', 'B', 'B', 'B']
    const tokens = readableTokens(moves)
    expect(tokens[0].start).toBe(0)
    expect(tokens[tokens.length - 1].end).toBe(moves.length - 1)
    for (const [index, token] of tokens.entries()) {
      if (index === 0) continue
      expect(token.start).toBe(tokens[index - 1].end + 1)
    }
  })
})
