import { describe, expect, it } from 'vitest'
import { FaceletReconciler, applyFaceletMoves, isSolvedFacelets, setupAlgFromFacelets, solvedFacelets } from './faceletReconciliation'
import { areAlgsEquivalent } from './guidedSolve'

describe('facelet reconciliation', () => {
  it('verifies moves against a later legal facelet snapshot', () => {
    const reconciler = new FaceletReconciler()
    expect(reconciler.reconcile(solvedFacelets)).toMatchObject({ status: 'baseline' })

    reconciler.recordMove('R')
    expect(reconciler.reconcile(applyFaceletMoves(solvedFacelets, ['R']))).toMatchObject({ status: 'verified', pendingMoves: ['R'] })
  })

  it('flags a legal snapshot that contradicts the captured move stream', () => {
    const reconciler = new FaceletReconciler()
    reconciler.reconcile(solvedFacelets)
    reconciler.recordMove('R')

    expect(reconciler.reconcile(solvedFacelets)).toMatchObject({ status: 'mismatch', pendingMoves: ['R'] })
  })

  it('converts a legal physical facelet state into an equivalent cubing.js setup algorithm', async () => {
    const facelets = applyFaceletMoves(solvedFacelets, ['R', "U'", 'F2'])

    expect(await areAlgsEquivalent(await setupAlgFromFacelets(facelets), "R U' F2")).toBe(true)
  }, 30_000)

  it('self-heals on the next reading instead of latching a stale mismatch forever', () => {
    const reconciler = new FaceletReconciler()
    reconciler.reconcile(solvedFacelets)
    reconciler.recordMove('R')
    expect(reconciler.reconcile(solvedFacelets, 'device')).toMatchObject({ status: 'mismatch' })

    reconciler.recordMove("R'")
    expect(reconciler.reconcile(applyFaceletMoves(solvedFacelets, ["R'"]), 'device')).toMatchObject({ status: 'verified' })
  })

  it('never reports a mismatch for a per-move echo, even when it disagrees', () => {
    const reconciler = new FaceletReconciler()
    reconciler.reconcile(solvedFacelets, 'echo')
    reconciler.recordMove('R')

    expect(reconciler.reconcile(solvedFacelets, 'echo')).toMatchObject({ status: 'verified' })
  })

  it('lets a genuine post-request device state disagree, then silently re-baselines from it', () => {
    const reconciler = new FaceletReconciler()
    reconciler.reconcile(solvedFacelets, 'device')
    reconciler.recordMove('R')

    expect(reconciler.reconcile(solvedFacelets, 'device')).toMatchObject({ status: 'mismatch' })
    expect(reconciler.disagreements).toHaveLength(1)
    expect(reconciler.disagreements[0]).toMatchObject({ source: 'device', actual: solvedFacelets })
    expect(reconciler.reconcile(solvedFacelets, 'device')).toMatchObject({ status: 'verified' })
  })

  it('does not surface a user-facing disagreement when a dropped move is followed by an echo', () => {
    const reconciler = new FaceletReconciler()
    reconciler.reconcile(solvedFacelets, 'echo')
    // The app failed to record this move (dropped event), so the next echo — computed by
    // the driver from the real move stream — legitimately disagrees with our accumulation.
    const statuses = [
      reconciler.reconcile(applyFaceletMoves(solvedFacelets, ['R']), 'echo').status,
      reconciler.reconcile(applyFaceletMoves(solvedFacelets, ['R', 'U']), 'echo').status
    ]

    expect(statuses).toEqual(['verified', 'verified'])
    expect(reconciler.disagreements.length).toBeGreaterThan(0)
  })

  it('resync leaves the reconciler exactly agreeing with the reported state', () => {
    const reconciler = new FaceletReconciler()
    reconciler.reconcile(solvedFacelets)
    reconciler.recordMove('R')
    reconciler.reconcile(solvedFacelets, 'device')

    const resynced = applyFaceletMoves(solvedFacelets, ["R'"])
    expect(reconciler.resync(resynced)).toMatchObject({ status: 'baseline' })
    expect(reconciler.reconcile(resynced)).toMatchObject({ status: 'verified' })
  })

  it('only arms a physical scramble from a solved sticker checkpoint', () => {
    expect(isSolvedFacelets(solvedFacelets)).toBe(true)
    expect(isSolvedFacelets(applyFaceletMoves(solvedFacelets, ['R']))).toBe(false)
  })
})

describe('solved detection on a physical cube', () => {
  const block = (colour: string) => colour.repeat(9)

  it('accepts a solved cube whatever way up it is held', () => {
    expect(isSolvedFacelets(solvedFacelets)).toBe(true)
    const orientations = [
      ['D', 'R', 'F', 'U', 'L', 'B'],
      ['U', 'F', 'L', 'D', 'B', 'R'],
      ['F', 'R', 'D', 'B', 'L', 'U'],
      ['L', 'U', 'F', 'R', 'D', 'B']
    ]
    for (const faces of orientations) {
      expect(isSolvedFacelets(faces.map(block).join('')), faces.join('')).toBe(true)
    }
  })

  it('rejects a cube one turn away from solved', () => {
    expect(isSolvedFacelets(applyFaceletMoves(solvedFacelets, ['R']))).toBe(false)
  })

  it('rejects a snapshot whose faces are not six distinct colours', () => {
    expect(isSolvedFacelets(block('U').repeat(6))).toBe(false)
  })
})
