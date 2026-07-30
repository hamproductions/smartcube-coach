import { describe, expect, it, vi } from 'vitest'
import { importReco } from './recoImport'

const page = `
  <div class="container">
    <h1>Yiheng Wang - 3.45 3x3 solve</h1>
    <h3>2026-06-17 - reconstruction by <a>Stewy</a></h3>
    <div id="reconstruction">R U R' U'\nR U R' // cross</div>
    <table id="solvestats"><tr><th></th><th>Total</th></tr><tr><th>Time</th><td>3.45</td></tr></table>
  </div>
`

describe('importReco', () => {
  it('fetches and parses a canonical reco.nz solve', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(page, { status: 200 }))

    const reconstruction = await importReco('https://www.reco.nz/solve/13444?tracking=1', fetcher)

    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0][0]).toBe('https://reco.nz/solve/13444')
    expect(reconstruction.solver).toBe('Yiheng Wang')
    expect(reconstruction.stats.Time.Total).toBe('3.45')
  })

  it('rejects upstream failures', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response('missing', { status: 404 }))

    await expect(importReco('https://reco.nz/solve/999999', fetcher)).rejects.toThrow('reco.nz returned 404')
  })
})
