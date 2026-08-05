export type StageTelemetry = {
  name: string
  timeMs: number
  recognitionMs: number
  executionMs: number
  moves: number
  rotations: number
  pauses: number[]
}

export type SolveTelemetry = {
  id: string
  totalMs: number
  stages: StageTelemetry[]
  history: {
    sampleSize: number
    pairTransitionMedianMs: number
    f2l2PauseRecurrence: number
    crossMedianMs: number
  }
}

export type FindingMetric = 'pair_transition_pause' | 'cross_time' | 'rotation_count'

export type Finding = {
  id: string
  metric: FindingMetric
  title: string
  observed: number
  baseline: number
  target: number
  impactMs: number
  recurrence: number
  confidence: number
  priority: number
  evidence: {
    solveId: string
    stage: string
    fromMs: number
    toMs: number
  }
}

export type SolveAnalysis = {
  totalMoves: number
  rotationCount: number
  primary: Finding
  findings: Finding[]
}

const priority = (impactMs: number, recurrence: number, confidence: number, trainability: number) =>
  Number(((impactMs / 1000) * recurrence * confidence * trainability).toFixed(3))

export function analyzeSolve(solve: SolveTelemetry): SolveAnalysis {
  if (!solve.stages.length) throw new Error('Solve analysis requires at least one segmented stage')
  const pairStage = solve.stages
    .filter((stage) => stage.name.startsWith('F2L'))
    .sort((a, b) => b.recognitionMs - a.recognitionMs)[0]
  const pairStart = pairStage
    ? solve.stages
      .slice(0, solve.stages.findIndex((stage) => stage.name === pairStage.name))
      .reduce((total, stage) => total + stage.timeMs, 0)
    : 0
  const pairImpact = pairStage ? Math.max(0, pairStage.recognitionMs - solve.history.pairTransitionMedianMs) : 0
  const cross = solve.stages.find((stage) => stage.name === 'Cross') ?? solve.stages[0]
  const crossImpact = Math.max(0, cross.timeMs - 1800)
  const rotationCount = solve.stages.reduce((total, stage) => total + stage.rotations, 0)

  const findings: Finding[] = []

  if (pairStage) {
    findings.push({
      id: 'finding-pair-2',
      metric: 'pair_transition_pause',
      title: 'Second-pair lookahead stalls',
      observed: pairStage.recognitionMs,
      baseline: solve.history.pairTransitionMedianMs,
      target: 380,
      impactMs: pairImpact,
      recurrence: solve.history.f2l2PauseRecurrence,
      confidence: 0.94,
      priority: priority(pairImpact, solve.history.f2l2PauseRecurrence, 0.94, 0.95),
      evidence: {
        solveId: solve.id,
        stage: pairStage.name,
        fromMs: pairStart,
        toMs: pairStart + pairStage.recognitionMs
      }
    })
  }

  findings.push(
    {
      id: 'finding-cross-time',
      metric: 'cross_time',
      title: 'Cross exceeds the next gate',
      observed: cross.timeMs,
      baseline: solve.history.crossMedianMs,
      target: 1800,
      impactMs: crossImpact,
      recurrence: 0.33,
      confidence: 0.88,
      priority: priority(crossImpact, 0.33, 0.88, 0.8),
      evidence: {
        solveId: solve.id,
        stage: cross.name,
        fromMs: 0,
        toMs: cross.timeMs
      }
    },
    {
      id: 'finding-rotations',
      metric: 'rotation_count',
      title: 'F2L rotations break visual continuity',
      observed: rotationCount,
      baseline: 2,
      target: 1,
      impactMs: Math.max(0, rotationCount - 1) * 180,
      recurrence: 0.5,
      confidence: 0.9,
      priority: priority(Math.max(0, rotationCount - 1) * 180, 0.5, 0.9, 0.7),
      evidence: {
        solveId: solve.id,
        stage: 'F2L',
        fromMs: cross.timeMs,
        toMs: solve.totalMs
      }
    }
  )

  findings.sort((a, b) => b.priority - a.priority)
  const primary = findings[0]
  if (!primary) throw new Error('Solve analysis produced no finding')

  return {
    totalMoves: solve.stages.reduce((total, stage) => total + stage.moves, 0),
    rotationCount,
    primary,
    findings
  }
}
