import { describe, expect, it } from 'vitest'
import {
  ARM_HOLD_MS,
  MIN_KEYBOARD_SOLVE_MS,
  STOP_GUARD_MS,
  handleArmTimeout,
  handleEscape,
  handleSpaceDown,
  handleSpaceUp,
  handleStopKey,
  idleKeyboardTimerState,
  isKeyboardTimerArmed,
  isKeyboardTimerRunning,
  isPlausibleKeyboardSolve,
  isWithinStopGuard,
  keyboardInspectionElapsedMs,
  keyboardTimerElapsedMs,
  resetKeyboardTimer
} from './keyboardTimer'

describe('keyboardTimer', () => {
  it('arms after holding space past the threshold', () => {
    const held = handleSpaceDown(idleKeyboardTimerState, 0)
    expect(held.phase).toBe('holding')
    const early = handleArmTimeout(held, ARM_HOLD_MS - 1)
    expect(early.phase).toBe('holding')
    const armed = handleArmTimeout(held, ARM_HOLD_MS)
    expect(armed.phase).toBe('armed')
    expect(isKeyboardTimerArmed(armed)).toBe(true)
  })

  it('cancels back to idle when space is released before arming', () => {
    const held = handleSpaceDown(idleKeyboardTimerState, 0)
    const released = handleSpaceUp(held, 100, false)
    expect(released.phase).toBe('idle')
  })

  it('starts running on release once armed without inspection', () => {
    const held = handleSpaceDown(idleKeyboardTimerState, 0)
    const armed = handleArmTimeout(held, ARM_HOLD_MS)
    const running = handleSpaceUp(armed, ARM_HOLD_MS + 5, false)
    expect(running.phase).toBe('running')
    expect(running.startedAt).toBe(ARM_HOLD_MS + 5)
    expect(isKeyboardTimerRunning(running)).toBe(true)
  })

  it('stops on any key while running and freezes elapsed time', () => {
    const held = handleSpaceDown(idleKeyboardTimerState, 0)
    const armed = handleArmTimeout(held, ARM_HOLD_MS)
    const running = handleSpaceUp(armed, 100, false)
    const stopped = handleStopKey(running, 9_100)
    expect(stopped.phase).toBe('stopped')
    expect(stopped.lastStoppedAt).toBe(9_100)
    expect(keyboardTimerElapsedMs(stopped, 20_000)).toBe(9_000)
  })

  it('does not stop when not running', () => {
    expect(handleStopKey(idleKeyboardTimerState, 100)).toEqual(idleKeyboardTimerState)
  })

  it('enters inspection on release when inspection is enabled, then requires a second hold-arm-release to start', () => {
    const held = handleSpaceDown(idleKeyboardTimerState, 0)
    const armed = handleArmTimeout(held, ARM_HOLD_MS)
    const inspection = handleSpaceUp(armed, ARM_HOLD_MS, true)
    expect(inspection.phase).toBe('inspection')
    expect(inspection.inspectionStartedAt).toBe(ARM_HOLD_MS)
    expect(keyboardInspectionElapsedMs(inspection, ARM_HOLD_MS + 5_000)).toBe(5_000)

    const secondHold = handleSpaceDown(inspection, ARM_HOLD_MS + 5_000)
    expect(secondHold.phase).toBe('inspectionHolding')
    const secondArmed = handleArmTimeout(secondHold, ARM_HOLD_MS + 5_000 + ARM_HOLD_MS)
    expect(secondArmed.phase).toBe('inspectionArmed')
    const running = handleSpaceUp(secondArmed, ARM_HOLD_MS + 5_300, true)
    expect(running.phase).toBe('running')
    expect(running.penalty).toBe('none')
  })

  it('releasing the second hold before it arms returns to inspection, not idle', () => {
    const inspection: ReturnType<typeof handleSpaceUp> = { phase: 'inspection', inspectionStartedAt: 0 }
    const holding = handleSpaceDown(inspection, 1_000)
    const released = handleSpaceUp(holding, 1_100, true)
    expect(released.phase).toBe('inspection')
    expect(released.inspectionStartedAt).toBe(0)
  })

  it('applies the +2 penalty past 15s of inspection and dnf past 17s', () => {
    const plusTwo = handleSpaceUp({ phase: 'inspectionArmed', inspectionStartedAt: 0 }, 15_500, true)
    expect(plusTwo.penalty).toBe('+2')
    const dnf = handleSpaceUp({ phase: 'inspectionArmed', inspectionStartedAt: 0 }, 17_500, true)
    expect(dnf.penalty).toBe('dnf')
    const clean = handleSpaceUp({ phase: 'inspectionArmed', inspectionStartedAt: 0 }, 10_000, true)
    expect(clean.penalty).toBe('none')
  })

  it('resets to idle', () => {
    expect(resetKeyboardTimer()).toEqual(idleKeyboardTimerState)
  })

  it('resets to idle from any state on escape, without recording a solve', () => {
    expect(handleEscape(idleKeyboardTimerState)).toEqual({ phase: 'idle', lastStoppedAt: undefined })
    expect(handleEscape({ phase: 'holding', holdStartedAt: 0 }).phase).toBe('idle')
    expect(handleEscape({ phase: 'armed' }).phase).toBe('idle')
    expect(handleEscape({ phase: 'inspection', inspectionStartedAt: 0 }).phase).toBe('idle')
    expect(handleEscape({ phase: 'inspectionHolding', inspectionStartedAt: 0, holdStartedAt: 100 }).phase).toBe('idle')
    expect(handleEscape({ phase: 'inspectionArmed', inspectionStartedAt: 0 }).phase).toBe('idle')
    const guarded = handleEscape({ phase: 'stopped', startedAt: 0, stoppedAt: 10, lastStoppedAt: 10 })
    expect(guarded).toEqual({ phase: 'idle', lastStoppedAt: 10 })
  })

  it('reports zero elapsed time before running', () => {
    expect(keyboardTimerElapsedMs(idleKeyboardTimerState, 5_000)).toBe(0)
  })

  it('flags a solve shorter than the minimum plausible duration', () => {
    expect(isPlausibleKeyboardSolve(0, MIN_KEYBOARD_SOLVE_MS - 1)).toBe(false)
    expect(isPlausibleKeyboardSolve(0, MIN_KEYBOARD_SOLVE_MS)).toBe(true)
  })

  it('a stray hold-release while still in inspection can start running just before a stop, producing an implausible solve', () => {
    const held = handleSpaceDown(idleKeyboardTimerState, 0)
    const armed = handleArmTimeout(held, ARM_HOLD_MS)
    const inspection = handleSpaceUp(armed, ARM_HOLD_MS, true)
    expect(inspection.phase).toBe('inspection')

    const strayHold = handleSpaceDown(inspection, 20_000)
    const strayArmed = handleArmTimeout(strayHold, 20_000 + ARM_HOLD_MS)
    const accidentallyRunning = handleSpaceUp(strayArmed, 20_000 + ARM_HOLD_MS, true)
    expect(accidentallyRunning.phase).toBe('running')

    const stopped = handleStopKey(accidentallyRunning, accidentallyRunning.startedAt! + 16)
    expect(isPlausibleKeyboardSolve(stopped.startedAt!, stopped.stoppedAt!)).toBe(false)
  })

  describe('lastStoppedAt guard', () => {
    it('is not set until a solve has stopped once', () => {
      expect(isWithinStopGuard(idleKeyboardTimerState, 100)).toBe(false)
    })

    it('blocks a new arm attempt within the guard window after a stop', () => {
      const stopped: ReturnType<typeof handleStopKey> = { phase: 'stopped', startedAt: 0, stoppedAt: 1_000, lastStoppedAt: 1_000 }
      const blocked = handleSpaceDown(stopped, 1_000 + STOP_GUARD_MS - 1)
      expect(blocked).toBe(stopped)
      expect(blocked.phase).toBe('stopped')
    })

    it('does not start or record a new solve for a keypress that lands inside the guard window', () => {
      const stopped: ReturnType<typeof handleStopKey> = { phase: 'stopped', startedAt: 0, stoppedAt: 1_000, lastStoppedAt: 1_000 }
      const stillBlocked = handleSpaceDown(stopped, 1_200)
      expect(stillBlocked.phase).toBe('stopped')
      const releasedWithNoArm = handleSpaceUp(stillBlocked, 1_250, false)
      expect(releasedWithNoArm.phase).toBe('stopped')
      expect(releasedWithNoArm.startedAt).toBe(0)
    })

    it('allows a new arm attempt once the guard window has elapsed', () => {
      const stopped: ReturnType<typeof handleStopKey> = { phase: 'stopped', startedAt: 0, stoppedAt: 1_000, lastStoppedAt: 1_000 }
      const now = 1_000 + STOP_GUARD_MS
      const held = handleSpaceDown(stopped, now)
      expect(held.phase).toBe('holding')
      expect(isWithinStopGuard(held, now)).toBe(false)
    })
  })

  describe('three consecutive solves', () => {
    it('each records a plausible duration and does not corrupt the next', () => {
      let state = idleKeyboardTimerState
      let clock = 0
      const solves: Array<{ startedAt: number; stoppedAt: number }> = []

      for (let solve = 0; solve < 3; solve += 1) {
        state = handleSpaceDown(state, clock)
        expect(state.phase).toBe('holding')
        clock += ARM_HOLD_MS
        state = handleArmTimeout(state, clock)
        expect(state.phase).toBe('armed')
        clock += 5
        state = handleSpaceUp(state, clock, false)
        expect(state.phase).toBe('running')
        const startedAt = state.startedAt!
        clock += 2_000
        state = handleStopKey(state, clock)
        expect(state.phase).toBe('stopped')
        solves.push({ startedAt, stoppedAt: state.stoppedAt! })
        clock += STOP_GUARD_MS + 100
      }

      expect(solves).toHaveLength(3)
      for (const solve of solves) {
        expect(isPlausibleKeyboardSolve(solve.startedAt, solve.stoppedAt)).toBe(true)
        expect(solve.stoppedAt - solve.startedAt).toBe(2_000)
      }
    })
  })
})
