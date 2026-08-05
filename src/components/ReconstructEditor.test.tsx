import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from '../storage/database'
import type { SolveRecord } from '../domain/models'
import { ReconstructEditor } from './ReconstructEditor'

type RecoFixture = { scramble: string; moves: string[] }
const fixture = JSON.parse(readFileSync(`${process.cwd()}/public/reco/13444.json`, 'utf8')) as RecoFixture

const keyboardSolve = (id: string): SolveRecord => ({
  id,
  sessionId: 'session-1',
  puzzle: '3x3x3',
  scramble: fixture.scramble,
  scrambleGenerator: 'cstimer-import',
  startedAt: 0,
  endedAt: 20_000,
  penalty: 'none',
  analysisVersion: '1',
  rawEventIds: [],
  moves: [],
  source: 'keyboard',
  stateVerified: false,
  verificationDetail: 'keyboard timer solve, no move stream captured'
})

describe('ReconstructEditor', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('saves editable revisions while retaining source event links', async () => {
    const user = userEvent.setup()
    render(<ReconstructEditor solveId="solve-1" initialScramble="R U" initialMoves={["U'", "R'"]} sourceEventIds={['raw-1', 'raw-2']} />)

    await user.click(screen.getByRole('button', { name: 'Save revision' }))

    expect(await screen.findByText(/2 immutable source events remain linked/)).toBeInTheDocument()
    const [revision] = await repositories.revisions.all()
    expect(revision.solveId).toBe('solve-1')
    expect(revision.lines[0].sourceEventIds).toEqual(['raw-1', 'raw-2'])
  })

  it('completes the active line from a literal move prefix', async () => {
    const user = userEvent.setup()
    render(<ReconstructEditor initialMoves={['R', 'U', "R'"]} />)

    const suggestions = screen.getByLabelText('Algorithm suggestions')
    await user.click(within(suggestions).getByRole('button', { name: /Sune/ }))

    expect(screen.getByLabelText('Reconstruction')).toHaveValue("R U R' U R U2 R' // OLL 27 Sune")
  })

  it('accepts the first completion with Tab', async () => {
    const user = userEvent.setup()
    render(<ReconstructEditor />)
    const editor = screen.getByLabelText('Reconstruction')

    await user.click(editor)
    await user.type(editor, "R U R'")
    await user.keyboard('{Tab}')

    expect(editor).toHaveValue("R U R' U R U2 R' // OLL 27 Sune")
  })

  it('renders automatic stage boundaries as editable reconstruction lines', () => {
    render(<ReconstructEditor initialMoves={['R', 'U', "R'"]} initialStages={[
      { id: 'cross', solveId: 'solve-1', method: 'CFOP', name: 'Cross', startEvent: 0, firstMoveEvent: 0, endEvent: 1, recognitionMs: 0, executionMs: 80, moveCount: 2, rotationCount: 0, pauseCount: 0, tps: 25, confidence: 1 },
      { id: 'auf', solveId: 'solve-1', method: 'CFOP', name: 'AUF', startEvent: 2, firstMoveEvent: 2, endEvent: 2, recognitionMs: 0, executionMs: 0, moveCount: 1, rotationCount: 0, pauseCount: 0, tps: 12.5, confidence: 1 }
    ]} />)

    expect(screen.getByLabelText('Reconstruction')).toHaveValue("R U // Cross\nR' // AUF")
  })

  it('solves the current reconstructed position instead of restarting from scramble', async () => {
    const user = userEvent.setup()
    render(<ReconstructEditor initialScramble="R" initialMoves={["R'"]} />)

    await user.click(screen.getByRole('button', { name: 'Solve state' }))

    expect(await screen.findByText(/Current reconstructed state is solved\./)).toBeInTheDocument()
    expect(screen.getByLabelText('Reconstruction')).toHaveValue("R' // Captured solve")
  })

  it('attaches a valid typed reconstruction to a move-less solve and reports what analysis became available', async () => {
    const user = userEvent.setup()
    await repositories.solves.put(keyboardSolve('solve-attach-ok'))
    render(<ReconstructEditor solveId="solve-attach-ok" initialScramble={fixture.scramble} initialMoves={[]} />)

    expect(screen.getByText(/This solve has no captured move stream/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Typed solution'), fixture.moves.join(' '))
    await user.click(screen.getByRole('button', { name: 'Attach reconstruction' }))

    expect(await screen.findByText(/Attached\./)).toBeInTheDocument()
    expect(screen.queryByText(/This solve has no captured move stream/)).not.toBeInTheDocument()
    const saved = await repositories.solves.get('solve-attach-ok')
    expect(saved?.moves).toEqual(fixture.moves)
    expect(saved?.stateVerified).toBe(true)
    const stages = await repositories.stages.forSolve('solve-attach-ok')
    expect(stages.map((stage) => stage.name).filter((name) => name !== 'AUF')).toEqual(['Cross', 'F2L 1', 'F2L 2', 'F2L 3', 'F2L 4', 'OLL', 'PLL'])
  }, 60_000)

  it('shows the ergonomic assessment computed from the typed solution', () => {
    render(<ReconstructEditor initialMoves={['R', 'U', "R'"]} />)

    const strip = screen.getByLabelText('Ergonomic assessment')
    expect(strip).toHaveTextContent('Ergonomics')
    expect(strip).toHaveTextContent('0.432')
  })

  it('offers alternative algorithms from the catalogue matching the typed moves', async () => {
    const user = userEvent.setup()
    render(<ReconstructEditor />)
    const editor = screen.getByLabelText('Reconstruction')

    await user.click(editor)
    await user.type(editor, "R U R' U R'")

    const alternatives = screen.getByLabelText('Alternative algorithms')
    expect(alternatives).toHaveTextContent('OLL 27 Sune')
  })

  it('inserts the remaining moves of a clicked alternative algorithm', async () => {
    const user = userEvent.setup()
    render(<ReconstructEditor />)
    const editor = screen.getByLabelText('Reconstruction')

    await user.click(editor)
    await user.type(editor, "R U R' U R'")
    const alternatives = screen.getByLabelText('Alternative algorithms')
    await user.click(within(alternatives).getByRole('button', { name: /^OLL 27 Sune/ }))

    expect(editor).toHaveValue("R U R' U R' U2 R' // OLL 27 Sune")
  })

  it('rejects a typed reconstruction that does not solve the scramble and leaves the solve unattached', async () => {
    const user = userEvent.setup()
    await repositories.solves.put(keyboardSolve('solve-attach-bad'))
    render(<ReconstructEditor solveId="solve-attach-bad" initialScramble={fixture.scramble} initialMoves={[]} />)

    await user.type(screen.getByLabelText('Typed solution'), "R U R' U'")
    await user.click(screen.getByRole('button', { name: 'Attach reconstruction' }))

    expect(await screen.findByText(/does not solve this scramble/)).toBeInTheDocument()
    expect(screen.getByText(/This solve has no captured move stream/)).toBeInTheDocument()
    const saved = await repositories.solves.get('solve-attach-bad')
    expect(saved?.moves).toEqual([])
    expect(saved?.stateVerified).toBe(false)
  })
})
