# Current task: full UI and UX overhaul

## Scope (owner's goal)
1. Redesign every screen: coherent look, working navigation, no broken UI.
2. Training reorganised around the solving domain; every trainer gets its own user flow, rework and retest.
3. Do what is asked, verified in a real browser.
4. 3D cube properly rendered, smooth.
5. No long wait for a solve result; the scramble must work from the cube's real tracked state.

## Decisions
- Direction: `docs/design/moodboard.md` (acubemy playground target, cubedex case library) and the Kinetic Logic tokens in `panda.config.ts`. `docs/design-system.md` is stale where it conflicts and must be rewritten to match.
- Navigation: Solve, Train, Stats, Study, Settings with hash routes (`src/app/route.ts`). Practice and Library are dissolved.
- Trainer flows: `docs/redesign/trainer-flows.md`; one view file per trainer in `src/components/train/views/`.
- Cube: own three.js renderer `src/components/cube/CubeRenderer.ts` behind `Cube3D` (props setupAlg, viewRotation, size, gyro, highlight). CubePlayback uses it too.
- FACELETS never resync the app's cube state (FEATURE-LOCK). Scrambles route from the app's own tracked pattern.

## Done (local commits, not pushed; pushed head is 5343bf3)
- Shell, routes, Train hub, cube renderer (6f90399); routed scramble fix (fbb2957); Solve rebuild (728dc0e).
- Trainers: Cross to pairs (4afb522), Plan the cross (dceb5b4), Turn pacer (b87a1af), Solve checklist + WebGL context release (af404b6), look-ahead four with piece highlight (63381d1), playback on new cube (fa34870).

## In progress (agents, uncommitted)
- Algorithm cases + Time attack: `src/components/train/cases/`, port 5211, session `cases`.
- F2L on the cube + Free pair: `src/components/train/f2l/`, port 5213, session `f2l`.
- Stats, Solve breakdown, Study, Settings: port 5214, session `pages`.
- Memo (blindfold): `src/components/train/bld/`, port 5215, session `bld`.

## Next
- Review and commit each agent's output after checking it in the browser myself.
- Retire the old panels in `TrainerHub.tsx` and its tests once every trainer has its own view.
- Rewrite `docs/design-system.md` to the shipped system; full test suite, build, then ask to push.

## Permissions
- Push only when the owner says so in the current turn.
