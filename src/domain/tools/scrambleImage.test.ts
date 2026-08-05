import { describe, expect, it } from 'vitest'
import {
  FACE_COLORS,
  type FaceIndex,
  genPosit,
  parseFaceTurns,
  scrambleDiagram,
  scrambleDiagramSvg,
  solvedPosit
} from './scrambleImage'

const histogram = (posit: number[]) => {
  const counts = [0, 0, 0, 0, 0, 0]
  for (const color of posit) counts[color] += 1
  return counts
}

describe('parseFaceTurns', () => {
  it('maps WCA notation to D-L-B-U-R-F face index + power', () => {
    expect(parseFaceTurns("R U R' F2")).toEqual([
      { face: 4, power: 1 },
      { face: 3, power: 1 },
      { face: 4, power: 3 },
      { face: 5, power: 2 }
    ])
  })

  it('ignores unrecognized tokens rather than throwing', () => {
    expect(parseFaceTurns('R x Rw2 U')).toEqual([
      { face: 4, power: 1 },
      { face: 3, power: 1 }
    ])
  })
})

describe('genPosit / doSlice — known, checkable cube states', () => {
  it('the empty scramble is the solved state: each face solid in its own color', () => {
    const posit = solvedPosit(3)
    expect(posit).toHaveLength(54)
    expect(histogram(posit)).toEqual([9, 9, 9, 9, 9, 9])
    for (let face = 0; face < 6; face++) {
      const stickers = posit.slice(face * 9, face * 9 + 9)
      expect(stickers.every((c) => c === face)).toBe(true)
    }
  })

  it('four quarter turns of the same face return to solved (group identity)', () => {
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
      const posit = genPosit(3, parseFaceTurns(`${face} ${face} ${face} ${face}`))
      expect(posit, face).toEqual(solvedPosit(3))
    }
  })

  it('a sequence followed by its inverse returns to solved', () => {
    const posit = genPosit(3, parseFaceTurns("R U R' U' U R U' R'"))
    expect(posit).toEqual(solvedPosit(3))
  })

  it('a single U turn never touches the D face (U and D share no layer)', () => {
    const posit = genPosit(3, parseFaceTurns('U'))
    expect(posit.slice(0, 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it("a further U turn rotates the U face's own border stickers (once it holds mixed colors)", () => {
    const before = genPosit(3, parseFaceTurns('F')).slice(3 * 9, 3 * 9 + 9)
    const after = genPosit(3, parseFaceTurns('F U')).slice(3 * 9, 3 * 9 + 9)
    expect(after).not.toEqual(before)
    expect(after[4]).toBe(3) // center sticker is fixed by any turn of its own face
  })

  it('any scramble is a permutation of stickers: color counts stay 9 each', () => {
    const posit = genPosit(3, parseFaceTurns("R U R' U' F2 D L B2"))
    expect(histogram(posit)).toEqual([9, 9, 9, 9, 9, 9])
  })
})

describe('scrambleDiagram', () => {
  it('produces 54 stickers for a 3x3 with valid colors and positive bounds', () => {
    const diagram = scrambleDiagram("R U R' U'", 3, 30)
    expect(diagram.stickers).toHaveLength(54)
    expect(diagram.width).toBeGreaterThan(0)
    expect(diagram.height).toBeGreaterThan(0)
    for (const sticker of diagram.stickers) {
      expect(FACE_COLORS).toContain(sticker.color)
      expect(sticker.x).toBeGreaterThanOrEqual(0)
      expect(sticker.y).toBeGreaterThanOrEqual(0)
    }
  })

  it('renders an SVG string sized to the diagram bounds', () => {
    const svg = scrambleDiagramSvg('R', 3, 30)
    expect(svg).toContain('<svg')
    expect(svg.match(/<rect/g)).toHaveLength(54)
  })
})

describe('face index order matches D L B U R F', () => {
  it('parses each letter to its documented index', () => {
    const faces: [string, FaceIndex][] = [
      ['D', 0],
      ['L', 1],
      ['B', 2],
      ['U', 3],
      ['R', 4],
      ['F', 5]
    ]
    for (const [letter, index] of faces) {
      expect(parseFaceTurns(letter)).toEqual([{ face: index, power: 1 }])
    }
  })
})
