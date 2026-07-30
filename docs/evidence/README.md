# Runtime evidence

Current public deployment: https://hamproductions.github.io/smartcube-coach/

The public deployment remains the pre-correction build until the current `main` push and Pages workflow complete. Do not use the old public UI as proof of the corrected product.

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
