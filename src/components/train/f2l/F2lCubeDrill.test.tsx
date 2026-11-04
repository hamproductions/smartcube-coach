import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { CubeConnectionProvider, resetTrackedCubeToSolved } from '../../../device/CubeConnection'
import type { CubeEvent, CubeInputSource } from '../../../device/inputSource'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import { defaultAlgorithms } from '../../../domain/training'
import { clearDatabase, repositories } from '../../../storage/database'
import { F2lCubeDrill } from './F2lCubeDrill'
import { DEFAULT_HOLD, faceMoves, toSolverMove } from './frame'
import { displayCaseName } from './queue'

const fakeCubeSource = () => {
  const state = { emit: undefined as undefined | ((event: CubeEvent) => void | Promise<void>) }
  const source: CubeInputSource = {
    id: 'fake-drill-cube',
    label: 'Injected drill cube',
    async start(onEvent, onStatus) {
      state.emit = onEvent
      onStatus('Injected drill cube ready')
      return {
        name: 'Injected drill cube',
        protocol: 'contract',
        mac: 'aa:bb',
        capabilities: { facelets: true, battery: false, gyroscope: false },
        provenance: 'cube',
        requestState: async () => undefined,
        stop: async () => undefined
      }
    }
  }
  return { source, state }
}

const CUBE_MOVES = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap((face) => [face, `${face}'`, `${face}2`])
const toCubeMove = (solverMove: string) => {
  const found = CUBE_MOVES.find((move) => toSolverMove(move, DEFAULT_HOLD.rotation) === solverMove)
  if (!found) throw new Error(`No cube move for ${solverMove}`)
  return found
}

const emitMove = (state: { emit?: (event: CubeEvent) => void | Promise<void> }, solverMove: string) => {
  const timestamp = Date.now()
  return state.emit?.({ type: 'MOVE', face: 0, direction: 1, move: toCubeMove(solverMove), localTimestamp: timestamp, cubeTimestamp: timestamp, timestamp } as CubeEvent)
}

const turn = async (state: { emit?: (event: CubeEvent) => void | Promise<void> }, moves: string[]) => {
  for (const move of moves) {
    await act(async () => {
      await emitMove(state, move)
      await new Promise((resolve) => setTimeout(resolve, 130))
    })
  }
}

const buildAttempt = (caseId: string, totalMs: number, startedAt: number): TrainerAttempt => ({
  id: `seed-${caseId}-${startedAt}`,
  sessionId: 's',
  caseId,
  caseVersion: 1,
  family: 'algorithm',
  protocol: 'typed-answer',
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

const caseOnScreen = async () => {
  const heading = await screen.findByRole('heading', { level: 2 })
  const record = (await repositories.algorithms.all()).find((item) => item.set === 'F2L' && displayCaseName(item) === heading.textContent)
  if (!record) throw new Error(`No record for ${heading.textContent}`)
  return record
}

const solveOf = (record: AlgorithmRecord) => new Alg(faceMoves(record.setup).join(' ')).invert().toString().replace(/2'/g, '2').split(/\s+/).filter(Boolean)

const startDrill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'Connect cube' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Start drill/ })).toBeEnabled(), { timeout: 60_000 })
  await user.click(screen.getByRole('button', { name: /Start drill/ }))
  await screen.findByText(/Set up the case/)
}

describe('F2L on the cube', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await clearDatabase()
    await resetTrackedCubeToSolved()
  })
  afterEach(async () => clearDatabase())

  it('shows only the connect action until a cube is connected', async () => {
    const { source } = fakeCubeSource()
    render(<CubeConnectionProvider><F2lCubeDrill source={source} /></CubeConnectionProvider>)
    expect(screen.getByRole('button', { name: 'Connect cube' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start drill/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('drills the recorded-slowest F2L case first once Slow first is chosen', async () => {
    const defaultF2l = defaultAlgorithms.filter((record) => record.set === 'F2L')
    const dummySeed = { ...defaultF2l[0], id: 'f2l-fr-dummy', name: 'Dummy FR seed' }
    await Promise.all([...defaultF2l, dummySeed].map((record) => repositories.algorithms.put(record)))
    const times: Record<string, number> = { 'f2l-insert-right': 9_000, 'f2l-insert-left': 500, 'f2l-sledge': 2_000, 'f2l-fr-dummy': 1_000 }
    await Promise.all(Object.entries(times).map(([caseId, totalMs], index) => repositories.attempts.put(buildAttempt(caseId, totalMs, Date.now() + index))))

    const user = userEvent.setup()
    const { source } = fakeCubeSource()
    render(<CubeConnectionProvider><F2lCubeDrill source={source} /></CubeConnectionProvider>)
    await user.click(await screen.findByRole('button', { name: 'Connect cube' }))
    await user.click(await screen.findByRole('button', { name: 'Slow first' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Start drill/ })).toBeEnabled(), { timeout: 15_000 })
    await user.click(screen.getByRole('button', { name: /Start drill/ }))

    expect(await screen.findByRole('heading', { name: 'Basic right insert' })).toBeInTheDocument()
  }, 30_000)

  it('tracks the setup on the cube, then completes the case from cube state and records a state-success solve', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeCubeSource()
    render(<CubeConnectionProvider><F2lCubeDrill source={source} /></CubeConnectionProvider>)
    await startDrill(user)

    const record = await caseOnScreen()
    const setup = faceMoves(record.setup)
    await turn(state, [setup[0]])
    expect(screen.getByText(`1/${setup.length}`)).toBeInTheDocument()
    await turn(state, setup.slice(1))
    expect(await screen.findByRole('heading', { name: 'Solve the pair' })).toBeInTheDocument()

    await turn(state, solveOf(record))
    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.protocol === 'state-success' && attempt.outcome === 'success' && attempt.caseId === record.id && attempt.dataQuality.setupVerifiedByState)).toBe(true), { timeout: 5_000 })
    expect(await screen.findByText(/^Recognition \d+\.\d{2} s · Execution \d+\.\d{2} s/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Verdict' })).getByText(record.algorithm)).toBeInTheDocument()
  }, 90_000)

  it('flags a wrong setup turn and recovers when it is undone', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeCubeSource()
    render(<CubeConnectionProvider><F2lCubeDrill source={source} /></CubeConnectionProvider>)
    await startDrill(user)

    const record = await caseOnScreen()
    const setup = faceMoves(record.setup)
    const wrong = ['F', 'B', 'L'].find((move) => move[0] !== setup[0][0] && move[0] !== setup[1]?.[0]) ?? 'B'
    await turn(state, [setup[0], wrong])
    expect(await screen.findByText(/Off the setup\. Undo with/)).toBeInTheDocument()
    await turn(state, [`${wrong}'`])
    await waitFor(() => expect(screen.queryByText(/Off the setup/)).not.toBeInTheDocument())
    expect(screen.getByText(`1/${setup.length}`)).toBeInTheDocument()
  }, 90_000)

  it('advances to a different case after completing one', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeCubeSource()
    render(<CubeConnectionProvider><F2lCubeDrill source={source} /></CubeConnectionProvider>)
    await startDrill(user)

    const first = await caseOnScreen()
    await turn(state, faceMoves(first.setup))
    await turn(state, solveOf(first))
    expect(within(await screen.findByRole('region', { name: 'Verdict' })).getByText('Solved')).toBeInTheDocument()
    expect(screen.getByText(/Next setup/)).toBeInTheDocument()

    await user.keyboard(' ')
    const second = await caseOnScreen()
    expect(second.name).not.toBe('')
    expect(screen.getByText(/Set up the case/)).toBeInTheDocument()
  }, 90_000)

  it('blocks completion on give-up while still applying moves to the drill cube', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeCubeSource()
    render(<CubeConnectionProvider><F2lCubeDrill source={source} /></CubeConnectionProvider>)
    await startDrill(user)

    const record = await caseOnScreen()
    await turn(state, faceMoves(record.setup))
    await screen.findByRole('heading', { name: 'Solve the pair' })
    await user.click(screen.getByRole('button', { name: 'Give up' }))
    expect(within(screen.getByRole('region', { name: 'Verdict' })).getByText('Gave up')).toBeInTheDocument()

    await turn(state, solveOf(record))
    expect(within(screen.getByRole('region', { name: 'Verdict' })).getByText('Gave up')).toBeInTheDocument()
    const attempts = await repositories.attempts.all()
    expect(attempts.filter((attempt) => attempt.outcome === 'success')).toHaveLength(0)
    expect(attempts.filter((attempt) => attempt.outcome === 'give-up' && attempt.caseId === record.id)).toHaveLength(1)

    await user.keyboard(' ')
    expect(await screen.findByText(/Set up the case/)).toBeInTheDocument()
  }, 90_000)
})
