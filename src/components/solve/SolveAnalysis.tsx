import { useEffect, useMemo, useRef, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { stageAdvice } from '../../domain/stageAdvice'
import { betterAlgorithmFor } from '../../domain/betterAlgorithm'
import { coachCatalogue } from '../../domain/coachCatalogue'
import { repositories } from '../../storage/database'
import type { AlgorithmRecord, SolveRecord, StageRecord } from '../../domain/models'
import { Cube3D } from './Cube3D'
import { viewRotationForHold } from '../../domain/cubeHold'
import { defaultPreferences, readPreferences } from '../../storage/preferences'
import { readableTokens } from '../../domain/reconstructionText'
import { conjugateQuaternion, gyroDisplayQuaternion, gyroSensorQuaternion, holdQuaternion, type Quaternion } from '../../domain/gyro'
import { gainReason, lossReason, solveVerdict, type SolveVerdict, type StageVerdict } from '../../domain/solveVerdict'
import { turnMetrics } from '../../domain/turnMetrics'
import { setSharedScramble } from '../../device/CubeConnection'
import { navigate, routeHref } from '../../app/route'
import { Icon, IC } from '../ui/Icon'
import { DASH, card, mono, plain, sectionTitle } from '../ui/Page'

const STAGE_COLOURS = ['#9333ea', '#4f46e5', '#5b5bd6', '#6366f1', '#7c83f0', '#3b82f6', '#22c55e', '#94a3b8']
const SPEEDS = [0.5, 1, 1.5, 2] as const
const LEAD_MS = 400
const PAUSE_MS = 700
const FIXED_GAP_MS = 320

const secs = (ms?: number) => ms === undefined ? DASH : (ms / 1000).toFixed(2)
const signed = (ms: number) => `${ms < 0 ? '-' : '+'}${(Math.abs(ms) / 1000).toFixed(2)}s`
const smallLabel = css({ fontSize: 'xs', color: 'inkVariant' })
const stageMs = (stage: StageRecord) => stage.recognitionMs === undefined && stage.executionMs === undefined ? undefined : (stage.recognitionMs ?? 0) + (stage.executionMs ?? 0)
const trainerForStage = (name: string) => /^cross/i.test(name) ? 'cross-plan' : name.startsWith('F2L') ? 'f2l-cube' : /^(OLL|PLL)/.test(name) ? 'cases' : undefined
const slotLabel = (stage: StageRecord) => /^F2L (\d)/.exec(stage.name)?.[1] ? `Slot ${/^F2L (\d)/.exec(stage.name)![1]}` : stage.name

const round = css({
  w: '44px', h: '44px', borderRadius: 'pill', display: 'grid', placeItems: 'center', flexShrink: '0',
  bg: 'floating', color: 'ink', cursor: 'pointer', _hover: { bg: 'outline' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' }
})
const pill = css({
  minH: '44px', px: '4', borderRadius: 'pill', bg: 'floating', color: 'ink', fontSize: 'sm', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: '2', _hover: { bg: 'outline' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' },
  '&[aria-pressed=true]': { bg: 'green', color: 'onGreen' }
})

type Badge = { label: string; tone: 'green' | 'amber' | 'blue' }

function badgeFor(stage: StageRecord, verdict?: StageVerdict): Badge | undefined {
  if (stage.moveCount === 0) return undefined
  if (stage.longestPauseMs !== undefined && stage.longestPauseMs >= 1000) return { label: 'Fumble', tone: 'amber' }
  if (stage.optimalMoveCount !== undefined && stage.moveCount > 0 && stage.moveCount <= stage.optimalMoveCount) return { label: 'Optimal', tone: 'green' }
  if (verdict?.turnDeltaMs !== undefined && verdict.usualMs !== undefined && stage.executionMs !== undefined && verdict.turnDeltaMs <= -0.25 * (stage.executionMs - verdict.turnDeltaMs)) return { label: 'Speedy', tone: 'blue' }
  return undefined
}

const BADGE_COLOUR = { green: { bg: 'rgba(34,197,94,0.14)', fg: '#4be277' }, amber: { bg: 'rgba(245,158,11,0.16)', fg: '#f59e0b' }, blue: { bg: 'rgba(59,130,246,0.18)', fg: '#93b4ff' } }

function countAtOrBefore(sorted: number[], value: number) {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (sorted[middle] <= value) low = middle + 1
    else high = middle
  }
  return low
}

function Swatch({ colours }: { colours?: Array<{ name: string; hex: string }> }) {
  if (!colours?.length) return null
  return (
    <span aria-hidden title={colours.map((colour) => colour.name).join('/')} className={css({ w: '3.5', h: '3.5', borderRadius: '3px', flexShrink: '0', overflow: 'hidden', display: 'inline-block' })}
      style={{ background: colours.length > 1 ? `linear-gradient(135deg, ${colours[0].hex} 50%, ${colours[1].hex} 50%)` : colours[0].hex }} />
  )
}

function copy(text: string) {
  void navigator.clipboard?.writeText(text).catch(() => undefined)
}

export type SolveAnalysisProps = {
  solve: SolveRecord
  stages: StageRecord[]
  history?: StageRecord[]
  penalty: 'none' | 'plus_two' | 'dnf'
  onPenalty(next: 'none' | 'plus_two' | 'dnf'): void
  onDeleted?(): void
}

export function SolveAnalysis({ solve, stages, history = [], penalty, onPenalty, onDeleted }: SolveAnalysisProps) {
  const [catalogue, setCatalogue] = useState<AlgorithmRecord[]>(() => coachCatalogue([]))
  useEffect(() => { void repositories.algorithms.all().then((stored) => setCatalogue(coachCatalogue(stored))).catch(() => undefined) }, [])
  const [hold, setHold] = useState({ top: defaultPreferences.diagramTopColor, front: defaultPreferences.diagramFrontColor })
  useEffect(() => { void readPreferences().then((prefs) => setHold({ top: prefs.diagramTopColor, front: prefs.diagramFrontColor })).catch(() => undefined) }, [])

  const offsets = useMemo(() => solve.moveOffsetsMs?.length === solve.moves.length ? solve.moveOffsetsMs : solve.moves.map((_, index) => index * FIXED_GAP_MS), [solve])
  const duration = Math.max(offsets[offsets.length - 1] ?? 0, solve.endedAt - solve.startedAt, 1)
  const [time, setTime] = useState(duration)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const [useGyro, setUseGyro] = useState(true)
  const [openTips, setOpenTips] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notice, setNotice] = useState<string>()
  const last = useRef(0)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    last.current = performance.now()
    const tick = (now: number) => {
      const elapsed = (now - last.current) * speed
      last.current = now
      setTime((current) => {
        const next = current + elapsed
        if (next >= duration) { setPlaying(false); return duration }
        return next
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, speed, duration])

  const index = time < 0 ? 0 : countAtOrBefore(offsets, time)
  const seek = (next: number) => { setPlaying(false); setTime(Math.min(duration, Math.max(-LEAD_MS, next))) }
  const seekMove = (moveIndex: number) => seek(moveIndex <= 0 ? -LEAD_MS : offsets[Math.min(offsets.length, moveIndex) - 1])
  const togglePlay = () => { if (time >= duration) setTime(-LEAD_MS); setPlaying((current) => !current) }

  const playbackRotation = stages.find((stage) => stage.frame)?.frame ?? viewRotationForHold(hold.top, hold.front)
  const holdTurn = useMemo(() => holdQuaternion(playbackRotation), [playbackRotation])
  const gyroSamples = solve.gyro
  const gyroTimes = useMemo(() => gyroSamples?.map((sample) => sample[0]) ?? [], [gyroSamples])
  const basis = useMemo(() => {
    const reference = solve.gyroReference ?? gyroSamples?.[0]?.slice(1)
    const sensor = reference && gyroSensorQuaternion({ x: reference[0], y: reference[1], z: reference[2], w: reference[3] })
    return sensor ? conjugateQuaternion(sensor) : undefined
  }, [gyroSamples, solve.gyroReference])
  const orientation: Quaternion | null = useMemo(() => {
    if (!useGyro || !gyroSamples?.length || !basis) return null
    const sample = gyroSamples[Math.max(0, countAtOrBefore(gyroTimes, Math.max(0, time)) - 1)]
    const sensor = gyroSensorQuaternion({ x: sample[1], y: sample[2], z: sample[3], w: sample[4] })
    return sensor ? gyroDisplayQuaternion(basis, sensor, holdTurn) : null
  }, [useGyro, gyroSamples, gyroTimes, basis, time, holdTurn])

  const verdict = useMemo(() => solveVerdict(stages, history), [stages, history])
  const verdictFor = (stage: StageRecord) => verdict.stages.find((entry) => entry.stage.id === stage.id)

  const spans = stages.map((stage, position) => {
    const start = position === 0 ? -LEAD_MS : offsets[Math.max(0, stages[position - 1].endEvent)] ?? 0
    const firstMove = offsets[Math.min(offsets.length - 1, stage.startEvent)] ?? start
    const end = offsets[Math.min(offsets.length - 1, stage.endEvent)] ?? start
    return { stage, start, firstMove: Math.max(start, firstMove), end, colour: STAGE_COLOURS[position % STAGE_COLOURS.length] }
  })
  const span = duration + LEAD_MS
  const at = (ms: number) => ((ms + LEAD_MS) / span) * 100
  const activeStage = time < 0 ? undefined : spans.find((entry) => time <= entry.end)?.stage ?? stages[stages.length - 1]

  const rawMs = solve.endedAt - solve.startedAt
  const shownTime = penalty === 'dnf' ? 'DNF' : secs(rawMs + (penalty === 'plus_two' ? 2000 : 0))
  const metrics = useMemo(() => turnMetrics(stages.length
    ? stages.flatMap((stage) => readableTokens(solve.moves.slice(stage.startEvent, stage.endEvent + 1)).map((token) => token.text))
    : readableTokens(solve.moves).map((token) => token.text)), [solve.moves, stages])
  const tps = rawMs > 0 && metrics.htm > 0 ? (metrics.htm / (rawMs / 1000)).toFixed(2) : DASH
  const pauses = stages.reduce((sum, stage) => sum + (stage.pauseCount ?? 0), 0)
  const fluency = stages.length && solve.moves.length ? `${Math.max(0, 100 - Math.round((pauses / solve.moves.length) * 100))}%` : DASH
  const reconstructionText = stages.map((stage) => `${readableTokens(solve.moves.slice(stage.startEvent, stage.endEvent + 1)).map((token) => token.text).join(' ')} // ${stage.name}${stage.caseName ? ` (${stage.caseName})` : ''}`).join('\n')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input:not([type=range]), textarea, select, button, a, [role=dialog]')) return
      if (event.code === 'Space') { event.preventDefault(); togglePlay() }
      else if (event.key === 'ArrowRight') { event.preventDefault(); seekMove(index + 1) }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); seekMove(index - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const groups = [
    { title: 'Cross', stages: stages.filter((stage) => stage.name === 'Cross') },
    { title: 'F2L', stages: stages.filter((stage) => stage.name.startsWith('F2L')) },
    { title: 'OLL', stages: stages.filter((stage) => stage.name === 'OLL') },
    { title: 'PLL', stages: stages.filter((stage) => stage.name === 'PLL') },
    { title: 'Other', stages: stages.filter((stage) => !/^(Cross|F2L|OLL|PLL)/.test(stage.name)) }
  ].filter((group) => group.stages.length > 0)

  const summary = [
    { label: 'Time', value: shownTime, tone: penalty === 'dnf' ? 'error' : 'green' },
    { label: 'TPS', value: tps },
    { label: 'Turns', value: String(metrics.htm) },
    { label: 'Fluency', value: fluency, hint: 'Share of turns that were not followed by a pause' },
    { label: 'Date', value: new Date(solve.endedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) },
    { label: 'Cube', value: solve.deviceId ?? (solve.source === 'keyboard' ? 'Keyboard' : DASH) }
  ]

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: { base: '5', md: '6' }, minW: '0' })}>
      {solve.analysisError && (
        <p role="alert" className={css({ color: 'amber', fontSize: 'sm' })}>This solve could not be re-analysed, so its breakdown is from an older analyser: <span className={mono}>{solve.analysisError}</span></p>
      )}

      <section aria-label="Summary" className={cx(card, css({ display: 'grid', gridTemplateColumns: { base: 'repeat(3, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' } }))}>
        {summary.map((item, position) => (
          <div key={item.label} title={item.hint} className={css({ p: '4', display: 'flex', flexDirection: 'column', gap: '2', minW: '0', borderLeftWidth: { base: position % 3 === 0 ? '0' : '1px', md: position === 0 ? '0' : '1px' }, borderColor: 'floating' })}>
            <span className={smallLabel}>{item.label}</span>
            <span className={cx(mono, css({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: 'semibold', truncate: true }))} style={item.tone === 'green' ? { color: '#22c55e' } : item.tone === 'error' ? { color: '#ffb4ab' } : undefined}>{item.value}</span>
          </div>
        ))}
      </section>

      <section aria-label="Scramble" className={cx(card, css({ overflow: 'hidden' }))}>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3', px: '5', py: '4' })}>
          <p className={cx(mono, css({ flex: '1', fontSize: { base: 'md', md: 'lg' }, lineHeight: '1.6', wordBreak: 'break-word' }))}>{solve.scramble || DASH}</p>
          <button type="button" aria-label="Copy scramble" onClick={() => { copy(solve.scramble); setNotice('Scramble copied') }} className={round}><Icon d={['M9 9h11v11H9z', 'M5 15H4V4h11v1']} size={18} /></button>
        </div>
        <button type="button" onClick={() => { void setSharedScramble(solve.scramble).then(() => navigate({ section: 'solve' })) }} className={css({ w: 'full', minH: '12', bg: 'floating', color: 'amber', fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer', _hover: { bg: 'outline' }, _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '-2px' } })}>Use this scramble</button>
      </section>

      <div className={css({ display: 'flex', alignItems: 'center', gap: '2', flexWrap: 'wrap' })}>
        <button type="button" aria-pressed={penalty === 'plus_two'} onClick={() => onPenalty(penalty === 'plus_two' ? 'none' : 'plus_two')} className={pill}>+2</button>
        <button type="button" aria-pressed={penalty === 'dnf'} onClick={() => onPenalty(penalty === 'dnf' ? 'none' : 'dnf')} className={pill}>DNF</button>
        {confirmDelete ? (
          <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '2', fontSize: 'sm' })}>
            Delete this solve?
            <button type="button" onClick={() => { void Promise.all([repositories.solves.remove(solve.id), ...stages.map((stage) => repositories.stages.remove(stage.id))]).then(() => onDeleted?.()) }} className={css({ minH: '44px', px: '4', borderRadius: 'pill', bg: 'error', color: '#3a0d0a', cursor: 'pointer' })}>Delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className={pill}>Keep</button>
          </span>
        ) : onDeleted && <button type="button" aria-label="Delete solve" onClick={() => setConfirmDelete(true)} className={css({ w: '44px', h: '44px', borderRadius: 'pill', display: 'grid', placeItems: 'center', bg: 'floating', color: 'error', cursor: 'pointer', _hover: { bg: 'outline' } })}><Icon d={['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3']} size={18} /></button>}
        <button type="button" aria-label="Copy link to this solve" onClick={() => { copy(`${window.location.origin}${window.location.pathname}#/stats/${solve.id}`); setNotice('Link copied') }} className={css({ ml: 'auto', w: '44px', h: '44px', borderRadius: 'pill', display: 'grid', placeItems: 'center', bg: 'floating', color: '#93b4ff', cursor: 'pointer', _hover: { bg: 'outline' } })}><Icon d={['M18 8a3 3 0 1 0-2.8-4', 'M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M8.6 13.5l6.8 4', 'M15.4 6.5l-6.8 4']} size={18} /></button>
        {notice && <span role="status" className={css({ fontSize: 'xs', color: 'inkVariant' })}>{notice}</span>}
      </div>

      <section aria-label="Replay and reconstruction" className={cx(card, css({ display: 'grid', gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, overflow: 'hidden' }))}>
        <div className={css({ p: { base: '4', md: '6' }, display: 'flex', flexDirection: 'column', gap: '4' })}>
          <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3', flexWrap: 'wrap' })}>
            <h2 className={sectionTitle}>Replay</h2>
            <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
              <label className={css({ display: 'flex', alignItems: 'center', gap: '2', fontSize: 'sm' })}>
                Speed
                <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className={css({ minH: '44px', px: '3', borderRadius: 'pill', bg: 'floating', color: 'ink', fontFamily: 'mono', fontSize: 'sm' })}>
                  {SPEEDS.map((value) => <option key={value} value={value}>x{value}</option>)}
                </select>
              </label>
              <button type="button" role="switch" aria-checked={useGyro && Boolean(gyroSamples?.length)} disabled={!gyroSamples?.length} onClick={() => setUseGyro((value) => !value)} title={gyroSamples?.length ? 'Show how you held and rotated the cube' : 'No gyro was recorded for this solve'} className={css({ display: 'flex', alignItems: 'center', gap: '2', minH: '44px', fontSize: 'sm', cursor: 'pointer', _disabled: { opacity: '0.45', cursor: 'default' } })}>
                Gyro
                <span aria-hidden className={css({ w: '11', h: '6', borderRadius: 'pill', position: 'relative', transition: 'background 120ms' })} style={{ background: useGyro && gyroSamples?.length ? '#22c55e' : '#3f3f46' }}>
                  <span className={css({ position: 'absolute', top: '1', w: '4', h: '4', borderRadius: 'pill', bg: 'ink', transition: 'left 120ms' })} style={{ left: useGyro && gyroSamples?.length ? '24px' : '4px' }} />
                </span>
              </button>
            </div>
          </div>

          <div className={css({ aspectRatio: '1', w: 'full', maxW: '20rem', mx: 'auto' })}>
            <Cube3D viewRotation={playbackRotation} setupAlg={[solve.scramble, ...solve.moves.slice(0, index)].join(' ')} orientation={orientation} />
          </div>

          <p className={cx(mono, css({ textAlign: 'center', fontSize: 'md', color: 'inkVariant', fontVariantNumeric: 'tabular-nums' }))}>
            <span className={css({ color: 'ink' })}>{secs(Math.max(0, time))}</span> / {secs(duration)}
            {activeStage && <span className={css({ ml: '3', fontFamily: 'sans', fontSize: 'sm', color: 'green' })}>{slotLabel(activeStage)}</span>}
          </p>

          <div className={css({ position: 'relative', h: '8' })}>
            <div aria-hidden className={css({ position: 'absolute', insetX: '0', top: '3', h: '2', borderRadius: 'pill', overflow: 'hidden', bg: 'surface' })}>
              {spans.map((entry) => (
                <div key={entry.stage.id}>
                  <div className={css({ position: 'absolute', top: '0', bottom: '0', opacity: '0.35' })} style={{ left: `${at(entry.start)}%`, width: `${at(entry.firstMove) - at(entry.start)}%`, background: entry.colour }} />
                  <div className={css({ position: 'absolute', top: '0', bottom: '0' })} style={{ left: `${at(entry.firstMove)}%`, width: `${Math.max(0.4, at(entry.end) - at(entry.firstMove))}%`, background: entry.colour }} />
                </div>
              ))}
            </div>
            <div aria-hidden className={css({ position: 'absolute', top: '1', w: '1.5', h: '6', bg: 'ink', borderRadius: 'pill', transform: 'translateX(-50%)', pointerEvents: 'none', boxShadow: '0 0 0 2px #18181b' })} style={{ left: `${at(Math.max(-LEAD_MS, time))}%` }} />
            <input type="range" aria-label="Replay position" aria-valuetext={`${secs(Math.max(0, time))} seconds, move ${index} of ${solve.moves.length}`} min={-LEAD_MS} max={duration} step={10} value={Math.round(time)} onChange={(event) => seek(Number(event.target.value))} className={css({ position: 'absolute', inset: '0', w: 'full', h: 'full', opacity: '0', cursor: 'pointer', m: '0' })} />
          </div>

          <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { base: '2', md: '4' } })}>
            <button type="button" aria-label="Start" onClick={() => seek(-LEAD_MS)} className={round}><Icon d={['M6 5v14', 'M18 6l-8 6 8 6']} size={18} /></button>
            <button type="button" aria-label="Previous move" onClick={() => seekMove(index - 1)} className={round}><Icon d="M15 18l-6-6 6-6" size={18} /></button>
            <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay} className={css({ w: '16', h: '16', borderRadius: 'pill', display: 'grid', placeItems: 'center', bg: 'floating', color: 'ink', cursor: 'pointer', _hover: { bg: 'outline' }, _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } })}>
              <Icon d={playing ? ['M9 5v14', 'M15 5v14'] : IC.play} size={24} strokeWidth={2.4} />
            </button>
            <button type="button" aria-label="Next move" onClick={() => seekMove(index + 1)} className={round}><Icon d="M9 18l6-6-6-6" size={18} /></button>
            <button type="button" aria-label="End" onClick={() => seek(duration)} className={round}><Icon d={['M18 5v14', 'M6 6l8 6-8 6']} size={18} /></button>
          </div>
          <p className={css({ fontSize: 'xs', color: 'inkVariant', textAlign: 'center' })}>Space plays and pauses, arrow keys step. Tap any move in the breakdown to jump there.</p>
        </div>

        <div className={css({ bg: 'surface', p: { base: '4', md: '6' }, display: 'flex', flexDirection: 'column', gap: '4', borderLeftWidth: { lg: '1px' }, borderTopWidth: { base: '1px', lg: '0' }, borderColor: 'floating', maxH: { lg: '44rem' }, overflowY: { lg: 'auto' } })}>
          {stages.length === 0 && <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>No reconstruction for this solve. Stage splits come from smart cube solves; a keyboard solve has no moves to split.</p>}
          {groups.map((group) => {
            const groupMs = group.stages.reduce((sum, stage) => sum + (stageMs(stage) ?? 0), 0)
            const single = group.stages.length === 1 && group.title !== 'F2L'
            return (
              <div key={group.title} className={css({ display: 'flex', flexDirection: 'column', gap: '3', pb: '4', borderBottomWidth: '1px', borderColor: 'floating', _last: { borderBottomWidth: '0', pb: '0' } })}>
                {!single && <h3 className={cx(mono, css({ fontSize: 'md', fontWeight: 'semibold', textTransform: 'uppercase' }))}>{group.title} <span className={css({ color: 'inkVariant' })}>[{secs(groupMs)}]</span></h3>}
                {group.stages.map((stage) => {
                  const judged = verdictFor(stage)
                  const badge = badgeFor(stage, judged)
                  const tokens = readableTokens(solve.moves.slice(stage.startEvent, stage.endEvent + 1))
                  const better = betterAlgorithmFor(stage, catalogue)
                  const advice = stageAdvice(stage, stages)
                  const tips = Boolean(better || advice || stage.setupAlg)
                  const active = activeStage?.id === stage.id
                  return (
                    <div key={stage.id} aria-current={active ? 'step' : undefined} className={css({ display: 'flex', flexDirection: 'column', gap: '1.5', pl: single ? '0' : '3' })}>
                      <div className={css({ display: 'flex', alignItems: 'center', gap: '2', flexWrap: 'wrap' })}>
                        <button type="button" onClick={() => seekMove(stage.startEvent)} className={css({ display: 'inline-flex', alignItems: 'center', gap: '2', minH: '44px', cursor: 'pointer', _hover: { color: 'greenBright' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}>
                          <Swatch colours={stage.slotColours} />
                          <span className={cx(mono, css({ fontWeight: 'semibold', textTransform: 'uppercase', color: active ? 'green' : 'ink' }))}>{slotLabel(stage)}</span>
                          {single && <span className={cx(mono, css({ color: 'inkVariant' }))}>[{secs(stageMs(stage))}]</span>}
                        </button>
                        {badge && <span className={cx(mono, css({ px: '2', py: '1', borderRadius: 'pill', fontSize: 'xs', fontWeight: 'semibold', textTransform: 'uppercase' }))} style={{ background: BADGE_COLOUR[badge.tone].bg, color: BADGE_COLOUR[badge.tone].fg }}>{badge.label}</span>}
                        {stage.caseName && <span className={cx(mono, css({ px: '2', py: '1', borderRadius: 'pill', bg: 'floating', fontSize: 'xs' }))}>{stage.caseName}</span>}
                        {!single && <span className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>{secs(stageMs(stage))}s</span>}
                        {judged?.deltaMs !== undefined && Math.abs(judged.deltaMs) >= 100 && <span className={cx(mono, css({ fontSize: 'xs', color: judged.deltaMs < 0 ? 'green' : 'error' }))} title={`Your usual ${stage.name}: ${secs(judged.usualMs)}s`}>{signed(judged.deltaMs)}</span>}
                        {trainerForStage(stage.name) && <a href={routeHref({ section: 'train', detail: trainerForStage(stage.name) })} className={css({ ml: 'auto', minH: '44px', px: '2', display: 'inline-flex', alignItems: 'center', fontSize: 'xs', color: 'green', textDecoration: 'none', _hover: { textDecoration: 'underline' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}>Train</a>}
                        {tips && <button type="button" aria-expanded={openTips === stage.id} aria-label={`Tips for ${stage.name}`} onClick={() => setOpenTips((current) => current === stage.id ? undefined : stage.id)} className={css({ ml: trainerForStage(stage.name) ? '0' : 'auto', w: '44px', h: '44px', display: 'grid', placeItems: 'center', color: 'inkVariant', cursor: 'pointer', _hover: { color: 'ink' } })}><Icon d={openTips === stage.id ? 'M6 15l6-6 6 6' : 'M9 18l6-6-6-6'} size={16} /></button>}
                      </div>
                      <p className={cx(mono, css({ display: 'flex', flexWrap: 'wrap', columnGap: '2.5', rowGap: '1', fontSize: 'md', pl: single ? '0' : '1' }))}>
                        {tokens.length === 0 ? <span className={smallLabel}>No turns</span> : tokens.map((token) => {
                          const start = stage.startEvent + token.start
                          const end = stage.startEvent + token.end
                          const current = index > start && index <= end + 1
                          const done = end < index
                          return (
                            <button key={`${token.text}-${token.start}`} type="button" aria-current={current ? 'step' : undefined} onClick={() => seekMove(end + 1)}
                              className={css({ cursor: 'pointer', fontWeight: current ? 'bold' : 'normal', color: current ? 'ink' : done ? 'inkVariant' : 'outline', textDecoration: current ? 'underline' : 'none', textUnderlineOffset: '4px', textDecorationColor: '#22c55e', _hover: { color: 'ink' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}
                            >{token.text}</button>
                          )
                        })}
                      </p>
                      {openTips === stage.id && (
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', fontSize: 'xs', pl: '1' })}>
                          {better && <p className={css({ color: 'green' })}>{stage.moveCount} moves for {better.caseName}; the {better.moveCount}-move alg is <span className={mono}>{better.algorithm}</span></p>}
                          {advice && <p className={css({ color: 'amber' })}>{plain(advice)}</p>}
                          {stage.setupAlg && <p className={css({ color: 'inkVariant' })}>Practise this case from solved: <span className={cx(mono, css({ color: 'ink', wordBreak: 'break-word' }))}>{stage.setupAlg}</span></p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
          {stages.length > 0 && (
            <div className={css({ display: 'flex', justifyContent: 'flex-end' })}>
              <button type="button" onClick={() => { copy(reconstructionText); setNotice('Reconstruction copied') }} className={pill}>Copy reconstruction</button>
            </div>
          )}
        </div>
      </section>

      <VerdictPanel verdict={verdict} onSeek={(stage) => seekMove(stage.startEvent)} />

      {stages.length > 0 && <StepCharts stages={stages} solve={solve} penalty={penalty} activeId={activeStage?.id} tokensFor={(stage) => readableTokens(solve.moves.slice(stage.startEvent, stage.endEvent + 1)).map((token) => token.text)} />}

      {stages.length > 0 && <StepTable stages={stages} spans={spans} activeId={activeStage?.id} tokensFor={(stage) => readableTokens(solve.moves.slice(stage.startEvent, stage.endEvent + 1)).map((token) => token.text)} />}
    </div>
  )
}

const CHART_TABS = ['Time per step', 'TPS per step', 'Totals'] as const
const RECOGNITION_COLOUR = '#5b8bd6'
const EXECUTION_COLOUR = '#e0663a'

function niceMax(value: number) {
  if (value <= 0) return 1
  const step = value <= 5 ? 1 : value <= 12 ? 2 : 5
  return Math.ceil(value / step) * step
}

function StepCharts({ stages, solve, penalty, activeId, tokensFor }: { stages: StageRecord[]; solve: SolveRecord; penalty: 'none' | 'plus_two' | 'dnf'; activeId?: string; tokensFor: (stage: StageRecord) => string[] }) {
  const [tab, setTab] = useState<typeof CHART_TABS[number]>('Time per step')
  const W = 640
  const H = 260
  const left = 40
  const bottom = 40
  const top = 28
  const plotW = W - left - 12
  const plotH = H - top - bottom
  const band = plotW / stages.length
  const bars = stages.map((stage) => ({ stage, look: (stage.recognitionMs ?? 0) / 1000, turn: (stage.executionMs ?? 0) / 1000 }))
  const timeMax = niceMax(Math.max(...bars.map((bar) => bar.look + bar.turn)))
  const tps = stages.map((stage) => {
    const htm = turnMetrics(tokensFor(stage)).htm
    const ms = stage.executionMs ?? stageMs(stage)
    return ms && htm ? htm / (ms / 1000) : undefined
  })
  const measured = tps.flatMap((value, position) => value === undefined ? [] : [{ value, position }])
  const tpsMax = niceMax(Math.max(0, ...measured.map((point) => point.value)))
  const max = tab === 'TPS per step' ? tpsMax : timeMax
  const ticks = Array.from({ length: 6 }, (_, position) => (max / 5) * position)
  const y = (value: number) => top + plotH - (value / max) * plotH
  const centre = (position: number) => left + band * position + band / 2
  const recognition = bars.reduce((sum, bar) => sum + bar.look, 0)
  const execution = bars.reduce((sum, bar) => sum + bar.turn, 0)
  const totals = [
    { label: 'Inspection', value: solve.inspectionMs === undefined ? DASH : `${secs(solve.inspectionMs)}s` },
    { label: 'Total recognition', value: `${recognition.toFixed(2)}s` },
    { label: 'Total execution', value: `${execution.toFixed(2)}s` },
    { label: 'Solving time', value: `${secs(solve.endedAt - solve.startedAt)}s` },
    { label: 'Penalty', value: penalty === 'plus_two' ? '+2' : penalty === 'dnf' ? 'DNF' : 'None' },
    { label: 'Steps', value: String(stages.length) }
  ]
  return (
    <section aria-label="Step charts" className={cx(card, css({ p: { base: '4', md: '6' }, display: 'flex', flexDirection: 'column', gap: '4' }))}>
      <div role="tablist" aria-label="Chart" className={css({ display: 'flex', gap: '1', borderBottomWidth: '1px', borderColor: 'floating', overflowX: 'auto' })}>
        {CHART_TABS.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}
            className={css({ minH: '44px', px: '4', fontSize: 'sm', whiteSpace: 'nowrap', color: 'inkVariant', cursor: 'pointer', borderBottomWidth: '2px', borderColor: 'transparent', mb: '-1px', _hover: { color: 'ink' }, '&[aria-selected=true]': { color: 'ink', borderColor: 'green' }, _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '-2px' } })}
          >{name}</button>
        ))}
      </div>
      {tab === 'Totals' ? (
        <div className={css({ display: 'grid', gap: '3', gridTemplateColumns: { base: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } })}>
          {totals.map((item) => (
            <div key={item.label} className={css({ bg: 'surface', borderRadius: 'control', p: '4', display: 'flex', flexDirection: 'column', gap: '1', alignItems: 'center', textAlign: 'center' })}>
              <span className={cx(mono, css({ fontSize: '2xl', fontWeight: 'semibold' }))}>{item.value}</span>
              <span className={smallLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={css({ overflowX: 'auto' })}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tab === 'TPS per step' ? `Turns per second by step: ${stages.map((stage, position) => `${slotLabel(stage)} ${tps[position]?.toFixed(1) ?? 'not measured'}`).join(', ')}` : `Recognition and execution seconds by step: ${bars.map((bar) => `${slotLabel(bar.stage)} ${bar.look.toFixed(2)} looking, ${bar.turn.toFixed(2)} turning`).join(', ')}`} className={css({ w: 'full', minW: '28rem', h: 'auto', display: 'block' })}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={left} x2={W - 12} y1={y(tick)} y2={y(tick)} stroke="#3f3f46" strokeWidth={1} />
                <text x={left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} fill="#a1a1aa" fontFamily="ui-monospace, monospace">{tick % 1 === 0 ? tick : tick.toFixed(1)}</text>
              </g>
            ))}
            {stages.map((stage, position) => stage.id === activeId && <rect key={`active-${stage.id}`} x={left + band * position} y={top} width={band} height={plotH} fill="#ffffff" opacity={0.05} />)}
            {tab === 'Time per step' ? bars.map((bar, position) => {
              const width = Math.min(48, band * 0.7)
              const x = centre(position) - width / 2
              return (
                <g key={bar.stage.id}>
                  <rect x={x} y={y(bar.look)} width={width} height={top + plotH - y(bar.look)} fill={RECOGNITION_COLOUR} rx={2} />
                  <rect x={x} y={y(bar.look + bar.turn)} width={width} height={y(bar.look) - y(bar.look + bar.turn)} fill={EXECUTION_COLOUR} rx={2} />
                </g>
              )
            }) : (
              <>
                <polyline points={measured.map(({ value, position }) => `${centre(position)},${y(value)}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinejoin="round" />
                {measured.map(({ value, position }) => (
                  <g key={stages[position].id}>
                    <circle cx={centre(position)} cy={y(value)} r={4} fill="#22c55e" />
                    <text x={centre(position)} y={y(value) - 10} textAnchor="middle" fontSize={11} fill="#e4e4e7" fontFamily="ui-monospace, monospace">{value.toFixed(1)}</text>
                  </g>
                ))}
              </>
            )}
            {stages.map((stage, position) => (
              <text key={`label-${stage.id}`} x={centre(position)} y={H - bottom + 18} textAnchor="middle" fontSize={11} fill={stage.id === activeId ? '#22c55e' : '#a1a1aa'}>{slotLabel(stage)}</text>
            ))}
          </svg>
          {tab === 'Time per step' && (
            <p className={css({ display: 'flex', gap: '4', fontSize: 'xs', color: 'inkVariant', mt: '2' })}>
              <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '1.5' })}><span aria-hidden className={css({ w: '3', h: '3', borderRadius: '2px' })} style={{ background: RECOGNITION_COLOUR }} />Recognition</span>
              <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '1.5' })}><span aria-hidden className={css({ w: '3', h: '3', borderRadius: '2px' })} style={{ background: EXECUTION_COLOUR }} />Execution</span>
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function StepTable({ stages, spans, activeId, tokensFor }: { stages: StageRecord[]; spans: Array<{ stage: StageRecord; colour: string }>; activeId?: string; tokensFor: (stage: StageRecord) => string[] }) {
  const columns = stages.map((stage) => {
    const metrics = turnMetrics(tokensFor(stage))
    const ms = stageMs(stage)
    return { stage, metrics, ms, colour: spans.find((entry) => entry.stage.id === stage.id)?.colour }
  })
  let running = 0
  const cumulative = columns.map((column) => (running += column.ms ?? 0))
  const totalMs = running
  const sum = (pick: (column: typeof columns[number]) => number | undefined) => columns.reduce((total, column) => total + (pick(column) ?? 0), 0)
  const recognition = sum((column) => column.stage.recognitionMs)
  const execution = sum((column) => column.stage.executionMs)
  const totals = turnMetrics(columns.flatMap((column) => tokensFor(column.stage)))
  const pct = (part: number) => totalMs > 0 ? ` (${Math.round((part / totalMs) * 100)}%)` : ''
  const rows: Array<{ label: string; cells: string[]; total: string }> = [
    { label: 'Recognition', cells: columns.map((column) => column.stage.recognitionMs ? secs(column.stage.recognitionMs) : DASH), total: `${secs(recognition)}${pct(recognition)}` },
    { label: 'Execution', cells: columns.map((column) => secs(column.stage.executionMs)), total: `${secs(execution)}${pct(execution)}` },
    { label: 'Step time', cells: columns.map((column) => secs(column.ms)), total: secs(totalMs) },
    { label: 'Total time', cells: cumulative.map((value) => secs(value)), total: secs(totalMs) },
    { label: 'HTM', cells: columns.map((column) => String(column.metrics.htm)), total: String(totals.htm) },
    { label: 'QTM', cells: columns.map((column) => String(column.metrics.qtm)), total: String(totals.qtm) },
    { label: 'STM', cells: columns.map((column) => String(column.metrics.stm)), total: String(totals.stm) },
    { label: 'ETM', cells: columns.map((column) => String(column.metrics.etm)), total: String(totals.etm) },
    { label: 'TPS', cells: columns.map((column) => {
      const turning = column.stage.executionMs ?? column.ms
      return turning && column.metrics.htm ? (column.metrics.htm / (turning / 1000)).toFixed(2) : DASH
    }), total: totalMs > 0 ? (totals.htm / (totalMs / 1000)).toFixed(2) : DASH }
  ]
  return (
    <section aria-labelledby="step-heading" className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
      <h2 id="step-heading" className={sectionTitle}>Step analysis</h2>
      <div className={cx(card, css({ overflowX: 'auto' }))}>
        <table className={cx(mono, css({ w: 'full', borderCollapse: 'collapse', fontSize: 'sm', fontVariantNumeric: 'tabular-nums' }))}>
          <thead>
            <tr>
              <th className={css({ p: '3' })} />
              {columns.map((column) => (
                <th key={column.stage.id} scope="col" className={css({ p: '3', fontWeight: 'normal', textAlign: 'center', whiteSpace: 'nowrap' })} style={column.stage.id === activeId ? { background: '#27272a' } : undefined}>
                  <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '1.5', fontFamily: 'sans', fontWeight: 'semibold', textTransform: 'uppercase', fontSize: 'xs' })}>
                    {column.stage.slotColours ? <Swatch colours={column.stage.slotColours} /> : <span aria-hidden className={css({ w: '2', h: '2', borderRadius: 'pill' })} style={{ background: column.colour }} />}
                    {slotLabel(column.stage)}
                  </span>
                  {column.stage.caseName && <span className={css({ display: 'block', mt: '1', fontSize: '2xs', color: 'inkVariant' })}>{column.stage.caseName}</span>}
                </th>
              ))}
              <th scope="col" className={css({ p: '3', fontFamily: 'sans', fontWeight: 'semibold', fontSize: 'xs', textTransform: 'uppercase', textAlign: 'center' })}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={css({ borderTopWidth: '1px', borderColor: 'floating' })}>
                <th scope="row" className={css({ p: '3', textAlign: 'left', fontFamily: 'sans', fontWeight: 'normal', fontSize: 'xs', textTransform: 'uppercase', color: 'inkVariant', whiteSpace: 'nowrap' })}>{row.label}</th>
                {row.cells.map((cell, position) => (
                  <td key={position} className={css({ p: '3', textAlign: 'center' })} style={columns[position].stage.id === activeId ? { background: '#27272a' } : undefined}>{cell}</td>
                ))}
                <td className={css({ p: '3', textAlign: 'center', whiteSpace: 'nowrap' })}>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function VerdictPanel({ verdict, onSeek }: { verdict: SolveVerdict; onSeek: (stage: StageRecord) => void }) {
  const judged = verdict.stages.filter((entry) => entry.deltaMs !== undefined).length
  if (judged === 0) {
    return <p className={cx(card, css({ p: '4', fontSize: 'sm', color: 'inkVariant' }))}>After three more smart cube solves, every stage is compared with your own average here, so you can see where this solve gained and lost time.</p>
  }
  const row = (entry: StageVerdict, tone: 'good' | 'bad') => (
    <li key={entry.stage.id}>
      <button type="button" onClick={() => onSeek(entry.stage)} className={css({ w: 'full', minH: '44px', display: 'flex', alignItems: 'baseline', gap: '2', flexWrap: 'wrap', textAlign: 'left', cursor: 'pointer', _hover: { color: 'greenBright' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}>
        <span className={css({ fontWeight: 'medium' })}>{slotLabel(entry.stage)}{entry.stage.caseName ? ` · ${entry.stage.caseName}` : ''}</span>
        <span className={cx(mono, css({ fontSize: 'sm', color: tone === 'good' ? 'green' : 'error' }))}>{signed(entry.deltaMs ?? 0)}</span>
        <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>{tone === 'good' ? gainReason(entry) : lossReason(entry)}</span>
      </button>
    </li>
  )
  return (
    <section aria-label="How this solve went" className={css({ display: 'grid', gap: '4', gridTemplateColumns: { base: '1fr', md: 'repeat(2, minmax(0, 1fr))' } })}>
      <div className={cx(card, css({ p: '5', display: 'flex', flexDirection: 'column', gap: '2' }))}>
        <h2 className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'error' })}>Where you lost time</h2>
        {verdict.biggestLoss && <p>Biggest loss: <strong>{slotLabel(verdict.biggestLoss.stage)}</strong>, {secs(verdict.biggestLoss.deltaMs)}s over your usual {secs(verdict.biggestLoss.usualMs)}s, because {lossReason(verdict.biggestLoss)}.</p>}
        {verdict.bad.length ? <ul className={css({ listStyle: 'none', m: '0', p: '0' })}>{verdict.bad.map((entry) => row(entry, 'bad'))}</ul> : <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>No stage was slower than your usual.</p>}
      </div>
      <div className={cx(card, css({ p: '5', display: 'flex', flexDirection: 'column', gap: '2' }))}>
        <h2 className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'green' })}>What went well</h2>
        {verdict.good.length ? <ul className={css({ listStyle: 'none', m: '0', p: '0' })}>{verdict.good.map((entry) => row(entry, 'good'))}</ul> : <p className={css({ fontSize: 'sm', color: 'inkVariant' })}>No stage beat your usual this time.</p>}
      </div>
    </section>
  )
}
