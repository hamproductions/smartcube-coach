import { describe, expect, it } from 'vitest'
import type { Finding } from './analyzeSolve'
import type { MetricSample } from './models'
import { createPrescriptionRecord, evaluatePrescriptionTransfer } from './coach'

const finding: Finding = {
  id: 'finding-1',
  metric: 'pair_transition_pause',
  title: 'Pair transition',
  observed: 1100,
  baseline: 1000,
  target: 380,
  impactMs: 720,
  recurrence: 0.6,
  confidence: 0.9,
  priority: 1,
  evidence: { solveId: 'solve-1', stage: 'F2L 2', fromMs: 1000, toMs: 2100 }
}

const sample = (id: string, value: number, occurredAt: number): MetricSample => ({
  id,
  metric: 'pair_transition_pause',
  metricVersion: '1',
  sourceType: 'stage',
  sourceId: id,
  value,
  unit: 'ms',
  occurredAt,
  confidence: 1,
  context: { puzzle: '3x3x3', method: 'CFOP', stage: 'F2L 2' },
  evidence: []
})

describe('coach transfer', () => {
  it('passes only after a fixed post-solve sample demonstrates transfer', () => {
    const prescription = createPrescriptionRecord(finding, 100)
    prescription.transfer.baselineSampleSize = 3
    prescription.transfer.postSampleSize = 3
    const metrics = [
      sample('b1', 1000, 10), sample('b2', 1100, 20), sample('b3', 900, 30),
      sample('p1', 300, 110), sample('p2', 350, 120), sample('p3', 360, 130)
    ]

    const evaluation = evaluatePrescriptionTransfer(prescription, metrics)

    expect(evaluation.status).toBe('passed')
    expect(evaluation.baselineSourceIds).toEqual(['b1', 'b2', 'b3'])
    expect(evaluation.postSourceIds).toEqual(['p1', 'p2', 'p3'])
    expect(evaluation.effect).toBeGreaterThan(0)
  })
})
