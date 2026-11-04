import { Alg } from 'cubing/alg'
import { describe, expect, it } from 'vitest'
import { simulateCfopSolve } from './cfopSimulation'
import { segmentCfop } from './reconstruction'
import { stageTrends } from './statistics'

describe('simulated CFOP solve', () => {
  it('produces a solve that actually solves its own scramble and segments into every stage', async () => {
    for (const seed of ['alpha', 'beta', 'gamma']) {
      const simulated = await simulateCfopSolve(seed)
      const stages = await segmentCfop(simulated.scramble, simulated.events, `sim-${seed}`)

      expect(stages.map((stage) => stage.name).filter((name) => name !== 'AUF'), seed).toEqual(['Cross', 'F2L 1', 'F2L 2', 'F2L 3', 'F2L 4', 'OLL', 'PLL'])
      for (const stage of stages.filter((entry) => entry.name === 'AUF')) expect(stage.moveCount, `${seed} AUF`).toBeGreaterThan(0)
      expect(simulated.totalMs, seed).toBeGreaterThan(10_000)
      expect(simulated.totalMs, seed).toBeLessThan(45_000)
    }
  }, 120_000)

  it('is deterministic for a given seed', async () => {
    const first = await simulateCfopSolve('repeat')
    const second = await simulateCfopSolve('repeat')

    expect(first.scramble).toBe(second.scramble)
    expect(first.events).toEqual(second.events)
  }, 60_000)

  it('paces recognition before execution in every stage after the cross', async () => {
    const simulated = await simulateCfopSolve('pacing')

    for (const stage of simulated.stages.slice(1)) {
      expect(stage.recognitionMs, stage.name).toBeGreaterThan(0)
      expect(stage.executionMs, stage.name).toBeGreaterThan(0)
    }
  }, 60_000)
})

describe('stage trends', () => {
  it('reports stages in solve order rather than alphabetically', () => {
    const stage = (name: string) => ({
      id: name,
      solveId: 'solve',
      method: 'CFOP',
      name,
      startEvent: 0,
      firstMoveEvent: 0,
      endEvent: 1,
      recognitionMs: 100,
      executionMs: 200,
      moveCount: 5,
      rotationCount: 0,
      pauseCount: 0,
      tps: 3,
      confidence: 1
    })

    expect(stageTrends([stage('AUF'), stage('PLL'), stage('Cross'), stage('F2L 2')]).map((trend) => trend.name))
      .toEqual(['Cross', 'F2L 2', 'PLL', 'AUF'])
  })
})

describe('stage tps honesty', () => {
  it('never reports a tps that its own execution window cannot support', async () => {
    const solve = await simulateCfopSolve('tps-probe')
    const stages = await segmentCfop(solve.scramble, solve.events.map((event) => ({ move: event.move, timestamp: event.timestamp })), 'probe')
    expect(stages.length).toBeGreaterThan(0)
    for (const stage of stages) {
      // A zero-length execution window supports no turn rate at all, so the stage must
      // report nothing rather than 0 — reporting 0 was the defect this test now guards.
      if (stage.executionMs === 0) expect(stage.tps).toBeUndefined()
      else expect(stage.tps).toBeCloseTo(stage.moveCount / (stage.executionMs! / 1000), 5)
    }
  })

  it('drops unmeasurable stages from the trend average instead of averaging in zeros', () => {
    const base = { solveId: 's', method: 'CFOP', name: 'F2L 1', startEvent: 0, firstMoveEvent: 0, endEvent: 1, recognitionMs: 500, moveCount: 4, rotationCount: 0, pauseCount: 0, confidence: 1 }
    const trends = stageTrends([
      { ...base, id: 'a', executionMs: 1_000, tps: 4 },
      { ...base, id: 'b', executionMs: 0, moveCount: 1, tps: 0 }
    ])
    expect(trends[0].tps).toBe(4)
  })

  it('reports no trend tps at all when no stage in the group was measurable', () => {
    const base = { solveId: 's', method: 'CFOP', name: 'AUF', startEvent: 0, firstMoveEvent: 0, endEvent: 0, recognitionMs: 300, moveCount: 1, rotationCount: 0, pauseCount: 0, confidence: 1 }
    const trends = stageTrends([{ ...base, id: 'a', executionMs: 0, tps: 0 }])
    expect(trends[0].tps).toBeUndefined()
  })

  it('averages only the measured stages when a group mixes measured and unmeasured timing', () => {
    const base = { solveId: 's', method: 'CFOP', name: 'F2L 1', startEvent: 0, firstMoveEvent: 0, endEvent: 1, moveCount: 4, rotationCount: 0, confidence: 1 }
    const trends = stageTrends([
      { ...base, id: 'a', recognitionMs: 400, executionMs: 800, pauseCount: 1, tps: 5 },
      { ...base, id: 'b', recognitionMs: 200, executionMs: 600, pauseCount: 3, tps: 6 },
      { ...base, id: 'c' }
    ])
    expect(trends[0].recognitionMs).toBe(300)
    expect(trends[0].executionMs).toBe(700)
    expect(trends[0].pauses).toBe(2)
  })

  it('returns undefined recognition, execution and pause metrics when no stage in the group is measurable', () => {
    const base = { solveId: 's', method: 'CFOP', name: 'F2L 1', startEvent: 0, firstMoveEvent: 0, endEvent: 1, moveCount: 4, rotationCount: 0, confidence: 1 }
    const trends = stageTrends([{ ...base, id: 'a' }, { ...base, id: 'b' }])
    expect(trends[0].recognitionMs).toBeUndefined()
    expect(trends[0].executionMs).toBeUndefined()
    expect(trends[0].pauses).toBeUndefined()
  })
})

describe('phantom stage suppression', () => {
  it('never emits a stage that contains no turns', async () => {
    for (const seed of ['rot-a', 'rot-b', 'rot-c', 'rot-d']) {
      const solve = await simulateCfopSolve(seed)
      const stages = await segmentCfop(solve.scramble, solve.events.map((event) => ({ move: event.move, timestamp: event.timestamp })), seed)
      for (const stage of stages) {
        if (/-(skip|free)$/.test(stage.caseId ?? '')) expect(stage.moveCount).toBe(0)
        else expect(stage.moveCount).toBeGreaterThan(0)
      }
    }
  }, 60_000)
})

describe('non-CFOP solves', () => {
  it('marks the segmentation unreliable instead of reporting an impossible cross', async () => {
    const solve = await simulateCfopSolve('non-cfop')
    const scramble = solve.scramble
    const moves = new Alg(scramble).invert().toString().split(/\s+/).filter(Boolean)
      .map((move, index) => ({ move, timestamp: 1_000 + index * 120 }))
    const stages = await segmentCfop(scramble, moves, 'inverse')
    const cross = stages.find((stage) => stage.name === 'Cross')
    if (cross && cross.moveCount > 20) {
      expect(stages.every((stage) => stage.confidence < 0.5)).toBe(true)
      expect(stageTrends(stages)).toEqual([])
    }
  }, 60_000)
})
