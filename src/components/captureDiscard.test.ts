import { describe, expect, it } from 'vitest'

type Snapshot = { status: string; solveMoves: string[] }

function discardNotice(snapshot: Snapshot) {
  if (!['scrambling', 'inspection', 'solving'].includes(snapshot.status)) return ''
  return snapshot.solveMoves.length
    ? `Connecting discarded an in-progress capture of ${snapshot.solveMoves.length} solve moves — an incomplete move stream cannot be analysed. Generate a new scramble.`
    : 'Connecting discarded the scramble in progress. Generate a new scramble once the cube is ready.'
}

describe('capture discarded by a connect or reconnect', () => {
  it('says nothing when there was nothing to lose', () => {
    expect(discardNotice({ status: 'idle', solveMoves: [] })).toBe('')
    expect(discardNotice({ status: 'complete', solveMoves: ['R'] })).toBe('')
  })

  it('names the number of solve moves thrown away mid-solve', () => {
    expect(discardNotice({ status: 'solving', solveMoves: ['R', 'U', "R'"] })).toContain('3 solve moves')
    expect(discardNotice({ status: 'solving', solveMoves: ['R'] })).toContain('cannot be analysed')
  })

  it('reports a discarded scramble even before any solve move', () => {
    expect(discardNotice({ status: 'scrambling', solveMoves: [] })).toContain('discarded the scramble in progress')
  })
})
