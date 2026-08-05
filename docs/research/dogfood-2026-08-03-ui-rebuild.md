# Dogfood — UI rebuild and keyboard timer, 2026-08-03

Driven in a real browser at `http://127.0.0.1:5173`, desktop 1440×900 and mobile 390×844. Notes written as each finding was observed, not reconstructed afterwards. Every claim below was read off the running app or out of IndexedDB, never off a subagent's report.

## E1 — Every surface in the app had been flattened by a CSS override

**Observed:** Today, Progress and Library rendered as unstyled text on black with a full-viewport display heading per route.
**Root cause:** a trailing block in `src/styles.css` — `.app-shell .panel { border: 0; background: none; padding: 0 }`, repeated for `.metric-strip`, `.progress-metrics`, `.case-card`, `.constraint-card`, `.reco-stats`, `.empty-state`.
**Fix:** override block replaced with real card surfaces; palette moved off near-black + acid yellow; all legacy green-black hex literals mapped to tokens; per-route heroes deleted in favour of a sticky pill top bar.
**Verified:** `/tmp/sc-ui/new-today3.png`, `/tmp/sc-ui/new-progress2.png`, `/tmp/sc-ui/new-library2.png`.

## E2 — Mobile brand mark collapsed to zero width

**Observed:** at 390 px the top-left brand was a 0×0 box and the nav was squeezed to a single visible tab.
**Root cause:** a legacy media rule hid `.brand > span:last-child`, which after the shell rewrite is the brand mark itself, and the tabs row had no wrap behaviour.
**Fix:** rule dropped; the top bar wraps to two rows below 760 px with the tab strip on its own full-width scroll row.
**Verified:** `/tmp/sc-ui/new-mobile3.png`.

## E3 — Solve layout put the timer stage inside the stat rail

**Observed:** after the Live Solve rewrite the cube and timer rendered in the 288 px right column and overflowed off-screen.
**Root cause:** mine, not the implementer's — the class contract I issued made `.scramble-bar` and `.timer-stage` siblings of `.stat-rail` inside a two-column grid, so auto-placement dropped the stage into column 2.
**Fix:** explicit placement — scramble and stage in column 1, rail spanning both rows of column 2, all collapsing to one column below 1080 px.
**Verified:** `/tmp/sc-ui/live-rebuilt2.png`.

## E4 — Space bar did nothing, and the reason was not the reason it looked like

**Observed:** holding Space never armed the timer under `agent-browser`.
**Investigation:** instrumented `window.addEventListener('keydown', …)` in the live page and dumped the events. Real events arrive, but the harness delivers them with `code: ""` and `key: ""`, so a handler keyed only on `event.code === 'Space'` can never fire under it.
**Fix:** the handler now accepts `event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar'`. This is a genuine robustness fix, not a test accommodation — `code` is absent for some IME and remote-input paths.
**Verified in the browser, full loop:** hold → `phase: armed`, hint "Release to start solving"; release → `phase: running`, `2.213`; any key → `phase: stopped`, `7.355`; stat rail wrote `single 7.36 / 7.36`; a `7.36` chip appeared in the session times list.

## E5 — The history line lied about where a solve came from

**Observed:** the keyboard solve rendered as `7.36s · 0 moves · none · simulator`.
**Investigation:** read the record straight out of IndexedDB — `{"src":"keyboard","det":"keyboard timer solve, no move stream captured","sess":"default"}`. Storage was correct; the display was wrong.
**Root cause:** `HistoryProgress.tsx:155` branched on `cube` and `replay` and fell through to `'simulator'` for everything else, so a new provenance value silently rendered as a fabricated one.
**Fix:** explicit `keyboard` branch — `· keyboard timer, no move stream`.
**Why it matters:** this is the same class of defect the provenance work was built to prevent. A real solve was being labelled as software simulation, which would have poisoned any coaching claim derived from it.

## Standing lesson

A subagent reporting "proven by tests: …" is not proof. E5 was reported as shipped and correct; it took reading IndexedDB in the running app to find that the user-visible string was wrong. Verify the artifact the user will look at, every time.

## Still open

- Full test suite not yet green; the TrainerHub timeout fix is still in flight.
- The host disk hit 100% mid-session (233 MB free of 460 GB) and killed the dev server. Freed the regenerable build artifacts and stale bunx caches; the real consumers are Docker (19 GB) and the Spotify cache (1.7 GB), which are the user's to clear.
- Cube colours are still `twisty`'s defaults; acubemy renders a visibly more muted cube.
