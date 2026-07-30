import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from './database'
import { exportAllData, importAllData } from './transfer'
import type { SolveRecord } from '../domain/models'

const solve: SolveRecord = {
  id: 'solve-1',
  sessionId: 'session-1',
  puzzle: '3x3x3',
  scramble: 'R U',
  scrambleGenerator: 'test-v1',
  startedAt: 100,
  endedAt: 500,
  penalty: 'none',
  analysisVersion: '1',
  rawEventIds: ['event-1'],
  moves: ["U'", "R'"]
}

beforeEach(clearDatabase)

describe('local data transfer', () => {
  it('round-trips solves and raw telemetry with schema versions', async () => {
    await repositories.solves.put(solve)
    await repositories.rawEvents.put({
      id: 'event-1',
      solveId: solve.id,
      sequence: 0,
      type: 'move',
      hostTimestamp: 120,
      payload: { move: "U'" }
    })

    const backup = await exportAllData()
    await clearDatabase()
    await importAllData(backup)

    expect(backup.schemaVersion).toBe(4)
    expect(backup.format).toBe('smartcube-coach-backup')
    expect(backup.analysisVersion).toBe('1')
    expect(await repositories.solves.get(solve.id)).toEqual(solve)
    expect(await repositories.rawEvents.forSolve(solve.id)).toHaveLength(1)
  })
})
