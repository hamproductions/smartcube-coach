import { useEffect, useMemo, useState } from 'react'
import type { RecoStage } from '../integrations/reco'
import { css, cx } from 'styled-system/css'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Cube3D } from './solve/Cube3D'

const control = css({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '2', minH: '44px', px: '4',
  borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'transparent', color: 'ink',
  fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer', _hover: { bg: 'floating' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' }
})

type CubePlaybackProps = {
  title: string
  scramble: string
  moves: string[]
  stages: RecoStage[]
  setupAlg?: string
  moveTimestamps?: number[]
  speed?: number
  live?: boolean
  playbackIndex?: number
  controller?: boolean
}

export function CubePlayback(props: CubePlaybackProps) {
  return (
    <ErrorBoundary surface={props.title}>
      <CubePlaybackView {...props} />
    </ErrorBoundary>
  )
}

function CubePlaybackView({ title, scramble, moves, stages, setupAlg, moveTimestamps, speed = 1, live = false, playbackIndex, controller = false }: CubePlaybackProps) {
  const [moveIndex, setMoveIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const currentAlg = moves.slice(0, moveIndex).join(' ')
  const stageEnds = useMemo(() => {
    let end = 0
    return stages.map((stage) => {
      if (stage.label.toLowerCase() !== 'inspection') end += stage.moves.length
      return { label: stage.label, end }
    })
  }, [stages])

  useEffect(() => {
    if (!playing) return
    let cancelled = false
    let timer = 0

    const step = (index: number) => {
      if (cancelled) return
      if (index >= moves.length) {
        setPlaying(false)
        return
      }
      setMoveIndex(index + 1)
      const gap = moveTimestamps && moveTimestamps[index + 1] !== undefined && moveTimestamps[index] !== undefined
        ? Math.max(40, (moveTimestamps[index + 1] - moveTimestamps[index]) / speed)
        : 320 / speed
      timer = window.setTimeout(() => step(index + 1), gap)
    }

    timer = window.setTimeout(() => step(moveIndex), 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [moves.length, playing, moveTimestamps, speed])

  useEffect(() => {
    if (playbackIndex === undefined) return
    setPlaying(false)
    setMoveIndex(Math.min(moves.length, Math.max(0, playbackIndex)))
  }, [moves.length, playbackIndex])

  const seek = (next: number) => {
    setPlaying(false)
    setMoveIndex(Math.min(moves.length, Math.max(0, next)))
  }

  const nudge = (delta: number) => {
    setPlaying(false)
    setMoveIndex((previous) => Math.min(moves.length, Math.max(0, previous + delta)))
  }

  return (
    <section aria-label={title} className={css({ display: 'flex', flexDirection: 'column', gap: '3', minW: '0' })}>
      {!live && (
        <div className={css({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '3' })}>
          <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{title}</h3>
          <span className={css({ fontFamily: 'mono', fontVariantNumeric: 'tabular-nums', fontSize: 'xs', color: 'inkVariant' })}>Move {moveIndex} / {moves.length}</span>
        </div>
      )}
      <div className={css({ h: { base: '280px', md: '360px' }, borderWidth: '1px', borderColor: 'floating', borderRadius: 'card', bg: 'surface', overflow: 'hidden', display: 'grid', placeItems: 'center', p: '4' })}>
        <Cube3D setupAlg={live ? (setupAlg ?? '') : [setupAlg ?? scramble, currentAlg].filter(Boolean).join(' ')} />
      </div>
      {!live && !controller && <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
        <button type="button" aria-label="Previous move" onClick={() => nudge(-1)} className={control}>Back</button>
        <button type="button" aria-label={playing ? 'Pause playback' : 'Play reconstruction'} onClick={() => setPlaying((current) => !current)} className={cx(control, css({ bg: 'green', borderColor: 'green', color: 'onGreen', fontWeight: 'semibold', minW: '6rem', _hover: { bg: 'greenBright' } }))}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" aria-label="Next move" onClick={() => nudge(1)} className={control}>Next</button>
        <button type="button" aria-label="Reset playback" onClick={() => seek(0)} className={cx(control, css({ ml: 'auto' }))}>Reset</button>
      </div>}
      {!live && !controller && stageEnds.length > 0 && <div aria-label="Reconstruction stages" className={css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(8rem, 1fr))', gap: '2' })}>
        {stageEnds.map((stage) => (
          <button key={`${stage.label}-${stage.end}`} type="button" onClick={() => seek(stage.end)} className={cx(control, css({ justifyContent: 'space-between', fontSize: 'xs', color: 'inkVariant' }))}>
            <span className={css({ overflow: 'hidden', textOverflow: 'ellipsis' })}>{stage.label}</span>
            <span className={css({ fontFamily: 'mono', color: 'ink' })}>{stage.end}</span>
          </button>
        ))}
      </div>}
      {!live && !controller && <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '1', p: '2', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card', bg: 'surface' })}>
        {moves.map((move, index) => (
          <button
            type="button"
            aria-current={index === moveIndex ? 'step' : undefined}
            className={css({
              minW: '2.25rem', minH: '2.25rem', px: '1.5', borderRadius: 'control', cursor: 'pointer', fontFamily: 'mono', fontSize: 'sm',
              color: index < moveIndex ? 'ink' : 'outline', bg: index === moveIndex ? 'floating' : 'transparent',
              boxShadow: index === moveIndex ? 'inset 0 -2px 0 0 #22c55e' : 'none',
              _hover: { bg: 'floating' },
              _focusVisible: { outline: '2px solid', outlineColor: 'green' }
            })}
            key={`${move}-${index}`}
            onClick={() => seek(index + 1)}
          >
            {move}
          </button>
        ))}
      </div>}
    </section>
  )
}
