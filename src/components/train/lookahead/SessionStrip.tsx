import { css, cx } from 'styled-system/css'

export type SessionResult = { success: boolean; ms: number }

const labelClass = css({ fontSize: 'xs', color: 'inkVariant' })
const valueClass = css({ fontFamily: 'mono', fontSize: 'lg', fontVariantNumeric: 'tabular-nums', color: 'ink', lineHeight: '1.2' })

function currentStreak(results: SessionResult[]) {
  let streak = 0
  for (let index = results.length - 1; index >= 0 && results[index].success; index -= 1) streak += 1
  return streak
}

export function SessionStrip({ results }: { results: SessionResult[] }) {
  const correct = results.filter((result) => result.success).length
  const accuracy = results.length ? `${Math.round((correct / results.length) * 100)}%` : '0%'
  const recent = results.slice(-5)
  return (
    <section aria-label="Session" className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: '6', rowGap: '2' })}>
      <div className={css({ display: 'grid' })}>
        <span className={labelClass}>Attempts</span>
        <span className={valueClass} data-testid="session-attempts">{results.length}</span>
      </div>
      <div className={css({ display: 'grid' })}>
        <span className={labelClass}>Accuracy</span>
        <span className={valueClass}>{accuracy}</span>
      </div>
      <div className={css({ display: 'grid' })}>
        <span className={labelClass}>Streak</span>
        <span className={valueClass}>{currentStreak(results)}</span>
      </div>
      {recent.length ? (
        <ol aria-label="Last answers" className={css({ display: 'flex', gap: '1', listStyle: 'none', p: '0', m: '0' })}>
          {recent.map((result, index) => (
            <li
              key={results.length - recent.length + index}
              aria-label={`${result.success ? 'Right' : 'Wrong'} in ${(result.ms / 1000).toFixed(2)} seconds`}
              className={cx(
                css({ fontFamily: 'mono', fontSize: 'xs', fontVariantNumeric: 'tabular-nums', px: '1.5', py: '0.5', borderRadius: 'control', borderWidth: '1px' }),
                result.success ? css({ borderColor: 'green', color: 'green' }) : css({ borderColor: 'error', color: 'error' })
              )}
            >
              {(result.ms / 1000).toFixed(1)}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
