import type { AlgorithmRecord, StageRecord } from './models'

/**
 * The algorithm the solver should have used for the case they actually hit.
 *
 * "F2L 3 took 2.5 seconds" is a measurement. "You hit the T-Shape and used 11 moves; the
 * standard alg is 7, here it is" is the thing that changes the next solve. The catalogue is
 * already loaded for the trainer, so this is a lookup, not new data.
 */
export type BetterAlgorithm = {
  caseName: string
  algorithm: string
  moveCount: number
  savedMoves: number
}

const countMoves = (algorithm: string) => algorithm.trim().split(/\s+/).filter(Boolean).length

export function betterAlgorithmFor(stage: StageRecord, catalogue: AlgorithmRecord[]): BetterAlgorithm | undefined {
  const name = stage.caseName?.trim()
  if (!name) return undefined

  // Prefer an exact name match; fall back to the case id the segmenter recorded.
  const record = catalogue.find((entry) => entry.name === name)
    ?? (stage.caseId ? catalogue.find((entry) => entry.id === stage.caseId) : undefined)
  if (!record?.algorithm.trim()) return undefined

  const moveCount = countMoves(record.algorithm)
  const savedMoves = stage.moveCount - moveCount
  // Only worth saying when their execution was actually longer than the known algorithm.
  if (savedMoves < 2) return undefined

  return { caseName: record.name, algorithm: record.algorithm.trim(), moveCount, savedMoves }
}
