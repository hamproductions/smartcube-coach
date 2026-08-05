# Smart Cube Coach — complete feature list for the designer

Everything the product does or must do. This is the inventory to design against. It is not a spec for how it should look — that is `docs/rebuild-spec.md`. Nothing here is aspirational unless the Status column says so.

**Status key** — `built` works today and is proven against real captures · `built, wrong` works but behaves incorrectly and is scheduled to change · `built, hidden` works but has no usable entry point · `to build` does not exist.

## Who this is for

One cuber. Solves a 3×3 in 20–30 seconds, wants sub-10. Owns a QiYi smart cube that reports every turn over Bluetooth. Uses this with the cube in both hands, often mid-solve, often glancing from arm's length. There is no second user, no sharing, no accounts, no server. All data is local.

---

## 1. The cube connection

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 1.1 | Connect over Web Bluetooth | built | One action. Browser shows its own device chooser; we cannot style it. |
| 1.2 | Show connection state | built | Name, protocol, battery. Needs to be readable at a glance and never occupy a whole panel. |
| 1.3 | Live cube state | built | The cube reports its sticker state; we render the physical cube in 3D. Must render as a **cube**, never an unfolded net. |
| 1.4 | Battery level | built | Secondary. Belongs in the device sheet, not on a page. |
| 1.5 | Reconnect after drop | built | Silent. Only surfaces if it fails. |
| 1.6 | Record a session to a file | built | Writes every packet with timing. Used to reproduce bugs without the cube. |
| 1.7 | Replay a recorded session | built | Feeds a file back through the identical live pipeline. **This is how the whole app is testable without hardware** and must stay a first-class action, not a debug curiosity. |
| 1.8 | Connection self-test | built, hidden | Diagnostic. Device sheet only. |
| 1.9 | Gyroscope orientation | not supported | This cube has no orientation sensor. Do not design for it. |

---

## 2. Scrambling

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 2.1 | Generate a WCA scramble | built | 3×3 random-state. Displayed as text, must be readable across a room. |
| 2.2 | Scramble picture | built | Flat sticker diagram of the scrambled state. This is the one place a net is correct — it shows a target, not the cube now. |
| 2.3 | Track scrambling progress | built, wrong | Shows moves remaining. Today it also asserts "wrong move" live, which false-alarms on correctly-scrambled cubes. The reference product never does this. **Being removed.** |
| 2.4 | Done scrambling | built | Becomes the **primary** path: accept whatever state the cube is in and start. Must be the most prominent control while scrambling. |
| 2.5 | Start from this state | built | Same as above for a cube already scrambled by hand. |
| 2.6 | F4 gesture to finish scrambling | to build | Turn the front face four times to signal "done" without touching the screen. Matters because both hands are on the cube. |
| 2.7 | Auto-ready after inactivity | to build | Optional, off by default, 1–10s. Same purpose as the gesture. |
| 2.8 | Strict scramble check | to build | The old live-divergence behaviour, off by default, for anyone who wants it. |

---

## 3. Timing a solve

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 3.1 | Start on first turn | built | No button press. The timer starts when the cube moves. |
| 3.2 | Stop when solved | built | Detected from cube state, not a keypress. |
| 3.3 | Live elapsed time | built | **The single biggest element on the screen while solving.** Monospaced, tabular, unmissable. |
| 3.4 | Keyboard timer | built | Hold space, release, press to stop. For solving without the cube connected. |
| 3.5 | WCA inspection | built | 15 seconds, with +2 after 15 and DNF after 17. |
| 3.6 | Inspection audio warnings at 8s and 12s | to build | Reference product does this. Hands are on the cube; audio beats visuals. |
| 3.7 | +2 / DNF toggles | to build | Manual, on the saved solve, and they must override the automatic penalty. |
| 3.8 | Cube-clock timing | built | Times come from the cube's own clock, fitted, not the browser's. More accurate; invisible to the user. |

---

## 4. The solve record

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 4.1 | Save every solve locally | built | IndexedDB. No server, no account. |
| 4.2 | Store every raw turn | built | Immutable event log per solve. |
| 4.3 | Readable reconstruction | built | `L' L'` is shown as `L2`. `F F'` is **kept**, because a cancelled pair is wasted work worth seeing. Set in mono. |
| 4.4 | Verify the solve actually solves | built | If the recorded moves do not solve the recorded scramble, the solve is marked unverified rather than presented as clean. |
| 4.5 | Sessions | built, hidden | Named groups of solves. Low value; may be cut. |
| 4.6 | Export to csTimer CSV | built, hidden | One action, belongs in a sheet. |
| 4.7 | Export and import all data | built, hidden | Same. |
| 4.8 | Edit a reconstruction by hand | built | For fixing a mis-recorded solve. Belongs to a solve, not a separate page. |

---

## 5. Analysis of a solve

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 5.1 | CFOP stage split | built | Cross, F2L 1–4, OLL, PLL. Seven stages. |
| 5.2 | Per-stage time | built | Recognition time and execution time, split separately. |
| 5.3 | Per-stage move count | built | Must sum exactly to the solve's move count. |
| 5.4 | Per-stage confidence | built | Scored against how long each stage normally takes. A 1-move OLL now scores 0.18 while the rest stay near 1.0. Design needs a quiet way to mark a low-confidence stage — not an alarm. |
| 5.5 | Recognise the OLL case | built | Names the case, e.g. "OLL skip". |
| 5.6 | Recognise the PLL case | built | e.g. "Ab Perm". |
| 5.7 | Recognise the F2L slot | built | Which of the four slots was solved. |
| 5.8 | Pause detection | built | Count, longest pause, and which move it preceded. |
| 5.9 | Rotation cost | built | Time lost to cube rotations. |
| 5.10 | TPS | built | Turns per second, excluding rotations. |
| 5.11 | Fluency | to build | One percentage: how much of the solve was actually turning rather than pausing. |
| 5.12 | Optimal comparison | built | How many moves the stage could have taken, so waste is measurable. |
| 5.13 | Method selector | to build | CFOP / Roux / ZZ, re-running the analysis. Currently CFOP only. |
| 5.14 | No analysis without a replay | to build | With no smart-cube data, show one sentence saying so. Never zeros or blanks. |

---

## 6. Playback

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 6.1 | 3D cube replay | built | The solve replayed on a real cube model. |
| 6.2 | Step forward and back | built | One move at a time. |
| 6.3 | Play at recorded speed | built | Uses the real inter-move timings. |
| 6.4 | Jump to a stage | built | Click a stage, cube jumps to where it started. |
| 6.5 | Jump to a move | built | Click a move in the reconstruction. |
| 6.6 | Reset | built | Back to the scrambled state. |

---

## 7. Coaching

The reason the product exists. Weakest area today.

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 7.1 | Find recurring problems | built | Looks across solves for the same problem repeating. |
| 7.2 | Require evidence before advising | built | Five solves with the same problem before anything is claimed. Until then it says so plainly. |
| 7.3 | Show the evidence | built | Which solves, how often, how confident. Numbers, not charts. |
| 7.4 | Prescribe a drill | built | Turns a finding into specific cases to practise. |
| 7.5 | Check the drill worked | built | Compares later solves to see if the problem actually went away. |
| 7.6 | Rank problems by time cost | built | Biggest time loss first. |
| 7.7 | One coaching surface | to build | Today this is scattered across three routes. It needs one page: the finding, the evidence, the drill. |

---

## 8. Training

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 8.1 | Case catalogues | built | 1,235 cases: F2L 167, OLL 57, PLL 21, COLL 40, CMLL 42, OCLL, 2-Look OLL/PLL, WVLS 27, OLLCP 342, VHLS 32, ZBLL 472, ZBLS 305, L6E. **A list this size is a search problem, not a scroll problem.** |
| 8.2 | Case picture | built | Flat sticker diagram per case. Correct here — the whole state must read at a glance. |
| 8.3 | Filter by set | built | The current one-line filter bar works and is the one piece of existing UI worth keeping. |
| 8.4 | Filter by subset | built | F2L slot, OLL edge count. |
| 8.5 | Filter by learning state | built | Unlearned / learning / learned, with counts. |
| 8.6 | Filter F2L by shape | built, hidden | Behind a disclosure. Should not be. |
| 8.7 | Learn / Drill / Review / Recognize modes | built | Four practice modes. |
| 8.8 | Recognition timing | built | Time to recognise, timed separately from execution. |
| 8.9 | Real-cube drills | built | Completion detected from the actual cube state, not a keypress. |
| 8.10 | Progressive hints | built | Three levels before the answer. |
| 8.11 | Redo queue | built | Failed cases come back. |
| 8.12 | Mastery per case | built | Attempts, success rate, best time, ao5, ao12. |
| 8.13 | Time attack | built, hidden | Race a queue of cases against per-case targets. |
| 8.14 | Two-sided recognition | built | Recognise from two faces only. |
| 8.15 | Custom algorithms | built, hidden | Replace the default for a case. |
| 8.16 | Metronome | built | 40–120 bpm for turning at a steady pace. Belongs with practice. |
| 8.17 | Pre/post-solve checklist | built | Notes attached to a solve. Belongs with practice. |
| 8.18 | Blindfold drills | built, hidden | Letter pairs, memo. Present but unreachable. |
| 8.19 | Cross planning | built, hidden | Inspection practice. Same. |
| 8.20 | Edge orientation tracking | built, hidden | Same. |

---

## 9. Statistics

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 9.1 | Averages | built | ao5, ao12, ao50, ao100, ao1000, best and current. |
| 9.2 | Personal bests | built | Single and each average. |
| 9.3 | Stage trends | built | Whether each stage is improving. |
| 9.4 | Session summary | built | Per-session aggregates. |
| 9.5 | Solve history | built | Every solve, listed. **Today this is a whole route; it should be a short recent list inside coaching.** |

Averages are reference material, not the main event. They currently occupy a permanent six-row rail on the solve screen and should not.

---

## 10. Study

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 10.1 | Import someone else's reconstruction | built | Paste a solve and study it. |
| 10.2 | Reconstruction library | built | Saved study material. |
| 10.3 | Third-party lesson content | removed | Was another project's writing, shipped verbatim. Taken down. |

---

## 11. App-level

| # | Feature | Status | Notes for the designer |
|---|---|---|---|
| 11.1 | Works offline | built | Installable, works with no network. |
| 11.2 | Local-first storage | built | Nothing leaves the machine. Worth stating plainly in the UI. |
| 11.3 | Persistent storage request | built | Asks the browser not to evict the data. |
| 11.4 | Update prompt | built | Never mid-solve. |
| 11.5 | Cube colour settings | built | Which colours the cube renders in. |
| 11.6 | Playback settings | built | Controls visible, hint elevation. |
| 11.7 | Error isolation | built | One broken panel must not take the page down. |
| 11.8 | Dark only | built | No light mode. Not planned. |

---

## 12. What is hidden today

These exist, work, and have no usable entry point. Every one is a design decision waiting to be made — either give it a home or cut it.

Blindfold drills · cross planning · edge-orientation tracking · custom algorithm authoring · time attack · two-sided recognition setup · F2L shape filter · csTimer export · full data export and import · connection self-test · device diagnostics · session management.

---

## 13. The three things that must be true

Everything above serves these. If a design decision conflicts with one of them, the design is wrong.

1. **The cube is the product.** Connecting, staying in sync, timing a solve and splitting it correctly outrank every other feature. Anything untestable from a recorded session is a design defect, not a reason to ask for hardware.
2. **Never fabricate.** No seeded averages, no zeros standing in for unmeasured data, no solve presented as clean when the moves do not solve the scramble. Blank beats invented.
3. **It is used with both hands on a cube.** Controls stay visible, targets stay large, the number that matters stays the biggest thing on screen, and nothing needed mid-solve hides behind a disclosure.
