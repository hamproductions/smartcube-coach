import { describe, expect, it } from 'vitest'
import type { TrainerAttempt } from './models'
import { cmllCases, collCases, toAlgorithmRecord } from './algorithmCatalogue'
import { caseAverages, caseSubset, caseTrainingStats, createAlgorithmRecord, defaultAlgorithms, deriveTwoSidedRecognitionView, filterByLearningState, filterBySubset, isOcllCase, isTwoLookPllCase, learningBadgeClass, learningState, ocllCases, orderByCatalogue, planDefaultAlgorithmSync, setLearningState, subsetsFor, caseStats, twoLookPllCases } from './training'

const record = {
  id: 'case-1',
  set: 'F2L' as const,
  name: 'Case 1',
  algorithm: 'R U',
  setup: "R U R'",
  targetMs: 900,
  mastery: 0,
  dueAt: 0,
  orientations: ['FR']
}

describe('trainer learning states', () => {
  it('derives unlearned, learning, and finished from durable mastery', () => {
    expect(learningState({ ...record, mastery: 0 })).toBe('unlearned')
    expect(learningState({ ...record, mastery: 0.5 })).toBe('learning')
    expect(learningState({ ...record, mastery: 0.8 })).toBe('finished')
  })

  it('sets a case learning state without changing its algorithm identity', () => {
    const next = setLearningState(record, 'finished', 1_000)

    expect(next).toMatchObject({ id: 'case-1', algorithm: 'R U', mastery: 1, dueAt: 1_000 + 28 * 86_400_000 })
  })

  it('creates a validated personal algorithm record', () => {
    const created = createAlgorithmRecord({ set: 'PLL', name: 'Personal T', algorithm: "R U R' U'", setup: 'R U', targetMs: 850, orientations: ['U'] }, 1_000, 'personal-t')

    expect(created).toEqual({ id: 'personal-t', set: 'PLL', name: 'Personal T', algorithm: "R U R' U'", setup: 'R U', targetMs: 850, mastery: 0, dueAt: 1_000, orientations: ['U'] })
  })

  it('rejects unnamed or invalid personal algorithms', () => {
    expect(() => createAlgorithmRecord({ set: 'F2L', name: '', algorithm: 'R U', setup: '', targetMs: 900, orientations: [] })).toThrow('Case name is required')
    expect(() => createAlgorithmRecord({ set: 'F2L', name: 'Broken', algorithm: 'R @', setup: '', targetMs: 900, orientations: [] })).toThrow()
  })

  it('ships the full OLL and PLL catalogue as defaults', () => {
    expect(defaultAlgorithms.filter((entry) => entry.set === 'OLL')).toHaveLength(57)
    expect(defaultAlgorithms.filter((entry) => entry.set === 'PLL')).toHaveLength(21)
    expect(new Set(defaultAlgorithms.map((entry) => entry.id)).size).toBe(defaultAlgorithms.length)
  })

  it('backfills missing catalogue cases and retires untouched starter duplicates', () => {
    const stored = [
      { ...record, id: 'oll-sune', set: 'OLL' as const, mastery: 0 },
      { ...record, id: 'pll-t', set: 'PLL' as const, mastery: 0.4 },
      { ...record, id: 'personal-case' }
    ]
    const { missing, superseded } = planDefaultAlgorithmSync(stored, 5_000)

    expect(missing).toHaveLength(defaultAlgorithms.length - 1)
    expect(missing.some((entry) => entry.id === 'pll-t')).toBe(false)
    expect(missing.every((entry) => entry.dueAt === 5_000)).toBe(true)
    expect(superseded).toEqual(['oll-sune'])
  })

  it('orders stored cases by catalogue position and keeps personal cases last', () => {
    const stored = [
      { ...record, id: 'personal-case' },
      { ...record, id: 'f2l-sledge' },
      { ...record, id: 'f2l-insert-right' }
    ]

    expect(orderByCatalogue(stored).map((entry) => entry.id)).toEqual(['f2l-insert-right', 'f2l-sledge', 'personal-case'])
  })

  it('orders generated catalogue cases by case number rather than by key text', () => {
    const generated = [
      { ...record, id: 'f2l-bl-10', name: 'F2L 10 - Back Left' },
      { ...record, id: 'f2l-bl-2', name: 'F2L 2 - Back Left' },
      { ...record, id: 'f2l-bl-1', name: 'F2L 1 - Back Left' }
    ]

    expect(orderByCatalogue(generated).map((entry) => entry.name)).toEqual(['F2L 1 - Back Left', 'F2L 2 - Back Left', 'F2L 10 - Back Left'])
  })

  it('summarizes case outcomes without counting another case', () => {
    expect(caseTrainingStats([record], [
      { caseId: 'case-1', outcome: 'success', totalMs: 920, endedAt: 1_000 },
      { caseId: 'case-1', outcome: 'incorrect', totalMs: 1_120, endedAt: 2_000 },
      { caseId: 'case-1', outcome: 'success', totalMs: 880, endedAt: 3_000 },
      { caseId: 'other-case', outcome: 'success', totalMs: 100, endedAt: 4_000 }
    ])).toEqual([{ caseId: 'case-1', attempts: 3, successes: 2, successRate: 2 / 3, bestMs: 880, meanMs: Math.round(2_920 / 3), recentAverageMs: Math.round(2_920 / 3) }])
  })
})

describe('case-library grammar', () => {
  it('groups F2L cases by slot', () => {
    expect(caseSubset({ ...record, orientations: ['FR'] })).toBe('FR')
    expect(caseSubset({ ...record, orientations: ['BL'] })).toBe('BL')
    expect(caseSubset({ ...record, orientations: [] })).toBe('Personal')
  })

  it('groups OLL cases by real edge-orientation shape, not fabricated names', () => {
    expect(caseSubset(defaultAlgorithms.find((entry) => entry.id === 'oll-01')!)).toBe('No Edges')
    expect(caseSubset(defaultAlgorithms.find((entry) => entry.id === 'oll-27')!)).toBe('All Edges')
    expect(caseSubset(defaultAlgorithms.find((entry) => entry.id === 'oll-07')!)).toBe('Two Edges')
  })

  it('groups PLL cases by corner-permutation shape', () => {
    expect(caseSubset(defaultAlgorithms.find((entry) => entry.id === 'pll-z')!)).toBe('Edge Perm')
    expect(caseSubset(defaultAlgorithms.find((entry) => entry.id === 'pll-y')!)).toBe('Diagonal Corners')
    expect(caseSubset(defaultAlgorithms.find((entry) => entry.id === 'pll-t')!)).toBe('Adjacent Corners')
  })

  it('groups COLL cases by their corner-orientation family', () => {
    const antiSune1 = toAlgorithmRecord(collCases.find((entry) => entry.id === 'coll-as-1')!)
    const pi3 = toAlgorithmRecord(collCases.find((entry) => entry.id === 'coll-pi-3')!)
    const h1 = toAlgorithmRecord(collCases.find((entry) => entry.id === 'coll-h-1')!)
    expect(caseSubset(antiSune1)).toBe('Anti-Sune')
    expect(caseSubset(pi3)).toBe('Pi')
    expect(caseSubset(h1)).toBe('H')
    expect(new Set(subsetsFor(collCases.map((entry) => toAlgorithmRecord(entry)))).size).toBe(7)
  })

  it('groups CMLL cases by their corner-orientation family', () => {
    const o1 = toAlgorithmRecord(cmllCases.find((entry) => entry.id === 'cmll-o-1')!)
    const antiS2 = toAlgorithmRecord(cmllCases.find((entry) => entry.id === 'cmll-as-2')!)
    expect(caseSubset(o1)).toBe('O')
    expect(caseSubset(antiS2)).toBe('Anti-S')
    expect(new Set(subsetsFor(cmllCases.map((entry) => toAlgorithmRecord(entry)))).size).toBe(8)
  })

  it('lists only subsets that actually occur, in first-seen order', () => {
    const cases = [{ ...record, id: 'a', orientations: ['FR'] }, { ...record, id: 'b', orientations: ['BL'] }, { ...record, id: 'c', orientations: ['FR'] }]
    expect(subsetsFor(cases)).toEqual(['FR', 'BL'])
  })

  it('filters by subset, and "All" is a no-op', () => {
    const cases = [{ ...record, id: 'a', orientations: ['FR'] }, { ...record, id: 'b', orientations: ['BL'] }]
    expect(filterBySubset(cases, 'FR').map((entry) => entry.id)).toEqual(['a'])
    expect(filterBySubset(cases, 'All')).toEqual(cases)
  })

  it('filters by learning state, and "All" is a no-op', () => {
    const cases = [{ ...record, id: 'a', mastery: 0 }, { ...record, id: 'b', mastery: 0.5 }, { ...record, id: 'c', mastery: 1 }]
    expect(filterByLearningState(cases, 'Unlearned').map((entry) => entry.id)).toEqual(['a'])
    expect(filterByLearningState(cases, 'Learning').map((entry) => entry.id)).toEqual(['b'])
    expect(filterByLearningState(cases, 'Learned').map((entry) => entry.id)).toEqual(['c'])
    expect(filterByLearningState(cases, 'All')).toEqual(cases)
  })

  it('maps learning state to the badge class exactly, renaming finished to learned', () => {
    expect(learningBadgeClass({ ...record, mastery: 0 })).toBe('unlearned')
    expect(learningBadgeClass({ ...record, mastery: 0.5 })).toBe('learning')
    expect(learningBadgeClass({ ...record, mastery: 1 })).toBe('learned')
  })
})

describe('per-case statistics', () => {
  const attempt = (caseId: string, outcome: 'success' | 'incorrect', totalMs: number): TrainerAttempt => ({
    id: `${caseId}-${totalMs}`,
    sessionId: 's',
    caseId,
    caseVersion: 1,
    family: 'algorithm',
    protocol: 'typed-answer',
    curriculumMode: 'drill',
    setup: { seed: 's', generatorId: 'g', generatorVersion: '1', caseId, scramble: '', constraintHash: '' },
    input: 'keyboard',
    startedAt: 0,
    endedAt: totalMs,
    phaseEvents: [],
    totalMs,
    outcome,
    hintEvents: [],
    wrongMoves: 0,
    divergenceCount: 0,
    correctionMoveCount: 0,
    rawEventIds: [],
    dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: [] },
    schemaVersion: 1
  })

  it('tracks practice count, failures, best time and ao5 per case', () => {
    const attempts = [
      attempt('oll-1', 'success', 3_000),
      attempt('oll-1', 'incorrect', 9_000),
      attempt('oll-1', 'success', 2_000),
      attempt('oll-1', 'success', 2_500),
      attempt('oll-1', 'success', 5_000),
      attempt('oll-1', 'success', 2_200)
    ]
    const stats = caseStats(attempts, 'oll-1')
    expect(stats.practiceCount).toBe(6)
    expect(stats.failedCount).toBe(1)
    expect(stats.bestTime).toBe(2_000)
    expect(stats.ao5).toBeCloseTo((2_500 + 3_000 + 2_200) / 3, 5)
  })

  it('reuses the shared trim rules to compute per-case ao5 and ao12, never fabricating a value from too few attempts', () => {
    const withFour = [
      attempt('oll-1', 'success', 3_000),
      attempt('oll-1', 'success', 2_000),
      attempt('oll-1', 'success', 2_500),
      attempt('oll-1', 'success', 5_000)
    ]
    expect(caseAverages(withFour, 'oll-1')).toEqual({ ao5: undefined, ao12: undefined })

    const withFive = [...withFour, attempt('oll-1', 'success', 2_200)]
    expect(caseAverages(withFive, 'oll-1').ao5).toBeCloseTo((2_500 + 3_000 + 2_200) / 3, 5)
    expect(caseAverages(withFive, 'oll-1').ao12).toBeUndefined()

    const failedOnly = [attempt('oll-1', 'incorrect', 1_000)]
    expect(caseAverages(failedOnly, 'oll-1')).toEqual({ ao5: undefined, ao12: undefined })
  })

  it('ignores attempts from other cases when computing per-case averages', () => {
    const attempts = [
      attempt('oll-1', 'success', 1_000),
      attempt('oll-1', 'success', 1_100),
      attempt('oll-1', 'success', 1_200),
      attempt('oll-1', 'success', 1_300),
      attempt('oll-1', 'success', 1_400),
      attempt('oll-2', 'success', 9_000)
    ]
    expect(caseAverages(attempts, 'oll-2').ao5).toBeUndefined()
  })
})

describe('OCLL and 2-Look PLL subsets', () => {
  it('derives OCLL as exactly the 7 corner-orientation-with-edges-already-oriented cases, OLL 21-27', () => {
    const ollCases = defaultAlgorithms.filter((entry) => entry.set === 'OLL')
    const ocll = ocllCases(ollCases)

    expect(ocll).toHaveLength(7)
    expect(ocll.map((entry) => entry.id).sort()).toEqual(['oll-21', 'oll-22', 'oll-23', 'oll-24', 'oll-25', 'oll-26', 'oll-27'])
    expect(ocll.every((entry) => isOcllCase(entry))).toBe(true)
    expect(isOcllCase(ollCases.find((entry) => entry.id === 'oll-27')!)).toBe(true)
    expect(isOcllCase(ollCases.find((entry) => entry.id === 'oll-01')!)).toBe(false)
    expect(isOcllCase(ollCases.find((entry) => entry.id === 'oll-07')!)).toBe(false)
  })

  it('derives 2-Look PLL as the corner-permutation and edge-permutation cases, a strict subset of the 21', () => {
    const pllCases = defaultAlgorithms.filter((entry) => entry.set === 'PLL')
    const twoLook = twoLookPllCases(pllCases)

    expect(twoLook.length).toBeGreaterThan(0)
    expect(twoLook.length).toBeLessThan(pllCases.length)
    expect(twoLook.every((entry) => isTwoLookPllCase(entry))).toBe(true)
    expect(isTwoLookPllCase(pllCases.find((entry) => entry.id === 'pll-aa')!)).toBe(true)
    expect(isTwoLookPllCase(pllCases.find((entry) => entry.id === 'pll-z')!)).toBe(true)
    expect(isTwoLookPllCase(pllCases.find((entry) => entry.id === 'pll-t')!)).toBe(false)
  })

  it('never classifies an F2L case as OCLL or 2-Look PLL', () => {
    expect(isOcllCase(record)).toBe(false)
    expect(isTwoLookPllCase(record)).toBe(false)
  })
})

describe('two-sided recognition view', () => {
  it('shows only the solved front and right faces for an empty setup', async () => {
    const view = await deriveTwoSidedRecognitionView('')
    expect(view).toEqual({ front: ['F', 'F', 'F'], right: ['R', 'R', 'R'] })
  })

  it('derives the real front/right stickers for a known OLL case setup, never a constant string', async () => {
    const sune = defaultAlgorithms.find((entry) => entry.id === 'oll-27')!
    const view = await deriveTwoSidedRecognitionView(sune.setup)
    expect(view).toEqual({ front: ['B', 'F', 'U'], right: ['B', 'B', 'U'] })
    expect(new Set([...view.front, ...view.right]).size).toBeGreaterThan(1)
  })

  it('produces a different view for a different case, proving the view tracks real per-case state', async () => {
    const runway = defaultAlgorithms.find((entry) => entry.id === 'oll-01')!
    const sune = defaultAlgorithms.find((entry) => entry.id === 'oll-27')!
    const [runwayView, suneView] = await Promise.all([
      deriveTwoSidedRecognitionView(runway.setup),
      deriveTwoSidedRecognitionView(sune.setup)
    ])
    expect(runwayView).not.toEqual(suneView)
  })

  it('only ever reports the six real face letters', async () => {
    const runway = defaultAlgorithms.find((entry) => entry.id === 'oll-01')!
    const view = await deriveTwoSidedRecognitionView(runway.setup)
    const faces = new Set(['U', 'D', 'L', 'R', 'F', 'B'])
    for (const sticker of [...view.front, ...view.right]) expect(faces.has(sticker)).toBe(true)
  })
})
