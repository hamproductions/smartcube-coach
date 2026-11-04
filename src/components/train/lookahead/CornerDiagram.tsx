import { css, cx } from 'styled-system/css'
import type { Colour, CornerSticker } from './positions'

export const COLOUR_FILL: Record<Colour, string> = {
  White: css({ fill: 'cube.u' }),
  Yellow: css({ fill: 'cube.d' }),
  Green: css({ fill: 'cube.f' }),
  Blue: css({ fill: 'cube.b' }),
  Red: css({ fill: 'cube.r' }),
  Orange: css({ fill: 'cube.l' })
}

export const COLOUR_SWATCH: Record<Colour, string> = {
  White: css({ bg: 'cube.u' }),
  Yellow: css({ bg: 'cube.d' }),
  Green: css({ bg: 'cube.f' }),
  Blue: css({ bg: 'cube.b' }),
  Red: css({ bg: 'cube.r' }),
  Orange: css({ bg: 'cube.l' })
}

const FACES = [
  { points: '50,50 14,29 50,8 86,29', label: { x: 50, y: 33 } },
  { points: '50,50 14,29 14,71 50,92', label: { x: 32, y: 65 } },
  { points: '50,50 86,29 86,71 50,92', label: { x: 68, y: 65 } }
]

export function CornerDiagram({ stickers, reveal, size }: { stickers: CornerSticker[]; reveal: boolean; size: number }) {
  const description = stickers.map((sticker, index) => `${['top', 'left', 'right'][index]} ${sticker.hidden && !reveal ? 'hidden' : sticker.colour.toLowerCase()}`).join(', ')
  return (
    <svg role="img" aria-label={`Corner: ${description}`} viewBox="0 0 100 100" width={size} height={size} className={css({ maxW: 'full', h: 'auto' })}>
      {stickers.map((sticker, index) => {
        const face = FACES[index]
        const covered = sticker.hidden && !reveal
        return (
          <g key={index}>
            <polygon points={face.points} className={cx(covered ? css({ fill: 'floating' }) : COLOUR_FILL[sticker.colour], css({ stroke: 'surface' }))} strokeWidth={2.5} strokeLinejoin="round" />
            {covered ? <text x={face.label.x} y={face.label.y} textAnchor="middle" dominantBaseline="middle" className={css({ fill: 'ink', fontFamily: 'mono', fontSize: 'md', fontWeight: 'bold' })}>?</text> : null}
          </g>
        )
      })}
    </svg>
  )
}
