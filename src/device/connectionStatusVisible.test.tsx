import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CubeConnectionIndicator, CubeConnectionProvider, useCubeConnection } from './CubeConnection'
import type { CubeInputSource } from './inputSource'

const failingSource = (progress: string, failure: string): CubeInputSource => ({
  id: 'failing',
  label: 'Failing cube',
  async start(_onEvent, onStatus) {
    onStatus(progress)
    throw new Error(failure)
  }
})

let link: ReturnType<typeof useCubeConnection> | undefined
function Capture() {
  link = useCubeConnection()
  return null
}

describe('connection status in the header', () => {
  it('shows why a connection failed instead of a bare "Not connected"', async () => {
    Object.defineProperty(navigator, 'bluetooth', { value: {}, configurable: true })
    render(<CubeConnectionProvider><Capture /><CubeConnectionIndicator /></CubeConnectionProvider>)
    expect(screen.getByText('Not connected')).toBeInTheDocument()

    await act(async () => {
      await link?.connect(failingSource('Reading advertisements…', 'Unable to determine cube MAC address, connection is not possible!')).catch(() => undefined)
    })

    expect(screen.getByText('Unable to determine cube MAC address, connection is not possible!')).toBeInTheDocument()
    expect(screen.queryByText('Not connected')).not.toBeInTheDocument()
  })
})
