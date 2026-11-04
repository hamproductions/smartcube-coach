import { useEffect } from 'react'
import { expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { CubeConnectionProvider, useCubeConnection } from '../../../device/CubeConnection'
import type { CubeEvent, CubeInputSource } from '../../../device/inputSource'
import type { TrainerAttempt } from '../../../domain/models'

export function fakeCube() {
  const state = { emit: undefined as undefined | ((event: CubeEvent) => void | Promise<void>) }
  const source: CubeInputSource = {
    id: 'fake-cube',
    label: 'Injected cube',
    async start(onEvent, onStatus) {
      state.emit = onEvent
      onStatus('Injected cube ready')
      return {
        name: 'Injected cube',
        protocol: 'contract',
        mac: 'aa:bb',
        capabilities: { facelets: true, battery: false, gyroscope: false },
        provenance: 'cube',
        requestState: async () => undefined,
        stop: async () => undefined
      }
    }
  }
  const turn = async (move: string) => {
    const timestamp = Date.now()
    await state.emit?.({ type: 'MOVE', face: 0, direction: move.endsWith("'") ? 1 : 0, move, localTimestamp: timestamp, cubeTimestamp: timestamp, timestamp } as CubeEvent)
    await new Promise((resolve) => setTimeout(resolve, 130))
  }
  return { source, turn }
}

function Connect({ source }: { source: CubeInputSource }) {
  const link = useCubeConnection()
  useEffect(() => { void link.connect(source) }, [])
  return null
}

export function renderWithCube(ui: ReactNode, source?: CubeInputSource) {
  return render(<CubeConnectionProvider>{source && <Connect source={source} />}{ui}</CubeConnectionProvider>)
}

const Z2: Record<string, string> = { R: 'L', L: 'R', U: 'D', D: 'U', F: 'F', B: 'B' }

export function cubeMovesFor(solverMoves: string[]) {
  return solverMoves.flatMap((move) => {
    const face = Z2[move[0]]
    if (move.endsWith('2')) return [face, face]
    return [move.endsWith("'") ? `${face}'` : face]
  })
}

export async function chooseSetup(user: UserEvent, set: RegExp) {
  await user.click(await screen.findByRole('button', { name: set }, { timeout: 20_000 }))
  const subset = screen.queryByRole('button', { name: /^All subsets/ })
  if (subset) await user.click(subset)
  await user.click(await screen.findByRole('button', { name: /^All cases/ }))
  await waitFor(() => expect(screen.getByRole('button', { name: /^Start session/ })).toBeEnabled(), { timeout: 20_000 })
}

export const seededAttempt = (caseId: string, totalMs: number, startedAt: number): TrainerAttempt => ({
  id: `seed-${caseId}-${startedAt}`,
  sessionId: 's',
  caseId,
  caseVersion: 1,
  family: 'algorithm',
  protocol: 'algorithm-rehearsal',
  curriculumMode: 'drill',
  setup: { seed: 's', generatorId: 'g', generatorVersion: '1', caseId, scramble: '', constraintHash: '' },
  input: 'keyboard',
  startedAt,
  endedAt: startedAt + totalMs,
  phaseEvents: [],
  totalMs,
  outcome: 'success',
  hintEvents: [],
  wrongMoves: 0,
  divergenceCount: 0,
  correctionMoveCount: 0,
  rawEventIds: [],
  dataQuality: { completeMoveStream: true, setupVerifiedByState: true, packetLossSuspected: false, timingUsable: true, notes: [] },
  schemaVersion: 1
})
