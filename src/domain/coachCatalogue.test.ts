import { describe, expect, it } from 'vitest'
import { coachCatalogue } from './coachCatalogue'
import { betterAlgorithmFor } from './betterAlgorithm'
import type { AlgorithmRecord, StageRecord } from './models'

const stage = (overrides: Partial<StageRecord> = {}): StageRecord => ({
  id: 'x:f2l-1', solveId: 'x', method: 'CFOP', name: 'F2L 1',
  startEvent: 0, firstMoveEvent: 0, endEvent: 12, moveCount: 13,
  rotationCount: 0, confidence: 1,
  caseId: 'f2l-fr-4', caseName: 'F2L 4 - Front Right',
  ...overrides
})

describe('coachCatalogue', () => {
  it('supplies an algorithm for a case before Training has ever been opened', () => {
    const catalogue = coachCatalogue([])
    const better = betterAlgorithmFor(stage(), catalogue)
    expect(better?.caseName).toBe('F2L 4 - Front Right')
    expect(better?.algorithm).toBe("R U R'")
    expect(better?.savedMoves).toBe(10)
  })

  it('covers OLL and PLL too', () => {
    const catalogue = coachCatalogue([])
    expect(catalogue.find((entry) => entry.id === 'oll-46')?.algorithm).toBeTruthy()
    expect(catalogue.find((entry) => entry.id === 'pll-ua')?.algorithm).toBeTruthy()
  })

  it('prefers the solver’s own stored algorithm over the compiled one', () => {
    const mine: AlgorithmRecord = {
      id: 'f2l-fr-4', set: 'F2L', name: 'F2L 4 - Front Right', algorithm: "y' L' U' L",
      setup: '', targetMs: 0, mastery: 0, dueAt: 0, orientations: ['FR']
    }
    const catalogue = coachCatalogue([mine])
    expect(catalogue.filter((entry) => entry.id === 'f2l-fr-4').length).toBe(1)
    expect(betterAlgorithmFor(stage(), catalogue)?.algorithm).toBe("y' L' U' L")
  })
})
