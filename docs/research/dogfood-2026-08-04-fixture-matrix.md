# Dogfood — every recorded session replayed through the running app, 2026-08-04

Method: ground truth is computed from each fixture independently of the app — every `MOVE` event is applied to a solved `KPattern`, and the first index reaching the WCA scramble state and the first later index reaching solved are recorded. The app is then driven at `http://127.0.0.1:5173/` (Live Solve → `Replay a recorded device session`) and its output compared against those numbers. The app never supplies its own ground truth.

## Ground truth

| Fixture | Move events | Reaches scramble at | Reaches solved at | Solve length |
|---|---|---|---|---|
| `…06-59-08` | 298 | never | never | — |
| `…06-59-11` | 298 | never | never | — |
| `…08-23-59` | 195 | never | never | — |
| `…08-31-36` | 302 | 217 | 301 | 84 |
| `…08-43-11` | 150 | never | never | — |
| `…08-56-22` | 102 | 36 | 101 | 65 |
| `…09-56-18` | 116 | 35 | 115 | 80 |
| `…16-06-14` | 160 | never | never | — |

Three of eight contain a completable scramble→solve cycle. The other five never reach the target scramble from a solved cube, so no timing or analysis is possible from them — see "Sessions with no solve" below.

## Replayed in the running app

| Fixture | Scramble moves | Solve moves | Timer | Stage breakdown | Verdict |
|---|---|---|---|---|---|
| `…08-56-22` | 37 (truth 37) | 65 (truth 65) | 22.999 s | Cross 8 · F2L 12/12/10/9 (BR, FL, FR, BL) · OLL skip 1 · PLL Ab Perm 13 — sums to 65 | **PASS** |
| `…09-56-18` | 36 (truth 36) | 80 (truth 80) | 20.217 s | Cross 7 · F2L 16/4/18/10 (BR, FR, BL, FL) · OLL 25 Anti-Bowtie 9 · PLL Gc Perm 16 — sums to 80 | **PASS** |
| `…08-31-36` | 218 (truth 218) | 84 (truth 84) | 25.605 s | Cross 8 · F2L 12/7/10/12 (FL, FR, BR, BL) · OLL 32 Anti-Couch 17 · PLL Ra Perm 18 — sums to 84 | **PASS** |

Move counts, scramble/solve split and stage sums match ground truth exactly in all three. The saved move list for `…08-56-22` was additionally compared byte-for-byte against the fixture's own moves 37–101.

## Defects this pass found and fixed

**1. Saved solves had no stages at all.** `finalizeSolve` rebuilt the solve's move list from persisted raw events filtered on a `phase` tag, and that tag was computed from the capture status read *before* the tracker ran. The move buffer resolves on a 100 ms window, so the solve's opening turns were credited to the scramble; the reconstructed list did not solve the scramble, `segmentCfop` never reached the cross, and it returned nothing. Fixed by taking the move list from `CubedexSolveTracker.solutionTimeline()` — the exact resolved stream the tracker itself counted as the solve — and by moving the displayed scramble/solve split onto the tracker's resolution.

**2. Two-look solves were discarded.** `…08-31-36` produced seven correct stages but the app rejected them: *"This solve does not break into CFOP stages, so it is left out of your averages."* The per-stage plausibility bounds budgeted only one-look algorithms (OLL `generous: 15`, PLL `generous: 21`), so a 17-move OLL and an 18-move PLL scored the implausibility floor. A 20–30 second solver two-looks both stages, so the bound was discarding exactly the solves this app exists to coach. Recomputed from this repo's own `algorithmCatalogue.ts` using the same methodology already documented there, extended to the two-look path: two-look OLL = max EOLL (12) + max OCLL (11) = 23; two-look PLL = max corner perm (18, E) + max edge perm (10, Z) = 28.

**3. `My cube is solved` did not fix an uncalibrated cube.** It reset the facelet reconciler, the live cube and the hardware, but never the solve tracker — whose pattern is seeded at solved and never resyncs from facelets by design. After pressing it the model stayed wrong, so the scramble could still never verify. It now reseeds the tracker with the current scramble.

**4. Wide and slice notation crashed the move tracker.** `patternToFacelets` rejects a pattern whose centres are not in the solved frame; the tracker called it without `fixOrientation`, unlike every other call site in `domain/cubedex/scramble.ts`. A smart cube never sends such moves, but this app's own OLL/PLL catalogue does through the software simulator.

## Sessions with no solve

Five fixtures never reach the target scramble from a solved cube. `…16-06-14` was examined in full: its 160 moves reach neither the scramble nor solved in any of the 24 cube orientations, while the cube's own facelet reports agree with all 160 moves — 161 snapshots cross-checked, zero mismatches. The recording is sound; the assumed starting state was not. The cube was not physically solved when the session began, and this app's solve tracker seeds its model at solved by design (see the header of `src/device/cubedex/solveTracker.ts` for why seeding from device facelets is worse — the QiYi's first reported facelets on connect is stale, which `…08-56-22` proves by tracking perfectly from solved despite an identical wrong opening string).

The supported recovery is the `My cube is solved` control, which issues the protocol's `REQUEST_RESET` where the cube supports it (`capabilities.reset` in `smartcube-web-bluetooth`) and now also reseeds the tracker. These five recordings cannot be repaired after the fact; they are retained as fixtures for the uncalibrated-start case.

## Reproduce

```bash
bun run dev
AGENT_BROWSER_ARGS="--use-mock-keychain,--password-store=basic,--mute-audio" \
  agent-browser --session cube open "http://127.0.0.1:5173/"
agent-browser --session cube get url          # MUST be 127.0.0.1:5173
agent-browser --session cube upload "input[type=file]" \
  src/device/fixtures/user-sessions/cube-session-QY-QYSC-S-23C0-2026-08-03T08-31-36.json
agent-browser close --all                     # when finished
```
