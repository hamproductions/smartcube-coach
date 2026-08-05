import { describe, expect, it } from 'vitest'
import type { Finding, FindingMetric } from './analyzeSolve'
import { buildPrescription } from './prescribe'

const finding = (metric: string, target: number): Finding => ({
  id: `finding-${metric}`,
  metric: metric as FindingMetric,
  title: metric,
  observed: target * 2,
  baseline: target * 2,
  target,
  impactMs: target,
  recurrence: 1,
  confidence: 1,
  priority: 1,
  evidence: { solveId: 'solve', stage: 'F2L 2', fromMs: 0, toMs: target }
})

describe('prescriptions for every finding type', () => {
  it('assigns a distinct plan per metric instead of one generic reset', () => {
    const titles = ['pair_transition_pause', 'slot_transition_pause', 'case_recognition', 'stage_tps', 'stage_moves', 'solve_duration']
      .map((metric) => buildPrescription(finding(metric, 500), { slot: 'BL', caseName: 'OLL 27 Sune', stage: 'OLL' }).title)

    expect(new Set(titles).size).toBe(titles.length)
  })

  it('names the slot in a slot finding so the drill is actionable', () => {
    const prescription = buildPrescription(finding('slot_transition_pause', 500), { slot: 'BL' })

    expect(prescription.title).toContain('BL')
    expect(prescription.blocks.some((block) => block.label.includes('BL'))).toBe(true)
  })

  it('names the case in a recognition finding', () => {
    const prescription = buildPrescription(finding('case_recognition', 900), { caseName: 'OLL 27 Sune' })

    expect(prescription.title).toContain('OLL 27 Sune')
    expect(prescription.blocks.filter((block) => block.label.includes('OLL 27 Sune')).length).toBeGreaterThanOrEqual(2)
  })

  it('always closes with a full-solve transfer block carrying the pass condition', () => {
    for (const metric of ['pair_transition_pause', 'slot_transition_pause', 'case_recognition', 'stage_tps', 'stage_moves', 'solve_duration']) {
      const prescription = buildPrescription(finding(metric, 500), { slot: 'FR', caseName: 'T Perm', stage: 'PLL' })
      const last = prescription.blocks.at(-1)!

      expect(last.kind, metric).toBe('transfer')
      expect(prescription.passCondition.metric, metric).toBe(metric)
      expect(prescription.passCondition.fullSolveSample, metric).toBe(12)
    }
  })

  it('still returns a usable plan for an unknown metric', () => {
    const prescription = buildPrescription(finding('unheard_of', 100))

    expect(prescription.blocks).toHaveLength(4)
    expect(prescription.passCondition.metric).toBe('unheard_of')
  })
})
