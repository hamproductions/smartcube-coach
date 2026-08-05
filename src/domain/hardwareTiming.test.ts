import { describe, expect, it } from 'vitest'
import { simulateCfopSolve } from './cfopSimulation'
import { segmentCfop } from './reconstruction'

const gaps = [0, 0, 53, 53, 96, 315, 512, 1_140, 3_465]

const hardwareTimestamps = (count: number) => {
  const stamps: number[] = []
  let now = 1_000
  for (let index = 0; index < count; index += 1) {
    now += gaps[index % gaps.length]
    stamps.push(now)
  }
  return stamps
}

describe('stage metrics under a real cube timing profile', () => {
  it('never reports a turn rate a zero-length window cannot support', async () => {
    const solve = await simulateCfopSolve('hardware-timing')
    const stamps = hardwareTimestamps(solve.events.length)
    const moves = solve.events.map((event, index) => ({ move: event.move, timestamp: stamps[index] }))
    const stages = await segmentCfop(solve.scramble, moves, 'hardware')

    expect(stages.length).toBeGreaterThan(0)
    for (const stage of stages) {
      expect(stage.moveCount).toBeGreaterThan(0)
      // undefined when untimed, a real number otherwise — never a fabricated 0.
      expect(stage.tps === undefined || Number.isFinite(stage.tps)).toBe(true)
      if (stage.executionMs === 0) expect(stage.tps).toBeUndefined()
      else expect(stage.tps).toBeCloseTo(stage.moveCount / (stage.executionMs! / 1000), 5)
      expect(stage.recognitionMs).toBeGreaterThanOrEqual(0)
      expect(stage.longestPauseMs ?? 0).toBeLessThanOrEqual(Math.max(...gaps))
    }
  }, 60_000)

  it('counts a multi-second gap as a pause and attributes it to a turn', async () => {
    const solve = await simulateCfopSolve('hardware-pause')
    const stamps = hardwareTimestamps(solve.events.length)
    const moves = solve.events.map((event, index) => ({ move: event.move, timestamp: stamps[index] }))
    const stages = await segmentCfop(solve.scramble, moves, 'hardware')
    const paused = stages.filter((stage) => (stage.longestPauseMs ?? 0) >= 500)

    expect(paused.length).toBeGreaterThan(0)
    for (const stage of paused) {
      expect(stage.pauseCount).toBeGreaterThan(0)
      expect(stage.longestPauseBefore).toBeTruthy()
    }
  }, 60_000)
})
