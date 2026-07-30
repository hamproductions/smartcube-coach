import type { SolveRecord, StageRecord, TrainerAttempt } from './models'

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

export function averageOf(solves: SolveRecord[], count: number) {
  const times = [...solves]
    .sort((left, right) => right.endedAt - left.endedAt)
    .slice(0, count)
    .map((solve) => solve.endedAt - solve.startedAt)
  if (times.length < count) return undefined
  if (count < 5) return mean(times)
  const sorted = [...times].sort((left, right) => left - right)
  const trim = Math.ceil(count * 0.05)
  return mean(sorted.slice(trim, sorted.length - trim))
}

export function stageTrends(stages: StageRecord[]) {
  const groups = new Map<string, StageRecord[]>()
  for (const stage of stages) groups.set(stage.name, [...(groups.get(stage.name) ?? []), stage])
  return [...groups.entries()].map(([name, group]) => ({
    name,
    recognitionMs: mean(group.map((stage) => stage.recognitionMs)),
    executionMs: mean(group.map((stage) => stage.executionMs)),
    tps: mean(group.map((stage) => stage.tps)),
    moves: mean(group.map((stage) => stage.moveCount)),
    rotations: mean(group.map((stage) => stage.rotationCount)),
    pauses: mean(group.map((stage) => stage.pauseCount))
  }))
}

export function transferSummary(attempts: TrainerAttempt[], solves: SolveRecord[]) {
  const completed = attempts.filter((attempt) => attempt.outcome === 'success')
  const drillSuccess = attempts.length ? completed.length / attempts.length : 0
  const ordered = [...solves].sort((left, right) => left.endedAt - right.endedAt)
  const midpoint = Math.floor(ordered.length / 2)
  const before = mean(ordered.slice(0, midpoint).map((solve) => solve.endedAt - solve.startedAt))
  const after = mean(ordered.slice(midpoint).map((solve) => solve.endedAt - solve.startedAt))
  return { drillSuccess, before, after, improved: before > 0 && after > 0 && after < before }
}
