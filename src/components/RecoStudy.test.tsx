import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecoStudy } from './RecoStudy'

const imported = {
  id: '13444',
  sourceUrl: 'https://reco.nz/solve/13444',
  algUrl: 'https://alg.cubing.net/?setup=R&alg=U',
  solver: 'Yiheng Wang',
  result: '3.45',
  puzzle: '3x3',
  subtitle: '[WR] 2026-06-17 - reconstruction by Stewy',
  date: '2026-06-17',
  reconstructor: 'Stewy',
  scramble: "F2 R2 D U2 B2 D L2 U'",
  reconstruction: "z2 // inspection\nD' L R D R' U D // cross\nL' U L // 1st pair",
  moves: ["D'", 'L', 'R', 'D', "R'", 'U', 'D', "L'", 'U', 'L'],
  stages: [
    { label: 'inspection', alg: 'z2', moves: ['z2'] },
    { label: 'cross', alg: "D' L R D R' U D", moves: ["D'", 'L', 'R', 'D', "R'", 'U', 'D'] },
    { label: '1st pair', alg: "L' U L", moves: ["L'", 'U', 'L'] }
  ],
  stats: {
    Time: { Total: '3.45', F2L: '2.23' },
    STM: { Total: '47', F2L: '31' },
    STPS: { Total: '13.62', F2L: '13.90' }
  },
  videoUrl: 'https://www.youtube.com/embed/15qHa6UCimo'
}

afterEach(() => vi.unstubAllGlobals())

describe('RecoStudy', () => {
  it('imports a reco.nz URL into an attributed study player', async () => {
    const user = userEvent.setup()
    const fetcher = vi.fn(async () => new Response(JSON.stringify(imported), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    vi.stubGlobal('fetch', fetcher)
    render(<RecoStudy />)

    await user.clear(screen.getByRole('textbox', { name: 'reco.nz solve URL' }))
    await user.type(screen.getByRole('textbox', { name: 'reco.nz solve URL' }), imported.sourceUrl)
    await user.click(screen.getByRole('button', { name: 'Import reconstruction' }))

    expect(await screen.findByRole('heading', { name: 'Yiheng Wang · 3.45' })).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith(`/api/reco/import?url=${encodeURIComponent(imported.sourceUrl)}`)
    expect(screen.getByRole('link', { name: 'Open original on reco.nz' })).toHaveAttribute('href', imported.sourceUrl)
    expect(screen.getByRole('button', { name: 'Study cross' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Split %' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ETM' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'ETPS' })).toBeInTheDocument()
    expect(screen.getByText('100.0%')).toBeInTheDocument()
    expect(screen.getAllByText('2.90')).toHaveLength(2)
    expect(screen.getAllByText('–').length).toBeGreaterThan(0)
    expect(screen.getByRole('textbox', { name: 'Study notes' })).toBeInTheDocument()
  }, 30_000)
})
