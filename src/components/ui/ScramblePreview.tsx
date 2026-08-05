import { scrambleDiagram } from '../../domain/tools/scrambleImage'

interface ScramblePreviewProps {
  scramble: string
  cellPx?: number
  view?: 'net' | 'layer'
  /**
   * Which pieces matter for this case, mirroring cubedex's per-category stickering
   * (/tmp/refs/cubedex/src/lib/stickering.ts, applied at CaseCard.tsx:22). OLL is an
   * orientation problem, so only "is this facing up" is shown; PLL is a permutation
   * problem, so the side colours stay. Full colour on an OLL case is noise that makes
   * every case look alike.
   */
  stickering?: 'full' | 'OLL' | 'PLL'
}

// FACE_ORDER is D L B U R F, so U is index 3 and the four side faces are 1, 2, 4, 5.
const U_FACE = 3
const SIDE_FACES = [2, 4, 5, 1] as const

export function ScramblePreview({ scramble, cellPx = 14, view = 'net', stickering = 'full' }: ScramblePreviewProps) {
  const diagram = scrambleDiagram(scramble, 3, cellPx)

  if (view === 'layer') {
    // The top-down recognition diagram: the U face with each neighbour's adjacent row
    // wrapped around it. This is how a case is actually recognised mid-solve, and it's
    // what the case cards in the design show — a net spread is unreadable at 128px.
    const gap = Math.max(2, Math.round(cellPx * 0.3))
    const strip = Math.round(cellPx * 0.7)
    const span = cellPx * 3
    const extent = span + (strip + gap) * 2
    const origin = strip + gap

    const cells: Array<{ key: string; x: number; y: number; w: number; h: number; color: string }> = []

    const U_COLOUR = diagram.stickers.find((entry) => entry.face === U_FACE && entry.row === 1 && entry.col === 1)?.color
    const DIM = '#3f3f46'
    const paint = (colour: string, isTop: boolean) => {
      if (stickering === 'full') return colour
      // Side stickers that face out ARE the recognition cue: Sune and Antisune share a
      // U-face pattern and differ only in which side the U colour shows. Greying every
      // side sticker made those cases render identically.
      if (stickering === 'OLL') return colour === U_COLOUR ? colour : DIM
      return colour
    }

    for (const sticker of diagram.stickers) {
      if (sticker.face === U_FACE) {
        cells.push({
          key: `u-${sticker.row}-${sticker.col}`,
          x: origin + sticker.col * cellPx,
          y: origin + sticker.row * cellPx,
          w: cellPx, h: cellPx, color: paint(sticker.color, true)
        })
        continue
      }
      // Only the row that physically touches the U layer belongs in this view.
      if (sticker.row !== 0) continue
      const side = SIDE_FACES.indexOf(sticker.face as (typeof SIDE_FACES)[number])
      if (side === -1) continue

      // Column direction, derived from the net offsets in scrambleImage.faceOffset:
      // the net is L F R B in a row under U, so F keeps U's left-to-right order and L
      // does too once folded, while R's near-F column and B's near-R column end up at
      // the far end of their strips. Those two are drawn reversed.
      const reversed = side === 0 || side === 1
      const column = reversed ? 2 - sticker.col : sticker.col
      const along = origin + column * cellPx
      const cell =
        side === 0 ? { x: along, y: 0, w: cellPx, h: strip } :
        side === 1 ? { x: origin + span + gap, y: along, w: strip, h: cellPx } :
        side === 2 ? { x: along, y: origin + span + gap, w: cellPx, h: strip } :
                     { x: 0, y: along, w: strip, h: cellPx }
      cells.push({ key: `s${sticker.face}-${sticker.col}`, ...cell, color: paint(sticker.color, false) })
    }

    return (
      <svg className="scramble-preview" width={extent} height={extent} style={{ display: 'block' }}>
        {cells.map((cell) => (
          <rect key={cell.key} x={cell.x} y={cell.y} width={cell.w} height={cell.h} fill={cell.color} stroke="var(--line)" strokeWidth={1} rx={1} />
        ))}
      </svg>
    )
  }

  return (
    <svg className="scramble-preview" width={diagram.width} height={diagram.height} style={{ display: 'block' }}>
      {diagram.stickers.map((sticker) => (
        <rect
          key={`${sticker.face}-${sticker.row}-${sticker.col}`}
          x={sticker.x}
          y={sticker.y}
          width={sticker.size}
          height={sticker.size}
          fill={sticker.color}
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}
