import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'

const rotationBases = ['', 'x', 'x2', "x'", 'z', "z'"]
const rotations = rotationBases
  .flatMap((base) => ['', 'y', 'y2', "y'"].map((turn) => [base, turn].filter(Boolean).join(' ')))
  .filter(Boolean)
const quarters = [0, 1, 2, 3]

export interface LastLayerCase {
  orientation: string
  permutation: string
  f2lIntact: boolean
  orientationSolved: boolean
  permutationSolved: boolean
}

function centersSolved(pattern: KPattern) {
  return pattern.patternData.CENTERS.pieces.every((piece, index) => piece === index)
}

export function reorientToSolvedCenters(pattern: KPattern) {
  if (centersSolved(pattern)) return pattern
  for (const rotation of rotations) {
    const candidate = pattern.applyAlg(new Alg(rotation))
    if (centersSolved(candidate)) return candidate
  }
  return undefined
}

function shift(values: number[], offset: number) {
  return values.map((_, index) => values[(index + offset) % values.length])
}

export function orientationClassOf(pattern: KPattern, layerOffset = 0) {
  const corners = pattern.patternData.CORNERS.orientation.slice(layerOffset, layerOffset + 4)
  const edges = pattern.patternData.EDGES.orientation.slice(layerOffset, layerOffset + 4)
  return quarters.map((offset) => `${shift(corners, offset).join('')}:${shift(edges, offset).join('')}`).sort()[0]
}

export function permutationClassOf(pattern: KPattern, layerOffset = 0) {
  const corners = pattern.patternData.CORNERS.pieces.slice(layerOffset, layerOffset + 4).map((piece) => piece - layerOffset)
  const edges = pattern.patternData.EDGES.pieces.slice(layerOffset, layerOffset + 4).map((piece) => piece - layerOffset)
  const variants = quarters.flatMap((before) =>
    quarters.map((after) => {
      const rotated = (values: number[]) => shift(values, before).map((value) => (value + after) % 4)
      return `${rotated(corners).join('')}:${rotated(edges).join('')}`
    })
  )
  return variants.sort()[0]
}

function f2lIntact(pattern: KPattern) {
  const { CORNERS, EDGES } = pattern.patternData
  const corners = CORNERS.pieces.slice(4).every((piece, index) => piece === index + 4) && CORNERS.orientation.slice(4).every((value) => value === 0)
  const edges = EDGES.pieces.slice(4).every((piece, index) => piece === index + 4) && EDGES.orientation.slice(4).every((value) => value === 0)
  return corners && edges
}

export async function caseStateOf(algorithm: string) {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const applied = puzzle.defaultPattern().applyAlg(new Alg(algorithm).invert())
  const reoriented = reorientToSolvedCenters(applied)
  if (!reoriented) throw new Error(`Algorithm does not restore the cube frame: ${algorithm}`)
  return reoriented
}

export async function classifyLastLayerAlgorithm(algorithm: string): Promise<LastLayerCase> {
  const state = await caseStateOf(algorithm)
  return {
    orientation: orientationClassOf(state),
    permutation: permutationClassOf(state),
    f2lIntact: f2lIntact(state),
    orientationSolved: orientationClassOf(state) === '0000:0000',
    permutationSolved: permutationClassOf(state) === '0123:0123'
  }
}
