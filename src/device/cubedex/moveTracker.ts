/**
 * Adapted from poliva/cubedex (MIT licensed).
 * Source: src/hooks/useSmartcubeConnection.ts (handleCubeEvent MOVE branch, processResolvedMove)
 * Copyright (c) 2024 Pau Oliva Fora
 *
 * Adapted from a React hook into a plain class operating on this project's
 * CubeEvent shape (src/device/inputSource.ts) instead of smartcube-web-bluetooth's
 * SmartCubeEvent, and using setTimeout/clearTimeout instead of window.setTimeout so
 * it runs outside a browser (fixture replay, tests). Gyroscope-orientation mode is
 * out of scope for this port; only the always-on slice-pairing path is kept.
 */

import type { KPattern } from 'cubing/kpuzzle'
import type { CubeEvent, CubeMoveEvent } from '../inputSource'
import { patternToFacelets, solvedPattern } from '../../domain/cubedex/cubeUtils'
import { fixOrientation } from '../../domain/cubedex/scramble'
import {
  getSliceForPair,
  IDENTITY,
  isSliceCandidate,
  remapMoveForPlayer,
  updateSliceOrientation,
  type FacePerm
} from '../../domain/cubedex/smartcubeParity'

export type ResolvedCubeMove = {
  key: string
  move: string
  rawMoves: CubeMoveEvent[]
  visualMove: string
  pattern: KPattern
  isBugged: boolean
}

const SLICE_PAIR_WINDOW_MS = 100

export class CubedexMoveTracker {
  private currentPattern: KPattern | null = null
  private sliceOrientation: FacePerm = { ...IDENTITY }
  private sliceBuffer: { event: CubeMoveEvent; timer: ReturnType<typeof setTimeout> } | null = null
  private previousFacelets = ''
  private isBugged = false
  /**
   * Pair two quick opposite-face turns into a slice move.
   *
   * Right during a solve — it is how M/S/E get rendered. Wrong while the solver is following
   * a printed scramble: those are literal face turns, and merging two of them into a slice
   * makes the tracker lose both, so a correctly turned move reads as "off the scramble".
   */
  slicePairing = true

  /** Called after the tracked cube is put back to solved, by whoever asked. */
  onReset?: () => void

  private readonly onResolvedMove: (resolved: ResolvedCubeMove) => void | Promise<void>

  constructor(onResolvedMove: (resolved: ResolvedCubeMove) => void | Promise<void>) {
    this.onResolvedMove = onResolvedMove
  }

  get pattern() {
    return this.currentPattern
  }

  private clearSliceBuffer() {
    if (this.sliceBuffer) {
      clearTimeout(this.sliceBuffer.timer)
      this.sliceBuffer = null
    }
  }

  async reset() {
    this.clearSliceBuffer()
    this.currentPattern = await solvedPattern()
    this.sliceOrientation = { ...IDENTITY }
    this.previousFacelets = ''
    this.isBugged = false
    this.onReset?.()
  }

  private async processResolvedMove(event: CubeMoveEvent, rawMoves: CubeMoveEvent[], visualMove?: string) {
    let trackerPattern = this.currentPattern
    if (!trackerPattern) {
      trackerPattern = await solvedPattern()
    }

    // fixOrientation first, exactly as domain/cubedex/scramble.ts does before every
    // other patternToFacelets call: wide and slice notation moves the centers, and
    // patternToFacelets rejects a pattern whose centers are not in the solved frame.
    // A smart cube never sends those, but this app's own OLL/PLL catalogue does when
    // it drives the tracker through the software simulator.
    const currentFacelets = patternToFacelets(fixOrientation(trackerPattern))
    const isBuggedState = currentFacelets === this.previousFacelets && !this.isBugged
    if (isBuggedState) {
      this.isBugged = true
    }
    this.previousFacelets = currentFacelets

    for (const rawMove of rawMoves) {
      trackerPattern = trackerPattern.applyMove(rawMove.move)
    }
    this.currentPattern = trackerPattern

    const effectiveVisualMove = visualMove ?? remapMoveForPlayer(event.move, this.sliceOrientation)
    const nextSliceOrientation = visualMove ? updateSliceOrientation(this.sliceOrientation, visualMove) : this.sliceOrientation
    this.sliceOrientation = nextSliceOrientation

    const computedKey = `${event.timestamp}:${effectiveVisualMove}:${rawMoves.map((entry) => entry.move).join(',')}`

    await this.onResolvedMove({
      key: computedKey,
      move: event.move,
      rawMoves,
      visualMove: effectiveVisualMove,
      pattern: trackerPattern,
      isBugged: this.isBugged
    })
  }

  private async flushBufferedMove() {
    if (!this.sliceBuffer) {
      return
    }
    const bufferedEvent = this.sliceBuffer.event
    this.clearSliceBuffer()
    await this.processResolvedMove(bufferedEvent, [bufferedEvent])
  }

  // A real connection eventually lets the 100ms slice-pair window in
  // handleEvent's setTimeout resolve. A caller driving a finite recorded
  // session (fixture replay, disconnect) has no further events to trigger
  // that, so it must call this once done to flush a still-buffered move
  // instead of silently losing it.
  async finish() {
    await this.flushBufferedMove()
  }

  async handleEvent(event: CubeEvent) {
    // FACELETS never seeds the tracked pattern. The app owns its cube state: the pattern
    // starts solved and advances only by applying the moves the cube reports. Seeding it
    // from the device made the app's state jump to whatever the hardware believed, which
    // is the desync this rule exists to prevent. The event still reaches diagnostics.
    if (event.type === 'FACELETS') return

    if (event.type === 'DISCONNECT') {
      this.clearSliceBuffer()
      this.currentPattern = null
      this.sliceOrientation = { ...IDENTITY }
      this.previousFacelets = ''
      this.isBugged = false
      return
    }

    if (event.type !== 'MOVE') {
      return
    }

    const sliceCandidate = this.slicePairing && isSliceCandidate(event.move)

    if (sliceCandidate) {
      if (this.sliceBuffer) {
        const bufferedEvent = this.sliceBuffer.event
        this.clearSliceBuffer()
        const sliceMove = getSliceForPair(bufferedEvent.move, event.move)
        if (sliceMove) {
          await this.processResolvedMove(event, [bufferedEvent, event], sliceMove)
        } else {
          await this.processResolvedMove(bufferedEvent, [bufferedEvent])
          this.sliceBuffer = {
            event,
            timer: setTimeout(() => {
              void this.flushBufferedMove()
            }, SLICE_PAIR_WINDOW_MS)
          }
        }
        return
      }

      this.sliceBuffer = {
        event,
        timer: setTimeout(() => {
          void this.flushBufferedMove()
        }, SLICE_PAIR_WINDOW_MS)
      }
      return
    }

    if (this.sliceBuffer) {
      await this.flushBufferedMove()
    }
    await this.processResolvedMove(event, [event])
  }
}
