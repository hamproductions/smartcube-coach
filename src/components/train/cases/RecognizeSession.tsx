import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import { chooseTrainingCase, deriveTwoSidedRecognitionView, updateMastery, type TwoSidedRecognitionView } from '../../../domain/training'
import { HEX, defaultScheme, schemeFor, type ColorScheme } from '../../ui/LastLayerDiagram'
import { readPreferences } from '../../../storage/preferences'
import { recognitionAttempt } from './attempts'
import { CaseStage } from './CaseStage'
import { seconds, useKeys, useNow, usePuzzle } from './hooks'
import { SessionStrip, type SessionResult } from './SessionStrip'
import { Action, focusRing, Kbd, labelText, mono } from './ui'

type Round = { record: AlgorithmRecord; round: number; startedAt: number; choices: string[]; answer?: string; endedAt?: number }

function shuffle<T>(values: T[]) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function choicesFor(record: AlgorithmRecord, available: AlgorithmRecord[]) {
  const others = shuffle(available.filter((entry) => entry.id !== record.id && entry.name !== record.name)).slice(0, 3)
  return shuffle([record.name, ...others.map((entry) => entry.name)])
}

function useScheme() {
  const [scheme, setScheme] = useState<ColorScheme>(defaultScheme)
  useEffect(() => {
    void readPreferences().then((prefs) => setScheme(schemeFor(prefs.diagramTopColor, prefs.diagramFrontColor) ?? defaultScheme)).catch(() => undefined)
  }, [])
  return scheme
}

function StickerRow({ label, faces, scheme }: { label: string; faces: string[]; scheme: ColorScheme }) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', alignItems: 'center' })}>
      <span className={labelText}>{label}</span>
      <div role="group" aria-label={`${label} stickers`} className={css({ display: 'flex', gap: '1.5' })}>
        {faces.map((face, index) => {
          const colour = scheme[face as keyof ColorScheme] ?? 'white'
          return <span key={index} role="img" aria-label={colour} className={css({ w: { base: '12', md: '20' }, h: { base: '12', md: '20' }, borderRadius: 'control', borderWidth: '1px', borderColor: 'surface' })} style={{ background: HEX[colour] }} />
        })}
      </div>
    </div>
  )
}

export function RecognizeSession({ pool, available, attempts, rotation, onRecord, onEnd }: {
  pool: AlgorithmRecord[]
  available: AlgorithmRecord[]
  attempts: TrainerAttempt[]
  rotation: string
  onRecord: (attempt: TrainerAttempt, updated: AlgorithmRecord) => Promise<void>
  onEnd: () => void
}) {
  const scheme = useScheme()
  const puzzle = usePuzzle()
  const [round, setRound] = useState<Round>()
  const [view, setView] = useState<TwoSidedRecognitionView>()
  const [viewError, setViewError] = useState('')
  const [results, setResults] = useState<SessionResult[]>([])
  const [saveError, setSaveError] = useState('')
  const latest = useRef({ pool, available, attempts, onRecord })
  latest.current = { pool, available, attempts, onRecord }
  const now = useNow(Boolean(round && !round.answer))

  const next = useCallback(() => {
    const record = chooseTrainingCase(latest.current.pool, latest.current.attempts)
    if (!record) return
    setRound((current) => ({ record, round: (current?.round ?? 0) + 1, startedAt: performance.now(), choices: choicesFor(record, latest.current.available) }))
  }, [])

  useEffect(() => { next() }, [next])

  useEffect(() => {
    if (!round) return
    let cancelled = false
    setView(undefined)
    setViewError('')
    void deriveTwoSidedRecognitionView(round.record.setup)
      .then((derived) => { if (!cancelled) setView(derived) })
      .catch(() => { if (!cancelled) setViewError('The side stickers could not be worked out for this case. Press Space to skip it.') })
    return () => { cancelled = true }
  }, [round?.record.id, round?.round])

  const answer = (choice: string) => {
    if (!round || round.answer) return
    const endedAt = performance.now()
    const attempt = recognitionAttempt(round.record, choice, round.startedAt, endedAt)
    setRound({ ...round, answer: choice, endedAt })
    setResults((current) => [...current, { id: attempt.id, success: attempt.outcome === 'success', totalMs: attempt.totalMs }])
    latest.current.onRecord(attempt, updateMastery(round.record, attempt.outcome === 'success', attempt.totalMs)).catch(() => setSaveError('This answer could not be saved. Local storage is unavailable.'))
  }

  useKeys((key) => {
    if (!round) return
    if (round.answer || viewError) {
      if (key === 'Space' || key === 'Enter') { next(); return true }
      return
    }
    const index = Number(key) - 1
    if (Number.isInteger(index) && index >= 0 && index < round.choices.length) { answer(round.choices[index]); return true }
  })

  const choices = useMemo(() => round?.choices ?? [], [round])

  if (!round) return <p className={css({ color: 'inkVariant' })}>No case to recognise. Go back and widen the selection.</p>

  const correct = round.answer === round.record.name
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4', flex: '1' })}>
      <SessionStrip results={results}>
        <Action compact onClick={onEnd}>End session</Action>
      </SessionStrip>
      {saveError && <p role="alert" className={css({ color: 'error', fontSize: 'sm' })}>{saveError}</p>}
      <div className={css({ display: 'grid', gap: { base: '4', lg: '8' }, gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1.1fr) minmax(0, 1fr)' }, alignItems: 'center', flex: '1' })}>
        {round.answer ? (
          <CaseStage record={round.record} puzzle={puzzle} rotation={rotation} moves={[]} />
        ) : (
          <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: { base: '3', md: '6' } })}>
            {view ? (
              <div className={css({ display: 'flex', gap: { base: '4', md: '8' }, justifyContent: 'center' })}>
                <StickerRow label="Front" faces={view.front} scheme={scheme} />
                <StickerRow label="Right" faces={view.right} scheme={scheme} />
              </div>
            ) : <p className={css({ color: viewError ? 'error' : 'inkVariant' })}>{viewError || 'Working out the side stickers'}</p>}
            <p className={cx(mono, css({ fontSize: { base: '2xl', md: '4xl' }, fontWeight: 'bold' }))}>{seconds(now - round.startedAt)}</p>
          </div>
        )}
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
          {round.answer ? (
            <>
              <p aria-label="Verdict" className={css({ fontSize: { base: '4xl', md: '6xl' }, fontWeight: 'bold', lineHeight: '1', color: correct ? 'green' : 'error' })}>{correct ? 'Correct' : 'Wrong'}</p>
              <p className={css({ fontSize: 'lg' })}>
                {correct ? `${round.record.name} in ` : `It was ${round.record.name}. You picked ${round.answer}. `}
                {correct && <span className={mono}>{seconds((round.endedAt ?? 0) - round.startedAt)}</span>}
              </p>
              <p className={cx(mono, css({ color: 'inkVariant' }))}>{round.record.algorithm}</p>
              <Action primary hotkey="Space" className={css({ alignSelf: { base: 'stretch', lg: 'flex-start' } })} onClick={next}>Next case</Action>
            </>
          ) : (
            <>
              <h2 className={css({ fontSize: 'xl', fontWeight: 'semibold' })}>Which case is this?</h2>
              <p className={css({ fontSize: 'sm', color: 'inkVariant', display: { base: 'none', md: 'block' } })}>Only the front and right stickers of the last layer, as you see them before turning.</p>
              <div className={css({ display: 'grid', gap: '2', gridTemplateColumns: '1fr 1fr' })}>
                {choices.map((choice, index) => (
                  <button
                    key={choice}
                    type="button"
                    disabled={!view}
                    onClick={() => answer(choice)}
                    className={cx(css({
                      display: 'flex', alignItems: 'center', gap: '3', minH: '56px', px: '4', borderRadius: 'control', textAlign: 'left',
                      bg: 'container', borderWidth: '1px', borderColor: 'floating', color: 'ink', fontSize: 'md', cursor: 'pointer',
                      _hover: { borderColor: 'outline' }, _disabled: { opacity: '0.4', cursor: 'wait' }
                    }), focusRing)}
                  >
                    <Kbd>{index + 1}</Kbd>{choice}
                  </button>
                ))}
              </div>
              {viewError && <Action primary hotkey="Space" onClick={next}>Skip case</Action>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
