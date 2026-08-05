import { describe, expect, it } from 'vitest'
import { betterAlgorithmFor } from './betterAlgorithm'
import type { AlgorithmRecord, StageRecord } from './models'

const stage = (over: Partial<StageRecord>): StageRecord => ({
  id: 's', solveId: 'x', method: 'CFOP', name: 'OLL',
  startEvent: 0, firstMoveEvent: 0, endEvent: 5,
  moveCount: 11, rotationCount: 0, confidence: 1, ...over
})

const catalogue: AlgorithmRecord[] = [{
  id: 'oll-45', set: 'OLL', name: 'OLL 45 T Shape', algorithm: "F R U R' U' F'",
  setup: '', targetMs: 2000, mastery: 0, dueAt: 0, orientations: []
}]

describe('betterAlgorithmFor', () => {
  it('offers the known algorithm when the solver used noticeably more moves', () => {
    const found = betterAlgorithmFor(stage({ caseName: 'OLL 45 T Shape', moveCount: 11 }), catalogue)
    expect(found).toEqual({ caseName: 'OLL 45 T Shape', algorithm: "F R U R' U' F'", moveCount: 6, savedMoves: 5 })
  })

  it('says nothing when the solver already matched the algorithm', () => {
    expect(betterAlgorithmFor(stage({ caseName: 'OLL 45 T Shape', moveCount: 7 }), catalogue)).toBeUndefined()
  })

  it('says nothing for a stage with no recognised case', () => {
    expect(betterAlgorithmFor(stage({ caseName: undefined }), catalogue)).toBeUndefined()
  })

  it('falls back to the case id when the name does not match the catalogue', () => {
    const found = betterAlgorithmFor(stage({ caseName: 'T Shape', caseId: 'oll-45', moveCount: 12 }), catalogue)
    expect(found?.algorithm).toBe("F R U R' U' F'")
  })
})
