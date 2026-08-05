/**
 * Ported from cs0x7f/cstimer (GPL-3.0), src/js/tools/image.js.
 * Upstream: https://github.com/cs0x7f/cstimer/blob/master/src/js/tools/image.js
 * cstimer is licensed under the GNU General Public License; see
 * https://github.com/cs0x7f/cstimer/blob/master/LICENSE for the full notice.
 *
 * This file ports only the `nnnImage` sub-module (the NxN cube net diagram
 * used for every WCA-style puzzle in cstimer). The sticker permutation
 * math in `doSlice` and the net layout math in `faceOffset`/`faceStickers`
 * are byte-faithful translations of `nnnImage.doslice` and `nnnImage.face`
 * (image.js lines 297-425). Everything else in image.js (clock, Square-1,
 * gear, mirror blocks, pyraminx, generic polyhedra, sliding puzzles) draws
 * puzzles this app does not support and was not ported.
 *
 * cstimer drives `genPosit` off `cubeutil.parseScramble`, which understands
 * wide/slice/rotation notation for arbitrary NxN puzzles. This app only ever
 * produces plain WCA 3x3x3 scrambles (single-layer U/R/F/D/L/B turns, see
 * `src/domain/scramble.ts`), so `parseFaceTurns` below is a deliberately
 * narrower tokenizer for that notation rather than a port of
 * `cubeutil.parseScramble`. `genPosit`/`doSlice` remain general in `size` so
 * a future NxN diagram can reuse them, but only single-layer (depth 0) turns
 * are ever produced by the tokenizer.
 */

export const FACE_ORDER = ['D', 'L', 'B', 'U', 'R', 'F'] as const
export type FaceIndex = 0 | 1 | 2 | 3 | 4 | 5

/**
 * Default sticker colors, indexed by FACE_ORDER (D L B U R F).
 *
 * These mirror DEFAULT_CUBE_COLORS in domain/ao1k/settings.ts (up white, down yellow),
 * which is the scheme the user can edit in Library > Settings. Hardcoding a different
 * scheme here silently overrode their configuration.
 */
export const FACE_COLORS: readonly string[] = ['#EEFF00', '#FFA914', '#2870FF', '#FFFFFF', '#FF0000', '#3EF600']

export interface FaceTurn {
  face: FaceIndex
  power: 1 | 2 | 3
}

const TURN_RE = /^([URFDLB])(2|')?$/

/**
 * Tokenizes a plain WCA 3x3x3 scramble string ("R U R' F2 ...") into
 * face turns expressed in cstimer's D-L-B-U-R-F face order, matching the
 * face-index + power convention `cubeutil.parseScramble` produces for
 * single-layer outer turns (image.js line 547).
 */
export function parseFaceTurns(scramble: string): FaceTurn[] {
  const turns: FaceTurn[] = []
  for (const token of scramble.trim().split(/\s+/).filter(Boolean)) {
    const match = TURN_RE.exec(token)
    if (!match) continue
    const face = FACE_ORDER.indexOf(match[1] as (typeof FACE_ORDER)[number]) as FaceIndex
    const power: 1 | 2 | 3 = match[2] === '2' ? 2 : match[2] === "'" ? 3 : 1
    turns.push({ face, power })
  }
  return turns
}

/**
 * Byte-faithful port of `nnnImage.doslice` (image.js lines 337-402).
 * Mutates `posit` in place, cycling the four side-strips touched by turning
 * face `f` at depth `d` (0 = outermost layer) `q` quarter turns, and — when
 * d === 0 — also rotating that face's own border stickers.
 */
export function doSlice(posit: number[], f: FaceIndex, d: number, q: number, size: number): void {
  const s2 = size * size
  if (f > 5) f = ((f - 6) as FaceIndex)
  for (let k = 0; k < q; k++) {
    for (let i = 0; i < size; i++) {
      let f1: number, f2: number, f3: number, f4: number
      if (f === 0) {
        f1 = 6 * s2 - size * d - size + i
        f2 = 2 * s2 - size * d - 1 - i
        f3 = 3 * s2 - size * d - 1 - i
        f4 = 5 * s2 - size * d - size + i
      } else if (f === 1) {
        f1 = 3 * s2 + d + size * i
        f2 = 3 * s2 + d - size * (i + 1)
        f3 = s2 + d - size * (i + 1)
        f4 = 5 * s2 + d + size * i
      } else if (f === 2) {
        f1 = 3 * s2 + d * size + i
        f2 = 4 * s2 + size - 1 - d + size * i
        f3 = d * size + size - 1 - i
        f4 = 2 * s2 - 1 - d - size * i
      } else if (f === 3) {
        f1 = 4 * s2 + d * size + size - 1 - i
        f2 = 2 * s2 + d * size + i
        f3 = s2 + d * size + i
        f4 = 5 * s2 + d * size + size - 1 - i
      } else if (f === 4) {
        f1 = 6 * s2 - 1 - d - size * i
        f2 = size - 1 - d + size * i
        f3 = 2 * s2 + size - 1 - d + size * i
        f4 = 4 * s2 - 1 - d - size * i
      } else {
        f1 = 4 * s2 - size - d * size + i
        f2 = 2 * s2 - size + d - size * i
        f3 = s2 - 1 - d * size - i
        f4 = 4 * s2 + d + size * i
      }
      const c = posit[f1]
      posit[f1] = posit[f2]
      posit[f2] = posit[f3]
      posit[f3] = posit[f4]
      posit[f4] = c
    }
    if (d === 0) {
      for (let i = 0; i + i < size; i++) {
        for (let j = 0; j + j < size - 1; j++) {
          const f1 = f * s2 + i + j * size
          const f3 = f * s2 + (size - 1 - i) + (size - 1 - j) * size
          let f2: number, f4: number
          if (f < 3) {
            f2 = f * s2 + (size - 1 - j) + i * size
            f4 = f * s2 + j + (size - 1 - i) * size
          } else {
            f4 = f * s2 + (size - 1 - j) + i * size
            f2 = f * s2 + j + (size - 1 - i) * size
          }
          const c = posit[f1]
          posit[f1] = posit[f2]
          posit[f2] = posit[f3]
          posit[f3] = posit[f4]
          posit[f4] = c
        }
      }
    }
  }
}

/**
 * Port of `nnnImage.genPosit` (image.js lines 404-425), narrowed to
 * single-layer (depth 0) outer turns only — see the module header.
 */
export function genPosit(size: number, turns: FaceTurn[]): number[] {
  const posit: number[] = []
  let cnt = 0
  for (let face = 0; face < 6; face++) {
    for (let f = 0; f < size * size; f++) posit[cnt++] = face
  }
  for (const turn of turns) {
    doSlice(posit, turn.face, 0, turn.power, size)
  }
  return posit
}

/** Solved-cube facelet state: each of the six faces is entirely its own color. */
export function solvedPosit(size: number): number[] {
  return genPosit(size, [])
}

/**
 * Port of `nnnImage.face`'s block-offset switch (image.js lines 300-318),
 * in cell units of 10/9 (a 1/9-cell gap between adjacent net faces).
 */
export function faceOffset(f: FaceIndex, size: number): [number, number] {
  const unit = 10 / 9
  switch (f) {
    case 0:
      return [unit * size, unit * size * 2] // D
    case 1:
      return [0, unit * size] // L
    case 2:
      return [unit * size * 3, unit * size] // B
    case 3:
      return [unit * size, 0] // U
    case 4:
      return [unit * size * 2, unit * size] // R
    default:
      return [unit * size, unit * size] // F
  }
}

export interface Sticker {
  face: FaceIndex
  row: number
  col: number
  x: number
  y: number
  size: number
  color: string
}

/**
 * Port of the per-face sticker loop inside `nnnImage.face`
 * (image.js lines 320-329), translated from cstimer's `$.ctxTransform`
 * affine (`[width, offx, offy]` -> `local*width + offx*width`) into plain
 * pixel rects so a component can draw each sticker directly.
 */
export function faceStickers(posit: number[], f: FaceIndex, size: number, cellPx: number): Sticker[] {
  const [offx, offy] = faceOffset(f, size)
  const s2 = size * size
  const stickers: Sticker[] = []
  for (let i = 0; i < size; i++) {
    const x = f === 1 || f === 2 ? size - 1 - i : i
    for (let j = 0; j < size; j++) {
      const y = f === 0 ? size - 1 - j : j
      const colorIdx = posit[f * s2 + y * size + x]
      stickers.push({
        face: f,
        row: j,
        col: i,
        x: cellPx * (i + offx + 0.1),
        y: cellPx * (j + offy + 0.1),
        size: cellPx,
        color: FACE_COLORS[colorIdx]
      })
    }
  }
  return stickers
}

export interface ScrambleDiagram {
  width: number
  height: number
  stickers: Sticker[]
}

/**
 * Port of `nnnImage.draw`'s bounding box (image.js lines 427-431) plus the
 * per-face sticker layout, exposed as plain data for a component to render
 * to canvas or SVG.
 */
export function scrambleDiagram(scramble: string, size = 3, cellPx = 30): ScrambleDiagram {
  const posit = genPosit(size, parseFaceTurns(scramble))
  const stickers: Sticker[] = []
  for (let f = 0; f < 6; f++) {
    stickers.push(...faceStickers(posit, f as FaceIndex, size, cellPx))
  }
  return {
    width: (39 * size / 9 + 0.2) * cellPx,
    height: (29 * size / 9 + 0.2) * cellPx,
    stickers
  }
}

/** Renders a scramble diagram to a self-contained SVG string. */
export function scrambleDiagramSvg(scramble: string, size = 3, cellPx = 30): string {
  const diagram = scrambleDiagram(scramble, size, cellPx)
  const rects = diagram.stickers
    .map((s) => `<rect x="${s.x}" y="${s.y}" width="${s.size}" height="${s.size}" fill="${s.color}" stroke="#000" stroke-width="1" />`)
    .join('')
  return `<svg width="${diagram.width}" height="${diagram.height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`
}

/** Draws a scramble diagram onto an existing 2D canvas context. */
export function drawScrambleDiagram(ctx: CanvasRenderingContext2D, scramble: string, size = 3, cellPx = 30): ScrambleDiagram {
  const diagram = scrambleDiagram(scramble, size, cellPx)
  for (const s of diagram.stickers) {
    ctx.fillStyle = s.color
    ctx.fillRect(s.x, s.y, s.size, s.size)
    ctx.strokeStyle = '#000'
    ctx.strokeRect(s.x, s.y, s.size, s.size)
  }
  return diagram
}
