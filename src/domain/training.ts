import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { catalogueCases, toAlgorithmRecord } from './algorithmCatalogue'
import type { AlgorithmRecord, SolveRecord, TrainerAttempt } from './models'
import { createId } from './ids'
import { averageOf } from './statistics'
import { reorientToSolvedCenters } from './lastLayer'

export type LearningState = 'unlearned' | 'learning' | 'finished'

const now = Date.now()

const supersededStarterIds = ['oll-sune', 'oll-antisune']

export const defaultAlgorithms: AlgorithmRecord[] = [
  { id: 'f2l-insert-right', set: 'F2L', name: 'Basic right insert', algorithm: "U R U' R'", setup: "R U R'", targetMs: 900, mastery: 0, dueAt: now, orientations: ['FR'] },
  { id: 'f2l-insert-left', set: 'F2L', name: 'Basic left insert', algorithm: "U' L' U L", setup: "L' U' L", targetMs: 900, mastery: 0, dueAt: now, orientations: ['FL'] },
  { id: 'f2l-sledge', set: 'F2L', name: 'Sledge insert', algorithm: "R' F R F'", setup: "F R' F' R", targetMs: 850, mastery: 0, dueAt: now, orientations: ['FR'] },
  ...catalogueCases.map((entry) => toAlgorithmRecord(entry, now))
]

export function orderByCatalogue(records: AlgorithmRecord[]) {
  const order = new Map(defaultAlgorithms.map((record, index) => [record.id, index]))
  return [...records].sort((left, right) => {
    const leftRank = order.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightRank = order.get(right.id) ?? Number.MAX_SAFE_INTEGER
    if (leftRank !== rightRank) return leftRank - rightRank
    return left.name.localeCompare(right.name, undefined, { numeric: true })
  })
}

export function f2lCatalogueRecords(cases: Array<{ id: string; name: string; slot: string; algPool: string[]; setup: string; optimalMoves: number }>, timestamp = Date.now()): AlgorithmRecord[] {
  return cases.map((entry) => ({
    id: entry.id,
    set: 'F2L' as const,
    name: entry.name,
    algorithm: entry.algPool[0] ?? '',
    setup: entry.setup,
    targetMs: Math.max(700, entry.optimalMoves * 220),
    mastery: 0,
    dueAt: timestamp,
    orientations: [entry.slot]
  }))
}

export function planDefaultAlgorithmSync(stored: AlgorithmRecord[], timestamp = Date.now()) {
  const storedIds = new Set(stored.map((record) => record.id))
  const missing = defaultAlgorithms.filter((record) => !storedIds.has(record.id)).map((record) => ({ ...record, dueAt: timestamp }))
  const superseded = stored.filter((record) => supersededStarterIds.includes(record.id) && record.mastery === 0).map((record) => record.id)
  return { missing, superseded }
}

export type ExpectedCaseTime = { totalMs: number }

export type CaseExpectedTimeTable = (caseId: string, skillBucket: number) => ExpectedCaseTime | undefined

export function getSkillBucketFromGoalTime(goalMs: number, maxBucket = 45): number {
  return Math.max(0, Math.min(maxBucket, Math.floor(goalMs / 1_000)))
}

export function computePerformanceScore(expectedMs: number, actualMs: number): number {
  if (expectedMs <= 0 || actualMs <= 0) return 100
  return (expectedMs / actualMs) * 100
}

export function computeSelectionWeight(performanceScore: number): number {
  const gap = Math.max(1, 100 - performanceScore)
  return gap * gap
}

export function buildOwnDataExpectedTimeTable(attempts: TrainerAttempt[]): CaseExpectedTimeTable {
  const timesByCase = new Map<string, number[]>()
  for (const attempt of attempts) {
    if (attempt.outcome !== 'success') continue
    const times = timesByCase.get(attempt.caseId) ?? []
    times.push(attempt.totalMs)
    timesByCase.set(attempt.caseId, times)
  }
  const medianByCase = new Map<string, number>()
  for (const [caseId, times] of timesByCase) {
    const sorted = [...times].sort((left, right) => left - right)
    const middle = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    medianByCase.set(caseId, median)
  }
  return (caseId) => {
    const median = medianByCase.get(caseId)
    return median === undefined ? undefined : { totalMs: median }
  }
}

export function caseWeights(
  cases: AlgorithmRecord[],
  attempts: TrainerAttempt[],
  expectedTimeTable: CaseExpectedTimeTable = buildOwnDataExpectedTimeTable(attempts)
) {
  const solvesFor = (id: string) => attempts.filter((attempt) => attempt.caseId === id && attempt.outcome === 'success')
  const counts = cases.map((record) => solvesFor(record.id).length)
  const maxCount = Math.max(0, ...counts)
  const averages = cases.map((record) => {
    const solves = solvesFor(record.id).slice(-5)
    return solves.length ? solves.reduce((total, attempt) => total + attempt.totalMs, 0) / solves.length : undefined
  })
  const measured = averages.filter((value): value is number => value !== undefined)
  const overallAverage = measured.length ? measured.reduce((total, value) => total + value, 0) / measured.length : undefined
  const skillBucket = overallAverage !== undefined ? getSkillBucketFromGoalTime(overallAverage) : 0

  return cases.map((record, index) => {
    const countDeficit = maxCount - counts[index]
    const solveWeight = 1 + Math.min(2, countDeficit / 3)
    const average = averages[index]
    const timeWeight = average !== undefined && overallAverage !== undefined
      ? 1 + Math.min(2, Math.max(0, (average - overallAverage) / 100))
      : 1
    const fallbackWeight = Math.min(3, Math.max(solveWeight, timeWeight))

    if (average === undefined) return { record, weight: fallbackWeight }
    const expected = expectedTimeTable(record.id, skillBucket)
    if (!expected) return { record, weight: fallbackWeight }

    const performanceScore = computePerformanceScore(expected.totalMs, average)
    return { record, weight: computeSelectionWeight(performanceScore) }
  })
}

export function chooseTrainingCase(
  cases: AlgorithmRecord[],
  attempts: TrainerAttempt[],
  timestamp = Date.now(),
  roll = Math.random(),
  expectedTimeTable?: CaseExpectedTimeTable
) {
  if (!cases.length) return undefined
  const due = cases.filter((record) => record.dueAt <= timestamp)
  const pool = due.length ? due : cases
  const weighted = expectedTimeTable ? caseWeights(pool, attempts, expectedTimeTable) : caseWeights(pool, attempts)
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0)
  let cursor = roll * total
  for (const entry of weighted) {
    cursor -= entry.weight
    if (cursor <= 0) return entry.record
  }
  return weighted[weighted.length - 1].record
}

export function updateMastery(record: AlgorithmRecord, success: boolean, elapsedMs: number, timestamp = Date.now()): AlgorithmRecord {
  const speedPass = elapsedMs <= record.targetMs
  const delta = success ? (speedPass ? 0.18 : 0.1) : -0.2
  const mastery = Math.min(1, Math.max(0, record.mastery + delta))
  const intervalDays = success ? Math.max(1, Math.round(1 + mastery * 13)) : 0
  return { ...record, mastery, dueAt: timestamp + intervalDays * 86_400_000 }
}

export function progressiveHint(record: AlgorithmRecord, level: number) {
  if (level <= 0) return `${record.set} · no hints revealed`
  if (level === 1) return `Setup: ${record.setup}`
  if (level === 2) return `First trigger: ${record.algorithm.split(/\s+/).slice(0, 4).join(' ')}`
  return record.algorithm
}

export function learningState(record: AlgorithmRecord): LearningState {
  if (record.mastery >= 0.8) return 'finished'
  if (record.mastery > 0) return 'learning'
  return 'unlearned'
}

export function setLearningState(record: AlgorithmRecord, state: LearningState, timestamp = Date.now()): AlgorithmRecord {
  if (state === 'unlearned') return { ...record, mastery: 0, dueAt: timestamp }
  if (state === 'learning') return { ...record, mastery: 0.4, dueAt: timestamp }
  return { ...record, mastery: 1, dueAt: timestamp + 28 * 86_400_000 }
}

const ollNoEdgesOriented = new Set([1, 2, 3, 4, 17, 18, 19, 20])
const ollAllEdgesOriented = new Set([21, 22, 23, 24, 25, 26, 27])

function ollGroup(id: string): string {
  if (id.startsWith('eoll-')) return 'Edge Orientation'
  const number = Number(id.slice('oll-'.length))
  if (ollNoEdgesOriented.has(number)) return 'No Edges'
  if (ollAllEdgesOriented.has(number)) return 'All Edges'
  return 'Two Edges'
}

const pllEdgePermIds = new Set(['pll-h', 'pll-ua', 'pll-ub', 'pll-z'])
const pllDiagonalCornerIds = new Set(['pll-e', 'pll-na', 'pll-nb', 'pll-v', 'pll-y'])
const pllCornerPermIds = new Set(['pll-aa', 'pll-ab'])

function pllGroup(id: string): string {
  if (pllEdgePermIds.has(id)) return 'Edge Perm'
  if (pllDiagonalCornerIds.has(id)) return 'Diagonal Corners'
  return 'Adjacent Corners'
}

export function isOcllCase(record: AlgorithmRecord): boolean {
  if (record.set !== 'OLL') return false
  const number = Number(record.id.slice('oll-'.length))
  return ollAllEdgesOriented.has(number)
}

export function isEollCase(record: AlgorithmRecord): boolean {
  return record.set === 'OLL' && record.id.startsWith('eoll-')
}

export function isTwoLookPllCase(record: AlgorithmRecord): boolean {
  if (record.set !== 'PLL') return false
  return pllEdgePermIds.has(record.id) || pllCornerPermIds.has(record.id)
}

export function isTwoLookOllCase(record: AlgorithmRecord): boolean {
  return isEollCase(record) || isOcllCase(record)
}

export function ocllCases(records: AlgorithmRecord[]): AlgorithmRecord[] {
  return records.filter(isOcllCase)
}

export function twoLookPllCases(records: AlgorithmRecord[]): AlgorithmRecord[] {
  return records.filter(isTwoLookPllCase)
}

export function twoLookOllCases(records: AlgorithmRecord[]): AlgorithmRecord[] {
  return records.filter(isTwoLookOllCase)
}

function cornerFamilyGroup(record: AlgorithmRecord, prefix: string): string {
  return record.name.replace(new RegExp(`^${prefix} `), '').replace(/\s\d+$/, '')
}

// The sets ported from cubedex carry their own subset name, which does not follow any of
// this app's id conventions — ZBLL groups as AS1..U6, WVLS as "0 Oriented".. and so on. It
// is stored the same way F2L's slot is, in orientations[0], rather than parsed back out of
// an id.
const CUBEDEX_PORTED_SETS: ReadonlyArray<AlgorithmRecord['set']> = ['WVLS', 'OLLCP', 'VHLS', 'ZBLL', 'ZBLS', 'L6E-EO', 'L6E-EOLR']

export function caseSubset(record: AlgorithmRecord): string {
  if (CUBEDEX_PORTED_SETS.includes(record.set)) return record.orientations[0] ?? 'All'
  if (record.set === 'F2L') return record.orientations[0] ?? 'Personal'
  if (record.set === 'OLL') return ollGroup(record.id)
  if (record.set === 'PLL') return pllGroup(record.id)
  if (record.set === 'COLL') return cornerFamilyGroup(record, 'COLL')
  if (record.set === 'CMLL') return cornerFamilyGroup(record, 'CMLL')
  return 'All'
}

export function subsetsFor(records: AlgorithmRecord[]): string[] {
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const record of records) {
    const subset = caseSubset(record)
    if (seen.has(subset)) continue
    seen.add(subset)
    ordered.push(subset)
  }
  return ordered
}

export function filterBySubset(records: AlgorithmRecord[], subset: string): AlgorithmRecord[] {
  if (subset === 'All') return records
  return records.filter((record) => caseSubset(record) === subset)
}

export type LearningStateFilter = 'All' | 'Unlearned' | 'Learning' | 'Learned'

const learningStateFilterMap: Record<Exclude<LearningStateFilter, 'All'>, LearningState> = {
  Unlearned: 'unlearned',
  Learning: 'learning',
  Learned: 'finished'
}

export function filterByLearningState(records: AlgorithmRecord[], filter: LearningStateFilter): AlgorithmRecord[] {
  if (filter === 'All') return records
  const target = learningStateFilterMap[filter]
  return records.filter((record) => learningState(record) === target)
}

export function learningBadgeClass(record: AlgorithmRecord): 'learned' | 'learning' | 'unlearned' {
  const state = learningState(record)
  return state === 'finished' ? 'learned' : state
}

export function caseTrainingStats(
  cases: AlgorithmRecord[],
  attempts: Array<Pick<TrainerAttempt, 'caseId' | 'outcome' | 'totalMs' | 'endedAt'>>
) {
  return cases.map((record) => {
    const caseAttempts = attempts.filter((attempt) => attempt.caseId === record.id)
    const timed = caseAttempts.filter((attempt) => Number.isFinite(attempt.totalMs) && attempt.totalMs >= 0)
    const durations = timed.map((attempt) => attempt.totalMs)
    const recent = [...timed].sort((left, right) => right.endedAt - left.endedAt).slice(0, 5).map((attempt) => attempt.totalMs)
    const successes = caseAttempts.filter((attempt) => attempt.outcome === 'success').length
    const average = (values: number[]) => values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : undefined
    return {
      caseId: record.id,
      attempts: caseAttempts.length,
      successes,
      successRate: caseAttempts.length ? successes / caseAttempts.length : 0,
      bestMs: durations.length ? Math.min(...durations) : undefined,
      meanMs: average(durations),
      recentAverageMs: average(recent)
    }
  })
}

export function createAlgorithmRecord(
  draft: Omit<AlgorithmRecord, 'id' | 'mastery' | 'dueAt'>,
  timestamp = Date.now(),
  id: string = createId()
): AlgorithmRecord {
  const name = draft.name.trim()
  const algorithm = draft.algorithm.trim()
  const setup = draft.setup.trim()
  if (!name) throw new Error('Case name is required')
  if (!algorithm) throw new Error('Algorithm is required')
  if (!Number.isFinite(draft.targetMs) || draft.targetMs <= 0) throw new Error('Target time must be positive')
  new Alg(algorithm)
  new Alg(setup)

  return { ...draft, id, name, algorithm, setup, mastery: 0, dueAt: timestamp }
}


export type CaseStats = {
  practiceCount: number
  failedCount: number
  bestTime?: number
  ao5?: number
}

export type CaseAverages = {
  ao5?: number
  ao12?: number
}

export function caseAverages(attempts: TrainerAttempt[], caseId: string): CaseAverages {
  const timedSolves = attempts
    .filter((attempt) => attempt.caseId === caseId && attempt.outcome === 'success')
    .map((attempt) => ({ startedAt: attempt.startedAt, endedAt: attempt.endedAt, penalty: 'none' as const })) as unknown as SolveRecord[]
  return {
    ao5: averageOf(timedSolves, 5),
    ao12: averageOf(timedSolves, 12)
  }
}

const cornerHomeFaces: Record<number, [string, string, string]> = {
  0: ['U', 'R', 'F'],
  1: ['U', 'B', 'R'],
  2: ['U', 'L', 'B'],
  3: ['U', 'F', 'L'],
  4: ['D', 'F', 'R'],
  5: ['D', 'L', 'F'],
  6: ['D', 'B', 'L'],
  7: ['D', 'R', 'B']
}

const edgeHomeFaces: Record<number, [string, string]> = {
  0: ['U', 'F'],
  1: ['U', 'R'],
  2: ['U', 'B'],
  3: ['U', 'L'],
  4: ['D', 'F'],
  5: ['D', 'R'],
  6: ['D', 'B'],
  7: ['D', 'L'],
  8: ['F', 'R'],
  9: ['F', 'L'],
  10: ['B', 'R'],
  11: ['B', 'L']
}

function cornerFace(corners: { pieces: number[]; orientation: number[] }, position: number, slot: number): string {
  return cornerHomeFaces[corners.pieces[position]][(slot - corners.orientation[position] + 3) % 3]
}

function edgeFace(edges: { pieces: number[]; orientation: number[] }, position: number, slot: number): string {
  return edgeHomeFaces[edges.pieces[position]][(slot - edges.orientation[position] + 2) % 2]
}

export type TwoSidedRecognitionView = {
  front: [string, string, string]
  right: [string, string, string]
}

export async function deriveTwoSidedRecognitionView(setup: string): Promise<TwoSidedRecognitionView> {
  const puzzle = await puzzles['3x3x3'].kpuzzle()
  const applied = puzzle.defaultPattern().applyAlg(new Alg(setup))
  const pattern = reorientToSolvedCenters(applied)
  if (!pattern) throw new Error(`Setup does not restore the cube frame: ${setup}`)
  const { CORNERS: corners, EDGES: edges } = pattern.patternData
  return {
    front: [cornerFace(corners, 3, 1), edgeFace(edges, 0, 1), cornerFace(corners, 0, 2)],
    right: [cornerFace(corners, 0, 1), edgeFace(edges, 1, 1), cornerFace(corners, 1, 2)]
  }
}

export function caseStats(attempts: TrainerAttempt[], caseId: string): CaseStats {
  const forCase = attempts.filter((attempt) => attempt.caseId === caseId)
  const successes = forCase.filter((attempt) => attempt.outcome === 'success')
  const times = successes.map((attempt) => attempt.totalMs)
  const recent = times.slice(-5)
  const ao5 = recent.length === 5
    ? recent.slice().sort((left, right) => left - right).slice(1, 4).reduce((total, value) => total + value, 0) / 3
    : undefined
  return {
    practiceCount: forCase.length,
    failedCount: forCase.filter((attempt) => attempt.outcome !== 'success').length,
    bestTime: times.length ? Math.min(...times) : undefined,
    ao5
  }
}
