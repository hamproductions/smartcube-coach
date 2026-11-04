import { useEffect, type ReactNode } from 'react'
import { css } from 'styled-system/css'
import { navigate, routeHref } from '../../app/route'
import { suspendSolveCapture } from '../../device/CubeConnection'
import { Icon, IC } from '../ui/Icon'
import type { TrainerInfo } from './trainers'

export function TrainerPage({ trainer, children }: { trainer: TrainerInfo; children: ReactNode }) {
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
    <div className={css({ w: 'full', maxW: '1280px', mx: 'auto', px: { base: '4', md: '8' }, py: { base: '4', md: '6' }, display: 'flex', flexDirection: 'column', gap: '6', flex: '1' })}>
      <header className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
        <a href={routeHref({ section: 'train' })} className={css({ display: 'inline-flex', alignItems: 'center', gap: '1', alignSelf: 'flex-start', minH: '44px', color: 'inkVariant', fontSize: 'sm', textDecoration: 'none', _hover: { color: 'ink' }, _focusVisible: { outline: '2px solid', outlineColor: 'green' } })}>
          <Icon d={IC.back} size={14} /> Train · {trainer.stage}
        </a>
        <h1 className={css({ fontSize: { base: 'xl', md: '2xl' }, fontWeight: 'semibold', letterSpacing: '-0.02em' })}>{trainer.name}</h1>
        <p className={css({ color: 'inkVariant', fontSize: 'sm', maxW: '70ch' })}>{trainer.purpose}</p>
      </header>
      <div className={css({ flex: '1', minH: '0', display: 'flex', flexDirection: 'column' })}>{children}</div>
    </div>
  )
}
