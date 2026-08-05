import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { f2lCatalogue } from './f2lCatalogue'
import type { PairSlot } from './pairSolver'

/**
 * Which F2L case the solver actually hit, so the stage that costs the most time can say
 * what it was rather than only how long it took. The segmenter already knows the slot and
 * the position the stage started from; the case is where the pair's two pieces sit in it.
 *
 * A case is recognised regardless of AUF: the same pair one U turn away is the same case,
 * so every catalogue state is indexed in all four U positions.
 */
export type RecognizedF2lCase = {
  id: string
  name: string
  slot: PairSlot
  algorithm: string
  repertoireMoves: number
}

const slotPieces: Record<PairSlot, { corner: number; edge: number }> = {
  FR: { corner: 4, edge: 8 },
  FL: { corner: 5, edge: 9 },
  BL: { corner: 6, edge: 11 },
  BR: { corner: 7, edge: 10 }
}

const AUFS = ['', 'U', 'U2', "U'"] as const

const faceMoves = (algorithm: string) =>
  algorithm.split(/\s+/).filter(Boolean).filter((move) => !/^[xyz]/i.test(move)).length

export function f2lSignature(pattern: KPattern, slot: PairSlot): string | undefined {
  const { corner, edge } = slotPieces[slot]
  const corners = pattern.patternData.CORNERS
  const edges = pattern.patternData.EDGES
  const cornerAt = corners.pieces.indexOf(corner)
  const edgeAt = edges.pieces.indexOf(edge)
  if (cornerAt === -1 || edgeAt === -1) return undefined
  return `${slot}|${cornerAt}.${corners.orientation[cornerAt]}:${edgeAt}.${edges.orientation[edgeAt]}`
}

let index: Map<string, RecognizedF2lCase> | undefined

export async function buildF2lIndex() {
  if (index) return index
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  const built = new Map<string, RecognizedF2lCase>()

  for (const entry of f2lCatalogue) {
    const recognised: RecognizedF2lCase = {
      id: `f2l-${entry.slot.toLowerCase()}-${entry.caseNumber}`,
      name: entry.name,
      slot: entry.slot,
      algorithm: entry.algorithm,
      repertoireMoves: faceMoves(entry.algorithm)
    }
    let state: KPattern
    try {
      state = solved.applyAlg(new Alg(entry.algorithm).invert())
    } catch {
      continue
    }
    for (const auf of AUFS) {
      const signature = f2lSignature(auf ? state.applyAlg(auf) : state, entry.slot)
      // First entry wins: the catalogue is ordered by case number, so a state two case
      // numbers describe is reported as the lower one rather than whichever came last.
      if (signature && !built.has(signature)) built.set(signature, recognised)
    }
  }

  index = built
  return index
}

export async function recognizeF2l(pattern: KPattern, slot: PairSlot): Promise<RecognizedF2lCase | undefined> {
  const table = await buildF2lIndex()
  const signature = f2lSignature(pattern, slot)
  return signature ? table.get(signature) : undefined
}
