# GYST execution receipt 8 — 2026-08-04

## Exact latest request

`/get-your-shit-together`, immediately after being told that acubemy is the best-performing reference and is where effort should go, and then that the **design** must be taken from the references too, not only the logic.

## Rules violated

1. **Do not invent what a reference already solves.** Three times in this session: a bespoke timer state machine while csTimer's was available; an index-based scramble comparator while smart-cube-timer's `MoveSequence` reduction mode existed; and a hand-written state walk in `nextExpectedMove` that threw `Unsupported move: M` because it applied scramble tokens through a move table with no slice support. The third destroyed a real recorded solve in fixture `08-43-11` before it was caught.
2. **Take the whole reference, not a slice of it.** Only logic was being ported. The design — tokens, shell chrome, UI primitives, case-card treatment — was left as this project's own invention even though cubedex is a React + Vite + TypeScript app with the same file structure and an MIT licence.
3. **Verify the artifact, not the report.** Ten agents were editing concurrently and the tree state had not been checked once since they started. Reports were being relayed rather than confirmed.
4. **Over-restrictive licence gatekeeping.** Agents were told to reimplement F2LTrainer and `smartcube-web-bluetooth` behaviour rather than copy it, on a rule this file's own `AGENTS.md` carried. The owner overrode it; `AGENTS.md` now records that reference code may be copied with attribution, so agents stop hitting a wall of my making.

## State locked

- Branch `main`, **178 dirty files**, nothing committed, nothing pushed.
- One dev server on `:5173`; zero browser processes; 14 GB free.
- Reference sources cloned at `/tmp/refs/`: `cubedex`, `ao1k`, `smart-cube-timer`, `f2ltrainer`, `cstimer`, `smartcube-web-bluetooth`, plus 34 acubemy production chunks.

## Corrected action taken

Copying, not inventing. Landed this round, each with an attribution header:

| Module | Source | Verified against |
|---|---|---|
| `sliceRecovery.ts` | smart-cube-timer `MoveSequence.js:107-180`, `utils.js:16-33` | All 7 real captures: 1 461 raw moves, 22 slice collapses, state equivalence held on every session |
| `simplifyRotations.ts` | Ao1K `simplifyRotations.tsx:1-149`, byte-identical | Wired into `segmentCfop`; state equivalence pinned including a 5-rotation run and a run cancelling to identity |
| `ergonomics.ts`, `algSuggester.ts` | Ao1K, byte-identical | Compile clean; wiring reported |
| `moveFrame.ts` | F2LTrainer `moveValidator.ts`, `TrainClassicSmart.svelte` | 78 tests: wide/slice/rotation compensation, double-move buffering, undo guidance |
| `moveParity.ts`, `sliceMoveBuffer.ts`, `movesetMatcher.ts`, `solveDetection.ts` | cubedex `smartcube-parity.ts`, `useSmartcubeConnection.ts`, `useTrainingState.ts` | Matcher reaches final checkpoint on 3 of 4 scramble-bearing captures; correctly never completes on the diverging one |
| Live cube anchor fix | cubedex + Ao1K `TwistyPlayer.tsx:61-67, 733-782` | First setup alg was being shattered token-by-token instead of anchored once — the documented stutter cause |
| Reconciler | vendored QiYi driver contract | Permanent mismatch latch removed; `resync()` is now a true full reset |

Design port from cubedex's `styles/index.css`, `components/shell`, `components/ui`, `CaseCard`, `ToggleSwitch`, `Icons` is dispatched.

## Discrepancy under investigation, not accepted

Cubedex's ported `solveDetection` reports 52 812 ms for fixture `08-31-36` and 12 301 ms for `08-56-22`, while `docs/research/hardware-replay-2026-08-03.md` measured those same solves at 25.6 s and 23.0 s. Cubedex times from the cube clock; smart-cube-timer and csTimer both time from the host clock. Routed for root-cause before that detector is trusted.

## Verification artifact

`bun run typecheck` clean at the time of writing. The bar that actually matters remains unmet: replaying a real capture and seeing a correct time and a correct stage breakdown.

## Explicitly unverified

- No end-to-end run since the ports landed.
- 178 files uncommitted.
- The app has not been opened in a browser since the design and rendering changes.
