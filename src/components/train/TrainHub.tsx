import { css } from 'styled-system/css'
import { routeHref } from '../../app/route'
import { TRAINERS, TRAINER_STAGES } from './trainers'

const CUBE_LABEL = { required: 'Smart cube', optional: 'Smart cube or keyboard', none: 'No cube needed' } as const

export function TrainHub() {
  return (
    <div className={css({ w: 'full', maxW: '1180px', mx: 'auto', px: { base: '4', md: '8' }, py: { base: '6', md: '10' }, display: 'flex', flexDirection: 'column', gap: '10' })}>
      <header className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
        <h1 className={css({ fontSize: { base: '2xl', md: '3xl' }, fontWeight: 'semibold', letterSpacing: '-0.02em' })}>Train</h1>
        <p className={css({ color: 'inkVariant', maxW: '60ch' })}>Pick the part of the solve you want faster. Each trainer does one thing.</p>
      </header>
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
