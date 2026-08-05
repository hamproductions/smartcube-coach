> **Superseded (2026-08-04, later).** The ingestion path described below was
> `src/components/LiveSolve.tsx`, which has since been deleted — it was unreachable from the
> app. Ingestion now runs through the shared `CaptureSession` in `src/device/CubeConnection.tsx`
> and `src/device/capture.ts`, and the correction mechanisms named here (`generateCorrection`,
> `acceptCurrentState`) are gone; see `strictScrambleProgress`, `offTrack`/`matchedIndex`, and
> the state-based `shortestFix`. Re-verify any conclusion in this section before relying on it.

# acubemy bundle analysis — 2026-08-04

Read-only reverse-engineering of the production JS bundles at `/tmp/refs/acubemy/`
(34 chunks + `index.html`, downloaded Next.js output, minified).

**Licence note:** acubemy is closed source. Its bundle is not licensed for copying.
Everything below is a description of *observed behaviour* (state machines, data
shapes, formulas, event names) inferred by reading the minified output — never a
transcription of its source, and nothing here should be pasted into this repo.
Where this app's own code implements the same behaviour, it does so independently
(see `src/domain/faceletReconciliation.ts`, `src/domain/statistics.ts`, etc.),
written before/without reference to acubemy's implementation details beyond the
high-level behaviour documented here.

Chunks that mattered: `7839-82bec37ab48c7b59.js` (1.3 MB — bluetooth cube
protocol drivers, gyro handling, a custom `CubeState`/`MoveSequence` engine, CFOP
analysis serialization), `8122-a01019da8834d031.js` (176 KB — 3D cube renderer,
sticker-scheme/teaching overlays, recognition timeline builder), `451-84df600ea32235cb.js`
(26 KB — the full averages/statistics module), `643-ba659ceca46b66e6.js` (their
`CubeState` class), `8107-9a6fe2da10bee084.js` (CFOP recognition/execution split),
`7563-8522c4e7a4653250.js` (settings UI — inspection audio warnings, DNF/+2 flag
badges). `page-*.js` and the remaining large numeric chunks (`4354`, `1053`,
`8083`, `8648`, `c3f2cda1`, `9732`, `83607670`, `69806262`, `3f8f5523`, `618f8807`,
`6a1f7758`, `e646c3ff`) turned out to be marketing/landing page code, Firebase
auth, Chart.js, Framer Motion, and Three.js core — not cube logic.

## 1. Timer

**Not found as an isolated state machine.** No `startSolve`/`stopSolve`/
`solveStarted` symbols, no `keydown`/`Space` handlers, and no `SOLVING`/
`INSPECTING` phase enum turned up in any of the 34 chunks. The manual/keyboard
timer screen is very likely a route chunk that wasn't part of this bundle set.

What *is* confirmed, in `7563-8522c4e7a4653250.js` (settings UI):

```
"Inspection Time Warnings"
"Play audio warnings at 8 and 12 seconds during inspection time"
```

— i.e. acubemy plays audio cues at 8s/12s into inspection (not host-side +2/DNF
enforcement logic itself, just the warning cue). A persisted `timer` preference
object exists (`7839-82bec37ab48c7b59.js`):

```
timer:{spacebarHoldThreshold:300}
```

confirming a hold-to-start keyboard timer exists, with a configurable hold
threshold (clamped 0–1000 ms via `setTimerPreference`), but its actual
countdown/hold logic isn't in these chunks.

DNF/+2 are UI toggle flags applied *after* a solve is recorded, not computed from
elapsed time automatically (from `8122-a01019da8834d031.js`):

```
onClick:()=>M("plus_two"===y.flag?"none":"plus_two")
...
onClick:()=>M("dnf"===y.flag?"none":"dnf")
```

**Clock authority (bluetooth path):** confirmed in `7839-82bec37ab48c7b59.js`.
Every `MOVE` event carries three timestamp fields — `timestamp`, `localTimestamp`,
`cubeTimestamp`. For GAN cubes, `cubeTimestamp` is accumulated from the device's
own hardware clock deltas (`this.cubeTimestamp+=a` where `a` is a 16-bit delta
read off the packet); `localTimestamp`/`timestamp` are `Date.now()` (host clock)
or the BLE notification's `timestamp` variable. For non-GAN drivers (MoYu,
QiYi), there is no real device clock at all: every field is stamped with
`Date.now()` at receipt, and QiYi's `cubeTimestamp` is just a `1.6×` guess-scaled
copy of a device counter (`cubeTimestamp:1.6*e.timestamp`). So acubemy's real
authoritative clock is the **host clock** in the general case, with a genuine
device clock only for GAN, used as auxiliary data — not the sole source of truth.

**This app vs. acubemy:** `src/device/capture.ts` does something more principled:
`fitCubeTimestamp()` least-squares-fits a `cube → host` linear mapping from
`{cube, host}` sample pairs, so cube-clock timestamps (when present) get
reprojected onto the host clock instead of trusted or discarded outright.
`inspectionPenalty()` is an explicit, testable function (`>17s → dnf`, `>15s →
+2`), computed automatically from `hostTimestamp - inspectionStartedAt` inside
`CaptureSession.handleMove()` — i.e. this app derives the penalty from real
elapsed time, where acubemy's chunks only show the penalty as a manually-toggled
UI flag plus optional audio warnings at 8s/12s.

## 2. Scramble tracking / wrong-move handling

No `scrambleMatch`, `isScrambled`, `matchesScramble`, or any "wrong move"
concept was found anywhere in the 34 chunks — this is a genuine negative result,
not a miss: I grep'd variants (`wrongMove`, `invalidMove`, `unexpectedMove`,
`out of sync`) across every file. The only "sync" warning in the whole bundle
set is a **protocol-level** one in the QiYi driver, unrelated to scramble
matching:

```
console.error("[QiYi Driver] Cube is out of sync. Please reconnect. Current move:",e,"Previous moves:",this.previousMovesQueue[s])
```

That fires when a move's timestamp is out of order versus the driver's own
move-echo queue — a BLE packet-ordering sanity check, not a "you turned the
wrong way during scrambling" feature.

**This app does something acubemy's bundles show no evidence of:**
`src/domain/scramble.ts`'s `nextExpectedMove()` walks the target scramble move
by move, comparing facelet states (`faceletsOf(turnAll(...))`) after filtering
out rotations, to find how far the physical cube has actually progressed versus
the scramble, and reports the single wrong move (`actual: onScript ? undefined :
turns[turns.length-1]`) plus a live correction algorithm
(`generateCorrection` — inverse of what was turned, then re-apply the target).
`CaptureSession.handleMove()` in `src/device/capture.ts` drives a state machine
(`idle → scrambling → ready → inspection → solving → complete`) around this,
including handling a hand-scrambled cube: `acceptCurrentState(setupAlg)` lets
the session re-baseline to whatever state the cube is actually in and switch
straight to `ready`. Acubemy's chunks show no equivalent.

## 3. Cube state sync (moves vs. facelets)

Strong, concrete finding. In the bluetooth-connect hook (`7839-…js`), the event
subscription is:

```
w.current=M.events.subscribe(e=>{switch(e.type){
  case"MOVE":A(e.move,e.timestamp);break;
  case"FACELETS":E(e.facelets);break;
  case"DISCONNECT":O();break;
  case"BATTERY":N(e.batteryLevel);break;
  case"GYRO":Q(e.quaternion)}})
```

where `A=(e,s)=>m.current.emit("cubeMove",e,s)` (moves are re-emitted for
consumers) but **`E=e=>{}`** — the `FACELETS` handler is a literal no-op. A
`REQUEST_FACELETS` command is sent once on connect, but nothing in this hook (or
in `8122-a01019da8834d031.js`, the live-solve/analysis screen chunk, which has
no `"FACELETS"` handling at all) consumes the reply for anything user-visible.
Move accumulation is authoritative: acubemy built its own kinematic engine —
`CubeState` (in `643-ba659ceca46b66e6.js`, with `.equals()`, `.isSolved()`,
`.applyMove()`, `.applyAlgorithm()`) and `MoveSequence` — and every CFOP/Roux/ZZ
analysis function in `7839-…js` replays the accumulated move stream through it
(`e.applyMove(t.sliceTurn),u.addMove(t)`), never cross-checking against a
device-reported facelet string. There is no user-visible "mismatch" or "resync"
UI anywhere in these chunks.

**This app does the opposite, deliberately:** `src/domain/faceletReconciliation.ts`'s
`FaceletReconciler` treats FACELETS readings as a real oracle *when they're
device-sourced*, applies the pending move buffer to the last baseline
(`applyFaceletMoves`), compares to the new reading, and logs a `FaceletDisagreement`
on mismatch — explicitly modeling that most cubes' FACELETS packets are a
driver-side echo (`FaceletSource: 'device' | 'echo'`) and only trusting an echo
disagreement as informational, never freezing state on it (comment in the file:
"a per-move echo is not an independent check"). This is a considered design this
app has and acubemy's bundle shows no equivalent of.

## 4. Live cube rendering

acubemy does **not** use `cubing/twisty`'s `<twisty-player>` — none of
`experimentalAddMove`, `setupAnchor`, `tempoScale`, `catchUpMove`, `jumpToEnd`,
or the string `"cubing"` (as a package name/twisty reference) appear anywhere.
Instead `8122-a01019da8834d031.js` has a hand-built Three.js cube (GLTF piece
models loaded via a `useGLTF`-style hook) with its own move-animation queue:

```
y=useRef({active:!1,axis:0,layers:[],angleStart:0,angleEnd:0,prevAngle:0,startTime:0,duration:0,queue:[]})
...
D=function(e,t=1,n){
  if(y.current.active&&void 0!==n){y.current.targetProgress=n;return}
  if(y.current.active&&void 0===n){y.current.queue.push({move:e,duration:t,targetProgress:n});return}
  let{rotation_axis:r,rotation_layers:l,angle_end:a}=f(e);
  y.current.axis=r;y.current.layers=l;y.current.angleEnd=a;y.current.active=!0;
  y.current.startTime=performance.now()/1e3;y.current.duration=t*(180===e.rotation?.2:.1);
  y.current.targetProgress=n;y.current.prevAngle=0
}
```

`D()` is their move dispatcher: if a rotation is already animating it queues the
next move (their equivalent of a catch-up queue) rather than dropping it;
`f(e)` (see §5) decodes move notation into a rotation axis/layer set/angle that
drives the animation per-frame via `performance.now()`.

**This app's approach is architecturally different but functionally
analogous:** `src/components/CubePlayback.tsx` *does* use `cubing/twisty`'s
`<twisty-player>` with the exact primitives acubemy avoids —
`experimentalAddMove`, `tempoScale`, `catchUpMove.addFreshListener`, and a
`liveMoveQueue` that gets drained one move at a time, escalating tempo as the
queue backs up (`getLiveQueueTempo`). The setup alg is not rebuilt from scratch
on every update: `appendedMoves` detects when the new `setupAlg` is a strict
suffix-extension of the previous one and pushes only the delta through
`experimentalAddMove`, falling back to a full `experimentalSetupAlg` reset (with
queue/animation state cleared) only when the prefix relationship breaks —
i.e. this app treats "setup alg set once, extended incrementally" as the common
case, same intent as acubemy's queue-based `D()`, just built on the standard
`cubing/twisty` component instead of a custom Three.js renderer.

## 5. Move notation

acubemy's move decoder, `f(e)` in `8122-…js`:

```
function f(e){let t,n;let r=-.5*e.rotation*Math.PI;
switch(e.slice){
 case"U":n=[2],t=1;break;case"u":n=[1,2],t=1;break;
 case"D":n=[0],t=1,r*=-1;break;case"d":n=[0,1],t=1,r*=-1;break;
 case"R":n=[2],t=0;break;case"r":n=[1,2],t=0;break;
 case"L":n=[0],t=0,r*=-1;break;case"l":n=[0,1],t=0,r*=-1;break;
 case"F":n=[2],t=2;break;case"f":n=[1,2],t=2;break;
 case"B":n=[0],t=2,r*=-1;break;case"b":n=[0,1],t=2,r*=-1;break;
 case"x":n=[0,1,2],t=0;break;case"y":n=[0,1,2],t=1;break;case"z":n=[0,1,2],t=2;break;
 case"M":n=[1],t=0,r*=-1;break;case"E":n=[1],t=1,r*=-1;break;case"S":n=[1],t=2;break;
 default:throw Error("Slice ".concat(e.slice," not supported."))
}
return{rotation_axis:t,rotation_layers:n,angle_end:r}}
```

Wide moves (lowercase `u/d/r/l/f/b`) are just the outer-layer face plus the
adjacent middle layer (`n=[1,2]` vs `n=[2]` for `U`/`u`); whole-cube rotations
`x/y/z` turn all three layers on the corresponding axis (`n=[0,1,2]`); slice
moves `M/E/S` turn only the middle layer. Every one of these is dispatched
through the same animation queue (`D()`, §4) — **cube rotations (`x`/`y`/`z`)
are first-class moves derived from notation, not driven by gyro data.** Gyro
*is* real and used elsewhere (`Q=e=>{...m.current.emit("gyro",s)}`,
`qFromEulerZYX`, `qMul`/`qConj` quaternion math in the connect hook) but only to
orient the *camera/viewport* to match how the physical cube is held — a
separate concern from applying `x/y/z` to the rendered cube state.

**This app:** `src/domain/cubeMath.ts`/`scramble.ts` and the twisty-player setup
algs are plain WCA notation strings (`U R2 F' ...`) fed to `cubing/alg`/`cubing/
kpuzzle`; `nextExpectedMove()` explicitly filters out rotations before facelet
comparison (`actualMoves.filter((move) => !/^[xyz]/i.test(move))`), i.e. this app
also treats `x/y/z` as notation-level moves rather than gyro-derived — same
underlying assumption as acubemy, arrived at independently (this app has no
gyro/orientation feature at all, so there's no camera-vs-cube-state split to
reconcile).

## 6. Stats (ao5/ao12/ao50/ao100/ao1000, DNF, PB target)

The complete module lives in `451-84df600ea32235cb.js`:

```
function n(e){return Math.ceil(.05*e)}                          // solves to drop
function l(e){return"dnf"===e.flag?1/0:s(e)}                    // effective time
function s(e){return"plus_two"===e.flag?e.totalTime+2e3:e.totalTime} // display time
function a(e){let t=n(e.length);
  return e.sort((e,t)=>e-t).slice(t,-t).reduce((e,t)=>e+t,0)/(e.length-2*t)}
t.getAverageOf5=e=>r(5,e); t.getAverageOf12=e=>r(12,e); t.getAverageOf100=e=>r(100,e)
```

Trim count is a uniform `ceil(5% × n)` rule (1 for n=5/12, 5 for n=100) applied
to both ends — the standard WCA/CubeDesk average convention, generalized to any
N rather than hardcoding "drop best 1, worst 1" only for 5/12. `getBestAverageOf`
brute-forces every sliding window of size N over ordered solves and keeps the
minimum trimmed mean (personal-best search). `getBestAverageOfSolves` does the
same but DNF-aware and with a sorted-array + binary-search incremental
maintenance (`splice`) instead of resorting every window — an optimization for
large histories. The DNF rule, in `computeAverageWithFlags`/`getBestAverageOfSolves`:
an average only counts as DNF if the number of DNFs in the trimmed group exceeds
the trim count `r` (`if(u>r)return` skips considering that window at all) —
i.e. it generalizes "an ao5 is DNF if 2+ solves are DNF" to arbitrary N via the
same 5%-trim number, rather than a hardcoded ">1" everywhere.

**This app:** `src/domain/statistics.ts`'s `averageOf()` implements essentially
the same rule shape independently — `trim = Math.ceil(count * 0.05)`,
`dnfs > trim ? undefined : mean(...)`, `count < 5` short-circuits to a plain
mean with any DNF invalidating it (matching acubemy's n=5/n=1 trim-of-0 edge
case implicitly). `bestAverageOf()` is the same brute-force sliding-window
search acubemy's `getBestAverageOf` does (not the optimized incremental version
acubemy also has). One clear feature difference: this app's `personalBestTarget()`
binary-searches for the exact solve time needed on the *next* attempt to beat
the current best average — a target-time computation with no equivalent found
anywhere in acubemy's stats module.

## Addendum — live-solve smoothness (2026-08-04, follow-up pass)

Re-read `7839-82bec37ab48c7b59.js` and `8122-a01019da8834d031.js` with the
formatter approach (`node -e` pretty-print / break-on-`;`) instead of bare
token grep, specifically for the four things that make a live solve *feel*
fast: renderer pacing, ingestion path, timer loop, and cube-state model. Same
licence caveat as above: behaviour only, quoted for checkability, never
source to copy. Two other agents are covering stats/PB and scramble
tracking/segmentation in parallel; this section stays scoped to rendering,
ingestion, timer, and state-model.

### 1. Live cube rendering — no `cubing/twisty`, a hand-rolled rAF queue

acubemy still shows no `experimentalAddMove`/`setupAnchor`/`tempoScale`/
`catchUpMove`/`jumpToEnd`/`cubing/twisty` anywhere in the bundle. It has (at
least) two independent custom cube renderers — a Three.js/GLTF one in
`8122-a01019da8834d031.js` and a CSS-transform sticker-grid one, further down
in the same chunk, exposed via `useImperativeHandle` as `animateMove`. Both
are driven the same way: a single `requestAnimationFrame` loop reading
`performance.now()` against a **ref**, not React state:

```
W=(0,i.useCallback)((e,t,n,a)=>{let s=Z[e]||1;
  N.current=Object.assign({},N.current,{active:!0,slice:e,angle:0,
    targetAngle:90*Math.abs(t),direction:s*Math.sign(t),
    startTime:performance.now(),duration:n,targetProgress:a});
  M(e),R(0)},[]);
useEffect(()=>{let e;let t=()=>{let n=N.current;
  if(n.active){
    let elapsed=performance.now()-n.startTime;
    let progress=n.targetProgress ?? Math.min(1, elapsed/n.duration);
    progress=Math.min(1,progress);
    R(n.targetAngle*progress*n.direction);
    if(progress>=1 && n.targetProgress===undefined){
      N.current.active=!1; M(null); R(0);
      let turns = n.direction>0 ? n.targetAngle/90 : -n.targetAngle/90;
      H(n.slice, turns); // <- commits the permutation to sticker-grid state, once
      if(N.current.queue.length>0){
        let next=N.current.queue.shift();
        W(next.slice,next.rotation,next.duration,next.targetProgress)
      }
    }
  }
  e=requestAnimationFrame(t)
};return e=requestAnimationFrame(t),()=>cancelAnimationFrame(e)},[H,W]);
```

and the public entry point new moves arrive through:

```
animateMove:(e,t,n)=>{
  ...
  let duration=(Math.abs(e.rotation)>=2?200:100)*t;   // t = caller-supplied timescale
  if(N.current.active && n!==undefined){N.current.targetProgress=n;return}
  N.current.active
    ? N.current.queue.push({slice:r,rotation:e.rotation,duration,targetProgress:n})
    : W(r,e.rotation,duration,n)
}
```

Key properties, all directly checkable in that excerpt:

- **Per-move, never batched into one jump.** A move that arrives mid-animation
  is pushed onto `N.current.queue` (FIFO) and only starts once the current one
  finishes — there is no `jumpToEnd`/skip-ahead path in either renderer.
- **The only thing that changes when moves back up is speed, via a
  caller-supplied `t` timescale multiplier on `duration`** — the loop itself
  never special-cases queue depth; whoever calls `animateMove` decides how much
  to compress `duration` for a given backlog. That caller isn't present in
  these chunks (likely the un-downloaded live-solve route), so the exact
  backlog→speed curve isn't verifiable here, but the mechanism is.
- **React state writes are minimal and off the hot path.** Per animation
  frame, only two numeric/derived pieces of state are touched (`R` — the
  current rotation angle, `M` — the active slice id); the actual sticker
  permutation (`H`, updating `y`/`w` state — the color grids) commits **once**,
  at the end of the move, not every frame. Everything else driving the
  animation (`active`, `angle`, `startTime`, `duration`, `queue`) lives in a
  ref (`N.current`), invisible to React's render cycle entirely.
- Duration scaling by rotation ("half-turns take longer") — `(|rotation|>=2 ?
  200 : 100) * t` — mirrors a common cubing convention (double turns feel
  ~2× a quarter turn) rather than a fixed per-move duration.

**This app (`src/components/CubePlayback.tsx`) is closer to this than it looks,
architecturally, but built on the standard library instead of a custom
renderer:** it drains its own `liveMoveQueue` one move at a time via
`experimentalAddMove`, and — like acubemy — speeds up rather than skips when
behind, via `getLiveQueueTempo` (`tempoScale.set` ramps 4→100 as
`pendingCount` grows 0→4+) and `catchUpMove.addFreshListener`. The setup alg
is also not rebuilt wholesale each time: `appended` detects a strict
suffix-extension of the previous `setupAlg` and pushes only the delta through
`experimentalAddMove`, matching the "set once, extend incrementally" intent
inferred from acubemy's `W()`/queue design. **The animation-timing state
here, however, is not a same-effect ref-driven rAF loop — it rides entirely on
whatever `cubing/twisty`'s internal `TwistyAnimationController` does (its
`catchUpMove` listener + `tempoScale`), which this app does not control or
inspect frame-by-frame.** That's a reasonable choice (don't reinvent a working
animation controller) but it does mean this app cannot independently verify
or tune the exact catch-up cadence the way acubemy's visible `N.current`
ref-loop can be reasoned about from source. Net: equivalent design intent
(queue + speed-up, never drop/jump), different level of control.

### 2. Event ingestion path — the actual smoothness gap

acubemy's ingestion, in `7839-82bec37ab48c7b59.js`, is a **flat, synchronous
re-dispatch**, no batching/throttling/worker:

```
w.current = M.events.subscribe(e=>{switch(e.type){
  case"MOVE": A(e.move,e.timestamp); break;   // A = (e,s)=>m.current.emit("cubeMove",e,s)
  case"FACELETS": E(e.facelets); break;        // E = e=>{}  (no-op, see §3 above)
  case"DISCONNECT": O(); break;
  case"BATTERY": N(e.batteryLevel); break;
  case"GYRO": Q(e.quaternion)
}})
```

`A` does nothing but re-emit on a plain `EventEmitter` (`m.current`, a `new
(P())` — a Node-style emitter shimmed for the browser) — no `await`, no
persistence, no state update at this layer at all. Whatever subscribes to
`"cubeMove"` (not present in these chunks) is handed the move synchronously,
on the same microtask the BLE notification arrived on, and it's *that*
consumer's job (§1's `animateMove`) to queue/pace via its own rAF loop.
Nothing here writes to a database, and no `Worker`/`postMessage` exists
anywhere in this 1.3 MB chunk — persistence and analysis are not part of the
live path at all; the CFOP analysis code (§ found earlier) works from a whole
recorded move sequence after the fact, not incrementally per move.

**This app's ingestion path is fundamentally heavier, and this is the most
concrete, checkable candidate for "movement doesn't feel smooth":**
`enqueueEvent` (`src/components/LiveSolve.tsx:476-483`) chains every incoming
event onto a single serialized promise (`eventQueue.current = eventQueue.current.then(() => recordEvent(...))`),
and `recordEvent` (`:352-474`) `await`s an **IndexedDB write**
(`repositories.rawEvents.put(raw)`) before it does anything else — including
before it calls `liveCube.current.applyMove(event.move)` and
`setLiveSetupAlg(afterMove.setupAlg)`, the two lines that feed the live
`CubePlayback` twisty player:

```
await repositories.rawEvents.put(raw)
if ((version !== undefined && version !== connectionVersion.current) || lifecycleVersion !== lifecycleGeneration.current) return
if (event.type === 'MOVE') {
  faceletReconciler.current.recordMove(event.move)
  const afterMove = liveCube.current.applyMove(event.move)
  setLiveSetupAlg(afterMove.setupAlg)
  setFacelets(afterMove.facelets)
  setPhysicalSolved(afterMove.solved)
  await session.handleMove(event.move, event.cubeTimestamp ?? null, toEpochMs(event.timestamp))
  ...
}
```

Because processing is serialized through one promise chain
(`eventQueue.current`), **move N+1 cannot even begin its own IndexedDB write,
facelet reconciliation, or `setLiveSetupAlg` until move N's full chain —
including `session.handleMove`'s own internal scramble/solve evaluation
(`evaluateScramble`, itself calling into `cubing/kpuzzle`) — has resolved.**
At sustained turn rates (5-10+ TPS for anyone acubemy is being benchmarked
against), IndexedDB write latency and the async scramble/kpuzzle evaluation
inside `session.handleMove` are squarely in the critical path before the
twisty player ever sees the move — there is no rAF, no worker, and no
"animate now, persist later" split. acubemy's ingestion layer does none of
that: it hands the move to the renderer's own pacing loop immediately and
apparently persists/analyzes only after the solve, off the live path
entirely. This is the single largest architectural difference found and the
most defensible explanation for a perceived smoothness gap — it is in the
ingestion path, not (only) in the renderer choice from §1.

### 3. Timer loop

Still not locatable as an isolated module in these 34 chunks — no
`keydown`/`Space`/`holdThreshold` consumer, no dedicated `useTimer`-shaped
hook, beyond the settings-persistence code already reported (§1 of the main
report): `timer:{spacebarHoldThreshold:300}` and the 8s/12s inspection audio
cue strings. The actual running-clock display/update mechanism (interval vs.
rAF vs. CSS) is not present in the downloaded chunk set; most likely it lives
in a route chunk that wasn't part of this bundle pull. Flagging this as a
genuine gap rather than guessing.

**This app's timer loop, for direct comparison:** two independent
`setInterval(..., 50)` tickers in `LiveSolve.tsx` (one for the cube-driven
`snapshot.status === 'solving'` display, one for the keyboard timer's running/
inspection phases), each just bumping a `tick` state counter to force a
re-render; the actual elapsed value is computed fresh from `Date.now() -
startedAt` (host clock) on each render, not accumulated — so the interval is
purely a redraw pulse, not the time source. 50ms polling is a plausible but
unverified-against-acubemy choice (a rAF-driven display, sampled every frame,
would track more smoothly than a 50ms/20fps interval, especially under load
from the ingestion-path bottleneck in §2 competing for the main thread).

### 4. Cube state model

Confirmed and expanded from the main report: acubemy's `CubeState` class
(`643-ba659ceca46b66e6.js`) is a resident **cubie/pattern model** —
`edges`/`corners`/`centers` arrays with `.applyMove()`/`.applyAlgorithm()`/
`.isSolved()`/`.equals()` operating directly on that array representation.
Facelets are a pure *derived* read, computed on demand via the sticker-lookup
function found in `8122-…js` (`p(e,t)` — indexes into the cubie arrays to
produce a facelet color per sticker position), never the other way around.
The device's own `FACELETS` reports are discarded (no-op handler, §3 of the
main report) — moves accumulated into the resident `CubeState` are the only
authority, and there is no user-facing disagreement/mismatch signal of any
kind, because nothing ever compares the two.

**This app inverts the representation and pays a conversion cost every
move.** `src/domain/liveCubeState.ts`'s `applyMove()` calls
`applyFaceletMoves(this.state.facelets, [move])`
(`src/domain/faceletReconciliation.ts:26-28`), which does
`faceletsOf(turnAll(cubeFromFacelets(facelets), moves))` — i.e. **every
single move parses the 54-char facelet string back into a cubie model
(`cubeFromFacelets`), applies the move to that cubie model, then serializes
back to a facelet string (`faceletsOf`)**, discarding the cubie
representation each time rather than keeping it resident like acubemy's
`CubeState`. Functionally this app's design is more capable — it keeps
`facelets` as the primary representation specifically so it can compare
device-reported facelets against move-accumulated ones and surface real
disagreement (`FaceletReconciler`, `LiveCubeSnapshot.lastDisagreement`, UI
copy like "Your cube reported an impossible sticker layout" /
"Stickers match the turns we recorded" in `LiveSolve.tsx`) — a feature
acubemy's bundle shows no equivalent of at all. But it is doing strictly more
work per move (parse + apply + serialize vs. acubemy's apply-only on a
resident model) precisely on the same hot path identified as the bottleneck
in §2.

### Bottom line for "why acubemy feels smoother"

Ranked by how directly each maps to *perceived per-move smoothness*, not
overall feature completeness:

1. **Ingestion path (§2) is the primary suspect.** acubemy hands a move to
   its renderer synchronously and does no persistence/analysis inline; this
   app serializes every move through an `await`ed IndexedDB write plus a
   scramble/kpuzzle evaluation before the twisty player is even told about
   it, via one single-file promise chain (`eventQueue.current`) with no
   escape hatch for the renderer to run ahead of persistence.
2. **Cube-state model (§4) compounds it.** This app's `cubeFromFacelets` →
   `turnAll` → `faceletsOf` round-trip runs on every move, on the same path
   as #1, where acubemy's resident cubie model applies a move in place.
3. **Renderer choice (§1) is close to a wash.** Both this app and acubemy
   implement "queue, never drop, speed up under backlog" — this app rides
   `cubing/twisty`'s built-in `catchUpMove`/`tempoScale`, acubemy hand-rolls
   an equivalent rAF+ref loop. Neither is obviously worse in design; this
   app's version is just less independently inspectable.
4. **Timer loop (§3) is likely a minor contributor at most** — a 50ms
   `setInterval` redraw pulse competing with the ingestion-path work on the
   same main thread would visibly stutter under load even though the
   underlying clock source (`Date.now()`) is fine; acubemy's own timer
   mechanism could not be located to compare directly.

## Summary of behavioural differences

| Area | acubemy (observed) | This app |
|---|---|---|
| Timer engine | Not present in downloaded chunks; only a settings-level hold-threshold + audio-warning config found | Explicit `CaptureSession` state machine, penalty computed from elapsed host time |
| Clock authority | Host `Date.now()` for all non-GAN cubes; device clock only for GAN, used as-is | Host clock, cube clock linearly re-fit to host via least squares (`fitCubeTimestamp`) |
| Scramble tracking / wrong move | No concept found (only a BLE packet-order sanity check) | Explicit `nextExpectedMove` + correction-alg generator, hand-scramble re-baseline |
| Facelets vs. moves | Facelets literally ignored (`E=e=>{}`); moves replayed through custom `CubeState` | Facelets used as a real oracle for device-sourced readings, moves reconciled against them, mismatches logged, echoes never trusted as independent |
| Rendering | Custom Three.js renderer + own move-animation queue; no cubing.js | `cubing/twisty` `<twisty-player>`, incremental setup-alg extension, catch-up-move-driven tempo ramp |
| Notation | Custom axis/layer/angle decoder for wide/slice/rotation moves; rotations from notation, gyro only orients camera | WCA alg strings via `cubing/alg`; rotations filtered out before facelet comparison; no gyro feature at all |
| Stats | ceil(5%) trim rule, DNF-aware sliding-window PB search (optimized) | Same trim/DNF rule (unoptimized sliding window), plus a target-time-to-beat-PB feature not seen in acubemy |
