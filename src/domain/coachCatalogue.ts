import { ollCases, pllCases } from './algorithmCatalogue'
import { f2lCatalogue } from './f2lCatalogue'
import type { AlgorithmRecord } from './models'

/**
 * The algorithms the breakdown looks a case up in.
 *
 * The stored catalogue is written by the Training page, so a solver who has never opened
 * Training had no F2L records at all and the breakdown could name their case while having
 * nothing to suggest for it. The case tables are compiled into the app, so the lookup falls
 * back to them and only needs storage for what the solver has customised.
 *
 * Stored records win: a solver who edited an algorithm for a case must be shown their own.
 */
export function coachCatalogue(stored: AlgorithmRecord[]): AlgorithmRecord[] {
  const seen = new Set(stored.map((record) => record.id))
  const named = new Set(stored.map((record) => record.name))
  const builtIn: AlgorithmRecord[] = []

  const add = (id: string, set: AlgorithmRecord['set'], name: string, algorithm: string, orientations: string[]) => {
    if (seen.has(id) || named.has(name) || !algorithm.trim()) return
    seen.add(id)
    named.add(name)
    builtIn.push({ id, set, name, algorithm, setup: '', targetMs: 0, mastery: 0, dueAt: 0, orientations })
  }

  for (const entry of f2lCatalogue) {
    add(`f2l-${entry.slot.toLowerCase()}-${entry.caseNumber}`, 'F2L', entry.name, entry.algorithm, [entry.slot])
  }
  for (const entry of ollCases) add(entry.id, 'OLL', entry.name, entry.algorithm, [])
  for (const entry of pllCases) add(entry.id, 'PLL', entry.name, entry.algorithm, [])

  return [...stored, ...builtIn]
}
