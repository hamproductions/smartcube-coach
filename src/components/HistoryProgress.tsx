import { useEffect, useState } from 'react'
import { averageOf, stageTrends, transferSummary } from '../domain/statistics'
import { roastFinding } from '../domain/recurrence'
import type { FindingRecord, PrescriptionRecord, SolveRecord, StageRecord, TrainerAttempt, TransferEvaluation, SmartCubeCoachBackup } from '../domain/models'
import { repositories } from '../storage/database'
import { downloadBackup, exportAllData, importAllData } from '../storage/transfer'
import { CubePlayback } from './CubePlayback'
import { ReconstructEditor } from './ReconstructEditor'

const seconds = (milliseconds?: number) => milliseconds === undefined ? '—' : (milliseconds / 1000).toFixed(2)

export function HistoryProgress() {
  const [solves, setSolves] = useState<SolveRecord[]>([])
  const [stages, setStages] = useState<StageRecord[]>([])
  const [attempts, setAttempts] = useState<TrainerAttempt[]>([])
  const [findings, setFindings] = useState<FindingRecord[]>([])
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([])
  const [evaluations, setEvaluations] = useState<TransferEvaluation[]>([])
  const [selected, setSelected] = useState<SolveRecord>()
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('All data is local and versioned.')

  const refresh = async () => {
    const nextSolves = (await repositories.solves.all()).sort((left, right) => right.endedAt - left.endedAt)
    setSolves(nextSolves)
    setStages(await repositories.stages.all())
    setAttempts(await repositories.attempts.all())
    setFindings((await repositories.findings.all()).sort((left, right) => (right.impactMs * right.recurrence * right.confidence) - (left.impactMs * left.recurrence * left.confidence)))
    setPrescriptions((await repositories.prescriptions.all()).sort((left, right) => right.createdAt - left.createdAt))
    setEvaluations((await repositories.transfers.all()).sort((left, right) => right.evaluatedAt - left.evaluatedAt))
    setSelected((current) => current ?? nextSolves[0])
  }

  useEffect(() => void refresh(), [])

  const changePenalty = async (solve: SolveRecord, penalty: SolveRecord['penalty']) => {
    await repositories.solves.put({ ...solve, penalty })
    await refresh()
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      await importAllData(JSON.parse(await file.text()) as SmartCubeCoachBackup)
      setMessage('Backup imported and analysis data restored.')
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed')
    }
  }

  const trends = stageTrends(stages)
  const transfer = transferSummary(attempts, solves)
  const selectedStages = selected ? stages.filter((stage) => stage.solveId === selected.id) : []

  return (
    <section className="surface-stack">
      <article className="panel progress-panel">
        <div className="surface-heading">
          <div><span className="eyebrow green">PROGRESS / DRILL ≠ TRANSFER</span><h2>Rolling baselines and stage trends.</h2></div>
          <button className="button secondary" onClick={() => void exportAllData().then(downloadBackup)}>Export everything</button>
        </div>
        <div className="progress-metrics">
          <div><span>Ao5</span><strong>{seconds(averageOf(solves, 5))}</strong></div>
          <div><span>Ao12</span><strong>{seconds(averageOf(solves, 12))}</strong></div>
          <div><span>Ao100</span><strong>{seconds(averageOf(solves, 100))}</strong></div>
          <div><span>Drill success</span><strong>{Math.round(transfer.drillSuccess * 100)}%</strong></div>
          <div><span>Full-solve transfer</span><strong>{transfer.improved ? 'IMPROVED' : 'PENDING'}</strong></div>
        </div>
        <div className="trend-table">
          <div className="trend-row header"><span>Stage</span><span>Recognition</span><span>Execution</span><span>TPS</span><span>Moves</span><span>Rotations</span><span>Pauses</span></div>
          {trends.map((trend) => <div className="trend-row" key={trend.name}><strong>{trend.name}</strong><span>{Math.round(trend.recognitionMs)} ms</span><span>{Math.round(trend.executionMs)} ms</span><span>{trend.tps.toFixed(2)}</span><span>{trend.moves.toFixed(1)}</span><span>{trend.rotations.toFixed(1)}</span><span>{trend.pauses.toFixed(1)}</span></div>)}
        </div>
      </article>

      <article className="panel coaching-records">
        <div className="surface-heading"><div><span className="eyebrow green">EVIDENCE / COACHING CONTRACTS</span><h2>Recurring costs and full-solve transfer.</h2></div></div>
        <div className="coaching-record-grid">
          <div className="finding-ledger">
            <h3>Verified recurring findings</h3>
            {findings.map((finding) => (
              <article key={finding.id}>
                <div><strong>{finding.evidence[0]?.stage ?? finding.metric}</strong><span>{Math.round(finding.confidence * 100)}% confidence · {Math.round(finding.recurrence * 100)}% recurrence</span></div>
                <p>{roastFinding(finding)}</p>
                <small>{finding.solveIds.length} solves · {finding.evidence.flatMap((item) => item.rawEventIds ?? []).length} raw evidence references</small>
              </article>
            ))}
            {!findings.length && <p className="empty-state">Recurring findings require at least five compatible metric samples. Nothing is invented before that gate.</p>}
          </div>
          <div className="prescription-ledger">
            <h3>Prescriptions</h3>
            {prescriptions.map((prescription) => {
              const evaluation = evaluations.find((item) => item.prescriptionId === prescription.id)
              return (
                <article key={prescription.id}>
                  <header><strong>{prescription.metric.replaceAll('_', ' ')}</strong><span className={`contract-status ${prescription.status}`}>{prescription.status}</span></header>
                  <div className="contract-blocks">
                    {prescription.blocks.map((block) => <span className={block.completedAt ? 'complete' : ''} key={block.id}>{block.title} · {block.dose}</span>)}
                  </div>
                  <p>Target {prescription.target} · {prescription.transfer.postSampleSize} post-assignment full solves</p>
                  {evaluation && <small>{evaluation.status} · baseline {Math.round(evaluation.baselineMedian)} · post {evaluation.postMedian === undefined ? 'collecting' : Math.round(evaluation.postMedian)} · confidence {evaluation.confidence === undefined ? '—' : `${Math.round(evaluation.confidence * 100)}%`}</small>}
                </article>
              )
            })}
            {!prescriptions.length && <p className="empty-state">A prescription is assigned only after a recurring finding crosses the evidence gate.</p>}
          </div>
        </div>
      </article>

      <article className="panel history-panel">
        <div className="surface-heading"><div><span className="eyebrow">SOLVE HISTORY</span><h2>{solves.length} immutable captures.</h2></div></div>
        <div className="history-layout">
          <div className="solve-list">
            {solves.map((solve) => (
              <button className={selected?.id === solve.id ? 'active' : ''} key={solve.id} onClick={() => setSelected(solve)}>
                <strong>{seconds(solve.endedAt - solve.startedAt)}s</strong>
                <span>{new Date(solve.endedAt).toLocaleString()} · {solve.moves.length} moves · {solve.penalty}</span>
              </button>
            ))}
            {!solves.length && <p className="empty-state">No completed captures yet. The Live Solve simulator creates the same persisted records as hardware.</p>}
          </div>
          {selected && (
            <div>
              <div className="penalty-row">
                {(['none', '+2', 'dnf'] as const).map((penalty) => <button className={selected.penalty === penalty ? 'active' : ''} key={penalty} onClick={() => void changePenalty(selected, penalty)}>{penalty}</button>)}
                <button onClick={() => setEditing((current) => !current)}>{editing ? 'Close editor' : 'Edit reconstruction'}</button>
              </div>
              {editing ? <ReconstructEditor key={selected.id} solveId={selected.id} initialScramble={selected.scramble} initialMoves={selected.moves} sourceEventIds={selected.rawEventIds} /> : <CubePlayback title="Saved solve replay" scramble={selected.scramble} moves={selected.moves} stages={selectedStages.map((stage) => ({ label: stage.name, alg: selected.moves.slice(stage.startEvent, stage.endEvent + 1).join(' '), moves: selected.moves.slice(stage.startEvent, stage.endEvent + 1) }))} />}
            </div>
          )}
        </div>
      </article>

      <article className="panel data-panel">
        <span className="eyebrow green">LOCAL-FIRST DATA</span>
        <h2>Schema and analysis version round-trip.</h2>
        <label className="button secondary">Import backup<input type="file" accept="application/json" onChange={(event) => void importBackup(event.target.files?.[0])} /></label>
        <p>{message}</p>
      </article>
    </section>
  )
}
