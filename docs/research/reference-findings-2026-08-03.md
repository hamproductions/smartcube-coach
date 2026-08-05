# Reference findings — 2026-08-03

Source of truth for behaviour copied from working implementations. Nothing in the app may be invented where a reference solves it.

## Licences (decides what may be copied)

| Repo | Licence | Allowed |
|---|---|---|
| hakatashi/smart-cube-timer | MIT | code and data |
| cs0x7f/cstimer | GPL-3.0 | behaviour/rules only, no pasted source |
| Dave2ooo/F2LTrainer | none declared | design shape only, no data |
| Ao1K/Ao1K_site | none checked | design only |
| cubedex.app, acubemy.com | closed | observed behaviour from shipped bundle |

## cstimer (`cs0x7f/cstimer`)

- `src/js/tools/bluetoothutil.js` `scrHinter.checkInSeq` — scramble progress is tracked by **cube state**, trying 1/2/3 quarter turns of each face against the live state. A cube that reports `U2` as `U`+`U` matches partially then advances. Never compare move tokens.
- `checkScramble` — verification is full-state equality, not string equality.
- `markScrambled` — silently re-syncs a state offset so a manually scrambled cube still starts.
- `src/js/timer.js` — inspection penalty `insTime > 17000 → DNF`, `> 15000 → +2`, derived once at the inspection→solve transition.
- `src/js/timer.js` **timer state machine — copy this, do not invent one.** A single `status` value drives everything: `-1` idle, `-2` armed, `-3` inspection running, `-4` armed during inspection, `0` complete, `>0` solving. Arming is a **timeout** (`pressreadyId = setTimeout(pressReady, preTime)`, default 300 ms) cancelled by `clearPressReady()` on an early release — not a polling tick. Elapsed time is always `now - startTime` and nothing else derives it. ESC resets to idle from any state. **Critically, `lastStop` blocks input while `now - lastStop < 500`**, so a stop key and the next arm press cannot chain into a phantom near-zero solve. This app originally had no such guard and spread its timer state across a phase enum plus refs plus three effects; that is the shape of bug that makes the first solve behave differently from every later one.
- `src/js/stats/stats.js` — penalty encoding keeps raw time and penalty separate (`time[0]` penalty, `time[1]` raw). Never bake +2 into the raw time.
- `src/js/stats/timestat.js` `getNTrim` — 5% trim each side; ao5 drops best+worst; an average is DNF when non-DNF count < size − trim.
- `src/js/timer/giiker.js` — auto-stop uses a per-step completion predicate, not full-scramble diffing.

## smart-cube-timer (`hakatashi/smart-cube-timer`)

- `lib/utils.js` `findCross` — iterates every face, cross is the face whose 4 edges are home (`eo===0 && ep===index`). No reference rotation.
- `lib/SolveAnalyzer.js` `pushMoves` — cross face is found once, stored, and passed unchanged for the rest of the solve. Stage machine checks only the current stage and advances forward.
- `isCfopStageSatisfied` — F2L stages counted by how many of the 4 corner+edge pairs are simultaneously solved; OLL satisfied on full LL orientation; PLL satisfied when permutation equals the `PLL Skip` entry.
- Last layer is read as `getOppositeFace(cross)` in index space — this is why a U-cross solve must not read the U layer.
- `getOll`/`getPll` — AUF handled by rotating the CO/EO arrays 0..3 (and for PLL an extra mod-4 shift), matched against static tables. A skip is a real table entry, never inferred from move count.
- `getInspectionTime` — recognition ends at the **first non-trivial move**: `MoveSequence.getFirstNonTrivialMove` cancels same-face pairs and skips a leading AUF turn.

## F2LTrainer (`Dave2ooo/F2LTrainer`)

- `src/lib/utils/checkF2LState.ts` — slot indices `fr:{edge:8,corner:4} fl:{edge:9,corner:5} br:{edge:10,corner:7} bl:{edge:11,corner:6}`; cross edges `[4,5,6,7]`.
- Case completion judged by **piece permutation/orientation**, not by matching the displayed algorithm — a different solution still counts.
- `src/lib/trainCases.ts` — weighted-random selection: solve-count deficit and recent-time deficit, each capped at +2, combined, capped at 3×, duplicated into a shuffled queue.
- `CaseStatic` shape — per case: `algPool`, `scramblePool`, `ignoreAUF`, category, plus an attribute taxonomy (corner position/orientation, edge position/orientation).
- Drill mode splits recognition (case shown → first non-U move) from execution.

## Cubedex (`cubedex.app`, shipped bundle `assets/index-BwAelGsv.js`)

- Renders with **cubing.js twisty** (174 references) over three.js — same library this app already depends on.
- Drives it through the model API: `experimentalModel.experimentalAddMove(move, {cancel})`, plus `setupAnchor`, `tempoScale`, `catchUpMove`, `jumpToEnd`. The setup alg is an anchor set once — never rebuilt per move. Rebuilding it per move is what makes a live cube view stutter.
- Per-case store: `{practiceCounts, failedCounts, bestTimes, ao5Times, selectedCaseIds, autoUpdateLearningState}`.
- F2L catalogue is per slot: `"F2L 13 - Front Right"`, `"… - Back Left"`.

## Applied in this app

- `src/domain/scramble.ts` — `nextExpectedMove` state walk; `generateScramble` uses `randomScrambleForEvent('333')`.
- `src/device/capture.ts` — `inspectionPenalty`, host-time fallback until the clock fit has two points.
- `src/domain/reconstruction.ts` — per-face cross detection locked for the solve, last layer opposite the cross, first-non-trivial-move recognition, corrected F2L slot pairing.
- `src/domain/statistics.ts` — `bestSingle`, `bestAverageOf`, `inSession`.
- `src/domain/training.ts` — `caseWeights`, weighted-random `chooseTrainingCase`, `caseStats`.
- `src/domain/f2lCases.ts` — 164 generated cases (4 slots), F2LTrainer shape, Cubedex naming.
- `src/components/CubePlayback.tsx` — live moves through the twisty model API.
