import { gradeFreePair, type FreePairPrompt } from '../../../domain/freePair'
import { createId } from '../../../domain/ids'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'

const sessionId = () => `trainer-${new Date().toISOString().slice(0, 10)}`

export type DrillResult = {
  record: AlgorithmRecord
  outcome: 'success' | 'give-up'
  recognitionMs?: number
  executionMs?: number
  totalMs: number
  wrongMoves: number
  hints: number
  startedAt: number
  endedAt: number
}

export function drillAttempt(result: DrillResult): TrainerAttempt {
  const { record } = result
  const success = result.outcome === 'success'
  return {
    id: createId(),
    sessionId: sessionId(),
    caseId: record.id,
    caseVersion: 1,
    algorithmVariantId: record.id,
    family: 'algorithm',
    protocol: 'state-success',
    curriculumMode: 'drill',
    setup: {
      seed: createId().replaceAll('-', ''),
      generatorId: 'f2l-drill-engine',
      generatorVersion: '2',
      caseId: record.id,
      scramble: record.setup,
      constraintHash: record.id
    },
    input: 'smart-cube',
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    phaseEvents: [{ phase: 'solving', at: result.startedAt, source: 'cube' }, { phase: success ? 'done' : 'give-up', at: result.endedAt, source: success ? 'cube' : 'user' }],
    recognitionMs: result.recognitionMs,
    executionMs: result.executionMs,
    totalMs: result.totalMs,
    outcome: result.outcome,
    hintEvents: result.hints ? [{ at: result.endedAt, level: 'step', revealedMoves: result.hints }] : [],
    wrongMoves: result.wrongMoves,
    divergenceCount: result.wrongMoves,
    correctionMoveCount: 0,
    rawEventIds: [],
    targetSatisfied: success && result.totalMs <= record.targetMs,
    dataQuality: {
      completeMoveStream: true,
      setupVerifiedByState: true,
      packetLossSuspected: false,
      timingUsable: success,
      notes: ['F2L drill engine state predicate (isF2LSolved on the tracked cube), ported from F2LTrainer']
    },
    schemaVersion: 1
  }
}

export function freePairCaseId(prompt: FreePairPrompt) {
  return `free-pair-${prompt.caseName.toLowerCase()}-${prompt.slot.toLowerCase()}`
}

export function freePairAttempt(prompt: FreePairPrompt, answer: number, startedAt: number, endedAt: number, input: TrainerAttempt['input']): TrainerAttempt {
  const success = gradeFreePair(prompt, answer)
  const caseId = freePairCaseId(prompt)
  const working = prompt.options.filter((_, index) => gradeFreePair(prompt, index))
  return {
    id: createId(),
    sessionId: sessionId(),
    caseId,
    caseVersion: 1,
    family: 'free-pair',
    protocol: 'multiple-choice',
    curriculumMode: 'drill',
    setup: { seed: prompt.seed, generatorId: 'solved-no-free-pair', generatorVersion: '2', caseId, scramble: prompt.setup, constraintHash: prompt.options.join(':') },
    input,
    startedAt,
    endedAt,
    phaseEvents: [{ phase: 'prompt', at: startedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
    totalMs: endedAt - startedAt,
    outcome: success ? 'success' : 'incorrect',
    answer: prompt.options[answer],
    expectedAnswer: working.join(' | '),
    answerCorrect: success,
    hintEvents: [],
    wrongMoves: 0,
    divergenceCount: 0,
    correctionMoveCount: 0,
    rawEventIds: [],
    targetSatisfied: success,
    dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: [`solved.no free-pair rule, ${prompt.mode} mode`] },
    schemaVersion: 1
  }
}
