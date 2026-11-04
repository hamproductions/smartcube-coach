import { useEffect, useRef, type ReactNode } from 'react'
import { css } from 'styled-system/css'
import { navigate, routeHref } from '../../app/route'
import { suspendSolveCapture } from '../../device/CubeConnection'
import { TRAINERS, TRAINER_STAGES, type TrainerInfo } from './trainers'

const railLink = css({
  display: 'flex', alignItems: 'center', gap: '2', minH: '44px', px: '3', borderRadius: 'control',
  fontSize: 'sm', color: 'inkVariant', textDecoration: 'none', whiteSpace: 'nowrap',
  _hover: { color: 'ink', bg: 'floating' },
  _focusVisible: { outline: '2px solid', outlineColor: 'green', outlineOffset: '-2px' },
  '&[aria-current=page]': { color: 'ink', bg: 'floating', fontWeight: 'semibold' }
})

function CubeDot({ trainer }: { trainer: TrainerInfo }) {
  if (trainer.cube === 'none') return null
  return <span aria-label={trainer.cube === 'required' ? 'needs a smart cube' : 'uses a smart cube'} title={trainer.cube === 'required' ? 'Needs a smart cube' : 'Uses a smart cube when connected'} className={css({ w: '1.5', h: '1.5', borderRadius: 'pill', flexShrink: '0', bg: trainer.cube === 'required' ? 'green' : 'outline' })} />
}

export function TrainerPage({ trainer, children }: { trainer: TrainerInfo; children: ReactNode }) {
  const chips = useRef<HTMLElement>(null)
  useEffect(() => {
    const row = chips.current
    const current = row?.querySelector<HTMLElement>('[aria-current=page]')
    if (row && current) row.scrollLeft = current.offsetLeft - row.clientWidth / 2 + current.clientWidth / 2
  }, [trainer.id])

  useEffect(() => {
    void suspendSolveCapture(true)
    return () => { void suspendSolveCapture(false) }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[role=dialog]')) return
      navigate({ section: 'train' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={css({ w: 'full', maxW: '1440px', mx: 'auto', flex: '1', display: 'grid', gridTemplateColumns: { base: '1fr', lg: '15rem minmax(0, 1fr)' }, minH: '0' })}>
      <nav aria-label="Trainers" className={css({ display: { base: 'none', lg: 'flex' }, flexDirection: 'column', gap: '4', px: '4', py: '6', borderRightWidth: '1px', borderColor: 'floating', overflowY: 'auto' })}>
        <a href={routeHref({ section: 'train' })} className={railLink}>All training</a>
        {TRAINER_STAGES.map((stage) => (
          <div key={stage} className={css({ display: 'flex', flexDirection: 'column', gap: '0.5' })}>
            <span className={css({ px: '3', fontSize: 'xs', color: 'inkVariant', textTransform: 'uppercase', letterSpacing: '0.06em' })}>{stage}</span>
            {TRAINERS.filter((entry) => entry.stage === stage).map((entry) => (
              <a key={entry.id} href={routeHref({ section: 'train', detail: entry.id })} aria-current={entry.id === trainer.id ? 'page' : undefined} className={railLink}>
                <span className={css({ flex: '1', truncate: true })}>{entry.name}</span>
                <CubeDot trainer={entry} />
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className={css({ minW: '0', px: { base: '4', md: '8' }, py: { base: '4', md: '6' }, display: 'flex', flexDirection: 'column', gap: '5' })}>
        <nav ref={chips} aria-label="Switch trainer" className={css({ display: { base: 'flex', lg: 'none' }, gap: '1', overflowX: 'auto', mx: { base: '-4', md: '-8' }, px: { base: '4', md: '8' } })}>
          <a href={routeHref({ section: 'train' })} className={railLink}>All</a>
          {TRAINERS.map((entry) => (
            <a key={entry.id} href={routeHref({ section: 'train', detail: entry.id })} aria-current={entry.id === trainer.id ? 'page' : undefined} className={railLink}>{entry.name}</a>
          ))}
        </nav>
        <header className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
          <span className={css({ fontSize: 'xs', color: 'inkVariant', textTransform: 'uppercase', letterSpacing: '0.06em' })}>{trainer.stage}</span>
          <h1 className={css({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: 'semibold', letterSpacing: '-0.02em' })}>{trainer.name}</h1>
          <p className={css({ color: 'inkVariant', fontSize: 'sm', maxW: '70ch' })}>{trainer.purpose}</p>
        </header>
        <div className={css({ flex: '1', minH: '0', display: 'flex', flexDirection: 'column' })}>{children}</div>
      </div>
    </div>
  )
}
