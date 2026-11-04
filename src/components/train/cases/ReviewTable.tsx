import { css, cx } from 'styled-system/css'
import type { AlgorithmRecord, TrainerAttempt } from '../../../domain/models'
import { seconds } from './hooks'
import { card, mono } from './ui'

const best = (values: Array<number | undefined>) => {
  const real = values.filter((value): value is number => value !== undefined)
  return real.length ? Math.min(...real) : undefined
}

export function caseRunning(attempts: TrainerAttempt[], caseId: string) {
  const tries = attempts.filter((attempt) => attempt.caseId === caseId)
  const solved = tries.filter((attempt) => attempt.outcome === 'success').sort((left, right) => left.endedAt - right.endedAt)
  const recent = solved.slice(-5).map((attempt) => attempt.totalMs)
  return {
    tries: tries.length,
    successRate: tries.length ? solved.length / tries.length : undefined,
    recentMs: recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : undefined,
    bestMs: best(solved.map((attempt) => attempt.totalMs)),
    recognitionMs: best(solved.map((attempt) => attempt.recognitionMs)),
    executionMs: best(solved.map((attempt) => attempt.executionMs))
  }
}

const cell = css({ px: '3', py: '2', textAlign: 'right', whiteSpace: 'nowrap' })

export function ReviewTable({ records, attempts }: { records: AlgorithmRecord[]; attempts: TrainerAttempt[] }) {
  const rows = records
    .map((record) => ({ record, stat: caseRunning(attempts, record.id) }))
    .filter((row) => row.stat.tries > 0)
    .sort((left, right) => (right.stat.recentMs ?? Infinity) - (left.stat.recentMs ?? Infinity))
  return (
    <section aria-labelledby="case-statistics" className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
      <h2 id="case-statistics" className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>Case statistics</h2>
      {rows.length === 0 ? (
        <p className={css({ color: 'inkVariant', fontSize: 'sm' })}>No attempts yet. Start a session and each case you drill appears here, slowest first.</p>
      ) : (
        <div className={cx(card, css({ overflowX: 'auto' }))}>
          <table className={cx(mono, css({ w: 'full', borderCollapse: 'collapse', fontSize: 'sm' }))}>
            <thead>
              <tr className={css({ color: 'inkVariant', fontSize: 'xs', borderBottomWidth: '1px', borderColor: 'floating' })}>
                <th className={css({ px: '3', py: '2', textAlign: 'left', fontFamily: 'sans', fontWeight: 'medium' })}>Case</th>
                <th className={cell}>Tries</th>
                <th className={cell}>Success</th>
                <th className={cell}>Last 5</th>
                <th className={cell}>Best</th>
                <th className={cell}>Best rec</th>
                <th className={cell}>Best exec</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ record, stat }) => (
                <tr key={record.id} className={css({ borderBottomWidth: '1px', borderColor: 'floating', _last: { borderBottomWidth: '0' } })}>
                  <td className={css({ px: '3', py: '2', fontFamily: 'sans', whiteSpace: 'nowrap' })}>{record.name}</td>
                  <td className={cell}>{stat.tries}</td>
                  <td className={cx(cell, css({ color: (stat.successRate ?? 0) < 0.8 ? 'error' : 'ink' }))}>{Math.round((stat.successRate ?? 0) * 100)}%</td>
                  <td className={cell}>{seconds(stat.recentMs) || '-'}</td>
                  <td className={cell}>{seconds(stat.bestMs) || '-'}</td>
                  <td className={cell}>{seconds(stat.recognitionMs) || '-'}</td>
                  <td className={cell}>{seconds(stat.executionMs) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
