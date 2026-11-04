# Current task: full UI and UX overhaul

## Scope (owner's goal)
1. Redesign every screen: coherent look, working navigation, no broken UI.
2. Training reorganised around the solving domain; every trainer gets its own user flow, rework and retest.
3. Do what is asked, verified in a real browser.
4. 3D cube properly rendered, smooth.
5. No long wait for a solve result; the scramble must work from the cube's real tracked state.

## State
- All local commits on `main`, not pushed. Pushed head is `5343bf3` (gyro).
- Every screen and all 13 trainers rebuilt and browser-checked; flows in `docs/redesign/trainer-flows.md`.
- Legacy `src/styles.css` and `TrainerHub.tsx` deleted; dead components removed.
- Full suite 820/820.
- Performance: with 1500 stored solves a simulated solve shows its result ~55 ms after the last move; worst frame 20 ms.
- Results page (`e9f931d`): summary bar, scramble box (copy, reuse), +2/DNF/delete/share, time-based replay with gyro toggle and 5-button transport, grouped reconstruction with Optimal/Speedy/Fumble badges, verdict vs own averages, time-per-step / TPS-per-step / totals charts, step table with HTM/QTM/STM/ETM. Browser-checked at 1440 and 400 with a solve driven through `injectCubeEvent`.
- Gyro re-zeroes when the scramble verifies; the replay uses the same reference (`gyroReference`).
- Off-scramble beyond a 3-turn undo, or a routed cube back to solved, auto-restarts the scramble from the cube's state.
- Stats (`f04a3ed`): solve-times chart (total/recognition/execution), average CFOP split with goal = same stage in the fastest fifth of recent solves, turns-per-second chart. No benchmark against other solvers (no data exists).
- Gyro re-zero verified live through the provider with a recorded-session source: tilted cube snaps to the home orientation the moment the scramble verifies.
- Latency at 1507 stored solves: time on screen ~100 ms after the last turn; analysed solve stored 114-165 ms warm, 297 ms for the first solve after load (analysis worker warmed 1.2 s after start; was 615-738 ms cold). Stats renders 1501 solves in 152 ms. No long tasks during a solve.
- 3D cube: 27 animated turns at ~9 tps, 224 frames, p99 16.8 ms, zero frames over 33 ms.
- Sweep of all 18 routes (5 sections + 13 trainers) at 1440 and 400: no console errors, no horizontal overflow, no target under 44 px, nav marks the current section; every page has an h1.
- Trainer rounds replayed in the browser: pair/piece tracking, edge orientation, hidden colours, free pair, plan the cross, memo all start, judge an answer, show the correct one, and update the session strip.
- Cube trainers played end to end with a scripted cube on the real provider and tracker path (moves remapped for the yellow-top hold): F2L on the cube (setup, recognise, solve, split timing), Cross to pairs (scramble, inspection, timed cross, shortest cross, history), Algorithm cases (state-verified setup, recognition and execution, per-case stats), Time attack (two cases against targets, results, run the misses).

- Training revision (`da70bee`..`3335a5f`), following Cubedex (cloned reference; F2LTrainer was read too and its visible recognition clock is the pattern removed): setups routed from the cube's current state and re-routed after wrong turns; clocks hold at 0.00 until the first turn everywhere (cases, time attack, F2L on the cube, cross to pairs, plan the cross, typed cross plan waits for Start inspection); with a cube connected every trainer uses it (plan the cross turned on the cube, look-ahead turned on the cube, free pair answered by turning, checklist and memo scrambles tracked). Trainer pages have a stage-grouped rail; Train hub leads with the top coaching item; results steps link to trainers. Coaching cards say step, cost, action, trainer and worst solve. All verified with a scripted cube on the real provider and tracker path; sweep of 18 routes at 1440 and 400 clean.
- Hidden colours and the turn pacer are unchanged: hidden colours is sticker knowledge with no cube state to check; the pacer already reads the cube.

## Next
- Full handoff: `docs/HANDOFF_2026-11-04-redesign-and-training.md`. Shipped `688d01f` to Pages; waiting on the owner's physical-cube verdict.
- Owner decides when to push; the live site changes only after a push.

## Reviews
- Council 1: 12 findings fixed (`2b1430c`). Council 2: 11 fixed (`2c03b9a`). Council 3: 3 fixed (`77611ed`); its unfinished keyboard and console checks were completed directly: every trainer's keys work, no console errors, every route has 44px targets at 1440 and 390.

## Unverified
- Real GAN cube hardware: all flows pass on the scripted cube; physical cube confirmation needs the owner's cube.

## Permissions
- Push only when the owner says so in the current turn.
