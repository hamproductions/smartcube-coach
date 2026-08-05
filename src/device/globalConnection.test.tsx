import { useEffect, useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CubeEvent, CubeInputSource } from './inputSource'
import { CubeConnectionProvider, useCubeConnection } from './CubeConnection'

const fakeSource = () => {
  const state = {
    emit: undefined as undefined | ((event: CubeEvent) => void | Promise<void>),
    starts: 0,
    stops: 0
  }
  const source: CubeInputSource = {
    id: 'fake',
    label: 'Fake cube',
    async start(onEvent, onStatus) {
      state.starts += 1
      state.emit = onEvent
      onStatus('Fake cube ready')
      return {
        name: 'Fake cube',
        protocol: 'fake',
        mac: 'aa:bb:cc:dd:ee:ff',
        capabilities: { facelets: true, battery: true },
        provenance: 'cube',
        requestState: async () => undefined,
        stop: async () => { state.stops += 1 }
      }
    }
  }
  return { source, state }
}

function StatusView() {
  const cubeLink = useCubeConnection()
  return (
    <div data-testid="status">
      {cubeLink.handle ? `${cubeLink.handle.name}:${cubeLink.status}` : 'disconnected'}
    </div>
  )
}

function GlobalSink({ received }: { received: CubeEvent[] }) {
  const cubeLink = useCubeConnection()
  useEffect(() => cubeLink.subscribe((event) => { received.push(event) }), [cubeLink])
  return null
}

function ConnectButton({ source }: { source: CubeInputSource }) {
  const cubeLink = useCubeConnection()
  return <button onClick={() => void cubeLink.connect(source)}>Connect</button>
}

function RouteListener({ received }: { received: CubeEvent[] }) {
  const cubeLink = useCubeConnection()
  useEffect(() => cubeLink.subscribe((event) => { received.push(event) }), [cubeLink])
  return <div data-testid="route">route mounted</div>
}

function Harness({ route, source, routeEvents, globalEvents }: {
  route: 'a' | 'b' | 'none'
  source: CubeInputSource
  routeEvents: CubeEvent[]
  globalEvents: CubeEvent[]
}) {
  return (
    <CubeConnectionProvider>
      <StatusView />
      <GlobalSink received={globalEvents} />
      {route === 'a' && <ConnectButton source={source} />}
      {route !== 'none' && <RouteListener received={routeEvents} />}
    </CubeConnectionProvider>
  )
}

describe('global cube connection survives navigation', () => {
  it('stays connected after navigating to another route and back', async () => {
    const user = userEvent.setup()
    const { source } = fakeSource()
    const routeEvents: CubeEvent[] = []
    const globalEvents: CubeEvent[] = []

    const { rerender } = render(
      <Harness route="a" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />
    )

    await user.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('Fake cube:Fake cube · fake'))

    rerender(<Harness route="b" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />)
    expect(screen.getByTestId('status').textContent).toBe('Fake cube:Fake cube · fake')

    rerender(<Harness route="a" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />)
    expect(screen.getByTestId('status').textContent).toBe('Fake cube:Fake cube · fake')
  })

  it('does not lose events emitted while a different route is mounted', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeSource()
    const routeEvents: CubeEvent[] = []
    const globalEvents: CubeEvent[] = []

    const { rerender } = render(
      <Harness route="a" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />
    )

    await user.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(state.emit).toBeDefined())

    rerender(<Harness route="b" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />)

    await act(async () => {
      await state.emit?.({ type: 'MOVE', move: 'R', face: 0, direction: 1, timestamp: 1, cubeTimestamp: 1, localTimestamp: 1 })
      await state.emit?.({ type: 'BATTERY', batteryLevel: 42, timestamp: 2 })
    })

    expect(globalEvents.filter((event) => event.type === 'MOVE')).toHaveLength(1)
    expect(globalEvents.filter((event) => event.type === 'BATTERY')).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('Fake cube:Fake cube · fake'))
  })

  it('reflects a real device disconnect immediately even with no route mounted to react to it', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeSource()
    const routeEvents: CubeEvent[] = []
    const globalEvents: CubeEvent[] = []

    const { rerender } = render(
      <Harness route="a" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />
    )

    await user.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('Fake cube:Fake cube · fake'))

    rerender(<Harness route="none" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />)

    await act(async () => { await state.emit?.({ type: 'DISCONNECT', timestamp: 3 }) })

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('disconnected'))
  })

  it('does not disconnect the device when a subscribing route unmounts', async () => {
    const user = userEvent.setup()
    const { source, state } = fakeSource()
    const routeEvents: CubeEvent[] = []
    const globalEvents: CubeEvent[] = []

    const { rerender } = render(
      <Harness route="a" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />
    )

    await user.click(screen.getByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(state.starts).toBe(1))

    const stopsBeforeNav = state.stops
    rerender(<Harness route="none" source={source} routeEvents={routeEvents} globalEvents={globalEvents} />)

    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(state.stops).toBe(stopsBeforeNav)
    expect(screen.getByTestId('status').textContent).toBe('Fake cube:Fake cube · fake')
  })

  it('lets each route subscribe and unsubscribe independently without affecting other listeners', async () => {
    function TwoListeners({ aEvents, bEvents, showA, showB }: {
      aEvents: CubeEvent[]
      bEvents: CubeEvent[]
      showA: boolean
      showB: boolean
    }) {
      return (
        <>
          {showA && <RouteListener received={aEvents} />}
          {showB && <RouteListener received={bEvents} />}
        </>
      )
    }

    function Root({ showA, showB, aEvents, bEvents, emitRef }: {
      showA: boolean
      showB: boolean
      aEvents: CubeEvent[]
      bEvents: CubeEvent[]
      emitRef: { current?: (event: CubeEvent) => void }
    }) {
      const cubeLink = useCubeConnection()
      const [ready, setReady] = useState(false)
      useEffect(() => {
        void cubeLink.connect({
          id: 'fake',
          label: 'Fake',
          async start(onEvent, onStatus) {
            emitRef.current = (event) => void onEvent(event)
            onStatus('ready')
            setReady(true)
            return {
              name: 'Fake cube',
              protocol: 'fake',
              mac: 'aa',
              capabilities: {},
              provenance: 'cube',
              requestState: async () => undefined,
              stop: async () => undefined
            }
          }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return ready ? <TwoListeners aEvents={aEvents} bEvents={bEvents} showA={showA} showB={showB} /> : null
    }

    const aEvents: CubeEvent[] = []
    const bEvents: CubeEvent[] = []
    const emitRef: { current?: (event: CubeEvent) => void } = {}

    const { rerender } = render(
      <CubeConnectionProvider>
        <Root showA showB aEvents={aEvents} bEvents={bEvents} emitRef={emitRef} />
      </CubeConnectionProvider>
    )

    await waitFor(() => expect(emitRef.current).toBeDefined())
    await act(async () => { emitRef.current?.({ type: 'MOVE', move: 'U', face: 2, direction: 1, timestamp: 1, cubeTimestamp: 1, localTimestamp: 1 }) })
    expect(aEvents).toHaveLength(1)
    expect(bEvents).toHaveLength(1)

    rerender(
      <CubeConnectionProvider>
        <Root showA={false} showB aEvents={aEvents} bEvents={bEvents} emitRef={emitRef} />
      </CubeConnectionProvider>
    )

    await act(async () => { emitRef.current?.({ type: 'MOVE', move: 'D', face: 3, direction: 1, timestamp: 2, cubeTimestamp: 2, localTimestamp: 2 }) })
    expect(aEvents).toHaveLength(1)
    expect(bEvents).toHaveLength(2)
  })
})
