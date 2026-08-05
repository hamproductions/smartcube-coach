import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'
import { solveSplits, stageDurationMs } from '../../domain/bottleneck'
import { buildInsights } from '../../domain/coachInsights'
import { buildPrescription } from '../../domain/prescribe'
import { useState } from 'react'
import type { SolveRecord, StageRecord } from '../../domain/models'

// Ported from docs/design/stitch/coaching_history/code.html. Two sections: an insight
// banner carrying a primary left edge, then the solve history with its CFOP splits. The
// banner states a bottleneck only when the stored stages actually support one.

const Panel = styled('section', {
  base: {
    position: 'relative',
    // In a column flex container these are flex items, so they shrink to fit the
    // viewport by default and `overflow: hidden` then clips the content away. That is
    // what cut the last line off every card and hid half the drill plan.
    flexShrink: '0',
    bg: 'container',
    borderWidth: '1px',
    borderColor: 'floating',
    borderRadius: 'card',
    overflow: 'hidden'
  }
})

const LabelCaps = styled('span', {
  base: {
    fontFamily: 'sans',
    fontSize: 'xs',
    fontWeight: 'bold',
    letterSpacing: '0.12em',
    textTransform: 'uppercase'
  }
})

const Cell = styled('td', {
  base: { px: '6', py: '3', color: 'inkVariant', whiteSpace: 'nowrap' },
  variants: {
    tone: {
      time: { color: 'ink', fontWeight: 'bold' },
      focus: { color: 'green', fontWeight: 'bold' },
      slow: { color: 'error', fontWeight: 'medium' }
    }
  }
})

const Head = styled('th', {
  base: {
    px: '6', py: '3', textAlign: 'left', fontWeight: 'normal',
    fontFamily: 'sans', fontSize: 'xs', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'inkVariant', whiteSpace: 'nowrap'
  },
  variants: { focus: { true: { color: 'green' } } }
})

const DASH = '—'
const seconds = (ms?: number) => ms === undefined ? DASH : (ms / 1000).toFixed(2)

export type CoachingHistoryProps = {
  solves: SolveRecord[]
  stages: StageRecord[]
  onOpenSolve(solveId: string): void
  onDrillSlot(slot: string): void
}

export function CoachingHistory({ solves, stages, onOpenSolve, onDrillSlot }: CoachingHistoryProps) {
  const ordered = [...solves].sort((left, right) => right.endedAt - left.endedAt)
  const stagesFor = (solveId: string) => stages.filter((stage) => stage.solveId === solveId)
  const insights = buildInsights(stages)
  const [openPlan, setOpenPlan] = useState<string>()

  // Penalties must count: a DNF is not a valid time and a +2 is two seconds slower.
  // Averaging raw durations reported a session average the solver never achieved.
  const effective = (solve: SolveRecord) =>
    solve.penalty === 'dnf' ? undefined : (solve.endedAt - solve.startedAt) + (solve.penalty === '+2' ? 2000 : 0)
  const durations = ordered.map(effective).filter((value): value is number => value !== undefined)
  const sessionMean = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : undefined

  // The design colours an F2L cell red when it is worse than usual. That threshold is the
  // solver's own mean, so a "slow" mark always means slow for them.
  const f2lValues = ordered
    .map((solve) => solveSplits(solve.id, stagesFor(solve.id)).f2l)
    .filter((value): value is number => value !== undefined)
  const f2lMean = f2lValues.length ? f2lValues.reduce((sum, value) => sum + value, 0) / f2lValues.length : undefined

  return (
    <div className={css({ flex: '1', minH: '0', overflowY: 'auto', p: '8', display: 'flex', flexDirection: 'column', gap: '8' })}>
      {insights.length === 0 ? (
        <Panel>
          <div className={css({ position: 'absolute', top: '0', left: '0', w: '4px', h: 'full', bg: 'green' })} />
          <div className={css({ p: '8' })}>
            <LabelCaps className={css({ color: 'green' })}>Insights</LabelCaps>
            <h2 className={css({ mt: '2', fontSize: '2xl', fontWeight: 'semibold', color: 'ink', letterSpacing: '-0.02em' })}>
              No timed stages to read yet
            </h2>
            <p className={css({ mt: '2', fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant' })}>
              Capture or replay a solve and the coach reads it.
            </p>
          </div>
        </Panel>
      ) : insights.map((insight, position) => (
        <Panel key={insight.id}>
          {/* Only the leading insight carries the accent edge; the rest are context. */}
          <div className={css({ position: 'absolute', top: '0', left: '0', w: '4px', h: 'full', bg: position === 0 ? 'green' : 'floating' })} />
          <div className={css({ p: '8', display: 'flex', flexDirection: 'column', gap: '6', lg: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } })}>
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '2', maxW: '720px' })}>
              <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
                <LabelCaps className={css({ color: position === 0 ? 'green' : 'inkVariant' })}>
                  {position === 0 ? 'Biggest win' : 'Also true'}
                </LabelCaps>
                {insight.savingMs !== undefined && (
                  <span className={css({ px: '2', py: '0.5', borderRadius: 'pill', bg: 'rgba(34,197,94,0.12)', color: 'green', fontFamily: 'mono', fontSize: '2xs', fontWeight: 'bold' })}>
                    ≈{seconds(insight.savingMs)}s / solve
                  </span>
                )}
              </div>
              <h2 className={css({ fontSize: '2xl', fontWeight: 'semibold', color: 'ink', letterSpacing: '-0.02em' })}>{insight.headline}</h2>
              <p className={css({ fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant', lineHeight: 'relaxed' })}>{insight.evidence}</p>
              {insight.detail && (
                <p className={css({ fontSize: 'sm', color: 'inkVariant', lineHeight: 'relaxed' })}>{insight.detail}</p>
              )}
            </div>

            {position === 0 && insight.finding && (
              <button
                type="button"
                onClick={() => setOpenPlan((current) => current === insight.id ? undefined : insight.id)}
                className={css({
                  // 48px literal: `touch` is a spacing token, and minH reads the sizes
                  // scale, so the named token emits nothing and the button collapses.
                  flexShrink: '0', minH: '48px', px: '6', borderRadius: 'card',
                  bg: 'green', color: 'onGreen', cursor: 'pointer',
                  fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  boxShadow: '0 0 15px rgba(34,197,94,0.15)',
                  _hover: { bg: 'greenBright' }
                })}
              >{openPlan === insight.id ? 'Hide plan' : 'Drill this'}</button>
            )}
          </div>

          {openPlan === insight.id && insight.finding && (() => {
            const plan = buildPrescription(insight.finding)
            return (
              <div className={css({ px: '8', pb: '8', borderTopWidth: '1px', borderColor: 'floating', pt: '6' })}>
                <div className={css({ display: 'flex', alignItems: 'baseline', gap: '3', mb: '4' })}>
                  <LabelCaps className={css({ color: 'ink' })}>{plan.title}</LabelCaps>
                  <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>{plan.duration}</span>
                </div>
                <ol className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
                  {plan.blocks.map((block, order) => (
                    <li key={block.label} className={css({
                      display: 'flex', flexDirection: 'column', gap: '1',
                      p: '4', bg: 'surface', borderRadius: 'control',
                      borderWidth: '1px', borderColor: 'floating',
                      md: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
                    })}>
                      <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
                        <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'green' })}>{order + 1}</span>
                        <span className={css({ color: 'ink' })}>{block.label}</span>
                      </div>
                      <div className={css({ display: 'flex', gap: '6', fontFamily: 'mono', fontSize: 'xs' })}>
                        <span className={css({ color: 'inkVariant' })}>{block.dose}</span>
                        <span className={css({ color: 'green' })}>{block.target}</span>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className={css({ mt: '6', display: 'flex', flexDirection: 'column', gap: '3', md: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } })}>
                  <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>
                    Passes when {plan.passCondition.metric.replace(/_/g, ' ')} reaches {(plan.passCondition.target / 1000).toFixed(2)}s median over {plan.passCondition.fullSolveSample} solves.
                  </p>
                  {/* Blocks 1 and 2 are recognition work, which the trainer already runs. */}
                  <button
                    type="button"
                    onClick={() => onDrillSlot(insight.id)}
                    className={css({
                      flexShrink: '0', minH: '48px', px: '6', borderRadius: 'card',
                      borderWidth: '1px', borderColor: 'green', bg: 'transparent', color: 'green',
                      cursor: 'pointer', fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      _hover: { bg: 'rgba(34,197,94,0.12)' }
                    })}
                  >Start block 1 — {plan.blocks[0].label}</button>
                </div>
              </div>
            )
          })()}
        </Panel>
      ))}

      <Panel>
        <div className={css({ px: '6', py: '4', borderBottomWidth: '1px', borderColor: 'floating', display: 'flex', justifyContent: 'space-between', alignItems: 'center' })}>
          <LabelCaps className={css({ color: 'inkVariant' })}>Solve history &amp; splits</LabelCaps>
          <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>
            Session avg: {seconds(sessionMean)}
          </span>
        </div>

        <div className={css({ overflowX: 'auto' })}>
          <table className={css({ w: 'full', borderCollapse: 'collapse', textAlign: 'left' })}>
            <thead>
              <tr className={css({ borderBottomWidth: '1px', borderColor: 'floating', bg: 'surface' })}>
                <Head className={css({ w: '12' })}>#</Head>
                <Head>Time</Head>
                <Head>Date</Head>
                <Head>Cross</Head>
                <Head focus>F2L</Head>
                <Head>OLL</Head>
                <Head>PLL</Head>
              </tr>
            </thead>
            <tbody className={css({ fontFamily: 'mono', fontSize: 'sm' })}>
              {ordered.length === 0 && (
                <tr><Cell colSpan={7} className={css({ py: '8', textAlign: 'center' })}>No solves recorded yet.</Cell></tr>
              )}
              {ordered.map((solve, position) => {
                const splits = solveSplits(solve.id, stagesFor(solve.id))
                const slow = f2lMean !== undefined && splits.f2l !== undefined && splits.f2l > f2lMean
                return (
                  <tr
                    key={solve.id}
                    onClick={() => onOpenSolve(solve.id)}
                    className={css({
                      borderBottomWidth: '1px', borderColor: 'floating', cursor: 'pointer',
                      bg: position === 0 ? 'floating' : undefined,
                      _hover: { bg: 'floating' }
                    })}
                  >
                    <Cell>{ordered.length - position}</Cell>
                    <Cell tone="time">{solve.penalty === 'dnf' ? 'DNF' : seconds(effective(solve))}</Cell>
                    <Cell>{new Date(solve.endedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Cell>
                    <Cell>{seconds(splits.cross)}</Cell>
                    <Cell tone={slow ? 'slow' : 'focus'}>{seconds(splits.f2l)}</Cell>
                    <Cell>{seconds(splits.oll)}</Cell>
                    <Cell>{seconds(splits.pll)}</Cell>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

export { stageDurationMs }
