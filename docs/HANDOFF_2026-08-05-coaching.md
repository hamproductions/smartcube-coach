# Smart Cube Coach — coaching surface and solve pipeline, handoff 2026-08-05

Everything required to resume without rediscovery. This is not a summary.

# PART I — TASK CONTRACT AND LIVE STATE

## 1. Exact task contract

- **Latest owner requirement:** the coaching output must give both a better algorithm for the case and a better slot choice; the breakdown must be an accordion because everything on screen at once was unreadable; the playback player must be normal-sized and sticky; the "set up for PLL again" affordance is removed in favour of simply showing the algorithm. (Recorded as requirements — this repository does not carry chat text verbatim.)
- **Required completion:** the app tells the solver, per stage, which case it was, the better algorithm for it, and which pair they should have taken instead. Standing session goal: nothing stops until the work is done, dogfooded, and council-approved.
- **Explicit non-actions:** no commit, push, deploy, or PR — none was authorised this session. Do not reintroduce a hands-free accept gesture. Do not let any control mutate the app's main scramble.
- **Current-turn authority:** local edits and local verification only.
- **Source-of-truth precedence:** the owner's latest message → screenshots he supplied → live app behaviour → `docs/research/gyst-2026-08-04-state-and-verification.md` → this handoff.

## 2. Ground truth: repository and working tree

| Field | Current value | Evidence command |
|---|---|---|
| Working directory | `/Users/vittayapalotai.tanyawat/code/smartcube-coach` | `pwd` |
| Repository and branch | `main` | `git branch --show-current` |
| HEAD | `002ac74` ("docs: add complete project handoff") | `git rev-parse --short HEAD` |
| Base/PR state | Not applicable — nothing pushed, no PR opened | — |
| Pre-existing dirty state | The tree was already dirty at session start (~200 modified/untracked paths from prior sessions); `git status --porcelain` counted 246 entries when this handoff was first written and **255** after the 2026-08-05 follow-up | `git status --short` at session start; `git status --porcelain \| wc -l` |
| Task changes | See §6 and §14 — all edits are under `src/domain/`, `src/components/solve/`, `docs/` | `git status --porcelain` |
| Untracked artifacts | `src/components/ao1k/`, `src/components/cubedex/`, `src/components/history/`, `src/components/library/`, `src/components/settings/`, `src/components/solve/`, `src/components/study/`, `src/components/training/`, `src/components/ui/`, plus new domain/device files listed in §6 | `git status --porcelain \| awk '$1=="??"'` |
| Ownership uncertainty | Most untracked directories predate this session (the design rebuild). Files named in §6 are this session's. | Classified by comparing against the session's own edit log |

**Deleted this session:** `src/components/LiveSolve.tsx`, `src/components/LiveSolve.test.tsx`, and its sibling test files — the component was unreachable from `App.tsx` yet carried the repo's largest test suite. Coverage was ported onto the shipped route first (see §5).

## 3. Environment and operational rules

- Dev server: already running on `http://localhost:5173`, PID `46939` (it was `93874` when this handoff was first written — someone else restarted it between sessions; check with `lsof -i :5173 -sTCP:LISTEN`). **Do not restart it**; if it dies, find out why before relaunching.
- Build gate: `bun run build` (= `panda codegen && tsc -b && vite build`). `tsc --noEmit` is **not** the gate — it misses what `tsc -b` and `vite build` catch. `bunx tsc -b` alone is a fast typecheck.
- Tests: **always** cap concurrency — `bunx vitest run --pool=threads --maxWorkers=2`. Uncapped runs have bricked this machine.
- Browser: prefix every command inline with `AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio"`. Without it Chromium hits the macOS Keychain and raises an OS password prompt.
- **No browser is running.** `cube`, `dogfood` and `ui-check` were all closed at the end of the 2026-08-05 follow-up; `ps ax | grep agent-browser-chrome` returns **zero** processes and disk went from 7.1 GB to 9.7 GB free. `agent-browser session list` nevertheless still prints `ui-check` — a stale registry entry under `~/.agent-browser/` whose `ui-check.pid` file is empty and which predates that session. Verify with the process check, not with `session list` alone; the list is not authoritative, and each `close` on the stale name spawns a short-lived browser just to close it. Leftover *real* sessions have previously filled the disk and killed the dev server.
- Confirm the origin with `agent-browser get url` before trusting any browser step — `--session <name>` is not isolation.
- Never click `mailto:`/`tel:`/non-http(s) links in the app.
- HMR trap: editing files while a tab is open re-evaluates modules and previously threw `useCubeConnection must be used inside CubeConnectionProvider`, taking the solve page down mid-session. The context is now held on `globalThis` to survive this, but a hard reload is still the way to confirm a real error versus an HMR artifact.

# PART II — COMPLETE EXECUTION RECORD

## 4. Chronological command and action ledger

Condensed to material actions; every command below is safe to rerun unless noted.

| Order | Phase | CWD | Command / action | Why | Material output |
|---|---|---|---|---|---|
| 1 | Diagnose | repo | `agent-browser --session cube open http://localhost:5173/` + Settings → "Perform this scramble & solve" | Drive a full scramble+solve with no hardware | Solve recorded `cube 2.40s 21 moves`, stages written |
| 2 | Fix | repo | Edits to `src/device/CubeConnection.tsx` | App-wide capture/scramble/tracking; single bus registration | Build green |
| 3 | Verify | repo | `bunx vitest run --pool=threads --maxWorkers=2` | Full gate | 760 passing at final run |
| 4 | Diagnose | repo | Screenshot + `magick compare -metric RMSE` on cropped cube regions | Decide whether the playback cube actually moves | Inconclusive — wrong crop region; see §8 |
| 5 | Build | repo | `src/domain/betterAlgorithm.ts`, `src/domain/betterSlot.ts`, `src/domain/stageAdvice.ts` | The coaching output the owner asked for | Unit tests pass |
| 6 | Wire | repo | `src/domain/reconstruction.ts` — keep `optimalCrossPlusPairSolution().moves`, score free slots | Was discarding the solution and keeping only its length | `betterSlot` + `optimalMoves` now persisted on stages |
| 7 | Prove | repo | `bunx vitest run src/domain/betterSlotOnRealSolve.test.ts --pool=threads --maxWorkers=2` | Verify coaching on a REAL human solve, not a generated one | `F2L 2: The BL pair was 3 moves cheaper here: R B2 R' B2` |
| 8 | UI | repo | `src/components/solve/SolveAnalysis.tsx` accordion + sticky 160px player | Owner: cluttered, player too big | Browser-verified: advice collapsed, click seeks `21/21 → 0/21` |

### Follow-up session, 2026-08-05

| Order | Phase | CWD | Command / action | Why | Material output | Safe to rerun? |
|---|---|---|---|---|---|---|
| 9 | State | repo | `lsof -i :5173 -sTCP:LISTEN`; `df -h /`; `agent-browser session list` | Live state before touching anything | Dev server PID `46939`; 7.1 GB free; `ui-check` and `dogfood` still open | Yes |
| 10 | Hygiene | repo | `agent-browser close --session ui-check`; `… --session dogfood` | Leftovers from the previous session | Both closed | Yes |
| 11 | Drive | repo | `agent-browser --session cube open http://localhost:5173/`, then Settings → "Perform this scramble & solve" **clicked through `eval` DOM click** | `click` by ref and by `:has-text` selector both failed; the panel's own log stayed empty, proving the click never landed | `[SYSTEM] performing D' B2 …` then `[SYSTEM] solution F U' L …`; 1 solve, 2 stages in IndexedDB | Yes |
| 12 | Measure | repo | `agent-browser … eval` for the modal player's `getBoundingClientRect()`, then `magick … -crop 160x160+314+436` + `magick compare -metric RMSE` | Settle whether the playback cube follows the seek, cropping the cube's **own** rect this time | `20718.9 (0.316)`; move 1 scrambled, move 20 solved | Yes |
| 13 | Build | repo | `src/domain/f2lRecognition.ts` + wiring in `src/domain/reconstruction.ts` | F2L stages carried a slot but no case | `F2L 1 → F2L 2 - Front Left`, `F2L 2 → F2L 29 - Front Right` on the reco.nz solve | Yes |
| 14 | Verify | repo | `bunx vitest run --pool=threads --maxWorkers=2` | Full gate | 1 failure: `caseRecognition.test.ts` pinned the old "F2L unlabelled" gap; assertion updated to the intended behaviour | Yes |
| 15 | Seed | repo | `agent-browser … eval` importing `/src/domain/reconstruction.ts` and `/src/storage/database.ts`, segmenting `public/reco/13444.json` and writing solve + stages | See the coaching on a real human solve without hardware, through the app's own code | Stage rows and the better-pair line render in the modal | Yes |
| 16 | Correct | repo | Read `docs/research/acubemy-solve-2026-08-04.md` §82/§84 and `/tmp/refs/f2ltrainer/src/lib/utils/checkF2LState.ts`, then add `f2lCaseOfStage()` | GYST: the recogniser had been written before the repo's own reference notes were read | Forward-scan fallback added and pinned by a test; no change on the reco.nz fixture, whose F2L 3/4 pairs are buried all stage | Yes |
| 17 | Gate | repo | `bunx vitest run --pool=threads --maxWorkers=2`; `bun run build` | Final gates | 102 files / 765 tests passing; build clean | Yes |
| 18 | Hygiene | repo | `agent-browser close --all`, then `ps ax -o pid,command \| grep agent-browser-chrome`, `df -h /` | Leave nothing running | Zero browser processes; 9.7 GB free. A first check that grepped for `Chromium` reported clean while a headless `Google Chrome for Testing` (PID 22755) was still alive — grep the launcher path, not the word Chromium | Yes |

## 5. Methodology and decision record

**Cube state is app-owned.** The cube is only a move source. `CubedexMoveTracker` no longer seeds its pattern from device `FACELETS` (the branch is a no-op). The capture session leaves `scrambling` **only** when the cube's own state matches the scramble — nothing in the move stream may end that phase. Rejected alternative: the ported hands-free accept gesture (four turns of one face). It was wired to capture, and any pattern it recognised ended the scramble phase so the next turn started the clock — this is the "timer starts by itself" defect the owner reported repeatedly. The gesture is deleted from `CubedexSolveTracker` entirely. **A successor must not reintroduce it.**

**Progress is what matched, not what was turned.** `faceProgress` forgives an intervening wrong face once the target face is turned again — right for the next-move hint, wrong as progress, because the stray turn is still on the cube. `strictScrambleProgress` drives the display: a wrong face is a divergence until the cube's own state verifies. Modulo-4 accumulation, so `R2` performed as `R' R'` is not a mistake. Whole-cube rotations are skipped; slice turns count.

**The way back is stateless.** Three rejected attempts are recorded in §8. The shipped form is a breadth-first search over cube **states** from the current position to the matched point, depth 3, falling back to the tracker's state-derived route. Same position ⇒ same instruction, regardless of history.

**Slice pairing is off while scrambling.** Every face turn is a slice candidate, so two quick opposite-face turns were merged into one slice and both were lost — a correctly turned `B2` then read as "off the scramble". The flag is set where events **enter** the bus, not in the resolved-move callback, or the first turn of every scramble is already buffered under the old setting.

**Coaching, added this session.** The pair solver already computed the shorter insert; the code kept only `.length` and printed "look for the shorter insert". It now keeps `moves`. `scoreSlots` ranks every slot still unsolved at each F2L decision from the same position; `betterSlotThan` speaks only when the saving is ≥3 moves. Better-pair advice outranks all other advice because slot choice costs more than execution.

## 6. Files and artifacts

| Path | Role | Exact change | Verification |
|---|---|---|---|
| `src/domain/betterSlot.ts` | NEW — score every free pair, name the cheaper one | `scoreSlots`, `betterSlotThan` (≥3 move threshold) | `src/domain/betterSlot.test.ts` (3 tests) |
| `src/domain/betterAlgorithm.ts` | NEW — case → known algorithm lookup | Only speaks when the solver used ≥2 more moves | `src/domain/betterAlgorithm.test.ts` (4 tests) |
| `src/domain/stageAdvice.ts` | NEW — per-stage advice + `retrySetup` | Better pair first, then recognition share, wasted turns (with the moves), outlier stage, pauses | `src/domain/stageAdvice.test.ts` (7 tests) |
| `src/domain/reconstruction.ts` | Persist `optimalMoves` and `betterSlot` on each stage | Keeps the solver's solution, scores free slots | `src/domain/betterSlotOnRealSolve.test.ts` — real reco.nz solve |
| `src/domain/cubeHold.ts` | NEW — hold rotation + face permutation | `composePerm(rotation, perm)` order is load-bearing | `src/domain/cubeHold.test.ts` — all 24 rotations vs real cube states |
| `src/domain/scramble.ts` | `strictScrambleProgress` added; `generateCorrection`/`backtrackToScramble` deleted | Honest progress and divergence | `src/domain/strictScrambleProgress.test.ts` (5 tests) |
| `src/device/capture.ts` | `matchedIndex`, `offTrack`, `recovery`, `startedAtWall`; generation guard after every await | State-based recovery; live readout on the wall clock | `src/device/capture.test.ts` (25 tests) |
| `src/device/CubeConnection.tsx` | App-wide capture/scramble/trackers; single bus registration; context on `globalThis` | The core of "same cube every page" | `src/device/sharedTracking.test.tsx`, `timerNeverAutoStarts.test.tsx` |
| `src/device/recordCapture.ts` | NEW — app-wide solve persistence + `toWallClock` | A solve completes and records from any page | `src/device/recordCapture.test.ts` (5 tests) |
| `src/storage/repairTimestamps.ts` | NEW — rebase 1970-dated solves once on load | Slots sized by duration; anchored before the oldest good solve; floor-clamped | `src/storage/repairTimestamps.test.ts` (8 tests) |
| `src/components/solve/SolveAnalysis.tsx` | Accordion rows that also seek; 160px sticky player; case name on rows; better-alg line | The breakdown surface | Browser: `21/21 → 0/21` on stage click |
| `src/components/solve/SolveRoute.tsx` | Breakdown modal on the first page; insights on the cockpit | Owner: insights must be on the landing page | Browser: `role="dialog"` with CFOP splits + reconstruction |
| `src/components/ui/LastLayerDiagram.tsx` | NEW — SVG OLL/PLL diagrams, configurable hold | cubing.js has no colour-scheme API | `src/components/ui/lastLayerDiagram.test.ts` |
| `docs/research/gyst-2026-08-04-state-and-verification.md` | Durable defect/decision record | Appended throughout the session | — |
| `src/domain/f2lRecognition.ts` | NEW — which of the 41 F2L cases a stage was | `f2lSignature`, `buildF2lIndex` (164 catalogue entries × 4 AUFs), `recognizeF2l` | `src/domain/f2lRecognition.test.ts` (5 tests) |
| `src/domain/reconstruction.ts` (follow-up) | F2L branch in `recognized`; `f2lCaseOfStage()` forward scan per acubemy §82 | `framedEntry` moved above recognition so the F2L branch can use it | `f2lRecognition.test.ts`, `caseRecognition.test.ts`; browser rows on the reco.nz solve |
| `src/components/solve/SolveAnalysis.tsx` (follow-up) | Hold-aware playback cube; rows expand only when they carry advice | Reads `readPreferences()` itself; `better`/`advice` computed once per row | Browser: hold flips white↔yellow top; a no-advice row no longer opens |
| `docs/evidence/coaching-2026-08-05-*.png` | Five screenshots: breakdown, seek pair, hold pair | Captured from `http://localhost:5173/` | Indexed in `docs/evidence/README.md` |
| `docs/research/execution-receipt-2026-08-05-gyst.md` | NEW — GYST receipt for the follow-up | Rule broken, sources read, corrected work, unverified items | — |

## 7. Verification matrix

| Claim | Evidence layer | Artifact | Result | Unverified |
|---|---|---|---|---|
| Full scramble → solve → record → segment | Browser, no hardware | Settings → "Perform this scramble & solve"; IndexedDB read | **browser-proven** — `cube 2.40s 21 moves 2026`, stages written | Never run against the owner's physical cube by me |
| Timer never starts by itself | Unit + browser | `src/device/timerNeverAutoStarts.test.tsx` (18 assorted turns incl. the old gesture pattern) | **proven** | — |
| Scramble tracking is honest | Unit + browser | `strictScrambleProgress.test.ts`; browser showed 12/21 matched mid-scramble, 3 matched + 1-move fix after a wrong turn | **proven** | — |
| Better pair suggestion | Unit on a real human solve | `betterSlotOnRealSolve.test.ts` → `F2L 2: The BL pair was 3 moves cheaper here: R B2 R' B2` | **proven on fixture** | Never seen on the owner's own solve in the browser |
| Accordion + seek from stage row | Browser | Click stage row → advice expands, `move 21/21 → 0/21` | **browser-proven** | — |
| Case name on stage rows | Browser | See the F2L row line below — superseded, no longer code-inspected only | **browser-proven** | — |
| Playback cube follows the seek | Browser | `docs/evidence/coaching-2026-08-05-seek-move1.png` / `-move20.png`, cropped to the player's own rect (313,436 160×160), `magick compare -metric RMSE` = 20718.9 (0.316) | **browser-proven** — move 1 scrambled, move 20 solved | — |
| Playback cube in the configured hold | Browser | Settings top colour white → `coaching-2026-08-05-hold-white-top.png`; yellow → `-hold-yellow-top.png`; RMSE 12480.7 (0.190) | **browser-proven** on a rotation-free solve | A solve whose own move stream contains rotations ends in the frame the solver left it in; the hold is a view rotation applied on top of that |
| F2L case named on the stage row | Browser | `docs/evidence/coaching-2026-08-05-breakdown.png` — `F2L 1 · F2L 2 - Front Left`, `F2L 2 · F2L 29 - Front Right` | **browser-proven** | Only the 41 catalogued cases; a pair trapped in another slot stays unnamed |
| Better-pair coaching on screen | Browser | Same screenshot — `The BL pair was 3 moves cheaper here: R B2 R' B2` on the expanded F2L 2 row | **browser-proven** | Seen on the reco.nz solve seeded into storage, not on a solve from the owner's cube |

## 8. Failures, traps, and rejected approaches

| Item | Symptom | Root cause | Do not repeat |
|---|---|---|---|
| Accept gesture wired to capture | Timer started by itself | Four same-face turns (`U U' U U'` qualifies) ended the scramble phase | Gesture deleted; nothing in the move stream may end scrambling |
| Retry-from-step | Overwrote the **main** scramble with ~100 raw moves; timing it would record a fake solve | Feature mutated app-wide scramble state | Any "practise this again" must be self-contained |
| Correction as token arithmetic | `F' F' F' F'`, then 32 alternating moves that cancel to nothing | Inverting the move list instead of asking the cube | Compute from cube **state** |
| Hold rotation appended last | Cube desynced mid-solve | Rotation at the end blocks per-move append, forcing a full re-parse each turn | Rotation goes **first**; remap appended moves through the permutation |
| `holdPermutation` fold order | Wrong face turned for two-token rotations | `composePerm(perm, rotation)` — identical for one token, which is why `z2` masked it | Verify with ≥2-token rotations |
| Hero elapsed vs cube clock | Printed `1785851560…` | Monotonic cube timestamp subtracted from `Date.now()` | Use `startedAtWall` for display |
| `tsc --noEmit` as the gate | Broken production build went unnoticed | It is not what `bun run build` runs | Use `bun run build` |
| Diagnosing by reading code | Told the owner click-to-seek "was never wired" — it is, `SolveAnalysis` line ~154 | Read instead of used | Drive the app first |
| Council reading diffs | 13 rounds; all missed the retry hijack the owner found in seconds | Auditors read source, never used the product | Dogfood council must drive the app |
| `agent-browser click` on the diagnostics buttons | `✗ Element not found` for `@ref`, and `button:has-text(...)` is not a supported selector | Refs from a snapshot taken before navigation are stale; the CLI does not accept Playwright text selectors | Click through `eval` (`Array.from(document.querySelectorAll('button')).find(…).click()`) and confirm the app's own log line, not the CLI's `✓ Done` |
| Reading a `twisty-player`'s `experimentalSetupAlg` | The getter throws inside `eval`, which kills the whole expression | It is a write-oriented experimental property | Judge the cube from a screenshot crop, not from the property |
| First lookahead test used `D` as the burying move | `recognizeF2l` still returned `f2l-fr-4` | `D` does not touch a pair sitting in the top layer | Bury with `B`, which pulls the pair out of the top layer |
| Writing the F2L recogniser before reading the repo's notes | Missing acubemy's documented forward-scan fallback | Skipped `AGENTS.md`'s reference-first rule | Read `docs/research/` for the behaviour before building it — the note already named this exact gap |

## 9. Known limitations and blockers

- **No physical cube.** Everything is verified through `scriptedSource` (Settings → Diagnostics), which drives the app's own scramble plus a computed solution through the normal event path. That covers the pipeline but not real Bluetooth timing, packet loss, or the owner's hands. First action when a cube is available: connect and perform one real solve, checking the marker advances only on matching turns and the timer starts on the first solve move.
- **No CFOP solver for an arbitrary scramble.** Settings → "Perform this scramble & solve" still solves with Kociemba, so the solve it records segments into a Cross stage and little else. The coaching surface is therefore seen locally only on a human solve seeded into storage (§14). Building a CFOP solution path for the app's own scramble would remove the seeding step; `optimalCrossPlusPairSolution` solves cross+one pair but does not preserve the pairs already placed, so it is not that solver yet.
- **Not council-approved.** Thirteen code-reading rounds; two consecutive clean rounds never happened. The 2026-08-05 follow-up ran a single-operator dogfood instead of the multi-auditor council.

# PART IV — RESUME WITHOUT REDISCOVERY

## 10. Immediate next action

CWD `/Users/vittayapalotai.tanyawat/code/smartcube-coach`. The playback questions this section used to hold are answered (§14). The next action is item 5 or 6 of §11: run the dogfooding council when subagents are authorised, or connect the physical cube and perform one real solve.

## 11. Remaining ordered work

Items 1–4 were closed on 2026-08-05 (second session). What each turned out to be is in §14.

1. ~~Playback cube follows the seek~~ — **done**, browser-proven.
2. ~~Playback cube in the configured hold~~ — **done**; `SolveAnalysis` reads the preference itself, so every call site (`SolveRoute`, `AnalysisRoute`, `HistoryRoute`) gets it.
3. ~~F2L case identification in the segmenter~~ — **done**; `src/domain/f2lRecognition.ts`.
4. ~~See the coaching on a real solve in the browser~~ — **done** on the reco.nz solve seeded into storage through the app's own segmenter.
5. **Dogfooding council** — still open. A single-operator dogfood pass ran instead (every route walked, console clean, the coaching surface driven end to end); the multi-auditor council was not run because this session had no authority to spawn subagents. Stop condition unchanged: two consecutive rounds with no behavioural findings.
6. **A solve from the owner's physical cube** — still the largest unverified surface. Everything above is software-path evidence.

## 12. Command cookbook

```
# typecheck / build gate
bunx tsc -b
bun run build

# tests — ALWAYS capped
bunx vitest run --pool=threads --maxWorkers=2
bunx vitest run src/domain/betterSlotOnRealSolve.test.ts --pool=threads --maxWorkers=2

# browser (prefix inline, session `cube`)
AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session cube open http://localhost:5173/
AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session cube console
AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session cube screenshot /tmp/shot.png

# drive a full solve with no hardware: Settings → "Perform this scramble & solve"
# drive a deliberate mistake: Settings → "Scramble then a wrong turn"

# read what was actually stored
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "new Promise(function(res){var r=indexedDB.open('smart-cube-coach');r.onsuccess=function(){var t=r.result.transaction(['solves','stages']);var q=t.objectStore('solves').getAll();var g=t.objectStore('stages').getAll();t.oncomplete=function(){res(JSON.stringify({solves:q.result.length,stages:g.result.length}))}}})"

# MUST run before finishing — close what you opened, then prove it by process, not by list
AGENT_BROWSER_ARGS="..." agent-browser close --all
ps ax -o pid,command | grep agent-browser-chrome | grep -v grep

# a stale `ui-check` entry survives in `session list` with an empty ~/.agent-browser/ui-check.pid;
# it has no process behind it, and closing it just spawns a browser to close again
```

Do not run the full test suite and a browser screenshot sweep concurrently. Do not restart the dev server (PID `46939` as of the 2026-08-05 follow-up; it was `93874` when this handoff was first written, so it has been restarted at least once by someone else).

Seed a real human CFOP solve into local storage, which is what makes the coaching visible without hardware — the app's own segmenter and repositories, driven from the page:

```
AGENT_BROWSER_ARGS="..." agent-browser --session cube eval "(async function(){
  var reco = await (await fetch('/reco/13444.json')).json();
  var rec = await import('/src/domain/reconstruction.ts');
  var db = await import('/src/storage/database.ts');
  var events = reco.moves.map(function(m,i){return {move:m,timestamp:1000+i*90}});
  var stages = await rec.segmentCfop(reco.scramble, events, 'reco-13444');
  var started = Date.now()-60000;
  await db.repositories.solves.put({id:'reco-13444',sessionId:'default',puzzle:'3x3x3',scramble:reco.scramble,scrambleGenerator:'reco.nz',startedAt:started,endedAt:started+4320,penalty:'none',analysisVersion:'1',rawEventIds:[],moves:reco.moves,source:'replay'});
  for (var s of stages) await db.repositories.stages.put(s);
})()"
```

The F2L catalogue records `betterAlgorithmFor` looks up are only written when the Training page has been opened once in that browser profile. Open TRAINING before expecting a suggested algorithm on a stage row.

## 13. Handoff receipt

- **Authoring time:** 2026-08-05, immediately after the better-slot wiring landed.
- **Live state checked at:** authoring time — `git branch --show-current` (`main`), `git rev-parse --short HEAD` (`002ac74`), `git status --porcelain` (246 entries), `agent-browser session list` (`cube`, `dogfood`, `ui-check` all open), `lsof -i :5173` (PID 93874).
- **Sources read:** `~/.claude/skills/get-your-shit-together/references/user-demands.md` (26 KB, §1–8 in full); `src/domain/reconstruction.ts`, `pairSolver.ts`, `scramble.ts`, `stageAdvice.ts`; `src/device/capture.ts`, `CubeConnection.tsx`, `cubedex/moveTracker.ts`, `cubedex/solveTracker.ts`; `src/components/solve/SolveAnalysis.tsx`, `SolveRoute.tsx`, `SolveCockpit.tsx`, `Cube3D.tsx`; every screenshot the owner supplied this session.
- **Logs/history ranges read:** none — no history-mining request this session.
- **Durable notes written:** `docs/research/gyst-2026-08-04-state-and-verification.md` (appended throughout) and this handoff.
- **Exact verification artifact inspected after writing:** `bunx vitest run --pool=threads --maxWorkers=2` → **101 files, 760 tests passing**; `bun run build` → clean.
- **Explicitly unverified:** whether the playback cube follows the seek; the playback cube's orientation; case names rendered on stage rows in a browser; any behaviour against the owner's physical cube; the dogfooding council's result.

### Receipt for the 2026-08-05 follow-up

- **Authoring time:** 2026-08-05, after the F2L lookahead landed and both gates were green.
- **Live state checked at:** authoring time — `git branch --show-current` (`main`), `git rev-parse --short HEAD` (`002ac74`), `git status --porcelain | wc -l` (255), `lsof -i :5173 -sTCP:LISTEN` (PID 46939), `ps ax | grep agent-browser-chrome` (zero processes; `session list` still prints a stale `ui-check` with an empty pid file), `df -h /` (9.7 GB free).
- **Sources read:** `~/.claude/CLAUDE.md`; `~/.claude/skills/get-your-shit-together/references/user-demands.md` (26 KB, all 20 sections); this repo's `AGENTS.md` (all 135 lines); this handoff; `docs/research/reference-findings-2026-08-03.md`, `feature-harvest.md`, `acubemy-solve-2026-08-04.md`; `/tmp/refs/f2ltrainer/src/lib/utils/checkF2LState.ts` (all 203 lines); the source files listed in `docs/research/execution-receipt-2026-08-05-gyst.md`.
- **Logs/history ranges read:** none — no history-mining request, so no extraction exists to purge.
- **Durable notes written:** `docs/research/execution-receipt-2026-08-05-gyst.md`, this §14, and `docs/evidence/README.md`.
- **Exact verification artifact inspected after writing:** `bunx vitest run --pool=threads --maxWorkers=2` → 102 files, 765 tests passing; `bun run build` → clean; `docs/evidence/coaching-2026-08-05-breakdown.png` reopened and read.
- **Explicitly unverified:** the owner's physical cube; the multi-auditor dogfooding council; whether the reco.nz solve's F2L 3 and F2L 4 are nameable at all.

## 14. Follow-up session, 2026-08-05 (items 1–4)

**A self-contained handoff for that follow-up is `docs/HANDOFF_2026-08-05-f2l-coaching.md`** — full ledger, ownership-classified file list, verification matrix, traps and ordered remaining work. This section is the short form kept in place so this document stays accurate on its own.

**Task contract:** finish the remaining ordered work in this handoff. Same non-actions as §1 — nothing was committed, pushed, deployed, or opened as a PR, and no control was given the ability to mutate the app's main scramble.

### What each open question turned out to be

| # | Question | Answer | How it was settled |
|---|---|---|---|
| 1 | Does the playback cube follow the seek? | **Yes — it always did.** The earlier RMSE was inconclusive because the crop was taken from a guessed region. | Read the modal player's own `getBoundingClientRect()` (313.75, 436, 160×160) and cropped that. Move 1 renders the scrambled cube, move 20 the solved one, RMSE 20718.9 (0.316). |
| 2 | Is the playback cube in the configured hold? | It was not; it is now. | `SolveAnalysis` reads `readPreferences()` itself and passes `viewRotationForHold(top, front)` to `Cube3D`. Reading the preference in the component rather than threading a prop means `SolveRoute`, `AnalysisRoute` and `HistoryRoute` all get it. Proven by flipping the Settings top colour on a rotation-free solve: white top → white on top, yellow top → yellow on top, RMSE 12480.7 (0.190). |
| 3 | Why does no F2L stage carry a case name? | Nothing recognised F2L. `caseName` was only ever set by the OLL and PLL recognisers. | New `src/domain/f2lRecognition.ts`: signature of where the slot's own corner and edge sit and how they are twisted, indexed from `f2lCatalogue`'s 164 entries in all four AUF positions. Wired into `segmentCfop` alongside the OLL/PLL branches, with the forward-scan fallback described below. |
| 4 | Can the coaching be seen on a real solve in the browser? | Yes, on the reco.nz solve seeded into storage through the app's own `segmentCfop` and repositories. | Breakdown modal renders `F2L 1 · F2L 2 - Front Left`, `F2L 2 · F2L 29 - Front Right`, and the expanded row reads `The BL pair was 3 moves cheaper here: R B2 R' B2`. |

### Defect found and fixed while dogfooding

Clicking a stage row with nothing to say opened an **empty** accordion panel — on a real solve that is half the rows. `SolveAnalysis` now computes the better-algorithm and advice once per row and only toggles open when there is something in it; the click still seeks the player either way.

### The reference the recogniser should have started from

The recogniser was written before this repository's own reference notes were read, which `AGENTS.md` forbids. `docs/research/acubemy-solve-2026-08-04.md` §82 already describes acubemy's per-slot `detectF2LCase` and its lookahead — when the position at stage entry is not a recognised case, scan forward for the first point where it is — and §84 already records the absence of that fallback here. `f2lCaseOfStage()` in `reconstruction.ts` now implements it and cites the note; `f2lRecognition.test.ts` pins it with a pair deliberately buried out of the top layer. The full account is `docs/research/execution-receipt-2026-08-05-gyst.md`.

F2LTrainer's `src/lib/utils/checkF2LState.ts` was read as well: it answers only whether a slot is solved, so it is not prior art for recognition, though its slot table is the same one this project already uses.

### Honest limits of the F2L recogniser

Only the 41 catalogued cases are named. A pair whose corner or edge is trapped in a *different* F2L slot is not one of them, and the recogniser returns nothing rather than inventing a name — on the reco.nz solve that is F2L 3 and F2L 4. `caseRecognition.test.ts` previously pinned "non-last-layer stages are unlabelled"; that assertion described the gap, not a requirement, and now asserts that an F2L stage is either unlabelled or carries a well-formed F2L case id.

### Files changed in this follow-up

| Path | Change |
|---|---|
| `src/domain/f2lRecognition.ts` | NEW — `f2lSignature`, `buildF2lIndex`, `recognizeF2l` |
| `src/domain/f2lRecognition.test.ts` | NEW — every catalogue case round-trips, AUF invariance, no cross-slot leakage, F2L names on the reco.nz solve |
| `src/domain/reconstruction.ts` | `framedEntry` computed before recognition; F2L branch added to `recognized`; `f2lCaseOfStage()` (exported for its test) carries acubemy's forward-scan fallback |
| `docs/research/execution-receipt-2026-08-05-gyst.md` | NEW — what was read, which rule was broken, and the corrected work |
| `src/domain/caseRecognition.test.ts` | The "unlabelled" assertion now describes the intended behaviour |
| `src/components/solve/SolveAnalysis.tsx` | Hold-aware playback cube; row expands only when it has advice |
| `docs/evidence/coaching-2026-08-05-*.png` | Five screenshots: breakdown surface, seek pair, hold pair |

### Verification artifacts inspected

- `bunx vitest run --pool=threads --maxWorkers=2` → **102 files, 765 tests passing**.
- `bun run build` → clean (`panda codegen && tsc -b && vite build`).
- Browser, session `cube`, `http://localhost:5173/`: every route walked, console free of errors and warnings, screenshots listed above.

### State at the end of this follow-up

- Branch `main`, HEAD still `002ac74`, nothing committed.
- Dev server left running on PID `46939` — it was already running and was not restarted.
- Browser sessions: `ui-check` and `dogfood` (left over from the previous session) were closed; the `cube` session opened for this work was closed at the end.
- Still unverified: anything against the owner's physical cube, and the multi-auditor dogfooding council.
