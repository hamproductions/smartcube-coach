import { css, cx } from 'styled-system/css'
import { formatSeconds } from './memo'
import { labelClass } from './ui'

export type RoundResult = { allRight: boolean; partsRight: number; parts: number; memoMs: number }

const valueClass = css({ fontFamily: 'mono', fontSize: 'lg', fontVariantNumeric: 'tabular-nums', color: 'ink', lineHeight: '1.2' })

export function SessionStrip({ results }: { results: RoundResult[] }) {
  const fullyCorrect = results.filter((result) => result.allRight).length
  const average = results.length ? results.reduce((total, result) => total + result.memoMs, 0) / results.length : undefined
  const recent = results.slice(-5)
  return (
    <section aria-label="Session" className={css({ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', columnGap: '6', rowGap: '2' })}>
      <div className={css({ display: 'grid' })}>
        <span className={labelClass}>Attempts</span>
        <span className={valueClass} data-testid="session-attempts">{results.length}</span>
      </div>
      <div className={css({ display: 'grid' })}>
        <span className={labelClass}>Fully correct</span>
        <span className={valueClass} data-testid="session-correct">{fullyCorrect}</span>
      </div>
      <div className={css({ display: 'grid' })}>
        <span className={labelClass}>Average memo</span>
        <span className={valueClass} data-testid="session-average">{average === undefined ? '-' : `${formatSeconds(average)} s`}</span>
      </div>
      {recent.length ? (
        <ol aria-label="Last memo times" className={css({ display: 'flex', gap: '1', listStyle: 'none', p: '0', m: '0' })}>
          {recent.map((result, index) => (
            <li
              key={results.length - recent.length + index}
              aria-label={`${result.partsRight} of ${result.parts} right in ${formatSeconds(result.memoMs)} seconds`}
              className={cx(
                css({ fontFamily: 'mono', fontSize: 'xs', fontVariantNumeric: 'tabular-nums', px: '1.5', py: '0.5', borderRadius: 'control', borderWidth: '1px' }),
                result.allRight ? css({ borderColor: 'green', color: 'green' }) : css({ borderColor: 'error', color: 'error' })
              )}
            >
              {formatSeconds(result.memoMs)}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
