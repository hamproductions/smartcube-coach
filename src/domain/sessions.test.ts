import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SESSION_ID,
  DEFAULT_SESSION_NAME,
  createDefaultSession,
  createSession,
  orderSolvesForSession,
  solveIdsNeedingMigration,
  sortSessionsByCreated
} from './sessions'
import type { SolveRecord } from './models'

const solve = (overrides: Partial<SolveRecord>): SolveRecord => ({
  id: 'solve-1',
  sessionId: 'session-a',
  puzzle: '3x3x3',
  scramble: 'R U F',
  scrambleGenerator: 'cubing.js-333',
  startedAt: 0,
  endedAt: 1_000,
  penalty: 'none',
  analysisVersion: '1',
  rawEventIds: [],
  moves: [],
  ...overrides
})

describe('sessions', () => {
  it('creates a default session with the fixed id and name', () => {
    const session = createDefaultSession(1_000)
    expect(session).toEqual({ id: DEFAULT_SESSION_ID, name: DEFAULT_SESSION_NAME, createdAt: 1_000, puzzle: '333' })
  })

  it('creates a named session and falls back to the default name when blank', () => {
    const named = createSession('abc', 'Weeknight ao100', 500)
    expect(named).toEqual({ id: 'abc', name: 'Weeknight ao100', createdAt: 500, puzzle: '333' })
    const blank = createSession('def', '   ', 500)
    expect(blank.name).toBe(DEFAULT_SESSION_NAME)
  })

  it('sorts sessions oldest first', () => {
    const sessions = [createSession('b', 'B', 200), createSession('a', 'A', 100)]
    expect(sortSessionsByCreated(sessions).map((session) => session.id)).toEqual(['a', 'b'])
  })

  it('flags solves whose sessionId does not match any known session', () => {
    const known = new Set(['default'])
    const solves = [
      solve({ id: '1', sessionId: 'default' }),
      solve({ id: '2', sessionId: 'session-2024-01-01' }),
      solve({ id: '3', sessionId: '' as unknown as string })
    ]
    expect(solveIdsNeedingMigration(solves, known)).toEqual(['2', '3'])
  })

  it('returns solves for a session newest first', () => {
    const solves = [
      solve({ id: '1', sessionId: 'a', endedAt: 1_000 }),
      solve({ id: '2', sessionId: 'a', endedAt: 3_000 }),
      solve({ id: '3', sessionId: 'b', endedAt: 5_000 }),
      solve({ id: '4', sessionId: 'a', endedAt: 2_000 })
    ]
    expect(orderSolvesForSession(solves, 'a').map((entry) => entry.id)).toEqual(['2', '4', '1'])
  })
})
