import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from './database'
import { reanalyseStoredSolves } from './reanalyseSolves'
import { ANALYSIS_VERSION, type SolveRecord, type StageRecord } from '../domain/models'
import { segmentCfop } from '../domain/reconstruction'

const reco = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as {
  scramble: string
  moves: string[]
}

const solve = (overrides: Partial<SolveRecord> = {}): SolveRecord => ({
  id: 'solve-1',
  sessionId: 'default',
  puzzle: '3x3x3',
  scramble: reco.scramble,
  scrambleGenerator: 'reco.nz',
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_004_320,
  penalty: 'none',
  analysisVersion: '1',
  rawEventIds: [],
  moves: reco.moves,
  ...overrides
})

describe('reanalyseStoredSolves', () => {
  beforeEach(async () => { await clearDatabase() })

  it('gives an old solve the analysis it was recorded before', async () => {
    await repositories.solves.put(solve())
    // What the old analyser wrote: a move count and an optimal count, no moves, no case.
    const stages = await segmentCfop(reco.scramble, reco.moves.map((move, index) => ({ move, timestamp: index })), 'solve-1')
    for (const stage of stages) {
      const { optimalMoves: _moves, betterSlot: _slot, caseId: _id, caseName: _name, ...old } = stage
      await repositories.stages.put({ ...old, recognitionMs: 500, executionMs: 1_500, tps: 4 } as StageRecord)
    }

    expect((await reanalyseStoredSolves()).length).toBe(1)

    const after = await repositories.stages.forSolve('solve-1')
    expect(after.some((stage) => stage.optimalMoves?.length)).toBe(true)
    expect(after.some((stage) => stage.name.startsWith('F2L') && stage.caseName)).toBe(true)
    expect((await repositories.solves.get('solve-1'))?.analysisVersion).toBe(ANALYSIS_VERSION)
  }, 60_000)

  it('keeps the timing that was actually measured', async () => {
    await repositories.solves.put(solve())
    const stages = await segmentCfop(reco.scramble, reco.moves.map((move, index) => ({ move, timestamp: index })), 'solve-1')
    for (const stage of stages) {
      await repositories.stages.put({ ...stage, recognitionMs: 1_234, executionMs: 5_678, tps: 2.5 })
    }

    await reanalyseStoredSolves()

    const after = await repositories.stages.forSolve('solve-1')
    expect(after.length).toBeGreaterThan(0)
    for (const stage of after) {
      expect(stage.recognitionMs).toBe(1_234)
      expect(stage.executionMs).toBe(5_678)
      expect(stage.tps).toBe(2.5)
    }
  }, 60_000)

  it('does not touch a solve already on the current version', async () => {
    await repositories.solves.put(solve({ analysisVersion: ANALYSIS_VERSION }))
    await repositories.stages.put({
      id: 'solve-1:cross', solveId: 'solve-1', method: 'CFOP', name: 'Cross',
      startEvent: 0, firstMoveEvent: 0, endEvent: 1, moveCount: 2, confidence: 1
    } as StageRecord)

    expect((await reanalyseStoredSolves()).length).toBe(0)
    expect((await repositories.stages.forSolve('solve-1')).length).toBe(1)
  })

  it('skips a solve with no captured moves rather than emptying its breakdown', async () => {
    await repositories.solves.put(solve({ moves: [] }))
    await repositories.stages.put({
      id: 'solve-1:cross', solveId: 'solve-1', method: 'CFOP', name: 'Cross',
      startEvent: 0, firstMoveEvent: 0, endEvent: 1, moveCount: 2, confidence: 1
    } as StageRecord)

    expect((await reanalyseStoredSolves()).length).toBe(0)
    expect((await repositories.stages.forSolve('solve-1')).length).toBe(1)
    expect((await repositories.solves.get('solve-1'))?.analysisVersion).toBe('1')
  })
})
