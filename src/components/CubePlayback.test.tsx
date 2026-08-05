import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CubePlayback } from './CubePlayback'

type CatchUpMove = { move: unknown; amount: number }

function stubTwistyModel(element: Element) {
  const experimentalAddMove = vi.fn()
  const tempoScaleSet = vi.fn()
  let catchUpListener: ((value: CatchUpMove) => void) | undefined
  const catchUpMove = {
    addFreshListener: vi.fn((callback: (value: CatchUpMove) => void) => { catchUpListener = callback }),
    removeFreshListener: vi.fn(),
  }
  const model = {
    experimentalAddMove,
    tempoScale: { set: tempoScaleSet },
    catchUpMove,
  }
  Object.defineProperty(element, 'experimentalModel', { value: model, configurable: true })
  const resolveCatchUp = () => {
    catchUpListener?.({ move: 'x', amount: 0 })
    catchUpListener?.({ move: null, amount: 0 })
  }
  return { experimentalAddMove, tempoScaleSet, catchUpMove, resolveCatchUp }
}

function stubSetupAlgSetter(element: Element) {
  const setupAlgSet = vi.fn()
  Object.defineProperty(element, 'experimentalSetupAlg', { set: setupAlgSet, configurable: true })
  Object.defineProperty(element, 'alg', { set: vi.fn(), configurable: true })
  return setupAlgSet
}

describe('CubePlayback', () => {
  it('renders the supplied physical setup state instead of replay setup', () => {
    const { container } = render(<CubePlayback title="Live cube state" scramble="R U" moves={[]} stages={[]} setupAlg="F2" />)

    expect(container.querySelector('twisty-player')?.getAttribute('experimental-setup-alg')).toBe('F2')
    expect(container.querySelector('twisty-player')?.getAttribute('hint-facelets')).toBe('none')
  })

  it('accepts an external move index for controller-driven playback', () => {
    const { container } = render(<CubePlayback title="Execution" scramble="" moves={['R', 'U']} stages={[]} playbackIndex={1} />)

    // The played moves go into the setup alg, not `alg`: a twisty-player renders the
    // position at the START of its alg, so moves placed there leave the cube frozen.
    expect(container.querySelector('twisty-player')?.getAttribute('experimental-setup-alg')).toBe('R')
  })

  it('assigns the live setup anchor once and feeds consecutive moves through experimentalAddMove', () => {
    const { container, rerender } = render(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="" />)
    const element = container.querySelector('twisty-player') as Element
    const setupAlgSet = stubSetupAlgSetter(element)
    const { experimentalAddMove, resolveCatchUp } = stubTwistyModel(element)

    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U" />)
    expect(setupAlgSet).toHaveBeenCalledTimes(1)
    expect(setupAlgSet).toHaveBeenCalledWith('R U')
    expect(experimentalAddMove).not.toHaveBeenCalled()

    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U R'" />)
    expect(experimentalAddMove).toHaveBeenNthCalledWith(1, "R'", { cancel: false })
    resolveCatchUp()

    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U R' F" />)
    expect(experimentalAddMove).toHaveBeenNthCalledWith(2, 'F', { cancel: false })
    resolveCatchUp()

    expect(experimentalAddMove).toHaveBeenCalledTimes(2)
    expect(setupAlgSet).toHaveBeenCalledTimes(1)
  })

  it('queues a burst of moves and accelerates tempo instead of dropping any', () => {
    const { container, rerender } = render(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="" />)
    const element = container.querySelector('twisty-player') as Element
    stubSetupAlgSetter(element)
    const { experimentalAddMove, tempoScaleSet, resolveCatchUp } = stubTwistyModel(element)

    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R" />)

    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U R2" />)
    expect(experimentalAddMove).toHaveBeenCalledTimes(1)
    expect(experimentalAddMove).toHaveBeenNthCalledWith(1, 'U', { cancel: false })

    resolveCatchUp()
    expect(experimentalAddMove).toHaveBeenCalledTimes(2)
    expect(experimentalAddMove).toHaveBeenNthCalledWith(2, 'R2', { cancel: false })
    expect(tempoScaleSet).toHaveBeenCalledWith(5)

    resolveCatchUp()
    expect(experimentalAddMove).toHaveBeenCalledTimes(2)
  })

  it('never hands the player a fragment when a move grows in place', () => {
    const { container, rerender } = render(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="" />)
    const element = container.querySelector('twisty-player')!
    stubSetupAlgSetter(element)
    const { experimentalAddMove, resolveCatchUp } = stubTwistyModel(element)

    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U" />)
    // "R U" is a string prefix of "R U2", so diffing the raw strings yields the fragment
    // "2", which the player cannot parse. It must re-seed instead of appending.
    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U2" />)
    resolveCatchUp()

    for (const call of experimentalAddMove.mock.calls) {
      expect(String(call[0])).toMatch(/^[URFDLBMESxyzrlfdub]w?[2']?$/)
    }
  })

  it('survives a move the player cannot parse instead of taking the page down', () => {
    const { container, rerender } = render(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="" />)
    const element = container.querySelector('twisty-player')!
    stubSetupAlgSetter(element)
    const { experimentalAddMove } = stubTwistyModel(element)
    experimentalAddMove.mockImplementation(() => { throw new Error('internal parsing error') })

    rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R" />)
    expect(() => rerender(<CubePlayback title="Live cube state" scramble="" moves={[]} stages={[]} live setupAlg="R U" />)).not.toThrow()
    expect(container.querySelector('twisty-player')).toBeInTheDocument()
  })
})

describe('CubePlayback stepping', () => {
  it('renders the played moves as cube state, not as an unplayed alg', () => {
    const { container } = render(<CubePlayback title="Saved solve replay" scramble="R U" moves={['F', 'B']} stages={[]} playbackIndex={2} />)
    const player = container.querySelector('twisty-player')

    // A twisty-player shows the position at the START of its alg. Moves placed in
    // `alg` therefore leave the cube frozen on the scramble while the move counter
    // advances — the player visibly never turns.
    expect(player?.getAttribute('experimental-setup-alg')).toBe('R U F B')
    expect(player?.getAttribute('alg')).toBe('')
  })

  it('advances one move per click when clicks land in a single React batch', async () => {
    const { container, getByLabelText } = render(<CubePlayback title="Saved solve replay" scramble="R U" moves={['F', 'B', 'L', 'D']} stages={[]} />)
    const next = getByLabelText('Next move')

    // Three clicks with no await between them share one batch. Reading moveIndex from
    // each handler's own closure made every click compute the same target, so the cube
    // advanced by a single move no matter how many times it was pressed.
    await act(async () => { next.click(); next.click(); next.click() })

    expect(container.querySelector('twisty-player')?.getAttribute('experimental-setup-alg')).toBe('R U F B L')
  })
})
