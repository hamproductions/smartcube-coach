import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { TurnPacer } from './TurnPacer'

// No real AudioContext: the pacer must never take over the machine's audio during a test
// run, and the ported Metronome accepts an injected factory precisely so it does not have
// to. This stub records what the component asked WebAudio to do.
const oscillators: Array<{ frequency: { value: number }; started: boolean }> = []

const stubAudioContext = () => {
  const gain = { gain: { value: 0 }, connect: vi.fn() }
  return {
    currentTime: 0,
    destination: {},
    createGain: () => gain,
    createOscillator: () => {
      const osc = { type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), started: true }
      oscillators.push(osc)
      return osc
    }
  } as unknown as AudioContext
}

afterEach(() => {
  oscillators.length = 0
  vi.useRealTimers()
})

describe('TurnPacer', () => {
  it('reports the real interval the ported metronome computes for the chosen rate', async () => {
    const user = userEvent.setup()
    render(<TurnPacer />)

    expect(screen.getByText(/1000 ms apart/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^2\.0/ }))
    expect(screen.getByText(/500 ms apart/)).toBeInTheDocument()
  })

  it('marks the selected rate as pressed so the active preset is unambiguous', async () => {
    const user = userEvent.setup()
    render(<TurnPacer />)

    expect(screen.getByRole('button', { name: /^1\.0/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /^1\.5/ }))
    expect(screen.getByRole('button', { name: /^1\.5/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^1\.0/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles between starting and stopping the pacer', async () => {
    const user = userEvent.setup()
    render(<TurnPacer />)

    await user.click(screen.getByRole('button', { name: /^Start pacer/ }))
    expect(screen.getByRole('button', { name: /^Stop pacer/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Stop pacer/ }))
    expect(screen.getByRole('button', { name: /^Start pacer/ })).toBeInTheDocument()
  })

  it('stays silent until the user starts it', () => {
    vi.stubGlobal('AudioContext', stubAudioContext)
    render(<TurnPacer />)
    expect(oscillators).toHaveLength(0)
    vi.unstubAllGlobals()
  })
})
