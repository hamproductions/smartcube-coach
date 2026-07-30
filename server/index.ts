import { importReco } from './recoImport'

const port = Number(Bun.env.PORT ?? 3001)
const dist = new URL('../dist/', import.meta.url)

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store'
    }
  })

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/api/reco/import') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
      const sourceUrl = url.searchParams.get('url')
      if (!sourceUrl) return json({ error: 'Missing reco.nz solve URL' }, 400)

      try {
        return json(await importReco(sourceUrl))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed'
        const status = message === 'Invalid reco.nz solve URL' ? 400 : 502
        return json({ error: message }, status)
      }
    }

    if (Bun.env.NODE_ENV !== 'production') {
      return new Response('Not found', { status: 404 })
    }

    const pathname = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    if (pathname.includes('..')) return new Response('Not found', { status: 404 })
    const asset = Bun.file(new URL(pathname, dist))
    if (await asset.exists()) return new Response(asset)
    return new Response(Bun.file(new URL('index.html', dist)))
  }
})

console.log(`Smart Cube Coach server listening on http://127.0.0.1:${server.port}`)
