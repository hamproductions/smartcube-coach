import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { ollCases, pllCases } from './algorithmCatalogue'
import { caseStateOf, orientationClassOf, permutationClassOf, reorientToSolvedCenters } from './lastLayer'

export type RecognizedCase = {
  id: string
  name: string
  set: 'OLL' | 'PLL'
  repertoireMoves?: number
}

let orientationIndex: Map<string, RecognizedCase> | undefined
let permutationIndex: Map<string, RecognizedCase> | undefined

async function buildIndexes() {
  if (orientationIndex && permutationIndex) return { orientationIndex, permutationIndex }
  const orientation = new Map<string, RecognizedCase>()
  const permutation = new Map<string, RecognizedCase>()

  const moves = (algorithm: string) => algorithm.split(/\s+/).filter(Boolean).filter((move) => !/^[xyz]/i.test(move)).length

  for (const entry of ollCases) {
    const state = await caseStateOf(entry.algorithm)
    orientation.set(orientationClassOf(state), { id: entry.id, name: entry.name, set: 'OLL', repertoireMoves: moves(entry.algorithm) })
  }
  for (const entry of pllCases) {
    const state = await caseStateOf(entry.algorithm)
    permutation.set(permutationClassOf(state), { id: entry.id, name: entry.name, set: 'PLL', repertoireMoves: moves(entry.algorithm) })
  }

  orientationIndex = orientation
  permutationIndex = permutation
  return { orientationIndex, permutationIndex }
}

// The catalogue is indexed on the U layer, where the corner ring and the edge ring run the same
// way round. On the D layer they run opposite ways, so rotating both arrays together does not
// model an AUF there and one turn of the layer changed which case a state read as (Aa became
// Ab). Relabel the position as seen with the cube flipped (a conjugation, so the centres stay
// solved) and read the last layer from the top.
async function lastLayerOnTop(pattern: KPattern, lastLayer: 'U' | 'D') {
  const oriented = reorientToSolvedCenters(pattern) ?? pattern
  if (lastLayer === 'U') return oriented
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const state = oriented.experimentalToTransformation()
  if (!state) return oriented
  const flip = puzzle.algToTransformation(new Alg('x2'))
  return puzzle.defaultPattern().applyTransformation(flip.invert().applyTransformation(state).applyTransformation(flip))
}

export async function recognizeOll(pattern: KPattern, lastLayer: 'U' | 'D' = 'U'): Promise<RecognizedCase | undefined> {
  const { orientationIndex: index } = await buildIndexes()
  const signature = orientationClassOf(await lastLayerOnTop(pattern, lastLayer))
  if (signature === '0000:0000') return { id: 'oll-skip', name: 'OLL skip', set: 'OLL' }
  return index.get(signature)
}

export async function recognizePll(pattern: KPattern, lastLayer: 'U' | 'D' = 'U'): Promise<RecognizedCase | undefined> {
  const { permutationIndex: index } = await buildIndexes()
  const signature = permutationClassOf(await lastLayerOnTop(pattern, lastLayer))
  if (signature === '0123:0123') return { id: 'pll-skip', name: 'PLL skip', set: 'PLL' }
  return index.get(signature)
}
