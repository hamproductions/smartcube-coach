import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { Button } from '../ui/Button'
import { Cube3D } from '../solve/Cube3D'
import { HEX, defaultScheme, schemeFor, type ColorScheme } from '../ui/LastLayerDiagram'
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

const DASH = '—'
const seconds = (ms: number) => (ms / 1000).toFixed(2)
const colourName = (colour: string) => colour[0].toUpperCase() + colour.slice(1)

const keyboardMoves: Record<string, string> = { u: 'U', r: 'R', f: 'F', d: 'D', l: 'L', b: 'B' }

const label = css({ fontFamily: 'mono', fontSize: '2xs', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'inkMuted' })
const chip = css({
  display: 'inline-flex', alignItems: 'center', gap: '2', px: '3', minH: '10', borderRadius: 'control',
  borderWidth: '1px', borderColor: 'floating', bg: 'transparent', color: 'inkVariant', cursor: 'pointer',
  fontSize: 'sm', fontFamily: 'mono', _hover: { color: 'ink', borderColor: 'outline' },
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
  }, [])

  const chooseGoal = useCallback((next: PracticeGoal) => {
    setGoal(next)
    void writeGoal(next).catch(() => undefined)
    dispatch({ type: 'unready' })
  }, [])

  useEffect(() => {
    const seed = () => {
      const pattern = trackedPattern()
      try { setDisplayAlg(pattern ? patternToPlayerAlg(pattern) : '') } catch { setDisplayAlg('') }
    }
    seed()
    const offReset = subscribeTrackerReset(() => { setDisplayAlg(''); dispatch({ type: 'restart' }) })
    const offMoves = subscribeResolvedMoves((resolved) => {
      const last = resolved.rawMoves[resolved.rawMoves.length - 1]
      const move: PracticeMove = { move: resolved.move, cube: last?.cubeTimestamp ?? null, wall: last?.localTimestamp ?? Date.now() }
      const live = stateRef.current.phase === 'ready' || stateRef.current.phase === 'solving'
      const reached = live ? goalReached(resolved.pattern, goalRef.current) : undefined
      setNotice(undefined)
      setDisplayAlg((alg) => [alg, ...resolved.rawMoves.map((raw) => raw.move)].filter(Boolean).join(' '))
      dispatch({ type: 'move', move, goal: goalRef.current, reached })
    })
    return () => { offReset(); offMoves() }
  }, [])

  const arm = useCallback(() => {
    const pattern = trackedPattern()
    const current = stateRef.current
    if (!pattern) { setNotice('The cube is not being tracked yet.'); return }
    if (current.phase !== 'scrambling') return
    if (current.scrambleTurns === 0) { setNotice('Scramble the cube first — turn it any way you like.'); return }
    const met = goalReached(pattern, goalRef.current)
    if (!canArm(current, met !== undefined)) {
      setNotice(`That is already ${goalLabel(goalRef.current.pairs).toLowerCase()} on ${met?.face}. Scramble it some more.`)
      return
    }
    setNotice(undefined)
    startPattern.current = pattern
    dispatch({ type: 'ready', wall: Date.now(), alreadyMet: false })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName) || target.isContentEditable)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault()
        arm()
        return
      }
      if (event.key === 'Escape') {
        dispatch({ type: 'unready' })
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
  }, [arm, keyboardCube])

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
    const from = startPattern.current
    if (!from) return
    void bestCross(from)
      .then((best) => {
        if (!best) return
        setAttempts((existing) => existing.map((entry) => (entry.id === attempt.id ? { ...entry, bestCross: best } : entry)))
        return patchAttempt(attempt.id, { bestCross: best })
      })
      .catch(() => undefined)
  }, [state.phase, state.result])

  useEffect(() => {
    if (state.phase === 'done' && displayAlg.split(' ').length > 120) {
      const pattern = trackedPattern()
      try { if (pattern) setDisplayAlg(patternToPlayerAlg(pattern)) } catch { /* keep the running alg */ }
    }
  }, [state.phase, displayAlg])

  const scoped = useMemo(() => attempts.filter((attempt) => attempt.pairs === goal.pairs), [attempts, goal.pairs])
  const lastResult = state.phase === 'done' && state.result
    ? { ...state.result, bestCross: attempts.find((attempt) => attempt.id === lastId)?.bestCross }
    : attempts[attempts.length - 1]
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
  const headline = state.phase === 'scrambling'
    ? (state.scrambleTurns === 0 ? 'Scramble your cube' : `${state.scrambleTurns} turn${state.scrambleTurns === 1 ? '' : 's'} scrambled`)
    : state.phase === 'ready' ? 'Look it over'
      : state.phase === 'solving' ? `Solving · ${goalLabel(goal.pairs)}`
        : `${goalLabel(state.result?.pairs ?? goal.pairs)} on ${colourName(scheme[state.result?.face ?? 'D'])}`
  const instruction = state.phase === 'scrambling'
    ? 'Turn the cube any way you like. It does not need a given scramble. Press Space when it is mixed up.'
    : state.phase === 'ready' ? 'Your first turn starts the clock. It stops by itself the moment the goal is true.'
      : state.phase === 'solving' ? 'Keep going — the clock stops on its own.'
        : 'Turn the cube to start the next scramble. Nothing to reset.'

  return (
    <div className={css({ display: 'grid', gap: '8', p: { base: '4', lg: '8' }, gridTemplateColumns: { base: '1fr', xl: 'minmax(0, 1.4fr) minmax(20rem, 1fr)' }, alignItems: 'start', overflowY: 'auto', h: 'full' })}>
      <section aria-label="Practice" className={css({ display: 'grid', gap: '6', alignContent: 'start' })}>
        <header className={css({ display: 'grid', gap: '2' })}>
          <span className={label}>Cross → F2L practice</span>
          <h1 className={css({ fontSize: '2xl', color: 'ink', fontWeight: 'medium' })}>{headline}</h1>
          <p className={css({ color: 'inkVariant', fontSize: 'sm', maxW: '40rem' })}>{instruction}</p>
        </header>

        <div role="group" aria-label="Goal" className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
          {[0, 1, 2, 3, 4].map((pairs) => (
            <button key={pairs} type="button" className={chip} aria-pressed={goal.pairs === pairs} onClick={() => chooseGoal({ ...goal, pairs })}>
              {goalLabel(pairs)}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Cross colour" className={css({ display: 'flex', flexWrap: 'wrap', gap: '2', alignItems: 'center' })}>
          <span className={label}>Cross colour</span>
          <button type="button" className={chip} aria-pressed={goal.face === 'any'} onClick={() => chooseGoal({ ...goal, face: 'any' })}>Any</button>
          {faces.map((face: Face) => (
            <button key={face} type="button" className={chip} aria-pressed={goal.face === face} onClick={() => chooseGoal({ ...goal, face })} title={`Cross on the ${face} face`}>
              <span aria-hidden className={css({ w: '3', h: '3', borderRadius: 'full', borderWidth: '1px', borderColor: 'outline' })} style={{ background: HEX[scheme[face]] }} />
              {colourName(scheme[face])}
            </button>
          ))}
        </div>

        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '6', alignItems: 'end' })}>
          <div className={css({ display: 'grid', gap: '1' })}>
            <span className={label}>{state.phase === 'ready' ? 'Inspection' : state.phase === 'done' ? 'Time' : 'Time'}</span>
            <strong
              data-testid="practice-clock"
              className={css({ fontFamily: 'mono', fontSize: { base: '6xl', md: '8xl' }, fontWeight: 'normal', lineHeight: '0.85', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' })}
              style={{ color: state.phase === 'done' ? 'var(--colors-green, #4ade80)' : undefined }}
            >{seconds(state.phase === 'ready' ? inspectionMs : elapsedMs)}</strong>
          </div>
          <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
            {state.phase === 'scrambling' && <Button variant="solid" onClick={arm}>Ready <kbd className={css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7' })}>Space</kbd></Button>}
            {state.phase === 'ready' && <Button variant="outline" onClick={() => dispatch({ type: 'unready' })}>Keep scrambling</Button>}
            {state.phase === 'solving' && <Button variant="outline" onClick={() => dispatch({ type: 'unready' })}>Abort</Button>}
          </div>
        </div>
        {notice && <p role="status" className={css({ color: 'amber', fontSize: 'sm' })}>{notice}</p>}

        {lastResult && (
          <div aria-label="Last attempt" className={css({ display: 'grid', gap: '4', pt: '4', borderTopWidth: '1px', borderColor: 'rule' })}>
            <span className={label}>Last attempt · {goalLabel(lastResult.pairs)} on {colourName(scheme[lastResult.face])} · {seconds(lastResult.durationMs)}s</span>
            <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '10' })}>
              <Metric title="Turns" value={String(lastResult.turns)} />
              <Metric title="TPS" value={lastResult.durationMs > 0 ? (lastResult.turns / (lastResult.durationMs / 1000)).toFixed(2) : DASH} />
              <Metric title="Looked for" value={lastResult.recognitionMs === null ? DASH : `${seconds(lastResult.recognitionMs)}s`} />
              <Metric title="Pairs" value={lastResult.slots.length ? lastResult.slots.join(' ') : DASH} />
              <Metric
                title="Shortest cross from there"
                value={lastResult.bestCross ? `${lastResult.bestCross.turns} turn${lastResult.bestCross.turns === 1 ? '' : 's'}` : '…'}
                note={lastResult.bestCross ? `on ${colourName(scheme[lastResult.bestCross.face])}` : undefined}
              />
            </div>
            <p aria-label="Your moves" className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant', wordBreak: 'break-word' })}>{lastResult.moves.join(' ')}</p>
          </div>
        )}
      </section>

      <aside aria-label="Cube and history" className={css({ display: 'grid', gap: '6', alignContent: 'start' })}>
        <div className={css({ display: 'grid', placeItems: 'center' })}>
          <Cube3D gyro size={280} viewRotation={viewRotation} setupAlg={displayAlg} />
        </div>

        {!connected && (
          <div className={css({ display: 'grid', gap: '3', p: '4', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card' })}>
            <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>No cube connected. Connect it, or turn a virtual cube with the keyboard.</p>
            <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
              <Button variant="outline" onClick={() => { void cube.connect(bluetoothSource({ requestInitialState: true })).catch((error: unknown) => cube.setStatus(error instanceof Error ? error.message : 'Could not connect to a cube')) }}>Connect cube</Button>
              <Button variant="outline" aria-pressed={keyboardCube} onClick={() => setKeyboardCube((value) => !value)}>{keyboardCube ? 'Keyboard cube on' : 'Keyboard cube'}</Button>
            </div>
            {keyboardCube && <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkMuted' })}>u r f d l b turn a face clockwise. Hold Shift for counter-clockwise.</p>}
          </div>
        )}

        <p className={css({ fontSize: 'xs', color: 'inkMuted' })}>
          The app follows your cube from the last time you told it the cube was solved. If the 3D cube stops matching yours, solve it and{' '}
          <button type="button" className={css({ textDecoration: 'underline', color: 'inkVariant', cursor: 'pointer' })} onClick={() => { void resetTrackedCubeToSolved() }}>reset the tracking</button>.
        </p>

        <div className={css({ display: 'grid', gap: '3' })}>
          <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' })}>
            <span className={label}>{goalLabel(goal.pairs)} · {scoped.length} attempt{scoped.length === 1 ? '' : 's'}</span>
            {attempts.length > 0 && <button type="button" className={css({ fontSize: 'xs', color: 'inkMuted', cursor: 'pointer', _hover: { color: 'ink' } })} onClick={() => { setAttempts([]); void clearAttempts().catch(() => undefined) }}>Clear history</button>}
          </div>
          <div className={css({ display: 'flex', gap: '8' })}>
            <Metric title="Best" value={stats.best === undefined ? DASH : seconds(stats.best)} />
            <Metric title="Mean of 5" value={stats.mean5 === undefined ? DASH : seconds(stats.mean5)} />
            <Metric title="Avg turns" value={stats.turns === undefined ? DASH : stats.turns.toFixed(1)} />
          </div>
          <table className={css({ width: 'full', fontFamily: 'mono', fontSize: 'sm', borderCollapse: 'collapse' })}>
            <thead>
              <tr className={css({ color: 'inkMuted', textAlign: 'left' })}>
                <th className={css({ py: '2', fontWeight: 'normal' })}>#</th>
                <th className={css({ fontWeight: 'normal' })}>Time</th>
                <th className={css({ fontWeight: 'normal' })}>Turns</th>
                <th className={css({ fontWeight: 'normal' })}>Colour</th>
                <th className={css({ fontWeight: 'normal' })}>Best cross</th>
              </tr>
            </thead>
            <tbody>
              {scoped.slice(-12).reverse().map((attempt, index) => (
                <tr key={attempt.id} className={css({ borderTopWidth: '1px', borderColor: 'rule', color: 'ink' })}>
                  <td className={css({ py: '2', color: 'inkMuted' })}>{scoped.length - index}</td>
                  <td>{seconds(attempt.durationMs)}</td>
                  <td>{attempt.turns}</td>
                  <td>{colourName(scheme[attempt.face])}</td>
                  <td>{attempt.bestCross ? attempt.bestCross.turns : DASH}</td>
                </tr>
              ))}
              {scoped.length === 0 && (
                <tr><td colSpan={5} className={css({ py: '4', color: 'inkMuted' })}>No attempts at this goal yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  )
}

function Metric({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className={css({ display: 'grid', gap: '1' })}>
      <span className={label}>{title}</span>
      <strong className={css({ fontFamily: 'mono', fontSize: '2xl', fontWeight: 'normal', lineHeight: '1', color: 'ink', fontVariantNumeric: 'tabular-nums' })}>{value}</strong>
      {note ? <small className={css({ fontSize: 'xs', color: 'inkMuted' })}>{note}</small> : null}
    </div>
  )
}
