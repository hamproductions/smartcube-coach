import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaStatus } from './PwaStatus'

const persisted = vi.fn()
const persist = vi.fn()

vi.mock('../pwa/register', () => ({ activateUpdate: vi.fn(), registerSmartCubeCoachPwa: vi.fn() }))

describe('PwaStatus', () => {
  beforeEach(() => {
    persisted.mockReset()
    persist.mockReset()
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted, persist, estimate: vi.fn().mockResolvedValue({ usage: 1_048_576, quota: 10_485_760 }) } })
  })

  it('offers durable storage only until it is granted', async () => {
    persisted.mockResolvedValueOnce(false).mockResolvedValue(true)
    persist.mockResolvedValue(true)
    const user = userEvent.setup()
    render(<PwaStatus />)

    const button = await screen.findByRole('button', { name: 'Protect local data' })
    await user.click(button)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Protect local data' })).not.toBeInTheDocument())
    expect(screen.getByText(/1.0 \/ 10 MB/)).toBeInTheDocument()
  })

  it('does not render a redundant protection action for durable storage', async () => {
    persisted.mockResolvedValue(true)
    render(<PwaStatus />)
    await waitFor(() => expect(screen.getByText(/durable/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Protect local data' })).not.toBeInTheDocument()
  })
})
