import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { css } from 'styled-system/css'
import { viewRotationForHold } from '../../domain/cubeHold'
import { defaultPreferences } from '../../storage/preferences'
import { SolveCockpit, type AverageRow, type SolveRow, type StageSplit } from './SolveCockpit'
import { Cube3D } from './Cube3D'
import { SolveAnalysis } from './SolveAnalysis'
import { useCubeConnection, useCubedexCubeTracker } from '../../device/CubeConnection'
import { bluetoothSource, sessionSource } from '../../device/sources'
import { replaySessionIntoStorage } from '../../device/replayIntoStorage'
import type { CaptureSession, CaptureSnapshot } from '../../device/capture'
import { subscribeSolveSaved } from '../../device/recordCapture'
import { currentTargetScramble, ensureSharedCapture, ensureSharedScramble, newSharedScramble, subscribeCapture, subscribeScramble } from '../../device/CubeConnection'
import { parseDeviceSession } from '../../device/deviceRecorder'
import { readPreferences } from '../../storage/preferences'
import {
  ARM_HOLD_MS,
  handleArmTimeout,
  handleSpaceDown,
  handleSpaceUp,
  handleStopKey,
  idleKeyboardTimerState,
  isWithinStopGuard,
  keyboardTimerElapsedMs,
  type KeyboardTimerState
} from '../../domain/keyboardTimer'
import { repositories } from '../../storage/database'
import { createId } from '../../domain/ids'
import { averageOf, bestAverageOf } from '../../domain/statistics'
import { buildInsights } from '../../domain/coachInsights'
import { ANALYSIS_VERSION, type SolveRecord, type StageRecord } from '../../domain/models'

// Wires the cockpit to real stored solves. Nothing here invents a number: a value the
// data cannot support is rendered as an em dash, per the design system's own rule that
// "—" is the empty state rather than 0.00, so a blank is never mistaken for a measurement.
const DASH = '–'

// Penalty-aware, matching statistics.ts effectiveSolveMs. Using the raw duration here
// put a DNF'd solve in the rail as a valid time — and let it win "best" — while the ao5
// rows on the same screen correctly excluded it.
const secondsOf = (solve: SolveRecord) => ((solve.endedAt - solve.startedAt) + (solve.penalty === '+2' ? 2000 : 0)) / 1000
const isDnf = (solve: SolveRecord) => solve.penalty === 'dnf'

function tpsOf(solve: SolveRecord) {
  const elapsed = secondsOf(solve)
  if (elapsed <= 0 || solve.moves.length === 0) return DASH
  return (solve.moves.length / elapsed).toFixed(2)
}

function averageLabel(milliseconds: number | undefined) {
  return milliseconds === undefined ? DASH : (milliseconds / 1000).toFixed(2)
}

export function SolveRoute({ onOpenStatistics }: { onOpenStatistics?(): void } = {}) {
  // A scramble to actually solve next. Without one the tracker has no scrambling phase
  // to leave, so "Done scrambling" could never appear (rebuild-spec §1.1).
  // The scramble is app state (see ensureSharedScramble): the capture session must have one
  // from app start, whichever page the user lands on.
  const [pendingScramble, setPendingScramble] = useState(currentTargetScramble)
  useEffect(() => {
    void ensureSharedScramble().then(setPendingScramble).catch(() => undefined)
    return subscribeScramble(setPendingScramble)
  }, [])

  const cube = useCubeConnection()
  const tracker = useCubedexCubeTracker(pendingScramble)

  // The cockpit cube must reflect the physical cube, so every resolved move is appended
  // to the setup alg and the player re-renders that position. Without this it showed the
  // scramble and never turned, no matter what the solver did.
  // The cockpit printed "hold [SPACE] to start timer" while registering no key listener,
  // because the timer lived in LiveSolve.tsx, which is never mounted. The state machine
  // is already a pure domain module, so the cockpit drives it directly.
  // Seeded from the live session, not from an empty placeholder: the capture is application
  // state that keeps running while this page is unmounted, so a page that starts at 'idle'
  // and waits for the next emit shows a scramble nobody is on and a cube nobody turned until
  // the solver happens to turn again.
  const [capture, setCapture] = useState<CaptureSnapshot>(() => ensureSharedCapture().snapshot)
  const [justSolvedMs, setJustSolvedMs] = useState<number>()
  const [timer, setTimer] = useState<KeyboardTimerState>(idleKeyboardTimerState)
  const [useInspection, setUseInspection] = useState(false)
  useEffect(() => { void readPreferences().then((prefs) => setUseInspection(prefs.wcaInspection)).catch(() => undefined) }, [])
  const [tick, setTick] = useState(0)

  // Read inside the listener without re-registering it on every phase change.
  const timerPhase = useRef(timer.phase)
  timerPhase.current = timer.phase

  useEffect(() => {
    const isSpace = (event: KeyboardEvent) => event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar'
    const onKeyDown = (event: KeyboardEvent) => {
      // `event.target` is not always an Element (window/document dispatch), and calling
      // getAttribute on those throws inside the listener, which silently swallows the
      // keypress and leaves the timer at 0.00.
      const target = event.target instanceof HTMLElement ? event.target : null
      // Space activates a focused button/link; hijacking it made "Done scrambling" and
      // "Connect Smart Cube" unreachable for keyboard users.
      if (target && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName) || target.isContentEditable || target.getAttribute('role') === 'button')) return
      const now = performance.now()
      // A running timer stops on ANY key, as every speedcubing timer does — you slam the
      // keyboard, you don't hunt for the space bar. Only the start is space-specific.
      if (timerPhase.current === 'running') {
        event.preventDefault()
        setTimer((state) => state.phase === 'running' ? handleStopKey(state, now) : state)
        return
      }
      if (!isSpace(event)) return
      event.preventDefault()
      setTimer((state) => isWithinStopGuard(state, now) ? state : handleSpaceDown(state, now))
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!isSpace(event)) return
      setTimer((state) => handleSpaceUp(state, performance.now(), useInspection))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [useInspection])

  // holding -> armed after the hold threshold. Without this the release always fell back
  // to idle and the timer could never start.
  useEffect(() => {
    if (timer.phase !== 'holding' && timer.phase !== 'inspectionHolding') return
    const id = setTimeout(() => setTimer((state) => handleArmTimeout(state, performance.now())), ARM_HOLD_MS)
    return () => clearTimeout(id)
  }, [timer.phase, timer.holdStartedAt])

  useEffect(() => {
    // Inspection needs the same repaint loop as the solve, or the countdown is frozen.
    if (timer.phase !== 'running' && !timer.phase.startsWith('inspection') && capture.status !== 'solving') return
    let frame = 0
    const step = () => { setTick((count) => count + 1); frame = requestAnimationFrame(step) }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // capture.status belongs here: a cube-only solve never changes timer.phase, so with
    // this keyed on the keyboard timer alone the hero only repainted when a move arrived
    // and the clock visibly froze during every think-pause.
  }, [timer.phase, capture.status])

  // A timer that discards its result is a stopwatch, not a trainer. On stop the solve is
  // written with source 'keyboard' and stateVerified false: no smart-cube move stream
  // backs it, so it must not masquerade as a captured solve.
  useEffect(() => {
    if (timer.phase !== 'stopped' || timer.startedAt === undefined || timer.stoppedAt === undefined) return
    const durationMs = timer.stoppedAt - timer.startedAt
    if (durationMs < 1000) return
    const endedAt = Date.now()
    const record: SolveRecord = {
      id: createId(),
      sessionId: 'default',
      puzzle: '3x3x3',
      scramble: pendingScramble,
      scrambleGenerator: 'cubing.js-333',
      startedAt: endedAt - durationMs,
      endedAt,
      penalty: timer.penalty === '+2' ? '+2' : timer.penalty === 'dnf' ? 'dnf' : 'none',
      analysisVersion: ANALYSIS_VERSION,
      rawEventIds: [],
      moves: [],
      source: 'keyboard',
      stateVerified: false,
      verificationDetail: 'keyboard timer, no move stream'
    }
    void repositories.solves.put(record).then(() => {
      setReload((count) => count + 1)
      void newSharedScramble().catch(() => undefined)
    })
  }, [timer.phase, timer.startedAt, timer.stoppedAt])

  // The capture state machine already exists and is already correct (idle → scrambling →
  // ready → solving → complete, scramble/solve move split, generation guards). This route
  // only needed a new design, so it drives that engine rather than reimplementing it —
  // reimplementing it is what broke the solve path.
  // The capture session lives in the connection provider, not here: the cube is tracked
  // for the whole application, so a solve started on this page and finished after
  // navigating elsewhere is still the same solve. This route only supplies the completion
  // handler and renders the snapshots.
  const sessionRef = useRef<CaptureSession | null>(null)
  sessionRef.current = ensureSharedCapture()
  useEffect(() => {
    // Re-read on subscribe as well: anything that happened between render and this effect
    // would otherwise be missed entirely.
    setCapture(ensureSharedCapture().snapshot)
    return subscribeCapture((snapshot) => {
      if (snapshot.status === 'complete' && snapshot.startedAt !== undefined && snapshot.endedAt !== undefined) setJustSolvedMs(snapshot.endedAt - snapshot.startedAt)
      else if (snapshot.scrambleMoves.length > 0 || snapshot.status === 'solving') setJustSolvedMs(undefined)
      setCapture(snapshot)
    })
  }, [])
  // Persistence lives in recordCapture (app-wide); this route only follows the result.
  useEffect(() => subscribeSolveSaved(() => setReload((count) => count + 1)), [])


  const [solves, setSolves] = useState<SolveRecord[]>([])
  const [stages, setStages] = useState<StageRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  // The full breakdown opens right here, on the page you land on — not a route away.
  const [detailId, setDetailId] = useState<string>()
  // The live cube is shown in the hold the solver actually uses.
  const [hold, setHold] = useState({ top: defaultPreferences.diagramTopColor, front: defaultPreferences.diagramFrontColor })
  useEffect(() => {
    void readPreferences()
      .then((prefs) => setHold({ top: prefs.diagramTopColor, front: prefs.diagramFrontColor }))
      .catch(() => undefined)
  }, [])
  const [reload, setReload] = useState(0)

  useEffect(() => {
    void Promise.all([repositories.solves.all(), repositories.stages.all()])
      .then(([allSolves, allStages]) => {
        const ordered = allSolves.sort((left, right) => right.endedAt - left.endedAt)
        setSolves(ordered)
        setStages(allStages)
        // Follow the newest solve on every reload. `current ?? …` only ever fired once,
        // so after saving a solve the hero and rail still showed the previous one.
        setSelectedId((current) => (reload === 0 ? (current ?? ordered[0]?.id) : ordered[0]?.id))
      })
      .catch(() => undefined)
  }, [reload])

  const selected = solves.find((solve) => solve.id === selectedId) ?? solves[0]
  const bestTime = solves.filter((solve) => !isDnf(solve)).reduce<number | undefined>((best, solve) => {
    const value = secondsOf(solve)
    return best === undefined || value < best ? value : best
  }, undefined)

  const solveRows: SolveRow[] = solves.slice(0, 24).map((solve) => ({
    id: solve.id,
    endedAt: solve.endedAt,
    tps: tpsOf(solve),
    time: isDnf(solve) ? 'DNF' : secondsOf(solve).toFixed(2),
    best: !isDnf(solve) && bestTime !== undefined && Math.abs(secondsOf(solve) - bestTime) < 0.0001,
    selected: solve.id === selected?.id
  }))

  const selectedStages = selected
    ? stages.filter((stage) => stage.solveId === selected.id).sort((left, right) => left.startEvent - right.startEvent)
    : []

  // Cross, F2L (all four slots summed), OLL, PLL — the four bands the export charts.
  const f2l = selectedStages.filter((stage) => stage.name.startsWith('F2L'))
  const splits: StageSplit[] = selectedStages.length === 0 ? [] : [
    band('Cross', selectedStages.filter((stage) => stage.name === 'Cross')),
    band('F2L', f2l),
    band('OLL', selectedStages.filter((stage) => stage.name === 'OLL')),
    band('PLL', selectedStages.filter((stage) => stage.name === 'PLL'))
  ].filter((split): split is StageSplit => split !== undefined)

  const averages = useMemo<AverageRow[]>(() => [
    { label: 'single', now: selected ? (isDnf(selected) ? 'DNF' : secondsOf(selected).toFixed(2)) : DASH, best: bestTime === undefined ? DASH : bestTime.toFixed(2) },
    { label: 'ao5', now: averageLabel(averageOf(solves, 5)), best: averageLabel(bestAverageOf(solves, 5)), emphasis: true },
    { label: 'ao12', now: averageLabel(averageOf(solves, 12)), best: averageLabel(bestAverageOf(solves, 12)) },
    { label: 'ao50', now: averageLabel(averageOf(solves, 50)), best: averageLabel(bestAverageOf(solves, 50)) },
    { label: 'ao100', now: averageLabel(averageOf(solves, 100)), best: averageLabel(bestAverageOf(solves, 100)) }
  ], [solves, selected, bestTime])

  const insights = useMemo(() => buildInsights(stages).slice(0, 2), [stages])
  const turns = selected?.moves.length
  const pauses = selectedStages.reduce((total, stage) => total + (stage.pauseCount ?? 0), 0)

  const detailSolve = solves.find((record) => record.id === detailId)
  const closeDetail = useCallback(() => setDetailId(undefined), [])

  return (
    <>
    <SolveCockpit
      solveNumber={pendingScramble ? solves.length + 1 : (solves.length || undefined)}
      scramble={pendingScramble || (selected?.scramble ?? '')}
      // No boxed move. `scrambleRemaining` is the move SEQUENCE still needed to reach the
      // target state (recomputed from the cube's actual state every move, tolerant of
      // wrong-direction turns) — it is not a suffix of the displayed scramble, so deriving
      // an index from its length made the highlight jump around at random.
      // Scramble progress comes from the capture engine, which owns this state. Reading
      // the solve tracker here meant two sources of truth and a line that never moved.
      scrambleProgress={capture.status === 'scrambling'
        ? {
            // Matched, not turned: a wrong turn must not advance the marker.
            done: Math.min(capture.matchedIndex ?? 0, capture.scramble.split(/\s+/).filter(Boolean).length),
            total: capture.scramble.split(/\s+/).filter(Boolean).length,
            offTrack: capture.offTrack,
            // ONLY the short route back to the point the solver actually reached. There used
            // to be a fallback to the tracker's `scrambleRemaining` whenever that route was
            // not found, and `scrambleRemaining` starts life as the entire target scramble —
            // so a cube that was merely at the start of the scramble was told it was "off"
            // and handed all twenty-one moves to "get back on the scramble". Routing to the
            // fully scrambled state is a rejected approach on record
            // (docs/research/gyst-2026-08-04-state-and-verification.md, "The way back must be
            // stateless", attempt 2); it must not come back in through the UI.
            undo: capture.recovery ?? []
          }
        // Scrambled: every move is done, nothing is "next". Reporting 0/0 sent the marker
        // back to the first move, which read as "start the scramble again".
        : capture.status === 'ready'
          ? {
              done: capture.scramble.split(/\s+/).filter(Boolean).length,
              total: capture.scramble.split(/\s+/).filter(Boolean).length,
              offTrack: false,
              undo: []
            }
          : undefined}
      // Recalibrate: tell the app the cube in your hands is solved, and start tracking
      // from there. This is the app's own state, which is the only reliable reference.
      onNewScramble={() => { void newSharedScramble().catch(() => undefined) }}
      // While the timer is live it shows the running time; otherwise the selected solve.
      // Previously this was always a stored solve's duration, so an 11rem readout that
      // looks like a timer never ticked.
      // During inspection the hero counts the WCA 15 seconds down; a frozen 0.00 gave the
      // solver no signal that inspection had even begun.
      // A cube solve is timed by the capture engine (startedAt is set on your first solve
      // move). Previously only the keyboard timer drove this readout, so turning the cube
      // started the engine's clock while the screen stayed at 0.00.
      elapsed={capture.status === 'solving' && capture.startedAtWall !== undefined
        ? ((Date.now() - capture.startedAtWall) / 1000).toFixed(2)
        : capture.status === 'complete' && capture.startedAt !== undefined && capture.endedAt !== undefined
          ? ((capture.endedAt - capture.startedAt) / 1000).toFixed(2)
          : timer.phase.startsWith('inspection') && timer.inspectionStartedAt !== undefined
        ? Math.max(0, 15 - (performance.now() - timer.inspectionStartedAt) / 1000).toFixed(2)
        : timer.phase === 'idle'
          ? (justSolvedMs !== undefined ? (justSolvedMs / 1000).toFixed(2) : selected && capture.scrambleMoves.length === 0 ? (isDnf(selected) ? 'DNF' : secondsOf(selected).toFixed(2)) : '0.00')
          : timer.phase === 'stopped'
            ? (selected ? (isDnf(selected) ? 'DNF' : secondsOf(selected).toFixed(2)) : '0.00')
            : (keyboardTimerElapsedMs(timer, performance.now()) / 1000).toFixed(2)}
      connected={cube.handle !== undefined}
      tps={selected ? tpsOf(selected) : undefined}
      turns={turns}
      fluency={selectedStages.length > 0 && turns ? `${Math.max(0, 100 - Math.round((pauses / turns) * 100))}%` : undefined}
      awaitingSolve={capture.status !== 'complete' && justSolvedMs === undefined && selected !== undefined}
      splits={splits}
      insights={insights}
      onOpenInsights={onOpenStatistics}
      solves={solveRows}
      averages={averages}
      sessionName="Default Session"
      // Drives a recorded capture through the LIVE path — the same tracker, cube and
      // timer a physical cube feeds — so the scramble tracker and the turning cube are
      // exercisable without hardware, which this project requires of every capability.
      onReplayLive={async (json) => {
        const record = parseDeviceSession(json)
        // Aim both the tracker and the capture session at the scramble this session was
        // actually recorded against, not at whatever this page happens to be showing.
        await tracker.resetToSolved(record.scramble ?? '')
        const source = sessionSource(record, { delayMs: 0 })
        const handle = await source.start(
          (event) => tracker.handleEvent(event),
          () => undefined
        )
        await handle.done?.catch(() => undefined)
      }}
      onReplay={async (json) => { await replaySessionIntoStorage(json, 'default'); setReload((count) => count + 1) }}
      // Connect means connect a real cube. An earlier version fell back to the software
      // simulator when Web Bluetooth was missing, which auto-ran a scramble and solve —
      // the timer started by itself and a fabricated solve would have been recorded.
      // Simulated input belongs behind an explicit control (Settings > Run simulator).
      onConnect={() => {
        if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
          cube.setStatus('Web Bluetooth unavailable in this browser')
          return
        }
        void cube.connect(bluetoothSource()).catch(() => undefined)
      }}
      onSelectSolve={(id) => { setSelectedId(id); setDetailId(id) }}
      // The 3D cube mirrors YOUR cube, which the app tracks from solved by applying the
      // moves you turn — the same state the tracker uses. It previously rendered the
      // target scramble, so it could never follow your turns and "Cube is solved" changed
      // nothing on screen. The scramble to perform is the text above; this is your cube.
      cube={<Cube3D gyro gyroResetKey={capture.scrambledAt} viewRotation={viewRotationForHold(hold.top, hold.front)} setupAlg={[capture.startAlg ?? '', ...capture.scrambleMoves, ...capture.solveMoves].filter(Boolean).join(' ')} />}
    />
    {detailSolve && (
      <BreakdownDialog
        title={`Solve breakdown, ${detailSolve.penalty === 'dnf' ? 'DNF' : `${secondsOf(detailSolve).toFixed(2)} seconds`}`}
        onClose={closeDetail}
      >
        <SolveAnalysis
          solve={detailSolve}
          stages={stages.filter((stage) => stage.solveId === detailSolve.id).sort((left, right) => left.startEvent - right.startEvent)}
          history={stages}
          onDeleted={() => { closeDetail(); setReload((count) => count + 1) }}
          penalty={detailSolve.penalty === '+2' ? 'plus_two' : detailSolve.penalty === 'dnf' ? 'dnf' : 'none'}
          onPenalty={(next) => {
            const penalty = next === 'plus_two' ? '+2' : next === 'dnf' ? 'dnf' : 'none'
            void repositories.solves.put({ ...detailSolve, penalty } as SolveRecord)
              .then(() => setReload((count) => count + 1))
          }}
        />
      </BreakdownDialog>
    )}
    </>
  )
}

function BreakdownDialog({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    close.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className={css({ position: 'fixed', inset: '0', zIndex: '50', bg: 'rgba(9,9,11,0.86)', display: 'flex', justifyContent: 'center', p: { base: '0', lg: '6' } })}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={css({ w: 'full', maxW: '1180px', display: 'flex', flexDirection: 'column', bg: 'surface', borderWidth: { base: '0', lg: '1px' }, borderColor: 'floating', borderRadius: { base: '0', lg: 'card' }, overflow: 'hidden' })}
      >
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '3', px: { base: '4', md: '6' }, py: '2', pt: { base: 'calc(env(safe-area-inset-top, 0px) + 8px)', lg: '2' }, borderBottomWidth: '1px', borderColor: 'floating' })}>
          <h2 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>Solve breakdown</h2>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            className={css({ px: '4', minH: '44px', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating', bg: 'transparent', color: 'ink', cursor: 'pointer', fontSize: 'sm', _hover: { bg: 'floating' }, _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } })}
          >Close</button>
        </div>
        <div className={css({ flex: '1', minH: '0', overflowY: 'auto', px: { base: '4', md: '8' }, py: { base: '5', md: '8' } })}>{children}</div>
      </div>
    </div>
  )
}

function band(label: string, records: StageRecord[]): StageSplit | undefined {
  if (records.length === 0) return undefined
  const measured = records.filter((stage) => stage.executionMs !== undefined || stage.recognitionMs !== undefined)
  if (measured.length === 0) return undefined
  const seconds = measured.reduce((total, stage) => total + ((stage.recognitionMs ?? 0) + (stage.executionMs ?? 0)), 0) / 1000
  // Count moves over the SAME stages the seconds come from. Summing all stages' moves
  // against only the measured stages' seconds roughly doubled the reported band TPS.
  const moves = measured.reduce((total, stage) => total + stage.moveCount, 0)
  return {
    label,
    seconds,
    tps: seconds > 0 && moves > 0 ? (moves / seconds).toFixed(2) : undefined
  }
}
