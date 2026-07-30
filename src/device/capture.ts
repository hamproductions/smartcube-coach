import { evaluateScramble, generateCorrection, nextExpectedMove } from '../domain/scramble'

export type CaptureStatus = 'idle' | 'scrambling' | 'ready' | 'inspection' | 'solving' | 'complete'

export type CaptureSnapshot = {
  status: CaptureStatus
  scramble: string
  scrambleMoves: string[]
  solveMoves: string[]
  expectedMove?: string
  wrongMove?: string
  correction: string
  inspectionStartedAt?: number
  startedAt?: number
  endedAt?: number
}

export type CompletedCapture = {
  scramble: string
  moves: string[]
  events: Array<{ move: string; timestamp: number }>
  startedAt: number
  endedAt: number
}

type ClockPoint = { cube: number; host: number }

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

export class CaptureSession {
  private state: CaptureSnapshot = {
    status: 'idle',
    scramble: '',
    scrambleMoves: [],
    solveMoves: [],
    correction: ''
  }

  private clockPoints: ClockPoint[] = []
  private solveEvents: Array<{ move: string; timestamp: number }> = []

  constructor(
    private readonly onComplete: (capture: CompletedCapture) => void | Promise<void>,
    private readonly onChange?: (snapshot: CaptureSnapshot) => void
  ) {}

  get snapshot(): CaptureSnapshot {
    return structuredClone(this.state)
  }

  async setScramble(scramble: string) {
    this.solveEvents = []
    this.state = {
      status: 'scrambling',
      scramble,
      scrambleMoves: [],
      solveMoves: [],
      correction: ''
    }
    this.emit()
  }

  beginInspection(timestamp = performance.now()) {
    if (this.state.status !== 'ready') throw new Error('Scramble is not verified')
    this.state.status = 'inspection'
    this.state.inspectionStartedAt = timestamp
    this.emit()
  }

  async handleMove(move: string, cubeTimestamp: number | null, hostTimestamp: number) {
    if (cubeTimestamp !== null) {
      this.clockPoints.push({ cube: cubeTimestamp, host: hostTimestamp })
      this.clockPoints = this.clockPoints.slice(-100)
    }
    const correctedTimestamp = cubeTimestamp === null ? hostTimestamp : fitCubeTimestamp(this.clockPoints)(cubeTimestamp)

    if (this.state.status === 'scrambling') {
      this.state.scrambleMoves.push(move)
      const progress = nextExpectedMove(this.state.scramble.split(/\s+/), this.state.scrambleMoves)
      this.state.expectedMove = progress.expected
      this.state.wrongMove = progress.actual
      const actual = this.state.scrambleMoves.join(' ')
      const verified = await evaluateScramble(this.state.scramble, actual)
      this.state.correction = verified ? '' : generateCorrection(this.state.scramble, actual)
      if (verified) {
        this.state.status = 'ready'
        this.state.expectedMove = undefined
        this.state.wrongMove = undefined
      }
      this.emit()
      return
    }

    if (this.state.status !== 'inspection' && this.state.status !== 'solving') return
    if (this.state.status === 'inspection') {
      this.state.status = 'solving'
      this.state.startedAt = correctedTimestamp
    }
    this.state.solveMoves.push(move)
    this.solveEvents.push({ move, timestamp: correctedTimestamp })

    if (await evaluateScramble('', `${this.state.scramble} ${this.state.solveMoves.join(' ')}`)) {
      this.state.status = 'complete'
      this.state.endedAt = correctedTimestamp
      await this.onComplete({
        scramble: this.state.scramble,
        moves: [...this.state.solveMoves],
        events: [...this.solveEvents],
        startedAt: this.state.startedAt ?? correctedTimestamp,
        endedAt: correctedTimestamp
      })
    }
    this.emit()
  }

  private emit() {
    this.onChange?.(this.snapshot)
  }
}
