import { puzzles } from 'cubing/puzzles'
import { describe, expect, it } from 'vitest'
import { isF2LSolved } from '../domain/drillEngine'
import { f2lCatalogue } from '../domain/f2lCatalogue'
import { stuckEdgeRecords } from '../domain/f2lStuckEdge'
import type { TrainerAttempt } from '../domain/models'
import { defaultAlgorithms } from '../domain/training'
import { TRAINERS } from '../components/train/trainers'
import { PLAN, drillProgress, presetCaseIds } from './plan'

describe('stuck edge F2L cases', () => {
  it('each setup breaks F2L and its solution restores it', async () => {
    const solved = (await puzzles['3x3x3'].kpuzzle()).defaultPattern()
    const f2lDone = (alg: string) => {
      const pattern = solved.applyAlg(alg)
      return isF2LSolved(pattern.patternData.CORNERS, pattern.patternData.EDGES, undefined)
    }
    const records = stuckEdgeRecords(0)
    expect(records).toHaveLength(6)
    for (const record of records) {
      expect(f2lDone(record.setup)).toBe(false)
      expect(f2lDone(`${record.setup} ${record.algorithm}`)).toBe(true)
    }
  })
})

describe('coaching plan', () => {
  const known = new Set([
    ...defaultAlgorithms.map((record) => record.id),
    ...f2lCatalogue.map((entry) => `f2l-${entry.slot.toLowerCase()}-${entry.caseNumber}`)
  ])
  const drills = PLAN.flatMap((group) => group.drills)

  it('points every drill at a real trainer and real cases', () => {
    for (const drill of drills) {
      expect(TRAINERS.some((trainer) => trainer.id === drill.trainer), drill.id).toBe(true)
      for (const id of presetCaseIds(drill)) expect(known.has(id), `${drill.id}: ${id}`).toBe(true)
    }
  })

  it('counts only today, this drill family and its own cases', () => {
    const drill = drills.find((entry) => entry.id === 'pll-stops')!
    const attempt = (caseId: string, family: string, outcome: string, recordedAt: number) => ({ caseId, family, outcome, recordedAt }) as unknown as TrainerAttempt
    const progress = drillProgress(drill, [
      attempt('pll-aa', 'algorithm', 'success', 200),
      attempt('pll-aa', 'algorithm', 'incorrect', 210),
      attempt('pll-gc', 'algorithm', 'success', 50),
      attempt('pll-t', 'algorithm', 'success', 220),
      attempt('pll-ab', 'recognition', 'success', 230)
    ], 100)
    expect(progress).toMatchObject({ reps: 2, clean: 1 })
    expect([...(progress?.cleanCases ?? [])]).toEqual(['pll-aa'])
  })
})
