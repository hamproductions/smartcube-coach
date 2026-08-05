// Ported from poliva/cubedex (MIT License).
// Upstream repo: https://github.com/poliva/cubedex
// Source paths:
//   src/hooks/usePracticeToggles.ts (toggle state + mutual-exclusivity rules)
//   src/hooks/useTrainingState.ts (TrainingPracticeOptions, buildQueue,
//     buildSmartReviewQueue, insertSlowCase, shuffleCases, insertCaseWithGap,
//     SMART_REVIEW_RETRY_GAP, SMART_REVIEW_MAX_REPEATS_PER_PASS)
//   src/hooks/useAppSettings.ts (non-drill display/device settings, listed
//     for completeness in CUBEDEX_ALL_OPTIONS below)
//   src/views/OptionsView.tsx (what each option is called and where it lives)
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

/**
 * Every practice-affecting knob cubedex exposes, where it lives upstream, and
 * its default. Six of these (the "PracticeTogglesState" toggles) are wired to
 * the queue-ordering functions below; the rest are display/device settings
 * (OptionsView.tsx) that don't change drill order but are listed here because
 * this app's trainer exposes far fewer knobs overall.
 */
export const CUBEDEX_ALL_OPTIONS = [
  { name: 'smartReviewScheduling', default: false, source: 'usePracticeToggles.ts', affectsQueueOrder: true,
    effect: 'SRS-driven queue: due-and-seen cases first (most urgent first), then due-and-unseen (shuffled), then not-yet-due-seen, then not-yet-due-unseen (shuffled). Mutually exclusive with randomOrder, prioritizeSlowCases and timeAttack (enabling it turns those three off).' },
  { name: 'randomizeAUF', default: false, source: 'usePracticeToggles.ts', affectsQueueOrder: false,
    effect: 'Adds a random U-face pre-rotation (AUF) before each scramble/algorithm so the same case is not always approached from the same angle.' },
  { name: 'randomOrder', default: false, source: 'usePracticeToggles.ts', affectsQueueOrder: true,
    effect: 'Shuffles the queue (Fisher-Yates) whenever it wraps and, in time-attack, shuffles the whole run up front. Disables prioritizeSlowCases and smartReviewScheduling.' },
  { name: 'prioritizeSlowCases', default: false, source: 'usePracticeToggles.ts', affectsQueueOrder: true,
    effect: 'Inserts each case into the queue ordered slowest-best-time-first (cases with no recorded best time go after all timed cases). Disables randomOrder and smartReviewScheduling.' },
  { name: 'prioritizeFailedCases', default: false, source: 'usePracticeToggles.ts', affectsQueueOrder: true,
    effect: 'On a fix/mistake, the failed case is queued for an extra repeat later in the same pass (independent of the other four; can combine with any of them).' },
  { name: 'timeAttack', default: false, source: 'usePracticeToggles.ts', affectsQueueOrder: true,
    effect: 'Runs the whole selected set back-to-back under one continuous timer instead of one case at a time; disables smartReviewScheduling and the per-case countdown.' },
  { name: 'countdownMode', default: false, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: '3-2-1 countdown before each case is revealed; disabled automatically while timeAttack is on.' },
  { name: 'alwaysScrambleTo', default: false, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Keeps "Scramble To" available even when a scramble is already active, instead of clearing it on Train.' },
  { name: 'autoUpdateLearningState', default: true, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Derives the learned/learning/unlearned badge from recent review history (deriveAutoLearnedStatus) instead of only the manual toggle.' },
  { name: 'flashingIndicatorEnabled', default: true, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Flashes the timer card green on success / red on mistake.' },
  { name: 'showAlgName', default: true, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Shows the case name above the stats panel instead of a generic "Recent times" / "Case Stats" label.' },
  { name: 'gyroscope', default: true, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Drives the virtual cube orientation from the smartcube\'s gyroscope when supported.' },
  { name: 'visualization', default: 'PG3D', source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Cube render mode: PG3D | 2D | 3D | experimental-2D-LL | experimental-2D-LL-face.' },
  { name: 'backview', default: 'none', source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'none | side-by-side | top-right — shows the back of the cube.' },
  { name: 'hintFacelets', default: 'none', source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'none | floating — floating mirror stickers as a solving aid.' },
  { name: 'fullStickering', default: false, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Always shows full stickers instead of the experimental partial stickering; gates whiteOnBottom.' },
  { name: 'whiteOnBottom', default: false, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Virtual cube orientation with white on the bottom face; requires fullStickering.' },
  { name: 'controlPanel', default: 'none', source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'none | bottom-row — an on-screen virtual-cube control panel.' },
  { name: 'cubeSizePx', default: 400, source: 'useAppSettings.ts', affectsQueueOrder: false,
    effect: 'Render size of the virtual cube, clamped 240-600px.' },
] as const

export interface CubedexPracticeToggles {
  smartReviewScheduling: boolean
  randomizeAUF: boolean
  randomOrder: boolean
  prioritizeSlowCases: boolean
  prioritizeFailedCases: boolean
  timeAttack: boolean
}

export const CUBEDEX_PRACTICE_TOGGLES_DEFAULT: CubedexPracticeToggles = {
  smartReviewScheduling: false,
  randomizeAUF: false,
  randomOrder: false,
  prioritizeSlowCases: false,
  prioritizeFailedCases: false,
  timeAttack: false,
}

/**
 * Faithful port of usePracticeToggles.ts's setter side-effects: turning one
 * toggle on can turn others off. Call with the toggle being changed and its
 * new value; returns the next full state. (Upstream mutates six separate
 * `useState`s inline; this collapses that into one pure reducer step.)
 */
export function applyCubedexToggle(
  state: CubedexPracticeToggles,
  toggle: keyof CubedexPracticeToggles,
  value: boolean
): CubedexPracticeToggles {
  const next = { ...state, [toggle]: value }
  if (!value) return next

  switch (toggle) {
    case 'randomOrder':
      next.prioritizeSlowCases = false
      next.smartReviewScheduling = false
      break
    case 'prioritizeSlowCases':
      next.randomOrder = false
      next.smartReviewScheduling = false
      break
    case 'smartReviewScheduling':
      next.randomOrder = false
      next.prioritizeSlowCases = false
      next.timeAttack = false
      break
    case 'timeAttack':
      next.smartReviewScheduling = false
      break
    default:
      break
  }
  return next
}

/** Minimal shape the queue functions below need from a trainable case. */
export interface CubedexQueueCase {
  id: string
  name: string
  bestMs?: number
  reviewCount: number
  dueAt: number | null
  isDue: boolean
  /** Lower = more urgent. Use getCubedexCaseUrgency to derive from dueAt. */
  urgency: number
}

export function getCubedexCaseUrgency(dueAt: number | null, now = Date.now()): number {
  if (dueAt == null) return Number.NEGATIVE_INFINITY
  return dueAt <= now ? dueAt - now : dueAt
}

export function isCubedexCaseDue(dueAt: number | null, now = Date.now()): boolean {
  if (dueAt == null) return true
  return dueAt <= now
}

/** Ported from useTrainingState.ts `shuffleCases` (Fisher-Yates). */
export function cubedexShuffleCases<T>(cases: T[]): T[] {
  const next = [...cases]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[randomIndex]] = [next[randomIndex], next[index]]
  }
  return next
}

/** Ported from useTrainingState.ts `insertSlowCase`: no-best-time cases go last, else slowest-first. */
export function cubedexInsertSlowCase<T extends { id: string; bestMs?: number }>(queue: T[], nextCase: T): void {
  if (nextCase.bestMs == null) {
    const index = queue.reduceRight<number>((lastIndex, current, currentIndex) => {
      return current.bestMs == null ? lastIndex : currentIndex
    }, -1)
    if (index === -1) queue.push(nextCase)
    else queue.splice(index, 0, nextCase)
    return
  }

  const index = queue.findIndex((current) => current.bestMs != null && current.bestMs < nextCase.bestMs!)
  if (index === -1) queue.push(nextCase)
  else queue.splice(index, 0, nextCase)
}

/**
 * Ported from useTrainingState.ts `buildSmartReviewQueue`: due-and-seen cases
 * sorted by urgency then reviewCount then name; due-and-unseen shuffled;
 * then not-due-seen; then not-due-unseen shuffled. Falls back to sorting the
 * whole set by dueAt when nothing is due yet.
 */
export function cubedexBuildSmartReviewQueue<T extends CubedexQueueCase>(cases: T[]): T[] {
  const byUrgency = (left: T, right: T) => {
    if (left.urgency !== right.urgency) return left.urgency - right.urgency
    if (left.reviewCount !== right.reviewCount) return left.reviewCount - right.reviewCount
    return left.name.localeCompare(right.name)
  }
  const byDueAt = (left: T, right: T) => {
    const leftDue = left.dueAt ?? Number.POSITIVE_INFINITY
    const rightDue = right.dueAt ?? Number.POSITIVE_INFINITY
    if (leftDue !== rightDue) return leftDue - rightDue
    if (left.reviewCount !== right.reviewCount) return left.reviewCount - right.reviewCount
    return left.name.localeCompare(right.name)
  }

  if (!cases.some((c) => c.isDue)) {
    return [...cases].sort(byDueAt)
  }

  const seenDue = cases.filter((c) => c.reviewCount > 0 && c.isDue).sort(byUrgency)
  const unseenDue = cubedexShuffleCases(cases.filter((c) => c.reviewCount === 0 && c.isDue))
  const seenUpcoming = cases.filter((c) => c.reviewCount > 0 && !c.isDue).sort(byUrgency)
  const unseenUpcoming = cubedexShuffleCases(cases.filter((c) => c.reviewCount === 0 && !c.isDue))

  return [...seenDue, ...unseenDue, ...seenUpcoming, ...unseenUpcoming]
}

/** Ported from useTrainingState.ts `buildQueue`: dispatches to the active ordering strategy. */
export function cubedexBuildQueue<T extends CubedexQueueCase & { bestMs?: number }>(
  cases: T[],
  toggles: Pick<CubedexPracticeToggles, 'prioritizeSlowCases' | 'smartReviewScheduling'>
): T[] {
  if (toggles.smartReviewScheduling) {
    return cubedexBuildSmartReviewQueue(cases)
  }
  if (!toggles.prioritizeSlowCases) {
    return [...cases]
  }
  const queue: T[] = []
  for (const c of cases) cubedexInsertSlowCase(queue, c)
  return queue
}

export const CUBEDEX_SMART_REVIEW_RETRY_GAP = 4
export const CUBEDEX_SMART_REVIEW_MAX_REPEATS_PER_PASS = 2

/**
 * Ported from useTrainingState.ts `insertCaseWithGap`, used by the
 * prioritizeFailedCases retry mechanism to reinsert a failed case
 * CUBEDEX_SMART_REVIEW_RETRY_GAP positions ahead instead of at the very end.
 */
export function cubedexInsertCaseWithGap<T>(queue: T[], nextCase: T, gap = CUBEDEX_SMART_REVIEW_RETRY_GAP): void {
  const insertIndex = Math.min(queue.length, Math.max(0, gap))
  queue.splice(insertIndex, 0, nextCase)
}
