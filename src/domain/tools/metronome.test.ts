import { describe, expect, it } from 'vitest'
import { bpmToIntervalMs, createBeepSchedule, parseBeepSchedule, tickBeepSchedule } from './metronome'

describe('bpmToIntervalMs', () => {
  it('matches cstimer: interval = 60000 / bpm (metronome.js line 78)', () => {
    expect(bpmToIntervalMs(60)).toBe(1000)
    expect(bpmToIntervalMs(120)).toBe(500)
    expect(bpmToIntervalMs(40)).toBe(1500)
  })
})

describe('parseBeepSchedule', () => {
  it('parses, sorts and truncates to millisecond precision', () => {
    expect(parseBeepSchedule('10, 5, 15')).toEqual([5, 10, 15])
    expect(parseBeepSchedule('5.1234')).toEqual([5.123])
  })

  it('drops a literal 0 entry, matching upstream filter(Number) (metronome.js line 118)', () => {
    expect(parseBeepSchedule('0,5,10')).toEqual([5, 10])
  })
})

describe('tickBeepSchedule', () => {
  it('fires once curTime passes a scheduled time minus the 0.05s lead', () => {
    let schedule = createBeepSchedule([5, 10, 15])
    let result = tickBeepSchedule(4.9, schedule)
    expect(result.fire).toBe(false)
    expect(result.schedule.index).toBe(0)

    schedule = result.schedule
    result = tickBeepSchedule(4.96, schedule)
    expect(result.fire).toBe(true)
    expect(result.schedule.index).toBe(1)

    schedule = result.schedule
    result = tickBeepSchedule(9.5, schedule)
    expect(result.fire).toBe(false)
    expect(result.schedule.index).toBe(1)
  })

  it('resets the index when curTime returns to zero (a new solve)', () => {
    const advanced = tickBeepSchedule(20, createBeepSchedule([5, 10])).schedule
    expect(advanced.index).toBe(2)
    const reset = tickBeepSchedule(0, advanced)
    expect(reset.fire).toBe(false)
    expect(reset.schedule.index).toBe(0)
  })
})
