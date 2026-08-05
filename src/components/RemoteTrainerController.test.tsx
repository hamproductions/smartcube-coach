import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CubeConnectionProvider, useCubeConnection } from '../device/CubeConnection'
import { RemoteTrainerController } from './RemoteTrainerController'

describe('RemoteTrainerController', () => {
  it('uses any smart-cube turn as a controller input without state validation', async () => {
    let emitMove: ((move: string) => void) | undefined
    const user = userEvent.setup()
    render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R', 'U', "R'"]} connect={async (onMove, onStatus) => {
      onStatus('Connected controller')
      emitMove = (move) => onMove(move, performance.now())
      return { name: 'Test cube', mac: 'test', protocol: 'test', capabilities: {}, disconnect: async () => {} }
    }} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    await act(async () => emitMove?.('x'))
    await act(async () => emitMove?.('F2'))
    await act(async () => emitMove?.('M'))

    expect(screen.getByText('Target 3 / 3')).toBeInTheDocument()
    expect(screen.getByText('Controller pass complete.')).toBeInTheDocument()
    expect(screen.getByText('x F2 M')).toBeInTheDocument()
  })

  it('reports controller progress for visible playback', async () => {
    let emitMove: ((move: string) => void) | undefined
    const progress = vi.fn()
    const user = userEvent.setup()
    render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R', 'U']} onProgress={progress} connect={async (onMove) => {
      emitMove = (move) => onMove(move, performance.now())
      return { name: 'Test cube', disconnect: async () => undefined }
    }} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    await act(async () => emitMove?.('F2'))

    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ targetIndex: 1, turns: ['F2'] }))
  })

  it('reports one completed pass to the trainer ledger', async () => {
    let emitMove: ((move: string) => void) | undefined
    const complete = vi.fn()
    const user = userEvent.setup()
    render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R']} onComplete={complete} connect={async (onMove) => {
      emitMove = (move) => onMove(move, performance.now())
      return { name: 'Test cube', disconnect: async () => {} }
    }} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    await act(async () => emitMove?.('F'))
    await act(async () => emitMove?.('U'))

    expect(complete).toHaveBeenCalledTimes(1)
    expect(complete.mock.calls[0][0].turns).toEqual(['F'])
  })

  it('disconnects the controller when the trainer unmounts', async () => {
    const disconnect = vi.fn(async () => undefined)
    const user = userEvent.setup()
    const { unmount } = render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R']} connect={async () => ({ name: 'Test cube', disconnect })} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    unmount()

    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('keeps the cube connected when the target is replaced and resets only the pass', async () => {
    const disconnect = vi.fn(async () => undefined)
    const user = userEvent.setup()
    const { rerender } = render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R']} connect={async () => ({ name: 'Test cube', disconnect })} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    rerender(<CubeConnectionProvider><RemoteTrainerController targetMoves={['U']} connect={async () => ({ name: 'Test cube', disconnect })} /></CubeConnectionProvider>)

    expect(disconnect).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Controller connected' })).toBeInTheDocument()
    expect(screen.getByText('Target 0 / 1')).toBeInTheDocument()
  })

  it('disconnects a controller that resolves after unmount', async () => {
    let resolveConnection: () => void = () => undefined
    const disconnect = vi.fn(async () => undefined)
    const pending = new Promise<void>((resolve) => { resolveConnection = () => resolve() })
    const user = userEvent.setup()
    const { unmount } = render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R']} connect={async () => {
      await pending
      return { name: 'Test cube', disconnect }
    }} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    unmount()
    resolveConnection()

    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1))
  })

  it('applies turns to the replacement target instead of the retired one', async () => {
    let emitMove: ((move: string) => void) | undefined
    let resolveConnection: () => void = () => undefined
    const pending = new Promise<void>((resolve) => { resolveConnection = () => resolve() })
    const user = userEvent.setup()
    const { rerender } = render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R']} connect={async (onMove) => {
      emitMove = (move) => onMove(move, performance.now())
      await pending
      return { name: 'Test cube', disconnect: async () => undefined }
    }} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    rerender(<CubeConnectionProvider><RemoteTrainerController targetMoves={['U']} connect={async () => ({ name: 'Test cube', disconnect: async () => undefined })} /></CubeConnectionProvider>)
    await act(async () => emitMove?.('F'))
    resolveConnection()

    expect(screen.getByText('Target 1 / 1')).toBeInTheDocument()
  })

  it('surfaces a controller failure even when the target was replaced while connecting', async () => {
    let rejectConnection: (error: Error) => void = () => undefined
    const pending = new Promise<void>((_resolve, reject) => { rejectConnection = (error) => reject(error) })
    const user = userEvent.setup()
    const { rerender } = render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R']} connect={async () => {
      await pending
      return { name: 'Test cube', disconnect: async () => undefined }
    }} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    rerender(<CubeConnectionProvider><RemoteTrainerController targetMoves={['U']} connect={async () => ({ name: 'Test cube', disconnect: async () => undefined })} /></CubeConnectionProvider>)
    rejectConnection(new Error('late connection failure'))

    await act(async () => undefined)
    expect(screen.getByText('late connection failure')).toBeInTheDocument()
  })

  it('does not start a second controller connection while one is pending', async () => {
    let resolveConnection: () => void = () => undefined
    const pending = new Promise<void>((resolve) => { resolveConnection = () => resolve() })
    const connect = vi.fn(async () => {
      await pending
      return { name: 'Test cube', disconnect: async () => undefined }
    })
    const user = userEvent.setup()
    render(<CubeConnectionProvider><RemoteTrainerController targetMoves={['R']} connect={connect} /></CubeConnectionProvider>)

    await user.click(screen.getByRole('button', { name: 'Connect controller' }))
    expect(screen.getByRole('button', { name: 'Connecting controller…' })).toBeDisabled()
    resolveConnection()

    expect(connect).toHaveBeenCalledTimes(1)
  })
})

describe('shared cube connection', () => {
  it('never disconnects the global cube when the controller unmounts', async () => {
    const stops = { count: 0 }
    const source = {
      id: 'fake',
      label: 'Fake cube',
      async start() {
        return {
          name: 'Fake cube',
          protocol: 'test',
          mac: '',
          capabilities: {},
          provenance: 'cube' as const,
          requestState: async () => undefined,
          stop: async () => { stops.count += 1 }
        }
      }
    }

    function Harness() {
      const link = useCubeConnection()
      return (
        <div>
          <button onClick={() => void link.connect(source)}>connect shared</button>
          <RemoteTrainerController targetMoves={['R']} />
        </div>
      )
    }

    const user = userEvent.setup()
    const { unmount } = render(<CubeConnectionProvider><Harness /></CubeConnectionProvider>)
    await user.click(screen.getByRole('button', { name: 'connect shared' }))
    await waitFor(() => expect(screen.getByText(/Fake cube/)).toBeInTheDocument())

    unmount()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(stops.count).toBe(0)
  }, 30_000)
})
