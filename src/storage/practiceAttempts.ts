import type { Face, PracticeAttempt } from '../domain/crossF2lPractice'
import { repositories } from './database'

const ATTEMPTS_KEY = 'practice.crossF2l.attempts'
const GOAL_KEY = 'practice.crossF2l.goal'
const KEEP = 300

export type StoredGoal = { pairs: number; face: Face | 'any' }

let queue: Promise<unknown> = Promise.resolve()
const serial = <T,>(work: () => Promise<T>) => {
  const next = queue.then(work, work)
  queue = next.catch(() => undefined)
  return next
}

export async function readAttempts(): Promise<PracticeAttempt[]> {
  const record = await repositories.settings.get(ATTEMPTS_KEY)
  return Array.isArray(record?.value) ? (record.value as PracticeAttempt[]) : []
}

export const saveAttempt = (attempt: PracticeAttempt) => serial(async () => {
  const next = [...(await readAttempts()), attempt].slice(-KEEP)
  await repositories.settings.put({ key: ATTEMPTS_KEY, value: next })
  return next
})

export const patchAttempt = (id: string, patch: Partial<PracticeAttempt>) => serial(async () => {
  const next = (await readAttempts()).map((attempt) => (attempt.id === id ? { ...attempt, ...patch } : attempt))
  await repositories.settings.put({ key: ATTEMPTS_KEY, value: next })
  return next
})

export const clearAttempts = () => serial(() => repositories.settings.put({ key: ATTEMPTS_KEY, value: [] }))

export async function readGoal(): Promise<StoredGoal | undefined> {
  const value = (await repositories.settings.get(GOAL_KEY))?.value as Partial<StoredGoal> | undefined
  if (!value || typeof value.pairs !== 'number' || value.pairs < 0 || value.pairs > 4) return undefined
  return { pairs: value.pairs, face: value.face ?? 'any' }
}

export const writeGoal = (goal: StoredGoal) => repositories.settings.put({ key: GOAL_KEY, value: goal })
