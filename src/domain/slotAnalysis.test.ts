import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MetricSample } from './models'
import { analyzeRecurringErrors } from './recurrence'
import { segmentCfop } from './reconstruction'

const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as { scramble: string; moves: string[] }

describe('per-slot F2L analysis', () => {
  it('names which slot each pair stage completed, once each', async () => {
    const events = solve.moves.map((move, index) => ({ move, timestamp: 1_000 + index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'reco')
    const slots = stages.filter((stage) => stage.name.startsWith('F2L')).map((stage) => stage.slot)

    expect(slots).toHaveLength(4)
    expect(slots.every((slot) => slot !== undefined)).toBe(true)
    expect(new Set(slots).size).toBe(4)
    for (const slot of slots) expect(['FR', 'FL', 'BR', 'BL']).toContain(slot)
  }, 60_000)

  it('leaves non-F2L stages without a slot', async () => {
    const events = solve.moves.map((move, index) => ({ move, timestamp: 1_000 + index * 90 }))
    const stages = await segmentCfop(solve.scramble, events, 'reco')

    for (const stage of stages.filter((entry) => !entry.name.startsWith('F2L'))) expect(stage.slot, stage.name).toBeUndefined()
  }, 60_000)

  it('ranks a consistently slow slot as its own recurring finding', () => {
    const sample = (attempt: number, slot: string, value: number): MetricSample => ({
      id: `${attempt}:${slot}`,
      metric: 'slot_transition_pause',
      metricVersion: '1',
      sourceType: 'stage',
      sourceId: `solve-${attempt}:${slot}`,
      value,
      unit: 'ms',
      occurredAt: attempt,
      confidence: 1,
      context: { puzzle: '3x3x3', stage: 'F2L', slot },
      evidence: [{ fromEvent: 0, toEvent: 1 }]
    })
    const samples = [0, 1, 2, 3, 4].flatMap((attempt) => [
      sample(attempt, 'FR', 300),
      sample(attempt, 'BL', 1_400)
    ])

    const findings = analyzeRecurringErrors(samples, 'solve')
    const slow = findings.filter((finding) => finding.metric === 'slot_transition_pause')

    expect(slow).toHaveLength(1)
    expect(slow[0].evidence[0].stage).toBe('BL slot')
    expect(slow[0].observed).toBe(1_400)
  })
})

describe('cross efficiency coaching', () => {
  it('raises a finding when the cross is repeatedly longer than the state required', async () => {
    const { analyzeRecurringErrors: analyze, roastFinding: roast } = await import('./recurrence')
    const sample = (attempt: number, waste: number) => ({
      id: `${attempt}:waste`,
      metric: 'cross_waste',
      metricVersion: '1',
      sourceType: 'stage' as const,
      sourceId: `solve-${attempt}:Cross`,
      value: waste,
      unit: 'moves' as const,
      occurredAt: attempt,
      confidence: 1,
      context: { puzzle: '3x3x3', stage: 'Cross' },
      evidence: [{ fromEvent: 0, toEvent: 5 }]
    })

    const findings = analyze([0, 1, 2, 3, 4].map((attempt) => sample(attempt, 3)), 'solve')
    const waste = findings.find((finding) => finding.metric === 'cross_waste')!

    expect(waste.observed).toBe(3)
    expect(roast(waste)).toContain('moves gate')
    expect(roast(waste)).toContain('Plan the whole cross in inspection')
  })

  it('stays silent when every cross was optimal', async () => {
    const { analyzeRecurringErrors: analyze } = await import('./recurrence')
    const samples = [0, 1, 2, 3, 4].map((attempt) => ({
      id: `${attempt}:waste`,
      metric: 'cross_waste',
      metricVersion: '1',
      sourceType: 'stage' as const,
      sourceId: `solve-${attempt}:Cross`,
      value: 0,
      unit: 'moves' as const,
      occurredAt: attempt,
      confidence: 1,
      context: { puzzle: '3x3x3', stage: 'Cross' },
      evidence: [{ fromEvent: 0, toEvent: 5 }]
    }))

    expect(analyze(samples, 'solve').filter((finding) => finding.metric === 'cross_waste')).toEqual([])
  })
})
