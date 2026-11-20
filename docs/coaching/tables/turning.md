# Turning mechanics, pauses, fumbles, rotations, gyro

Source: acubemy last 1000 solves (GAN i4), sorted oldest to newest. Times in seconds (2 dp) unless marked ms. Non-CFOP solves: 2 (excluded from every stage-based table; included in whole-solve tables). Bootstrap: 2000 resamples of solves, seed 20261120, 95% percentile CI. LOW-N = group n<30.
Move units: "raw" = quarter turns as reported by the cube (half turn = 2 raw); "turns" = acubemy turnCount (half turn = 1; app TPS = turns/totalTime).
Gap = ts[i]-ts[i-1] between consecutive raw quarter turns. Pause = gap > 500 ms unless stated. Stage k owns raw moves with stage.start < ts <= stage.end (ts 0 belongs to cross); stage-leading gap = gap before the first raw move of the stage (equals recognition).
Alignment of raw moves to reconstruction tokens (needed for solver-frame faces): solves fully aligned 978/1000; 22 have raw moves left over after the last token or a token mismatch (unmapped raw moves are labelled unmapped); 366 resyncs by timestamp. Overall median raw gap = 150 ms (n=81584 gaps).

### 1a Inter-move gap distribution, all raw moves, all 1000 solves
Columns: percentile of all 81584 gaps; gap in ms (percentiles 20, 40, 60, 70 are in out/turning.json)

| percentile | gap ms |
|---|---|
| 10 | 61 |
| 25 | 93 |
| 30 | 117 |
| 50 | 150 |
| 75 | 269 |
| 80 | 330 |
| 90 | 538 |
| 95 | 743 |
| 99 | 1238 |
| mean | 236 |

### 1b Pause metrics by totalTime quintile (Q1 fastest), n=1000
Columns: cells are median / mean of the per-solve metric; last column Spearman rho between the metric and totalTime over all 1000 solves with bootstrap CI

| metric (median / mean per solve) | Q1 n=200 T 11.22-16.74 s | Q2 n=200 T 16.75-18.05 s | Q3 n=200 T 18.06-19.47 s | Q4 n=200 T 19.50-21.33 s | Q5 n=200 T 21.36-38.89 s | Spearman vs totalTime [95% CI] |
|---|---|---|---|---|---|---|
| turns (turnCount) | 65.0 / 64.5 | 69.0 / 68.9 | 73.0 / 72.3 | 75.0 / 75.3 | 82.0 / 84.0 | 0.72 [0.68, 0.75] |
| overall TPS (app, turns/s) | 4.18 / 4.17 | 3.93 / 3.95 | 3.86 / 3.86 | 3.68 / 3.70 | 3.44 / 3.47 | -0.60 [-0.65, -0.56] |
| raw quarter turns | 73.0 / 72.6 | 78.0 / 77.7 | 82.0 / 81.9 | 85.0 / 85.3 | 94.0 / 95.4 | 0.75 [0.71, 0.77] |
| # gaps > 300 ms | 14.0 / 14.0 | 16.0 / 15.8 | 17.0 / 17.2 | 18.0 / 18.7 | 22.0 / 22.3 | 0.75 [0.71, 0.78] |
| time in gaps > 300 ms (s) | 7.97 / 7.90 | 9.16 / 9.17 | 10.31 / 10.20 | 11.48 / 11.46 | 13.84 / 14.42 | 0.88 [0.86, 0.90] |
| # gaps > 500 ms | 7.0 / 6.8 | 8.0 / 8.0 | 9.0 / 8.7 | 10.0 / 9.6 | 12.0 / 12.1 | 0.69 [0.65, 0.73] |
| time in gaps > 500 ms (s) | 5.01 / 5.12 | 6.26 / 6.13 | 6.85 / 6.88 | 8.03 / 7.92 | 10.02 / 10.46 | 0.77 [0.74, 0.80] |
| # gaps > 800 ms | 2.0 / 2.2 | 3.0 / 2.6 | 3.0 / 3.1 | 4.0 / 3.8 | 5.0 / 5.0 | 0.55 [0.50, 0.59] |
| time in gaps > 800 ms (s) | 2.06 / 2.25 | 2.71 / 2.77 | 3.25 / 3.39 | 4.23 / 4.25 | 5.74 / 6.02 | 0.59 [0.54, 0.63] |
| # gaps > 1200 ms | 0.0 / 0.4 | 0.0 / 0.6 | 1.0 / 0.8 | 1.0 / 1.1 | 2.0 / 1.7 | 0.45 [0.39, 0.50] |
| time in gaps > 1200 ms (s) | 0.00 / 0.58 | 0.00 / 0.86 | 1.25 / 1.23 | 1.42 / 1.70 | 2.73 / 2.88 | 0.47 [0.41, 0.52] |
| pause share = time in gaps>500 / totalTime (%) | 32.3 / 32.9 | 35.5 / 35.1 | 36.7 / 36.7 | 39.2 / 38.9 | 42.7 / 42.6 | 0.43 [0.37, 0.48] |
| burst TPS = turns / (totalTime - gaps>500 time) | 6.24 / 6.27 | 6.12 / 6.14 | 6.17 / 6.16 | 6.13 / 6.12 | 6.05 / 6.08 | -0.08 [-0.14, -0.02] |
| burst TPS / overall TPS | 1.477 / 1.509 | 1.551 / 1.559 | 1.579 / 1.603 | 1.644 / 1.660 | 1.744 / 1.771 | 0.43 [0.37, 0.48] |

### 2 Pauses (gap > 500 ms) by stage and position, CFOP solves n=998
Columns: mean stage time (s); seconds per solve in stage-leading pauses (median / mean, zeros included); seconds per solve in mid-stage pauses (median / mean); mean seconds of the stage-leading gap at any size; mean # leading pauses and # mid pauses per solve; % of solves with at least one; stage share of all pause time. Cross has no leading gap in the data (inspection is outside the recording).

| stage | mean stage time | leading pause s med/mean | mid pause s med/mean | leading gap any size mean s | lead # /solve | mid # /solve | % solves lead | % solves mid | share of pause time |
|---|---|---|---|---|---|---|---|---|---|
| cross | 2.83 | 0.00 / 0.00 | 0.66 / 1.06 | 0.00 | 0.00 | 1.31 | 0% | 68% | 14.6% |
| f2l1 | 2.88 | 0.63 / 0.62 | 0.54 / 0.67 | 0.72 | 0.66 | 0.84 | 66% | 55% | 17.7% |
| f2l2 | 2.80 | 0.51 / 0.48 | 0.56 / 0.67 | 0.63 | 0.51 | 0.85 | 51% | 58% | 15.7% |
| f2l3 | 2.59 | 0.57 / 0.50 | 0.51 / 0.52 | 0.63 | 0.57 | 0.67 | 57% | 50% | 13.9% |
| f2l4 | 2.19 | 0.57 / 0.46 | 0.00 / 0.35 | 0.59 | 0.58 | 0.48 | 58% | 39% | 11.2% |
| oll | 2.63 | 0.71 / 0.72 | 0.00 / 0.21 | 0.74 | 0.96 | 0.30 | 96% | 25% | 12.9% |
| pll | 3.33 | 0.78 / 0.78 | 0.00 / 0.24 | 0.81 | 0.93 | 0.35 | 93% | 25% | 14.1% |
| ALL | 19.26 | 3.50 / 3.56 | 3.35 / 3.72 | 4.12 | 4.22 | 4.80 | 100% | 99% | 100% |

### 3a Counterfactual totals using only the solver's own distribution, n=1000 (pause = time in gaps > 500 ms; total = turns / burst TPS + pause)
Columns: median and mean counterfactual total (s); mean saving vs actual (s) with bootstrap CI; saving as % of mean actual. Benchmarks p25/p10 are percentiles of this solver's own per-solve values (own-best benchmark, not a prediction). Solves already better than the benchmark are unchanged. Mean actual pause = 7.30 s, mean fast time = 11.97 s, mean turns = 73.0, median burst TPS = 6.13.

| scenario | median T' | mean T' | mean saving s [CI] | saving % of mean T |
|---|---|---|---|---|
| actual | 18.74 | 19.27 | - | 0.0% |
| pause time -10% (moves, burst TPS unchanged) | 18.07 | 18.54 | 0.73 [0.71, 0.75] | 3.8% |
| pause time -25% (moves, burst TPS unchanged) | 17.05 | 17.45 | 1.83 [1.79, 1.87] | 9.5% |
| pause time -50% (moves, burst TPS unchanged) | 15.30 | 15.62 | 3.65 [3.57, 3.73] | 18.9% |
| pause time -100% (moves, burst TPS unchanged) | 11.78 | 11.97 | 7.30 [7.15, 7.46] | 37.9% |
| pause capped at own p25 (5.60 s) [own-best benchmark] | 17.14 | 17.32 | 1.95 [1.82, 2.10] | 10.1% |
| pause capped at own p10 (4.52 s) [own-best benchmark] | 16.25 | 16.43 | 2.85 [2.70, 3.01] | 14.8% |
| moves capped at own p25 (67 turns) [own-best benchmark] | 17.69 | 18.11 | 1.16 [1.08, 1.24] | 6.0% |
| moves capped at own p10 (63 turns) [own-best benchmark] | 17.19 | 17.58 | 1.69 [1.60, 1.79] | 8.8% |
| burst TPS floored at own p75 (6.54) [own-best benchmark] | 17.80 | 18.29 | 0.99 [0.92, 1.05] | 5.1% |
| burst TPS floored at own p90 (6.97) [own-best benchmark] | 17.31 | 17.73 | 1.55 [1.48, 1.62] | 8.0% |
| pause p25 + moves p25 | 16.19 | 16.16 | 3.11 [2.92, 3.31] | 16.1% |
| pause p10 + moves p10 | 14.69 | 14.73 | 4.54 [4.34, 4.76] | 23.6% |
| pause p25 + moves p25 + burst p75 | 15.64 | 15.26 | 4.01 [3.81, 4.20] | 20.8% |
| pause p10 + moves p10 + burst p90 | 13.56 | 13.39 | 5.88 [5.67, 6.09] | 30.5% |

Spearman of totalTime (n=1000): turns 0.72 [0.68, 0.75]; pause time s (>500) 0.77 [0.74, 0.80]; fast time s (T - pause) 0.63 [0.58, 0.67]; burst TPS -0.08 [-0.14, -0.02]; pause share 0.43 [0.37, 0.48].

### 3c What separates the slowest quintile from the fastest (Q5 - Q1), n=200 vs 200
Columns: Q1 mean, Q5 mean, difference with bootstrap CI (resampling within each quintile), difference as % of the totalTime difference. fast time = turns / burst TPS, so its difference is split into move-count and turn-rate parts by the log shares ln(turns5/turns1) and -ln(b5/b1).

| component (s) | Q1 mean | Q5 mean | Q5-Q1 [CI] | % of totalTime diff |
|---|---|---|---|---|
| totalTime | 15.49 | 24.35 | 8.86 [8.39, 9.34] | 100% |
| pause time (gaps > 500) | 5.12 | 10.46 | 5.34 [4.94, 5.76] | 60% |
| fast time (T - pause) | 10.38 | 13.90 | 3.52 [3.20, 3.85] | 40% |
|   of which move count (log-share of fast time) |  |  | 3.18 [2.91, 3.47] | 36% |
|   of which turn rate (log-share of fast time) |  |  | 0.34 [0.12, 0.57] | 4% |
| mean turns (Q1 vs Q5) | 64.5 | 84.0 | 19.5 |  |

### 4a Fumbles in the raw stream, n=1000 solves
Columns: total events; mean events per solve; % of solves with at least one; mean cost per event (s) = first-to-last move duration + following gap - median gap (150 ms); cost per solve median / mean (s); Spearman of events per solve vs totalTime. Patterns can overlap (an X X' X' run is counted in both a and b).

| pattern | events | mean/solve | % solves | mean cost/event s | cost per solve med/mean s | Spearman events vs totalTime |
|---|---|---|---|---|---|---|
| inverse pair X X' <=1500 ms | 2025 | 2.025 | 85.1% | 0.53 | 0.903 / 1.079 | 0.32 [0.25, 0.37] |
| same turn x3 in a row | 419 | 0.419 | 34.3% | 0.90 | 0.000 / 0.378 | 0.14 [0.08, 0.20] |
| same turn x4+ in a row | 48 | 0.048 | 4.7% | 1.65 | 0.000 / 0.079 | 0.12 [0.06, 0.17] |
| any of the three | 2492 | 2.492 | 91.3% | 0.62 | 1.319 / 1.537 | 0.37 [0.31, 0.43] |

Gap between the two moves of every adjacent opposite-direction same-face pair in the raw stream (n=2318, any gap): percentiles 10/25/50/75/90 = 118/202/330/569/901 ms; share <=300 ms = 45.9%, 300-1500 ms = 52.0%, >1500 ms = 2.0%.

Solves with >=1 fumble: n=913 (median 18.87 s, mean 19.41 s); without: n=87 (median 17.62 s, mean 17.90 s); mean difference 1.51 s [0.82, 2.15].

### 4b Fumbles by stage of the first move of the pattern, CFOP n=998
Columns: events per pattern type; total events per solve; summed time cost per solve (s)

| stage | inverse pair | x3 | x4+ | events/solve | cost s/solve |
|---|---|---|---|---|---|
| cross | 172 | 26 | 4 | 0.202 | 0.169 |
| f2l1 | 292 | 51 | 5 | 0.349 | 0.249 |
| f2l2 | 294 | 76 | 14 | 0.385 | 0.271 |
| f2l3 | 301 | 79 | 5 | 0.386 | 0.251 |
| f2l4 | 323 | 89 | 9 | 0.422 | 0.267 |
| oll | 311 | 63 | 9 | 0.384 | 0.199 |
| pll | 329 | 33 | 2 | 0.365 | 0.128 |

### 4c Fumbles by face in the solver frame (face of the reconstruction token owning the first move)
Columns: events per pattern; all events; reconstruction tokens of that face; events per 1000 tokens

| face | inverse | x3 | x4+ | all | tokens | per 1000 tokens |
|---|---|---|---|---|---|---|
| U | 953 | 296 | 34 | 1283 | 25459 | 50.39 |
| D | 71 | 10 | 2 | 83 | 3331 | 24.92 |
| L | 149 | 5 | 0 | 154 | 7923 | 19.44 |
| R | 461 | 20 | 2 | 483 | 21213 | 22.77 |
| F | 260 | 62 | 7 | 329 | 9799 | 33.57 |
| B | 64 | 4 | 2 | 70 | 3073 | 22.78 |
| wide/slice | 67 | 22 | 1 | 90 | 2169 | 41.49 |

### 5a Gap before each move type (solver frame, reconstruction tokens), CFOP n=998
Columns: move token (half turns merged: X2 and X2' are one row; prime = counter-clockwise); total occurrences; mean per solve; n of occurrences inside a fluent run = the gap before the previous token < 300 ms, and the move is not stage-leading; median / mean / p90 of the gap before the move (ms, measured from the previous raw move to this token's first raw quarter turn); LOW-N if n<30. Types with <30 occurrences omitted.

| move | total | per solve | n fluent | median gap ms | mean gap ms | p90 gap ms | flag |
|---|---|---|---|---|---|---|---|
| U' | 10464 | 10.48 | 7019 | 122 | 170 | 300 |  |
| R' | 10174 | 10.19 | 7907 | 119 | 148 | 242 |  |
| U | 10135 | 10.16 | 6650 | 149 | 197 | 391 |  |
| R | 9504 | 9.52 | 6616 | 121 | 157 | 266 |  |
| U2 | 4651 | 4.66 | 2568 | 135 | 185 | 361 |  |
| F | 4403 | 4.41 | 2831 | 150 | 205 | 437 |  |
| F' | 4276 | 4.28 | 2922 | 150 | 207 | 418 |  |
| L | 3961 | 3.97 | 2711 | 178 | 218 | 414 |  |
| L' | 3477 | 3.48 | 2294 | 148 | 185 | 356 |  |
| R2 | 1497 | 1.50 | 1067 | 119 | 137 | 240 |  |
| D' | 1386 | 1.39 | 806 | 208 | 294 | 600 |  |
| D | 1375 | 1.38 | 970 | 151 | 231 | 508 |  |
| B | 1347 | 1.35 | 924 | 146 | 191 | 391 |  |
| B' | 1311 | 1.31 | 969 | 150 | 198 | 421 |  |
| F2 | 1081 | 1.08 | 587 | 169 | 241 | 472 |  |
| D2 | 537 | 0.54 | 336 | 363 | 374 | 674 |  |
| L2 | 461 | 0.46 | 297 | 151 | 200 | 359 |  |
| B2 | 378 | 0.38 | 195 | 176 | 276 | 574 |  |
| d' | 327 | 0.33 | 129 | 172 | 271 | 569 |  |
| d | 322 | 0.32 | 141 | 449 | 467 | 900 |  |
| l' | 269 | 0.27 | 190 | 120 | 175 | 307 |  |
| f' | 249 | 0.25 | 222 | 168 | 188 | 270 |  |
| r' | 226 | 0.23 | 127 | 122 | 209 | 330 |  |
| U3 | 166 | 0.17 | 47 | 180 | 259 | 411 |  |
| f | 131 | 0.13 | 72 | 272 | 318 | 453 |  |
| r | 121 | 0.12 | 75 | 150 | 221 | 535 |  |
| l | 118 | 0.12 | 80 | 150 | 212 | 338 |  |
| M | 99 | 0.10 | 54 | 256 | 290 | 450 |  |
| M2 | 90 | 0.09 | 80 | 118 | 115 | 181 |  |
| M' | 73 | 0.07 | 49 | 148 | 180 | 269 |  |
| b' | 39 | 0.04 | 18 | 140 | 132 | 206 | LOW-N |
| b | 36 | 0.04 | 24 | 210 | 221 | 292 | LOW-N |
| ALL moves in fluent runs | 72783 |  | 49018 | 135 | 185 | 363 |  |

### 5b Half turns: gap between the two raw quarter turns, solver-frame face, CFOP n=998
Columns: tokens X2 mapped to exactly two raw quarter turns; n; median / mean / p90 ms

| face | n | median ms | mean ms | p90 ms | flag |
|---|---|---|---|---|---|
| U2 | 4588 | 135 | 163 | 302 |  |
| D2 | 531 | 183 | 201 | 300 |  |
| L2 | 416 | 120 | 154 | 330 |  |
| R2 | 1444 | 90 | 109 | 191 |  |
| F2 | 1059 | 150 | 168 | 300 |  |
| B2 | 368 | 151 | 175 | 298 |  |
| all half turns | 8406 | 132 | 157 | 300 |  |

### 5d Move-type frequency and cube rotation tokens per solve, CFOP n=998
Columns: median / mean count per solve; % solves with >=1; Spearman vs totalTime. Rotations are inferred by acubemy (they share a timestamp with a neighbour), so a rotation at the start (before the first turn) is counted in "all" but not in "mid-solve".

| count | median / mean per solve | % solves >=1 | Spearman vs totalTime |
|---|---|---|---|
| B / B' | 2.00 / 2.66 | 76.1% | 0.16 [0.11, 0.22] |
| F / F' | 8.00 / 8.70 | 99.5% | 0.19 [0.13, 0.25] |
| D / D' | 2.00 / 2.77 | 89.4% | 0.20 [0.14, 0.26] |
| L / L' | 7.00 / 7.45 | 99.3% | 0.21 [0.15, 0.27] |
| wide r l u d f b (any direction) | 2.00 / 1.87 | 81.6% | 0.09 [0.03, 0.15] |
| slice M S E | 0.00 / 0.29 | 16.2% | 0.14 [0.08, 0.21] |
| all x tokens | 2.00 / 2.22 | 81.5% | 0.21 [0.15, 0.27] |
| all y tokens | 2.00 / 2.14 | 90.5% | 0.19 [0.13, 0.25] |
| all z tokens | 1.00 / 1.13 | 80.3% | 0.07 [0.01, 0.13] |
| all rotation tokens | 5.00 / 5.49 | 100.0% | 0.30 [0.24, 0.36] |
| mid-solve rotation tokens (between two moves) | 4.00 / 3.98 | 94.3% | 0.31 [0.25, 0.36] |

### 5e Time cost of a rotation: gap between the move before and the move after a run of rotation tokens, CFOP n=998
Columns: axis (mixed = run with several axes; same-stage = both neighbours in the same stage, cross-stage = rotation straddles a stage boundary); events; median / mean gap ms; mean gap minus the overall median raw gap (150 ms) with solve-cluster bootstrap CI; median gap minus median gap; flag

| axis | events | median gap ms | mean gap ms | mean cost ms [CI] | median cost ms | flag |
|---|---|---|---|---|---|---|
| x | 1627 | 480 | 622 | +472 [+449, +497] | +330 |  |
| y | 1241 | 541 | 593 | +443 [+420, +468] | +391 |  |
| z | 252 | 178 | 295 | +145 [+107, +184] | +28 |  |
| mixed | 363 | 538 | 662 | +512 [+454, +572] | +388 |  |
| ALL | 3483 | 481 | 592 | +442 [+426, +459] | +331 |  |
| x|same-stage | 1201 | 306 | 488 | +338 [+311, +367] | +156 |  |
| y|same-stage | 872 | 391 | 472 | +322 [+296, +349] | +241 |  |
| z|same-stage | 231 | 168 | 241 | +91 [+60, +123] | +18 |  |
| mixed|same-stage | 273 | 329 | 534 | +384 [+318, +452] | +179 |  |
| ALL|same-stage | 2577 | 300 | 466 | +316 [+297, +334] | +150 |  |
| ALL|cross-stage | 906 | 870 | 952 | +802 [+777, +829] | +720 |  |

### 6a Top 30 3-move sequences in the solver frame, CFOP n=998
Columns: sequence (contiguous non-rotation tokens within one stage, X2/X2' merged); occurrences; distinct solves; duration median / p90 ms from the first raw move of the first token to the last raw move of the last token (3-token windows overlap, so one longer sequence feeds several windows); % of occurrences containing an internal gap > 500 ms; median duration relative to the median of all 3-windows (350 ms, n=54762)

| sequence | count | solves | median ms | p90 ms | % with gap>500 | rel median | flag |
|---|---|---|---|---|---|---|---|
| R U R' | 2358 | 872 | 237 | 406 | 1% | 0.68 |  |
| R U' R' | 1891 | 820 | 240 | 419 | 2% | 0.69 |  |
| U R' U' | 1163 | 686 | 182 | 359 | 4% | 0.52 |  |
| R' U R | 1148 | 685 | 211 | 418 | 2% | 0.60 |  |
| R' U' R | 1059 | 654 | 240 | 419 | 3% | 0.69 |  |
| U R U' | 874 | 566 | 206 | 392 | 3% | 0.59 |  |
| U' R U | 843 | 592 | 259 | 505 | 6% | 0.74 |  |
| R U2 R' | 834 | 570 | 355 | 571 | 1% | 1.01 |  |
| U' R' U | 703 | 512 | 250 | 515 | 4% | 0.71 |  |
| U R' U | 673 | 516 | 285 | 600 | 9% | 0.81 |  |
| U' R U' | 637 | 496 | 327 | 479 | 4% | 0.93 |  |
| L' U' L | 633 | 462 | 332 | 480 | 2% | 0.95 |  |
| L' U L | 609 | 436 | 270 | 439 | 1% | 0.77 |  |
| R' F R | 593 | 430 | 213 | 481 | 4% | 0.61 |  |
| R' U2 R | 572 | 444 | 334 | 568 | 2% | 0.96 |  |
| U' R' U' | 545 | 443 | 274 | 541 | 8% | 0.78 |  |
| U R U | 493 | 384 | 330 | 570 | 7% | 0.94 |  |
| R' U' R' | 483 | 379 | 240 | 423 | 3% | 0.69 |  |
| F R F' | 476 | 363 | 240 | 389 | 2% | 0.69 |  |
| L U' L' | 408 | 327 | 270 | 420 | 1% | 0.77 |  |
| U2 R U' | 396 | 320 | 380 | 670 | 3% | 1.09 |  |
| U' R' F | 381 | 337 | 209 | 421 | 4% | 0.60 |  |
| U2 R' U | 308 | 263 | 538 | 818 | 7% | 1.54 |  |
| R' F' R | 306 | 264 | 243 | 449 | 2% | 0.69 |  |
| U2 R' U' | 298 | 248 | 331 | 618 | 4% | 0.95 |  |
| U' R' U2 | 288 | 255 | 421 | 750 | 7% | 1.20 |  |
| U R' U2 | 285 | 245 | 389 | 780 | 7% | 1.11 |  |
| F' U' F | 281 | 248 | 303 | 510 | 5% | 0.87 |  |
| U R U2 | 269 | 243 | 402 | 776 | 8% | 1.15 |  |
| U' R U2 | 256 | 222 | 422 | 731 | 7% | 1.20 |  |

### 6b Top 30 4-move sequences in the solver frame, CFOP n=998
Columns: sequence (contiguous non-rotation tokens within one stage, X2/X2' merged); occurrences; distinct solves; duration median / p90 ms from the first raw move of the first token to the last raw move of the last token (4-token windows overlap, so one longer sequence feeds several windows); % of occurrences containing an internal gap > 500 ms; median duration relative to the median of all 4-windows (539 ms, n=46659)

| sequence | count | solves | median ms | p90 ms | % with gap>500 | rel median | flag |
|---|---|---|---|---|---|---|---|
| R U R' U' | 876 | 591 | 303 | 572 | 3% | 0.56 |  |
| U R U' R' | 675 | 473 | 300 | 568 | 3% | 0.56 |  |
| U' R U R' | 655 | 487 | 363 | 651 | 5% | 0.67 |  |
| U' R' U R | 487 | 378 | 357 | 599 | 5% | 0.66 |  |
| R' U R U' | 466 | 363 | 300 | 511 | 2% | 0.56 |  |
| R' U' R U | 458 | 389 | 330 | 570 | 5% | 0.61 |  |
| R U' R' U | 455 | 358 | 388 | 685 | 5% | 0.72 |  |
| U' R U' R' | 449 | 368 | 452 | 659 | 4% | 0.84 |  |
| R U R' U | 407 | 352 | 393 | 808 | 11% | 0.73 |  |
| U R U R' | 381 | 311 | 419 | 633 | 5% | 0.78 |  |
| U R' U R | 365 | 313 | 361 | 708 | 5% | 0.67 |  |
| U R' U' R' | 361 | 337 | 278 | 481 | 4% | 0.52 |  |
| R' F R F' | 341 | 277 | 334 | 657 | 4% | 0.62 |  |
| U2 R U' R' | 330 | 271 | 490 | 811 | 5% | 0.91 |  |
| U' R' U' R | 329 | 297 | 345 | 630 | 7% | 0.64 |  |
| U R' U' R | 318 | 268 | 360 | 672 | 8% | 0.67 |  |
| R U' R' U' | 297 | 264 | 405 | 664 | 7% | 0.75 |  |
| R' U' R' F | 253 | 244 | 240 | 420 | 1% | 0.45 |  |
| R' U2 R U' | 251 | 219 | 480 | 750 | 4% | 0.89 |  |
| R' U' R U' | 241 | 219 | 422 | 689 | 8% | 0.78 |  |
| R U R' U2 | 238 | 214 | 541 | 936 | 7% | 1.00 |  |
| U' R U2 R' | 232 | 200 | 570 | 905 | 7% | 1.06 |  |
| U2 R U R' | 225 | 202 | 627 | 872 | 4% | 1.16 |  |
| R U2 R' U | 225 | 199 | 630 | 876 | 5% | 1.17 |  |
| F R U R' | 218 | 210 | 336 | 392 | 1% | 0.62 |  |
| U R' U2 R | 214 | 197 | 480 | 789 | 5% | 0.89 |  |
| R U2 R' U' | 211 | 181 | 405 | 674 | 2% | 0.75 |  |
| U2 R' U' R | 202 | 186 | 479 | 839 | 9% | 0.89 |  |
| F' R U R' | 197 | 185 | 359 | 522 | 2% | 0.67 |  |
| U2 R' U R | 191 | 178 | 600 | 931 | 4% | 1.11 |  |

### 7a Gyro sampling and coverage, n=1000
Columns: statistic over solves; t in ms from solve start as stored

| statistic | value |
|---|---|
| samples per solve (min / p5 / median / p95 / max) | 122 / 160 / 199 / 268 / 410 |
| solves at the 410-sample cap | 1 |
| sample rate Hz (min / median / max) | 9.6 / 10.4 / 11.0 |
| sample interval ms (p1 / p10 / p50 / p90 / p99 / max) | 26 / 66 / 91 / 123 / 171 / 1419 |
| solves with duplicate timestamps (n; total duplicates) | 300; 496 |
| first sample t ms (min / median / max) | 14 / 60 / 272 |
| last sample t minus totalTime ms (min / median / max) | -60 / 359 / 923 |
| coverage of [0, totalTime] by [first, last] sample (min / median) | 0.985 / 0.997 |

Per-sample angular step (deg between consecutive samples, angle = 2*acos|q1.q2|): p10 3.4, median 9.3, p90 24.8, p99 47.0, n=203884. Because the cube is turned by hand the whole time, this includes hand shake and face-turn vibration; travel is an upper bound on deliberate reorientation.

### 7b Gyro angular travel and large reorientations, n=1000 (rotation correlation: CFOP n=998 vs mid-solve rotation tokens)
Columns: median / mean per solve; Spearman vs totalTime; Spearman vs mid-solve rotation-token count

| metric | median / mean | Spearman vs totalTime | Spearman vs rotation tokens |
|---|---|---|---|
| total travel in [0, totalTime] (deg) | 2388 / 2448 | 0.78 [0.75, 0.81] | 0.33 [0.27, 0.39] |
| total travel incl. tail after last move (deg) | 2427 / 2493 | 0.77 [0.74, 0.80] | - |
| travel rate (deg/s) | 127 / 127 | -0.23 [-0.29, -0.17] | 0.07 [0.01, 0.13] |
| large reorientations (>60 deg within 400 ms) per solve | 8.00 / 8.20 | 0.31 [0.25, 0.37] | 0.28 [0.22, 0.34] |

### 7c Gyro travel and large reorientations by stage, CFOP n=998
Columns: travel deg per solve median / mean; travel deg per second of stage median / mean; large reorientations per solve median / mean; % solves with >=1. Samples assigned to stages by midpoint time using the move timeline (stage ends); tail after the last move excluded.

| stage | travel deg | deg/s | big reorient /solve | % solves >=1 |
|---|---|---|---|---|
| cross | 234 / 310 | 105 / 107 | 0.000 / 0.829 | 43.4% |
| f2l1 | 309 / 327 | 114 / 115 | 1.000 / 0.832 | 60.7% |
| f2l2 | 287 / 305 | 109 / 110 | 1.000 / 0.767 | 56.4% |
| f2l3 | 284 / 296 | 115 / 116 | 1.000 / 0.862 | 62.0% |
| f2l4 | 270 / 283 | 129 / 130 | 1.000 / 0.977 | 66.2% |
| oll | 367 / 391 | 150 / 151 | 1.000 / 1.522 | 72.4% |
| pll | 512 / 534 | 158 / 164 | 2.000 / 2.343 | 91.6% |

### 7d Gyro time-alignment check: angular speed relative to mid-solve rotation-token timestamps, CFOP n=998 (3483 rotation events)
Columns: gyro sample time minus rotation timestamp (ms); samples; mean angular speed deg/s; ratio to the overall mean speed (160 deg/s)

| offset bin ms | samples | mean deg/s | ratio to overall |
|---|---|---|---|
| -1000..-750 | 9044 | 161 | 1.01 |
| -750..-500 | 8521 | 173 | 1.08 |
| -500..-250 | 9663 | 188 | 1.17 |
| -250..+0 | 8685 | 162 | 1.01 |
| +0..+250 | 8900 | 182 | 1.13 |
| +250..+500 | 9399 | 154 | 0.96 |
| +500..+750 | 8372 | 158 | 0.98 |
| +750..+1000 | 9076 | 167 | 1.04 |

Large reorientations within +-500 ms of a mid-solve rotation event: 1709 of 8173 (20.9%); rotation events with a large reorientation within +-500 ms: 1473 of 3483 (42.3%). Chance baseline (rotation times shifted by +-2000/3000/4000 ms, wrapped within the solve): reorientations matched 16.8% (range 14.8-18.0), rotation events matched 34.4% (range 30.8-36.5).

### 7e Orientation of the first gyro sample relative to the mean start orientation, n=1000
Columns: angle (deg) between each solve's first quaternion and the principal-axis mean of all first quaternions: p50 / p75 / p90 / max; % within 20 deg; % within 45 deg. The gyro frame can be re-zeroed by the app, so this measures consistency in the stored frame, not in the room.

| group | angle deg p50/p75/p90/max | <20 deg | <45 deg |
|---|---|---|---|
| all 1000 | 82 / 130 / 158 / 180 | 3.4% | 23.3% |
| oldest 500 | 91 / 136 / 159 / 180 | 2.2% | 21.0% |
| newest 500 | 78 / 124 / 157 / 180 | 4.6% | 25.6% |

### 8a fluencyPercent verification, n=1000
Columns: check; result. Bundle code (chunk 7769, module 85350): extractFluencyPercent=function(e,s){let U=arguments.length>2&&void 0!==arguments[2]?arguments[2]:R.EXECUTION_GAP_THRESHOLD_MS,t=e.moves;if(t.length<2||s<=0)return 100;let n=t.findIndex(e=>!e.sliceTurn.isCubeRotation());if(-1===n)return 100;let M=t[n].timeStamp,p=t[t.length-1].timeStamp-M;if(p<=0)return 100;let r=0;for(let e=n;e<t.length-1;e++){let s=t[e+1].timeStamp-t[e].timeStamp;s>U&&(r+=s)}return 100-Math.round(r/p*100)} with EXECUTION_GAP_THRESHOLD_MS=400 and the first argument the raw (cube-reported) sequence. Python port: 100 - floor(sum(gaps>400 ms)/(last ts - first ts)*100 + 0.5). UI tooltip: "What proportion of your solve you have been turning instead of pausing".

| check | result |
|---|---|
| formula recomputed from rawSolutionSequence == list.fluencyPercent | 1000 / 1000 match (0 mismatches) |
| list.fluencyPercent == detail.fluencyPercent | 1000 / 1000 |
| fluencyPercent median / mean | 55.0 / 54.85 |
| Spearman fluency vs share of time in gaps > 400 ms | -1.00 [-1.00, -1.00] |
| Spearman fluency vs pause share (gaps > 500 ms) | -0.83 [-0.85, -0.81] |
| Spearman fluency vs app TPS | 0.63 [0.59, 0.67] |
| Spearman fluency vs totalTime | -0.44 [-0.50, -0.39] |
| Spearman fluency vs burst TPS | -0.37 [-0.42, -0.32] |

### 8b tpsInsights Default Session (859c481a) averageSplits, as returned
Columns: step; mean time ms; percentage of mean total; mean turns; tps; mean recognition ms; mean execution ms

| step | time ms | % | turns | tps | recog ms | exec ms |
|---|---|---|---|---|---|---|
| cross | 2913 | 15.22 | 10.7 | 3.674 | 0 | 2913 |
| f2l | 10267 | 53.65 | 38.6 | 3.757 | 4045 | 6222 |
|   slot1 | 2735 | 14.29 | 9.6 | 3.512 | 1048 | 1687 |
|   slot2 | 2740 | 14.32 | 9.8 | 3.564 | 1041 | 1699 |
|   slot3 | 2536 | 13.25 | 9.6 | 3.794 | 966 | 1570 |
|   slot4 | 2257 | 11.79 | 9.6 | 4.247 | 990 | 1267 |
| oll | 2500 | 13.07 | 11.5 | 4.611 | 955 | 1545 |
| pll | 3457 | 18.06 | 17.1 | 4.957 | 984 | 2473 |

tpsInsights structure: top-level {json}; json keys = method ("CFOP"), stepDefinitions[4] (name,label,color for cross,f2l,oll,pll), solves[200] (newest 200 solves of the session; keys timestamps[], totalTime, stepTimes[4], stepTurns[4], stepRecognition[4], slotTimes[4], slotTurns[4], slotRecognition[4]), stageBoundaries[3] = [0.1455, 0.6893, 0.8224], averageSplits[4] (above; f2l carries subSteps slot1..slot4), averageTotalTime = 19137.

Checks: mean(totalTime) over solves[] = 19137 vs averageTotalTime 19137; mean stepTimes [cross,f2l,oll,pll] = [2913, 10267, 2500, 3457] equals averageSplits times; mean of per-solve cumulative step fractions = [0.1455, 0.6893, 0.8224] vs stageBoundaries [0.1455, 0.6893, 0.8224] (ratio-of-means cumulative = [0.1522, 0.6887, 0.8194]); mean stepTurns = [10.7, 38.6, 11.5, 17.1]; solves matched to our data by totalTime: 200 of 200; timestamps equal solutionSequence timestamps incl. rotations: 200, non-rotation tokens only: 0, raw sequence: 0. No per-gap or per-percent TPS aggregate is in the file: the page itself derives median TPS per percent-done bucket from solves[].timestamps with TPS = min(1000/gap, 20) per consecutive timestamp pair.

### 9a Demonstrated hand speed: fastest 8-move window per solve, n=1000
Columns: window = 8 consecutive raw quarter-turn gaps (TPS = 8000 / (ts[i+8]-ts[i]) ms, includes the gap before the first move); median; mean; p10 / p25 / p75 / p90; Spearman vs totalTime

| metric | n | median | mean | p10/p25/p75/p90 | Spearman vs totalTime |
|---|---|---|---|---|---|
| fastest 8-move window TPS (raw) | 1000 | 10.26 | 10.96 | 8.35 / 9.21 / 12.14 / 14.81 | -0.10 [-0.16, -0.04] |
| overall raw TPS (raw quarter turns / totalTime) | 1000 | 4.33 | 4.33 | 3.77 / 4.05 / 4.63 / 4.87 | -0.60 [-0.64, -0.56] |
| burst raw TPS (raw / time excluding gaps>500) | 1000 | 6.91 | 6.95 | 6.17 / 6.55 / 7.36 / 7.76 | -0.06 [-0.12, 0.00] |
| app TPS (turns / totalTime) | 1000 | 3.83 | 3.83 | 3.32 / 3.56 / 4.10 / 4.33 | -0.60 [-0.65, -0.56] |
| burst TPS (turns) | 1000 | 6.13 | 6.15 | 5.33 / 5.71 / 6.54 / 6.97 | -0.08 [-0.14, -0.02] |

Ceiling vs others, paired per solve (n=1000): ceiling minus burst raw TPS = 4.01 [3.87, 4.16]; ceiling minus overall raw TPS = 6.63 [6.48, 6.78]; median ratio ceiling/overall raw TPS = 2.40; ceiling/burst raw TPS = 1.49.

Data-quality counts: solves with raw first timestamp != 0 = 0; solves where raw last ts != totalTime = 0; solves where solutionSequence last ts != totalTime = 22; solves whose raw count != turnCount (half turns merge two raw into one turn) = 1000; solves with duplicate raw timestamps = 181; gaps of 0 ms between raw moves = 285; raw/token alignment not exact = 22; solves with a gap > 5 s = 1; max gap ms = 6421; non-CFOP solves excluded from stage tables = 2.
