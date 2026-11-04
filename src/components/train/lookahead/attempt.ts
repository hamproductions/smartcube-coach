import { createId } from '../../../domain/ids'
import type { AttemptProtocol, TrainerAttempt, TrainerFamily } from '../../../domain/models'

export type AnswerInput = 'pointer' | 'keyboard'

export type AttemptTiming = { input: AnswerInput; startedAt: number; answerOpenedAt: number; endedAt: number }

type AttemptSpec = {
  caseId: string
  family: TrainerFamily
  protocol: AttemptProtocol
  generatorId: string
  seed: string
  scramble: string
  constraintHash: string
  answer: string
  expectedAnswer: string
  success: boolean
  completeMoveStream: boolean
  note: string
}

export function buildAttempt(spec: AttemptSpec, timing: AttemptTiming): TrainerAttempt {
  const { startedAt, answerOpenedAt, endedAt, input } = timing
  return {
    id: createId(),
    sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
    caseId: spec.caseId,
    caseVersion: 1,
    family: spec.family,
    protocol: spec.protocol,
    curriculumMode: 'drill',
    setup: {
      seed: spec.seed,
      generatorId: spec.generatorId,
      generatorVersion: '1',
      caseId: spec.caseId,
      scramble: spec.scramble,
      constraintHash: spec.constraintHash
    },
    input,
    startedAt,
    endedAt,
    phaseEvents: [
      { phase: 'prompt', at: startedAt, source: 'system' },
      { phase: 'answer', at: answerOpenedAt, source: 'system' },
      { phase: 'grading', at: endedAt, source: 'user' }
    ],
    recognitionMs: endedAt - answerOpenedAt,
    totalMs: endedAt - startedAt,
    outcome: spec.success ? 'success' : 'incorrect',
    answer: spec.answer,
    expectedAnswer: spec.expectedAnswer,
    answerCorrect: spec.success,
    hintEvents: [],
    wrongMoves: 0,
    divergenceCount: 0,
    correctionMoveCount: 0,
    rawEventIds: [],
    targetSatisfied: spec.success,
    dataQuality: {
      completeMoveStream: spec.completeMoveStream,
      setupVerifiedByState: true,
      packetLossSuspected: false,
      timingUsable: true,
      notes: [spec.note]
    },
    schemaVersion: 1
  }
}
