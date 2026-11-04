import { useEffect, useMemo, useRef, useState } from 'react'
import type { KPuzzle } from 'cubing/kpuzzle'
import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { defaultLetterScheme, generateBldDrill, normalizeLetterScheme, validateCornerMemo, validateMemo } from '../domain/bld'
import { generateColorInference, gradeColorInference } from '../domain/cognitive'
import { generateEdgeOrientationPrompt, generateEdgeTrackingPrompt, generatePairTrackingPrompt, gradeEdgeOrientation, gradeEdgeTracking, gradePairTracking } from '../domain/tracking'
import { crossPlanSucceeds, generateCrossInspectionPrompt } from '../domain/inspection'
import { generateFreePairPrompt, gradeFreePair, type FreePairMode } from '../domain/freePair'
import { createRemoteControllerAttempt, type RemoteControllerSnapshot } from '../domain/remoteController'
import { buildF2lCases } from '../domain/f2lCases'
import { cmllCases, collCases, eollCases, toAlgorithmRecord } from '../domain/algorithmCatalogue'
import { caseAverages, caseSubset, caseStats, caseTrainingStats, f2lCatalogueRecords, chooseTrainingCase, createAlgorithmRecord, deriveTwoSidedRecognitionView, filterByLearningState, filterBySubset, isEollCase, isOcllCase, isTwoLookOllCase, isTwoLookPllCase, learningBadgeClass, learningState, ocllCases, orderByCatalogue, planDefaultAlgorithmSync, progressiveHint, setLearningState, subsetsFor, twoLookOllCases, twoLookPllCases, updateMastery, type LearningStateFilter, type TwoSidedRecognitionView } from '../domain/training'
import {
  DrillEngine,
  advanceQueueIndex,
  checkF2LState,
  createHintManager,
  findActiveEdgeIndex,
  isAlgorithmValidationActive,
  isUMove,
  type DrillPhase,
  type DrillQueueState,
  type DrillSlot,
  type HintMode
} from '../domain/drillEngine'
import {
  CUBEDEX_ALL_OPTIONS,
  CUBEDEX_PRACTICE_TOGGLES_DEFAULT,
  applyCubedexToggle,
  cubedexBuildQueue,
  cubedexInsertCaseWithGap,
  cubedexShuffleCases,
  getCubedexCaseUrgency,
  isCubedexCaseDue,
  type CubedexPracticeToggles,
  type CubedexQueueCase
} from '../domain/cubedex/practiceOptions'
import {
  CUBEDEX_QUICK_CATEGORIES,
  cubedexPreviewMoves,
  validateCubedexNewAlgDraft,
  type CubedexQuickCategory
} from '../domain/cubedex/newAlgAuthoring'
import {
  CUBEDEX_SETS_NEW_TO_THIS_APP,
  cubedexAllCasesForCategory,
  cubedexSubsetsForCategory
} from '../domain/cubedex/defaultAlgs'
import { expandNotation } from '../domain/cubedex/notation'
import { classifyCaseAttributes, matchesCaseAttributes, type CaseAttributeSlot, type CaseAttributes } from '../domain/caseAttributes'
import type { AlgorithmRecord, TrainerAttempt } from '../domain/models'
import { repositories } from '../storage/database'
import { setCriticalActivity } from '../pwa/register'
import { CubePlayback } from './CubePlayback'
import { css } from 'styled-system/css'
import { readPreferences } from '../storage/preferences'
import { CaseMastery } from './training/CaseMastery'
import { ActiveDrill } from './training/ActiveDrill'
import { ShapeFilterDialog } from './training/ShapeFilterDialog'
import { TimeAttackGauntlet } from './training/TimeAttackGauntlet'
import { CaseCard } from './ui/CaseCard'
import { Button } from './ui/Button'
import { TrainerToolbar } from './train/TrainerToolbar'
import { RemoteTrainerController, type RemoteControllerConnect } from './RemoteTrainerController'
import { createId } from '../domain/ids'
import { useCubeConnection } from '../device/CubeConnection'
import { bluetoothSource } from '../device/sources'
import type { CubeInputSource } from '../device/inputSource'

const F2L_SLOTS = ['fr', 'fl', 'br', 'bl'] as const

const toDrillSlot = (value: string | undefined): DrillSlot | undefined =>
  (F2L_SLOTS as readonly string[]).includes((value ?? '').toLowerCase()) ? (value!.toLowerCase() as DrillSlot) : undefined

type DrillQueueEntry = { record: AlgorithmRecord; solved: boolean }

type CubedexExtraSet = (typeof CUBEDEX_SETS_NEW_TO_THIS_APP)[number]

type CasePillSet = 'F2L' | 'OLL' | 'PLL' | 'OCLL' | '2-Look PLL' | '2-Look OLL' | 'COLL' | 'CMLL' | CubedexExtraSet

const isCubedexExtraPill = (pill: CasePillSet): pill is CubedexExtraSet =>
  (CUBEDEX_SETS_NEW_TO_THIS_APP as readonly string[]).includes(pill)

// The ported cubedex sets are stored under their own real `set` value, so a pill matches
// on that like every other category. The id prefix still exists to keep the ported copies
// of OLL/PLL/COLL/CMLL — which this app has its own authoritative catalogues for —
// from colliding with those catalogues' ids.
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const cubedexIdPrefix = (category: CubedexExtraSet) => `cubedex-${slugify(category)}-`
const cubedexCaseId = (category: CubedexExtraSet, caseName: string) => `${cubedexIdPrefix(category)}${slugify(caseName)}`

const recordSetFor = (pill: CasePillSet): AlgorithmRecord['set'] =>
  pill === 'OCLL' || pill === '2-Look OLL' ? 'OLL' : pill === '2-Look PLL' ? 'PLL' : pill

const matchesPill = (record: AlgorithmRecord, pill: CasePillSet): boolean => {
  if (isCubedexExtraPill(pill)) return record.set === pill
  if (pill === 'OCLL') return isOcllCase(record)
  if (pill === '2-Look PLL') return isTwoLookPllCase(record)
  if (pill === '2-Look OLL') return isTwoLookOllCase(record)
  if (pill === 'OLL') return record.set === 'OLL' && !isEollCase(record) && !record.id.startsWith('cubedex-')
  return record.set === pill && !record.id.startsWith('cubedex-')
}

export function TrainerHub({ controllerConnect, source, focusPanel }: { controllerConnect?: RemoteControllerConnect; source?: CubeInputSource; focusPanel?: string }) {
  const cubeLink = useCubeConnection()
  const [algorithms, setAlgorithms] = useState<AlgorithmRecord[]>([])
  const [attempts, setAttempts] = useState<TrainerAttempt[]>([])
  const [set, setSet] = useState<CasePillSet>('F2L')
  const [subset, setSubset] = useState('All')
  const [learningFilter, setLearningFilter] = useState<LearningStateFilter>('All')
  const [caseQuery, setCaseQuery] = useState('')
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [detailCase, setDetailCase] = useState<AlgorithmRecord>()
  const [shapeFilterOpen, setShapeFilterOpen] = useState(false)
  const [attributeFilter, setAttributeFilter] = useState<Partial<CaseAttributes>>({})
  const activeAttributeCount = Object.values(attributeFilter).filter(Boolean).length
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set())
  const [practicePool, setPracticePool] = useState<AlgorithmRecord[]>()
  const [mode, setMode] = useState<'Drill' | 'Learn' | 'Review' | 'Recognize'>('Drill')
  const [recognitionView, setRecognitionView] = useState<TwoSidedRecognitionView>()
  const [recognitionError, setRecognitionError] = useState('')
  const [timeAttackOrder, setTimeAttackOrder] = useState<string[]>([])
  const [timeAttackTargets, setTimeAttackTargets] = useState<Record<string, number>>({})
  const [timeAttackQueue, setTimeAttackQueue] = useState<AlgorithmRecord[]>()
  const [timeAttackIndex, setTimeAttackIndex] = useState(0)
  const [timeAttackStartedAt, setTimeAttackStartedAt] = useState(0)
  const [timeAttackRunId, setTimeAttackRunId] = useState('')
  const [current, setCurrent] = useState<AlgorithmRecord>()
  const [controllerIndex, setControllerIndex] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [recognizedAt, setRecognizedAt] = useState(0)
  const [hintLevel, setHintLevel] = useState(0)
  const [answer, setAnswer] = useState('')
  const [seed, setSeed] = useState('bld-001')
  const [memo, setMemo] = useState('')
  const [memoResult, setMemoResult] = useState('')
  const [cornerMemo, setCornerMemo] = useState('')
  const [cornerMemoResult, setCornerMemoResult] = useState('')
  const [bldFlipAnswer, setBldFlipAnswer] = useState('')
  const [bldTwistAnswer, setBldTwistAnswer] = useState('')
  const [bldOrientationResult, setBldOrientationResult] = useState('')
  const [bldStartedAt, setBldStartedAt] = useState(() => performance.now())
  const [bldConfig, setBldConfig] = useState({ buffer: 'A', letterScheme: defaultLetterScheme })
  const [bldBufferDraft, setBldBufferDraft] = useState('A')
  const [bldSchemeDraft, setBldSchemeDraft] = useState(defaultLetterScheme)
  const [bldConfigError, setBldConfigError] = useState('')
  const [colorAnswer, setColorAnswer] = useState('')
  const [colorResult, setColorResult] = useState('')
  const [colorRound, setColorRound] = useState(1)
  const [colorStartedAt, setColorStartedAt] = useState(() => performance.now())
  const [trackingAnswer, setTrackingAnswer] = useState('')
  const [trackingResult, setTrackingResult] = useState('')
  const [trackingRound, setTrackingRound] = useState(1)
  const [trackingStartedAt, setTrackingStartedAt] = useState(() => performance.now())
  const [pairAnswer, setPairAnswer] = useState('')
  const [pairResult, setPairResult] = useState('')
  const [pairRound, setPairRound] = useState(1)
  const [pairStartedAt, setPairStartedAt] = useState(() => performance.now())
  const [freePairAnswer, setFreePairAnswer] = useState<number | null>(null)
  const [freePairMode, setFreePairMode] = useState<FreePairMode>('normal')
  const [freePairCube, setFreePairCube] = useState(false)
  const [freePairResult, setFreePairResult] = useState('')
  const [freePairRound, setFreePairRound] = useState(1)
  const [freePairStartedAt, setFreePairStartedAt] = useState(() => performance.now())
  const [orientationAnswer, setOrientationAnswer] = useState('')
  const [orientationResult, setOrientationResult] = useState('')
  const [orientationRound, setOrientationRound] = useState(1)
  const [orientationStartedAt, setOrientationStartedAt] = useState(() => performance.now())
  const [crossPlan, setCrossPlan] = useState('')
  const [crossResult, setCrossResult] = useState('')
  const [crossRound, setCrossRound] = useState(1)
  const [crossStartedAt, setCrossStartedAt] = useState(() => performance.now())
  const [newCaseCategory, setNewCaseCategory] = useState<CubedexQuickCategory>('F2L')
  const [newCaseSubset, setNewCaseSubset] = useState('')
  const [newCaseName, setNewCaseName] = useState('')
  const [newCaseAlgorithm, setNewCaseAlgorithm] = useState('')
  const [newCaseSetup, setNewCaseSetup] = useState('')
  const [newCaseTargetMs, setNewCaseTargetMs] = useState(900)
  const [newCaseMessage, setNewCaseMessage] = useState('')
  const [practiceToggles, setPracticeToggles] = useState<CubedexPracticeToggles>(CUBEDEX_PRACTICE_TOGGLES_DEFAULT)
  const [storageError, setStorageError] = useState('')
  const [catalogueLoading, setCatalogueLoading] = useState(false)
  const [puzzle, setPuzzle] = useState<KPuzzle>()
  const [drillCase, setDrillCase] = useState<AlgorithmRecord>()
  const [drillPhase, setDrillPhase] = useState<DrillPhase>('stopped')
  const [drillCountdown, setDrillCountdown] = useState(3)
  const [drillRecognitionMs, setDrillRecognitionMs] = useState<number>()
  const [drillExecutionMs, setDrillExecutionMs] = useState<number>()
  const [performedMoves, setPerformedMoves] = useState<string[]>([])
  const [hintMode, setHintMode] = useState<HintMode>('step')
  const [hintManager, setHintManager] = useState(() => createHintManager())
  const [, setHintTick] = useState(0)
  const [algViewerLoaded, setAlgViewerLoaded] = useState(false)
  const algViewerContainerRef = useRef<HTMLDivElement>(null)
  const puzzleRef = useRef<KPuzzle | undefined>(undefined)
  puzzleRef.current = puzzle
  const drillCaseRef = useRef<AlgorithmRecord | undefined>(undefined)
  drillCaseRef.current = drillCase
  const hintModeRef = useRef(hintMode)
  hintModeRef.current = hintMode
  const algViewerLoadedRef = useRef(false)
  algViewerLoadedRef.current = algViewerLoaded
  const executionIndexRef = useRef(0)
  const divergenceRef = useRef(0)
  const f2lAlgorithms = useMemo(() => algorithms.filter((record) => record.set === 'F2L'), [algorithms])
  const f2lPoolRef = useRef<AlgorithmRecord[]>([])
  f2lPoolRef.current = f2lAlgorithms
  const attemptsRef = useRef<TrainerAttempt[]>([])
  attemptsRef.current = attempts
  const queueRef = useRef<DrillQueueState<DrillQueueEntry>>({ queue: [], index: -1 })
  const drillSlot = toDrillSlot(drillCase?.orientations[0])
  const drillSlotRef = useRef<DrillSlot | undefined>(undefined)
  drillSlotRef.current = drillSlot
  const practiceTogglesRef = useRef(practiceToggles)
  practiceTogglesRef.current = practiceToggles

  useEffect(() => {
    let cancelled = false
    void puzzles['3x3x3'].kpuzzle().then((loaded) => { if (!cancelled) setPuzzle(loaded) })
    void readPreferences().then((prefs) => { if (!cancelled) setPlaybackSpeed(prefs.playbackSpeed) })
    // A prescription block names a drill that lives further down this page, so arriving
    // from the coach lands on that drill rather than the top of the trainer.
    if (focusPanel) requestAnimationFrame(() => document.getElementById(focusPanel)?.scrollIntoView({ block: 'start' }))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (navigator.userAgent.includes('jsdom')) return
    const load = customElements.get('twisty-alg-viewer') ? Promise.resolve() : import('cubing/twisty')
    void load.then(() => customElements.whenDefined('twisty-alg-viewer')).then(() => setAlgViewerLoaded(true))
  }, [])

  const cubedexCaseFor = (record: AlgorithmRecord, attemptsList: TrainerAttempt[], now = Date.now()): AlgorithmRecord & CubedexQueueCase => ({
    ...record,
    bestMs: caseStats(attemptsList, record.id).bestTime,
    reviewCount: attemptsList.filter((attempt) => attempt.caseId === record.id).length,
    isDue: isCubedexCaseDue(record.dueAt, now),
    urgency: getCubedexCaseUrgency(record.dueAt, now)
  })

  const chooseF2lCase = (): AlgorithmRecord | undefined => {
    const toggles = practiceTogglesRef.current
    if (!toggles.randomOrder && !toggles.smartReviewScheduling && !toggles.prioritizeSlowCases) {
      return chooseTrainingCase(f2lPoolRef.current, attemptsRef.current)
    }
    const cases = f2lPoolRef.current.map((record) => cubedexCaseFor(record, attemptsRef.current))
    const ordered = toggles.randomOrder ? cubedexShuffleCases(cases) : cubedexBuildQueue(cases, toggles)
    return ordered[0]
  }

  const togglePracticeOption = (toggle: keyof CubedexPracticeToggles) => {
    setPracticeToggles((current) => applyCubedexToggle(current, toggle, !current[toggle]))
  }

  const advanceDrillQueue = (): AlgorithmRecord | undefined => {
    const next = advanceQueueIndex(queueRef.current, () => {
      const chosen = chooseF2lCase()
      return chosen ? [{ record: chosen, solved: false }] : []
    })
    queueRef.current = next
    return next.queue[next.index]?.record
  }

  const recordDrillSolve = async (recognitionMs: number, executionMs: number) => {
    const record = drillCaseRef.current
    if (!record) return
    const entry = queueRef.current.queue[queueRef.current.index]
    if (entry) entry.solved = true
    const wrongMoves = divergenceRef.current
    executionIndexRef.current = 0
    divergenceRef.current = 0
    const totalMs = recognitionMs + executionMs
    const endedAt = performance.now()
    const startedAt = endedAt - totalMs
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: record.id,
      caseVersion: 1,
      algorithmVariantId: record.id,
      family: 'algorithm',
      protocol: 'state-success',
      curriculumMode: 'drill',
      setup: {
        seed: createId().replaceAll('-', ''),
        generatorId: 'f2l-drill-engine',
        generatorVersion: '1',
        caseId: record.id,
        scramble: record.setup,
        constraintHash: record.id
      },
      input: 'smart-cube',
      startedAt,
      endedAt,
      phaseEvents: [{ phase: 'solving', at: startedAt, source: 'cube' }, { phase: 'done', at: endedAt, source: 'cube' }],
      recognitionMs,
      executionMs,
      totalMs,
      outcome: 'success',
      hintEvents: [],
      wrongMoves,
      divergenceCount: wrongMoves,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied: totalMs <= record.targetMs,
      dataQuality: {
        completeMoveStream: true,
        setupVerifiedByState: true,
        packetLossSuspected: false,
        timingUsable: true,
        notes: ['F2L drill engine state predicate (checkF2LState.entireF2LSolved), ported from F2LTrainer']
      },
      schemaVersion: 1
    }
    const updated = updateMastery(record, true, totalMs)
    await repositories.attempts.put(attempt)
    await repositories.algorithms.put(updated)
    setAttempts((current) => [...current, attempt])
    setAlgorithms((current) => current.map((item) => item.id === updated.id ? updated : item))
  }

  const [drillEngine] = useState(() => new DrillEngine<AlgorithmRecord>({
    getNextCase: () => advanceDrillQueue(),
    getFirstUnsolvedCase: () => {
      const index = findActiveEdgeIndex(queueRef.current.queue, (entry) => entry.solved)
      if (index === -1) return advanceDrillQueue()
      queueRef.current = { ...queueRef.current, index }
      return queueRef.current.queue[index]?.record
    },
    onCaseChanged: (nextCase) => {
      executionIndexRef.current = 0
      divergenceRef.current = 0
      setPerformedMoves([])
      setDrillCase(nextCase)
      const manager = createHintManager()
      if (nextCase) manager.initialize(hintModeRef.current, algViewerLoadedRef.current, algViewerContainerRef.current ?? undefined)
      setHintManager(manager)
      setDrillRecognitionMs(undefined)
      setDrillExecutionMs(undefined)
    },
    onPhaseChanged: (phase, countdownNumber) => { setDrillPhase(phase); setDrillCountdown(countdownNumber) },
    onSolveRecorded: (recognitionMs, executionMs) => {
      setDrillRecognitionMs(recognitionMs)
      setDrillExecutionMs(executionMs)
      void recordDrillSolve(recognitionMs, executionMs)
    },
    now: () => performance.now()
  }))

  useEffect(() => cubeLink.subscribe((event) => {
    if (event.type !== 'MOVE') return
    const record = drillCaseRef.current
    const slot = drillSlotRef.current
    const activePuzzle = puzzleRef.current
    if (!record || !slot || !activePuzzle) return
    drillEngine.handleMove(event.move)
    if (drillEngine.phase === 'executing' && isAlgorithmValidationActive(hintModeRef.current) && !isUMove(event.move)) {
      const expected = record.algorithm.split(/\s+/).filter(Boolean)
      if (expected[executionIndexRef.current] !== event.move) divergenceRef.current += 1
      executionIndexRef.current += 1
    }
    setPerformedMoves((moves) => {
      const next = [...moves, event.move]
      const state = checkF2LState(activePuzzle, record.setup, next.join(' '), slot, 'right')
      if (state.entireF2LSolved) void drillEngine.notifySolved()
      return next
    })
  }), [cubeLink, drillEngine])

  const startF2lDrill = () => {
    const first = chooseF2lCase()
    if (!first) return
    queueRef.current = { queue: [{ record: first, solved: false }], index: 0 }
    executionIndexRef.current = 0
    divergenceRef.current = 0
    setPerformedMoves([])
    setDrillCase(first)
    setDrillRecognitionMs(undefined)
    setDrillExecutionMs(undefined)
    const manager = createHintManager()
    manager.initialize(hintModeRef.current, algViewerLoadedRef.current, algViewerContainerRef.current ?? undefined)
    setHintManager(manager)
    void drillEngine.startDrill()
  }

  const stopF2lDrill = () => {
    drillEngine.stop()
    setDrillCase(undefined)
  }

  const giveUpF2lCase = () => {
    if (practiceTogglesRef.current.prioritizeFailedCases && drillCaseRef.current) {
      cubedexInsertCaseWithGap(queueRef.current.queue, { record: drillCaseRef.current, solved: false })
    }
    drillEngine.giveUp()
  }

  const redoF2lCase = () => {
    executionIndexRef.current = 0
    divergenceRef.current = 0
    setPerformedMoves([])
    void drillEngine.redo()
  }

  const changeHintMode = (value: HintMode) => {
    setHintMode(value)
    if (!drillCase) return
    const manager = createHintManager()
    manager.initialize(value, algViewerLoadedRef.current, algViewerContainerRef.current ?? undefined)
    setHintManager(manager)
  }

  const revealDrillHint = () => {
    if (!drillCase) return
    hintManager.revealHint(hintMode, drillCase.algorithm, algViewerLoaded, algViewerContainerRef.current ?? undefined)
    setHintTick((tick) => tick + 1)
  }

  const connectDrillCube = async () => {
    await cubeLink.connect(source ?? bluetoothSource({ requestInitialState: true })).catch(() => undefined)
  }
  const bld = useMemo(() => generateBldDrill(seed, bldConfig.buffer, bldConfig.letterScheme), [bldConfig, seed])
  const colorPrompt = useMemo(() => generateColorInference(`color-${String(colorRound).padStart(3, '0')}`), [colorRound])
  const trackingPrompt = useMemo(() => generateEdgeTrackingPrompt(`tracking-${String(trackingRound).padStart(3, '0')}`), [trackingRound])
  const pairPrompt = useMemo(() => generatePairTrackingPrompt(`pair-${String(pairRound).padStart(3, '0')}`), [pairRound])
  const freePairPrompt = useMemo(() => generateFreePairPrompt(`free-pair-${String(freePairRound).padStart(3, '0')}`, freePairMode), [freePairRound, freePairMode])
  const orientationPrompt = useMemo(() => generateEdgeOrientationPrompt(`orientation-${String(orientationRound).padStart(3, '0')}`), [orientationRound])
  const crossPrompt = useMemo(() => generateCrossInspectionPrompt(`cross-${String(crossRound).padStart(3, '0')}`), [crossRound])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const existing = await repositories.algorithms.all()
        if (cancelled || existing.some((record) => record.id.startsWith('f2l-fr-'))) return
        setCatalogueLoading(true)
        const generated = f2lCatalogueRecords(await buildF2lCases(['FR', 'FL', 'BL', 'BR']))
        if (cancelled) return
        await Promise.all(generated.map((record) => repositories.algorithms.put(record)))
        if (!cancelled) setAlgorithms(orderByCatalogue(await repositories.algorithms.all()))
      } catch {
        if (!cancelled) setStorageError('Could not build the F2L case library')
      } finally {
        if (!cancelled) setCatalogueLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const existing = await repositories.algorithms.all()
        if (cancelled || existing.some((record) => record.id.startsWith('eoll-'))) return
        const generated = eollCases.map((entry) => toAlgorithmRecord(entry))
        await Promise.all(generated.map((record) => repositories.algorithms.put(record)))
        if (!cancelled) setAlgorithms(orderByCatalogue(await repositories.algorithms.all()))
      } catch {
        if (!cancelled) setStorageError('Could not build the 2-Look OLL case library')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const existing = await repositories.algorithms.all()
        if (cancelled || existing.some((record) => record.id.startsWith('coll-'))) return
        const generated = collCases.map((entry) => toAlgorithmRecord(entry))
        await Promise.all(generated.map((record) => repositories.algorithms.put(record)))
        if (!cancelled) setAlgorithms(orderByCatalogue(await repositories.algorithms.all()))
      } catch {
        if (!cancelled) setStorageError('Could not build the COLL case library')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const existing = await repositories.algorithms.all()
        if (cancelled || existing.some((record) => record.id.startsWith('cmll-'))) return
        const generated = cmllCases.map((entry) => toAlgorithmRecord(entry))
        await Promise.all(generated.map((record) => repositories.algorithms.put(record)))
        if (!cancelled) setAlgorithms(orderByCatalogue(await repositories.algorithms.all()))
      } catch {
        if (!cancelled) setStorageError('Could not build the CMLL case library')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isCubedexExtraPill(set)) return
    const category = set
    const prefix = cubedexIdPrefix(category)
    let cancelled = false
    void (async () => {
      try {
        const existing = await repositories.algorithms.all()
        if (cancelled || existing.some((record) => record.id.startsWith(prefix))) return
        setCatalogueLoading(true)
        const generated = cubedexAllCasesForCategory(category).map((entry): AlgorithmRecord => {
          const algorithm = expandNotation(entry.algorithm).replace(/[()]/g, '')
          const setup = new Alg(algorithm).invert().toString()
          const moveCount = algorithm.split(/\s+/).filter(Boolean).length
          return {
            id: cubedexCaseId(category, entry.name),
            set: category,
            name: entry.name,
            algorithm,
            setup,
            targetMs: Math.max(900, moveCount * 220),
            mastery: 0,
            dueAt: Date.now(),
            orientations: [entry.subset]
          }
        })
        await Promise.all(generated.map((record) => repositories.algorithms.put(record)))
        if (!cancelled) setAlgorithms(orderByCatalogue(await repositories.algorithms.all()))
      } catch {
        if (!cancelled) setStorageError(`Could not build the ${category} case library`)
      } finally {
        if (!cancelled) setCatalogueLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [set])

  useEffect(() => {
    void (async () => {
      const existing = await repositories.algorithms.all()
      const { missing, superseded } = planDefaultAlgorithmSync(existing)
      await Promise.all(missing.map(repositories.algorithms.put))
      await Promise.all(superseded.map(repositories.algorithms.remove))

      const stored = orderByCatalogue(await repositories.algorithms.all())
      const savedBldConfig = await repositories.settings.get('bld-config')
      if (savedBldConfig && typeof savedBldConfig.value === 'object' && savedBldConfig.value) {
        const saved = savedBldConfig.value as { buffer?: unknown; letterScheme?: unknown }
        if (typeof saved.buffer === 'string' && typeof saved.letterScheme === 'string') {
          try {
            const letterScheme = normalizeLetterScheme(saved.letterScheme)
            generateBldDrill(seed, saved.buffer, letterScheme)
            const configuration = { buffer: saved.buffer.toUpperCase(), letterScheme }
            setBldConfig(configuration)
            setBldBufferDraft(configuration.buffer)
            setBldSchemeDraft(configuration.letterScheme)
          } catch {}
        }
      }
      setAlgorithms(stored)
      setAttempts(await repositories.attempts.all())
    })().catch((error: unknown) => setStorageError(error instanceof Error ? error.message : 'Unable to open local storage'))
  }, [])

  useEffect(() => {
    setControllerIndex(0)
  }, [current?.id])

  useEffect(() => {
    if (!current) return
    setCriticalActivity(true)
    return () => setCriticalActivity(false)
  }, [current])

  useEffect(() => {
    if (mode !== 'Recognize' || !current) {
      setRecognitionView(undefined)
      setRecognitionError('')
      return
    }
    let cancelled = false
    setRecognitionView(undefined)
    setRecognitionError('')
    void deriveTwoSidedRecognitionView(current.setup)
      .then((view) => { if (!cancelled) setRecognitionView(view) })
      .catch(() => { if (!cancelled) setRecognitionError('Could not derive the visible stickers for this case') })
    return () => { cancelled = true }
  }, [mode, current])

  const ocllAvailable = ocllCases(algorithms.filter((record) => record.set === 'OLL'))
  const twoLookPllAvailable = twoLookPllCases(algorithms.filter((record) => record.set === 'PLL'))
  const twoLookOllAvailable = twoLookOllCases(algorithms.filter((record) => record.set === 'OLL'))
  const available = algorithms.filter((record) => matchesPill(record, set))
  const availableSets: CasePillSet[] = [
    ...(['F2L', 'OLL', 'PLL', 'COLL', 'CMLL'] as const).filter((value) => algorithms.some((record) => record.set === value)),
    ...(ocllAvailable.length ? (['OCLL'] as const) : []),
    ...(twoLookPllAvailable.length ? (['2-Look PLL'] as const) : []),
    ...(twoLookOllAvailable.length ? (['2-Look OLL'] as const) : []),
    // Ported cubedex sets absent from this app's own catalogues (defaultAlgs.ts,
    // CUBEDEX_SETS_NEW_TO_THIS_APP). Their case data is static, so the pills always
    // show; the useEffect above lazily builds and persists a category's records the
    // first time it is selected rather than syncing all 1,235 cases on mount.
    ...CUBEDEX_SETS_NEW_TO_THIS_APP
  ]
  const recognitionEligible = recordSetFor(set) !== 'F2L'

  useEffect(() => {
    if (!recognitionEligible && mode === 'Recognize') setMode('Drill')
  }, [recognitionEligible, mode])

  // training.ts's caseSubset/subsetsFor/filterBySubset switch on record.set and, for
  // 'OLL', parse an 'oll-<n>' id — meaningless for ported cases (all stored with
  // set: 'OLL' as a bucket, see matchesPill above). Grouping for the ported pills is
  // computed here instead, straight from cubedex's own subset field, so it stays
  // cubedex's real subset names (e.g. ZBLL's "AS1", WVLS's "0 Oriented") rather than
  // training.ts's unrelated OLL-shape groups.
  const cubedexSubsetById = useMemo(() => {
    if (!isCubedexExtraPill(set)) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const entry of cubedexAllCasesForCategory(set)) map.set(cubedexCaseId(set, entry.name), entry.subset)
    return map
  }, [set])
  const subsets = isCubedexExtraPill(set)
    ? cubedexSubsetsForCategory(set).map((entry) => entry.subset)
    : subsetsFor(available)
  const bySubset = isCubedexExtraPill(set)
    ? (subset === 'All' ? available : available.filter((record) => cubedexSubsetById.get(record.id) === subset))
    : filterBySubset(available, subset)
  const learningCounts = bySubset.reduce<Record<'unlearned' | 'learning' | 'finished', number>>((counts, record) => {
    counts[learningState(record)] += 1
    return counts
  }, { unlearned: 0, learning: 0, finished: 0 })
  const learningFiltered = filterByLearningState(bySubset, learningFilter)
  const caseAttributesById = useMemo(() => {
    const map = new Map<string, CaseAttributes>()
    if (!puzzle || set !== 'F2L') return map
    for (const record of bySubset) {
      const slot = toDrillSlot(record.orientations[0]) as CaseAttributeSlot | undefined
      if (!slot) continue
      try {
        const pattern = puzzle.defaultPattern().applyAlg(new Alg(record.setup))
        map.set(record.id, classifyCaseAttributes(pattern, slot))
      } catch {
        // Malformed or personal setups without state-derivable attributes are left unmapped.
      }
    }
    return map
  }, [puzzle, set, bySubset])
  const hasAttributeFilter = Object.values(attributeFilter).some(Boolean)
  const visibleCases = hasAttributeFilter
    ? learningFiltered.filter((record) => {
        const attrs = caseAttributesById.get(record.id)
        return attrs ? matchesCaseAttributes(attrs, attributeFilter) : false
      })
    : learningFiltered
  // Search narrows what the grid shows without touching the practice pool, so typing a
  // name to look something up never silently changes what a drill would serve.
  const searchedCases = caseQuery.trim() === ''
    ? visibleCases
    : visibleCases.filter((record) => {
        const needle = caseQuery.trim().toLowerCase()
        return record.name.toLowerCase().includes(needle) || record.algorithm.toLowerCase().includes(needle)
      })
  const reviewStats = caseTrainingStats(visibleCases, attempts)
  const trainingPool = practicePool ?? available

  const begin = () => {
    const next = chooseTrainingCase(trainingPool, attempts)
    setCurrent(next)
    setStartedAt(performance.now())
    setRecognizedAt(0)
    setHintLevel(mode === 'Learn' ? 3 : 0)
    setAnswer('')
  }

  const toggleCaseSelection = (id: string) => {
    setSelectedCaseIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setTimeAttackOrder((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id])
  }

  const moveTimeAttackCase = (id: string, direction: -1 | 1) => {
    setTimeAttackOrder((current) => {
      const index = current.indexOf(id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const setTimeAttackTarget = (id: string, targetMs: number) => {
    setTimeAttackTargets((current) => ({ ...current, [id]: targetMs }))
  }

  const timeAttackConfig = timeAttackOrder
    .map((id) => algorithms.find((record) => record.id === id))
    .filter((record): record is AlgorithmRecord => Boolean(record))

  const startTimeAttack = () => {
    if (!timeAttackConfig.length) return
    setTimeAttackQueue(timeAttackConfig)
    setTimeAttackIndex(0)
    setTimeAttackRunId(createId())
    setTimeAttackStartedAt(performance.now())
  }

  const timeAttackRunAttempts = attempts.filter((attempt) => attempt.family === 'time-attack' && attempt.setup.seed === timeAttackRunId)
  const timeAttackMetCount = timeAttackRunAttempts.filter((attempt) => attempt.targetSatisfied).length

  const finishTimeAttackCase = async (outcome: 'success' | 'give-up') => {
    if (!timeAttackQueue || timeAttackIndex >= timeAttackQueue.length) return
    const record = timeAttackQueue[timeAttackIndex]
    const endedAt = performance.now()
    const totalMs = endedAt - timeAttackStartedAt
    const target = timeAttackTargets[record.id] ?? record.targetMs
    const targetSatisfied = outcome === 'success' && totalMs <= target
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: record.id,
      caseVersion: 1,
      algorithmVariantId: record.id,
      family: 'time-attack',
      protocol: 'algorithm-rehearsal',
      curriculumMode: 'drill',
      setup: {
        seed: timeAttackRunId,
        generatorId: 'time-attack-run',
        generatorVersion: '1',
        caseId: record.id,
        scramble: record.setup,
        constraintHash: `${timeAttackRunId}:${target}`
      },
      input: 'manual-timer',
      startedAt: timeAttackStartedAt,
      endedAt,
      phaseEvents: [{ phase: 'prompt', at: timeAttackStartedAt, source: 'system' }, { phase: 'done', at: endedAt, source: 'user' }],
      executionMs: totalMs,
      totalMs,
      outcome,
      hintEvents: [],
      wrongMoves: 0,
      divergenceCount: 0,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied,
      dataQuality: {
        completeMoveStream: false,
        setupVerifiedByState: false,
        packetLossSuspected: false,
        timingUsable: true,
        notes: [`Time attack target ${target}ms`]
      },
      schemaVersion: 1
    }
    await repositories.attempts.put(attempt)
    setAttempts((current) => [...current, attempt])
    const nextIndex = timeAttackIndex + 1
    setTimeAttackIndex(nextIndex)
    if (nextIndex < timeAttackQueue.length) setTimeAttackStartedAt(performance.now())
  }

  const resetTimeAttack = () => {
    setTimeAttackQueue(undefined)
    setTimeAttackIndex(0)
    setTimeAttackOrder([])
    setSelectedCaseIds(new Set())
  }

  const nextPool = (nextAlgorithms: AlgorithmRecord[]) => {
    if (!practicePool) return nextAlgorithms.filter((record) => matchesPill(record, set))
    const poolIds = new Set(practicePool.map((record) => record.id))
    return nextAlgorithms.filter((record) => poolIds.has(record.id))
  }

  const practiceSelected = () => {
    const pool = visibleCases.filter((record) => selectedCaseIds.has(record.id))
    if (!pool.length) return
    setPracticePool(pool)
    const next = chooseTrainingCase(pool, attempts)
    setCurrent(next)
    setStartedAt(performance.now())
    setRecognizedAt(0)
    setHintLevel(mode === 'Learn' ? 3 : 0)
    setAnswer('')
  }

  const finish = async (success: boolean) => {
    if (!current) return
    const endedAt = performance.now()
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: current.id,
      caseVersion: 1,
      algorithmVariantId: current.id,
      family: 'algorithm',
      protocol: 'typed-answer',
      curriculumMode: mode.toLowerCase() as 'drill' | 'learn' | 'review',
      setup: {
        seed: createId().replaceAll('-', ''),
        generatorId: 'algorithm-inverse',
        generatorVersion: '1',
        caseId: current.id,
        scramble: current.setup,
        constraintHash: current.id
      },
      input: 'keyboard',
      startedAt,
      endedAt,
      phaseEvents: [
        { phase: 'prompt', at: startedAt, source: 'system' },
        { phase: 'grading', at: endedAt, source: 'user' }
      ],
      recognitionMs: recognizedAt ? recognizedAt - startedAt : undefined,
      executionMs: recognizedAt ? endedAt - recognizedAt : endedAt - startedAt,
      totalMs: endedAt - startedAt,
      outcome: success ? 'success' : 'incorrect',
      answer,
      expectedAnswer: current.name,
      answerCorrect: success,
      hintEvents: Array.from({ length: hintLevel }, (_, index) => ({ at: endedAt, level: `level-${index + 1}` })),
      wrongMoves: success ? 0 : 1,
      divergenceCount: success ? 0 : 1,
      correctionMoveCount: 0,
      recognitionBoundaryConfidence: recognizedAt ? 1 : 0.5,
      rawEventIds: [],
      targetSatisfied: success,
      dataQuality: {
        completeMoveStream: false,
        setupVerifiedByState: false,
        packetLossSuspected: false,
        timingUsable: true,
        notes: ['Typed answer validated against the immutable case name']
      },
      schemaVersion: 1
    }
    const updated = updateMastery(current, success, endedAt - startedAt)
    await repositories.attempts.put(attempt)
    await repositories.algorithms.put(updated)
    const nextAttempts = [...attempts, attempt]
    const nextAlgorithms = algorithms.map((record) => record.id === updated.id ? updated : record)
    setAttempts(nextAttempts)
    setAlgorithms(nextAlgorithms)
    setCurrent(chooseTrainingCase(nextPool(nextAlgorithms), nextAttempts))
    setStartedAt(performance.now())
    setRecognizedAt(0)
    setHintLevel(mode === 'Learn' ? 3 : 0)
    setAnswer('')
  }

  const finishRecognition = async (success: boolean) => {
    if (!current) return
    const endedAt = performance.now()
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: current.id,
      caseVersion: 1,
      algorithmVariantId: current.id,
      family: 'recognition',
      protocol: 'typed-answer',
      curriculumMode: 'drill',
      setup: {
        seed: createId().replaceAll('-', ''),
        generatorId: 'two-sided-recognition',
        generatorVersion: '1',
        caseId: current.id,
        scramble: current.setup,
        constraintHash: current.id
      },
      input: 'keyboard',
      startedAt,
      endedAt,
      phaseEvents: [
        { phase: 'prompt', at: startedAt, source: 'system' },
        { phase: 'grading', at: endedAt, source: 'user' }
      ],
      recognitionMs: endedAt - startedAt,
      totalMs: endedAt - startedAt,
      outcome: success ? 'success' : 'incorrect',
      answer,
      expectedAnswer: current.name,
      answerCorrect: success,
      hintEvents: [],
      wrongMoves: success ? 0 : 1,
      divergenceCount: success ? 0 : 1,
      correctionMoveCount: 0,
      recognitionBoundaryConfidence: 1,
      rawEventIds: [],
      targetSatisfied: success,
      dataQuality: {
        completeMoveStream: false,
        setupVerifiedByState: true,
        packetLossSuspected: false,
        timingUsable: true,
        notes: ['Two-sided view derived from the real post-setup cube state; only the front and right last-layer stickers were shown']
      },
      schemaVersion: 1
    }
    const updated = updateMastery(current, success, endedAt - startedAt)
    await repositories.attempts.put(attempt)
    await repositories.algorithms.put(updated)
    const nextAttempts = [...attempts, attempt]
    const nextAlgorithms = algorithms.map((record) => record.id === updated.id ? updated : record)
    setAttempts(nextAttempts)
    setAlgorithms(nextAlgorithms)
    setCurrent(chooseTrainingCase(nextPool(nextAlgorithms), nextAttempts))
    setStartedAt(performance.now())
    setRecognizedAt(0)
    setAnswer('')
  }

  const finishColorInference = async () => {
    const endedAt = performance.now()
    const success = gradeColorInference(colorPrompt, colorAnswer)
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: 'color-inference-corner',
      caseVersion: 1,
      family: 'color-inference',
      protocol: 'typed-answer',
      curriculumMode: 'drill',
      setup: {
        seed: colorPrompt.seed,
        generatorId: 'corner-color-inference',
        generatorVersion: '1',
        caseId: 'color-inference-corner',
        scramble: '',
        constraintHash: [...colorPrompt.visible, colorPrompt.answer].sort().join(':')
      },
      input: 'keyboard',
      startedAt: colorStartedAt,
      endedAt,
      phaseEvents: [{ phase: 'prompt', at: colorStartedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
      totalMs: endedAt - colorStartedAt,
      outcome: success ? 'success' : 'incorrect',
      answer: colorAnswer,
      expectedAnswer: colorPrompt.answer,
      answerCorrect: success,
      hintEvents: [],
      wrongMoves: 0,
      divergenceCount: 0,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied: success,
      dataQuality: {
        completeMoveStream: false,
        setupVerifiedByState: true,
        packetLossSuspected: false,
        timingUsable: true,
        notes: ['Generated legal corner color set']
      },
      schemaVersion: 1
    }
    await repositories.attempts.put(attempt)
    setAttempts((currentAttempts) => [...currentAttempts, attempt])
    setColorResult(success ? 'Correct color.' : `Correct color: ${colorPrompt.answer}.`)
    setColorAnswer('')
    setColorStartedAt(performance.now())
    setColorRound((round) => round + 1)
  }

  const finishEdgeTracking = async () => {
    const endedAt = performance.now()
    const success = gradeEdgeTracking(trackingPrompt, trackingAnswer)
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: `track-edge-${trackingPrompt.target}`,
      caseVersion: 1,
      family: 'tracking',
      protocol: 'tracking-answer',
      curriculumMode: 'drill',
      setup: {
        seed: trackingPrompt.seed,
        generatorId: 'cubie-edge-tracking',
        generatorVersion: '1',
        caseId: `track-edge-${trackingPrompt.target}`,
        scramble: trackingPrompt.moves.join(' '),
        constraintHash: `${trackingPrompt.target}:${trackingPrompt.answer}`
      },
      input: 'keyboard',
      startedAt: trackingStartedAt,
      endedAt,
      phaseEvents: [{ phase: 'prompt', at: trackingStartedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
      totalMs: endedAt - trackingStartedAt,
      outcome: success ? 'success' : 'incorrect',
      answer: trackingAnswer,
      expectedAnswer: trackingPrompt.answer,
      answerCorrect: success,
      hintEvents: [],
      wrongMoves: 0,
      divergenceCount: 0,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied: success,
      dataQuality: {
        completeMoveStream: true,
        setupVerifiedByState: true,
        packetLossSuspected: false,
        timingUsable: true,
        notes: ['Cubie-state-derived edge location']
      },
      schemaVersion: 1
    }
    await repositories.attempts.put(attempt)
    setAttempts((currentAttempts) => [...currentAttempts, attempt])
    setTrackingResult(success ? 'Correct edge location.' : `Correct location: ${trackingPrompt.answer}.`)
    setTrackingAnswer('')
    setTrackingStartedAt(performance.now())
    setTrackingRound((round) => round + 1)
  }

  const finishEdgeOrientation = async () => {
    const endedAt = performance.now()
    const success = gradeEdgeOrientation(orientationPrompt, orientationAnswer)
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: `orient-edge-${orientationPrompt.target}`,
      caseVersion: 1,
      family: 'tracking',
      protocol: 'orientation-answer',
      curriculumMode: 'drill',
      setup: {
        seed: orientationPrompt.seed,
        generatorId: 'cubie-edge-orientation',
        generatorVersion: '1',
        caseId: `orient-edge-${orientationPrompt.target}`,
        scramble: orientationPrompt.moves.join(' '),
        constraintHash: `${orientationPrompt.target}:${orientationPrompt.answer}`
      },
      input: 'keyboard',
      startedAt: orientationStartedAt,
      endedAt,
      phaseEvents: [{ phase: 'prompt', at: orientationStartedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
      totalMs: endedAt - orientationStartedAt,
      outcome: success ? 'success' : 'incorrect',
      answer: orientationAnswer,
      expectedAnswer: orientationPrompt.answer,
      answerCorrect: success,
      hintEvents: [],
      wrongMoves: 0,
      divergenceCount: 0,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied: success,
      dataQuality: {
        completeMoveStream: true,
        setupVerifiedByState: true,
        packetLossSuspected: false,
        timingUsable: true,
        notes: ['Cubie-state-derived edge orientation']
      },
      schemaVersion: 1
    }
    await repositories.attempts.put(attempt)
    setAttempts((currentAttempts) => [...currentAttempts, attempt])
    setOrientationResult(success ? 'Correct edge orientation.' : `Correct orientation: ${orientationPrompt.answer}.`)
    setOrientationAnswer('')
    setOrientationStartedAt(performance.now())
    setOrientationRound((round) => round + 1)
  }

  const finishPairTracking = async () => {
    const endedAt = performance.now()
    const success = gradePairTracking(pairPrompt, pairAnswer)
    const attempt: TrainerAttempt = {
      id: createId(), sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`, caseId: `track-pair-${pairPrompt.target}`, caseVersion: 1,
      family: 'tracking', protocol: 'tracking-answer', curriculumMode: 'drill',
      setup: { seed: pairPrompt.seed, generatorId: 'cubie-pair-tracking', generatorVersion: '1', caseId: `track-pair-${pairPrompt.target}`, scramble: pairPrompt.moves.join(' '), constraintHash: `${pairPrompt.target}:${pairPrompt.answer}` },
      input: 'keyboard', startedAt: pairStartedAt, endedAt,
      phaseEvents: [{ phase: 'prompt', at: pairStartedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
      totalMs: endedAt - pairStartedAt, outcome: success ? 'success' : 'incorrect', answer: pairAnswer, expectedAnswer: pairPrompt.answer, answerCorrect: success,
      hintEvents: [], wrongMoves: 0, divergenceCount: 0, correctionMoveCount: 0, rawEventIds: [], targetSatisfied: success,
      dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: ['Cubie-state-derived F2L pair tracking'] }, schemaVersion: 1
    }
    await repositories.attempts.put(attempt)
    setAttempts((currentAttempts) => [...currentAttempts, attempt])
    setPairResult(success ? 'Correct pair locations.' : `Correct locations: ${pairPrompt.answer}.`)
    setPairAnswer('')
    setPairStartedAt(performance.now())
    setPairRound((round) => round + 1)
  }

  const finishFreePair = async () => {
    if (!freePairPrompt || freePairAnswer === null) return
    const endedAt = performance.now(), success = gradeFreePair(freePairPrompt, freePairAnswer)
    const caseId = `free-pair-${freePairPrompt.caseName.toLowerCase()}-${freePairPrompt.slot.toLowerCase()}`
    const working = freePairPrompt.options.filter((_, index) => gradeFreePair(freePairPrompt, index))
    const attempt: TrainerAttempt = { id: createId(), sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`, caseId, caseVersion: 1, family: 'free-pair', protocol: 'multiple-choice', curriculumMode: 'drill', setup: { seed: freePairPrompt.seed, generatorId: 'solved-no-free-pair', generatorVersion: '2', caseId, scramble: freePairPrompt.setup, constraintHash: freePairPrompt.options.join(':') }, input: 'keyboard', startedAt: freePairStartedAt, endedAt, phaseEvents: [{ phase: 'prompt', at: freePairStartedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }], totalMs: endedAt - freePairStartedAt, outcome: success ? 'success' : 'incorrect', answer: freePairPrompt.options[freePairAnswer], expectedAnswer: working.join(' | '), answerCorrect: success, hintEvents: [], wrongMoves: 0, divergenceCount: 0, correctionMoveCount: 0, rawEventIds: [], targetSatisfied: success, dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: [`solved.no free-pair rule, ${freePairPrompt.mode} mode`] }, schemaVersion: 1 }
    await repositories.attempts.put(attempt)
    setAttempts((items) => [...items, attempt])
    const twoGenOnly = freePairPrompt.mode === '2gen' && !success ? freePairPrompt.normalFinishes[freePairAnswer] : null
    const verdict = success
      ? `Correct. ${freePairPrompt.options[freePairAnswer]} leaves the ${freePairPrompt.slot} pair free: finish with ${freePairPrompt.finishes[freePairAnswer]}.`
      : twoGenOnly
        ? `Wrong. Free in normal mode with ${twoGenOnly}, but 2gen rejects that finish.`
        : `Wrong. The ${freePairPrompt.slot} pair is not free after ${freePairPrompt.options[freePairAnswer]}.`
    setFreePairResult(`${verdict} Working: ${working.join(' · ')}.`)
    setFreePairAnswer(null); setFreePairStartedAt(performance.now()); setFreePairRound((round) => round + 1)
  }

  const switchFreePairMode = () => {
    setFreePairMode((mode) => (mode === 'normal' ? '2gen' : 'normal'))
    setFreePairAnswer(null); setFreePairResult(''); setFreePairStartedAt(performance.now())
  }

  const finishCrossInspection = async () => {
    const endedAt = performance.now()
    const success = await crossPlanSucceeds(crossPrompt.scramble, crossPlan)
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: 'cross-inspection',
      caseVersion: 1,
      family: 'inspection',
      protocol: 'inspection-only',
      curriculumMode: 'drill',
      setup: {
        seed: crossPrompt.seed,
        generatorId: 'cross-inspection-scramble',
        generatorVersion: '1',
        caseId: 'cross-inspection',
        scramble: crossPrompt.scramble,
        constraintHash: 'cross-edges-4-5-6-7'
      },
      input: 'keyboard',
      startedAt: crossStartedAt,
      endedAt,
      phaseEvents: [{ phase: 'prompt', at: crossStartedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
      inspectionMs: endedAt - crossStartedAt,
      totalMs: endedAt - crossStartedAt,
      outcome: success ? 'success' : 'incorrect',
      answer: crossPlan,
      answerCorrect: success,
      hintEvents: [],
      wrongMoves: 0,
      divergenceCount: 0,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied: success,
      dataQuality: {
        completeMoveStream: true,
        setupVerifiedByState: true,
        packetLossSuspected: false,
        timingUsable: true,
        notes: ['State-success cross predicate']
      },
      schemaVersion: 1
    }
    await repositories.attempts.put(attempt)
    setAttempts((currentAttempts) => [...currentAttempts, attempt])
    setCrossResult(success ? 'Cross solved by your plan.' : 'That plan does not solve cross.')
    setCrossPlan('')
    setCrossStartedAt(performance.now())
    setCrossRound((round) => round + 1)
  }

  const finishBldMemo = async (kind: 'edge' | 'corner') => {
    const endedAt = performance.now()
    const isCorner = kind === 'corner'
    const submittedMemo = isCorner ? cornerMemo : memo
    const expectedMemo = isCorner ? bld.cornerMemo : bld.memo
    const success = isCorner ? validateCornerMemo(bld, submittedMemo) : validateMemo(bld, submittedMemo)
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: `bld-${kind}-memo`,
      caseVersion: 1,
      family: 'bld-memo',
      protocol: 'memo-recall',
      curriculumMode: 'drill',
      setup: {
        seed: bld.seed,
        generatorId: `cubie-${kind}-cycle`,
        generatorVersion: '1',
        caseId: `bld-${kind}-memo`,
        scramble: bld.scramble,
        constraintHash: `${bld.buffer}:${bld.letterScheme}`
      },
      input: 'keyboard',
      startedAt: bldStartedAt,
      endedAt,
      phaseEvents: [{ phase: 'prompt', at: bldStartedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
      totalMs: endedAt - bldStartedAt,
      outcome: success ? 'success' : 'incorrect',
      answer: submittedMemo,
      expectedAnswer: expectedMemo,
      answerCorrect: success,
      hintEvents: [],
      wrongMoves: 0,
      divergenceCount: 0,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied: success,
      dataQuality: {
        completeMoveStream: true,
        setupVerifiedByState: true,
        packetLossSuspected: false,
        timingUsable: true,
        notes: [`Cubie-state-derived ${kind} memo`]
      },
      schemaVersion: 1
    }
    await repositories.attempts.put(attempt)
    setAttempts((currentAttempts) => [...currentAttempts, attempt])
    if (isCorner) {
      setCornerMemoResult(success ? 'Correct corner memo' : `Expected ${expectedMemo}`)
      setCornerMemo('')
    } else {
      setMemoResult(success ? 'Correct edge memo' : `Expected ${expectedMemo}`)
      setMemo('')
    }
    setBldStartedAt(performance.now())
  }

  const finishBldOrientation = async (kind: 'flip' | 'twist') => {
    const endedAt = performance.now()
    const answer = kind === 'flip' ? bldFlipAnswer : bldTwistAnswer
    const expected = kind === 'flip' ? bld.flippedEdges : bld.twistedCorners
    const success = Number(answer) === expected
    const attempt: TrainerAttempt = {
      id: createId(), sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`, caseId: `bld-${kind}-count`, caseVersion: 1,
      family: 'bld-memo', protocol: 'typed-answer', curriculumMode: 'drill',
      setup: { seed: bld.seed, generatorId: `cubie-${kind}-count`, generatorVersion: '1', caseId: `bld-${kind}-count`, scramble: bld.scramble, constraintHash: String(expected) },
      input: 'keyboard', startedAt: bldStartedAt, endedAt,
      phaseEvents: [{ phase: 'prompt', at: bldStartedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
      totalMs: endedAt - bldStartedAt, outcome: success ? 'success' : 'incorrect', answer, expectedAnswer: String(expected), answerCorrect: success,
      hintEvents: [], wrongMoves: 0, divergenceCount: 0, correctionMoveCount: 0, rawEventIds: [], targetSatisfied: success,
      dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: [`Cubie-state-derived ${kind} count`] }, schemaVersion: 1
    }
    await repositories.attempts.put(attempt)
    setAttempts((currentAttempts) => [...currentAttempts, attempt])
    setBldOrientationResult(success ? `Correct ${kind} count.` : `Expected ${expected}.`)
    if (kind === 'flip') setBldFlipAnswer('')
    else setBldTwistAnswer('')
    setBldStartedAt(performance.now())
  }

  const finishRemoteController = async (snapshot: RemoteControllerSnapshot) => {
    if (!current) return
    const attempt = createRemoteControllerAttempt(current, snapshot)
    const updated = updateMastery(current, true, attempt.totalMs)
    await repositories.attempts.put(attempt)
    await repositories.algorithms.put(updated)
    const nextAttempts = [...attempts, attempt]
    const nextAlgorithms = algorithms.map((record) => record.id === updated.id ? updated : record)
    setAttempts(nextAttempts)
    setAlgorithms(nextAlgorithms)
    setCurrent(chooseTrainingCase(nextPool(nextAlgorithms), nextAttempts))
    setStartedAt(performance.now())
    setRecognizedAt(0)
    setHintLevel(mode === 'Learn' ? 3 : 0)
    setAnswer('')
    setControllerIndex(0)
  }

  const applyBldConfiguration = async () => {
    try {
      const letterScheme = normalizeLetterScheme(bldSchemeDraft)
      const buffer = bldBufferDraft.trim().toUpperCase()
      generateBldDrill(seed, buffer, letterScheme)
      const configuration = { buffer, letterScheme }
      await repositories.settings.put({ key: 'bld-config', value: configuration })
      setBldConfig(configuration)
      setBldBufferDraft(buffer)
      setBldSchemeDraft(letterScheme)
      setBldConfigError('')
    } catch (error) {
      setBldConfigError(error instanceof Error ? error.message : 'Invalid BLD configuration')
    }
  }

  const setAllLearningStates = async (state: 'unlearned' | 'learning' | 'finished') => {
    const updated = available.map((record) => setLearningState(record, state))
    await Promise.all(updated.map(repositories.algorithms.put))
    setAlgorithms((currentAlgorithms) => currentAlgorithms.map((record) => updated.find((next) => next.id === record.id) ?? record))
  }

  const addPersonalCase = async () => {
    const validation = validateCubedexNewAlgDraft({ category: newCaseCategory, subset: newCaseSubset, name: newCaseName, algorithm: newCaseAlgorithm })
    if (!validation.ok) {
      setNewCaseMessage(validation.error)
      return
    }
    try {
      const record = createAlgorithmRecord({
        set: newCaseCategory === 'Custom' ? recordSetFor(set) : newCaseCategory,
        name: newCaseName,
        algorithm: validation.expandedAlgorithm,
        setup: newCaseSetup,
        targetMs: newCaseTargetMs,
        orientations: []
      })
      await repositories.algorithms.put(record)
      setAlgorithms((currentAlgorithms) => [...currentAlgorithms, record])
      setNewCaseSubset('')
      setNewCaseName('')
      setNewCaseAlgorithm('')
      setNewCaseSetup('')
      setNewCaseMessage('Personal case added.')
    } catch (error) {
      setNewCaseMessage(error instanceof Error ? error.message : 'Case could not be added')
    }
  }

  if (detailCase) {
    return (
      <CaseMastery
        record={detailCase}
        attempts={attempts}
        onBack={() => setDetailCase(undefined)}
        onPractice={() => { setCurrent(detailCase); setDetailCase(undefined) }}
      />
    )
  }

  return (
    // The shell gives each route a fixed-height flex cell and never scrolls itself, so a
    // route that overflows must own its own scrolling. Without this the Practice page
    // simply cut off below the fold.
    <section className={`surface-stack ${css({ flex: '1', minH: '0', overflowY: 'auto' })}`}>
      <article className="panel trainer-panel">
        <div className="surface-heading">
          <div><h2>Practice</h2></div>
          <button className="button primary" disabled={!available.length} onClick={begin}>{current ? 'Next case' : 'Start session'}</button>
          {storageError && <p className="trainer-note trainer-note-error">Local storage is unavailable: {storageError}. Cases cannot load and attempts will not be saved.</p>}
          {catalogueLoading && <p className="trainer-note">Building the full F2L case library in the background…</p>}
        </div>
        <TrainerToolbar
          sets={availableSets as unknown as string[]}
          set={set}
          // Time attack is staged from the selection, so the staged queue clears with
          // it — leaving it behind let a user who had visibly deselected everything
          // still start a run on cases from the set they left. A run already in
          // progress is not staged any more, and its per-case targets are still being
          // read as each case finishes, so clearing mid-run would silently revert the
          // user's chosen targets to defaults.
          onSet={(value) => { setSet(value as typeof set); setSubset('All'); setLearningFilter('All'); setAttributeFilter({}); setSelectedCaseIds(new Set()); if (!timeAttackQueue) { setTimeAttackOrder([]); setTimeAttackTargets({}) } setPracticePool(undefined); setCurrent(undefined) }}
          subsets={subsets as unknown as string[]}
          subset={subset}
          onSubset={(value) => { setSubset(value as typeof subset); setAttributeFilter({}); setSelectedCaseIds(new Set()) }}
          learning={learningFilter}
          learningCounts={{ all: bySubset.length, unlearned: learningCounts.unlearned, learning: learningCounts.learning, finished: learningCounts.finished }}
          onLearning={(value) => setLearningFilter(value as typeof learningFilter)}
          modes={recognitionEligible ? ['Learn', 'Drill', 'Review', 'Recognize'] : ['Learn', 'Drill', 'Review']}
          mode={mode}
          onMode={(value) => setMode(value as typeof mode)}
        />
        {current && mode === 'Recognize' ? (
          <div className="trainer-workspace">
            <div className="current-case-card two-sided-recognition">
              <span>{current.set} · two-sided recognition</span>
              <h3>What case is this?</h3>
              <p>Only the front and right last-layer faces are shown — exactly what you would see before turning the last layer.</p>
              {recognitionView ? (
                <div className="two-sided-faces">
                  <div><span>Front</span><strong>{recognitionView.front.join(' ')}</strong></div>
                  <div><span>Right</span><strong>{recognitionView.right.join(' ')}</strong></div>
                </div>
              ) : <p className="empty-state">{recognitionError || 'Deriving the visible stickers…'}</p>}
              <label>Case answer<input aria-label="Recognition answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type the exact case name" /></label>
              <div>
                <button onClick={() => void finishRecognition(false)}>Redo</button>
                <button disabled={!answer.trim()} onClick={() => void finishRecognition(answer.trim().toLowerCase() === current.name.toLowerCase())}>Submit recognition</button>
              </div>
            </div>
          </div>
        ) : current ? (
          <div className="trainer-workspace">
            {/* The recognition phase had no heading: a screen reader landing here was told
                nothing about what it was being asked to do. The execution phase already has
                its own visible heading, so this only covers the phase that lacked one. */}
            {!recognizedAt && <h2 className={css({ srOnly: true })}>Recognize the case</h2>}
            <ActiveDrill
              caseName={mode === 'Drill' && hintLevel === 0 && !recognizedAt ? `${current.set} case` : current.name}
              set={current.set}
              setup={current.setup}
              startedAt={startedAt}
              recognizedAtMs={recognizedAt || undefined}
              hint={hintLevel > 0 ? progressiveHint(current, hintLevel) : undefined}
              onHint={() => setHintLevel((level) => Math.min(3, level + 1))}
            />
            {/* Rebuilt off the legacy sheet: the old .current-case-card rendered its
                controls as an unspaced run of text once its rules were deleted. */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '4', maxW: '480px', mx: 'auto', w: 'full' })}>
              <input
                aria-label="Case answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type the exact case name"
                className={css({
                  w: 'full', minH: '48px', px: '4', borderRadius: 'control',
                  bg: 'container', color: 'ink', borderWidth: '1px', borderColor: 'floating',
                  fontFamily: 'mono', fontSize: 'sm',
                  _focus: { outline: 'none', borderColor: 'green' }
                })}
              />
              <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '3' })}>
                <button
                  type="button"
                  onClick={() => setRecognizedAt(performance.now())}
                  disabled={Boolean(recognizedAt)}
                  className={css({
                    flex: '1', minH: '48px', px: '5', borderRadius: 'control',
                    bg: 'green', color: 'onGreen', cursor: 'pointer',
                    fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    _disabled: { bg: 'floating', color: 'inkVariant', cursor: 'default' }
                  })}
                >Recognized</button>
                <button
                  type="button"
                  onClick={() => void finish(false)}
                  className={css({
                    minH: '48px', px: '5', borderRadius: 'control',
                    bg: 'transparent', color: 'ink', borderWidth: '1px', borderColor: 'floating',
                    cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    _hover: { bg: 'floating' }
                  })}
                >Redo</button>
                <button
                  type="button"
                  disabled={!answer.trim()}
                  onClick={() => void finish(answer.trim().toLowerCase() === current.name.toLowerCase())}
                  className={css({
                    flex: '1', minH: '48px', px: '5', borderRadius: 'control',
                    bg: 'transparent', color: 'ink', borderWidth: '1px', borderColor: 'outline',
                    cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    _hover: { bg: 'floating' },
                    _disabled: { borderColor: 'floating', color: 'inkVariant', cursor: 'default' }
                  })}
                >Submit answer</button>
              </div>
              <p className={css({ fontSize: 'xs', color: 'inkVariant', textAlign: 'center' })}>
                {recognizedAt
                  ? `Execution timed from ${((recognizedAt - startedAt) / 1000).toFixed(2)}s`
                  : 'Press Recognized the moment you know the case'}
              </p>
            </div>
            <RemoteTrainerController connect={controllerConnect} targetMoves={current.algorithm.split(/\s+/)} onComplete={finishRemoteController} onProgress={(next) => setControllerIndex(next.targetIndex)} />
            <CubePlayback speed={playbackSpeed} controller={mode === 'Drill' && hintLevel === 0 && !recognizedAt} key={current.id} title={mode === 'Drill' && hintLevel === 0 && !recognizedAt ? 'Controller playback' : `${current.name} execution`} scramble={current.setup} moves={current.algorithm.split(/\s+/)} playbackIndex={controllerIndex} stages={[{ label: current.name, alg: current.algorithm, moves: current.algorithm.split(/\s+/) }]} />
          </div>
        ) : <p className="empty-state">Choose a set and start. Recognition and execution are timed separately; failed cases enter the redo queue.</p>}
        {/* The library is hidden while a case is being practised: in Recognize mode the
            grid renders the very case you are being asked to identify, and in every mode a
            1235-card grid under the drill is noise. */}
        {!current && <>
        {/* Sticky search bar over the grid, per training_case_library. With 1235 cases a
            filter chip alone can't get you to a named case. */}
        <div>
        {/* Sticky is scoped to the library block below; without a bounding wrapper it
            stayed pinned past the grid and floated over the panels further down. */}
        <div className={css({
          position: 'sticky', top: '0', zIndex: '1', py: '2',
          bg: 'surface', display: 'flex', justifyContent: 'flex-end'
        })}>
          <input
            type="search"
            aria-label="Search cases"
            value={caseQuery}
            onChange={(event) => setCaseQuery(event.target.value)}
            placeholder={`Search ${visibleCases.length} cases…`}
            className={css({
              w: 'full', xl: { w: '320px' },
              bg: 'container', color: 'ink',
              borderWidth: '1px', borderColor: 'floating', borderRadius: 'pill',
              px: '4', py: '3', fontSize: 'sm',
              _focus: { outline: 'none', borderColor: 'green' }
            })}
          />
        </div>
        {/* case-grid is the stable hook the case-grid tests select on; the redesign changed
            the styling, not what this region is. */}
        <div className={`case-grid ${css({
          display: 'grid', gap: 'gutter', mt: '2',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          sm: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
          lg: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
          xl: { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }
        })}`}>
          {searchedCases.map((record) => {
            const stat = caseStats(attempts, record.id)
            const averages = caseAverages(attempts, record.id)
            const badge = learningBadgeClass(record)
            const selected = selectedCaseIds.has(record.id)
            return (
              <CaseCard
                key={record.id}
                name={record.name}
                badge={record.set}
                setup={record.setup}
                alg={record.algorithm}
                mastery={record.mastery}
                selected={selected}
                stats={stat.practiceCount > 0 ? [
                  { label: 'Best', value: stat.bestTime === undefined ? '—' : `${(stat.bestTime / 1000).toFixed(2)}s` },
                  { label: 'Tries', value: `${stat.practiceCount}` },
                  { label: 'Success', value: `${Math.round(((stat.practiceCount - stat.failedCount) / stat.practiceCount) * 100)}%` },
                  { label: 'ao5', value: averages.ao5 === undefined ? '—' : `${(averages.ao5 / 1000).toFixed(2)}s` }
                ] : undefined}
                onSelect={() => toggleCaseSelection(record.id)}
                onOpen={() => setDetailCase(record)}
              />
            )
          })}
        </div>
        </div>
        {set === 'F2L' && (
          <button
            type="button"
            onClick={() => setShapeFilterOpen(true)}
            className={css({
              alignSelf: 'flex-start', minH: '48px', px: '6', borderRadius: 'control',
              bg: 'container', color: 'ink', borderWidth: '1px', borderColor: 'outline',
              cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              _hover: { bg: 'floating' }
            })}
          >Shape filter{activeAttributeCount > 0 ? ` · ${activeAttributeCount}` : ''}</button>
        )}

        {shapeFilterOpen && (
          <ShapeFilterDialog
            filter={attributeFilter}
            subset={subset}
            matchCount={visibleCases.length}
            onChange={setAttributeFilter}
            onSubset={(next) => setSubset(next as typeof subset)}
            onReset={() => { setAttributeFilter({}); setSubset('All' as typeof subset) }}
            onClose={() => setShapeFilterOpen(false)}
          />
        )}
        </>}
        <details className="f2l-drill-panel">
          <summary>Real-cube F2L drill (state-verified)</summary>
          <p>Solves this F2L pair on your connected smart cube. Completion is detected from the cube&apos;s actual state (checkF2LState), never from move identity.</p>
          <div className="pill-row" role="tablist" aria-label="Practice options">
            {(['smartReviewScheduling', 'randomOrder', 'prioritizeSlowCases', 'prioritizeFailedCases'] as const).map((toggle) => (
              <button
                type="button"
                key={toggle}
                className={`pill ${practiceToggles[toggle] ? 'active' : ''}`}
                title={CUBEDEX_ALL_OPTIONS.find((option) => option.name === toggle)?.effect}
                onClick={() => togglePracticeOption(toggle)}
              >
                {{ smartReviewScheduling: 'Smart Order', randomOrder: 'Random Order', prioritizeSlowCases: 'Slow First', prioritizeFailedCases: 'Prioritize Failed' }[toggle]}
              </button>
            ))}
          </div>
          {!cubeLink.handle && <button className="button secondary" onClick={() => void connectDrillCube()}>Connect cube for drill</button>}
          {cubeLink.handle && <p>{cubeLink.handle.name} · {cubeLink.handle.protocol}</p>}
          {!drillCase ? (
            <button className="button primary" disabled={!f2lAlgorithms.length} onClick={startF2lDrill}>Start real-cube drill</button>
          ) : (
            <div className="current-case-card f2l-drill-card">
              <span>{drillCase.set} · {drillPhase}</span>
              <h3>{drillCase.name}</h3>
              {drillPhase === 'countdown' && <p className="drill-countdown">{drillCountdown}</p>}
              {drillPhase === 'solving' && <p>Recognize…</p>}
              {drillPhase === 'executing' && <p>Executing…</p>}
              {drillPhase === 'transitioning' && <p>Case solved. Next case…</p>}
              {drillPhase === 'gave_up' && <p>Gave up. Redo or resume when ready.</p>}
              <div className="pill-row" role="tablist" aria-label="Hint mode">
                {(['hidden', 'step', 'allAtOnce', 'always'] as const).map((value) => (
                  <button type="button" key={value} className={`pill ${hintMode === value ? 'active' : ''}`} onClick={() => changeHintMode(value)}>{value}</button>
                ))}
              </div>
              <div ref={algViewerContainerRef} className="drill-alg-viewer">
                {hintManager.shouldShowPlaceholder(hintMode) ? 'Hint hidden' : hintManager.getDisplayedAlgorithm(hintMode, drillCase.algorithm) || 'No hint revealed yet'}
              </div>
              {hintManager.showHintButton && <button onClick={revealDrillHint}>Reveal hint</button>}
              <div>
                <button onClick={giveUpF2lCase}>Give up (drill)</button>
                <button disabled={drillPhase !== 'gave_up'} onClick={redoF2lCase}>Redo case</button>
                <button disabled={drillPhase !== 'gave_up'} onClick={() => void drillEngine.resume(false)}>Resume drill</button>
                <button onClick={() => void drillEngine.skip()}>Skip case</button>
                <button onClick={stopF2lDrill}>Stop drill</button>
              </div>
              {drillRecognitionMs !== undefined && <small>Recognition {drillRecognitionMs.toFixed(0)}ms · Execution {(drillExecutionMs ?? 0).toFixed(0)}ms</small>}
              <CubePlayback
                title={`${drillCase.name} drill`}
                scramble={drillCase.setup}
                moves={performedMoves}
                playbackIndex={performedMoves.length}
                stages={[{ label: drillCase.name, alg: drillCase.algorithm, moves: drillCase.algorithm.split(/\s+/) }]}
              />
            </div>
          )}
        </details>
        <details className="trainer-manage">
          <summary>Manage {set} cases</summary>
        <div className="trainer-tabs">
          <button disabled={!available.length} onClick={() => void setAllLearningStates('unlearned')}>Mark all unlearned</button>
          <button disabled={!available.length} onClick={() => void setAllLearningStates('learning')}>Mark all learning</button>
          <button disabled={!available.length} onClick={() => void setAllLearningStates('finished')}>Mark all finished</button>
        </div>
        <div className="trainer-authoring">
          <div className="pill-row" role="tablist" aria-label="New case category">
            {CUBEDEX_QUICK_CATEGORIES.map((value) => <button type="button" key={value} aria-label={`Category ${value}`} className={`pill ${newCaseCategory === value ? 'active' : ''}`} onClick={() => setNewCaseCategory(value)}>{value}</button>)}
          </div>
          <label>Subset<input aria-label="New case subset" value={newCaseSubset} onChange={(event) => setNewCaseSubset(event.target.value)} /></label>
          <label>New case name<input aria-label="New case name" value={newCaseName} onChange={(event) => setNewCaseName(event.target.value)} /></label>
          <label>New case algorithm<input aria-label="New case algorithm" value={newCaseAlgorithm} onChange={(event) => setNewCaseAlgorithm(event.target.value)} /></label>
          {newCaseAlgorithm.trim() && (
            <div className="pill-row" aria-label="Move preview">
              {cubedexPreviewMoves(newCaseAlgorithm).map((move, index) => <span className="pill" key={`${move}-${index}`}>{move}</span>)}
              <span>{cubedexPreviewMoves(newCaseAlgorithm).length} moves</span>
            </div>
          )}
          <label>Setup<input aria-label="New case setup" value={newCaseSetup} onChange={(event) => setNewCaseSetup(event.target.value)} /></label>
          <label>Target ms<input aria-label="New case target milliseconds" min="1" type="number" value={newCaseTargetMs} onChange={(event) => setNewCaseTargetMs(Number(event.target.value))} /></label>
          <button disabled={!newCaseName.trim() || !newCaseAlgorithm.trim() || !newCaseSubset.trim()} onClick={() => void addPersonalCase()}>Add personal case</button>
          {newCaseMessage && <span>{newCaseMessage}</span>}
        </div>
        </details>
        <button className="button primary" disabled={!selectedCaseIds.size} onClick={practiceSelected}>{selectedCaseIds.size ? `Practice selected (${selectedCaseIds.size})` : 'Practice selected'}</button>
        {!selectedCaseIds.size && <p className="empty-state">Select one or more cases above to practice only those.</p>}
        <details className="time-attack-panel">
          <summary>Time attack</summary>
          {!timeAttackQueue && (
            <TimeAttackGauntlet
              queue={timeAttackConfig}
              targets={timeAttackTargets}
              failedAttempts={attempts.filter((attempt) => attempt.family === 'time-attack' && !attempt.targetSatisfied).slice(-5)}
              onStart={startTimeAttack}
              onMove={(id, direction) => moveTimeAttackCase(id, direction)}
              onTarget={setTimeAttackTarget}
            />
          )}
          {timeAttackQueue && timeAttackIndex < timeAttackQueue.length && (
            <div className="current-case-card">
              <span>Case {timeAttackIndex + 1} / {timeAttackQueue.length}</span>
              <h3>{timeAttackQueue[timeAttackIndex].name}</h3>
              <p>{timeAttackQueue[timeAttackIndex].algorithm}</p>
              <p>Target: {((timeAttackTargets[timeAttackQueue[timeAttackIndex].id] ?? timeAttackQueue[timeAttackIndex].targetMs) / 1000).toFixed(2)}s</p>
              <div>
                <button onClick={() => void finishTimeAttackCase('give-up')}>Give up</button>
                <button onClick={() => void finishTimeAttackCase('success')}>Done</button>
              </div>
            </div>
          )}
          {timeAttackQueue && timeAttackIndex >= timeAttackQueue.length && (
            <div className="time-attack-summary">
              <p>Time attack complete: {timeAttackMetCount} / {timeAttackRunAttempts.length} cases met target.</p>
              <button className="button secondary" onClick={resetTimeAttack}>New time attack</button>
            </div>
          )}
        </details>
        {mode === 'Review' && <section className="case-review">
          <h3>Case statistics</h3>
          {reviewStats.some((stat) => stat.attempts) ? <div className="case-library">{visibleCases.map((record, index) => {
            const stat = reviewStats[index]
            return <div key={record.id}><strong>{record.name}</strong><span>{stat.attempts} attempts · {Math.round(stat.successRate * 100)}% success · {stat.bestMs === undefined ? 'No timed result' : `best ${(stat.bestMs / 1000).toFixed(2)}s`} · {stat.recentAverageMs === undefined ? 'No recent average' : `recent ${(stat.recentAverageMs / 1000).toFixed(2)}s`}</span></div>
          })}</div> : <p className="empty-state">No attempts yet.</p>}
        </section>}
      </article>

      <article className="panel trainer-panel">
        <div className="surface-heading"><div><span className="eyebrow green">EDGE ORIENTATION</span><h2>Is this edge flipped?</h2></div></div>
        <p>Is the {orientationPrompt.target} edge oriented or flipped after: {orientationPrompt.moves.join(' ')}?</p>
        <label>Edge orientation<input aria-label="Edge orientation" value={orientationAnswer} onChange={(event) => setOrientationAnswer(event.target.value)} placeholder="oriented or flipped" /></label>
        <button className="button secondary" disabled={!orientationAnswer.trim()} onClick={() => void finishEdgeOrientation()}>Check edge orientation</button>
        {orientationResult && <p>{orientationResult}</p>}
      </article>

      <article className="panel trainer-panel">
        <div className="surface-heading"><div><span className="eyebrow green">HIDDEN COLOURS</span><h2>Work out the colour you cannot see.</h2></div></div>
        <p>Visible colors: {colorPrompt.visible.join(' · ')}</p>
        <label>Missing color<input aria-label="Missing color" value={colorAnswer} onChange={(event) => setColorAnswer(event.target.value)} placeholder="Type the missing color" /></label>
        <button className="button secondary" disabled={!colorAnswer.trim()} onClick={() => void finishColorInference()}>Check missing color</button>
        {colorResult && <p>{colorResult}</p>}
      </article>

      <article className="panel trainer-panel">
        <div className="surface-heading"><div><span className="eyebrow green">PIECE TRACKING</span><h2>Follow one edge through the turns.</h2></div></div>
        <p>Track the {trackingPrompt.target} edge through: {trackingPrompt.moves.join(' ')}</p>
        <label>Tracked edge location<input aria-label="Tracked edge location" value={trackingAnswer} onChange={(event) => setTrackingAnswer(event.target.value)} placeholder="UR, UF, UL…" /></label>
        <button className="button secondary" disabled={!trackingAnswer.trim()} onClick={() => void finishEdgeTracking()}>Check tracked edge</button>
        {trackingResult && <p>{trackingResult}</p>}
      </article>

      <article className="panel trainer-panel" id="pair-tracking">
        <div className="surface-heading"><div><span className="eyebrow green">PAIR TRACKING</span><h2>Follow an F2L pair through the turns.</h2></div></div>
        <p>Track {pairPrompt.target} through: {pairPrompt.moves.join(' ')}</p>
        <label>Tracked pair locations<input aria-label="Tracked pair locations" value={pairAnswer} onChange={(event) => setPairAnswer(event.target.value)} placeholder="URF FR" /></label>
        <button className="button secondary" disabled={!pairAnswer.trim()} onClick={() => void finishPairTracking()}>Check tracked pair</button>
        {pairResult && <p>{pairResult}</p>}
      </article>

      <article className="panel trainer-panel">
        <div className="surface-heading"><div><span className="eyebrow green">FREE PAIR</span><h2>Solve front right and leave another pair free.</h2></div></div>
        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
          <Button size="sm" variant={freePairMode === '2gen' ? 'solid' : 'outline'} aria-pressed={freePairMode === '2gen'} onClick={switchFreePairMode}>2gen mode</Button>
          <Button size="sm" variant={freePairCube ? 'solid' : 'outline'} aria-pressed={freePairCube} onClick={() => setFreePairCube((shown) => !shown)}>Show cube</Button>
          <Button size="sm" variant="ghost" onClick={() => { setFreePairAnswer(null); setFreePairStartedAt(performance.now()); setFreePairRound((round) => round + 1) }}>New position</Button>
        </div>
        {freePairPrompt ? (
          <>
            <p>{freePairPrompt.caseName}. Setup: {freePairPrompt.setup}</p>
            {freePairCube && <CubePlayback key={`${freePairPrompt.seed}-${freePairPrompt.mode}`} live title="Free pair position" scramble={freePairPrompt.setup} setupAlg={`z2 ${freePairPrompt.setup}`} moves={[]} stages={[]} />}
            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
              {freePairPrompt.options.map((option, index) => (
                <Button key={`${index}-${option}`} size="sm" variant={freePairAnswer === index ? 'solid' : 'outline'} aria-pressed={freePairAnswer === index} onClick={() => setFreePairAnswer(index)}>{index + 1} · {option}</Button>
              ))}
            </div>
            <div className={css({ display: 'flex', mt: '2' })}>
              <Button variant="outline" disabled={freePairAnswer === null} onClick={() => void finishFreePair()}>Check free pair</Button>
            </div>
          </>
        ) : <p>No position found for this seed. Pick a new position.</p>}
        {freePairResult && <p>{freePairResult}</p>}
      </article>

      <article className="panel trainer-panel">
        <div className="surface-heading"><div><span className="eyebrow green">INSPECTION</span><h2>Plan the cross before you start.</h2></div></div>
        <p>Scramble: {crossPrompt.scramble}</p>
        <label>Cross plan<input aria-label="Cross plan" value={crossPlan} onChange={(event) => setCrossPlan(event.target.value)} placeholder="Enter any cross-solving sequence" /></label>
        <button className="button secondary" disabled={!crossPlan.trim()} onClick={() => void finishCrossInspection()}>Check cross plan</button>
        {crossResult && <p>{crossResult}</p>}
      </article>

      <article className="panel bld-panel">
        <div className="surface-heading"><div><span className="eyebrow green">BLINDFOLD</span><h2>Memorise and recall.</h2></div></div>
        <label>Seed<input value={seed} onChange={(event) => { setSeed(event.target.value); setBldStartedAt(performance.now()) }} /></label>
        <label>BLD buffer<input aria-label="BLD buffer" value={bldBufferDraft} onChange={(event) => setBldBufferDraft(event.target.value)} /></label>
        <label>BLD letter scheme<input aria-label="BLD letter scheme" value={bldSchemeDraft} onChange={(event) => setBldSchemeDraft(event.target.value)} /></label>
        <button className="button secondary" onClick={() => void applyBldConfiguration()}>Apply BLD configuration</button>
        {bldConfigError && <p className="import-error" role="alert">{bldConfigError}</p>}
        <div className="bld-grid">
          <div><span>Buffer</span><strong>{bld.buffer}</strong></div>
          <div><span>Edge cycles</span><strong>{bld.cycles.map((cycle) => cycle.join(' ')).join(' / ')}</strong></div>
          <div><span>Corner cycles</span><strong>{bld.cornerCycles.map((cycle) => cycle.join(' ')).join(' / ')}</strong></div>
          <div><span>Parity</span><strong>{bld.parity ? 'YES' : 'NO'}</strong></div>
        </div>
        <p>State scramble: {bld.scramble}</p>
        <label>Memo<input aria-label="Memo" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Enter edge letter pairs" /></label>
        <button className="button secondary" onClick={() => void finishBldMemo('edge')}>Validate memo</button>
        {memoResult && <p>{memoResult}</p>}
        <label>Corner memo<input aria-label="Corner memo" value={cornerMemo} onChange={(event) => setCornerMemo(event.target.value)} placeholder="Enter corner letter pairs" /></label>
        <button className="button secondary" onClick={() => void finishBldMemo('corner')}>Validate corner memo</button>
        {cornerMemoResult && <p>{cornerMemoResult}</p>}
        <label>Flipped edges<input aria-label="Flipped edges" value={bldFlipAnswer} onChange={(event) => setBldFlipAnswer(event.target.value)} inputMode="numeric" placeholder="Count" /></label>
        <button className="button secondary" disabled={!bldFlipAnswer.trim()} onClick={() => void finishBldOrientation('flip')}>Check flipped edges</button>
        <label>Twisted corners<input aria-label="Twisted corners" value={bldTwistAnswer} onChange={(event) => setBldTwistAnswer(event.target.value)} inputMode="numeric" placeholder="Count" /></label>
        <button className="button secondary" disabled={!bldTwistAnswer.trim()} onClick={() => void finishBldOrientation('twist')}>Check twisted corners</button>
        {bldOrientationResult && <p>{bldOrientationResult}</p>}
      </article>
    </section>
  )
}
