import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from './database'
import { exportAllData, exportSessionAsCsTimerCsv, importAllData, importSessionFromCsTimerCsv } from './transfer'
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

  it('exports only the requested session as csTimer CSV', async () => {
    await repositories.solves.put(solve)
    await repositories.solves.put({ ...solve, id: 'solve-2', sessionId: 'session-other' })

    const csv = await exportSessionAsCsTimerCsv('session-1')

    expect(csv.split('\r\n')).toHaveLength(2)
    expect(csv).toContain('R U')
  })

  it('imports csTimer CSV rows into the target session and persists them', async () => {
    await repositories.solves.put(solve)
    const csv = await exportSessionAsCsTimerCsv('session-1')

    const result = await importSessionFromCsTimerCsv(csv, 'session-imported')

    expect(result.skipped).toHaveLength(0)
    expect(result.solves).toHaveLength(1)
    const stored = await repositories.solves.get(result.solves[0].id)
    expect(stored?.sessionId).toBe('session-imported')
    expect(stored?.moves).toEqual([])
  })
})
