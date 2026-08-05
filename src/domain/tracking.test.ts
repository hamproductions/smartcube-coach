import { describe, expect, it } from 'vitest'
import { generateEdgeOrientationPrompt, generateEdgeTrackingPrompt, generatePairTrackingPrompt, gradeEdgeOrientation, gradeEdgeTracking, gradePairTracking } from './tracking'

describe('edge tracking', () => {
  it('generates reproducible legal edge-location prompts', () => {
    const prompt = generateEdgeTrackingPrompt('tracking-001')

    expect(generateEdgeTrackingPrompt('tracking-001')).toEqual(prompt)
    expect(prompt.moves).toHaveLength(6)
    expect(['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR']).toContain(prompt.answer)
  })

  it('grades an edge location without accepting a different slot', () => {
    const prompt = generateEdgeTrackingPrompt('tracking-002')

    expect(gradeEdgeTracking(prompt, prompt.answer.toLowerCase())).toBe(true)
    expect(gradeEdgeTracking(prompt, 'ZZ')).toBe(false)
  })

  it('generates and grades an orientation prompt from cubie state', () => {
    const prompt = generateEdgeOrientationPrompt('orientation-001')

    expect(generateEdgeOrientationPrompt('orientation-001')).toEqual(prompt)
    expect(prompt.moves).toHaveLength(6)
    expect(['oriented', 'flipped']).toContain(prompt.answer)
    expect(gradeEdgeOrientation(prompt, prompt.answer.toUpperCase())).toBe(true)
  })

  it('tracks a corner-edge pair through the same legal move stream', () => {
    const prompt = generatePairTrackingPrompt('pair-001')

    expect(generatePairTrackingPrompt('pair-001')).toEqual(prompt)
    expect(prompt.moves).toHaveLength(8)
    expect(gradePairTracking(prompt, prompt.answer.toLowerCase())).toBe(true)
  })
})
