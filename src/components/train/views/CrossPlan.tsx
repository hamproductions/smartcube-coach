import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { Button } from '../../ui/Button'
import { Cube3D } from '../../solve/Cube3D'
import { viewRotationForHold } from '../../../domain/cubeHold'
import { gradeCrossPlan, heldFrame, optimalCrossPlan, parsePlan } from '../../../domain/crossPlan'
import { generateScramble } from '../../../domain/scramble'
import { createId } from '../../../domain/ids'
import { defaultPreferences, readPreferences } from '../../../storage/preferences'
import { repositories } from '../../../storage/database'
import type { TrainerAttempt } from '../../../domain/models'
import { useOptionalCubeConnection } from '../../../device/CubeConnection'
import { CrossPlanOnCube } from './CrossPlanOnCube'

const INSPECTION_MS = 15_000
const PAD_FACES = ['U', 'D', 'R', 'L', 'F', 'B']
const PAD_SUFFIXES = ['', "'", '2']

type Verdict = { solved: boolean; yours: number; optimal?: number; solution?: string[] }
type Round = { scramble: string; startedAt?: number }

const padButton = css({
  minH: '44px', minW: '0', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'container',
  fontFamily: 'mono', fontSize: 'md', color: 'ink', cursor: 'pointer', _hover: { bg: 'floating' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '1px' }, _disabled: { opacity: '0.4', cursor: 'default' }
})

export function CrossPlanTrainer() {
  const connected = Boolean(useOptionalCubeConnection()?.handle)
  const [rotation, setRotation] = useState(viewRotationForHold(defaultPreferences.diagramTopColor, defaultPreferences.diagramFrontColor))
  const [bottomColour, setBottomColour] = useState('white')
  useEffect(() => {
    void readPreferences().then((prefs) => {
      setRotation(viewRotationForHold(prefs.diagramTopColor, prefs.diagramFrontColor))
      setBottomColour(OPPOSITE_COLOUR[prefs.diagramTopColor] ?? 'white')
    }).catch(() => undefined)
  }, [])
  return connected ? <CrossPlanOnCube rotation={rotation} bottomColour={bottomColour} /> : <CrossPlanTyped />
}

function CrossPlanTyped() {
  const [rotation, setRotation] = useState(viewRotationForHold(defaultPreferences.diagramTopColor, defaultPreferences.diagramFrontColor))
  const [bottomColour, setBottomColour] = useState('white')
  const [round, setRound] = useState<Round | null>(null)
  const [plan, setPlan] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(() => performance.now())
  const [history, setHistory] = useState<Verdict[]>([])
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const frame = useMemo(() => heldFrame(rotation), [rotation])

  const next = useCallback(async () => {
    setVerdict(null)
    setPlan('')
    setError(undefined)
    setRound(null)
    try {
      const scramble = await generateScramble()
      setRound({ scramble })
    } catch {
      setError('Could not make a scramble. Reload the page and try again.')
    }
  }, [])

  useEffect(() => {
    void readPreferences().then((prefs) => {
      setRotation(viewRotationForHold(prefs.diagramTopColor, prefs.diagramFrontColor))
      setBottomColour(OPPOSITE_COLOUR[prefs.diagramTopColor] ?? 'white')
    }).catch(() => undefined)
    void next()
  }, [next])

  const beginInspection = useCallback(() => {
    setRound((current) => current && current.startedAt === undefined ? { ...current, startedAt: performance.now() } : current)
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }))
  }, [])

  useEffect(() => {
    if (!round || round.startedAt === undefined || verdict) return
    let frameId = 0
    const tick = () => { setNow(performance.now()); frameId = requestAnimationFrame(tick) }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [round, verdict])

  const moves = parsePlan(plan)

  const check = useCallback(async () => {
    if (!round || verdict || checking) return
    const parsed = parsePlan(plan)
    if (!parsed || parsed.length === 0) { setError('Enter the cross as moves, for example F R D2 L.'); return }
    setChecking(true)
    setError(undefined)
    const endedAt = performance.now()
    const startedAt = round.startedAt ?? endedAt
    const [graded, solution] = await Promise.all([gradeCrossPlan(round.scramble, parsed, frame), optimalCrossPlan(round.scramble, frame)])
    const result: Verdict = { solved: graded.solved, yours: parsed.length, optimal: graded.optimal, solution }
    setVerdict(result)
    setHistory((existing) => [...existing, result].slice(-50))
    setChecking(false)
    const attempt: TrainerAttempt = {
      id: createId(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: 'cross-inspection',
      caseVersion: 1,
      family: 'inspection',
      protocol: 'inspection-only',
      curriculumMode: 'drill',
      setup: { seed: round.scramble, generatorId: 'random-state-scramble', generatorVersion: '1', caseId: 'cross-inspection', scramble: round.scramble, constraintHash: `cross-${frame.bottom}` },
      input: 'keyboard',
      startedAt,
      endedAt,
      phaseEvents: [{ phase: 'prompt', at: startedAt, source: 'system' }, { phase: 'grading', at: endedAt, source: 'user' }],
      inspectionMs: endedAt - startedAt,
      totalMs: endedAt - startedAt,
      outcome: graded.solved ? 'success' : 'incorrect',
      answer: parsed.join(' '),
      answerCorrect: graded.solved,
      hintEvents: [],
      wrongMoves: 0,
      divergenceCount: 0,
      correctionMoveCount: 0,
      rawEventIds: [],
      targetSatisfied: graded.solved,
      dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: ['State-success cross predicate'] },
      schemaVersion: 1
    }
    void repositories.attempts.put(attempt).catch(() => undefined)
  }, [round, verdict, checking, plan, frame])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (verdict && (event.code === 'Space' || event.key === 'Enter')) {
        event.preventDefault()
        void next()
        return
      }
      if (round && round.startedAt === undefined && event.code === 'Space') {
        event.preventDefault()
        beginInspection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [verdict, next, round, beginInspection])

  const remainingMs = round && round.startedAt !== undefined && !verdict ? INSPECTION_MS - (now - round.startedAt) : undefined
  const solvedCount = history.filter((entry) => entry.solved).length
  const extra = history.filter((entry) => entry.solved && entry.optimal !== undefined)
  const averageExtra = extra.length ? extra.reduce((total, entry) => total + entry.yours - (entry.optimal ?? 0), 0) / extra.length : undefined
  const shownSolution = verdict?.solution ?? []
  const cubeAlg = round ? [round.scramble, ...(verdict ? shownSolution.map(frame.toCube) : [])].join(' ') : ''

  return (
    <div className={css({ display: 'grid', gap: '8', gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1fr) 20rem' }, alignItems: 'start' })}>
      <section aria-label="Plan" className={css({ display: 'flex', flexDirection: 'column', gap: '5', minW: '0' })}>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
          <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>Scramble, white top and green front</span>
          <p aria-label="Scramble" className={css({ fontFamily: 'mono', fontSize: { base: '20px', md: '24px' }, lineHeight: '1.5', minH: '9' })}>
            {round ? round.scramble : error ? '' : 'Making a scramble…'}
          </p>
          <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>Hold it with the {bottomColour} cross on the bottom, as the cube shows, and plan the whole cross before you turn.</p>
        </div>

        {!verdict && round && round.startedAt === undefined && (
          <div><Button variant="solid" onClick={beginInspection}>Start inspection <kbd className={css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7' })}>Space</kbd></Button></div>
        )}
        {!verdict && round?.startedAt !== undefined && (
          <div className={css({ display: 'flex', alignItems: 'baseline', gap: '3' })}>
            <span aria-label="Inspection" className={css({ fontFamily: 'mono', fontSize: { base: '48px', md: '64px' }, fontWeight: 'semibold', lineHeight: '1', fontVariantNumeric: 'tabular-nums', color: remainingMs !== undefined && remainingMs < 0 ? 'amber' : 'ink' })}>
              {remainingMs === undefined ? '15.0' : (Math.abs(remainingMs) / 1000).toFixed(1)}
            </span>
            <span className={css({ fontSize: 'sm', color: remainingMs !== undefined && remainingMs < 0 ? 'amber' : 'inkVariant' })}>{remainingMs !== undefined && remainingMs < 0 ? 'over inspection' : 'inspection left'}</span>
          </div>
        )}

        {!verdict ? (
          <form onSubmit={(event) => { event.preventDefault(); void check() }} className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
            <label className={css({ display: 'flex', flexDirection: 'column', gap: '1.5', fontSize: 'sm' })}>
              Your cross
              <input
                ref={input}
                aria-label="Cross plan"
                value={plan}
                onChange={(event) => { setPlan(event.target.value); setError(undefined) }}
                placeholder="F R D2 L"
                autoComplete="off"
                spellCheck={false}
                className={css({ fontFamily: 'mono', fontSize: 'lg', px: '4', minH: '12', borderRadius: 'control', bg: 'container', borderWidth: '1px', borderColor: moves === undefined && plan.trim() ? 'error' : 'floating', color: 'ink', _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}
              />
            </label>
            <div role="group" aria-label="Move pad" className={css({ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '1.5' })}>
              {PAD_SUFFIXES.flatMap((suffix) => PAD_FACES.map((face) => `${face}${suffix}`)).map((move) => (
                <button key={move} type="button" className={padButton} onMouseDown={(event) => event.preventDefault()} onClick={() => { setPlan((current) => `${current.trim()} ${move}`.trim()); input.current?.focus({ preventScroll: true }) }}>{move}</button>
              ))}
            </div>
            <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
              <Button type="submit" variant="solid" disabled={!round || checking || !plan.trim()}>{checking ? 'Checking…' : 'Check plan'} <kbd className={css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7' })}>Enter</kbd></Button>
              <Button type="button" variant="outline" disabled={!plan.trim()} onClick={() => setPlan((current) => current.trim().split(/\s+/).slice(0, -1).join(' '))}>Undo move</Button>
              <Button type="button" variant="ghost" onClick={() => void next()}>Skip</Button>
            </div>
            {error && <p role="alert" className={css({ color: 'error', fontSize: 'sm' })}>{error}</p>}
          </form>
        ) : (
          <section aria-label="Verdict" aria-live="polite" className={css({ display: 'flex', flexDirection: 'column', gap: '3', p: '5', borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: verdict.solved ? 'green' : 'floating' })}>
            <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold', color: verdict.solved ? 'green' : 'error' })}>{verdict.solved ? 'Cross solved' : 'Cross not solved'}</h2>
            <p className={css({ fontFamily: 'mono', fontSize: 'sm' })}>
              Your plan: {verdict.yours} move{verdict.yours === 1 ? '' : 's'}{verdict.optimal !== undefined ? ` · shortest: ${verdict.optimal}` : ''}
            </p>
            {shownSolution.length > 0 && (
              <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>Shortest cross, playing on the cube: <span className={css({ fontFamily: 'mono', color: 'ink' })}>{shownSolution.join(' ')}</span></p>
            )}
            <div>
              <Button variant="solid" onClick={() => void next()}>Next scramble <kbd className={css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7' })}>Space</kbd></Button>
            </div>
          </section>
        )}
      </section>

      <aside aria-label="Cube and session" className={css({ display: 'flex', flexDirection: 'column', gap: '6', order: { base: '-1', lg: '0' } })}>
        <div className={css({ aspectRatio: '1', w: 'full', maxW: { base: '13rem', lg: '20rem' }, mx: 'auto' })}>
          <Cube3D viewRotation={rotation} setupAlg={cubeAlg} />
        </div>
        <section aria-label="Session" className={css({ display: 'flex', gap: '6' })}>
          <Stat title="Plans" value={String(history.length)} />
          <Stat title="Solved" value={history.length ? `${Math.round((solvedCount / history.length) * 100)}%` : '–'} />
          <Stat title="Extra moves" value={averageExtra === undefined ? '–' : averageExtra.toFixed(1)} />
        </section>
      </aside>
    </div>
  )
}

const OPPOSITE_COLOUR: Record<string, string> = { white: 'yellow', yellow: 'white', green: 'blue', blue: 'green', red: 'orange', orange: 'red' }

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
      <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{title}</span>
      <strong className={css({ fontFamily: 'mono', fontSize: 'xl', fontWeight: 'medium', fontVariantNumeric: 'tabular-nums' })}>{value}</strong>
    </div>
  )
}
