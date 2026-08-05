import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { crossDepthOf, crossMoveTable, moveNames } from './crossSolver'

export type PairSlot = 'FR' | 'FL' | 'BR' | 'BL'

const slotPieces: Record<PairSlot, { corner: number; edge: number }> = {
  FR: { corner: 4, edge: 8 },
  FL: { corner: 5, edge: 9 },
  BL: { corner: 6, edge: 11 },
  BR: { corner: 7, edge: 10 }
}

type CornerMove = { slots: number[]; twists: number[] }

let cornerTable: CornerMove[] | undefined
const pairTables = new Map<PairSlot, Uint8Array>()

async function buildCornerTable() {
  if (cornerTable) return cornerTable
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  cornerTable = moveNames.map((move) => {
    const data = solved.applyAlg(new Alg(move)).patternData.CORNERS
    return { slots: [...data.pieces], twists: [...data.orientation] }
  })
  return cornerTable
}

const pairKey = (cornerSlot: number, cornerTwist: number, edgeSlot: number, edgeFlip: number) =>
  ((cornerSlot * 3 + cornerTwist) * 12 + edgeSlot) * 2 + edgeFlip

async function buildPairTable(slot: PairSlot) {
  const cached = pairTables.get(slot)
  if (cached) return cached
  const corners = await buildCornerTable()
  const edges = await crossMoveTable()
  const table = new Uint8Array(8 * 3 * 12 * 2).fill(255)
  const target = slotPieces[slot]
  const start = { cornerSlot: target.corner, cornerTwist: 0, edgeSlot: target.edge, edgeFlip: 0 }
  table[pairKey(start.cornerSlot, start.cornerTwist, start.edgeSlot, start.edgeFlip)] = 0
  let frontier = [start]

  for (let depth = 1; depth <= 12 && frontier.length; depth += 1) {
    const next: typeof frontier = []
    for (const state of frontier) {
      for (const [index, corner] of corners.entries()) {
        const edge = edges[index]
        const cornerSlot = corner.slots.indexOf(state.cornerSlot)
        const cornerTwist = (state.cornerTwist + corner.twists[cornerSlot]) % 3
        const edgeSlot = edge.slots.indexOf(state.edgeSlot)
        const edgeFlip = (state.edgeFlip + edge.flips[edgeSlot]) % 2
        const key = pairKey(cornerSlot, cornerTwist, edgeSlot, edgeFlip)
        if (table[key] !== 255) continue
        table[key] = depth
        next.push({ cornerSlot, cornerTwist, edgeSlot, edgeFlip })
      }
    }
    frontier = next
  }

  pairTables.set(slot, table)
  return table
}

type SearchState = {
  crossSlots: number[]
  crossFlips: number[]
  cornerSlot: number
  cornerTwist: number
  edgeSlot: number
  edgeFlip: number
}

export async function optimalCrossPlusPairSolution(pattern: KPattern, slot: PairSlot, limit = 11): Promise<{ moves: string[]; length: number } | undefined> {
  const edges = await crossMoveTable()
  const corners = await buildCornerTable()
  const pairTable = await buildPairTable(slot)
  const target = slotPieces[slot]
  const edgeData = pattern.patternData.EDGES
  const cornerData = pattern.patternData.CORNERS

  const crossSlots = [4, 5, 6, 7].map((piece) => edgeData.pieces.indexOf(piece))
  if (crossSlots.some((value) => value === -1)) return undefined
  const state: SearchState = {
    crossSlots,
    crossFlips: crossSlots.map((position) => edgeData.orientation[position] % 2),
    cornerSlot: cornerData.pieces.indexOf(target.corner),
    cornerTwist: cornerData.orientation[cornerData.pieces.indexOf(target.corner)] % 3,
    edgeSlot: edgeData.pieces.indexOf(target.edge),
    edgeFlip: edgeData.orientation[edgeData.pieces.indexOf(target.edge)] % 2
  }
  if (state.cornerSlot === -1 || state.edgeSlot === -1) return undefined

  const heuristic = async (current: SearchState) => Math.max(
    await crossDepthOf(current.crossSlots, current.crossFlips),
    pairTable[pairKey(current.cornerSlot, current.cornerTwist, current.edgeSlot, current.edgeFlip)]
  )

  const solvedState = (current: SearchState) =>
    current.crossSlots.every((position, index) => position === index + 4 && current.crossFlips[index] === 0) &&
    current.cornerSlot === target.corner && current.cornerTwist === 0 &&
    current.edgeSlot === target.edge && current.edgeFlip === 0

  const apply = (current: SearchState, index: number): SearchState => {
    const edge = edges[index]
    const corner = corners[index]
    const nextCrossSlots: number[] = []
    const nextCrossFlips: number[] = []
    for (const [position, slotIndex] of current.crossSlots.entries()) {
      const next = edge.slots.indexOf(slotIndex)
      nextCrossSlots.push(next)
      nextCrossFlips.push((current.crossFlips[position] + edge.flips[next]) % 2)
    }
    const cornerSlot = corner.slots.indexOf(current.cornerSlot)
    const edgeSlot = edge.slots.indexOf(current.edgeSlot)
    return {
      crossSlots: nextCrossSlots,
      crossFlips: nextCrossFlips,
      cornerSlot,
      cornerTwist: (current.cornerTwist + corner.twists[cornerSlot]) % 3,
      edgeSlot,
      edgeFlip: (current.edgeFlip + edge.flips[edgeSlot]) % 2
    }
  }

  const path: number[] = []
  const search = async (current: SearchState, depth: number, bound: number, lastFace: number): Promise<boolean> => {
    if (solvedState(current)) return true
    const estimate = depth + await heuristic(current)
    if (estimate > bound) return false
    for (const [index] of moveNames.entries()) {
      const face = Math.floor(index / 3)
      if (face === lastFace) continue
      path.push(index)
      if (await search(apply(current, index), depth + 1, bound, face)) return true
      path.pop()
    }
    return false
  }

  for (let bound = await heuristic(state); bound <= limit; bound += 1) {
    path.length = 0
    if (await search(state, 0, bound, -1)) return { moves: path.map((index) => moveNames[index]), length: bound }
  }
  return undefined
}

export async function optimalCrossPlusPairMoves(pattern: KPattern, slot: PairSlot, limit = 11): Promise<number | undefined> {
  return (await optimalCrossPlusPairSolution(pattern, slot, limit))?.length
}
