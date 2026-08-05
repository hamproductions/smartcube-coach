// Ported from poliva/cubedex (MIT License).
// Upstream repo: https://github.com/poliva/cubedex
// Source paths:
//   src/views/StatsPanel.tsx
//   src/hooks/useTrainingState.ts (buildStats, averageFromValues, TrainingStats)
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
// cubedex's `buildStats` (useTrainingState.ts:186-250) tracks, per case:
//   best, ao5, average (recog+exec total), avgExec, avgRecog, averageTps,
//   practiceCount, hasHistory, and a `lastFive` list of {value,label,isPb}
//   entries for the recent-times strip/graph in StatsPanel.tsx.
//
// This app's src/domain/training.ts already has `caseTrainingStats` (attempts,
// successes, successRate, bestMs, meanMs, recentAverageMs) and `caseAverages`
// (ao5/ao12 via the trimmed-mean averageOf in statistics.ts). What it does NOT
// compute that cubedex does:
//   - a separate recognition-time average (avgRecog) distinct from execution
//   - turns-per-second (averageTps), derived from move count / execution time
//   - a "last five" list annotated with a personal-best flag per entry, ready
//     for a recent-times UI strip
//
// This file ports that gap using this app's own AlgorithmRecord/TrainerAttempt
// model (models.ts) instead of cubedex's localStorage-backed
// getAttemptHistorySummary.
//
// Move counting: cubedex's lib/charts.ts `countMovesETM` wraps
// `cubing/alg`'s `experimentalCountMovesETM`, which the installed `cubing`
// version here does not export (verified against
// node_modules/cubing/dist/lib/cubing/notation/index.d.ts — no
// `experimentalCountMovesETM` re-export in this dependency version). Rather
// than reach further into `cubing` internals or reimplement ETM counting,
// this uses this project's own pinned ETM implementation,
// `countEtm`/`etps` in src/domain/solveMetrics.ts (slice = 2, face = 1,
// rotation = 0 — covered by that file's own tests), which is the
// project-standard ETM source everywhere else in this codebase.

import { countEtm, etps } from '../solveMetrics'
import type { TrainerAttempt } from '../models'

/** Tokenizes a spaced algorithm string into plain move tokens, same convention as movesetMatcher.ts. */
function tokenizeAlgorithm(algorithm: string): string[] {
  return algorithm
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

export interface CubedexLastFiveEntry {
  value: number
  label: string
  isPb: boolean
}

export interface CubedexCaseStats {
  caseId: string
  bestMs?: number
  ao5Ms?: number
  averageMs?: number
  avgExecMs?: number
  avgRecogMs?: number
  averageTps?: number
  practiceCount: number
  hasHistory: boolean
  lastFive: CubedexLastFiveEntry[]
}

const AO5_WINDOW = 5
const AO5_TRIM_START = 1
const AO5_TRIM_END = 4

function mean(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function ao5(values: number[]): number | undefined {
  if (values.length < AO5_WINDOW) return undefined
  const trimmed = [...values]
    .slice(-AO5_WINDOW)
    .sort((a, b) => a - b)
    .slice(AO5_TRIM_START, AO5_TRIM_END)
  return mean(trimmed)
}

/** Same move-counting semantics as cubedex's lib/charts.ts `countMovesETM`, backed by this project's pinned ETM rules. */
export function cubedexCountMovesETM(algorithm: string): number {
  return countEtm(tokenizeAlgorithm(algorithm))
}

/**
 * Faithful port of cubedex's `buildStats` (useTrainingState.ts:186-250),
 * adapted to read from this app's `TrainerAttempt[]` instead of cubedex's
 * `getAttemptHistorySummary`/`getBestTime` localStorage helpers.
 *
 * `attempts` must already be filtered/ordered to a single case's history,
 * oldest first (same contract cubedex's `executionTimes` array has).
 */
export function cubedexCaseStats(
  caseId: string,
  algorithm: string,
  attempts: Array<Pick<TrainerAttempt, 'executionMs' | 'recognitionMs' | 'totalMs' | 'endedAt'>>
): CubedexCaseStats {
  if (!caseId) {
    return { caseId, practiceCount: 0, hasHistory: false, lastFive: [] }
  }

  const ordered = [...attempts].sort((left, right) => left.endedAt - right.endedAt)
  const executionTimes = ordered
    .map((attempt) => attempt.executionMs)
    .filter((value): value is number => value !== undefined)
  const recognitionTimes = ordered
    .map((attempt) => attempt.recognitionMs)
    .filter((value): value is number => value !== undefined)
  const totalTimes = ordered
    .map((attempt) => attempt.totalMs)
    .filter((value): value is number => Number.isFinite(value))

  const bestMs = executionTimes.length ? Math.min(...executionTimes) : undefined
  const avgExecMs = mean(executionTimes)
  const avgRecogMs = mean(recognitionTimes)
  const averageMs = mean(totalTimes)
  const algorithmMoves = algorithm ? tokenizeAlgorithm(algorithm) : []
  const averageTps = algorithmMoves.length > 0 ? etps(algorithmMoves, avgExecMs) : undefined

  const lastFive = executionTimes.slice(-5).map((value, index, times) => {
    const positionFromEnd = times.length - 1 - index
    const sessionNumber = executionTimes.length - positionFromEnd
    return {
      value,
      label: `Time ${sessionNumber}`,
      isPb: bestMs === value,
    }
  })

  return {
    caseId,
    bestMs,
    ao5Ms: ao5(executionTimes),
    averageMs,
    avgExecMs,
    avgRecogMs,
    averageTps,
    practiceCount: executionTimes.length,
    hasHistory: executionTimes.length > 0,
    lastFive,
  }
}
