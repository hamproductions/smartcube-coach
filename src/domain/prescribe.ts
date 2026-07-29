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

export function buildPrescription(finding: Finding): Prescription {
  if (finding.metric === 'pair_transition_pause') {
    return {
      title: 'F2L Lookahead Reset',
      duration: '22 min',
      blocks: [
        {
          kind: 'tracking',
          label: 'Track the next pair',
          dose: '3 × 8 cases',
          target: '≥ 85% without stopping'
        },
        {
          kind: 'prediction',
          label: 'Predict pair outcome',
          dose: '12 prompts',
          target: '≥ 10 correct'
        },
        {
          kind: 'execution',
          label: 'Slow-turn F2L flow',
          dose: '8 solves at 3 TPS',
          target: 'No pause over 500 ms'
        },
        {
          kind: 'transfer',
          label: 'Full-solve transfer',
          dose: '12 timed solves',
          target: `Pair pause ≤ ${finding.target} ms median`
        }
      ],
      passCondition: {
        metric: finding.metric,
        target: finding.target,
        fullSolveSample: 12
      }
    }
  }

  return {
    title: 'Efficiency Reset',
    duration: '18 min',
    blocks: [
      { kind: 'tracking', label: 'Slow recognition', dose: '10 prompts', target: '≥ 80%' },
      { kind: 'prediction', label: 'Plan before turning', dose: '10 cases', target: 'No restart' },
      { kind: 'execution', label: 'Controlled execution', dose: '8 repetitions', target: 'Clean turns' },
      { kind: 'transfer', label: 'Full-solve transfer', dose: '12 solves', target: 'Beat baseline' }
    ],
    passCondition: {
      metric: finding.metric,
      target: finding.target,
      fullSolveSample: 12
    }
  }
}
