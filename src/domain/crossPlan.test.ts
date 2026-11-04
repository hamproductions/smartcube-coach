import { describe, expect, it } from 'vitest'
import { gradeCrossPlan, heldFrame, optimalCrossPlan, parsePlan } from './crossPlan'
import { viewRotationForHold } from './cubeHold'

const scramble = "L2 U2 R D B' D' L2 F R2 F2 U2 F2 R2 F2 D2 B2 L2 U' D' L F'"

describe('plan the cross', () => {
  it('grades the shortest plan as solved, in the solver hold, and a wrong plan as not', async () => {
    const frame = heldFrame(viewRotationForHold('yellow', 'green'))
    expect(frame.bottom).toBe('U')
    const best = await optimalCrossPlan(scramble, frame)
    expect(best).toBeDefined()
    const graded = await gradeCrossPlan(scramble, best!, frame)
    expect(graded).toEqual({ solved: true, optimal: best!.length })
    expect((await gradeCrossPlan(scramble, ['R', 'U'], frame)).solved).toBe(false)
  })

  it('reads plans with brackets and rejects anything that is not a face turn', () => {
    expect(parsePlan("(R U) F2' D")).toEqual(['R', 'U', 'F2', 'D'])
    expect(parsePlan('R x U')).toBeUndefined()
  })
})
