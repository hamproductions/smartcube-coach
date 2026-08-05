import { css } from 'styled-system/css'
import { Button } from './ui/Button'
import { Actions, Eyebrow, MetricStrip, Panel, PanelNote, PanelTitle, Stack, TwoUp } from './ui/Surface'
import { useEffect, useState } from 'react'
import type { FindingRecord, PrescriptionRecord, SolveRecord, StageRecord, TrainerAttempt } from '../domain/models'
import { averageOf } from '../domain/statistics'
import { repositories } from '../storage/database'
import { CubePlayback } from './CubePlayback'
import { ScramblePreview } from './ui/ScramblePreview'

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
    return <Panel><Eyebrow>Your data</Eyebrow><PanelTitle>Loading your solves…</PanelTitle></Panel>
  }

  if (loadError) {
    return <Panel><Eyebrow tone="warn">Storage problem</Eyebrow><PanelTitle>We could not open your saved data.</PanelTitle><PanelNote>{loadError}</PanelNote></Panel>
  }

  const latest = data.solves[0]
  if (!latest) {
    return (
      <Stack>
        <Panel>
          <Eyebrow tone="good">Getting started</Eyebrow>
          <PanelTitle>No solves yet.</PanelTitle>
          <PanelNote>This dashboard stays empty until you capture a real cube solve or deliberately run the simulator test harness. No AO12, findings, prescriptions, or confidence scores are seeded.</PanelNote>
          <Actions>
            <Button onClick={() => onNavigate('Live Solve')}>Capture a solve</Button>
            <Button variant="outline" onClick={() => onNavigate('Train')}>Open trainers</Button>
            <Button variant="ghost" onClick={() => onNavigate('Library')}>Open reconstruction tools</Button>
          </Actions>
        </Panel>
        <MetricStrip label="Local data summary" metrics={[
          { label: 'Captured solves', value: 0, note: 'Waiting for immutable events' },
          { label: 'Trainer attempts', value: data.attempts.length, note: 'Persisted locally' },
          { label: 'Study records', value: data.studies, note: 'Private notes and bookmarks' },
          { label: 'Coaching findings', value: 0, note: 'Requires evidence from repeated solves' }
        ]} />
      </Stack>
    )
  }

  const latestStages = data.stages.filter((stage) => stage.solveId === latest.id).sort((left, right) => left.startEvent - right.startEvent)
  const primaryFinding = data.findings[0]
  const prescription = data.prescriptions[0]

  return (
    <Stack>
      <MetricStrip label="Current performance summary" metrics={[
        { label: 'Latest solve', value: seconds(latest.endedAt - latest.startedAt), note: new Date(latest.endedAt).toLocaleString() },
        { label: 'Ao12', value: seconds(averageOf(data.solves, 12)), note: `${data.solves.length} captured solves` },
        { label: 'Move count', value: latest.moves.length, note: 'every turn saved' },
        { label: 'Coaching', value: primaryFinding ? 'Ready' : 'Not yet', note: primaryFinding ? `${Math.round(primaryFinding.confidence * 100)}% confidence` : 'Needs five solves' }
      ]} />

      <TwoUp>
        <Panel>
          <Eyebrow tone="warn">Biggest problem</Eyebrow>
          {primaryFinding
            ? <><PanelTitle>{primaryFinding.evidence[0]?.stage ?? primaryFinding.metric}</PanelTitle><PanelNote>{Math.round(primaryFinding.observed)} ms observed · {Math.round(primaryFinding.recurrence * 100)}% recurrence · {primaryFinding.solveIds.length} solves.</PanelNote></>
            : <><PanelTitle>Not enough solves yet.</PanelTitle><PanelNote>We will not tell you what to fix until the same problem shows up across several solves.</PanelNote></>}
          <Actions><Button variant="outline" onClick={() => onNavigate('History')}>See the details</Button></Actions>
        </Panel>
        <Panel>
          <Eyebrow tone="good">What to practise</Eyebrow>
          {prescription
            ? <><PanelTitle>{prescription.metric.replaceAll('_', ' ')}</PanelTitle>{prescription.blocks.map((block) => <PanelNote key={block.id}>{block.title} · {block.dose}</PanelNote>)}</>
            : <><PanelTitle>Nothing to practise yet.</PanelTitle><PanelNote>Practice is only suggested once a problem proves it keeps happening.</PanelNote></>}
          <Actions><Button variant="outline" onClick={() => onNavigate('Train')}>Open training</Button></Actions>
        </Panel>
      </TwoUp>

      <Panel>
        {/* Two columns, not a wrapping flex row: the preview belongs beside the
            scramble, pinned right. Wrapping dropped it underneath and left the whole
            block reading as an unaligned spread. */}
        <div className={css({ display: 'grid', gap: '8', alignItems: 'start', gridTemplateColumns: '1fr', md: { gridTemplateColumns: 'minmax(0, 1fr) auto' } })}>
          <p className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkMuted', lineHeight: '1.9', letterSpacing: '0.04em' })}>{latest.scramble}</p>
          <div className={css({ justifySelf: { base: 'start', md: 'end' } })}>
            <ScramblePreview scramble={latest.scramble} />
          </div>
        </div>
        <CubePlayback title="Latest captured solve" scramble={latest.scramble} moves={latest.moves} stages={latestStages.map((stage) => ({ label: stage.name, alg: latest.moves.slice(stage.startEvent, stage.endEvent + 1).join(' '), moves: latest.moves.slice(stage.startEvent, stage.endEvent + 1) }))} />
      </Panel>
    </Stack>
  )
}
