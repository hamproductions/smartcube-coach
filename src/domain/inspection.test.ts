import { describe, expect, it } from 'vitest'
import { crossPlanSucceeds, generateCrossInspectionPrompt } from './inspection'

describe('cross inspection', () => {
  it('accepts a state-valid cross plan instead of an exact expected algorithm', async () => {
    await expect(crossPlanSucceeds('R', "R'")).resolves.toBe(true)
    await expect(crossPlanSucceeds('R', '')).resolves.toBe(false)
  })

  it('generates reproducible inspection scrambles', () => {
    expect(generateCrossInspectionPrompt('cross-001')).toEqual(generateCrossInspectionPrompt('cross-001'))
  })
})
