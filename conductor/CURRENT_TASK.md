# Current task: full UI and UX overhaul

## Scope (owner's goal)
1. Redesign every screen: coherent look, working navigation, no broken UI.
2. Training reorganised around the solving domain; every trainer gets its own user flow, rework and retest.
3. Do what is asked, verified in a real browser.
4. 3D cube properly rendered, smooth.
5. No long wait for a solve result; the scramble must work from the cube's real tracked state.

## Decisions
- Direction: `docs/design/moodboard.md` (acubemy playground target, cubedex case library) and the Kinetic Logic tokens in `panda.config.ts`. `docs/design-system.md` is stale where it conflicts and gets rewritten to match.
- Navigation: Solve, Train, Stats, Study, Settings. Practice and Library are dissolved into Train and Study.
- Trainer flows: `docs/redesign/trainer-flows.md`.
- Cube: own three.js renderer `src/components/cube/CubeRenderer.ts` behind `Cube3D`.
- FACELETS never resync the app's cube state (FEATURE-LOCK). The scramble fix routes from the app's own tracked pattern.

## Done
- Gyro on live cube, pushed `5343bf3`.
- `CubeRenderer` + `Cube3D` rewrite, browser-checked on Playground (local, uncommitted).
- `TrainerHub` takes `trainer` to render one trainer (local, uncommitted).

## Next
- Shell, hash routing and Train hub.
- Rework each trainer against its flow, browser-test each.
- Scramble from tracked state in `capture.ts`.

## Permissions
- Push only when the owner says so in the current turn.
