/**
 * Adapted from poliva/cubedex (MIT licensed).
 * Source: src/hooks/useScrambleState.ts (startScrambleTo/advanceScramble), src/lib/scramble.ts
 *         (getScrambleToSolution), src/hooks/useTrainingState.ts (timerState machine,
 *         handleSmartcubeMove solved-detection, stopAndRecordSolve cube-clock fit)
 * Copyright (c) 2024 Pau Oliva Fora
 *
 * cubedex tracks progress against a fixed target algorithm chosen by the trainer UI.
 * This project has no fixed target algorithm for a live solve, only a known WCA
 * scramble string, so the completion test is state-based against the solved pattern
 * (KPattern.isIdentical) rather than against a specific move-index in an algorithm's
 * pattern-state table. The scramble-matching phase reuses getScrambleToSolution
 * unmodified: treating the scramble's own inverse as "the algorithm still left to
 * play" makes it compute the remaining hand-scramble moves needed to reach the
 * target scrambled state, tolerant of wrong-direction turns and split doubles because
 * it re-solves from the actual cube state on every move instead of walking an index.
 *
 * A WCA scramble string is defined relative to the solved state, not relative to
 * whatever the physical cube happens to be showing when a session starts recording
 * (confirmed against src/device/fixtures/user-sessions/: the device's own reported
 * FACELETS on connect frequently is not the solved facelets string, e.g. a session
 * captured mid-use, or before a firmware calibration round-trip completed). cubedex's
 * own trainer avoids this by seeding its comparison pattern once from whatever the
 * cube looks like when a drill starts, because its target is "an algorithm relative
 * to now," not a WCA scramble relative to solved. This tracker instead keeps its own
 * pattern seeded at the solved state and updates it by applying only resolved moves
 * (never a FACELETS resync), independently of CubedexMoveTracker's live, facelets-
 * synced pattern (which stays authoritative for rendering/bug-detection). Replaying
 * every scrambled fixture in src/device/fixtures/user-sessions/ confirmed this:
 * comparing against the facelets-synced pattern never reaches the target scramble or
 * the solved state even for real, physically completed solves, while accumulating
 * moves from solved does, at the same move index this project's own
 * domain/scramble.ts + capture.ts pipeline already finds (see
 * docs/research/hardware-replay-2026-08-03.md).
 */

import { Alg } from 'cubing/alg'
import type { KPattern } from 'cubing/kpuzzle'
import { cubeTimestampLinearFit } from '../../../node_modules/smartcube-web-bluetooth/src/index'
import type { CubeMoveEvent } from '../inputSource'
import { getScrambleToSolution } from '../../domain/cubedex/scramble'
import { solvedPattern } from '../../domain/cubedex/cubeUtils'
import type { ResolvedCubeMove } from './moveTracker'

export type SolveTrackerStatus = 'idle' | 'scrambling' | 'ready' | 'running' | 'stopped'

export type SolveTrackerSnapshot = {
  status: SolveTrackerStatus
  scrambleRemaining: string
  durationMs: number | null
}

export type SolutionMove = { move: string; timestamp: number }

export class CubedexSolveTracker {
  private status: SolveTrackerStatus
  private scrambleRemaining: string
  private readonly targetInverseAlg: string
  private solutionMoves: CubeMoveEvent[] = []
  private firstLocalTimestamp: number | null = null
  private durationMs: number | null = null
  private solved: KPattern | null = null
  private pattern: KPattern | null = null

  // `initialPattern` is the cube's ACTUAL state when tracking starts, and must be
  // supplied whenever the target scramble is not being verified from solved —
  // "Done scrambling" and "Start from this state" both begin from a cube that is
  // already scrambled. Without it the tracker seeds at solved, so isIdentical()
  // fires as soon as the moves since that moment cancel out, and a session with no
  // solve in it is saved as a completed solve that replays to a scrambled cube.
  constructor(private readonly targetScramble: string, initialPattern?: KPattern | null) {
    this.targetInverseAlg = targetScramble ? Alg.fromString(targetScramble).invert().toString() : ''
    this.scrambleRemaining = targetScramble
    this.status = targetScramble ? 'scrambling' : 'ready'
    this.pattern = initialPattern ?? null
  }

  snapshot(): SolveTrackerSnapshot {
    return { status: this.status, scrambleRemaining: this.scrambleRemaining, durationMs: this.durationMs }
  }

  /**
   * Accepts whatever state the cube is in as the start of the solve.
   *
   * Per rebuild-spec §1.1 this is the primary way out of the scrambling phase, matching
   * the reference: it never asserts that a scrambling move was wrong, it just takes the
   * current state when the solver says they are done. A strict scramble match remains
   * available but must not be the only route to `ready`.
   */
  /**
   * Declares the cube physically solved right now and restarts tracking from there.
   *
   * This is the recalibration path. It deliberately does NOT read the device's facelets:
   * the header comment on this class records that a FACELETS resync never reaches the
   * solved state even for real completed solves, so the only reliable reference is this
   * tracker's own pattern accumulated from resolved moves. Resetting means "start
   * accumulating from solved again", which is exactly what a solver does when they hand
   * the app a solved cube.
   */
  async resetToSolvedState() {
    this.solved = this.solved ?? (await solvedPattern())
    this.pattern = this.solved
    this.solutionMoves = []
    this.firstLocalTimestamp = null
    this.durationMs = null
    this.scrambleRemaining = this.targetScramble
    this.status = this.targetScramble ? 'scrambling' : 'ready'
  }

  acceptCurrentState() {
    if (this.status !== 'scrambling') return
    this.scrambleRemaining = ''
    this.status = 'ready'
  }

  /**
   * There is deliberately no hands-free accept gesture.
   *
   * The reference has one (four turns of a face) and it was ported, but any pattern it
   * recognises ends the scrambling phase — and the next turn then starts the clock. That is
   * the "timer starts by itself" this app kept reproducing. It also froze `scrambleRemaining`
   * at empty, so the recovery panel showed an off-track state with no moves in it. The
   * scrambling phase now ends only when the cube's own state matches the scramble.
   */

  async onResolvedMove(resolved: ResolvedCubeMove) {
    if (this.status === 'idle' || this.status === 'stopped') {
      return
    }

    if (!this.solved) {
      this.solved = await solvedPattern()
    }
    if (!this.pattern) {
      this.pattern = this.solved
    }
    for (const rawMove of resolved.rawMoves) {
      this.pattern = this.pattern.applyMove(rawMove.move)
    }

    if (this.status === 'scrambling') {
      this.scrambleRemaining = await getScrambleToSolution(this.targetInverseAlg, this.pattern)
      if (this.scrambleRemaining.trim().length === 0) {
        this.status = 'ready'
      }
      return
    }

    if (this.status === 'ready') {
      this.status = 'running'
      this.solutionMoves = []
      this.firstLocalTimestamp = null
    }

    if (this.status === 'running') {
      for (const rawMove of resolved.rawMoves) {
        if (this.firstLocalTimestamp == null && rawMove.localTimestamp != null) {
          this.firstLocalTimestamp = rawMove.localTimestamp
        }
      }
      this.solutionMoves = [...this.solutionMoves, ...resolved.rawMoves]

      if (this.pattern.isIdentical(this.solved)) {
        this.durationMs = this.computeFinalDuration()
        this.status = 'stopped'
      }
    }
  }

  // The exact move stream this tracker counted as the solve, in the same
  // resolved form it applied to its own pattern — so replaying it from the
  // scrambled state always reaches solved. Rebuilding the list from persisted
  // raw events instead loses the slice pairs the move buffer collapsed, the
  // rotations the capture drops, and the orientation remap, which is why that
  // reconstruction did not solve the cube and left segmentCfop with no cross.
  solutionTimeline(startedAt: number): SolutionMove[] {
    // Decide the clock from the SOURCE moves, never from the fitted output.
    // cubeTimestampLinearFit multiplies through a non-null assertion, and JS
    // coerces a null cubeTimestamp to 0 rather than to NaN, so a batch with no
    // hardware clock at all comes back as a column of valid-looking zeroes. A
    // null-check on the fitted value therefore never fires, and every move in the
    // solve lands on startedAt. This is the same either/or that
    // computeFinalDuration already makes for the total duration.
    const hasCubeClock = this.solutionMoves.some((raw) => raw.cubeTimestamp != null)
    const fitted = hasCubeClock ? cubeTimestampLinearFit(this.solutionMoves) : []
    return this.solutionMoves.map((raw, index) => {
      const cubeTimestamp = fitted[index]?.cubeTimestamp
      const offset = hasCubeClock && cubeTimestamp != null && Number.isFinite(cubeTimestamp)
        ? cubeTimestamp
        : this.firstLocalTimestamp != null && raw.localTimestamp != null
          ? raw.localTimestamp - this.firstLocalTimestamp
          : 0
      return { move: raw.move, timestamp: startedAt + offset }
    })
  }

  private computeFinalDuration(): number {
    if (this.solutionMoves.length === 0) {
      return 0
    }

    const fitted = cubeTimestampLinearFit(this.solutionMoves)
    const last = fitted.at(-1)
    if (last?.cubeTimestamp != null && Number.isFinite(last.cubeTimestamp) && last.cubeTimestamp > 0) {
      return last.cubeTimestamp
    }

    const lastLocalTimestamp = this.solutionMoves.at(-1)?.localTimestamp
    if (this.firstLocalTimestamp != null && lastLocalTimestamp != null) {
      return lastLocalTimestamp - this.firstLocalTimestamp
    }

    return 0
  }
}
