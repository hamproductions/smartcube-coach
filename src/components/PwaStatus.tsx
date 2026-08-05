import { css } from 'styled-system/css'
import { Button } from './ui/Button'
import { useEffect, useState } from 'react'
import { activateUpdate, registerSmartCubeCoachPwa } from '../pwa/register'

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
    <div className={css({ display: 'flex', alignItems: 'center', gap: '2', minW: '0' })}>
      <span className={css({ w: '2', h: '2', borderRadius: 'full', flexShrink: '0', bg: online ? 'green' : 'outline' })} />
      <div className={css({ display: 'grid', minW: '0', lineHeight: 'tight' })}>
        <strong className={css({ fontSize: '2xs', letterSpacing: 'wide', color: 'ink', whiteSpace: 'nowrap' })}>{online ? 'LOCAL FIRST' : 'OFFLINE'}</strong>
        <small className={css({ fontSize: '2xs', color: 'inkVariant', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>{usage || 'Storage checking…'} · {persisted ? 'durable' : 'best effort'}</small>
        {shellError && <small className={css({ fontSize: '2xs', color: 'error' })}>{shellError}</small>}
      </div>
      {!persisted && <Button size="xs" variant="outline" aria-label="Protect local data" onClick={persist}>Protect</Button>}
      {update && <Button size="xs" aria-label="Install update" onClick={() => void activateUpdate()}>Update</Button>}
    </div>
  )
}
