import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { cmllCases, collCases, eollCases, ollCases, pllCases, toAlgorithmRecord } from './algorithmCatalogue'
import { caseStateOf, classifyLastLayerAlgorithm, reorientToSolvedCenters } from './lastLayer'

const quarters = [0, 1, 2, 3]

function shift<T>(values: T[], offset: number): T[] {
  return values.map((_, index) => values[(index + offset) % values.length])
}

function cornerClassOf(pattern: KPattern) {
  const orientation = pattern.patternData.CORNERS.orientation.slice(0, 4)
  const pieces = pattern.patternData.CORNERS.pieces.slice(0, 4)
  const variants = quarters.flatMap((before) =>
    quarters.map((after) => {
      const rotatedOrientation = shift(orientation, before)
      const rotatedPieces = shift(pieces, before).map((piece) => (piece + after) % 4)
      return `${rotatedOrientation.join('')}:${rotatedPieces.join('')}`
    })
  )
  return variants.sort()[0]
}

function cornerSolved(pattern: KPattern) {
  const orientation = pattern.patternData.CORNERS.orientation.slice(0, 4)
  const pieces = pattern.patternData.CORNERS.pieces.slice(0, 4)
  return orientation.every((value) => value === 0) && pieces.every((piece, index) => piece === index)
}

function lastLayerEdgesOriented(pattern: KPattern) {
  return pattern.patternData.EDGES.orientation.slice(0, 4).every((value) => value === 0)
}

function rouxBlocksIntact(pattern: KPattern) {
  const { CORNERS, EDGES } = pattern.patternData
  const cornersIntact = CORNERS.pieces.slice(4).every((piece, index) => piece === index + 4) && CORNERS.orientation.slice(4).every((value) => value === 0)
  const blockEdgeIndices = [5, 7, 8, 9, 10, 11]
  const edgesIntact = blockEdgeIndices.every((index) => EDGES.pieces[index] === index && EDGES.orientation[index] === 0)
  return cornersIntact && edgesIntact
}

describe('algorithm catalogue', () => {
  it('covers all 57 OLL cases with distinct orientation states', async () => {
    const signatures = new Map<string, string>()

    for (const entry of ollCases) {
      const result = await classifyLastLayerAlgorithm(entry.algorithm)
      expect(result.f2lIntact, `${entry.id} breaks F2L`).toBe(true)
      expect(result.orientationSolved, `${entry.id} orients nothing`).toBe(false)
      expect(signatures.get(result.orientation), `${entry.id} duplicates another case`).toBeUndefined()
      signatures.set(result.orientation, entry.id)
    }

    expect(signatures.size).toBe(57)
  }, 60_000)

  it('covers all 21 PLL cases with distinct permutation states', async () => {
    const signatures = new Map<string, string>()

    for (const entry of pllCases) {
      const result = await classifyLastLayerAlgorithm(entry.algorithm)
      expect(result.f2lIntact, `${entry.id} breaks F2L`).toBe(true)
      expect(result.orientationSolved, `${entry.id} misorients the last layer`).toBe(true)
      expect(result.permutationSolved, `${entry.id} permutes nothing`).toBe(false)
      expect(signatures.get(result.permutation), `${entry.id} duplicates another case`).toBeUndefined()
      signatures.set(result.permutation, entry.id)
    }

    expect(signatures.size).toBe(21)
  }, 60_000)

  it('derives a parseable setup from every algorithm', () => {
    for (const entry of [...ollCases, ...eollCases, ...pllCases]) {
      const record = toAlgorithmRecord(entry, 0)
      expect(record.setup.length).toBeGreaterThan(0)
      expect(() => new Alg(record.setup)).not.toThrow()
      expect(record.dueAt).toBe(0)
    }
  })

  it('covers the 3 EOLL cases with distinct, genuine edge-orientation shapes', async () => {
    const signatures = new Map<string, string>()
    const orientedIndicesById = new Map<string, number[]>()

    for (const entry of eollCases) {
      const result = await classifyLastLayerAlgorithm(entry.algorithm)
      expect(result.f2lIntact, `${entry.id} breaks F2L`).toBe(true)

      const setupState = await caseStateOf(entry.algorithm)
      const edgeOrientation = setupState.patternData.EDGES.orientation.slice(0, 4)
      const orientedIndices = edgeOrientation.flatMap((value, index) => (value === 0 ? [index] : []))
      orientedIndicesById.set(entry.id, orientedIndices)

      expect(signatures.get(result.orientation), `${entry.id} duplicates another case's orientation class`).toBeUndefined()
      signatures.set(result.orientation, entry.id)
    }

    expect(signatures.size).toBe(3)
    expect(orientedIndicesById.get('eoll-dot')).toHaveLength(0)
    expect(orientedIndicesById.get('eoll-line')).toHaveLength(2)
    expect(orientedIndicesById.get('eoll-l')).toHaveLength(2)

    const [lineFirst, lineSecond] = orientedIndicesById.get('eoll-line')!
    expect(Math.abs(lineFirst - lineSecond)).toBe(2)

    const [lFirst, lSecond] = orientedIndicesById.get('eoll-l')!
    expect(Math.abs(lFirst - lSecond)).not.toBe(2)
  }, 60_000)

  it('restores a solved cube and orients all four last-layer edges when setup and algorithm run in sequence', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = puzzle.defaultPattern()

    for (const entry of eollCases) {
      const record = toAlgorithmRecord(entry, 0)
      const afterSetup = solved.applyAlg(new Alg(record.setup))
      const afterAlgorithm = afterSetup.applyAlg(new Alg(record.algorithm))

      expect(afterAlgorithm.isIdentical(solved), `${entry.id} setup+algorithm does not restore the solved cube`).toBe(true)
      const edgeOrientation = afterAlgorithm.patternData.EDGES.orientation.slice(0, 4)
      expect(edgeOrientation.every((value) => value === 0), `${entry.id} leaves a last-layer edge unoriented`).toBe(true)

      const cornerPieces = afterSetup.patternData.CORNERS.pieces.slice(4)
      const cornerOrientation = afterSetup.patternData.CORNERS.orientation.slice(4)
      const edgePieces = afterSetup.patternData.EDGES.pieces.slice(4)
      const edgeOrientationF2L = afterSetup.patternData.EDGES.orientation.slice(4)
      expect(cornerPieces.every((piece, index) => piece === index + 4), `${entry.id} setup disturbs F2L corners`).toBe(true)
      expect(cornerOrientation.every((value) => value === 0), `${entry.id} setup twists F2L corners`).toBe(true)
      expect(edgePieces.every((piece, index) => piece === index + 4), `${entry.id} setup disturbs F2L edges`).toBe(true)
      expect(edgeOrientationF2L.every((value) => value === 0), `${entry.id} setup flips F2L edges`).toBe(true)
    }
  }, 60_000)

  it('covers all 40 verified COLL cases with distinct corner-solving states and intact F2L', async () => {
    const signatures = new Map<string, string>()

    for (const entry of collCases) {
      const classification = await classifyLastLayerAlgorithm(entry.algorithm)
      expect(classification.f2lIntact, `${entry.id} breaks F2L`).toBe(true)

      const state = await caseStateOf(entry.algorithm)
      expect(lastLayerEdgesOriented(state), `${entry.id} requires solving last-layer edge orientation, which COLL assumes done`).toBe(true)
      expect(cornerSolved(state), `${entry.id} does not require solving any corners`).toBe(false)

      const signature = cornerClassOf(state)
      expect(signatures.get(signature), `${entry.id} duplicates another case`).toBeUndefined()
      signatures.set(signature, entry.id)
    }

    expect(signatures.size).toBe(40)
  }, 60_000)

  it('restores a solved cube and fully solves the last-layer corners when a COLL setup and algorithm run in sequence', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = puzzle.defaultPattern()

    for (const entry of collCases) {
      const record = toAlgorithmRecord(entry, 0)
      const afterSetup = solved.applyAlg(new Alg(record.setup))
      const afterAlgorithm = afterSetup.applyAlg(new Alg(record.algorithm))

      expect(afterAlgorithm.isIdentical(solved), `${entry.id} setup+algorithm does not restore the solved cube`).toBe(true)
      expect(cornerSolved(afterAlgorithm), `${entry.id} leaves last-layer corners unsolved`).toBe(true)

      const reorientedSetup = reorientToSolvedCenters(afterSetup)!
      const cornerPieces = reorientedSetup.patternData.CORNERS.pieces.slice(4)
      const cornerOrientation = reorientedSetup.patternData.CORNERS.orientation.slice(4)
      const edgePieces = reorientedSetup.patternData.EDGES.pieces.slice(4)
      const edgeOrientationF2L = reorientedSetup.patternData.EDGES.orientation.slice(4)
      expect(cornerPieces.every((piece, index) => piece === index + 4), `${entry.id} setup disturbs F2L corners`).toBe(true)
      expect(cornerOrientation.every((value) => value === 0), `${entry.id} setup twists F2L corners`).toBe(true)
      expect(edgePieces.every((piece, index) => piece === index + 4), `${entry.id} setup disturbs F2L edges`).toBe(true)
      expect(edgeOrientationF2L.every((value) => value === 0), `${entry.id} setup flips F2L edges`).toBe(true)
    }
  }, 60_000)

  it('covers all 42 CMLL cases with distinct corner-solving states and intact first-two-blocks, ignoring the M slice', async () => {
    const signatures = new Map<string, string>()

    for (const entry of cmllCases) {
      const state = await caseStateOf(entry.algorithm)
      expect(rouxBlocksIntact(state), `${entry.id} disturbs the first two blocks`).toBe(true)
      expect(cornerSolved(state), `${entry.id} does not require solving any corners`).toBe(false)

      const signature = cornerClassOf(state)
      expect(signatures.get(signature), `${entry.id} duplicates another case`).toBeUndefined()
      signatures.set(signature, entry.id)
    }

    expect(signatures.size).toBe(42)
  }, 60_000)

  it('restores a solved cube and fully solves the last-layer corners when a CMLL setup and algorithm run in sequence', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = puzzle.defaultPattern()

    for (const entry of cmllCases) {
      const record = toAlgorithmRecord(entry, 0)
      const afterSetup = solved.applyAlg(new Alg(record.setup))
      const afterAlgorithm = afterSetup.applyAlg(new Alg(record.algorithm))

      expect(afterAlgorithm.isIdentical(solved), `${entry.id} setup+algorithm does not restore the solved cube`).toBe(true)
      expect(cornerSolved(afterAlgorithm), `${entry.id} leaves last-layer corners unsolved`).toBe(true)
      expect(rouxBlocksIntact(afterSetup), `${entry.id} setup disturbs the first two blocks`).toBe(true)
    }
  }, 60_000)
})
