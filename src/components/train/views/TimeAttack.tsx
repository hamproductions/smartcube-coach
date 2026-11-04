import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KPuzzle } from 'cubing/kpuzzle'
import { css, cx } from 'styled-system/css'
import { DASH } from '../../ui/Page'
import type { AlgorithmRecord } from '../../../domain/models'
import { createId } from '../../../domain/ids'
import { useCubeConnection } from '../../../device/CubeConnection'
import { CASE_SETS, matchesSet, type CaseSet } from '../cases/catalogue'
import { CaseGrid } from '../cases/CaseGrid'
import { CaseStage } from '../cases/CaseStage'
import { SetupPrompt } from '../cases/CaseSession'
import { timeAttackAttempt } from '../cases/attempts'
import { seconds, useCaseLibrary, useHoldRotation, useKeys, useNow, usePuzzle, useRemembered } from '../cases/hooks'
import { SessionStrip } from '../cases/SessionStrip'
import { useCaseAttempt, type AttemptState } from '../cases/useCaseAttempt'
import { CasePreview } from '../../ui/CasePreview'
import { Action, Chip, Notice, card, focusRing, labelText, mono } from '../cases/ui'

type Saved = { set: CaseSet; order: string[]; targets: Record<string, number>; misses: string[] }

type Screen = 'pick' | 'targets' | 'run' | 'summary'

type RunResult = { id: string; record: AlgorithmRecord; totalMs: number; targetMs: number; success: boolean }

const DEFAULTS: Saved = { set: 'PLL', order: [], targets: {}, misses: [] }

export function TimeAttackTrainer() {
  const [saved, remember, savedReady] = useRemembered<Saved>('trainer-time-attack', DEFAULTS)
  const library = useCaseLibrary(savedReady ? saved.set : undefined)
  const puzzle = usePuzzle()
  const rotation = useHoldRotation()
  const cubeLink = useCubeConnection()
  const [screen, setScreen] = useState<Screen>()
  const [queue, setQueue] = useState<AlgorithmRecord[]>([])
  const [results, setResults] = useState<RunResult[]>([])
  const [error, setError] = useState('')
  const run = useRef({ id: '', index: 0, queue: [] as AlgorithmRecord[], missed: [] as string[] })

  const byId = useMemo(() => new Map(library.algorithms.map((record) => [record.id, record])), [library.algorithms])
  const ordered = saved.order.map((id) => byId.get(id)).filter((record): record is AlgorithmRecord => Boolean(record))
  const inSet = library.algorithms.filter((record) => matchesSet(record, saved.set))
  const targetFor = (record: AlgorithmRecord) => saved.targets[record.id] ?? record.targetMs
  const misses = saved.misses.map((id) => byId.get(id)).filter((record): record is AlgorithmRecord => Boolean(record))
  const current = screen ?? 'pick'

  useEffect(() => {
    if (savedReady && library.loaded && screen === undefined) setScreen(saved.order.length ? 'targets' : 'pick')
  }, [savedReady, library.loaded, screen, saved.order.length])

  const finishCase = useCallback((state: AttemptState) => {
    const { id, index, queue: active } = run.current
    const record = state.record
    const targetMs = saved.targets[record.id] ?? record.targetMs
    const result = { input: state.input, startedAt: state.input === 'smart-cube' ? state.recognizedAt ?? state.startedAt : state.startedAt, endedAt: state.endedAt ?? performance.now(), success: Boolean(state.success), moves: state.moves }
    const attempt = timeAttackAttempt(record, id, targetMs, result)
    setResults((list) => [...list, { id: attempt.id, record, totalMs: attempt.totalMs, targetMs, success: result.success }])
    library.saveAttempt(attempt).catch(() => setError('A result could not be saved. Local storage is unavailable, so this run is not stored.'))
    const nextIndex = index + 1
    const missed = attempt.targetSatisfied ? run.current.missed : [...run.current.missed, record.id]
    run.current = { ...run.current, index: nextIndex, missed }
    if (nextIndex < active.length) {
      beginRef.current(active[nextIndex], { cube: Boolean(cubeLink.handle) })
      return
    }
    remember({ misses: missed })
    setScreen('summary')
  }, [saved.targets, library, cubeLink.handle, remember])

  const attempt = useCaseAttempt({ puzzle, rotation, split: false, onDone: finishCase })
  const beginRef = useRef(attempt.begin)
  beginRef.current = attempt.begin

  const startRun = (cases: AlgorithmRecord[]) => {
    if (!cases.length) return
    run.current = { id: createId(), index: 0, queue: cases, missed: [] }
    setQueue(cases)
    setResults([])
    setError('')
    setScreen('run')
    attempt.begin(cases[0], { cube: Boolean(cubeLink.handle) })
  }

  const toggle = (id: string) => {
    remember((current) => ({ order: current.order.includes(id) ? current.order.filter((entry) => entry !== id) : [...current.order, id] }))
  }

  const select = (ids: string[], on: boolean) => {
    remember((current) => {
      const rest = current.order.filter((id) => !ids.includes(id))
      return { order: on ? [...rest, ...ids] : rest }
    })
  }

  const move = (id: string, direction: -1 | 1) => {
    remember((current) => {
      const index = current.order.indexOf(id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.order.length) return {}
      const next = [...current.order]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { order: next }
    })
  }

  const runMisses = results.filter((result) => !result.success || result.totalMs > result.targetMs).map((result) => result.record)

  useKeys((key) => {
    if (current === 'targets' && (key === 'Space' || key === 'Enter')) { startRun(ordered); return true }
    if (current === 'pick' && key === 'Enter' && ordered.length) { setScreen('targets'); return true }
    if (current === 'summary' && (key === 'Space' || key === 'Enter')) { startRun(runMisses.length ? runMisses : queue); return true }
    if (current !== 'run' || !attempt.state) return
    const phase = attempt.state.phase
    if (phase === 'setup') {
      if (key === 'Space' || key === 'Enter') { attempt.skipSetup(); return true }
      if (key === 'r' || key === 'R') { attempt.restartSetup(); return true }
      return
    }
    if (phase === 'execute' && (key === 'Space' || key === 'Enter' || key === '1')) { attempt.finish(true); return true }
    if (phase === 'execute' && key === '2') { attempt.finish(false); return true }
  })

  if (library.error && !library.loaded) return <Notice tone="error">Local storage could not be opened: {library.error}. Close other tabs of this app and reload.</Notice>
  if (!library.loaded || !savedReady) return <Notice>Loading your cases.</Notice>

  if (current === 'run' && attempt.state) {
    return (
      <RunScreen
        state={attempt.state}
        puzzle={puzzle}
        position={run.current.index + 1}
        total={queue.length}
        targetMs={targetFor(attempt.state.record)}
        results={results}
        rotation={rotation}
        error={error}
        onDone={() => attempt.finish(true)}
        onGiveUp={() => attempt.finish(false)}
        onSkipSetup={attempt.skipSetup}
        onRestartSetup={attempt.restartSetup}
        onStop={() => { attempt.stop(); setScreen(results.length ? 'summary' : 'targets') }}
      />
    )
  }

  if (current === 'summary') {
    return <Summary results={results} misses={runMisses} onRunMisses={() => startRun(runMisses)} onAgain={() => startRun(queue)} onEdit={() => setScreen('targets')} onNew={() => setScreen('pick')} />
  }

  if (current === 'targets') {
    const total = ordered.reduce((sum, record) => sum + targetFor(record), 0)
    return (
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '3', alignItems: 'center' })}>
          <Action onClick={() => setScreen('pick')}>Change cases</Action>
          <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>{ordered.length} {ordered.length === 1 ? 'case' : 'cases'} · total target <span className={mono}>{seconds(total)}</span></span>
        </div>
        <ol aria-label="Queue" className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
          {ordered.map((record, index) => (
            <li key={record.id} className={cx(card, css({ display: 'flex', alignItems: 'center', gap: '3', p: '2', pr: '3', flexWrap: 'wrap' }))}>
              <span className={cx(mono, css({ w: '6', textAlign: 'right', color: 'inkVariant', fontSize: 'sm' }))}>{index + 1}</span>
              <CasePreview setup={record.setup} set={record.set} size={56} />
              <span className={css({ flex: '1', minW: '120px', fontWeight: 'semibold', fontSize: 'sm' })}>{record.name}</span>
              <label className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                <span className={labelText}>Target s</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  aria-label={`Target time for ${record.name}`}
                  defaultValue={Number((targetFor(record) / 1000).toFixed(2))}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isFinite(value) && value > 0) remember((current) => ({ targets: { ...current.targets, [record.id]: Math.round(value * 1000) } }))
                  }}
                  className={cx(mono, css({ w: '88px', minH: '44px', px: '2', borderRadius: 'control', bg: 'surface', color: 'ink', borderWidth: '1px', borderColor: 'floating', fontSize: 'sm' }), focusRing)}
                />
              </label>
              <Action aria-label={`Move ${record.name} earlier`} disabled={index === 0} onClick={() => move(record.id, -1)} compact>↑</Action>
              <Action aria-label={`Move ${record.name} later`} disabled={index === ordered.length - 1} onClick={() => move(record.id, 1)} compact>↓</Action>
            </li>
          ))}
        </ol>
        <Action primary hotkey="Space" className={css({ alignSelf: { base: 'stretch', md: 'flex-start' } })} onClick={() => startRun(ordered)}>Start run</Action>
      </div>
    )
  }

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      <div role="group" aria-label="Set" className={css({ display: 'flex', flexWrap: { base: 'nowrap', md: 'wrap' }, overflowX: { base: 'auto', md: 'visible' }, gap: '2', pb: { base: '1', md: '0' } })}>
        {CASE_SETS.map((value) => <Chip key={value} active={saved.set === value} onClick={() => remember({ set: value })}>{value}</Chip>)}
      </div>
      <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3' })}>
        <span className={css({ fontSize: 'sm', color: 'inkVariant', flex: '1', minW: '160px' })}>
          {ordered.length ? `${ordered.length} in the queue` : 'Select the cases for the run, from any set.'}
        </span>
        {misses.length > 0 && <Action onClick={() => select(misses.map((record) => record.id), true)}>Add last misses ({misses.length})</Action>}
        <Action primary hotkey="Enter" disabled={!ordered.length} onClick={() => setScreen('targets')}>Set targets</Action>
      </div>
      {library.building === saved.set && <Notice>Building the {saved.set} cases. This takes a few seconds the first time.</Notice>}
      {library.error && <Notice tone="error">{library.error}. Choose another set or reload the page.</Notice>}
      <CaseGrid records={inSet} attempts={library.attempts} selected={new Set(saved.order)} onToggle={toggle} onSelect={select} puzzle={puzzle} shapes={saved.set === 'F2L'} />
    </div>
  )
}

function RunScreen({ state, puzzle, position, total, targetMs, results, rotation, error, onDone, onGiveUp, onSkipSetup, onRestartSetup, onStop }: {
  state: AttemptState
  puzzle: KPuzzle | undefined
  position: number
  total: number
  targetMs: number
  results: RunResult[]
  rotation: string
  error: string
  onDone: () => void
  onGiveUp: () => void
  onSkipSetup: () => void
  onRestartSetup: () => void
  onStop: () => void
}) {
  const now = useNow(state.phase === 'execute')
  const firstTurn = state.input === 'smart-cube' ? state.recognizedAt : state.startedAt
  const elapsed = state.phase === 'execute' && firstTurn !== undefined ? now - firstTurn : 0
  const over = elapsed > targetMs
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4', flex: '1' })}>
      <SessionStrip results={results.map((result) => ({ id: result.id, success: result.success && result.totalMs <= result.targetMs, totalMs: result.totalMs }))}>
        <span className={cx(mono, css({ fontSize: 'sm' }))}>Case {position} / {total}</span>
        <Action onClick={onStop}>Stop run</Action>
      </SessionStrip>
      <div aria-hidden className={css({ h: '1', borderRadius: 'pill', bg: 'floating', overflow: 'hidden' })}>
        <div className={css({ h: 'full', bg: 'green' })} style={{ width: `${((position - 1) / total) * 100}%` }} />
      </div>
      {error && <p role="alert" className={css({ color: 'error', fontSize: 'sm' })}>{error}</p>}
      <div className={css({ display: 'grid', gap: { base: '4', lg: '8' }, gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1.1fr) minmax(0, 1fr)' }, alignItems: 'center', flex: '1' })}>
        <CaseStage record={state.record} puzzle={puzzle} rotation={rotation} moves={state.moves} />
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold' })}>{state.record.name}</h2>
          <p className={cx(mono, css({ color: 'inkVariant', letterSpacing: '0.04em' }))}>{state.record.algorithm}</p>
          {state.phase === 'setup' ? (
            <>
              <SetupPrompt state={state} puzzle={puzzle} onSkipSetup={onSkipSetup} onRestartSetup={onRestartSetup} />
            </>
          ) : (
            <>
              <p aria-label="Timer" className={cx(mono, css({ fontSize: { base: '6xl', md: '8xl' }, fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.04em', color: over ? 'error' : 'green' }))}>{seconds(elapsed)}</p>
              <p className={cx(mono, css({ fontSize: 'sm', color: 'inkVariant' }))}>Target {seconds(targetMs)}{state.input === 'smart-cube' && firstTurn === undefined ? '. The clock starts on your first turn.' : ''}</p>
              <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
                <Action primary hotkey="Space" className={css({ flex: { base: '1', lg: 'none' } })} onClick={onDone}>Done</Action>
                <Action hotkey="2" onClick={onGiveUp}>Give up</Action>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Summary({ results, misses, onRunMisses, onAgain, onEdit, onNew }: {
  results: RunResult[]
  misses: AlgorithmRecord[]
  onRunMisses: () => void
  onAgain: () => void
  onEdit: () => void
  onNew: () => void
}) {
  const met = results.filter((result) => result.success && result.totalMs <= result.targetMs).length
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '5' })}>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
        <p aria-label="Run result" className={cx(mono, css({ fontSize: { base: '4xl', md: '6xl' }, fontWeight: 'bold', lineHeight: '1', color: met === results.length ? 'green' : 'ink' }))}>{met} / {results.length}</p>
        <p className={css({ fontSize: 'lg' })}>{met === results.length ? 'Every target met.' : `${met} of ${results.length} targets met.`}</p>
      </div>
      <div className={cx(card, css({ overflowX: 'auto' }))}>
        <table className={cx(mono, css({ w: 'full', borderCollapse: 'collapse', fontSize: 'sm' }))}>
          <thead>
            <tr className={css({ color: 'inkVariant', fontSize: 'xs', borderBottomWidth: '1px', borderColor: 'floating' })}>
              <th className={css({ px: '3', py: '2', textAlign: 'left', fontFamily: 'sans', fontWeight: 'medium' })}>Case</th>
              <th className={css({ px: '3', py: '2', textAlign: 'right' })}>Time</th>
              <th className={css({ px: '3', py: '2', textAlign: 'right' })}>Target</th>
              <th className={css({ px: '3', py: '2', textAlign: 'right', fontFamily: 'sans', fontWeight: 'medium' })}>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => {
              const outcome = !result.success ? 'Gave up' : result.totalMs <= result.targetMs ? 'Met' : 'Over'
              return (
                <tr key={result.id} className={css({ borderBottomWidth: '1px', borderColor: 'floating', _last: { borderBottomWidth: '0' } })}>
                  <td className={css({ px: '3', py: '2', fontFamily: 'sans', whiteSpace: 'nowrap' })}>{result.record.name}</td>
                  <td className={css({ px: '3', py: '2', textAlign: 'right' })}>{result.success ? seconds(result.totalMs) : DASH}</td>
                  <td className={css({ px: '3', py: '2', textAlign: 'right' })}>{seconds(result.targetMs)}</td>
                  <td className={css({ px: '3', py: '2', textAlign: 'right', fontFamily: 'sans', color: outcome === 'Met' ? 'green' : 'error' })}>{outcome}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {misses.length > 0 && (
        <section aria-labelledby="misses" className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
          <h2 id="misses" className={css({ fontSize: 'md', fontWeight: 'semibold' })}>Misses for the next run</h2>
          <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>{misses.map((record) => record.name).join(', ')}</p>
        </section>
      )}
      <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
        {misses.length > 0
          ? <Action primary hotkey="Space" onClick={onRunMisses}>Run the misses ({misses.length})</Action>
          : <Action primary hotkey="Space" onClick={onAgain}>Run again</Action>}
        {misses.length > 0 && <Action onClick={onAgain}>Run all again</Action>}
        <Action onClick={onEdit}>Edit targets</Action>
        <Action onClick={onNew}>New run</Action>
      </div>
    </div>
  )
}
