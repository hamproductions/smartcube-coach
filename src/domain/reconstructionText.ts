import MoveSequence from './moveSequence'
import type { Face, Move } from './smartCubeTimerUtils'

/**
 * Rewrites a raw captured move stream into readable notation.
 *
 * A smart cube reports every physical quarter turn separately, so a solve arrives as
 * `L' L' U' … D D R`, which no cuber can read. The rewrite uses MoveSequence in its
 * default `addition` mode — the same mode hakatashi/smart-cube-timer uses for its
 * per-stage sequences in `lib/SolveAnalyzer.js` (it reserves `raw` for the complete
 * turn record and never uses `reduction` for a solve).
 *
 * `addition` is the correct mode here because of what its `joinMoves` refuses to do
 * (`lib/MoveSequence.js`): turns of opposite sign are never merged, so `F F'` survives
 * as two moves. That pair is a real regrip or correction the solver made, and it is
 * exactly the wasted work this app exists to surface — `reduction` would cancel it to
 * nothing and quietly flatter the solve. Same-direction turns merge only when the
 * total is at most a half turn, so `L' L'` becomes `L2` while `F F F` stays legible.
 *
 * Tokens that are not plain face turns (rotations, wide and slice notation) pass
 * through untouched and break the run, so nothing is reordered around them.
 */
const FACES = new Set(['U', 'D', 'L', 'R', 'F', 'B'])

function parseMove(token: string): Move | null {
  const face = token[0]
  if (!face || !FACES.has(face) || token.length > 2) return null
  const suffix = token.slice(1)
  const amount = suffix === "'" ? -1 : suffix === '2' ? 2 : suffix === '' ? 1 : null
  if (amount === null) return null
  return { face: face as Face, amount }
}

function format({ face, amount }: Move): string {
  const normalized = ((amount % 4) + 4) % 4
  if (normalized === 1) return face
  if (normalized === 2) return `${face}2`
  if (normalized === 3) return `${face}'`
  return face
}

export type ReadableToken = {
  /** The condensed token, e.g. `L2` for a captured `L' L'`. */
  text: string
  /** Index of the first raw move it came from. */
  start: number
  /** Index of the last raw move it came from. */
  end: number
}

/**
 * The same condensing as `readableReconstruction`, keeping each token's span in the raw
 * stream. The player's move strip needs both: a cuber reads `L2`, but clicking it has to
 * seek the raw move index the cube actually reported.
 *
 * The spans come from MoveSequence itself rather than a second implementation of its
 * merge rules — a token that does not lengthen the output has been merged into the
 * previous one, so it extends that token's span.
 */
export function readableTokens(moves: string[]): ReadableToken[] {
  const output: ReadableToken[] = []
  let sequence = new MoveSequence([])
  let emitted = 0

  const flushRun = () => {
    sequence = new MoveSequence([])
    emitted = 0
  }

  for (const [index, token] of moves.entries()) {
    const move = parseMove(token)
    if (!move) {
      flushRun()
      output.push({ text: token, start: index, end: index })
      continue
    }
    sequence.push(move)
    const formatted = sequence.moves.map(format)
    if (formatted.length > emitted) {
      output.push({ text: formatted[formatted.length - 1], start: index, end: index })
    } else if (output.length > 0) {
      // Merged into the token before it: rewrite that token and widen its span.
      output[output.length - 1] = {
        text: formatted[formatted.length - 1],
        start: output[output.length - 1].start,
        end: index
      }
    }
    emitted = formatted.length
  }

  return output
}

export function readableReconstruction(moves: string[]): string {
  const output: string[] = []
  let run: Move[] = []

  // Pushed one at a time: the join happens inside push(), so handing the constructor
  // a pre-filled array returns the raw stream back unchanged.
  const flush = () => {
    if (run.length === 0) return
    const sequence = new MoveSequence([])
    for (const move of run) sequence.push(move)
    output.push(...sequence.moves.map(format))
    run = []
  }

  for (const token of moves) {
    const move = parseMove(token)
    if (move) {
      run.push(move)
      continue
    }
    flush()
    output.push(token)
  }
  flush()

  return output.join(' ')
}
