import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { SolveAnalysis } from './SolveAnalysis'
import { repositories } from '../../storage/database'
import type { SolveRecord, StageRecord } from '../../domain/models'

export function AnalysisRoute() {
  const [solves, setSolves] = useState<SolveRecord[]>([])
  const [stages, setStages] = useState<StageRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>()

  useEffect(() => {
    void Promise.all([repositories.solves.all(), repositories.stages.all()])
      .then(([allSolves, allStages]) => {
        const ordered = allSolves.sort((left, right) => right.endedAt - left.endedAt)
        setSolves(ordered)
        setStages(allStages)
        setSelectedId((current) => current ?? ordered[0]?.id)
      })
      .catch(() => undefined)
  }, [])

  const solve = solves.find((record) => record.id === selectedId) ?? solves[0]

  if (!solve) {
    return (
      <div className={css({ p: '8', color: 'inkVariant' })}>
        No solves recorded yet. Capture one on Live Solve, or replay a recorded session.
      </div>
    )
  }

  return (
    <SolveAnalysis
      solve={solve}
      stages={stages.filter((stage) => stage.solveId === solve.id).sort((left, right) => left.startEvent - right.startEvent)}
      penalty={solve.penalty === '+2' ? 'plus_two' : solve.penalty === 'dnf' ? 'dnf' : 'none'}
      onPenalty={(next) => {
        const penalty = next === 'plus_two' ? '+2' : next === 'dnf' ? 'dnf' : 'none'
        void repositories.solves.put({ ...solve, penalty } as SolveRecord).then(() => {
          setSolves((current) => current.map((record) => record.id === solve.id ? { ...record, penalty } as SolveRecord : record))
        })
      }}
    />
  )
}
