import { describe, expect, it } from 'vitest'
import { exportCsTimerCsv, importCsTimerCsv } from './csTimerFormat'
import type { SolveRecord } from './models'

const baseSolve: SolveRecord = {
  id: 'solve-1',
  sessionId: 'session-1',
  puzzle: '3x3x3',
  scramble: "R U R' U'",
  scrambleGenerator: 'test-v1',
  startedAt: 1_000,
  endedAt: 13_340,
  penalty: 'none',
  analysisVersion: '1',
  rawEventIds: ['event-1'],
  moves: ["R", "U", "R'", "U'"]
}

describe('exportCsTimerCsv', () => {
  it('writes the csTimer header and a plain solve row', () => {
    const csv = exportCsTimerCsv([baseSolve])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('No.;Time;Comment;Scramble;Date;P.1')
    expect(lines[1]).toBe(`1;12.34;;R U R' U';${Math.round(baseSolve.endedAt / 1000)};`)
  })

  it('exports a DNF as DNF(<raw time>) without folding in any penalty', () => {
    const dnf: SolveRecord = { ...baseSolve, penalty: 'dnf' }
    const csv = exportCsTimerCsv([dnf])
    expect(csv.split('\r\n')[1]).toContain('DNF(12.34)')
  })

  it('exports a +2 as the penalised time with a trailing plus', () => {
    const plusTwo: SolveRecord = { ...baseSolve, penalty: '+2' }
    const csv = exportCsTimerCsv([plusTwo])
    expect(csv.split('\r\n')[1]).toContain('14.34+')
  })

  it('quotes a comment or scramble containing the delimiter', () => {
    const withComment: SolveRecord = { ...baseSolve, comment: 'nice; skip' }
    const csv = exportCsTimerCsv([withComment])
    expect(csv.split('\r\n')[1]).toContain('"nice; skip"')
  })
})

describe('importCsTimerCsv', () => {
  it('round-trips a plain export back into a SolveRecord', () => {
    const csv = exportCsTimerCsv([baseSolve])
    const { solves, skipped } = importCsTimerCsv(csv, 'session-2')
    expect(skipped).toHaveLength(0)
    expect(solves).toHaveLength(1)
    expect(solves[0].scramble).toBe(baseSolve.scramble)
    expect(solves[0].penalty).toBe('none')
    expect(solves[0].endedAt - solves[0].startedAt).toBe(baseSolve.endedAt - baseSolve.startedAt)
  })

  it('never fabricates a move stream or verified state on import', () => {
    const csv = exportCsTimerCsv([baseSolve])
    const { solves } = importCsTimerCsv(csv, 'session-2')
    expect(solves[0].moves).toEqual([])
    expect(solves[0].source).toBe('keyboard')
    expect(solves[0].stateVerified).toBe(false)
    expect(solves[0].verificationDetail).toMatch(/csTimer/)
  })

  it('parses a quoted field containing the delimiter', () => {
    const csv = 'No.;Time;Comment;Scramble;Date;P.1\r\n1;12.34;"nice; skip";"R U; R2";1000;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(skipped).toHaveLength(0)
    expect(solves[0].comment).toBe('nice; skip')
    expect(solves[0].scramble).toBe('R U; R2')
  })

  it('parses CRLF line endings', () => {
    const csv = 'No.;Time;Comment;Scramble;Date;P.1\r\n1;12.34;;R U;1000;\r\n2;9.99;;U R;2000;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(skipped).toHaveLength(0)
    expect(solves).toHaveLength(2)
  })

  it('parses a file with no trailing newline', () => {
    const csv = 'No.;Time;Comment;Scramble;Date;P.1\n1;12.34;;R U;1000;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(skipped).toHaveLength(0)
    expect(solves).toHaveLength(1)
  })

  it('handles an absent Comment column', () => {
    const csv = 'No.;Time;Scramble;Date;P.1\n1;12.34;R U;1000;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(skipped).toHaveLength(0)
    expect(solves[0].comment).toBeUndefined()
    expect(solves[0].scramble).toBe('R U')
  })

  it('parses a DNF(12.34) time field back into penalty dnf with the raw time preserved', () => {
    const csv = 'No.;Time;Comment;Scramble;Date;P.1\n1;DNF(12.34);;R U;1000;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(skipped).toHaveLength(0)
    expect(solves[0].penalty).toBe('dnf')
    expect(solves[0].endedAt - solves[0].startedAt).toBe(12_340)
  })

  it('parses a 12.34+ time field back into penalty +2 with the raw time recovered', () => {
    const csv = 'No.;Time;Comment;Scramble;Date;P.1\n1;14.34+;;R U;1000;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(skipped).toHaveLength(0)
    expect(solves[0].penalty).toBe('+2')
    expect(solves[0].endedAt - solves[0].startedAt).toBe(12_340)
  })

  it('reports a malformed time field instead of silently dropping it', () => {
    const csv = 'No.;Time;Comment;Scramble;Date;P.1\n1;not-a-time;;R U;1000;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(solves).toHaveLength(0)
    expect(skipped).toEqual([{ line: 2, reason: 'unparseable Time field: "not-a-time"' }])
  })

  it('reports a malformed date field instead of silently dropping it', () => {
    const csv = 'No.;Time;Comment;Scramble;Date;P.1\n1;12.34;;R U;not-a-date;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(solves).toHaveLength(0)
    expect(skipped).toEqual([{ line: 2, reason: 'unparseable Date field: "not-a-date"' }])
  })

  it('reports a row with too few columns rather than dropping it silently', () => {
    const csv = 'No.;Time;Comment;Scramble;Date;P.1\n1;12.34'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(solves).toHaveLength(0)
    expect(skipped[0].line).toBe(2)
    expect(skipped[0].reason).toMatch(/columns/)
  })

  it('reports a header missing the required Time, Scramble or Date columns', () => {
    const csv = 'No.;Comment;P.1\n1;hi;'
    const { solves, skipped } = importCsTimerCsv(csv, 'session-1')
    expect(solves).toHaveLength(0)
    expect(skipped).toEqual([{ line: 1, reason: 'header is missing required Time, Scramble or Date column' }])
  })
})
