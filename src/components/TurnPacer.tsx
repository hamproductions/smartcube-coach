import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { Metronome, bpmToIntervalMs } from '../domain/tools/metronome'
import { subscribeResolvedMoves } from '../device/CubeConnection'
import { Button } from './ui/Button'

const PRESETS = [1, 1.5, 2, 2.5, 3, 4, 5, 6].map((tps) => tps * 60)

const chip = css({
  display: 'inline-flex', alignItems: 'center', gap: '1', px: '3', minH: '11', borderRadius: 'control', flexShrink: '0',
  borderWidth: '1px', borderColor: 'floating', bg: 'transparent', color: 'inkVariant', cursor: 'pointer', fontFamily: 'mono', fontSize: 'sm',
  _hover: { color: 'ink', borderColor: 'outline' }, _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' },
  '&[aria-pressed=true]': { bg: 'floating', color: 'ink', borderColor: 'green' }
})

export function TurnPacer() {
  const metronome = useRef<Metronome>(undefined)
  const [bpm, setBpm] = useState(60)
  const [running, setRunning] = useState(false)
  const [sound, setSound] = useState(false)
  const [beat, setBeat] = useState(0)
  const [turns, setTurns] = useState<number[]>([])
  const beats = useRef<number[]>([])
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    if (!running) return
    const interval = bpmToIntervalMs(bpm)
    const tick = () => {
      beats.current = [...beats.current, performance.now()].slice(-64)
      setBeat((count) => count + 1)
      if (soundRef.current && typeof AudioContext !== 'undefined') {
        metronome.current ??= new Metronome({ bpm })
        metronome.current.playTick()
      }
    }
    tick()
    const timer = setInterval(tick, interval)
    return () => clearInterval(timer)
  }, [running, bpm])

  useEffect(() => subscribeResolvedMoves(() => {
    setTurns((existing) => [...existing, performance.now()].slice(-60))
  }), [])

  const toggle = useCallback(() => {
    setRunning((value) => {
      if (value) return false
      beats.current = []
      setTurns([])
      return true
    })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName)) return
      if (event.code !== 'Space') return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const interval = bpmToIntervalMs(bpm)
  const recent = turns.filter((at) => at > performance.now() - 10_000)
  const onBeat = recent.filter((at) => beats.current.some((beatAt) => Math.abs(at - beatAt) <= interval * 0.25)).length
  const actualTps = recent.length > 1 ? (recent.length - 1) / ((recent[recent.length - 1] - recent[0]) / 1000) : undefined

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8', alignItems: 'center', py: { base: '2', md: '6' } })}>
      <div role="group" aria-label="Rate" className={css({ display: 'flex', gap: '2', overflowX: 'auto', maxW: 'full', pb: '1' })}>
        {PRESETS.map((preset) => (
          <button key={preset} type="button" className={chip} aria-pressed={preset === bpm} onClick={() => setBpm(preset)}>
            {(preset / 60).toFixed(1)}<span className={css({ fontSize: 'xs', color: 'inkVariant' })}>TPS</span>
          </button>
        ))}
      </div>

      <div aria-hidden className={css({ position: 'relative', w: { base: '10rem', md: '13rem' }, h: { base: '10rem', md: '13rem' }, display: 'grid', placeItems: 'center' })}>
        <span
          key={beat}
          className={css({
            position: 'absolute', inset: '0', borderRadius: 'pill', borderWidth: '2px', borderColor: running ? 'green' : 'floating',
            animation: running ? 'pacerPulse 360ms ease-out' : 'none', _motionReduce: { animation: 'none' }
          })}
        />
        <span className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1' })}>
          <strong className={css({ fontFamily: 'mono', fontSize: { base: '48px', md: '64px' }, fontWeight: 'semibold', lineHeight: '1', fontVariantNumeric: 'tabular-nums' })}>{(bpm / 60).toFixed(1)}</strong>
          <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>turns per second</span>
        </span>
      </div>

      <p className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant' })}>{(60_000 / interval).toFixed(0)} beats per minute · {Math.round(interval)} ms apart</p>

      <div className={css({ display: 'flex', gap: '3', flexWrap: 'wrap', justifyContent: 'center' })}>
        <Button variant="solid" onClick={toggle}>{running ? 'Stop pacer' : 'Start pacer'} <kbd className={css({ fontFamily: 'mono', fontSize: 'xs', opacity: '0.7' })}>Space</kbd></Button>
        <Button variant="outline" aria-pressed={sound} onClick={() => setSound((value) => !value)}>{sound ? 'Sound on' : 'Sound off'}</Button>
      </div>

      <section aria-label="Your turning" className={css({ display: 'flex', gap: '10', justifyContent: 'center', borderTopWidth: '1px', borderColor: 'floating', pt: '6', w: 'full', maxW: '32rem' })}>
        <Stat title="Your rate, last 10 s" value={actualTps === undefined ? '–' : `${actualTps.toFixed(1)} TPS`} />
        <Stat title="Turns on the beat" value={recent.length ? `${Math.round((onBeat / recent.length) * 100)}%` : '–'} />
      </section>
      <p className={css({ fontSize: 'sm', color: 'inkVariant', textAlign: 'center', maxW: '36rem' })}>
        Set it just under your current rate and land every turn on a beat. With the smart cube connected, your rate and how many turns land on the beat show above.
      </p>
    </div>
  )
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1' })}>
      <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>{title}</span>
      <strong className={css({ fontFamily: 'mono', fontSize: 'xl', fontWeight: 'medium', fontVariantNumeric: 'tabular-nums' })}>{value}</strong>
    </div>
  )
}
