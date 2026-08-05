import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'

const faces = ['U', 'R', 'F', 'D', 'L', 'B']
export const moveNames = faces.flatMap((face) => [face, `${face}2`, `${face}'`])
const crossPieces = [4, 5, 6, 7]

export type EdgeMove = { slots: number[]; flips: number[] }

let moveTable: EdgeMove[] | undefined
let depths: Uint8Array | undefined

export async function crossMoveTable() {
  return buildMoveTable()
}

export async function crossDepthOf(slots: number[], flips: number[]) {
  const table = await buildDepthTable()
  const depth = table[encode(slots, flips)]
  return depth === 255 ? 20 : depth
}

async function buildMoveTable() {
  if (moveTable) return moveTable
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  moveTable = moveNames.map((move) => {
    const data = solved.applyAlg(new Alg(move)).patternData.EDGES
    return { slots: [...data.pieces], flips: [...data.orientation] }
  })
  return moveTable
}

const encode = (slots: number[], flips: number[]) =>
  slots.reduce((value, slot, index) => value * 24 + slot * 2 + flips[index], 0)

function applyMove(slots: number[], flips: number[], move: EdgeMove) {
  const nextSlots: number[] = []
  const nextFlips: number[] = []
  for (const [index, slot] of slots.entries()) {
    const target = move.slots.indexOf(slot)
    nextSlots.push(target)
    nextFlips.push((flips[index] + move.flips[target]) % 2)
  }
  return { slots: nextSlots, flips: nextFlips }
}

async function buildDepthTable() {
  if (depths) return depths
  const table = await buildMoveTable()
  const size = 24 ** 4
  const found = new Uint8Array(size).fill(255)
  const start = { slots: [...crossPieces], flips: [0, 0, 0, 0] }
  found[encode(start.slots, start.flips)] = 0
  let frontier = [start]

  for (let depth = 1; depth <= 8 && frontier.length; depth += 1) {
    const next: Array<{ slots: number[]; flips: number[] }> = []
    for (const state of frontier) {
      for (const move of table) {
        const candidate = applyMove(state.slots, state.flips, move)
        const key = encode(candidate.slots, candidate.flips)
        if (found[key] !== 255) continue
        found[key] = depth
        next.push(candidate)
      }
    }
    frontier = next
  }

  depths = found
  return depths
}

export async function framePattern(pattern: KPattern, frame: string, rotationsBefore: string[] = []) {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  const rotated = rotationsBefore.length ? pattern.applyAlg(new Alg(rotationsBefore.join(' '))) : pattern
  const transformation = rotated.experimentalToTransformation()
  return frame && transformation
    ? solved.applyAlg(new Alg(frame).invert()).applyTransformation(transformation)
    : rotated
}

export async function optimalCrossMovesInFrame(pattern: KPattern, frame: string, rotationsBefore: string[] = []): Promise<number | undefined> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  const rotated = rotationsBefore.length ? pattern.applyAlg(new Alg(rotationsBefore.join(' '))) : pattern
  const transformation = rotated.experimentalToTransformation()
  const framed = frame && transformation
    ? solved.applyAlg(new Alg(frame).invert()).applyTransformation(transformation)
    : rotated
  return optimalCrossMoves(framed)
}

export async function optimalCrossMoves(pattern: KPattern): Promise<number | undefined> {
  const table = await buildDepthTable()
  const data = pattern.patternData.EDGES
  const slots: number[] = []
  const flips: number[] = []

  for (const piece of crossPieces) {
    const slot = data.pieces.indexOf(piece)
    if (slot === -1) return undefined
    slots.push(slot)
    flips.push(data.orientation[slot] % 2)
  }

  const depth = table[encode(slots, flips)]
  return depth === 255 ? undefined : depth
}
