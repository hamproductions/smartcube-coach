# Design direction — reference mood board

Project-owned. Captures live in `docs/design/reference/`. Every image was taken in a browser at 1440×900 on 2026-08-03/04, not recalled or described.

## What every reference agrees on, and where this app breaks it

1. **The working surface starts at the top.** csTimer and acubemy both put the scramble inside the first 100 px. No reference opens with a title or a hero. — *We complied after the 2026-08-03 shell rebuild.*
2. **The timer is the largest object on the page.** — *Ours sat below the fold until the solve stage was compacted.*
3. **Numbers are mono and tabular; prose is small and grey.** No reference uses display type for anything except the clock. — *Complied.*
4. **Filters are progressive.** cubedex reveals category, then subset, then learning state. — *Broken: the Train page shows seven pill rows at once before you reach a case.*
5. **Session statistics live in a permanent rail, not a route you navigate to.** csTimer and acubemy keep averages visible while you solve. — *Broken: we render the same `HistoryProgress` component behind two separate nav items, Solves and Progress, and repeat the averages a third time on Today.*
6. **Nothing decorative.** One accent, hairline borders, flat surfaces wherever focus matters. — *Complied after the cubedex token port.*

Rules 4 and 5 are tracked as open work.

## The captures

| File | Source | What it decides |
|---|---|---|
| `reference/ref-acubemy-play.png` | acubemy playground | **The target.** Scramble centred in mono at top; cube small and desaturated; timer huge directly beneath; right rail NOW/BEST × single→ao1000 as plain text with no card. Nothing competes with the solve. |
| `reference/ref-cstimer.png` | csTimer | Scramble strip pinned full width, timer centre stage, ao5/ao12 immediately beneath, session and times list permanently visible on the left. Dense, undecorated, everything one click away. |
| `reference/ref-cubedex.png` | cubedex practice | Icon rail with labels; compact context bar reading `Practice · PLL · 0 selected`; the algorithm input is the primary control; card empty states name the next action. |
| `reference/ref-cubedex-cases.png` | cubedex case library | Category pills → subset pills → learning-state pills → case grid → one primary action. The model our trainer is meant to follow. |
| `reference/ref-acubemy-train.png` | acubemy training | Gated behind payment, but the shape is clear: one focused surface, not a stack of panels. |
| `reference/ref-solved.png` | solved.no | Feature-card entry grid; each card is one job with an icon, a name and a single line of purpose. |
| `reference/design-now5.png` | **ours** — Solve | Closest to the target: flat surface, centred mono scramble, muted cube, large timer, plain stat rail. |
| `reference/train-redo2.png` | **ours** — Train | Two-pane workbench, but the left column is seven filter rows before the first case and the right pane is empty. |
| `reference/compare-current3.png` | **ours** — Solve, earlier | Before flattening: bordered cards competing with the solve. |

## Not yet captured

`solved.no/trainers` and `f2l-trainer.top` both failed DNS on the 2026-08-04 run. They are missing from this board and must be captured before the trainer redesign is called finished — F2LTrainer's source is on disk, but its shipped interface has never been looked at.

## Rule

This file and `docs/design-system.md` are the design source of truth. Never publish a deliverable to a vendor artifact store, scratchpad or hosted workspace — project-owned repository from the start, always.
