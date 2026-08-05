import { describe, expect, it } from 'vitest'
import { normalizeRecoUrl, parseRecoHtml } from './reco'

const html = `
  <div class="container">
    <h1><a href="/solver/yiheng-wang">Yiheng Wang</a> - 3.45 3x3 solve</h1>
    <h3>[WR] 2026-06-17 - Hefei Cubing League 3x3 III 2026 - reconstruction by <a href="/reconstructor/stewy">Stewy</a></h3>
    <div id="reconstruction">
      F2 R2 D U2 B2 D L2 U' R2 U F R' F2 U' R2 D2 R F' L' F' U'

      z2 // inspection
      D' L R D R' U D // cross
      L' U L // 1st pair
      R' F R F' R' F R F' // 2nd pair
      M2' U2 M2' // EPLL
    </div>
    <a id="alg-link" href="https://alg.cubing.net/?setup=F2+R2+D+U2+B2+D+L2+U%27+R2+U+F+R%27+F2+U%27+R2+D2+R+F%27+L%27+F%27+U%27&alg=z2+%2F%2F+inspection%0AD%27+L+R+%2F%2F+cross">alg.cubing.net</a>
    <table id="solvestats">
      <tr><th></th><th>Total</th><th>F2L</th><th>LL</th></tr>
      <tr><th>Time</th><td>3.45</td><td>2.23</td><td>1.22</td></tr>
      <tr><th>STM</th><td>47</td><td>31</td><td>16</td></tr>
      <tr><th>STPS</th><td>13.62</td><td>13.90</td><td>13.11</td></tr>
    </table>
    <iframe src="https://www.youtube.com/embed/15qHa6UCimo"></iframe>
  </div>
`

describe('reco.nz integration', () => {
  it('accepts only canonical public solve URLs', () => {
    expect(normalizeRecoUrl('https://reco.nz/solve/13444')).toBe('https://reco.nz/solve/13444')
    expect(normalizeRecoUrl('https://www.reco.nz/solve/13444?x=1')).toBe('https://reco.nz/solve/13444')
    expect(() => normalizeRecoUrl('https://reco.nz.evil.test/solve/13444')).toThrow('Invalid reco.nz solve URL')
    expect(() => normalizeRecoUrl('https://reco.nz/about')).toThrow('Invalid reco.nz solve URL')
  })

  it('extracts reconstruction, stages, stats and attribution', () => {
    const reconstruction = parseRecoHtml(html, 'https://reco.nz/solve/13444')

    expect(reconstruction.id).toBe('13444')
    expect(reconstruction.solver).toBe('Yiheng Wang')
    expect(reconstruction.result).toBe('3.45')
    expect(reconstruction.puzzle).toBe('3x3')
    expect(reconstruction.reconstructor).toBe('Stewy')
    expect(reconstruction.scramble).toContain("F2 R2 D U2")
    expect(reconstruction.stages.map((stage) => stage.label)).toEqual([
      'inspection',
      'cross',
      '1st pair',
      '2nd pair',
      'EPLL'
    ])
    expect(reconstruction.moves).toHaveLength(22)
    expect(reconstruction.moves[0]).toBe('z2')
    expect(reconstruction.turnMoves).toHaveLength(21)
    expect(reconstruction.stats.Time.Total).toBe('3.45')
    expect(reconstruction.stats.STPS.F2L).toBe('13.90')
    expect(reconstruction.videoUrl).toBe('https://www.youtube.com/embed/15qHa6UCimo')
    expect(reconstruction.sourceUrl).toBe('https://reco.nz/solve/13444')
  })
})
