// Ported from Dave2ooo/F2LTrainer (https://github.com/Dave2ooo/F2LTrainer)
// Sources:
//   src/lib/components/TrainView/TrainDrill.svelte   (drill state machine, timings, give-up/redo/resume)
//   src/lib/utils/checkF2LState.ts                   (state-predicate completion, F2L slot indices)
//   src/lib/utils/moveValidator.ts                   (isUMove — recognition boundary)
//   src/lib/utils/hintManager.svelte.ts               (hint ladder: step / allAtOnce / always / hidden)
//   src/lib/trainCaseQueue.svelte.ts                  (queue runoff regeneration, history navigation)
//
// Adapted from Svelte 5 runes ($state, $effect) and inline async/await UI handlers to a
// framework-agnostic class with injectable clock/delay so the exact same phases, transitions
// and timings can be driven from this app's React components without a Svelte runtime.
// States, transition conditions and every constant timing value are unchanged.

import type { KPattern } from 'cubing/kpuzzle'
import { Alg } from 'cubing/alg'
import type { KPuzzle } from 'cubing/kpuzzle'

export type DrillPhase = 'stopped' | 'countdown' | 'solving' | 'executing' | 'transitioning' | 'gave_up'

export interface DrillTiming {
  countdownSteps: readonly number[]
  countdownStepMs: number
  transitionMs: number
}

export const DEFAULT_DRILL_TIMING: DrillTiming = {
  countdownSteps: [3, 2, 1],
  countdownStepMs: 500,
  transitionMs: 1000
}

// --- Recognition boundary -------------------------------------------------
// AUF (U, U', U2) counts as recognition by design: users often adjust the
// up-face while still reading the case, so the clock only leaves recognition
// on the first move that is not a U-layer turn.
export function isUMove(move: string): boolean {
  const baseFace = move.replace(/['2]/g, '')
  return baseFace === 'U'
}

// --- State-predicate completion (never move-identity) ---------------------
// A case is finished when the cube reaches the target state: a solver using a
// different-but-valid solution still counts.

export type DrillSlot = 'fr' | 'fl' | 'br' | 'bl'
export type DrillSide = 'right' | 'left'

const F2L_SLOTS: Record<DrillSlot, { edge: number; corner: number }> = {
  fr: { edge: 8, corner: 4 },
  fl: { edge: 9, corner: 5 },
  br: { edge: 10, corner: 7 },
  bl: { edge: 11, corner: 6 }
}

const CROSS_EDGES = [4, 5, 6, 7] as const

function mirrorSlot(slot: DrillSlot): DrillSlot {
  const mirrorMap: Record<DrillSlot, DrillSlot> = { fr: 'fl', fl: 'fr', br: 'bl', bl: 'br' }
  return mirrorMap[slot]
}

function isSlotSolved(
  corners: { pieces: number[]; orientation: number[] },
  edges: { pieces: number[]; orientation: number[] },
  slot: DrillSlot
): boolean {
  const { edge, corner } = F2L_SLOTS[slot]
  return (
    corners.pieces[corner] === corner &&
    corners.orientation[corner] === 0 &&
    edges.pieces[edge] === edge &&
    edges.orientation[edge] === 0
  )
}

function isCrossSolved(edges: { pieces: number[]; orientation: number[] }): boolean {
  return CROSS_EDGES.every((edgePos) => edges.pieces[edgePos] === edgePos && edges.orientation[edgePos] === 0)
}

export function isF2LSolved(
  corners: { pieces: number[]; orientation: number[] },
  edges: { pieces: number[]; orientation: number[] },
  slotToExclude: DrillSlot | undefined,
  side: DrillSide = 'right'
): boolean {
  if (!isCrossSolved(edges)) return false

  const excluded = slotToExclude && side === 'left' ? mirrorSlot(slotToExclude) : slotToExclude

  const slotsToCheck: DrillSlot[] = ['fr', 'fl', 'br', 'bl']
  for (const slot of slotsToCheck) {
    if (slot === excluded) continue
    if (!isSlotSolved(corners, edges, slot)) return false
  }
  return true
}

function isCubeSolved(pattern: KPattern): boolean {
  return (
    pattern.patternData.CORNERS.pieces.every((value, index) => value === index) &&
    pattern.patternData.CORNERS.orientation.every((value) => value === 0) &&
    pattern.patternData.EDGES.pieces.every((value, index) => value === index) &&
    pattern.patternData.EDGES.orientation.every((value) => value === 0)
  )
}

export interface F2LState {
  f2lSolved: boolean
  entireF2LSolved: boolean
  cubeSolved: boolean
}

// Checks the current F2L state from a scramble + performed alg, exactly like
// the upstream checkF2LState: normalized pattern ignores setup rotation, and
// callbacks fire on the resulting booleans, never on move identity.
export function checkF2LState(
  puzzle: KPuzzle,
  scramble: string,
  alg: string,
  slotToExclude?: DrillSlot,
  side: DrillSide = 'right',
  onF2LSolved?: (entireF2LSolved: boolean) => void,
  onCubeSolved?: () => void
): F2LState {
  const pattern = puzzle.defaultPattern().applyAlg(new Alg(`${scramble} ${alg}`))

  const f2lSolved = isF2LSolved(pattern.patternData.CORNERS, pattern.patternData.EDGES, slotToExclude, side)
  const entireF2LSolved = slotToExclude
    ? isF2LSolved(pattern.patternData.CORNERS, pattern.patternData.EDGES, undefined, side)
    : f2lSolved
  const cubeSolved = isCubeSolved(pattern)

  if (f2lSolved) onF2LSolved?.(entireF2LSolved)
  if (cubeSolved) onCubeSolved?.()

  return { f2lSolved, entireF2LSolved, cubeSolved }
}

// --- Hint ladder ------------------------------------------------------------
// step: reveal one move at a time. allAtOnce: blurred/hidden until the first
// move, then all moves show. always: visible the whole time. hidden: no
// algorithm validation and no display at all.
export type HintMode = 'step' | 'allAtOnce' | 'always' | 'hidden'

export interface HintState {
  counter: number
  showAlgViewer: boolean
  showHintButton: boolean
}

export class HintManager {
  private state: HintState = { counter: -1, showAlgViewer: false, showHintButton: false }

  get counter(): number {
    return this.state.counter
  }

  get showAlgViewer(): boolean {
    return this.state.showAlgViewer
  }

  get showHintButton(): boolean {
    return this.state.showHintButton
  }

  reset(): void {
    this.state.counter = -1
    this.state.showAlgViewer = false
    this.state.showHintButton = false
  }

  initialize(hintMode: HintMode, twistyAlgViewerLoaded: boolean, algViewerContainer?: HTMLElement): void {
    const algViewerElement = algViewerContainer?.querySelector('twisty-alg-viewer')
    const algMoveElements = algViewerElement?.querySelectorAll('.twisty-alg-move')

    if (twistyAlgViewerLoaded && algMoveElements) {
      if (hintMode === 'always') {
        algMoveElements.forEach((element) => {
          ;(element as HTMLElement).style.visibility = 'visible'
        })
        this.state.showAlgViewer = true
        this.state.showHintButton = false
      } else {
        algMoveElements.forEach((element) => {
          ;(element as HTMLElement).style.visibility = 'hidden'
        })
        this.state.showAlgViewer = false
        this.state.showHintButton = true
      }
    } else {
      this.state.showAlgViewer = false
      this.state.showHintButton = true
    }
  }

  revealHint(hintMode: HintMode, alg: string, twistyAlgViewerLoaded: boolean, algViewerContainer?: HTMLElement): void {
    const algViewerElement = algViewerContainer?.querySelector('twisty-alg-viewer')
    const algMoveElements = algViewerElement?.querySelectorAll('.twisty-alg-move')

    if (this.state.counter === -1) {
      this.state.counter = 0
    }

    if (hintMode === 'always') return

    const algList = alg.split(' ').filter((move) => move.trim() !== '')

    if (twistyAlgViewerLoaded && algMoveElements) {
      this.state.showAlgViewer = true
      this.state.showHintButton = false

      if (hintMode === 'step') {
        if (this.state.counter === 0) {
          algMoveElements.forEach((element) => {
            ;(element as HTMLElement).style.visibility = 'hidden'
          })
        }

        const maxViewerMoves = algMoveElements.length
        const maxMoves = Math.max(algList.length, maxViewerMoves)
        if (this.state.counter < maxMoves && algMoveElements[this.state.counter]) {
          ;(algMoveElements[this.state.counter] as HTMLElement).style.visibility = 'visible'
          this.state.counter++
        }
      } else if (hintMode === 'allAtOnce') {
        algMoveElements.forEach((element) => {
          ;(element as HTMLElement).style.visibility = 'visible'
        })
        this.state.counter++
      }
    } else {
      this.state.showAlgViewer = false
      this.state.showHintButton = true
      this.state.counter++
    }
  }

  getDisplayedAlgorithm(hintMode: HintMode, alg: string): string {
    if (hintMode === 'always') return alg
    if (this.state.counter === -1) return ''
    if (hintMode === 'allAtOnce') return alg
    if (hintMode === 'step') {
      const algList = alg.split(' ').filter((move) => move.trim() !== '')
      return algList.slice(0, this.state.counter).join(' ')
    }
    return ''
  }

  shouldShowPlaceholder(hintMode: HintMode): boolean {
    return this.state.counter === -1 && hintMode !== 'always'
  }
}

export function createHintManager(): HintManager {
  return new HintManager()
}

// isAlgorithmValidationActive mirrors TrainClassicSmart.svelte's guard: the
// 'hidden' hint mode (and a manual hint behavior) turns off algorithm
// validation entirely — a solver is only ever judged by the state predicate.
export function isAlgorithmValidationActive(hintMode: HintMode, hintBehavior: 'auto' | 'manual' = 'auto'): boolean {
  return hintMode !== 'hidden' && hintBehavior !== 'manual'
}

// --- Queue and history ------------------------------------------------------
// Regenerates a batch on index runoff; clamps at the end if generation yields
// nothing so the queue never goes out of bounds.
export interface DrillQueueState<TCase> {
  queue: TCase[]
  index: number
}

export function advanceQueueIndex<TCase>(state: DrillQueueState<TCase>, regenerateBatch: () => TCase[]): DrillQueueState<TCase> {
  const next = state.index + 1
  if (next >= state.queue.length) {
    const generated = regenerateBatch()
    if (generated.length > 0) {
      return { queue: [...state.queue, ...generated], index: next }
    }
    return { queue: state.queue, index: Math.max(0, state.queue.length - 1) }
  }
  return { queue: state.queue, index: next }
}

// The "active edge" is the last unsolved case in the queue — jumping here
// (e.g. on Resume from history) must not land back on an already-skipped case.
export function findActiveEdgeIndex<TCase>(queue: TCase[], isSolved: (trainCase: TCase) => boolean): number {
  for (let index = queue.length - 1; index >= 0; index--) {
    if (!isSolved(queue[index])) return index
  }
  return -1
}

// History navigation rebuilds a case from the stored solve rather than
// replaying moves — the caller supplies the solve -> case reconstruction
// (this app's own solve/case shapes are owned elsewhere).
export function rebuildCaseFromSolve<TSolve, TCase>(solve: TSolve, fromSolve: (solve: TSolve) => TCase): TCase {
  return fromSolve(solve)
}

// --- Drill loop state machine -----------------------------------------------
// stopped -> countdown (3x500ms) -> solving -> [first non-U move] -> executing
//   -> [state predicate satisfied] -> transitioning (1s) -> solving (next case, no countdown)
// gave_up -> redo -> countdown -> solving
// gave_up -> resume -> countdown -> solving (next case, or jump to active edge if history)
export interface DrillEngineHooks<TCase> {
  getNextCase: () => TCase | undefined
  getFirstUnsolvedCase: () => TCase | undefined
  onCaseChanged: (trainCase: TCase | undefined) => void
  onPhaseChanged?: (phase: DrillPhase, countdownNumber: number) => void
  onSolveRecorded?: (recognitionMs: number, executionMs: number) => void
  now?: () => number
  delay?: (ms: number) => Promise<void>
  timing?: DrillTiming
}

const defaultDelay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export class DrillEngine<TCase> {
  phase: DrillPhase = 'stopped'
  countdownNumber = 3
  recognitionMs: number | undefined
  executionMs: number | undefined

  private recognitionStartedAt = 0
  private executionStartedAt = 0
  private readonly timing: DrillTiming

  constructor(private readonly hooks: DrillEngineHooks<TCase>) {
    this.timing = hooks.timing ?? DEFAULT_DRILL_TIMING
  }

  private now(): number {
    return this.hooks.now ? this.hooks.now() : Date.now()
  }

  private delay(ms: number): Promise<void> {
    return this.hooks.delay ? this.hooks.delay(ms) : defaultDelay(ms)
  }

  private setPhase(phase: DrillPhase): void {
    this.phase = phase
    this.hooks.onPhaseChanged?.(this.phase, this.countdownNumber)
  }

  private async runCountdown(): Promise<void> {
    this.phase = 'countdown'
    for (const step of this.timing.countdownSteps) {
      this.countdownNumber = step
      this.hooks.onPhaseChanged?.(this.phase, this.countdownNumber)
      await this.delay(this.timing.countdownStepMs)
    }
  }

  private beginSolving(): void {
    this.setPhase('solving')
    this.recognitionStartedAt = this.now()
    this.recognitionMs = undefined
    this.executionMs = undefined
  }

  private async goToNextCase(withCountdown: boolean, jumpToActiveEdge: boolean): Promise<void> {
    const nextCase = jumpToActiveEdge ? this.hooks.getFirstUnsolvedCase() : this.hooks.getNextCase()
    this.hooks.onCaseChanged(nextCase)

    if (withCountdown) await this.runCountdown()
    this.beginSolving()
  }

  // Start the drill from stopped: countdown, then solving.
  async startDrill(): Promise<void> {
    await this.runCountdown()
    this.beginSolving()
  }

  // Incoming move from the input source. Ignored while stopped, counting
  // down, or transitioning between cases (faithful to the real component:
  // moves ARE still applied while 'gave_up', they just cannot complete a
  // case — see notifySolved).
  handleMove(move: string): void {
    const trimmed = move.trim()
    if (!trimmed) return
    if (this.phase === 'stopped' || this.phase === 'countdown' || this.phase === 'transitioning') return

    if (this.phase === 'solving' && !isUMove(trimmed)) {
      this.recognitionMs = this.now() - this.recognitionStartedAt
      this.executionStartedAt = this.now()
      this.setPhase('executing')
    }
  }

  // Called when the state predicate (checkF2LState) reports the case solved.
  // No-op outside 'solving'/'executing' — most notably while 'gave_up'.
  async notifySolved(): Promise<void> {
    const startingPhase: DrillPhase = this.phase
    if (startingPhase !== 'executing' && startingPhase !== 'solving') return

    const now = this.now()
    const executionMs = startingPhase === 'executing' ? now - this.executionStartedAt : 0
    const recognitionMs = this.recognitionMs ?? now - this.recognitionStartedAt
    this.recognitionMs = recognitionMs
    this.executionMs = executionMs
    this.hooks.onSolveRecorded?.(recognitionMs, executionMs)

    this.setPhase('transitioning')
    await this.delay(this.timing.transitionMs)

    // If the drill was stopped during the transition delay, don't advance.
    if (this.phase !== 'transitioning') return
    await this.goToNextCase(false, false)
  }

  giveUp(): void {
    this.setPhase('gave_up')
  }

  async redo(): Promise<void> {
    await this.runCountdown()
    this.beginSolving()
  }

  async resume(isHistoryCase: boolean): Promise<void> {
    await this.goToNextCase(true, isHistoryCase)
  }

  async skip(): Promise<void> {
    await this.goToNextCase(true, false)
  }

  stop(): void {
    this.setPhase('stopped')
  }
}
