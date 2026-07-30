import { useEffect, useState } from 'react'
import type { FindingRecord, PrescriptionRecord, SolveRecord, StageRecord, TrainerAttempt } from '../domain/models'
import { averageOf } from '../domain/statistics'
import { repositories } from '../storage/database'
import { CubePlayback } from './CubePlayback'

type TodayDashboardProps = {
  onNavigate: (destination: string) => void
}

type DashboardData = {
  solves: SolveRecord[]
  stages: StageRecord[]
  findings: FindingRecord[]
  prescriptions: PrescriptionRecord[]
  attempts: TrainerAttempt[]
  studies: number
}

const emptyData: DashboardData = {
  solves: [],
  stages: [],
  findings: [],
  prescriptions: [],
  attempts: [],
  studies: 0
}

const seconds = (milliseconds?: number) => milliseconds === undefined ? '—' : `${(milliseconds / 1000).toFixed(2)}s`

export function TodayDashboard({ onNavigate }: TodayDashboardProps) {
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    void Promise.all([
      repositories.solves.all(),
      repositories.stages.all(),
      repositories.findings.all(),
      repositories.prescriptions.all(),
      repositories.attempts.all(),
      repositories.studies.all()
    ]).then(([solves, stages, findings, prescriptions, attempts, studies]) => {
      setData({
        solves: solves.sort((left, right) => right.endedAt - left.endedAt),
        stages,
        findings: findings.sort((left, right) => right.impactMs - left.impactMs),
        prescriptions: prescriptions.sort((left, right) => right.createdAt - left.createdAt),
        attempts,
        studies: studies.length
      })
      setLoading(false)
    }).catch((error: unknown) => {
      setLoadError(error instanceof Error ? error.message : 'Unable to open local storage')
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <section className="panel empty-dashboard"><span className="eyebrow">LOCAL DATABASE</span><h2>Reading your captures…</h2></section>
  }

  if (loadError) {
    return <section className="panel empty-dashboard"><span className="eyebrow orange">LOCAL DATABASE ERROR</span><h2>Storage could not be opened.</h2><p>{loadError}</p></section>
  }

  const latest = data.solves[0]
  if (!latest) {
    return (
      <section className="surface-stack">
        <article className="panel empty-dashboard">
          <span className="eyebrow green">FIRST RUN / NO FABRICATED TELEMETRY</span>
          <h2>No solves yet.</h2>
          <p>This dashboard stays empty until you capture a real cube solve or deliberately run the simulator test harness. No AO12, findings, prescriptions, or confidence scores are seeded.</p>
          <div className="constraint-actions">
            <button className="button primary" onClick={() => onNavigate('Live Solve')}>Capture a solve</button>
            <button className="button secondary" onClick={() => onNavigate('Train')}>Open trainers</button>
            <button className="button ghost" onClick={() => onNavigate('Library')}>Open reconstruction tools</button>
          </div>
        </article>
        <section className="metric-strip" aria-label="Local data summary">
          <div><span>Captured solves</span><strong>0</strong><small>Waiting for immutable events</small></div>
          <div><span>Trainer attempts</span><strong>{data.attempts.length}</strong><small>Persisted locally</small></div>
          <div><span>Study records</span><strong>{data.studies}</strong><small>Private notes and bookmarks</small></div>
          <div><span>Coaching findings</span><strong>0</strong><small>Requires evidence from repeated solves</small></div>
        </section>
      </section>
    )
  }

  const latestStages = data.stages.filter((stage) => stage.solveId === latest.id).sort((left, right) => left.startEvent - right.startEvent)
  const primaryFinding = data.findings[0]
  const prescription = data.prescriptions[0]

  return (
    <section className="surface-stack">
      <section className="metric-strip" aria-label="Current performance summary">
        <div><span>Latest solve</span><strong>{seconds(latest.endedAt - latest.startedAt)}</strong><small>{new Date(latest.endedAt).toLocaleString()}</small></div>
        <div><span>Ao12</span><strong>{seconds(averageOf(data.solves, 12))}</strong><small>{data.solves.length} captured solves</small></div>
        <div><span>Move count</span><strong>{latest.moves.length}</strong><small>{latest.rawEventIds.length} linked raw events</small></div>
        <div><span>Evidence status</span><strong>{primaryFinding ? 'READY' : 'COLLECTING'}</strong><small>{primaryFinding ? `${Math.round(primaryFinding.confidence * 100)}% confidence` : 'Five compatible samples required'}</small></div>
      </section>

      <section className="dashboard-grid">
        <article className="panel constraint-card">
          <span className="eyebrow orange">TOP EVIDENCE-BACKED FINDING</span>
          {primaryFinding ? <><h2>{primaryFinding.evidence[0]?.stage ?? primaryFinding.metric}</h2><p>{Math.round(primaryFinding.observed)} ms observed · {Math.round(primaryFinding.recurrence * 100)}% recurrence · {primaryFinding.solveIds.length} solves.</p></> : <><h2>Still collecting.</h2><p>No coaching claim is generated until repeated compatible metric samples cross the evidence gate.</p></>}
          <button className="button secondary" onClick={() => onNavigate('Progress')}>Inspect evidence</button>
        </article>
        <article className="panel prescription-card">
          <span className="eyebrow green">CURRENT PRESCRIPTION</span>
          {prescription ? <><h2>{prescription.metric.replaceAll('_', ' ')}</h2>{prescription.blocks.map((block) => <p key={block.id}>{block.title} · {block.dose}</p>)}</> : <><h2>None assigned.</h2><p>A drill is prescribed only after a recurring finding is backed by persisted solve evidence.</p></>}
          <button className="button secondary" onClick={() => onNavigate('Train')}>Open training</button>
        </article>
      </section>

      <article className="panel playback-panel">
        <CubePlayback title="Latest captured solve" scramble={latest.scramble} moves={latest.moves} stages={latestStages.map((stage) => ({ label: stage.name, alg: latest.moves.slice(stage.startEvent, stage.endEvent + 1).join(' '), moves: latest.moves.slice(stage.startEvent, stage.endEvent + 1) }))} />
      </article>
    </section>
  )
}
