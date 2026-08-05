import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase } from './storage/database'
import App from './App'

// These previously asserted a first-run dashboard (`TodayDashboard`) that is imported by
// nothing and whose nav targets ('Live Solve', 'Train', 'History') match no route in the
// shipped app. They now assert the same *intent* — an honest empty state with no seeded
// telemetry — against the surface a first-run user actually lands on.

describe('Smart Cube Coach', () => {
  beforeEach(clearDatabase)
  afterEach(clearDatabase)

  it('renders an honest first-run state without seeded solve telemetry', async () => {
    render(<App />)

    // The cockpit is the landing surface. With no stored solves every measured value
    // must read as empty rather than as a plausible number.
    expect(await screen.findByText('TPS', {}, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.queryByText('23.10')).not.toBeInTheDocument()
    expect(screen.queryByText('Second-pair lookahead stalls')).not.toBeInTheDocument()
    expect(screen.queryByText('Demo telemetry · 72%')).not.toBeInTheDocument()
  })

  it('offers every primary destination exactly once', async () => {
    render(<App />)

    // One <nav>: rendering the destinations in both a header group and a sidebar put two
    // "Primary navigation" landmarks in the tree and announced each destination twice.
    for (const label of ['Playground', 'Training', 'Statistics', 'Library', 'Study', 'Settings']) {
      expect(await screen.findByRole('button', { name: label }, { timeout: 10_000 })).toBeInTheDocument()
    }
  })

  it('opens a blank reconstruction editor instead of fabricated moves', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Library/ }))

    await waitFor(() => expect(screen.getByLabelText('Scramble')).toHaveValue(''))
    expect(screen.getByLabelText('Reconstruction')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Solve state' })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: 'Editable reconstruction' })).not.toBeInTheDocument()
  })
})
