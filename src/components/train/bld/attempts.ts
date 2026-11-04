import type { BldDrill } from '../../../domain/bld'
import { createId } from '../../../domain/ids'
import type { TrainerAttempt } from '../../../domain/models'
import { STEPS, type Answers, type Part, type StepId } from './memo'

const RECORD: Record<StepId, { caseId: string; protocol: TrainerAttempt['protocol']; generatorId: string; note: string }> = {
  edges: { caseId: 'bld-edge-memo', protocol: 'memo-recall', generatorId: 'cubie-edge-cycle', note: 'Cubie-state-derived edge memo' },
  corners: { caseId: 'bld-corner-memo', protocol: 'memo-recall', generatorId: 'cubie-corner-cycle', note: 'Cubie-state-derived corner memo' },
  parity: { caseId: 'bld-parity', protocol: 'yes-no', generatorId: 'cubie-edge-parity', note: 'Cubie-state-derived edge permutation parity' },
  flips: { caseId: 'bld-flip-count', protocol: 'typed-answer', generatorId: 'cubie-flip-count', note: 'Cubie-state-derived flip count' },
  twists: { caseId: 'bld-twist-count', protocol: 'typed-answer', generatorId: 'cubie-twist-count', note: 'Cubie-state-derived twist count' }
}

export function buildAttempts(drill: BldDrill, answers: Answers, parts: Part[], startedAt: number): TrainerAttempt[] {
  const sessionId = `trainer-${new Date().toISOString().slice(0, 10)}`
  let previous = startedAt
  return STEPS.flatMap((step) => {
    const answer = answers[step.id]
    const part = parts.find((entry) => entry.id === step.id)
    if (!answer || !part) return []
    const record = RECORD[step.id]
    const stepStart = previous
    previous = answer.at
    const memoStep = step.kind === 'memo'
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId,
      caseId: record.caseId,
      caseVersion: 1,
      family: 'bld-memo',
      protocol: record.protocol,
      curriculumMode: 'drill',
      setup: {
        seed: drill.seed,
        generatorId: record.generatorId,
        generatorVersion: '1',
        caseId: record.caseId,
        scramble: drill.scramble,
        constraintHash: memoStep ? `${drill.buffer}:${drill.letterScheme}` : part.correct
      },
      input: answer.input,
      startedAt: stepStart,
      endedAt: answer.at,
      phaseEvents: [{ phase: 'prompt', at: stepStart, source: 'system' }, { phase: 'grading', at: answer.at, source: 'user' }],
      totalMs: answer.at - stepStart,
      outcome: part.right ? 'success' : 'incorrect',
      answer: answer.value,
      expectedAnswer: part.correct,
      answerCorrect: part.right,
      hintEvents: [],
      wrongMoves: 0,
      divergenceCount: 0,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied: part.right,
      dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: [record.note] },
      schemaVersion: 1
    }
    return [attempt]
  })
}
