import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase } from './storage/database'
import App from './App'

describe('Smart Cube Coach', () => {
  beforeEach(async () => { window.location.hash = ''; await clearDatabase() })
  afterEach(clearDatabase)

  it('renders an honest first-run state without seeded solve telemetry', async () => {
    render(<App />)

    expect(await screen.findByText('TPS', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByText('23.10')).not.toBeInTheDocument()
    expect(screen.queryByText('Second-pair lookahead stalls')).not.toBeInTheDocument()
    expect(screen.queryByText('Demo telemetry · 72%')).not.toBeInTheDocument()
  })

  it('offers every primary destination exactly once in the primary navigation', async () => {
    render(<App />)
    const nav = await screen.findByRole('navigation', { name: 'Primary' }, { timeout: 10_000 })
    for (const label of ['Solve', 'Train', 'Stats', 'Study', 'Settings']) {
      expect(within(nav).getAllByRole('link', { name: label })).toHaveLength(1)
    }
  })

  it('opens a blank reconstruction editor instead of fabricated moves', async () => {
    window.location.hash = '#/study/reconstruct'
    render(<App />)

    await waitFor(() => expect(screen.getByLabelText('Scramble')).toHaveValue(''))
    expect(screen.getByLabelText('Reconstruction')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Solve state' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Editable reconstruction' })).not.toBeInTheDocument()
  })
})
