import { defineConfig } from '@pandacss/dev'

// Kinetic Logic — the owner's Stitch design system, transcribed exactly from
// stitch_smart_cube_coach/kinetic_logic/DESIGN.md. "Cockpit modernism": a specialised
// instrument, not an application. Tonal layering instead of shadows, ghost borders
// instead of elevation, deep black so the cube's facets stay the brightest thing on
// screen. Do not substitute values here — the export is the source of truth.
export default defineConfig({
  preflight: true,
  presets: ['@pandacss/preset-base'],

  include: ['./src/**/*.{js,jsx,ts,tsx}'],
  exclude: [],

  theme: {
    extend: {
      keyframes: {
        pacerPulse: {
          '0%': { transform: 'scale(0.94)', opacity: '1' },
          '100%': { transform: 'scale(1.08)', opacity: '0.35' }
        }
      },
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      },
      tokens: {
        fonts: {
          // Geist carries the UI, JetBrains Mono carries every solve number. Tabular
          // digits stop the timer jumping and keep R / U' / L2 aligned for scanning.
          sans: { value: "Geist, system-ui, -apple-system, sans-serif" },
          mono: { value: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }
        },
        colors: {
          // Tonal layering, level 0 through 2.
          surface: { value: '#09090b' },
          container: { value: '#18181b' },
          floating: { value: '#27272a' },
          ghost: { value: '#27272a' },
          ink: { value: '#e5e1e4' },
          inkVariant: { value: '#bccbb9' },
          outline: { value: '#869585' },
          // Aliases so surfaces written before the export landed still resolve.
          ground: { value: '#09090b' },
          inkMuted: { value: '#bccbb9' },
          rule: { value: '#27272a' },
          green: { value: '#22c55e' },
          greenBright: { value: '#4be277' },
          onGreen: { value: '#003915' },
          blue: { value: '#3b82f6' },
          amber: { value: '#f59e0b' },
          error: { value: '#ffb4ab' },
          cube: {
            u: { value: '#f7f9fc' },
            d: { value: '#ffd500' },
            f: { value: '#009b48' },
            b: { value: '#0051ba' },
            r: { value: '#b90000' },
            l: { value: '#ff5900' }
          }
        },
        radii: {
          // Soft, not square: a precision tool, not a brutalist one.
          control: { value: '0.25rem' },
          card: { value: '0.5rem' },
          pill: { value: '9999px' }
        },
        spacing: {
          // 4px base, per the design system. The numeric scale must exist or every
          // px/py/gap/h in the app silently resolves to nothing and the layout collapses.
          '0.5': { value: '2px' },
          '1': { value: '4px' },
          '1.5': { value: '6px' },
          '2': { value: '8px' },
          '2.5': { value: '10px' },
          '3': { value: '12px' },
          '3.5': { value: '14px' },
          '4': { value: '16px' },
          '5': { value: '20px' },
          '6': { value: '24px' },
          '7': { value: '28px' },
          '8': { value: '32px' },
          '9': { value: '36px' },
          '10': { value: '40px' },
          '11': { value: '44px' },
          '12': { value: '48px' },
          '14': { value: '56px' },
          '16': { value: '64px' },
          '20': { value: '80px' },
          gutter: { value: '16px' },
          // Interactive targets are pressed with a cube in both hands.
          touch: { value: '48px' }
        },
        sizes: {
          // Numeric entries mirror the spacing scale. Without them `h: '8'` passed the
          // raw number through as 8px instead of 32px, which silently collapsed a
          // progress bar, a picture box, a CTA and a set of transport controls before it
          // was traced. Any property reading this scale now behaves like spacing does.
          '0.5': { value: '2px' },
          '1': { value: '4px' },
          '1.5': { value: '6px' },
          '2': { value: '8px' },
          '2.5': { value: '10px' },
          '3': { value: '12px' },
          '3.5': { value: '14px' },
          '4': { value: '16px' },
          '5': { value: '20px' },
          '6': { value: '24px' },
          '7': { value: '28px' },
          '8': { value: '32px' },
          '9': { value: '36px' },
          '10': { value: '40px' },
          '11': { value: '44px' },
          '12': { value: '48px' },
          '14': { value: '56px' },
          '16': { value: '64px' },
          '20': { value: '80px' },
          '32': { value: '128px' },
          touch: { value: '48px' },
          // 'w: full' and friends silently do nothing without these, which collapsed
          // every full-width child to its content width.
          full: { value: '100%' },
          screen: { value: '100vw' },
          fit: { value: 'fit-content' },
          reading: { value: '68ch' }
        },
        fontSizes: {
          // Standard scale as well as the named design-system sizes: surfaces written
          // before the export use these, and without them every small label falls back
          // to body size and overflows its row.
          '2xs': { value: '10px' },
          xs: { value: '12px' },
          sm: { value: '14px' },
          md: { value: '16px' },
          lg: { value: '18px' },
          xl: { value: '20px' },
          '2xl': { value: '24px' },
          '3xl': { value: '30px' },
          '4xl': { value: '36px' },
          '6xl': { value: '60px' },
          '8xl': { value: '96px' },
          timer: { value: '120px' },
          timerMobile: { value: '72px' },
          scramble: { value: '24px' },
          headline: { value: '32px' },
          body: { value: '16px' },
          data: { value: '14px' },
          label: { value: '12px' }
        }
      },
      textStyles: {
        timer: {
          value: {
            fontFamily: 'mono', fontSize: '120px', fontWeight: '700',
            lineHeight: '120px', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums'
          }
        },
        scramble: {
          // Generous tracking so no two moves read as one during preparation.
          value: { fontFamily: 'mono', fontSize: '24px', fontWeight: '500', lineHeight: '32px', letterSpacing: '0.1em' }
        },
        headline: {
          value: { fontFamily: 'sans', fontSize: '32px', fontWeight: '600', lineHeight: '40px' }
        },
        body: {
          value: { fontFamily: 'sans', fontSize: '16px', fontWeight: '400', lineHeight: '24px' }
        },
        data: {
          value: { fontFamily: 'mono', fontSize: '14px', fontWeight: '400', lineHeight: '20px', fontVariantNumeric: 'tabular-nums' }
        },
        labelCaps: {
          value: { fontFamily: 'sans', fontSize: '12px', fontWeight: '700', lineHeight: '16px', textTransform: 'uppercase' }
        }
      }
    }
  },

  jsxFramework: 'react',
  outdir: './styled-system',

  importMap: {
    css: 'styled-system/css',
    recipes: 'styled-system/recipes',
    patterns: 'styled-system/patterns',
    jsx: 'styled-system/jsx'
  },

  globalCss: {
    html: { colorScheme: 'dark' },
    'html, body': {
      bg: 'surface',
      color: 'ink',
      fontFamily: 'sans',
      WebkitFontSmoothing: 'antialiased'
    },
    body: { margin: '0', minWidth: '320px' },
    'button, a': { font: 'inherit', color: 'inherit' },
    ':where(button, a, input, select, textarea, summary):focus-visible': { outline: '2px solid {colors.green}', outlineOffset: '2px' }
  },

  lightningcss: true,
  minify: process.env.NODE_ENV === 'production',
  hash: process.env.NODE_ENV === 'production' ? { className: true, cssVar: true } : false
})
