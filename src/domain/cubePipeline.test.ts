import { describe, expect, it } from 'vitest'
import { puzzles } from 'cubing/puzzles'
import { evaluateScramble, generateScramble, nextExpectedMove, scramblePositionOfPattern } from './scramble'
import { segmentCfop, suggestReconstructionCompletions } from './reconstruction'

describe('cube state pipeline', () => {
  it('generates a WCA random-state scramble that actually scrambles the cube', async () => {
    const scramble = await generateScramble()
    const moves = scramble.split(' ').filter(Boolean)
    const sameFaceTwice = moves.some((move, index) => index > 0 && move[0] === moves[index - 1][0])

    expect(moves.length).toBeGreaterThanOrEqual(16)
    expect(sameFaceTwice).toBe(false)
    expect(await evaluateScramble('', scramble)).toBe(false)

    const second = await generateScramble()
    expect(second).not.toBe(scramble)
  }, 60_000)

  it('reports an unfinished scramble as unverified, and says how far it genuinely got', async () => {
    expect(await evaluateScramble('R U F', 'R U')).toBe(false)
    // Two of three moves done, still on the scramble — asked of the cube's position, not of
    // the move history, so it stays true however the solver got there.
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const twoDone = puzzle.defaultPattern().applyAlg('R U')
    expect(await scramblePositionOfPattern(twoDone, ['R', 'U', 'F'])).toBe(2)
  })

  it('verifies opposite-face identities by state rather than surface notation', async () => {
    await expect(evaluateScramble("R L'", 'x M')).resolves.toBe(true)
    await expect(evaluateScramble("R L'", "M'")).resolves.toBe(false)
  })

  it('segments a timestamped solve and preserves solved-state proof', async () => {
    const stages = await segmentCfop('R U', [
      { move: "U'", timestamp: 120 },
      { move: "R'", timestamp: 270 }
    ])

    expect(stages.length).toBeGreaterThan(0)
    expect(stages.at(-1)?.endEvent).toBe(1)
    expect(stages.filter((stage) => stage.name === 'AUF' && stage.moveCount === 0)).toEqual([])
    expect(stages.every((stage) => stage.confidence > 0)).toBe(true)
  })

  it('offers only the remaining moves for a literal reconstruction prefix', () => {
    expect(suggestReconstructionCompletions("R U R'", [
      { id: 'sune', name: 'Sune', algorithm: "R U R' U R U2 R'" },
      { id: 't-perm', name: 'T Perm', algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'" }
    ])).toEqual([
      { id: 'sune', name: 'Sune', remaining: "U R U2 R'" },
      { id: 't-perm', name: 'T Perm', remaining: "U' R' F R2 U' R' U' R U R' F'" }
    ])
  })
})

describe('scramble progress', () => {
  it('treats a partially applied double turn as progress, not divergence', () => {
    const progress = nextExpectedMove(['R', 'U2', 'F'], ['R', 'U'])
    expect(progress.actual).toBeUndefined()
    expect(progress.expected).toBe('U2')
  })

  it('treats an over-turned face as recoverable progress on the same move', () => {
    const progress = nextExpectedMove(['R', 'U', 'F'], ['R', 'U', 'F2'])
    expect(progress.expected).toBe('F')
    expect(progress.actual).toBeUndefined()
    expect(progress.complete).toBe(false)
  })

  it('accepts a double turn reported as two counter-clockwise quarters', () => {
    const progress = nextExpectedMove(['U2'], ["U'", "U'"])
    expect(progress.complete).toBe(true)
    expect(progress.actual).toBeUndefined()
  })

  it('flags a wrong face as a real mistake', () => {
    const progress = nextExpectedMove(['R', 'U', 'F'], ['R', 'U', 'B'])
    expect(progress.actual).toBe('B')
  })
})

describe('scramble divergence reporting', () => {
  it('blames the move where the mistake happened, not the first move', () => {
    const progress = nextExpectedMove(['R', 'U'], ['R', 'L'])
    expect(progress.index).toBe(1)
    expect(progress.expected).toBe('U')
    expect(progress.actual).toBe('L')
  })

  it('reports the next expected move after a correct prefix', () => {
    const progress = nextExpectedMove(['R', 'U', 'F'], ['R', 'U'])
    expect(progress.index).toBe(2)
    expect(progress.expected).toBe('F')
    expect(progress.actual).toBeUndefined()
  })
})
