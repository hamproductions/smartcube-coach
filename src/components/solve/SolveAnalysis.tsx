import { Fragment, useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { stageAdvice } from '../../domain/stageAdvice'

import { betterAlgorithmFor } from '../../domain/betterAlgorithm'
import { coachCatalogue } from '../../domain/coachCatalogue'
import { repositories } from '../../storage/database'
import type { AlgorithmRecord } from '../../domain/models'
import { styled } from 'styled-system/jsx'
import { Cube3D } from './Cube3D'
import { viewRotationForHold } from '../../domain/cubeHold'
import { defaultPreferences, readPreferences } from '../../storage/preferences'
import { readableReconstruction, readableTokens } from '../../domain/reconstructionText'
import { buildInsights } from '../../domain/coachInsights'
import type { SolveRecord, StageRecord } from '../../domain/models'

// Ports three export screens describing the same surface at increasing detail:
//   docs/design/stitch/solve_analysis_kinetic_logic_aligned — stage band with playhead
//   docs/design/stitch/solve_analysis_deep_dive             — this layout
//   docs/design/stitch/advanced_solve_analysis_replay       — transport and autoplay
// Structure follows the deep dive; the other two contribute the replay behaviour.
//
// From docs/design/stitch/solve_analysis_deep_dive/code.html: final time and
// scramble across the top, the replay with a scrubbing move strip on the left, and the
// CFOP splits table on the right. Every number here is measured — a stage with no timing
// shows a dash rather than a computed-looking zero.

const Card = styled('div', {
  base: { bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card' }
})

const LabelCaps = styled('span', {
  base: {
    fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
    letterSpacing: '0.14em', textTransform: 'uppercase', color: 'inkVariant'
  }
})

/**
 * The slot's two side colours, recorded by the analyser from the cube's own centres. `FR`/`BL`
 * are named in a frame the solver never chose; the colours are what is in their hands.
 */
function SlotSwatch({ colours }: { colours?: Array<{ name: string; hex: string }> }) {
  if (!colours?.length) return null
  return (
    <span
      className={css({ display: 'inline-flex', alignItems: 'center', gap: '1', ml: '1', verticalAlign: 'middle' })}
      title={colours.map((colour) => colour.name).join('/')}
    >
      {colours.map((colour, index) => (
        <span
          key={`${colour.name}-${index}`}
          className={css({ w: '10px', h: '10px', borderRadius: '2px', borderWidth: '1px', borderColor: 'rgba(0,0,0,0.5)' })}
          style={{ background: colour.hex }}
        />
      ))}
    </span>
  )
}

const Pill = styled('button', {
  base: {
    px: '5', minH: '40px', borderRadius: 'control', bg: 'container', color: 'ink',
    fontFamily: 'sans', fontSize: 'sm', fontWeight: 'medium', cursor: 'pointer',
    borderWidth: '1px', borderColor: 'floating',
    _hover: { bg: 'floating' }
  },
  variants: { active: { true: { bg: 'green', color: 'onGreen', borderColor: 'green' } } }
})

const Round = styled('button', {
  base: {
    // Explicit px: the sizes scale has no numeric entries, so w/h '12' would emit 12px.
    w: '48px', h: '48px', borderRadius: 'pill', display: 'grid', placeItems: 'center',
    bg: 'floating', color: 'ink', cursor: 'pointer',
    borderWidth: '1px', borderColor: 'outline', fontSize: 'lg',
    _hover: { bg: 'outline' }
  },
  variants: { primary: { true: { w: '64px', h: '64px', bg: 'green', color: 'onGreen', borderColor: 'green', fontSize: '2xl', _hover: { bg: 'greenBright' } } } }
})

// Cool to warm across the solve, ending on the primary green.
const STAGE_COLOURS = ['#9333ea', '#4f46e5', '#3b82f6', '#0ea5e9', '#14b8a6', '#f59e0b', '#22c55e']

const DASH = '—'
const secs = (ms?: number) => ms === undefined ? DASH : (ms / 1000).toFixed(2)

export type SolveAnalysisProps = {
  solve: SolveRecord
  stages: StageRecord[]
  penalty: 'none' | 'plus_two' | 'dnf'
  onPenalty(next: 'none' | 'plus_two' | 'dnf'): void
  /** Aim the app at the position this stage started from, so the case can be tried again. */
  onRetryStage?(setup: string): void
}

const SPEEDS = [0.5, 1, 2] as const

export function SolveAnalysis({ solve, stages, penalty, onPenalty }: SolveAnalysisProps) {
  // The case catalogue is already stored for the trainer; this is a lookup, not new data.
  // Falls back to the compiled case tables: the stored catalogue only exists once the
  // Training page has been opened, and until then a named case had no algorithm to show.
  const [catalogue, setCatalogue] = useState<AlgorithmRecord[]>(() => coachCatalogue([]))
  useEffect(() => {
    void repositories.algorithms.all()
      .then((stored) => setCatalogue(coachCatalogue(stored)))
      .catch(() => undefined)
  }, [])
  // The playback cube is shown in the hold the solver actually uses, same as the cockpit.
  const [hold, setHold] = useState({ top: defaultPreferences.diagramTopColor, front: defaultPreferences.diagramFrontColor })
  useEffect(() => {
    void readPreferences()
      .then((prefs) => setHold({ top: prefs.diagramTopColor, front: prefs.diagramFrontColor }))
      .catch(() => undefined)
  }, [])
  // Accordion: every stage's advice was on screen at once, which buried the numbers. One
  // stage open at a time, and clicking a row also seeks the player to that stage.
  const [openStage, setOpenStage] = useState<string>()
  const [index, setIndex] = useState(solve.moves.length)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)

  // Autoplay replays the solve at the speed it was turned, using the gaps between the
  // recorded moves. A solve captured before those were stored has none, and then this falls
  // back to a fixed cadence — which is not the real rhythm, so the player says so.
  const offsets = solve.moveOffsetsMs?.length === solve.moves.length ? solve.moveOffsetsMs : undefined
  const realTime = offsets !== undefined
  useEffect(() => {
    if (!playing) return
    if (index >= solve.moves.length) { setPlaying(false); return }
    // A long think between two moves is real, but sitting through a 30s pause is not
    // watching a solve, so the gap is capped.
    const gap = offsets ? Math.min(5_000, Math.max(0, offsets[index] - (offsets[index - 1] ?? offsets[0]))) : 320
    const timer = setTimeout(() => setIndex((current) => Math.min(solve.moves.length, current + 1)), gap / speed)
    return () => clearTimeout(timer)
  }, [playing, index, speed, solve.moves.length, offsets])
  const played = solve.moves.slice(0, index)
  const totalMs = solve.endedAt - solve.startedAt

  // The stage of the move about to be played, so clicking a row highlights that row. The
  // old rule matched on `index > startEvent`, and seeking to a stage's first move therefore
  // landed on the previous stage's last index — clicking F2L 4 highlighted F2L 3.
  const stageAt = stages.find((stage) => index >= stage.startEvent && index <= stage.endEvent)
    ?? (index >= solve.moves.length ? stages[stages.length - 1] : undefined)
  const strip = readableTokens(solve.moves)
  // Show the solve the way the solver held it: cross down. The segmenter already worked out
  // which face the cross is on and stored the rotation that takes the solve there, so the
  // playback uses that rather than a fixed colour preference — a preference cannot know which
  // cross THIS solve used. Falls back to the configured hold when a solve has no stages.
  const solveFrame = stages.find((stage) => stage.frame)?.frame
  const playbackRotation = solveFrame ?? viewRotationForHold(hold.top, hold.front)
  const solveInsights = buildInsights(stages)

  return (
    <div className={css({ flex: '1', minH: '0', overflowY: 'auto', p: '8' })}>
      <div className={css({ maxW: '1280px', mx: 'auto', display: 'grid', gap: 'gutter', gridTemplateColumns: '1fr', lg: { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' } })}>
        {solve.analysisError && (
          <p role="alert" className={css({ lg: { gridColumn: 'span 12' }, color: 'amber', fontSize: 'sm', fontFamily: 'mono' })}>
            This solve could not be re-analysed, so its breakdown is from an older analyser: {solve.analysisError}
          </p>
        )}
        <Card className={css({ lg: { gridColumn: 'span 4' }, p: '6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' })}>
          <LabelCaps className={css({ mb: '2' })}>Final time</LabelCaps>
          <span className={css({ fontFamily: 'mono', fontSize: '8xl', fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.05em', color: 'green' })}>
            {secs(totalMs)}
          </span>
          <div className={css({ mt: '4', display: 'flex', gap: '4', fontSize: 'sm', color: 'inkVariant' })}>
            <span>Penalty: <span className={css({ color: 'ink' })}>{penalty === 'none' ? 'None' : penalty === 'plus_two' ? '+2' : 'DNF'}</span></span>
            <span>{new Date(solve.endedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className={css({ mt: '5', display: 'flex', gap: '3' })}>
            <Pill type="button" active={penalty === 'plus_two'} onClick={() => onPenalty(penalty === 'plus_two' ? 'none' : 'plus_two')}>+2</Pill>
            <Pill type="button" active={penalty === 'dnf'} onClick={() => onPenalty(penalty === 'dnf' ? 'none' : 'dnf')}>DNF</Pill>
          </div>
        </Card>

        <Card className={css({ lg: { gridColumn: 'span 8' }, p: '6', display: 'flex', flexDirection: 'column', justifyContent: 'center' })}>
          <LabelCaps className={css({ mb: '4' })}>Scramble</LabelCaps>
          <p className={css({ fontFamily: 'mono', fontSize: 'xl', color: 'ink', letterSpacing: '0.1em', lineHeight: 'relaxed', wordBreak: 'break-word' })}>
            {solve.scramble || DASH}
          </p>
        </Card>

        {/* Normal size and sticky: the player was taking half the screen and scrolling away
            from the stage rows it is meant to illustrate. */}
        <Card className={css({ lg: { gridColumn: 'span 7', position: 'sticky', top: '4', alignSelf: 'start' }, display: 'flex', flexDirection: 'column', overflow: 'hidden' })}>
          <div className={css({ position: 'relative', minH: '200px', display: 'grid', placeItems: 'center', bg: 'radial-gradient(circle at 50% 45%, rgba(34,197,94,0.07), transparent 65%)' })}>
            <span className={css({ position: 'absolute', top: '4', left: '4', px: '3', py: '1', borderRadius: 'control', bg: 'rgba(9,9,11,0.8)', borderWidth: '1px', borderColor: 'floating', fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>
              move {index} / {solve.moves.length}
            </span>
            <span className={css({ position: 'absolute', top: '4', right: '4', px: '3', py: '1', borderRadius: 'control', bg: 'rgba(9,9,11,0.8)', borderWidth: '1px', borderColor: 'floating', fontFamily: 'mono', fontSize: 'xs', color: 'green' })}>
              {stageAt?.name ?? 'scrambled'}
            </span>
            <Cube3D viewRotation={playbackRotation} setupAlg={[solve.scramble, ...played].join(' ')} size={160} />
          </div>

          {/* Move strip: the solution in the SAME condensed notation as the reconstruction
              below it — the cube reports every quarter turn separately, so the raw stream
              reads `L' L' U D D` where a cuber reads `L2 U D2`. Each token still scrubs to
              the raw move it came from. */}
          <div className={css({ h: '80px', px: '6', display: 'flex', alignItems: 'center', gap: '3', overflowX: 'auto', whiteSpace: 'nowrap', bg: 'surface', borderTopWidth: '1px', borderBottomWidth: '1px', borderColor: 'floating' })}>
            {strip.length === 0
              ? <span className={css({ color: 'inkVariant' })}>No moves recorded.</span>
              : strip.map((token) => {
                const played = token.end < index
                const current = index > token.start && index <= token.end + 1
                return (
                  <button
                    key={`${token.text}-${token.start}`}
                    type="button"
                    onClick={() => setIndex(token.end + 1)}
                    className={css({
                      fontFamily: 'mono', fontSize: 'lg', cursor: 'pointer', pb: '1',
                      color: played ? 'ink' : 'inkVariant',
                      opacity: played ? '1' : '0.5',
                      fontWeight: current ? 'bold' : 'normal',
                      borderBottomWidth: current ? '2px' : '0',
                      borderColor: 'green'
                    })}
                  >{token.text}</button>
                )
              })}
          </div>

          {/* Stage bands with a playhead: width by move share, marker at the cursor. */}
          <div className={css({ px: '6', pt: '5' })}>
            <div className={css({ position: 'relative', h: '2', display: 'flex', gap: '1px', borderRadius: 'pill', overflow: 'hidden', bg: 'surface' })}>
              {stages.map((stage, position) => (
                <div
                  key={stage.id}
                  title={`${stage.name} ${secs((stage.recognitionMs ?? 0) + (stage.executionMs ?? 0))}s`}
                  style={{
                    width: `${(stage.moveCount / Math.max(1, solve.moves.length)) * 100}%`,
                    background: STAGE_COLOURS[position % STAGE_COLOURS.length]
                  }}
                />
              ))}
              <div
                className={css({ position: 'absolute', top: '0', w: '2px', h: 'full', bg: 'ink' })}
                style={{ left: `${(index / Math.max(1, solve.moves.length)) * 100}%` }}
              />
            </div>
          </div>

          <div className={css({ h: '80px', px: '6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4' })}>
            <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
              {/* Say which clock the playback is on. A fixed cadence pretending to be the
                  solve's own rhythm is the kind of thing this app must never do. */}
              <LabelCaps title={realTime
                ? 'Replays the gaps between your own moves'
                : 'This solve was recorded before per-move timing was stored, so it steps at a fixed 320ms'}>
                {realTime ? 'Real speed' : 'Fixed 320ms'}
              </LabelCaps>
              {SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpeed(value)}
                  className={css({
                    px: '3', minH: '32px', borderRadius: 'pill', cursor: 'pointer',
                    fontFamily: 'mono', fontSize: 'xs',
                    bg: speed === value ? 'green' : 'surface',
                    color: speed === value ? 'onGreen' : 'inkVariant'
                  })}
                >x{value}</button>
              ))}
            </div>

            <div className={css({ display: 'flex', alignItems: 'center', gap: '4' })}>
              <Round type="button" aria-label="Restart" onClick={() => { setPlaying(false); setIndex(0) }}>↺</Round>
              <Round type="button" aria-label="Previous move" onClick={() => { setPlaying(false); setIndex((current) => Math.max(0, current - 1)) }}>‹</Round>
              <Round
                type="button"
                primary
                aria-label={playing ? 'Pause' : 'Play'}
                onClick={() => {
                  if (index >= solve.moves.length) setIndex(0)
                  setPlaying((current) => !current)
                }}
              >{playing ? '❚❚' : '▶'}</Round>
              <Round type="button" aria-label="Next move" onClick={() => { setPlaying(false); setIndex((current) => Math.min(solve.moves.length, current + 1)) }}>›</Round>
              <Round type="button" aria-label="End" onClick={() => { setPlaying(false); setIndex(solve.moves.length) }}>⤓</Round>
            </div>

            <span className={css({ w: '96px' })} />
          </div>
        </Card>

        <Card className={css({ lg: { gridColumn: 'span 5' }, display: 'flex', flexDirection: 'column', overflow: 'hidden' })}>
          <div className={css({ px: '6', py: '4', borderBottomWidth: '1px', borderColor: 'floating', bg: 'surface' })}>
            <LabelCaps className={css({ color: 'ink' })}>CFOP splits</LabelCaps>
          </div>

          {/* The same reader the session coach uses, run over this solve's stages alone,
              so a single solve gets read rather than only the aggregate. */}
          {solveInsights.length > 0 && (
            <div className={css({ px: '6', py: '4', borderBottomWidth: '1px', borderColor: 'floating', display: 'flex', flexDirection: 'column', gap: '3' })}>
              <LabelCaps className={css({ color: 'green' })}>This solve</LabelCaps>
              {solveInsights.map((insight) => (
                <div key={insight.id}>
                  <p className={css({ color: 'ink', fontSize: 'sm', fontWeight: 'medium' })}>{insight.headline}</p>
                  <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>{insight.evidence}</p>
                </div>
              ))}
            </div>
          )}

          {stages.length === 0 ? (
            <p className={css({ p: '8', color: 'inkVariant' })}>
              No stage timings for this solve. Replay a captured session to produce them.
            </p>
          ) : (
            <div className={css({ overflowX: 'auto' })}>
              <table className={css({ w: 'full', borderCollapse: 'collapse', textAlign: 'left' })}>
                <thead>
                  <tr className={css({ borderBottomWidth: '1px', borderColor: 'floating' })}>
                    <th className={css({ py: '3', px: '4', fontWeight: 'normal' })}><LabelCaps>Stage</LabelCaps></th>
                    <th className={css({ py: '3', px: '4', fontWeight: 'normal', textAlign: 'right' })}><LabelCaps>Time</LabelCaps></th>
                    <th className={css({ py: '3', px: '4', fontWeight: 'normal', textAlign: 'right' })}><LabelCaps>Moves</LabelCaps></th>
                    <th className={css({ py: '3', px: '4', fontWeight: 'normal', textAlign: 'right' })}><LabelCaps>TPS</LabelCaps></th>
                  </tr>
                </thead>
                <tbody className={css({ fontFamily: 'mono', fontSize: 'sm' })}>
                  {stages.map((stage, position) => {
                    // A stage with no timing at all must dash; summing two undefineds to
                    // 0 printed "0.00" and read as a measurement.
                    const ms = stage.recognitionMs === undefined && stage.executionMs === undefined
                      ? undefined
                      : (stage.recognitionMs ?? 0) + (stage.executionMs ?? 0)
                    const active = stageAt?.id === stage.id
                    // A row with nothing to say must not open: an empty panel reads as a
                    // broken control, and half the stages of a real solve have no advice.
                    const better = betterAlgorithmFor(stage, catalogue)
                    const advice = stageAdvice(stage, stages)
                    // The stage's own position, computed from cube state by the analyser.
                    const setup = stage.setupAlg
                    const expandable = Boolean(better || advice || setup)
                    return (
                      <Fragment key={stage.id}>
                      <tr
                        onClick={() => {
                          if (expandable) setOpenStage((current) => current === stage.id ? undefined : stage.id)
                          setPlaying(false)
                          setIndex(Math.max(0, stage.startEvent))
                        }}
                        className={css({ borderBottomWidth: '1px', borderColor: 'floating', cursor: 'pointer', bg: active ? 'floating' : undefined, _hover: { bg: 'floating' } })}
                      >
                        <td className={css({ py: '3', px: '4', color: 'ink' })}>
                          <span className={css({ display: 'inline-flex', alignItems: 'center', gap: '2' })}>
                            <span className={css({ w: '2', h: '2', borderRadius: 'pill' })} style={{ background: STAGE_COLOURS[position % STAGE_COLOURS.length] }} />
                            {stage.name}
                            {/* Which case it actually was. "F2L 3 took 2.5s" is a measurement;
                                "F2L 3 — pair split, back-left" is the thing you can act on. */}
                            {/* Always say WHICH pair, colours or not: a stage analysed before
                                the colours were recorded showed nothing at all here. */}
                            {stage.slot && (
                              <span className={css({ color: 'inkVariant', fontSize: 'xs' })}>· {stage.slot}</span>
                            )}
                            <SlotSwatch colours={stage.slotColours} />
                            {stage.caseName && (
                              <span className={css({ color: 'inkVariant', fontSize: 'xs' })}>· {stage.caseName}</span>
                            )}
                          </span>
                        </td>
                        <td className={css({ py: '3', px: '4', textAlign: 'right', color: 'inkVariant' })}>{secs(ms)}</td>
                        <td className={css({ py: '3', px: '4', textAlign: 'right', color: 'ink' })}>{stage.moveCount}</td>
                        <td className={css({ py: '3', px: '4', textAlign: 'right', color: 'inkVariant' })}>{stage.tps === undefined ? DASH : stage.tps.toFixed(2)}</td>
                      </tr>
                      {/* Advice and a way to act on it, on the row it belongs to. A table of
                          numbers tells you which stage was slow; this says what to do and
                          sets the cube back to that exact case so you can try it again. */}
                      {openStage === stage.id && expandable && (
                        <tr className={css({ borderBottomWidth: '1px', borderColor: 'floating' })}>
                          <td colSpan={4} className={css({ px: '4', pb: '3', pt: '0' })}>
                            <div className={css({ display: 'flex', gap: '3', alignItems: 'flex-start', flexWrap: 'wrap' })}>
                              {better && (
                                <span className={css({ flex: '1', minW: '18rem', fontFamily: 'mono', fontSize: 'xs', color: 'green' })}>
                                  {stage.moveCount} moves for {better.caseName};
                                  the {better.moveCount}-move alg is {better.algorithm}
                                </span>
                              )}
                              {advice && (
                                <span className={css({ flex: '1', minW: '16rem', fontFamily: 'mono', fontSize: 'xs', color: 'amber' })}>
                                  {advice}
                                </span>
                              )}
                            </div>
                            {/* The setup that puts a real cube back at this exact case. It is
                                derived from the cube state at the stage, not from replaying the
                                scramble plus every move made since — that printed the solver's
                                own history, fumbles included, back at them. No control here
                                touches the app's own scramble. */}
                            {setup && (
                              <div className={css({ mt: '2' })}>
                                <LabelCaps className={css({ fontSize: '2xs' })}>Setup</LabelCaps>
                                <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'ink', letterSpacing: '0.06em', wordBreak: 'break-word' })}>
                                  {setup}
                                </p>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>

              <div className={css({ p: '4', borderTopWidth: '1px', borderColor: 'floating' })}>
                <LabelCaps className={css({ display: 'block', mb: '2' })}>Reconstruction</LabelCaps>
                {stages.some((stage) => stage.frame) && (
                  <p className={css({ mb: '3', fontSize: 'xs', color: 'inkMuted' })}>
                    Turns are in the cube's own frame, as it reported them. Case names, slots and the algorithms offered are read with the cross down; where a stage needed a rotation to get there, it is shown beside the stage.
                  </p>
                )}
                {stages.map((stage) => (
                  <div key={stage.id} className={css({ mb: '3' })}>
                    <span className={css({ fontSize: 'xs', color: 'inkVariant', textTransform: 'uppercase' })}>{stage.name}</span>
                    {stage.caseName && <span className={css({ ml: '2', fontSize: 'xs', color: 'inkVariant' })}>{stage.caseName}</span>}
                    {stage.frame && <span className={css({ ml: '2', fontFamily: 'mono', fontSize: 'xs', color: 'inkMuted' })}>cross-down via {stage.frame}</span>}
                    <div className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'ink', letterSpacing: '0.06em' })}>
                      {readableReconstruction(solve.moves.slice(stage.startEvent, stage.endEvent + 1))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
