import type { SessionRecord, SolveRecord } from './models'

export type { SessionRecord }

export const DEFAULT_SESSION_ID = 'default'
export const DEFAULT_SESSION_NAME = 'Default session'

export function createDefaultSession(now: number): SessionRecord {
  return { id: DEFAULT_SESSION_ID, name: DEFAULT_SESSION_NAME, createdAt: now, puzzle: '333' }
}

export function createSession(id: string, name: string, now: number): SessionRecord {
  return { id, name: name.trim() || DEFAULT_SESSION_NAME, createdAt: now, puzzle: '333' }
}

export function sortSessionsByCreated(sessions: SessionRecord[]): SessionRecord[] {
  return [...sessions].sort((left, right) => left.createdAt - right.createdAt)
}

export function solveIdsNeedingMigration(solves: Pick<SolveRecord, 'id' | 'sessionId'>[], knownSessionIds: ReadonlySet<string>): string[] {
  return solves.filter((solve) => !solve.sessionId || !knownSessionIds.has(solve.sessionId)).map((solve) => solve.id)
}

export function orderSolvesForSession(solves: SolveRecord[], sessionId: string): SolveRecord[] {
  return solves.filter((solve) => solve.sessionId === sessionId).sort((left, right) => right.endedAt - left.endedAt)
}
