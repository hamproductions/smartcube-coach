import { describe, expect, it } from 'vitest'
import type { SolveRecord } from './models'
import { averageOf, effectiveSolveMs } from './statistics'

const solve = (index: number, ms: number, penalty: SolveRecord['penalty'] = 'none'): SolveRecord => ({
  id: `solve-${index}`,
  sessionId: 'session',
  puzzle: '3x3x3',
  scramble: 'R U',
  scrambleGenerator: 'test',
  startedAt: index * 100_000,
  endedAt: index * 100_000 + ms,
  penalty,
  analysisVersion: '1',
  rawEventIds: [],
  moves: []
})

describe('WCA penalty semantics', () => {
  it('adds two seconds to a +2 and removes a DNF from the count', () => {
    expect(effectiveSolveMs(solve(1, 20_000))).toBe(20_000)
    expect(effectiveSolveMs(solve(1, 20_000, '+2'))).toBe(22_000)
    expect(effectiveSolveMs(solve(1, 20_000, 'dnf'))).toBeUndefined()
  })

  it('counts a +2 at its penalised time inside an average', () => {
    const times = [20_000, 21_000, 22_000, 23_000, 24_000]
    const clean = averageOf(times.map((ms, index) => solve(index + 1, ms)), 5)
    const penalised = averageOf(times.map((ms, index) => solve(index + 1, ms, index === 2 ? '+2' : 'none')), 5)

    expect(clean).toBe(22_000)
    expect(penalised).toBeGreaterThan(clean!)
  })

  it('trims a +2 away when it becomes the slowest solve, exactly like WCA', () => {
    const flat = [20_000, 20_000, 20_000, 20_000, 20_000]

    expect(averageOf(flat.map((ms, index) => solve(index + 1, ms, index === 0 ? '+2' : 'none')), 5)).toBe(20_000)
  })

  it('lets an ao5 survive exactly one DNF and fail on two', () => {
    const one = averageOf([solve(1, 20_000, 'dnf'), solve(2, 20_000), solve(3, 21_000), solve(4, 22_000), solve(5, 23_000)], 5)
    const two = averageOf([solve(1, 20_000, 'dnf'), solve(2, 20_000, 'dnf'), solve(3, 21_000), solve(4, 22_000), solve(5, 23_000)], 5)

    expect(one).toBeGreaterThan(0)
    expect(two).toBeUndefined()
  })

  it('never reports a mean of three that contains a DNF', () => {
    expect(averageOf([solve(1, 20_000, 'dnf'), solve(2, 20_000), solve(3, 21_000)], 3)).toBeUndefined()
  })
})
