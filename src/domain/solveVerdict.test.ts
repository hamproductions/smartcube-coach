import { describe, expect, it } from 'vitest'
import type { StageRecord } from './models'
import { lossReason, solveVerdict } from './solveVerdict'

const stage = (solveId: string, name: string, recognitionMs: number, executionMs: number, moveCount = 8): StageRecord => ({
  id: `${solveId}-${name}`, solveId, method: 'CFOP', name, startEvent: 0, firstMoveEvent: 0, endEvent: 0,
  recognitionMs, executionMs, moveCount, rotationCount: 0, confidence: 1
})

describe('solve verdict', () => {
  const history = ['a', 'b', 'c', 'd'].flatMap((id) => [stage(id, 'Cross', 500, 1500), stage(id, 'F2L 1', 400, 1600)])

  it('names the stage that lost the most time against the solver\'s own average, and why', () => {
    const current = [stage('now', 'Cross', 300, 1200), stage('now', 'F2L 1', 1800, 1700)]
    const verdict = solveVerdict(current, [...history, ...current])
    expect(verdict.good.map((entry) => entry.stage.name)).toEqual(['Cross'])
    expect(verdict.biggestLoss?.stage.name).toBe('F2L 1')
    expect(Math.round(verdict.biggestLoss!.deltaMs!)).toBe(1500)
    expect(lossReason(verdict.biggestLoss!)).toBe('you looked 1.40s longer than usual before turning')
  })

  it('makes no claim without enough earlier solves of that stage', () => {
    const verdict = solveVerdict([stage('now', 'OLL', 2000, 2000)], history)
    expect(verdict.bad).toEqual([])
    expect(verdict.stages[0].samples).toBe(0)
  })
})
