import { useEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { CasePreview } from '../ui/CasePreview'

// Ported from docs/design/stitch/active_recognition_drill/code.html: a case pill at the
// top, the case picture centred, then the phase label above a large running timer. The
// export gives the drill the whole screen because during a rep the solver is looking at
// the cube, not at a control panel.

const PHASE_LABEL = {
  recognizing: 'Recognizing…',
  executing: 'Executing',
  done: 'Complete'
} as const

export type ActiveDrillProps = {
  caseName: string
  /** Case group, e.g. 'F2L' | 'OLL' | 'PLL'. Chooses the view, per cubedex CaseCard.tsx:20-22. */
  set?: string
  setup: string
  startedAt: number
  recognizedAtMs?: number
  finishedAtMs?: number
  hint?: string
  onHint(): void
}

export function ActiveDrill({ caseName, set = '', setup, startedAt, recognizedAtMs, finishedAtMs, hint, onHint }: ActiveDrillProps) {
  const [now, setNow] = useState(() => performance.now())
  const frame = useRef<number | undefined>(undefined)

  const running = finishedAtMs === undefined

  useEffect(() => {
    if (!running) return
    const tick = () => {
      setNow(performance.now())
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current) }
  }, [running])

  const elapsed = (finishedAtMs ?? now) - startedAt
  const phase = finishedAtMs !== undefined ? 'done' : recognizedAtMs ? 'executing' : 'recognizing'

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10', py: '10' })}>
      <div className={css({
        display: 'flex', alignItems: 'center', gap: '3',
        px: '6', py: '2', borderRadius: 'pill',
        bg: 'container', borderWidth: '1px', borderColor: 'floating',
        fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant', letterSpacing: '0.08em'
      })}>
        {caseName} — recognize &amp; execute
      </div>

      <div className={css({ p: '5', bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card' })}>
        <CasePreview setup={setup} set={set} size={220} />
      </div>

      <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2' })}>
        <span className={css({
          fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: phase === 'executing' ? 'green' : 'inkVariant'
        })}>{PHASE_LABEL[phase]}</span>

        <span className={css({
          fontFamily: 'mono', fontSize: '8xl', fontWeight: 'bold',
          lineHeight: '1', letterSpacing: '-0.05em',
          fontVariantNumeric: 'tabular-nums',
          color: phase === 'done' ? 'ink' : 'green'
        })}>{(elapsed / 1000).toFixed(2)}</span>

        {/* Recognition is the number the coach cares about, so it stays visible once taken. */}
        <span className={css({ mt: '2', h: '6', fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant' })}>
          {recognizedAtMs ? `recognition ${((recognizedAtMs - startedAt) / 1000).toFixed(2)}s` : ''}
        </span>
      </div>

      <button
        type="button"
        onClick={onHint}
        className={css({
          minH: '48px', px: '8', borderRadius: 'pill',
          bg: 'container', borderWidth: '1px', borderColor: 'floating', color: 'ink',
          cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          _hover: { bg: 'floating' }
        })}
      >Hint</button>

      {hint && (
        <p className={css({ fontFamily: 'mono', fontSize: 'lg', color: 'greenBright', letterSpacing: '0.08em' })}>{hint}</p>
      )}
    </div>
  )
}
