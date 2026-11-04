import { describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { puzzles } from 'cubing/puzzles'
import { CaptureSession, type CompletedCapture } from './capture'
import { getScrambleToSolution } from '../domain/cubedex/scramble'

const turns = (alg: string) => alg.split(/\s+/).filter(Boolean).flatMap((move) => (move.endsWith('2') ? [move[0], move[0]] : [move]))

describe('scramble armed on a cube that is not solved', () => {
  it('follows the route from the tracked state, then records the real scramble', async () => {
    const scramble = "R2 D' F' L2 B L2 U2 F2 U2 F D2 B' U2 F' L' F2 R2 B' R' U' L2"
    const start = (await puzzles['3x3x3'].kpuzzle()).defaultPattern().applyAlg('R U F L\' D B')
    const route = await getScrambleToSolution(new Alg(scramble).invert().toString(), start)
    const completed: CompletedCapture[] = []
    const session = new CaptureSession((capture) => { completed.push(capture) })
    await session.setScramble(scramble, { pattern: start, route })

    expect(session.snapshot.scramble).toBe(route)
    let at = 0
    for (const move of turns(route)) await session.handleMove(move, at += 100, at)
    expect(session.snapshot.status).toBe('ready')
    expect(session.snapshot.offTrack).toBe(false)

    for (const move of turns(new Alg(scramble).invert().toString())) await session.handleMove(move, at += 100, at)
    expect(completed).toHaveLength(1)
    expect(completed[0].scramble).toBe(scramble)
  })
})
