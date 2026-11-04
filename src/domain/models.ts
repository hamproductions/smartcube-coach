/**
 * What the analyser knew when a solve's stages were written. A solve carrying an older value
 * is re-segmented on load (`src/storage/reanalyseSolves.ts`) so improvements to the analyser
 * reach solves that were recorded before them. Bump it when `segmentCfop` records something
 * new. This is the record's version, not the backup envelope's `analysisVersion`.
 */
export const ANALYSIS_VERSION = '6'

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
  /** Set when the last attempt to re-analyse this solve failed, so a solve that could not be upgraded is not mistaken for one that has not been tried yet. */
  analysisError?: string
  rawEventIds: string[]
  moves: string[]
  /**
   * Milliseconds from the first solve move to each move, parallel to `moves`. Without it
   * playback can only step at a fixed cadence, which is not how the solve was turned; raw
   * events are not persisted, so this is the only record of the real rhythm.
   */
  moveOffsetsMs?: number[]
  source?: 'simulator' | 'cube' | 'replay' | 'keyboard'
  stateVerified?: boolean
  verificationDetail?: string
  inspectionMs?: number
  comment?: string
}

export type StageRecord = {
  id: string
  solveId: string
  method: string
  name: string
  startEvent: number
  firstMoveEvent: number
  endEvent: number
  recognitionMs?: number
  executionMs?: number
  moveCount: number
  rotationCount: number
  pauseCount?: number
  tps?: number
  caseId?: string
  caseName?: string
  /**
   * A short alg that reproduces the position this stage started from, computed from the cube
   * state rather than replayed from history. Turning it on a solved cube puts the same case in
   * front of the solver.
   */
  setupAlg?: string
  slot?: 'FR' | 'FL' | 'BR' | 'BL'
  /** The slot's two side colours, read from the cube state so they mean something on a real cube. */
  slotColours?: Array<{ name: string; hex: string }>
  optimalMoveCount?: number
  /** The shorter solution itself — computed anyway, so show it instead of describing it. */
  optimalMoves?: string[]
  /** The better pair's own side colours, recorded the same way as `slotColours`. */
  betterSlotColours?: Array<{ name: string; hex: string }>
  /** The pair that was cheaper than the one taken, when there was one. */
  betterSlot?: { slot: 'FR' | 'FL' | 'BR' | 'BL'; moves: string[]; saved: number }
  frame?: string
  longestPauseMs?: number
  longestPauseAfter?: string
  longestPauseBefore?: string
  rotationMs?: number
  confidence: number
  notation?: string
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
export type AttemptProtocol = 'state-success' | 'algorithm-rehearsal' | 'multiple-choice' | 'typed-answer' | 'yes-no' | 'inspection-only' | 'inspection-execution' | 'tracking-answer' | 'orientation-answer' | 'memo-recall' | 'memo-decode'
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
  set: 'F2L' | 'OLL' | 'PLL' | 'BLD' | 'COLL' | 'CMLL' | 'WVLS' | 'OLLCP' | 'VHLS' | 'ZBLL' | 'ZBLS' | 'L6E-EO' | 'L6E-EOLR'
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
  context: { puzzle: string; method?: string; stage?: string; caseId?: string; caseName?: string; slot?: string; pauseBefore?: string }
  evidence: Array<{ rawEventId?: string; fromEvent?: number; toEvent?: number }>
}

export type PrescriptionRecord = {
  id: string
  findingId: string
  title?: string
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

export type SessionRecord = {
  id: string
  name: string
  createdAt: number
  puzzle: '333'
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
  sessions?: SessionRecord[]
}
