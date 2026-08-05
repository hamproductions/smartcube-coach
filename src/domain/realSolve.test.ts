import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MetricSample } from './models'
import { analyzeRecurringErrors, roastFinding } from './recurrence'
import { segmentCfop } from './reconstruction'

type RecoFixture = {
  scramble: string
  moves: string[]
  turnMoves: string[]
  stages: Array<{ label: string; moves: string[] }>
}

const solve = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as RecoFixture
const events = solve.moves.map((move, index) => ({ move, timestamp: 1_000 + index * 90 }))

describe('real reconstructed solve', () => {
  it('keeps inspection rotations so the move stream reproduces the solved state', () => {
    expect(solve.moves[0]).toBe('z2')
    expect(solve.moves.length).toBe(49)
    expect(solve.turnMoves.length).toBe(47)
  })

  it('segments a human CFOP solve into every stage in order', async () => {
    const stages = await segmentCfop(solve.scramble, events, 'reco-13444')

    const core = ['Cross', 'F2L 1', 'F2L 2', 'F2L 3', 'F2L 4', 'OLL', 'PLL']
    expect(stages.map((stage) => stage.name).filter((name) => name !== 'AUF')).toEqual(core)
    for (const stage of stages.filter((entry) => entry.name === 'AUF')) expect(stage.moveCount, 'an AUF stage only exists when it consumed a move').toBeGreaterThan(0)
    expect(stages.every((stage) => stage.endEvent >= stage.startEvent)).toBe(true)
    expect(stages.map((stage) => stage.endEvent)).toEqual([...stages.map((stage) => stage.endEvent)].sort((left, right) => left - right))
  }, 60_000)

  it('agrees with the reconstructor on the pair, OLL and PLL boundaries', async () => {
    const stages = await segmentCfop(solve.scramble, events, 'reco-13444')
    const boundary = (label: string) => {
      let index = -1
      for (const stage of solve.stages) {
        index += stage.moves.length
        if (stage.label === label) return index
      }
      throw new Error(`missing label ${label}`)
    }
    const detected = Object.fromEntries(stages.map((stage) => [stage.name, stage.endEvent]))

    expect(detected['F2L 1']).toBe(boundary('1st pair'))
    expect(detected['F2L 2']).toBe(boundary('2nd pair'))
    expect(detected['F2L 4']).toBe(boundary('4th pair'))
    expect(detected.OLL).toBe(boundary('OLL(CP)'))
    expect(detected.PLL).toBe(boundary('EPLL'))
  }, 60_000)

  it('emits finite stage metrics for every detected stage', async () => {
    const stages = await segmentCfop(solve.scramble, events, 'reco-13444')

    for (const stage of stages) {
      expect(Number.isFinite(stage.recognitionMs), `${stage.name} recognition`).toBe(true)
      expect(Number.isFinite(stage.executionMs), `${stage.name} execution`).toBe(true)
      expect(Number.isFinite(stage.tps), `${stage.name} tps`).toBe(true)
      expect(stage.recognitionMs).toBeGreaterThanOrEqual(0)
      expect(stage.executionMs).toBeGreaterThanOrEqual(0)
      expect(stage.tps).toBeGreaterThan(0)
      expect(stage.recognitionMs! + stage.executionMs!).toBeLessThanOrEqual(events.at(-1)!.timestamp - events[0].timestamp)
    }
  }, 60_000)

  const sampleFor = async (eventStream: typeof events, attempts: number) => {
    const stages = await segmentCfop(solve.scramble, eventStream, 'reco-13444')
    const samples: MetricSample[] = []

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      for (const stage of stages) {
        const context = { puzzle: '3x3x3', method: stage.method, stage: stage.name }
        const evidence = [{ fromEvent: stage.startEvent, toEvent: stage.endEvent }]
        const common = { metricVersion: '1', sourceType: 'stage' as const, sourceId: `solve-${attempt}:${stage.name}`, occurredAt: attempt, confidence: stage.confidence, context, evidence }
        samples.push(
          { ...common, id: `${attempt}:${stage.name}:recognition`, metric: stage.name === 'F2L 2' ? 'pair_transition_pause' : 'stage_recognition', value: stage.recognitionMs!, unit: 'ms' },
          { ...common, id: `${attempt}:${stage.name}:moves`, metric: 'stage_moves', value: stage.moveCount, unit: 'moves' },
          { ...common, id: `${attempt}:${stage.name}:tps`, metric: 'stage_tps', value: stage.tps!, unit: 'tps' }
        )
      }
    }

    return samples
  }

  it('invents no finding for a world-record-pace solve', async () => {
    const findings = analyzeRecurringErrors(await sampleFor(events, 5), 'reco-13444')

    expect(findings).toEqual([])
  }, 60_000)

  it('turns repeated 25-second solves into recurring findings through the shipped pipeline', async () => {
    const slow = solve.moves.map((move, index) => ({ move, timestamp: 1_000 + index * 520 }))
    const findings = analyzeRecurringErrors(await sampleFor(slow, 5), 'reco-13444')

    expect(findings.length).toBeGreaterThan(0)
    for (const finding of findings) {
      expect(Number.isFinite(finding.observed)).toBe(true)
      expect(Number.isFinite(finding.impactMs)).toBe(true)
      expect(finding.recurrence).toBeGreaterThan(0)
      expect(finding.confidence).toBeGreaterThan(0)
      expect(finding.evidence.length).toBeGreaterThanOrEqual(5)
      expect(roastFinding(finding)).toContain(String(Math.round(finding.observed)))
    }
  }, 60_000)
})
