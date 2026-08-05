# Runtime evidence

Current public deployment: https://hamproductions.github.io/smartcube-coach/

**This index describes the 2026-07-30 correction pass and is older than the working tree.** The 2026-08-03 session added the device session harness, connection self-test, CFOP case and slot recognition, route comparison and the redo surfaces; none of that is committed or deployed, so the public URL does not contain it. The current, accurate capability list is `docs/feature-status.md`, and the defect-by-defect record is `docs/research/execution-receipt-2026-08-03.md`.

No evidence anywhere in this repository was produced by a physically paired smart cube.

## Corrected build evidence

| Workflow | Evidence layer | Result | Limitation |
| --- | --- | --- | --- |
| First run | Production Pages artifact in `agent-browser`, fresh origin | Rendered `Smart Cube Coach`, `No solves yet.`, zero local records, no sample AO12, no demo telemetry | Screenshot was captured before the final phase/trainer patches; those patches do not alter first-run presentation |
| Training scramble | Production Pages artifact in `agent-browser` | Generated a 25-move training scramble immediately after replacing the deadlocking random-state worker path | Random-move training scramble, not WCA random-state |
| Simulator capture | Production Pages artifact plus IndexedDB readback | Persisted 1 solve, 50 phase-separated raw events, and solve-linked events | Simulator proves software behavior only |
| Today/history | Production Pages artifact in `agent-browser` | Persisted solve rendered with 3D replay and no fabricated finding or prescription | Simulator inverse solve is not valid coaching evidence |
| Stage timing | Integration test | Recognition values are constrained to the solve duration after clock-domain repair | Heuristic CFOP segmentation remains partial |
| Trainer grading | Component test and production artifact | Hidden drill case no longer renders target algorithm before recognition; typed correct/incorrect attempts persist | Starter case coverage only |
| Reconstruction editor | Component test and production artifact | Starts blank; valid saved revisions retain immutable source-event links | Autocomplete is small and not state-aware |
| reco.nz study | Integration test and bundled attributed fixture | Solve 13444 parses, persists, and supports study playback | Arbitrary GitHub Pages imports are unavailable |
| Backup | Integration test | Schema-v4 export/import round-trip passes | Browser download picker was not re-dogfooded after correction |

## Current screenshot

- `smart-cube-coach-first-run.png` — corrected first-run empty state with no fabricated telemetry.

## Coaching surface, 2026-08-05 (local dev server, not deployed)

Captured from `http://localhost:5173/` against a working tree that is not committed or deployed. The solve in these shots is the bundled reco.nz reconstruction 13444, segmented by the app's own `segmentCfop` and written to the app's own repositories; no smart cube was involved.

- `coaching-2026-08-05-breakdown.png` — solve breakdown with F2L case names on the stage rows and the expanded better-pair line.
- `coaching-2026-08-05-seek-move1.png` / `coaching-2026-08-05-seek-move20.png` — the playback cube at the first and last move of the same solve, cropped to the player's own rect. RMSE 20718.9 (0.316).
- `coaching-2026-08-05-hold-white-top.png` / `coaching-2026-08-05-hold-yellow-top.png` — the same finished solve with the Settings top colour set to white and to yellow. RMSE 12480.7 (0.190).
- `coaching-2026-08-05-player-and-rows.png` — clicking the F2L 4 row highlights F2L 4 (it used to highlight F2L 3), the move strip in the player uses the same condensed notation as the reconstruction, and the transport is labelled `REAL SPEED` because that solve carries per-move timings.
- `coaching-2026-08-05-algorithms-on-rows.png` — a stage row carrying both the case's algorithm and the shorter solution, captured with the stored algorithm catalogue emptied first, on a solve whose stages were written in the old format and upgraded by the on-load re-analysis.

All screenshots from the mocked `Vector` deployment were deleted because they were misleading and stale.

## Latest automated gates

- `bun run test`: 22/22 tests, 14/14 files passed.
- `bun run typecheck`: passed.
- `VITE_BASE_PATH=/smartcube-coach/ bun run build`: passed.
- Build warning: several `cubing` chunks exceed 500 kB; this is a performance warning, not a failed build.

## Hardware boundary

No physical smart cube was available. The following are unverified:

- Bluetooth permission and GATT pairing
- supported model/protocol compatibility
- physical battery, facelet, gyro, and cube-clock reports
- disconnect and reconnect recovery
- packet-loss behavior
- physical scramble verification
- physical solve timing accuracy

See `../feature-status.md` for the complete working/partial/unverified/not-implemented matrix.
