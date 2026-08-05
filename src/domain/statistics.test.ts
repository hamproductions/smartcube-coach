import { describe, expect, it } from 'vitest'
import type { SolveRecord } from './models'
import { averageOf, bestAverageOf, bestSingle, inSession, personalBestTarget } from './statistics'

function bruteForceBestAverageOf(solves: SolveRecord[], count: number) {
  const ordered = [...solves].sort((left, right) => left.endedAt - right.endedAt)
  let best: number | undefined
  for (let index = count; index <= ordered.length; index += 1) {
    const value = averageOf(ordered.slice(index - count, index), count)
    if (value !== undefined && (best === undefined || value < best)) best = value
  }
  return best
}

describe('personal bests and session scoping', () => {
  const solve = (id: string, sessionId: string, ms: number, penalty: SolveRecord['penalty'] = 'none'): SolveRecord => ({
    id, sessionId, puzzle: '3x3x3', scramble: '', scrambleGenerator: 'test',
    startedAt: 0, endedAt: ms, penalty, analysisVersion: '1', rawEventIds: [], moves: []
  })

  it('reports the best single across all sessions and within one', () => {
    const solves = [solve('a', 's1', 12_000), solve('b', 's1', 9_000), solve('c', 's2', 15_000)]
    expect(bestSingle(solves)).toBe(9_000)
    expect(bestSingle(inSession(solves, 's2'))).toBe(15_000)
  })

  it('ignores DNFs when reporting a best single', () => {
    const solves = [solve('a', 's1', 12_000), solve('b', 's1', 5_000, 'dnf')]
    expect(bestSingle(solves)).toBe(12_000)
  })

  it('finds the best rolling average of five across the history', () => {
    const times = [20_000, 19_000, 18_000, 10_000, 11_000, 12_000, 13_000, 14_000]
    const solves = times.map((ms, index) => solve(`s${index}`, 's1', ms))
    const best = bestAverageOf(solves, 5)
    const rolling = averageOf(solves.slice(3, 8), 5)
    expect(best).toBeLessThanOrEqual(rolling as number)
    expect(best).toBeDefined()
  })

  describe('personal best target', () => {
    const ordered = (times: number[]): SolveRecord[] => times.map((ms, index) => ({
      id: `s${index}`, sessionId: 's1', puzzle: '3x3x3', scramble: '', scrambleGenerator: 'test',
      startedAt: index * 100_000, endedAt: index * 100_000 + ms, penalty: 'none', analysisVersion: '1', rawEventIds: [], moves: []
    }))

    it('returns a time that beats the best average and one millisecond slower that does not', () => {
      const solves = ordered([30_000, 30_000, 30_000, 30_000, 30_000, 20_000, 12_000, 11_000, 10_000])
      const best = bestAverageOf(solves, 5) as number
      const target = personalBestTarget(solves, 5) as number

      expect(target).toBeGreaterThan(0)

      const recent = [...solves].sort((left, right) => right.endedAt - left.endedAt).slice(0, 4)
      const startedAt = Math.max(...solves.map((solve) => solve.endedAt)) + 1
      const withTime = (ms: number) => averageOf([...recent, { ...recent[0], id: 'next', startedAt, endedAt: startedAt + ms, penalty: 'none' as const }], 5) as number

      expect(withTime(target)).toBeLessThan(best)
      expect(withTime(target + 1)).toBeGreaterThanOrEqual(best)
    })

    it('returns nothing when even an instant solve cannot beat the standing average', () => {
      const solves = ordered([10_000, 10_000, 10_000, 10_000, 10_000, 60_000, 60_000, 60_000, 60_000])
      expect(personalBestTarget(solves, 5)).toBeUndefined()
    })

    it('returns nothing before there are enough solves to complete a window', () => {
      expect(personalBestTarget(ordered([10_000, 11_000]), 5)).toBeUndefined()
    })
  })

  describe('incremental best-average matches brute-force recompute', () => {
    it('agrees with a naive per-window recompute across a randomized history with DNFs and +2s', () => {
      let seed = 42
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }
      const penalties: SolveRecord['penalty'][] = ['none', 'none', 'none', 'none', '+2', 'dnf']
      const history: SolveRecord[] = []
      for (let index = 0; index < 220; index += 1) {
        const penalty = penalties[Math.floor(random() * penalties.length)]
        const duration = 8_000 + Math.floor(random() * 20_000)
        history.push({
          id: `r${index}`,
          sessionId: 's1',
          puzzle: '3x3x3',
          scramble: '',
          scrambleGenerator: 'test',
          startedAt: index * 100_000,
          endedAt: index * 100_000 + duration,
          penalty,
          analysisVersion: '1',
          rawEventIds: [],
          moves: []
        })
      }

      for (const count of [5, 12, 50, 100]) {
        expect(bestAverageOf(history, count)).toBe(bruteForceBestAverageOf(history, count))
      }
    })
  })
})
