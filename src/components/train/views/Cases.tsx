import { useMemo, useState } from 'react'
import { css, cx } from 'styled-system/css'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import type { LearningStateFilter } from '../../../domain/training'
import { cubedexCaseCount } from '../../../domain/cubedex/defaultAlgs'
import { useCubeConnection } from '../../../device/CubeConnection'
import { bluetoothSource } from '../../../device/sources'
import { CASE_SETS, LEARNING_FILTERS, filterSetSubset, isCubedexExtraSet, learningCounts, matchesSet, narrowCases, recordSetFor, subsetsForSet, type CaseSet } from '../cases/catalogue'
import { CaseGrid } from '../cases/CaseGrid'
import { CaseSession, type SessionMode } from '../cases/CaseSession'
import { useCaseLibrary, useHoldRotation, useKeys, usePuzzle, useRemembered } from '../cases/hooks'
import { ManageCases } from '../cases/ManageCases'
import { RecognizeSession } from '../cases/RecognizeSession'
import { ReviewTable } from '../cases/ReviewTable'
import { SetupSteps, type SetupStep, type StepDefinition } from '../cases/SetupSteps'
import { Action, Chip, Notice, card } from '../cases/ui'

type Mode = SessionMode | 'Recognize'

type Saved = { set: CaseSet; subset: string; learning: LearningStateFilter; mode: Mode; chosen: boolean }

type Screen = 'setup' | 'pick' | 'manage' | 'session'

const MODES: Array<{ value: Mode; label: string; line: string }> = [
  { value: 'Learn', label: 'Learn', line: 'The algorithm is shown before you start.' },
  { value: 'Drill', label: 'Drill', line: 'Recognise, then execute. The name stays hidden until the verdict.' },
  { value: 'Recognize', label: 'Recognise', line: 'Name the case from the front and right stickers only.' },
  { value: 'Review', label: 'Review', line: 'Cases that are due come first, and each verdict shows the case history.' }
]

const DEFAULTS: Saved = { set: 'OLL', subset: 'All', learning: 'All', mode: 'Drill', chosen: false }

export function CasesTrainer() {
  const [saved, remember, savedReady] = useRemembered<Saved>('trainer-cases', DEFAULTS)
  const library = useCaseLibrary(savedReady ? saved.set : undefined)
  const puzzle = usePuzzle()
  const rotation = useHoldRotation()
  const cubeLink = useCubeConnection()
  const [stepOverride, setStepOverride] = useState<SetupStep>()
  const [screen, setScreen] = useState<Screen>('setup')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState<string[]>()
  const [connectError, setConnectError] = useState('')

  const { set, subset, learning } = saved
  const mode: Mode = saved.mode === 'Recognize' && recordSetFor(set) === 'F2L' ? 'Drill' : saved.mode
  const step: SetupStep = stepOverride ?? (saved.chosen ? 'ready' : 'set')
  const { inSet, inSubset, cases } = useMemo(() => narrowCases(set, library.algorithms, subset, learning), [set, library.algorithms, subset, learning])
  const subsets = subsetsForSet(set, inSet)
  const counts = learningCounts(inSubset)
  const customPool = custom ? library.algorithms.filter((record) => custom.includes(record.id)) : undefined
  const pool = customPool ?? cases

  const setCounts = (value: CaseSet) => {
    const count = library.algorithms.filter((record) => matchesSet(record, value)).length
    if (isCubedexExtraSet(value)) return count || cubedexCaseCount(value)
    return value === 'F2L' && count < 10 ? undefined : count
  }

  const steps: StepDefinition[] = [
    { id: 'set', label: 'Set', title: 'Choose a set', value: set, options: CASE_SETS.map((value) => ({ value, count: setCounts(value) })) },
    ...(subsets.length > 1 ? [{ id: 'subset' as const, label: 'Subset', title: 'Choose a subset', value: subset, options: ['All', ...subsets].map((value) => ({ value, label: value === 'All' ? 'All subsets' : value, count: filterSetSubset(set, inSet, value).length })) }] : []),
    { id: 'learning', label: 'Cases', title: 'Choose which cases to drill', value: learning, options: LEARNING_FILTERS.map((value) => ({ value, label: value === 'All' ? 'All cases' : value === 'Unlearned' ? 'New' : value, count: counts[value] })) }
  ]

  const choose = (id: StepDefinition['id'], value: string) => {
    setCustom(undefined)
    setSelected(new Set())
    if (id === 'set') {
      remember({ set: value as CaseSet, subset: 'All', learning: 'All' })
      const nextSubsets = subsetsForSet(value as CaseSet, library.algorithms.filter((record) => matchesSet(record, value as CaseSet)))
      setStepOverride(nextSubsets.length > 1 ? 'subset' : 'learning')
      return
    }
    if (id === 'subset') {
      remember({ subset: value, learning: 'All' })
      setStepOverride('learning')
      return
    }
    remember({ learning: value as LearningStateFilter, chosen: true })
    setStepOverride('ready')
  }

  const start = () => {
    if (!pool.length) return
    setScreen('session')
  }

  const practiceSelected = () => {
    if (!selected.size) return
    setCustom([...selected])
    setScreen('session')
  }

  const connect = async () => {
    setConnectError('')
    await cubeLink.connect(bluetoothSource({ requestInitialState: true })).catch((reason: unknown) => setConnectError(reason instanceof Error ? reason.message : 'The cube did not connect.'))
  }

  const record = async (attempt: TrainerAttempt, updated: AlgorithmRecord) => {
    await library.saveAttempt(attempt)
    await library.saveAlgorithms([updated])
  }

  useKeys((key) => {
    if (screen === 'setup' && step === 'ready' && (key === 'Space' || key === 'Enter') && pool.length) { start(); return true }
    if (screen === 'pick' && key === 'Enter' && selected.size) { practiceSelected(); return true }
  }, screen !== 'session')

  if (library.error && !library.loaded) {
    return <Notice tone="error">Local storage could not be opened: {library.error}. Cases cannot load and attempts will not be saved. Close other tabs of this app and reload.</Notice>
  }

  if (!library.loaded || !savedReady) {
    return <Notice>Loading your cases.</Notice>
  }

  if (screen === 'session') {
    const end = () => { setScreen('setup'); setCustom(undefined) }
    return mode === 'Recognize'
      ? <RecognizeSession pool={pool} available={inSet} attempts={library.attempts} rotation={rotation} onRecord={record} onEnd={end} />
      : <CaseSession pool={pool} attempts={library.attempts} mode={mode} puzzle={puzzle} rotation={rotation} cube={cubeLink.handle} onRecord={record} onEnd={end} />
  }

  const building = library.building === set
  const summary = (
    <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2', alignItems: 'center' })}>
      <Action onClick={() => setScreen('setup')}>Back to setup</Action>
      <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>{set} · {subset === 'All' ? 'all subsets' : subset} · {cases.length} cases</span>
    </div>
  )

  if (screen === 'pick') {
    return (
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '3', alignItems: 'center' })}>
          <Action onClick={() => setScreen('setup')}>Back to setup</Action>
          <span className={css({ fontSize: 'sm', color: 'inkVariant', flex: '1', minW: '160px' })}>
            {selected.size ? `${selected.size} of ${cases.length} ${set} cases selected` : `Select the ${set} cases to practise.`}
          </span>
          <Action primary hotkey="Enter" disabled={!selected.size} onClick={practiceSelected}>{selected.size ? `Practice selected (${selected.size})` : 'Practice selected'}</Action>
        </div>
        <CaseGrid
          records={cases}
          attempts={library.attempts}
          selected={selected}
          puzzle={puzzle}
          shapes={set === 'F2L'}
          onToggle={(id) => setSelected((current) => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })}
          onSelect={(ids, on) => setSelected((current) => {
            const next = new Set(current)
            for (const id of ids) {
              if (on) next.add(id)
              else next.delete(id)
            }
            return next
          })}
        />
      </div>
    )
  }

  if (screen === 'manage') {
    return (
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
        {summary}
        <ManageCases set={set} cases={cases} onSave={library.saveAlgorithms} />
      </div>
    )
  }

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '6' })}>
      {library.error && <Notice tone="error">{library.error}. Choose another set or reload the page.</Notice>}
      <SetupSteps steps={steps} step={step} onStep={setStepOverride} onChoose={choose}>
        <section aria-label="Ready" className={css({ display: 'flex', flexDirection: 'column', gap: '5' })}>
          <div role="group" aria-label="Mode" className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
            {MODES.filter((entry) => entry.value !== 'Recognize' || recordSetFor(set) !== 'F2L').map((entry) => (
              <Chip key={entry.value} active={mode === entry.value} onClick={() => remember({ mode: entry.value })}>{entry.label}</Chip>
            ))}
          </div>
          <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>{MODES.find((entry) => entry.value === mode)?.line}</p>
          {building ? (
            <Notice>Building the {set} cases. This takes a few seconds the first time.</Notice>
          ) : cases.length === 0 ? (
            <Notice>No {learning === 'All' ? '' : `${learning.toLowerCase()} `}cases in {set}{subset === 'All' ? '' : ` ${subset}`}. Pick another learning state above.</Notice>
          ) : null}
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '3', alignItems: 'center' })}>
            <Action primary hotkey="Space" disabled={!pool.length} onClick={start}>{cases.length ? `Start session · ${cases.length} cases` : 'Start session'}</Action>
            <Action disabled={!cases.length} onClick={() => setScreen('pick')}>Pick cases</Action>
            <Action onClick={() => setScreen('manage')}>Manage cases</Action>
          </div>
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '3', alignItems: 'center', fontSize: 'sm', color: 'inkVariant' })}>
            {cubeLink.handle
              ? <span>{cubeLink.handle.name} connected. It checks each case by state.</span>
              : <>
                  <span>No smart cube connected. Time with Space instead, or connect one.</span>
                  <Action disabled={cubeLink.connecting} onClick={() => void connect()}>{cubeLink.connecting ? 'Connecting' : 'Connect cube'}</Action>
                </>}
            {connectError && <span role="alert" className={css({ color: 'error' })}>{connectError}</span>}
          </div>
          {mode === 'Review' && <ReviewTable records={cases} attempts={library.attempts} />}
        </section>
      </SetupSteps>
    </div>
  )
}
