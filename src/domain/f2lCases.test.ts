import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { buildF2lCases } from './f2lCases'

const slotPieces = {
  FR: { corner: 4, edge: 8 },
  FL: { corner: 5, edge: 9 },
  BL: { corner: 6, edge: 11 },
  BR: { corner: 7, edge: 10 }
} as const

describe('generated F2L case catalogue', () => {
  it('gives every case an algorithm that actually solves cross plus that pair', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = puzzle.defaultPattern()
    const cases = await buildF2lCases(['FR'])

    expect(cases.length).toBeGreaterThan(30)

    for (const entry of cases) {
      const solvedState = solved.applyAlg(entry.setup).applyAlg(entry.algPool[0])
      const pieces = slotPieces[entry.slot]
      const edges = solvedState.patternData.EDGES
      const corners = solvedState.patternData.CORNERS

      expect(edges.pieces[pieces.edge], `${entry.id} edge`).toBe(pieces.edge)
      expect(edges.orientation[pieces.edge], `${entry.id} edge orientation`).toBe(0)
      expect(corners.pieces[pieces.corner], `${entry.id} corner`).toBe(pieces.corner)
      expect(corners.orientation[pieces.corner], `${entry.id} corner orientation`).toBe(0)

      for (const crossEdge of [4, 5, 6, 7]) {
        expect(edges.pieces[crossEdge], `${entry.id} cross edge ${crossEdge}`).toBe(crossEdge)
        expect(edges.orientation[crossEdge], `${entry.id} cross orientation ${crossEdge}`).toBe(0)
      }
    }
  }, 120_000)

  it('keeps every alternative algorithm in the pool solving the same case', async () => {
    const puzzle = await puzzles['3x3x3'].kpuzzle()
    const solved = puzzle.defaultPattern()
    const cases = await buildF2lCases(['FR'])

    for (const entry of cases) {
      for (const alg of entry.algPool) {
        const result = solved.applyAlg(entry.setup).applyAlg(alg)
        const pieces = slotPieces[entry.slot]
        expect(result.patternData.EDGES.pieces[pieces.edge], `${entry.id} :: ${alg}`).toBe(pieces.edge)
        expect(result.patternData.CORNERS.pieces[pieces.corner], `${entry.id} :: ${alg}`).toBe(pieces.corner)
      }
    }
  }, 120_000)

  it('reports the optimal move count it claims for each case', async () => {
    const cases = await buildF2lCases(['FR'])
    for (const entry of cases) {
      const taught = entry.algPool[0].split(/\s+/).filter(Boolean)
      expect(entry.optimalMoves, entry.id).toBeGreaterThan(0)
      expect(entry.optimalMoves, entry.id).toBeLessThanOrEqual(taught.length)
      expect(new Alg(entry.setup).toString().length).toBeGreaterThan(0)
    }
  }, 120_000)

  it('never emits two cases for the same cube state', async () => {
    const cases = await buildF2lCases(['FR', 'FL'])
    const ids = cases.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  }, 180_000)
})
