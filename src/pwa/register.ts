const CACHE_PREFIX = 'smart-cube-coach-shell'

let criticalActivity = 0
let registration: ServiceWorkerRegistration | undefined
let updateAvailable = false
let notifyUpdate: ((available: boolean) => void) | undefined

export function setCriticalActivity(active: boolean) {
  criticalActivity = Math.max(0, criticalActivity + (active ? 1 : -1))
}

export async function registerSmartCubeCoachPwa(onUpdate: (available: boolean) => void, onError?: (message: string) => void) {
  notifyUpdate = onUpdate
  if (!('serviceWorker' in navigator)) return onError?.('Offline shell unavailable: this browser has no service worker support')

  // Never run the offline shell against the dev server. The fetch handler in
  // public/sw.js is cache-first for same-origin GETs, and Vite's dev modules are
  // served unhashed, so a cached module is returned forever and source edits never
  // reach the page. That shipped a stale bundle for a whole session: fixes present
  // in the source kept throwing in the browser because the browser never saw them.
  // Tear down anything a previous dev visit installed, too — a worker already in
  // control keeps serving its cache no matter what this build does.
  if (import.meta.env.DEV) {
    // Scoped to this app's own worker and its own cache names. Both APIs are
    // origin-scoped, not app-scoped, and this machine runs several local projects
    // that can occupy the same host:port at different times — an unfiltered sweep
    // would delete a neighbouring project's offline data.
    const scope = new URL(import.meta.env.BASE_URL, location.origin).href
    for (const existing of await navigator.serviceWorker.getRegistrations()) {
      if (existing.scope === scope) await existing.unregister()
    }
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX)) await caches.delete(key)
    }
    return
  }
  try {
    registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  } catch (error) {
    return onError?.(`Offline shell unavailable: ${error instanceof Error ? error.message : 'registration failed'}`)
  }
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
