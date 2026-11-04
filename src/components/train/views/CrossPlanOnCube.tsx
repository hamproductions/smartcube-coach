import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KPattern } from 'cubing/kpuzzle'
import { css } from 'styled-system/css'
import { Button } from '../../ui/Button'
import { Cube3D } from '../../solve/Cube3D'
import { subscribeResolvedMoves, trackedPattern } from '../../../device/CubeConnection'
import { bestCross, goalReached } from '../../../domain/crossF2lPractice'
import { heldFrame, optimalCrossFrom } from '../../../domain/crossPlan'
import { patternToPlayerAlg } from '../../../domain/cubedex/scramble'
import { useRoutedScramble } from '../useRoutedScramble'

const PAUSE_MS = 500

type Phase = 'scrambling' | 'inspecting' | 'solving' | 'done'
type Turn = { move: string; at: number }
type Result = { ms: number; inspectionMs: number; turns: number; shortest?: number; pauses: number; longestPauseMs: number; shortestCross?: string[]; start: KPattern }

const seconds = (ms: number) => (ms / 1000).toFixed(2)

export function CrossPlanOnCube({ rotation, bottomColour }: { rotation: string; bottomColour: string }) {
  const frame = useMemo(() => heldFrame(rotation), [rotation])
  const { scramble, generate, follow } = useRoutedScramble()
  const [phase, setPhase] = useState<Phase>('scrambling')
  const [now, setNow] = useState(() => performance.now())
  const [result, setResult] = useState<Result>()
  const [history, setHistory] = useState<Result[]>([])
  const run = useRef<{ phase: Phase; readyAt: number; start?: KPattern; turns: Turn[] }>({ phase: 'scrambling', readyAt: 0, turns: [] })

  const setRunPhase = useCallback((next: Phase) => { run.current.phase = next; setPhase(next) }, [])

  const nextScramble = useCallback(() => {
    run.current = { phase: 'scrambling', readyAt: 0, turns: [] }
    setPhase('scrambling')
    void generate()
  }, [generate])

  useEffect(() => { nextScramble() }, [nextScramble])

  const finish = useCallback(async (endedAt: number) => {
    const { turns, readyAt, start } = run.current
    if (!start) return
    setRunPhase('done')
    const gaps = turns.slice(1).map((turn, index) => turn.at - turns[index].at)
    const [best, solution] = await Promise.all([bestCross(start, frame.bottom), optimalCrossFrom(start, frame)])
    const entry: Result = {
      ms: endedAt - turns[0].at,
      inspectionMs: turns[0].at - readyAt,
      turns: turns.length,
      shortest: best?.turns,
      pauses: gaps.filter((gap) => gap >= PAUSE_MS).length,
      longestPauseMs: gaps.length ? Math.max(...gaps) : 0,
      shortestCross: solution,
      start
    }
    setResult(entry)
    setHistory((existing) => [...existing, entry].slice(-50))
  }, [frame, setRunPhase])

  useEffect(() => subscribeResolvedMoves((resolved) => {
    const state = run.current
    const at = performance.now()
    if (state.phase === 'scrambling') {
      const followed = follow(resolved.pattern)
      if (followed?.complete) {
        state.start = resolved.pattern
        state.readyAt = at
        setRunPhase('inspecting')
      }
      return
    }
    if (state.phase === 'done') return
    if (state.phase === 'inspecting') setRunPhase('solving')
    state.turns.push(...resolved.rawMoves.map((raw) => ({ move: raw.move, at })))
    if (goalReached(resolved.pattern, { pairs: 0, face: frame.bottom })) void finish(at)
  }), [follow, finish, frame, setRunPhase])

  useEffect(() => {
    if (phase !== 'solving' && phase !== 'inspecting') return
    let id = 0
    const tick = () => { setNow(performance.now()); id = requestAnimationFrame(tick) }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [phase])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (phase === 'done' && (event.code === 'Space' || event.key === 'Enter')) { event.preventDefault(); nextScramble() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, nextScramble])

  const clock = phase === 'solving' && run.current.turns[0] ? now - run.current.turns[0].at : phase === 'done' && result ? result.ms : 0
  const inspecting = phase === 'inspecting' ? now - run.current.readyAt : undefined
  const solved = history.length
  const extras = history.filter((entry) => entry.shortest !== undefined)
  const averageExtra = extras.length ? extras.reduce((total, entry) => total + entry.turns - (entry.shortest ?? 0), 0) / extras.length : undefined
  const cubeAlg = (() => {
    const live = trackedPattern()
    if (phase === 'done' && result?.shortestCross) {
      try { return [patternToPlayerAlg(result.start), ...result.shortestCross.map(frame.toCube)].join(' ') } catch { return '' }
    }
    try { return live ? patternToPlayerAlg(live) : '' } catch { return '' }
  })()

  return (
    <div className={css({ display: 'grid', gap: '8', gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1fr) 20rem' }, alignItems: 'start' })}>
      <section aria-label="Plan on the cube" className={css({ display: 'flex', flexDirection: 'column', gap: '5', minW: '0' })}>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
          <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{phase === 'scrambling' ? 'Turn this from where your cube is, white top and green front' : 'Scramble'}</span>
          <p aria-label="Scramble" className={css({ fontFamily: 'mono', fontSize: { base: '20px', md: '24px' }, lineHeight: '1.5', minH: '9', display: 'flex', flexWrap: 'wrap', columnGap: '2.5' })}>
            {scramble ? scramble.moves.map((move, index) => (
              <span key={`${move}-${index}`} className={css({ opacity: phase === 'scrambling' && index < scramble.done ? '0.3' : '1', color: phase === 'scrambling' && index === scramble.done && !scramble.offTrack ? 'green' : 'ink' })}>{move}</span>
            )) : <span className={css({ color: 'inkVariant', fontSize: 'md' })}>Working out a scramble from your cube...</span>}
          </p>
          <p role="status" className={css({ fontSize: 'sm', color: scramble?.offTrack && phase === 'scrambling' ? 'amber' : 'inkVariant' })}>
            {phase === 'scrambling' ? (scramble?.offTrack ? 'Off the scramble. Undo the last turn.' : 'Scramble the cube. Nothing is timed yet.')
              : phase === 'inspecting' ? `Hold it with the ${bottomColour} cross on the bottom. Plan the whole cross, then turn it without stopping. The clock starts on your first turn.`
                : phase === 'solving' ? 'Turning. The clock stops when the cross is solved.'
                  : 'Done. Space for the next scramble.'}
          </p>
        </div>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
          <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>Time</span>
          <strong data-testid="cross-plan-clock" className={css({ fontFamily: 'mono', fontSize: { base: '64px', md: '96px' }, fontWeight: 'semibold', lineHeight: '0.9', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', color: phase === 'done' ? 'green' : 'ink' })}>{seconds(clock)}</strong>
          {inspecting !== undefined && <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: inspecting > 15_000 ? 'amber' : 'inkVariant' })}>Inspecting {Math.floor(inspecting / 1000)}s</span>}
        </div>

        {phase === 'done' && result && (
          <section aria-label="Verdict" aria-live="polite" className={css({ display: 'flex', flexDirection: 'column', gap: '3', p: '5', borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: 'floating' })}>
            <div className={css({ display: 'grid', gap: '4', gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } })}>
              <Stat title="Your turns" value={String(result.turns)} tone={result.shortest !== undefined && result.turns <= result.shortest ? 'good' : undefined} />
              <Stat title="Shortest" value={result.shortest === undefined ? '–' : String(result.shortest)} />
              <Stat title="Pauses" value={String(result.pauses)} tone={result.pauses === 0 ? 'good' : 'bad'} />
              <Stat title="Inspection" value={`${seconds(result.inspectionMs)}s`} tone={result.inspectionMs > 15_000 ? 'bad' : undefined} />
            </div>
            <p className={css({ fontSize: 'sm' })}>
              {result.pauses === 0
                ? (result.shortest !== undefined && result.turns > result.shortest + 2 ? `Planned all the way, but ${result.turns - result.shortest} turns over the shortest. Look for a shorter cross in inspection.` : 'Planned all the way through with no stops.')
                : `You stopped ${result.pauses} time${result.pauses === 1 ? '' : 's'} (longest ${seconds(result.longestPauseMs)}s), so part of the cross was found while turning, not planned.`}
            </p>
            {result.shortestCross && result.shortestCross.length > 0 && (
              <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>Shortest cross, playing on the cube: <span className={css({ fontFamily: 'mono', color: 'ink' })}>{result.shortestCross.join(' ')}</span></p>
            )}
            <div><Button variant="solid" onClick={nextScramble}>Next scramble <kbd className={css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7' })}>Space</kbd></Button></div>
          </section>
        )}
        {phase !== 'done' && <div><Button variant="ghost" onClick={nextScramble}>New scramble</Button></div>}
      </section>

      <aside aria-label="Cube and session" className={css({ display: 'flex', flexDirection: 'column', gap: '6', order: { base: '-1', lg: '0' } })}>
        <div className={css({ aspectRatio: '1', w: 'full', maxW: { base: '13rem', lg: '20rem' }, mx: 'auto' })}>
          <Cube3D gyro viewRotation={rotation} setupAlg={cubeAlg} />
        </div>
        <section aria-label="Session" className={css({ display: 'flex', gap: '6' })}>
          <Stat title="Crosses" value={String(solved)} />
          <Stat title="No-pause crosses" value={solved ? `${Math.round((history.filter((entry) => entry.pauses === 0).length / solved) * 100)}%` : '–'} />
          <Stat title="Extra turns" value={averageExtra === undefined ? '–' : averageExtra.toFixed(1)} />
        </section>
      </aside>
    </div>
  )
}

function Stat({ title, value, tone }: { title: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
      <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{title}</span>
      <strong className={css({ fontFamily: 'mono', fontSize: 'xl', fontWeight: 'medium', fontVariantNumeric: 'tabular-nums', color: tone === 'good' ? 'green' : tone === 'bad' ? 'amber' : 'ink' })}>{value}</strong>
    </div>
  )
}
