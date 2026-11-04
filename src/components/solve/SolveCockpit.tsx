import type { ReactNode } from 'react'
import { useState } from 'react'
import { css } from 'styled-system/css'

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
  insights?: Array<{ id: string; headline: string; evidence: string; detail?: string }>
  onOpenInsights?(): void
  cube: ReactNode
  onConnect(): void
  onSelectSolve(id: string): void
  onReplay?(json: string): void | Promise<void>
  onReplayLive?(json: string): void | Promise<void>
  awaitingSolve?: boolean
  scrambleProgress?: { done: number; total: number; offTrack: boolean; undo: string[] }
  onNewScramble?(): void
}

export function SolveCockpit({
  solveNumber, scramble, elapsed, connected, tps, turns, fluency,
  splits, solves, averages, sessionName, insights, onOpenInsights, cube, onConnect, onSelectSolve, onReplay, onReplayLive,
  awaitingSolve, scrambleProgress, onNewScramble
}: SolveCockpitProps) {
  const moves = scramble.trim() ? scramble.trim().split(/\s+/) : []
  const offTrack = Boolean(scrambleProgress?.offTrack)
  const [trendWindow, setTrendWindow] = useState(12)
  const total = splits.reduce((sum, split) => sum + split.seconds, 0)
  const points = solves.slice(0, trendWindow).reverse().map((solve) => Number(solve.time))
  const timed = points.filter((value) => Number.isFinite(value))
  const low = Math.min(...timed)
  const span = Math.max(...timed) - low || 1
  const trend = timed.length > 1
    ? points.map((value, index) => ({ value, index })).filter(({ value }) => Number.isFinite(value)).map(({ value, index }, position) => {
        const x = (index / Math.max(1, points.length - 1)) * 100
        const y = 38 - ((value - low) / span) * 36
        return `${position === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
    : ''
  const [whole, fraction] = elapsed.includes('.') ? elapsed.split('.') : [elapsed, undefined]

  return (
    <div className={css({
      flex: { lg: '1' }, minH: { lg: '0' }, display: 'grid',
      gridTemplateColumns: { base: '1fr', lg: '15rem minmax(0, 1fr) 15rem' },
      gridTemplateAreas: { base: '"stage" "stats" "times"', lg: '"times stage stats"' }
    })}>
      <aside aria-label="Session solves" className={css({ gridArea: 'times', minH: { lg: '0' }, display: 'flex', flexDirection: 'column', borderRightWidth: { lg: '1px' }, borderTopWidth: { base: '1px', lg: '0' }, borderColor: 'floating' })}>
        <div className={css({ px: '5', pt: '5', pb: '3', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' })}>
          <span className={css({ fontSize: 'sm', fontWeight: 'semibold' })}>{sessionName}</span>
        </div>
        <div className={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', px: '5', pb: '2', fontSize: 'xs', color: 'inkVariant' })}>
          <span>TPS</span>
          <span className={css({ textAlign: 'right' })}>Time</span>
        </div>
        <ol className={css({ flex: '1', minH: '0', overflowY: 'auto', listStyle: 'none', m: '0', px: '2', pb: '4', fontFamily: 'mono', fontSize: 'sm', fontVariantNumeric: 'tabular-nums', maxH: { base: '20rem', lg: 'none' } })}>
          {solves.length === 0 && <li className={css({ px: '3', py: '4', fontFamily: 'sans', color: 'inkVariant', fontSize: 'sm' })}>Your solves appear here.</li>}
          {solves.map((solve, position) => {
            const dayOf = (value: number | undefined) => value === undefined || !Number.isFinite(value) || value <= 0 ? undefined : new Date(value).toDateString()
            const day = dayOf(solve.endedAt)
            const startsNewDay = day !== undefined && position > 0 && day !== dayOf(solves[position - 1].endedAt)
            const older = day !== undefined && day !== dayOf(solves[0]?.endedAt)
            return (
              <li key={solve.id} className={css({ opacity: older ? '0.6' : '1' })}>
                {startsNewDay && (
                  <span className={css({ display: 'block', px: '3', pt: '4', pb: '1', fontFamily: 'sans', fontSize: 'xs', color: 'inkVariant' })}>
                    {new Date(solve.endedAt as number).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onSelectSolve(solve.id)}
                  aria-current={solve.selected ? 'true' : undefined}
                  className={css({
                    w: 'full', display: 'grid', gridTemplateColumns: '1fr 1fr', px: '3', py: '1.5', minH: '44px',
                    alignItems: 'center', borderRadius: 'control', cursor: 'pointer', textAlign: 'left',
                    bg: solve.selected ? 'floating' : 'transparent', _hover: { bg: 'floating' },
                    _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '-2px' }
                  })}
                >
                  <span className={css({ color: 'inkVariant' })}>{solve.tps}</span>
                  <span className={css({ textAlign: 'right', fontWeight: solve.best ? 'bold' : 'medium', color: solve.best ? 'green' : 'ink' })}>{solve.time}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </aside>

      <section aria-label="Solve" className={css({ gridArea: 'stage', minH: { lg: '0' }, overflowY: { lg: 'auto' }, display: 'flex', flexDirection: 'column', alignItems: 'center', px: { base: '4', lg: '8' }, pt: { base: '5', lg: '8' }, pb: '10' })}>
        <div className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3', w: 'full', maxW: '52rem' })}>
          {solveNumber !== undefined && <span className={css({ color: 'inkVariant', fontSize: 'sm', fontFamily: 'mono' })}>#{solveNumber}</span>}
          <p aria-label="Scramble" className={css({ fontFamily: 'mono', fontSize: { base: '20px', md: '26px', xl: '30px' }, fontWeight: '500', letterSpacing: '0.04em', lineHeight: '1.5', textAlign: 'center', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: '2' })}>
            {moves.map((move, index) => {
              const done = index < (scrambleProgress?.done ?? 0)
              const next = !offTrack && index === (scrambleProgress?.done ?? 0)
              const beyond = offTrack && index >= (scrambleProgress?.done ?? 0)
              return (
                <span
                  key={`${move}-${index}`}
                  data-state={beyond ? 'off-track' : done ? 'done' : next ? 'next' : 'pending'}
                  className={css({
                    px: '1', borderRadius: 'control', borderWidth: '1px',
                    borderColor: next ? 'green' : 'transparent', bg: next ? 'rgba(34,197,94,0.14)' : 'transparent',
                    color: next ? 'green' : 'ink', opacity: beyond ? '0.3' : done ? '0.35' : '1',
                    transition: 'color 120ms, background 120ms, opacity 120ms'
                  })}
                >{move}</span>
              )
            })}
          </p>
          <div aria-live="polite" className={css({ minH: '7', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2', flexWrap: 'wrap', fontSize: 'sm' })}>
            {offTrack ? (
              <>
                <span className={css({ color: 'error', fontWeight: 'semibold' })}>Off the scramble.</span>
                {(scrambleProgress?.undo.length ?? 0) > 0 ? (
                  <>
                    <span className={css({ color: 'inkVariant' })}>Turn</span>
                    {scrambleProgress!.undo.map((move, index) => (
                      <span key={`${move}-${index}`} className={css({ fontFamily: 'mono', px: '1.5', borderRadius: 'control', bg: 'floating', color: 'ink' })}>{move}</span>
                    ))}
                    <span className={css({ color: 'inkVariant' })}>to get back.</span>
                  </>
                ) : <span className={css({ color: 'inkVariant' })}>Getting a new scramble from where your cube is.</span>}
              </>
            ) : scrambleProgress && scrambleProgress.total > 0 && scrambleProgress.done < scrambleProgress.total ? (
              <span className={css({ fontFamily: 'mono', color: 'inkVariant' })}>{scrambleProgress.done} / {scrambleProgress.total}</span>
            ) : scrambleProgress ? (
              <span className={css({ color: 'green' })}>Scrambled. Inspect, then start turning.</span>
            ) : null}
          </div>
        </div>

        <div className={css({ mt: '2', w: { base: '180px', md: '220px' }, h: { base: '180px', md: '220px' }, display: 'grid', placeItems: 'center' })}>{cube}</div>

        <div className={css({ mt: '2', textAlign: 'center' })}>
          <div aria-label="Timer" className={css({ fontFamily: 'mono', fontSize: { base: '76px', md: '120px', xl: '150px' }, fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.04em', color: awaitingSolve ? 'ink' : 'green', fontVariantNumeric: 'tabular-nums' })}>
            {whole}{fraction !== undefined && <span className={css({ opacity: '0.6' })}>.{fraction}</span>}
          </div>
          {(tps || turns !== undefined || fluency) && (
            <div className={css({ mt: '3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3', color: 'inkVariant', fontFamily: 'mono', fontSize: 'sm' })}>
              {tps && <span>{tps} TPS</span>}
              {turns !== undefined && <><Dot /><span>{turns} turns</span></>}
              {fluency && <><Dot /><span>{fluency} fluency</span></>}
            </div>
          )}
        </div>

        <div className={css({ mt: '6', display: 'flex', alignItems: 'center', gap: '3', flexWrap: 'wrap', justifyContent: 'center' })}>
          {!connected && (
            <button type="button" onClick={onConnect} className={css({ px: '5', minH: '44px', borderRadius: 'control', bg: 'green', color: 'onGreen', fontWeight: 'semibold', cursor: 'pointer', _hover: { bg: 'greenBright' }, _focusVisible: { outline: '2px solid', outlineColor: 'ink', outlineOffset: '2px' } })}>Connect cube</button>
          )}
          {onNewScramble && (
            <button type="button" onClick={onNewScramble} className={css({ px: '5', minH: '44px', borderRadius: 'control', bg: 'transparent', color: 'ink', borderWidth: '1px', borderColor: 'floating', fontWeight: 'medium', cursor: 'pointer', _hover: { bg: 'floating' }, _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' } })}>New scramble</button>
          )}
        </div>
        <p className={css({ mt: '3', color: 'inkVariant', fontSize: 'sm' })}>
          {connected ? 'Turn the cube to start. The timer stops when it is solved.' : 'No cube? Hold Space to start the timer, any key stops it.'}
        </p>

        {splits.length > 0 && total > 0 && (
          <section aria-label="CFOP split" className={css({ w: 'full', maxW: '40rem', mt: '12', display: 'flex', flexDirection: 'column', gap: '4' })}>
            <div className={css({ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' })}>
              <h2 className={css({ fontWeight: 'semibold', fontSize: 'sm' })}>{awaitingSolve ? 'Last solve split' : 'Split'}</h2>
              <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>{total.toFixed(2)}s</span>
            </div>
            <div className={css({ h: '2', display: 'flex', borderRadius: 'pill', overflow: 'hidden', gap: '0.5' })}>
              {splits.map((split, index) => (
                <div key={split.label} title={`${split.label} ${split.seconds.toFixed(2)}s`} style={{ width: `${(split.seconds / total) * 100}%`, background: STAGE_COLOURS[index % STAGE_COLOURS.length] }} />
              ))}
            </div>
            <div className={css({ display: 'grid', gap: '4' })} style={{ gridTemplateColumns: `repeat(${Math.min(splits.length, 4)}, minmax(0, 1fr))` }}>
              {splits.map((split, index) => (
                <div key={split.label} className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
                  <span className={css({ display: 'flex', alignItems: 'center', gap: '1.5', fontSize: 'xs', color: 'inkVariant' })}>
                    <span className={css({ w: '2', h: '2', borderRadius: 'pill' })} style={{ background: STAGE_COLOURS[index % STAGE_COLOURS.length] }} />
                    {split.label}
                  </span>
                  <span className={css({ fontFamily: 'mono', fontSize: 'md' })}>
                    {split.seconds.toFixed(2)}s{split.delta && <span className={css({ fontSize: 'xs', ml: '1', color: split.deltaGood ? 'green' : 'error' })}>{split.delta}</span>}
                  </span>
                  {split.tps && <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>{split.tps} TPS</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {insights && insights.length > 0 && (
          <section aria-label="What to work on" className={css({ w: 'full', maxW: '40rem', mt: '10', display: 'flex', flexDirection: 'column', gap: '3' })}>
            <h2 className={css({ fontWeight: 'semibold', fontSize: 'sm' })}>What to work on</h2>
            {insights.map((insight) => (
              <div key={insight.id} className={css({ p: '4', borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: 'floating', display: 'flex', flexDirection: 'column', gap: '1' })}>
                <span className={css({ fontWeight: 'medium' })}>{insight.headline}</span>
                <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>{insight.evidence}</span>
              </div>
            ))}
            {onOpenInsights && (
              <button type="button" onClick={onOpenInsights} className={css({ alignSelf: 'flex-start', px: '4', minH: '11', borderRadius: 'control', bg: 'transparent', color: 'green', borderWidth: '1px', borderColor: 'floating', cursor: 'pointer', fontSize: 'sm', _hover: { bg: 'floating' } })}>Open in Stats</button>
            )}
          </section>
        )}
      </section>

      <aside aria-label="Averages" className={css({ gridArea: 'stats', minH: { lg: '0' }, overflowY: { lg: 'auto' }, borderLeftWidth: { lg: '1px' }, borderTopWidth: { base: '1px', lg: '0' }, borderColor: 'floating', p: '5', display: 'flex', flexDirection: 'column', gap: '6' })}>
        <table className={css({ w: 'full', fontFamily: 'mono', fontSize: 'sm', fontVariantNumeric: 'tabular-nums', borderCollapse: 'collapse' })}>
          <thead>
            <tr className={css({ color: 'inkVariant', fontFamily: 'sans', fontSize: 'xs' })}>
              <th className={css({ textAlign: 'left', fontWeight: 'normal', pb: '2' })} />
              <th className={css({ textAlign: 'right', fontWeight: 'normal', pb: '2' })}>Now</th>
              <th className={css({ textAlign: 'right', fontWeight: 'normal', pb: '2' })}>Best</th>
            </tr>
          </thead>
          <tbody>
            {averages.map((row) => (
              <tr key={row.label}>
                <th scope="row" className={css({ textAlign: 'left', fontWeight: 'normal', py: '1.5', color: row.emphasis ? 'green' : 'inkVariant' })}>{row.label}</th>
                <td className={css({ textAlign: 'right', py: '1.5', color: row.emphasis ? 'green' : 'ink', fontWeight: row.emphasis ? 'bold' : 'normal' })}>{row.now}</td>
                <td className={css({ textAlign: 'right', py: '1.5', color: 'inkVariant' })}>{row.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {trend && (
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
            <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' })}>
              <span className={css({ fontSize: 'xs', color: 'inkVariant' })}>Trend</span>
              <select aria-label="Trend window" value={trendWindow} onChange={(event) => setTrendWindow(Number(event.target.value))} className={css({ minH: '44px', bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'control', color: 'inkVariant', fontSize: 'xs', fontFamily: 'mono', px: '2' })}>
                <option value={5}>last 5</option>
                <option value={12}>last 12</option>
                <option value={50}>last 50</option>
              </select>
            </div>
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Solve times trend" className={css({ w: 'full', h: '20', color: 'green' })}>
              <path d={trend} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        )}
      </aside>
    </div>
  )
}

function Dot() {
  return <span className={css({ w: '1', h: '1', bg: 'outline', borderRadius: 'pill' })} />
}
