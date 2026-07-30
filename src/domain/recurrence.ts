import type { FindingRecord, MetricSample } from './models'

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const definitions: Record<string, { target: number; title: string; unit: string }> = {
  pair_transition_pause: { target: 380, title: 'Second-pair lookahead stalls', unit: 'ms' },
  solve_duration: { target: 10_000, title: 'Full-solve transfer remains above sub-10', unit: 'ms' },
  stage_moves: { target: 12, title: 'Stage move count is leaking efficiency', unit: 'moves' },
  stage_tps: { target: 4, title: 'Execution speed is below the current gate', unit: 'tps' }
}

export function analyzeRecurringErrors(samples: MetricSample[], solveId: string): FindingRecord[] {
  const grouped = new Map<string, MetricSample[]>()
  for (const sample of samples) {
    if (!definitions[sample.metric]) continue
    const key = `${sample.metric}:${sample.context.stage ?? 'solve'}`
    grouped.set(key, [...(grouped.get(key) ?? []), sample])
  }

  return [...grouped.entries()].flatMap(([key, group]) => {
    if (group.length < 5) return []
    const metric = group[0].metric
    const definition = definitions[metric]
    const inverse = metric === 'stage_tps'
    const failures = group.filter((sample) => inverse ? sample.value < definition.target : sample.value > definition.target)
    if (!failures.length) return []
    const observed = median(group.map((sample) => sample.value))
    const impact = inverse ? Math.max(0, definition.target - observed) : Math.max(0, observed - definition.target)
    const recurrence = failures.length / group.length
    const confidence = Math.min(1, group.length / 12) * median(group.map((sample) => sample.confidence))
    const stage = group[0].context.stage ?? definitions[metric].title
    const evidence = group.map((sample) => ({
      solveId: sample.sourceId.split(':')[0] || solveId,
      fromEvent: sample.evidence[0]?.fromEvent ?? 0,
      toEvent: sample.evidence[0]?.toEvent ?? 0,
      stage,
      rawEventIds: sample.evidence.flatMap((item) => item.rawEventId ? [item.rawEventId] : [])
    }))
    const finding: FindingRecord = {
      id: `recurrence:${key}`,
      solveIds: [...new Set(evidence.map((item) => item.solveId))],
      metric,
      observed,
      baseline: median(group.map((sample) => sample.value)),
      target: definition.target,
      recurrence,
      confidence,
      impactMs: definition.unit === 'ms' ? impact : impact * 180,
      evidence
    }
    return [finding]
  }).sort((left, right) => (right.impactMs * right.recurrence * right.confidence) - (left.impactMs * left.recurrence * left.confidence))
}

export function roastFinding(finding: FindingRecord) {
  const total = finding.evidence.length
  const occurrences = Math.round(finding.recurrence * total)
  const stage = finding.evidence[0]?.stage ?? finding.metric
  return `${stage}: ${occurrences} of ${total} evidence windows failed the ${finding.target} gate. Median was ${Math.round(finding.observed)}. The cube is not “thinking”; you are pausing. Fix the transition before buying more TPS.`
}
