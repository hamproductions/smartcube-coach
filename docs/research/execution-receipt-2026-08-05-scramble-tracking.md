# Execution receipt — 2026-08-05, "off the scramble" on a cube that was on it

## Request

A screenshot of the Playground: scramble #29, the cube rendered correct, and an `OFF THE SCRAMBLE` panel listing twenty-one moves under "turn these to get back on the scramble". Reported alongside: a correct turn being called wrong. The same class of defect has been reported repeatedly across sessions.

## Rules violated, named

**The settled cube-state rule was re-broken for the third time.** `docs/research/gyst-2026-08-04-state-and-verification.md` records, with fixture evidence, that the app maintains its own cube state and must **never** resync it from device `FACELETS`; a previous session "fixed" a desync exactly that way and had to revert, and council round 1 found `FACELETS` still seeding the tracked pattern and made it a no-op. Before reading that note this session routed `FACELETS` into the capture session and made it the authority for scramble progress. It was reverted before any further work — no facelet-derived state remains in the capture path.

The trigger was diagnosing from the symptom instead of reading the project's own record of the symptom first. The note names the defect, the rejected approaches, and why each was rejected.

## What was actually wrong

Two independent defects, both in code that judges the solver, plus one that made the page disagree with the session.

1. **The way back could be the whole scramble.** `SolveRoute` supplied `undo: capture.recovery ?? tracker.scrambleRemaining`. `CubedexSolveTracker.scrambleRemaining` is initialised to the *entire target scramble* and is the route to the fully scrambled state. So whenever the short state-derived fix was not found — which is whenever the cube is more than three turns from the matched point, including when it is simply at the start — the app printed the whole scramble as the way "back". Routing to the fully scrambled state is a rejected approach on record ("The way back must be stateless", attempt 2); it had survived in the UI layer. The fallback is deleted: `undo` is now only the short route, and when there is none the panel says "more than three turns off — start a new scramble" instead of inventing an instruction.

2. **One stray packet marked every later correct turn wrong.** `strictScrambleProgress` walked the move list and returned at the first move whose face did not match, with `diverged: true`. It had no way back: once anything spurious arrived — a duplicated packet, a turn from the previous solve landing after the new scramble was issued — the solver was off track for the rest of the scramble and every correct turn after it kept reading as a mistake. Progress and divergence now come from where the cube *is*: the app's own state (solved plus the moves it received, per the settled rule) is compared against the scramble's prefix states. That has no memory of how the cube got there, so undoing a mistake clears the flag immediately. `strictScrambleProgress` is deleted along with its test file.

   A half turn arrives as two quarter turns, so between them the cube is at no scramble position at all. `scrambleFollowState` therefore also accepts a cube part-way through the next move's own face — without that, every `R2`/`F2`/`B2` in a scramble would have flashed "off the scramble" mid-turn, which is worse than the defect being fixed. Caught by an existing test.

3. **The Playground started from an empty snapshot.** `SolveRoute` initialised its capture state to a hardcoded `idle` placeholder and only updated on the next emit, while the capture session keeps running application-wide. Navigating back to the page therefore showed no progress, no panel and an unturned cube until the solver happened to turn again — the page and the session disagreeing, which is what makes a screenshot like the reported one possible even when the engine is right. It now seeds from `ensureSharedCapture().snapshot` and re-reads on subscribe.

## Sources read in full

- `docs/research/gyst-2026-08-04-state-and-verification.md` (23 KB, all sections) — the record that named the rule I had just broken.
- `~/.claude/skills/get-your-shit-together/references/user-demands.md` (26 KB) and this repository's `AGENTS.md`, both re-read earlier the same session.
- `src/device/capture.ts`, `src/domain/scramble.ts`, `src/device/cubedex/solveTracker.ts`, `src/components/solve/SolveRoute.tsx`, `src/components/solve/SolveCockpit.tsx`, `src/device/CubeConnection.tsx`, `src/device/deviceRecorder.ts`.
- The owner's screenshot, which is the artifact the fix is measured against.

## Verification

Browser, real app, no hardware, session `cube`, origin confirmed with `agent-browser get url`:

| Step | Observed |
|---|---|
| Settings → "Scramble then a wrong turn" (drives `R B' R` correct, then a deliberate `U`) | Diagnostics: `scrambling · scramble 4/21` |
| Playground | `OFF THE SCRAMBLE` with exactly one move: `U'` — the inverse of the wrong turn. Before: twenty-one moves |
| Settings → "Replay capture through cube path" with a one-move session (`U'`) | Diagnostics: `scrambling · scramble 5/21` |
| Playground | Panel **cleared**, progress reads `3 / 21 scramble moves` — the three moves genuinely made |

Evidence: `docs/evidence/scramble-2026-08-05-off-track-one-move.png`, `docs/evidence/scramble-2026-08-05-recovered.png`. Console free of errors.

Unit: `src/device/offTrackRecovery.test.ts` (6 tests) pins a cube at the start reading on-track, a wrong turn giving a one-move way back, the flag clearing when the solver undoes it, following continuing afterwards, and a completed scramble never reading off-track. Gates: 106 files / 781 tests passing; `bun run build` clean.

## Explicitly unverified

- Nothing has been tested against the owner's physical cube; all of the above is the scripted/replay path through the real event bus.
- Whether his particular #29 screenshot came from defect 1, 2 or 3 cannot be established from the image alone — all three were live, and all three are fixed.

## The freeze after a solve, and the desync it caused (2026-08-05, later)

Reported: the app lags and drops frames, tracking should not run on the thread that renders;
and separately, it goes out of sync **after a solve**. Both are the same event.

### Measured, not guessed

A `PerformanceObserver` on `longtask` in the running app, while Settings →
"Perform this scramble & solve" drove a full 21-move scramble and its solution:

| Path | Long tasks | Main thread blocked |
|---|---|---|
| Driving 4 moves (tracking only) | none | 0 ms |
| Full scramble + solve, before the fix | 1 | **407 ms** |
| Full scramble + solve, after the fix | none | **0 ms** |

Per-move cost measured separately in node: capture ~0.3–0.8 ms, solve tracker ~0.7–1.3 ms.
Tracking was never the problem; the single block at the end of the solve was.

### What it was

`segmentCfop` — cross-plus-pair searches and last-layer recognition — ran on the main thread
the moment a solve completed, and `ensureSharedCapture`'s completion handler awaited it
**before** issuing the next scramble:

```
await recordCompletedCapture(completed)   // the whole analysis, main thread
await newSharedScramble()                 // only now is the cube re-armed
```

So for the length of that analysis the session sat in `complete`, and `handleMove` discards
turns in that status. A solver is already turning the next scramble by then, so those turns
were dropped and the app disagreed with the cube from that point on — the desync, with the
frame drops as the visible symptom of the same block.

### Fixed

- **Re-arm first, analyse after.** The next scramble is issued immediately; recording follows
  without being awaited.
- **Turns during completion are held, not dropped.** `CaptureSession.pendingMoves` keeps them
  and `setScramble` replays them into the new scramble. `reset()` discards them, because reset
  declares the cube solved — a case the test caught before it shipped.
- **The analysis runs in a worker.** `src/domain/analysis.worker.ts` with
  `src/domain/analyseOffThread.ts` in front of it; it falls back to this thread where workers
  do not exist (jsdom) or if the worker dies, so behaviour is identical either way. Both
  `recordCompletedCapture` and the on-load re-analysis use it.

Verified after the change: no long tasks at all during a full driven solve, the solve still
records (IndexedDB read: solves and stages present), and the session reads
`scrambling · scramble 0/21` the instant the solve finishes. Unit cover:
`src/device/turnsDuringCompletion.test.ts`. Gates: 107 files / 783 tests; `bun run build`
clean, and `dist/assets/analysis.worker-*.js` is emitted.

## The recommendation was junk, and why (2026-08-05, later still)

Reported on a row reading `14 moves against an optimal 9 — 5 wasted turns. Shorter: U B U R D F2 R2 F D'`.

Two things were wrong with it, and one thing was not.

**Not wrong:** the suggested sequence *is* expressed relative to the cross. `optimalMoves` comes
from `optimalCrossPlusPairSolution` run on the framed pattern, whose cross is on D, and applying
it to that pattern does solve the pair — checked directly.

**Wrong 1 — it is not an algorithm anybody turns.** The search returns the shortest cross-plus-pair
sequence over all eighteen face turns. `U R2 F R2 F2 U' F` for a pair is optimal and useless as
advice.

**Wrong 2 — it may take apart what the solver already had.** The search tracks only the cross and
the target pair, so nothing stops it destroying a pair that was already in. Following it would
undo the solver's own work.

**Also true, and left alone deliberately:** the recorded stage moves are printed in the frame the
cube reports, while case names, slots and the suggested algorithm are in the segmenter's cross-down
frame — two coordinate systems on one row. A rename helper was written and **reverted**: renaming
is only valid while the frame is constant, and a rotation inside a stage moves it, which an
equivalence test over a real solve caught. Neither remap direction passed, so nothing was shipped.
This remains open and is the honest reason the two sequences do not line up move for move.

**A constrained search was tried and reverted.** Requiring the solution to preserve the pairs
already solved is correct, and it made one test go from 1 s to 12.5 s and the suite exceed ten
minutes — IDA* has to go deeper and exhausts every bound when no preserving solution exists inside
the limit. Not shippable in that form.

**What shipped instead.** The machine sequence is no longer presented as an instruction anywhere:

- The wasted-turn line keeps its measurement (`14 moves against an optimal 9 — 5 wasted turns.`)
  and prints no moves.
- The better-pair line names the pair and what it was worth (`The BL pair was 3 moves cheaper
  here`) and prints no moves.
- The algorithm to actually use comes from the case catalogue via `betterAlgorithmFor`, which is a
  real F2L/OLL/PLL algorithm, on its own line, whenever the case is recognised.

Gates after: 107 files / 783 tests; `bun run build` clean; browser closed, no processes.

## The setup was the history, not the position (2026-08-05, later still)

A stage's SETUP line printed `scramble + every move made before the stage` — around forty
tokens for a mid-solve stage, ending in the solver's own fiddling (`… D F D F' D F D F' D F D'
F'`). It answered "how did I get here" when the question is "put this case in front of me", and
it grew with every wasted turn: two solvers at the same position got different setups.

`retrySetup()` — the history join — is deleted. `segmentCfop` now records `setupAlg` per stage,
derived from the cube state at that stage with `patternToPlayerAlg` (min2phase, inverted), so
the same position always yields the same short alg. Half turns are normalised from min2phase's
`F2'` to `F2`.

`ANALYSIS_VERSION` is `'3'`, so solves recorded before this gain the field on next load through
the existing re-analysis, and that analysis runs in the worker — the extra min2phase solve per
stage never touches the render thread.

Verified in the browser: the F2L 2 row now reads
`SETUP F2 D2 B2 U2 L D2 L' R2 B2 D2 L' B2 D' R' B' D' L' B D` — nineteen state-derived moves in
place of the forty-token replay, and it appeared on a solve that had been stored under the old
version, after one reload. Evidence: `docs/evidence/coaching-2026-08-05-setup-from-state.png`.

Unit: `src/domain/setupAlgFromState.test.ts` — every stage's setup reproduces that stage's
position (compared with the cube stood upright, because a setup reproduces the position, not the
hold), and is never longer than the history it replaces. Gates: 108 files / 783 tests;
`bun run build` clean.

## Slot colours: the wrong approach, and the reference that has the right one (2026-08-05)

Asked to colour the slot properly and to rotate the playback cube to the cross colour.

**The rotation is done and verified.** The segmenter already records, per stage, the rotation
that takes the solve cross-down. The breakdown player now uses that instead of the configured
hold — a colour preference cannot know which cross THIS solve used. `crossDownFrame.test.ts`
asserts the recorded frame really does put the four cross edges in the D layer on a real solve.

**The colours are NOT done, and nothing was shipped.** `slotColours.ts` derived a slot's two
colours by pushing its frame label (`FR`, `BL`) through the frame's rotation permutation. It
rendered — green/red on one row, green/orange on the next — but a ground-truth check, comparing
against the slot each stage physically solves, could not identify that slot at all, so the
colours could not be confirmed. A wrong colour on a coaching row is worse than no colour, so the
swatches and the colour naming were pulled back out. The module stays, disabled, carrying the
reason.

**The reference has it, and the approach differs in kind.**
`Ao1K_site/composables/recon/SimpleCubeInterpreter.tsx#getF2LPairDirections` (line 2047): take
the cross colour from the cube state, look the slots up in a table keyed by cross colour where
each slot carries its own `slotColors` pair, and map those through the cube's actual colour
scheme (`mapEffectiveColorToActual`, `effectiveColorToDirection`). No frame algebra anywhere — a
pair is identified by which two colours it is, which is the same answer however the cube is held.
That is why the frame-permutation approach kept failing to verify: it was answering a different
question. The port is the next step and is not started.

This is the second time this session that reaching for the reference first would have skipped the
wrong path entirely.

Gates: 110 files / 787 tests; `bun run build` clean.

## OLL and PLL were being read off the wrong layer (2026-08-05)

Reported: `OLL · OLL skip` with 12 moves in it, `PLL · PLL skip` with 22.

Measured on the reco.nz solve, at the OLL stage entry, from the raw pattern stood upright:

```
D-cross edges home: false | U-cross edges home: true
orientU: 0000:0000   <- the CROSS layer, solved by definition
orientD: 0021:0101   <- the last layer, a real OLL
```

This solve's cross is on the raw U face. Recognition chose its layer from `lockedCrossFace` and
was ALSO handed a pattern that `toCrossDownFrame` had rotated by `x2` on top of the stage frame
— two compensations for the same thing, and the two stages did not even agree on which side the
cross was. The recogniser ended up inspecting the cross layer, which is solved, so it answered
"skip" for every OLL and PLL of any solve whose cross is not on raw D.

Fixed by taking frames out of it entirely: `lastLayerRecognitionInput` stands the raw stage-entry
pattern upright, calls the layer whose four cross edges are home the cross layer, and recognises
on the other one. `toCrossDownFrame` is gone. The OLL of that solve now reads **OLL 34 City**
instead of "OLL skip", pinned by `src/domain/lastLayerRecognition.test.ts`.

**PLL on that fixture is still reported as a skip, and that one is honest.** At the PLL boundary
both layers measure `0123:0123` — the cube is already permuted, so there was no PLL to name. What
is wrong there is the BOUNDARY, not the recognition: the stage still carries seven trailing moves
on an already-solved cube, which means the cut lands after the last layer is finished. Stage
boundary placement for the last layer is the open defect; a 22-move PLL stage is the same
symptom.

Gates: 111 files / 789 tests; `bun run build` clean.

### The fix did not reach stored solves until the version was bumped

The OLL recognition fix landed without changing `ANALYSIS_VERSION`, which was already `'4'` from
the slot-colour change. Stored solves had been upgraded to `'4'` an hour earlier, so
`reanalyseStoredSolves` skipped every one of them and the rows kept showing `OLL skip` — the code
was right and the data was stale. `ANALYSIS_VERSION` is `'5'`.

**Any change to what `segmentCfop` produces has to bump it in the same edit.** Verified: a solve
stored at `'4'` carrying `OLL skip` re-analysed on the next load and now reads
`version 5 | OLL=OLL 34 City`.
