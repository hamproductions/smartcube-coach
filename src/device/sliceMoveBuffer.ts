// Ported from poliva/cubedex (MIT License), commit e5849e2.
// Source: https://github.com/poliva/cubedex/blob/main/src/hooks/useSmartcubeConnection.ts
//   - slice pair buffering: lines 236-241 (clearSliceBuffer), 342-351 (flushBufferedMove),
//     353-508 (handleCubeEvent, MOVE branch only)
//   - visual-move remap + running slice orientation: lines 277-340 (processResolvedMove)
// Copyright (c) 2024 Pau Oliva Fora
//
// A QiYi (and similar) smart cube can only ever report single-face quarter/double turns.
// M/E/S slice moves don't exist on the hardware: a human doing an M' turns R' and L together,
// and the cube reports two independent opposite-face MOVE events a few tens of ms apart.
// cubedex buffers the first "slice candidate" face turn for a short window; if the very next
// move is its opposite face, the pair collapses into the slice token it represents (getSliceForPair).
// If it isn't, the buffered move is flushed as itself and the new move starts its own window.
// Because a slice move silently rotates the whole cube in the solver's hands, every future
// single-face move must be remapped through the accumulated slice orientation so the twisty
// player (and any move-stream display) shows what the move visually is, not what face sensor
// fired.

import type { CubeMoveEvent } from './inputSource'
import {
  IDENTITY,
  getSliceForPair,
  isSliceCandidate,
  remapMoveForPlayer,
  updateSliceOrientation,
  type FacePerm,
} from '../domain/moveParity'

export const SLICE_PAIR_WINDOW_MS = 100

export type ResolvedMove = {
  /** The slice/face token as it should be displayed and applied to the visual cube. */
  visualMove: string
  /** The raw single-face MOVE event(s) this resolves (1 for a plain turn, 2 for a slice pair). */
  rawMoves: CubeMoveEvent[]
}

type SetTimeoutFn = (handler: () => void, ms: number) => number
type ClearTimeoutFn = (handle: number) => void

export type SliceMoveBufferOptions = {
  bufferMs?: number
  gyroscopeEnabled?: boolean
  setTimeoutFn?: SetTimeoutFn
  clearTimeoutFn?: ClearTimeoutFn
}

/**
 * Standalone (framework-free) port of cubedex's slice-pairing + visual-move-remap pipeline.
 * Feed it raw MOVE events from a `CubeInputSource`; it calls back with resolved moves once
 * the 100ms pairing window has settled.
 */
export class SliceMoveBuffer {
  private readonly bufferMs: number
  private readonly gyroscopeEnabled: boolean
  private readonly setTimeoutFn: SetTimeoutFn
  private readonly clearTimeoutFn: ClearTimeoutFn
  private buffered: { event: CubeMoveEvent; timer: number } | null = null
  private sliceOrientation: FacePerm = { ...IDENTITY }

  constructor(
    private readonly onResolvedMove: (resolved: ResolvedMove) => void,
    options: SliceMoveBufferOptions = {}
  ) {
    this.bufferMs = options.bufferMs ?? SLICE_PAIR_WINDOW_MS
    this.gyroscopeEnabled = options.gyroscopeEnabled ?? false
    this.setTimeoutFn = options.setTimeoutFn ?? ((handler, ms) => globalThis.setTimeout(handler, ms) as unknown as number)
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => globalThis.clearTimeout(handle))
  }

  get orientation(): FacePerm {
    return this.sliceOrientation
  }

  reset() {
    this.clearBuffer()
    this.sliceOrientation = { ...IDENTITY }
  }

  private clearBuffer() {
    if (this.buffered) {
      this.clearTimeoutFn(this.buffered.timer)
      this.buffered = null
    }
  }

  private flushBuffered() {
    if (!this.buffered) return
    const bufferedEvent = this.buffered.event
    this.clearBuffer()
    this.resolve(bufferedEvent, [bufferedEvent])
  }

  private resolve(event: CubeMoveEvent, rawMoves: CubeMoveEvent[], visualMove?: string) {
    const effectiveVisualMove = visualMove ?? remapMoveForPlayer(event.move, this.sliceOrientation)
    if (visualMove) {
      this.sliceOrientation = updateSliceOrientation(this.sliceOrientation, visualMove)
    }
    this.onResolvedMove({ visualMove: effectiveVisualMove, rawMoves })
  }

  /** Feed one raw physical MOVE event. Mirrors cubedex's handleCubeEvent MOVE branch. */
  feed(event: CubeMoveEvent) {
    const sliceCandidate = isSliceCandidate(event.move)

    if (!this.gyroscopeEnabled) {
      if (sliceCandidate) {
        if (this.buffered) {
          const bufferedEvent = this.buffered.event
          this.clearBuffer()
          const sliceMove = getSliceForPair(bufferedEvent.move, event.move)
          if (sliceMove) {
            this.resolve(event, [bufferedEvent, event], sliceMove)
          } else {
            this.resolve(bufferedEvent, [bufferedEvent])
            this.buffered = {
              event,
              timer: this.setTimeoutFn(() => this.flushBuffered(), this.bufferMs),
            }
          }
          return
        }

        this.buffered = {
          event,
          timer: this.setTimeoutFn(() => this.flushBuffered(), this.bufferMs),
        }
        return
      }

      if (this.buffered) {
        this.flushBuffered()
        this.resolve(event, [event])
        return
      }
    } else if (this.buffered) {
      this.flushBuffered()
      return
    }

    this.resolve(event, [event])
  }
}
