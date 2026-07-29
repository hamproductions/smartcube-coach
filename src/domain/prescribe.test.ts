import { describe, expect, it } from 'vitest'
import { buildPrescription } from './prescribe'

const finding = {
  id: 'finding-pair-2',
  metric: 'pair_transition_pause' as const,
  title: 'Second-pair lookahead stalls',
  observed: 1140,
  baseline: 520,
  target: 380,
  impactMs: 620,
  recurrence: 0.58,
  confidence: 0.94,
  priority: 0.72,
  evidence: { solveId: 'solve-1042', stage: 'F2L 2', fromMs: 5620, toMs: 6760 }
}

describe('buildPrescription', () => {
  it('turns a pause finding into a measured lookahead session', () => {
    const prescription = buildPrescription(finding)

    expect(prescription.title).toBe('F2L Lookahead Reset')
    expect(prescription.blocks.map((block) => block.kind)).toEqual([
      'tracking',
      'prediction',
      'execution',
      'transfer'
    ])
    expect(prescription.passCondition.metric).toBe('pair_transition_pause')
    expect(prescription.passCondition.target).toBe(380)
    expect(prescription.passCondition.fullSolveSample).toBe(12)
  })
})
