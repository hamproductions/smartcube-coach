# GYST execution receipt 4 — 2026-08-03

## Exact latest request

Two messages, in order:

1. Required every basic feature present across all reference projects to be in place — matching or exceeding acubemy and every other reference project — with full control of subagents to make them write the code, and reported that the app could not reliably track a solve or scramble.
2. Rejected the current UI as low-effort and unacceptable, and required studying and mimicking the reference projects' UI.

## Rules violated

1. **Reuse proven behaviour from the references instead of inventing.** The UI was authored from imagination. No screenshot of acubemy, cubedex, csTimer or solved.no had ever been looked at before designing, so the app got a marketing landing-page shell (full-viewport hero heading per route, giant display type, single acid accent on near-black) instead of the tool grammar every reference uses.
2. **Never leave the tree broken.** `bun run test` was failing 13 tests in `src/components/TrainerHub.test.tsx` and this was not being treated as blocking.
3. **Basic features missing while advanced ones shipped.** No keyboard/space-bar timer and no session concept exist, yet the app claims coaching depth. A user without a paired smart cube cannot record a single solve — that is what "can't keep track of a solve" means.
4. **Proxy completion.** `docs/feature-status.md` still describes the F2L trainer as "three independently authored starter cases" while `TrainerHub.tsx:86` now builds the 164-case catalogue; the doc was not reconciled with the code.

## Read in full this round

- `AGENTS.md`
- `docs/feature-status.md` (28K, whole capability matrix)
- `docs/research/reference-findings-2026-08-03.md`
- `docs/research/dogfood-2026-08-03.md`
- `docs/research/execution-receipt-2026-08-03-gyst-3.md`
- `~/.claude/skills/get-your-shit-together/references/user-demands.md` (26K)
- `src/App.tsx`, `src/components/PwaStatus.tsx`, `src/components/TodayDashboard.tsx`, `src/components/CubePlayback.tsx` (playback section), `src/styles.css` (token, shell and override blocks)
- Delegated full reads: `docs/research/feature-harvest.md`, `docs/research/harvest-refresh-2026-08-03.md`, `docs/product-spec.md` → reference feature checklist; all of `src/components/*.tsx` → current surface inventory

## Live references inspected in a real browser (this is the missing evidence from every prior round)

Driven with agent-browser at 1440×900, screenshots read back and looked at:

| Reference | Screenshot | What it decides |
|---|---|---|
| acubemy playground | `/tmp/sc-ui/ref-acubemy-play.png` | Centre column scramble → cube → timer; right rail NOW/BEST × single/ao5/ao12/ao50/ao100/ao1000; "or hold [SPACE] to start timer"; horizontal pill nav; mono for every number |
| acubemy marketing | `/tmp/sc-ui/ref-acubemy.png` | Per-case cards carrying badge + median + occurrences + percentage |
| cubedex practice | `/tmp/sc-ui/ref-cubedex.png` | Icon rail, compact context topbar, alg input as the primary control, card empty states |
| cubedex case library | `/tmp/sc-ui/ref-cubedex-cases.png` | Category pills → subset pills → learning-state pills → case grid → "Practice Selected" |
| csTimer | `/tmp/sc-ui/ref-cstimer.png` | Scramble strip pinned full width; timer centre stage; ao5/ao12 directly beneath; session + times list always visible on the left |
| solved.no | `/tmp/sc-ui/ref-solved.png` | Feature-card entry grid |

Current app before the change: `/tmp/sc-ui/cur-today-desk.png`, `/tmp/sc-ui/cur-live.png`.

## Root cause of the slop

`src/styles.css` carried a trailing override block — `.app-shell .panel { border: 0; background: none; padding: 0 }` plus the same flattening for `.metric-strip`, `.progress-metrics`, `.case-card`, `.constraint-card`, `.reco-stats`, `.empty-state` — which stripped every surface in the app to text on black. Combined with per-route `<h1>` heroes at `clamp(34px, 4vw, 56px)` and a 216 px text sidebar, the result read as an unstyled marketing page rather than a cubing tool.

## Conflict resolution

Latest raw user message wins. "GO STUDY OTHER PROJECTS AND MIMIC" outranks the design skill's default preference for an unmistakable original direction: this is a tool whose grammar is already settled by the references, and the user has rejected invention twice.

## Source of truth

The live reference UIs listed above, plus `docs/research/reference-findings-2026-08-03.md` for behaviour.

## Corrected immediate action

1. Shell rebuilt: horizontal pill top bar, per-route hero headings deleted, page width centred (`src/App.tsx`, `src/styles.css`).
2. Palette moved off near-black + acid yellow to a neutral slate ground with a calmer amber accent, and every legacy green-black hardcode replaced with tokens.
3. Flattening override block removed; real card surfaces, form controls and section headings restored.
4. Chatty section sentences replaced with names: "Session averages", "Coaching", "Solve history", "Local data".
5. Two code agents dispatched against a fixed CSS class contract: Live Solve re-layout + **space-bar keyboard timer** + **sessions**; TrainerHub root-cause fix for the 13 timeouts + case-library grid.

## Verification artifact

`bun run typecheck` clean; `bunx vitest run src/App.test.tsx --pool=threads --maxWorkers=2` → 3/3 passing; screenshots of every rebuilt route read back in the browser (`/tmp/sc-ui/new-*.png`).

## Explicitly unverified

- Full suite is not yet green — the 13 TrainerHub timeouts are assigned and not yet confirmed fixed.
- Keyboard timer and sessions are in flight, not yet driven in the browser.
- No physical smart cube has been paired at any point.
- Nothing committed, nothing deployed.
