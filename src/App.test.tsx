import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase } from './storage/database'
import App from './App'

describe('Smart Cube Coach', () => {
  beforeEach(clearDatabase)
  afterEach(clearDatabase)

  it('renders an honest first-run state without seeded solve telemetry', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'No solves yet.' }, { timeout: 10_000 })).toBeInTheDocument()
    expect(screen.getByText(/No AO12, findings, prescriptions, or confidence scores are seeded/)).toBeInTheDocument()
    expect(screen.queryByText('23.10')).not.toBeInTheDocument()
    expect(screen.queryByText('Second-pair lookahead stalls')).not.toBeInTheDocument()
    expect(screen.queryByText('Demo telemetry · 72%')).not.toBeInTheDocument()
  })

  it('navigates from first run to the functional capture surface', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Capture a solve' }, { timeout: 10_000 }))

    expect(screen.getByRole('heading', { name: 'Connect, verify, inspect, solve.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New scramble' })).toBeEnabled()
    expect(screen.getByText(/Software simulator · exercises persistence, not Bluetooth hardware/)).toBeInTheDocument()
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
