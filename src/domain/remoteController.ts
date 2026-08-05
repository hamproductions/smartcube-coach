export type RemoteControllerSnapshot = {
  targetIndex: number
  complete: boolean
  turns: string[]
  startedAt?: number
  endedAt?: number
}

export class RemoteControllerSession {
  private turns: string[] = []
  private startedAt?: number
  private endedAt?: number

  constructor(private readonly targetMoves: string[]) {}

  handleMove(move: string, timestamp: number): RemoteControllerSnapshot {
    this.startedAt ??= timestamp
    this.turns.push(move)
    if (this.turns.length >= this.targetMoves.length) this.endedAt ??= timestamp
    return this.snapshot
  }

  get snapshot(): RemoteControllerSnapshot {
    return {
      targetIndex: Math.min(this.turns.length, this.targetMoves.length),
      complete: this.turns.length >= this.targetMoves.length,
      turns: [...this.turns],
      startedAt: this.startedAt,
      endedAt: this.endedAt
    }
  }
}

export function createRemoteControllerAttempt(
  target: AlgorithmRecord,
  snapshot: RemoteControllerSnapshot,
  createdAt = Date.now()
): TrainerAttempt {
  if (!snapshot.complete || snapshot.startedAt === undefined || snapshot.endedAt === undefined) throw new Error('Controller target is incomplete')

  return {
    id: createId(),
    sessionId: `remote-${new Date(createdAt).toISOString().slice(0, 10)}`,
    caseId: target.id,
    caseVersion: 1,
    algorithmVariantId: target.id,
    family: 'algorithm',
    protocol: 'algorithm-rehearsal',
    curriculumMode: 'drill',
    setup: {
      seed: `remote-${createdAt}`,
      generatorId: 'remote-controller',
      generatorVersion: '1',
      caseId: target.id,
      scramble: target.setup,
      constraintHash: target.id
    },
    input: 'smart-cube',
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt,
    phaseEvents: [
      { phase: 'controller-start', at: snapshot.startedAt, source: 'cube' },
      { phase: 'controller-complete', at: snapshot.endedAt, source: 'cube' }
    ],
    executionMs: snapshot.endedAt - snapshot.startedAt,
    totalMs: snapshot.endedAt - snapshot.startedAt,
    outcome: 'success',
    answer: snapshot.turns.join(' '),
    expectedAnswer: target.algorithm,
    answerCorrect: true,
    hintEvents: [],
    wrongMoves: 0,
    divergenceCount: 0,
    correctionMoveCount: 0,
    rawEventIds: [],
    targetSatisfied: true,
    dataQuality: {
      completeMoveStream: true,
      setupVerifiedByState: false,
      packetLossSuspected: false,
      timingUsable: true,
      notes: ['Controller mode intentionally ignores cube state and turn identity']
    },
    schemaVersion: 1
  }
}
import type { AlgorithmRecord, TrainerAttempt } from './models'
import { createId } from './ids'
