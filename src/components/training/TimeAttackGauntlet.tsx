import { css } from 'styled-system/css'
import { ScramblePreview } from '../ui/ScramblePreview'
import type { AlgorithmRecord, TrainerAttempt } from '../../domain/models'

// Ported from docs/design/stitch/time_attack_gauntlet/code.html: the aggregate target
// time as the hero, the redo queue in an error-toned card beside it, and the generated
// queue as numbered case tiles. The redo queue lists real failed attempts from the last
// run rather than a placeholder — an empty queue simply says so.

const LabelCaps = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={`${css({ fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold', letterSpacing: '0.12em', textTransform: 'uppercase' })} ${className ?? ''}`}>{children}</span>
)

export type TimeAttackGauntletProps = {
  queue: AlgorithmRecord[]
  targets: Record<string, number>
  failedAttempts: TrainerAttempt[]
  onStart(): void
  onMove(id: string, direction: -1 | 1): void
  onTarget(id: string, targetMs: number): void
}

export function TimeAttackGauntlet({ queue, targets, failedAttempts, onStart, onMove, onTarget }: TimeAttackGauntletProps) {
  const totalMs = queue.reduce((sum, record) => sum + (targets[record.id] ?? record.targetMs), 0)

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8' })}>
      <div className={css({ display: 'grid', gap: '6', gridTemplateColumns: '1fr', lg: { gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' } })}>
        <div className={css({
          lg: { gridColumn: 'span 8' },
          bg: 'floating', borderWidth: '1px', borderColor: 'outline', borderRadius: 'card',
          p: '8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        })}>
          <LabelCaps className={css({ color: 'green', mb: '2' })}>Total target time</LabelCaps>
          <span className={css({ fontFamily: 'mono', fontSize: '8xl', fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.05em', color: 'ink' })}>
            {(totalMs / 1000).toFixed(2)}
          </span>
          <p className={css({ mt: '2', fontFamily: 'mono', fontSize: 'sm', color: 'inkVariant', letterSpacing: '0.08em' })}>
            {queue.length} case{queue.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className={css({
          lg: { gridColumn: 'span 4' },
          bg: 'rgba(255,180,171,0.06)', borderWidth: '1px', borderColor: 'rgba(255,180,171,0.25)',
          borderRadius: 'card', p: '6', display: 'flex', flexDirection: 'column', gap: '4'
        })}>
          <div className={css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2' })}>
            <LabelCaps className={css({ color: 'error' })}>Redo queue</LabelCaps>
            <span className={css({ px: '2', py: '0.5', borderRadius: 'pill', bg: 'rgba(255,180,171,0.16)', color: 'error', fontFamily: 'mono', fontSize: '2xs', fontWeight: 'bold' })}>
              {failedAttempts.length} pending
            </span>
          </div>

          {failedAttempts.length === 0 ? (
            <p className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'inkVariant' })}>
              Nothing missed in your last run.
            </p>
          ) : (
            <>
              <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
                {failedAttempts.slice(0, 5).map((attempt) => (
                  <div key={attempt.id} className={css({
                    bg: 'container', borderWidth: '1px', borderColor: 'rgba(255,180,171,0.15)',
                    borderRadius: 'control', p: '3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '3'
                  })}>
                    <span className={css({ fontSize: 'sm', color: 'ink' })}>{attempt.expectedAnswer ?? attempt.caseId}</span>
                    <span className={css({ fontFamily: 'mono', fontSize: 'xs', color: 'error' })}>
                      {attempt.outcome === 'success' ? `${(attempt.totalMs / 1000).toFixed(2)}s` : 'DNF'}
                    </span>
                  </div>
                ))}
              </div>
              <p className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'error', opacity: '0.8', textAlign: 'center' })}>
                These are mixed into your next gauntlet.
              </p>
            </>
          )}
        </div>
      </div>

      <div>
        <div className={css({ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: '4', px: '2' })}>
          <LabelCaps className={css({ color: 'inkVariant' })}>Generated queue ({queue.length})</LabelCaps>
          <button
            type="button"
            onClick={onStart}
            disabled={queue.length === 0}
            className={css({
              minH: '48px', px: '6', borderRadius: 'control',
              bg: 'green', color: 'onGreen', cursor: 'pointer',
              fontFamily: 'sans', fontSize: 'xs', fontWeight: 'bold',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              _hover: { bg: 'greenBright' },
              _disabled: { bg: 'floating', color: 'inkVariant', cursor: 'default' }
            })}
          >Start gauntlet</button>
        </div>

        {queue.length === 0 ? (
          <p className={css({ px: '2', color: 'inkVariant' })}>
            Select cases in the library above, then set a target time for each.
          </p>
        ) : (
          <div className={css({
            display: 'grid', gap: '4',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            sm: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
            md: { gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }
          })}>
            {queue.map((record, index) => (
              <div key={record.id} className={css({
                position: 'relative', bg: 'container', borderWidth: '1px', borderColor: 'floating',
                borderRadius: 'card', p: '4', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3'
              })}>
                <span className={css({
                  position: 'absolute', top: '2', left: '2', zIndex: '10',
                  px: '1.5', py: '0.5', borderRadius: 'control', bg: 'floating',
                  fontFamily: 'mono', fontSize: '2xs', color: 'inkVariant'
                })}>{String(index + 1).padStart(2, '0')}</span>

                <ScramblePreview scramble={record.setup} cellPx={12} view="layer" />

                <div className={css({ textAlign: 'center', w: 'full' })}>
                  <p className={css({ fontSize: 'sm', fontWeight: 'bold', color: 'ink' })}>{record.name}</p>
                  <p className={css({ fontFamily: 'mono', fontSize: '2xs', color: 'inkVariant', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>
                    {record.algorithm}
                  </p>
                </div>

                <label className={css({ w: 'full', display: 'flex', flexDirection: 'column', gap: '1' })}>
                  <span className={css({ fontFamily: 'sans', fontSize: '2xs', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'inkVariant' })}>Target ms</span>
                  <input
                    type="number"
                    min="1"
                    aria-label={`Target time for ${record.name}`}
                    value={targets[record.id] ?? record.targetMs}
                    onChange={(event) => onTarget(record.id, Number(event.target.value))}
                    className={css({
                      w: 'full', minH: '36px', px: '2', borderRadius: 'control',
                      bg: 'surface', color: 'ink', borderWidth: '1px', borderColor: 'floating',
                      fontFamily: 'mono', fontSize: 'xs',
                      _focus: { outline: 'none', borderColor: 'green' }
                    })}
                  />
                </label>

                <div className={css({ display: 'flex', gap: '2', w: 'full' })}>
                  <button
                    type="button"
                    aria-label={`Move ${record.name} earlier`}
                    disabled={index === 0}
                    onClick={() => onMove(record.id, -1)}
                    className={css({ flex: '1', minH: '32px', borderRadius: 'control', bg: 'transparent', borderWidth: '1px', borderColor: 'floating', color: 'inkVariant', cursor: 'pointer', _hover: { bg: 'floating', color: 'ink' }, _disabled: { opacity: '0.4', cursor: 'default' } })}
                  >↑</button>
                  <button
                    type="button"
                    aria-label={`Move ${record.name} later`}
                    disabled={index === queue.length - 1}
                    onClick={() => onMove(record.id, 1)}
                    className={css({ flex: '1', minH: '32px', borderRadius: 'control', bg: 'transparent', borderWidth: '1px', borderColor: 'floating', color: 'inkVariant', cursor: 'pointer', _hover: { bg: 'floating', color: 'ink' }, _disabled: { opacity: '0.4', cursor: 'default' } })}
                  >↓</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
