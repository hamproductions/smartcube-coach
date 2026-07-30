import { describe, expect, it } from 'vitest'
import type { MetricSample } from './models'
import { analyzeRecurringErrors, roastFinding } from './recurrence'

const metric = (id: string, value: number): MetricSample => ({
  id,
  metric: 'pair_transition_pause',
  metricVersion: '1',
  sourceType: 'stage',
  sourceId: `stage-${id}`,
  value,
  unit: 'ms',
  occurredAt: Number(id),
  confidence: 0.95,
  context: { puzzle: '3x3x3', method: 'CFOP', stage: 'F2L 2' },
  evidence: [{ rawEventId: `raw-${id}` }]
})

describe('recurring error analysis', () => {
  it('creates evidence-backed recurrence and roast from persisted metrics', () => {
    const samples = [900, 800, 750, 700, 650, 600, 550, 300, 320, 340, 360, 370].map((value, index) => metric(String(index + 1), value))
    const [finding] = analyzeRecurringErrors(samples, 'solve-12')

    expect(finding.recurrence).toBeCloseTo(7 / 12)
    expect(finding.evidence.flatMap((item) => item.rawEventIds ?? [])).toHaveLength(12)
    expect(roastFinding(finding)).toContain('7 of 12')
    expect(roastFinding(finding)).toContain('F2L 2')
  })
})
