import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('coach cockpit', () => {
  it('shows evidence, prescription and stage telemetry for the primary weakness', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Second-pair lookahead stalls' })).toBeInTheDocument()
    expect(screen.getByText('1.14s')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'F2L Lookahead Reset' })).toBeInTheDocument()
    expect(screen.getByText('F2L 2')).toBeInTheDocument()
  })

  it('renders the roast from the same verified finding', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Roast this solve' }))

    expect(screen.getByRole('status')).toHaveTextContent(/your hands went AFK for 1\.14 seconds/i)
    expect(screen.getByRole('status')).toHaveTextContent(/7 of the last 12 solves/i)
  })
})
