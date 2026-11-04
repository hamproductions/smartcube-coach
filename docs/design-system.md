# Design system

Binding rules for this app's interface. The tokens live in `panda.config.ts` (the owner's Kinetic Logic system, exported from Stitch into `docs/design/stitch/kinetic_logic/`); this file describes how they are used. Direction and references are in `docs/design/moodboard.md`. The previous version of this file described a blue-accent cubedex palette in `src/styles.css`; that sheet is legacy and nothing new may use it.

## Rules

1. **The cube is the brightest thing on screen.** Dark ground, tonal surfaces, one accent. The product is used with a cube in both hands, often in a dim room, so the cube colours and the clock carry the screen.
2. **One accent: green** (`green`, hover `greenBright`, text on it `onGreen`). It marks the one primary action on a screen, the active choice in a group, the next move to turn, and success. `amber` is for warnings and over-time; `error` is for wrong answers and failures. Nothing else gets colour, except the CFOP stage colours in splits.
3. **Numbers are mono and tabular**: times, scrambles, moves, TPS, counts. `fontFamily: 'mono'` with `fontVariantNumeric: 'tabular-nums'`. Prose is the sans stack.
4. **No wide-tracked uppercase labels and no em dash characters in UI copy.** Labels are sentence case, `xs` or `sm`, `inkVariant`.
5. **Every colour, radius and space comes from a token.** Use Panda `css()`; no new rules in `src/styles.css`, no legacy class names.
6. **Cards only where grouping helps.** Surfaces that hold one task (the solve stage, the stat rails) sit flat; a verdict, a scramble block or a setting group may be a `container` card with a `floating` hairline border. No shadows for elevation.
7. **Never call a screen done without looking at it** at 1440x900 and 390x844 in a real browser.

## Tokens (`panda.config.ts`)

| Token | Value | Use |
|---|---|---|
| `surface` | `#09090b` | Page ground |
| `container` | `#18181b` | Cards, inputs, mobile tab bar |
| `floating` | `#27272a` | Hairline borders, hover, pressed chips |
| `ink` | `#e5e1e4` | Primary text |
| `inkVariant` | `#bccbb9` | Secondary text and labels |
| `outline` | `#869585` | Hover borders, dashed add buttons |
| `green` / `greenBright` / `onGreen` | `#22c55e` / `#4be277` / `#003915` | The accent (rule 2) |
| `amber` | `#f59e0b` | Warnings, over inspection |
| `error` | `#ffb4ab` | Wrong, failed, destructive |
| radii `control` / `card` / `pill` | 4px / 8px / 9999px | Controls / cards / dots and rings |
| spacing | 4px scale, plus `touch` 48px | Every interactive target is at least 44px tall |

## Layout grammar

- **Shell** (`src/components/shell/AppShell.tsx`): one 56px top bar with the brand, the five destinations (Solve, Train, Stats, Study, Settings) and the cube connection status. On phones the destinations move to a bottom tab bar. Only `<main>` scrolls. Routes are hash routes (`src/app/route.ts`), so back and links work.
- **Page frame**: centred column up to about 1280px, side padding 16px on phones and 32px from `md`, an `h1` with one line of `inkVariant` description, then the work.
- **Solve**: session times rail, then the stage (scramble, live cube, clock, actions), then the averages rail. On phones the stage comes first.
- **Train**: the hub groups trainers by solve stage. Every trainer is a page in `TrainerPage` with a back link, and follows the loop in `docs/redesign/trainer-flows.md`: setup, prompt on the cube, answer, verdict, next with Space.
- **Choices** are chips: `floating` border, pressed state `green` border on `floating` fill with `aria-pressed`.

## The cube

`Cube3D` (`src/components/solve/Cube3D.tsx`) renders every 3D cube with the three.js renderer in `src/components/cube/CubeRenderer.ts`: rounded black cubies, inset stickers, animated layer turns, optional gyro orientation and piece highlighting. It fills its parent unless given a `size`. Each one holds a WebGL context, so case grids use `CasePreview` thumbnails instead, and flat case diagrams (`LastLayerDiagram`, `ScramblePreview`) stay 2D on purpose.

## Copy

Active voice, sentence case, the same verb through a flow. A control says what happens ("Check plan", "Next scramble"). Empty states say why they are empty and the one action that fills them. Errors say what happened and what to do. No marketing register.

## Quality floor

Works at 390px with no horizontal scroll, visible focus on every control, `prefers-reduced-motion` respected, zero console errors, verified by screenshot in a real browser.
