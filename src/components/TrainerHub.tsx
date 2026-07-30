import { useEffect, useMemo, useState } from 'react'
import { generateBldDrill, validateMemo } from '../domain/bld'
import { chooseTrainingCase, defaultAlgorithms, progressiveHint, updateMastery } from '../domain/training'
import type { AlgorithmRecord, TrainerAttempt } from '../domain/models'
import { repositories } from '../storage/database'
import { setCriticalActivity } from '../pwa/register'
import { CubePlayback } from './CubePlayback'

const cognitiveDrills = [
  'Cross + first-pair inspection',
  'Piece tracking',
  'Pair prediction',
  'Color inference',
  'Free-pair preservation',
  'Two-sided recognition',
  'Algorithm time attack',
  'Metronome TPS control'
]

export function TrainerHub() {
  const [algorithms, setAlgorithms] = useState<AlgorithmRecord[]>([])
  const [attempts, setAttempts] = useState<TrainerAttempt[]>([])
  const [set, setSet] = useState<'F2L' | 'OLL' | 'PLL'>('F2L')
  const [mode, setMode] = useState<'Drill' | 'Learn' | 'Review'>('Drill')
  const [current, setCurrent] = useState<AlgorithmRecord>()
  const [startedAt, setStartedAt] = useState(0)
  const [recognizedAt, setRecognizedAt] = useState(0)
  const [hintLevel, setHintLevel] = useState(0)
  const [answer, setAnswer] = useState('')
  const [selectedDrill, setSelectedDrill] = useState(cognitiveDrills[0])
  const [seed, setSeed] = useState('vector-001')
  const [memo, setMemo] = useState('')
  const [memoResult, setMemoResult] = useState('')
  const bld = useMemo(() => generateBldDrill(seed), [seed])

  useEffect(() => {
    void (async () => {
      let stored = await repositories.algorithms.all()
      if (!stored.length) {
        await Promise.all(defaultAlgorithms.map(repositories.algorithms.put))
        stored = defaultAlgorithms
      }
      setAlgorithms(stored)
      setAttempts(await repositories.attempts.all())
    })()
  }, [])

  useEffect(() => {
    if (!current) return
    setCriticalActivity(true)
    return () => setCriticalActivity(false)
  }, [current])

  const available = algorithms.filter((record) => record.set === set)

  const begin = () => {
    const next = chooseTrainingCase(available, attempts)
    setCurrent(next)
    setStartedAt(performance.now())
    setRecognizedAt(0)
    setHintLevel(mode === 'Learn' ? 3 : 0)
    setAnswer('')
  }

  const finish = async (success: boolean) => {
    if (!current) return
    const endedAt = performance.now()
    const attempt: TrainerAttempt = {
      id: crypto.randomUUID(),
      sessionId: `trainer-${new Date().toISOString().slice(0, 10)}`,
      caseId: current.id,
      caseVersion: 1,
      algorithmVariantId: current.id,
      family: 'algorithm',
      protocol: 'typed-answer',
      curriculumMode: mode.toLowerCase() as 'drill' | 'learn' | 'review',
      setup: {
        seed: crypto.randomUUID().replaceAll('-', ''),
        generatorId: 'algorithm-inverse',
        generatorVersion: '1',
        caseId: current.id,
        scramble: current.setup,
        constraintHash: current.id
      },
      input: 'keyboard',
      startedAt,
      endedAt,
      phaseEvents: [
        { phase: 'prompt', at: startedAt, source: 'system' },
        { phase: 'grading', at: endedAt, source: 'user' }
      ],
      recognitionMs: recognizedAt ? recognizedAt - startedAt : undefined,
      executionMs: recognizedAt ? endedAt - recognizedAt : endedAt - startedAt,
      totalMs: endedAt - startedAt,
      outcome: success ? 'success' : 'incorrect',
      answer,
      expectedAnswer: current.name,
      answerCorrect: success,
      hintEvents: Array.from({ length: hintLevel }, (_, index) => ({ at: endedAt, level: `level-${index + 1}` })),
      wrongMoves: success ? 0 : 1,
      divergenceCount: success ? 0 : 1,
      correctionMoveCount: 0,
      recognitionBoundaryConfidence: recognizedAt ? 1 : 0.5,
      rawEventIds: [],
      targetSatisfied: success,
      dataQuality: {
        completeMoveStream: false,
        setupVerifiedByState: false,
        packetLossSuspected: false,
        timingUsable: true,
        notes: ['Typed answer validated against the immutable case name']
      },
      schemaVersion: 1
    }
    const updated = updateMastery(current, success, endedAt - startedAt)
    await repositories.attempts.put(attempt)
    await repositories.algorithms.put(updated)
    const nextAttempts = [...attempts, attempt]
    const nextAlgorithms = algorithms.map((record) => record.id === updated.id ? updated : record)
    setAttempts(nextAttempts)
    setAlgorithms(nextAlgorithms)
    setCurrent(chooseTrainingCase(nextAlgorithms.filter((record) => record.set === set), nextAttempts))
    setStartedAt(performance.now())
    setRecognizedAt(0)
    setHintLevel(mode === 'Learn' ? 3 : 0)
    setAnswer('')
  }

  return (
    <section className="surface-stack">
      <article className="panel trainer-panel">
        <div className="surface-heading">
          <div><span className="eyebrow green">TRAIN / LEARN · DRILL · REVIEW</span><h2>Weak cases return first.</h2></div>
          <button className="button primary" disabled={!available.length} onClick={begin}>{current ? 'Next case' : 'Start session'}</button>
        </div>
        <div className="trainer-tabs">
          {(['F2L', 'OLL', 'PLL'] as const).map((value) => <button className={set === value ? 'active' : ''} key={value} onClick={() => { setSet(value); setCurrent(undefined) }}>{value}</button>)}
          {(['Learn', 'Drill', 'Review'] as const).map((value) => <button className={mode === value ? 'active' : ''} key={value} onClick={() => setMode(value)}>{value}</button>)}
        </div>
        {current ? (
          <div className="trainer-workspace">
            <div className="case-card">
              <span>{current.set} · mastery {Math.round(current.mastery * 100)}%</span>
              <h3>{mode === 'Drill' && hintLevel === 0 ? 'Recognize the case' : current.name}</h3>
              <p>{progressiveHint(current, hintLevel)}</p>
              <label>Case answer<input aria-label="Case answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type the exact case name" /></label>
              <div>
                <button onClick={() => setRecognizedAt(performance.now())} disabled={Boolean(recognizedAt)}>Recognized</button>
                <button onClick={() => setHintLevel((level) => Math.min(3, level + 1))}>Hint {hintLevel}/3</button>
                <button onClick={() => void finish(false)}>Redo</button>
                <button disabled={!answer.trim()} onClick={() => void finish(answer.trim().toLowerCase() === current.name.toLowerCase())}>Submit answer</button>
              </div>
            </div>
            <CubePlayback title={`${mode === 'Drill' && hintLevel === 0 ? 'Hidden case' : current.name} execution`} scramble={current.setup} moves={current.algorithm.split(/\s+/)} stages={[{ label: mode === 'Drill' && hintLevel === 0 ? 'Target algorithm' : current.name, alg: current.algorithm, moves: current.algorithm.split(/\s+/) }]} />
          </div>
        ) : <p className="empty-state">Choose a set and start. Recognition and execution are timed separately; failed cases enter the redo queue.</p>}
        <div className="case-library">
          {available.map((record) => <button key={record.id} onClick={() => setCurrent(record)}><strong>{record.name}</strong><span>{Math.round(record.mastery * 100)}% · target {(record.targetMs / 1000).toFixed(2)}s</span></button>)}
        </div>
      </article>

      <article className="panel cognitive-panel">
        <div className="surface-heading"><div><span className="eyebrow">COGNITIVE DRILLS</span><h2>{selectedDrill}</h2></div></div>
        <div className="cognitive-grid">
          {cognitiveDrills.map((drill) => <button className={selectedDrill === drill ? 'active' : ''} key={drill} onClick={() => setSelectedDrill(drill)}>{drill}</button>)}
        </div>
        <p className="study-prompt">Run 12 prompts. Record recognition before execution. Pass when at least 10 are correct without exceeding the personal baseline.</p>
      </article>

      <article className="panel bld-panel">
        <div className="surface-heading"><div><span className="eyebrow green">BLD LAB / SEEDED + REPRODUCIBLE</span><h2>Memo cycles and parity.</h2></div></div>
        <label>Seed<input value={seed} onChange={(event) => setSeed(event.target.value)} /></label>
        <div className="bld-grid">
          <div><span>Buffer</span><strong>A</strong></div>
          <div><span>Targets</span><strong>{bld.cycles[0].slice(1, -1).join(' ')}</strong></div>
          <div><span>Parity</span><strong>{bld.parity ? 'YES' : 'NO'}</strong></div>
        </div>
        <label>Memo<input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Enter letter pairs" /></label>
        <button className="button secondary" onClick={() => setMemoResult(validateMemo(bld, memo) ? 'Correct memo' : `Expected ${bld.memo}`)}>Validate memo</button>
        {memoResult && <p>{memoResult}</p>}
      </article>
    </section>
  )
}
