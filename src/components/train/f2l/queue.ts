import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import { caseStats } from '../../../domain/training'
import {
  cubedexBuildQueue,
  cubedexInsertCaseWithGap,
  cubedexShuffleCases,
  getCubedexCaseUrgency,
  isCubedexCaseDue
} from '../../../domain/cubedex/practiceOptions'

export type F2lOrder = 'smart' | 'random' | 'slow'

export const F2L_ORDERS: F2lOrder[] = ['smart', 'random', 'slow']

export const ORDER_LABEL: Record<F2lOrder, string> = { smart: 'Smart', random: 'Random', slow: 'Slow first' }

export function buildPass(records: AlgorithmRecord[], attempts: TrainerAttempt[], order: F2lOrder, now = Date.now()): AlgorithmRecord[] {
  const cases = records.map((record) => ({
    ...record,
    bestMs: caseStats(attempts, record.id).bestTime,
    reviewCount: attempts.filter((attempt) => attempt.caseId === record.id).length,
    isDue: isCubedexCaseDue(record.dueAt, now),
    urgency: getCubedexCaseUrgency(record.dueAt, now)
  }))
  if (order === 'random') return cubedexShuffleCases(cases)
  return cubedexBuildQueue(cases, { smartReviewScheduling: order === 'smart', prioritizeSlowCases: order === 'slow' })
}

export function requeueFailed<T>(queue: T[], index: number, entry: T): T[] {
  const remaining = queue.slice(index + 1)
  cubedexInsertCaseWithGap(remaining, entry)
  return [...queue.slice(0, index + 1), ...remaining]
}

export const SLOT_ORDER = ['FR', 'FL', 'BL', 'BR'] as const

export const SLOT_LABEL: Record<string, string> = { FR: 'Front right', FL: 'Front left', BL: 'Back left', BR: 'Back right' }

export const slotOf = (record: AlgorithmRecord) => (record.orientations[0] ?? '').toUpperCase()

export function shortCaseName(record: AlgorithmRecord) {
  const numbered = /^F2L (\d+)\b/.exec(record.name)
  return numbered ? numbered[1] : record.name
}

export function displayCaseName(record: AlgorithmRecord) {
  const numbered = /^F2L (\d+) - (.+)$/.exec(record.name)
  return numbered ? `F2L ${numbered[1]}, ${numbered[2].toLowerCase()}` : record.name
}
