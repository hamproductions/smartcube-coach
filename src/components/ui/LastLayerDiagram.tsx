import { useEffect, useState } from 'react'

// Why this exists rather than another twisty-player.
//
// cubing.js hard-codes its colour scheme (U is white) in the 3D chunk, and its only colour
// hook — `experimental-sprite` — is the picture-cube feature: the texture is applied solely
// when the stickering mask's specialBehaviour is "picture" (see the sprite/UV block in
// cubing's twisty-dynamic-3d chunk). There is no supported way to ask it for a yellow top.
// Rotating the puzzle does not help either: `experimental-2D-LL` draws whatever is on U, so
// rotating yellow onto U moves the last layer off U and the diagram stops being the case.
//
// So the last-layer diagram is drawn here, the way every speedcubing trainer draws it: the
// U face as a 3x3 grid with a tab per side facelet, coloured from a scheme we own. That
// also drops 20 WebGL players from the case grid.

export type StickerColor = 'white' | 'yellow' | 'red' | 'orange' | 'green' | 'blue'

/** Which real colour each cube face carries. Default is the usual yellow-top hold. */
export type ColorScheme = Record<'U' | 'R' | 'F' | 'D' | 'L' | 'B', StickerColor>

export const defaultScheme: ColorScheme = {
  U: 'yellow', R: 'red', F: 'green', D: 'white', L: 'orange', B: 'blue'
}

// A cube's colours are fixed relative to each other; only which one you hold on top varies.
// Placing each colour on an axis of the standard scheme (white up, green front, red right)
// lets the rest be derived: R is U x F. Guessing a lookup table would put orange and red on
// the wrong sides for half the holds, which is worse than offering no choice at all.
const AXIS: Record<StickerColor, [number, number, number]> = {
  white: [0, 1, 0], yellow: [0, -1, 0],
  green: [0, 0, 1], blue: [0, 0, -1],
  red: [1, 0, 0], orange: [-1, 0, 0]
}

const colourAt = (vector: [number, number, number]) =>
  (Object.keys(AXIS) as StickerColor[]).find((colour) =>
    AXIS[colour].every((component, index) => component === vector[index]))

const negate = ([x, y, z]: [number, number, number]): [number, number, number] => [-x, -y, -z]

const cross = (a: [number, number, number], b: [number, number, number]): [number, number, number] =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** The scheme for holding `top` up with `front` toward you, or null if that is not a hold. */
export function schemeFor(top: StickerColor, front: StickerColor): ColorScheme | null {
  const up = AXIS[top]
  const toward = AXIS[front]
  // Same colour, or opposite colours, is not a hold a cube can take.
  if (up.every((component, index) => component === toward[index])) return null
  if (up.every((component, index) => component === -toward[index])) return null
  const right = colourAt(cross(up, toward))
  const down = colourAt(negate(up))
  const back = colourAt(negate(toward))
  const left = right && colourAt(negate(AXIS[right]))
  if (!right || !down || !back || !left) return null
  return { U: top, F: front, R: right, D: down, B: back, L: left }
}

export const HEX: Record<StickerColor, string> = {
  white: '#f7f9fc', yellow: '#ffd500', red: '#b90000',
  orange: '#ff5900', green: '#009b48', blue: '#0051ba'
}

const UNORIENTED = '#3f3f46'

/** Facelet string order is Kociemba's: U R F D L B, nine per face, row major. */
const FACE_OFFSET = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 } as const

export type LastLayerMode = 'orientation' | 'permutation'

/** The facelet index each drawn cell reads, for the diagram's own geometry test. */
export const diagramFaceletIndex = {
  top: (row: number, column: number) => FACE_OFFSET.U + row * 3 + column,
  back: (position: number) => FACE_OFFSET.B + (2 - position),
  front: (position: number) => FACE_OFFSET.F + position,
  left: (position: number) => FACE_OFFSET.L + position,
  right: (position: number) => FACE_OFFSET.R + (2 - position)
}

async function faceletsAfter(setup: string) {
  const [{ Alg }, { patternToFacelets, solvedPattern }, { fixOrientation }] = await Promise.all([
    import('cubing/alg'),
    import('../../domain/cubedex/cubeUtils'),
    import('../../domain/cubedex/scramble')
  ])
  const solved = await solvedPattern()
  const pattern = setup.trim() ? solved.applyAlg(Alg.fromString(setup)) : solved
  // Wide and rotation moves in a case setup move the centres, and patternToFacelets rejects
  // a pattern whose centres are not in the solved frame — the same guard the rest of the
  // app applies before every conversion.
  return patternToFacelets(fixOrientation(pattern))
}

export function LastLayerDiagram({
  setup,
  mode,
  size = 96,
  scheme = defaultScheme
}: {
  setup: string
  mode: LastLayerMode
  size?: number
  scheme?: ColorScheme
}) {
  const [facelets, setFacelets] = useState<string>()

  useEffect(() => {
    let cancelled = false
    void faceletsAfter(setup).then((value) => { if (!cancelled) setFacelets(value) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [setup])

  const colourOf = (faceletIndex: number) => {
    if (!facelets) return UNORIENTED
    const letter = facelets[faceletIndex] as keyof ColorScheme | undefined
    if (!letter || !(letter in scheme)) return UNORIENTED
    // An orientation diagram only answers "is this facelet part of the top face?", which is
    // exactly what OLL recognition is. A permutation diagram keeps the real colours.
    if (mode === 'orientation') return letter === 'U' ? HEX[scheme.U] : UNORIENTED
    return HEX[scheme[letter]]
  }

  // Geometry: a 3x3 U face with a row of tabs on each side, as on every OLL/PLL sheet.
  const unit = size / 5.2
  const gap = unit * 0.08
  const tab = unit * 0.42
  const origin = tab + gap * 2

  const cell = (x: number, y: number, w: number, h: number, fill: string, key: string) => (
    <rect key={key} x={x} y={y} width={w} height={h} rx={unit * 0.12} fill={fill} stroke="#09090b" strokeWidth={gap} />
  )

  const squares = []
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      squares.push(cell(
        origin + column * (unit + gap),
        origin + row * (unit + gap),
        unit, unit,
        colourOf(FACE_OFFSET.U + row * 3 + column),
        `u-${row}-${column}`
      ))
    }
  }

  // Tab order, established by turning single faces on a solved cube and reading which
  // facelet index moved (see lastLayerDiagram.test.ts, which pins each of these):
  //   F and L run with the diagram; B and R run against it, because their top rows are
  //   indexed from the far side when you face them.
  for (let index = 0; index < 3; index += 1) {
    squares.push(cell(origin + index * (unit + gap), origin - tab - gap, unit, tab, colourOf(FACE_OFFSET.B + (2 - index)), `b-${index}`))
    squares.push(cell(origin + index * (unit + gap), origin + 3 * (unit + gap), unit, tab, colourOf(FACE_OFFSET.F + index), `f-${index}`))
    squares.push(cell(origin - tab - gap, origin + index * (unit + gap), tab, unit, colourOf(FACE_OFFSET.L + index), `l-${index}`))
    squares.push(cell(origin + 3 * (unit + gap), origin + index * (unit + gap), tab, unit, colourOf(FACE_OFFSET.R + (2 - index)), `r-${index}`))
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Last layer case ${setup}`}>
      {squares}
    </svg>
  )
}
