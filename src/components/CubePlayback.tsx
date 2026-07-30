import { useEffect, useMemo, useState } from 'react'
import type { RecoStage } from '../integrations/reco'

type CubePlaybackProps = {
  title: string
  scramble: string
  moves: string[]
  stages: RecoStage[]
}

export function CubePlayback({ title, scramble, moves, stages }: CubePlaybackProps) {
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
    if (!navigator.userAgent.includes('jsdom') && !customElements.get('twisty-player')) {
      void import('cubing/twisty')
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setMoveIndex((current) => {
        if (current >= moves.length) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 320)
    return () => window.clearInterval(timer)
  }, [moves.length, playing])

  const seek = (next: number) => {
    setPlaying(false)
    setMoveIndex(Math.min(moves.length, Math.max(0, next)))
  }

  return (
    <section className="playback" aria-label={title}>
      <div className="playback-heading">
        <div>
          <span className="eyebrow green">CUBING.JS / 3D RECONSTRUCTION</span>
          <h2>{title}</h2>
        </div>
        <strong>Move {moveIndex} / {moves.length}</strong>
      </div>
      <div className="cube-stage">
        <twisty-player
          alg={currentAlg}
          background="none"
          control-panel="none"
          experimental-setup-alg={scramble}
          hint-facelets="floating"
          puzzle="3x3x3"
          visualization="3D"
        />
      </div>
      <div className="playback-controls">
        <button aria-label="Previous move" onClick={() => seek(moveIndex - 1)}>←</button>
        <button aria-label={playing ? 'Pause playback' : 'Play reconstruction'} onClick={() => setPlaying((current) => !current)}>
          {playing ? 'PAUSE' : 'PLAY'}
        </button>
        <button aria-label="Next move" onClick={() => seek(moveIndex + 1)}>→</button>
        <button aria-label="Reset playback" onClick={() => seek(0)}>RESET</button>
      </div>
      <div className="playback-stages" aria-label="Reconstruction stages">
        {stageEnds.map((stage) => (
          <button key={`${stage.label}-${stage.end}`} onClick={() => seek(stage.end)}>
            <span>{stage.label}</span>
            <strong>{stage.end}</strong>
          </button>
        ))}
      </div>
      <div className="move-stream">
        {moves.map((move, index) => (
          <button
            className={index < moveIndex ? 'passed' : index === moveIndex ? 'current' : ''}
            key={`${move}-${index}`}
            onClick={() => seek(index + 1)}
          >
            {move}
          </button>
        ))}
      </div>
    </section>
  )
}
