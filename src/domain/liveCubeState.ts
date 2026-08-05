import { applyFaceletMoves, isSolvedFacelets, setupAlgFromFacelets, solvedFacelets } from './faceletReconciliation'

export type LiveCubeOrigin = 'unknown' | 'cube' | 'user' | 'move'

export type LiveCubeSnapshot = {
  facelets: string
  setupAlg: string
  solved: boolean
  known: boolean
  origin: LiveCubeOrigin
  pendingMoves: string[]
  lastDisagreement?: { expected: string; actual: string; afterMoves: string[] }
}

const invert = (moves: string[]) => [...moves].reverse().map((move) => move.endsWith('2') ? move : move.endsWith("'") ? move.slice(0, -1) : `${move}'`)

const empty: LiveCubeSnapshot = {
  facelets: '',
  setupAlg: '',
  solved: false,
  known: false,
  origin: 'unknown',
  pendingMoves: []
}

export class LiveCubeState {
  private state: LiveCubeSnapshot = { ...empty }
  private moveLog: string[] = []
  private reference?: string
  private awaitingReference = false
  private movesSinceReference: string[] = []

  get snapshot(): LiveCubeSnapshot {
    return { ...this.state, pendingMoves: [...this.state.pendingMoves] }
  }

  reset() {
    this.state = { ...empty }
    this.moveLog = []
    this.reference = undefined
    this.awaitingReference = false
    this.movesSinceReference = []
    return this.snapshot
  }

  markSolved(cubeReportedFacelets?: string) {
    const usable = cubeReportedFacelets && cubeReportedFacelets.length === 54 ? cubeReportedFacelets : undefined
    this.reference = usable
    this.awaitingReference = !usable
    this.movesSinceReference = []
    this.state = {
      facelets: solvedFacelets,
      setupAlg: '',
      solved: true,
      known: true,
      origin: 'user',
      pendingMoves: []
    }
    this.moveLog = []
    return this.snapshot
  }

  applyMove(move: string) {
    this.moveLog.push(move)
    if (this.reference || this.awaitingReference) this.movesSinceReference.push(move)
    if (!this.state.known) {
      this.state = { ...this.state, pendingMoves: [...this.state.pendingMoves, move] }
      return this.snapshot
    }
    try {
      const facelets = applyFaceletMoves(this.state.facelets, [move])
      this.state = {
        ...this.state,
        facelets,
        setupAlg: this.state.setupAlg ? `${this.state.setupAlg} ${move}` : move,
        solved: isSolvedFacelets(facelets),
        origin: 'move',
        pendingMoves: []
      }
    } catch {
      this.state = { ...this.state, known: false, pendingMoves: [...this.state.pendingMoves, move] }
    }
    return this.snapshot
  }

  /**
   * Full reset, matching the reference contract: trust the reported absolute state,
   * discard every accumulated move and rotation-offset assumption, no diff, no merge,
   * no warning. Unlike `adopt`, this never runs the reading through the reference-relative
   * reconstruction — it cannot make divergence worse because it keeps nothing from before.
   */
  resync(facelets: string): LiveCubeSnapshot {
    if (facelets.length !== 54) return this.snapshot
    this.reference = undefined
    this.awaitingReference = false
    this.movesSinceReference = []
    this.moveLog = []
    this.state = {
      facelets,
      setupAlg: '',
      solved: isSolvedFacelets(facelets),
      known: true,
      origin: 'cube',
      pendingMoves: []
    }
    return this.snapshot
  }

  adopt(facelets: string, options: { origin?: LiveCubeOrigin } = {}) {
    if (facelets.length !== 54) return this.snapshot
    if (this.awaitingReference) {
      try {
        this.reference = applyFaceletMoves(facelets, invert(this.movesSinceReference))
      } catch {
        this.reference = facelets
      }
      this.awaitingReference = false
      return this.adoptRelative(facelets)
    }
    if (this.reference) return this.adoptRelative(facelets)
    const expected = this.state.known ? this.state.facelets : undefined
    const disagreed = expected !== undefined && expected !== facelets
    this.state = {
      facelets,
      setupAlg: this.state.setupAlg,
      solved: isSolvedFacelets(facelets),
      known: true,
      origin: options.origin ?? 'cube',
      pendingMoves: [],
      lastDisagreement: disagreed
        ? { expected: expected as string, actual: facelets, afterMoves: [...this.moveLog] }
        : this.state.lastDisagreement
    }
    this.moveLog = []
    return this.snapshot
  }

  private adoptRelative(facelets: string) {
    const moves = [...this.movesSinceReference]
    let expected: string
    let ourFacelets: string
    try {
      expected = applyFaceletMoves(this.reference as string, moves)
      ourFacelets = applyFaceletMoves(solvedFacelets, moves)
    } catch {
      return this.snapshot
    }
    const agrees = expected === facelets
    this.state = {
      ...this.state,
      facelets: ourFacelets,
      solved: isSolvedFacelets(ourFacelets),
      known: true,
      origin: 'user',
      pendingMoves: [],
      lastDisagreement: agrees
        ? this.state.lastDisagreement
        : { expected, actual: facelets, afterMoves: moves }
    }
    return this.snapshot
  }

  async resolveSetupAlg() {
    if (!this.state.known) return this.state.setupAlg
    const setupAlg = await setupAlgFromFacelets(this.state.facelets)
    this.state = { ...this.state, setupAlg: setupAlg ?? '' }
    return this.state.setupAlg
  }
}
