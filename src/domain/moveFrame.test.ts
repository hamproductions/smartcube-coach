import { describe, expect, it } from 'vitest'
import {
  MoveFrameSession,
  combineRotations,
  decomposeAlgorithmMove,
  getSliceImplicitRotation,
  getWideImplicitRotation
} from './moveFrame'

describe('decomposeAlgorithmMove', () => {
  it('decomposes a wide move into its single layer plus implied rotation', () => {
    expect(decomposeAlgorithmMove('r')).toEqual({ rotation: 'x', faceMoves: ['L'] })
    expect(decomposeAlgorithmMove("r'")).toEqual({ rotation: "x'", faceMoves: ["L'"] })
    expect(decomposeAlgorithmMove('u2')).toEqual({ rotation: 'y2', faceMoves: ['D2'] })
  })

  it('decomposes M into the R L\' layer turns with an x\' implied rotation', () => {
    expect(decomposeAlgorithmMove('M')).toEqual({ rotation: "x'", faceMoves: ['R', "L'"] })
  })

  it('decomposes E into the U D\' layer turns with a y\' implied rotation', () => {
    expect(decomposeAlgorithmMove('E')).toEqual({ rotation: "y'", faceMoves: ['U', "D'"] })
  })

  it('decomposes S into the F\' B layer turns with a z implied rotation', () => {
    expect(decomposeAlgorithmMove('S')).toEqual({ rotation: 'z', faceMoves: ["F'", 'B'] })
  })

  it('leaves a plain face move undecomposed with no rotation', () => {
    expect(decomposeAlgorithmMove("R'")).toEqual({ rotation: '', faceMoves: ["R'"] })
  })

  it('reports a bare rotation token as rotation-only with no face moves', () => {
    expect(decomposeAlgorithmMove("y'")).toEqual({ rotation: "y'", faceMoves: [] })
  })
})

describe('getWideImplicitRotation / getSliceImplicitRotation', () => {
  it('matches the wide-move rotation table', () => {
    expect(getWideImplicitRotation('r')).toBe('x')
    expect(getWideImplicitRotation('l')).toBe("x'")
    expect(getWideImplicitRotation('u')).toBe('y')
    expect(getWideImplicitRotation('d')).toBe("y'")
    expect(getWideImplicitRotation('f')).toBe('z')
    expect(getWideImplicitRotation('b')).toBe("z'")
  })

  it('matches the slice-move rotation table (M->x\', E->y\', S->z)', () => {
    expect(getSliceImplicitRotation('M')).toBe("x'")
    expect(getSliceImplicitRotation('E')).toBe("y'")
    expect(getSliceImplicitRotation('S')).toBe('z')
  })
})

describe('combineRotations', () => {
  it('composes several rotations on the same axis into one', () => {
    expect(combineRotations(['y', 'y'])).toBe('y2')
    expect(combineRotations(['y', 'y', 'y'])).toBe("y'")
    expect(combineRotations(['y', 'y', 'y', 'y'])).toBe('')
  })

  it('keeps a compound rotation across axes when it cannot be simplified to one turn', () => {
    expect(combineRotations(['x', 'y'])).toBe('x y')
  })

  it('composes cumulative rotation across several calls, matching a running frame', () => {
    let rotation = ''
    rotation = combineRotations([rotation, 'y'].filter((r) => r !== ''))
    rotation = combineRotations([rotation, 'y'].filter((r) => r !== ''))
    expect(rotation).toBe('y2')
    rotation = combineRotations(["x'", rotation].filter((r) => r !== ''))
    expect(rotation).toBe("x' y2")
  })
})

describe('MoveFrameSession - wide move compensation', () => {
  it('maps a wide move to its detectable single layer and prepends the implied rotation', () => {
    const session = new MoveFrameSession(['r'])
    const step = session.handleRawMove('L')

    expect(step.verdict).toBe('matched')
    expect(step.algMoves).toEqual(['L'])
    expect(step.impliedRotation).toBe('x')
    expect(step.rotation).toBe('x')
  })

  it('applies the wide-move rotation to every subsequent raw move', () => {
    const session = new MoveFrameSession(['r', 'U'])
    session.handleRawMove('L')
    const step = session.handleRawMove('F')

    expect(step.verdict).toBe('matched')
    expect(step.algMoves).toEqual(['U'])
  })
})

describe('MoveFrameSession - slice move compensation (M, E, S)', () => {
  it('waits for the second face of an M slice, then resolves it with an x\' implied rotation', () => {
    const session = new MoveFrameSession(['M'])

    const first = session.handleRawMove('R')
    expect(first.verdict).toBe('pending')

    const second = session.handleRawMove("L'")
    expect(second.verdict).toBe('matched')
    expect(second.algMoves).toEqual(['R', "L'"])
    expect(second.impliedRotation).toBe("x'")
    expect(second.rotation).toBe("x'")
  })

  it('applies the M-slice implied rotation to every subsequent raw move', () => {
    const session = new MoveFrameSession(['M', 'U'])
    session.handleRawMove('R')
    session.handleRawMove("L'")

    const step = session.handleRawMove('B')
    expect(step.verdict).toBe('matched')
    expect(step.algMoves).toEqual(['U'])
  })

  it('resolves an E slice (U D\') with a y\' implied rotation', () => {
    const session = new MoveFrameSession(['E'])
    session.handleRawMove('U')
    const step = session.handleRawMove("D'")

    expect(step.verdict).toBe('matched')
    expect(step.algMoves).toEqual(['U', "D'"])
    expect(step.impliedRotation).toBe("y'")
  })

  it('resolves an S slice (F\' B) with a z implied rotation, accepting either physical order', () => {
    const session = new MoveFrameSession(['S'])
    session.handleRawMove('B')
    const step = session.handleRawMove("F'")

    expect(step.verdict).toBe('matched')
    expect(step.impliedRotation).toBe('z')
  })
})

describe('MoveFrameSession - move buffering for doubles', () => {
  it('recognises U followed by U as U2 instead of judging the first U wrong', () => {
    const session = new MoveFrameSession(['U2'])

    const first = session.handleRawMove('U')
    expect(first.verdict).toBe('pending')
    expect(first.undoMoves).toEqual([])

    const second = session.handleRawMove('U')
    expect(second.verdict).toBe('matched')
    expect(second.algMoves).toEqual(['U2'])
    expect(second.consumedExpected).toBe(1)
  })

  it('still flags a genuine wrong move immediately when a double is not expected', () => {
    const session = new MoveFrameSession(['R'])
    const step = session.handleRawMove('U')

    expect(step.verdict).toBe('mismatch')
    expect(step.undoMoves).toEqual(["U'"])
  })
})

describe('MoveFrameSession - rotation auto-apply from the expected algorithm', () => {
  it('auto-applies a leading rotation and reinterprets the next raw move through it', () => {
    const session = new MoveFrameSession(['y', 'F'])
    const step = session.handleRawMove('R')

    expect(step.verdict).toBe('matched')
    expect(step.algMoves).toEqual(['F'])
    expect(step.rotation).toBe('y')
  })
})

describe('MoveFrameSession - undo guidance', () => {
  it('builds an undo stack on mismatch and clears it once the user performs the inverse', () => {
    const session = new MoveFrameSession(['R'])
    const wrong = session.handleRawMove('U')
    expect(wrong.verdict).toBe('mismatch')
    expect(wrong.undoMoves).toEqual(["U'"])

    const corrected = session.handleRawMove("U'")
    expect(corrected.verdict).toBe('undo-complete')
    expect(corrected.undoMoves).toEqual([])

    const resumed = session.handleRawMove('R')
    expect(resumed.verdict).toBe('matched')
  })
})

describe('MoveFrameSession - never throws on any move token the reference accepts', () => {
  const faces = ['U', 'D', 'L', 'R', 'F', 'B']
  const wides = ['r', 'l', 'u', 'd', 'f', 'b']
  const slices = ['M', 'E', 'S']
  const rotations = ['x', 'y', 'z']
  const modifiers = ['', "'", '2']

  const allTokens = [...faces, ...wides, ...slices, ...rotations].flatMap((base) => modifiers.map((mod) => base + mod))

  it.each(allTokens)('does not throw for token %s', (token) => {
    expect(() => decomposeAlgorithmMove(token)).not.toThrow()

    const session = new MoveFrameSession([token])
    expect(() => session.handleRawMove(token)).not.toThrow()
    expect(() => session.handleRawMove('U')).not.toThrow()
  })
})
