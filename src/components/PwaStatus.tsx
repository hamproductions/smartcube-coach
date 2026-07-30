import { useEffect, useState } from 'react'
import { activateUpdate, registerVectorPwa } from '../pwa/register'

export function PwaStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [persisted, setPersisted] = useState<boolean>()
  const [usage, setUsage] = useState('')
  const [update, setUpdate] = useState(false)

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
    registerVectorPwa(setUpdate)
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
    <div className="pwa-status">
      <span className={online ? 'status-dot' : 'status-dot offline'} />
      <div><strong>{online ? 'LOCAL FIRST' : 'OFFLINE'}</strong><small>{usage || 'Storage checking…'} · {persisted ? 'durable' : 'best effort'}</small></div>
      {!persisted && <button aria-label="Protect local data" onClick={persist}>PROTECT</button>}
      {update && <button aria-label="Install update" onClick={() => void activateUpdate()}>UPDATE</button>}
    </div>
  )
}
