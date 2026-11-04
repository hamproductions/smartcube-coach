import { useEffect, useState } from 'react'
import { css } from 'styled-system/css'
import { routeHref } from '../../app/route'
import { TRAINERS, TRAINER_STAGES } from './trainers'
import { PageHeader, pageFrame } from '../ui/Page'
import { repositories } from '../../storage/database'
import { buildInsights, type Insight } from '../../domain/coachInsights'
import { InsightCard } from '../history/InsightCard'
import { trainerForInsight } from '../history/CoachingHistory'

const CUBE_LABEL = { required: 'Smart cube', optional: 'Smart cube or keyboard', none: 'No cube needed' } as const

export function TrainHub() {
  const [focus, setFocus] = useState<Insight>()
  useEffect(() => {
    void repositories.stages.all().then((stages) => {
      const top = buildInsights(stages).find((insight) => insight.trainer ?? trainerForInsight(insight))
      if (top) setFocus({ ...top, trainer: top.trainer ?? trainerForInsight(top)?.id })
    }).catch(() => undefined)
  }, [])
  return (
    <div className={pageFrame}>
      <PageHeader title="Train" description="Pick the part of the solve you want faster. Each trainer does one thing." />
      {focus && (
        <section aria-labelledby="focus-heading" className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <h2 id="focus-heading" className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'green' })}>From your solves: start here</h2>
          <InsightCard insight={focus} />
        </section>
      )}
      {TRAINER_STAGES.map((stage) => (
        <section key={stage} aria-labelledby={`stage-${stage}`} className={css({ display: 'grid', gap: '4', md: { gridTemplateColumns: '180px 1fr' } })}>
          <h2 id={`stage-${stage}`} className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'inkVariant', pt: '3' })}>{stage}</h2>
          <ul className={css({ display: 'grid', gap: '3', gridTemplateColumns: { base: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, listStyle: 'none', p: '0', m: '0' })}>
            {TRAINERS.filter((trainer) => trainer.stage === stage).map((trainer) => (
              <li key={trainer.id}>
                <a
                  href={routeHref({ section: 'train', detail: trainer.id })}
                  className={css({
                    h: 'full', display: 'flex', flexDirection: 'column', gap: '2', p: '5',
                    bg: 'container', borderWidth: '1px', borderColor: 'floating', borderRadius: 'card',
                    color: 'ink', textDecoration: 'none', transition: 'border-color 120ms, background 120ms',
                    _hover: { borderColor: 'outline', bg: 'floating' },
                    _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '2px' }
                  })}
                >
                  <span className={css({ fontWeight: 'semibold', fontSize: 'md' })}>{trainer.name}</span>
                  <span className={css({ color: 'inkVariant', fontSize: 'sm', lineHeight: '1.5', flex: '1' })}>{trainer.purpose}</span>
                  <span className={css({ fontSize: 'xs', color: trainer.cube === 'required' ? 'green' : 'inkVariant' })}>{CUBE_LABEL[trainer.cube]}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
