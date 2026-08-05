import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CubeEvent, CubeInputHandle, CubeInputSource } from './inputSource'
import { bluetoothSource } from './sources'
import { supportsWebBluetooth } from './webBluetooth'
import { generateScramble } from '../domain/scramble'
import { CubedexMoveTracker, type ResolvedCubeMove } from './cubedex/moveTracker'
import { CubedexSolveTracker, type SolveTrackerSnapshot } from './cubedex/solveTracker'
import { CaptureSession, type CaptureSnapshot } from './capture'
import { recordCompletedCapture } from './recordCapture'

type Listener = (event: CubeEvent) => void | Promise<void>

export type CubeConnectionValue = {
  handle?: CubeInputHandle
  status: string
  connecting: boolean
  batteryLevel?: number
  connect(source: CubeInputSource): Promise<CubeInputHandle | undefined>
  disconnect(): Promise<void>
  subscribe(listener: Listener): () => void
  setStatus(status: string): void
}

// Held on globalThis so a hot module replacement — which re-evaluates this file while the
// mounted provider keeps the OLD context object — cannot leave consumers reading a brand-new,
// empty context and throwing "must be used inside CubeConnectionProvider". That crash took
// the whole solve page down mid-session during development.
const contextKey = '__smartCubeConnectionContext'
const globalScope = globalThis as typeof globalThis & {
  [contextKey]?: ReturnType<typeof createContext<CubeConnectionValue | undefined>>
}
const CubeConnectionContext = globalScope[contextKey]
  ?? (globalScope[contextKey] = createContext<CubeConnectionValue | undefined>(undefined))


export function CubeConnectionProvider({ children }: { children: ReactNode }) {
  const [handle, setHandle] = useState<CubeInputHandle>()
  const [status, setStatus] = useState('No cube connected')
  const [connecting, setConnecting] = useState(false)
  const [batteryLevel, setBatteryLevel] = useState<number>()
  const listeners = useRef(new Set<Listener>())
  const handleRef = useRef<CubeInputHandle | undefined>(undefined)

  // This provider lives above every route in App.tsx, so `handleRef`/`listeners`
  // outlive whichever page happens to be mounted. A page unsubscribing (route
  // change, component unmount) only removes its own listener from the shared
  // set below — it must never call `stop()` on the device, or every other page
  // would lose the connection the moment one page navigated away.
  const emit = useCallback(async (event: CubeEvent) => {
    if (event.type === 'DISCONNECT') {
      // The device can drop while no page is subscribed to react to it (e.g.
      // the user is on Train, not Live Solve). The shared connection state
      // must reflect that immediately regardless of which page is mounted,
      // otherwise the topnav indicator and every other page keep reporting a
      // connection that no longer exists.
      handleRef.current = undefined
      setHandle(undefined)
      setBatteryLevel(undefined)
      setStatus('Cube disconnected')
    }
    if (event.type === 'BATTERY') setBatteryLevel(event.batteryLevel)
    for (const listener of [...listeners.current]) await listener(event)
  }, [])

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => { listeners.current.delete(listener) }
  }, [])

  // Cube state is tracked for the WHOLE application, from app start — not from whenever
  // the solve page happens to mount. Every move reaches the shared trackers regardless of
  // which route is open, so navigating mid-scramble no longer loses the cube.
  useEffect(() => {
    ensureSharedTrackers()
    void ensureSharedScramble()
    // registerTrackerBus, not a second subscribe(): the hook registers the same listener,
    // and while both were live every move was delivered to the tracker twice — 58 tracked
    // moves for a 21-move scramble, which could never verify.
    return registerTrackerBus(subscribe)
  }, [subscribe])

  const connect = useCallback(async (source: CubeInputSource) => {
    setConnecting(true)
    try {
      await handleRef.current?.stop().catch(() => undefined)
      const next = await source.start(emit, setStatus)
      handleRef.current = next
      setHandle(next)
      setBatteryLevel(undefined)
      setStatus(`${next.name} · ${next.protocol}`)
      return next
    } finally {
      setConnecting(false)
    }
  }, [emit])

  const disconnect = useCallback(async () => {
    await handleRef.current?.stop().catch(() => undefined)
    handleRef.current = undefined
    setHandle(undefined)
    setBatteryLevel(undefined)
    setStatus('No cube connected')
  }, [])

  const value = useMemo<CubeConnectionValue>(
    () => ({ handle, status, connecting, batteryLevel, connect, disconnect, subscribe, setStatus }),
    [handle, status, connecting, batteryLevel, connect, disconnect, subscribe]
  )

  return <CubeConnectionContext.Provider value={value}>{children}</CubeConnectionContext.Provider>
}

export function useCubeConnection() {
  const value = useContext(CubeConnectionContext)
  if (!value) throw new Error('useCubeConnection must be used inside CubeConnectionProvider')
  return value
}

export function CubeConnectionIndicator() {
  const cubeLink = useCubeConnection()
  const connect = async () => {
    if (cubeLink.connecting) return
    await cubeLink.connect(bluetoothSource({ requestInitialState: true }))
      .catch((error: unknown) => cubeLink.setStatus(error instanceof Error ? error.message : 'Could not connect to a cube'))
  }
  const label = cubeLink.handle
    ? `${cubeLink.handle.name || 'Cube'} · ${cubeLink.handle.protocol}`
    : cubeLink.connecting
      ? 'Connecting…'
      : 'No cube connected'
  const detail = cubeLink.handle
    ? cubeLink.batteryLevel !== undefined
      ? `Battery ${cubeLink.batteryLevel}%`
      : cubeLink.status
    : supportsWebBluetooth()
      ? 'Not connected'
      : 'Web Bluetooth unavailable'

  return (
    <div className="cube-status">
      <span className={cubeLink.handle ? 'status-dot' : 'status-dot offline'} />
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      {/* Reset lives here, not buried in Settings: a cube desyncs mid-solve on whatever
          screen you happen to be on, and this indicator is in the header on every route. */}
      {(
        <button
          className="button ghost"
          title="Tell the app the cube in your hands is solved"
          onClick={() => {
            void resetTrackedCubeToSolved().then(() => cubeLink.setStatus('Tracking restarted from solved'))
          }}
        >Reset cube</button>
      )}
      {cubeLink.handle
        ? <button className="button ghost" onClick={() => void cubeLink.disconnect()}>Disconnect</button>
        : <button
            className="button ghost"
            disabled={cubeLink.connecting || !supportsWebBluetooth()}
            onClick={() => void connect()}
          >
            {cubeLink.connecting ? 'Connecting…' : 'Connect cube'}
          </button>}
    </div>
  )
}

export type CubedexTrackerState = SolveTrackerSnapshot & { lastMove: ResolvedCubeMove | null; handleEvent: (event: CubeEvent) => void; resetToSolved: (targetScramble?: string) => Promise<void> }

// Wires the ported cubedex move/scramble/solve-timing logic (src/device/cubedex/)
// into the shared cube connection: every event this app's device layer already emits
// on `subscribe` is fed through CubedexMoveTracker (slice pairing + pattern tracking)
// and then CubedexSolveTracker (scramble-to-target matching + solved-state timing).
// Tracked cube state must outlive any single page, exactly as the connection does. While
// these refs were per-component, navigating away mid-scramble destroyed the tracker: the
// header kept reporting a live cube while the app had forgotten where that cube was.
let onSharedResolvedMove: ((resolved: ResolvedCubeMove) => void) | null = null

/** Creates the shared trackers once, so tracking exists before any page mounts. */
export function ensureSharedTrackers(targetScramble = '') {
  if (!sharedSolveTracker.current) sharedSolveTracker.current = new CubedexSolveTracker(targetScramble)
  if (!sharedMoveTracker.current) {
    // Reads sharedSolveTracker.current on every move rather than closing over it: a new
    // scramble replaces the solve tracker, and a captured reference would keep feeding the
    // discarded one — which is exactly how the capture session stopped receiving moves.
    sharedMoveTracker.current = new CubedexMoveTracker(async (resolved) => {
      await sharedSolveTracker.current?.onResolvedMove(resolved)
      // NOTHING in the move stream moves the capture session out of scrambling. The ported
      // tracker used to have a hands-free accept gesture; wiring it here let the timer start
      // by itself, and it has since been removed from the tracker entirely. The capture
      // session leaves 'scrambling' only when the cube's own state matches the scramble.
      const capture = ensureSharedCapture()
      for (const raw of resolved.rawMoves) {
        // The cube's own timestamp is the accurate one — it is not subject to Bluetooth
        // delivery jitter — so it times the solve. It is monotonic rather than wall clock,
        // which recordCapture's toWallClock rebases (and clamps if the two ends ever come
        // from different clocks).
        await capture.handleMove(raw.move, raw.cubeTimestamp ?? null, raw.localTimestamp ?? Date.now())
      }
      onSharedResolvedMove?.(resolved)
    })
    void sharedMoveTracker.current.reset()
  }
}

let trackerBusUnsubscribe: (() => void) | null = null

/**
 * Subscribes the shared trackers to the connection bus, exactly once at a time.
 *
 * Registering per provider rather than once per process: the guard used to latch onto the
 * first provider forever, so a provider that remounted kept feeding the trackers from a
 * bus nothing emitted on any more, and every move was dropped.
 */
function registerTrackerBus(subscribe: (listener: (event: CubeEvent) => void | Promise<void>) => () => void) {
  trackerBusUnsubscribe?.()
  trackerBusUnsubscribe = subscribe((event) => {
    // Decide pairing BEFORE the event is buffered. Setting it after a move resolved left the
    // first turn of every scramble going through slice pairing, where it could be merged
    // with the next turn and lost — so move one of a scramble read as "off the scramble".
    const tracker = sharedMoveTracker.current
    if (tracker) tracker.slicePairing = ensureSharedCapture().snapshot.status !== 'scrambling'
    void tracker?.handleEvent(event)
  })
  return () => {
    trackerBusUnsubscribe?.()
    trackerBusUnsubscribe = null
  }
}

/**
 * Declares the physical cube solved and restarts tracking from there.
 *
 * This is THE reset. There is no separate device reset: the cube only supplies moves, so
 * asking the hardware to reset changes nothing the app believes. Exposed at module scope
 * so the header control and the cockpit invoke the same behaviour.
 */
export async function resetTrackedCubeToSolved() {
  await sharedSolveTracker.current?.resetToSolvedState()
  await sharedMoveTracker.current?.reset()
  // The capture session is app-owned state too. Resetting only the trackers left it
  // holding the moves and status from the abandoned attempt, so the scramble progress and
  // the rendered cube kept describing a cube the app had just declared solved.
  await ensureSharedCapture().setScramble(currentTargetScramble())
}

const sharedMoveTracker: { current: CubedexMoveTracker | null } = { current: null }
const sharedSolveTracker: { current: CubedexSolveTracker | null } = { current: null }
let sharedTargetScramble: string | null = null

/**
 * The one capture session for the whole application.
 *
 * Cube state must be tracked app-wide, not per page: connect on Settings, turn the cube
 * on Training, finish on Playground — it is the same cube and the same solve throughout.
 * While this lived inside the solve route, anything done on another page was discarded.
 */
export const sharedCapture: { current: CaptureSession | null } = { current: null }
let captureListeners = new Set<(snapshot: CaptureSnapshot) => void>()

export function ensureSharedCapture() {
  if (sharedCapture.current) return sharedCapture.current
  sharedCapture.current = new CaptureSession(
    async (completed) => {
      // Re-arm FIRST. Recording runs the whole CFOP analysis, and while that was awaited the
      // session sat in 'complete' with no scramble — so every turn the solver made in that
      // window was dropped, and the app was out of sync with the cube from the next solve
      // onwards. The scramble is issued immediately; the analysis follows on its own.
      await newSharedScramble()
      void recordCompletedCapture(completed)
    },
    (snapshot) => { for (const listener of captureListeners) listener(snapshot) }
  )
  return sharedCapture.current
}

export function subscribeCapture(listener: (snapshot: CaptureSnapshot) => void) {
  captureListeners.add(listener)
  return () => { captureListeners.delete(listener) }
}


/** The scramble the app is currently asking the solver to perform. */
export function currentTargetScramble() {
  return sharedTargetScramble ?? ''
}

const scrambleListeners = new Set<(scramble: string) => void>()

export function subscribeScramble(listener: (scramble: string) => void) {
  scrambleListeners.add(listener)
  return () => { scrambleListeners.delete(listener) }
}

/**
 * The pending scramble is application state, not page state. It was generated by the solve
 * route, so loading the app on any other page left the capture session with no scramble to
 * match against — every move then fell outside the state machine and no solve was ever
 * recorded.
 */
let pendingScrambleRequest: Promise<string> | null = null

export async function ensureSharedScramble() {
  if (sharedTargetScramble) return sharedTargetScramble
  // The provider and the solve route both ask for a scramble in the same commit on a cold
  // load. Without sharing the in-flight promise each generated its own, and whichever
  // resolved last silently replaced the scramble the other had already displayed.
  pendingScrambleRequest ??= newSharedScramble().finally(() => { pendingScrambleRequest = null })
  return pendingScrambleRequest
}

/**
 * Aim the whole app at a specific position — used by "retry from this step", where the
 * setup is the original scramble plus everything solved up to that stage.
 */
export async function setSharedScramble(next: string) {
  sharedTargetScramble = next
  ensureSharedTrackers(next)
  sharedSolveTracker.current = new CubedexSolveTracker(next)
  await sharedMoveTracker.current?.reset()
  await ensureSharedCapture().setScramble(next)
  for (const listener of scrambleListeners) listener(next)
  return next
}

export async function newSharedScramble() {
  const next = await generateScramble()
  sharedTargetScramble = next
  ensureSharedTrackers(next)
  // Replace, don't ensure: the solve tracker is built once at app start, before the first
  // scramble exists, so it was permanently targeting '' and reported "already solved" for
  // the rest of the session. Every new scramble needs a tracker aimed at it.
  sharedSolveTracker.current = new CubedexSolveTracker(next)
  await sharedMoveTracker.current?.reset()
  await ensureSharedCapture().setScramble(next)
  for (const listener of scrambleListeners) listener(next)
  return next
}

export function useCubedexCubeTracker(targetScramble: string): CubedexTrackerState {
  const cubeLink = useCubeConnection()
  const moveTrackerRef = sharedMoveTracker
  const solveTrackerRef = sharedSolveTracker
  const [snapshot, setSnapshot] = useState<SolveTrackerSnapshot>({
    status: targetScramble ? 'scrambling' : 'ready',
    scrambleRemaining: targetScramble,
        durationMs: null
  })
  const [lastMove, setLastMove] = useState<ResolvedCubeMove | null>(null)

  // Consume the shared trackers; never construct new ones here. Any page that mounts
  // this hook sees the same cube, mid-scramble or mid-solve, because the trackers and
  // the bus subscription both live in the provider.
  useEffect(() => {
    ensureSharedTrackers(targetScramble)
    if (targetScramble && sharedTargetScramble !== targetScramble) {
      sharedTargetScramble = targetScramble
      sharedSolveTracker.current = new CubedexSolveTracker(targetScramble)
      void sharedMoveTracker.current?.reset()
    }
    setSnapshot(sharedSolveTracker.current?.snapshot() ?? { status: 'idle', scrambleRemaining: '', durationMs: null })

    onSharedResolvedMove = (resolved) => {
      setLastMove(resolved)
      setSnapshot(sharedSolveTracker.current?.snapshot() ?? { status: 'idle', scrambleRemaining: '', durationMs: null })
    }
    return () => { onSharedResolvedMove = null }
  }, [targetScramble])

  // NOTE: the subscription itself lives in the provider (see registerTrackerBus), not
  // here. While it was in this hook, tracking only ran when the solve page happened to be
  // mounted — connect on Settings, replay a capture, and nothing was tracked at all.
  // Deliberately does not return the unregister: the provider owns the bus registration
  // for the whole app. Tearing it down when this hook unmounts would stop tracking the
  // moment the solve page navigated away, which is the bug this file exists to prevent.
  useEffect(() => { registerTrackerBus(cubeLink.subscribe) }, [cubeLink])

  // Replay and simulator sources hand events straight to their caller's own handler and
  // never publish to the provider bus, so a bus-only subscription sees nothing from them.
  // Exposing the handler lets every event path — BLE, replayed session, simulator — reach
  // the tracker through one entry point.
  const handleEvent = useCallback((event: CubeEvent) => {
    void moveTrackerRef.current?.handleEvent(event)
  }, [])


  // Recalibration: the app's own state is the authority (see solveTracker's header), so
  // resetting means re-seeding it at solved, not asking the cube what it looks like.
  // Takes the scramble the cube is about to be turned against, because the capture session
  // has to be re-aimed at it too. Resetting only the display trackers left capture pinned to
  // the page's own pending scramble, so a replayed session recorded against a different
  // scramble never verified and its solve was silently discarded.
  // Returns the promise: a caller that starts feeding moves immediately (replay with no
  // delay) would otherwise deliver its first move into the previous session's state, and
  // the reset would then wipe it — one move short, so the scramble never verified.
  const resetToSolved = useCallback(async (targetScramble?: string) => {
    const tracker = solveTrackerRef.current
    if (!tracker) return
    await tracker.resetToSolvedState()
    await moveTrackerRef.current?.reset()
    await ensureSharedCapture().setScramble(targetScramble ?? currentTargetScramble())
    setSnapshot(tracker.snapshot())
    setLastMove(null)
  }, [])

  return useMemo(() => ({ ...snapshot, lastMove, handleEvent, resetToSolved }), [snapshot, lastMove, handleEvent, resetToSolved])
}
