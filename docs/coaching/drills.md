# Drill sheet

This list lives in the app as the plan at `#/train/plan` (`src/coaching/plan.ts`): each drill opens its trainer already set to these cases and the cube counts the reps. The six stuck-edge cases are now in the F2L trainer (`src/domain/f2lStuckEdge.ts`).

What to open, what to set, what to do, and when a rep counts. Evidence is in `acubemy-1000-2026-11-20.md`; this page has none on purpose. Cube connected for everything.

## 1. Stop pausing between pairs

**A. Train → Turning → Turn pacer**
- Set the beat slow enough that you never miss it. Sound on.
- Do full solves on the beat. One turn per beat, all the way through F2L.
- A rep counts only if you never stopped between two pairs. Missed a beat while looking for the next pair: the beat is too fast, lower it.
- Raise the beat one step after ten clean solves in a row.

**B. Train → Look-ahead → Pair tracking** (then Piece tracking)
- Follow the named pair while the moves play, say where it ends up.
- This is the eye skill for A: watching a piece you are not turning.

**C. Train → Cross → Cross to pairs, goal "Cross + 2"**
- Solve cross and two pairs. Rule: while your hands do pair one, your eyes are already on pair two. Never look at the pair you are inserting.
- A rep counts if there was no stop between pair one and pair two.

## 2. Cross

**A. Train → Cross → Plan the cross**
- Turn the scramble. Plan every move of the cross. Do not touch the cube until you can say the whole solution.
- Look away or close your eyes, then turn it in one go.
- The verdict shows your pause count and the shortest cross. A rep counts only at zero pauses. Watch the shortest cross play every time yours was longer.
- Twenty a session.

**B. Train → Cross → Cross to pairs, goal "Cross + 1"**
- Only after A is mostly clean. During inspection also find one corner and its edge. Solve cross, then that pair, with no stop in between.

**Habit to kill:** extra turn after the fourth cross edge lands. Cross done means eyes already on the pair.

## 3. F2L cases to fix

### In the app: Train → F2L → F2L on the cube
Pick these four cases, all four slots, order "Slow first". The trainer sets the case up on your cube and shows a reference solution after each attempt.

| Case in the grid | What is wrong now | What to drill |
|---|---|---|
| F2L 36 | You know a short solution but often pick a long one or rotate | One solution per slot, no rotation. Your own short one (`F' U' F U' R U R'` for front-right) is fine; so is the trainer's. Pick and never switch. |
| F2L 35 | Rotating, long versions | The trainer's solution. Front-right: `U' R U R' U F' U' F`. |
| F2L 24 | Using an 11 to 12 move solution | The trainer's 9-move solution replaces yours. Front-right: `U F' L' U L F R U R'`. |
| F2L 8 | Solution is fine, you take too long to see it | Recognition only: glance, go. Keep your solution (`L' U2 L U2 L' U L` on the left, mirror on the right). |

A rep counts when you start turning without a stop and use the same solution as last time.

### Edge stuck in another slot
The biggest F2L leak is one family: the corner is on top, but its edge sits in a different, still-empty slot. You currently dig the edge out, then solve the pair as a new case, with a stop in between. Each of these has a direct solution.

Drill by hand: from a cube with cross and the other pairs solved, do the setup, look at the case, do the solution. Five times each, then mix them.

| Setup (makes the case) | Solution (verified on a simulated cube) |
|---|---|
| `R U' R2 U R U'` | `U R' U' R2 U R'` |
| `F' U F L F' L' F U'` | `U F' L F L' F' U' F` |
| `F' U F U2 R B' R' B U'` | `U B' R B R' U2 F' U' F` |
| `R U' R' U' B' U B U'` | `U B' U' B U R U R'` |
| `b' R b U L U' L' U` | `U' L U L' U' b' R' b` |
| `b' R b U B L' B' L U'` | `U L' B L B' U' b' R' b` |

These six are in the F2L trainer as Stuck edge 1 to 6.

### Rotations
In every drill above and in Turn pacer solves: at most one cube rotation per F2L. Back-left slot is the one you rotate for most; solve it from where you sit.

## 4. Last layer

### PLL: Train → Last layer → Algorithm cases, set PLL, pick from the grid
- **Stops in the middle of the algorithm** (drill until it runs in one piece, Drill mode): Aa, Ab, Gc, Gd, Nb, E, V.
- **Slow hands** (then take them to Time attack, target = your T perm time): Aa, Ab, Z, Nb, Ua, Ja, Ga, Gb, Gc, Gd.
- **Slow to recognise** (Recognize mode): E, Aa, Ab, Z, Rb, Gc, Gd. Learn the two-side pattern; do not turn the top to check.
- **V perm:** you use two different algorithms. Pick one, delete the other from your hands.

### OLL: Train → Last layer → Algorithm cases, set OLL, pick from the grid
The grid shows the picture next to each number. Shape family in brackets.

- **Slow to recognise** (Recognize mode, from all four angles, so you never turn the top twice before starting): 47 (small L), 11 and 12 (small lightning), 52 and 56 (line), 41 and 42 (awkward), 13 and 16 (knight), 3 and 4 (dot).
- **Done in two steps, needs one real algorithm** (Learn mode, then Drill): 20 (dot, all four edges flipped), 9 (fish), 13 (knight).
- **Slow hands** (Drill, then Time attack): 20, 9, 1, 12, 22, 18.

### Last turn
Before the PLL finishes, know which way the top layer has to go. No stop before the final turn.

## Session order
1. Plan the cross, twenty reps.
2. Turn pacer solves, about fifteen minutes.
3. One F2L item from section 3 and one last-layer item from section 4.
4. Twelve normal timed solves on the Solve page.
