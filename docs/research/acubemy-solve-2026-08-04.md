# acubemy solve-pipeline reverse-engineering — 2026-08-04

Scope: scramble tracking, solve start/stop, stage segmentation, case recognition, analysis metrics, move notation.
Source: `/tmp/refs/acubemy/*.js` (34 minified Next.js chunks + `index.html`), read-only, pretty-printed locally by splitting on `;` (no deobfuscator/sourcemaps available). Method note: acubemy's own low-level cube-state math (facelet/permutation ops) lives in webpack module IDs 2268, 79112, 48078, 17484, 69324, 72934, 49926, 55587, 85350 inside chunk `7839-82bec37ab48c7b59.js` (1.3MB vendor/logic chunk) and `8107-9a6fe2da10bee084.js`; UI/data wiring lives in `8122-a01019da8834d031.js` (solve detail page) and `7563-8522c4e7a4653250.js` (settings page).

**Licence note: acubemy is closed-source and its bundle is not licensed for copying. Everything below is a description of observed *behaviour and algorithm shape*, inferred from reading the shipped code — no acubemy source is reproduced or proposed for reuse.**

---

## 1. Scramble tracking

**Finding: acubemy does not appear to do live cube-state-vs-target-scramble verification at all.** Extensive search (`diverg`, `mismatch`, `wrongMove`, `invalidMove`, "off script", `expectedMove`, `targetState`) across all 34 chunks returned zero hits. What *is* present, in `7563-8522c4e7a4653250.js` (settings page) and mirrored in the settings-store defaults in `7839-82bec37ab48c7b59.js`:

- A "Hand Scramble" settings section with:
  - `showHandScrambleDoneButton` (default **true**) — quoted: `'Show "Done Scrambling" button'` / `"Display a button to finish hand scrambling and start solving"`.
  - `enableF4FinishScramble` — a **physical gesture**, not a state check: `"Allow performing an F4 move (front face repeated 4 times) to finish hand scrambling"`.
  - `enableAutoReady` (default **false**) + `autoReadySeconds` (1–10s slider) — `"Automatically finish hand scrambling after a period of no moves"`. This is an **inactivity timeout**, not a solved-state match.
  - `playReadySound` — `"Play a sound when hand scramble is finished and ready to solve"`, gated on the same manual/timeout signal.
- A "Reset & calibrate" hint in the playground: `"Open this menu to reset the cube to its scrambled state or recalibrate the gyro — or use D4 / U4 moves directly"` — resetting to the scrambled state is a manual action (`D4`/`U4` gestures or a menu button), again not an automatic verification loop.

Conclusion: acubemy's product decision is to **never assert live divergence** during scrambling. It trusts the user to signal "I'm done scrambling" via button, `F4` gesture, or silence-timeout, then takes whatever physical state the cube reports at that instant as the accepted start-of-solve state. This sidesteps the entire problem class this app is being complained about for — there is no "wrong move" detector to false-alarm in the first place. Separately, the "Daily Scramble" leaderboard feature (in `page-e272de7b8d2ffa37.js`) does check that a submitted solve's scramble matches the assigned one, but that is a **string equality check on the normalized scramble text** (`r.scramble.normalized().toString()` against a cached map), done to decide leaderboard eligibility after the fact — not a physical-cube divergence check during scrambling.

**What this app does instead:** `src/domain/scramble.ts` (`nextExpectedMove`) and `src/device/capture.ts` (`handleMove` in the `'scrambling'` branch) actively replay every scrambling-phase move against the target algorithm, computing an `expectedMove`/`wrongMove`/`correction` on **every move** and surfacing it live via `CaptureSnapshot`. This is a fundamentally different design from the reference: we are the only side attempting real-time scramble-state comparison at all, and it is exactly this mechanism the owner has flagged as false-alarming on correctly-scrambled cubes.

**Verdict: ours is not "worse-implemented", it is solving a problem acubemy deliberately doesn't solve.** The actionable fix suggested by this reference is architectural, not a bug fix: stop trying to detect scramble divergence live. Replace with a manual "Done scrambling" / accept-current-state affordance (this app already has `acceptCurrentState()` in `capture.ts` — the fix is to make that the primary path and stop emitting `wrongMove` from `nextExpectedMove` during the `'scrambling'` phase, or gate it behind an opt-in "strict scramble check" setting the way acubemy gates its comparatively low-risk features).

---

## 2. Solve start and stop

- **Inspection**: an "Inspection Time Warnings" sound setting (`playInspectionSound`, default true) plays **audio warnings at 8 and 12 seconds** during inspection — `"Play audio warnings at 8 and 12 seconds during inspection time"` (`7563-8522c4e7a4653250.js`). This confirms a WCA-style 15s inspection window with pre-penalty warnings, consistent with our own `inspectionPenalty()` using 15s/17s (+2/DNF) boundaries in `src/device/capture.ts` — we could not find the exact +2/17s DNF cutoff constant in the bundle (it may live in a chunk not covered by this pass, or be applied purely server-side), so this specific boundary is **unverified against acubemy**, not confirmed equivalent.
- **Penalty (+2/DNF) is a manual, post-hoc toggle**, not (as far as observed) an automatic consequence of inspection overrun. In the solve-detail view (`8122-a01019da8834d031.js`) there are explicit buttons: `ariaLabel:"Toggle +2 penalty"` / `ariaLabel:"Toggle DNF"`, wired to `onSetFlag`, flipping a `flag: 'none'|'plus_two'|'dnf'` field on the solve record. We did not find code that auto-derives this flag from elapsed inspection time; it may happen server-side (tRPC) or may simply not exist as an automatic feature — worth treating as an open question rather than assuming acubemy auto-penalizes the way we do.
- **Completion / stop detection**: `validateSolve(scramble, moveSequence)` (module 2268, `8107-9a6fe2da10bee084.js`) applies the scramble then the full solve move list to a fresh `CubeState` and throws `"Cube is not solved"` if `!isSolved({ignoreOrientation:true})`. This is an **AUF-agnostic full-state check**, run as a precondition of building the post-solve analysis (`analyzeCFOPSolve`/`analyzeRouxSolve`/`analyzeZZSolve` all call it first) — i.e. an unsolved capture simply fails analysis generation outright (throws), it does not silently render a garbage partial breakdown.
- **Detailed analysis gating**: analysis (TPS, turns, fluency, stage timing) is only computed at all for `hasReplay` solves (i.e. ones with a full smart-cube move/timestamp/gyro replay). Manual-timer solves show literally `"connect smart cube to see detailed analysis"` instead of any per-stage numbers.

**What this app does instead:** `src/domain/scramble.ts#evaluateScramble(target, actual)` compares full `KPattern` identity (via `cubing/kpuzzle`) — same AUF-*sensitive* full-state-identity philosophy for the scrambling phase, but the solve-completion check in `capture.ts#handleMove` calls `evaluateScramble('', scramble + ' ' + solveMoves)`, i.e. compares against the *solved* pattern, ignoring nothing (full including orientation), which is stricter than acubemy's `ignoreOrientation:true`. Ours never throws/fails on an unsolved-but-plausible-complete state; acubemy's `validateSolve` hard-fails and the UI has no per-stage analysis to show in that case. **Verdict: our completion check is equivalent in spirit (full-state comparison) but slightly stricter (no orientation tolerance) and the +2/DNF-from-inspection-time auto-classification in `inspectionPenalty()` has no confirmed analog in acubemy — theirs looked manual.**

---

## 3. Stage segmentation

This is the most substantively different area, and directly explains why our app "produces suspicious boundaries on real captures."

**acubemy's pipeline (function `h()` inside `computeCFOPReconstruction`, `7839-82bec37ab48c7b59.js`, module ~"CFOP reconstruction"):**

1. `analyzeCFOPSolve(scramble, moveSequence)` (module 79112) does the segmentation by **forward-simulating the cube state move-by-move against 6 candidate faces**, but with a crucial lookahead: it first calls `getFirstSolvedF2LFace(cube, moveSequence)` — quoted:
   ```
   R.getFirstSolvedF2LFace=function(U,R){let L=U.clone();
   for(let U of R.moves){for(let U of y.FACES)if(f(L,U))return U;
   L.applyMove(U.sliceTurn)}throw Error("F2L never solved")}
   ```
   i.e. it walks the **entire** solve forward and returns the first face on which **F2L** (not just cross) fully solves — that face is then used as the fixed cross/F2L target for the whole solve, including retroactively re-deriving the cross segment (`getCrossSolution(cube, moveSequence, thatFace)`). The cross face is thus locked from a stronger, F2L-complete signal, not from the first coincidental cross-only match.
2. Each of cross / 4×F2L-slot / OLL / PLL gets its own `{moveSequence, time}` computed by this simulation (with a "case never reached" throw for OLL/PLL: e.g. `if(!e.isSolved())throw Error("Cube not solved after PLL")`).
3. Separately, a **reconstruction** move list is built by merging gyro-derived cube-rotation events with reported face turns (`mergeCubeRotationsAndMoves`) and compacting it (`compactify`). This reconstruction is the move list actually shown/replayed to the user.
4. Function `h()` then **re-buckets the reconstruction's moves into steps using time midpoints between the simulated stages' start/end timestamps**, not by re-running the state predicates against the reconstruction:
   ```
   let r=e=>{for(let s=0;s<t.length;s++){let n=t[s],M=t[s+1];
     if(M){if(e<=(n.endTime+M.startTime)/2)return{stepType:n.stepType,slotIndex:n.slotIndex}}
     else{if(e<=n.endTime)return{stepType:n.stepType,slotIndex:n.slotIndex};return null}}
     return{stepType:"cross"}}
   ```
   Every move's timestamp is assigned to a stage by which midpoint-bucket it falls in. This **decouples "which stage owns this move" from a single brittle state-predicate hit** and smooths jitter from rotation/regrip moves near a boundary.
5. Fit check: `isCFOPSolve(analysis, threshold=0.7)` (module 49926) hard-rejects (`{valid:false, probability:0}`) if F2L doesn't have exactly 4 slots, or `cross.moveSequence.length>12`, `oll.moveSequence.length>25`, `pll.moveSequence.length>30`. Otherwise it computes a **per-stage Gaussian likelihood** against calibrated means/stddevs (empirically calibrated via `calibrateCFOPGaussianParams`, defaults quoted verbatim: `{cross:7.23, slots:[8.21,8.23,8.26,8.33], oll:9.93, pll:11.8}` mean move-counts, `{cross:3.85, slots:[4.5,4.38,4.28,3.93], oll:4.78, pll:3.58}` stddevs), averages the 6 per-stage Gaussian densities into one probability, and flags the analysis invalid below the 0.7 threshold. A 1-move OLL or an 18-move F2L pair doesn't get a hardcoded reject — it pulls the *specific stage's* Gaussian density down (e.g. a 1-move OLL against μ=9.93,σ=4.78 scores ~0.03) while the *other* stages remain fully weighted, so the confidence penalty is localized rather than applied uniformly to the whole solve.
6. When the confidence is low, or the user simply wants a different method, the UI exposes a manual **method selector ("CFOP" / "Roux" / "ZZ")** (`8122-a01019da8834d031.js`, `eL` dropdown) that calls `onRegenerateAnalysis(method)`, which re-runs `computeAnalysisForMethod` against a **structurally different analyzer** (`analyzeRouxSolve` → FB/SB/CMLL/LSE stages, `analyzeZZSolve` → EOCross/F2L×4/ZBLL) — there is no auto-detection of method, and no visible "doesn't fit any method" fallback beyond the confidence score; a solve that truly doesn't fit CFOP just gets a low-confidence CFOP analysis until the user switches method.

**What this app does instead:** `src/domain/reconstruction.ts#segmentCfop()` also precomputes a `progressByIndex` scan over the whole event stream first (similar spirit), but locks `lockedCrossFace` on the **first** index where `step.reached >= 1` for *any* candidate face — a cross-only signal, not an F2L-complete signal. It then assigns each move to a stage by live re-walking `solveProgress()` per move and cutting the segment the instant `progress.reached > nextStage`, i.e. a hard move-index cut at first-predicate-hit, not a smoothed time-midpoint rebucket. Confidence is a single boolean-ish `plausibleCfop()` check (`cross.moveCount <= 20`) applied uniformly to *all* stages' `confidence` field (either `1` or a flat `0.2`), with no per-stage Gaussian and no OLL/PLL/F2L-slot outlier detection at all — exactly the gap that lets a 1-move OLL or 18-move F2L pair through undetected, since only the cross length is ever checked.

**Verdict: ours is a plausible-but-weaker version of the same idea, and this is likely the direct cause of the "suspicious boundaries" complaint.** Two concrete, low-risk improvements this reference suggests: (a) lock the cross face from an F2L-complete lookahead like `getFirstSolvedF2LFace`, not a first cross-only hit; (b) replace the single `cross.moveCount<=20` heuristic with a per-stage outlier/likelihood check (even a simple z-score against typical move counts per stage would catch the 1-move-OLL/18-move-F2L cases acubemy's Gaussian model catches and ours doesn't).

---

## 4. Case recognition

acubemy: OLL/PLL cases are stored as static tables (`ollCases`, `pllCases` — `69324`/module holding `pllCases`, `72934` for OLL) each with a `lexicographicRanks: number[]` array — e.g. quoted directly from the bundle:
```
{caseIndex:0,type:"Dot Case",name:"OLL 1", setup:"F R' F' R U2' F R' F' R2' U2' R'", lexicographicRanks:[583,576]}
```
(2 or 4 ranks per OLL case; PLL cases similarly, e.g. `{name:"Ua",caseIndex:16,...,lexicographicRanks:[4,12,19,20]}` — 4 ranks for asymmetric perms, fewer for rotationally-symmetric ones like `H` (`[16]`, 1 rank) or `Z` (`[7,23]`, 2 ranks)). Recognition (`getOllCase`, module with `s.getOllCase=function(e,s){let t=m(e,s); return p.ollCases.find(e=>e.lexicographicRanks.includes(t))}`) computes **one** lexicographic rank of the actual last-layer state and does a table lookup; `getPLLCase` explicitly requires cross+F2L+OLL already solved (`throw Error("Cross, F2L or OLL not solved yet.")`) before computing its own rank and lookup.

**AUF is handled by baking all 4 (or fewer, for symmetric cases) AUF-rotated states into the case's rank list at data-generation time** — there is no separate "detect AUF, normalize, then match" step; one rank computation plus one `.includes()` covers all AUF offsets simultaneously.

F2L per-slot case identification (`detectF2LCase`, referenced in `getF2LSolution`, module 2268/55587) has an additional **lookahead fallback**: if the immediately-applied algorithm's resulting state isn't a recognized case, it scans forward through the remaining moves for the first point where the state *is* a recognized F2L case for that slot, rather than giving up.

**What this app does instead:** `src/domain/caseRecognition.ts` builds `orientationIndex`/`permutationIndex` maps once (from each case's algorithm's resulting `KPattern`), keyed by `orientationClassOf`/`permutationClassOf` signatures. Those signature functions (`src/domain/lastLayer.ts`) **already canonicalize over all 4 rotations** by trying all `y`/`y2`/`y'` (and, for permutation, both a pre- and post- rotation) and taking the lexicographically-smallest signature — functionally the same idea as acubemy's "precompute all 4 AUF ranks", just computed on the fly per lookup instead of precomputed once into static data. **Verdict: equivalent design, not worse** — both approaches fold AUF into the canonical key rather than treating it as a separate detection step. Ours recomputes the canonicalization on every recognition call (minor perf cost, no correctness gap); it has no F2L-recognition-lookahead-fallback equivalent to acubemy's `detectF2LCase` retry loop, which is a plausible improvement if F2L slot recognition (not audited by this pass beyond the reconstruction.ts wrapper) is ever asked to identify a case from a slightly-drifted intermediate state.

---

## 5. Analysis surfaced to the user

acubemy shows, per completed smart-cube solve (`8122-a01019da8834d031.js` solve-detail view):
- **Time**, **TPS**, **Turns**, **Fluency%**, **Date**, **Cube/device name**.
- Per-step (cross/F2L-slot/OLL/PLL): **recognition time and execution time**, computed by `getRecognitionTime`/`getExecutionTime` (module 2268, `8107-9a6fe2da10bee084.js`) — a materially more sophisticated split than a flat "first non-trivial move" cut:
  - `EXECUTION_GAP_THRESHOLD_MS = 400`.
  - It walks the stage's moves looking for the first move that (a) isn't "undone" later by a same-slice move that cancels it (`normalizedRotation` sums to 0 mod 4 across the segment) and (b) isn't a probing turn on the face opposite the cross face within the gap threshold (treated as a potential re-orientation/AUF probe rather than real execution) — the recognition/execution boundary is placed at that move's timestamp.
  - There's a debug flag: `"1"===F.env.DEBUG_RECOGNITION` gates verbose `console.log` tracing of this decision (move-by-move "countsAsExecution"/"isOpposite" reasoning) — evidence the authors iterated on this heuristic and needed to debug it directly, i.e. even acubemy considers this a subtle, error-prone computation.
- **TPS** = `extractTPS(turnCount, ms) = turnCount<=0?0:1000*turnCount/ms`, **turnCount** excludes cube rotations (`extractTurnCount`).
- **Fluency%** = `100 - round(sum(gaps > 400ms) / totalExecutionMs * 100)` — one holistic "were you actually turning vs. pausing" percentage, computed from the *first non-rotation move* to the *last move*, not a per-pause list.
- **Chess-style quality tags** (opt-in setting, `showChessTagsInReconstruction`): `["brilliant","blunder","fumble","optimal","spam","predicted","smooth","book"]`, computed by `compareF2LSlotToDatabase` against a "book" (optimal-solution) database per F2L slot.
- **Missing-data handling**: if the solve has no smart-cube replay (`!hasReplay`), the entire analysis panel is replaced with the sentence `"connect smart cube to see detailed analysis"` — no per-stage numbers are fabricated or zeroed.

**What this app does instead:** `src/domain/reconstruction.ts#segmentCfop()` computes `recognitionMs`/`executionMs` via a much simpler `firstNonTrivialMove()`: skip moves on the AUF face and skip adjacent-pair cancelling moves, return the first move that's neither — a single-pass, no-gap-threshold, no "undone later in the segment" check. TPS: `moveCount / (executionMs/1000)` — same shape as acubemy's `extractTPS`, but keyed off *our* execution window rather than acubemy's move-count/total-time. Pauses: we report a discrete `pauseCount` (≥500ms) plus `longestPauseMs`/`After`/`Before`, which is a genuinely richer per-pause breakdown than acubemy's single Fluency% — that part of ours is arguably better/more actionable. **Verdict: mixed.** Our recognition/execution split is a simplified version of acubemy's (missing the 400ms-gap-based "undone" detection, which likely explains occasional recognition/execution splits that don't match intuition on solves with regrips or false starts); our pause reporting is more granular than theirs. Neither app was seen to fabricate metrics for unmeasurable data — ours (`evaluationUnsupported` flag in `capture.ts`) has an analogous "can't evaluate" escape hatch, though ours surfaces it as a boolean flag rather than removing the whole panel.

---

## 6. Move notation

acubemy models moves as structured `SliceTurn` objects (a `slice` identifier + turn amount), not bare strings, with methods `.isCubeRotation()`, `.normalizedRotation()`, `.rotatedBy(rotation)`. Key behaviours:
- **Rotations are tracked via a hybrid of gyro data and the move stream, not either exclusively.** `AccumulatedProximityGyroRotationTracker` + `extractOrientation(qNorm(quaternion))` derive whole-cube-rotation events from live gyroscope quaternions; `mergeCubeRotationsAndMoves(moveSeq, gyroRotations)` interleaves these by timestamp and **re-expresses every subsequent face turn in the corrected frame** via `.rotatedBy(accumulatedRotation.inverse())`.
- There is an explicit **pure-move-stream fallback**: `synthesizeMissingCubeRotations(moves, gyroRotations, rawGyro)` runs when gyro data is absent/unreliable — i.e. rotation derivation from the move stream alone *is* supported, but only as a fallback, not the primary mechanism, for CFOP. For **Roux and ZZ reconstruction the gyro path is explicitly disabled** (`applyGyroSetup:false, allowSliceTurnsWithoutCubeRotation:true` — quoted from `computeRouxReconstruction`/`computeZZReconstruction`), meaning those methods' rotation notation is derived purely from the slice-turn stream, never from gyro. Only CFOP opportunistically uses gyro when available (`o=M&&s.length>0` gate).
- A `"Show Gyro Orientation in Playground/Training"` setting exists, and `"Enable Gyro Drift Correction"` — `"resets the Gyro orientation at the start of every scramble"` — confirms gyro is a live, drift-prone signal that's periodically re-zeroed, not treated as ground truth indefinitely.
- Slices/wide moves: `getMovesToOrientFaceToBottom`, `getRightFace`/`getAdjacentFaces`/`getOppositeFace` and the `SLOTS_FOR_FACE`/`ROUXBLOCKS` tables imply wide and slice turns are represented via the same `SliceTurn` abstraction with a face/slice identifier rather than string-parsed on demand; `f.simplified()` / `.withNormalizedRotation()` (seen in module 55587, `compareF2LSlotToDatabase`) do algebraic simplification (cancel/merge adjacent same-face turns) on `Algorithm` objects before analysis, not on raw move strings.

**What this app does instead:** `src/domain/reconstruction.ts#simplifyRotationEvents()` collapses runs of consecutive `x/y/z` rotation moves via `simplifyRotations()` (string-based, per `src/domain/simplifyRotations.ts`, not audited here) and does not consume any gyro/orientation sensor input at all — this app has no gyro integration in the reconstruction pipeline, so rotation moves are derived **purely from the move stream** (the fallback-only path in acubemy's design). Given this app apparently doesn't have gyro hardware access in scope, that's the correct default, not a gap — but it does mean this app cannot benefit from acubemy's "accumulated proximity gyro rotation tracker" disambiguation for solves where the move stream alone is genuinely ambiguous about physical orientation (e.g., a rotation reported by the cube's own sensor that the move-stream heuristic can't otherwise infer). **Verdict: equivalent for the Roux/ZZ-style pure-move-stream case acubemy itself falls back to; acubemy has an additional gyro-assisted mode this app has no analog for (not necessarily applicable, since it depends on cube hardware/BLE gyro data availability).**

---

## Summary table

| Area | acubemy | This app | Verdict |
|---|---|---|---|
| Scramble tracking | No live divergence detection; manual "Done Scrambling" button / F4 gesture / inactivity timeout | Live per-move `evaluateScramble`+`nextExpectedMove` divergence warning | Different philosophy — ours is the false-alarm source; acubemy avoids the problem entirely |
| Solve stop | Full-state `isSolved({ignoreOrientation:true})`, throws if unsolved; analysis gated on smart-cube replay | Full-state identity match (stricter, no orientation tolerance) | Equivalent-to-stricter |
| +2/DNF | Manual toggle buttons (`flag` field); no confirmed auto-derivation from inspection time | Automatic from elapsed inspection time (15s/17s) | Unverified vs. acubemy — different mechanism, not proven equivalent |
| Cross/F2L face lock | Full-sequence lookahead via F2L-complete face | First cross-only hit during forward precompute | Ours is weaker — plausible root cause of bad boundaries |
| Stage boundary assignment | Time-midpoint rebucket between simulated stage timestamps | Hard move-index cut at first predicate hit | Ours is more brittle to jitter |
| CFOP-fit confidence | Per-stage Gaussian likelihood (calibrated μ/σ), continuous 0–1 | Single `cross.moveCount<=20` check, flat 0.2 confidence | Ours misses OLL/PLL/F2L-slot outliers entirely |
| OLL/PLL case+AUF | Precomputed lexicographic ranks incl. all AUF rotations | Canonicalized signature over all 4 rotations, computed per-call | Equivalent design |
| Recognition/execution split | 400ms gap threshold + "undone move" cancellation detection | First-non-trivial-move heuristic, no gap threshold | Ours is a simplified subset |
| TPS / pauses | TPS + single Fluency% (holistic pause ratio) | TPS + discrete pauseCount/longestPause | Ours is more granular on pauses |
| Unmeasurable data | Whole analysis panel hidden ("connect smart cube…") | `evaluationUnsupported` boolean flag | Roughly equivalent intent |
| Move notation / rotations | Hybrid gyro + move-stream, gyro disabled for Roux/ZZ, drift-corrected | Pure move-stream only, no gyro | Equivalent to acubemy's own fallback path |
