// Ported from poliva/cubedex (MIT License).
// Upstream repo: https://github.com/poliva/cubedex
// Source paths:
//   src/views/NewAlgView.tsx
//   src/lib/storage.ts (expandNotation, saveAlgorithm)
//   src/hooks/useAlgorithmImportExport.ts (submitSave validation)
//
// MIT License
// Copyright (c) 2024 Pau Oliva Fora
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// How cubedex authors a custom case (NewAlgView.tsx, standalone branch,
// lines 78-379): four fields — Category (with PLL/OLL/F2L/Custom quick
// chips), Subset, Name, and a raw-algorithm textarea. As the user types, the
// textarea is run through `expandNotation` (storage.ts:333-360, ported below
// verbatim) and split on whitespace into a live "Move Preview" chip row so
// the user sees exactly what tokens will be saved before saving. On save
// (useAlgorithmImportExport.ts:51-75), the ONLY validation is "are category,
// subset, name and the expanded algorithm all non-empty" — `expandNotation`
// is a character-level normalizer (quote unification, bracket-to-paren,
// stripping anything not in RLFBUDMESrlfbudxyz2()', then respacing), it does
// NOT parse the result as a real algorithm, so `saveAlgorithm` will happily
// store a syntactically-broken sequence like ")R2(" as long as it's non-empty.
//
// Compare with this app's authoring path: `createAlgorithmRecord`
// (src/domain/models.ts:240-255) requires name, algorithm and a positive
// targetMs, AND calls `new Alg(algorithm)` / `new Alg(setup)` — cubing/alg's
// real parser — throwing on anything that isn't a legal algorithm. That is
// strictly better validation than cubedex's, and should not be weakened.
//
// What cubedex has that this app's authoring lacks, and worth porting:
//   1. A live move-token preview as you type (immediate visual feedback,
//      independent of save-time validation) — `cubedexPreviewMoves` below.
//   2. Quick category chips for the common sets — `CUBEDEX_QUICK_CATEGORIES`.
//   3. A count of parsed moves next to the textarea — `cubedexPreviewMoves(...).length`.
// This file ports those three as pure functions/constants; it does NOT
// reintroduce cubedex's weaker non-parsing validation — draft validation
// below is a stricter merge: cubedex's required-fields check PLUS this app's
// existing Alg-parse requirement, so nothing regresses.

import { Alg } from 'cubing/alg'

export const CUBEDEX_QUICK_CATEGORIES = ['PLL', 'OLL', 'F2L', 'Custom'] as const
export type CubedexQuickCategory = (typeof CUBEDEX_QUICK_CATEGORIES)[number]

/**
 * Ported verbatim from cubedex's `expandNotation` (storage.ts:333-360): a
 * character-level cleanup pass, not a parser. Turns things like
 * `R U R' U'` / `(R U R' U')` typed with curly quotes or square brackets
 * into a canonical, single-spaced token stream.
 */
export function cubedexExpandNotation(input: string): string {
  let output = input
    .replace(/["´`‘]/g, "'")
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/XYZ/g, 'xyz')

  output = output.replace(/[^RLFBUDMESrlfbudxyz2()']/g, '')
  output = output.replace(/\(/g, ' (')
  output = output.replace(/\)(?!\s)/g, ') ')
  output = output.replace(/'(?![\s)])/g, "' ")
  output = output.replace(/2(?![\s')])/g, '2 ')
  output = output.replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g, '$1 ')
  output = output.replace(/\s+2/g, '2')
  output = output.replace(/\s+/g, ' ').trim()
  return output
}

/**
 * Ported from NewAlgView.tsx:82-83 (`expandedAlg.split(/\s+/).filter(Boolean)`),
 * used to render the "Move Preview" chip row as the user types, before any
 * save-time validation runs.
 */
export function cubedexPreviewMoves(rawInput: string): string[] {
  const trimmed = rawInput.trim()
  if (!trimmed) return []
  return cubedexExpandNotation(trimmed).split(/\s+/).filter(Boolean)
}

export interface CubedexNewAlgDraft {
  category: string
  subset: string
  name: string
  algorithm: string
}

export type CubedexNewAlgValidation =
  | { ok: true; expandedAlgorithm: string }
  | { ok: false; error: string }

/**
 * Stricter-than-upstream validation: cubedex's required-fields check
 * (useAlgorithmImportExport.ts:57-64, "Please fill in all fields") merged
 * with this app's existing Alg-parse requirement from
 * `createAlgorithmRecord` (models.ts:248-251) so a syntactically invalid
 * algorithm is rejected instead of silently saved.
 */
export function validateCubedexNewAlgDraft(draft: CubedexNewAlgDraft): CubedexNewAlgValidation {
  const category = draft.category.trim()
  const subset = draft.subset.trim()
  const name = draft.name.trim()
  const expandedAlgorithm = cubedexExpandNotation(draft.algorithm.trim())

  if (!category || !subset || !name || !expandedAlgorithm) {
    return { ok: false, error: 'Please fill in all fields' }
  }

  try {
    new Alg(expandedAlgorithm)
  } catch {
    return { ok: false, error: 'Algorithm is not valid' }
  }

  return { ok: true, expandedAlgorithm }
}
