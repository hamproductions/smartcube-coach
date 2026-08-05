import type { ReactNode } from 'react'
import { useState } from 'react'
import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'

// Built from the owner's Stitch export, docs/design/stitch/solve_cockpit_kinetic_logic_aligned.
// Refinements from docs/design/stitch/solve_cockpit/code.html and
// docs/design/stitch/timer_solve_dashboard_refined/code.html: solve number above the
// scramble, best solve emphasised, date separators with older days dimmed.
// Three-column cockpit: session solves left, timer and cube centre, averages right.
// Colours, radii and type all come from kinetic_logic/DESIGN.md — do not substitute.

const RAIL = '16rem'

// The rails sit beside the timer on a desktop and stack under it on a phone. Kept as
// side rails at every width, a 390px viewport rendered three columns of ~130px and the
// scramble degraded to one move per line.
const Rail = styled('aside', {
  base: {
    w: { base: 'full', lg: RAIL },
    flexShrink: '0',
    display: 'flex',
    flexDirection: 'column',
    bg: 'container'
  },
  variants: {
    side: {
      left: { borderRightWidth: { base: '0', lg: '1px' }, borderBottomWidth: { base: '1px', lg: '0' }, borderColor: 'floating' },
      right: { borderLeftWidth: { base: '0', lg: '1px' }, borderTopWidth: { base: '1px', lg: '0' }, borderColor: 'floating', bg: '#1c1b1d', p: '4' }
    }
  }
})

const Label = styled('span', {
  base: { fontFamily: 'sans', fontSize: '12px', fontWeight: '700', lineHeight: '16px', color: 'inkVariant' }
})

const Card = styled('div', {
  base: {
    bg: 'container',
    borderWidth: '1px',
    borderColor: 'floating',
    borderRadius: 'card',
    p: '6'
  }
})

// Cross, F2L, OLL, PLL — the export's stage palette, in solve order.
const STAGE_COLOURS = ['#9333ea', '#4f46e5', '#3b82f6', '#22c55e']

export type SolveRow = { id: string; tps: string; time: string; best?: boolean; selected?: boolean; endedAt?: number }
export type StageSplit = { label: string; seconds: number; delta?: string; deltaGood?: boolean; tps?: string }
export type AverageRow = { label: string; now: string; best: string; emphasis?: boolean }

export type SolveCockpitProps = {
  solveNumber?: number
  scramble: string
  elapsed: string
  connected: boolean
  tps?: string
  turns?: number
  fluency?: string
  splits: StageSplit[]
  solves: SolveRow[]
  averages: AverageRow[]
  sessionName: string
  /** The coach's read of the stored solves, shown here so the first page answers "what should
      I work on?" without a detour through another route. */
  insights?: Array<{ id: string; headline: string; evidence: string; detail?: string }>
  onOpenInsights?(): void
  cube: ReactNode
  onConnect(): void
  onSelectSolve(id: string): void
  /** Real session names; when more than one exists the pill becomes a chooser. */
  onReplay?(json: string): void | Promise<void>
  /** Replays a capture through the live tracker instead of straight into storage. */
  onReplayLive?(json: string): void | Promise<void>
  /** True when the hero shows a ready 0.00 rather than a finished result. */
  awaitingSolve?: boolean
  /** Declares the physical cube solved and restarts tracking from there. */
  /** Moves still needed to reach the target scrambled state. */
  scrambleProgress?: { done: number; total: number; offTrack: boolean; undo: string[] }
  onNewScramble?(): void
}

export function SolveCockpit({
  solveNumber, scramble, elapsed, connected, tps, turns, fluency,
  splits, solves, averages, sessionName, insights, onOpenInsights, cube, onConnect, onSelectSolve, onReplay, onReplayLive,
  awaitingSolve, scrambleProgress, onNewScramble
}: SolveCockpitProps) {
  const moves = scramble.trim() ? scramble.trim().split(/\s+/) : []
  // Off track means the turns no longer prefix the scramble; the correction is the way back.
  // Only an off-track state WITH a way back is worth showing: a panel with no moves in it
  // tells the solver nothing.
  // Off track is off track whether or not a short way back was found. Requiring moves to
  // show it meant the panel appeared only when the app had something to print — and when it
  // had nothing, the route to the fully scrambled cube got printed instead.
  const offTrack = Boolean(scrambleProgress?.offTrack)
  const [trendWindow, setTrendWindow] = useState(12)
  const total = splits.reduce((sum, split) => sum + split.seconds, 0)
  const trend = solves.length > 1
    ? solves.slice(0, trendWindow).reverse().map((solve, index, list) => {
        const values = list.map((entry) => Number(entry.time)).filter((value) => Number.isFinite(value))
        const low = Math.min(...values); const high = Math.max(...values)
        const span = high - low || 1
        const x = (index / Math.max(1, list.length - 1)) * 100
        const y = 38 - ((Number(solve.time) - low) / span) * 36
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
    : ''
  const [whole, fraction] = elapsed.includes('.') ? elapsed.split('.') : [elapsed, undefined]

  return (
    <div className={css({
      display: 'flex',
      flexDirection: { base: 'column', lg: 'row' },
      flex: '1',
      overflowY: { base: 'auto', lg: 'hidden' },
      overflowX: 'hidden',
      minH: '0'
    })}>
      <Rail side="left">
        <div className={css({ p: '4', borderBottomWidth: '1px', borderColor: 'floating' })}>
          <div className={css({
            w: 'full', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: '3', py: '2', minH: 'touch', bg: 'floating', borderRadius: 'control',
            borderWidth: '1px', borderColor: '#353437', color: 'ink', fontWeight: 'medium', cursor: 'pointer'
          })}>{sessionName}</div>
          {/* Replay controls are developer affordances, not product UI — a solver has no
              session JSON. They live in Settings > Diagnostics with the simulator. */}
        </div>

        <div className={css({ flex: '1', overflowY: 'auto', p: '2', fontFamily: 'mono', fontSize: '12px' })}>
          <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', px: '4', py: '2', color: 'inkVariant', fontWeight: 'semibold', mb: '2' })}>
            <span>TPS</span>
            <span className={css({ textAlign: 'right' })}>TIME</span>
          </div>
          <div className={css({ display: 'grid', gap: '1' })}>
            {solves.map((solve, position) => {
              // A date chip whenever the day changes, and older days dimmed, so the
              // current session reads as the live one without hiding history.
              // A timestamp that is missing, zero or not a real date must not render as
              // "Thu, January 1" — an epoch-0 chip reads as a real day the solve happened.
              const dayOf = (value: number | undefined) =>
                value === undefined || !Number.isFinite(value) || value <= 0
                  ? undefined
                  : new Date(value).toDateString()
              const day = dayOf(solve.endedAt)
              const previousDay = position === 0 ? undefined : dayOf(solves[position - 1].endedAt)
              const newestDay = dayOf(solves[0]?.endedAt)
              const startsNewDay = day !== undefined && position > 0 && day !== previousDay
              return (
              <div key={solve.id} className={css({ opacity: day !== undefined && newestDay !== undefined && day !== newestDay ? '0.6' : '1' })}>
              {startsNewDay && (
                <span className={css({
                  display: 'inline-block', mt: '4', mb: '2', mx: '4', px: '2', py: '1',
                  borderRadius: 'control', bg: 'floating', color: 'inkVariant',
                  fontFamily: 'sans', fontSize: '2xs', fontWeight: 'semibold',
                  letterSpacing: '0.08em', textTransform: 'uppercase'
                })}>{new Date(solve.endedAt as number).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}</span>
              )}
              <button
                onClick={() => onSelectSolve(solve.id)}
                className={css({
                  // w:full because these buttons are no longer direct grid items — the
                  // date-chip wrapper broke the stretch, so the row shrink-wrapped and
                  // TPS/TIME stopped lining up under their headers.
                  w: 'full',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', px: '4', py: '2',
                  borderRadius: 'control', cursor: 'pointer', textAlign: 'left',
                  bg: solve.selected ? 'floating' : 'transparent',
                  borderWidth: '1px', borderColor: solve.selected ? '#353437' : 'transparent',
                  _hover: { bg: 'floating' }
                })}
              >
                <span className={css({ color: 'inkVariant' })}>{solve.tps}</span>
                <span className={css({ textAlign: 'right', fontWeight: solve.best ? 'bold' : 'medium', color: solve.best ? 'green' : 'ink' })}>{solve.time}</span>
              </button>
              </div>
            )})}
          </div>
        </div>
      </Rail>

      {/* On a phone the three columns stack and the page scrolls as one, so this section
          must size to its content — as a flex:1 child of a column it collapsed to nothing
          and the scramble, cube and timer disappeared between the two rails. */}
      <section className={css({
        flex: { base: 'none', lg: '1' },
        display: 'flex', flexDirection: 'column', position: 'relative', bg: 'surface',
        overflowY: { base: 'visible', lg: 'auto' },
        px: { base: '4', lg: '8' }, py: { base: '8', lg: '10' }
      })}>
        <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', w: 'full' })}>
          {solveNumber !== undefined && <span className={css({ color: 'inkVariant', fontSize: '14px', mb: '4' })}>#{solveNumber}</span>}
          {/* The move being turned is boxed, so there is no ambiguity mid-scramble. */}
          <div className={css({ fontFamily: 'mono', fontSize: { base: '24px', xl: '34px' }, fontWeight: '500', letterSpacing: '0.06em', textAlign: 'center', color: 'ink', lineHeight: '1.5', maxW: '56rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1' })}>
            {/* Every move carries its own state: turned, next, or not yet reached — and the
                whole scramble greys out when you have wandered off it, because the position
                in the string is meaningless until you undo back onto it. */}
            {moves.map((move, index) => {
              // While off track the confirmed prefix stays lit and the rest dims: the moves
              // before the divergence are still done, so blanking them loses the solver's place.
              const done = index < (scrambleProgress?.done ?? 0)
              const next = !offTrack && index === (scrambleProgress?.done ?? 0)
              const beyond = offTrack && index >= (scrambleProgress?.done ?? 0)
              return (
                <span
                  key={`${move}-${index}`}
                  data-state={beyond ? 'off-track' : done ? 'done' : next ? 'next' : 'pending'}
                  className={css({
                    px: '1', mx: '0.5', borderRadius: 'control',
                    borderWidth: '1px', borderColor: next && !offTrack ? 'green' : 'transparent',
                    bg: next && !offTrack ? 'rgba(34,197,94,0.16)' : 'transparent',
                    color: done ? 'inkVariant' : next ? 'green' : 'ink',
                    opacity: beyond ? '0.35' : done ? '0.45' : '1',
                    transition: 'color 120ms, background 120ms, opacity 120ms'
                  })}
                >{move}</span>
              )
            })}
          </div>
        </div>

        {/* Controls sit UNDER the cube, not stacked on top of it. Three overlaid
            controls buried the one thing this panel exists to show. */}
        <div className={css({ w: '16rem', h: '16rem', mt: '8', mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' })}>
          {cube}
        </div>

        {/* Never gated on a connected cube. The cube is only a source of moves; the app
            owns the state, so every control works with keyboard, cube or replay alike. */}
        <div className={css({ mt: '5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3' })}>
            <div className={css({ display: 'flex', alignItems: 'center', gap: '3', flexWrap: 'wrap', justifyContent: 'center' })}>
              {!connected && (
                <button onClick={onConnect} className={css({
                  display: 'flex', alignItems: 'center', gap: '2', px: '6', minH: 'touch',
                  borderRadius: 'control', bg: 'floating', borderWidth: '1px', borderColor: 'rgba(34,197,94,0.3)',
                  color: 'green', fontWeight: 'medium', cursor: 'pointer'
                })}>Connect Smart Cube</button>
              )}
              {/* The scrambling phase ends when the cube's own state matches the scramble —
                  there is no gesture or button that declares it done. */}
              {onNewScramble && (
                <button
                  type="button"
                  onClick={onNewScramble}
                  className={css({
                    minH: 'touch', px: '6', borderRadius: 'control',
                    bg: 'transparent', color: 'ink', borderWidth: '1px', borderColor: 'floating',
                    cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    _hover: { bg: 'floating' }
                  })}
                >New scramble</button>
              )}
              {/* Reset lives in the header indicator as "Reset cube" — one concept, one
                  control, available on every route. */}
              {/* No "Done scrambling" button: you do not announce that you finished
                  scrambling, you just start solving. The scrambled state is detected from
                  the cube's own position — nothing else ends the phase, which is what stops
                  the timer ever starting on its own. */}
            </div>
            <p className={css({ color: 'inkVariant', fontSize: '14px', fontFamily: 'mono' })}>
              or hold <span className={css({ color: 'amber', fontWeight: 'bold' })}>[SPACE]</span> to start timer
            </p>
            {scrambleProgress !== undefined && scrambleProgress.total > 0 && !offTrack && (
              <div className={css({ w: 'full', maxW: '32rem', display: 'flex', flexDirection: 'column', gap: '1' })}>
                {/* A bar, not just a count: mid-scramble you want to see how far in you are
                    without counting tokens. */}
                <div className={css({ h: '1.5', w: 'full', borderRadius: 'pill', bg: 'floating', overflow: 'hidden' })}>
                  <div
                    className={css({ h: 'full', bg: 'green', transition: 'width 140ms' })}
                    style={{ width: `${Math.round((scrambleProgress.done / scrambleProgress.total) * 100)}%` }}
                  />
                </div>
                <p className={css({ fontFamily: 'mono', fontSize: '12px', color: 'inkVariant', textAlign: 'center' })}>
                  {scrambleProgress.done === scrambleProgress.total
                    ? 'scrambled — start solving when ready'
                    : `${scrambleProgress.done} / ${scrambleProgress.total} scramble moves`}
                </p>
              </div>
            )}
            {scrambleProgress !== undefined && scrambleProgress.total === 0 && (
              <p className={css({ fontFamily: 'mono', fontSize: '12px', color: 'inkVariant' })}>
                scrambled — start solving when ready
              </p>
            )}
            {/* Backtracking: the app knows exactly which turns put you back on the scramble,
                so it shows them instead of telling you that you are wrong and stopping. */}
            {offTrack && (
              <div className={css({
                w: 'full', maxW: '32rem', px: '4', py: '3', borderRadius: 'control',
                bg: 'rgba(239,68,68,0.10)', borderWidth: '1px', borderColor: 'rgba(239,68,68,0.35)',
                display: 'flex', flexDirection: 'column', gap: '1', alignItems: 'center'
              })}>
                <span className={css({ fontFamily: 'sans', fontSize: '2xs', fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'error' })}>
                  Off the scramble
                </span>
                <div className={css({ fontFamily: 'mono', fontSize: '18px', color: 'ink', display: 'flex', flexWrap: 'wrap', gap: '2', justifyContent: 'center' })}>
                  {(scrambleProgress?.undo ?? []).map((move, index) => (
                    <span key={`${move}-${index}`} className={css({ px: '1.5', py: '0.5', borderRadius: 'control', bg: 'floating' })}>{move}</span>
                  ))}
                </div>
                <span className={css({ fontFamily: 'mono', fontSize: '11px', color: 'inkVariant' })}>
                  {(scrambleProgress?.undo.length ?? 0) > 0
                    ? 'turn these to get back on the scramble'
                    : 'more than three turns off — start a new scramble'}
                </span>
              </div>
            )}
        </div>

        <div className={css({ textAlign: 'center', mt: '8', w: 'full' })}>
          {/* Decimals sit at 70% so the whole seconds read first at a glance. */}
          <div className={css({ fontFamily: 'mono', fontSize: { base: '72px', lg: '11rem' }, fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.05em', color: 'green', fontVariantNumeric: 'tabular-nums' })}>
            {whole}{fraction !== undefined && <span className={css({ opacity: '0.7' })}>.{fraction}</span>}
          </div>
          {(tps || turns !== undefined || fluency) && (
            <div className={css({ mt: '4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4', color: 'inkVariant', fontFamily: 'mono', fontSize: '14px' })}>
              {tps && <span>{tps} TPS</span>}
              {turns !== undefined && <><Dot /><span>{turns} turns</span></>}
              {fluency && <><Dot /><span>{fluency} fluency</span></>}
            </div>
          )}
        </div>

        {splits.length > 0 && total > 0 && (
          <div className={css({ alignSelf: 'stretch', maxW: '42rem', w: 'full', mx: 'auto', mt: '16' })}>
            <Card>
              <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '4' })}>
                <h3 className={css({ color: 'ink', fontWeight: 'medium' })}>{awaitingSolve ? 'Last solve · CFOP split' : 'CFOP split'}</h3>
                <span className={css({ fontFamily: 'mono', fontSize: '12px', color: 'inkVariant' })}>{total.toFixed(2)}s</span>
              </div>
              <div className={css({ h: '8', display: 'flex', borderRadius: 'control', overflow: 'hidden', borderWidth: '1px', borderColor: '#353437', fontFamily: 'mono', fontSize: '12px' })}>
                {splits.map((split, index) => (
                  <div
                    key={split.label}
                    title={`${split.label} ${split.seconds.toFixed(2)}s`}
                    className={css({ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'ink', overflow: 'hidden' })}
                    style={{ width: `${(split.seconds / total) * 100}%`, background: `${STAGE_COLOURS[index % STAGE_COLOURS.length]}cc` }}
                  >{split.seconds.toFixed(2)}s</div>
                ))}
              </div>
              <div className={css({ display: 'grid', gap: '4', mt: '6' })} style={{ gridTemplateColumns: `repeat(${Math.min(splits.length, 4)}, minmax(0, 1fr))` }}>
                {splits.map((split, index) => (
                  <div key={split.label}>
                    <div className={css({ display: 'flex', alignItems: 'center', gap: '1.5', mb: '1' })}>
                      <span className={css({ w: '2', h: '2', borderRadius: 'pill' })} style={{ background: STAGE_COLOURS[index % STAGE_COLOURS.length] }} />
                      <Label>{split.label}</Label>
                    </div>
                    <div className={css({ fontFamily: 'mono', fontSize: '14px', color: 'ink' })}>
                      {split.seconds.toFixed(2)}s{' '}
                      {split.delta && <span className={css({ fontSize: '12px', color: split.deltaGood ? 'green' : 'error' })}>({split.delta})</span>}
                    </div>
                    {split.tps && <div className={css({ fontSize: '12px', color: 'inkVariant', mt: '0.5' })}>{split.tps} TPS</div>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
        {/* The coach's read belongs on the page you land on. It used to live only on
            Statistics, so the answer to "what should I work on" was a route away. */}
        {insights && insights.length > 0 && (
          <div className={css({ w: 'full', maxW: '720px', mx: 'auto', mt: '6', display: 'flex', flexDirection: 'column', gap: '3' })}>
            {insights.map((insight, position) => (
              <Card key={insight.id} className={css({ p: '4', display: 'flex', flexDirection: 'column', gap: '1' })}>
                <span className={css({ fontFamily: 'sans', fontSize: '2xs', fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase', color: position === 0 ? 'green' : 'inkVariant' })}>
                  {position === 0 ? 'Biggest win' : 'Also true'}
                </span>
                <h3 className={css({ color: 'ink', fontWeight: 'medium' })}>{insight.headline}</h3>
                <p className={css({ fontFamily: 'mono', fontSize: '12px', color: 'inkVariant' })}>{insight.evidence}</p>
              </Card>
            ))}
            {onOpenInsights && (
              <button
                type="button"
                onClick={onOpenInsights}
                className={css({
                  alignSelf: 'flex-start', px: '4', minH: '40px', borderRadius: 'control',
                  bg: 'transparent', color: 'green', borderWidth: '1px', borderColor: 'floating',
                  cursor: 'pointer', fontFamily: 'sans', fontSize: '2xs', fontWeight: 'bold',
                  letterSpacing: '0.12em', textTransform: 'uppercase'
                })}
              >Full breakdown</button>
            )}
          </div>
        )}
      </section>

      <Rail side="right">
        {/* The export's right rail carries Tournaments and Daily Scramble tiles. This
            app has neither feature, and a tile that navigates nowhere is a lie about
            what the product does, so they are not rendered. */}
        <div className={css({ display: 'grid', gap: '3', fontFamily: 'mono', fontSize: '14px', px: '2' })}>
          {averages.map((row) => (
            <div key={row.label} className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center' })}>
              <div className={css({ color: row.emphasis ? 'green' : 'inkVariant', fontWeight: row.emphasis ? 'medium' : 'normal' })}>{row.label}</div>
              <div className={css({ textAlign: 'right', color: row.emphasis ? 'green' : 'ink', fontWeight: row.emphasis ? 'bold' : 'normal' })}>{row.now}</div>
              <div className={css({ textAlign: 'right', color: 'inkVariant' })}>{row.best}</div>
            </div>
          ))}
        </div>
        {/* Sparkline card closing the rail, with the ao5/ao12 selector from the export. */}
        <div className={css({ mt: '8', position: 'relative', h: '96px', overflow: 'hidden', borderRadius: 'control', borderWidth: '1px', borderColor: '#353437', bg: 'floating', p: '3' })}>
          {/* Was a decorative select with no value and no handler: changing it did
              nothing because the trend was always the last 20 raw times. */}
          <select
            aria-label="Trend window"
            value={trendWindow}
            onChange={(event) => setTrendWindow(Number(event.target.value))}
            className={css({ position: 'absolute', top: '2', right: '2', zIndex: '1', bg: 'container', borderWidth: '1px', borderColor: '#353437', borderRadius: 'control', color: 'inkVariant', fontSize: '2xs', fontFamily: 'mono', px: '1.5', py: '0.5' })}
          >
            <option value={5}>last 5</option>
            <option value={12}>last 12</option>
            <option value={50}>last 50</option>
          </select>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={css({ w: 'full', h: 'full', color: 'green', opacity: '0.8' })}>
            <path d={trend} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </Rail>
    </div>
  )
}

function Dot() {
  return <span className={css({ w: '1', h: '1', bg: 'outline', borderRadius: 'pill' })} />
}
