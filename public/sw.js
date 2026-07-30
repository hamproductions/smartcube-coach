const CACHE = 'vector-shell-v3'
const BASE = new URL('./', self.location.href).pathname
const path = (value) => new URL(value, self.registration.scope).pathname
const INDEX = path('index.html')
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'icon.svg', 'maskable.svg', 'offline.svg'].map(path)

async function precache() {
  const cache = await caches.open(CACHE)
  const response = await fetch(INDEX)
  const html = await response.clone().text()
  await cache.put(INDEX, response)
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => `${url.pathname}${url.search}`)
  await Promise.allSettled([...new Set([...SHELL, ...assets])].map((asset) => cache.add(asset)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith(`${BASE}api/reco`)) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone()
      void caches.open(CACHE).then((cache) => cache.put(INDEX, copy))
      return response
    }).catch(() => caches.match(INDEX)))
    return
  }
  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
    if (response.ok) void caches.open(CACHE).then((cache) => cache.put(request, response.clone()))
    return response
  })))
})
