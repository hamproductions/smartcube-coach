import type { StageRecord } from './models'

export type Bottleneck = {
  slot: 'FR' | 'FL' | 'BR' | 'BL'
  meanMs: number
  deltaMs: number
  sampleCount: number
  solveCount: number
}

const SLOT_NAMES: Record<Bottleneck['slot'], string> = {
  FR: 'Front-Right',
  FL: 'Front-Left',
  BR: 'Back-Right',
  BL: 'Back-Left'
}

export function slotName(slot: Bottleneck['slot']) {
  return SLOT_NAMES[slot]
}

export function stageDurationMs(stage: StageRecord) {
  return (stage.recognitionMs ?? 0) + (stage.executionMs ?? 0)
}

/**
 * Finds the F2L slot that is slowest relative to the solver's own F2L average.
 *
 * The comparison is against their own pairs, not a population baseline, because a
 * baseline we do not have measurements for would be an invented number. Returns
 * undefined when there is not enough evidence to name a bottleneck at all — a coaching
 * claim with two samples behind it is worse than no claim.
 */
export function findSlotBottleneck(stages: StageRecord[], minSamples = 3): Bottleneck | undefined {
  const pairs = stages.filter((stage) => stage.slot !== undefined)
  if (pairs.length === 0) return undefined

  const bySlot = new Map<Bottleneck['slot'], number[]>()
  for (const stage of pairs) {
    const slot = stage.slot as Bottleneck['slot']
    const durations = bySlot.get(slot) ?? []
    durations.push(stageDurationMs(stage))
    bySlot.set(slot, durations)
  }
  if (bySlot.size < 2) return undefined

  const overallMean = pairs.reduce((sum, stage) => sum + stageDurationMs(stage), 0) / pairs.length

  let worst: Bottleneck | undefined
  for (const [slot, durations] of bySlot) {
    if (durations.length < minSamples) continue
    const meanMs = durations.reduce((sum, value) => sum + value, 0) / durations.length
    const deltaMs = meanMs - overallMean
    if (deltaMs <= 0) continue
    if (worst && deltaMs <= worst.deltaMs) continue
    worst = {
      slot,
      meanMs,
      deltaMs,
      sampleCount: durations.length,
      solveCount: new Set(pairs.map((stage) => stage.solveId)).size
    }
  }
  return worst
}

export type SolveSplits = {
  solveId: string
  cross?: number
  f2l?: number
  oll?: number
  pll?: number
}

/** Sums each CFOP phase for one solve. F2L is the total of its pairs, not one stage. */
export function solveSplits(solveId: string, stages: StageRecord[]): SolveSplits {
  const splits: SolveSplits = { solveId }
  for (const stage of stages) {
    const ms = stageDurationMs(stage)
    const name = stage.name.toLowerCase()
    if (name.includes('cross')) splits.cross = (splits.cross ?? 0) + ms
    else if (name.includes('f2l') || stage.slot !== undefined) splits.f2l = (splits.f2l ?? 0) + ms
    else if (name.includes('oll')) splits.oll = (splits.oll ?? 0) + ms
    else if (name.includes('pll')) splits.pll = (splits.pll ?? 0) + ms
  }
  return splits
}
