import { css } from 'styled-system/css'
import { styled } from 'styled-system/jsx'
import { ScramblePreview } from '../ui/ScramblePreview'
import type { AlgorithmRecord, TrainerAttempt } from '../../domain/models'

// Ported from docs/design/stitch/case_mastery_sune_oll_27/code.html: a back header, a
// left column with the case picture and a mastery ring, and a right column with four
// stat tiles above the algorithm list. The export itself prints a dash for an algorithm
// with no recorded average, so unmeasured values stay dashes here too.

const Card = styled('div', {
  base: { bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card' }
})

const LabelCaps = styled('span', {
  base: {
    fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
    letterSpacing: '0.12em', textTransform: 'uppercase', color: 'inkVariant'
  }
})

const DASH = '—'
const secs = (ms?: number) => ms === undefined ? DASH : (ms / 1000).toFixed(2)

function best(values: Array<number | undefined>) {
  const real = values.filter((value): value is number => value !== undefined)
  return real.length ? Math.min(...real) : undefined
}

function masteryLabel(mastery: number) {
  if (mastery >= 0.8) return 'Advanced'
  if (mastery >= 0.4) return 'Intermediate'
  if (mastery > 0) return 'Learning'
  return 'New'
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <Card className={css({ p: '4', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '2' })}>
      <LabelCaps>{label}</LabelCaps>
      <div className={css({ display: 'flex', alignItems: 'flex-end', gap: '1' })}>
        <span className={css({ fontFamily: 'mono', fontSize: '2xl', fontWeight: 'bold', color: accent ? 'green' : 'ink' })}>{value}</span>
        {unit && value !== DASH && <LabelCaps className={css({ mb: '1', color: accent ? 'green' : 'inkVariant' })}>{unit}</LabelCaps>}
      </div>
    </Card>
  )
}

export type CaseMasteryProps = {
  record: AlgorithmRecord
  attempts: TrainerAttempt[]
  onBack(): void
  onPractice(): void
}

export function CaseMastery({ record, attempts, onBack, onPractice }: CaseMasteryProps) {
  const forCase = attempts.filter((attempt) => attempt.caseId === record.id)
  const successes = forCase.filter((attempt) => attempt.outcome === 'success')

  const pbRecognition = best(successes.map((attempt) => attempt.recognitionMs))
  const pbExecution = best(successes.map((attempt) => attempt.executionMs))
  const moveCount = record.algorithm.split(/\s+/).filter(Boolean).length

  // TPS is only meaningful over executions we actually timed.
  const timedExecutions = successes.filter((attempt) => attempt.executionMs !== undefined && attempt.executionMs > 0)
  const avgTps = timedExecutions.length
    ? timedExecutions.reduce((sum, attempt) => sum + moveCount / ((attempt.executionMs as number) / 1000), 0) / timedExecutions.length
    : undefined

  const successRate = forCase.length ? Math.round((successes.length / forCase.length) * 100) : undefined

  const radius = 45
  const circumference = 2 * Math.PI * radius
  const mastery = Math.max(0, Math.min(1, record.mastery))

  return (
    <div className={css({ flex: '1', minH: '0', overflowY: 'auto' })}>
      <header className={css({ display: 'flex', alignItems: 'center', gap: '4', px: '8', py: '4', borderBottomWidth: '1px', borderColor: 'floating' })}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to case library"
          className={css({
            w: '10', h: '10', display: 'grid', placeItems: 'center', borderRadius: 'pill',
            bg: 'transparent', color: 'inkVariant', cursor: 'pointer', fontSize: 'xl',
            _hover: { bg: 'floating', color: 'ink' }
          })}
        >←</button>
        <div className={css({ display: 'flex', flexDirection: 'column' })}>
          <LabelCaps>{record.set} case</LabelCaps>
          <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'ink', letterSpacing: '-0.02em' })}>{record.name}</h2>
        </div>
      </header>

      <div className={css({ p: '8', display: 'grid', gap: 'gutter', gridTemplateColumns: '1fr', lg: { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }, maxW: '1280px', mx: 'auto' })}>
        <div className={css({ display: 'flex', flexDirection: 'column', gap: 'gutter', lg: { gridColumn: 'span 4' } })}>
          <Card className={css({ p: '6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minH: '300px' })}>
            <div className={css({ p: '4', bg: 'surface', borderWidth: '1px', borderColor: 'floating', borderRadius: 'control' })}>
              <ScramblePreview scramble={record.setup} cellPx={26} view="layer" />
            </div>
            <div className={css({ mt: '6', display: 'flex', justifyContent: 'space-around', w: 'full' })}>
              <div className={css({ textAlign: 'center' })}>
                <LabelCaps className={css({ display: 'block' })}>Moves</LabelCaps>
                <span className={css({ fontFamily: 'mono', color: 'ink' })}>{moveCount}</span>
              </div>
              <div className={css({ textAlign: 'center' })}>
                <LabelCaps className={css({ display: 'block' })}>Group</LabelCaps>
                <span className={css({ fontFamily: 'mono', color: 'ink' })}>{record.set}</span>
              </div>
            </div>
          </Card>

          <Card className={css({ p: '6', display: 'flex', flexDirection: 'column', alignItems: 'center' })}>
            <LabelCaps className={css({ w: 'full', textAlign: 'left', mb: '6' })}>Mastery level</LabelCaps>
            <div className={css({ position: 'relative', w: '160px', h: '160px', display: 'grid', placeItems: 'center' })}>
              <svg width="160" height="160" viewBox="0 0 100 100" className={css({ transform: 'rotate(-90deg)' })}>
                <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#27272a" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r={radius} fill="transparent" stroke="#4be277" strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - mastery)}
                  strokeLinecap="round"
                />
              </svg>
              <div className={css({ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' })}>
                <span className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'green' })}>
                  {Math.round(mastery * 100)}<span className={css({ fontSize: 'md' })}>%</span>
                </span>
                <LabelCaps>{masteryLabel(mastery)}</LabelCaps>
              </div>
            </div>
            <button
              type="button"
              onClick={onPractice}
              className={css({
                mt: '8', w: 'full', minH: '48px', borderRadius: 'card',
                bg: 'green', color: 'onGreen', cursor: 'pointer',
                fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                _hover: { bg: 'greenBright' }
              })}
            >Practice this case</button>
          </Card>
        </div>

        <div className={css({ display: 'flex', flexDirection: 'column', gap: 'gutter', lg: { gridColumn: 'span 8' } })}>
          <div className={css({ display: 'grid', gap: 'gutter', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', md: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' } })}>
            <Stat label="PB rec" value={secs(pbRecognition)} unit="s" />
            <Stat label="PB exec" value={secs(pbExecution)} unit="s" accent />
            <Stat label="Avg TPS" value={avgTps === undefined ? DASH : avgTps.toFixed(1)} />
            <Stat label="Success" value={successRate === undefined ? DASH : `${successRate}`} unit="%" />
          </div>

          <Card className={css({ display: 'flex', flexDirection: 'column', overflow: 'hidden' })}>
            <div className={css({ p: '4', borderBottomWidth: '1px', borderColor: 'floating', bg: 'floating' })}>
              <LabelCaps className={css({ color: 'ink' })}>Algorithm</LabelCaps>
            </div>
            <div className={css({ p: '4' })}>
              <div className={css({
                bg: 'surface', borderRadius: 'control', p: '4',
                borderLeftWidth: '4px', borderLeftColor: 'green',
                borderTopWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderColor: 'floating',
                display: 'flex', flexDirection: 'column', gap: '4',
                md: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }
              })}>
                <div>
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '2', mb: '1' })}>
                    <LabelCaps className={css({ color: 'green' })}>Primary</LabelCaps>
                    <span className={css({ px: '2', py: '0.5', borderRadius: 'control', bg: 'rgba(34,197,94,0.1)', color: 'green', fontSize: '2xs', fontWeight: 'bold' })}>
                      {moveCount} moves
                    </span>
                  </div>
                  <p className={css({ fontFamily: 'mono', fontSize: 'lg', color: 'ink', letterSpacing: '0.06em' })}>{record.algorithm}</p>
                </div>
                <div className={css({ textAlign: 'right' })}>
                  <LabelCaps className={css({ display: 'block' })}>Your avg exec</LabelCaps>
                  <span className={css({ fontFamily: 'mono', fontWeight: 'bold', color: 'ink' })}>
                    {timedExecutions.length
                      ? `${secs(timedExecutions.reduce((sum, attempt) => sum + (attempt.executionMs as number), 0) / timedExecutions.length)}s`
                      : DASH}
                  </span>
                </div>
              </div>
              <p className={css({ mt: '4', fontSize: 'xs', color: 'inkVariant' })}>
                Alternative algorithms are not stored per case yet, so none are listed.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
