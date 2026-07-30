export type RawCubeEvent = {
  id: string
  solveId: string
  sequence: number
  phase?: 'scramble' | 'solve' | 'device'
  type: 'move' | 'facelets' | 'gyro' | 'battery' | 'hardware' | 'disconnect'
  cubeTimestamp?: number
  hostTimestamp: number
  payload: unknown
}

export type SolveRecord = {
  id: string
  sessionId: string
  puzzle: '3x3x3'
  scramble: string
  scrambleGenerator: string
  startedAt: number
  endedAt: number
  penalty: 'none' | '+2' | 'dnf'
  deviceId?: string
  analysisVersion: string
  rawEventIds: string[]
  moves: string[]
}

export type StageRecord = {
  id: string
  solveId: string
  method: string
  name: string
  startEvent: number
  firstMoveEvent: number
  endEvent: number
  recognitionMs: number
  executionMs: number
  moveCount: number
  rotationCount: number
  pauseCount: number
  tps: number
  caseId?: string
  confidence: number
}

export type FindingRecord = {
  id: string
  solveIds: string[]
  metric: string
  observed: number
  baseline: number
  target: number
  confidence: number
  impactMs: number
  recurrence: number
  evidence: Array<{ solveId: string; fromEvent: number; toEvent: number; stage?: string; rawEventIds?: string[] }>
  prescriptionId?: string
}

export type CurriculumMode = 'drill' | 'learn' | 'review'
export type TrainerFamily = 'algorithm' | 'recognition' | 'inspection' | 'prediction' | 'tracking' | 'color-inference' | 'free-pair' | 'time-attack' | 'metronome' | 'bld-memo' | 'bld-cycle' | 'bld-letter-pair'
export type AttemptProtocol = 'state-success' | 'algorithm-rehearsal' | 'multiple-choice' | 'typed-answer' | 'yes-no' | 'inspection-only' | 'inspection-execution' | 'tracking-answer' | 'memo-recall' | 'memo-decode'
export type AttemptOutcome = 'success' | 'incorrect' | 'give-up' | 'skip' | 'aborted' | 'disconnect' | 'invalid-setup'

export type TrainerAttempt = {
  id: string
  sessionId: string
  assignmentId?: string
  caseId: string
  caseVersion: number
  algorithmVariantId?: string
  family: TrainerFamily
  protocol: AttemptProtocol
  curriculumMode: CurriculumMode
  setup: {
    seed: string
    generatorId: string
    generatorVersion: string
    caseId: string
    scramble: string
    constraintHash: string
  }
  input: 'smart-cube' | 'keyboard' | 'pointer' | 'manual-timer'
  startedAt: number
  endedAt: number
  phaseEvents: Array<{ phase: string; at: number; source: 'system' | 'user' | 'cube' | 'timeout' | 'disconnect'; rawEventId?: string }>
  recognitionMs?: number
  inspectionMs?: number
  executionMs?: number
  correctionMs?: number
  totalMs: number
  outcome: AttemptOutcome
  answer?: string
  expectedAnswer?: string
  answerCorrect?: boolean
  hintEvents: Array<{ at: number; level: string; revealedMoves?: number }>
  wrongMoves: number
  divergenceCount: number
  correctionMoveCount: number
  recognitionBoundaryConfidence?: number
  rawEventIds: string[]
  finalPattern?: string
  targetSatisfied?: boolean
  dataQuality: {
    completeMoveStream: boolean
    setupVerifiedByState: boolean
    clockFitConfidence?: number
    packetLossSuspected: boolean
    timingUsable: boolean
    notes: string[]
  }
  schemaVersion: 1
}

export type AlgorithmRecord = {
  id: string
  set: 'F2L' | 'OLL' | 'PLL' | 'BLD'
  name: string
  algorithm: string
  setup: string
  targetMs: number
  mastery: number
  dueAt: number
  orientations: string[]
}

export type StudyRecord = {
  id: string
  sourceUrl: string
  solver: string
  result: string
  scramble: string
  moves: string[]
  notes: string
  bookmarks: number[]
  importedAt: number
}

export type ReconstructionRevision = {
  id: string
  solveId: string
  parentRevisionId?: string
  analysisVersion: string
  method: string
  lines: Array<{ id: string; sourceEventIds: string[]; insertedMoves?: string[]; label?: string; splitAnnotation?: string }>
  createdAt: number
  origin: 'automatic' | 'user-edit' | 'recomputed'
}

export type MetricSample = {
  id: string
  metric: string
  metricVersion: string
  sourceType: 'solve' | 'stage' | 'trainer-attempt'
  sourceId: string
  value: number
  unit: 'ms' | 'moves' | 'count' | 'ratio' | 'tps'
  occurredAt: number
  confidence: number
  context: { puzzle: string; method?: string; stage?: string; caseId?: string }
  evidence: Array<{ rawEventId?: string; fromEvent?: number; toEvent?: number }>
}

export type PrescriptionRecord = {
  id: string
  findingId: string
  metric: string
  target: number
  sampleSize: number
  status: 'assigned' | 'training' | 'transfer' | 'passed' | 'not-demonstrated'
  blocks: Array<{ id: string; kind: 'planning' | 'recognition' | 'execution' | 'transfer'; title: string; dose: string; passCondition: string; completedAt?: number; evidenceIds: string[] }>
  transfer: {
    direction: 'lower' | 'higher'
    baselineSampleSize: number
    postSampleSize: number
    minimumConfidence: number
    minimumDataQuality: number
  }
  createdAt: number
}

export type TransferEvaluation = {
  id: string
  prescriptionId: string
  evaluatedAt: number
  evaluatorVersion: string
  status: 'collecting' | 'passed' | 'not-demonstrated' | 'insufficient-quality' | 'superseded'
  baselineSourceIds: string[]
  postSourceIds: string[]
  baselineMedian: number
  postMedian?: number
  effect?: number
  confidence?: number
}

export type KeyValueRecord = { key: string; value: unknown }

export type SmartCubeCoachBackup = {
  format: 'smartcube-coach-backup'
  exportVersion: 1
  schemaVersion: 4
  analysisVersion: '1'
  exportedAt: number
  rawEvents: RawCubeEvent[]
  solves: SolveRecord[]
  stages: StageRecord[]
  findings: FindingRecord[]
  attempts: TrainerAttempt[]
  algorithms: AlgorithmRecord[]
  studies: StudyRecord[]
  revisions: ReconstructionRevision[]
  metrics: MetricSample[]
  prescriptions: PrescriptionRecord[]
  transfers: TransferEvaluation[]
  settings: KeyValueRecord[]
  meta: KeyValueRecord[]
}
