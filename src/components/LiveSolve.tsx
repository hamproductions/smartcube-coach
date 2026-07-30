import { Alg } from 'cubing/alg'
import { useEffect, useRef, useState } from 'react'
import type { SmartCubeEvent } from '../../node_modules/smartcube-web-bluetooth/src/index'
import { generateScramble } from '../domain/scramble'
import { evaluatePrescriptionTransfer, createPrescriptionRecord } from '../domain/coach'
import { analyzeRecurringErrors } from '../domain/recurrence'
import { segmentCfop } from '../domain/reconstruction'
import type { MetricSample, RawCubeEvent, SolveRecord } from '../domain/models'
import { repositories } from '../storage/database'
import { setCriticalActivity } from '../pwa/register'
import { CaptureSession, type CaptureSnapshot, type CompletedCapture } from '../device/capture'
import { connectWebCube, supportsWebBluetooth, type ConnectedCube } from '../device/webBluetooth'
import { CubePlayback } from './CubePlayback'

const idleSnapshot: CaptureSnapshot = {
  status: 'idle',
  scramble: '',
  scrambleMoves: [],
  solveMoves: [],
  correction: ''
}

export function LiveSolve() {
  const [snapshot, setSnapshot] = useState(idleSnapshot)
  const [connection, setConnection] = useState<ConnectedCube>()
  const [connectionStatus, setConnectionStatus] = useState('Offline simulator ready')
  const [battery, setBattery] = useState<number>()
  const [facelets, setFacelets] = useState('')
  const [lastSaved, setLastSaved] = useState<SolveRecord>()
  const solveId = useRef(crypto.randomUUID())
  const sequence = useRef(0)
  const deviceId = useRef<string | undefined>(undefined)

  const saveCapture = async (capture: CompletedCapture) => {
    const rawEvents = await repositories.rawEvents.forSolve(solveId.current)
    const solveEvents = rawEvents.some((event) => event.phase) ? rawEvents.filter((event) => event.phase === 'solve') : rawEvents.slice(-capture.moves.length)
    const record: SolveRecord = {
      id: solveId.current,
      sessionId: `session-${new Date(capture.startedAt).toISOString().slice(0, 10)}`,
      puzzle: '3x3x3',
      scramble: capture.scramble,
      scrambleGenerator: 'cubing.js-333',
      startedAt: capture.startedAt,
      endedAt: capture.endedAt,
      penalty: 'none',
      deviceId: deviceId.current,
      analysisVersion: '1',
      rawEventIds: solveEvents.map((event) => event.id),
      moves: capture.moves
    }
    const stages = await segmentCfop(capture.scramble, capture.events, record.id)
    const metrics: MetricSample[] = [
      {
        id: `${record.id}:duration`,
        metric: 'solve_duration',
        metricVersion: '1',
        sourceType: 'solve',
        sourceId: record.id,
        value: record.endedAt - record.startedAt,
        unit: 'ms',
        occurredAt: record.endedAt,
        confidence: 1,
        context: { puzzle: record.puzzle, method: 'CFOP' },
        evidence: [{ rawEventId: record.rawEventIds[0], fromEvent: 0, toEvent: Math.max(0, record.rawEventIds.length - 1) }]
      },
      ...stages.flatMap((stage) => {
        const evidence = [{ rawEventId: record.rawEventIds[stage.startEvent], fromEvent: stage.startEvent, toEvent: stage.endEvent }]
        const context = { puzzle: record.puzzle, method: stage.method, stage: stage.name }
        const common = { metricVersion: '1', sourceType: 'stage' as const, sourceId: stage.id, occurredAt: record.endedAt, confidence: stage.confidence, context, evidence }
        return [
          { ...common, id: `${stage.id}:recognition`, metric: stage.name === 'F2L 2' ? 'pair_transition_pause' : 'stage_recognition', value: stage.recognitionMs, unit: 'ms' as const },
          { ...common, id: `${stage.id}:execution`, metric: 'stage_execution', value: stage.executionMs, unit: 'ms' as const },
          { ...common, id: `${stage.id}:moves`, metric: 'stage_moves', value: stage.moveCount, unit: 'moves' as const },
          { ...common, id: `${stage.id}:tps`, metric: 'stage_tps', value: stage.tps, unit: 'tps' as const }
        ]
      })
    ]
    await repositories.solves.put(record)
    await Promise.all(stages.map(repositories.stages.put))
    await Promise.all(metrics.map(repositories.metrics.put))
    const allMetrics = await repositories.metrics.all()
    const findings = analyzeRecurringErrors(allMetrics, record.id)
    await Promise.all(findings.map(repositories.findings.put))
    const existingPrescriptions = await repositories.prescriptions.all()
    const pairFinding = findings.find((finding) => finding.metric === 'pair_transition_pause')
    if (pairFinding && !existingPrescriptions.some((item) => item.findingId === pairFinding.id)) {
      const prescription = createPrescriptionRecord({
        id: pairFinding.id,
        metric: 'pair_transition_pause',
        title: 'Second-pair lookahead stalls',
        observed: pairFinding.observed,
        baseline: pairFinding.baseline,
        target: pairFinding.target,
        impactMs: pairFinding.impactMs,
        recurrence: pairFinding.recurrence,
        confidence: pairFinding.confidence,
        priority: pairFinding.impactMs * pairFinding.recurrence * pairFinding.confidence,
        evidence: {
          solveId: record.id,
          stage: pairFinding.evidence[0]?.stage ?? 'F2L 2',
          fromMs: 0,
          toMs: pairFinding.observed
        }
      })
      await repositories.prescriptions.put(prescription)
      await repositories.findings.put({ ...pairFinding, prescriptionId: prescription.id })
    }
    for (const prescription of await repositories.prescriptions.all()) {
      if (['passed', 'not-demonstrated'].includes(prescription.status)) continue
      const evaluation = evaluatePrescriptionTransfer(prescription, allMetrics)
      await repositories.transfers.put(evaluation)
      if (evaluation.status === 'passed' || evaluation.status === 'not-demonstrated') {
        await repositories.prescriptions.put({ ...prescription, status: evaluation.status === 'passed' ? 'passed' : 'not-demonstrated' })
      }
    }
    setLastSaved(record)
  }

  const sessionRef = useRef<CaptureSession | undefined>(undefined)
  sessionRef.current ??= new CaptureSession(saveCapture, setSnapshot)
  const session = sessionRef.current
  const captureActive = ['scrambling', 'inspection', 'solving'].includes(snapshot.status)

  useEffect(() => {
    if (!captureActive) return
    setCriticalActivity(true)
    return () => setCriticalActivity(false)
  }, [captureActive])

  const recordEvent = async (event: SmartCubeEvent) => {
    const type = event.type.toLowerCase() as RawCubeEvent['type']
    const captureStatus = session.snapshot.status
    const phase: RawCubeEvent['phase'] = ['inspection', 'solving'].includes(captureStatus) ? 'solve' : captureStatus === 'scrambling' ? 'scramble' : 'device'
    const raw: RawCubeEvent = {
      id: crypto.randomUUID(),
      solveId: solveId.current,
      sequence: sequence.current++,
      phase,
      type,
      cubeTimestamp: event.type === 'MOVE' ? event.cubeTimestamp ?? undefined : undefined,
      hostTimestamp: event.timestamp,
      payload: event
    }
    await repositories.rawEvents.put(raw)

    if (event.type === 'MOVE') await session.handleMove(event.move, event.cubeTimestamp, event.timestamp)
    if (event.type === 'BATTERY') setBattery(event.batteryLevel)
    if (event.type === 'FACELETS') setFacelets(event.facelets)
    if (event.type === 'DISCONNECT') {
      setConnection(undefined)
      setConnectionStatus('Cube disconnected')
    }
  }

  const createScramble = async () => {
    solveId.current = crypto.randomUUID()
    sequence.current = 0
    setLastSaved(undefined)
    await session.setScramble(await generateScramble())
  }

  const connect = async () => {
    try {
      const cube = await connectWebCube(recordEvent, setConnectionStatus)
      deviceId.current = cube.mac || cube.name
      setConnection(cube)
      setConnectionStatus(`${cube.name} · ${cube.protocol}`)
    } catch (error) {
      setConnectionStatus(error instanceof Error ? error.message : 'Connection failed')
    }
  }

  const simulateMove = async (move: string, timestamp: number) => {
    const faces = 'URFDLB'
    await recordEvent({
      type: 'MOVE',
      face: Math.max(0, faces.indexOf(move[0])),
      direction: move.includes("'") ? -1 : 1,
      move,
      localTimestamp: timestamp,
      cubeTimestamp: timestamp,
      timestamp
    })
  }

  const applyWithSimulator = async () => {
    let timestamp = Date.now()
    for (const move of snapshot.scramble.split(/\s+/).filter(Boolean)) {
      timestamp += 40
      await simulateMove(move, timestamp)
    }
  }

  const solveWithSimulator = async () => {
    if (snapshot.status === 'ready') session.beginInspection(Date.now())
    let timestamp = Date.now()
    for (const move of new Alg(snapshot.scramble).invert().toString().split(/\s+/).filter(Boolean)) {
      timestamp += 80
      await simulateMove(move, timestamp)
    }
  }

  const moveStages = snapshot.solveMoves.length
    ? [{ label: 'Captured moves', alg: snapshot.solveMoves.join(' '), moves: snapshot.solveMoves }]
    : []

  return (
    <section className="surface-stack">
      <article className="panel live-console">
        <div className="surface-heading">
          <div>
            <span className="eyebrow green">LIVE SOLVE / IMMUTABLE TELEMETRY</span>
            <h2>Connect, verify, inspect, solve.</h2>
          </div>
          <span className={`capture-status ${snapshot.status}`}>{snapshot.status}</span>
        </div>

        <div className="device-toolbar">
          <div>
            <strong>{connectionStatus}</strong>
            <small>{supportsWebBluetooth() ? 'Web Bluetooth available' : 'Use Chromium desktop or Android for physical cubes'}</small>
          </div>
          <button className="button secondary" onClick={connect}>{connection ? 'Reconnect' : 'Connect cube'}</button>
          <button className="button primary" onClick={createScramble}>New scramble</button>
        </div>

        <div className="live-grid">
          <div className="scramble-console">
            <span>Target scramble</span>
            <strong>{snapshot.scramble || 'Generate a scramble to begin'}</strong>
            <div className="scramble-progress">
              <span>{snapshot.scrambleMoves.length} physical moves</span>
              <span>{snapshot.expectedMove ? `Next ${snapshot.expectedMove}` : 'State check pending'}</span>
              {snapshot.wrongMove && <span className="error">Wrong {snapshot.wrongMove}</span>}
            </div>
            {snapshot.correction && <p>Correction from current state: <code>{snapshot.correction}</code></p>}
          </div>
          <div className="timer-console">
            <span>Corrected timer</span>
            <strong>{snapshot.endedAt && snapshot.startedAt ? `${((snapshot.endedAt - snapshot.startedAt) / 1000).toFixed(3)}` : '0.000'}</strong>
            <small>{snapshot.solveMoves.length} moves · battery {battery === undefined ? '—' : `${battery}%`}</small>
          </div>
        </div>

        <div className="simulator-toolbar">
          <span>Replay/simulator harness</span>
          <button disabled={!snapshot.scramble || snapshot.status !== 'scrambling'} onClick={applyWithSimulator}>Apply scramble</button>
          <button disabled={snapshot.status !== 'ready'} onClick={() => session.beginInspection()}>Start inspection</button>
          <button disabled={!['ready', 'inspection'].includes(snapshot.status)} onClick={solveWithSimulator}>Run verified solve</button>
        </div>

        {facelets && <small className="facelet-readout">Facelets {facelets}</small>}
        {lastSaved && <p className="save-confirmation">Saved solve #{lastSaved.id.slice(0, 8)} with raw events and recomputable analysis.</p>}
      </article>

      {snapshot.scramble && (
        <article className="panel playback-panel">
          <CubePlayback title="Live cube and move stream" scramble={snapshot.scramble} moves={snapshot.solveMoves} stages={moveStages} />
        </article>
      )}
    </section>
  )
}
