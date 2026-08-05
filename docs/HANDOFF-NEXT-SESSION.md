# Recovery Capsule

## Task Contract
- Exact latest user request: rebuild the app from the ground up — organisation, features, design. "REDESIGN MEANS DELETE EVERY FUCKING MARKUP HTML AND DO IT AGAIN, NOT JUST CHANGING COLORS." Usability maxed, it is a Rubik's cube trainer not an informational site. Use acubemy as the reference.
- Required completion: three routes rewritten from nothing (Solve, Drill, Coach), old routes deleted, `src/styles.css` gone, behaviour fixes from the acubemy notes landed first.
- Explicit non-actions: no commit, push, deploy. No running the test suite as a substitute for work (he rejected it twice: "RUNNING USELESS TEST AGAIN???????"). No vendor artifact stores. No verbatim chat quotes in repo files. Never request physical hardware. Never leave agent-browser sessions or subagent transcripts behind — they filled his disk to 0 bytes this session.
- Current-turn external-write authority: none.

## Source of Truth
- CWD: `/Users/vittayapalotai.tanyawat/code/smartcube-coach`, branch `main`, HEAD `002ac74`, ~220 dirty paths.
- **`docs/rebuild-spec.md`** — the ground-up spec, grounded in acubemy. Read §1 first; it is behaviour, not paint.
- **`docs/feature-list-for-designer.md`** — ~120 features with honest status (`built` / `built, wrong` / `built, hidden` / `to build`).
- **`docs/research/acubemy-solve-2026-08-04.md`** — the reverse-engineering that the spec is built on. This file existed for most of the session and was ignored; it is the highest-value document in the repo.
- His captures: `src/device/fixtures/user-sessions/` (8 files).
- Dev server: `bun run dev` on `:5173`.

## State
- Changes this session, all uncommitted:
  - `src/domain/reconstruction.ts` — per-stage Gaussian confidence using acubemy's observed μ/σ. **The only unverified-in-browser edit.**
  - `src/domain/reconstructionText.ts` — new. `readableReconstruction()` merges `L' L'` → `L2` via MoveSequence `addition` mode, never cancels `F F'`.
  - `src/device/fixtureGroundTruth.test.ts` — new. Pins 84/65/80 moves and exact durations for the three solve-bearing captures, and no-solve for the rest.
  - `src/storage/notimerStore.ts` + test — new. Serialised write queue, `addCheck` idempotent on (solve, template, location).
  - `src/domain/ao1k/notimerChecklist.ts` — `persistChecklist` now calls `updateCheck` (upstream never did, so a ticked box never persisted).
  - `src/components/solve/SolvePage.tsx` — new, written from nothing. **The pattern to follow. Not wired to a route.**
  - `src/components/library/LibraryPage.tsx` — new. Library recomposed as a tool rail.
  - `panda.config.ts`, `src/components/ui/Surface.tsx` — instrument direction: near-black ground, lime accent, radius 0, hairline rules.
  - `src/components/shell/AppShell.tsx`, `PwaStatus.tsx`, `TodayDashboard.tsx`, `train/TrainerToolbar.tsx`, `ui/CaseCard.tsx` — on Panda + Park UI.
  - `src/styles.css` — 3547 → 3108 lines. Every deletion verified dead first.
  - `AGENTS.md` — Panda + Park UI stack recorded; rebuild standard recorded.
- Browser sessions: closed. Disk: was 0 bytes mid-session from my own subagent transcripts; purge `/private/tmp/claude-502/*/tasks` if it recurs.

## Verification
- Proven: 8/8 captures replay correctly against ground truth derived from the files themselves (84/25605ms, 65/22999ms, 80/20217ms; five with no solve save nothing). Stage move counts sum exactly to solve move counts. Zero console errors across all five routes in a clean browser context.
- Proven by measurement, not reasoning: the playback bugs (moves fed to `alg` froze the cube; ten clicks advanced one move) — both fixed, both have regression tests.
- Failed and fixed: `persistChecklist` never persisted a toggle; queued reads did not stop duplicate checks (the test proved my first fix wrong; atomic idempotent `addCheck` was the real fix).
- Unverified: the Gaussian confidence edit, in a browser.

## Decisions
- Settled: Panda CSS + Park UI is the stack (he had said this before; it was not written down, so he was asked twice — that was a failure).
- Settled: `readableReconstruction` never cancels `F F'`. A cancelled pair is the wasted work the coach exists to find. `MoveSequence` `reduction` mode is wrong here; `addition` is what smart-cube-timer itself uses per stage.
- Settled: the solve's move list comes from the tracker's own resolved stream, never rebuilt from phase-tagged raw events.
- Rejected: seeding the solve tracker from device facelets. Reverted.
- Rejected: `SolveAnalyzer` as `segmentCfop` (0-move OLL, crashes on ground truth).
- His corrections that I kept getting wrong: patching is not redesigning; retheming is not redesigning; delete the markup and write it again.

## Resume
- **Immediate next action: `docs/rebuild-spec.md` §1.1 — delete live scramble-divergence detection.** acubemy never asserts "wrong move" while scrambling; it uses Done Scrambling, an F4 gesture, or an inactivity timeout. Our live detector is the source of every false alarm he hit today. This is behaviour and must land before any UI work.
- Then §1.3 (time-midpoint stage bucketing), §1.5 (400ms recognition/execution gap), §1.6 (no fabricated analysis without a replay).
- Then the routes, in spec build order: Shell → Solve → Drill → Coach → delete `src/styles.css` and the files in spec §8.
- §1.2 (F2L-complete cross lookahead) is already implemented — do not redo it.
- Verify each step by replaying a fixture in a real browser. Compiling is not done. Do not run the full suite as a substitute for looking at the page.
