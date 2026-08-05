# Design system

Binding rules for this app's interface. Derived from the shipped UIs of the reference set, inspected in a browser on 2026-08-03 (evidence and screenshot paths: `docs/research/execution-receipt-2026-08-03-gyst-4.md`), and from a direct token/component port of `poliva/cubedex` on 2026-08-04 (source: `/tmp/refs/cubedex`, MIT, © 2024 Pau Oliva Fora). This app is a cubing tool. It is not a marketing site, and nothing in it may be designed from imagination while a reference already solves the same screen.

## Non-negotiable

1. **No per-route hero.** A route never opens with a full-viewport display heading. Every reference (acubemy, cubedex, csTimer, solved.no) puts the working surface at the top of the fold. Page identity lives in the nav, not in a 56 px `<h1>`. This is why the 2026-08-04 cubedex port did **not** add a second "compact context topbar" row under `.topnav`: cubedex's `DesktopTopbar` shows a screen title + selected-category breadcrumb, but this app already puts that identity in the nav pills and each page's own toolbar (e.g. `TrainerHub`'s `.trainer-toolbar`) — stacking a second title bar on top would violate this rule, not satisfy it.
2. **Section headings are names, not sentences.** "Session averages", not "How each stage is going." A kicker and a heading never say the same thing twice.
3. **Surfaces are real, with one deliberate exception.** Panels are bordered, rounded, filled cards. Never re-add a global `border: 0; background: none` override — that is exactly what flattened this app into text on black once already. **The exception is the solve surface**: `.timer-stage` and `.stat-rail` sit flat on the page with no card, because acubemy's playground does the same so that nothing competes with the scramble, the cube and the timer. Applying the card rule there made the page read as clutter. Every other surface keeps its card. This exception survives the cubedex token port unchanged — only colour *values* changed, no surface gained or lost its card treatment.
4. **Never call a screen done without looking at it.** Screenshot it, and open the reference screenshot beside your own in the same pass — judging fidelity from memory is guessing. A cube that stopped rendering shipped once because the page was declared finished from an older screenshot.
4. **Numbers are mono and tabular.** Times, scrambles, move counts, TPS, percentages: `DM Mono`, `font-variant-numeric: tabular-nums`. Prose is `Space Grotesk`.
5. **One accent.** `--green` marks the single primary action or active state on a surface. `--pos` and `--orange` are reserved for verdicts (pass/fail, learned/unlearned). No decorative colour. As of the 2026-08-04 cubedex port the `--green` token holds cubedex's actual accent value — blue (`#3b82f6`), not amber — because the token's *name* is kept for backward compatibility with every existing rule that references it, while its *value* now comes from the reference source. Treat `--green` as "the accent token", not literally green.
6. **Every colour comes from a token.** No hex literal in a component or a new rule.

## Tokens (`src/styles.css` `:root`)

Ported 2026-08-04 from `poliva/cubedex`, `src/styles/index.css` (the `html.dark { ... }` variable block) and the inline `var(--accent)` / `var(--surface)` / `var(--raised)` usage across `src/components/shell` and `src/components/ui`. This project's token *names* are unchanged so every existing rule keeps working; only the *values* are cubedex's dark-mode palette.

| Token | Value | Cubedex source | Use |
|---|---|---|---|
| `--bg` | `#111827` | `--bg` (dark) | Page ground |
| `--panel` | `#1f2937` | `--surface` (dark) | Card surface |
| `--panel-raised` | `#374151` | `--raised` (dark) | Inputs, chips, nested surfaces |
| `--line` | `#4b5563` | `--border-l` (dark) | Every border and divider |
| `--ink` | `#ffffff` | `--fg` (dark) | Primary text |
| `--muted` | `#9ca3af` | `--fg3` (dark) | Secondary text |
| `--faint` | `#6b7280` | `--fg4` (dark) | Label / tertiary text |
| `--green` | `#3b82f6` | `--accent` (dark) | Accent: primary action, active pill, focus ring (blue, despite the token name — kept for compatibility, see rule 5 above) |
| `--pos` | `#22c55e` | `--ok` (dark) | Pass, learned, improved |
| `--orange` | `#ef4444` | `--danger` (dark) | Fail, DNF, regression |
| `--info` | `#60a5fa` | derived from cubedex's `--accent-tint` (dark) | Neutral emphasis |
| `--rail` | `288px` | not in cubedex | Width of the stat rail |
| `--radius` | `12px` | `--radius` | Containers/cards (new — cubedex has a two-tier radius scale this app lacked) |
| `--radius-sm` | `8px` | `--radius-sm` | Inputs/buttons/pills (new) |
| `--radius-pill` | `9999px` | `--radius-pill` | Fully round controls (new) |
| `--shadow-sm` / `--shadow-md` | see `:root` | `--shadow-sm` / `--shadow-md` | Card/control elevation (new) |
| `--mono` | `'DM Mono', ...` | `--mono` | Numeric/code type stack as a token (new) |
| `--sidebar-w` / `--tab-h` | `64px` / `60px` | `--sidebar-w` / `--tab-h` | Reserved for a future vertical icon rail / mobile tab bar (new, not yet laid out — this app's shell stays a horizontal `.topnav`) |

Radius 8 px on controls, 10–12 px on panels. Panel padding `clamp(16px, 2vw, 22px)`.

## Layout grammar per surface

**Shell** — sticky 58 px top bar: brand mark, horizontal nav pills, storage state, primary action. Content centred at `min(1520px, 100%)`. Nav pills (`.nav-item`) and the primary action (`.button.primary`) now carry a leading icon (`src/components/ui/Icon.tsx`, ported from cubedex's `Sidebar`/`BottomTabBar` icon set), matching cubedex's icon+label chrome without changing this app's horizontal-topnav architecture into cubedex's vertical sidebar — the shell stays a top bar per rule 1.

**Live Solve** (csTimer + acubemy playground): `.solve-layout` is main + `.stat-rail`.
Main runs `.scramble-bar` (full width, large mono) → `.timer-stage` (`.cube-frame`, `.timer-display`, `.timer-hint`, `.stage-actions`).
Rail runs `.session-bar` → `.stat-table` (rows single/ao5/ao12/ao50/ao100 × columns NOW/BEST) → `.times-list` of `.time-chip`.
Everything that is not the solve loop — MAC entry, device picker, self-test, diagnostics, session export/replay, gyro — lives in `<details className="device-drawer">` below the stage. The primary path is scramble → cube → timer, always.

**Train** (cubedex case library): `.trainer-toolbar` holds three `.pill-row`s — category, subset, learning state, each `.pill` carrying a `.pill-count`. Below them `.case-grid` of `.case-card`: `.case-card-head` (`.case-name` + `.case-badge`), `.case-mastery` bar, `.case-stats` of `.case-stat`. Selection drives one primary "Practice selected" action. `.case-card`'s resting/selected/alternating-row treatment (4 px transparent-to-accent-tinted border, resting `--shadow-sm` elevation, `nth-child(even)` row tint) is ported directly from cubedex's `src/components/CaseCard.tsx`.

**Solves / Progress**: stat strip card, then coaching, then history, then data. Tables are hairline-ruled inside a card, never free-floating.

## Ported UI primitives (`src/components/ui/`)

Added 2026-08-04, each with an attribution header naming its `poliva/cubedex` source path:

- `Icon.tsx` — the `Icon`/`IC` shape from cubedex's `ui/Icon.tsx`, wired into `App.tsx`'s nav pills and primary action. **Reachable.**
- `Toggle.tsx`, `StatChip.tsx`, `MiniGraph.tsx`, `EmptyState.tsx` — ported 1:1 with inline styles rewritten onto this app's token names. **Not yet imported by any page** — `TrainerHub.tsx`, `HistoryProgress.tsx` etc. own their markup and were not edited (out of scope for the agent that ported these). A page owner adopting one of these should confirm with `grep -rl` that it is actually reachable before calling it shipped, per the no-unreachable-features rule in `AGENTS.md`.

## Copy

Active voice, sentence case, the same verb through a whole flow. A control says what happens: "Save revision", not "Submit". Empty states name the next action and never apologise. Errors state what happened and what to do. No marketing register anywhere in the product surface.

## Quality floor

Responsive to 390 px, keyboard focus visible on every control, `prefers-reduced-motion` respected, zero console errors. Verify by screenshot in a real browser before calling any UI work done — not by reading the CSS.

## Recorded deviations from Park UI

`AGENTS.md` requires taking the component from Park UI before hand-rolling a `styled()` primitive. Two controls in the Train toolbar deliberately do not, and the reasons belong here rather than only in a code comment.

**The case-set control is a native `<select>`, not Park UI's `Select`.** Park UI's `Select` is built on Ark's listbox: a button trigger plus a rendered popup, not a `<select>` element. Three things follow. The catalogue can run to hundreds of entries, and a native select gets the platform's own long-list handling — including the full-screen picker on mobile — for free. Type-ahead comes from the platform rather than from a re-implementation. And the control is driven in tests with `selectOptions`, which exercises real change events; the Ark listbox would need those rewritten into click sequences that assert less about the actual filtering.

**The subset / learning / mode rows are buttons, not Park UI's `SegmentGroup`.** `SegmentGroup` renders radio inputs. These three rows are filters, not a form field being submitted, and they are asserted in the trainer tests as pressable controls with `aria-pressed`. Swapping in radios changes what those tests assert about the toolbar rather than how it looks, which is a worse trade than styling three small button rows with Panda.

Everything else on a rebuilt surface takes the Park UI component — `Button` is used in the app shell, the status widget and Today. If a future control has no such constraint, use Park UI and delete the exception rather than widening it.
