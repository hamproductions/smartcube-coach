import { describe, expect, it } from 'vitest'
import { classifyMove, computePhaseMetrics, countEtm, countStm, etps, splitPercent, stps, turnsPerSecond } from './solveMetrics'

describe('classifyMove', () => {
  it('classifies slice moves regardless of modifier', () => {
    expect(classifyMove('M')).toBe('slice')
    expect(classifyMove("M2'")).toBe('slice')
    expect(classifyMove('E')).toBe('slice')
    expect(classifyMove('S')).toBe('slice')
  })

  it('classifies whole-cube rotations regardless of modifier', () => {
    expect(classifyMove('x')).toBe('rotation')
    expect(classifyMove('x2')).toBe('rotation')
    expect(classifyMove("y'")).toBe('rotation')
    expect(classifyMove('z2')).toBe('rotation')
  })

  it('classifies wide moves as regular face turns, not slice moves', () => {
    expect(classifyMove('Rw')).toBe('face')
    expect(classifyMove("Rw2")).toBe('face')
    expect(classifyMove('r')).toBe('face')
    expect(classifyMove("u'")).toBe('face')
  })

  it('classifies plain face moves as face turns', () => {
    expect(classifyMove('U')).toBe('face')
    expect(classifyMove("R'")).toBe('face')
    expect(classifyMove('F2')).toBe('face')
  })
})

describe('countStm', () => {
  it('counts a slice move as 1', () => {
    expect(countStm(['M'])).toBe(1)
    expect(countStm(['M2'])).toBe(1)
    expect(countStm(['E'])).toBe(1)
    expect(countStm(['S'])).toBe(1)
  })

  it('counts a whole-cube rotation as 0', () => {
    expect(countStm(['x'])).toBe(0)
    expect(countStm(['y2'])).toBe(0)
  })

  it('counts wide moves as 1, matching a plain face turn', () => {
    expect(countStm(['Rw'])).toBe(1)
    expect(countStm(['r'])).toBe(1)
  })

  it('sums mixed move lists', () => {
    expect(countStm(['R', 'M', 'x', 'U', "M'"])).toBe(4)
  })
})

describe('countEtm', () => {
  it('counts a slice move as 2', () => {
    expect(countEtm(['M'])).toBe(2)
    expect(countEtm(['M2'])).toBe(2)
    expect(countEtm(['E'])).toBe(2)
    expect(countEtm(['S'])).toBe(2)
  })

  it('counts a whole-cube rotation as 0', () => {
    expect(countEtm(['x'])).toBe(0)
    expect(countEtm(['y2'])).toBe(0)
    expect(countEtm(['z'])).toBe(0)
  })

  it('counts wide moves as 1, matching a plain face turn', () => {
    expect(countEtm(['Rw'])).toBe(1)
    expect(countEtm(['u'])).toBe(1)
  })

  it('sums mixed move lists', () => {
    expect(countEtm(['R', 'M', 'x', 'U', "M'"])).toBe(6)
  })
})

describe('turnsPerSecond', () => {
  it('divides turns by duration in seconds', () => {
    expect(turnsPerSecond(20, 2_000)).toBe(10)
  })

  it('returns undefined when duration is unmeasurable', () => {
    expect(turnsPerSecond(20, undefined)).toBeUndefined()
    expect(turnsPerSecond(20, 0)).toBeUndefined()
    expect(turnsPerSecond(20, -5)).toBeUndefined()
  })
})

describe('stps and etps', () => {
  it('computes rate metrics from a move list and duration', () => {
    expect(stps(['M', 'M', 'R', 'R'], 2_000)).toBe(2)
    expect(etps(['M', 'M', 'R', 'R'], 2_000)).toBe(3)
  })

  it('returns undefined for a phase with no timing rather than fabricating 0', () => {
    expect(stps(['M', 'R'], undefined)).toBeUndefined()
    expect(etps(['M', 'R'], undefined)).toBeUndefined()
  })
})

describe('splitPercent', () => {
  it('computes the phase share of total solve time', () => {
    expect(splitPercent(1_000, 4_000)).toBe(25)
  })

  it('returns undefined when either duration is unmeasurable', () => {
    expect(splitPercent(undefined, 4_000)).toBeUndefined()
    expect(splitPercent(1_000, undefined)).toBeUndefined()
    expect(splitPercent(1_000, 0)).toBeUndefined()
  })
})

describe('computePhaseMetrics', () => {
  it('never fabricates a 0 or 0.00 for an unmeasurable metric', () => {
    const metrics = computePhaseMetrics(['M', 'R'], undefined, undefined)
    expect(metrics.stm).toBe(2)
    expect(metrics.etm).toBe(3)
    expect(metrics.stps).toBeUndefined()
    expect(metrics.etps).toBeUndefined()
    expect(metrics.splitPercent).toBeUndefined()
  })

  it('computes every column when duration is known', () => {
    const metrics = computePhaseMetrics(['M', 'M'], 1_000, 4_000)
    expect(metrics.stm).toBe(2)
    expect(metrics.etm).toBe(4)
    expect(metrics.stps).toBe(2)
    expect(metrics.etps).toBe(4)
    expect(metrics.splitPercent).toBe(25)
  })
})
