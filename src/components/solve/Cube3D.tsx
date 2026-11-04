import { useEffect, useRef } from 'react'
import { css } from 'styled-system/css'
import { holdPermutation } from '../../domain/cubeHold'
import { remapMoveForPlayer } from '../../domain/cubedex/smartcubeParity'
import { conjugateQuaternion, gyroDisplayQuaternion, gyroSensorQuaternion, type Quaternion } from '../../domain/gyro'
import { useOptionalCubeConnection } from '../../device/CubeConnection'

// Just the cube. The cockpit's centre slot is a borderless area with the cube in it —
// per the design system, "a borderless area with a subtle radial gradient behind the
// cube to provide depth without distracting from the facets". CubePlayback is a whole
// panel with its own title, controls and move list, so it does not belong here.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>
    }
  }
}

type ThreeQuaternion = Quaternion & { clone(): ThreeQuaternion; set(x: number, y: number, z: number, w: number): ThreeQuaternion; slerp(target: ThreeQuaternion, t: number): ThreeQuaternion }
type GyroPlayer = HTMLElement & {
  experimentalCurrentVantages?: () => Promise<Iterable<{ render?: () => void }>>
  experimentalCurrentThreeJSPuzzleObject?: () => Promise<{ quaternion: ThreeQuaternion }>
}

export function Cube3D({ setupAlg = '', viewRotation = '', size = 256, gyro = false }: { setupAlg?: string; viewRotation?: string; size?: number; gyro?: boolean }) {
  const player = useRef<HTMLElement | null>(null)
  const applied = useRef('')
  const connection = useOptionalCubeConnection()
  const subscribe = gyro ? connection?.subscribe : undefined
  const handle = connection?.handle
  const basis = useRef<Quaternion | null>(null)
  const target = useRef<Quaternion | null>(null)

  useEffect(() => {
    if (!subscribe) return
    basis.current = null
    target.current = null
    let frame = 0
    let scene: { puzzle: { quaternion: ThreeQuaternion }; vantage?: { render?: () => void } } | null = null
    let loading = false
    const animate = () => {
      frame = requestAnimationFrame(animate)
      const element = player.current as GyroPlayer | null
      if (!target.current || !element) return
      if (!scene) {
        if (loading || !element.experimentalCurrentThreeJSPuzzleObject || !element.experimentalCurrentVantages) return
        loading = true
        void Promise.all([element.experimentalCurrentThreeJSPuzzleObject(), element.experimentalCurrentVantages()])
          .then(([puzzle, vantages]) => { scene = { puzzle, vantage: [...vantages][0] } })
          .catch(() => undefined)
          .finally(() => { loading = false })
        return
      }
      const { x, y, z, w } = target.current
      scene.puzzle.quaternion.slerp(scene.puzzle.quaternion.clone().set(x, y, z, w), 0.25)
      scene.vantage?.render?.()
    }
    frame = requestAnimationFrame(animate)
    const unsubscribe = subscribe((event) => {
      if (event.type !== 'GYRO') return
      const sensor = gyroSensorQuaternion(event.quaternion)
      if (!sensor) return
      basis.current ??= conjugateQuaternion(sensor)
      target.current = gyroDisplayQuaternion(basis.current, sensor)
    })
    return () => {
      cancelAnimationFrame(frame)
      unsubscribe()
    }
  }, [subscribe, handle])

  // Append only what is new. Re-seeding from solved on every move meant a 40-move solve
  // re-parsed 40 growing algs; appending keeps it to one move of work per turn.
  useEffect(() => {
    let cancelled = false
    // The alg is set as a PROPERTY, so it must wait for the custom element to upgrade —
    // assigning before that just parks a plain value the player never reads, and the cube
    // renders unrotated and unmoved.
    void customElements.whenDefined('twisty-player').then(() => { if (!cancelled) apply() })
    return () => { cancelled = true }

    function apply() {
    const element = player.current as (HTMLElement & {
      experimentalSetupAlg?: string
      alg?: string
      experimentalModel?: { experimentalAddMove?: (move: string, options?: { cancel?: boolean }) => void }
    }) | null
    if (!element) return
    // The rotation goes FIRST, and every move after it is expressed in the rotated frame via
    // the same face permutation. That keeps the one-move-at-a-time append working, which is
    // what stops the cube falling behind a real solve; putting the rotation last forced a
    // full re-parse per turn and the display drifted out of sync with the hand.
    const rotation = viewRotation.trim()
    const perm = holdPermutation(rotation)
    const inFrame = (moves: string) => moves
      .split(/\s+/)
      .filter(Boolean)
      .map((move) => remapMoveForPlayer(move, perm))
      .join(' ')
    // Only plain face turns can be expressed in the rotated frame by a face permutation; a
    // slice or wide move would need more than a face relabel. The cube reports face turns, so
    // the append path stays available, and anything else falls back to a re-seed with the
    // rotation applied last, which needs no remapping at all.
    const plainFaceTurns = setupAlg.trim().split(/\s+/).filter(Boolean).every((move) => /^[URFDLB]['2]?$/.test(move))
    const next = plainFaceTurns
      ? [rotation, inFrame(setupAlg.trim())].filter(Boolean).join(' ')
      : [setupAlg.trim(), rotation].filter(Boolean).join(' ')
    const previous = applied.current.trim()
    const addMove = element.experimentalModel?.experimentalAddMove
    if (next === previous) return
    if (addMove && previous && plainFaceTurns && next.startsWith(previous)) {
      const appended = next.slice(previous.length).trim().split(/\s+/).filter(Boolean)
      try {
        for (const move of appended) addMove.call(element.experimentalModel, move, { cancel: false })
        applied.current = next
        return
      } catch {
        // An unparseable move must not take the cube down; fall through to a full re-seed.
      }
    }
    element.experimentalSetupAlg = next
    element.alg = ''
    applied.current = next
    }
  }, [setupAlg, viewRotation])

  useEffect(() => {
    if (navigator.userAgent.includes('jsdom')) return
    const load = customElements.get('twisty-player') ? Promise.resolve() : import('cubing/twisty')
    void load.then(async () => {
      await customElements.whenDefined('twisty-player')
      // twisty-player defers its first render until an intersection observer fires. In
      // panels that are laid out after mount that never happens and the cube stays
      // blank, so kick it directly — the same workaround CubePlayback already uses.
      const element = player.current
      const callback = element && Object.getOwnPropertySymbols(Object.getPrototypeOf(element)).find((symbol) => String(symbol).includes('intersectedCallback'))
      if (element && callback) {
        const internal = element as HTMLElement & { [key: symbol]: () => void; contentWrapper?: HTMLElement }
        internal[callback]()
        if (internal.contentWrapper) internal.contentWrapper.style.height = '100%'
      }
    })
  }, [])

  return (
    <div
      className={css({
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        borderRadius: 'card',
        background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.05), transparent 62%)'
      })}
      style={{ width: size, height: size }}
      title={gyro ? 'Click to reset gyro: hold white up, green front' : undefined}
      onClick={gyro ? () => { basis.current = null } : undefined}
    >
      {/* No experimental-setup-alg here: React would rewrite the attribute on every turn
          and the player would re-parse and re-render the whole sequence from solved, which
          is what made the cube stutter as you scrambled. Moves are applied one at a time
          below, exactly as CubePlayback does for a live cube. */}
      <twisty-player
        ref={player}
        alg=""
        background="none"
        control-panel="none"
        hint-facelets="none"
        puzzle="3x3x3"
        visualization="3D"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    </div>
  )
}
