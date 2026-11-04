import { useCallback, useEffect, useRef, useState } from 'react'
import type { KPuzzle } from 'cubing/kpuzzle'
import { css, cx } from 'styled-system/css'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import { chooseTrainingCase, progressiveHint, updateMastery } from '../../../domain/training'
import { setCriticalActivity } from '../../../pwa/register'
import { caseAttempt } from './attempts'
import { CaseStage } from './CaseStage'
import { GOAL_LABEL, caseDisplay, goalFor } from './caseState'
import { seconds, useKeys, useNow } from './hooks'
import { caseRunning } from './ReviewTable'
import { SessionStrip, type SessionResult } from './SessionStrip'
import { useCaseAttempt, type AttemptState } from './useCaseAttempt'
import { Action, Stat, card, labelText, mono } from './ui'

export type SessionMode = 'Learn' | 'Drill' | 'Review'

type Props = {
  pool: AlgorithmRecord[]
  attempts: TrainerAttempt[]
  mode: SessionMode
  puzzle: KPuzzle | undefined
  rotation: string
  cube: { name: string } | undefined
  onRecord: (attempt: TrainerAttempt, updated: AlgorithmRecord) => Promise<void>
  onEnd: () => void
}

const PHASE_LABEL = { setup: 'Set up', recognize: 'Ready', execute: 'Solving', done: '' } as const

export function CaseSession({ pool, attempts, mode, puzzle, rotation, cube, onRecord, onEnd }: Props) {
  const [results, setResults] = useState<SessionResult[]>([])
  const [error, setError] = useState('')
  const latest = useRef({ pool, attempts, cube, onRecord })
  latest.current = { pool, attempts, cube, onRecord }

  const onDone = useCallback((state: AttemptState, result: Parameters<typeof caseAttempt>[2]) => {
    const attempt = caseAttempt(state.record, mode === 'Learn' ? 'learn' : mode === 'Review' ? 'review' : 'drill', result)
    setResults((current) => [...current, { id: attempt.id, success: result.success, totalMs: attempt.totalMs }])
    latest.current.onRecord(attempt, updateMastery(state.record, result.success, attempt.totalMs)).catch(() => setError('This attempt could not be saved. Local storage is unavailable, so the session keeps running but nothing is stored.'))
  }, [mode])

  const { state, begin, skipSetup, restartSetup, recognize, finish, hint } = useCaseAttempt({ puzzle, rotation, split: true, onDone })
  const [last, setLast] = useState<AttemptState>()

  const next = useCallback(() => {
    const { pool: currentPool, attempts: currentAttempts, cube: currentCube } = latest.current
    const record = chooseTrainingCase(currentPool, currentAttempts)
    if (record) begin(record, { cube: Boolean(currentCube), hintLevel: mode === 'Learn' ? 3 : 0 })
  }, [begin, mode])

  useEffect(() => { next() }, [next])

  useEffect(() => {
    if (state?.phase !== 'done' || state.input !== 'smart-cube' || !state.moves.length) return
    setLast(state)
    next()
  }, [state, next])

  useEffect(() => {
    setCriticalActivity(true)
    return () => setCriticalActivity(false)
  }, [])

  useKeys((key) => {
    if (!state) return
    if (state.phase === 'setup') {
      if (key === 'Space' || key === 'Enter') { skipSetup(); return true }
      if (key === 'r' || key === 'R') { restartSetup(); return true }
      return
    }
    if (state.phase === 'done') {
      if (key === 'Space' || key === 'Enter') { next(); return true }
      return
    }
    if (key === 'h' || key === 'H') { hint(); return true }
    if (key === '2') { finish(false); return true }
    if (state.phase === 'recognize' && (key === 'Space' || key === 'Enter')) { recognize(); return true }
    if (state.phase === 'execute' && (key === 'Space' || key === 'Enter' || key === '1')) { finish(true); return true }
  })

  if (!state) {
    return <p className={css({ color: 'inkVariant' })}>No case to drill. Go back and widen the selection.</p>
  }

  const { record } = state
  const named = mode !== 'Drill' || state.hintLevel > 0 || state.phase === 'done'

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4', flex: '1' })}>
      <SessionStrip results={results}>
        <span className={css({ fontSize: 'xs', color: 'inkVariant', display: { base: 'none', md: 'inline' } })}>{cube ? `${cube.name} verifies each case` : 'Keyboard timing'}</span>
        <Action compact onClick={onEnd}>End session</Action>
      </SessionStrip>
      {error && <p role="alert" className={css({ color: 'error', fontSize: 'sm' })}>{error}</p>}
      {last && state.phase !== 'done' && <LastResult state={last} />}
      <div className={css({ display: 'grid', gap: { base: '3', lg: '8' }, gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1.1fr) minmax(0, 1fr)' }, alignItems: 'center', flex: '1' })}>
        <CaseStage record={record} puzzle={puzzle} rotation={rotation} moves={state.moves} replay={state.phase === 'done' && !state.moves.length} />
        <div className={css({ display: 'flex', flexDirection: 'column', gap: { base: '2', md: '4' }, alignItems: { base: 'stretch', lg: 'flex-start' } })}>
          {state.phase === 'done'
            ? <Verdict state={state} attempts={attempts} mode={mode} onNext={next} />
            : <Running state={state} puzzle={puzzle} named={named} onRecognize={recognize} onFinish={finish} onHint={hint} onSkipSetup={skipSetup} onRestartSetup={restartSetup} />}
        </div>
      </div>
    </div>
  )
}

function Running({ state, puzzle, named, onRecognize, onFinish, onHint, onSkipSetup, onRestartSetup }: {
  state: AttemptState
  puzzle: KPuzzle | undefined
  named: boolean
  onRecognize: () => void
  onFinish: (success: boolean) => void
  onHint: () => void
  onSkipSetup: () => void
  onRestartSetup: () => void
}) {
  const now = useNow(state.phase === 'execute')
  const { record } = state
  const recognitionMs = state.recognizedAt === undefined ? undefined : state.recognizedAt - state.startedAt
  const cube = state.input === 'smart-cube'

  if (state.phase === 'setup') {
    return <SetupPrompt state={state} puzzle={puzzle} onSkipSetup={onSkipSetup} onRestartSetup={onRestartSetup} />
  }

  const elapsed = state.phase === 'execute' ? now - (state.recognizedAt ?? state.startedAt) : 0
  const goal = GOAL_LABEL[goalFor(record)]
  return (
    <>
      <div className={css({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '3', w: 'full', flexDirection: { base: 'row', lg: 'column-reverse' }, lg: { alignItems: 'flex-start' } })}>
        <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold' })}>{named ? record.name : `${record.set} case`}</h2>
        <span className={css({ fontSize: 'sm', fontWeight: 'semibold', color: state.phase === 'execute' ? 'green' : 'inkVariant' })}>{PHASE_LABEL[state.phase]}</span>
      </div>
      <p aria-label="Timer" className={cx(mono, css({ fontSize: { base: '6xl', md: '8xl' }, fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.04em', color: state.phase === 'execute' ? 'green' : 'ink' }))}>{seconds(elapsed)}</p>
      {recognitionMs !== undefined && <p className={cx(mono, css({ fontSize: 'sm', color: 'inkVariant' }))}>Recognition {seconds(recognitionMs)}</p>}
      {state.hintLevel > 0 && (
        <p aria-label="Hint" className={cx(card, mono, css({ px: '4', py: '3', fontSize: { base: 'md', md: 'xl' }, letterSpacing: '0.04em', color: 'greenBright' }))}>{progressiveHint(record, state.hintLevel)}</p>
      )}
      <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>
        {state.phase === 'recognize'
          ? (cube ? 'Look, then turn. The clock starts on your first turn.' : 'Press Space the moment you know the case.')
          : (cube ? `The cube stops the clock at ${goal}.` : 'Press Space when the algorithm is done.')}
      </p>
      <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2', w: { base: 'full', lg: 'auto' } })}>
        {state.phase === 'recognize'
          ? <Action primary hotkey="Space" className={css({ flex: { base: '1', lg: 'none' } })} onClick={onRecognize}>Recognised</Action>
          : <Action primary hotkey="Space" className={css({ flex: { base: '1', lg: 'none' } })} onClick={() => onFinish(true)}>Done</Action>}
        <Action hotkey="2" onClick={() => onFinish(false)}>Missed</Action>
        {state.hintLevel < 3 && <Action hotkey="H" onClick={onHint}>Hint</Action>}
      </div>
    </>
  )
}

function Verdict({ state, attempts, mode, onNext }: { state: AttemptState; attempts: TrainerAttempt[]; mode: SessionMode; onNext: () => void }) {
  const { record } = state
  const totalMs = (state.endedAt ?? state.startedAt) - state.startedAt
  const recognitionMs = state.recognizedAt === undefined ? undefined : state.recognizedAt - state.startedAt
  const executionMs = state.recognizedAt === undefined ? (state.success ? totalMs : undefined) : (state.endedAt ?? state.recognizedAt) - state.recognizedAt
  const stat = caseRunning(attempts, record.id)
  return (
    <>
      <p aria-label="Verdict" className={css({ fontSize: { base: '4xl', md: '6xl' }, fontWeight: 'bold', lineHeight: '1', color: state.success ? 'green' : 'error' })}>{state.success ? 'Solved' : 'Missed'}</p>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
        <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold' })}>{record.name}</h2>
        <p className={cx(mono, css({ fontSize: { base: 'md', md: 'lg' }, color: 'inkVariant', letterSpacing: '0.04em' }))}>{record.algorithm}</p>
      </div>
      <Action primary hotkey="Space" className={css({ w: { base: 'full', lg: 'auto' } })} onClick={onNext}>Next case</Action>
      <div className={cx(card, css({ p: '4', display: 'grid', gap: '4', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', w: 'full', maxW: '480px' }))}>
        <Stat label="Recognition" value={seconds(recognitionMs)} />
        <Stat label="Execution" value={seconds(executionMs)} />
        <Stat label="Total" value={seconds(totalMs)} tone={state.success && totalMs <= record.targetMs ? 'good' : undefined} />
        <Stat label="Last 5 average" value={seconds(stat.recentMs)} />
        <Stat label="Case best" value={seconds(stat.bestMs)} />
        <Stat label="Case tries" value={String(stat.tries)} />
        {mode === 'Review' && <>
          <Stat label="Success" value={stat.successRate === undefined ? '' : `${Math.round(stat.successRate * 100)}%`} tone={(stat.successRate ?? 0) < 0.8 ? 'bad' : 'good'} />
          <Stat label="Best recognition" value={seconds(stat.recognitionMs)} />
          <Stat label="Best execution" value={seconds(stat.executionMs)} />
        </>}
      </div>
    </>
  )
}

export function SetupPrompt({ state, puzzle, onSkipSetup, onRestartSetup }: { state: AttemptState; puzzle: KPuzzle | undefined; onSkipSetup: () => void; onRestartSetup: () => void }) {
  const cube = state.input === 'smart-cube'
  const route = cube ? state.setupRoute : caseDisplay(puzzle, state.record).setup
  return (
    <>
      <span className={labelText}>Set up</span>
      <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold' })}>{cube ? 'Turn this from where your cube is' : 'Turn this onto a solved cube'}</h2>
      <p aria-live="polite" className={cx(mono, css({ fontSize: { base: 'lg', md: '2xl' }, letterSpacing: '0.06em', lineHeight: '1.4', minH: '1.4em' }))}>
        {route === undefined ? <span className={css({ color: 'inkVariant', fontSize: 'md' })}>Working out the turns from your cube...</span> : route.join(' ')}
      </p>
      <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>
        {cube ? 'A wrong turn just updates the moves. When the cube matches the case, the clock waits for your first turn.' : 'The clock waits until you press Space.'}
      </p>
      <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
        <Action primary hotkey="Space" onClick={onSkipSetup}>It is set up</Action>
        <Action hotkey="R" onClick={onRestartSetup}>{cube ? 'Re-read my cube' : 'Restart setup'}</Action>
      </div>
    </>
  )
}

function LastResult({ state }: { state: AttemptState }) {
  const recognitionMs = state.recognizedAt === undefined ? undefined : state.recognizedAt - state.startedAt
  const executionMs = state.recognizedAt === undefined || state.endedAt === undefined ? undefined : state.endedAt - state.recognizedAt
  return (
    <p className={cx(card, css({ px: '4', py: '3', display: 'flex', flexWrap: 'wrap', gap: '3', alignItems: 'baseline', fontSize: 'sm' }))}>
      <span className={css({ color: state.success ? 'green' : 'error', fontWeight: 'semibold' })}>{state.success ? 'Solved' : 'Missed'}</span>
      <span className={css({ fontWeight: 'semibold' })}>{state.record.name}</span>
      <span className={cx(mono, css({ color: 'inkVariant' }))}>{state.record.algorithm}</span>
      <span className={cx(mono, css({ ml: 'auto' }))}>{seconds(recognitionMs)} look · {seconds(executionMs)} turn</span>
    </p>
  )
}
