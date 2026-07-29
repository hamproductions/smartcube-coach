# Browser evidence

Verified against the Vite runtime at `http://127.0.0.1:4173` with `agent-browser`.

## Desktop

- CSS viewport: 1440 × 1000
- `window.innerWidth`: 1440
- `document.documentElement.scrollWidth`: 1425
- Positive horizontal overflow: 0
- Screenshot: `coach-cockpit-desktop-agent-browser.png`

## Mobile

- CSS viewport: 390 × 844
- `window.innerWidth`: 390
- `document.documentElement.scrollWidth`: 375
- Positive horizontal overflow: 0
- Screenshot: `coach-cockpit-mobile-agent-browser.png`
- Confirmed visible without clipping: confidence badge, 1.14-second primary metric, median/gate/recoverable comparisons, evidence range, actions, prescription, all seven stage cards, trend and secondary findings.

## Interactions

- Opened the verified roast and read back its DOM text, including `1.14 seconds` and `7 of the last 12 solves`.
- Completed the first training block and confirmed class `training-block completed` with state text `DONE✓`.
- `agent-browser errors` returned no page errors.
- Console output contained only Vite connection messages and the React development-tools notice.

The CLI's semantic/ref click reported success without dispatching against this local React runtime. Explicit DOM `click()` through `agent-browser eval` triggered the React state changes, which were then asserted through visible text and DOM state.
