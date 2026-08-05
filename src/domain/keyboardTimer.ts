import { inspectionPenalty } from '../device/capture'

export type KeyboardTimerPhase =
  | 'idle'
  | 'holding'
  | 'armed'
  | 'inspection'
  | 'inspectionHolding'
  | 'inspectionArmed'
  | 'running'
  | 'stopped'

export type KeyboardTimerState = {
  phase: KeyboardTimerPhase
  holdStartedAt?: number
  inspectionStartedAt?: number
  startedAt?: number
  stoppedAt?: number
  lastStoppedAt?: number
  penalty?: 'none' | '+2' | 'dnf'
}

export const ARM_HOLD_MS = 300
export const STOP_GUARD_MS = 500
export const MIN_KEYBOARD_SOLVE_MS = 1_000

export const idleKeyboardTimerState: KeyboardTimerState = { phase: 'idle' }

export function isWithinStopGuard(state: KeyboardTimerState, now: number): boolean {
  return state.lastStoppedAt !== undefined && now - state.lastStoppedAt < STOP_GUARD_MS
}

export function handleSpaceDown(state: KeyboardTimerState, now: number): KeyboardTimerState {
  if (state.phase === 'idle' || state.phase === 'stopped') {
    if (isWithinStopGuard(state, now)) return state
    return { phase: 'holding', holdStartedAt: now, lastStoppedAt: state.lastStoppedAt }
  }
  if (state.phase === 'inspection') return { ...state, phase: 'inspectionHolding', holdStartedAt: now }
  return state
}

export function handleArmTimeout(state: KeyboardTimerState, now: number): KeyboardTimerState {
  if (state.phase === 'holding' && state.holdStartedAt !== undefined && now - state.holdStartedAt >= ARM_HOLD_MS) {
    return { ...state, phase: 'armed' }
  }
  if (state.phase === 'inspectionHolding' && state.holdStartedAt !== undefined && now - state.holdStartedAt >= ARM_HOLD_MS) {
    return { ...state, phase: 'inspectionArmed' }
  }
  return state
}

export function handleSpaceUp(state: KeyboardTimerState, now: number, useInspection: boolean): KeyboardTimerState {
  if (state.phase === 'holding') return { phase: 'idle', lastStoppedAt: state.lastStoppedAt }
  if (state.phase === 'armed') {
    return useInspection ? { phase: 'inspection', inspectionStartedAt: now } : { phase: 'running', startedAt: now }
  }
  if (state.phase === 'inspectionHolding') return { phase: 'inspection', inspectionStartedAt: state.inspectionStartedAt }
  if (state.phase === 'inspectionArmed') {
    const penalty = inspectionPenalty(now - (state.inspectionStartedAt ?? now))
    return { phase: 'running', startedAt: now, inspectionStartedAt: state.inspectionStartedAt, penalty }
  }
  return state
}

export function handleStopKey(state: KeyboardTimerState, now: number): KeyboardTimerState {
  if (state.phase !== 'running') return state
  return { ...state, phase: 'stopped', stoppedAt: now, lastStoppedAt: now }
}

export function handleEscape(state: KeyboardTimerState): KeyboardTimerState {
  return { phase: 'idle', lastStoppedAt: state.lastStoppedAt }
}

export function resetKeyboardTimer(): KeyboardTimerState {
  return idleKeyboardTimerState
}

export function keyboardTimerElapsedMs(state: KeyboardTimerState, now: number): number {
  if (state.phase === 'running' && state.startedAt !== undefined) return now - state.startedAt
  if (state.phase === 'stopped' && state.startedAt !== undefined && state.stoppedAt !== undefined) return state.stoppedAt - state.startedAt
  return 0
}

export function keyboardInspectionElapsedMs(state: KeyboardTimerState, now: number): number {
  const inInspection = state.phase === 'inspection' || state.phase === 'inspectionHolding' || state.phase === 'inspectionArmed'
  if (inInspection && state.inspectionStartedAt !== undefined) return now - state.inspectionStartedAt
  return 0
}

export function isKeyboardTimerArmed(state: KeyboardTimerState): boolean {
  return state.phase === 'armed' || state.phase === 'inspectionArmed'
}

export function isKeyboardTimerRunning(state: KeyboardTimerState): boolean {
  return state.phase === 'running'
}

export function isPlausibleKeyboardSolve(startedAt: number, stoppedAt: number): boolean {
  return stoppedAt - startedAt >= MIN_KEYBOARD_SOLVE_MS
}
