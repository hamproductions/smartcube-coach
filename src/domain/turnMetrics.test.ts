import { describe, expect, it } from 'vitest'
import { turnMetrics } from './turnMetrics'

describe('turn metrics', () => {
  it('counts face, half, slice, wide and rotation turns the way each metric defines them', () => {
    expect(turnMetrics(['R', "U'", 'F2', 'M', "M2'", 'r', 'Rw2', 'y', "x'"])).toEqual({
      htm: 1 + 1 + 1 + 2 + 2 + 1 + 1,
      qtm: 1 + 1 + 2 + 2 + 4 + 1 + 2,
      stm: 7,
      etm: 9
    })
  })
})
