import { describe, expect, it } from 'vitest'
import { stageAdvice } from './stageAdvice'
import type { StageRecord } from './models'

const stage = (over: Partial<StageRecord>): StageRecord => ({
  id: 'a', solveId: 's', method: 'CFOP', name: 'F2L 1',
  startEvent: 0, firstMoveEvent: 0, endEvent: 5,
  moveCount: 8, rotationCount: 0, confidence: 1, ...over
})

describe('stageAdvice', () => {
  it('says nothing about a stage that is fine', () => {
    const one = stage({ recognitionMs: 200, executionMs: 1_000 })
    expect(stageAdvice(one, [one])).toBeUndefined()
  })

  it('calls out recognition when the pause is most of the stage', () => {
    const one = stage({ recognitionMs: 1_400, executionMs: 900 })
    expect(stageAdvice(one, [one])).toMatch(/Recognition took 1\.40s/)
  })

  it('calls out wasted turns against the optimal solution', () => {
    const one = stage({ recognitionMs: 100, executionMs: 1_500, moveCount: 14, optimalMoveCount: 7 })
    expect(stageAdvice(one, [one])).toMatch(/7 wasted turns/)
  })

  it('calls out the stage that is far slower than the solver’s own others', () => {
    const slow = stage({ id: 'slow', recognitionMs: 100, executionMs: 5_000 })
    const others = [
      stage({ id: 'b', recognitionMs: 100, executionMs: 1_000 }),
      stage({ id: 'c', recognitionMs: 100, executionMs: 1_200 })
    ]
    expect(stageAdvice(slow, [slow, ...others])).toMatch(/this is where the solve went/)
  })
})

describe('better pair advice', () => {
  it('names the cheaper pair and what it was worth, ahead of any other advice', () => {
    const one = stage({
      recognitionMs: 2_000, executionMs: 2_000, moveCount: 14, optimalMoveCount: 6,
      betterSlot: { slot: 'BR', moves: ['R', 'U', "R'"], saved: 8 }
    })
    expect(stageAdvice(one, [one])).toBe('The BR pair was 8 moves cheaper here')
  })
})
