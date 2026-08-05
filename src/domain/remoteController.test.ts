import { describe, expect, it } from 'vitest'
import { createRemoteControllerAttempt, RemoteControllerSession } from './remoteController'

describe('remote trainer controller', () => {
  it('advances target playback for every received turn without checking cube state', () => {
    const session = new RemoteControllerSession(['R', 'U', "R'"])

    expect(session.handleMove('x', 100)).toMatchObject({ targetIndex: 1, complete: false, turns: ['x'] })
    expect(session.handleMove('F2', 200)).toMatchObject({ targetIndex: 2, complete: false, turns: ['x', 'F2'] })
    expect(session.handleMove('M', 300)).toMatchObject({ targetIndex: 3, complete: true, turns: ['x', 'F2', 'M'] })
  })

  it('keeps the full physical turn stream after target playback completes', () => {
    const session = new RemoteControllerSession(['R'])

    session.handleMove('U', 100)
    expect(session.handleMove('L', 200)).toMatchObject({ targetIndex: 1, complete: true, turns: ['U', 'L'] })
  })

  it('records controller passes without treating unrelated turns as errors', () => {
    const session = new RemoteControllerSession(['R', 'U'])
    session.handleMove('x', 100)
    const snapshot = session.handleMove('M', 240)
    const attempt = createRemoteControllerAttempt({ id: 'f2l-1', name: 'Controller target', algorithm: 'R U', setup: "R U R'", set: 'F2L', targetMs: 900, mastery: 0, dueAt: 0, orientations: ['FR'] }, snapshot, 1_000)

    expect(attempt).toMatchObject({ family: 'algorithm', protocol: 'algorithm-rehearsal', input: 'smart-cube', outcome: 'success', answer: 'x M', wrongMoves: 0, targetSatisfied: true })
    expect(attempt.totalMs).toBe(140)
  })
})
