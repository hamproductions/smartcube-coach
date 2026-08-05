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
  stage_tps: { target: 4, title: 'Execution speed is below the current gate', unit: 'tps' },
  case_recognition: { target: 900, title: 'Case recognition is slower than the gate', unit: 'ms' },
  slot_transition_pause: { target: 500, title: 'One F2L slot stalls more than the others', unit: 'ms' },
  cross_waste: { target: 1, title: 'Cross costs more moves than it needs', unit: 'moves' },
  stage_longest_pause: { target: 700, title: 'One pause dominates a stage', unit: 'ms' },
  pair_waste: { target: 2, title: 'F2L pairs cost more moves than the state required', unit: 'moves' },
  alg_waste: { target: 2, title: 'Last-layer execution costs more moves than your own algorithm', unit: 'moves' },
  rotation_cost: { target: 400, title: 'Rotations are costing real time', unit: 'ms' }
}

export function analyzeRecurringErrors(samples: MetricSample[], solveId: string): FindingRecord[] {
  const grouped = new Map<string, MetricSample[]>()
  for (const sample of samples) {
    if (!definitions[sample.metric]) continue
    const scope = sample.metric === 'case_recognition'
      ? sample.context.caseId
      : sample.metric === 'slot_transition_pause'
        ? sample.context.slot
        : undefined
    const key = `${sample.metric}:${scope ?? sample.context.stage ?? 'solve'}`
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
    if (inverse ? observed >= definition.target : observed <= definition.target) return []
    const impact = inverse ? Math.max(0, definition.target - observed) : Math.max(0, observed - definition.target)
    const recurrence = failures.length / group.length
    const confidence = Math.min(1, group.length / 12) * median(group.map((sample) => sample.confidence))
    const pauseBefore = metric === 'stage_longest_pause' ? group.find((sample) => sample.context.pauseBefore)?.context.pauseBefore : undefined
    const scopeLabel = metric === 'stage_longest_pause' && pauseBefore
      ? `${group[0].context.stage ?? 'Stage'} before ${pauseBefore}`
      : metric === 'case_recognition'
      ? group[0].context.caseName ?? group[0].context.caseId
      : metric === 'slot_transition_pause'
        ? group[0].context.slot && `${group[0].context.slot} slot`
        : undefined
    const stage = scopeLabel ?? group[0].context.stage ?? definitions[metric].title
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

const units: Record<string, string> = { pair_transition_pause: 'ms', slot_transition_pause: 'ms', case_recognition: 'ms', solve_duration: 'ms', stage_moves: 'moves', stage_tps: 'TPS', cross_waste: 'moves', stage_longest_pause: 'ms', rotation_cost: 'ms', pair_waste: 'moves', alg_waste: 'moves' }

const verdicts: Record<string, string> = {
  pair_transition_pause: 'That is hesitation between pairs, not slow hands. Train the transition, not the turn speed.',
  slot_transition_pause: 'One slot is costing more than the others. Drill that slot until it stops being the exception.',
  case_recognition: 'You are identifying this case too late. The execution is not the problem.',
  stage_tps: 'The turns themselves are slow here. This one really is execution.',
  stage_moves: 'You are spending moves, not time. A shorter route beats a faster one.',
  cross_waste: 'The cross is longer than the state required. Plan the whole cross in inspection instead of solving it edge by edge.',
  stage_longest_pause: 'A single stall dominates this stage. Fix that one boundary before touching anything else.',
  pair_waste: 'The pair took more moves than the state needed. That is solution choice, not turn speed.',
  alg_waste: 'You spent more moves than your own algorithm for this case. That is extra AUFs, a regrip, or a different algorithm than the one you trained.',
  rotation_cost: 'You are paying for rotations. Learn the insert from the angle you already hold.',
  solve_duration: 'The whole solve is above the gate. Fix the largest stage first, not everything at once.'
}

export function roastFinding(finding: FindingRecord) {
  const total = finding.evidence.length
  const occurrences = Math.round(finding.recurrence * total)
  const stage = finding.evidence[0]?.stage ?? finding.metric
  const unit = units[finding.metric] ?? ''
  const direction = finding.metric === 'stage_tps' ? 'below' : 'above'
  const verdict = verdicts[finding.metric] ?? 'Fix the largest contributor first.'
  return `${stage}: ${occurrences} of ${total} evidence windows landed ${direction} the ${finding.target} ${unit} gate. Median was ${Math.round(finding.observed)} ${unit}. ${verdict}`.replace(/\s+/g, ' ')
}
