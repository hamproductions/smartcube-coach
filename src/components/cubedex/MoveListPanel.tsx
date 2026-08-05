// Ported from poliva/cubedex (MIT License).
// Upstream repo: https://github.com/poliva/cubedex
// Source paths:
//   src/views/MoveListPanel.tsx
//   src/components/ui/Icon.tsx (EyeIcon, EyeSlashIcon)
//   src/state/trainingViewStore.ts (displayMoves/fixText/fixVisible shape)
//
// MIT License
// Copyright (c) 2024 Pau Oliva Fora
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// cubedex has no equivalent surface in this app: a live move list that colors
// each token of the algorithm as it is solved (green = done, next move
// circled, red = wrong moves detected, blue = a redundant/AUF/opposite move
// the recognizer is choosing to ignore) plus a "fix" strip showing the moves
// needed to get back on track. Upstream reads this from a global
// `trainingViewStore` (src/state/trainingViewStore.ts) fed by
// useTrainingState.ts's `buildDisplayState`. This app has no equivalent
// store, so this port takes the same data as props instead of subscribing to
// a store — the owning trainer surface computes `moves`/`fixText`/`fixVisible`
// itself (see wiring notes below) and passes them down.
//
// Token rewrite: cubedex's inline `var(--border)/--surface/--raised/--fg*` map
// to this app's tokens per docs/design-system.md: --border -> --line,
// --surface -> --panel, --raised -> --panel-raised, --fg -> --ink,
// --fg2/--fg3 -> --muted, --danger -> --orange, --accent -> --green.

import { memo, type CSSProperties } from 'react'

export type CubedexMoveColor = 'default' | 'green' | 'red' | 'blue' | 'next'

export interface CubedexDisplayMove {
  prefix: string
  token: string
  suffix: string
  color: CubedexMoveColor
  /** True for the single move immediately after the last completed move. */
  circle: boolean
}

export interface MoveListPanelProps {
  moves: CubedexDisplayMove[]
  fixText: string
  fixVisible: boolean
  darkMode: boolean
  isMoveMasked: boolean
  onToggleMoveMask: () => void
  onEditCurrentAlgorithm: () => void
  showMoves?: boolean
  showFix?: boolean
  /** When true, the red fix strip is not rendered (caller is merging it into its own status bar). */
  suppressFixErrorStrip?: boolean
  variant?: 'default' | 'algTrack'
}

function EyeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="-5.5 0 32 32" aria-hidden>
      <path d="M10.32 22.32c-5.6 0-9.92-5.56-10.12-5.8-0.24-0.32-0.24-0.72 0-1.040 0.2-0.24 4.52-5.8 10.12-5.8s9.92 5.56 10.12 5.8c0.24 0.32 0.24 0.72 0 1.040-0.2 0.24-4.56 5.8-10.12 5.8zM1.96 16c1.16 1.32 4.52 4.64 8.36 4.64s7.2-3.32 8.36-4.64c-1.16-1.32-4.52-4.64-8.36-4.64s-7.2 3.32-8.36 4.64zM10.32 20c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.84 4-4 4zM10.32 13.68c-1.28 0-2.32 1.040-2.32 2.32s1.040 2.32 2.32 2.32 2.32-1.040 2.32-2.32-1.040-2.32-2.32-2.32z" />
    </svg>
  )
}

function EyeSlashIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="-5.5 0 32 32" aria-hidden>
      <path d="M20.44 15.48c-0.12-0.16-2.28-2.92-5.48-4.56l0.92-3c0.12-0.44-0.12-0.92-0.56-1.040s-0.92 0.12-1.040 0.56l-0.88 2.8c-0.96-0.32-2-0.56-3.080-0.56-5.6 0-9.92 5.56-10.12 5.8-0.24 0.32-0.24 0.72 0 1.040 0.16 0.24 4.2 5.36 9.48 5.76l-0.56 1.8c-0.12 0.44 0.12 0.92 0.56 1.040 0.080 0.040 0.16 0.040 0.24 0.040 0.36 0 0.68-0.24 0.8-0.6l0.72-2.36c5-0.68 8.8-5.48 9-5.72 0.24-0.28 0.24-0.68 0-1zM1.96 16c1.16-1.32 4.52-4.64 8.36-4.64 0.88 0 1.76 0.2 2.6 0.48l-0.28 0.88c-0.68-0.48-1.48-0.72-2.32-0.72-2.2 0-4 1.8-4 4s1.8 4 4 4c0.040 0 0.040 0 0.080 0l-0.2 0.64c-3.8-0.080-7.080-3.36-8.24-4.64zM10.88 18.24c-0.2 0.040-0.4 0.080-0.6 0.080-1.28 0-2.32-1.040-2.32-2.32s1.040-2.32 2.32-2.32c0.68 0 1.32 0.32 1.76 0.8l-1.16 3.76zM12 20.44l2.4-7.88c1.96 1.080 3.52 2.64 4.24 3.44-0.96 1.12-3.52 3.68-6.64 4.44z" />
    </svg>
  )
}

function moveColorToCss(color: CubedexMoveColor, darkMode: boolean): string {
  if (color === 'green') return 'var(--pos)'
  if (color === 'red') return 'var(--orange)'
  if (color === 'blue') return 'var(--info)'
  if (color === 'next') return darkMode ? '#ffffff' : 'var(--ink)'
  return darkMode ? '#ffffff' : 'var(--ink)'
}

function MoveListPanelComponent({
  moves,
  fixText,
  fixVisible,
  darkMode,
  isMoveMasked,
  onToggleMoveMask,
  onEditCurrentAlgorithm,
  showMoves = true,
  showFix = false,
  suppressFixErrorStrip = false,
  variant = 'default',
}: MoveListPanelProps) {
  const isAlgTrack = variant === 'algTrack'
  const maskedStyle: CSSProperties = isMoveMasked ? { WebkitTextSecurity: 'disc' } as CSSProperties : {}

  return (
    <>
      {showMoves ? (
        <div
          style={
            isAlgTrack
              ? undefined
              : {
                borderRadius: 12,
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                padding: '10px 12px',
              }
          }
        >
          {!isAlgTrack && (
            <div style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleMoveMask()
                }}
                style={{
                  backgroundColor: isMoveMasked ? 'var(--orange)' : 'var(--green)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '4px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {isMoveMasked ? <><EyeSlashIcon size={20} /> Unmask alg</> : <><EyeIcon size={20} /> Mask alg</>}
              </button>
            </div>
          )}
          <div
            onClick={onEditCurrentAlgorithm}
            style={{
              borderRadius: isAlgTrack ? 0 : 10,
              background: isAlgTrack ? 'transparent' : 'var(--panel-raised)',
              padding: isAlgTrack ? 0 : '10px 12px',
              minHeight: isAlgTrack ? undefined : 48,
              minWidth: 0,
              cursor: 'pointer',
              fontFamily: 'var(--mono)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div style={{ color: darkMode ? '#fff' : 'var(--ink)' }}>
              {moves.map((move, index) => {
                const color = moveColorToCss(move.color, darkMode)
                return (
                  <span key={`${move.token}-${index}`}>
                    {move.prefix ? <span style={{ color: darkMode ? '#fff' : 'var(--ink)' }}>{move.prefix}</span> : null}
                    {move.circle ? (
                      <span style={{ border: '1px solid currentColor', borderRadius: '50%', padding: '0 4px' }}>
                        <span style={{ color, ...maskedStyle }}>{move.token}</span>
                      </span>
                    ) : (
                      <span style={{ color, ...maskedStyle }}>{move.token}</span>
                    )}
                    {move.suffix ? <span style={{ color: darkMode ? '#fff' : 'var(--ink)' }}>{move.suffix}</span> : null}{' '}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      {showFix && !suppressFixErrorStrip && fixVisible && fixText ? (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.08)',
            color: 'var(--orange)',
            padding: '9px 12px',
            marginTop: 8,
            fontFamily: 'var(--mono)',
            fontSize: 'clamp(1.0625rem, 2.5vw, 1.1875rem)',
            lineHeight: 1.35,
          }}
        >
          {fixText}
        </div>
      ) : null}
    </>
  )
}

export const MoveListPanel = memo(MoveListPanelComponent)
