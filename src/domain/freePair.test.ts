import { describe, expect, it } from 'vitest'
import { generateFreePairPrompt, gradeFreePair } from './freePair'

describe('free pair', () => {
  it('grades only the candidate that preserves the target pair', () => {
    const prompt = generateFreePairPrompt('free-pair-001')

    expect(generateFreePairPrompt('free-pair-001')).toEqual(prompt)
    expect(gradeFreePair(prompt, prompt.answer)).toBe(true)
    expect(gradeFreePair(prompt, prompt.answer === 'A' ? 'B' : 'A')).toBe(false)
  })
})
