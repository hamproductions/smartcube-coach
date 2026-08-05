import { useEffect, useRef, useState } from 'react'
import { LastLayerDiagram, defaultScheme, schemeFor } from './LastLayerDiagram'
import { defaultPreferences, readPreferences } from '../../storage/preferences'

// Copied from the reference implementations rather than invented.
//
// F2LTrainer's TwistyPlayerStatic.svelte (lines 100-118 of
// /tmp/refs/f2ltrainer/src/lib/components/TwistyPlayerStatic.svelte) configures the
// player exactly as below, including back-view/camera/drag settings that a hand-rolled
// version misses. Its camera defaults are DEFAULT_CAMERA_LATITUDE = 25 and
// DEFAULT_CAMERA_LONGITUDE = 30 (globalState.svelte.ts:6-7).
//
// The stickering is an explicit PIECE MASK, not a named preset:
//   EDGES:<12 chars>,CORNERS:<8 chars>,CENTERS:------
// where '-' is a normal sticker and 'I' is ignored (rendered dull). See
// /tmp/refs/f2ltrainer/src/lib/stickering.ts getStickeringString(). It is passed as
// `experimental-stickering-mask-orbits`.
//
// cubedex takes the other route for last-layer sets: a flat 2D-LL visualization plus a
// named category stickering (/tmp/refs/cubedex/src/components/CaseCard.tsx:20-22).
//
// Do NOT prefix a rotation here to get a yellow top. `experimental-2D-LL` renders the U
// face and the named stickerings are defined against it, so rotating the puzzle moves the
// last layer to D and the view then draws unmasked stickers — full-colour squares instead
// of the yellow/grey OLL diagram. A configurable top colour is a colour-scheme change
// (cubing.js does that through an `experimental-sprite` texture), not an orientation
// change. f2ltrainer can rotate only because it computes its piece mask from the chosen
// colours (src/lib/stickering.ts) rather than using a named preset.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'twisty-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>
    }
  }
}

const CAMERA_LATITUDE = 25
const CAMERA_LONGITUDE = 30

export function isLastLayerSet(set: string) {
  return /ll$/i.test(set.replace(/[^a-zA-Z0-9]/g, ''))
}

/** Named cubing.js stickerings, used for last-layer sets the way cubedex does. */
export function stickeringFor(set: string): string {
  const normalised = set.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const known = ['OLL', 'PLL', 'COLL', 'CMLL', 'ZBLL', 'OCLL', 'EPLL', 'CPLL', 'ELL', 'F2L', 'CLS', 'ELS', 'VLS', 'LS']
  return known.find((entry) => entry === normalised) ?? known.find((entry) => normalised.includes(entry)) ?? 'full'
}

export function CasePreview({ setup, set, size = 96 }: { setup: string; set: string; size?: number }) {
  // The hold the solver actually uses. Yellow on top is the usual one, but a solver who
  // holds white on top must see their own colours or the diagram is a different case.
  const [scheme, setScheme] = useState(() => schemeFor(defaultPreferences.diagramTopColor, defaultPreferences.diagramFrontColor) ?? defaultScheme)
  useEffect(() => {
    void readPreferences()
      .then((prefs) => setScheme(schemeFor(prefs.diagramTopColor, prefs.diagramFrontColor) ?? defaultScheme))
      .catch(() => undefined)
  }, [])
  const player = useRef<HTMLElement | null>(null)
  const host = useRef<HTMLDivElement | null>(null)
  const lastLayer = isLastLayerSet(set)

  // Visibility gating, as cubedex does in CaseCardPreview.tsx: a 167-card grid must not
  // mount 167 players. Only cards near the viewport get one; the rest stay empty boxes.
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = host.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
    }, { rootMargin: '200px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    if (navigator.userAgent.includes('jsdom')) return
    const load = customElements.get('twisty-player') ? Promise.resolve() : import('cubing/twisty')
    void load.then(async () => {
      await customElements.whenDefined('twisty-player')
      // Copied verbatim from CubePlayback.tsx:76-84, which is the only twisty in this
      // app that reliably paints. Firing intersectedCallback alone is not enough: the
      // content wrapper and the visualization wrapper both need an explicit height or
      // the player mounts at zero height and renders nothing.
      // Wait for layout before kicking. useEffect runs before paint, so the player still
      // measures 0×0 here; twisty marks itself intersected on that first call, builds a
      // zero-sized scene and never retries — which is why every card in the grid was blank
      // while kicking the same elements again from the console rendered them correctly.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const element = player.current
      const callback = element && Object.getOwnPropertySymbols(Object.getPrototypeOf(element)).find((symbol) => String(symbol).includes('intersectedCallback'))
      if (element && callback) {
        const internal = element as HTMLElement & { [key: symbol]: () => void; contentWrapper: HTMLElement }
        internal[callback]()
        if (internal.contentWrapper) {
          internal.contentWrapper.style.height = '100%'
          const visualization = internal.contentWrapper.querySelector<HTMLElement>('.visualization-wrapper')
          if (visualization) visualization.style.height = '100%'
        }
      }
    })
  }, [visible])

  // Last-layer sets are drawn, not rendered: cubing.js has no colour-scheme API, so its
  // 2D-LL view always shows a white top. See LastLayerDiagram for the full reasoning.
  if (lastLayer) {
    return (
      <div ref={host} style={{ width: size, height: size }}>
        <LastLayerDiagram setup={setup} mode={/pll/i.test(set) ? 'permutation' : 'orientation'} size={size} scheme={scheme} />
      </div>
    )
  }

  return (
    <div ref={host} style={{ width: size, height: size }}>
    {visible && <twisty-player
      ref={player}
      puzzle="3x3x3"
      alg=""
      experimental-setup-alg={setup}
      camera-latitude={CAMERA_LATITUDE}
      camera-longitude={CAMERA_LONGITUDE}
      camera-distance="4.7"
      experimental-stickering={stickeringFor(set)}
      visualization={lastLayer ? 'experimental-2D-LL' : '3D'}
      control-panel="none"
      experimental-drag-input="none"
      background="none"
      hint-facelets="none"
      back-view="none"
      viewer-link="none"
      style={{ width: `${size}px`, height: `${size}px` }}
    />}
    </div>
  )
}
