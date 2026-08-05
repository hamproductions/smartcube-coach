import type { Finding } from './analyzeSolve'

export type PrescriptionBlock = {
  kind: 'tracking' | 'prediction' | 'execution' | 'transfer'
  label: string
  dose: string
  target: string
}

export type Prescription = {
  title: string
  duration: string
  blocks: PrescriptionBlock[]
  passCondition: {
    metric: Finding['metric']
    target: number
    fullSolveSample: number
  }
}

export type PrescriptionScope = {
  slot?: string
  caseName?: string
  stage?: string
}

const transfer = (target: string): PrescriptionBlock => ({ kind: 'transfer', label: 'Full-solve transfer', dose: '12 timed solves', target })

const plans: Record<string, (finding: Finding, scope: PrescriptionScope) => Omit<Prescription, 'passCondition'>> = {
  pair_transition_pause: (finding) => ({
    title: 'F2L Lookahead Reset',
    duration: '22 min',
    blocks: [
      { kind: 'tracking', label: 'Track the next pair', dose: '3 × 8 cases', target: '≥ 85% without stopping' },
      { kind: 'prediction', label: 'Predict pair outcome', dose: '12 prompts', target: '≥ 10 correct' },
      { kind: 'execution', label: 'Slow-turn F2L flow', dose: '8 solves at 3 TPS', target: 'No pause over 500 ms' },
      transfer(`Pair pause ≤ ${finding.target} ms median`)
    ]
  }),
  slot_transition_pause: (finding, scope) => {
    const slot = scope.slot ?? 'the slow'
    return {
      title: `${slot} slot rescue`,
      duration: '20 min',
      blocks: [
        { kind: 'tracking', label: `Track the ${slot} pair`, dose: '3 × 8 prompts', target: '≥ 85% correct' },
        { kind: 'prediction', label: `Free-pair choices preserving ${slot}`, dose: '10 prompts', target: '≥ 8 correct' },
        { kind: 'execution', label: `${slot} inserts at controlled TPS`, dose: '15 repetitions', target: 'No regrip pause' },
        transfer(`${slot} pause ≤ ${finding.target} ms median`)
      ]
    }
  },
  case_recognition: (finding, scope) => {
    const label = scope.caseName ?? 'the slow case'
    return {
      title: `${label} recognition`,
      duration: '15 min',
      blocks: [
        { kind: 'tracking', label: `Drill ${label} from every angle`, dose: '4 AUFs × 5 reps', target: 'Named before the first turn' },
        { kind: 'prediction', label: `Recognise ${label} against neighbours`, dose: '12 prompts', target: '≥ 10 correct' },
        { kind: 'execution', label: `${label} execution`, dose: '10 timed repetitions', target: `Recognition ≤ ${finding.target} ms` },
        transfer(`${label} recognition ≤ ${finding.target} ms median`)
      ]
    }
  },
  stage_tps: (finding, scope) => ({
    title: `${scope.stage ?? 'Execution'} turn speed`,
    duration: '18 min',
    blocks: [
      { kind: 'tracking', label: 'Metronome warm-up', dose: '3 × 60 s', target: 'Even spacing' },
      { kind: 'prediction', label: 'Plan the whole trigger before turning', dose: '10 cases', target: 'No mid-alg stop' },
      { kind: 'execution', label: 'Trigger repetitions above the gate', dose: '20 repetitions', target: `≥ ${finding.target} TPS` },
      transfer(`${scope.stage ?? 'Stage'} TPS ≥ ${finding.target} median`)
    ]
  }),
  stage_moves: (finding, scope) => ({
    title: `${scope.stage ?? 'Stage'} efficiency`,
    duration: '20 min',
    blocks: [
      { kind: 'tracking', label: 'Inspect before executing', dose: '10 scrambles', target: 'Plan stated first' },
      { kind: 'prediction', label: 'Choose the shorter route', dose: '10 pairs of options', target: '≥ 8 correct' },
      { kind: 'execution', label: 'Execute the planned route only', dose: '10 repetitions', target: 'No corrections' },
      transfer(`${scope.stage ?? 'Stage'} move count ≤ ${finding.target} median`)
    ]
  }),
  cross_waste: (finding) => ({
    title: 'Cross planning',
    duration: '20 min',
    blocks: [
      { kind: 'tracking', label: 'Plan the full cross in inspection', dose: '10 scrambles', target: 'Plan stated before the first turn' },
      { kind: 'prediction', label: 'Choose the shorter of two crosses', dose: '10 pairs', target: '≥ 8 correct' },
      { kind: 'execution', label: 'Execute the planned cross only', dose: '10 repetitions', target: 'No extra turn' },
      transfer(`Cross within ${finding.target} move of optimal`)
    ]
  }),
  stage_longest_pause: (finding, scope) => ({
    title: `${scope.stage ?? 'Stage'} stall`,
    duration: '18 min',
    blocks: [
      { kind: 'tracking', label: 'Name the next piece before the stall point', dose: '10 prompts', target: 'Named before turning' },
      { kind: 'prediction', label: 'Predict the state after the current trigger', dose: '12 prompts', target: '≥ 10 correct' },
      { kind: 'execution', label: 'Slow continuous solves through that boundary', dose: '8 solves', target: 'No stall over 700 ms' },
      transfer(`Longest ${scope.stage ?? 'stage'} pause ≤ ${finding.target} ms median`)
    ]
  }),
  rotation_cost: (finding, scope) => ({
    title: `${scope.stage ?? 'Rotation'} economy`,
    duration: '16 min',
    blocks: [
      { kind: 'tracking', label: 'Solve the slot from the angle you already hold', dose: '10 cases', target: 'No rotation' },
      { kind: 'prediction', label: 'Choose the rotationless insert', dose: '10 pairs', target: '≥ 8 correct' },
      { kind: 'execution', label: 'Back-slot inserts without rotating', dose: '15 repetitions', target: 'Rotation only when unavoidable' },
      transfer(`Rotation time ≤ ${finding.target} ms per solve median`)
    ]
  }),
  pair_waste: (finding, scope) => ({
    title: `${scope.slot ?? 'F2L'} solution choice`,
    duration: '20 min',
    blocks: [
      { kind: 'tracking', label: 'Name both pieces before choosing an insert', dose: '10 cases', target: 'Named before turning' },
      { kind: 'prediction', label: 'Pick the shorter of two valid inserts', dose: '10 pairs', target: '≥ 8 correct' },
      { kind: 'execution', label: 'Execute only the chosen insert', dose: '15 repetitions', target: 'No corrective turns' },
      transfer(`Pair within ${finding.target} moves of optimal`)
    ]
  }),
  alg_waste: (finding, scope) => ({
    title: `${scope.caseName ?? 'Last layer'} execution`,
    duration: '16 min',
    blocks: [
      { kind: 'tracking', label: 'Find the AUF before the last F2L move ends', dose: '10 cases', target: 'AUF chosen in advance' },
      { kind: 'prediction', label: 'Name the algorithm before turning', dose: '12 prompts', target: '≥ 10 correct' },
      { kind: 'execution', label: `Execute ${scope.caseName ?? 'the case'} exactly as trained`, dose: '15 repetitions', target: 'No extra turns' },
      transfer(`Within ${finding.target} moves of your own algorithm`)
    ]
  }),
  solve_duration: (finding) => ({
    title: 'Full-solve consolidation',
    duration: '25 min',
    blocks: [
      { kind: 'tracking', label: 'Cross plus first pair planning', dose: '10 inspections', target: 'Cross planned in 15 s' },
      { kind: 'prediction', label: 'Name the next pair before finishing', dose: '12 prompts', target: '≥ 10 correct' },
      { kind: 'execution', label: 'Untimed control solves', dose: '8 solves', target: 'No pause over 1 s' },
      transfer(`Solve time ≤ ${Math.round(finding.target / 1000)} s median`)
    ]
  })
}

export function buildPrescription(finding: Finding, scope: PrescriptionScope = {}): Prescription {
  const plan = plans[finding.metric]?.(finding, scope) ?? {
    title: 'Efficiency Reset',
    duration: '18 min',
    blocks: [
      { kind: 'tracking' as const, label: 'Slow recognition', dose: '10 prompts', target: '≥ 80%' },
      { kind: 'prediction' as const, label: 'Plan before turning', dose: '10 cases', target: 'No restart' },
      { kind: 'execution' as const, label: 'Controlled execution', dose: '8 repetitions', target: 'Clean turns' },
      transfer('Beat baseline')
    ]
  }

  return { ...plan, passCondition: { metric: finding.metric, target: finding.target, fullSolveSample: 12 } }
}
