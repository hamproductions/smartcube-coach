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

describe('coaching language', () => {
  const finding = (metric: string, target: number, observed: number) => ({
    id: 'finding',
    solveIds: ['solve'],
    metric,
    observed,
    baseline: observed,
    target,
    recurrence: 1,
    confidence: 1,
    impactMs: 100,
    evidence: [{ solveId: 'solve', fromEvent: 0, toEvent: 1, stage: 'BL slot', rawEventIds: [] }]
  })

  it('states the right direction and unit per metric', () => {
    expect(roastFinding(finding('stage_tps', 4, 2))).toContain('below the 4 TPS gate')
    expect(roastFinding(finding('slot_transition_pause', 500, 1400))).toContain('above the 500 ms gate')
    expect(roastFinding(finding('stage_moves', 12, 18))).toContain('above the 12 moves gate')
  })

  it('never blames pausing for a turn-speed finding', () => {
    expect(roastFinding(finding('stage_tps', 4, 2))).toContain('really is execution')
    expect(roastFinding(finding('stage_tps', 4, 2))).not.toContain('pausing')
  })

  it('names the scope it measured', () => {
    expect(roastFinding(finding('slot_transition_pause', 500, 1400)).startsWith('BL slot:')).toBe(true)
  })
})
