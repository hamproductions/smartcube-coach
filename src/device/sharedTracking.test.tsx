import { render, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CubeConnectionProvider,
  ensureSharedCapture,
  ensureSharedScramble,
  resetTrackedCubeToSolved,
  subscribeCapture,
  useCubeConnection,
  useCubedexCubeTracker
} from './CubeConnection'
import { subscribeSolveSaved } from './recordCapture'
import type { CaptureSnapshot } from './capture'
import { clearDatabase } from '../storage/database'
import type { CubeEvent, CubeInputHandle, CubeInputSource } from './inputSource'

// The provider and the tracker hook each register the same bus listener. While both
// registrations were live every physical move reached the tracker twice — a 21-move
// scramble tracked as 58 moves and could never verify — and nothing failed. This pins the
// invariant: N moves in, N moves tracked.
let emitEvent: ((event: CubeEvent) => Promise<void>) | null = null
// Counts any request for device-side state, so a reset that quietly asks the hardware fails.
let deviceStateRequests = 0

const fakeSource = (): CubeInputSource => ({
  id: 'fake',
  label: 'Fake cube',
  async start(emit) {
    emitEvent = emit as (event: CubeEvent) => Promise<void>
    const handle: CubeInputHandle = {
      name: 'fake',
      protocol: 'test',
      mac: '00:00:00:00:00:00',
      capabilities: {},
      provenance: 'simulator',
      async requestState() { deviceStateRequests += 1 },
      async stop() { emitEvent = null }
    }
    return handle
  }
})

function Harness({ scramble }: { scramble: string }) {
  const cube = useCubeConnection()
  useCubedexCubeTracker(scramble)
  return <button onClick={() => void cube.connect(fakeSource())}>connect</button>
}

describe('application-wide cube tracking', () => {
  beforeEach(clearDatabase)
  afterEach(async () => { emitEvent = null; deviceStateRequests = 0; await clearDatabase() })

  it('delivers each move to the shared capture exactly once, not once per registration', async () => {
    const scramble = "R U R' U'"
    await ensureSharedScramble()

    let latest: CaptureSnapshot | undefined
    const unsubscribe = subscribeCapture((snapshot) => { latest = snapshot })
    await ensureSharedCapture().setScramble(scramble)

    const { getByText } = render(
      <CubeConnectionProvider><Harness scramble={scramble} /></CubeConnectionProvider>
    )
    getByText('connect').click()
    await waitFor(() => expect(emitEvent).not.toBeNull())

    for (const move of ['R', 'U']) {
      await emitEvent?.({ type: 'MOVE', move, timestamp: Date.now(), localTimestamp: Date.now() } as CubeEvent)
    }

    await waitFor(() => expect(latest?.scrambleMoves.length).toBe(2))
    expect(latest?.scrambleMoves).toEqual(['R', 'U'])
    unsubscribe()
  }, 20_000)

  it('ignores a FACELETS event: the tracked pattern comes from moves, never from the device', async () => {
    const scramble = "R U R' U'"
    await ensureSharedScramble()

    let latest: CaptureSnapshot | undefined
    const unsubscribe = subscribeCapture((snapshot) => { latest = snapshot })
    await ensureSharedCapture().setScramble(scramble)

    const { getByText } = render(
      <CubeConnectionProvider><Harness scramble={scramble} /></CubeConnectionProvider>
    )
    getByText('connect').click()
    await waitFor(() => expect(emitEvent).not.toBeNull())

    await emitEvent?.({ type: 'MOVE', move: 'R', timestamp: Date.now(), localTimestamp: Date.now() } as CubeEvent)
    await waitFor(() => expect(latest?.scrambleMoves).toEqual(['R']))

    // A scrambled cube's facelets. If this ever seeded state again the tracked position
    // would jump to whatever the hardware believes, which is the desync that rule forbids.
    await emitEvent?.({
      type: 'FACELETS',
      facelets: 'DUUBULDBFRBFRRULLLBRDFFFBLURDBFDFDRDBRUBLWDLUFUFRLDBUUW'.slice(0, 54),
      timestamp: Date.now()
    } as unknown as CubeEvent)

    await emitEvent?.({ type: 'MOVE', move: 'U', timestamp: Date.now(), localTimestamp: Date.now() } as CubeEvent)
    await waitFor(() => expect(latest?.scrambleMoves).toEqual(['R', 'U']))
    unsubscribe()
  }, 20_000)

  it('resets to solved from the app\'s own state, without asking the device for anything', async () => {
    const scramble = "R U R' U'"
    await ensureSharedScramble()

    let latest: CaptureSnapshot | undefined
    const unsubscribe = subscribeCapture((snapshot) => { latest = snapshot })
    await ensureSharedCapture().setScramble(scramble)

    const { getByText } = render(
      <CubeConnectionProvider><Harness scramble={scramble} /></CubeConnectionProvider>
    )
    getByText('connect').click()
    await waitFor(() => expect(emitEvent).not.toBeNull())
    await emitEvent?.({ type: 'MOVE', move: 'B', timestamp: Date.now(), localTimestamp: Date.now() } as CubeEvent)
    await waitFor(() => expect(latest?.scrambleMoves.length).toBe(1))

    await resetTrackedCubeToSolved()

    // Back to a clean scramble phase, and the device was never asked anything.
    await waitFor(() => expect(latest?.scrambleMoves).toEqual([]))
    expect(latest?.status).toBe('scrambling')
    expect(deviceStateRequests).toBe(0)
    unsubscribe()
  }, 20_000)

  it('completes and records a solve whose page unmounted midway', async () => {
    const scramble = 'R'
    await ensureSharedScramble()
    await ensureSharedCapture().setScramble(scramble)

    const saved: string[] = []
    const unsubscribe = subscribeSolveSaved((solve) => saved.push(solve.source ?? 'unknown'))

    // The provider stays mounted, as it does in the app; only the page comes and goes.
    function Shell() {
      const [pageOpen, setPageOpen] = useState(true)
      return (
        <>
          {pageOpen && <Harness scramble={scramble} />}
          <button onClick={() => setPageOpen(false)}>navigate away</button>
        </>
      )
    }

    const { getByText } = render(<CubeConnectionProvider><Shell /></CubeConnectionProvider>)
    getByText('connect').click()
    await waitFor(() => expect(emitEvent).not.toBeNull())

    await emitEvent?.({ type: 'MOVE', move: 'R', timestamp: Date.now(), localTimestamp: Date.now() } as CubeEvent)

    // Leave the page that started the solve.
    getByText('navigate away').click()

    await emitEvent?.({ type: 'MOVE', move: "R'", timestamp: Date.now(), localTimestamp: Date.now() } as CubeEvent)

    await waitFor(() => expect(saved).toEqual(['cube']), { timeout: 10_000 })
    unsubscribe()
  }, 20_000)

  it('does not accept the scramble — or start the timer — when a scramble contains a repeated face', async () => {
    const scramble = "R U R' U'"
    await ensureSharedScramble()

    let latest: CaptureSnapshot | undefined
    const unsubscribe = subscribeCapture((snapshot) => { latest = snapshot })
    await ensureSharedCapture().setScramble(scramble)

    const { getByText } = render(
      <CubeConnectionProvider><Harness scramble={scramble} /></CubeConnectionProvider>
    )
    getByText('connect').click()
    await waitFor(() => expect(emitEvent).not.toBeNull())
    await resetTrackedCubeToSolved()

    // Ordinary fiddling on one face. This used to read as the hands-free accept, which
    // marked the scramble done and let the next turn start the timer by itself.
    for (const move of ['U', "U'", 'U', "U'"]) {
      await emitEvent?.({ type: 'MOVE', move, timestamp: Date.now(), localTimestamp: Date.now() } as CubeEvent)
    }

    await waitFor(() => expect(latest?.scrambleMoves.length).toBeGreaterThanOrEqual(3))
    expect(latest?.status).toBe('scrambling')
    unsubscribe()
  }, 20_000)


})
