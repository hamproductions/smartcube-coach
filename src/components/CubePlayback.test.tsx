import { act, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CubePlayback } from './CubePlayback'

const shownAlg = (container: HTMLElement) => container.querySelector('[data-testid=cube-3d]')?.getAttribute('data-setup-alg')

describe('CubePlayback', () => {
  it('renders the supplied physical setup state instead of replay setup', () => {
    const { container } = render(<CubePlayback title="Live cube state" scramble="R U" moves={[]} stages={[]} setupAlg="F2" />)
    expect(shownAlg(container)).toBe('F2')
  })

  it('accepts an external move index for controller-driven playback', () => {
    const { container } = render(<CubePlayback title="Execution" scramble="" moves={['R', 'U']} stages={[]} playbackIndex={1} />)
    expect(shownAlg(container)).toBe('R')
  })

  it('follows a live setup alg as moves are appended', () => {
    const { container, rerender } = render(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="" />)
    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U" />)
    expect(shownAlg(container)).toBe('R U')
    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U2" />)
    expect(shownAlg(container)).toBe('R U2')
  })
})

describe('CubePlayback stepping', () => {
  it('renders the played moves as cube state', () => {
    const { container } = render(<CubePlayback title="Saved solve replay" scramble="R U" moves={['F', 'B']} stages={[]} playbackIndex={2} />)
    expect(shownAlg(container)).toBe('R U F B')
  })

  it('advances one move per click when clicks land in a single React batch', async () => {
    const { container, getByLabelText } = render(<CubePlayback title="Saved solve replay" scramble="R U" moves={['F', 'B', 'L', 'D']} stages={[]} />)
    const next = getByLabelText('Next move')
    await act(async () => { next.click(); next.click(); next.click() })
    expect(shownAlg(container)).toBe('R U F B L')
  })
})
