import type { ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import type { Insight } from '../../domain/coachInsights'
import { routeHref } from '../../app/route'
import { trainerById } from '../train/trainers'
import { card, mono, plain, primaryButton, secondaryButton } from '../ui/Page'

export function InsightCard({ insight, extra }: { insight: Insight; extra?: ReactNode }) {
  const trainer = trainerById(insight.trainer)
  return (
    <article className={cx(card, css({ p: { base: '4', md: '5' }, display: 'flex', flexDirection: 'column', gap: '3' }))}>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
        <h3 className={css({ fontSize: 'md', fontWeight: 'semibold' })}>{plain(insight.headline)}</h3>
        <p className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant', lineHeight: '1.6' }))}>{plain(insight.evidence)}</p>
      </div>
      {insight.action && (
        <p className={css({ fontSize: 'sm', lineHeight: '1.6', pl: '3', borderLeftWidth: '2px', borderColor: 'green' })}>
          <span className={css({ color: 'green', fontWeight: 'semibold' })}>Do this: </span>{plain(insight.action)}
        </p>
      )}
      {!insight.action && insight.detail && <p className={css({ fontSize: 'sm', color: 'inkVariant', lineHeight: '1.6' })}>{plain(insight.detail)}</p>}
      {(trainer || insight.example || extra) && (
        <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap', alignItems: 'center' })}>
          {trainer && <a href={routeHref({ section: 'train', detail: trainer.id })} className={primaryButton}>Train: {trainer.name}</a>}
          {insight.example && <a href={routeHref({ section: 'stats', detail: insight.example.solveId })} className={secondaryButton}>Replay worst solve</a>}
          {extra}
          {insight.example && <span className={cx(mono, css({ fontSize: 'xs', color: 'inkVariant' }))}>{insight.example.label}</span>}
        </div>
      )}
    </article>
  )
}
