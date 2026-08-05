import { describe, expect, it } from 'vitest'
import type { MetricSample } from './models'
import { simulateCfopSolve } from './cfopSimulation'
import { analyzeRecurringErrors, roastFinding } from './recurrence'
import { segmentCfop } from './reconstruction'

describe('pause location and rotation cost', () => {
  it('reports where the longest pause in a stage happened', async () => {
    const simulated = await simulateCfopSolve('pause-demo')
    const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim')

    for (const stage of stages) {
      expect(stage.longestPauseMs, stage.name).toBeGreaterThanOrEqual(0)
      if (stage.longestPauseMs! > 0) {
        expect(stage.longestPauseBefore, `${stage.name} names the move it stalled before`).toBeDefined()
        expect(stage.longestPauseMs!, `${stage.name} pause fits the stage`).toBeLessThanOrEqual(stage.recognitionMs! + stage.executionMs! + 1)
      }
    }
  }, 60_000)

  it('charges rotation time only to stages that actually rotated', async () => {
    const simulated = await simulateCfopSolve('pause-demo')
    const stages = await segmentCfop(simulated.scramble, simulated.events, 'sim')

    for (const stage of stages) {
      if (stage.rotationCount === 0) expect(stage.rotationMs, stage.name).toBe(0)
      else expect(stage.rotationMs!, stage.name).toBeGreaterThan(0)
    }
  }, 60_000)

  it('names the move a recurring stall happens before', () => {
    const sample = (attempt: number): MetricSample => ({
      id: `${attempt}:pause`,
      metric: 'stage_longest_pause',
      metricVersion: '1',
      sourceType: 'stage',
      sourceId: `solve-${attempt}:F2L 2`,
      value: 1_400,
      unit: 'ms',
      occurredAt: attempt,
      confidence: 1,
      context: { puzzle: '3x3x3', stage: 'F2L 2', pauseBefore: 'y' },
      evidence: [{ fromEvent: 0, toEvent: 4 }]
    })

    const finding = analyzeRecurringErrors([0, 1, 2, 3, 4].map(sample), 'solve').find((entry) => entry.metric === 'stage_longest_pause')!

    expect(finding.evidence[0].stage).toBe('F2L 2 before y')
    expect(roastFinding(finding)).toContain('single stall dominates')
  })

  it('raises rotation cost as its own finding', () => {
    const sample = (attempt: number): MetricSample => ({
      id: `${attempt}:rotation`,
      metric: 'rotation_cost',
      metricVersion: '1',
      sourceType: 'stage',
      sourceId: `solve-${attempt}:F2L 3`,
      value: 900,
      unit: 'ms',
      occurredAt: attempt,
      confidence: 1,
      context: { puzzle: '3x3x3', stage: 'F2L 3' },
      evidence: [{ fromEvent: 0, toEvent: 4 }]
    })

    const finding = analyzeRecurringErrors([0, 1, 2, 3, 4].map(sample), 'solve').find((entry) => entry.metric === 'rotation_cost')!

    expect(finding.observed).toBe(900)
    expect(roastFinding(finding)).toContain('paying for rotations')
  })
})

describe('finding gate honesty', () => {
  it('stays silent when the median is inside the gate even if single samples exceeded it', () => {
    const sample = (attempt: number, value: number): MetricSample => ({
      id: `${attempt}:pause`,
      metric: 'stage_longest_pause',
      metricVersion: '1',
      sourceType: 'stage',
      sourceId: `solve-${attempt}:F2L 1`,
      value,
      unit: 'ms',
      occurredAt: attempt,
      confidence: 1,
      context: { puzzle: '3x3x3', stage: 'F2L 1' },
      evidence: [{ fromEvent: 0, toEvent: 1 }]
    })
    const samples = [300, 300, 300, 300, 1_500].map((value, attempt) => sample(attempt, value))

    expect(analyzeRecurringErrors(samples, 'solve').filter((finding) => finding.metric === 'stage_longest_pause')).toEqual([])
  })

  it('still reports when the median itself fails the gate', () => {
    const sample = (attempt: number, value: number): MetricSample => ({
      id: `${attempt}:pause`,
      metric: 'stage_longest_pause',
      metricVersion: '1',
      sourceType: 'stage',
      sourceId: `solve-${attempt}:F2L 1`,
      value,
      unit: 'ms',
      occurredAt: attempt,
      confidence: 1,
      context: { puzzle: '3x3x3', stage: 'F2L 1' },
      evidence: [{ fromEvent: 0, toEvent: 1 }]
    })
    const samples = [1_200, 1_300, 1_400, 900, 1_500].map((value, attempt) => sample(attempt, value))

    expect(analyzeRecurringErrors(samples, 'solve').filter((finding) => finding.metric === 'stage_longest_pause')).toHaveLength(1)
  })
})
