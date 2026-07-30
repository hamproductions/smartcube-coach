# Browser evidence

Public deployment: https://hamproductions.github.io/smartcube-coach/

Verified with `agent-browser` on 2026-07-30. Simulator evidence proves application capture, reconstruction, persistence, coaching, and training behavior. It does not certify physical Bluetooth/GATT compatibility.

## Current workflow matrix

| Workflow | Runtime | Result | Evidence |
| --- | --- | --- | --- |
| Live Solve simulator | Vite, 1440 × 1000 | Scramble applied to canonical state, capture reached `ready`, inverse solve completed and persisted | IndexedDB readback: one solve and 42 immutable raw events |
| Solve history and replay | Vite, 1440 × 1000 | Persisted solve rendered with interactive 3D playback | Browser DOM assertion |
| Reconstruction revision | Vite, 1440 × 1000 | Revision saved with 21 solve-phase source-event links | IndexedDB revision readback |
| Trainer grading | Vite, desktop | Incorrect and exact typed answers persisted separately; zero-hint Drill labels hidden | `TrainerHub.test.tsx` and browser workflow |
| reco.nz study | Vite, 1440 × 1000 | Public solve 13444 imported with attribution, stages, 3D playback, private notes, and cross bookmark | `vector-library-reco-desktop.png` and IndexedDB readback |
| Progress | Vite, 390 × 844 | Persisted solve/training data rendered without positive horizontal overflow | `vector-progress-mobile.png` |
| Live Solve mobile | Vite, 390 × 844 | Dense capture surface rendered without positive horizontal overflow | `vector-live-solve-mobile.png` |
| Production offline restart | Production build, 1440 × 1000 | Service worker cached hashed JS/CSS; app reloaded after the production server was stopped | `vector-production-offline-v2.png` |

## Responsive measurements

- Desktop viewport: 1440 × 1000
- Mobile viewport: 390 × 844
- Mobile document width: 375
- Mobile positive horizontal overflow: 0

## Screenshots

- `coach-cockpit-desktop-agent-browser.png`
- `coach-cockpit-mobile-agent-browser.png`
- `vector-library-reco-desktop.png`
- `vector-progress-mobile.png`
- `vector-live-solve-mobile.png`
- `vector-production-offline-v2.png`
- `vector-pages-local.png`
- `vector-pages-public.png`
- `vector-pages-public-live-solve.png`

## Runtime diagnostics

- Checked online workflows returned no page errors.
- Current online console output contained Vite lifecycle messages and the React development-tools notice only.
- Production offline reload rendered `Close the gap.` after the server process was terminated.
- The offline reload produced no application console output.

## Hardware boundary

No physical smart cube was available. The following remain uncertified rather than simulated:

- Bluetooth permission UX
- GATT pairing and reconnect behavior
- Device/protocol compatibility
- Physical battery, facelet, gyro, and clock reports
- Packet-loss behavior on real hardware
- Physical scramble verification
