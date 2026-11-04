import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { Cube3D } from '../../solve/Cube3D'
import { generateBldDrill } from '../../../domain/bld'
import { repositories } from '../../../storage/database'
import { buildAttempts } from './attempts'
import { MemoClock } from './MemoClock'
import { bufferPieces, gradeParts, STEPS, toPairs, type Answers, type Part, type StepInput } from './memo'
import { SessionStrip, type RoundResult } from './SessionStrip'
import { Settings } from './Settings'
import { DEFAULT_CONFIG, loadConfig, readRound, readSettingsOpen, saveConfig, seedForRound, writeRound, writeSettingsOpen, type BldConfig } from './config'
import { StepForm } from './StepForm'
import { labelClass } from './ui'
import { Verdict } from './Verdict'

const HIDDEN_SIDE = "x2 y'"

type Result = { parts: Part[]; memoMs: number; endedAt: number }

const finePointer = () => typeof window.matchMedia !== 'function' || window.matchMedia('(pointer: fine)').matches

function isTyping(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function MemoTrainer() {
  const [config, setConfig] = useState<BldConfig>(DEFAULT_CONFIG)
  const [round, setRound] = useState(readRound)
  const [startedAt, setStartedAt] = useState(() => performance.now())
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [history, setHistory] = useState<RoundResult[]>([])
  const [settingsOpen, setSettingsOpen] = useState(readSettingsOpen)
  const stepTarget = useRef<HTMLInputElement | HTMLDivElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const firstFocus = useRef(true)

  const drill = useMemo(() => generateBldDrill(seedForRound(round), config.buffer, config.letterScheme), [round, config])
  const buffer = useMemo(() => bufferPieces(drill), [drill])
  const step = STEPS[stepIndex]

  const reset = useCallback(() => {
    setStepIndex(0)
    setAnswers({})
    setDraft('')
    setResult(null)
    setStartedAt(performance.now())
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadConfig().then((loaded) => {
      if (cancelled || (loaded.buffer === DEFAULT_CONFIG.buffer && loaded.letterScheme === DEFAULT_CONFIG.letterScheme)) return
      setConfig(loaded)
      reset()
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [reset])

  useEffect(() => {
    if (result) {
      nextButton.current?.focus({ preventScroll: true })
      return
    }
    if (firstFocus.current && !finePointer()) {
      firstFocus.current = false
      return
    }
    firstFocus.current = false
    stepTarget.current?.focus({ preventScroll: true })
  }, [stepIndex, result, round, config])

  const finish = useCallback((final: Answers) => {
    const endedAt = final.twists?.at ?? performance.now()
    const parts = gradeParts(drill, final)
    const memoMs = endedAt - startedAt
    setResult({ parts, memoMs, endedAt })
    const partsRight = parts.filter((part) => part.right).length
    setHistory((existing) => [...existing, { allRight: partsRight === parts.length, partsRight, parts: parts.length, memoMs }].slice(-100))
    writeRound(round + 1)
    for (const attempt of buildAttempts(drill, final, parts, startedAt)) void repositories.attempts.put(attempt).catch(() => undefined)
  }, [drill, startedAt, round])

  const submitStep = useCallback((value: string, input: StepInput) => {
    if (result) return
    const normalized = step.kind === 'memo' ? toPairs(value).join(' ') : value.trim()
    const nextAnswers = { ...answers, [step.id]: { value: normalized, at: performance.now(), input } }
    setAnswers(nextAnswers)
    if (stepIndex === STEPS.length - 1) {
      finish(nextAnswers)
      return
    }
    setStepIndex(stepIndex + 1)
    setDraft(nextAnswers[STEPS[stepIndex + 1].id]?.value ?? '')
  }, [answers, finish, result, step, stepIndex])

  const back = useCallback(() => {
    if (stepIndex === 0 || result) return
    setStepIndex(stepIndex - 1)
    setDraft(answers[STEPS[stepIndex - 1].id]?.value ?? '')
  }, [answers, result, stepIndex])

  const next = useCallback(() => {
    setRound(round + 1)
    writeRound(round + 1)
    reset()
  }, [reset, round])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target)) return
      if (result) {
        if (event.target instanceof Element && event.target.closest('button, a')) return
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          next()
        }
        return
      }
      if (step.kind === 'yes-no') {
        const key = event.key.toLowerCase()
        if (key === '1' || key === 'n') { event.preventDefault(); submitStep('No', 'keyboard') }
        else if (key === '2' || key === 'y') { event.preventDefault(); submitStep('Yes', 'keyboard') }
        else if (key === 'backspace') { event.preventDefault(); back() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back, next, result, step, submitStep])

  const toggleSettings = (open: boolean) => {
    setSettingsOpen(open)
    writeSettingsOpen(open)
  }

  const applyConfig = async (nextConfig: BldConfig) => {
    await saveConfig(nextConfig)
    setConfig(nextConfig)
    reset()
  }

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '6' })}>
      <Settings config={config} open={settingsOpen} onToggle={toggleSettings} onApply={applyConfig} />
      <div className={css({ display: 'grid', columnGap: '10', rowGap: '6', gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1fr) 28rem', xl: 'minmax(0, 1fr) 32rem' }, gridTemplateAreas: { base: '"scramble" "answer" "session"', lg: '"scramble answer" "session answer"' }, gridTemplateRows: { lg: 'auto 1fr' }, alignItems: 'start' })}>
        <section aria-label="Scramble" className={css({ gridArea: 'scramble', display: 'flex', flexDirection: 'column', gap: '4', minW: '0' })}>
          <div className={css({ display: 'grid', gap: '2' })}>
            <span className={labelClass}>Scramble, white top and green front</span>
            <p data-testid="bld-scramble" className={css({ fontFamily: 'mono', fontSize: { base: 'lg', md: '2xl' }, lineHeight: '1.5', letterSpacing: '0.04em', wordSpacing: '0.2em', overflowWrap: 'anywhere' })}>{drill.scramble}</p>
          </div>
          <div className={css({ display: 'grid', gap: '3', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', w: 'full', maxW: '42rem' })}>
            <figure className={css({ display: 'grid', gap: '1', m: '0', minW: '0' })}>
              <div className={css({ w: 'full', aspectRatio: '1' })}>
                <Cube3D setupAlg={drill.scramble} viewRotation="" />
              </div>
              <figcaption className={css({ fontSize: 'xs', color: 'inkVariant', textAlign: 'center' })}>Front: U, F, R</figcaption>
            </figure>
            <figure className={css({ display: 'grid', gap: '1', m: '0', minW: '0' })}>
              <div className={css({ w: 'full', aspectRatio: '1' })}>
                <Cube3D setupAlg={drill.scramble} viewRotation={HIDDEN_SIDE} />
              </div>
              <figcaption className={css({ fontSize: 'xs', color: 'inkVariant', textAlign: 'center' })}>Back: D, L, B</figcaption>
            </figure>
          </div>
          <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>
            Buffer <span className={css({ fontFamily: 'mono', color: 'ink' })}>{drill.buffer}</span>: the {buffer.edgeSticker} sticker of the <span className={css({ fontFamily: 'mono', color: 'ink' })}>{buffer.edge}</span> edge and the {buffer.cornerSticker} sticker of the <span className={css({ fontFamily: 'mono', color: 'ink' })}>{buffer.corner}</span> corner.
          </p>
        </section>
        <div className={css({ gridArea: 'session', minW: '0' })}>
          <SessionStrip results={history} />
        </div>

        <aside aria-label="Memo answer" className={css({ gridArea: 'answer', display: 'flex', flexDirection: 'column', gap: '5', minW: '0' })}>
          <MemoClock startedAt={startedAt} stoppedAt={result?.endedAt} />
          <ol aria-label="Steps" className={css({ display: 'flex', flexWrap: 'wrap', gap: '1', listStyle: 'none', p: '0', m: '0' })}>
            {STEPS.map((entry, index) => {
              const current = !result && index === stepIndex
              return (
                <li key={entry.id} aria-current={current ? 'step' : undefined} data-done={!current && (result || answers[entry.id]) ? '' : undefined} className={css({ display: 'inline-flex', alignItems: 'center', gap: '1', minH: '8', px: '1.5', borderRadius: 'control', borderWidth: '1px', fontSize: 'xs', color: 'outline', borderColor: 'floating', '&[data-done]': { color: 'inkVariant' }, '&[aria-current=step]': { borderColor: 'green', color: 'ink' } })}>
                  <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums' })}>{index + 1}</span>
                  {entry.short}
                </li>
              )
            })}
          </ol>
          {result ? (
            <Verdict ref={nextButton} parts={result.parts} memoMs={result.memoMs} onNext={next} />
          ) : (
            <StepForm
              key={`${round}-${step.id}`}
              ref={stepTarget}
              step={step}
              last={stepIndex === STEPS.length - 1}
              canGoBack={stepIndex > 0}
              draft={draft}
              onDraft={setDraft}
              onSubmit={submitStep}
              onBack={back}
              onSkip={next}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
