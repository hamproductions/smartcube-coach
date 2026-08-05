import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { attachReconstruction } from './attachReconstruction'
import type { SolveRecord } from './models'

type RecoFixture = {
  scramble: string
  moves: string[]
}

const fixture = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as RecoFixture

const keyboardSolve: SolveRecord = {
  id: 'solve-keyboard-1',
  sessionId: 'session-1',
  puzzle: '3x3x3',
  scramble: fixture.scramble,
  scrambleGenerator: 'cstimer-import',
  startedAt: 0,
  endedAt: 20_000,
  penalty: 'none',
  analysisVersion: '1',
  rawEventIds: [],
  moves: [],
  source: 'keyboard',
  stateVerified: false,
  verificationDetail: 'keyboard timer solve, no move stream captured'
}

describe('attachReconstruction', () => {
  it('attaches a valid typed reconstruction and yields segmented stages', async () => {
    const result = await attachReconstruction(keyboardSolve, fixture.moves.join(' '))

    expect(result.accepted).toBe(true)
    if (!result.accepted) throw new Error('expected acceptance')
    expect(result.solve.moves).toEqual(fixture.moves)
    expect(result.solve.stateVerified).toBe(true)
    expect(result.solve.verificationDetail).toMatch(/human-entered/)
    const names = result.stages.map((stage) => stage.name).filter((name) => name !== 'AUF')
    expect(names).toEqual(['Cross', 'F2L 1', 'F2L 2', 'F2L 3', 'F2L 4', 'OLL', 'PLL'])
    expect(result.stages.every((stage) => stage.moveCount > 0)).toBe(true)
  }, 60_000)

  it('rejects a typed solution that does not solve the scramble, without partial acceptance', async () => {
    const brokenSolution = fixture.moves.slice(0, -1).join(' ')
    const result = await attachReconstruction(keyboardSolve, brokenSolution)

    expect(result.accepted).toBe(false)
    if (result.accepted) throw new Error('expected rejection')
    expect(result.reason).toMatch(/does not solve/)
  })

  it('rejects invalid cube notation outright', async () => {
    const result = await attachReconstruction(keyboardSolve, 'this is not a scramble')

    expect(result.accepted).toBe(false)
  })

  it('rejects attaching onto a solve that already has captured moves', async () => {
    const result = await attachReconstruction({ ...keyboardSolve, moves: ['R', 'U'] }, fixture.moves.join(' '))

    expect(result.accepted).toBe(false)
    if (result.accepted) throw new Error('expected rejection')
    expect(result.reason).toMatch(/already has a captured move stream/)
  })

  it('never fabricates per-move timing for an attached reconstruction', async () => {
    const result = await attachReconstruction(keyboardSolve, fixture.moves.join(' '))

    expect(result.accepted).toBe(true)
    if (!result.accepted) throw new Error('expected acceptance')
    for (const stage of result.stages) {
      expect(stage.recognitionMs).toBeUndefined()
      expect(stage.executionMs).toBeUndefined()
      expect(stage.tps).toBeUndefined()
      expect(stage.pauseCount).toBeUndefined()
      expect(stage.longestPauseMs).toBeUndefined()
      expect(stage.longestPauseAfter).toBeUndefined()
      expect(stage.longestPauseBefore).toBeUndefined()
      expect(stage.rotationMs).toBeUndefined()
    }
  }, 60_000)

  it('preserves real move counts and case identity while leaving timing absent', async () => {
    const result = await attachReconstruction(keyboardSolve, fixture.moves.join(' '))

    expect(result.accepted).toBe(true)
    if (!result.accepted) throw new Error('expected acceptance')
    expect(result.stages.every((stage) => stage.moveCount > 0)).toBe(true)
    const withCases = result.stages.filter((stage) => stage.name === 'OLL' || stage.name === 'PLL')
    expect(withCases.length).toBeGreaterThan(0)
    for (const stage of withCases) {
      expect(stage.caseId).toBeDefined()
      expect(stage.caseName).toBeDefined()
      expect(stage.recognitionMs).toBeUndefined()
    }
    const f2lWithSlot = result.stages.filter((stage) => stage.slot)
    expect(f2lWithSlot.length).toBeGreaterThan(0)
  }, 60_000)
})
