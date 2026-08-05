# Feature lock — 2026-08-05

This is the locked state of the app. **Nothing below may regress.** Every line names the
behaviour, where it lives, and the artifact that proves it. Before reporting any later change as
done, re-run the gates at the bottom and check every row here still holds.

The lock is the commit this document lands in, tagged `feature-lock-2026-08-05`. To get back to
it: `git checkout feature-lock-2026-08-05`.

## Locked behaviour

### Scramble tracking

| Behaviour | Lives in | Pinned by |
|---|---|---|
| A cube that has been turned nowhere reads as being at the start, never "off the scramble" | `src/device/capture.ts` | `src/device/offTrackRecovery.test.ts` |
| A wrong turn gives a SHORT way back — never the whole scramble | `capture.ts`, `SolveRoute.tsx` (no `scrambleRemaining` fallback) | `offTrackRecovery.test.ts`; browser: `OFF THE SCRAMBLE — U'` |
| Undoing your own mistake clears the flag immediately, and following continues | `capture.ts` (`scrambleFollowState`) | `offTrackRecovery.test.ts` |
| A half turn in progress (`R` of `R2`) is not a mistake | `src/domain/scramble.ts#scrambleFollowState` | `src/device/capture.test.ts` |
| Progress and divergence come from the app's own cube state, never a one-shot move walk | `capture.ts` | `offTrackRecovery.test.ts` |
| The app's cube state is never resynced from device `FACELETS` | `CubeConnection.tsx`, `cubedex/moveTracker.ts` | `docs/research/gyst-2026-08-04-state-and-verification.md` — settled, broken three times, do not revisit |

### Solve completion

| Behaviour | Lives in | Pinned by |
|---|---|---|
| The next scramble is armed BEFORE the analysis runs | `CubeConnection.tsx#ensureSharedCapture` | `src/device/turnsDuringCompletion.test.ts` |
| Turns made while the last solve records are kept and applied to the next scramble | `capture.ts#pendingMoves` | `turnsDuringCompletion.test.ts` |
| Reset discards held turns | `capture.ts#reset` | `turnsDuringCompletion.test.ts` |
| The CFOP analysis runs off the main thread | `src/domain/analysis.worker.ts`, `analyseOffThread.ts` | Browser: zero `longtask` entries through a full solve (was one 407 ms block) |

### Coaching surface

| Behaviour | Lives in | Pinned by |
|---|---|---|
| F2L stages carry the case they were | `src/domain/f2lRecognition.ts` | `f2lRecognition.test.ts` |
| Recognition scans forward when the pair is buried at stage entry | `reconstruction.ts#f2lCaseOfStage` | `f2lRecognition.test.ts` |
| OLL/PLL are read off the LAST layer, chosen from the cube, not from a frame | `reconstruction.ts#lastLayerRecognitionInput` | `src/domain/lastLayerRecognition.test.ts` |
| Every F2L row names its slot, and shows the slot's real colours | `SolveAnalysis.tsx`, `src/domain/slotColours.ts` | `slotColours.test.ts` |
| Slot colours come from the cube's own centres (Ao1K's method), not frame algebra | `slotColours.ts` | `slotColours.test.ts` |
| The algorithm offered is a real catalogue algorithm, never the machine's shortest sequence | `betterAlgorithm.ts`, `coachCatalogue.ts`, `stageAdvice.ts` | `coachCatalogue.test.ts`, `stageAdvice.test.ts` |
| Algorithm lookup works without ever opening Training | `coachCatalogue.ts` | `coachCatalogue.test.ts` |
| A stage setup is the POSITION, computed from cube state — never a replay of the history | `reconstruction.ts#setupAlgFor` | `setupAlgFromState.test.ts` |
| Rows with nothing to say do not open an empty panel | `SolveAnalysis.tsx` | Browser |

### Playback

| Behaviour | Lives in | Pinned by |
|---|---|---|
| The cube follows the seek | `SolveAnalysis.tsx`, `Cube3D.tsx` | `docs/evidence/coaching-2026-08-05-seek-move{1,20}.png`, RMSE 0.316 |
| Playback is rotated to the solve's own cross, not a fixed preference | `SolveAnalysis.tsx` | `src/domain/crossDownFrame.test.ts` |
| Clicking a stage highlights THAT stage | `SolveAnalysis.tsx#stageAt` | Browser: F2L 4 click highlights F2L 4 |
| The move strip uses the same condensed notation as the reconstruction, and still scrubs | `reconstructionText.ts#readableTokens` | `readableTokens.test.ts` |
| Playback runs at the solve's real rhythm when it was recorded, and SAYS SO when it was not | `SolveAnalysis.tsx`, `recordCapture.ts#moveOffsets` | `moveOffsets.test.ts` |

### Storage

| Behaviour | Lives in | Pinned by |
|---|---|---|
| Solves older than the analyser are re-analysed on load, keeping their recorded timings | `src/storage/reanalyseSolves.ts` | `reanalyseSolves.test.ts` |
| A solve with no captured moves is skipped, not emptied | `reanalyseSolves.ts` | `reanalyseSolves.test.ts` |
| **Any change to what `segmentCfop` produces bumps `ANALYSIS_VERSION` in the same edit** | `src/domain/models.ts` | Currently `'5'` |

## Known broken, and NOT locked

These are defects at lock time. Fixing them is allowed; making them worse is not.

1. **Last-layer stage boundaries.** A PLL stage can hold 22 moves and an OLL stage 12, because
   the cut lands after the last layer is already finished. On the reco fixture both layers read
   `0123:0123` at the PLL boundary, so "PLL skip" is the honest answer for a wrong boundary. This
   is the largest open defect on the coaching surface.
2. **Two coordinate systems on one row.** Recorded stage moves print in the cube's reported
   frame; case names, slots and suggested algorithms are cross-down. A rename helper was written
   and reverted — renaming is only valid while the frame is constant, and a rotation inside a
   stage moves it.
3. **F2L cases outside the catalogued 41** stay unnamed (a pair buried in another slot). Blank by
   design, never invented.
4. **Nothing has been verified against the physical cube.** Every claim above is the scripted or
   replay path through the real event bus.
5. **A solve whose re-analysis throws is skipped silently**, so it looks identical to one that has
   not been upgraded yet.

## Gates at lock time

```
bunx vitest run --pool=threads --maxWorkers=2     # 111 files, 789 tests passing
bun run build                                      # clean; emits dist/assets/analysis.worker-*.js
```

Machine state: dev server on `http://localhost:5173` (PID 46939, not started by this session),
no browser processes, nothing pushed or deployed.
