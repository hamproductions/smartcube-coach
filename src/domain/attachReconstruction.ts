import { puzzles } from 'cubing/puzzles'
import { normalizeSolutionMoves } from './guidedSolve'
import { reorientToSolvedCenters } from './lastLayer'
import { segmentCfop } from './reconstruction'
import type { SolveRecord, StageRecord } from './models'

export type AttachReconstructionRejection = {
  accepted: false
  reason: string
}

export type AttachReconstructionSuccess = {
  accepted: true
  solve: SolveRecord
  stages: StageRecord[]
}

export type AttachReconstructionResult = AttachReconstructionRejection | AttachReconstructionSuccess

function withoutFabricatedTiming(stage: StageRecord): StageRecord {
  const {
    recognitionMs: _recognitionMs,
    executionMs: _executionMs,
    tps: _tps,
    pauseCount: _pauseCount,
    longestPauseMs: _longestPauseMs,
    longestPauseAfter: _longestPauseAfter,
    longestPauseBefore: _longestPauseBefore,
    rotationMs: _rotationMs,
    ...untimed
  } = stage
  return untimed
}

export async function attachReconstruction(solve: SolveRecord, typedSolution: string): Promise<AttachReconstructionResult> {
  if (solve.moves.length) return { accepted: false, reason: 'This solve already has a captured move stream.' }

  const trimmed = typedSolution.trim()
  if (!trimmed) return { accepted: false, reason: 'Type a reconstruction before attaching it.' }

  let moves: string[]
  try {
    moves = normalizeSolutionMoves(trimmed)
  } catch (error) {
    return { accepted: false, reason: error instanceof Error ? `Not valid cube notation: ${error.message}` : 'Not valid cube notation.' }
  }
  if (!moves.length) return { accepted: false, reason: 'Type a reconstruction before attaching it.' }

  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const solved = puzzle.defaultPattern()
  let reached
  try {
    reached = solved.applyAlg(solve.scramble).applyAlg(moves.join(' '))
  } catch (error) {
    return { accepted: false, reason: error instanceof Error ? `Not valid cube notation: ${error.message}` : 'Not valid cube notation.' }
  }
  const solvedNow = reorientToSolvedCenters(reached)?.isIdentical(solved) ?? false
  if (!solvedNow) {
    return { accepted: false, reason: 'That reconstruction does not solve this scramble. Nothing was attached.' }
  }

  const events = moves.map((move, index) => ({ move, timestamp: index }))
  const rawStages = await segmentCfop(solve.scramble, events, solve.id)
  const stages = rawStages.map(withoutFabricatedTiming)

  return {
    accepted: true,
    solve: {
      ...solve,
      moves,
      stateVerified: true,
      verificationDetail: 'human-entered reconstruction attached and verified against the scramble by cubing.js state check, no per-move timing captured'
    },
    stages
  }
}
