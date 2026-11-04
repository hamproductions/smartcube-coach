import { css } from 'styled-system/css'
import { useEffect, useState } from 'react'
import { activateUpdate, registerSmartCubeCoachPwa } from '../pwa/register'
import { mono, primaryButton, secondaryButton } from './ui/Page'

export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [persisted, setPersisted] = useState<boolean>()
  const [usage, setUsage] = useState('')
  const [update, setUpdate] = useState(false)
  const [shellError, setShellError] = useState('')

  const refreshStorage = async () => {
    if (!navigator.storage) return
    const [isPersisted, estimate] = await Promise.all([
      navigator.storage.persisted?.() ?? Promise.resolve(false),
      navigator.storage.estimate()
    ])
    setPersisted(isPersisted)
    if (estimate.usage !== undefined && estimate.quota) {
      setUsage(`${(estimate.usage / 1_048_576).toFixed(1)} / ${(estimate.quota / 1_048_576).toFixed(0)} MB`)
    }
  }

  useEffect(() => {
    const handleOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOnline)
    void registerSmartCubeCoachPwa(setUpdate, setShellError)
    void refreshStorage()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOnline)
    }
  }, [])

  const persist = async () => {
    await navigator.storage.persist?.()
    await refreshStorage()
  }

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
      <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '3' })}>
        <span aria-hidden className={css({ mt: '1.5', w: '2', h: '2', borderRadius: 'pill', flexShrink: '0', bg: online ? 'green' : 'amber' })} />
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '1', minW: '0' })}>
          <span className={css({ fontWeight: 'medium' })}>{online ? 'Everything is stored on this device' : 'Offline. Everything keeps working from this device'}</span>
          <span className={css({ fontSize: 'sm', color: 'inkVariant' })}>
            {usage && <><span className={mono}>{usage}</span> used · </>}{persisted ? 'durable, the browser will not clear it' : 'best effort, the browser may clear it when space runs low'}
          </span>
          {shellError && <span className={css({ fontSize: 'sm', color: 'error' })}>{shellError}</span>}
        </div>
      </div>
      {(!persisted || update) && (
        <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
          {!persisted && <button type="button" onClick={() => void persist()} className={secondaryButton}>Protect local data</button>}
          {update && <button type="button" onClick={() => void activateUpdate()} className={primaryButton}>Install update</button>}
        </div>
      )}
    </div>
  )
}
