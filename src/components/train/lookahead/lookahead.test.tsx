import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateColorInference } from '../../../domain/cognitive'
import { generateEdgeOrientationPrompt, generateEdgeTrackingPrompt, generatePairTrackingPrompt } from '../../../domain/tracking'
import { clearDatabase, repositories } from '../../../storage/database'
import { EdgeOrientationTrainer } from '../views/EdgeOrientation'
import { HiddenColoursTrainer } from '../views/HiddenColours'
import { PairTrackingTrainer } from '../views/PairTracking'
import { PieceTrackingTrainer } from '../views/PieceTracking'
import { CHOICE_KEYS, cornerStickers, EDGE_LAYERS, layerIds } from './positions'

const setup = () => userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })

async function playUntilHidden() {
  for (let step = 0; step < 30 && !screen.queryByTestId('lookahead-question'); step += 1) {
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
  }
  expect(screen.getByTestId('lookahead-question')).toBeInTheDocument()
}

describe('look-ahead trainers', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    window.localStorage.clear()
    await clearDatabase()
  })
  afterEach(async () => {
    vi.useRealTimers()
    await clearDatabase()
  })

  it('persists cubie-derived edge tracking attempts picked by tap', async () => {
    const user = setup()
    render(<PieceTrackingTrainer />)
    const prompt = generateEdgeTrackingPrompt('tracking-001')

    expect(screen.getByTestId('lookahead-target')).toHaveTextContent(`${prompt.target} edge`)
    await user.click(screen.getByRole('button', { name: /Start/ }))
    await playUntilHidden()
    await user.click(within(screen.getByRole('group', { name: 'Edge position' })).getByRole('button', { name: prompt.answer }))

    expect(screen.getByTestId('lookahead-verdict')).toHaveTextContent('Right')
    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'tracking' && attempt.answerCorrect && attempt.input === 'pointer')).toBe(true))
    expect(window.localStorage.getItem('lookahead:piece-tracking:round')).toBe('2')
  })

  it('answers edge tracking by number key and moves on with Space', async () => {
    const user = setup()
    render(<PieceTrackingTrainer />)
    const prompt = generateEdgeTrackingPrompt('tracking-001')
    const wrong = layerIds(EDGE_LAYERS).find((id) => id !== prompt.answer)!

    await user.keyboard(' ')
    await playUntilHidden()
    await user.keyboard(CHOICE_KEYS[layerIds(EDGE_LAYERS).indexOf(wrong)])

    expect(screen.getByTestId('lookahead-verdict')).toHaveTextContent('Wrong')
    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.family === 'tracking' && attempt.answerCorrect === false && attempt.answer === wrong && attempt.input === 'keyboard')).toBe(true))

    await user.keyboard(' ')
    expect(screen.getByTestId('lookahead-target')).toHaveTextContent(`${generateEdgeTrackingPrompt('tracking-002').target} edge`)
    expect(screen.getByTestId('session-attempts')).toHaveTextContent('1')
  })

  it('persists cubie-derived edge orientation attempts', async () => {
    const user = setup()
    render(<EdgeOrientationTrainer />)
    const prompt = generateEdgeOrientationPrompt('orientation-001')

    await user.click(screen.getByRole('button', { name: /Start/ }))
    await playUntilHidden()
    await user.click(screen.getByRole('button', { name: prompt.answer === 'flipped' ? 'Flipped' : 'Oriented' }))

    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.protocol === 'orientation-answer' && attempt.answerCorrect)).toBe(true))
  })

  it('persists cubie-derived pair tracking attempts picked corner first, then edge', async () => {
    const user = setup()
    render(<PairTrackingTrainer />)
    const prompt = generatePairTrackingPrompt('pair-001')
    const [corner, edge] = prompt.answer.split(' ')

    await user.click(screen.getByRole('button', { name: /Start/ }))
    await playUntilHidden()
    await user.click(within(screen.getByRole('group', { name: 'Corner position' })).getByRole('button', { name: corner }))
    await user.click(within(screen.getByRole('group', { name: 'Edge position' })).getByRole('button', { name: edge }))

    expect(screen.getByTestId('lookahead-verdict')).toHaveTextContent('Right')
    await waitFor(async () => expect((await repositories.attempts.all()).some((attempt) => attempt.setup.generatorId === 'cubie-pair-tracking' && attempt.answerCorrect && attempt.answer === prompt.answer)).toBe(true))
  })

  it('persists color-inference attempts and shows the next corner after Space', async () => {
    const user = setup()
    render(<HiddenColoursTrainer />)
    const prompt = generateColorInference('color-001')

    expect(screen.getByRole('img', { name: /Corner:/ })).toHaveAccessibleName(expect.stringContaining('hidden'))
    await user.click(within(screen.getByRole('group', { name: 'Colour' })).getByRole('button', { name: prompt.answer }))

    await waitFor(async () => expect(await repositories.attempts.all()).toHaveLength(1))
    const [attempt] = await repositories.attempts.all()
    expect(attempt.family).toBe('color-inference')
    expect(attempt.protocol).toBe('multiple-choice')
    expect(attempt.answerCorrect).toBe(true)

    await user.keyboard(' ')
    const second = generateColorInference('color-002')
    expect(screen.getByTestId('lookahead-target')).toHaveTextContent(`${second.visible[0]} and ${second.visible[1]}`)
  })

  it('places the visible colours on the corner in real cube order', () => {
    for (let round = 1; round <= 50; round += 1) {
      const prompt = generateColorInference(`color-${String(round).padStart(3, '0')}`)
      const stickers = cornerStickers(prompt)
      expect(stickers.filter((sticker) => sticker.hidden).map((sticker) => sticker.colour)).toEqual([prompt.answer])
      expect(new Set(stickers.map((sticker) => sticker.colour))).toEqual(new Set([...prompt.visible, prompt.answer]))
    }
    expect(cornerStickers({ seed: 'x', visible: ['White', 'Green'], answer: 'Red' }).map((sticker) => sticker.colour).join(' ')).toMatch(/^(White Green Red|Green Red White|Red White Green)$/)
  })
})
