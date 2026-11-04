import { useEffect, useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { secondaryButton } from '../ui/Page'
import { currentTargetScramble, subscribeCapture, useCubeConnection } from '../../device/CubeConnection'
import type { CaptureSnapshot } from '../../device/capture'
import type { CubeEvent } from '../../device/inputSource'
import { scriptedSource, sessionSource, simulatorSource } from '../../device/sources'
import { parseDeviceSession } from '../../device/deviceRecorder'

const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const
const FACE_COLOUR: Record<string, string> = {
  U: '#f7f9fc', R: '#b90000', F: '#009b48',
  D: '#ffd500', L: '#ff5900', B: '#0051ba'
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'ink' })}>{children}</span>
)

const DASH = '–'
const MAX_LINES = 120

function Face({ label, stickers }: { label: string; stickers: string[] }) {
  return (
    <div className={css({ p: '1', bg: 'surface', borderWidth: '1px', borderColor: 'floating', display: 'flex', flexDirection: 'column', gap: '1' })}>
      <span className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'inkVariant', textAlign: 'center' })}>{label}</span>
      <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' })}>
        {stickers.map((sticker, index) => (
          <div key={index} className={css({ aspectRatio: '1', borderRadius: '1px' })} style={{ background: FACE_COLOUR[sticker] ?? '#27272a' }} />
        ))}
      </div>
    </div>
  )
}

export function DiagnosticsPanel() {
  const cube = useCubeConnection()
  const [facelets, setFacelets] = useState<string>()
  const [quaternion, setQuaternion] = useState<{ x: number; y: number; z: number; w: number }>()
  const [velocity, setVelocity] = useState<{ x: number; y: number; z: number }>()
  const [lines, setLines] = useState<string[]>([])
  const [capture, setCapture] = useState<CaptureSnapshot>()
  useEffect(() => subscribeCapture(setCapture), [])
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => cube.subscribe((event: CubeEvent) => {
    if (event.type === 'FACELETS') {
      setFacelets(event.facelets)
      setLines((current) => [...current.slice(-MAX_LINES), `[STATE] ${event.facelets.slice(0, 27)}…`])
      return
    }
    if (event.type === 'GYRO') {
      setQuaternion(event.quaternion)
      if (event.velocity) setVelocity(event.velocity)
      return
    }
    if (event.type === 'MOVE') {
      setLines((current) => [...current.slice(-MAX_LINES), `[MOVE] ${event.move} face=${event.face} dir=${event.direction} t=${event.cubeTimestamp ?? event.timestamp}`])
      return
    }
    if (event.type === 'BATTERY') {
      setLines((current) => [...current.slice(-MAX_LINES), `[BATTERY] ${event.batteryLevel}%`])
      return
    }
    if (event.type === 'DISCONNECT') {
      setLines((current) => [...current.slice(-MAX_LINES), '[SYSTEM] disconnected'])
    }
  }), [cube])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [lines])
  const faces = facelets && facelets.length >= 54
    ? FACE_ORDER.map((label, index) => ({ label, stickers: facelets.slice(index * 9, index * 9 + 9).split('') }))
    : undefined

  return (
    <div className={css({ display: 'grid', gap: 'gutter', gridTemplateColumns: '1fr', lg: { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' } })}>
      <div className={css({ lg: { gridColumn: 'span 7' }, display: 'flex', flexDirection: 'column', gap: '4' })}>
        <Label>Cube state</Label>
        {faces ? (
          <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1', maxW: '440px' })}>
            <div style={{ gridColumn: 2 }}><Face label="U" stickers={faces[0].stickers} /></div>
            <div style={{ gridColumn: 1, gridRow: 2 }}><Face label="L" stickers={faces[4].stickers} /></div>
            <div style={{ gridColumn: 2, gridRow: 2 }}><Face label="F" stickers={faces[2].stickers} /></div>
            <div style={{ gridColumn: 3, gridRow: 2 }}><Face label="R" stickers={faces[1].stickers} /></div>
            <div style={{ gridColumn: 4, gridRow: 2 }}><Face label="B" stickers={faces[5].stickers} /></div>
            <div style={{ gridColumn: 2, gridRow: 3 }}><Face label="D" stickers={faces[3].stickers} /></div>
          </div>
        ) : (
          <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>
            No facelet state received. Connect a cube that reports state, then request it below.
          </p>
        )}

        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '2' })}>
        <button
          type="button"
          disabled={!cube.handle}
          onClick={() => void cube.handle?.requestState()}
          className={secondaryButton}
        >Request state</button>
        <button
          type="button"
          disabled={!cube.handle?.resetToSolved}
          onClick={() => {
            const reset = cube.handle?.resetToSolved
            if (!reset) return
            setLines((current) => [...current, '[SYSTEM] resetting cube state to solved…'])
            void reset().then((ok) => {
              setLines((current) => [...current, ok ? '[SYSTEM] cube reset to solved' : '[SYSTEM] cube refused the reset'])
              if (ok) void cube.handle?.requestState()
            })
          }}
          className={secondaryButton}
        >Reset cube to solved</button>
        <button
          type="button"
          disabled={cube.connecting}
          onClick={() => { setLines([]); void cube.connect(simulatorSource({ seed: 'diagnostics' })) }}
          className={secondaryButton}
        >Run simulator</button>
        <button
          type="button"
          onClick={() => {
            const scramble = currentTargetScramble().split(/\s+/).filter(Boolean)
            if (scramble.length === 0) { setLines((current) => [...current, '[SYSTEM] no scramble to perform']); return }
            const wrong = scramble[3]?.startsWith('U') ? 'D' : 'U'
            const moves = [...scramble.slice(0, 3), wrong]
            setLines((current) => [...current, `[SYSTEM] performing ${moves.join(' ')} (last move deliberately wrong)`])
            void cube.connect(scriptedSource(moves, { gapMs: 300 }))
          }}
          className={secondaryButton}
        >Scramble then a wrong turn</button>

        <button
          type="button"
          onClick={() => {
            const scramble = currentTargetScramble()
            if (!scramble) { setLines((current) => [...current, '[SYSTEM] no scramble to perform']); return }
            setLines((current) => [...current, `[SYSTEM] performing ${scramble}`])
            void import('cubing/search')
              .then(async ({ experimentalSolve3x3x3IgnoringCenters }) => {
                const { Alg } = await import('cubing/alg')
                const { puzzles } = await import('cubing/puzzles')
                const kpuzzle = await puzzles['3x3x3'].kpuzzle()
                const pattern = kpuzzle.defaultPattern().applyAlg(Alg.fromString(scramble))
                const solution = await experimentalSolve3x3x3IgnoringCenters(pattern)
                const moves = `${scramble} ${solution.toString()}`.split(/\s+/).filter(Boolean)
                await cube.connect(scriptedSource(moves))
                setLines((current) => [...current, `[SYSTEM] solution ${solution.toString()}`])
              })
              .catch((error: unknown) => setLines((current) => [...current, `[SYSTEM] ${String(error)}`]))
          }}
          className={secondaryButton}
        >Perform this scramble and solve</button>
        <label className={cx(secondaryButton, css({ position: 'relative', cursor: 'pointer', _focusWithin: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } }))}>
          Replay capture through cube path
          <input type="file" accept="application/json" className={css({ srOnly: true })} onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void file.text().then((json) => cube.connect(sessionSource(parseDeviceSession(json), { delayMs: 0 })))
          }} />
        </label>
        </div>
      </div>

      <div className={css({ lg: { gridColumn: 'span 5' }, display: 'flex', flexDirection: 'column', gap: 'gutter' })}>
        <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4' })}>
          <div className={css({ bg: 'surface', borderWidth: '1px', borderColor: 'floating', borderRadius: 'control', p: '3' })}>
            <Label>Orientation (quat)</Label>
            <div className={css({ mt: '2', display: 'flex', flexDirection: 'column', gap: '1', fontFamily: 'mono', fontSize: 'xs', color: 'ink' })}>
              {quaternion
                ? (['w', 'x', 'y', 'z'] as const).map((axis) => <span key={axis}>{axis}: {quaternion[axis].toFixed(3)}</span>)
                : <span className={css({ color: 'inkVariant' })}>{DASH}</span>}
            </div>
          </div>
          <div className={css({ bg: 'surface', borderWidth: '1px', borderColor: 'floating', borderRadius: 'control', p: '3' })}>
            <Label>Angular velocity</Label>
            <div className={css({ mt: '2', display: 'flex', flexDirection: 'column', gap: '1', fontFamily: 'mono', fontSize: 'xs', color: 'ink' })}>
              {velocity
                ? (['x', 'y', 'z'] as const).map((axis) => <span key={axis}>{axis}: {velocity[axis].toFixed(3)}</span>)
                : <span className={css({ color: 'inkVariant' })}>{DASH}</span>}
            </div>
          </div>
        </div>

        <div className={css({ flex: '1', minH: '240px', display: 'flex', flexDirection: 'column', bg: 'surface', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card', overflow: 'hidden' })}>
          <div className={css({ px: '3', py: '2', borderBottomWidth: '1px', borderColor: 'floating', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '3', flexWrap: 'wrap' })}>
            <Label>Live receive stream</Label>
            <span className={css({ fontFamily: 'mono', fontSize: '2xs', color: cube.handle ? 'green' : 'inkVariant' })}>
              {capture
                ? `${capture.status} · scramble ${capture.scrambleMoves.length}/${capture.scramble.split(/\s+/).filter(Boolean).length} · solve ${capture.solveMoves.length}`
                : cube.handle ? 'listening' : 'idle'}
            </span>
          </div>
          <div ref={logRef} className={css({ flex: '1', minH: '0', overflowY: 'auto', p: '4', fontFamily: 'mono', fontSize: '2xs', color: 'inkVariant', display: 'flex', flexDirection: 'column', gap: '1' })}>
            {lines.length === 0
              ? <span>No packets received yet.</span>
              : lines.map((line, index) => (
                <span key={index} className={css({ color: line.startsWith('[MOVE]') ? 'greenBright' : 'inkVariant' })}>{line}</span>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
