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
- Full suite 820/820 at `e9f931d`.
- Performance: with 1500 stored solves a simulated solve shows its result ~55 ms after the last move; worst frame 20 ms.
- Results page (`e9f931d`): summary bar, scramble box (copy, reuse), +2/DNF/delete/share, time-based replay with gyro toggle and 5-button transport, grouped reconstruction with Optimal/Speedy/Fumble badges, verdict vs own averages, time-per-step / TPS-per-step / totals charts, step table with HTM/QTM/STM/ETM. Browser-checked at 1440 and 400 with a solve driven through `injectCubeEvent`.
- Gyro re-zeroes when the scramble verifies; the replay uses the same reference (`gyroReference`).
- Off-scramble beyond a 3-turn undo, or a routed cube back to solved, auto-restarts the scramble from the cube's state.

## Next
- Stats page from the owner's reference screenshots: solve-times chart (total/recognition/execution), average CFOP split with goal splits, TPS over solves. No benchmark against other solvers (no data).

## Reviews
- Council 1: 12 findings fixed (`2b1430c`). Council 2: 11 fixed (`2c03b9a`). Council 3: 3 fixed (`77611ed`); its unfinished keyboard and console checks were completed directly: every trainer's keys work, no console errors, every route has 44px targets at 1440 and 390.

- Owner decides when to push; the live site changes only after a push.

## Unverified
- Real GAN cube behaviour after the routed-scramble fix (needs the owner's cube).
- Live gyro re-zero at scramble completion on real hardware (unit-tested; no gyro device in the agent browser).

## Permissions
- Push only when the owner says so in the current turn.
