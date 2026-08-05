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
import type { CaptureSnapshot } from './capture'
import { clearDatabase } from '../storage/database'
import type { CubeEvent, CubeInputHandle, CubeInputSource } from './inputSource'

// The owner reported the timer starting by itself repeatedly. Every cause was something in
// the move stream moving the capture session out of 'scrambling' without the cube actually
// reaching the scrambled state. Nothing may do that. This pins it against the patterns that
// caused it before: an accept gesture, idle fiddling, and a long stream of unrelated turns.
let emitEvent: ((event: CubeEvent) => Promise<void>) | null = null

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
      async requestState() {},
      async stop() { emitEvent = null }
    }
    return handle
  }
})

function Harness({ scramble }: { scramble: string }) {
  const cube = useCubeConnection()
  useCubedexCubeTracker(scramble)
  const [ready] = useState(true)
  return <button onClick={() => void cube.connect(fakeSource())}>{ready ? 'connect' : ''}</button>
}

const drive = async (moves: string[]) => {
  for (const move of moves) {
    await emitEvent?.({ type: 'MOVE', move, timestamp: Date.now(), localTimestamp: Date.now() } as CubeEvent)
  }
}

describe('the timer never starts by itself', () => {
  beforeEach(clearDatabase)
  afterEach(async () => { emitEvent = null; await clearDatabase() })

  it('stays in the scrambling phase through gestures, fiddling and unrelated turns', async () => {
    const scramble = "R U2 F' L D2 B"
    await ensureSharedScramble()

    let latest: CaptureSnapshot | undefined
    const unsubscribe = subscribeCapture((snapshot) => { latest = snapshot })

    const { getByText } = render(
      <CubeConnectionProvider><Harness scramble={scramble} /></CubeConnectionProvider>
    )
    getByText('connect').click()
    await waitFor(() => expect(emitEvent).not.toBeNull())
    await resetTrackedCubeToSolved()
    await ensureSharedCapture().setScramble(scramble)

    // Four identical turns — the old hands-free accept gesture.
    await drive(['U', 'U', 'U', 'U'])
    expect(latest?.status).toBe('scrambling')

    // Alternating fiddling on one face.
    await drive(['F', "F'", 'F', "F'"])
    expect(latest?.status).toBe('scrambling')

    // A long stream of turns that never reaches the scrambled state.
    await drive(['R', 'L', 'B', 'D', 'R', 'L', 'B', 'D', 'R2', 'L2'])
    expect(latest?.status).toBe('scrambling')
    expect(latest?.startedAt).toBeUndefined()

    unsubscribe()
  }, 30_000)
})
