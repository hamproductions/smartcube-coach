import { useEffect, useState } from 'react'
import { bestAverageOf, bestSingle, inSession, averageOf, effectiveSolveMs, orderStages, stageTrends, transferSummary } from '../domain/statistics'
import { buildPairRedo, type PairRedo } from '../domain/pairRedo'
import { buildLastLayerRedo, type LastLayerRedo } from '../domain/lastLayerRedo'
import { createAlgorithmRecord } from '../domain/training'
import { roastFinding } from '../domain/recurrence'
import type { FindingRecord, PrescriptionRecord, SolveRecord, StageRecord, TrainerAttempt, TransferEvaluation, SmartCubeCoachBackup } from '../domain/models'
import { repositories } from '../storage/database'
import { downloadBackup, downloadCsTimerCsv, exportAllData, exportSessionAsCsTimerCsv, importAllData, importSessionFromCsTimerCsv } from '../storage/transfer'
import { DEFAULT_SESSION_ID } from '../domain/sessions'
import { CubePlayback } from './CubePlayback'
import { ReconstructEditor } from './ReconstructEditor'

const seconds = (milliseconds?: number) => milliseconds === undefined ? '—' : (milliseconds / 1000).toFixed(2)

export function HistoryProgress() {
  const [solves, setSolves] = useState<SolveRecord[]>([])
  const [replayTimestamps, setReplayTimestamps] = useState<number[]>()
  const latestSessionId = [...solves].sort((left, right) => right.endedAt - left.endedAt)[0]?.sessionId
  const sessionSolves = latestSessionId ? inSession(solves, latestSessionId) : solves
  const [stages, setStages] = useState<StageRecord[]>([])
  const [attempts, setAttempts] = useState<TrainerAttempt[]>([])
  const [findings, setFindings] = useState<FindingRecord[]>([])
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([])
  const [evaluations, setEvaluations] = useState<TransferEvaluation[]>([])
  const [selected, setSelected] = useState<SolveRecord>()
  const [editing, setEditing] = useState(false)
  const [redo, setRedo] = useState<PairRedo>()
  const [redoStatus, setRedoStatus] = useState('')
  const [lastLayerRedo, setLastLayerRedo] = useState<LastLayerRedo>()

  const sendToTrainer = async (name: string, setup: string, algorithm: string, set: 'F2L' | 'OLL' | 'PLL') => {
    try {
      await repositories.algorithms.put(createAlgorithmRecord({ set, name, algorithm, setup, targetMs: 1_200, orientations: ['U'] }))
      setRedoStatus(`Saved “${name}” to the ${set} trainer.`)
    } catch (error) {
      setRedoStatus(error instanceof Error ? error.message : 'Could not save that case')
    }
  }
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

  const [storageError, setStorageError] = useState('')

  useEffect(() => {
    refresh().catch((error: unknown) => setStorageError(error instanceof Error ? error.message : 'Unable to open local storage'))
  }, [])

  useEffect(() => {
    if (!selected) {
      setReplayTimestamps(undefined)
      return
    }
    let cancelled = false
    void repositories.rawEvents.forSolve(selected.id)
      .then((events) => {
        if (cancelled) return
        const solveMoves = events.filter((event) => event.phase === 'solve' && event.type === 'move')
        setReplayTimestamps(solveMoves.length === selected.moves.length ? solveMoves.map((event) => event.hostTimestamp) : undefined)
      })
      .catch(() => { if (!cancelled) setReplayTimestamps(undefined) })
    return () => { cancelled = true }
  }, [selected?.id])

  const changePenalty = async (solve: SolveRecord, penalty: SolveRecord['penalty']) => {
    await repositories.solves.put({ ...solve, penalty })
    await refresh()
  }

  const saveComment = async (solve: SolveRecord, comment: string) => {
    await repositories.solves.put({ ...solve, comment: comment.trim() || undefined })
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

  const exportCsTimerSession = async () => {
    if (!latestSessionId) {
      setMessage('No session to export yet.')
      return
    }
    downloadCsTimerCsv(await exportSessionAsCsTimerCsv(latestSessionId), latestSessionId)
  }

  const importCsTimer = async (file?: File) => {
    if (!file) return
    try {
      const result = await importSessionFromCsTimerCsv(await file.text(), latestSessionId ?? DEFAULT_SESSION_ID)
      const landed = `Landed ${result.solves.length} solve${result.solves.length === 1 ? '' : 's'} from csTimer CSV.`
      if (!result.skipped.length) {
        setMessage(landed)
      } else {
        const reasons = result.skipped.map((skip) => `line ${skip.line}: ${skip.reason}`).join('; ')
        setMessage(`${landed} Skipped ${result.skipped.length} row${result.skipped.length === 1 ? '' : 's'} — ${reasons}`)
      }
      await refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'csTimer import failed')
    }
  }

  const trends = stageTrends(stages)
  const transfer = transferSummary(attempts, solves)
  const selectedStages = selected ? orderStages(stages.filter((stage) => stage.solveId === selected.id)) : []

  return (
    <section className="surface-stack">
      <article className="panel progress-panel">
        <div className="surface-heading">
          <div><h2>Session averages</h2></div>
          <button className="button secondary" onClick={() => void exportAllData().then(downloadBackup)}>Export everything</button>
        </div>
        <div className="progress-metrics">
          <div><span>Ao5</span><strong>{seconds(averageOf(sessionSolves, 5))}</strong><small>best {seconds(bestAverageOf(solves, 5))}</small></div>
          <div><span>Ao12</span><strong>{seconds(averageOf(sessionSolves, 12))}</strong><small>best {seconds(bestAverageOf(solves, 12))}</small></div>
          <div><span>Best single</span><strong>{seconds(bestSingle(solves))}</strong><small>this session {seconds(bestSingle(sessionSolves))}</small></div>
          <div><span>Drill success</span><strong>{Math.round(transfer.drillSuccess * 100)}%</strong></div>
          <div><span>Full-solve transfer</span><strong>{transfer.improved ? 'IMPROVED' : 'PENDING'}</strong></div>
        </div>
        <div className="trend-table">
          <div className="trend-row header"><span>Stage</span><span>Recognition</span><span>Execution</span><span>TPS</span><span>Moves</span><span>Rotations</span><span>Pauses</span></div>
          {trends.map((trend) => <div className="trend-row" key={trend.name}><strong>{trend.name}</strong><span>{trend.recognitionMs === undefined ? '—' : `${Math.round(trend.recognitionMs)} ms`}</span><span>{trend.executionMs === undefined ? '—' : `${Math.round(trend.executionMs)} ms`}</span><span>{trend.tps === undefined ? '—' : trend.tps.toFixed(2)}</span><span>{trend.moves.toFixed(1)}</span><span>{trend.rotations.toFixed(1)}</span><span>{trend.pauses === undefined ? '—' : trend.pauses.toFixed(1)}</span></div>)}
        </div>
      </article>

      <article className="panel coaching-records">
        <div className="surface-heading"><div><h2>Coaching</h2></div></div>
        <div className="coaching-record-grid">
          <div className="finding-ledger">
            <h3>Problems that keep coming back</h3>
            {findings.map((finding) => (
              <article key={finding.id}>
                <div><strong>{finding.evidence[0]?.stage ?? finding.metric}</strong><span>{Math.round(finding.confidence * 100)}% confidence · {Math.round(finding.recurrence * 100)}% recurrence</span></div>
                <p>{roastFinding(finding)}</p>
                <small>{finding.solveIds.length} solves · {finding.evidence.flatMap((item) => item.rawEventIds ?? []).length} raw evidence references</small>
              </article>
            ))}
            {!findings.length && <p className="empty-state">Nothing here yet. We need five solves with the same problem before calling it a pattern — no guessing from one bad solve.</p>}
          </div>
          <div className="prescription-ledger">
            <h3>Your practice plan</h3>
            {prescriptions.map((prescription) => {
              const evaluation = evaluations.find((item) => item.prescriptionId === prescription.id)
              return (
                <article key={prescription.id}>
                  <header><strong>{prescription.title ?? prescription.metric.replaceAll('_', ' ')}</strong><span className={`contract-status ${prescription.status}`}>{prescription.status}</span></header>
                  <div className="contract-blocks">
                    {prescription.blocks.map((block) => <span className={block.completedAt ? 'complete' : ''} key={block.id}>{block.title} · {block.dose}</span>)}
                  </div>
                  <p>Target {prescription.target} · {prescription.transfer.postSampleSize} post-assignment full solves</p>
                  {evaluation && <small>{evaluation.status} · baseline {Math.round(evaluation.baselineMedian)} · post {evaluation.postMedian === undefined ? 'collecting' : Math.round(evaluation.postMedian)} · confidence {evaluation.confidence === undefined ? '—' : `${Math.round(evaluation.confidence * 100)}%`}</small>}
                </article>
              )
            })}
            {!prescriptions.length && <p className="empty-state">A practice plan appears once a problem above proves it keeps happening.</p>}
          </div>
        </div>
      </article>

      <article className="panel history-panel">
        <div className="surface-heading"><div><h2>Solve history</h2><span className="eyebrow">{solves.length} SAVED</span></div></div>
        <div className="history-layout">
          <div className="solve-list">
            {solves.map((solve) => (
              <button className={selected?.id === solve.id ? 'active' : ''} key={solve.id} onClick={() => setSelected(solve)}>
                <strong>{solve.penalty === 'dnf' ? `DNF (${seconds(solve.endedAt - solve.startedAt)}s)` : `${seconds(effectiveSolveMs(solve))}s${solve.penalty === '+2' ? ' (+2)' : ''}`}</strong>
                <span>{new Date(solve.endedAt).toLocaleString()} · {solve.moves.length} moves · {solve.penalty}{solve.source === 'cube' ? (solve.stateVerified ? ' · cube, state-verified' : ' · cube, UNVERIFIED move stream') : solve.source === 'replay' ? ' · replayed session' : solve.source === 'keyboard' ? ' · keyboard timer, no move stream' : ' · simulator'}</span>
              </button>
            ))}
            {storageError && <p className="error">Local storage is unavailable: {storageError}. Nothing shown here is a real record of your solves.</p>}
            {!storageError && !solves.length && <p className="empty-state">No completed captures yet. The Live Solve simulator creates the same persisted records as hardware.</p>}
          </div>
          {selected && (
            <div>
              {selectedStages.length > 0 && selectedStages.every((stage) => stage.confidence < 0.5) && (
                <p className="live-cube-warning">This solve does not break into CFOP stages — cross, F2L, OLL and PLL never completed in that order, so the stage numbers below are not used for your averages.</p>
              )}
              <div className="penalty-row">
                {(['none', '+2', 'dnf'] as const).map((penalty) => <button className={selected.penalty === penalty ? 'active' : ''} key={penalty} onClick={() => void changePenalty(selected, penalty)}>{penalty}</button>)}
                <button onClick={() => setEditing((current) => !current)}>{editing ? 'Close editor' : 'Edit reconstruction'}</button>
              </div>
              <label className="solve-comment">
                <span>Comment</span>
                <input
                  type="text"
                  key={`comment-${selected.id}`}
                  defaultValue={selected.comment ?? ''}
                  placeholder="What happened on this solve?"
                  onBlur={(event) => void saveComment(selected, event.target.value)}
                />
              </label>
              {selected.inspectionMs !== undefined && <p className="solve-inspection">Inspection {(selected.inspectionMs / 1000).toFixed(2)}s</p>}
              <div className="redo-row">
                {selectedStages.filter((stage) => ['OLL', 'PLL'].includes(stage.name) && stage.caseId && !stage.caseId.endsWith('skip')).map((stage) => (
                  <button
                    className="button ghost"
                    key={`ll-${stage.id}`}
                    onClick={() => {
                      setRedoStatus(`Rebuilding ${stage.name} from that state…`)
                      setRedo(undefined)
                      setLastLayerRedo(undefined)
                      void buildLastLayerRedo(selected, stage).then((result) => {
                        setLastLayerRedo(result)
                        setRedoStatus(result ? '' : `No trained algorithm reproduces ${stage.name} from that state.`)
                      })
                    }}
                  >Redo {stage.caseName ?? stage.name}</button>
                ))}
                {selectedStages.filter((stage) => stage.slot).map((stage) => (
                  <button
                    className="button ghost"
                    key={stage.id}
                    onClick={() => {
                      setRedoStatus(`Solving ${stage.slot} from that state…`)
                      setRedo(undefined)
                      setLastLayerRedo(undefined)
                      void buildPairRedo(selected, stage).then((result) => {
                        setRedo(result)
                        setRedoStatus(result ? '' : `No optimal route found for ${stage.slot} within the search bound.`)
                      })
                    }}
                  >Redo {stage.slot} pair</button>
                ))}
              </div>
              {redoStatus && <p className="empty-state">{redoStatus}</p>}
              {lastLayerRedo && (
                <div className="redo-panel">
                  <h3>{lastLayerRedo.caseName} from that exact state</h3>
                  <p>
                    You used <strong>{lastLayerRedo.yourMoves}</strong> moves; your trained algorithm needs <strong>{lastLayerRedo.trainedMoves}</strong>
                    {lastLayerRedo.saved > 0 ? ` — ${lastLayerRedo.saved} fewer.` : ' — no moves wasted.'} Pre-AUF: {lastLayerRedo.preAuf}.
                  </p>
                  <code>Yours: {lastLayerRedo.yours || '—'}</code>
                  <code>Trained: {lastLayerRedo.trained}</code>
                  <button className="button secondary" onClick={() => void sendToTrainer(`${lastLayerRedo.caseName} redo`, lastLayerRedo.setup, lastLayerRedo.trained, lastLayerRedo.stage)}>Send case to trainer</button>
                  <CubePlayback
                    key={`${selected.id}:${lastLayerRedo.stage}`}
                    title={`Redo ${lastLayerRedo.caseName}`}
                    scramble={lastLayerRedo.setup}
                    moves={lastLayerRedo.trained.split(' ').filter(Boolean)}
                    stages={[{ label: lastLayerRedo.caseName, alg: lastLayerRedo.trained, moves: lastLayerRedo.trained.split(' ').filter(Boolean) }]}
                  />
                </div>
              )}
              {redo && (
                <div className="redo-panel">
                  <h3>{redo.slot} pair from that exact state</h3>
                  <p>
                    You used <strong>{redo.yourMoves}</strong> moves; the optimal route from that state is <strong>{redo.optimalMoves}</strong>
                    {redo.saved > 0 ? ` — ${redo.saved} fewer.` : ' — you were optimal.'}
                  </p>
                  <code>Yours: {redo.yours || '—'}</code>
                  <code>Optimal: {redo.optimal}</code>
                  <button className="button secondary" onClick={() => void sendToTrainer(`${redo.slot} redo · ${selected.id.slice(0, 6)}`, redo.setup, redo.optimal, 'F2L')}>Send optimal route to trainer</button>
                  <CubePlayback
                    key={`${selected.id}:${redo.slot}`}
                    title={`Redo ${redo.slot} · optimal route`}
                    scramble={redo.setup}
                    moves={redo.optimal.split(' ').filter(Boolean)}
                    stages={[{ label: `${redo.slot} optimal`, alg: redo.optimal, moves: redo.optimal.split(' ').filter(Boolean) }]}
                  />
                </div>
              )}
              {editing ? <ReconstructEditor key={selected.id} solveId={selected.id} initialScramble={selected.scramble} initialMoves={selected.moves} initialStages={selectedStages} sourceEventIds={selected.rawEventIds} /> : <CubePlayback title="Saved solve replay" moveTimestamps={replayTimestamps} scramble={selected.scramble} moves={selected.moves} stages={selectedStages.map((stage) => ({ label: stage.caseName ? `${stage.name} · ${stage.caseName}` : stage.slot ? `${stage.name} · ${stage.slot}` : stage.name, alg: selected.moves.slice(stage.startEvent, stage.endEvent + 1).join(' '), moves: selected.moves.slice(stage.startEvent, stage.endEvent + 1) }))} />}
            </div>
          )}
        </div>
      </article>

      <article className="panel data-panel">
        
        <h2>Local data</h2>
        <label className="button secondary device-import">Import backup<input type="file" accept="application/json" aria-label="Import backup file" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importBackup(file) }} /></label>
        <button className="button secondary" onClick={() => void exportCsTimerSession()}>Export session as csTimer CSV</button>
        <label className="button secondary device-import">Import csTimer CSV<input type="file" accept=".csv" aria-label="Import csTimer CSV file" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void importCsTimer(file) }} /></label>
        <p>{message}</p>
      </article>
    </section>
  )
}
