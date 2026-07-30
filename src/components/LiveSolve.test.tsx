import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, repositories } from '../storage/database'
import { LiveSolve } from './LiveSolve'

describe('LiveSolve simulator', () => {
  beforeEach(async () => clearDatabase())
  afterEach(async () => clearDatabase())

  it('persists simulator moves through the immutable event path', async () => {
    const user = userEvent.setup()
    render(<LiveSolve />)

    await user.click(screen.getByRole('button', { name: 'New scramble' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simulate scramble' })).toBeEnabled(), { timeout: 10_000 })
    await user.click(screen.getByRole('button', { name: 'Simulate scramble' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Simulate inverse solve' })).toBeEnabled(), { timeout: 10_000 })
    await user.click(screen.getByRole('button', { name: 'Simulate inverse solve' }))

    expect(await screen.findByText(/Saved solve #/, {}, { timeout: 20_000 })).toBeInTheDocument()
    const [solve] = await repositories.solves.all()
    expect(solve.startedAt).toBeGreaterThan(1_000_000_000_000)
    expect(solve.endedAt).toBeGreaterThan(solve.startedAt)
    expect(solve.moves.length).toBeGreaterThan(0)
    const rawEvents = await repositories.rawEvents.forSolve(solve.id)
    expect(rawEvents).toHaveLength(solve.scramble.split(/\s+/).length + solve.moves.length)
    expect(rawEvents.filter((event) => event.phase === 'scramble')).toHaveLength(solve.scramble.split(/\s+/).length)
    expect(rawEvents.filter((event) => event.phase === 'solve')).toHaveLength(solve.moves.length)
    expect(solve.rawEventIds).toEqual(rawEvents.filter((event) => event.phase === 'solve').map((event) => event.id))
    const stages = await repositories.stages.forSolve(solve.id)
    expect(stages.length).toBeGreaterThan(0)
    expect(Math.max(...stages.map((stage) => stage.recognitionMs))).toBeLessThanOrEqual(solve.endedAt - solve.startedAt)
  }, 60_000)
})
