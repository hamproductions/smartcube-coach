import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { formatSeconds } from './memo'

export function MemoClock({ startedAt, stoppedAt }: { startedAt: number; stoppedAt?: number }) {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (stoppedAt !== undefined) return
    setNow(performance.now())
    const id = window.setInterval(() => setNow(performance.now()), 100)
    return () => window.clearInterval(id)
  }, [startedAt, stoppedAt])

  const elapsed = Math.max(0, (stoppedAt ?? now) - startedAt)
  return (
    <div className={css({ display: 'flex', alignItems: 'baseline', gap: '3' })}>
      <span aria-label="Memo time" data-testid="memo-time" className={css({ fontFamily: 'mono', fontSize: { base: '4xl', md: '6xl' }, fontWeight: 'semibold', lineHeight: '1', fontVariantNumeric: 'tabular-nums', color: 'ink' })}>
        {formatSeconds(elapsed)}
      </span>
      <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>{stoppedAt === undefined ? 'seconds memo' : 'seconds, stopped'}</span>
    </div>
  )
}
