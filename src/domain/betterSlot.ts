import type { KPattern } from 'cubing/kpuzzle'
import { optimalCrossPlusPairSolution, type PairSlot } from './pairSolver'

/**
 * Which pair the solver should have gone for.
 *
 * The single highest-value thing a CFOP coach says. At each F2L decision the solver picks a
 * slot; the app can score every slot still unsolved from the same position and say which one
 * was cheapest. "F2L 3 was slow" is a measurement — "the back-right pair was a 6-move insert,
 * you took the front-left for 14" is something to change next solve.
 */
export type SlotChoice = { slot: PairSlot; moves: string[]; length: number }

export async function scoreSlots(pattern: KPattern, candidates: PairSlot[]): Promise<SlotChoice[]> {
  const scored = await Promise.all(candidates.map(async (slot) => {
    const solution = await optimalCrossPlusPairSolution(pattern, slot)
    return solution ? { slot, moves: solution.moves, length: solution.length } : undefined
  }))
  return scored.filter((entry): entry is SlotChoice => entry !== undefined)
    .sort((left, right) => left.length - right.length)
}

/**
 * The better choice, if there was one. Returns nothing when the solver already took the
 * cheapest pair, or when the difference is too small to be worth a nag.
 */
export function betterSlotThan(chosen: PairSlot, scored: SlotChoice[], minimumSaving = 3) {
  const taken = scored.find((entry) => entry.slot === chosen)
  const best = scored[0]
  if (!taken || !best || best.slot === chosen) return undefined
  if (taken.length - best.length < minimumSaving) return undefined
  return { best, taken, saved: taken.length - best.length }
}
