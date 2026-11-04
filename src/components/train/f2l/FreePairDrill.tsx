import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { css, cx } from 'styled-system/css'
import { DASH } from '../../ui/Page'
import { generateFreePairPrompt, gradeFreePair, type FreePairMode, type FreePairPrompt } from '../../../domain/freePair'
import type { TrainerAttempt } from '../../../domain/models'
import { repositories } from '../../../storage/database'
import { Button } from '../../ui/Button'
import { freePairAttempt } from './attempts'
import { faceMoves } from './frame'
import { CubeStage, Key, Segmented, SessionStrip, focusRing, labelClass, numberClass, seconds, useKeys } from './parts'
import { SLOT_LABEL } from './queue'
import { readChoice, writeChoice } from './remember'
import { CHOICE_KEYS } from '../lookahead/positions'

const MODES: FreePairMode[] = ['normal', '2gen']
const MODE_LABEL: Record<FreePairMode, string> = { normal: 'Normal', '2gen': '2gen' }
const MODE_KEY = 'free-pair:mode'

const promptFor = (round: number, mode: FreePairMode) => generateFreePairPrompt(`free-pair-${String(round).padStart(3, '0')}`, mode)

const slotName = (prompt: FreePairPrompt) => SLOT_LABEL[prompt.slot].toLowerCase()

function explanation(prompt: FreePairPrompt, answer: number) {
  if (gradeFreePair(prompt, answer)) return `${prompt.options[answer]} leaves the ${slotName(prompt)} pair free: finish with ${prompt.finishes[answer]}.`
  const normal = prompt.mode === '2gen' ? prompt.normalFinishes[answer] : null
  if (normal) return `Free in normal mode with ${normal}, but 2gen rejects that finish.`
  return `The ${slotName(prompt)} pair is not free after ${prompt.options[answer]}.`
}

type Result = { success: boolean; ms: number }

export function FreePairDrill({ startRound }: { startRound?: number }) {
  const [mode, setMode] = useState<FreePairMode>(() => readChoice(MODE_KEY, MODES, 'normal'))
  const [round, setRound] = useState(() => startRound ?? 1 + Math.floor(Math.random() * 900))
  const prompt = useMemo(() => promptFor(round, mode), [round, mode])
  const [answer, setAnswer] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState(() => performance.now())
  const [results, setResults] = useState<Result[]>([])
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const nextButton = useRef<HTMLButtonElement>(null)

  const answered = answer !== null
  const working = prompt ? prompt.options.map((_, index) => gradeFreePair(prompt, index)) : []
  const shown = prompt && answered ? (working[answer] ? answer : working.findIndex(Boolean)) : -1
  const base = prompt ? `z2 ${prompt.setup}` : 'z2'
  const played = prompt && shown >= 0 ? [...faceMoves(prompt.options[shown]), ...faceMoves(prompt.finishes[shown] ?? '')].join(' ') : ''
  const setupAlg = playing && played ? `${base} ${played}` : base

  useEffect(() => {
    if (!answered) return
    nextButton.current?.focus()
    setPlaying(false)
    const timer = window.setTimeout(() => setPlaying(true), 450)
    return () => window.clearTimeout(timer)
  }, [answered, round])

  const nextPosition = () => {
    setAnswer(null)
    setPlaying(false)
    setRound((value) => value + 1)
    setStartedAt(performance.now())
  }

  const changeMode = (next: FreePairMode) => {
    if (next === mode) return
    writeChoice(MODE_KEY, next)
    setMode(next)
    setAnswer(null)
    setPlaying(false)
    setStartedAt(performance.now())
  }

  const pick = (index: number, input: TrainerAttempt['input']) => {
    if (!prompt || answered || index >= prompt.options.length) return
    const endedAt = performance.now()
    const attempt = freePairAttempt(prompt, index, startedAt, endedAt, input)
    setAnswer(index)
    setResults((current) => [...current, { success: Boolean(attempt.answerCorrect), ms: attempt.totalMs }])
    void repositories.attempts.put(attempt).catch(() => setError('Could not save this answer'))
  }

  const replay = () => {
    setPlaying(false)
    window.setTimeout(() => setPlaying(true), 350)
  }

  useKeys((event) => {
    if (!prompt) return false
    if (!answered) {
      const index = CHOICE_KEYS.indexOf(event.key)
      if (index < 0 || index >= prompt.options.length) return false
      pick(index, 'keyboard')
      return true
    }
    if (event.key === ' ' || event.key === 'Enter') {
      nextPosition()
      return true
    }
    return false
  })

  const correct = results.filter((result) => result.success).length
  const success = answered && prompt ? working[answer] : false

  return (
    <div className={css({ display: 'grid', gap: '6' })}>
      <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3' })}>
        <span className={labelClass}>Finishes</span>
        <Segmented label="Finishes" options={MODES} value={mode} onChange={changeMode} labels={MODE_LABEL} />
        <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{mode === '2gen' ? 'R and U turns only, free pair in back right.' : 'Any slot, any free insert.'}</span>
      </div>

      {prompt ? (
        <div className={css({ display: 'grid', gap: { base: '6', lg: '10' }, gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 5fr) minmax(0, 6fr)' }, alignItems: 'start' })}>
          <CubeStage setupAlg={setupAlg} caption={answered && shown >= 0 ? `Playing ${prompt.options[shown]}, then ${prompt.finishes[shown]}` : 'White cross on the bottom, front right pair to finish'} />

          <div className={css({ display: 'grid', gap: '5', alignContent: 'start' })}>
            <header className={css({ display: 'grid', gap: '1' })}>
              <span className={labelClass}>Case</span>
              <h2 className={css({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: 'semibold', letterSpacing: '-0.01em' })}>{prompt.caseName}</h2>
              <p className={css({ fontSize: 'md', color: 'ink' })}>Solve front right so the <strong className={css({ color: 'green', fontWeight: 'semibold' })}>{slotName(prompt)}</strong> pair is free.</p>
            </header>

            {answered ? (
              <section aria-live="polite" className={css({ display: 'grid', gap: '3', p: '4', borderRadius: 'card', bg: 'container', borderLeftWidth: '3px', borderColor: success ? 'green' : 'error' })}>
                <strong className={css({ fontSize: '3xl', lineHeight: '1', fontWeight: 'semibold', color: success ? 'green' : 'error' })}>{success ? 'Free' : 'Not free'}</strong>
                <p className={css({ fontSize: 'sm', color: 'ink' })}>{explanation(prompt, answer)}</p>
                <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>Working: <span className={numberClass}>{prompt.options.filter((_, index) => working[index]).join(' · ')}</span></p>
                <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3' })}>
                  <Button ref={nextButton} variant="solid" onClick={nextPosition}>Next position <Key>Space</Key></Button>
                  <Button variant="ghost" onClick={replay}>Replay</Button>
                </div>
              </section>
            ) : null}

            <div role="group" aria-label="Finish options" className={css({ display: 'grid', gap: '2', gridTemplateColumns: '1fr', maxW: '560px' })}>
              {prompt.options.map((option, index) => {
                const chosen = answer === index
                const works = answered && working[index]
                return (
                  <button
                    key={`${round}-${index}`}
                    type="button"
                    aria-label={`Option ${index + 1}, ${option}`}
                    aria-keyshortcuts={CHOICE_KEYS[index]}
                    disabled={answered}
                    onClick={(event: MouseEvent) => pick(index, event.detail === 0 ? 'keyboard' : 'pointer')}
                    className={css(
                      { display: 'flex', alignItems: 'center', gap: '3', minH: '12', px: '4', py: '2', textAlign: 'left', borderRadius: 'card', borderWidth: '1px', borderColor: 'floating', bg: 'container', color: 'ink', cursor: 'pointer', transition: 'border-color 0.12s ease', _hover: { borderColor: 'outline' }, _disabled: { cursor: 'default', _hover: { borderColor: 'floating' } }, ...focusRing },
                      answered && !chosen && !works && { opacity: '0.45' },
                      works && { borderColor: 'green', _disabled: { _hover: { borderColor: 'green' } } },
                      chosen && works && { bg: 'green', color: 'onGreen', borderColor: 'green' },
                      chosen && !works && { borderColor: 'error', borderWidth: '2px', color: 'error', _disabled: { _hover: { borderColor: 'error' } } }
                    )}
                  >
                    <span aria-hidden className={cx(numberClass, css({ display: 'grid', placeItems: 'center', w: '7', h: '7', flexShrink: 0, borderRadius: 'control', bg: 'surface', color: 'inkVariant', fontSize: 'xs' }))}>{index + 1}</span>
                    <span className={cx(numberClass, css({ fontSize: { base: 'md', md: 'lg' }, wordSpacing: '0.2em' }))}>{option}</span>
                  </button>
                )
              })}
            </div>

            {answered ? null : (
              <div className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3', color: 'inkVariant', fontSize: 'sm' })}>
                <span>Pick with <Key>1</Key> to <Key>{CHOICE_KEYS[Math.min(prompt.options.length, CHOICE_KEYS.length) - 1]}</Key></span>
                <Button variant="ghost" onClick={nextPosition}>Skip</Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={css({ display: 'grid', gap: '3', justifyItems: 'start' })}>
          <p>No position found for this seed.</p>
          <Button variant="solid" onClick={nextPosition}>New position</Button>
        </div>
      )}

      {error ? <p role="alert" className={css({ color: 'error', fontSize: 'sm' })}>{error}</p> : null}

      <SessionStrip
        stats={[
          { label: 'Attempts', value: results.length },
          { label: 'Accuracy', value: results.length ? `${Math.round((correct / results.length) * 100)}%` : DASH },
          { label: 'Mean answer', value: results.length ? `${seconds(results.reduce((sum, result) => sum + result.ms, 0) / results.length)} s` : DASH }
        ]}
        recent={results.slice(-8).map((result) => ({ success: result.success, label: `${result.success ? 'Free' : 'Not free'} in ${seconds(result.ms)} seconds`, text: seconds(result.ms) }))}
      />
    </div>
  )
}
