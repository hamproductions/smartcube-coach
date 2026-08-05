# acubemy bundle mining — statistics, sessions, trainer (2026-08-04)

Scope: statistics/averages, NOW-vs-BEST, personal-best target, session model, trainer
(case selection/weighting/learning states/per-case stats), persistence. Live-cube
rendering/event ingestion/timer loop and scramble tracking/solve segmentation are
covered by parallel agents and are out of scope here.

**Licence note:** acubemy (`https://acubemy.com`) is closed-source production output.
Everything below is *observed behaviour*, described from reading the minified bundle
at `/tmp/refs/acubemy/` (34 chunks + `index.html`), with the exact chunk filename and
a short verbatim excerpt cited so each claim is checkable. No acubemy source is
proposed for copying, vendoring, or pasting into this repo — only the algorithmic
shape is described, in prose/pseudocode.

Method used: rather than grepping single tokens out of context, candidate chunks were
located with `grep -l` for topic keywords, then the surrounding region was extracted
with small `node -e` scripts that slice ~200-800 chars around each match (the minified
files have no line breaks, so `sed`/`awk` line-based tools don't help). One file
(`451-84df600ea32235cb.js`) was small enough to read in full.

---

## 1. Averages (ao5 / ao12 / ao50 / ao100 / ao1000)

Found in `451-84df600ea32235cb.js`, webpack module `82521`. This module is the shared
stats-math package; the app also uses this file for `ao100` as a settings default
label (`7839-82bec37ab48c7b59.js`: `historyGraphMetric:"ao100"`), confirming these are
real product features, not dead code.

Exact trim rule:

```
function n(e){return Math.ceil(.05*e)}                 // solves-to-drop, PER SIDE
function l(e){return"dnf"===e.flag?1/0:s(e)}            // effective time (sort key)
function s(e){return"plus_two"===e.flag?e.totalTime+2e3:e.totalTime}  // display time
function a(e){                                          // plain-number trimmed mean
  let t=n(e.length);
  return e.sort((e,t)=>e-t).slice(t,-t).reduce((e,t)=>e+t,0)/(e.length-2*t)
}
```
— `451-84df600ea32235cb.js`, near offset 497.

So `n(count) = ceil(0.05 * count)` solves are trimmed from **each** end (best side and
worst side), same `n` uniformly applied for ao5/ao12/ao50/ao100/ao1000 — there is no
special-cased "no trim below 5" branch; for ao5, `n=ceil(0.25)=1` (drop 1 best / 1
worst, matches WCA's classic "drop high/low" for an average of 5); for ao12,
`n=ceil(0.6)=1`; for ao100, `n=ceil(5)=5` (drop 5 best/5 worst, keep middle 90).

`+2` handling: folded directly into the value via `s(e)` (`totalTime+2000` when
`flag==="plus_two"`), not kept as a separate flag on the aggregate.

DNF handling inside a window — the flag-aware entry point:

```
function o(e){                                          // computeAverageWithFlags
  let t=[...e].sort((e,t)=>{let n=l(e),s=l(t);return n===s?0:n-s}),
      r=n(e.length), o=t.slice(r,t.length-r),
      a=o.filter(e=>"dnf"===e.flag).length;
  return{time:o.reduce((e,t)=>e+s(t),0)/o.length, isDNF:a>0}
}
```
— `451-84df600ea32235cb.js`, near offset 774; exported as `computeAverageWithFlags`.

Mechanism: solves are sorted by **effective time** where a DNF sorts as `+Infinity`
(so DNFs always land at the tail of the sorted array), then `n` items are trimmed from
each end (front = best, back = worst/DNFs). If, after trimming, any DNF remains inside
the kept middle window, the whole average is marked `isDNF:true` and callers null it
out (`7563-8522c4e7a4653250.js`: `let e=(0,l.computeAverageWithFlags)(D);return
e.isDNF?null:e`). If a DNF was trimmed away entirely (count of DNFs ≤ `n`), the average
stands as a normal number. This is the standard WCA rule: an average is only DNF if
more unresolved DNFs exist than the trim allowance can absorb.

**Comparison to `src/domain/statistics.ts`:** our `averageOf()` filters DNFs out of the
window entirely first (`finished`), then does `trim = Math.ceil(count * 0.05)` and
`kept = sorted.slice(trim, sorted.length - (trim - dnfs))`, gating with
`if (dnfs > trim) return undefined`. Working through both on paired inputs (count=12,
trim=1, 0 or 1 DNF) confirms these are **mathematically equivalent** to acubemy's
sort-with-Infinity-then-trim-each-side approach: both drop the same net count from
each side and both invalidate the average under the same condition (DNFs exceeding the
trim allowance). Our special-case `if (count < 5) return dnfs ? undefined : mean(...)`
has no counterpart in acubemy — acubemy applies the same `ceil(0.05*count)` trim
uniformly regardless of window size (for ao3 that would be `n=1`, dropping 1 best/1
worst and averaging just the middle value, which acubemy would still do; our code
instead means-without-trim below count 5). This is a minor, probably immaterial,
divergence since ao3 isn't a normal reported average — but it means our trim formula
is not applied at very small counts the way acubemy's is. Verdict: **equivalent** for
ao5/ao12/ao50/ao100/ao1000, the practical values in play.

---

## 2. NOW vs BEST (rolling current vs best-ever)

Only one concrete usage site was found in the 34 chunks, and it is **not** the live
solving-page stat rail — it's a "wrapped"/profile-stats modal that recomputes over the
user's full solve history on demand:

```
D=(0,n.useMemo)(()=>(0,l.getBestAverageOfSolves)(b,5),[b]),
Z=(0,n.useMemo)(()=>{if(!D)return null;let e=(0,l.computeAverageWithFlags)(D);
  return e.isDNF?null:e},[D]),
```
— `7563-8522c4e7a4653250.js`, offset ~83706, feeding a "Fastest AO5" tile
(`{id:"fastest-ao",title:"Fastest AO5",value:i,description:o}`, offset ~87039).

The underlying "best window over history" algorithm, `getBestAverageOfSolves`
(module `82521`, `451-84df600ea32235cb.js`), is a genuinely incremental sliding-window
structure, not brute recompute per solve:

```
t.getBestAverageOfSolves=function(e,t){
  ... a = solves mapped to {eff, disp, dnf, idx} ...
  c = first-window slice sorted by eff  // maintained sorted array
  m(n) recomputes the window's trimmed mean using running sum `i` and running dnf
       count `u`, only summing the r-best + r-worst extremes out of the running total
  g(e) = binary-search removal of the outgoing solve from `c`
  v(e) = binary-search insertion of the incoming solve into `c`
  for each subsequent window: remove outgoing solve (g), insert incoming solve (v),
    update running sum/dnf count in O(1)+O(log n) for the splice, call m(n)
  returns the best-scoring window's raw solve slice, or null if every window has more
  DNFs than the trim allowance can absorb
}
```
— `451-84df600ea32235cb.js`, offset ~1392 (`getBestAverageOfSolves`).

This confirms the concern in the brief: a naive per-solve recompute of ao1000 would be
`O(n)` per solve / `O(n²)` total for `n` solves; this structure keeps a sorted array of
just the current window (binary-search insert/remove, `O(log n)` per step) and updates
a running sum/DNF-count incrementally, giving `O(n log n)` total to scan the whole
history for the single best window.

However, this function computes the **best window in a static array passed in**
(`b`/`solvesMetadata`, a full history array) inside a `useMemo` — it is recomputed
whenever that array reference changes, not maintained as a running per-solve
incremental "current best" store. No code path updating a persisted "current NOW ao_n"
or "current BEST ao_n" per new solve was found anywhere in the 34 chunks. Given that
acubemy's stats/sessions are backend-driven (see §4/§6 — a tRPC client `SX` calling a
Cloud Run backend), the live six-row NOW/BEST stat rail on the timer page is most
likely computed server-side and simply returned as numbers to the client; that
computation is **not present** in this bundle set (the timer/solving-page route chunk
was apparently not part of what was captured, or is server-rendered on each request).

**Honest gap:** cannot determine from this bundle whether/how acubemy maintains an
incremental "NOW" value per new solve on the live timer screen. What is verifiable is
that acubemy *has* an efficient incremental best-window algorithm for scanning history
(`getBestAverageOfSolves`), used at least once client-side for a "best AO5 of the
year" style stat, confirming the team is aware of and avoids the O(n) naive-recompute
problem for at least the historical/best-value case.

**Comparison to our code:** `src/domain/statistics.ts`'s `bestAverageOf()` is an
`O(n²)`-ish brute-force slide (`averageOf()` re-sorts/re-trims each window from
scratch in a loop over every possible start index) — strictly worse asymptotically
than acubemy's binary-search-maintained running window, though likely irrelevant at
our current data volumes (hundreds, not thousands, of solves). If ao1000 histories
ever become a real concern, acubemy's structure (sorted window + running sum/DNF count
+ binary insert/remove) is the concrete algorithm to adopt.

---

## 3. Personal best target ("what must the next solve beat")

Searched all 34 chunks for `toBeat`, `needToBeat`, `beatBy`, `targetTime`, `nextPB`,
`personalBest`, `PersonalBest`, `isPB`, `newPB`, `recordBroken` and inspected every
hit. The only match (`targetTime` in `e646c3ff-9a291dc539c7dc95.js`) is inside bundled
Sentry Session Replay SDK code (`maxReplayDuration`, `sessionIdleExpire` — nothing to
do with cubing), a false positive from generic naming.

**Honest conclusion:** no personal-best-target computation (what time the next solve
would need to achieve to set a new best ao_n) exists anywhere in this bundle. Either
acubemy doesn't ship this feature at all, or it lives entirely server-side and never
reaches the client as executable code (plausible given the backend-first
architecture — see §4/§6). Cannot be verified either way from what's available.
Our own `personalBestTarget()` in `src/domain/statistics.ts` (binary search over a
synthetic candidate solve appended to the recent window, checking if it beats
`bestAverageOf`) therefore has no counterpart to compare against in this bundle.

---

## 4. Session model

Found in full in `3563-6dc8b8188e204887.js`, webpack module `56182` (read in its
entirety — it's a small file). Key facts:

Session CRUD is **not local** — it's server-persisted via a tRPC client, with
optimistic local cache updates and rollback on error:

```
let{data:c=[],isLoading:f}=s.SX.sessions.getAll.useQuery(void 0,{enabled:!t&&!!e}),
    v=s.SX.useUtils(),
    g=s.SX.sessions.create.useMutation({onMutate:async e=>{
       ... optimistic session {id:Math.random(), userId:-1, name, inspectionTime, scrambleMode} ...
    }, onError:(e,t,n)=>{ /* roll back to previousSessions */ }}),
    m=s.SX.sessions.delete.useMutation({ ... same optimistic-then-rollback pattern ... })
```
— `3563-6dc8b8188e204887.js`, module `56182`.

Only two small pieces of session *state* are persisted client-side, via a Zustand
store with the `persist` middleware (localStorage by default):

```
let b=(0,i.U)()((0,o.tJ)(e=>({
  selectedSessionId:null, previousSessionId:-1,
  setSelectedSessionId:t=>e({selectedSessionId:t}),
  setPreviousSessionId:t=>e({previousSessionId:t})
}),{name:"session-storage", partialize:e=>({
  selectedSessionId:e.selectedSessionId, previousSessionId:e.previousSessionId})}))
```
— same file. So the *only* thing acubemy keeps in browser storage for sessions is
"which session id is currently selected" and "which was selected before that" (used to
restore the prior session when the current one is deleted) — not the sessions or
solves themselves.

Session naming/typing: four built-in name constants — `"Default Session"`,
`"Daily Scramble"`, `"Tournament"`, `"Online Match"` — with small classifier helpers:
`p(e)` = one of the four known names (`isKnownSessionName`), `m(e)` = is
Tournament/Online Match (`isCompetitionLike`), `S(e)` = is Daily
Scramble/Tournament/Online Match (a "special/timed mode" set). New sessions default
`inspectionTime` to on when the name is "Daily Scramble" (or explicit override), and
`scrambleMode` defaults to `"random"`.

Auto-select/fallback logic: if `selectedSessionId` is `null` or no longer exists in
the fetched session list, it falls back to the "Default Session" by name lookup:

```
if(f||t||!e||0===c.length)return;
let s=null===n, i=!c.find(e=>e.id===n);
if(s||i){let e=c.find(e=>e.name===u); e&&o(e.id)}   // u === "Default Session"
```

**Comparison to `src/storage/database.ts`:** our model is the inverse of acubemy's —
sessions and every solve live in local IndexedDB (`sessions`, `solves` stores) with a
full migration path (`migrateDefaultSession`) to backfill a synthetic "default"
session for legacy un-sessioned solves, and there is no backend at all. acubemy is a
thin client over a Cloud Run backend (see `h()`/`c()` in `643-ba659ceca46b66e6.js`:
`"https://acubemy-backend-production-16644438767.europe-west1.run.app"`, HTTPS + WSS)
using tRPC (`s.SX=(0,i.ec)()`) with optimistic react-query mutations for
create/delete, and keeps only the *selected session id* pair in localStorage. This is
a structural, not incremental, difference: our app is offline-local-first, acubemy is
online-first with an optimistic-UI veneer. Neither is "wrong" — they're different
product architectures (acubemy requires an account/network; ours is designed to work
fully offline) — but it means acubemy's session/stats code shown in the client bundle
is largely UI-cache glue, not the source of truth for the actual computation.

---

## 5. Trainer (case selection/weighting, learning states, per-case stats, sets/subsets)

No "trainer", "flashcard", "spaced repetition", "SRS", "dueAt/dueDate", "easeFactor",
"masteryLevel", or "learningState" identifiers were found anywhere across all 34
chunks (confirmed by exhaustive `grep` across the full chunk set, not just a sample).
`page-e272de7b8d2ffa37.js` (the marketing landing page) only has marketing copy about
"Personalized Algorithm Coach... targeted drills and spaced repetition" and "smart
flashcards using spaced repetition" — describing the feature in prose, with zero
implementation.

What *is* present, in `7839-82bec37ab48c7b59.js` (module `57335` + an adjacent
unnamed module right after it), is a population-benchmark + selection-weighting
utility library:

**Reference dataset** — `caseTimeDistributions`, an array of per-case (OLL/PLL/etc.,
keyed by `{caseIndex, algorithmType}`) execution-time percentile buckets:

```
s.caseTimeDistributions=[{caseIdentifier:{caseIndex:0,algorithmType:"OLL"},
  executionBucketStats:[{medianMs:200.25...,p20Ms:190.23...,p80Ms:295.99...}, ...46 buckets...]}, ...158 cases...]
```
— `7839-82bec37ab48c7b59.js`, module `57335`, offset ~40. There's a parallel
`recognitionBucketStats` array referenced alongside it (same shape, per bucket).

**Skill bucketing and lookup:**
```
s.getSkillBucketFromGoalTime=function(e){return Math.max(0,Math.min(45,Math.floor(e/1e3)))},
s.getExpectedCaseTime=function(e,s){
  let t=n.caseTimeDistributions.find(s=>s.caseIdentifier.algorithmType===e.algorithmType&&s.caseIdentifier.caseIndex===e.caseIndex);
  if(!t)return null;
  let M=Math.max(0,Math.min(45,s)),r=t.executionBucketStats[M],i=t.recognitionBucketStats[M];
  return(null==r?void 0:r.medianMs)&&(null==i?void 0:i.medianMs)
    ?{executionMs:r.medianMs,recognitionMs:i.medianMs,totalMs:r.medianMs+i.medianMs}:null
}
```
— i.e. the user's own overall speed (a "goal time" in ms, floored to whole seconds and
clamped 0–45) selects a percentile bucket, and every case has a *population median*
execution+recognition time benchmarked at that bucket. This is a fundamentally
different targeting model from a single fixed `targetMs` per case — it's "what should
this case take *someone at your overall speed*", derived from real aggregate data
across users, not a fixed heuristic constant.

**Performance score and selection weight:**
```
s.computePerformanceScore=function(e,s){return e<=0||s<=0?100:s/e*100},   // s=expected, e=actual? -> expected/actual*100
s.computeSelectionWeight=M,
function M(e){let s=Math.max(1,100-e);return s*s},                        // weight = max(1,100-score)^2
s.selectWeightedRandomCase=function(e,s){                                 // roulette-wheel select
  if(0===e.length||s.length!==e.length)return null;
  let t=s.map(M), n=t.reduce((e,s)=>e+s,0);
  if(0===n)return e[Math.floor(Math.random()*e.length)];
  let r=Math.random()*n;
  for(let s=0;s<e.length;s++) if((r-=t[s])<=0) return e[s];
  return e[e.length-1]
},
s.computeMedian=function(e){ /* standard sorted-median, even-length averages the two middles */ },
s.NEUTRAL_PERFORMANCE_SCORE=50
```
— `7839-82bec37ab48c7b59.js`, same region.

So the shape of the algorithm (as far as it's inferable from the shared math module)
is: for each case, compute the user's own median actual time (`computeMedian` over
recent attempts), compare to `getExpectedCaseTime` at their skill bucket via
`computePerformanceScore` (≈100 = on par, >100 = faster than expected/good, <100 =
slower than expected/bad, default `50` when no data — worse than "on par", biasing
untried/under-sampled cases toward being picked), turn that into a weight via
`computeSelectionWeight` — a **quadratic, not linear**, inverse-of-performance curve
(`(100-score)²`, floor 1) — and pick via roulette-wheel (`selectWeightedRandomCase`).
A quadratic curve means a case at score 0 gets weight 10000 vs. a case at score 90
getting weight 100 — a 100x disparity, much more aggressive than a linear scheme.

**Important limitation:** none of `selectWeightedRandomCase`, `computeSelectionWeight`,
`getExpectedCaseTime`, `computeMedian`, or `getSkillBucketFromGoalTime` has a call site
anywhere in the 34 downloaded chunks — they're defined but never invoked client-side
in this bundle set. Given the backend-first architecture established in §4/§6 (tRPC
client hitting a Cloud Run service), the most likely explanation is that this shared
math module is isomorphic code bundled for the client but the actual trainer
"next case" decision is made server-side (a `trainer.*`-style tRPC procedure not
captured because its handler runs on the server, not in client JS). This should be
read as **the algorithm's formulas, confirmed to exist in the shared client bundle**,
not as **proof of where/when the algorithm actually executes** — that part is a gap.

No learning-state machine (unlearned/learning/finished, or equivalent), no per-case
mastery/interval/due-date scheduling, and no case-subset/case-set grouping structures
were found anywhere in the 34 chunks.

**Comparison to `src/domain/training.ts`:**
- Case selection: our `chooseTrainingCase`/`caseWeights` computes weight = 
  `max(solveWeight, timeWeight)` capped at 3, where `solveWeight` is a *linear*
  function of how far a case's success-count trails the max-count case (`1 + min(2,
  countDeficit/3)`), and `timeWeight` is linear in how far a case's own recent average
  trails the *overall* average across all cases (`1 + min(2, (average-overallAverage)
  /100)`), both then fed into the same cursor-subtraction roulette-wheel selection —
  structurally the same *selection mechanism* (weighted roulette) as acubemy's
  `selectWeightedRandomCase`, but a materially different and much gentler weighting
  formula (linear, capped 3x, benchmarked against the user's own cross-case average)
  versus acubemy's (quadratic, up to ~100x, benchmarked against population data
  bucketed by the user's own overall solve speed). Ours is **simpler and safer**
  (bounded, no external dataset dependency) but **less adaptive** — it can't tell a
  genuinely-hard case (population-hard even for fast solvers) from a case the user
  personally hasn't drilled yet, since it only compares the user against themselves.
- Learning state / mastery / spaced repetition (`updateMastery`, `learningState`,
  `dueAt` scheduling) and case-subset grouping (`caseSubset`, OLL/PLL family
  groupings, F2L orientation groupings) in our `training.ts` have **no equivalent
  anywhere in the acubemy bundle** — this appears to be entirely our own design (or
  ported from F2LTrainer per the task brief), not something acubemy does client-side
  or exposes to the client at all. Cannot say whether acubemy has this server-side;
  no evidence either way.
- Per-case stats (`caseStats`/`caseTrainingStats`/`caseAverages` — practice count,
  fail count, best time, ao5/ao12 of a specific case's attempts) also has no
  client-side equivalent in the acubemy bundle; the closest analog is the
  population-benchmarked `getExpectedCaseTime` above, which is a different kind of
  per-case statistic (expected value from other users at your speed, not your own
  historical stats on that case).

---

## 6. Persistence

**Not IndexedDB.** No app-specific IndexedDB usage was found. The only `indexedDB`
references across all 34 chunks are:
- `4354-40ffe16b0d2432ad.js` — a generic browser-context-detection probe
  (`"validate-browser-context-for-indexeddb-analytics-module"`) plus the vendored
  `idb` package internals (`function g(e,t,{blocked:n,upgrade:r,...}...)`) — this is
  Firebase Analytics' IndexedDB availability check, not app data.
- `69806262-1d12ea2a53709374.js` — Firebase Auth's IndexedDB-backed persistence
  manager (`"keyChanged"`, `serviceWorkerReceiverAvailable`, `tA`/`tL`/`tU` DB/store
  name constants) — this stores Firebase Auth tokens/session state, not cubing data.

So unlike our repo, acubemy does **not** use IndexedDB as its solve/session/stat store
at all. Instead:

1. **Backend is source of truth.** A tRPC client (`s.SX=(0,i.ec)()` in
   `643-ba659ceca46b66e6.js`, module `10643`) talks to a Cloud Run service
   (`h()`→`"https://acubemy-backend-production-16644438767.europe-west1.run.app"`,
   `c()`→ the `wss://` equivalent for realtime). Sessions (`sessions.getAll/create/
   delete`), statistics (`statistics.getAverageMoveCount`, `statistics.getTPSInsights`),
   and user profile (`users.getProfile`, `users.setUserName`) are all fetched/mutated
   through this client with react-query caching (`useQuery`/`useMutation`, optimistic
   `onMutate` + rollback `onError`). Firebase is used for auth (auth token persisted
   via Firebase's own IndexedDB store, not app data).
2. **localStorage, minimally, for UI state only.** Zustand's `persist` middleware
   writes a `"session-storage"` key holding just `selectedSessionId` and
   `previousSessionId` (confirmed via the `partialize` option restricting what's
   persisted — see the exact code quoted in §4). No solves, no full session objects,
   no algorithm/case records are found in any localStorage-writing code path in these
   chunks.
3. Custom devalue-style serializers were registered for domain types passed over the
   wire (`r.ZP.registerCustom(...)` for `Algorithm`, `DailyScramble`, `MoveSequence`,
   `SliceTurn` — `643-ba659ceca46b66e6.js`), consistent with tRPC/superjson-style
   transport rather than any local DB schema.

**Comparison to `src/storage/database.ts`:** the two apps are architecturally
opposite on this axis. Ours is a versioned local `idb` schema (`openDB(...,5,{upgrade
...})`) with object stores for `rawEvents`, `solves`, `stages`, `findings`,
`attempts`, `algorithms`, `studies`, `revisions`, `metrics`, `prescriptions`,
`transfers`, `settings`, `meta`, `sessions` — every solve, stage, attempt, and
algorithm record lives entirely on-device, with an explicit migration path
(`migrateDefaultSession`) gated by a `meta` flag. acubemy keeps almost nothing on the
device; the browser is a thin, optimistic cache in front of a networked backend, and
the only durable client-side state is "which session tab is currently open." Neither
is a strict improvement over the other for our purposes — our IndexedDB-first design
is what makes fully-offline capture/analysis possible, which acubemy's backend-first
model does not appear to support at all (every session/stat/profile action in the
bundle assumes network reachability, softened only by react-query optimistic UI, not
true offline queuing/replay). This is worth flagging explicitly since it means
acubemy's persistence code is not something to imitate if offline-first remains a
requirement for this app.

---

## Summary table

| Area | acubemy (as observed) | Ours (`src/domain`, `src/storage`) | Verdict |
|---|---|---|---|
| Average trim rule | `ceil(0.05*count)` trimmed per side, uniformly at every count, DNF sorts as +Infinity | Same net trim via `trim - dnfs` back-adjustment after removing DNFs upfront; special-cased below count 5 | Equivalent for practical windows (ao5/12/50/100/1000); minor divergence only below count 5 |
| +2 handling | Folded into value (`totalTime+2000`) | Folded into value (`endedAt-startedAt+2000`) | Equivalent |
| DNF-in-window gating | Whole average invalidated if DNFs > trim allowance | Same condition (`dnfs > trim`) | Equivalent |
| Best-window scan | Incremental sorted-window + binary insert/remove, `O(n log n)`, but only seen used in a one-off `useMemo` over full history, not a persisted per-solve NOW/BEST store | Brute-force re-slice-and-sort per window, `O(n²)`-ish | Ours is worse algorithmically but likely irrelevant at current volumes; live-timer NOW/BEST maintenance in acubemy could not be located in this bundle |
| Personal-best target | Not found anywhere in the bundle | Binary search over synthetic candidate solve | Cannot compare — no acubemy client-side equivalent found |
| Session storage | Backend (tRPC/Cloud Run) is source of truth; only selected/previous session id cached in localStorage | Full session + solve records in local IndexedDB | Architecturally opposite (online-first vs. offline-first) |
| Trainer case selection | Roulette-wheel on quadratic weight `(100-score)²` from population-benchmarked performance score; call site not found (likely server-side) | Roulette-wheel on linear weight capped at 3x, benchmarked against user's own cross-case average | Same mechanism, more aggressive/adaptive formula in acubemy; ours is simpler/bounded |
| Learning states / SRS / case subsets | Not found anywhere in the bundle | Full mastery/interval/due-date model, OLL/PLL/F2L subset grouping | No acubemy client-side equivalent found — likely our own design, unverifiable against acubemy either way |
| Per-case stats | Population-benchmarked expected time only (`getExpectedCaseTime`) | Practice/fail count, best time, ao5/ao12 of own attempts | Different kind of statistic; not directly comparable |
| Persistence | No app IndexedDB use; tRPC + Cloud Run backend; localStorage only for `selectedSessionId`/`previousSessionId` | Full `idb`-backed local schema, 13 object stores, versioned migrations | Structurally opposite; not a like-for-like target to imitate given our offline-first requirement |
