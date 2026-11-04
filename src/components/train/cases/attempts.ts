import type { AlgorithmRecord, CurriculumMode, TrainerAttempt } from '../../../domain/models'
import { createId } from '../../../domain/ids'

export type AttemptInput = 'smart-cube' | 'keyboard'

export type FinishedAttempt = {
  input: AttemptInput
  startedAt: number
  recognizedAt?: number
  endedAt: number
  success: boolean
  moves: string[]
  hintLevel: number
}

const sessionId = () => `trainer-${new Date().toISOString().slice(0, 10)}`

const seed = () => createId().replaceAll('-', '')

export function caseAttempt(record: AlgorithmRecord, mode: CurriculumMode, result: FinishedAttempt): TrainerAttempt {
  const cube = result.input === 'smart-cube'
  const totalMs = result.endedAt - result.startedAt
  const recognitionMs = result.recognizedAt === undefined ? undefined : result.recognizedAt - result.startedAt
  return {
    id: createId(),
    sessionId: sessionId(),
    caseId: record.id,
    caseVersion: 1,
    algorithmVariantId: record.id,
    family: 'algorithm',
    protocol: cube ? 'state-success' : 'algorithm-rehearsal',
    curriculumMode: mode,
    setup: { seed: seed(), generatorId: 'algorithm-inverse', generatorVersion: '1', caseId: record.id, scramble: record.setup, constraintHash: record.id },
    input: result.input,
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    phaseEvents: [
      { phase: 'prompt', at: result.startedAt, source: 'system' },
      ...(result.recognizedAt === undefined ? [] : [{ phase: 'recognized', at: result.recognizedAt, source: cube ? 'cube' as const : 'user' as const }]),
      { phase: 'done', at: result.endedAt, source: cube && result.success ? 'cube' : 'user' }
    ],
    recognitionMs,
    executionMs: result.recognizedAt === undefined ? totalMs : result.endedAt - result.recognizedAt,
    totalMs,
    outcome: result.success ? 'success' : 'incorrect',
    answer: result.moves.join(' ') || undefined,
    expectedAnswer: record.algorithm,
    answerCorrect: result.success,
    hintEvents: Array.from({ length: result.hintLevel }, (_, index) => ({ at: result.endedAt, level: `level-${index + 1}` })),
    wrongMoves: result.success ? 0 : 1,
    divergenceCount: result.success ? 0 : 1,
    correctionMoveCount: 0,
    recognitionBoundaryConfidence: result.recognizedAt === undefined ? 0.5 : 1,
    rawEventIds: [],
    targetSatisfied: result.success && totalMs <= record.targetMs,
    dataQuality: {
      completeMoveStream: cube,
      setupVerifiedByState: cube,
      packetLossSuspected: false,
      timingUsable: true,
      notes: [cube ? 'Completion detected from the case state after the turned moves' : 'Recognition and execution marked with the keyboard']
    },
    schemaVersion: 1
  }
}

export function recognitionAttempt(record: AlgorithmRecord, answer: string, startedAt: number, endedAt: number): TrainerAttempt {
  const success = answer === record.name
  return {
    id: createId(),
    sessionId: sessionId(),
    caseId: record.id,
    caseVersion: 1,
    algorithmVariantId: record.id,
    family: 'recognition',
    protocol: 'multiple-choice',
    curriculumMode: 'drill',
    setup: { seed: seed(), generatorId: 'two-sided-recognition', generatorVersion: '1', caseId: record.id, scramble: record.setup, constraintHash: record.id },
    input: 'keyboard',
    startedAt,
    endedAt,
    phaseEvents: [{ phase: 'prompt', at: startedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
    recognitionMs: endedAt - startedAt,
    totalMs: endedAt - startedAt,
    outcome: success ? 'success' : 'incorrect',
    answer,
    expectedAnswer: record.name,
    answerCorrect: success,
    hintEvents: [],
    wrongMoves: success ? 0 : 1,
    divergenceCount: success ? 0 : 1,
    correctionMoveCount: 0,
    recognitionBoundaryConfidence: 1,
    rawEventIds: [],
    targetSatisfied: success,
    dataQuality: {
      completeMoveStream: false,
      setupVerifiedByState: true,
      packetLossSuspected: false,
      timingUsable: true,
      notes: ['Two-sided view derived from the real post-setup cube state; only the front and right last-layer stickers were shown']
    },
    schemaVersion: 1
  }
}

export function timeAttackAttempt(record: AlgorithmRecord, runId: string, targetMs: number, result: Pick<FinishedAttempt, 'input' | 'startedAt' | 'endedAt' | 'success' | 'moves'>): TrainerAttempt {
  const cube = result.input === 'smart-cube'
  const totalMs = result.endedAt - result.startedAt
  return {
    id: createId(),
    sessionId: sessionId(),
    caseId: record.id,
    caseVersion: 1,
    algorithmVariantId: record.id,
    family: 'time-attack',
    protocol: cube ? 'state-success' : 'algorithm-rehearsal',
    curriculumMode: 'drill',
    setup: { seed: runId, generatorId: 'time-attack-run', generatorVersion: '1', caseId: record.id, scramble: record.setup, constraintHash: `${runId}:${targetMs}` },
    input: cube ? 'smart-cube' : 'manual-timer',
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    phaseEvents: [{ phase: 'prompt', at: result.startedAt, source: 'system' }, { phase: 'done', at: result.endedAt, source: cube && result.success ? 'cube' : 'user' }],
    executionMs: totalMs,
    totalMs,
    outcome: result.success ? 'success' : 'give-up',
    answer: result.moves.join(' ') || undefined,
    expectedAnswer: record.name,
    hintEvents: [],
    wrongMoves: 0,
    divergenceCount: 0,
    correctionMoveCount: 0,
    rawEventIds: [],
    targetSatisfied: result.success && totalMs <= targetMs,
    dataQuality: {
      completeMoveStream: cube,
      setupVerifiedByState: cube,
      packetLossSuspected: false,
      timingUsable: true,
      notes: [`Time attack target ${targetMs}ms`]
    },
    schemaVersion: 1
  }
}
