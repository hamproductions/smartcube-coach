# Trainer flows

Every trainer is one screen with one job. The person using it is holding a cube in both hands, so the screen is read at a glance, the next action is always one key or one tap, and nothing that matters mid-attempt sits behind a disclosure.

## Shared shape

Every trainer follows the same loop so learning one teaches all of them:

1. **Setup**: the few choices that change what gets drilled (set, goal, colour). Remembered between visits. Never more than one row of choices visible before the first attempt.
2. **Prompt**: the position, shown on the 3D cube wherever the trainer is about a cube position. Text-only prompts are a defect.
3. **Answer**: on the smart cube when one is connected and the trainer can verify by state; otherwise by tapping one of the shown choices. Typing free text is only for things that are genuinely free text (a memo, a cross plan written as moves).
4. **Verdict**: correct or wrong in one word, then the evidence: the right answer replayed on the cube, the time split (recognition / execution) where the trainer times it.
5. **Next**: Space or Enter starts the next attempt. The trainer never makes you go back to the setup to continue.
6. **Session strip**: attempts, accuracy and the last few times stay visible in a narrow strip. Detailed history lives in Stats.

Keyboard: Space or Enter = primary action (start, submit, next). Number keys 1 to 9 pick a choice. Escape = back to the Train hub.

## Hub

Train opens on a hub grouped by solve stage, because a cuber decides what to work on by stage ("my F2L is slow"), not by trainer mechanics. Each card is one trainer: name, one line on what you do, and whether it needs the smart cube. Stats links a weakness straight to the trainer that works on it.

| Stage | Trainer | id |
|---|---|---|
| Cross | Cross to pairs | `cross-goal` |
| Cross | Plan the cross | `cross-plan` |
| F2L | F2L on the cube | `f2l-cube` |
| F2L | Free pair | `free-pair` |
| Last layer | Algorithm cases | `cases` |
| Last layer | Time attack | `time-attack` |
| Look-ahead | Pair tracking | `pair-tracking` |
| Look-ahead | Piece tracking | `piece-tracking` |
| Look-ahead | Edge orientation | `edge-orientation` |
| Look-ahead | Hidden colours | `hidden-colours` |
| Turning | Turn pacer | `pacer` |
| Turning | Solve checklist | `checklist` |
| Blindfold | Memo | `blindfold` |

## Per trainer

### Cross to pairs (`cross-goal`)
- Setup: goal (Cross, Cross + 1, + 2, + 3, Full F2L) and cross colour (Any or one colour).
- Prompt: a real random-state scramble, shown as text and tracked move by move on the cube from wherever the cube currently is. The scramble is generated, never "turn it however you like".
- Answer: inspect, then solve on the cube until the goal is reached. The clock starts on the first turn after the scramble verifies and stops the moment the goal state is reached.
- Verdict: time, turns, and the shortest cross from that scramble for comparison.
- Next: the next scramble appears immediately.

### Plan the cross (`cross-plan`)
- Prompt: the scrambled cube on screen with the scramble text. A 15 second inspection clock runs.
- Answer: type the plan, or tap it on the move pad, in the hold shown on the cube. Turning a cross on the smart cube against the clock is Cross to pairs with the Cross goal, so it is not duplicated here.
- Verdict: cross solved or not, your move count against the optimal count, and the optimal cross played on the cube.

### F2L on the cube (`f2l-cube`)
- Setup: case selection from the F2L set, ordering (smart, random, slow first, failed first).
- Prompt: the case's setup moves to turn into a solved cube, tracked live; then the case on screen.
- Answer: solve the pair on the cube; completion is detected from cube state.
- Verdict: recognition and execution time, with the reference algorithm. Hints come in steps if requested.

### Free pair (`free-pair`)
- Setup: normal or 2gen.
- Prompt: the position on the 3D cube, always visible, with the case name.
- Answer: tap one of the finish options (1 to 9 on the keyboard).
- Verdict: free or not, and when wrong, the finish that works played on the cube.

### Algorithm cases (`cases`)
- Setup: set (OLL, PLL, COLL, …), subset, learning state. Case grid to pick a custom selection.
- Prompt: the case on the cube or diagram.
- Answer: on the smart cube the case is verified by state; without a cube, Space when recognised, Space again when executed.
- Verdict: recognition and execution time, success, and the case's running average. Learn mode shows the algorithm up front; Review lists per-case stats.

### Time attack (`time-attack`)
- Setup: the selected cases and a target per case.
- Answer: run through the queue; each case is done or given up.
- Verdict: targets met, and the misses listed for the next run.

### Hidden colours
- Prompt: a corner drawn with two of its stickers placed where they sit on a real cube, and the third shown as unknown. There are no moves to follow, so there is no pace and no hide step.
- Answer: tap one of the six colours, or press 1 to 6.
- Verdict: right or wrong, with the hidden sticker filled in.

### Pair tracking, Piece tracking, Edge orientation
- Prompt: the start position on the cube with the target piece named; the moves play on the cube at a set pace, then the cube is hidden.
- Answer: tap the location (slot, edge position, oriented or flipped, colour). No typing.
- Verdict: right or wrong, then the moves replay with the piece followed.

### Turn pacer (`pacer`)
- Metronome at a chosen turns per second; the beat is always visible and is audible only when sound is switched on. With the smart cube connected it reports the actual rate and the share of turns on the beat.

### Solve checklist (`checklist`)
- Pre-solve and post-solve notes per solve, with the scramble to solve.

### Memo (`blindfold`)
- Prompt: the scramble and the cube.
- Answer: edge memo and corner memo as letter pairs, parity, flips and twists.
- Verdict: each part right or wrong with the correct memo.
