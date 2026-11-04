import { Alg } from 'cubing/alg'
import type { AlgorithmRecord } from '../../../domain/models'
import { CUBEDEX_SETS_NEW_TO_THIS_APP, cubedexAllCasesForCategory, cubedexSubsetsForCategory } from '../../../domain/cubedex/defaultAlgs'
import { expandNotation } from '../../../domain/cubedex/notation'
import { filterByLearningState, filterBySubset, isEollCase, isOcllCase, isTwoLookOllCase, isTwoLookPllCase, learningState, subsetsFor, type LearningStateFilter } from '../../../domain/training'

export type CubedexExtraSet = (typeof CUBEDEX_SETS_NEW_TO_THIS_APP)[number]

export type CaseSet = 'OLL' | 'PLL' | 'OCLL' | '2-Look OLL' | '2-Look PLL' | 'COLL' | 'CMLL' | 'F2L' | CubedexExtraSet

export const CASE_SETS: CaseSet[] = ['OLL', 'PLL', '2-Look OLL', '2-Look PLL', 'OCLL', 'COLL', 'CMLL', 'F2L', ...CUBEDEX_SETS_NEW_TO_THIS_APP]

export const LEARNING_FILTERS: LearningStateFilter[] = ['All', 'Unlearned', 'Learning', 'Learned']

export const isCubedexExtraSet = (set: string): set is CubedexExtraSet =>
  (CUBEDEX_SETS_NEW_TO_THIS_APP as readonly string[]).includes(set)

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const cubedexIdPrefix = (category: CubedexExtraSet) => `cubedex-${slugify(category)}-`

export const cubedexCaseId = (category: CubedexExtraSet, caseName: string) => `${cubedexIdPrefix(category)}${slugify(caseName)}`

export const recordSetFor = (set: CaseSet): AlgorithmRecord['set'] =>
  set === 'OCLL' || set === '2-Look OLL' ? 'OLL' : set === '2-Look PLL' ? 'PLL' : set

export function matchesSet(record: AlgorithmRecord, set: CaseSet): boolean {
  if (isCubedexExtraSet(set)) return record.set === set
  if (set === 'OCLL') return isOcllCase(record)
  if (set === '2-Look PLL') return isTwoLookPllCase(record)
  if (set === '2-Look OLL') return isTwoLookOllCase(record)
  if (set === 'OLL') return record.set === 'OLL' && !isEollCase(record) && !record.id.startsWith('cubedex-')
  return record.set === set && !record.id.startsWith('cubedex-')
}

export function cubedexRecords(category: CubedexExtraSet, timestamp = Date.now()): AlgorithmRecord[] {
  return cubedexAllCasesForCategory(category).map((entry) => {
    const algorithm = expandNotation(entry.algorithm).replace(/[()]/g, '')
    const moveCount = algorithm.split(/\s+/).filter(Boolean).length
    return {
      id: cubedexCaseId(category, entry.name),
      set: category,
      name: entry.name,
      algorithm,
      setup: new Alg(algorithm).invert().toString(),
      targetMs: Math.max(900, moveCount * 220),
      mastery: 0,
      dueAt: timestamp,
      orientations: [entry.subset]
    }
  })
}

export function subsetsForSet(set: CaseSet, records: AlgorithmRecord[]): string[] {
  if (isCubedexExtraSet(set)) return cubedexSubsetsForCategory(set).map((entry) => entry.subset)
  return subsetsFor(records)
}

export function filterSetSubset(set: CaseSet, records: AlgorithmRecord[], subset: string): AlgorithmRecord[] {
  if (subset === 'All') return records
  if (isCubedexExtraSet(set)) return records.filter((record) => record.orientations[0] === subset)
  return filterBySubset(records, subset)
}

export function learningCounts(records: AlgorithmRecord[]): Record<LearningStateFilter, number> {
  const counts: Record<LearningStateFilter, number> = { All: records.length, Unlearned: 0, Learning: 0, Learned: 0 }
  for (const record of records) {
    const state = learningState(record)
    counts[state === 'finished' ? 'Learned' : state === 'learning' ? 'Learning' : 'Unlearned'] += 1
  }
  return counts
}

export function narrowCases(set: CaseSet, algorithms: AlgorithmRecord[], subset: string, learning: LearningStateFilter) {
  const inSet = algorithms.filter((record) => matchesSet(record, set))
  const inSubset = filterSetSubset(set, inSet, subset)
  return { inSet, inSubset, cases: filterByLearningState(inSubset, learning) }
}

export function searchCases(records: AlgorithmRecord[], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return records
  return records.filter((record) => record.name.toLowerCase().includes(needle) || record.algorithm.toLowerCase().includes(needle))
}
