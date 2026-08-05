import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScramblePreview } from './ScramblePreview'

const stickerColors = (container: HTMLElement) => Array.from(container.querySelectorAll('rect')).map((rect) => rect.getAttribute('fill'))

describe('ScramblePreview', () => {
  it('renders 54 stickers for a 3x3 scramble', () => {
    const { container } = render(<ScramblePreview scramble="R U R' U'" />)
    expect(container.querySelectorAll('rect')).toHaveLength(54)
  })

  it('renders the solved cube (all faces solid) for an empty scramble', () => {
    const { container } = render(<ScramblePreview scramble="" />)
    const colors = stickerColors(container)
    const distinct = new Set(colors)
    expect(distinct.size).toBe(6)
    for (const color of distinct) {
      expect(colors.filter((c) => c === color)).toHaveLength(9)
    }
  })

  it('renders different sticker colours for different scrambles', () => {
    const solved = render(<ScramblePreview scramble="" />)
    const scrambled = render(<ScramblePreview scramble="R U R' U' F2 D L B2" />)
    expect(stickerColors(scrambled.container)).not.toEqual(stickerColors(solved.container))
  })

  it('reflects a single U turn by leaving the D face untouched', () => {
    const { container } = render(<ScramblePreview scramble="U" />)
    const rects = Array.from(container.querySelectorAll('rect'))
    const dFaceRects = rects.slice(0, 9)
    const dColor = dFaceRects[0]?.getAttribute('fill')
    for (const rect of dFaceRects) {
      expect(rect.getAttribute('fill')).toBe(dColor)
    }
  })
})
