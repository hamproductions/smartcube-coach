export type MoveKind = 'rotation' | 'slice' | 'face'

export type PhaseMetrics = {
  stm: number
  etm: number
  stps?: number
  etps?: number
  splitPercent?: number
}

const ROTATION_PATTERN = /^[xyz]/i
const SLICE_PATTERN = /^[mes]/i

const stmWeight: Record<MoveKind, number> = { rotation: 0, slice: 1, face: 1 }
const etmWeight: Record<MoveKind, number> = { rotation: 0, slice: 2, face: 1 }

export function classifyMove(move: string): MoveKind {
  if (ROTATION_PATTERN.test(move)) return 'rotation'
  if (SLICE_PATTERN.test(move)) return 'slice'
  return 'face'
}

export function countStm(moves: string[]): number {
  return moves.reduce((sum, move) => sum + stmWeight[classifyMove(move)], 0)
}

export function countEtm(moves: string[]): number {
  return moves.reduce((sum, move) => sum + etmWeight[classifyMove(move)], 0)
}

export function turnsPerSecond(turnCount: number, durationMs: number | undefined): number | undefined {
  if (durationMs === undefined || durationMs <= 0) return undefined
  return turnCount / (durationMs / 1000)
}

export function stps(moves: string[], durationMs: number | undefined): number | undefined {
  return turnsPerSecond(countStm(moves), durationMs)
}

export function etps(moves: string[], durationMs: number | undefined): number | undefined {
  return turnsPerSecond(countEtm(moves), durationMs)
}

export function splitPercent(phaseDurationMs: number | undefined, totalDurationMs: number | undefined): number | undefined {
  if (phaseDurationMs === undefined || totalDurationMs === undefined || totalDurationMs <= 0) return undefined
  return (phaseDurationMs / totalDurationMs) * 100
}

export function computePhaseMetrics(moves: string[], durationMs: number | undefined, totalDurationMs: number | undefined): PhaseMetrics {
  return {
    stm: countStm(moves),
    etm: countEtm(moves),
    stps: turnsPerSecond(countStm(moves), durationMs),
    etps: turnsPerSecond(countEtm(moves), durationMs),
    splitPercent: splitPercent(durationMs, totalDurationMs)
  }
}
