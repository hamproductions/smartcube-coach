import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import type { TrainerAttempt } from '../../../domain/models'
import { repositories } from '../../../storage/database'
import { Cube3D } from '../../solve/Cube3D'
import { Button } from '../../ui/Button'
import type { AnswerInput, AttemptTiming } from './attempt'
import { PaceControl } from './PaceControl'
import { LEAD_MS, PACE_MS, readPace, readRound, writePace, writeRound, type Pace } from './remember'
import { SessionStrip, type SessionResult } from './SessionStrip'

export type Phase = 'ready' | 'lead' | 'playing' | 'answer' | 'verdict'

export type LookaheadRound = {
  seed: string
  moves: string[]
  target: string
  pieces?: string[]
  question: string
  expected: string
  grade: (answer: string) => boolean
  label: (answer: string) => string
  attempt: (answer: string, success: boolean, timing: AttemptTiming) => TrainerAttempt
}

export type Verdict = { answer: string; success: boolean; ms: number }

export type AnswerProps<R extends LookaheadRound> = { round: R; active: boolean; verdict?: Verdict; onAnswer: (answer: string, input: AnswerInput) => void }

export type StageProps<R extends LookaheadRound> = { round: R; phase: Phase; verdict?: Verdict; size: number }

type DrillProps<R extends LookaheadRound> = {
  trainerId: string
  createRound: (round: number) => R
  renderAnswer: (props: AnswerProps<R>) => ReactNode
  renderStage?: (props: StageProps<R>) => ReactNode
}

const kbdClass = css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7' })

function useWidth() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export function LookaheadDrill<R extends LookaheadRound>({ trainerId, createRound, renderAnswer, renderStage }: DrillProps<R>) {
  const [roundNumber, setRoundNumber] = useState(() => readRound(trainerId))
  const round = useMemo(() => createRound(roundNumber), [createRound, roundNumber])
  const paced = round.moves.length > 0
  const [phase, setPhase] = useState<Phase>(paced ? 'ready' : 'answer')
  const [pace, setPace] = useState<Pace>(readPace)
  const [played, setPlayed] = useState(0)
  const [replayed, setReplayed] = useState<number | null>(null)
  const [verdict, setVerdict] = useState<Verdict>()
  const [results, setResults] = useState<SessionResult[]>([])
  const [saveError, setSaveError] = useState('')
  const startedAt = useRef(performance.now())
  const answerOpenedAt = useRef(performance.now())
  const nextButton = useRef<HTMLButtonElement | null>(null)
  const [stageRef, stageWidth] = useWidth()
  const cubeSize = Math.round(Math.min(stageWidth || 280, stageWidth && stageWidth < 480 ? 220 : 320))
  const total = round.moves.length

  const start = useCallback(() => {
    setVerdict(undefined)
    setReplayed(null)
    setSaveError('')
    if (paced) {
      setPlayed(0)
      setPhase('lead')
      return
    }
    startedAt.current = performance.now()
    answerOpenedAt.current = startedAt.current
    setPhase('answer')
  }, [paced])

  const next = useCallback(() => {
    setRoundNumber((value) => value + 1)
    start()
  }, [start])

  const replay = useCallback(() => setReplayed(0), [])

  const answer = useCallback((value: string, input: AnswerInput) => {
    if (phase !== 'answer') return
    const endedAt = performance.now()
    const success = round.grade(value)
    const ms = endedAt - answerOpenedAt.current
    const attempt = round.attempt(value, success, { input, startedAt: startedAt.current, answerOpenedAt: answerOpenedAt.current, endedAt })
    setVerdict({ answer: value, success, ms })
    setResults((current) => [...current, { success, ms }])
    setReplayed(paced ? 0 : null)
    setPhase('verdict')
    writeRound(trainerId, roundNumber + 1)
    repositories.attempts.put(attempt).catch((error: unknown) => setSaveError(error instanceof Error ? error.message : String(error)))
  }, [phase, round, paced, trainerId, roundNumber])

  useEffect(() => {
    if (phase === 'lead') {
      const timer = setTimeout(() => {
        startedAt.current = performance.now()
        setPlayed(1)
        setPhase('playing')
      }, LEAD_MS[pace])
      return () => clearTimeout(timer)
    }
    if (phase === 'playing') {
      const timer = setTimeout(() => {
        if (played < total) {
          setPlayed(played + 1)
          return
        }
        answerOpenedAt.current = performance.now()
        setPhase('answer')
      }, PACE_MS[pace])
      return () => clearTimeout(timer)
    }
    if (phase === 'verdict' && replayed !== null && replayed < total) {
      const timer = setTimeout(() => setReplayed(replayed + 1), replayed === 0 ? 600 : PACE_MS[pace])
      return () => clearTimeout(timer)
    }
  }, [phase, played, replayed, pace, total])

  useEffect(() => {
    if (phase === 'verdict') nextButton.current?.focus({ preventScroll: true })
  }, [phase])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return
      if (event.key === ' ' || event.key === 'Enter') {
        if (phase === 'ready') start()
        else if (phase === 'verdict') next()
        else return
        event.preventDefault()
        return
      }
      if ((event.key === 'r' || event.key === 'R') && phase === 'verdict' && paced) {
        event.preventDefault()
        replay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, paced, start, next, replay])

  const changePace = (value: Pace) => {
    setPace(value)
    writePace(value)
  }

  const shown = phase === 'playing' ? played : phase === 'answer' ? total : phase === 'verdict' ? (replayed ?? total) : 0
  const setupAlg = round.moves.slice(0, shown).join(' ')
  const hidden = phase === 'answer'
  const highlight = phase === 'playing' ? played - 1 : phase === 'verdict' && replayed !== null && replayed < total ? replayed - 1 : -1

  const status = {
    ready: 'Start position',
    lead: 'Get ready',
    playing: `Move ${played} of ${total}`,
    answer: `${total} moves played`,
    verdict: replayed !== null && replayed < total ? `Replay ${replayed} of ${total}` : 'Final position'
  }[phase]

  return (
    <div className={css({ display: 'grid', gap: '6' })}>
      <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4' })}>
        <SessionStrip results={results} />
        {paced ? <div className={hidden ? css({ display: { base: 'none', lg: 'block' } }) : undefined}><PaceControl pace={pace} onChange={changePace} /></div> : null}
      </div>

      <div className={css({ display: 'grid', gap: { base: '5', lg: '10' }, gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 360px) minmax(0, 1fr)' }, alignItems: 'start' })}>
        <section aria-label="Cube" ref={stageRef} className={css(css.raw({ display: 'grid', gap: '3', justifyItems: { base: 'center', lg: 'start' }, minW: '0' }), hidden && !renderStage ? css.raw({ display: { base: 'none', lg: 'grid' } }) : undefined)}>
          <div className={css({ display: 'grid', gap: '0.5', justifySelf: 'stretch' })}>
            <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{paced ? 'Track' : 'Corner'}</span>
            <strong data-testid="lookahead-target" className={css({ fontFamily: 'mono', fontSize: 'xl', fontWeight: 'semibold', color: 'green' })}>{round.target}</strong>
          </div>

          {renderStage ? (
            renderStage({ round, phase, verdict, size: cubeSize })
          ) : (
            <div className={css({ position: 'relative' })} style={{ width: cubeSize, height: cubeSize }}>
              <div aria-hidden={hidden} className={css({ transition: 'opacity 0.2s ease' })} style={{ opacity: hidden ? 0 : 1 }}>
                <Cube3D setupAlg={setupAlg} size={cubeSize} highlight={round.pieces} />
              </div>
              {hidden ? <div className={css({ position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', borderRadius: 'card', borderWidth: '1px', borderStyle: 'dashed', borderColor: 'floating', color: 'inkVariant', fontSize: 'sm' })}>Cube hidden</div> : null}
            </div>
          )}

          {paced && phase !== 'ready' ? (
            <div className={css({ display: 'grid', gap: '1.5', justifySelf: 'stretch' })}>
              <span aria-live="polite" className={css({ fontSize: 'xs', color: 'inkVariant', fontVariantNumeric: 'tabular-nums' })}>{status}</span>
              <ol aria-label="Moves" className={css({ display: 'flex', flexWrap: 'wrap', gap: '1', listStyle: 'none', p: '0', m: '0', minH: '8' })}>
                {round.moves.map((move, index) => {
                  const visible = phase === 'verdict' || (phase === 'playing' && index < played)
                  return (
                    <li
                      key={index}
                      className={css(css.raw({ minW: '8', h: '8', px: '1.5', display: 'grid', placeItems: 'center', borderRadius: 'control', fontFamily: 'mono', fontSize: 'sm', borderWidth: '1px', borderColor: 'floating', color: 'inkVariant' }), visible ? undefined : css.raw({ borderStyle: 'dashed', color: 'transparent' }), index === highlight ? css.raw({ bg: 'floating', color: 'ink', borderColor: 'outline' }) : undefined)}
                    >
                      {visible ? move : '·'}
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : null}
        </section>

        <section aria-label="Answer" className={css(css.raw({ display: 'grid', gap: '5', alignContent: 'start', minW: '0' }), phase === 'verdict' ? css.raw({ order: { base: '-1', lg: '0' } }) : undefined)}>
          {phase === 'ready' ? (
            <div className={css({ display: 'grid', gap: '4', justifyItems: 'start' })}>
              <p className={css({ fontSize: 'md', color: 'ink' })}>Find it on the cube. The moves play once, then the cube hides.</p>
              <Button variant="solid" onClick={start}>Start <kbd className={kbdClass}>Space</kbd></Button>
            </div>
          ) : null}

          {phase === 'lead' || phase === 'playing' ? <p className={css({ fontSize: { base: 'lg', md: 'xl' }, fontWeight: 'semibold', color: 'inkVariant' })}>Watch the {round.target}.</p> : null}

          {phase === 'answer' ? <h2 data-testid="lookahead-question" className={css({ fontSize: { base: 'lg', md: 'xl' }, fontWeight: 'semibold' })}>{round.question}</h2> : null}

          {phase === 'verdict' && verdict ? (
            <div className={css({ display: 'grid', gap: '3' })}>
              <div className={css({ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '4', rowGap: '1' })}>
                <h2 data-testid="lookahead-verdict" className={cx(css({ fontSize: '3xl', fontWeight: 'semibold', letterSpacing: '-0.02em' }), verdict.success ? css({ color: 'green' }) : css({ color: 'error' }))}>{verdict.success ? 'Right' : 'Wrong'}</h2>
                <span className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant', fontVariantNumeric: 'tabular-nums' })}>{(verdict.ms / 1000).toFixed(2)} s</span>
              </div>
              <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>
                Answer <strong className={css({ fontFamily: 'mono', color: 'ink' })}>{round.label(round.expected)}</strong>
                {verdict.success ? null : <> · you picked <strong className={css({ fontFamily: 'mono', color: 'error' })}>{round.label(verdict.answer)}</strong></>}
              </p>
              <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
                <Button ref={nextButton} variant="solid" onClick={next}>Next <kbd className={kbdClass}>Space</kbd></Button>
                {paced ? <Button variant="ghost" onClick={replay}>Replay <kbd className={kbdClass}>R</kbd></Button> : null}
              </div>
              {saveError ? <p role="alert" className={css({ fontSize: 'sm', color: 'error' })}>Could not save this attempt: {saveError}</p> : null}
            </div>
          ) : null}

          {phase !== 'ready' ? (
            <div className={phase === 'verdict' ? css({ display: { base: 'none', lg: 'block' } }) : undefined}>
              {renderAnswer({ round, active: phase === 'answer', verdict: phase === 'verdict' ? verdict : undefined, onAnswer: answer })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
