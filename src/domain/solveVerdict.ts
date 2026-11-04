import type { StageRecord } from './models'

export type StageVerdict = {
  stage: StageRecord
  ms?: number
  usualMs?: number
  deltaMs?: number
  lookDeltaMs?: number
  turnDeltaMs?: number
  usualMoves?: number
  samples: number
}

export type SolveVerdict = {
  stages: StageVerdict[]
  good: StageVerdict[]
  bad: StageVerdict[]
  biggestLoss?: StageVerdict
}

const MIN_SAMPLES = 3
const THRESHOLD_MS = 250
const WINDOW = 50

const total = (stage: StageRecord) => stage.recognitionMs === undefined && stage.executionMs === undefined ? undefined : (stage.recognitionMs ?? 0) + (stage.executionMs ?? 0)
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

export function solveVerdict(stages: StageRecord[], history: StageRecord[]): SolveVerdict {
  const solveId = stages[0]?.solveId
  const others = history.filter((stage) => stage.solveId !== solveId)
  const verdicts = stages.map((stage): StageVerdict => {
    const peers = others.filter((other) => other.name === stage.name && other.moveCount > 0 && total(other) !== undefined).slice(-WINDOW)
    const ms = total(stage)
    if (peers.length < MIN_SAMPLES || ms === undefined || stage.moveCount === 0) return { stage, ms, samples: peers.length }
    const usualMs = mean(peers.map((peer) => total(peer) as number))
    const usualLook = mean(peers.map((peer) => peer.recognitionMs ?? 0))
    const usualTurn = mean(peers.map((peer) => peer.executionMs ?? 0))
    return {
      stage,
      ms,
      usualMs,
      deltaMs: ms - usualMs,
      lookDeltaMs: (stage.recognitionMs ?? 0) - usualLook,
      turnDeltaMs: (stage.executionMs ?? 0) - usualTurn,
      usualMoves: mean(peers.map((peer) => peer.moveCount)),
      samples: peers.length
    }
  })
  const good = verdicts.filter((verdict) => (verdict.deltaMs ?? 0) <= -THRESHOLD_MS).sort((left, right) => (left.deltaMs ?? 0) - (right.deltaMs ?? 0))
  const bad = verdicts.filter((verdict) => (verdict.deltaMs ?? 0) >= THRESHOLD_MS).sort((left, right) => (right.deltaMs ?? 0) - (left.deltaMs ?? 0))
  return { stages: verdicts, good, bad, biggestLoss: bad[0] }
}

export function lossReason(verdict: StageVerdict) {
  const look = verdict.lookDeltaMs ?? 0
  const turn = verdict.turnDeltaMs ?? 0
  const extraMoves = verdict.usualMoves === undefined ? 0 : verdict.stage.moveCount - verdict.usualMoves
  if (look >= turn && look > 0) return `you looked ${(look / 1000).toFixed(2)}s longer than usual before turning`
  if (extraMoves >= 2) return `you turned ${Math.round(extraMoves)} more moves than usual`
  if (turn > 0) return `you turned ${(turn / 1000).toFixed(2)}s slower than usual`
  return 'it took longer than usual'
}

export function gainReason(verdict: StageVerdict) {
  const look = verdict.lookDeltaMs ?? 0
  const turn = verdict.turnDeltaMs ?? 0
  return look <= turn ? 'quicker recognition' : 'faster turning'
}
