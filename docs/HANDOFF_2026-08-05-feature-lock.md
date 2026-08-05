# Smart Cube Coach — feature lock, scramble tracking and coaching surface: full handoff, 2026-08-05

Everything required to resume this task without rediscovery. This is not a summary.

The state this describes is committed and tagged. `docs/FEATURE-LOCK-2026-08-05.md` is the
contract for what must not regress; this document is how the state was reached and what to do
next. Earlier companions, all still accurate for their own scope:
`docs/HANDOFF_2026-08-05-f2l-coaching.md` (the first half of the day),
`docs/research/execution-receipt-2026-08-05-gyst.md`,
`docs/research/execution-receipt-2026-08-05-scramble-tracking.md`.

# PART I — TASK CONTRACT AND LIVE STATE

## 1. Exact task contract

- **Latest owner instruction:** lock this state of the app and never make it worse. Before that,
  in order: fix the coaching output that showed no algorithms; fix the player defects (stage
  highlight, missing setup moves, uncondensed move strip, playback speed); fix "off the scramble"
  appearing on a cube that was on it and correct turns being called wrong; move tracking and
  state work off the render thread; fix the desync after a solve; colour the slots properly and
  rotate the cube to the cross; check Ao1K; fix OLL/PLL reading as skips.
  (Recorded as technical statements — this repository does not carry chat text verbatim.)
- **Required completion:** the defects above fixed with real evidence, gates green, machine left
  clean, and the working state locked behind a restore point.
- **Explicit non-actions:** no push, no deploy, no PR, no external write of any kind. No
  subagents. Do not let any control mutate the app's main scramble. Do not resync the app's cube
  state from device `FACELETS`. Do not restart the dev server.
- **Current-turn authority:** local edits, local verification, and the local commit + tag that
  constitute the lock. Nothing was pushed.
- **Source-of-truth precedence:** owner's latest instruction → `AGENTS.md` →
  `docs/research/gyst-2026-08-04-state-and-verification.md` (settled cube-state rule) →
  `docs/FEATURE-LOCK-2026-08-05.md` → the reference set (`/tmp/refs/`) → live app behaviour →
  this document.

## 2. Ground truth: repository and working tree

| Field | Current value | Evidence command/artifact |
|---|---|---|
| Working directory | `/Users/vittayapalotai.tanyawat/code/smartcube-coach` | `pwd` |
| Repository and branch | `main` | `git branch --show-current` |
| HEAD | `8a138cf` — "Feature lock: smart cube coaching surface and solve pipeline" | `git rev-parse --short HEAD` |
| Restore point | tag `feature-lock-2026-08-05` → `8a138cf` | `git tag -l 'feature-lock*'` |
| Base/PR state | **1 commit ahead of `origin/main`, not pushed.** No PR exists | `git log origin/main..HEAD --oneline` → 1 |
| Pre-existing dirty state | None now. Before the lock the tree carried 277 entries, most from earlier sessions (the design rebuild, the coaching work of 2026-08-03/04) | `git status --porcelain \| wc -l` → 0 |
| Task changes | 371 files in `8a138cf`: +88073 / −1345. That single commit contains this session's work **and** every uncommitted change that predated it | `git show --stat 8a138cf` |
| Untracked artifacts | None | `git status --porcelain` |
| Ownership uncertainty | **Real and unresolved inside the lock commit.** It sweeps prior sessions' uncommitted work together with this session's. The per-file split for this session is §6; anything not listed there predates it | `git show --stat 8a138cf` compared against this session's own edit log |

Files **created by this session** (all inside `8a138cf`):

`src/domain/f2lRecognition.ts`, `f2lRecognition.test.ts`, `slotColours.ts`, `slotColours.test.ts`,
`coachCatalogue.ts`, `coachCatalogue.test.ts`, `analysis.worker.ts`, `analyseOffThread.ts`,
`crossDownFrame.test.ts`, `lastLayerRecognition.test.ts`, `readableTokens.test.ts`,
`setupAlgFromState.test.ts`; `src/device/offTrackRecovery.test.ts`,
`turnsDuringCompletion.test.ts`, `moveOffsets.test.ts`; `src/storage/reanalyseSolves.ts`,
`reanalyseSolves.test.ts`; `docs/FEATURE-LOCK-2026-08-05.md`, this file,
`docs/research/execution-receipt-2026-08-05-gyst.md`,
`docs/research/execution-receipt-2026-08-05-scramble-tracking.md`, and
`docs/evidence/coaching-2026-08-05-*.png` / `scramble-2026-08-05-*.png` (12 PNGs in
`docs/evidence/` in total, some predating this session).

Files **modified by this session** (pre-existing, changed here): `src/domain/reconstruction.ts`,
`scramble.ts`, `stageAdvice.ts`, `models.ts`, `cubeHold.ts`, `reconstructionText.ts`,
`faceletReconciliation.ts`, `caseRecognition.test.ts`, `cubePipeline.test.ts`,
`stageAdvice.test.ts`; `src/device/capture.ts`, `capture.test.ts`, `CubeConnection.tsx`,
`recordCapture.ts`, `replayIntoStorage.ts`; `src/components/solve/SolveAnalysis.tsx`,
`SolveRoute.tsx`, `SolveCockpit.tsx`; `src/App.tsx`; `docs/evidence/README.md`.

Files **deleted by this session**: `src/domain/strictScrambleProgress.test.ts` (its function was
replaced); `retrySetup` removed from `stageAdvice.ts` and its tests from `stageAdvice.test.ts`.

## 3. Environment and operational rules

- **Dev server:** running at `http://localhost:5173`, PID `46939`, returns HTTP 200. Not started
  by this session. **Do not restart it.** Check with `lsof -i :5173 -sTCP:LISTEN`.
- **Build gate:** `bun run build` = `panda codegen && tsc -b && vite build`. `tsc --noEmit` is not
  the gate. `bunx tsc -b` alone is a fast typecheck. The build must emit
  `dist/assets/analysis.worker-*.js` — if it stops appearing, the analysis has silently returned
  to the main thread.
- **Tests:** always capped — `bunx vitest run --pool=threads --maxWorkers=2`. Uncapped runs have
  bricked this machine. Never run the suite and a browser screenshot sweep together.
- **Browser:** prefix every invocation inline with
  `AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio"`. Confirm the
  origin with `agent-browser get url` before trusting any step. Never click `mailto:`/`tel:` or
  any non-http(s) link.
- **Browser state right now: nothing running.** `ps ax | grep agent-browser/browsers` → 0. Getting
  there needed the kill described in §8 — `close --all` alone was not enough and repeatedly left
  processes behind.
- **Other people's browser sessions exist** in `~/.agent-browser/` (`ats2`, `showme`, `wbvid` pid
  files). They are not this project's and were left untouched.
- **Disk:** 9.6 GB free. Run `df -h /` before builds, suites or screenshot sweeps.
- **Module identity trap:** `await import('/src/...')` from `agent-browser eval` can resolve to a
  DIFFERENT module instance than the running app, so module-level state read that way is
  meaningless. IndexedDB reads through `repositories` are shared and reliable.
- **Environment variables:** none required beyond `AGENT_BROWSER_ARGS`.

# PART II — COMPLETE EXECUTION RECORD

## 4. Chronological command and action ledger

CWD is the repository throughout. Browser rows use the
`AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session cube …`
prefix. This continues the ledger in `docs/HANDOFF_2026-08-05-f2l-coaching.md` §4 (rows 1–34).

| Order | Phase | Exact command / action | Why | Material output / exit | Safe to rerun? |
|---|---|---|---|---|---|
| 35 | Diagnose | Read `src/domain/stageAdvice.ts`, `src/device/recordCapture.ts`, `grep -rn "analysisVersion" src` | A row showed a wasted-turn count with no moves | `stageAdvice` does print the moves when they exist, so the stage record had none: stages are written once and **nothing re-analysed them** | Yes |
| 36 | Build | `src/storage/reanalyseSolves.ts` + `ANALYSIS_VERSION` in `models.ts` + hook in `App.tsx` | Solves recorded before an analyser improvement must get it | Re-segments from the stored move list, keeps recorded timings when boundaries match | Yes |
| 37 | Build | `src/domain/coachCatalogue.ts` | The algorithm lookup only worked if Training had ever been opened | Compiled F2L/OLL/PLL tables behind the stored catalogue | Yes |
| 38 | Build | `announceSolveUpdated()` in `recordCapture.ts`, called from `App.tsx` | The migration wrote to storage while the open screen kept its mounted state | Rows update on the same load | Yes |
| 39 | Prove | Browser: seed a solve with `optimalMoves`/`caseName`/`betterSlot` stripped, `repositories.algorithms.clear()`, one reload | Reproduce the owner's exact conditions | `version 2`, case names back, `optimalMoves` present; row rendered the case algorithm and the shorter solution with the catalogue store empty | Yes |
| 40 | Fix | `SolveAnalysis.tsx` — `stageAt` matches `index >= startEvent && index <= endEvent` | Clicking F2L 4 highlighted F2L 3 | Browser: F2L 4 click highlights F2L 4 alone (`getComputedStyle` → `rgb(39,39,42)`) | Yes |
| 41 | Fix | `readableTokens()` in `reconstructionText.ts`; move strip rewritten on it | The strip showed the raw quarter-turn stream | 49 raw moves render as 43 tokens, each still scrubbing to its raw move | Yes |
| 42 | Fix | `moveOffsetsMs` on `SolveRecord`; `moveOffsets()` in `recordCapture.ts`; autoplay uses real gaps capped at 5 s | Playback ran at a fixed 320 ms regardless of the solve | Control reads `REAL SPEED` with timings, `FIXED 320MS` without | Yes |
| 43 | Fix | `stage.setupAlg` from `patternToPlayerAlg` in `reconstruction.ts`; `retrySetup` deleted | SETUP printed the scramble plus every move since, fumbles included | 19 state-derived moves replace a ~40-token replay | Yes |
| 44 | **Violation** | Routed `FACELETS` into `CaptureSession` and made it the scramble authority | Misdiagnosed the off-scramble defect | **Reverted before any other work** — the settled rule forbids it (§8) | No — never do this |
| 45 | Read | `docs/research/gyst-2026-08-04-state-and-verification.md` in full (23 KB) | GYST after the owner's correction | Named the rule just broken, and the rejected approaches | Yes |
| 46 | Fix | `scrambleFollowState` in `scramble.ts`; `capture.ts` judges from the app's own state; `strictScrambleProgress` deleted | One stray packet marked every later correct turn wrong, permanently | `offTrackRecovery.test.ts` (6 tests); browser: panel cleared, `3 / 21 scramble moves` | Yes |
| 47 | Fix | `SolveRoute.tsx` — deleted the `tracker.scrambleRemaining` fallback | It printed the ENTIRE scramble as the way "back" | Browser: `OFF THE SCRAMBLE — U'`, one move | Yes |
| 48 | Fix | `SolveRoute.tsx` — capture state seeded from `ensureSharedCapture().snapshot` | The page started from an empty placeholder and disagreed with the engine | Browser: progress and panel correct immediately on navigation | Yes |
| 49 | Measure | Browser `PerformanceObserver` on `longtask` across a full driven solve | "Lagging and dropped frames" | Tracking alone: 0 long tasks. Full solve: **one 407 ms block** | Yes |
| 50 | Fix | `analysis.worker.ts` + `analyseOffThread.ts`; `ensureSharedCapture` arms the next scramble before recording; `pendingMoves` in `capture.ts` | The block was `segmentCfop` on the main thread, and turns arriving during it were discarded | After: **0 long tasks**; solve still records; session back to `scrambling · 0/21` immediately | Yes |
| 51 | Reject | Constrained the pair search to preserve solved pairs | Suggestions could destroy pairs already in | One test 1 s → 12.5 s, suite past 600 s. **Reverted** | No |
| 52 | Fix | `stageAdvice.ts` prints measurements only; the algorithm comes from the catalogue | The machine's shortest sequence is not an algorithm anybody turns | Rows show `… wasted turns.` plus a real catalogue alg | Yes |
| 53 | Reject | `movesInFrame()` to rename recorded moves into the cross frame | Two coordinate systems on one row | Equivalence test over a real solve failed both directions. **Reverted** | No |
| 54 | Build | `src/domain/slotColours.ts` (first attempt, frame permutation) | Name the pair by colour | Rendered, but ground truth could not confirm it — **pulled back out** | No |
| 55 | Read | `/tmp/refs/ao1k/composables/recon/SimpleCubeInterpreter.tsx#getF2LPairDirections` (line 2047) | The owner said to check Ao1K | It reads colours from cube state through the scheme; no frame algebra | Yes |
| 56 | Build | `slotColours.ts` rewritten to read the CENTERS orbit | Ao1K's method | Verified the orbit order empirically: **`[U, L, F, R, B, D]`**, not the assumed `[U,R,F,D,L,B]` — the first version's passing test had been a coincidence | Yes |
| 57 | Fix | `SolveAnalysis.tsx` — every F2L row names its slot and shows swatches | A row with no colours showed nothing at all | `F2L 1 · FL 🟩🟧 · F2L 2 - Front Left` | Yes |
| 58 | Fix | Playback rotates by the solve's recorded frame | The cube was shown in a fixed colour preference | `crossDownFrame.test.ts` | Yes |
| 59 | Diagnose | Measured OLL/PLL boundaries on the raw upright pattern | Rows read `OLL skip` with 9–12 moves | Cross on raw **U**; `orientU` = `0000:0000` (cross layer), `orientD` = `0021:0101` (the real OLL) | Yes |
| 60 | Fix | `lastLayerRecognitionInput` in `reconstruction.ts`; `toCrossDownFrame` deleted | Recognition was pointed at the cross layer | `OLL 34 City` replaces `OLL skip`; `lastLayerRecognition.test.ts` | Yes |
| 61 | Fix | `ANALYSIS_VERSION` → `'5'` | The OLL fix did not reach stored solves: they were already at `'4'` | A `'4'` solve carrying `OLL skip` re-analysed to `version 5 \| OLL=OLL 34 City` | Yes |
| 62 | Gate | `bunx vitest run --pool=threads --maxWorkers=2`; `bun run build` | Before locking | **111 files / 789 tests**; `✓ built` | Yes |
| 63 | Lock | Secret scan over every captured file; `git add -A`; `git commit`; `git tag -f feature-lock-2026-08-05` | Owner: lock this state | No secrets, no junk paths; `8a138cf`, tree clean, **not pushed** | No — one-time |
| 64 | Hygiene | `agent-browser close --all`, then `ps ax \| grep agent-browser/browsers` and `kill` | 12 processes had respawned again | 0 remaining | Yes |

## 5. Methodology and decision record

**Measure before changing.** The "lag" was assumed to be per-move tracking cost; measuring said
otherwise — tracking produced no long tasks at all, and the entire stall was one 407 ms block at
solve completion. The fix followed the measurement (worker + ordering), not the assumption. A
successor must keep the `PerformanceObserver` method: install it, drive a full solve, read the
entries.

**The app's cube state is the reference, and it is never resynced from `FACELETS`.** This is a
settled decision with fixture evidence behind it, and it has now been broken three times. When
scramble tracking misbehaves, the fix is to ask the app's own state better questions — which is
what `scrambleFollowState` does — not to reach for the device's facelets.

**State over history, everywhere.** Three separate defects were the same mistake: divergence
computed by walking the move list (a stray packet poisoned the rest of the scramble); the way
back derived from the route to the scrambled state (printed the whole scramble); the setup
derived by replaying scramble + every move (printed the solver's fumbling). Each is now answered
from the cube position, so the same position always gives the same answer.

**Recognition must not depend on frames.** OLL/PLL were read off a layer chosen from the locked
cross face, on a pattern that had been rotated by the stage frame *and* again by
`toCrossDownFrame`. The two stages did not even agree which side the cross was on. It now stands
the raw pattern upright, calls the layer whose four cross edges are home the cross, and
recognises on the other one. Nothing about frames is consulted.

**Reference first — twice proven this session.** The F2L forward-scan already existed in
`docs/research/acubemy-solve-2026-08-04.md` §82, and the slot-colour method already existed in
Ao1K. Both were reached only after a wrong path had been built. `AGENTS.md` requires the
reference first; it is cheaper every time.

**Rejected, and why:** constraining the pair search to preserve solved pairs (correct, but 10×
slower and the suite exceeded ten minutes); renaming recorded moves into the cross frame (a
rotation mid-stage moves the frame, and the equivalence test failed both directions); deriving
slot colours from a frame permutation (unverifiable, and Ao1K shows it is the wrong question).
None of these should be re-attempted in the same shape.

**What a successor must preserve:** the settled `FACELETS` rule; `ANALYSIS_VERSION` bumping in
the same edit as any change to `segmentCfop` output; the worker path for analysis; and the
`pendingMoves` buffer, without which turns during recording are lost.

## 6. Files and artifacts

| Path | Role | State before | Exact change | Verification | Ownership | Resume instruction |
|---|---|---|---|---|---|---|
| `docs/FEATURE-LOCK-2026-08-05.md` | The contract for what must not regress | Did not exist | Every locked behaviour with its pinning test, plus the defects open at lock time | — | This session | Read before any change; re-check its rows before reporting work done |
| `src/domain/f2lRecognition.ts` | Which of the 41 F2L cases a stage was | Did not exist | Signature over the slot's own corner/edge, indexed from 164 catalogue entries × 4 AUFs | `f2lRecognition.test.ts` (5) | This session | Extend only after reading `acubemy-solve-2026-08-04.md` §82/§84 |
| `src/domain/slotColours.ts` | A slot's two side colours | Did not exist (a frame-based version was written and removed) | Reads the CENTERS orbit, order `[U,L,F,R,B,D]` verified empirically | `slotColours.test.ts` (3) | This session | Do not reintroduce frame-permutation colour derivation |
| `src/domain/coachCatalogue.ts` | Algorithm lookup independent of the Training page | Did not exist | Compiled F2L/OLL/PLL tables behind the stored catalogue; stored records win | `coachCatalogue.test.ts` (3) | This session | — |
| `src/domain/analysis.worker.ts`, `analyseOffThread.ts` | CFOP analysis off the render thread | Did not exist | Worker + client with an inline fallback for jsdom and for worker death | Browser: 0 long tasks; build emits `analysis.worker-*.js` | This session | If the emitted chunk disappears, the analysis is back on the main thread |
| `src/storage/reanalyseSolves.ts` | Brings stored solves up to the current analyser | Did not exist | Re-segments from the stored move list, keeps recorded timings only when boundaries match | `reanalyseSolves.test.ts` (4) | This session | Bump `ANALYSIS_VERSION` whenever `segmentCfop` output changes |
| `src/device/capture.ts` | Capture session | Judged from the move list; dropped turns while `complete` | `scrambleFollowState`-based progress; `pendingMoves`; prefixes cached per scramble | `offTrackRecovery.test.ts`, `turnsDuringCompletion.test.ts`, `capture.test.ts` | Pre-existing, changed here | Never resync it from `FACELETS` |
| `src/domain/reconstruction.ts` | CFOP segmenter | No F2L cases, frame-dependent LL recognition, no setup | F2L recognition + forward scan, `lastLayerRecognitionInput`, `setupAlgFor`, `slotColours`, `betterSlotColours` | Multiple suites; browser | Mostly prior sessions; this session's parts named here | `toCrossDownFrame` is deleted — do not restore it |
| `src/components/solve/SolveAnalysis.tsx` | The breakdown surface | Prior session's version | Hold/cross rotation, correct stage highlight, condensed strip, real-speed playback, setup line, slot name + swatches, catalogue algorithm | Browser + unit | Prior session's file | — |
| `src/components/solve/SolveRoute.tsx` | Solve page | Seeded capture from a placeholder; whole-scramble undo fallback | Seeds from the live snapshot; `undo` is the short route only | Browser | Prior session's file | Do not reintroduce the `scrambleRemaining` fallback |
| `docs/evidence/coaching-2026-08-05-*.png`, `scramble-2026-08-05-*.png` | Browser evidence | Some existed | Seek pair, hold pair, breakdown, algorithms-on-rows, setup-from-state, slot colours, off-track one-move, recovered | Each reopened and read | Mixed | Retake if the surfaces change |
| `docs/research/execution-receipt-2026-08-05-scramble-tracking.md` | The defect-by-defect record | Did not exist | Off-scramble, the 407 ms block, the desync, the junk recommendation, slot colours, OLL/PLL, the stale-version cause | — | This session | Read before touching scramble tracking or recognition |
| `public/reco/13444.json` | The only real human solve available | Unchanged | Read only | — | Pre-existing | Every "real solve" claim rests on this fixture |

## 7. Verification matrix

| Requirement / claim | Layer | Exact artifact | Result | Unverified |
|---|---|---|---|---|
| A cube at the start of the scramble is not "off" it | Unit + browser | `offTrackRecovery.test.ts`; browser panel absent | **browser-proven** | — |
| One wrong turn gives a one-move way back | Browser | `docs/evidence/scramble-2026-08-05-off-track-one-move.png` — `OFF THE SCRAMBLE — U'` | **browser-proven** | — |
| Undoing the mistake clears it and following continues | Browser + unit | Replayed `U'` through the real bus → panel cleared, `3 / 21 scramble moves`; `offTrackRecovery.test.ts` | **browser-proven** | — |
| No main-thread block during a solve | Browser | `PerformanceObserver` longtask: 407 ms → **0 ms** | **browser-proven** | Not measured on a low-end machine |
| Turns during recording are kept | Unit | `turnsDuringCompletion.test.ts` | **proven** | Never exercised over real Bluetooth timing |
| OLL is named, not "skip" | Unit + browser | `lastLayerRecognition.test.ts`; `OLL 34 City` | **proven** | — |
| Stored solves gain new analysis on load | Browser | A `'4'` solve with `OLL skip` → `version 5 \| OLL=OLL 34 City` after one reload | **browser-proven** | — |
| Slot colours are right | Unit | `slotColours.test.ts` — four distinct pairs, never opposite faces, follows `x2`/`y` | **proven** against cube states | Never checked against the physical stickers of the owner's cube |
| Playback rotates to the solve's cross | Unit | `crossDownFrame.test.ts` | **proven** | — |
| Real-speed playback | Unit + browser | `moveOffsets.test.ts`; `REAL SPEED` label | **browser-proven for the path** | The gaps have never been timed against a stopwatch |
| Setup reproduces the stage position | Unit | `setupAlgFromState.test.ts` | **proven** up to whole-cube rotation | Never applied by hand to a real cube |
| Move strip matches the reconstruction | Unit + browser | `readableTokens.test.ts`; 49 → 43 tokens | **browser-proven** | — |
| Suite and build green at lock | Unit + build | `111 files / 789 tests`; `✓ built` | **proven** | — |
| Last-layer stage boundaries | — | A PLL stage holds 22 moves; both layers read `0123:0123` at that boundary | **known broken** | The whole defect |
| Anything against the physical cube | Device | None | **not run** | Everything device-level |
| Multi-auditor dogfooding council | Independent agents | None | **not run** | No authority for subagents |

## 8. Failures, traps, and rejected approaches

| Item | Symptom / evidence | Root cause | Why rejected / what was done | Do not repeat / recovery |
|---|---|---|---|---|
| **Resynced capture from `FACELETS`** | — | Misdiagnosed the off-scramble defect without reading the project's own record of it | Reverted before other work; the rule is settled with fixture evidence and had already been broken twice | Read `gyst-2026-08-04-state-and-verification.md` before touching cube state |
| **Constrained pair search** | One test 1 s → 12.5 s; suite past 600 s | IDA* must go deeper and exhausts every bound when no preserving solution exists | Reverted; the fix was to stop presenting machine sequences as instructions | Do not re-add without a fundamentally cheaper formulation |
| **Renaming moves into the cross frame** | Equivalence test failed both permutation directions | A rotation inside a stage moves the frame; one permutation cannot express it | Reverted, unshipped | Two coordinate systems on one row remains open |
| **Slot colours from a frame permutation** | Rendered, but ground truth could not identify the slot | Wrong question — Ao1K identifies a pair by its colours, not by a frame | Pulled out, then rebuilt from the CENTERS orbit | The CENTERS order is `[U,L,F,R,B,D]`; verify empirically, do not assume |
| **Fix that never reached the data** | Rows still read `OLL skip` after the recogniser was fixed | `ANALYSIS_VERSION` was not bumped, so stored solves at `'4'` were skipped | Bumped to `'5'` | Any change to `segmentCfop` output bumps the version in the same edit |
| **`agent-browser` respawn** | `close --all` reports success, then 10–12 Chrome-for-Testing processes reappear within minutes | Not the registry files: a lingering **`agent-browser` daemon** (`…/agent-browser/bin/agent-browser-darwin-arm64`) survives `close --all` and brings its browsers back. Killing only the Chrome processes leaves the daemon to respawn them | Kill the DAEMON, then its browsers. Map a daemon to its session first with `lsof -p <pid> \| grep .agent-browser/.*\.sock` — other projects' daemons (`ats2`, `wbvid` here) must be left alone | Verify with `ps ax \| grep agent-browser/bin/agent-browser` AND `… /browsers`, never with `session list` |
| **Wrong process name in a cleanup check** | Reported clean while a headless browser was alive | The binary is `Google Chrome for Testing`, not `Chromium` | Corrected | Grep `agent-browser/browsers` |
| **`eval` module duplication** | `ensureSharedCapture().snapshot` read `idle` while the app showed `scrambling · 4/21` | `await import('/src/…')` can resolve to a different module instance | Used the app's own readouts and IndexedDB instead | Never diagnose module state through `eval` |
| **Ref and text selectors** | `✗ Element not found`; a `✓ Done` that did nothing | Stale snapshot refs; the CLI has no `:has-text` | Click via `eval` and confirm by the app's own reaction | — |
| **Judging the hold on a rotation-bearing solve** | The cube looked inverted | That solve's stream starts with `z2` | Verified on a rotation-free solve | — |
| **Test that asserted the defect** | `caseRecognition.test.ts` and a `capture.test.ts` case both encoded old broken behaviour | They pinned gaps as if they were requirements | Updated with the reason recorded | A test encoding a known gap changes with the gap |

## 9. Known limitations and blockers

1. **Last-layer stage boundaries are wrong.** Blocks: any trustworthy OLL/PLL row. Evidence: a PLL
   stage holding 22 moves; on the fixture both layers read `0123:0123` at the PLL boundary, so
   "skip" is the honest answer to a misplaced cut. Missing: nothing external — this is
   `computeStageCutIndices`/`reachedOnFace` work. First action: §11 item 1.
2. **No physical cube.** Blocks: every device-level claim. Missing: the hardware. Work done
   around it: the scripted and replay paths through the real event bus, plus the owner's recorded
   sessions in `src/device/fixtures/user-sessions/`.
3. **No authority for subagents.** Blocks: the dogfooding council. Missing: the owner's word.
4. **Two coordinate systems on one row.** Blocks: comparing a stage's moves against its suggested
   algorithm. See §8 for why the rename was reverted.
5. **Silent skip on re-analysis failure.** A solve whose re-analysis throws keeps its old stages
   and looks identical to one not yet upgraded.
6. **The lock commit mixes ownership.** `8a138cf` contains prior sessions' uncommitted work as
   well as this session's. Splitting it is not possible after the fact; §2 and §6 are the record
   of which parts are this session's.

# PART IV — RESUME WITHOUT REDISCOVERY

## 10. Immediate next action

CWD `/Users/vittayapalotai.tanyawat/code/smartcube-coach`. Confirm the lock is intact before
anything else:

```
git status --porcelain | wc -l                      # expect 0
git rev-parse --short feature-lock-2026-08-05       # expect 8a138cf
bunx vitest run --pool=threads --maxWorkers=2       # expect 111 files, 789 tests passing
```

On success, start §11 item 1. On failure — a dirty tree, a moved tag, or a red test — stop and
diff against `docs/FEATURE-LOCK-2026-08-05.md` before writing code; something has regressed and
the lock is the thing to restore (`git checkout feature-lock-2026-08-05`).

## 11. Remaining ordered work

1. **Last-layer stage boundaries.** Prerequisite: none. Target: `computeStageCutIndices` and
   `reachedOnFace` in `src/domain/reconstruction.ts` — `reachedOnFace` returns 6 for OLL-solved
   and jumps to 8 for PLL-solved, never 7, so the cut for the PLL stage fires on the wrong index
   and the stage absorbs trailing moves. Method: make the reached scale monotonic through the
   last layer, then re-segment the fixture. Verification: on `public/reco/13444.json`, the OLL and
   PLL stages contain only their own moves, and PLL is either a named case or a skip with ~0
   moves. Stop condition: no last-layer stage on the fixture or on the owner's recorded sessions
   holds more moves than its case can explain.
2. **PLL naming once boundaries are right.** Prerequisite: item 1. Verification: a fixture solve
   whose PLL row shows a real perm name.
3. **One solve on the physical cube.** Prerequisite: the cube. Verification: a recorded solve
   whose stages carry real recognition/execution splits, plus a screenshot of its breakdown.
   Stop condition: the marker advanced only on matching turns, the timer started on the first
   solve move, and the coaching rows are populated.
4. **Dogfooding council.** Prerequisite: the owner authorises subagents. Method:
   `agent-browser-dogfood` auditors who drive the app. Stop condition: two consecutive rounds with
   no behavioural findings.
5. **One frame for the whole row.** Prerequisite: none. Target: recorded moves versus case names
   and algorithms. Method: not the reverted rename — either express the analysis in the cube's
   reported frame, or state the frame in the UI. Verification: a stage's moves and its suggested
   algorithm can be compared move for move.
6. **Surface re-analysis failures.** Prerequisite: none. Target: `reanalyseSolves.ts`'s silent
   `catch`. Verification: a solve whose analysis throws is visibly marked, not indistinguishable
   from a stale one.

## 12. Command cookbook

```
# state checks
git status --porcelain | wc -l
git rev-parse --short feature-lock-2026-08-05
git log origin/main..HEAD --oneline          # expect 1 — the lock, unpushed
lsof -i :5173 -sTCP:LISTEN
df -h /
ps ax -o pid,command | grep agent-browser/browsers | grep -v grep   # authoritative browser check

# gates — never with a screenshot sweep
bunx tsc -b
bun run build                                 # must emit dist/assets/analysis.worker-*.js
bunx vitest run --pool=threads --maxWorkers=2

# restore the locked state
git checkout feature-lock-2026-08-05

# browser — one pinned session, prefix inline, confirm origin first
AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session cube open http://localhost:5173/
AGENT_BROWSER_ARGS="..." agent-browser --session cube get url
AGENT_BROWSER_ARGS="..." agent-browser --session cube set viewport 1280 1000
AGENT_BROWSER_ARGS="..." agent-browser --session cube console

# click anything in this app through eval; ref and text selectors have both failed here
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "Array.from(document.querySelectorAll('button')).find(function(x){return /Perform this scramble/i.test(x.textContent)}).click(); 'clicked'"

# measure main-thread blocking
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "window.__long=[]; var o=new PerformanceObserver(function(l){for(var e of l.getEntries()) window.__long.push(Math.round(e.duration))}); o.observe({entryTypes:['longtask']}); 'observer'"
# …drive a solve, then:
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "JSON.stringify(window.__long)"

# seed a real human solve through the app's OWN segmenter and repositories
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "(async function(){
  var reco = await (await fetch('/reco/13444.json')).json();
  var rec = await import('/src/domain/reconstruction.ts');
  var db = await import('/src/storage/database.ts');
  var events = reco.moves.map(function(m,i){return {move:m,timestamp:1000+i*90}});
  var stages = await rec.segmentCfop(reco.scramble, events, 'seeded');
  var started = Date.now()-60000;
  await db.repositories.solves.put({id:'seeded',sessionId:'default',puzzle:'3x3x3',scramble:reco.scramble,scrambleGenerator:'reco.nz',startedAt:started,endedAt:started+4320,penalty:'none',analysisVersion:'5',rawEventIds:[],moves:reco.moves,source:'replay'});
  for (var s of stages) await db.repositories.stages.put(s);
  return stages.map(function(s){return s.name+'='+(s.caseName||'-')}).join(' | ');
})()"

# force stored solves to re-analyse on the next load
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "(async function(){var db=await import('/src/storage/database.ts'); var sv=await db.repositories.solves.all(); for (var s of sv) await db.repositories.solves.put(Object.assign({}, s, {analysisVersion:'0'})); return sv.length})()"

# MUST run before finishing, in this order
AGENT_BROWSER_ARGS="..." agent-browser close --all
# `close --all` does NOT kill the daemon, and the daemon brings the browsers back.
# Map each daemon to its session and kill only the ones serving YOUR sessions:
for p in $(ps ax -o pid,command | grep 'agent-browser/bin/agent-browser' | grep -v grep | awk '{print $1}'); do
  echo -n "$p: "; lsof -p $p 2>/dev/null | grep -oE "\.agent-browser/[a-z0-9-]+\.sock" | sort -u | tr '\n' ' '; echo
done
kill <your-daemon-pids>
ps ax -o pid,command | grep agent-browser/browsers | grep -v grep | awk '{print $1}' | while read p; do kill $p; done
# then, if a name lingers in `session list`:
# rm ~/.agent-browser/<name>.{pid,sock,stream,version,engine}
```

Not authorised without a fresh instruction from the owner: `git push`, any deploy, opening a PR,
posting anywhere.

## 13. Handoff receipt

- **Handoff authoring time:** 2026-08-05, immediately after the feature lock commit and the
  browser cleanup.
- **Live state checked at:** authoring time — `pwd`, `git branch --show-current` (`main`),
  `git rev-parse --short HEAD` (`8a138cf`), `git tag -l` (`feature-lock-2026-08-05`),
  `git status --porcelain | wc -l` (0), `git log origin/main..HEAD --oneline` (1, unpushed),
  `lsof -i :5173 -sTCP:LISTEN` (PID 46939), `curl -o /dev/null -w %{http_code}` (200),
  `ps ax | grep agent-browser/browsers` (12 found; killed with their lingering daemons, then 0),
  `ps ax | grep agent-browser/bin/agent-browser` (4 daemons; the two serving this session's
  `ui-check` killed, the two serving other projects' `ats2`/`wbvid` left alone), `df -h /`
  (9.7 GB free),
  `ls docs/evidence/*.png | wc -l` (12).
- **Sources read:** `AGENTS.md`; `~/.claude/skills/get-your-shit-together/references/user-demands.md`;
  `docs/research/gyst-2026-08-04-state-and-verification.md` (23 KB, in full);
  `docs/research/acubemy-solve-2026-08-04.md`, `reference-findings-2026-08-03.md`,
  `feature-harvest.md`; `/tmp/refs/f2ltrainer/src/lib/utils/checkF2LState.ts` (203 lines);
  `/tmp/refs/ao1k/composables/recon/SimpleCubeInterpreter.tsx` (targeted reads around
  `getF2LPairDirections`, line 2047, and `getF2LSteps`) and `getLineStepInfo.ts` (353 lines);
  the app sources listed in §6. Sizes were checked before reading; nothing exceeded 500 KB.
- **Logs/history ranges read:** none — no history-mining was requested, so no extraction exists
  and none needs purging.
- **Durable notes written:** `docs/FEATURE-LOCK-2026-08-05.md`, this handoff,
  `docs/research/execution-receipt-2026-08-05-scramble-tracking.md` (four appended sections),
  `docs/research/execution-receipt-2026-08-05-gyst.md`, `docs/evidence/README.md`, and an appended
  section in `docs/research/gyst-2026-08-04-state-and-verification.md`.
- **Exact verification artifact inspected after writing:** `git status --porcelain` (clean before
  this file was added), `git rev-parse --short feature-lock-2026-08-05` → `8a138cf`,
  `bunx vitest run --pool=threads --maxWorkers=2` → 111 files / 789 tests passing, `bun run build`
  → `✓ built` with `dist/assets/analysis.worker-*.js` emitted.
- **Explicitly unverified:** anything against the owner's physical cube; the multi-auditor
  council; last-layer stage boundaries (known broken); slot colours against real stickers; the
  real-speed gaps against a stopwatch; the setup algs applied by hand.
