import type { KPattern } from 'cubing/kpuzzle'
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

export async function recognizeOll(pattern: KPattern, lastLayer: 'U' | 'D' = 'U'): Promise<RecognizedCase | undefined> {
  const { orientationIndex: index } = await buildIndexes()
  const oriented = reorientToSolvedCenters(pattern) ?? pattern
  const signature = orientationClassOf(oriented, lastLayer === 'D' ? 4 : 0)
  if (signature === '0000:0000') return { id: 'oll-skip', name: 'OLL skip', set: 'OLL' }
  return index.get(signature)
}

export async function recognizePll(pattern: KPattern, lastLayer: 'U' | 'D' = 'U'): Promise<RecognizedCase | undefined> {
  const { permutationIndex: index } = await buildIndexes()
  const oriented = reorientToSolvedCenters(pattern) ?? pattern
  const signature = permutationClassOf(oriented, lastLayer === 'D' ? 4 : 0)
  if (signature === '0123:0123') return { id: 'pll-skip', name: 'PLL skip', set: 'PLL' }
  return index.get(signature)
}
