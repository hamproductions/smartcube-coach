# Smart Cube Coach — F2L case coaching, playback hold and seek: full handoff and methodology, 2026-08-05

Everything required to resume this task without rediscovery. This is not a summary.

Companion documents, both current: `docs/HANDOFF_2026-08-05-coaching.md` is the previous session's handoff (its §11 is the work list this session executed, its §14 records the same follow-up in that document's own terms); `docs/research/execution-receipt-2026-08-05-gyst.md` is this session's GYST receipt.

# PART I — TASK CONTRACT AND LIVE STATE

## 1. Exact task contract

- **Latest owner instruction:** finish the handoff task with no mistakes — i.e. execute the remaining ordered work in `docs/HANDOFF_2026-08-05-coaching.md` §11 — followed by a compaction-safety pass and then this handoff. (Requirements are recorded as technical statements; this repository does not carry chat text verbatim.)
- **Required completion:** items 1–4 of that list closed with real evidence, gates green, machine left clean. Items 5–6 remain and are named below.
- **Explicit non-actions:** no commit, no push, no deploy, no PR, no external write of any kind. No subagents (the session forbids the Agent tool unless the owner asks). Do not let any control mutate the app's main scramble. Do not reintroduce the hands-free accept gesture. Do not restart the dev server.
- **Current-turn authority:** local edits and local verification only.
- **Source-of-truth precedence:** owner's latest instruction → this repository's `AGENTS.md` → `docs/HANDOFF_2026-08-05-coaching.md` → `docs/research/` notes (`acubemy-solve-2026-08-04.md`, `reference-findings-2026-08-03.md`, `feature-harvest.md`) → live app behaviour → this document.

## 2. Ground truth: repository and working tree

| Field | Current value | Evidence command/artifact |
|---|---|---|
| Working directory | `/Users/vittayapalotai.tanyawat/code/smartcube-coach` | `pwd` |
| Repository and branch | `main` | `git branch --show-current` |
| HEAD | `002ac74` — "docs: add complete project handoff" | `git rev-parse --short HEAD` |
| Base/PR state | Not applicable — nothing pushed this session, no PR exists | — |
| Pre-existing dirty state | The tree was already dirty before this session: 246 entries at the previous handoff's authoring time, from the design rebuild and the coaching work of earlier sessions | `git status --porcelain \| wc -l` |
| Task changes | 264 entries now; the 18 added entries are this session's, listed below | `git status --porcelain \| wc -l` |
| Untracked artifacts | Whole directories (`src/components/solve/`, `ui/`, `history/`, `library/`, `settings/`, `study/`, `training/`, `ao1k/`, `cubedex/`) predate this session | `git status --porcelain \| awk '$1=="??"'` |
| Ownership uncertainty | None for the paths in the table below; each was classified by `git status --porcelain <path>` plus `git diff` against HEAD | — |

Per-path classification for everything this session touched:

| Path | Git state | Ownership |
|---|---|---|
| `src/domain/f2lRecognition.ts` | `??` | **Created this session** |
| `src/domain/f2lRecognition.test.ts` | `??` | **Created this session** |
| `docs/research/execution-receipt-2026-08-05-gyst.md` | `??` | **Created this session** |
| `docs/evidence/coaching-2026-08-05-{breakdown,seek-move1,seek-move20,hold-white-top,hold-yellow-top}.png` | `??` | **Created this session** (5 files) |
| `docs/HANDOFF_2026-08-05-f2l-coaching.md` | `??` | **Created this session** (this file) |
| `src/domain/reconstruction.ts` | ` M` (585 changed lines vs HEAD) | **Mostly the previous session's.** This session added only: the `recognizeF2l` import, `f2lCaseOfStage()`, and the F2L branch of `recognized` |
| `src/components/solve/SolveAnalysis.tsx` | `??` | **File created by the previous session.** This session changed only the hold wiring and the row-expansion guard |
| `src/domain/caseRecognition.test.ts` | `??` | **File created by an earlier session.** This session changed one assertion |
| `docs/HANDOFF_2026-08-05-coaching.md` | `??` | **File created by the previous session.** This session brought §1–§4, §6–§13 current and added §14 |
| `docs/evidence/README.md` | ` M` | **Already modified before this session.** This session appended the coaching-screenshot section |
| `src/storage/reanalyseSolves.ts`, `src/storage/reanalyseSolves.test.ts`, `src/domain/coachCatalogue.ts`, `src/domain/coachCatalogue.test.ts` | `??` | **Created this session** (the owner-reported-defect fix) |
| `docs/evidence/coaching-2026-08-05-algorithms-on-rows.png` | `??` | **Created this session** |
| `src/App.tsx`, `src/domain/models.ts`, `src/components/ReconstructEditor.tsx` | ` M` | **Pre-existing tracked files**, changed here only for the migration hook, `ANALYSIS_VERSION`, and the version stamp |
| `src/device/recordCapture.ts`, `src/device/replayIntoStorage.ts`, `src/domain/csTimerFormat.ts` | `??` | **Files created by earlier sessions.** This session added `announceSolveUpdated()`, `moveOffsets()` and the version stamp |
| `src/domain/readableTokens.test.ts`, `src/device/moveOffsets.test.ts` | `??` | **Created this session** (the player fixes) |
| `docs/evidence/coaching-2026-08-05-player-and-rows.png` | `??` | **Created this session** |
| `src/domain/reconstructionText.ts` | `??` | **File created by an earlier session.** This session added `readableTokens()` |

## 3. Environment and operational rules

- **Dev server:** already running at `http://localhost:5173`, PID `46939`, returns HTTP 200. It was PID `93874` when the previous handoff was written, so someone restarted it between sessions. **Do not restart it.** If it dies, find out why first. Check: `lsof -i :5173 -sTCP:LISTEN`.
- **Build gate:** `bun run build` = `panda codegen && tsc -b && vite build`. `tsc --noEmit` is *not* the gate. `bunx tsc -b` alone is a fast typecheck.
- **Tests:** always capped — `bunx vitest run --pool=threads --maxWorkers=2`. Uncapped runs have bricked this machine. Do not run the suite and a browser screenshot sweep at the same time.
- **Browser:** prefix every invocation inline with `AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio"`, or Chromium hits the macOS Keychain and raises an OS password prompt. Confirm the origin with `agent-browser get url` before trusting any step — `--session <name>` is not isolation. Never click `mailto:`/`tel:`/non-http(s) links.
- **Browser state right now: nothing is running.** `ps ax -o pid,command | grep agent-browser/browsers` → 0, and `agent-browser session list` → `No active sessions`. Getting here required clearing a stale registry entry — see §8, it is the most dangerous trap in this document.
- **Disk:** 9.8 GB free, up from 7.1 GB at session start. Run `df -h /` before builds, suites or screenshot sweeps.
- **HMR trap:** editing files with a tab open re-evaluates modules and has previously thrown `useCubeConnection must be used inside CubeConnectionProvider`. The context is held on `globalThis` to survive it, but a hard reload is still how to tell a real error from an HMR artifact.
- **Environment variables:** none required beyond `AGENT_BROWSER_ARGS`.

# PART II — COMPLETE EXECUTION RECORD

## 4. Chronological command and action ledger

CWD is the repository for every row. Browser rows use the `AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session cube …` prefix unless stated.

| Order | Phase | Exact command / action | Why | Material output / exit | Safe to rerun? |
|---|---|---|---|---|---|
| 1 | Orient | `ls -lht docs/*.md`, `git log --oneline -5`, `git status --short` | Find the handoff task and the starting state | Latest handoff `docs/HANDOFF_2026-08-05-coaching.md`; HEAD `002ac74`; tree already dirty | Yes |
| 2 | Read | Read `docs/HANDOFF_2026-08-05-coaching.md` in full | It is the task contract | §11 gives six ordered items; §10 names the first action | Yes |
| 3 | State | `lsof -i :5173 -sTCP:LISTEN`; `df -h /`; `agent-browser session list` | Live state before touching anything | Server PID `46939` (not the documented `93874`); 7.1 GB free; sessions `ui-check`, `dogfood` open | Yes |
| 4 | Hygiene | `agent-browser close --session ui-check`; `… --session dogfood` | Leftovers from the previous session | Both reported closed | Yes |
| 5 | Drive | `agent-browser --session cube open http://localhost:5173/`; `agent-browser --session cube get url` | Start one pinned session, confirm origin | `http://localhost:5173/` | Yes |
| 6 | Drive | `agent-browser --session cube eval "…querySelectorAll('button')…/Perform this scramble/…click()"` | `click "@e28"` and `click "button:has-text(…)"` both failed silently — see §8 | App log printed `[SYSTEM] performing D' B2 …` then `[SYSTEM] solution F U' L …` | Yes |
| 7 | Check | `agent-browser --session cube eval "<IndexedDB solves/stages count>"` (§12) | Confirm the driven solve actually recorded | `{"solves":1,"stages":2}` | Yes |
| 8 | Measure | `agent-browser --session cube eval "<twisty-player getBoundingClientRect>"` | The previous session's RMSE was inconclusive because the crop was guessed | Modal player at `313.75, 436, 160×160`; cockpit player at `640, 183, 256×256` | Yes |
| 9 | Measure | `agent-browser --session cube set viewport 1280 1000`; click first move, screenshot; click last move, screenshot; `magick <shot> -crop 160x160+314+436 +repage <crop>`; `magick compare -metric RMSE crop1.png crop20.png null:` | Settle item 1 | `20718.9 (0.316)`; crops show scrambled vs solved | Yes |
| 10 | Build | Edit `src/components/solve/SolveAnalysis.tsx`: import `viewRotationForHold` + `readPreferences`, add `hold` state, pass `viewRotation` to `Cube3D` | Item 2 | Typecheck clean | Yes |
| 11 | Read | Read `src/domain/reconstruction.ts`, `pairSolver.ts`, `crossSolver.ts`, `caseRecognition.ts`, `f2lCases.ts`, `f2lCatalogue.ts`, `betterAlgorithm.ts` | Item 3 needs to know what already exists | `caseName` was only ever set by the OLL/PLL recognisers; a 164-entry F2L catalogue already exists | Yes |
| 12 | Build | Create `src/domain/f2lRecognition.ts`; wire the F2L branch into `segmentCfop` | Item 3 | On the reco.nz fixture: `F2L 1 → F2L 2 - Front Left`, `F2L 2 → F2L 29 - Front Right` | Yes |
| 13 | Verify | `bunx vitest run src/domain/f2lRecognition.test.ts --pool=threads --maxWorkers=2` | Prove recognition on all 164 catalogue entries and on a real solve | 4 passed | Yes |
| 14 | Verify | `bunx vitest run --pool=threads --maxWorkers=2` | Full gate | **1 failed** — `caseRecognition.test.ts` pinned the old "non-last-layer stages unlabelled" gap | Yes |
| 15 | Fix | Edit `src/domain/caseRecognition.test.ts` so an F2L stage must be either unlabelled or carry a well-formed F2L case id | The assertion described the gap item 3 removes | 2 passed | Yes |
| 16 | Verify | `bun run build` | Real build gate | `✓ built` | Yes |
| 17 | Seed | `agent-browser --session cube eval "<seed reco fixture>"` (full command in §12) | Item 4: see coaching on a real human solve with no hardware, through the app's own segmenter and repositories | Stages written; case names returned | Yes |
| 18 | Drive | Open Training once (seeds the F2L catalogue records), reload, open the solve, expand rows | The catalogue `betterAlgorithmFor` reads is only written by the Training page | `167 f2l records`; rows show case names; F2L 2 expands to `The BL pair was 3 moves cheaper here: R B2 R' B2` | Yes |
| 19 | Fix | Edit `SolveAnalysis.tsx`: compute `better`/`advice` once per row, expand only when non-empty | Rows with no advice opened an empty panel — found by using the app | Clicking F2L 3 no longer inserts a blank row | Yes |
| 20 | Verify | Settings top colour white → screenshot/crop; then yellow → screenshot/crop; `magick compare -metric RMSE` | Item 2, on a rotation-free solve so the hold is unambiguous | `12480.7 (0.190)`; white top vs yellow top, green front both times | Yes |
| 21 | Dogfood | Walk Statistics, Library, Study, Training; `agent-browser --session cube console` | Single-operator dogfood in place of the council | Every route rendered; zero console errors or warnings | Yes |
| 22 | Gate | `bunx vitest run --pool=threads --maxWorkers=2`; `bun run build` | Before reporting | 102 files / 764 tests; build clean | Yes |
| 23 | GYST | Read `~/.claude/skills/get-your-shit-together/references/user-demands.md` (26 KB), this repo's `AGENTS.md` (135 lines), `docs/research/reference-findings-2026-08-03.md`, `feature-harvest.md`, `acubemy-solve-2026-08-04.md`, `/tmp/refs/f2ltrainer/src/lib/utils/checkF2LState.ts` (203 lines) | The instruction stack, in full | Found the violation in §5: the recogniser was built before the repo's own reference notes were read | Yes |
| 24 | Correct | Add `f2lCaseOfStage()` to `src/domain/reconstruction.ts` with acubemy's forward scan; add its test | Close the gap `acubemy-solve-2026-08-04.md` §84 already named | Test passes; no change on the reco.nz fixture, and §7 explains why | Yes |
| 25 | Gate | `bunx tsc -b`; `bunx vitest run --pool=threads --maxWorkers=2`; `bun run build` | After the correction | Clean; 102 files / **765 tests**; `✓ built` | Yes |
| 26 | Verify | Reseed the fixture in a fresh page, reopen the breakdown, screenshot | The segmenter changed, so the browser evidence had to be retaken | Rows and the better-pair line unchanged; `docs/evidence/coaching-2026-08-05-breakdown.png` replaced | Yes |
| 27 | Hygiene | `agent-browser close --all`; `ps ax -o pid,command \| grep agent-browser/browsers`; `kill <pids>`; `rm ~/.agent-browser/ui-check.{pid,sock,stream,version,engine}` | A stale session entry kept respawning browsers — see §8 | 0 processes; `No active sessions`; listing no longer spawns anything; 9.8 GB free | Yes |

### Owner-reported defect, same day: the algorithms were missing from a real solve

The owner sent a screenshot of one of his own solves: every F2L row bare, and the one expanded row reading `23 moves against an optimal 8 — 15 wasted turns.` with no case, no algorithm, no moves. Two independent causes, both fixed:

| Order | Phase | Exact command / action | Why | Material output / exit | Safe to rerun? |
|---|---|---|---|---|---|
| 28 | Diagnose | `grep -rn "analysisVersion" src`; read `src/device/recordCapture.ts`, `src/storage/database.ts`, `src/domain/stageAdvice.ts` | Find why his row has a count but no moves | `stageAdvice` *does* print ` Shorter: …` when `optimalMoves` exists, so his stage record has none — stages are written once at record time and **nothing ever re-analyses them**. `rawEventIds` is always `[]`, so per-move timings are not stored either | Yes |
| 29 | Build | `src/storage/reanalyseSolves.ts`; `ANALYSIS_VERSION` in `src/domain/models.ts`; wired in `src/App.tsx` beside `repairSolveTimestamps` | Solves recorded before an analyser improvement must get it | Re-segments from the stored move list, keeps the recorded timings, bumps the record to `'2'` | Yes |
| 30 | Build | `src/domain/coachCatalogue.ts`; `SolveAnalysis` seeds its catalogue from it | The algorithm lookup only worked if the Training page had ever been opened, which seeds the stored catalogue | Compiled F2L/OLL/PLL tables back the lookup; a solver's own stored algorithm still wins | Yes |
| 31 | Build | `announceSolveUpdated()` in `src/device/recordCapture.ts`, called from `App.tsx` after the migration | The migration wrote to storage while the open screen kept showing what it read at mount, so the coaching appeared only on the *next* reload | Rows update on the same load | Yes |
| 32 | Prove | Fresh browser profile: seed a solve with old-format stages (`optimalMoves`, `betterSlot`, `caseId`, `caseName` deleted), `repositories.algorithms.clear()`, then one reload | Reproduce his exact conditions | After reload: `version 2`, case names back, `optimalMoves` present — `F2L 1 → D L' U2 L`, `F2L 2 → U R2 F R2 F2 U' F` | Yes |
| 33 | Prove | Patch one stage to his shape (23 moves against an optimal 8) and expand the row | His row is the one that showed nothing | Row renders `23 moves for F2L 4 - Front Right; the 3-move alg is R U R'` and `23 moves against an optimal 8 — 15 wasted turns. Shorter: R U R' U' R U R' U'` — with the stored catalogue empty. `docs/evidence/coaching-2026-08-05-algorithms-on-rows.png` | Yes |
| 34 | Gate | `bunx vitest run --pool=threads --maxWorkers=2`; `bun run build` | After the fixes | 104 files / **772 tests**; `✓ built` | Yes |

### Four more owner-reported defects in the breakdown player

| Order | Phase | Exact command / action | Why | Material output / exit | Safe to rerun? |
|---|---|---|---|---|---|
| 35 | Diagnose | Read `stageAt` in `SolveAnalysis.tsx` | Clicking F2L 4 highlighted F2L 3 | The rule was `index > stage.startEvent && index <= stage.endEvent + 1`. Clicking a stage seeks to its `startEvent`, which is exactly the previous stage's `endEvent + 1`, so the match landed one stage early — every stage click highlighted its predecessor | Yes |
| 36 | Fix | `stageAt` is now the stage of the move about to play: `index >= startEvent && index <= endEvent`, falling back to the last stage at the end of the solve | — | Browser: clicking F2L 4 highlights F2L 4 (`getComputedStyle(row).backgroundColor` → `rgb(39,39,42)` on that row alone) and the player badge reads `F2L 4` | Yes |
| 37 | Diagnose | `grep -rln retrySetup src` | The setup moves were missing | `retrySetup()` was imported by **nothing** — the app computed the setup for every stage and never rendered it, and `onRetryStage` was declared in the props type and never destructured. Exactly the dead-feature pattern `AGENTS.md` forbids | Yes |
| 38 | Fix | Expanded row now renders the setup alg under a `Setup` label, condensed | Turn it on a real cube and you are looking at that case again | Browser: the F2L 4 row shows its full setup sequence. No control here touches the app's own scramble, per §1 | Yes |
| 39 | Diagnose | Read the move strip's render | The strip showed the raw quarter-turn stream while the Reconstruction below it was condensed | The strip mapped `solve.moves` one-to-one; the cube reports `L' L'` where a cuber reads `L2` | Yes |
| 40 | Fix | `readableTokens()` in `src/domain/reconstructionText.ts` + strip rewritten on it | Same notation in both places, and each token must still scrub | Browser: 49 raw moves render as **43 tokens**; clicking one seeks the raw move it came from. `readableTokens.test.ts` pins that it condenses identically to `readableReconstruction` and that the spans tile the raw stream exactly | Yes |
| 41 | Diagnose | Read the autoplay effect | "Is everything playing at real speed?" | **No.** It stepped every `320 / speed` ms regardless of the solve, and per-move timings were never persisted (`rawEventIds: []`), so no stored solve could replay its real rhythm | Yes |
| 42 | Fix | `moveOffsetsMs` on `SolveRecord`, written by `recordCapture` and `replayIntoStorage` via `moveOffsets()`; autoplay uses the real gaps (capped at 5s) when present | Play the solve as it was turned | Browser: a solve carrying offsets shows a `REAL SPEED` label; without them the label reads `FIXED 320MS`, so the player never pretends. `moveOffsets.test.ts` covers the empty and backwards-clock cases | Yes |
| 43 | Gate | `bunx vitest run --pool=threads --maxWorkers=2`; `bun run build` | After all four | 106 files / **780 tests**; `✓ built`; console clean | Yes |

**Old solves cannot gain real-speed playback.** `moveOffsetsMs` can only be recorded at capture time; the re-analysis in `reanalyseSolves.ts` cannot invent it, because the raw per-move timings were never stored. Solves captured from now on replay at their real rhythm, older ones keep the fixed cadence and say so on the control.

**What a successor must preserve.** The re-analysis keeps recorded timings only when the recomputed stage covers exactly the same moves (`startEvent`/`endEvent` match); when the analyser's boundaries have moved, the old split belongs to a different span and carrying it over would attach real-looking timing to the wrong moves, so those fields are dropped instead. A solve with no captured moves is skipped rather than having its breakdown emptied, and a solve whose re-segmentation throws or returns nothing keeps what it has.

## 5. Methodology and decision record

**Item 1 — measure the thing itself.** The previous session cropped a guessed screen region and got a meaningless RMSE. The method here was to ask the page where the cube is (`getBoundingClientRect()` on the modal's own `twisty-player`), crop exactly that, and compare the first and last move. Rejected: reading `Cube3D`'s source to decide whether the index reaches it — this project has already burned a round telling the owner a wired feature "was never wired" after reading instead of using. A successor must keep measuring the element's own rect; the modal player is 160×160 at `313.75,436` only at viewport 1280×1000.

**Item 2 — put the preference where every caller gets it.** `Cube3D` already accepted `viewRotation`, and `SolveRoute` already computed `viewRotationForHold(hold.top, hold.front)` for the cockpit. The breakdown had three call sites (`SolveRoute`, `AnalysisRoute`, `HistoryRoute`). Threading a prop from each was rejected in favour of `SolveAnalysis` reading `readPreferences()` itself, which is the same pattern `SolveRoute` uses and fixes all three at once. Data flow: `settings` store → `readPreferences()` → `hold` state → `viewRotationForHold` → `Cube3D`'s setup alg. Verification had to use a **rotation-free** solve: the reco.nz stream contains the solver's own `z2`, so the finished cube sits in the frame they left it in and the hold appears inverted; that is correct behaviour, not a bug, and it is why the hold evidence uses the scripted solve.

**Item 3 — recognise the case, and only when it is really one.** The signature is where the slot's own corner and edge sit plus their orientation, indexed from all 164 catalogue entries in all four AUF positions. This matches how this repo's OLL/PLL recognisers already fold AUF into a canonical key, and how `acubemy-solve-2026-08-04.md` §84 records acubemy precomputing four ranks per case. The slot table (`FR {corner 4, edge 8}`, `FL {5,9}`, `BL {6,11}`, `BR {7,10}`) is the one `reference-findings-2026-08-03.md` line 37 transcribes from F2LTrainer. **A position that matches no catalogued case returns nothing** — the 41 cases only describe a pair in the top layer or its own slot, and naming a buried pair would be invention.

**The correction a successor must preserve.** This was built before the repository's own reference notes were read, which `AGENTS.md` forbids in as many words. `acubemy-solve-2026-08-04.md` §82 documents acubemy's `detectF2LCase` forward scan and §84 records its absence here. `f2lCaseOfStage()` now implements it: recognise at stage entry, else walk the stage's own moves (excluding the last, by which point the pair is placed) and return the first recognised case, re-framing at each step with the rotations still to come. Read the notes before extending this.

**Item 4 — use the app's own pipeline to see it.** Two alternatives were rejected. Setting the app's scramble to a simulated CFOP solve would mutate the main scramble, which is prohibited after the retry-from-step defect. Building a CFOP solver for an arbitrary scramble is not available from existing parts: `optimalCrossPlusPairSolution` solves cross+one pair but does not preserve pairs already placed, so it would unsolve earlier slots. What shipped instead: fetch the bundled `public/reco/13444.json`, segment it with the app's own `segmentCfop`, and write the solve and stages through the app's own repositories, so the UI renders real output from real code.

**The accordion fix came from using the product, not reading it.** Half the rows of a real solve have no advice, and they opened an empty panel. The row now computes `better` and `advice` once, expands only when one exists, and still seeks the player on every click.

## 6. Files and artifacts

| Path | Role | State before | Exact change / content | Verification | Ownership | Resume instruction |
|---|---|---|---|---|---|---|
| `src/domain/f2lRecognition.ts` | Which of the 41 F2L cases a stage was | Did not exist | `f2lSignature()`, `buildF2lIndex()` (164 entries × 4 AUFs, first entry wins on collision), `recognizeF2l()` | `f2lRecognition.test.ts` | This session | Extend only after reading `acubemy-solve-2026-08-04.md` §82/§84 |
| `src/domain/f2lRecognition.test.ts` | Pins recognition | Did not exist | Round-trips every catalogue case; AUF invariance; no cross-slot leakage; the buried-pair lookahead; F2L names on the reco.nz solve | 5 tests pass | This session | — |
| `src/domain/reconstruction.ts` | CFOP segmenter | Previous session's version, no F2L recognition | Added `recognizeF2l` import, `f2lCaseOfStage()` (exported for its test), F2L branch in `recognized`; `framedEntry` moved above recognition | Both test files above, plus browser rows | Mostly prior sessions; this session's part is the three items named | Do not re-order `framedEntry` back below `recognized` |
| `src/domain/caseRecognition.test.ts` | Pins OLL/PLL recognition | Asserted every non-last-layer stage is unlabelled | That assertion now allows an F2L stage to carry a well-formed F2L case id and still requires Cross/AUF to be unlabelled | 2 tests pass | Prior session's file, one assertion changed here | — |
| `src/components/solve/SolveAnalysis.tsx` | The breakdown surface | Previous session's accordion + 160px sticky player | Reads `readPreferences()` and passes `viewRotationForHold(...)` to `Cube3D`; rows compute `better`/`advice` once and expand only when non-empty | Browser: hold flip RMSE 0.190; no-advice row no longer opens | Prior session's file, two changes here | — |
| `docs/evidence/coaching-2026-08-05-breakdown.png` | Item 3+4 evidence, 130 KB | Did not exist | Breakdown modal: case names on rows, `The BL pair was 3 moves cheaper here: R B2 R' B2` | Reopened and read after saving | This session | Retake if the segmenter changes |
| `docs/evidence/coaching-2026-08-05-seek-move1.png` / `-seek-move20.png` | Item 1 evidence, 15 KB / 14 KB | Did not exist | The player's own 160×160 rect at move 1 and move 20 | `magick compare -metric RMSE` → `20718.9 (0.316)` | This session | — |
| `docs/evidence/coaching-2026-08-05-hold-white-top.png` / `-hold-yellow-top.png` | Item 2 evidence, 14 KB each | Did not exist | Same finished solve with Settings top colour white, then yellow | `magick compare` → `12480.7 (0.190)` | This session | Use a rotation-free solve or the result is ambiguous |
| `docs/evidence/README.md` | Evidence index | Already modified before this session | Appended the coaching-screenshot section with both RMSE figures and the "no smart cube was involved" caveat | — | Pre-existing modification + this session's section | — |
| `src/storage/reanalyseSolves.ts` | Re-runs the analyser on solves older than it | Did not exist | Re-segments from the stored move list, keeps recorded timings when boundaries match, bumps `analysisVersion` | `reanalyseSolves.test.ts` (4 tests); browser | This session | Bump `ANALYSIS_VERSION` in `domain/models.ts` whenever `segmentCfop` records something new |
| `src/domain/coachCatalogue.ts` | Algorithm lookup that does not depend on the Training page | Did not exist | Compiled F2L/OLL/PLL tables behind the stored catalogue; stored records win | `coachCatalogue.test.ts` (3 tests) | This session | — |
| `src/domain/models.ts` | Types + `ANALYSIS_VERSION` | Types only | Added the constant so writers stamp it without a domain→storage import | Typecheck | Pre-existing file, constant added here | — |
| `src/App.tsx` | Shell | Ran `repairSolveTimestamps` on mount | Also runs `reanalyseStoredSolves()` and announces each updated solve | Browser: rows update on the same load | Pre-existing file | — |
| `src/device/recordCapture.ts` | Solve persistence | Notified listeners only on a fresh save | Added `announceSolveUpdated()`; stamps `ANALYSIS_VERSION` | Browser | Pre-existing file | — |
| `docs/evidence/coaching-2026-08-05-algorithms-on-rows.png` | The owner-reported defect, fixed, 120 KB | Did not exist | Row showing the case's algorithm and the shorter solution, catalogue store empty | Reopened and read | This session | — |
| `docs/research/execution-receipt-2026-08-05-gyst.md` | GYST receipt | Did not exist | Rule broken, every source read, corrected work, verification artifacts, unverified items | — | This session | — |
| `docs/HANDOFF_2026-08-05-coaching.md` | Previous session's handoff | Stale in §2, §3, §7, §10–§13 | Brought current and given a §14 for this session; verbatim chat text removed from §1 per `AGENTS.md` | — | Prior session's file, updated here | Read alongside this document |
| `public/reco/13444.json` | Bundled reco.nz reconstruction | Unchanged | Read only — the fixture every claim about a "real human solve" rests on | — | Pre-existing | — |
| `/tmp/un-dumb-yourself/8065f307-77bc-49a5-81c1-8a20df94b2d4.md` | Compaction recovery capsule | Did not exist | Ephemeral by design; this handoff is the durable record | — | This session | Do not treat as project documentation |

## 7. Verification matrix

| Requirement / claim | Required layer | Exact evidence artifact | Current result | What remains unverified |
|---|---|---|---|---|
| Playback cube follows the seek | Browser | `docs/evidence/coaching-2026-08-05-seek-move1.png` / `-move20.png`, cropped to the player's own rect; RMSE `20718.9 (0.316)` | **browser-proven** | — |
| Playback cube uses the configured hold | Browser | `-hold-white-top.png` / `-hold-yellow-top.png`; RMSE `12480.7 (0.190)` | **browser-proven**, both directions | Behaviour on a solve containing the solver's own rotations is *understood* (frame follows the stream) but not separately screenshotted |
| F2L case named on the stage row | Browser | `-breakdown.png`: `F2L 1 · F2L 2 - Front Left`, `F2L 2 · F2L 29 - Front Right` | **browser-proven** | Only the 41 catalogued cases can be named |
| Better-pair coaching on screen | Browser | Same screenshot: `The BL pair was 3 moves cheaper here: R B2 R' B2` | **browser-proven** | Never seen on a solve from the owner's own cube |
| Recognition is correct for every catalogue case | Unit | `f2lRecognition.test.ts` case 1 — all 164 entries round-trip | **proven** | — |
| Recognition survives an AUF | Unit | `f2lRecognition.test.ts` case 2 — `f2l-fr-4` under `U`, `U2`, `U'` | **proven** | — |
| No cross-slot leakage in the index | Unit | `f2lRecognition.test.ts` case 3 — every key is prefixed with its own slot | **proven** | — |
| Forward scan when the pair is buried | Unit | `f2lRecognition.test.ts` case 4 — `B` buries the pair, `f2lCaseOfStage` still returns `f2l-fr-4` | **proven** | Never observed to fire on real data; on the reco.nz solve nothing changed |
| F2L 3 / F2L 4 of the reco.nz solve stay unnamed | Unit + inspection | Signature dump per stage: the BL and BR pair pieces sit in other bottom-layer slots for the whole stage | **explained, not a defect** | Whether a larger case set would name them |
| Rows without advice do not open | Browser | Clicking F2L 3 inserts no row; F2L 2 still expands | **browser-proven** | — |
| Whole suite green | Unit/integration | `bunx vitest run --pool=threads --maxWorkers=2` → 102 files, 765 tests | **proven** | — |
| Production build green | Build | `bun run build` → `✓ built` | **proven** | — |
| `recognizeF2l` is reachable, not dead code | Source | `grep -rl "recognizeF2l" src --include='*.ts' --include='*.tsx' \| grep -v '\.test\.'` → `f2lRecognition.ts`, `reconstruction.ts` | **proven** | — |
| Every route still renders, console clean | Browser | Statistics, Library, Study, Training walked; `agent-browser … console` → zero errors/warnings | **browser-proven** | Single operator, not the council |
| Old solves gain the current analysis on load | Browser + unit | Old-format stages seeded into a fresh profile; after one reload `analysisVersion` is `2`, case names and `optimalMoves` are present. `src/storage/reanalyseSolves.test.ts` (4 tests) | **browser-proven** | Not yet run against the owner's own stored history |
| The row shows the algorithm and the shorter solution | Browser | `docs/evidence/coaching-2026-08-05-algorithms-on-rows.png` — `the 3-move alg is R U R'` and `Shorter: R U R' U' R U R' U'` | **browser-proven**, with the stored catalogue emptied first | The stage in that shot was patched to the owner's shape (23 vs 8); no fixture in hand naturally wastes that many moves |
| Algorithm lookup works without opening Training | Unit + browser | `src/domain/coachCatalogue.test.ts` (3 tests); the screenshot above was taken with `algorithms` cleared | **proven** | — |
| Clicking a stage highlights that stage | Browser | Clicked F2L 4; `getComputedStyle(row).backgroundColor` is `rgb(39,39,42)` on the F2L 4 row alone and the player badge reads `F2L 4`. `docs/evidence/coaching-2026-08-05-player-and-rows.png` | **browser-proven** | — |
| Setup moves are shown per stage | Browser | Same screenshot/session — the expanded row renders the full setup sequence under `SETUP` | **browser-proven** | Never applied to a physical cube to confirm it reproduces the case by hand |
| Move strip uses the reconstruction's notation | Browser + unit | 49 raw moves render as 43 tokens; `readableTokens.test.ts` (5 tests) pins identical condensing and exact raw-span tiling | **browser-proven** | — |
| Playback runs at the solve's real speed | Browser + unit | A solve carrying `moveOffsetsMs` shows `REAL SPEED`; without it the control reads `FIXED 320MS`. `moveOffsets.test.ts` (3 tests) | **browser-proven for the label and the code path** | The gaps have never been played against a stopwatch, and no solve captured from a physical cube has been replayed yet |
| Coaching against the owner's physical cube | Device | None | **not run** | Everything device-level |
| Multi-auditor dogfooding council | Independent agents | None | **not run** — no authority to spawn subagents this session | Whatever the council would find |

## 8. Failures, traps, and rejected approaches

| Item | Exact symptom / evidence | Root cause | Why rejected / what was done | Do not repeat / recovery |
|---|---|---|---|---|
| **Stale `ui-check` session respawns browsers** | `agent-browser session list` printed `ui-check` after `close --all`; a later `ps ax \| grep agent-browser/browsers` showed **10** live processes all started within the same 11 seconds as that listing | The `~/.agent-browser/ui-check.*` registry files survive a close with an empty `.pid`; touching the name (`list`, `close`) launches a browser to talk to it | Cleared: `kill` the root process and its orphans, then `rm ~/.agent-browser/ui-check.{pid,sock,stream,version,engine}` | Verify browser state with `ps ax -o pid,command \| grep agent-browser/browsers`, never with `session list` alone. On this machine, `session list` is itself a spawning action |
| **Wrong process name in a cleanup check** | Reported "no Chromium processes" while PID 22755 — `Google Chrome for Testing`, launched with this session's own flags — was alive | agent-browser runs Chrome for Testing from `~/.agent-browser/browsers/`, not a binary called Chromium | Corrected in the same pass | Grep the launcher path `agent-browser/browsers`, not the word Chromium |
| `agent-browser click` on the diagnostics buttons | `✗ Element not found` for `@e28`; same for `button:has-text('Perform this scramble')`. The panel's own log stayed empty, so the click never landed even though an earlier call returned `✓ Done` | Snapshot refs go stale across navigation; the CLI does not accept Playwright text selectors | Clicked through `eval` and confirmed the app's own log line | Confirm a click by the app's observable reaction, not by the CLI's exit line |
| Reading `twisty-player.experimentalSetupAlg` | The getter throws inside `eval` and kills the whole expression (`at get experimentalSetupAlg (…cubing_twisty.js:2929:9)`) | Write-oriented experimental property | Judged the cube from screenshot crops instead | Do not probe that property |
| First lookahead test buried the pair with `D` | `recognizeF2l` still returned `f2l-fr-4`, so the test asserted nothing | `D` does not touch a pair sitting in the top layer | Switched to `B`, which pulls it out of the top layer | Verify that a "negative" setup is actually negative before asserting on it |
| `caseRecognition.test.ts` failed after item 3 | `AssertionError: F2L 2: expected 'f2l-fr-4' to be undefined` | The test pinned the very gap item 3 removes | Updated the assertion rather than weakening the feature | A test that encodes a known gap must be changed with the gap, not worked around |
| Playback cube looked "wrong" under the hold | With yellow-top configured, the reco.nz solve finished showing white on top | That solve's own move stream starts with `z2`, so the final frame is rotated; the hold is a view rotation applied on top | Verified on a rotation-free solve instead | Never judge the hold on a solve containing rotations |
| Building the recogniser before reading the repo's notes | `acubemy-solve-2026-08-04.md` §82 already described the forward scan; §84 already recorded its absence here | Skipped `AGENTS.md`'s reference-first rule | Corrected the same session; receipt in `docs/research/execution-receipt-2026-08-05-gyst.md` | Search `docs/research/` for the behaviour before writing it |
| Mutating the app scramble to get a CFOP solve | — | Prohibited after the retry-from-step defect recorded in the previous handoff | Rejected; seeded the fixture through the app's own pipeline instead | Any "practise this again" must be self-contained |
| Composing a CFOP solver from `optimalCrossPlusPairSolution` | — | It solves cross + one pair and does not preserve already-placed pairs | Rejected as a solver | If attempted, the search must constrain the solved slots |

## 9. Known limitations and blockers

- **No physical cube.** Blocks: any claim about Bluetooth timing, packet loss, or the owner's hands. Missing: the device. Safe work done around it: the whole pipeline is exercised through `scriptedSource` and through replayed fixtures. First action when a cube is available: connect, perform one real solve, and check that the scramble marker advances only on matching turns and the timer starts on the first solve move.
- **No authority to spawn subagents this session.** Blocks: §11 item 1, the multi-auditor dogfooding council. Missing: the owner's instruction. Safe work done around it: a single-operator dogfood (every route, console clean, coaching surface driven end to end). First action when it clears: run `agent-browser-dogfood` auditors who *use* the app, to two consecutive rounds with no behavioural findings.
- **No CFOP solver for an arbitrary scramble.** Blocks: seeing the coaching on a locally-driven solve without seeding a fixture — Settings → "Perform this scramble & solve" uses Kociemba, so its solve segments into a Cross stage and little else. Not a blocker for anything already claimed; the fixture path covers it.
- **F2L naming is limited to the 41 catalogued cases.** A pair buried in another bottom-layer slot is not one of them, which is why F2L 3 and F2L 4 of the reco.nz solve are unnamed. Blank over invention is deliberate.

# PART IV — RESUME WITHOUT REDISCOVERY

## 10. Immediate next action

CWD `/Users/vittayapalotai.tanyawat/code/smartcube-coach`. Confirm the tree is where this document says before anything else:

```
git status --porcelain | wc -l          # expect 264
bunx vitest run --pool=threads --maxWorkers=2   # expect 106 files, 780 tests passing
```

On success, start §11 item 1 or 2 depending on what the owner authorises. On failure — a different count, or a red test — stop and diff against §2 and §6 before writing code; someone else has been in the tree.

## 11. Remaining ordered work

1. **Dogfooding council.** Prerequisite: the owner authorises subagents. Target: the coaching surface and the solve pipeline. Method: `agent-browser-dogfood` auditors who drive the running app rather than read diffs — the previous session's thirteen code-reading rounds all missed a defect the owner found in seconds. Verification artifact: per-round findings recorded as observed behaviour with screenshots. Stop condition: two consecutive rounds with no behavioural findings.
2. **One solve on the owner's physical cube.** Prerequisite: the cube. Target: the whole capture path. Method: connect, scramble, solve, then open the breakdown. Verification artifact: a recorded solve in IndexedDB whose stages carry real recognition/execution splits, plus a screenshot of its breakdown. Stop condition: the marker advanced only on matching turns, the timer started on the first solve move, and the coaching rows are populated.
3. **F2L recognition on drifted states.** Prerequisite: none. Target: the cases the 41-case set cannot name — currently F2L 3 and F2L 4 of the reco.nz solve. Method: decide whether to extend the catalogue to buried-pair cases or to state the limit in the UI; do not invent names. Verification artifact: a fixture where the previously unnamed stage either carries a real case or an explicit "not a standard case" label. Stop condition: no F2L row is silently blank without the UI saying why.
4. **A CFOP solution path for the app's own scramble.** Prerequisite: none. Target: Settings → "Perform this scramble & solve". Method: a solver that preserves already-placed slots, or a documented decision to keep seeding fixtures. Verification artifact: a locally-driven solve that segments into Cross + four F2L stages + OLL + PLL. Stop condition: the coaching surface is reachable with no hardware and no fixture seeding.

## 12. Command cookbook

```
# state checks
git status --porcelain | wc -l
git rev-parse --short HEAD
lsof -i :5173 -sTCP:LISTEN
df -h /
ps ax -o pid,command | grep agent-browser/browsers | grep -v grep    # authoritative browser check

# gates — never run the suite and a screenshot sweep at the same time
bunx tsc -b
bun run build
bunx vitest run --pool=threads --maxWorkers=2
bunx vitest run src/domain/f2lRecognition.test.ts --pool=threads --maxWorkers=2

# reachability, per AGENTS.md "No unreachable features"
grep -rl "recognizeF2l" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'

# browser — one pinned session, prefix inline, confirm the origin first
AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session cube open http://localhost:5173/
AGENT_BROWSER_ARGS="..." agent-browser --session cube get url
AGENT_BROWSER_ARGS="..." agent-browser --session cube set viewport 1280 1000
AGENT_BROWSER_ARGS="..." agent-browser --session cube console
AGENT_BROWSER_ARGS="..." agent-browser --session cube screenshot /path/shot.png

# click anything in this app through eval; ref and text selectors have both failed here
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "Array.from(document.querySelectorAll('button')).find(function(x){return /Perform this scramble/i.test(x.textContent)}).click(); 'clicked'"

# what actually got stored
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "new Promise(function(res){var r=indexedDB.open('smart-cube-coach');r.onsuccess=function(){var t=r.result.transaction(['solves','stages']);var q=t.objectStore('solves').getAll();var g=t.objectStore('stages').getAll();t.oncomplete=function(){res(JSON.stringify({solves:q.result.length,stages:g.result.length}))}}})"

# seed a real human CFOP solve through the app's OWN segmenter and repositories
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "(async function(){
  var reco = await (await fetch('/reco/13444.json')).json();
  var rec = await import('/src/domain/reconstruction.ts');
  var db = await import('/src/storage/database.ts');
  var events = reco.moves.map(function(m,i){return {move:m,timestamp:1000+i*90}});
  var stages = await rec.segmentCfop(reco.scramble, events, 'reco-13444');
  var started = Date.now()-60000;
  await db.repositories.solves.put({id:'reco-13444',sessionId:'default',puzzle:'3x3x3',scramble:reco.scramble,scrambleGenerator:'reco.nz',startedAt:started,endedAt:started+4320,penalty:'none',analysisVersion:'1',rawEventIds:[],moves:reco.moves,source:'replay'});
  for (var s of stages) await db.repositories.stages.put(s);
  return stages.map(function(s){return s.name+'/'+(s.caseName||'-')}).join(' | ');
})()"
# then open TRAINING once — the F2L catalogue records betterAlgorithmFor reads are written there

# cube-region screenshots: ask the page where the cube is, never guess the crop
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "JSON.stringify(Array.from(document.querySelectorAll('twisty-player')).map(function(t){var r=t.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}}))"
magick shot.png -crop 160x160+314+436 +repage crop.png
magick compare -metric RMSE cropA.png cropB.png null:

# MUST run before finishing, in this order
AGENT_BROWSER_ARGS="..." agent-browser close --all
ps ax -o pid,command | grep agent-browser/browsers | grep -v grep     # expect nothing
# if a name lingers in `session list`, it is a stale registry entry that respawns browsers:
# kill the processes, then: rm ~/.agent-browser/<name>.{pid,sock,stream,version,engine}
```

## 13. Handoff receipt

- **Handoff authoring time:** 2026-08-05, after the F2L lookahead correction and after the browser-process cleanup.
- **Live state checked at:** authoring time — `pwd`, `git branch --show-current` (`main`), `git rev-parse --short HEAD` (`002ac74`), `git status --porcelain | wc -l` (264, including this file), per-path `git status --porcelain <path>` and `git diff --stat` for ownership, `lsof -i :5173 -sTCP:LISTEN` (PID 46939), `curl -o /dev/null -w %{http_code} http://localhost:5173/` (200), `ps ax | grep agent-browser/browsers` (0 after cleanup), `agent-browser session list` (`No active sessions`, and no processes spawned by the listing), `df -h /` (9.8 GB free), `ls -lh docs/evidence/coaching-2026-08-05-*.png` (7 files, 14–130 KB).
- **Sources read:** `~/.claude/CLAUDE.md`; `~/.claude/skills/get-your-shit-together/references/user-demands.md` (26 KB, all 20 sections); this repo's `AGENTS.md` (135 lines); `docs/HANDOFF_2026-08-05-coaching.md` (all sections); `docs/research/reference-findings-2026-08-03.md`, `feature-harvest.md`, `acubemy-solve-2026-08-04.md`; `/tmp/refs/f2ltrainer/src/lib/utils/checkF2LState.ts` (203 lines); `src/domain/{reconstruction,pairSolver,crossSolver,caseRecognition,f2lCases,f2lCatalogue,betterAlgorithm,cubeHold,guidedSolve,attachReconstruction}.ts`, `src/storage/preferences.ts`, `src/components/solve/{SolveAnalysis,SolveRoute,Cube3D}.tsx`, `src/components/settings/DiagnosticsPanel.tsx`, `src/components/{ReconstructEditor,RecoStudy}.tsx`. Every file's size was checked before reading; nothing exceeded 500 KB.
- **Logs/history ranges read:** none. No history-mining was requested, so no extraction exists and none needs purging.
- **Durable notes written:** this document; `docs/research/execution-receipt-2026-08-05-gyst.md`; `docs/HANDOFF_2026-08-05-coaching.md` §1–§4 and §6–§14; `docs/evidence/README.md`.
- **Exact verification artifact inspected after writing:** `bunx vitest run --pool=threads --maxWorkers=2` re-run after the owner-reported defect was fixed → `Test Files 106 passed (106) / Tests 780 passed (780)`; `bun run build` → `✓ built in 1.49s`; `docs/evidence/coaching-2026-08-05-breakdown.png` reopened and read (case names on the F2L rows, `The BL pair was 3 moves cheaper here: R B2 R' B2` on the expanded row); `ps ax | grep agent-browser/browsers` → 0 processes with the dev server still up on PID 46939.
- **Explicitly unverified:** the fix against the owner's own stored history — it was proven on a solve seeded to reproduce his conditions, and his solves will be re-analysed the next time he loads the app; anything against the owner's physical cube; the multi-auditor dogfooding council; whether the reco.nz solve's F2L 3 and F2L 4 are nameable by a larger case set; the hold's appearance on a solve containing the solver's own rotations (understood, not screenshotted).
