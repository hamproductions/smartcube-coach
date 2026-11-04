import { useState } from 'react'
import { css, cx } from 'styled-system/css'
import { solveSplits, stageDurationMs } from '../../domain/bottleneck'
import { buildInsights, type Insight } from '../../domain/coachInsights'
import { buildPrescription } from '../../domain/prescribe'
import { averageOf, bestAverageOf, bestSingle, effectiveSolveMs } from '../../domain/statistics'
import type { SolveRecord, StageRecord } from '../../domain/models'
import { routeHref } from '../../app/route'
import { trainerById } from '../train/trainers'
import { StageTrendChart, type StagePoint } from './StageTrendChart'
import { DASH, PageHeader, plain, Section, card, mono, pageFrame, primaryButton, secondaryButton } from '../ui/Page'

const STAGES = [
  { key: 'cross', label: 'Cross', colour: '#9333ea' },
  { key: 'f2l', label: 'F2L', colour: '#4f46e5' },
  { key: 'oll', label: 'OLL', colour: '#3b82f6' },
  { key: 'pll', label: 'PLL', colour: '#22c55e' }
] as const

const AVERAGES = [5, 12, 50, 100] as const
const TREND_WINDOW = 50
const PAGE_SIZE = 50

export const INSIGHT_TRAINER: Record<string, string | undefined> = {
  'recognition-share': 'pair-tracking',
  'lookahead-collapse': 'pair-tracking',
  'pause-trigger': 'pair-tracking',
  'execution-health': 'pair-tracking',
  'move-efficiency': 'f2l-cube',
  'slot-not-separable': undefined
}

export function trainerForInsight(insight: { id: string; stage?: string }) {
  if (insight.id === 'move-efficiency' && insight.stage) {
    if (/^cross/i.test(insight.stage)) return trainerById('cross-plan')
    if (/^(oll|pll)/i.test(insight.stage)) return trainerById('cases')
  }
  return trainerById(INSIGHT_TRAINER[insight.id])
}

const seconds = (ms?: number) => ms === undefined ? DASH : (ms / 1000).toFixed(2)

const thRaw = css.raw({ px: { base: '2', md: '3' }, py: '2.5', textAlign: 'right', fontWeight: 'normal', fontSize: 'xs', color: 'inkVariant', whiteSpace: 'nowrap', fontFamily: 'sans' })
const tdRaw = css.raw({ px: { base: '2', md: '3' }, py: '2.5', textAlign: 'right', whiteSpace: 'nowrap' })
const th = css(thRaw)
const td = css(tdRaw)

export type CoachingHistoryProps = {
  solves: SolveRecord[]
  stages: StageRecord[]
  onOpenSolve(solveId: string): void
}

export function CoachingHistory({ solves, stages, onOpenSolve }: CoachingHistoryProps) {
  const ordered = [...solves].sort((left, right) => right.endedAt - left.endedAt)
  const stagesBySolve = new Map<string, StageRecord[]>()
  for (const stage of stages) stagesBySolve.set(stage.solveId, [...(stagesBySolve.get(stage.solveId) ?? []), stage])
  const insights = buildInsights(stages)
  const [shown, setShown] = useState(PAGE_SIZE)

  return (
    <div className={pageFrame}>
      <PageHeader title="Stats" description="Your averages, how each stage is trending, and what to practise next." />
      {ordered.length === 0 ? (
        <div className={cx(card, css({ p: { base: '5', md: '8' }, display: 'flex', flexDirection: 'column', gap: '3', alignItems: 'flex-start' }))}>
          <h2 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>No solves yet</h2>
          <p className={css({ color: 'inkVariant', fontSize: 'sm', maxW: '60ch' })}>
            Do a solve on the Solve screen with your smart cube, or with the keyboard timer, and it shows up here. Stage splits and coaching need a smart cube solve.
          </p>
          <a href={routeHref({ section: 'solve' })} className={primaryButton}>Go to Solve</a>
        </div>
      ) : (
        <>
          <Averages solves={ordered} />
          <StageTrend ordered={ordered} stagesBySolve={stagesBySolve} />
          <Coaching insights={insights} />
          <Section
            id="history"
            title="Solve history"
            description="Select a solve to open its breakdown."
            action={<span className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>{ordered.length} solve{ordered.length === 1 ? '' : 's'}</span>}
          >
            <div className={cx(card, css({ overflowX: 'auto' }))}>
              <table className={css({ w: 'full', borderCollapse: 'collapse', fontSize: 'sm' })}>
                <thead>
                  <tr className={css({ borderBottomWidth: '1px', borderColor: 'floating' })}>
                    <th scope="col" className={css(thRaw, { textAlign: 'left' })}>#</th>
                    <th scope="col" className={css(thRaw, { textAlign: 'left' })}>Time</th>
                    <th scope="col" className={css(thRaw, { textAlign: 'left', display: { base: 'none', md: 'table-cell' } })}>Date</th>
                    {STAGES.map((stage) => <th key={stage.key} scope="col" className={th}>{stage.label}</th>)}
                  </tr>
                </thead>
                <tbody className={mono}>
                  {ordered.slice(0, shown).map((solve, position) => {
                    const splits = solveSplits(solve.id, stagesBySolve.get(solve.id) ?? [])
                    const number = ordered.length - position
                    const time = solve.penalty === 'dnf' ? 'DNF' : seconds(effectiveSolveMs(solve))
                    return (
                      <tr
                        key={solve.id}
                        onClick={() => onOpenSolve(solve.id)}
                        className={css({ borderBottomWidth: '1px', borderColor: 'floating', cursor: 'pointer', _last: { borderBottomWidth: '0' }, _hover: { bg: 'floating' } })}
                      >
                        <td className={css(tdRaw, { textAlign: 'left', color: 'inkVariant' })}>{number}</td>
                        <td className={css(tdRaw, { textAlign: 'left', py: '0' })}>
                          <button
                            type="button"
                            aria-label={`Open solve ${number}, ${time}${solve.penalty === '+2' ? ' including +2' : ''}`}
                            onClick={(event) => { event.stopPropagation(); onOpenSolve(solve.id) }}
                            className={css({
                              minH: '44px', px: '2', ml: '-2', borderRadius: 'control', cursor: 'pointer', color: 'ink', fontWeight: 'semibold',
                              _focusVisible: { outline: '2px solid', outlineColor: 'green' }
                            })}
                          >{time}{solve.penalty === '+2' && <span className={css({ ml: '1', fontSize: 'xs', color: 'amber' })}>+2</span>}</button>
                        </td>
                        <td className={css(tdRaw, { textAlign: 'left', color: 'inkVariant', fontFamily: 'sans', display: { base: 'none', md: 'table-cell' } })}>
                          {new Date(solve.endedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        {STAGES.map((stage) => <td key={stage.key} className={cx(td, css({ color: 'inkVariant' }))}>{seconds(splits[stage.key])}</td>)}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {ordered.length > shown && (
              <button type="button" onClick={() => setShown((count) => count + PAGE_SIZE)} className={cx(secondaryButton, css({ alignSelf: 'flex-start' }))}>
                Show {Math.min(PAGE_SIZE, ordered.length - shown)} more
              </button>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function Averages({ solves }: { solves: SolveRecord[] }) {
  const latest = solves[0]
  const columns = [
    { label: 'Single', now: latest ? (latest.penalty === 'dnf' ? 'DNF' : seconds(effectiveSolveMs(latest))) : DASH, best: seconds(bestSingle(solves)) },
    ...AVERAGES.map((count) => ({ label: `ao${count}`, now: seconds(averageOf(solves, count)), best: seconds(bestAverageOf(solves, count)) }))
  ]
  return (
    <Section id="averages" title="Averages" description="Current is your latest solve or the latest run of solves. Best is your personal best.">
      <div className={cx(card, css({ overflowX: 'auto' }))}>
        <table className={css({ display: { base: 'none', md: 'table' }, w: 'full', borderCollapse: 'collapse' })}>
          <thead>
            <tr className={css({ borderBottomWidth: '1px', borderColor: 'floating' })}>
              <td className={th} />
              {columns.map((column) => <th key={column.label} scope="col" className={th}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody className={mono}>
            <tr>
              <th scope="row" className={css(thRaw, { textAlign: 'left' })}>Current</th>
              {columns.map((column) => <td key={column.label} className={cx(td, css({ fontSize: 'xl', color: column.now === DASH ? 'inkVariant' : 'ink' }))}>{column.now}</td>)}
            </tr>
            <tr className={css({ borderTopWidth: '1px', borderColor: 'floating' })}>
              <th scope="row" className={css(thRaw, { textAlign: 'left' })}>Best</th>
              {columns.map((column) => <td key={column.label} className={cx(td, css({ fontSize: 'md', color: column.best === DASH ? 'inkVariant' : 'green' }))}>{column.best}</td>)}
            </tr>
          </tbody>
        </table>
        <table className={css({ display: { base: 'table', md: 'none' }, w: 'full', borderCollapse: 'collapse' })}>
          <thead>
            <tr className={css({ borderBottomWidth: '1px', borderColor: 'floating' })}>
              <td className={th} />
              <th scope="col" className={th}>Current</th>
              <th scope="col" className={th}>Best</th>
            </tr>
          </thead>
          <tbody className={mono}>
            {columns.map((column) => (
              <tr key={column.label} className={css({ borderTopWidth: '1px', borderColor: 'floating', _first: { borderTopWidth: '0' } })}>
                <th scope="row" className={css(thRaw, { textAlign: 'left' })}>{column.label}</th>
                <td className={cx(td, css({ fontSize: 'lg', color: column.now === DASH ? 'inkVariant' : 'ink' }))}>{column.now}</td>
                <td className={cx(td, css({ fontSize: 'md', color: column.best === DASH ? 'inkVariant' : 'green' }))}>{column.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function StageTrend({ ordered, stagesBySolve }: { ordered: SolveRecord[]; stagesBySolve: Map<string, StageRecord[]> }) {
  const points: StagePoint[] = ordered
    .filter((solve) => (stagesBySolve.get(solve.id)?.some((stage) => stageDurationMs(stage) > 0)) ?? false)
    .slice(0, TREND_WINDOW)
    .reverse()
    .map((solve) => {
      const splits = solveSplits(solve.id, stagesBySolve.get(solve.id) ?? [])
      return { solveId: solve.id, values: STAGES.map((stage) => splits[stage.key]) }
    })
  return (
    <Section id="trend" title="Which stage is getting faster?" description={points.length > 1 ? `Time per stage over your last ${points.length} smart cube solves, oldest on the left.` : 'Time per stage over your recent smart cube solves.'}>
      {points.length < 2 ? (
        <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>
          {points.length === 0 ? 'No stage timings yet.' : 'One solve has stage timings.'} The trend needs at least two smart cube solves; keyboard solves have no stages.
        </p>
      ) : (
        <div className={cx(card, css({ p: { base: '4', md: '6' } }))}>
          <StageTrendChart title="Time per CFOP stage across recent solves" series={STAGES.map(({ label, colour }) => ({ label, colour }))} points={points} />
        </div>
      )}
    </Section>
  )
}

function Coaching({ insights }: { insights: Insight[] }) {
  const [openPlan, setOpenPlan] = useState<string>()
  return (
    <Section id="coach" title="What to work on" description="Read from your stage timings. Biggest time saving first.">
      {insights.length === 0 ? (
        <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>
          Nothing to report yet. The coach reads stage timings, so it needs smart cube solves, and it only names a habit once it repeats across solves.
        </p>
      ) : (
        <ol className={css({ display: 'flex', flexDirection: 'column', gap: '3', listStyle: 'none', m: '0', p: '0' })}>
          {insights.map((insight) => {
            const trainer = trainerForInsight(insight)
            const plan = insight.finding ? buildPrescription(insight.finding) : undefined
            return (
              <li key={insight.id} className={cx(card, css({ p: { base: '4', md: '5' }, display: 'flex', flexDirection: 'column', gap: '3' }))}>
                <div className={css({ display: 'flex', flexDirection: { base: 'column', md: 'row' }, gap: '4', md: { alignItems: 'flex-start', justifyContent: 'space-between' } })}>
                  <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5', minW: '0', maxW: '72ch' })}>
                    <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>
                      {plain(insight.headline)}
                      {insight.savingMs !== undefined && (
                        <span className={cx(mono, css({ ml: '2', fontSize: 'xs', fontWeight: 'medium', color: 'green', whiteSpace: 'nowrap' }))}>about {seconds(insight.savingMs)}s per solve</span>
                      )}
                    </h3>
                    <p className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant', lineHeight: '1.6' }))}>{plain(insight.evidence)}</p>
                    {insight.detail && <p className={css({ fontSize: 'sm', color: 'inkVariant', lineHeight: '1.6' })}>{plain(insight.detail)}</p>}
                  </div>
                  <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap', flexShrink: '0' })}>
                    {plan && (
                      <button type="button" aria-expanded={openPlan === insight.id} onClick={() => setOpenPlan((current) => current === insight.id ? undefined : insight.id)} className={secondaryButton}>
                        {openPlan === insight.id ? 'Hide plan' : 'Show plan'}
                      </button>
                    )}
                    <a href={routeHref(trainer ? { section: 'train', detail: trainer.id } : { section: 'train' })} className={primaryButton}>
                      {trainer ? `Train: ${trainer.name}` : 'Browse trainers'}
                    </a>
                  </div>
                </div>
                {plan && openPlan === insight.id && (
                  <div className={css({ pt: '3', borderTopWidth: '1px', borderColor: 'floating', display: 'flex', flexDirection: 'column', gap: '3' })}>
                    <div className={css({ display: 'flex', gap: '3', alignItems: 'baseline', flexWrap: 'wrap' })}>
                      <h4 className={css({ fontSize: 'sm', fontWeight: 'semibold' })}>{plan.title}</h4>
                      <span className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>{plan.duration}</span>
                    </div>
                    <ol className={css({ display: 'flex', flexDirection: 'column', gap: '2', listStyle: 'none', m: '0', p: '0' })}>
                      {plan.blocks.map((block, order) => (
                        <li key={block.label} className={css({ display: 'grid', gridTemplateColumns: '1.5rem 1fr', gap: '2', fontSize: 'sm', md: { gridTemplateColumns: '1.5rem 1fr auto auto', gap: '4' } })}>
                          <span className={cx(mono, css({ color: 'green' }))}>{order + 1}</span>
                          <span>{block.label}</span>
                          <span className={cx(mono, css({ color: 'inkVariant', fontSize: 'xs', gridColumn: { base: '2', md: 'auto' } }))}>{block.dose}</span>
                          <span className={cx(mono, css({ color: 'green', fontSize: 'xs', gridColumn: { base: '2', md: 'auto' } }))}>{block.target}</span>
                        </li>
                      ))}
                    </ol>
                    <p className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>
                      Passes when {plan.passCondition.metric.replace(/_/g, ' ')} reaches {(plan.passCondition.target / 1000).toFixed(2)}s median over {plan.passCondition.fullSolveSample} solves.
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}
