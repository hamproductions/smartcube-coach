import type { ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import { seconds } from './hooks'
import { mono } from './ui'

export type SessionResult = { id: string; success: boolean; totalMs: number }

export function SessionStrip({ results, children }: { results: SessionResult[]; children?: ReactNode }) {
  const successes = results.filter((result) => result.success).length
  const accuracy = results.length ? `${Math.round((successes / results.length) * 100)}%` : '-'
  const recent = results.slice(-5).reverse()
  return (
    <div
      aria-label="Session"
      className={css({
        display: 'flex', alignItems: 'center', gap: { base: '2', md: '6' }, flexWrap: 'wrap',
        px: { base: '3', md: '4' }, py: '2', minH: '48px', borderRadius: 'card', bg: 'container', borderWidth: '1px', borderColor: 'floating', fontSize: { base: 'xs', md: 'sm' }
      })}
    >
      <span className={css({ color: 'inkVariant' })}>Attempts <span className={cx(mono, css({ color: 'ink', fontWeight: 'semibold' }))}>{results.length}</span></span>
      <span className={css({ color: 'inkVariant' })}>Accuracy <span className={cx(mono, css({ color: 'ink', fontWeight: 'semibold' }))}>{accuracy}</span></span>
      <span className={css({ display: 'flex', alignItems: 'center', gap: '2', color: 'inkVariant', minW: '0' })}>
        Last
        {recent.length === 0 && <span className={mono}>-</span>}
        {recent.map((result) => (
          <span key={result.id} title={result.success ? 'Solved' : 'Missed'} className={cx(mono, css({ color: result.success ? 'ink' : 'error' }))}>
            {result.success ? seconds(result.totalMs) : 'miss'}
          </span>
        ))}
      </span>
      <span className={css({ flex: '1' })} />
      {children}
    </div>
  )
}
