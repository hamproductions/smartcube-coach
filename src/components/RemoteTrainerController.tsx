import { useEffect, useRef, useState } from 'react'
import { RemoteControllerSession, type RemoteControllerSnapshot } from '../domain/remoteController'
import { bluetoothSource } from '../device/sources'
import { useCubeConnection } from '../device/CubeConnection'

export type RemoteConnection = {
  name: string
  disconnect(): Promise<void>
}

export type RemoteControllerConnect = (onMove: (move: string, timestamp: number) => void, onStatus: (status: string) => void) => Promise<RemoteConnection>

type RemoteTrainerControllerProps = {
  targetMoves: string[]
  onComplete?: (snapshot: RemoteControllerSnapshot) => void | Promise<void>
  onProgress?: (snapshot: RemoteControllerSnapshot) => void
  connect?: RemoteControllerConnect
}

const emptySnapshot: RemoteControllerSnapshot = { targetIndex: 0, complete: false, turns: [] }

export function RemoteTrainerController({ targetMoves, onComplete, onProgress, connect }: RemoteTrainerControllerProps) {
  const targetKey = targetMoves.join(' ')
  const session = useRef(new RemoteControllerSession(targetMoves))
  const completed = useRef(false)
  const [snapshot, setSnapshot] = useState<RemoteControllerSnapshot>(emptySnapshot)
  const [status, setStatus] = useState('No controller connected')
  const [connection, setConnection] = useState<RemoteConnection>()
  const [connecting, setConnecting] = useState(false)
  const connectionRef = useRef<RemoteConnection | undefined>(undefined)
  const connectionVersion = useRef(0)
  const cubeLink = useCubeConnection()
  const attachController: RemoteControllerConnect = connect ?? (async (onMove, onStatus) => {
    const handle = await cubeLink.connect(bluetoothSource({ requestInitialState: true }))
    if (!handle) throw new Error('Could not connect a cube')
    onStatus(`${handle.name} · ${handle.protocol}`)
    void onMove
    return { name: handle.name, disconnect: async () => undefined }
  })

  useEffect(() => {
    if (!cubeLink.handle) return
    setStatus(`${cubeLink.handle.name} · connected`)
    return cubeLink.subscribe((event) => {
      if (event.type !== 'MOVE') return
      const next = session.current.handleMove(event.move, event.timestamp)
      setSnapshot(next)
      onProgress?.(next)
      if (next.complete && !completed.current) {
        completed.current = true
        void onComplete?.(next)
      }
    })
  }, [cubeLink, cubeLink.handle, onComplete, onProgress])

  useEffect(() => {
    session.current = new RemoteControllerSession(targetMoves)
    completed.current = false
    setSnapshot(emptySnapshot)
    onProgress?.(emptySnapshot)
  }, [targetKey])

  useEffect(() => () => {
    connectionVersion.current += 1
    const active = connectionRef.current
    connectionRef.current = undefined
    void active?.disconnect()
  }, [])

  const connectController = async () => {
    if (connecting) return
    const version = connectionVersion.current
    setConnecting(true)
    try {
      const connected = await attachController((move, timestamp) => {
        if (version !== connectionVersion.current) return
        const next = session.current.handleMove(move, timestamp)
        setSnapshot(next)
        onProgress?.(next)
        if (next.complete && !completed.current) {
          completed.current = true
          void onComplete?.(next)
        }
      }, (nextStatus) => { if (version === connectionVersion.current) setStatus(nextStatus) })
      if (version !== connectionVersion.current) {
        await connected.disconnect()
        return
      }
      connectionRef.current = connected
      setConnection(connected)
      setStatus(`${connected.name} controls playback`)
    } catch (error) {
      if (version === connectionVersion.current) setStatus(error instanceof Error ? error.message : 'Controller connection failed')
    } finally {
      if (version === connectionVersion.current) setConnecting(false)
    }
  }

  return (
    <section className="remote-controller">
      <div><span className="eyebrow green">REMOTE CONTROLLER / STATE-AGNOSTIC</span><h3>Turn any move to advance playback.</h3></div>
      <p>{status}</p>
      <button className="button secondary" disabled={Boolean(connection) || connecting} onClick={() => void connectController()}>{connection ? 'Controller connected' : connecting ? 'Connecting controller…' : 'Connect controller'}</button>
      <strong>Target {snapshot.targetIndex} / {targetMoves.length}</strong>
      <p>{snapshot.complete ? 'Controller pass complete.' : 'Cube state is intentionally ignored.'}</p>
      <code>{snapshot.turns.join(' ') || 'Waiting for turns'}</code>
    </section>
  )
}
