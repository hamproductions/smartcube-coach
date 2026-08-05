import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { optimalCrossPlusPairSolution } from './pairSolver'
import { f2lCatalogue } from './f2lCatalogue'

export type F2lCornerPosition = 'top' | 'slot-correct' | 'slot-twisted'
export type F2lEdgePosition = 'top' | 'slot-correct' | 'slot-flipped'

export type F2lSlotName = 'FR' | 'FL' | 'BL' | 'BR'

export type F2lCase = {
  id: string
  name: string
  slot: F2lSlotName
  setup: string
  algPool: string[]
  cornerPosition: F2lCornerPosition
  cornerOrientation: 'up' | 'front' | 'side'
  edgePosition: F2lEdgePosition
  edgeOrientation: 'oriented' | 'flipped'
  ignoreAuf: boolean
  optimalMoves: number
}

const inverseOf = (alg: string) => new Alg(alg).invert().toString()

function describeCase(
  corner: { position: F2lCornerPosition; orientation: 'up' | 'front' | 'side' },
  edge: { position: F2lEdgePosition; orientation: 'oriented' | 'flipped' },
  slotLabel: string
) {
  const cornerText = corner.position === 'top'
    ? `corner on top facing ${corner.orientation}`
    : corner.position === 'slot-correct' ? 'corner seated' : 'corner twisted in slot'
  const edgeText = edge.position === 'top'
    ? `edge on top ${edge.orientation}`
    : edge.position === 'slot-correct' ? 'edge seated' : 'edge flipped in slot'
  return `${slotLabel} · ${cornerText}, ${edgeText}`
}

function classifyCorner(pattern: KPattern): { position: F2lCornerPosition; orientation: 'up' | 'front' | 'side' } {
  const corners = pattern.patternData.CORNERS
  const slotIndex = corners.pieces.indexOf(4)
  if (slotIndex === 4) {
    return { position: corners.orientation[4] === 0 ? 'slot-correct' : 'slot-twisted', orientation: corners.orientation[4] === 0 ? 'up' : corners.orientation[4] === 1 ? 'front' : 'side' }
  }
  const twist = corners.orientation[slotIndex]
  return { position: 'top', orientation: twist === 0 ? 'up' : twist === 1 ? 'front' : 'side' }
}

function classifyEdge(pattern: KPattern): { position: F2lEdgePosition; orientation: 'oriented' | 'flipped' } {
  const edges = pattern.patternData.EDGES
  const slotIndex = edges.pieces.indexOf(8)
  const flipped = edges.orientation[slotIndex] !== 0
  if (slotIndex === 8) return { position: flipped ? 'slot-flipped' : 'slot-correct', orientation: flipped ? 'flipped' : 'oriented' }
  return { position: 'top', orientation: flipped ? 'flipped' : 'oriented' }
}

const slotFrames: Array<{ slot: F2lSlotName; rotation: string; label: string }> = [
  { slot: 'FR', rotation: '', label: 'Front Right' },
  { slot: 'FL', rotation: 'y', label: 'Front Left' },
  { slot: 'BL', rotation: 'y2', label: 'Back Left' },
  { slot: 'BR', rotation: "y'", label: 'Back Right' }
]

const f2lCasesCache = new Map<string, Promise<F2lCase[]>>()

export function buildF2lCases(slots: F2lSlotName[] = ['FR']): Promise<F2lCase[]> {
  const key = [...slots].sort().join(',')
  const cached = f2lCasesCache.get(key)
  if (cached) return cached
  const built = buildF2lCasesUncached(slots)
  f2lCasesCache.set(key, built)
  built.catch(() => f2lCasesCache.delete(key))
  return built
}

async function buildF2lCasesUncached(slots: F2lSlotName[]): Promise<F2lCase[]> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  const cases: F2lCase[] = []

  for (const entry of f2lCatalogue) {
    if (!slots.includes(entry.slot)) continue
    const setup = inverseOf(entry.algorithm)
    let pattern
    try {
      pattern = solved.applyAlg(setup)
    } catch {
      continue
    }
    const corner = classifyCorner(pattern)
    const edge = classifyEdge(pattern)
    const solution = await optimalCrossPlusPairSolution(pattern, entry.slot)
    if (!solution || solution.length === 0) continue
    cases.push({
      id: `f2l-${entry.slot.toLowerCase()}-${entry.caseNumber}`,
      name: entry.name,
      slot: entry.slot,
      setup,
      algPool: [entry.algorithm, solution.moves.join(' ')].filter((alg, index, list) => alg && list.indexOf(alg) === index),
      cornerPosition: corner.position,
      cornerOrientation: corner.orientation,
      edgePosition: edge.position,
      edgeOrientation: edge.orientation,
      ignoreAuf: corner.position !== 'top' && edge.position !== 'top',
      optimalMoves: solution.length
    })
  }

  return cases
}
