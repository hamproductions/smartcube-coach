import { describe, expect, it } from 'vitest'
import { generateColorInference, gradeColorInference } from './cognitive'

describe('color inference drill', () => {
  it('generates a reproducible legal corner prompt', () => {
    const first = generateColorInference('corner-42')
    const second = generateColorInference('corner-42')

    expect(first).toEqual(second)
    expect(first.visible).toHaveLength(2)
    expect(first.visible).not.toContain(first.answer)
    expect([
      ['White', 'Green', 'Red'], ['White', 'Red', 'Blue'], ['White', 'Blue', 'Orange'], ['White', 'Orange', 'Green'],
      ['Yellow', 'Red', 'Green'], ['Yellow', 'Blue', 'Red'], ['Yellow', 'Orange', 'Blue'], ['Yellow', 'Green', 'Orange']
    ].map((corner) => corner.sort())).toContainEqual([...first.visible, first.answer].sort())
  })

  it('grades answers without case or whitespace sensitivity', () => {
    const prompt = generateColorInference('corner-42')

    expect(gradeColorInference(prompt, ` ${prompt.answer.toLowerCase()} `)).toBe(true)
    expect(gradeColorInference(prompt, 'yellow')).toBe(false)
  })
})
