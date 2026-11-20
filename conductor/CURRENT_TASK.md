# Current task: coaching from the last 1000 acubemy solves

## Scope
1. Pull the owner's latest 1000 solves from acubemy with every field.
2. Analyse every data point; delegate everything mechanical to subagents.
3. Write conservative, evidence-backed coaching. Target: sub-10, and every available improvement on the way.

## State: delivered, uncommitted
- Report: `docs/coaching/acubemy-1000-2026-11-20.md`. Evidence tables: `docs/coaching/tables/` (overview, cross, f2l, f2l-cases, ll, turning, three worst-lists).
- Scripts: `scripts/acubemy/pull.py` (needs `ACUBEMY_CREDS` = path to a two-line email/password file and `ACUBEMY_FIREBASE_KEY` = the web API key from acubemy's site bundle), `scripts/acubemy/analysis/{overview,cross,f2l,ll,turning}.py`, run as `python3 -I <script>`; they read and write `data/acubemy/` (override with `ACUBEMY_DATA`).
- Data: `data/acubemy/` (raw pull, account export, site bundles, analysis JSON). Git-ignored: it holds a device MAC and account ids.
- Verification: scramble + raw solution replays to solved on 998/998; stage times sum to totals on 998/998; headline numbers recomputed independently from raw; an independent fact-check of the report against the tables was run and its confirmed corrections applied (notably: with 14 mis-segmented solves removed, cross is 25% of variance and F2L 42%).

## Findings in one paragraph
Mean 19.27 s, 73 moves, 6.1 turns per second while turning, 7.3 s per solve in pauses over 0.5 s. Flat for about 1500 solves. Order of levers: F2L look-ahead, cross planning, F2L case efficiency, last-layer recognition and slow PLLs, rotations, turning accuracy.

## Plan inside the app
- Requirement from the owner: the coaching is delivered inside the main app, not as a standalone page or a list of statistics. The standalone `public/coaching/drills.html` was rejected and deleted.
- `#/train/plan` (`src/coaching/plan.ts`, `src/components/train/plan/PlanPage.tsx`), linked from the top of the Train hub. Twelve drills in four groups; each button opens its trainer preconfigured (`src/coaching/handoff.ts` for one-visit handoffs). Flow written in `docs/redesign/trainer-flows.md`.
- Six stuck-edge F2L cases added to the F2L set (`src/domain/f2lStuckEdge.ts`, seeded through `defaultAlgorithms`).
- Progress comes from the attempts store. Trainers stamp attempts with page-relative `performance.now()`, so `repositories.attempts.put` now adds wall-clock `recordedAt`; the plan counts from that.
- Verified in a headed browser with the recorded GAN i4 (`?replayCube=gan4`) and scripted turns through the real tracker: plan, F2L trainer with 6 of 173 cases, setup tracked, pair solved, verdict, and "2 clean of 2 today" back on the plan. PLL drill, PLL time attack, OLL recognise and cross goal launches also checked. 1440 and 390: no console errors, no overflow. Suite 832/832, typecheck clean.
- Text version of the drills: `docs/coaching/drills.md`.

## Device: connect without a MAC prompt
- Owner's report: solved.no connects with no MAC step. Finding: solved.no ships the same `smartcube-web-bluetooth` library and also ends in `window.prompt`; cstimer prompts too. It only looks prompt-free when the browser delivers advertisement data or a cached MAC exists.
- Change: `src/device/ganMacProbe.ts` derives a `GANi…_XXXX` cube's MAC from its own encrypted packets before any prompt (wired in `webBluetooth.ts`); a remembered MAC that fails is now forgotten. Tests: `ganMacProbe.test.ts` on the library's `GANi4_A26E` capture; full suite 829/829, typecheck clean.
- Unverified on hardware: whether the i4 sends packets before the first command. The capture shows a notification 2 ms after the first write, which suggests the stream was already running. If it is silent, the status line asks for one turn, and after 4 s the old path (prompt) takes over.
- Unknown: the exact failure the owner sees. The header shows the library's message on a failed connect; that text or an exported device session decides the next step.

## Open
- Nothing committed or pushed; owner decides.
- The acubemy password was typed into chat: owner should change it.
- Possible follow-up: import these metrics (pause time, fluency, cross excess, per-case tables) into the app's coaching view. Not requested.

## Previous task
- UI and UX overhaul: complete locally, see `docs/HANDOFF_2026-11-04-redesign-and-training.md`. Open item: owner's physical-cube verdict.
