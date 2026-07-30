import { useState } from 'react'
import { analyzeSolve } from './domain/analyzeSolve'
import { buildPrescription } from './domain/prescribe'
import { sampleSolve, trend } from './data/sampleSolve'
import { sampleReconstructionMoves, sampleReconstructionStages, sampleScramble } from './data/sampleReconstruction'
import { CubePlayback } from './components/CubePlayback'
import { HistoryProgress } from './components/HistoryProgress'
import { LiveSolve } from './components/LiveSolve'
import { PwaStatus } from './components/PwaStatus'
import { ReconstructEditor } from './components/ReconstructEditor'
import { RecoStudy } from './components/RecoStudy'
import { TrainerHub } from './components/TrainerHub'
import './styles.css'

const formatSeconds = (value: number) => `${(value / 1000).toFixed(2)}s`

const navItems = [
  ['01', 'Today'],
  ['02', 'Live Solve'],
  ['03', 'Solves'],
  ['04', 'Train'],
  ['05', 'Library'],
  ['06', 'Progress']
]

const blockGlyphs = {
  tracking: 'TR',
  prediction: 'PR',
  execution: 'EX',
  transfer: 'TF'
}

function TrendChart() {
  const width = 520
  const height = 112
  const min = Math.min(...trend) - 0.6
  const max = Math.max(...trend) + 0.4
  const points = trend
    .map((value, index) => {
      const x = (index / (trend.length - 1)) * width
      const y = height - ((value - min) / (max - min)) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Ao12 improving from 27.4 to 23.1 seconds">
      <line x1="0" y1="28" x2={width} y2="28" />
      <line x1="0" y1="72" x2={width} y2="72" />
      <polyline points={points} />
      {trend.map((value, index) => {
        const x = (index / (trend.length - 1)) * width
        const y = height - ((value - min) / (max - min)) * height
        return <circle key={`${value}-${index}`} cx={x} cy={y} r={index === trend.length - 1 ? 5 : 2.5} />
      })}
    </svg>
  )
}

function App() {
  const [roastOpen, setRoastOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('Today')
  const [completedBlocks, setCompletedBlocks] = useState<string[]>([])
  const analysis = analyzeSolve(sampleSolve)
  const prescription = buildPrescription(analysis.primary)

  const toggleBlock = (kind: string) => {
    setCompletedBlocks((current) =>
      current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Vector home">
          <span className="brand-mark">V</span>
          <span>VECTOR</span>
        </a>
        <nav aria-label="Primary navigation">
          {navItems.map(([index, label]) => (
            <button
              className={activeNav === label ? 'nav-item active' : 'nav-item'}
              key={label}
              onClick={() => setActiveNav(label)}
            >
              <span>{index}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <PwaStatus />
        </div>
      </aside>

      <main id="top">
        <header className="topbar">
          <div>
            <span className="eyebrow">{activeNav.toUpperCase()} / LOCAL-FIRST COACH</span>
            <h1>{activeNav === 'Today' ? 'Close the gap.' : activeNav}</h1>
          </div>
          <div className="device-cluster">
            <div className="device-copy">
              <span className="connection-pulse" />
              <div>
                <strong>GAN 12 ui</strong>
                <small>Demo telemetry · 72%</small>
              </div>
            </div>
            <button className="button secondary" onClick={() => setActiveNav('Live Solve')}>Device</button>
            <button className="avatar" aria-label="Profile">HP</button>
          </div>
        </header>

        {activeNav === 'Today' && <>
        <section className="metric-strip" aria-label="Current performance summary">
          <div>
            <span>Current Ao12</span>
            <strong>23.10</strong>
            <small className="good">↓ 1.52s this month</small>
          </div>
          <div>
            <span>Target gate</span>
            <strong>sub-20</strong>
            <small>2 of 4 checks passed</small>
          </div>
          <div>
            <span>Move count</span>
            <strong>{analysis.totalMoves}</strong>
            <small>HTM · solve #1042</small>
          </div>
          <div>
            <span>Data quality</span>
            <strong>98%</strong>
            <small className="good">Clock fit stable</small>
          </div>
        </section>

        <section className="dashboard-grid">
          <article className="constraint-card panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow orange">PRIMARY CONSTRAINT</span>
                <h2>{analysis.primary.title}</h2>
              </div>
              <span className="confidence">94% confidence</span>
            </div>

            <div className="constraint-main">
              <div className="big-metric">
                <strong>{formatSeconds(analysis.primary.observed)}</strong>
                <span>dead time before pair 2</span>
              </div>
              <div className="comparison">
                <div>
                  <span>Your median</span>
                  <strong>{formatSeconds(analysis.primary.baseline)}</strong>
                </div>
                <div>
                  <span>Next gate</span>
                  <strong>{formatSeconds(analysis.primary.target)}</strong>
                </div>
                <div>
                  <span>Recoverable</span>
                  <strong>{formatSeconds(analysis.primary.impactMs)}</strong>
                </div>
              </div>
            </div>

            <div className="evidence-line">
              <span className="evidence-index">E1</span>
              <p>
                Recurs in <strong>7 of the last 12 solves</strong>. Evidence: {analysis.primary.evidence.stage},
                {' '}{formatSeconds(analysis.primary.evidence.fromMs)}–{formatSeconds(analysis.primary.evidence.toMs)}.
              </p>
            </div>

            <div className="constraint-actions">
              <button className="button primary">Start prescription</button>
              <button className="button ghost" onClick={() => setRoastOpen((open) => !open)}>
                Roast this solve
              </button>
            </div>

            {roastOpen && (
              <div className="roast" role="status">
                <span>ROAST / VERIFIED</span>
                <p>
                  Your hands went AFK for 1.14 seconds before pair two. That is not “turning style”; it is a loading screen,
                  and it appeared in 7 of the last 12 solves. Track the next pair before finishing the first one.
                </p>
              </div>
            )}
          </article>

          <article className="prescription-card panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow green">TODAY'S PRESCRIPTION</span>
                <h2>{prescription.title}</h2>
              </div>
              <strong>{prescription.duration}</strong>
            </div>
            <div className="block-list">
              {prescription.blocks.map((block, index) => {
                const completed = completedBlocks.includes(block.kind)
                return (
                  <button
                    className={completed ? 'training-block completed' : 'training-block'}
                    key={block.kind}
                    onClick={() => toggleBlock(block.kind)}
                  >
                    <span className="block-number">{blockGlyphs[block.kind]}</span>
                    <span className="block-copy">
                      <strong>{block.label}</strong>
                      <small>{block.dose}</small>
                    </span>
                    <span className="block-target">{completed ? 'DONE' : block.target}</span>
                    <span className="check">{completed ? '✓' : index + 1}</span>
                  </button>
                )
              })}
            </div>
            <div className="transfer-gate">
              <span>PASS CONDITION</span>
              <strong>≤ 380 ms median in 12 full solves</strong>
            </div>
          </article>
        </section>

        <section className="playback-panel panel">
          <CubePlayback
            moves={sampleReconstructionMoves}
            scramble={sampleScramble}
            stages={sampleReconstructionStages}
            title="Solve playback"
          />
        </section>

        <section className="stage-panel panel">
          <div className="panel-heading compact">
            <div>
              <span className="eyebrow">SOLVE #1042 / 23.84</span>
              <h2>Where the time went</h2>
            </div>
            <button className="button secondary">Open reconstruction</button>
          </div>
          <div className="stage-track">
            {sampleSolve.stages.map((stage) => {
              const hot = stage.name === analysis.primary.evidence.stage
              return (
                <div className={hot ? 'stage hot' : 'stage'} key={stage.name}>
                  <div className="stage-top">
                    <span>{stage.name}</span>
                    <strong>{formatSeconds(stage.timeMs)}</strong>
                  </div>
                  <div className="stage-bar">
                    <span style={{ width: `${(stage.recognitionMs / stage.timeMs) * 100}%` }} />
                  </div>
                  <div className="stage-meta">
                    <span>{stage.moves} moves</span>
                    <span>{(stage.moves / (stage.executionMs / 1000)).toFixed(1)} TPS</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="legend">
            <span><i className="recognition-key" /> recognition / pause</span>
            <span><i className="execution-key" /> execution</span>
            <span className="legend-note">Click a stage in the full report to inspect raw moves.</span>
          </div>
        </section>

        <section className="lower-grid">
          <article className="trend-panel panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">TRANSFER TREND</span>
                <h2>Ao12 is moving. Pauses are not.</h2>
              </div>
              <span className="trend-value">−4.3s</span>
            </div>
            <TrendChart />
            <div className="chart-axis"><span>Solve 1031</span><span>Today</span></div>
          </article>

          <article className="findings-panel panel">
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">NEXT IN QUEUE</span>
                <h2>Other verified costs</h2>
              </div>
            </div>
            {analysis.findings.slice(1).map((finding, index) => (
              <div className="finding-row" key={finding.id}>
                <span>0{index + 2}</span>
                <div>
                  <strong>{finding.title}</strong>
                  <small>{Math.round(finding.confidence * 100)}% confidence · {formatSeconds(finding.impactMs)} estimated cost</small>
                </div>
                <button aria-label={`Inspect ${finding.title}`}>→</button>
              </div>
            ))}
          </article>
        </section>
        </>}

        {activeNav === 'Live Solve' && <LiveSolve />}
        {activeNav === 'Solves' && <HistoryProgress />}
        {activeNav === 'Train' && <TrainerHub />}
        {activeNav === 'Library' && <><ReconstructEditor /><RecoStudy /></>}
        {activeNav === 'Progress' && <HistoryProgress />}
      </main>
    </div>
  )
}

export default App
