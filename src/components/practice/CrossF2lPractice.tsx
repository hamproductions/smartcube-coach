import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { Button } from '../ui/Button'
import { Cube3D } from '../solve/Cube3D'
import { defaultScheme, schemeFor, type ColorScheme } from '../ui/LastLayerDiagram'
import { useCubeConnection, injectCubeEvent, subscribeResolvedMoves, subscribeTrackerReset, trackedPattern, resetTrackedCubeToSolved } from '../../device/CubeConnection'
import { viewRotationForHold } from '../../domain/cubeHold'
import { patternToPlayerAlg } from '../../domain/cubedex/scramble'
import {
  bestCross,
  canArm,
  faces,
  goalLabel,
  goalReached,
  initialPracticeState,
  practiceReducer,
  type Face,
  type PracticeAttempt,
  type PracticeGoal,
  type PracticeMove
} from '../../domain/crossF2lPractice'
import { createId } from '../../domain/ids'
import { defaultPreferences, readPreferences } from '../../storage/preferences'
import { clearAttempts, patchAttempt, readAttempts, readGoal, saveAttempt, writeGoal } from '../../storage/practiceAttempts'
import { bluetoothSource } from '../../device/sources'
import { useRoutedScramble } from '../train/useRoutedScramble'

const DASH = '–'
const seconds = (ms: number) => (ms / 1000).toFixed(2)
const colourName = (colour: string) => colour[0].toUpperCase() + colour.slice(1)

const keyboardMoves: Record<string, string> = { u: 'U', r: 'R', f: 'F', d: 'D', l: 'L', b: 'B' }

const label = css({ fontSize: 'xs', color: 'inkVariant' })
const chip = css({
  display: 'inline-flex', alignItems: 'center', gap: '2', px: '3', minH: '10', borderRadius: 'control',
  borderWidth: '1px', borderColor: 'floating', bg: 'transparent', color: 'inkVariant', cursor: 'pointer',
  fontSize: 'sm', whiteSpace: 'nowrap', flexShrink: '0', _hover: { color: 'ink', borderColor: 'outline' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' },
  '&[aria-pressed=true]': { bg: 'floating', color: 'ink', borderColor: 'green' }
})

export function CrossF2lPractice() {
  const cube = useCubeConnection()
  const [goal, setGoal] = useState<PracticeGoal>({ pairs: 1, face: 'any' })
  const goalRef = useRef(goal)
  goalRef.current = goal

  const [state, dispatch] = useReducer(practiceReducer, initialPracticeState)
  const stateRef = useRef(state)
  stateRef.current = state

  const { scramble, generate, follow } = useRoutedScramble()
  const followRef = useRef(follow)
  followRef.current = follow

  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])
  const [scheme, setScheme] = useState<ColorScheme>(defaultScheme)
  const [viewRotation, setViewRotation] = useState('')
  const [displayAlg, setDisplayAlg] = useState('')
  const [keyboardCube, setKeyboardCube] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [now, setNow] = useState(() => Date.now())
  const [lastId, setLastId] = useState<string>()
  const startPattern = useRef<ReturnType<typeof trackedPattern>>(null)

  useEffect(() => {
    void readAttempts().then(setAttempts).catch(() => undefined)
    void readGoal().then((stored) => { if (stored) setGoal(stored) }).catch(() => undefined)
    void readPreferences().then((prefs) => {
      setScheme(schemeFor(prefs.diagramTopColor, prefs.diagramFrontColor) ?? defaultScheme)
      setViewRotation(viewRotationForHold(prefs.diagramTopColor, prefs.diagramFrontColor))
    }).catch(() => {
      setViewRotation(viewRotationForHold(defaultPreferences.diagramTopColor, defaultPreferences.diagramFrontColor))
    })
    void generate()
  }, [generate])

  const chooseGoal = useCallback((next: PracticeGoal) => {
    setGoal(next)
    void writeGoal(next).catch(() => undefined)
    dispatch({ type: 'unready' })
  }, [])

  const arm = useCallback(() => {
    const pattern = trackedPattern()
    const current = stateRef.current
    if (!pattern) { setNotice('The cube is not being tracked yet. Connect it or turn on the keyboard cube.'); return }
    if (current.phase !== 'scrambling') return
    const met = goalReached(pattern, goalRef.current)
    if (!canArm({ ...current, scrambleTurns: Math.max(1, current.scrambleTurns) }, met !== undefined)) {
      setNotice(`That is already ${goalLabel(goalRef.current.pairs).toLowerCase()} on ${met?.face}. Turn the scramble first.`)
      return
    }
    setNotice(undefined)
    startPattern.current = pattern
    dispatch({ type: 'ready', wall: Date.now(), alreadyMet: false })
  }, [])
  const armRef = useRef(arm)
  armRef.current = arm

  useEffect(() => {
    const seed = () => {
      const pattern = trackedPattern()
      try { setDisplayAlg(pattern ? patternToPlayerAlg(pattern) : '') } catch { setDisplayAlg('') }
    }
    seed()
    const offReset = subscribeTrackerReset(() => { setDisplayAlg(''); dispatch({ type: 'restart' }); void generate() })
    const offMoves = subscribeResolvedMoves((resolved) => {
      const last = resolved.rawMoves[resolved.rawMoves.length - 1]
      const move: PracticeMove = { move: resolved.move, cube: last?.cubeTimestamp ?? null, wall: last?.localTimestamp ?? Date.now() }
      const live = stateRef.current.phase === 'ready' || stateRef.current.phase === 'solving'
      const reached = live ? goalReached(resolved.pattern, goalRef.current) : undefined
      setNotice(undefined)
      setDisplayAlg((alg) => [alg, ...resolved.rawMoves.map((raw) => raw.move)].filter(Boolean).join(' '))
      dispatch({ type: 'move', move, goal: goalRef.current, reached })
      if (stateRef.current.phase === 'scrambling' || stateRef.current.phase === 'done') {
        const followed = followRef.current(resolved.pattern)
        if (followed?.complete && followed.moves.length > 0) queueMicrotask(() => armRef.current())
        else if (followed?.offTrack && followed.done === 0) void generate()
      }
    })
    return () => { offReset(); offMoves() }
  }, [generate])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName) || target.isContentEditable)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.code === 'Space' || event.key === 'Enter') && stateRef.current.phase === 'scrambling') {
        event.preventDefault()
        void generate()
        return
      }
      if (!keyboardCube) return
      const face = keyboardMoves[event.key.toLowerCase()]
      if (!face) return
      event.preventDefault()
      const prime = event.shiftKey
      const stamp = Date.now()
      injectCubeEvent({
        type: 'MOVE',
        move: prime ? `${face}'` : face,
        face: 'URFDLB'.indexOf(face),
        direction: prime ? -1 : 1,
        timestamp: stamp,
        cubeTimestamp: null,
        localTimestamp: stamp
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [generate, keyboardCube])

  useEffect(() => {
    if (state.phase !== 'solving' && state.phase !== 'ready') return
    let frame = 0
    const step = () => { setNow(Date.now()); frame = requestAnimationFrame(step) }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [state.phase])

  const savedFor = useRef<unknown>(undefined)
  useEffect(() => {
    if (state.phase !== 'done' || !state.result || savedFor.current === state.result) return
    savedFor.current = state.result
    const attempt: PracticeAttempt = { ...state.result, id: createId(), at: Date.now() }
    setLastId(attempt.id)
    setAttempts((existing) => [...existing, attempt].slice(-300))
    void saveAttempt(attempt).catch(() => undefined)
    void generate()
    const from = startPattern.current
    if (!from) return
    void bestCross(from)
      .then((best) => {
        if (!best) return
        setAttempts((existing) => existing.map((entry) => (entry.id === attempt.id ? { ...entry, bestCross: best } : entry)))
        return patchAttempt(attempt.id, { bestCross: best })
      })
      .catch(() => undefined)
  }, [state.phase, state.result, generate])

  useEffect(() => {
    if (state.phase === 'done' && displayAlg.split(' ').length > 120) {
      const pattern = trackedPattern()
      try { if (pattern) setDisplayAlg(patternToPlayerAlg(pattern)) } catch { return }
    }
  }, [state.phase, displayAlg])

  const scoped = useMemo(() => attempts.filter((attempt) => attempt.pairs === goal.pairs), [attempts, goal.pairs])
  const lastResult = state.phase === 'done' && state.result
    ? { ...state.result, bestCross: attempts.find((attempt) => attempt.id === lastId)?.bestCross }
    : state.phase === 'scrambling' ? attempts.find((attempt) => attempt.id === lastId) : undefined
  const stats = useMemo(() => {
    const times = scoped.map((attempt) => attempt.durationMs)
    const lastFive = times.slice(-5)
    return {
      best: times.length ? Math.min(...times) : undefined,
      mean5: lastFive.length === 5 ? lastFive.reduce((total, value) => total + value, 0) / 5 : undefined,
      turns: scoped.length ? scoped.reduce((total, attempt) => total + attempt.turns, 0) / scoped.length : undefined
    }
  }, [scoped])

  const firstMove = state.solveMoves[0]
  const elapsedMs = state.phase === 'solving' && firstMove ? Math.max(0, now - firstMove.wall)
    : state.phase === 'done' && state.result ? state.result.durationMs
      : 0
  const inspectionMs = state.phase === 'ready' && state.readyAt !== undefined ? Math.max(0, now - state.readyAt) : 0
  const connected = cube.handle !== undefined
  const tracking = connected || keyboardCube

  const status = state.phase === 'ready' ? 'Inspect. Your first turn starts the clock.'
    : state.phase === 'solving' ? `Solving to ${goalLabel(goal.pairs).toLowerCase()}. The clock stops by itself.`
      : state.phase === 'done' ? 'Done. Turn the next scramble when you are ready.'
        : scramble?.offTrack ? 'Off the scramble. Undo the last turn, or get a new scramble from where your cube is.'
          : 'Turn this scramble on your cube.'

  return (
    <div className={css({ display: 'grid', gap: '8', gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1fr) 20rem' }, alignItems: 'start' })}>
      <section aria-label="Attempt" className={css({ display: 'flex', flexDirection: 'column', gap: '6', minW: '0' })}>
          <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3' })}>
          <div role="group" aria-label="Goal" className={css({ display: 'flex', flexWrap: { base: 'nowrap', md: 'wrap' }, overflowX: 'auto', gap: '2', pb: { base: '1', md: '0' }, maxW: 'full' })}>
            {[0, 1, 2, 3, 4].map((pairs) => (
              <button key={pairs} type="button" className={chip} aria-pressed={goal.pairs === pairs} onClick={() => chooseGoal({ ...goal, pairs })}>
                {goalLabel(pairs)}
              </button>
            ))}
          </div>
          <label className={css({ display: 'flex', alignItems: 'center', gap: '2', fontSize: 'sm', color: 'inkVariant' })}>
            Cross colour
            <select
              aria-label="Cross colour"
              value={goal.face}
              onChange={(event) => chooseGoal({ ...goal, face: event.target.value as Face | 'any' })}
              className={css({ minH: '10', px: '3', borderRadius: 'control', bg: 'container', color: 'ink', borderWidth: '1px', borderColor: 'floating', fontSize: 'sm', _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}
            >
              <option value="any">Any colour</option>
              {faces.map((face: Face) => <option key={face} value={face}>{colourName(scheme[face])}</option>)}
            </select>
          </label>
        </div>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: '3', p: { base: '4', md: '6' }, borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: 'floating' })}>
          <div className={css({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '3' })}>
            <span className={label}>Scramble</span>
            <button type="button" onClick={() => { dispatch({ type: 'unready' }); void generate() }} className={css({ fontSize: 'sm', color: 'green', cursor: 'pointer', _hover: { textDecoration: 'underline' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}>New scramble</button>
          </div>
          <p aria-label="Scramble moves" className={css({ fontFamily: 'mono', fontSize: { base: '20px', md: '26px' }, lineHeight: '1.5', display: 'flex', flexWrap: 'wrap', columnGap: '2', minH: '10' })}>
            {!scramble && <span className={css({ color: 'inkVariant', fontSize: 'md' })}>Working out a scramble from where your cube is…</span>}
            {scramble?.moves.map((move, index) => {
              const scrambling = state.phase === 'scrambling' || state.phase === 'done'
              const done = !scrambling || index < scramble.done
              const next = scrambling && !scramble.offTrack && index === scramble.done
              return (
                <span key={`${move}-${index}`} data-state={done ? 'done' : next ? 'next' : 'pending'} className={css({ px: '1', borderRadius: 'control', borderWidth: '1px', borderColor: next ? 'green' : 'transparent', bg: next ? 'rgba(34,197,94,0.14)' : 'transparent', color: next ? 'green' : 'ink', opacity: done ? '0.35' : '1' })}>{move}</span>
              )
            })}
          </p>
          <p role="status" className={css({ fontSize: 'sm', color: scramble?.offTrack && state.phase === 'scrambling' ? 'amber' : 'inkVariant' })}>{notice ?? status}</p>
        </div>

        <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '6' })}>
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
            <span className={label}>{state.phase === 'ready' ? 'Inspection' : 'Time'}</span>
            <strong
              data-testid="practice-clock"
              className={css({ fontFamily: 'mono', fontSize: { base: '64px', md: '96px' }, fontWeight: 'semibold', lineHeight: '0.9', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', color: state.phase === 'done' ? 'green' : 'ink' })}
            >{seconds(state.phase === 'ready' ? inspectionMs : elapsedMs)}</strong>
          </div>
          <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap', pb: '2' })}>
            {state.phase === 'ready' && <Button variant="outline" onClick={() => dispatch({ type: 'unready' })}>Back to scrambling</Button>}
            {state.phase === 'solving' && <Button variant="outline" onClick={() => dispatch({ type: 'unready' })}>Abort</Button>}
          </div>
        </div>

        {lastResult && (
          <section aria-label="Last attempt" className={css({ display: 'flex', flexDirection: 'column', gap: '4', pt: '5', borderTopWidth: '1px', borderColor: 'floating' })}>
            <h2 className={css({ fontSize: 'sm', fontWeight: 'semibold' })}>{goalLabel(lastResult.pairs)} on {colourName(scheme[lastResult.face])}</h2>
            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '8' })}>
              <Metric title="Turns" value={String(lastResult.turns)} />
              <Metric title="TPS" value={lastResult.durationMs > 0 ? (lastResult.turns / (lastResult.durationMs / 1000)).toFixed(2) : DASH} />
              <Metric title="Inspection" value={lastResult.recognitionMs === null ? DASH : `${seconds(lastResult.recognitionMs)}s`} />
              <Metric title="Pairs" value={lastResult.slots.length ? lastResult.slots.join(' ') : DASH} />
              <Metric
                title="Shortest cross"
                value={lastResult.bestCross ? `${lastResult.bestCross.turns} turn${lastResult.bestCross.turns === 1 ? '' : 's'}` : '…'}
                note={lastResult.bestCross ? `on ${colourName(scheme[lastResult.bestCross.face])}` : undefined}
              />
            </div>
            <p aria-label="Your moves" className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant', wordBreak: 'break-word' })}>{lastResult.moves.join(' ')}</p>
          </section>
        )}
      </section>

      <aside aria-label="Cube and session" className={css({ display: 'flex', flexDirection: 'column', gap: '6', order: { base: '-1', lg: '0' } })}>
        <div className={css({ display: 'grid', placeItems: 'center', aspectRatio: '1', w: 'full', maxW: { base: '13rem', lg: '20rem' }, mx: 'auto' })}>
          <Cube3D gyro viewRotation={viewRotation} setupAlg={displayAlg} />
        </div>

        {!connected && (
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '3', p: '4', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card' })}>
            <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>{tracking ? 'Keyboard cube on: u r f d l b turn a face, Shift for counter-clockwise.' : 'Connect your smart cube, or use the keyboard cube.'}</p>
            <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
              <Button variant="solid" onClick={() => { void cube.connect(bluetoothSource({ requestInitialState: true })).catch((error: unknown) => cube.setStatus(error instanceof Error ? error.message : 'Could not connect to a cube')) }}>Connect cube</Button>
              <Button variant="outline" aria-pressed={keyboardCube} onClick={() => setKeyboardCube((value) => !value)}>{keyboardCube ? 'Keyboard cube on' : 'Keyboard cube'}</Button>
            </div>
          </div>
        )}

        <section aria-label="Session" className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' })}>
            <h2 className={css({ fontSize: 'sm', fontWeight: 'semibold' })}>{goalLabel(goal.pairs)} · {scoped.length} attempt{scoped.length === 1 ? '' : 's'}</h2>
            {attempts.length > 0 && <button type="button" className={css({ fontSize: 'xs', color: 'inkVariant', cursor: 'pointer', _hover: { color: 'ink' } })} onClick={() => { setAttempts([]); void clearAttempts().catch(() => undefined) }}>Clear history</button>}
          </div>
          <div className={css({ display: 'flex', gap: '6' })}>
            <Metric title="Best" value={stats.best === undefined ? DASH : seconds(stats.best)} />
            <Metric title="Mean of 5" value={stats.mean5 === undefined ? DASH : seconds(stats.mean5)} />
            <Metric title="Avg turns" value={stats.turns === undefined ? DASH : stats.turns.toFixed(1)} />
          </div>
          <table className={css({ width: 'full', fontFamily: 'mono', fontSize: 'sm', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' })}>
            <thead>
              <tr className={css({ color: 'inkVariant', textAlign: 'left', fontFamily: 'sans', fontSize: 'xs' })}>
                <th className={css({ py: '2', fontWeight: 'normal' })}>#</th>
                <th className={css({ fontWeight: 'normal' })}>Time</th>
                <th className={css({ fontWeight: 'normal' })}>Turns</th>
                <th className={css({ fontWeight: 'normal' })}>Colour</th>
                <th className={css({ fontWeight: 'normal' })}>Best cross</th>
              </tr>
            </thead>
            <tbody>
              {scoped.slice(-12).reverse().map((attempt, index) => (
                <tr key={attempt.id} className={css({ borderTopWidth: '1px', borderColor: 'floating' })}>
                  <td className={css({ py: '2', color: 'inkVariant' })}>{scoped.length - index}</td>
                  <td>{seconds(attempt.durationMs)}</td>
                  <td>{attempt.turns}</td>
                  <td className={css({ fontFamily: 'sans' })}>{colourName(scheme[attempt.face])}</td>
                  <td>{attempt.bestCross ? attempt.bestCross.turns : DASH}</td>
                </tr>
              ))}
              {scoped.length === 0 && (
                <tr><td colSpan={5} className={css({ py: '4', fontFamily: 'sans', color: 'inkVariant' })}>No attempts at this goal yet. Turn the scramble to start one.</td></tr>
              )}
            </tbody>
          </table>
          <p className={css({ fontSize: 'xs', color: 'inkVariant' })}>
            If the 3D cube stops matching yours, solve it and{' '}
            <button type="button" className={css({ textDecoration: 'underline', color: 'ink', cursor: 'pointer' })} onClick={() => { void resetTrackedCubeToSolved() }}>reset tracking</button>.
          </p>
        </section>
      </aside>
    </div>
  )
}

function Metric({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
      <span className={label}>{title}</span>
      <strong className={css({ fontFamily: 'mono', fontSize: 'xl', fontWeight: 'medium', lineHeight: '1', fontVariantNumeric: 'tabular-nums' })}>{value}</strong>
      {note ? <small className={css({ fontSize: 'xs', color: 'inkVariant' })}>{note}</small> : null}
    </div>
  )
}
