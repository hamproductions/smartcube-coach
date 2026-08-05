// Ported from poliva/cubedex (MIT License).
// Upstream repo: https://github.com/poliva/cubedex
// Source path: src/data/defaultAlgs.json
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
// Data preserved verbatim in ./defaultAlgs.data.json (unmodified copy of the
// upstream file) and re-exported here with types. cubedex ships several
// algorithm sets this app's own catalogues (src/domain/algorithmCatalogue.ts,
// src/domain/f2lCatalogue.ts) do not have: WVLS, OLLCP, VHLS, ZBLL, ZBLS,
// L6E-EO and L6E-EOLR. See CUBEDEX_SETS_NEW_TO_THIS_APP below for exact case
// counts per set.

import raw from './defaultAlgs.data.json'

export interface CubedexAlgorithmEntry {
  name: string
  algorithm: string
}

export interface CubedexSubset {
  subset: string
  algorithms: CubedexAlgorithmEntry[]
}

export type CubedexCategory =
  | 'PLL'
  | 'OLL'
  | '2-Look PLL'
  | '2-Look OLL'
  | 'F2L'
  | 'WVLS'
  | 'COLL'
  | 'OLLCP'
  | 'VHLS'
  | 'ZBLL'
  | 'ZBLS'
  | 'CMLL'
  | 'L6E-EO'
  | 'L6E-EOLR'

export type CubedexDefaultAlgs = Record<CubedexCategory, CubedexSubset[]>

/** Verbatim upstream data (src/data/defaultAlgs.json), typed. */
export const cubedexDefaultAlgs = raw as unknown as CubedexDefaultAlgs

export function cubedexCategories(): CubedexCategory[] {
  return Object.keys(cubedexDefaultAlgs) as CubedexCategory[]
}

export function cubedexSubsetsForCategory(category: CubedexCategory): CubedexSubset[] {
  return cubedexDefaultAlgs[category] ?? []
}

export function cubedexCaseCount(category: CubedexCategory): number {
  return cubedexSubsetsForCategory(category).reduce((sum, subset) => sum + subset.algorithms.length, 0)
}

export function cubedexAllCasesForCategory(category: CubedexCategory): Array<CubedexAlgorithmEntry & { subset: string; category: CubedexCategory }> {
  return cubedexSubsetsForCategory(category).flatMap((subset) =>
    subset.algorithms.map((algorithm) => ({ ...algorithm, subset: subset.subset, category }))
  )
}

/**
 * Categories from cubedex's catalogue that this app's own domain catalogues
 * (algorithmCatalogue.ts: OLL/EOLL/PLL, f2lCatalogue.ts: F2L, plus COLL/CMLL
 * elsewhere) do not contain at all. Counts measured directly off the ported
 * data above (`cubedexCaseCount`), verified 2026-08-04:
 *
 *   WVLS       4 subsets  /  27 cases  (Winter Variation Last Slot)
 *   OLLCP     57 subsets  / 342 cases  (OLL with Corner Permutation)
 *   VHLS       2 subsets  /  32 cases  (Valk / Hulk Last Slot)
 *   ZBLL      40 subsets  / 472 cases  (Zborowski-Bruchem Last Layer)
 *   ZBLS      42 subsets  / 305 cases  (ZB Last Slot)
 *   L6E-EO     4 subsets  /  11 cases  (Last 6 Edges - Edge Orientation)
 *   L6E-EOLR   8 subsets  /  46 cases  (Last 6 Edges - EO + L/R edges)
 *
 * Total new-to-this-app cases: 1,235 across 157 subsets.
 *
 * cubedex's PLL/OLL/F2L/COLL/CMLL sets overlap with this app's existing
 * catalogues in scope but are NOT identical move-for-move — this app's own
 * catalogues remain authoritative for those five sets; this file exposes
 * cubedex's copies only for completeness/reference, not to replace them.
 */
export const CUBEDEX_SETS_NEW_TO_THIS_APP = [
  'WVLS',
  'OLLCP',
  'VHLS',
  'ZBLL',
  'ZBLS',
  'L6E-EO',
  'L6E-EOLR',
] as const satisfies readonly CubedexCategory[]
