# Smart Cube Coach: UI/UX redesign and training revision, full handoff, 2026-11-04

Everything required to resume this task without rediscovery. This is not a summary.

# PART I: TASK CONTRACT AND LIVE STATE

## 1. Exact task contract

- **Latest raw user request:** ship, write a handoff, and end the session. Shipping was already done at `688d01f` (see section 2).
- **Standing session goal (owner's stop-hook goal):**
  - Redesign every screen: coherent look, working navigation.
  - Rework training around the solving domain, with a user flow per trainer, retested.
  - Do what the owner asks, verified in a real browser.
  - A properly rendered, smooth 3D cube.
  - No long wait for a solve result.
- **Owner requirements recorded during the session** (neutral restatement; no chat quotes):
  1. Results stay on screen until the next turn.
  2. The gyro shows the correct front.
  3. The results page matches the owner's acubemy and CubeDesk reference screenshots:
     - replay with gyro, slider transport and current-move highlight;
     - which steps went well or badly;
     - reconstruction integrated with the replay;
     - HTM, QTM, STM and ETM counts;
     - step table;
     - recognition and execution split per step;
     - TPS per step;
     - totals.
  4. Stats gains three charts:
     - solve-times chart (total, recognition, execution);
     - CFOP split with goals;
     - TPS over solves.
     - No fabricated benchmark against other solvers.
  5. Scramble flow:
     - Drifting off the scramble restarts it automatically from the cube's state.
     - The gyro re-zeroes when the scramble is verified.
  6. Coaching advice must be actionable: which step, what it costs, what to do, which trainer, and an example solve.
  7. No timer starts on its own; the clock starts on the first turn.
  8. A connected smart cube is always used. Setups start from whatever state the cube is in, following Cubedex. The owner pointed at Cubedex and F2LTrainer as the references.
  9. Trainers must not feel detached; navigation between them must be direct.
  10. Revise all training.
- **Required completion:** the owner confirms the redesign on their physical GAN cube.
- **Explicit non-actions:**
  - Never quote the owner's messages in repo files.
  - No agent attribution in commits.
  - No osascript.
  - No `open` unless asked in the current turn.
  - Do not touch the owner's real Chrome unless asked in the current turn.
  - No outbound reporting.
- **Current-turn authority:** push, deploy and handoff. Push and deploy were authorised this session for this task and are complete.
- **Source-of-truth artifacts and precedence:**
  1. The owner's screenshots and messages in this session.
  2. Reference repos:
     - `poliva/cubedex` is the model to copy.
     - `Dave2ooo/F2LTrainer` was also read. Its visible recognition clock is the pattern this work removed.
  3. `AGENTS.md`.
  4. `docs/redesign/trainer-flows.md`, which holds the three training rules and the per-trainer flows.
  5. `docs/design-system.md`.

## 2. Ground truth: repository and working tree

| Field | Current value | Evidence command/artifact |
|---|---|---|
| Working directory | `/Users/vittayapalotai.tanyawat/code/smartcube-coach` | `pwd` |
| Repository and branch | `hamproductions/smartcube-coach`, `main`, remote `git@gh-personal:hamproductions/smartcube-coach.git` | `git remote -v` |
| HEAD | `688d01fd1ca71914d8afb92f66070b2f9fde1182` (before this handoff commit) | `git rev-parse HEAD` |
| Base/PR state | `main...origin/main` equal after push `5343bf3..688d01f`; no PR (owner's repos commit straight to main) | `git status -sb`, `git rev-list --left-right --count origin/main...HEAD` → `0 0` |
| Deploy | GitHub Pages run `41841640155` on `688d01f`: build success, deploy success; live at https://hamproductions.github.io/smartcube-coach/ | `gh run view 41841640155`; live page showed the trainer rail and a dark colour scheme |
| Pre-existing dirty state | None in smartcube-coach | `git status --short` → empty |
| Task changes | 42 commits `5343bf3..688d01f` plus this handoff | `git log --oneline 5343bf3..HEAD` |
| Untracked artifacts | None in the repo. Scratch files live outside it (section 6). | `git status --short` |
| Ownership uncertainty | The session cwd was `/Users/vittayapalotai.tanyawat/code/LLerNote`, which has its own pre-existing dirty files from unrelated work. They were left untouched and are not part of this task. | the session's git status snapshot |

## 3. Environment and operational rules

- Runtime:
  - `bun` for scripts.
  - `bun run test`, which already caps workers to `--pool=threads --maxWorkers=2`; add no flags.
  - `bunx tsc -b` for typechecking.
  - `bun run build`, which shows a pre-existing chunk-size warning.
- Dev server: `bunx vite --port 5173 --strictPort --host 127.0.0.1`, started from the repo. The one started this session (pid 97926) was stopped at handoff.
- Browser: one agent-browser session named `show`.
  - Prefix every command with `AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio"`.
  - Close it when done.
  - Session `ham-home-repair` is not ours; leave it.
- Cube-free verification harness: inject events through the real provider and tracker path. Scripts are in section 12.
- Known traps:
  - **Shell resets cwd.** The cwd resets to the LLerNote repo after every Bash call, so prefix every call with `cd /Users/vittayapalotai.tanyawat/code/smartcube-coach &&`.
  - **zsh does not word-split unquoted variables.** Use `${=var}` or a function.
  - **Hash-only navigation keeps stale state.** It does not reload modules, so a stale `CaptureSession` singleton survives HMR. Reload after editing `capture.ts`.
  - **Closing the browser session wipes IndexedDB.** It gives a fresh profile.
  - **Git network commands need the sandbox off** (`dangerouslyDisableSandbox: true`) because of ssh keys.
- Disk: about 9 GiB free at last check; run `df -h` before builds.

# PART II: COMPLETE EXECUTION RECORD

## 4. Chronological command and action ledger

The earlier session before compaction is recorded in `conductor/CURRENT_TASK.md` and git history (`5343bf3` and earlier commits). This ledger covers this segment.

| Order | Phase | CWD | Exact command/action | Why | Material output/exit | Safe to rerun? |
|---|---|---|---|---|---|---|
| 1 | results page | repo | Write `src/components/solve/SolveAnalysis.tsx`; `bunx tsc -b` | acubemy-style results | exit 0 | yes |
| 2 | wiring | repo | Edit `HistoryRoute.tsx`, `SolveRoute.tsx`: `history={stages}`, `onDeleted` | verdict needs history; delete flow | exit 0 | yes |
| 3 | charts | repo | Add `StepCharts` (time per step, TPS per step, totals) | owner's CubeDesk screenshots | tsc 0 | yes |
| 4 | tests | repo | `bunx vitest run src/domain/turnMetrics.test.ts src/domain/solveVerdict.test.ts`; `bun run test` | gate | 3/3; 817/817 | yes |
| 5 | off-scramble and gyro | repo | Edit `src/device/capture.ts`: `backToSolved`, `recoveryUnreachable`, `scrambledAt`, `gyroReference`; `CubeConnection.tsx` `restartLostScramble`; `Cube3D` `gyroResetKey` | owner requests | capture tests 28/28 | yes |
| 6 | clock trap | repo | `CubeConnection.tsx`: `raw.localTimestamp ?? raw.timestamp` (was `Date.now()`) | recovered moves mixed clocks, so gyro samples were dropped | 49 gyro samples stored after fix | yes |
| 7 | browser | repo | `drive-solve.js` via `ab eval` (section 12) | real capture path without hardware | solves stored with gyro | yes |
| 8 | results fixes | repo | badge needs turns; skip zero-turn peers in `solveVerdict`; summary metrics from stage tokens; TPS dash for zero execution | defects seen in browser | verified in browser | yes |
| 9 | commit | repo | `git commit` → `e9f931d` | | | n/a |
| 10 | stats | repo | `CoachingHistory.tsx`: SolveTimes, CfopSplit, TurnSpeed; `StageTrendChart` `suffix` and `higherIsBetter` | owner screenshots | `f04a3ed` | yes |
| 11 | gyro live proof | repo | `gyro-check.js` (provider fiber, `sessionSource`) | prove the re-zero | display quaternion equals expected home `[0.13,-0.043,-0.006,0.991]` | yes |
| 12 | sweep | repo | `sweep.js` at 1440 and 400 over 18 routes | console, overflow, targets, h1 | clean after the Solve h1 fix | yes |
| 13 | perf | repo | 1500-solve seed; `drive-latency.js` | scale latency | ~100 ms to the time on screen; cold save 738 ms → 297 ms after `warmAnalysis` | yes |
| 14 | commits | repo | `02468d2`, `bda10eb`, `bbf0e6f` (dark `colorScheme`, Train `PageHeader`) | | | n/a |
| 15 | coaching | repo | Rewrite `coachInsights.ts` (recognitionShare, moveEfficiency by family, action/trainer/example); `InsightCard.tsx` | owner screenshot | `09f46d5` | yes |
| 16 | cross clock | repo | `CrossF2lPractice.tsx`: main clock 0.00 until the first turn | owner report | browser: 0.00 for 2.5 s, then 1.24 after a turn | yes |
| 17 | references | scratch | `git clone --depth 1 https://github.com/poliva/cubedex.git`, `.../Dave2ooo/F2LTrainer.git` into the scratchpad `refs/` | owner said to look at them | read by two Explore agents | yes |
| 18 | cases routing | repo | `caseState.ts`: `toHoldFrame`, `routeToCase`; `useCaseAttempt.ts`: live hold-frame pattern, reroute; `CaseSession.tsx`: SetupPrompt, Ready, LastResult; `TimeAttack.tsx` | Cubedex parity | `routeToCase.test.ts` 3/3; browser proven | yes |
| 19 | F2L drill | repo | `useF2lDrill.ts` `routeFromHere`; `F2lCubeDrill.tsx` static 0.00 until the first turn | | browser: Ready 0.00 for 2 s, then Solving | yes |
| 20 | cross plan cube | repo | `CrossPlanOnCube.tsx`; `crossPlan.ts` `optimalCrossFrom` | owner request | browser: stopped at the cross 4.41 s; verdict shown | yes |
| 21 | nav | repo | `TrainerPage.tsx` rail and phone chips; `TrainHub.tsx` focus insight; SolveAnalysis per-step Train links | detached trainers | `da70bee` | yes |
| 22 | checklist and memo | repo | `CubeScramble.tsx`; `NotimerPractice.tsx`; `MemoTrainer.tsx` | cube use | `39d8e26` | yes |
| 23 | look-ahead | repo | `LookaheadDrill.tsx` cube-start and cube-turning phases | cube use | `f5dfb27` | yes |
| 24 | free pair | repo | `useCubeFreePair.ts`; `FreePairDrill.tsx` | cube use | browser: turned option 2, verdict Free; `31ebd8d` | yes |
| 25 | typed cross plan | repo | Start inspection button | no auto-start | `3335a5f` | yes |
| 26 | ship | repo | `bun run build`; `bun run test` (823/823); `git push origin main`; poll `gh run view 41841640155` | owner asked to push | success, deployed | no (already done) |

## 5. Methodology and decision record

- **Copy the reference instead of inventing.** This is a project rule (`docs/HANDOFF_2026-08-04-smartcube-port.md`, Decision 1). Cubedex is followed for case setup and timing:
  - Setup is routed from the current state (`src/lib/scramble.ts:208`, `getGuidanceMoves`).
  - The route is recomputed after a wrong turn (`useScrambleState.ts:171-186`).
  - The timer is READY at 0 and starts on the first move (`useTrainingState.ts:1484, 2161`).
  - Recognition is the time from reveal to the first move (`:2153-2160`).
  - The next case follows immediately after a solve (`:2318-2327`).

  F2LTrainer was rejected for timing because it starts a visible recognition timer when the case appears (`TrainDrill.svelte:318-322`).
- **Time attack clock.** Cubedex starts time-attack timing immediately (`startTimerImmediately`). This app deliberately does not: the owner's rule that nothing starts on its own takes precedence, so time attack also starts on the first turn.
- **Hold frame.** `toHoldFrame(puzzle, physical, rotation)` conjugates by the hold rotation. The test pins that a physical `R` under `z2` equals a held `L`. Preserve this when touching any routed setup.
- **Free pair matching.** Options contain rotations and wide moves that a smart cube cannot report. The answer is therefore matched by normalised state (`reorientToSolvedCenters`) against each option's final state.
- **Coaching saving estimates come only from the owner's own data:**
  - Recognition: usual minus best-quartile recognition.
  - Turns: extra turns multiplied by own ms per turn.
- **CFOP goal is own data.** It is the same stage in the fastest fifth of recent solves. No external benchmark is used because no data for it exists.
- **Hidden colours and the pacer are unchanged.** Hidden colours has no cube state to verify; the pacer already reads the cube.

## 6. Files and artifacts

| Path/URL/ID | Role | Exact change | Verification | Ownership | Resume instruction |
|---|---|---|---|---|---|
| `src/components/solve/SolveAnalysis.tsx` | results page | full rewrite: summary, scramble box, replay with gyro, grouped reconstruction, verdict, StepCharts, StepTable, per-step Train links | browser at 1440 and 400 | task | keep the layout |
| `src/domain/turnMetrics.ts`, `solveVerdict.ts` (+tests) | metrics and verdict | new | tests pass | task | |
| `src/device/capture.ts`, `CubeConnection.tsx`, `recordCapture.ts`, `src/domain/models.ts` | capture | gyroReference, scrambledAt, divergence flags, auto restart, clock fix, warmAnalysis call | capture tests and browser | task | |
| `src/domain/analyseOffThread.ts` | analysis worker | `warmAnalysis()` | cold first analysis 461 → 35 ms | task | |
| `src/components/history/CoachingHistory.tsx`, `StageTrendChart.tsx`, `InsightCard.tsx`, `src/domain/coachInsights.ts` | stats and coaching | new sections and card | browser | task | |
| `src/components/train/cases/{caseState.ts,useCaseAttempt.ts,CaseSession.tsx,routeToCase.test.ts,Cases.test.tsx}`, `views/TimeAttack.tsx` | case trainers | routed setup, Ready, LastResult | tests and browser | task | |
| `src/components/train/f2l/{useF2lDrill.ts,F2lCubeDrill.tsx,useCubeFreePair.ts,FreePairDrill.tsx}` | F2L trainers | routing, static clock, cube answers | browser | task | |
| `src/components/train/views/{CrossPlan.tsx,CrossPlanOnCube.tsx}`, `src/domain/crossPlan.ts` | cross plan | cube mode; typed mode waits for Start | browser | task | |
| `src/components/practice/CrossF2lPractice.tsx` | cross to pairs | clock 0.00 until the first turn | browser | task | |
| `src/components/train/{TrainerPage.tsx,TrainHub.tsx,CubeScramble.tsx,useRoutedScramble.ts}`, `lookahead/LookaheadDrill.tsx`, `ao1k/NotimerPractice.tsx`, `bld/MemoTrainer.tsx` | navigation and cube use | rail and chips, focus insight, routed scramble panel, look-ahead on the cube | browser | task | |
| `panda.config.ts` | global CSS | `html: { colorScheme: 'dark' }` | computed style is dark | task | |
| `docs/redesign/trainer-flows.md` | spec | three rules; cross plan and case setup flows rewritten | read | task | keep it in sync with behaviour |
| `conductor/CURRENT_TASK.md` | live task record | state replaced in place | read | task | update in place |
| Scratchpad `/private/tmp/claude-502/-Users-vittayapalotai-tanyawat-code-LLerNote/e2e83507-bec9-4e01-a354-9e3769036c39/scratchpad/` | harness scripts and screenshots | `drive-solve.js`, `drive-latency.js`, `gyro-check.js`, `cube-helper.js`, `sweep.js`, `refs/{cubedex,f2ltrainer}` | used this session | task, transient | outside the repo and will not persist; recreate from section 12 |
| https://hamproductions.github.io/smartcube-coach/ | live app | deployed `688d01f` | live rail checked | | |

# PART III: EVIDENCE, FAILURES, AND HONESTY

## 7. Verification matrix

| Requirement/claim | Required layer | Evidence | Result | Unverified |
|---|---|---|---|---|
| Results page per the references | browser | screenshots at 1440 and 400; replay seek, play and step via eval | pass | real GAN solve |
| Gyro replay and re-zero | browser, real provider | 49 samples stored; `gyro-check.js` equals expected home | pass | physical gyro |
| Off-scramble auto restart | browser | a fourth wrong turn re-routed (`startAlg U R F D`) | pass | physical cube |
| No auto-start clocks | browser | cases, time attack, F2L, cross to pairs and cross plan all held 0.00, then ran after the first turn | pass | physical cube |
| Cube used from any state | browser, scripted cube on the real tracker | routes from scrambled states for cases, F2L, free pair, look-ahead, checklist, cross plan | pass | physical cube |
| Navigation | browser | rail with current item; phone chip centred | pass | owner opinion |
| Coaching actionable | browser | card shows step, cost, action, trainer and worst solve | pass | owner opinion |
| 18 routes clean | browser sweep | no console errors, overflow or small targets; h1 at 1440 and 400 | pass | |
| 3D cube smooth | browser rAF | 224 frames, p99 16.8 ms, 0 frames over 33 ms | pass | physical cube, owner opinion |
| Performance at scale | browser | about 1,507 solves: time on screen ~100 ms; save 114–165 ms warm, 297 ms cold | pass | physical cube |
| Tests | unit | `bun run test` 823/823 | pass | |
| Deploy | CI and live | run 41841640155 success; live page checked | pass | |
| Owner satisfaction | owner | none | **unverified** | the owner's verdict |

## 8. Failures, traps, and rejected approaches

| Item | Symptom | Root cause | Do not repeat / recovery |
|---|---|---|---|
| Gyro missing from stored solve | `gyro` undefined | stale `CaptureSession` singleton after HMR (hash navigation) | reload the page after editing capture |
| Gyro still missing | samples dropped | `localTimestamp ?? Date.now()` mixed with the `performance.now()` gyro clock | fixed to `raw.timestamp`; keep one clock |
| Junk segmentation | one giant "Slot 1" | random simulator seed | use seeds `alpha`, `beta`, `gamma`, `pacing`, `tps-probe` |
| "Off the setup" in the F2L drill | expected behaviour | scripted moves not mapped to the yellow-top hold | map held→physical `{U:'D',D:'U',R:'L',L:'R'}` for the default hold |
| Insight "usual 0.01s" | nonsense comparison | peers with zero-turn stages were included | filtered `moveCount > 0` |
| First save 738 ms | cold worker start | worker and cube library loaded on the first solve | `warmAnalysis` with a real one-move solve, not an empty one (an empty one loads nothing) |
| Case setup invented before the reference was read | owner correction | references not read first | always read `refs/cubedex` first; cite file and line |
| Look-ahead deps | re-subscribing every render | `useRoutedScramble` returns a new object each render | destructure its stable callbacks |
| `sed` with a nested quote in a test title | parse error | shell escaping | use python to edit or avoid apostrophes |

## 9. Known limitations and blockers

- **The physical GAN cube was never run this segment.** Every cube flow was proven with a scripted cube injected into the real provider and tracker. This needs the owner and the physical cube. First action after that: watch for wrong-face mapping on routed setups in a non-default hold.
- **Owner satisfaction is unconfirmed.** This needs the owner's verdict.
- **Hidden colours does not use the cube.** This is by design: there is no state to verify.

# PART IV: RESUME WITHOUT REDISCOVERY

## 10. Immediate next action

Ask the owner for the result of one live session on https://hamproductions.github.io/smartcube-coach/ with the GAN cube:
1. One solve, then open its results.
2. One Algorithm cases round.
3. One F2L on the cube case.

- If a flow misbehaves, reproduce it with the scripted harness at `127.0.0.1:5173`, after starting the dev server.
- If everything passes, the goal is done.

## 11. Remaining ordered work

1. Gather the owner's verdict from the physical-cube session. Fix any reported defect at its root, verify in the browser, commit, and push (push is authorised for this task in this session only).
2. Optional: make the Solve page live cube show the gyro re-zero hint. Not requested.

## 12. Command cookbook

```sh
cd /Users/vittayapalotai.tanyawat/code/smartcube-coach
git fetch origin && git status -sb && git rev-list --left-right --count origin/main...HEAD
bunx tsc -b
bun run test
bun run build
bunx vite --port 5173 --strictPort --host 127.0.0.1   # dev server; check the port first with: lsof -nP -iTCP:5173 -sTCP:LISTEN
AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session show open "http://127.0.0.1:5173/#/train/cases"
AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" agent-browser --session show close
gh run list --workflow pages.yml --limit 1
```

Scripted cube harness: run this in the page via `agent-browser eval`. It connects a session source with no packets, then injects moves.

```js
(async () => {
  const url = (p) => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes(p)).pop() || p
  const cc = await import(url('/src/device/CubeConnection.tsx'))
  const sources = await import(url('/src/device/sources.ts'))
  const host = document.querySelector('main'); const key = Object.keys(host).find((k) => k.startsWith('__reactFiber'))
  let provider; for (let f = host[key]; f; f = f.return) if (f.memoizedProps?.value?.connect) { provider = f.memoizedProps.value; break }
  if (!provider.handle) await provider.connect(sources.sessionSource({ device: { name: 'Scripted cube', protocol: 'test', mac: '' }, events: [] }))
  const faces = 'URFDLB'
  window.turn = async (alg) => { for (const m of alg.split(/\s+/).filter(Boolean).flatMap((m) => m.endsWith('2') ? [m[0], m[0]] : [m])) { const t = performance.now(); cc.injectCubeEvent({ type: 'MOVE', move: m, face: faces.indexOf(m[0]), direction: m.endsWith("'") ? 1 : 0, timestamp: t, cubeTimestamp: t, localTimestamp: t }); await new Promise((r) => setTimeout(r, 120)) } }
})()
```

Simulated full solve (real capture path): call `simulateCfopSolve(seed)` from `/src/domain/cfopSimulation.ts`, then `setSharedScramble(solve.scramble)`. Inject the scramble moves, a GYRO event, then `solve.events` with their gaps.

## 13. Handoff receipt

- Handoff authoring time: 2026-11-04, after deploy run 41841640155.
- Live state checked at: just before writing.
  - HEAD `688d01f`, equal with origin.
  - Tree clean.
  - Dev server pid 97926 (own) on 5173, stopped after writing.
  - Browser sessions: only `ham-home-repair`, which is not ours.
- Sources read:
  - `conductor/CURRENT_TASK.md`
  - `docs/redesign/trainer-flows.md`
  - the reference reports from Cubedex and F2LTrainer, with file and line citations
  - the source files in section 6
- Logs and history ranges read: the current session only.
- Durable notes written: `conductor/CURRENT_TASK.md` and this file.
- Exact verification artifact inspected after writing: this file, re-read; `git status` after commit.
- Explicitly unverified: physical GAN cube behaviour; the owner's verdict.
