import { useEffect, useRef, useState } from 'react'
import { css } from 'styled-system/css'
import { currentTargetScramble, subscribeCapture, useCubeConnection } from '../../device/CubeConnection'
import type { CaptureSnapshot } from '../../device/capture'
import type { CubeEvent } from '../../device/inputSource'
import { scriptedSource, sessionSource, simulatorSource } from '../../device/sources'
import { parseDeviceSession } from '../../device/deviceRecorder'

// Ported from docs/design/stitch/diagnostics_calibration/code.html: the cube state on the
// left, sensor readouts and a live receive stream on the right. The export also shows an
// accelerometer and a calibration save; this protocol sends neither an accelerometer
// reading nor anything to persist, so those are absent rather than mocked.

const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'] as const
const FACE_COLOUR: Record<string, string> = {
  U: '#f7f9fc', R: '#b90000', F: '#009b48',
  D: '#ffd500', L: '#ff5900', B: '#0051ba'
}

const LabelCaps = ({ children }: { children: React.ReactNode }) => (
  <span className={css({ fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'inkVariant' })}>{children}</span>
)

const DASH = '—'
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
  // The capture engine's own view of the cube, so a solve that never records can be
  // diagnosed from the app instead of guessed at.
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

  // The facelet string is U R F D L B, nine stickers per face, in that order.
  const faces = facelets && facelets.length >= 54
    ? FACE_ORDER.map((label, index) => ({ label, stickers: facelets.slice(index * 9, index * 9 + 9).split('') }))
    : undefined

  return (
    <div className={css({ display: 'grid', gap: 'gutter', gridTemplateColumns: '1fr', lg: { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' } })}>
      <div className={css({ lg: { gridColumn: 'span 7' }, bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card', p: '6' })}>
        <LabelCaps>Cube state</LabelCaps>
        {faces ? (
          // Cross net: U above F, L and R beside it, B and D below.
          <div className={css({ mt: '4', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1', maxW: '440px' })}>
            <div style={{ gridColumn: 2 }}><Face label="U" stickers={faces[0].stickers} /></div>
            <div style={{ gridColumn: 1, gridRow: 2 }}><Face label="L" stickers={faces[4].stickers} /></div>
            <div style={{ gridColumn: 2, gridRow: 2 }}><Face label="F" stickers={faces[2].stickers} /></div>
            <div style={{ gridColumn: 3, gridRow: 2 }}><Face label="R" stickers={faces[1].stickers} /></div>
            <div style={{ gridColumn: 4, gridRow: 2 }}><Face label="B" stickers={faces[5].stickers} /></div>
            <div style={{ gridColumn: 2, gridRow: 3 }}><Face label="D" stickers={faces[3].stickers} /></div>
          </div>
        ) : (
          <p className={css({ mt: '4', color: 'inkVariant' })}>
            No facelet state received. Connect a cube that reports state, then request it below.
          </p>
        )}

        <button
          type="button"
          disabled={!cube.handle}
          onClick={() => void cube.handle?.requestState()}
          className={css({
            mt: '6', minH: '48px', px: '6', borderRadius: 'control',
            bg: 'transparent', color: 'ink', borderWidth: '1px', borderColor: 'floating',
            cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            _hover: { bg: 'floating' },
            _disabled: { color: 'inkVariant', cursor: 'default' }
          })}
        >Request state</button>

        {/* The cube's own reset-to-solved lives on CubeInputHandle.resetToSolved and was
            never surfaced. Telling the cube its current state IS solved is the only way
            to recover after it desyncs from the app. */}
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
          className={css({
            mt: '6', ml: '3', minH: '48px', px: '6', borderRadius: 'control',
            bg: 'transparent', color: 'ink', borderWidth: '1px', borderColor: 'floating',
            cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            _hover: { bg: 'floating' },
            _disabled: { color: 'inkVariant', cursor: 'default' }
          })}
        >Reset cube to solved</button>

        {/* The project rule is that every capability must be exercisable without
            hardware, so diagnostics can be driven from the software simulator. */}
        <button
          type="button"
          disabled={cube.connecting}
          onClick={() => { setLines([]); void cube.connect(simulatorSource({ seed: 'diagnostics' })) }}
          className={css({
            mt: '6', ml: '3', minH: '48px', px: '6', borderRadius: 'control',
            bg: 'transparent', color: 'green', borderWidth: '1px', borderColor: 'green',
            cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            _hover: { bg: 'rgba(34,197,94,0.12)' }
          })}
        >Run simulator</button>

        {/* Performs the app's OWN current scramble, then a real solution for it, through
            the connection bus. This is the only no-hardware way to exercise the whole
            chain — scramble tracking, solve detection, timing and segmentation — because
            a recorded capture is always a different scramble than the one on screen. */}
        {/* Drives the scramble a few moves in and then a wrong turn, so the off-track
            correction can be seen without needing to fumble a real cube. */}
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
          className={css({
            mt: '6', ml: '3', minH: '48px', px: '6', borderRadius: 'control',
            bg: 'transparent', color: 'amber', borderWidth: '1px', borderColor: 'amber',
            cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
            letterSpacing: '0.12em', textTransform: 'uppercase'
          })}
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
          className={css({
            mt: '6', ml: '3', minH: '48px', px: '6', borderRadius: 'control',
            bg: 'transparent', color: 'green', borderWidth: '1px', borderColor: 'green',
            cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            _hover: { bg: 'rgba(34,197,94,0.12)' }
          })}
        >Perform this scramble &amp; solve</button>

        {/* Replays a recorded capture through the real connection bus, so the tracker,
            the cockpit cube and the solve pipeline all run exactly as with a physical
            cube. Developer affordance — it lives here, not in the solve UI. */}
        <label className={css({
          display: 'inline-block', mt: '6', ml: '3', minH: '48px', px: '6', py: '3',
          borderRadius: 'control', bg: 'transparent', color: 'ink',
          borderWidth: '1px', borderColor: 'floating', cursor: 'pointer',
          fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
          letterSpacing: '0.12em', textTransform: 'uppercase'
        })}>
          Replay capture through cube path
          <input type="file" accept="application/json" className={css({ display: 'none' })} onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void file.text().then((json) => cube.connect(sessionSource(parseDeviceSession(json), { delayMs: 0 })))
          }} />
        </label>
      </div>

      <div className={css({ lg: { gridColumn: 'span 5' }, display: 'flex', flexDirection: 'column', gap: 'gutter' })}>
        <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4' })}>
          <div className={css({ bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'control', p: '4' })}>
            <LabelCaps>Orientation (quat)</LabelCaps>
            <div className={css({ mt: '2', display: 'flex', flexDirection: 'column', gap: '1', fontFamily: 'mono', fontSize: 'xs', color: 'ink' })}>
              {quaternion
                ? (['w', 'x', 'y', 'z'] as const).map((axis) => <span key={axis}>{axis}: {quaternion[axis].toFixed(3)}</span>)
                : <span className={css({ color: 'inkVariant' })}>{DASH}</span>}
            </div>
          </div>
          <div className={css({ bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'control', p: '4' })}>
            <LabelCaps>Angular velocity</LabelCaps>
            <div className={css({ mt: '2', display: 'flex', flexDirection: 'column', gap: '1', fontFamily: 'mono', fontSize: 'xs', color: 'ink' })}>
              {velocity
                ? (['x', 'y', 'z'] as const).map((axis) => <span key={axis}>{axis}: {velocity[axis].toFixed(3)}</span>)
                : <span className={css({ color: 'inkVariant' })}>{DASH}</span>}
            </div>
          </div>
        </div>

        <div className={css({ flex: '1', minH: '240px', display: 'flex', flexDirection: 'column', bg: 'surface', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card', overflow: 'hidden' })}>
          <div className={css({ px: '4', py: '2', bg: 'container', borderBottomWidth: '1px', borderColor: 'floating', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
            <LabelCaps>Live receive stream</LabelCaps>
            {/* The capture engine's own view, so a solve that never records can be
                diagnosed from the app rather than guessed at. */}
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
