# Dogfood sweep — every route, 2026-08-04

Driven in a real browser at `http://127.0.0.1:5173/` (origin confirmed with `agent-browser get url` before every step). Console checked after each route.

## What was broken before this sweep, and why it looked unfixable

Three crashes were reported from the running app:

1. `sw.js:45 TypeError: Failed to execute 'clone' on 'Response': Response body is already used`
2. `AlgParser … internal parsing error` from `TwistyPlayerModel.experimentalAddMove`, taking `<CubePlayback>` down
3. React advising that an error boundary was missing

All three were already fixed in the source. **The browser was never being served the fixed source.** `src/pwa/register.ts` registered the service worker unconditionally, including against the Vite dev server, and `public/sw.js` is cache-first for every same-origin GET. Vite's dev modules are unhashed, so once cached they are returned forever. The old worker also never yields: `install` has no `skipWaiting`, and activation is deliberately gated while a capture is running.

Confirmed directly in the browser, not inferred — before the fix the page had **1 live registration and the `smart-cube-coach-shell-v4` cache**.

Fixes:

- `src/pwa/register.ts` returns early under `import.meta.env.DEV`, and first tears down this app's own worker and caches, so a browser poisoned by an earlier dev visit repairs itself on next load. The teardown is **scoped** — matched against this app's registration scope and its `smart-cube-coach-shell` cache prefix — because both browser APIs are origin-scoped rather than app-scoped, and this machine runs other local projects that can occupy the same host and port at different times.
- `src/components/CubePlayback.tsx` wraps its view in the existing `ErrorBoundary`. The twisty player animates on its own timers, so a move it cannot parse throws from inside its scheduler where no local `try/catch` reaches it. All nine consumers are now covered by one wrapper at the source.

## Route sweep

| Route | Result | Console |
|---|---|---|
| Today | Renders latest solve, ao12, move count, coaching placeholders | 0 errors |
| Live Solve | Scramble, timer, live cube, capture controls | 0 errors |
| History | Session averages, per-stage table (recognition / execution / TPS / moves / rotations / pauses), coaching panel | 0 errors |
| Train | Filters, case grid, drill panels | 0 errors |
| Library | Reconstruction editor with method and orientation pickers, study library | 0 errors |

## Capture replay: `cube-session-QY-QYSC-S-23C0-2026-08-03T08-56-22.json`

Ground truth was established from the fixture independently of the app: replaying every `MOVE` event from the solved pattern reaches the WCA scramble state at move index 36 and the solved state at index 101 — 37 scramble moves, 65 solve moves.

The app agrees exactly: `37 captured scramble moves`, `Scramble state verified`, timer `22.999`, `65 moves · saved`, playback `Move 0 / 65` beginning `F R L' L' U' …`, and a full CFOP strip — `CROSS 5.08s/8` · `F2L 1 · BR 4.32s/12` · `F2L 2 · FL 3.24s/12` · `F2L 3 · FR 3.81s/10` · `F2L 4 · BL 1.94s/9` · `OLL · OLL SKIP 1.87s/1` · `PLL · AB PERM 2.75s/13`, summing to exactly 65.

## Capture replay: `cube-session-QY-QYSC-S-23C0-2026-08-03T16-06-14.json`

This capture contains **no solve**, and the app is right to refuse to invent one.

Established independently: 321 events, 160 moves, device identity recorded correctly (`QY-QYSC-S-23C0`, MAC `CC:A3:00:01:23:C0`, QiYi). The recording is internally perfect — 160 facelet snapshots cross-checked move-by-move against the cube's own reported state, **0 mismatches**, so nothing was dropped by the app. But from a solved cube those 160 moves never reach the displayed scramble and never reach solved, checked across **all 24 orientations**. Seeding instead from the cube's own first reported facelets: no match either way.

The cube was therefore not physically solved when recording began, and the app cannot know that. In the running app it reports `160 captured scramble moves`, stays `SCRAMBLING`, shows the remaining scramble, and leaves the timer at `0.000`. No crash, no fabricated result, and the `Done scrambling` / `Start from this state` / `My cube is solved` escapes are all offered.

**Open product gap:** nothing tells the user *why* nothing is matching. An uncalibrated cube produces a correct-but-useless "remaining moves" readout indefinitely. Calibration needs to be surfaced as the cause.

## Incidental finding: the device's first reported facelets are stale

`16-06-14` ends on exactly the facelet string that `08-56-22` *starts* on. `08-56-22` nevertheless tracked perfectly from solved. The QiYi cube's state on connect is therefore not trustworthy; the move stream is. This confirms `CubedexSolveTracker` seeding at solved is correct, and that the previously reverted "seed from device facelets" variant would have broken the fixture that works.

## Exhaustive feature sweep — every route, every control

Run in a **clean browser context** (new session, empty console) so no stale buffer could mask a live error. Origin confirmed before every step.

**Console errors across all five routes: 0.**

An earlier count of 6 errors came from the session's accumulated buffer — every one carried the superseded Vite dep hash `v=4e2b2d15` while the live build served `v=7b596b80`, i.e. they were replayed history from before the fixes, not live failures. Verified by hash, then re-verified from a fresh context.

| Surface | Feature exercised | Result |
|---|---|---|
| Today | Latest solve panel, stage-jump buttons | `Cross8 → Move 8/65`, `F2L 2 32 → Move 32/65`, `PLL65 → Move 65/65` |
| Today | Play reconstruction | Auto-advances over time (17 → 30 of 65) |
| Today | Next/Previous, Reset | 10 rapid clicks → `Move 10/65`, setup tail `U' F R L' L' U' L' U' B' U' F'` |
| Today | See the details → History | Navigates, stage table renders |
| Live Solve | Replay verified capture | 37 scramble moves, 65 solve moves, `22.999`, 7 CFOP stages |
| Live Solve | Replay capture with no solve in it | Stays `SCRAMBLING`, saves nothing — no fabricated solve |
| Live Solve | Connection self-test with no cube | Reports `IDLE / Ready to connect`, no crash |
| Live Solve | **Run a full fake solve** | 42 moves saved, `stateVerified: true`, 7 stages summing to exactly 42 |
| History | Solve list, per-stage table | Recognition / execution / TPS / moves / rotations / pauses populated |
| History | Edit reconstruction | Editor opens with the recorded moves |
| History | Export session as csTimer CSV | Control present and reachable |
| Train | Category switching | F2L 167, PLL 21, COLL 40, CMLL 42, ZBLL 472, WVLS 27, L6E-EO 11 |
| Train | Case grid rendering | **A cube diagram on every card in every category**, including all 472 ZBLL cases |
| Train | Modes Learn / Drill / Review / Recognize | All render the grid (167 cards) |
| Train | Start session | Recognition drill runs, hint ladder and answer controls present |
| Library | Reconstruction editor, method + orientation | CFOP / Roux / ZZ / APB and orientation switches respond |
| Library | Metronome | 40–120 bpm controls reachable and functional |

### The simulated solve is the important one

`Run a full fake solve` drives the entire pipeline with no hardware: simulate → capture → detect completion → time → save → segment → verify. It produced a 42-move solve with `stateVerified: true` and seven CFOP stages whose move counts sum to exactly 42. That is the whole product path proven without the physical cube.

## Production build

`bun run build` succeeds. Verified in `dist/` rather than assumed:

- `serviceWorker.register` present — the PWA still installs in production.
- The dev-only teardown is **compiled out**: `getRegistrations` appears 0 times in the app bundle.
- `public/sw.js` ships the clone-before-return ordering on both branches.
- Panda's `@layer utilities` is present in the 77 KB production stylesheet.

## Playback defects found and fixed during this sweep

Both were real, both were measured rather than reasoned about, and neither had test coverage before.

1. **The cube never turned.** Played moves were passed to the player's `alg`, but a twisty-player renders the position at the *start* of its alg, so the cube sat frozen on the scramble while the counter advanced. Moves now fold into the setup alg. Proven: Move 1 → `… U' F`, Move 2 → `… U' F R`, matching the capture's real opening moves.
2. **Controls dropped clicks.** Ten clicks on Next advanced the cube by one move — every handler read `moveIndex` from its own closure inside one React batch and computed the same target. Replaced with a functional update. Proven: ten clicks → `Move 10 / 65`.

A screenshot diff was tried first as evidence and rejected as a false probe: the WebGL canvas is not captured, so before/after images were byte-identical regardless of state. The setup-alg attribute is the honest observable.

## Real end-to-end test: all eight captures replayed through the running app

Not unit tests. Every one of the owner's own QiYi recordings driven through the real UI, graded against ground truth derived independently from the fixture files — so the app is never graded against itself.

Ground truth, computed by replaying each file's `MOVE` events from the solved pattern:

| Capture | Moves | Reaches scramble at | Reaches solved at | Contains a solve |
|---|---|---|---|---|
| 06-59-08 | 298 | never | never | no |
| 06-59-11 | 298 | never | never | no |
| 08-23-59 | 195 | never | never | no |
| 08-31-36 | 302 | 217 | 301 | **yes — 84 moves** |
| 08-43-11 | 150 | never | never | no |
| 08-56-22 | 102 | 36 | 101 | **yes — 65 moves** |
| 09-56-18 | 116 | 35 | 115 | **yes — 80 moves** |
| 16-06-14 | 160 | never | never | no |

What the running app produced, replaying each file through Live Solve:

| Capture | Expected | App result |
|---|---|---|
| 06-59-08 | no solve | saved nothing |
| 08-23-59 | no solve | saved nothing |
| 08-43-11 | no solve | saved nothing |
| 16-06-14 | no solve | saved nothing |
| 08-56-22 | 65 moves | **65 moves, 22.999 s** |
| 09-56-18 | 80 moves | **80 moves, 20.217 s** |
| 08-31-36 | 84 moves | **84 moves, 25.605 s** |

**Eight out of eight correct.** Every capture that contains a real solve produced exactly the right move count; every capture that contains none produced nothing rather than a fabricated result.

Each saved solve carries a complete CFOP breakdown whose stage move counts sum to exactly the solve's move count, with `stateVerified: true`:

| Solve | Moves | Stages | Stage moves sum |
|---|---|---|---|
| 08-56-22 | 65 | 7 | 65 |
| 09-56-18 | 80 | 7 | 80 |
| 08-31-36 | 84 | 7 | 84 |

That sum matching exactly is the load-bearing check: it means segmentation accounted for every single turn, with none dropped and none double-counted.

## Screenshots

Captured outside the repository at `~/smartcube-dogfood-2026-08-04/`: `01-today.png`, `live-solve.png`, `history.png`, `train.png`, `library.png`, `proof-3-real-solves.png`.

## Ao1K EO lesson

Now reachable from the Library route. The lesson's twelve interactive demos load from `public/ao1k/learn/*.html`, copied from the Ao1K reference — verified in the browser as **12 iframes, 12 loaded with real content, 0 empty, 0 404s**. It was briefly mounted without those assets, which would have shipped twelve broken frames; the adversarial audit caught it before it stood.

## Dead ports removed

Two ported modules were carrying passing tests while nothing in the app imported them. Both are superseded, so they were deleted rather than left as decoration that reads like delivered work.

- `src/domain/solveDetection.ts` (+ test) — cubedex's timer state machine (READY→RUNNING on the first physical move, RUNNING→STOPPED when the matcher hits the final checkpoint, cube-clock preferred for the final time). The live path uses `CubedexSolveTracker`, which is the same behaviour from the same upstream source and is the one actually wired into `LiveSolve`. Keeping both meant two implementations of one contract, only one of which was ever exercised.
- `src/domain/solveAnalyzer.ts` (+ test) — smart-cube-timer's analyser. Already rejected on evidence: it reproduces the naive first-cross-hit anchor, produced a 0-move OLL on the `08-56-22` capture, and crashes on the reco.nz ground-truth fixture with `Unsupported move: z2` because its `Move.face` type has no rotation path. `segmentCfop` stays the segmentation implementation.

Suite after removal: 693 tests across 90 files, all passing. The drop from 703/92 is exactly these two files' tests, not lost coverage of anything the app runs.
