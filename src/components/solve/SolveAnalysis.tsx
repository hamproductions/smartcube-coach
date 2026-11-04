import { Fragment, useEffect, useState } from 'react'
import { css, cx } from 'styled-system/css'
import { stageAdvice } from '../../domain/stageAdvice'
import { betterAlgorithmFor } from '../../domain/betterAlgorithm'
import { coachCatalogue } from '../../domain/coachCatalogue'
import { repositories } from '../../storage/database'
import type { AlgorithmRecord } from '../../domain/models'
import { Cube3D } from './Cube3D'
import { viewRotationForHold } from '../../domain/cubeHold'
import { defaultPreferences, readPreferences } from '../../storage/preferences'
import { readableReconstruction, readableTokens } from '../../domain/reconstructionText'
import { buildInsights } from '../../domain/coachInsights'
import type { SolveRecord, StageRecord } from '../../domain/models'
import { Icon, IC } from '../ui/Icon'
import { DASH, card, mono, plain, sectionTitle } from '../ui/Page'

function SlotSwatch({ colours }: { colours?: Array<{ name: string; hex: string }> }) {
  if (!colours?.length) return null
  return (
    <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '1' })} title={colours.map((colour) => colour.name).join('/')}>
      {colours.map((colour, index) => (
        <span key={`${colour.name}-${index}`} className={css({ w: '10px', h: '10px', borderRadius: '2px', borderWidth: '1px', borderColor: 'rgba(0,0,0,0.5)' })} style={{ background: colour.hex }} />
      ))}
    </span>
  )
}

const STAGE_COLOURS = ['#9333ea', '#4f46e5', '#3b82f6', '#0ea5e9', '#14b8a6', '#f59e0b', '#22c55e']
const SPEEDS = [0.5, 1, 2] as const

const ICONS = {
  restart: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  previous: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  end: ['M6 6l7 6-7 6', 'M18 6v12'],
  pause: ['M8 5v14', 'M16 5v14']
} as const

const secs = (ms?: number) => ms === undefined ? DASH : (ms / 1000).toFixed(2)
const smallLabel = css({ fontSize: 'xs', color: 'inkVariant' })

const transportRaw = css.raw({
  w: '44px', h: '44px', borderRadius: 'pill', display: 'grid', placeItems: 'center', flexShrink: '0',
  bg: 'floating', color: 'ink', cursor: 'pointer', borderWidth: '1px', borderColor: 'floating',
  _hover: { borderColor: 'outline' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' }
})

const toggleRaw = css.raw({
  minH: '44px', px: '4', borderRadius: 'control', borderWidth: '1px', borderColor: 'floating',
  bg: 'transparent', color: 'ink', fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer',
  _hover: { bg: 'floating' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' },
  '&[aria-pressed=true]': { bg: 'green', color: 'onGreen', borderColor: 'green' }
})
const toggle = css(toggleRaw)
const transport = css(transportRaw)

export type SolveAnalysisProps = {
  solve: SolveRecord
  stages: StageRecord[]
  penalty: 'none' | 'plus_two' | 'dnf'
  onPenalty(next: 'none' | 'plus_two' | 'dnf'): void
}

export function SolveAnalysis({ solve, stages, penalty, onPenalty }: SolveAnalysisProps) {
  const [catalogue, setCatalogue] = useState<AlgorithmRecord[]>(() => coachCatalogue([]))
  useEffect(() => {
    void repositories.algorithms.all()
      .then((stored) => setCatalogue(coachCatalogue(stored)))
      .catch(() => undefined)
  }, [])
  const [hold, setHold] = useState({ top: defaultPreferences.diagramTopColor, front: defaultPreferences.diagramFrontColor })
  useEffect(() => {
    void readPreferences()
      .then((prefs) => setHold({ top: prefs.diagramTopColor, front: prefs.diagramFrontColor }))
      .catch(() => undefined)
  }, [])
  const [openStage, setOpenStage] = useState<string>()
  const [index, setIndex] = useState(solve.moves.length)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)

  const offsets = solve.moveOffsetsMs?.length === solve.moves.length ? solve.moveOffsetsMs : undefined
  const realTime = offsets !== undefined
  useEffect(() => {
    if (!playing) return
    if (index >= solve.moves.length) { setPlaying(false); return }
    const gap = offsets ? Math.min(5_000, Math.max(0, offsets[index] - (offsets[index - 1] ?? offsets[0]))) : 320
    const timer = setTimeout(() => setIndex((current) => Math.min(solve.moves.length, current + 1)), gap / speed)
    return () => clearTimeout(timer)
  }, [playing, index, speed, solve.moves.length, offsets])
  const played = solve.moves.slice(0, index)
  const rawMs = solve.endedAt - solve.startedAt
  const shownTime = penalty === 'dnf' ? 'DNF' : secs(rawMs + (penalty === 'plus_two' ? 2000 : 0))
  const tps = rawMs > 0 && solve.moves.length > 0 ? (solve.moves.length / (rawMs / 1000)).toFixed(2) : undefined

  const stageAt = stages.find((stage) => index >= stage.startEvent && index <= stage.endEvent)
    ?? (index >= solve.moves.length ? stages[stages.length - 1] : undefined)
  const strip = readableTokens(solve.moves)
  const solveFrame = stages.find((stage) => stage.frame)?.frame
  const playbackRotation = solveFrame ?? viewRotationForHold(hold.top, hold.front)
  const solveInsights = buildInsights(stages)
  const stop = (next: number) => { setPlaying(false); setIndex(Math.min(solve.moves.length, Math.max(0, next))) }

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: { base: '6', md: '8' }, minW: '0' })}>
      {solve.analysisError && (
        <p role="alert" className={css({ color: 'amber', fontSize: 'sm' })}>
          This solve could not be re-analysed, so its breakdown is from an older analyser: <span className={mono}>{solve.analysisError}</span>
        </p>
      )}

      <header className={css({ display: 'grid', gap: { base: '5', lg: '10' }, gridTemplateColumns: { base: '1fr', lg: 'auto minmax(0, 1fr)' }, alignItems: 'start' })}>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <span className={smallLabel}>Final time</span>
          <span className={cx(mono, css({ fontSize: '6xl', fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.04em', color: penalty === 'dnf' ? 'error' : 'green' }))}>
            {shownTime}
          </span>
          <div className={cx(mono, css({ display: 'flex', flexWrap: 'wrap', columnGap: '4', rowGap: '1', fontSize: 'sm', color: 'inkVariant' }))}>
            {penalty !== 'none' && <span>recorded {secs(rawMs)}</span>}
            <span>{solve.moves.length} moves</span>
            {tps && <span>{tps} TPS</span>}
            <span className={css({ fontFamily: 'sans' })}>{new Date(solve.endedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div role="group" aria-label="Penalty" className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
            <button type="button" aria-pressed={penalty === 'plus_two'} onClick={() => onPenalty(penalty === 'plus_two' ? 'none' : 'plus_two')} className={toggle}>+2</button>
            <button type="button" aria-pressed={penalty === 'dnf'} onClick={() => onPenalty(penalty === 'dnf' ? 'none' : 'dnf')} className={toggle}>DNF</button>
            <span className={smallLabel}>Penalty: {penalty === 'none' ? 'none' : penalty === 'plus_two' ? '+2' : 'DNF'}</span>
          </div>
        </div>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', minW: '0', lg: { pt: '6' } })}>
          <span className={smallLabel}>Scramble</span>
          <p className={cx(mono, css({ fontSize: { base: 'lg', md: 'xl' }, lineHeight: '1.6', wordBreak: 'break-word' }))}>{solve.scramble || DASH}</p>
        </div>
      </header>

      <div className={css({ display: 'grid', gap: '6', gridTemplateColumns: { base: '1fr', lg: 'minmax(0, 5fr) minmax(0, 6fr)' }, alignItems: 'start' })}>
        <section aria-label="Replay" className={cx(card, css({ display: 'flex', flexDirection: 'column', overflow: 'hidden', lg: { position: 'sticky', top: '4' } }))}>
          <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '3', px: '4', pt: '4' })}>
            <h2 className={sectionTitle}>Replay</h2>
            <span className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>
              move {index} / {solve.moves.length} · <span className={css({ color: 'green' })}>{stageAt?.name ?? 'scrambled'}</span>
            </span>
          </div>
          <div className={css({ display: 'grid', placeItems: 'center', py: '4' })}>
            <Cube3D viewRotation={playbackRotation} setupAlg={[solve.scramble, ...played].join(' ')} size={200} />
          </div>

          <div className={css({ px: '4' })}>
            <div className={css({ position: 'relative', h: '2', display: 'flex', gap: '1px', borderRadius: 'pill', overflow: 'hidden', bg: 'surface' })}>
              {stages.map((stage, position) => (
                <div
                  key={stage.id}
                  title={`${stage.name} ${secs((stage.recognitionMs ?? 0) + (stage.executionMs ?? 0))}s`}
                  style={{ width: `${(stage.moveCount / Math.max(1, solve.moves.length)) * 100}%`, background: STAGE_COLOURS[position % STAGE_COLOURS.length] }}
                />
              ))}
              <div className={css({ position: 'absolute', top: '0', w: '2px', h: 'full', bg: 'ink' })} style={{ left: `${(index / Math.max(1, solve.moves.length)) * 100}%` }} />
            </div>
          </div>

          <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2', px: '4', py: '4' })}>
            <button type="button" aria-label="Restart" onClick={() => stop(0)} className={transport}><Icon d={ICONS.restart} size={18} /></button>
            <button type="button" aria-label="Previous move" onClick={() => { setPlaying(false); setIndex((current) => Math.max(0, current - 1)) }} className={transport}><Icon d={ICONS.previous} size={18} /></button>
            <button
              type="button"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => {
                if (index >= solve.moves.length) setIndex(0)
                setPlaying((current) => !current)
              }}
              className={css(transportRaw, { w: '56px', h: '56px', bg: 'green', borderColor: 'green', color: 'onGreen', _hover: { bg: 'greenBright', borderColor: 'greenBright' } })}
            ><Icon d={playing ? ICONS.pause : IC.play} size={20} strokeWidth={2.2} /></button>
            <button type="button" aria-label="Next move" onClick={() => { setPlaying(false); setIndex((current) => Math.min(solve.moves.length, current + 1)) }} className={transport}><Icon d={ICONS.next} size={18} /></button>
            <button type="button" aria-label="End" onClick={() => stop(solve.moves.length)} className={transport}><Icon d={ICONS.end} size={18} /></button>
          </div>

          <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3', flexWrap: 'wrap', px: '4', pb: '4' })}>
            <span className={smallLabel} title={realTime ? 'Replays the gaps between your own moves' : 'This solve was recorded before per-move timing was stored, so it steps at a fixed 320 ms'}>
              {realTime ? 'Plays at your real speed' : 'Fixed 320 ms per move'}
            </span>
            <div role="group" aria-label="Playback speed" className={css({ display: 'flex', gap: '1' })}>
              {SPEEDS.map((value) => (
                <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)} className={css(toggleRaw, { px: '3', fontSize: 'xs', fontFamily: 'mono' })}>{value}x</button>
              ))}
            </div>
          </div>

          <div aria-label="Moves" className={css({ display: 'flex', flexWrap: 'wrap', gap: '1', px: '3', py: '3', maxH: '10rem', overflowY: 'auto', bg: 'surface', borderTopWidth: '1px', borderColor: 'floating' })}>
            {strip.length === 0
              ? <span className={css({ color: 'inkVariant', fontSize: 'sm', px: '1' })}>No moves recorded.</span>
              : strip.map((token) => {
                const done = token.end < index
                const current = index > token.start && index <= token.end + 1
                return (
                  <button
                    key={`${token.text}-${token.start}`}
                    type="button"
                    aria-current={current ? 'step' : undefined}
                    onClick={() => stop(token.end + 1)}
                    className={cx(mono, css({
                      minW: '2.25rem', minH: '2.25rem', px: '1.5', borderRadius: 'control', cursor: 'pointer', fontSize: 'sm',
                      color: done ? 'ink' : 'outline', bg: current ? 'floating' : 'transparent',
                      boxShadow: current ? 'inset 0 -2px 0 0 #22c55e' : 'none',
                      _hover: { bg: 'floating' },
                      _focusVisible: { outline: '2px solid', outlineColor: 'green' }
                    }))}
                  >{token.text}</button>
                )
              })}
          </div>
        </section>

        <section aria-labelledby="stages-heading" className={css({ display: 'flex', flexDirection: 'column', gap: '4', minW: '0' })}>
          <h2 id="stages-heading" className={sectionTitle}>Stages</h2>
          {solveInsights.length > 0 && (
            <ul className={css({ display: 'flex', flexDirection: 'column', gap: '3', listStyle: 'none', m: '0', p: '0' })}>
              {solveInsights.map((insight) => (
                <li key={insight.id} className={css({ pl: '3', borderLeftWidth: '2px', borderColor: 'green' })}>
                  <p className={css({ fontSize: 'sm', fontWeight: 'medium' })}>{plain(insight.headline)}</p>
                  <p className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>{plain(insight.evidence)}</p>
                </li>
              ))}
            </ul>
          )}

          {stages.length === 0 ? (
            <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>
              No stage timings for this solve. Stage splits come from smart cube solves; a keyboard solve has no moves to split.
            </p>
          ) : (
            <div className={cx(card, css({ overflowX: 'auto' }))}>
              <table className={css({ w: 'full', borderCollapse: 'collapse', fontSize: 'sm' })}>
                <thead>
                  <tr className={css({ borderBottomWidth: '1px', borderColor: 'floating' })}>
                    <th scope="col" className={css({ px: '3', py: '2.5', textAlign: 'left', fontWeight: 'normal', fontSize: 'xs', color: 'inkVariant' })}>Stage</th>
                    <th scope="col" className={css({ px: '3', py: '2.5', textAlign: 'right', fontWeight: 'normal', fontSize: 'xs', color: 'inkVariant' })}>Time</th>
                    <th scope="col" className={css({ px: '3', py: '2.5', textAlign: 'right', fontWeight: 'normal', fontSize: 'xs', color: 'inkVariant' })}>Moves</th>
                    <th scope="col" className={css({ px: '3', py: '2.5', textAlign: 'right', fontWeight: 'normal', fontSize: 'xs', color: 'inkVariant' })}>TPS</th>
                  </tr>
                </thead>
                <tbody className={mono}>
                  {stages.map((stage, position) => {
                    const ms = stage.recognitionMs === undefined && stage.executionMs === undefined
                      ? undefined
                      : (stage.recognitionMs ?? 0) + (stage.executionMs ?? 0)
                    const active = stageAt?.id === stage.id
                    const better = betterAlgorithmFor(stage, catalogue)
                    const advice = stageAdvice(stage, stages)
                    const setup = stage.setupAlg
                    const expandable = Boolean(better || advice || setup)
                    const open = openStage === stage.id && expandable
                    return (
                      <Fragment key={stage.id}>
                        <tr className={css({ borderTopWidth: position === 0 ? '0' : '1px', borderColor: 'floating', bg: active ? 'floating' : 'transparent' })}>
                          <td className={css({ px: '1', py: '0' })}>
                            <button
                              type="button"
                              aria-expanded={expandable ? open : undefined}
                              onClick={() => {
                                if (expandable) setOpenStage((current) => current === stage.id ? undefined : stage.id)
                                stop(stage.startEvent)
                              }}
                              className={css({
                                w: 'full', minH: '44px', px: '2', display: 'flex', alignItems: 'center', gap: '2', flexWrap: 'wrap', textAlign: 'left',
                                borderRadius: 'control', cursor: 'pointer', fontFamily: 'sans', color: 'ink',
                                _hover: { color: 'greenBright' },
                                _focusVisible: { outline: '2px solid', outlineColor: 'green' }
                              })}
                            >
                              <span aria-hidden className={css({ w: '2', h: '2', borderRadius: 'pill', flexShrink: '0' })} style={{ background: STAGE_COLOURS[position % STAGE_COLOURS.length] }} />
                              <span className={css({ fontWeight: 'medium' })}>{stage.name}</span>
                              {stage.slot && <span className={css({ color: 'inkVariant', fontSize: 'xs' })}>{stage.slot}</span>}
                              <SlotSwatch colours={stage.slotColours} />
                              {stage.caseName && <span className={css({ color: 'inkVariant', fontSize: 'xs' })}>{stage.caseName}</span>}
                              {expandable && <span aria-hidden className={css({ display: { base: 'none', md: 'inline' }, ml: 'auto', color: 'outline', fontSize: 'xs' })}>{open ? 'Hide' : 'Tips'}</span>}
                            </button>
                          </td>
                          <td className={css({ px: '3', textAlign: 'right', color: ms === undefined ? 'inkVariant' : 'ink' })}>{secs(ms)}</td>
                          <td className={css({ px: '3', textAlign: 'right' })}>{stage.moveCount}</td>
                          <td className={css({ px: '3', textAlign: 'right', color: 'inkVariant' })}>{stage.tps === undefined ? DASH : stage.tps.toFixed(2)}</td>
                        </tr>
                        {open && (
                          <tr className={css({ bg: active ? 'floating' : 'transparent' })}>
                            <td colSpan={4} className={css({ px: '4', pb: '4', pt: '1' })}>
                              <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', fontSize: 'xs', fontFamily: 'sans' })}>
                                {better && (
                                  <p className={css({ color: 'green' })}>
                                    {stage.moveCount} moves for {better.caseName}; the {better.moveCount}-move alg is <span className={mono}>{better.algorithm}</span>
                                  </p>
                                )}
                                {advice && <p className={css({ color: 'amber' })}>{plain(advice)}</p>}
                                {setup && (
                                  <p className={css({ color: 'inkVariant' })}>
                                    Setup for this case: <span className={cx(mono, css({ color: 'ink', wordBreak: 'break-word' }))}>{setup}</span>
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {stages.length > 0 && (
        <section aria-labelledby="reconstruction-heading" className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <h2 id="reconstruction-heading" className={sectionTitle}>Reconstruction</h2>
          {stages.some((stage) => stage.frame) && (
            <p className={css({ fontSize: 'sm', color: 'inkVariant', maxW: '70ch' })}>
              Turns are in the cube's own frame, as it reported them. Case names, slots and suggested algorithms are read with the cross down; where a stage needed a rotation to get there, it is shown beside the stage.
            </p>
          )}
          <div className={cx(card, mono, css({ p: { base: '4', md: '5' }, display: 'grid', gridTemplateColumns: { base: '1fr', md: '10rem minmax(0, 1fr)' }, columnGap: '6', rowGap: { base: '1', md: '3' }, fontSize: 'sm' }))}>
            {stages.map((stage) => (
              <Fragment key={stage.id}>
                <span className={css({ fontFamily: 'sans', fontSize: 'xs', color: 'inkVariant', pt: { base: '2', md: '0.5' } })}>
                  {stage.name}{stage.caseName ? ` · ${stage.caseName}` : ''}{stage.frame ? ` · cross down via ${stage.frame}` : ''}
                </span>
                <span className={css({ wordBreak: 'break-word', lineHeight: '1.6' })}>{readableReconstruction(solve.moves.slice(stage.startEvent, stage.endEvent + 1)) || DASH}</span>
              </Fragment>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
