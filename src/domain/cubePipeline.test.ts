import { describe, expect, it } from 'vitest'
import { evaluateScramble, generateCorrection, generateScramble } from './scramble'
import { segmentCfop } from './reconstruction'

describe('cube state pipeline', () => {
  it('generates a 25-move training scramble without consecutive axes', async () => {
    const moves = (await generateScramble()).split(' ')
    const axis = (move: string) => 'UD'.includes(move[0]) ? 0 : 'LR'.includes(move[0]) ? 1 : 2

    expect(moves).toHaveLength(25)
    expect(moves.every((move, index) => index === 0 || axis(move) !== axis(moves[index - 1]))).toBe(true)
  })

  it('checks final scramble state and creates a valid correction', async () => {
    expect(await evaluateScramble('R U F', 'R U')).toBe(false)
    const correction = generateCorrection('R U F', 'R U')
    expect(await evaluateScramble('R U F', `R U ${correction}`)).toBe(true)
  })

  it('segments a timestamped solve and preserves solved-state proof', async () => {
    const stages = await segmentCfop('R U', [
      { move: "U'", timestamp: 120 },
      { move: "R'", timestamp: 270 }
    ])

    expect(stages.at(-1)?.name).toBe('AUF')
    expect(stages.at(-1)?.endEvent).toBe(1)
    expect(stages.every((stage) => stage.confidence > 0)).toBe(true)
  })
})
