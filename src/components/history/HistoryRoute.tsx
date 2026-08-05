import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { CoachingHistory } from './CoachingHistory'
import { SolveAnalysis } from '../solve/SolveAnalysis'
import { repositories } from '../../storage/database'
import type { SolveRecord, StageRecord } from '../../domain/models'

export function HistoryRoute({ onDrill, initialSolveId }: { onDrill?: () => void; initialSolveId?: string }) {
  const [solves, setSolves] = useState<SolveRecord[]>([])
  const [stages, setStages] = useState<StageRecord[]>([])
  // Opened straight into a solve when arriving from the cockpit's breakdown button.
  const [openId, setOpenId] = useState<string | undefined>(initialSolveId)

  useEffect(() => {
    void Promise.all([repositories.solves.all(), repositories.stages.all()])
      .then(([allSolves, allStages]) => {
        setSolves(allSolves)
        setStages(allStages)
      })
      .catch(() => undefined)
  }, [])

  const open = solves.find((record) => record.id === openId)

  if (open) {
    return (
      <div className={css({ flex: '1', minH: '0', display: 'flex', flexDirection: 'column' })}>
        <button
          type="button"
          onClick={() => setOpenId(undefined)}
          className={css({
            alignSelf: 'flex-start', m: '6', mb: '0', px: '4', minH: '10',
            borderRadius: 'control', borderWidth: '1px', borderColor: 'floating',
            bg: 'container', color: 'ink', cursor: 'pointer', fontSize: 'sm',
            _hover: { bg: 'floating' }
          })}
        >← Back to history</button>
        <SolveAnalysis
          solve={open}
          stages={stages.filter((stage) => stage.solveId === open.id).sort((left, right) => left.startEvent - right.startEvent)}
          penalty={open.penalty === '+2' ? 'plus_two' : open.penalty === 'dnf' ? 'dnf' : 'none'}
          onPenalty={(next) => {
            const penalty = next === 'plus_two' ? '+2' : next === 'dnf' ? 'dnf' : 'none'
            void repositories.solves.put({ ...open, penalty } as SolveRecord).then(() => {
              setSolves((current) => current.map((record) => record.id === open.id ? { ...record, penalty } as SolveRecord : record))
            })
          }}
        />
      </div>
    )
  }

  return (
    <CoachingHistory
      solves={solves}
      stages={stages}
      onOpenSolve={setOpenId}
      onDrillSlot={() => onDrill?.()}
    />
  )
}
