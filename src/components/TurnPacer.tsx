import { useEffect, useRef, useState } from 'react'
import { Metronome, bpmToIntervalMs } from '../domain/tools/metronome'

const PRESETS = [40, 60, 80, 100, 120]

export function TurnPacer() {
  const metronome = useRef<Metronome>(undefined)
  const [bpm, setBpm] = useState(60)
  const [running, setRunning] = useState(false)

  useEffect(() => () => metronome.current?.stop(), [])

  const toggle = () => {
    metronome.current ??= new Metronome({ bpm })
    if (running) {
      metronome.current.stop()
      setRunning(false)
      return
    }
    metronome.current.bpm = bpm
    metronome.current.start()
    setRunning(true)
  }

  const changeBpm = (next: number) => {
    setBpm(next)
    if (!metronome.current) return
    metronome.current.bpm = next
    if (running) metronome.current.start()
  }

  return (
    <article className="panel">
      <header className="panel-head">
        <span className="kicker">Turn pacer</span>
        <h2>Hold a steady turn rate</h2>
      </header>
      <p className="panel-note">Turning to a click exposes the pauses a stopwatch hides. Set it just under your current rate and keep every move on a beat.</p>
      <div className="pill-row">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            className={preset === bpm ? 'pill active' : 'pill'}
            aria-pressed={preset === bpm}
            onClick={() => changeBpm(preset)}
          >
            {preset} <span className="pill-count">bpm</span>
          </button>
        ))}
      </div>
      <div className="stage-actions">
        <button className="button primary" onClick={toggle}>{running ? 'Stop pacer' : 'Start pacer'}</button>
        <span className="metric-strip">
          <strong>{(60_000 / bpmToIntervalMs(bpm)).toFixed(0)}</strong>
          <small>beats per minute · {bpmToIntervalMs(bpm)} ms apart</small>
        </span>
      </div>
    </article>
  )
}
