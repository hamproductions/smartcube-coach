/**
 * Ported from cs0x7f/cstimer (GPL-3.0), src/js/tools/metronome.js.
 * Upstream: https://github.com/cs0x7f/cstimer/blob/master/src/js/tools/metronome.js
 * cstimer is licensed under the GNU General Public License; see
 * https://github.com/cs0x7f/cstimer/blob/master/LICENSE for the full notice.
 *
 * The original is a jQuery UI panel wired directly to cstimer's global
 * `kernel`/`timer` singletons. This port keeps the actual behaviour —
 * BPM-to-interval conversion (line 78), the oscillator tick (lines 83-93),
 * and the "beep at these solve times" schedule (lines 112-149, including
 * the `times.filter(Number)` quirk that silently drops a scheduled 0s beep,
 * since `Number(0)` is falsy) — as pure, DOM-free functions plus a small
 * class that owns the WebAudio nodes. Persisted UI settings (`beepEn`,
 * `beepAt` in cstimer's `kernel.regProp`) are left to a component/store
 * owner; see the wiring note in the port report.
 */

export function bpmToIntervalMs(bpm: number): number {
  return 60000 / Math.trunc(bpm)
}

/**
 * Byte-faithful port of `startBeep`'s parsing (metronome.js lines 112-123):
 * truncate each entry to millisecond precision, drop falsy entries via
 * `filter(Number)` (this really does drop a literal `0`, matching upstream),
 * then sort ascending.
 */
export function parseBeepSchedule(input: string): number[] {
  const times = input
    .split(',')
    .map((entry) => Math.trunc(Number.parseFloat(entry.trim()) * 1000) / 1000.0)
  const filtered = times.filter((value) => Boolean(value) && !Number.isNaN(value))
  return filtered.sort((a, b) => a - b)
}

export interface BeepScheduleState {
  times: number[]
  index: number
}

export function createBeepSchedule(times: number[]): BeepScheduleState {
  return { times, index: 0 }
}

/**
 * Port of `beepLoop` (metronome.js lines 135-149). `curTime` is elapsed
 * solve time in seconds. A schedule reset (curTime === 0) rewinds the
 * index. Returns whether a beep should fire on this tick and the advanced
 * schedule state; the 0.05s lead lets a beep land slightly before its
 * nominal timestamp, matching upstream's polling cadence.
 */
export function tickBeepSchedule(curTime: number, schedule: BeepScheduleState): { fire: boolean; schedule: BeepScheduleState } {
  if (curTime === 0) {
    return { fire: false, schedule: { times: schedule.times, index: 0 } }
  }
  let index = schedule.index
  let fire = false
  while (index < schedule.times.length && curTime > schedule.times[index] - 0.05) {
    index += 1
    fire = true
  }
  return { fire, schedule: { times: schedule.times, index } }
}

export interface MetronomeOptions {
  bpm?: number
  volume?: number
  audioContextFactory?: () => AudioContext
}

/**
 * Owns the WebAudio nodes for the click track. `playTick` mirrors
 * `playTick` (metronome.js lines 83-93): a 100ms sine blip through a single
 * shared gain node.
 */
export class Metronome {
  private context: AudioContext | undefined
  private gain: GainNode | undefined
  private timer: ReturnType<typeof setInterval> | undefined
  private readonly factory: () => AudioContext
  bpm: number
  volume: number

  constructor(options: MetronomeOptions = {}) {
    this.bpm = options.bpm ?? 60
    this.volume = options.volume ?? 0.3
    this.factory = options.audioContextFactory ?? (() => new AudioContext())
  }

  private ensureContext(): { context: AudioContext; gain: GainNode } {
    if (!this.context || !this.gain) {
      this.context = this.factory()
      this.gain = this.context.createGain()
      this.gain.gain.value = this.volume
      this.gain.connect(this.context.destination)
    }
    return { context: this.context, gain: this.gain }
  }

  setVolume(volume: number): void {
    this.volume = volume
    if (this.gain) this.gain.gain.value = volume
  }

  playTick(freq = 440): void {
    const { context, gain } = this.ensureContext()
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    osc.start(context.currentTime)
    osc.stop(context.currentTime + 0.1)
  }

  start(): void {
    this.stop()
    const interval = bpmToIntervalMs(this.bpm)
    this.timer = setInterval(() => this.playTick(), interval)
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  get isRunning(): boolean {
    return this.timer !== undefined
  }
}
