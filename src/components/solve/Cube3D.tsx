import { useEffect, useRef } from 'react'
import { css } from 'styled-system/css'
import { holdPermutation } from '../../domain/cubeHold'
import { remapMoveForPlayer } from '../../domain/cubedex/smartcubeParity'
import { conjugateQuaternion, gyroDisplayQuaternion, gyroSensorQuaternion, holdQuaternion, type Quaternion } from '../../domain/gyro'
import { useOptionalCubeConnection } from '../../device/CubeConnection'
import type { CubeRenderer } from '../cube/CubeRenderer'
import { onCubeColoursChange, readCubeColours } from '../cube/cubeColours'

const tokens = (alg: string) => alg.trim().split(/\s+/).filter(Boolean)

export function Cube3D({ setupAlg = '', viewRotation = '', size, gyro = false, gyroResetKey, highlight, orientation }: { setupAlg?: string; viewRotation?: string; size?: number; gyro?: boolean; gyroResetKey?: number; highlight?: string[]; orientation?: Quaternion | null }) {
  const host = useRef<HTMLDivElement | null>(null)
  const renderer = useRef<CubeRenderer | null>(null)
  const applied = useRef('')
  const wanted = useRef('')
  const connection = useOptionalCubeConnection()
  const subscribe = gyro ? connection?.subscribe : undefined
  const handle = connection?.handle
  const basis = useRef<Quaternion | null>(null)
  const holdRef = useRef<Quaternion>(holdQuaternion(viewRotation))
  holdRef.current = holdQuaternion(viewRotation)
  const highlightKey = highlight?.join(' ') ?? ''
  const highlightRef = useRef(highlightKey)
  highlightRef.current = highlightKey

  const sync = () => {
    const cube = renderer.current
    if (!cube) return
    const next = wanted.current
    const previous = applied.current
    if (next === previous) return
    if (previous && next.startsWith(previous) && (next.length === previous.length || next[previous.length] === ' ')) {
      cube.enqueue(tokens(next.slice(previous.length)))
    } else {
      cube.reset()
      cube.applyInstant(tokens(next))
    }
    applied.current = next
  }

  useEffect(() => {
    const rotation = viewRotation.trim()
    const perm = holdPermutation(rotation)
    const moves = tokens(setupAlg)
    const plainFaceTurns = moves.every((move) => /^[URFDLB](2'?|')?$/.test(move))
    wanted.current = plainFaceTurns
      ? [rotation, ...moves.map((move) => remapMoveForPlayer(move, perm))].filter(Boolean).join(' ')
      : [setupAlg.trim(), rotation].filter(Boolean).join(' ')
    sync()
  }, [setupAlg, viewRotation])

  useEffect(() => {
    const element = host.current
    if (!element || navigator.userAgent.includes('jsdom')) return
    let disposed = false
    let observer: ResizeObserver | undefined
    const applyColours = () => { void readCubeColours().then((colours) => { if (!disposed) renderer.current?.setColours(colours) }).catch(() => undefined) }
    const stopColours = onCubeColoursChange(applyColours)
    void import('../cube/CubeRenderer').then(({ CubeRenderer }) => {
      if (disposed) return
      const cube = new CubeRenderer()
      renderer.current = cube
      element.appendChild(cube.canvas)
      observer = new ResizeObserver(([entry]) => cube.resize(entry.contentRect.width, entry.contentRect.height))
      observer.observe(element)
      cube.resize(element.clientWidth, element.clientHeight)
      applied.current = ''
      sync()
      cube.highlight(highlightRef.current ? highlightRef.current.split(' ') : null)
      applyColours()
      if (orientationRef.current) cube.setOrientation(orientationRef.current)
      cube.start()
    })
    return () => {
      disposed = true
      stopColours()
      observer?.disconnect()
      renderer.current?.canvas.remove()
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [])

  useEffect(() => {
    renderer.current?.highlight(highlightKey ? highlightKey.split(' ') : null)
  }, [highlightKey])

  const orientationRef = useRef(orientation)
  orientationRef.current = orientation
  useEffect(() => {
    if (orientation === undefined) return
    renderer.current?.setOrientation(orientation)
  }, [orientation?.x, orientation?.y, orientation?.z, orientation?.w, orientation === null])

  useEffect(() => {
    basis.current = null
  }, [gyroResetKey])

  useEffect(() => {
    basis.current = null
    renderer.current?.setOrientation(null)
    if (!subscribe) return
    return subscribe((event) => {
      if (event.type !== 'GYRO') return
      const sensor = gyroSensorQuaternion(event.quaternion)
      if (!sensor) return
      basis.current ??= conjugateQuaternion(sensor)
      renderer.current?.setOrientation(gyroDisplayQuaternion(basis.current, sensor, holdRef.current))
    })
  }, [subscribe, handle])

  return (
    <div
      ref={host}
      data-testid="cube-3d"
      data-setup-alg={setupAlg}
      data-view-rotation={viewRotation}
      title={gyro ? 'Click to reset gyro: hold white up, green front' : undefined}
      onClick={gyro ? () => { basis.current = null } : undefined}
      className={css({ position: 'relative', flexShrink: 0, maxW: 'full' })}
      style={{ width: size ?? '100%', height: size ?? '100%' }}
    />
  )
}
