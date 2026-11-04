import type { KPattern } from 'cubing/kpuzzle'
import { patternToPlayerAlg } from '../domain/cubedex/scramble'
import { evaluateScramble, followScrambleWithPrefixes, isSolvedPattern, nextExpectedMove, scramblePrefixStates } from '../domain/scramble'

export type CaptureStatus = 'idle' | 'scrambling' | 'ready' | 'inspection' | 'solving' | 'complete'

export type CaptureSnapshot = {
  status: CaptureStatus
  scramble: string
  scrambleMoves: string[]
  solveMoves: string[]
  expectedMove?: string
  wrongMove?: string
  /** True when the turns made no longer follow the scramble. */
  offTrack: boolean
  startAlg?: string
  /** The turns that undo the divergence, cancelled down. Empty while on track. */
  recovery?: string[]
  /** How many scramble moves are genuinely matched so far — the only honest progress. */
  matchedIndex?: number
  /** Off the scramble and the cube is back to solved, so the scramble should start over. */
  backToSolved?: boolean
  /** Off the scramble by more than a few turns, so undoing is no longer the quick way back. */
  recoveryUnreachable?: boolean
  /** Host time the scramble was verified; the gyro is re-zeroed here. */
  scrambledAt?: number
  inspectionStartedAt?: number
  inspectionPenalty?: 'none' | '+2' | 'dnf'
  startedAt?: number
  /** Wall-clock instant the solve began, for the live readout only. */
  startedAtWall?: number
  endedAt?: number
  evaluationUnsupported?: boolean
}

export type CompletedCapture = {
  scramble: string
  moves: string[]
  events: Array<{ move: string; timestamp: number }>
  startedAt: number
  endedAt: number
  penalty: 'none' | '+2' | 'dnf'
  gyro?: number[][]
  gyroReference?: number[]
  deviceName?: string
}

type ClockPoint = { cube: number; host: number }

export function inspectionPenalty(elapsedMs: number): 'none' | '+2' | 'dnf' {
  if (elapsedMs > 17_000) return 'dnf'
  if (elapsedMs > 15_000) return '+2'
  return 'none'
}

export function fitCubeTimestamp(points: ClockPoint[]) {
  if (points.length < 2) return (cube: number) => cube
  const meanCube = points.reduce((sum, point) => sum + point.cube, 0) / points.length
  const meanHost = points.reduce((sum, point) => sum + point.host, 0) / points.length
  const covariance = points.reduce((sum, point) => sum + (point.cube - meanCube) * (point.host - meanHost), 0)
  const variance = points.reduce((sum, point) => sum + (point.cube - meanCube) ** 2, 0)
  const slope = variance === 0 ? 1 : covariance / variance
  const intercept = meanHost - slope * meanCube
  return (cube: number) => Math.round(slope * cube + intercept)
}


const QUARTER_MOVES = ['U', "U'", 'U2', 'D', "D'", 'D2', 'L', "L'", 'L2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'B', "B'", 'B2']

/**
 * The shortest turns that take the cube from where it IS to where the scramble expects it.
 *
 * Stateless by construction: it depends only on the two cube states, never on how the solver
 * got there. Deriving it from the move history instead produced an instruction that grew
 * with every turn — a hundred moves listed to undo a single mistake — and gave two solvers
 * at the identical position different answers.
 *
 * Breadth-first to depth three, which covers the overwhelmingly common case of one or two
 * mis-turns. Beyond that the caller falls back to the full route to the scrambled state.
 */
function shortestFix(from: KPattern, to: KPattern): string[] | undefined {
  if (from.isIdentical(to)) return []
  let frontier: Array<{ pattern: KPattern; moves: string[] }> = [{ pattern: from, moves: [] }]
  for (let depth = 0; depth < 3; depth += 1) {
    const next: Array<{ pattern: KPattern; moves: string[] }> = []
    for (const node of frontier) {
      for (const move of QUARTER_MOVES) {
        // Never turn the same face twice in a row; it is always expressible in one turn.
        if (node.moves.length && node.moves[node.moves.length - 1][0] === move[0]) continue
        const pattern = node.pattern.applyMove(move)
        const moves = [...node.moves, move]
        if (pattern.isIdentical(to)) return moves
        next.push({ pattern, moves })
      }
    }
    frontier = next
  }
  return undefined
}

function safePlayerAlg(pattern: KPattern) {
  try {
    return patternToPlayerAlg(pattern)
  } catch {
    return undefined
  }
}

export class CaptureSession {
  private state: CaptureSnapshot = {
    status: 'idle',
    scramble: '',
    scrambleMoves: [],
    solveMoves: [],
    offTrack: false
  }

  private solveEvents: Array<{ move: string; timestamp: number }> = []
  private generation = 0
  /**
   * The cube states the scramble passes through, built once when the scramble is set. Every
   * turn is then judged with plain comparisons and no await, which is what keeps a scramble
   * arriving in parallel from invalidating the move being processed.
   */
  private prefixes?: KPattern[]
  private start?: KPattern
  private gyro: number[][] = []
  private gyroReference?: number[]
  private lastGyro?: { quaternion: { x: number; y: number; z: number; w: number }; at: number }
  private recordScramble = ''
  /**
   * Turns that arrived while the solve was completing. A solver puts the cube down for a
   * fraction of a second, not at all — they are already turning the next scramble while the
   * app is still finishing with the last solve. Those turns used to hit a session in
   * 'complete' and be discarded, and from then on the app disagreed with the cube.
   */
  private pendingMoves: Array<{ move: string; cubeTimestamp: number | null; hostTimestamp: number }> = []
  constructor(
    private readonly onComplete: (capture: CompletedCapture) => void | Promise<void>,
    private readonly onChange?: (snapshot: CaptureSnapshot) => void
  ) {}

  get snapshot(): CaptureSnapshot {
    return structuredClone(this.state)
  }

  async setScramble(scramble: string, from?: { pattern: KPattern; route: string }) {
    this.generation += 1
    const generation = this.generation
    this.solveEvents = []
    this.prefixes = undefined
    this.start = from?.pattern
    this.gyro = []
    this.gyroReference = undefined
    this.recordScramble = scramble
    this.state = {
      status: 'scrambling',
      scramble: from?.route ?? scramble,
      startAlg: from ? safePlayerAlg(from.pattern) : undefined,
      scrambleMoves: [],
      solveMoves: [],
      offTrack: false
    }
    this.emit()
    try {
      const prefixes = await scramblePrefixStates(this.state.scramble.split(/\s+/).filter(Boolean), this.start)
      if (generation === this.generation) this.prefixes = prefixes
    } catch {
      // Without them every turn falls back to the move-list check below.
    }
    // Turns made while the last solve was being recorded belong to this scramble.
    const pending = this.pendingMoves
    this.pendingMoves = []
    for (const entry of pending) {
      if (generation !== this.generation) return
      await this.handleMove(entry.move, entry.cubeTimestamp, entry.hostTimestamp)
    }
  }

  reset() {
    this.generation += 1
    this.solveEvents = []
    this.start = undefined
    this.recordScramble = ''
    // Reset declares the cube solved and starts over, so turns held from before it are not
    // part of anything any more.
    this.pendingMoves = []
    this.state = {
      status: 'idle',
      scramble: '',
      scrambleMoves: [],
      solveMoves: [],
      offTrack: false
    }
    this.emit()
  }

  recordGyro(quaternion: { x: number; y: number; z: number; w: number }, at: number) {
    this.lastGyro = { quaternion, at }
    if (!this.gyroReference && (this.state.status === 'ready' || this.state.status === 'inspection')) this.markGyroReference()
    if (this.state.status !== 'solving' || this.state.startedAt === undefined) return
    const offset = Math.round(at - this.state.startedAt)
    const previous = this.gyro[this.gyro.length - 1]
    if (offset < 0 || (previous && offset - previous[0] < 40) || this.gyro.length >= 6000) return
    this.gyro.push([offset, quaternion.x, quaternion.y, quaternion.z, quaternion.w])
  }

  private markGyroReference() {
    const quaternion = this.lastGyro?.quaternion
    this.gyroReference = quaternion ? [quaternion.x, quaternion.y, quaternion.z, quaternion.w] : undefined
  }

  invalidate() {
    this.generation += 1
  }

  acceptCurrentState(setupAlg: string) {
    // Bump the generation: a scrambling evaluation already awaiting its result would
    // otherwise resume and write its own status/moves over the acceptance, putting the
    // session straight back into 'scrambling'.
    this.generation += 1
    this.start = undefined
    this.recordScramble = setupAlg
    this.state.scramble = setupAlg
    this.state.scrambleMoves = setupAlg.split(/\s+/).filter(Boolean)
    this.state.status = 'ready'
    this.state.expectedMove = undefined
    this.state.wrongMove = undefined
    this.state.offTrack = false
    this.state.matchedIndex = this.state.scrambleMoves.length
    this.state.scrambledAt = performance.now()
    this.markGyroReference()
    this.emit()
  }

  beginInspection(timestamp = performance.now()) {
    if (this.state.status !== 'ready') throw new Error('Scramble is not verified')
    this.state.status = 'inspection'
    this.state.inspectionStartedAt = timestamp
    this.emit()
  }

  /**
   * Where the app's own cube state sits on the scramble. Synchronous by design — see the
   * `prefixes` field.
   */
  private followScramble(targetMoves: string[]) {
    const prefixes = this.prefixes
    if (!prefixes || prefixes.length !== targetMoves.length + 1) return undefined
    try {
      const turned = this.state.scrambleMoves.filter((move) => !/^[xyz]/i.test(move)).join(' ')
      const current = turned.trim() ? prefixes[0].applyAlg(turned) : prefixes[0]
      return followScrambleWithPrefixes(current, prefixes, targetMoves)
    } catch {
      return undefined
    }
  }

  /** Where the cube should be if the matched part of the scramble had been performed. */
  private async fixToMatchedPoint(targetMoves: string[], matchedIndex: number) {
    try {
      const { puzzles } = await import('cubing/puzzles')
      const { Alg } = await import('cubing/alg')
      const kpuzzle = await puzzles['3x3x3'].kpuzzle()
      const base = this.start ?? kpuzzle.defaultPattern()
      const turned = this.state.scrambleMoves.join(' ')
      const current = turned.trim() ? base.applyAlg(Alg.fromString(turned)) : base
      const wanted = matchedIndex > 0
        ? base.applyAlg(Alg.fromString(targetMoves.slice(0, matchedIndex).join(' ')))
        : base
      return { fix: shortestFix(current, wanted), solved: await isSolvedPattern(current) }
    } catch {
      return undefined
    }
  }

  async handleMove(move: string, cubeTimestamp: number | null, hostTimestamp: number) {
    const generation = this.generation

    if (this.state.status === 'scrambling') {
      this.state.scrambleMoves.push(move)
      const progress = nextExpectedMove(this.state.scramble.split(/\s+/), this.state.scrambleMoves)
      this.state.expectedMove = progress.expected
      this.state.wrongMove = progress.actual

      const actual = this.state.scrambleMoves.join(' ')
      let verified: boolean
      try {
        verified = await evaluateScramble(this.state.scramble, actual)
      } catch {
        if (generation !== this.generation) return
        this.state.evaluationUnsupported = true
        this.emit()
        return
      }
      if (generation !== this.generation) return
      this.state.evaluationUnsupported = false
      // Progress and divergence are re-derived from the app's OWN cube state on every move —
      // the state it maintains by applying the moves it received, which is the project's
      // settled reference (docs/research/gyst-2026-08-04-state-and-verification.md).
      //
      // The walk this replaces returned at the first wrong face and never looked again, so a
      // single stray or duplicated packet marked the solver off track for the rest of the
      // scramble and every correct turn after it read as a mistake. Asking where the cube IS
      // has no memory of how it got there: undo the mistake and the position matches a prefix
      // again, so the app agrees with the solver the moment they are right.
      const targetMoves = this.state.scramble.split(/\s+/).filter(Boolean)
      const follow = this.followScramble(targetMoves)
      // Keep the furthest point genuinely reached: that is what the way back aims at, and it
      // must not collapse to zero just because the cube is momentarily off the path.
      if (follow?.matched !== undefined) this.state.matchedIndex = Math.min(follow.matched, targetMoves.length)
      this.state.matchedIndex ??= 0
      this.state.offTrack = !verified && !(follow?.onTrack ?? false)
      // The way back is the inverse of what was turned since the last matched move,
      // simplified so it cancels. This is exact — it literally undoes the divergence — and
      // for one wrong turn it is one move, where routing through a solver to the fully
      // scrambled state returned most of the scramble again.
      // Computed from the two cube states, never from the move history — same position, same
      // instruction, however the solver got there.
      const divergence = this.state.offTrack
        ? await this.fixToMatchedPoint(targetMoves, this.state.matchedIndex)
        : { fix: [], solved: false }
      // Re-check after that await, as after every other one here: a reset or a new scramble
      // in flight replaces this.state, and writing the old scramble's recovery onto the new
      // state showed an undo hint for a scramble the solver had not started.
      if (generation !== this.generation) return
      this.state.recovery = divergence?.fix
      this.state.backToSolved = this.state.offTrack && (divergence?.solved ?? false)
      this.state.recoveryUnreachable = this.state.offTrack && divergence !== undefined && divergence.fix === undefined
      if (verified) {
        this.state.status = 'ready'
        this.state.scrambledAt = hostTimestamp
        this.markGyroReference()
        this.state.expectedMove = undefined
        this.state.wrongMove = undefined
      }
      this.emit()
      return
    }

    // Between the solve finishing and the next scramble being armed the solver is already
    // turning. Hold those turns instead of discarding them; `setScramble` replays them.
    if (this.state.status === 'complete') {
      this.pendingMoves.push({ move, cubeTimestamp, hostTimestamp })
      return
    }
    if (!['ready', 'inspection', 'solving'].includes(this.state.status)) return
    if (this.state.status === 'ready' || this.state.status === 'inspection') {
      if (this.state.status === 'ready') this.state.inspectionStartedAt = hostTimestamp
      this.state.inspectionPenalty = inspectionPenalty(hostTimestamp - (this.state.inspectionStartedAt ?? hostTimestamp))
      this.state.status = 'solving'
      this.state.startedAt = hostTimestamp
      this.gyro = this.lastGyro ? [[0, this.lastGyro.quaternion.x, this.lastGyro.quaternion.y, this.lastGyro.quaternion.z, this.lastGyro.quaternion.w]] : []
      // The cube's clock is monotonic, so a running readout must not be measured against
      // Date.now() — that subtraction printed a raw epoch in the timer. This is the same
      // instant on the wall clock, for display only; the recorded duration still comes from
      // the cube's own timestamps.
      this.state.startedAtWall = Date.now()
    }
    this.state.solveMoves.push(move)
    this.solveEvents.push({ move, timestamp: hostTimestamp })

    let complete: boolean
    try {
      const performed = `${this.state.scramble} ${this.state.solveMoves.join(' ')}`
      complete = this.start ? await isSolvedPattern(this.start.applyAlg(performed)) : await evaluateScramble('', performed)
    } catch {
      if (generation !== this.generation) return
      this.state.evaluationUnsupported = true
      this.emit()
      return
    }
    if (generation !== this.generation) return
    this.state.evaluationUnsupported = false
    if (complete) {
      this.state.status = 'complete'
      this.state.endedAt = hostTimestamp
      // Emit BEFORE the completion side effects. onComplete records the solve and issues the
      // next scramble, and that setScramble replaces this.state and bumps the generation —
      // so the emit that used to follow was skipped and no subscriber ever saw 'complete'.
      // The hero jumped from the running clock straight to 0.00, never showing the time.
      this.emit()
      await this.onComplete({
        scramble: this.recordScramble || this.state.scramble,
        moves: [...this.state.solveMoves],
        events: [...this.solveEvents],
        startedAt: this.state.startedAt ?? hostTimestamp,
        endedAt: hostTimestamp,
        penalty: this.state.inspectionPenalty ?? 'none',
        gyro: this.gyro.length > 1 ? [...this.gyro] : undefined,
        gyroReference: this.gyroReference
      })
      if (generation !== this.generation) return
    }
    this.emit()
  }

  private emit() {
    this.onChange?.(this.snapshot)
  }
}
