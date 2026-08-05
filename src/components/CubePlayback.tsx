import { useEffect, useMemo, useRef, useState } from 'react'
import type { RecoStage } from '../integrations/reco'
import { ErrorBoundary } from './ui/ErrorBoundary'

const BASE_LIVE_TEMPO = 4
const LIVE_CATCH_UP_TIMEOUT_MS = 2000

type CatchUpMove = { move: unknown; amount: number }

type TwistyModel = {
  experimentalAddMove?: (move: string, options?: { cancel?: boolean }) => void
  tempoScale?: { set: (value: number) => void }
  catchUpMove?: {
    addFreshListener: (callback: (value: CatchUpMove) => void) => void
    removeFreshListener: (callback: (value: CatchUpMove) => void) => void
  }
}

const getLiveQueueTempo = (pendingCount: number, baseTempo: number): number => {
  if (pendingCount <= 0) return baseTempo
  if (pendingCount === 1) return Math.max(baseTempo, 5)
  if (pendingCount === 2) return Math.max(baseTempo, 10)
  if (pendingCount === 3) return Math.max(baseTempo, 20)
  return Math.max(baseTempo, 100)
}

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

// The twisty player is third-party and animates on its own timers, so a move it
// cannot parse throws from inside its own scheduler where no local try/catch can
// reach it. That crash took whole pages down. Every consumer gets the boundary.
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
  const player = useRef<HTMLElement | null>(null)
  const appliedSetup = useRef<string | undefined>(undefined)
  const liveMoveQueue = useRef<string[]>([])
  const liveAnimating = useRef(false)
  const liveCatchUpCleanup = useRef<(() => void) | null>(null)
  const currentAlg = moves.slice(0, moveIndex).join(' ')
  const stageEnds = useMemo(() => {
    let end = 0
    return stages.map((stage) => {
      if (stage.label.toLowerCase() !== 'inspection') end += stage.moves.length
      return { label: stage.label, end }
    })
  }, [stages])

  useEffect(() => {
    if (navigator.userAgent.includes('jsdom')) return
    const load = customElements.get('twisty-player') ? Promise.resolve() : import('cubing/twisty')
    void load.then(async () => {
      await customElements.whenDefined('twisty-player')
      const liveElement = player.current as unknown as { experimentalModel?: { tempoScale?: { set: (value: number) => void }; setupAnchor?: { set: (value: string) => void } } } | null
      liveElement?.experimentalModel?.tempoScale?.set(BASE_LIVE_TEMPO)
      liveElement?.experimentalModel?.setupAnchor?.set('start')
      const element = player.current
      const callback = element && Object.getOwnPropertySymbols(Object.getPrototypeOf(element)).find((symbol) => String(symbol).includes('intersectedCallback'))
      if (element && callback) {
        const internal = element as HTMLElement & { [key: symbol]: () => void; contentWrapper: HTMLElement }
        internal[callback]()
        internal.contentWrapper.style.height = '100%'
        const visualization = internal.contentWrapper.querySelector<HTMLElement>('.visualization-wrapper')
        if (visualization) visualization.style.height = '100%'
      }
    })
  }, [])

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

  // Functional update, because several clicks land in one React batch and each one
  // reading `moveIndex` from its own closure computes the same target — ten clicks
  // on Next advanced the cube by a single move.
  const nudge = (delta: number) => {
    setPlaying(false)
    setMoveIndex((previous) => Math.min(moves.length, Math.max(0, previous + delta)))
  }

  useEffect(() => {
    return () => { liveCatchUpCleanup.current?.() }
  }, [])

  useEffect(() => {
    if (!live) return
    const element = player.current as (HTMLElement & {
      experimentalAddMove?: (move: string) => void
      experimentalSetupAlg?: string
      alg?: string
      experimentalModel?: TwistyModel
    }) | null
    const next = setupAlg ?? ''
    const previous = appliedSetup.current
    appliedSetup.current = next
    if (!element) return

    const model = element.experimentalModel
    // Compare move by move, never by string prefix. "R U" is a string prefix of "R U2",
    // so slicing the raw string handed the player the fragment "2", and
    // experimentalAddMove threw "internal parsing error" and took the whole component
    // down with it.
    const previousMoves = (previous ?? '').trim().split(/\s+/).filter(Boolean)
    const nextMoves = next.trim().split(/\s+/).filter(Boolean)
    const appended = previousMoves.length > 0
      && nextMoves.length > previousMoves.length
      && previousMoves.every((move, index) => move === nextMoves[index])
      ? nextMoves.slice(previousMoves.length)
      : undefined

    if (appended?.length) {
      liveMoveQueue.current.push(...appended)
      if (!liveAnimating.current) advanceLiveMoveQueue(model)
      return
    }

    liveCatchUpCleanup.current?.()
    liveCatchUpCleanup.current = null
    liveMoveQueue.current = []
    liveAnimating.current = false
    element.experimentalSetupAlg = next
    element.alg = ''
  }, [live, setupAlg])

  function advanceLiveMoveQueue(model: TwistyModel | undefined) {
    const move = liveMoveQueue.current.shift()
    if (!move || !model?.experimentalAddMove) {
      liveAnimating.current = false
      return
    }
    liveAnimating.current = true
    model.tempoScale?.set(getLiveQueueTempo(liveMoveQueue.current.length, BASE_LIVE_TEMPO))
    try {
      model.experimentalAddMove(move, { cancel: false })
    } catch {
      // A move the player cannot parse is a bug upstream of here, but it must not take
      // the page down with it. Drop the queue and let the next setup alg re-seed the
      // cube from scratch, which is the same recovery path a resync uses.
      liveMoveQueue.current = []
      liveAnimating.current = false
      appliedSetup.current = undefined
      return
    }

    const catchUpMove = model.catchUpMove
    if (!catchUpMove) {
      advanceLiveMoveQueue(model)
      return
    }

    let seenPending = false
    const onCatchUpMove = (value: CatchUpMove) => {
      if (value.move !== null) { seenPending = true; return }
      if (!seenPending) return
      cleanup()
      advanceLiveMoveQueue(model)
    }
    const cleanup = () => {
      catchUpMove.removeFreshListener(onCatchUpMove)
      window.clearTimeout(safetyTimer)
      liveCatchUpCleanup.current = null
    }
    const safetyTimer = window.setTimeout(() => {
      cleanup()
      advanceLiveMoveQueue(model)
    }, LIVE_CATCH_UP_TIMEOUT_MS)
    liveCatchUpCleanup.current = cleanup
    catchUpMove.addFreshListener(onCatchUpMove)
  }

  return (
    <section className="playback" aria-label={title}>
      {!live && (
        <div className="playback-heading">
          <div>
            <span className="eyebrow green">PLAYBACK</span>
            <h2>{title}</h2>
          </div>
          <strong>Move {moveIndex} / {moves.length}</strong>
        </div>
      )}
      <div className="cube-stage">
        {/* The played moves belong in the setup alg, not in `alg`. A twisty-player shows
            the position at the START of its alg, so feeding the moves there left the cube
            frozen on the scramble while the move counter advanced — it visibly never
            turned. The live path above already folds its moves into a setup alg. */}
        <twisty-player
          alg=""
          background="none"
          control-panel="none"
          experimental-setup-alg={live ? undefined : [setupAlg ?? scramble, currentAlg].filter(Boolean).join(' ')}
          hint-facelets="none"
          puzzle="3x3x3"
          ref={player}
          visualization="3D"
        />
      </div>
      {!live && !controller && <div className="playback-controls">
        <button aria-label="Previous move" onClick={() => nudge(-1)}>←</button>
        <button aria-label={playing ? 'Pause playback' : 'Play reconstruction'} onClick={() => setPlaying((current) => !current)}>
          {playing ? 'PAUSE' : 'PLAY'}
        </button>
        <button aria-label="Next move" onClick={() => nudge(1)}>→</button>
        <button aria-label="Reset playback" onClick={() => seek(0)}>RESET</button>
      </div>}
      {!live && !controller && <div className="playback-stages" aria-label="Reconstruction stages">
        {stageEnds.map((stage) => (
          <button key={`${stage.label}-${stage.end}`} onClick={() => seek(stage.end)}>
            <span>{stage.label}</span>
            <strong>{stage.end}</strong>
          </button>
        ))}
      </div>}
      {!live && !controller && <div className="move-stream">
        {moves.map((move, index) => (
          <button
            className={index < moveIndex ? 'passed' : index === moveIndex ? 'current' : ''}
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
