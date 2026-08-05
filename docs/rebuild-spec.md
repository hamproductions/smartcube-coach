# Smart Cube Coach — ground-up rebuild specification

Every screen is deleted and written again against this document. The domain, device, storage and ported algorithm layers stay — they are proven against the owner's own captures. What gets deleted is the entire UI.

This is a **trainer**, not an informational site. It is used with a cube in both hands, often mid-solve, often glanced at from arm's length. Usability is the only thing that matters: the control you need next is always already on screen, and the number you need next is the biggest thing on it.

The reference is **acubemy**, reverse-engineered in `docs/research/acubemy-solve-2026-08-04.md`, `acubemy-stats-2026-08-04.md` and `acubemy-bundle-2026-08-04.md`. Where this spec and those notes disagree, the notes win — they are observed behaviour, this is design.

---

## 1. What acubemy does that we do not, and must

These are behavioural, not cosmetic, and they are the reason our app feels wrong regardless of how it is painted.

### 1.1 Stop detecting scramble divergence live
acubemy never asserts "wrong move" while scrambling. It offers a **Done Scrambling** button, an **F4 gesture** (front face turned four times), and an **auto-ready inactivity timeout** (default off, 1–10s). Whatever state the cube is in at that instant becomes the accepted start of the solve.

We replay every scrambling move against the target and emit `wrongMove`. That is the false-alarm source, and it is why a correctly-scrambled cube gets flagged. **Delete live divergence from the scrambling phase.** `acceptCurrentState()` becomes the primary path, plus the F4 gesture and an optional inactivity timeout. A strict scramble check may exist only as an off-by-default setting.

### 1.2 Lock the cross face from an F2L-complete lookahead
acubemy walks the **whole** solve forward and takes the first face on which **F2L** fully solves, then re-derives the cross segment against that face. We lock on the first cross-only hit, which is a weaker signal and produces the bad boundaries.

### 1.3 Assign stage boundaries by time midpoint
acubemy computes stage timings by simulation, then buckets each reconstruction move into a stage by **which midpoint between adjacent stage timestamps it falls in**. We cut at the first move where a state predicate fires. Theirs absorbs regrip and rotation jitter at boundaries; ours does not.

### 1.4 Score fit per stage, not per solve
acubemy hard-rejects on structure (F2L must have exactly 4 slots; cross > 12, OLL > 25, PLL > 30 moves) and otherwise scores a **Gaussian likelihood per stage** against calibrated means and standard deviations, averaging them into one probability with a 0.7 threshold. Observed constants: means `cross 7.23`, `slots 8.21 / 8.23 / 8.26 / 8.33`, `oll 9.93`, `pll 11.8`; stddevs `3.85`, `4.5 / 4.38 / 4.28 / 3.93`, `4.78`, `3.58`.

A 1-move OLL pulls only the OLL stage's density down; the rest stay fully weighted. Our single `cross.moveCount <= 20` check misses every OLL, PLL and F2L outlier.

### 1.5 Split recognition from execution at a 400ms gap
acubemy's boundary is the first move that is not undone later in the segment and is not a probing turn on the face opposite the cross within `EXECUTION_GAP_THRESHOLD_MS = 400`. Ours is a single first-non-trivial-move pass with no gap threshold.

### 1.6 Refuse to fabricate analysis
With no smart-cube replay, acubemy replaces the entire analysis panel with `connect smart cube to see detailed analysis`. No zeros, no blanks pretending to be data. Ours must do the same.

### 1.7 Penalties are manual
`+2` and `DNF` are toggle buttons on the solve record. Ours auto-derives them from inspection time; acubemy has no confirmed equivalent. Keep the automatic derivation, but the toggles must exist and must win.

---

## 2. Routes

Three. Not six.

| Route | Job |
|---|---|
| **Solve** | Capture or replay a solve and see what it cost, immediately. |
| **Drill** | Practise one thing against the real cube. |
| **Coach** | What is losing time across recent solves, and the drill that fixes it. |

Deleted as routes: Today, History, Library, Progress, Solves. Reconstruction editing belongs to a solve. Metronome and checklist belong to Drill. Settings and device diagnostics become sheets on the shell. The study library is deleted — it rendered another project's written content.

---

## 3. Layout rules

- **Ground** `#0b0b0c`, **ink** `#ece9e4`, **muted** `#8a867f`, **rule** `#2a2825`. One accent, lime `#bef264`, on exactly one element per screen.
- **Square corners, radius 0.** No pills, no rounded cards.
- **No bordered card grids.** Space first, hairline rule second.
- **Mono, tabular, for every number.** Sans for sentences.
- **Controls are always visible, never behind a disclosure.** The current app hides drill start, filters and case management behind `<details>`; that is the clutter complaint. A trainer's controls do not fold away.
- **Nothing important below the fold.** On every route, the primary control and the primary number are above 700px at 1280×800.

### The cube is a cube
The unfolded net is deleted wherever it represents the cube *now* — that is `twisty-player` in 3D. The net survives only on a case tile in Drill, where the whole state must read at a glance, and there it is small.

On Solve the cube sits **right**, in its own column, vertically centred against the move list. Never stacked under text.

---

## 4. Solve

Two columns. Left is time and moves, right is the cube.

**Left column, in order:**
1. **Scramble**, mono, one line, wrapping to two maximum.
2. **Timer** — `8xl`, mono, lime, tabular. The only lime element while running.
3. **State line** — `scrambling · 12 to go`, `ready`, `solving`, or the saved result. Muted, one line.
4. **Solve controls, always visible:** `Done scrambling`, `My cube is solved`, `New scramble`, `WCA inspection` toggle. Never behind a disclosure. `Done scrambling` is the primary path per §1.1.
5. **Result bar** after completion: `Time · TPS · Turns · Fluency%` in one mono row, plus `+2` and `DNF` toggles (§1.7).
6. **Stage strip** — one row, seven cells, hairline-separated: stage name, recognition time, execution time, moves. Per §1.5.
7. **Move list** — the readable reconstruction (`readableReconstruction`, which merges `L' L'` into `L2` but never cancels `F F'`, because a cancelled pair is the wasted work the coach exists to find). Current playback move highlighted; clicking seeks.
8. **Playback controls** — previous, play, next, reset.

**Right column:** the 3D cube, square, live while connected, playback position after a solve.

**Method selector** sits above the stage strip: `CFOP · Roux · ZZ`, re-running analysis on change, per acubemy. Confidence below 0.7 (§1.4) shows one muted line: `low confidence — try another method`.

**No replay:** the stage strip and move list are replaced by the single sentence `Connect a smart cube to see detailed analysis.`

**Not on this page:** the ao5/ao12/ao50/ao100/ao1000 rail, session picker, device diagnostics, self-test, export, packet counter, facelet readout. All move to the device sheet.

---

## 5. Drill

1. **Filter line** — one row: set select, then subset / learning / mode segmented rows. This is the existing `TrainerToolbar`, the one piece of current markup carried forward, because it already solved the clutter.
2. **Current case** — dominant. Name `3xl`, its cube in 3D at size, algorithm in mono, recognition and execution timing in lime while running.
3. **Drill controls, always visible:** `Recognized`, `Hint`, `Redo`, `Skip`. Never folded.
4. **Queue** — one horizontal scroll strip of upcoming case tiles (small net + name). Not a 167-cell grid on the page.
5. **Case browser** behind one control — a search field over 1,235 cases. That is a search problem, not a scroll problem.
6. **Metronome and checklist** live here, as a compact row, not as separate pages.

Deleted: the always-visible 167-card grid, the three stacked disclosure panels, the inline time-attack configuration block, the manage-cases panel, the authoring form. Time attack becomes a mode in the filter line; authoring moves behind the case browser.

---

## 6. Coach

1. **The finding** — one sentence, `2xl`: `Your F2L pairs cost 6.4s a solve.` Below it, mono: `12 solves · 87% · confidence 0.8`.
2. **Evidence rows** — at most five, hairline-separated: metric, observed, target, gap. Mono, right-aligned. No charts, no filled progress tracks.
3. **Prescription** — what to practise and how much, plus one control that opens Drill preloaded with exactly those cases.
4. **Recent solves** — last ten, one line each: time, moves, date, worst stage. Clicking opens it on Solve. This is all that remains of History.

**Not enough data:** `Not enough solves yet — five with the same problem before we call it a pattern`, plus the count so far. No seeded findings.

---

## 7. Shell

- **Header, 56px.** Wordmark left. Three route labels, underlined when active — no pills. Right: cube status as one line, and the primary control.
- **Device sheet** from the cube status line: packets, facelets, battery, protocol, self-test, export session, replay a session file.
- **Settings sheet** from the wordmark: cube colours, playback controls, hint elevation, and the off-by-default strict scramble check (§1.1).
- No sidebar, no footer.

---

## 8. Deletion list

```
src/components/TodayDashboard.tsx
src/components/HistoryProgress.tsx
src/components/LiveSolve.tsx
src/components/TrainerHub.tsx
src/components/RecoStudy.tsx
src/components/library/LibraryPage.tsx
src/components/ao1k/learn/     third-party written lesson content
public/ao1k/                   same
src/styles.css                 once the above are gone
```

Keep: everything under `src/domain/`, `src/device/`, `src/storage/`, plus `CubePlayback`, `ScramblePreview`, `ErrorBoundary`, `Icon`, `CaseCard`, `TrainerToolbar`, `Surface`, `src/components/parkui/`.

---

## 9. Build order

Each step ends driven in a real browser against a real capture in `src/device/fixtures/user-sessions/`. Compiling is not done.

1. **Behaviour first** — §1.1 through §1.6 in the domain layer, verified against the fixtures. The UI cannot fix a wrong boundary.
2. **Shell** — header, three routes, both sheets.
3. **Solve** — two columns, timer, 3D cube, result bar, stage strip, move list, method selector.
4. **Drill** — filter line, current case, always-visible controls, queue strip, case browser.
5. **Coach** — finding, evidence, prescription, recent solves.
6. **Delete** the files in §8.

---

## 10. Done means

- Three routes, no disclosure panels hiding controls, nothing important below the fold.
- No live wrong-move alarm while scrambling; `Done scrambling` and the F4 gesture are the path.
- Cross face locked by F2L-complete lookahead; boundaries by time midpoint; per-stage Gaussian confidence.
- Recognition/execution split at the 400ms gap threshold.
- The cube renders as a cube, right column, on Solve.
- Reconstructions read `F R L2 U' L'`, never `F R L' L' U' L'`.
- `src/styles.css` no longer exists.
- Replaying `08-56-22` gives 37 scramble moves, 65 solve moves, `22.999`, seven stages summing to 65.
- Zero console errors on every route in a clean browser context.
