let criticalActivity = 0
let registration: ServiceWorkerRegistration | undefined
let updateAvailable = false
let notifyUpdate: ((available: boolean) => void) | undefined

export function setCriticalActivity(active: boolean) {
  criticalActivity = Math.max(0, criticalActivity + (active ? 1 : -1))
}

export async function registerVectorPwa(onUpdate: (available: boolean) => void) {
  notifyUpdate = onUpdate
  if (!('serviceWorker' in navigator)) return
  registration = await navigator.serviceWorker.register('/sw.js')
  const inspect = () => {
    if (!registration?.waiting) return
    updateAvailable = true
    notifyUpdate?.(true)
  }
  inspect()
  registration.addEventListener('updatefound', () => {
    const worker = registration?.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) inspect()
    })
  })
}

export async function activateUpdate() {
  if (!updateAvailable || !registration?.waiting || criticalActivity > 0) return false
  const reloading = new Promise<void>((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
  })
  registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  await reloading
  window.location.reload()
  return true
}
