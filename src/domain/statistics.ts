import type { SolveRecord, StageRecord, TrainerAttempt } from './models'

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

export function effectiveSolveMs(solve: Pick<SolveRecord, 'startedAt' | 'endedAt' | 'penalty'>) {
  if (solve.penalty === 'dnf') return undefined
  return solve.endedAt - solve.startedAt + (solve.penalty === '+2' ? 2_000 : 0)
}

export function bestSingle(solves: SolveRecord[]) {
  const times = solves.map((solve) => effectiveSolveMs(solve)).filter((value): value is number => value !== undefined)
  return times.length ? Math.min(...times) : undefined
}

function sortedInsertIndex(sorted: number[], value: number) {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (sorted[middle] < value) low = middle + 1
    else high = middle
  }
  return low
}

export function bestAverageOf(solves: SolveRecord[], count: number) {
  const ordered = [...solves].sort((left, right) => left.endedAt - right.endedAt)
  if (ordered.length < count) return undefined
  if (count < 5) {
    let best: number | undefined
    for (let index = count; index <= ordered.length; index += 1) {
      const value = averageOf(ordered.slice(index - count, index), count)
      if (value !== undefined && (best === undefined || value < best)) best = value
    }
    return best
  }

  const trim = Math.ceil(count * 0.05)
  const effective = ordered.map((solve) => effectiveSolveMs(solve))

  const sorted: number[] = []
  let dnfCount = 0
  let runningSum = 0
  const insert = (value: number | undefined) => {
    if (value === undefined) {
      dnfCount += 1
      return
    }
    const index = sortedInsertIndex(sorted, value)
    sorted.splice(index, 0, value)
    runningSum += value
  }
  const remove = (value: number | undefined) => {
    if (value === undefined) {
      dnfCount -= 1
      return
    }
    const index = sortedInsertIndex(sorted, value)
    sorted.splice(index, 1)
    runningSum -= value
  }

  for (let index = 0; index < count; index += 1) insert(effective[index])

  let best: number | undefined
  const evaluate = () => {
    if (dnfCount > trim) return
    const tailTrim = trim - dnfCount
    const keptLength = sorted.length - trim - tailTrim
    if (keptLength <= 0) return
    let headSum = 0
    for (let index = 0; index < trim; index += 1) headSum += sorted[index]
    let tailSum = 0
    for (let index = 0; index < tailTrim; index += 1) tailSum += sorted[sorted.length - 1 - index]
    const value = (runningSum - headSum - tailSum) / keptLength
    if (best === undefined || value < best) best = value
  }

  evaluate()
  for (let index = count; index < ordered.length; index += 1) {
    remove(effective[index - count])
    insert(effective[index])
    evaluate()
  }

  return best
}

export function inSession(solves: SolveRecord[], sessionId: string) {
  return solves.filter((solve) => solve.sessionId === sessionId)
}

export function averageOf(solves: SolveRecord[], count: number) {
  const window = [...solves].sort((left, right) => right.endedAt - left.endedAt).slice(0, count)
  if (window.length < count) return undefined
  const times = window.map((solve) => effectiveSolveMs(solve))
  const dnfs = times.filter((time) => time === undefined).length
  const finished = times.filter((time): time is number => time !== undefined)
  if (count < 5) return dnfs ? undefined : mean(finished)
  const trim = Math.ceil(count * 0.05)
  if (dnfs > trim) return undefined
  const sorted = [...finished].sort((left, right) => left - right)
  const kept = sorted.slice(trim, sorted.length - (trim - dnfs))
  return kept.length ? mean(kept) : undefined
}

export function personalBestTarget(solves: SolveRecord[], count: number) {
  const best = bestAverageOf(solves, count)
  if (best === undefined) return undefined
  const recent = [...solves].sort((left, right) => right.endedAt - left.endedAt).slice(0, count - 1)
  if (recent.length < count - 1) return undefined
  const startedAt = Math.max(...solves.map((solve) => solve.endedAt)) + 1
  const beats = (candidate: number) => {
    const attempt: SolveRecord = { ...recent[0], id: 'pb-candidate', startedAt, endedAt: startedAt + candidate, penalty: 'none' }
    const value = averageOf([...recent, attempt], count)
    return value !== undefined && value < best
  }
  if (!beats(0)) return undefined
  let low = 0
  let high = Math.ceil(best) * count
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (beats(middle)) low = middle
    else high = middle - 1
  }
  return low
}

const stageOrder = ['Cross', 'F2L 1', 'F2L 2', 'F2L 3', 'F2L 4', 'OLL', 'PLL', 'AUF']

const stageRank = (name: string) => {
  const index = stageOrder.indexOf(name)
  return index === -1 ? stageOrder.length : index
}

export function orderStages<T extends { name: string; endEvent: number }>(stages: T[]) {
  return [...stages].sort((left, right) => left.endEvent - right.endEvent || stageRank(left.name) - stageRank(right.name))
}

const meanMeasurable = (values: Array<number | undefined>) => {
  const measured = values.filter((value): value is number => value !== undefined)
  return measured.length ? mean(measured) : undefined
}

export function stageTrends(stages: StageRecord[]) {
  const groups = new Map<string, StageRecord[]>()
  for (const stage of stages.filter((entry) => entry.confidence >= 0.5)) groups.set(stage.name, [...(groups.get(stage.name) ?? []), stage])
  return [...groups.entries()].sort(([left], [right]) => stageRank(left) - stageRank(right)).map(([name, group]) => ({
    name,
    recognitionMs: meanMeasurable(group.map((stage) => stage.recognitionMs)),
    executionMs: meanMeasurable(group.map((stage) => stage.executionMs)),
    tps: group.some((stage) => stage.tps !== undefined && stage.tps > 0) ? mean(group.filter((stage) => stage.tps !== undefined && stage.tps > 0).map((stage) => stage.tps as number)) : undefined,
    moves: mean(group.map((stage) => stage.moveCount)),
    rotations: mean(group.map((stage) => stage.rotationCount)),
    pauses: meanMeasurable(group.map((stage) => stage.pauseCount))
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
