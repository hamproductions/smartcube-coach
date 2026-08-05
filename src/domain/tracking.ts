import { solvedCube, turn, type CubeModel } from './cubeMath'

const edges = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR']
const corners = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB']
const f2lPairs = [[0, 8], [1, 9], [2, 10], [3, 11]]
const facesByAxis = [['U', 'D'], ['R', 'L'], ['F', 'B']]
const offsets: Record<string, number> = { U: 0, R: 3, F: 6, D: 9, L: 12, B: 15 }
const suffixes = ['', "'", '2']

function random(seed: string) {
  let value = 2166136261
  for (const character of seed) value = Math.imul(value ^ character.charCodeAt(0), 16777619)
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return (value >>> 0) / 2 ** 32
  }
}

function moveIndex(move: string) {
  const face = move[0]
  return offsets[face] + (move.endsWith('2') ? 1 : move.endsWith("'") ? 2 : 0)
}

function movesFromSeed(seed: string, length: number) {
  const next = random(seed)
  const moves: string[] = []
  let previousAxis = -1
  for (let index = 0; index < length; index += 1) {
    const axes = [0, 1, 2].filter((axis) => axis !== previousAxis)
    const axis = axes[Math.floor(next() * axes.length)]
    moves.push(`${facesByAxis[axis][Math.floor(next() * 2)]}${suffixes[Math.floor(next() * suffixes.length)]}`)
    previousAxis = axis
  }
  return moves
}

function cubeAfterMoves(moves: string[]) {
  let cube = solvedCube()
  for (const move of moves) {
    cube = turn(cube, move)
  }
  return cube
}

function edgeSlotAfterMoves(piece: number, moves: string[]) {
  return cubeAfterMoves(moves).ea.findIndex((edge) => (edge >> 1) === piece)
}

function edgeOrientationAfterMoves(piece: number, moves: string[]) {
  return cubeAfterMoves(moves).ea.find((edge) => (edge >> 1) === piece)! & 1
}

export type EdgeTrackingPrompt = {
  seed: string
  target: string
  moves: string[]
  answer: string
}

export function generateEdgeTrackingPrompt(seed: string): EdgeTrackingPrompt {
  const next = random(`${seed}:edge`)
  const targetIndex = Math.floor(next() * edges.length)
  const moves = movesFromSeed(seed, 6)
  return { seed, target: edges[targetIndex], moves, answer: edges[edgeSlotAfterMoves(targetIndex, moves)] }
}

export function gradeEdgeTracking(prompt: EdgeTrackingPrompt, answer: string) {
  return prompt.answer === answer.trim().toUpperCase()
}

export type EdgeOrientationPrompt = {
  seed: string
  target: string
  moves: string[]
  answer: 'oriented' | 'flipped'
}

export function generateEdgeOrientationPrompt(seed: string): EdgeOrientationPrompt {
  const next = random(`${seed}:orientation`)
  const targetIndex = Math.floor(next() * edges.length)
  const moves = movesFromSeed(seed, 6)
  return { seed, target: edges[targetIndex], moves, answer: edgeOrientationAfterMoves(targetIndex, moves) ? 'flipped' : 'oriented' }
}

export function gradeEdgeOrientation(prompt: EdgeOrientationPrompt, answer: string) {
  return prompt.answer === answer.trim().toLowerCase()
}

export type PairTrackingPrompt = {
  seed: string
  target: string
  moves: string[]
  answer: string
}

export function generatePairTrackingPrompt(seed: string): PairTrackingPrompt {
  const next = random(`${seed}:pair`)
  const [cornerPiece, edgePiece] = f2lPairs[Math.floor(next() * f2lPairs.length)]
  const moves = movesFromSeed(seed, 8)
  const cube = cubeAfterMoves(moves)
  const cornerSlot = cube.ca.findIndex((corner) => (corner & 7) === cornerPiece)
  const edgeSlot = cube.ea.findIndex((edge) => (edge >> 1) === edgePiece)
  return { seed, target: `${corners[cornerPiece]} + ${edges[edgePiece]}`, moves, answer: `${corners[cornerSlot]} ${edges[edgeSlot]}` }
}

export function gradePairTracking(prompt: PairTrackingPrompt, answer: string) {
  return prompt.answer === answer.trim().toUpperCase().replaceAll('+', ' ').replaceAll(/\s+/g, ' ')
}
