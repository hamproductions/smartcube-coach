# Cross and cross-to-first-pair analysis

Source: 1000 newest solves, GAN i4. Excluded: 2 non-CFOP solves (no cross stage). Analysed N=998. Times in seconds. CI = bootstrap 95% percentile, 2000 resamples, seed 20261120. LOW-N = n<30. Cube-frame raw moves (face turns only) applied to the scramble in standard orientation.
Definitions: opt = optimal cross length for the chosen face from the scrambled state (BFS over 190,080 four-edge states); HTM = half-turn metric, QTM = quarter-turn metric. used HTM = raw face turns up to cross end (timestamp <= cross stage end) with consecutive same-face quarter turns collapsed to one move. used QTM = raw quarter-turn count. excess = used - opt (same metric). pause = gap between consecutive raw quarter-turn timestamps inside the cross.

### 1. Verification. Columns: check, count, of
| check | count | of |
|---|---|---|
| scramble + full raw solution gives solved cube | 998 | 998 |
| 4 cross edges of cross.face solved after raw moves with ts <= cross end | 998 | 998 |
| first raw prefix with cross solved == prefix at cross end | 414 | 998 |
| first solved prefix earlier than cross-end prefix (cross finished before acubemy end) | 584 | 998 |
| first solved prefix later than cross-end prefix | 0 | 998 |
| cross never solved in raw sequence | 0 | 998 |
| excess < 0 (used < optimal) | 0 | 998 |
| crosses with >=1 collapsed same-face group of net 0 (e.g. D D') | 80 | 998 |
| unique scrambles among 1000 (export join key) | 1000 | 1000 |

Cross end minus last raw cross move timestamp (ms): median 0, max 0, n with gap > 100 ms: 0.


### 2. Chosen cross face. Columns: face, n, share, cross time median, cross time mean, excess HTM median, excess HTM mean, opt HTM mean
| face | n | share % | time med | time mean | exc med | exc mean | opt mean |
|---|---|---|---|---|---|---|---|
| U | 997 | 99.9 | 2.22 | 2.82 | 1.00 | 2.29 | 5.79 |
| R LOW-N | 1 | 0.1 | 14.67 | 14.67 | 39.00 | 39.00 | 6.00 |

Faces never chosen: D L F B. Faces used by >=5% of solves (used-face set for item 7): U.

### 3a. Length distribution, counts of solves. Columns: length, opt HTM chosen face, used HTM, opt HTM best of 6 faces, opt QTM chosen face, used QTM, opt QTM best of 6
| len | opt HTM chosen | used HTM | opt HTM best6 | opt QTM chosen | used QTM | opt QTM best6 |
|---|---|---|---|---|---|---|
| 2 | 2 | 2 | 8 | 1 | 1 | 3 |
| 3 | 6 | 4 | 41 | 4 | 4 | 20 |
| 4 | 53 | 25 | 253 | 16 | 8 | 91 |
| 5 | 253 | 124 | 541 | 91 | 36 | 348 |
| 6 | 508 | 244 | 155 | 259 | 82 | 464 |
| 7 | 176 | 230 | 0 | 513 | 155 | 72 |
| 8 | 0 | 179 | 0 | 112 | 198 | 0 |
| 9 | 0 | 87 | 0 | 2 | 152 | 0 |
| 10 | 0 | 29 | 0 | 0 | 144 | 0 |
| 11 | 0 | 17 | 0 | 0 | 73 | 0 |
| 12+ | 0 | 57 | 0 | 0 | 145 | 0 |

### 3c. Excess (HTM) distribution. Columns: excess, n, share %, cross time median, cross time mean
| excess | n | share % | time med | time mean |
|---|---|---|---|---|
| 0 | 331 | 33.2 | 1.69 | 1.78 |
| 1 | 323 | 32.4 | 2.13 | 2.27 |
| 2 | 172 | 17.2 | 2.69 | 2.88 |
| 3 | 75 | 7.5 | 3.21 | 3.51 |
| 4+ | 97 | 9.7 | 5.79 | 7.67 |

Excess HTM: median 1.00, mean 2.33. Excess QTM: median 2.00, mean 3.49.

### 3b-4. Per-solve cross metrics (length rows in moves). Columns: metric, n, median, mean, p90
| metric | n | median | mean | p90 |
|---|---|---|---|---|
| opt HTM chosen | 998 | 6.00 | 5.79 | 7.00 |
| used HTM | 998 | 7.00 | 8.12 | 10.00 |
| opt HTM best6 | 998 | 5.00 | 4.80 | 6.00 |
| opt QTM chosen | 998 | 7.00 | 6.61 | 8.00 |
| used QTM | 998 | 9.00 | 10.10 | 13.00 |
| opt QTM best6 | 998 | 6.00 | 5.47 | 6.00 |
| cross time s | 998 | 2.22 | 2.83 | 4.38 |
| used HTM | 998 | 7.00 | 8.12 | 10.00 |
| used QTM | 998 | 9.00 | 10.10 | 13.00 |
| HTM TPS | 998 | 3.12 | 3.19 | 4.31 |
| QTM TPS | 998 | 3.85 | 3.93 | 5.13 |
| longest pause s | 998 | 0.60 | 0.75 | 1.23 |
| rotations in cross (ts>0) | 998 | 0.00 | 0.47 | 2.00 |

Crosses with >=1 mid-cross rotation token: 270 of 998 (27.1%). Crosses with an already-solved F2L pair (corner+edge in place) at cross end: 33 of 998.

### 4b. Sensitivity: cross at first raw prefix where the 4 cross edges are solved vs acubemy cross end. Columns: metric, n, median, mean
| metric | n | median | mean |
|---|---|---|---|
| cross time to first prefix with 4 edges solved s | 998 | 1.86 | 2.18 |
| used HTM to that prefix | 998 | 6.00 | 6.57 |
| excess HTM to that prefix | 998 | 0.00 | 0.78 |
| HTM moves after first solved prefix, up to acubemy cross end | 998 | 1.00 | 1.56 |
| time after first solved prefix, up to acubemy cross end s | 998 | 0.33 | 0.65 |

- Solves with >=1 extra HTM move after first solved prefix: 584 of 998; >=3 extra: 46; >=6 extra: 39; cross unsolved again at some prefix between first-solved and acubemy end: 46; acubemy cross end with all four pairs in place: 14.
- Paired mean diff [95% CI] excess HTM (acubemy end minus first-solved prefix): +1.56 [+1.20, +1.96]; cross time s: +0.65 [+0.53, +0.78]
- First-solved-prefix excess HTM distribution (0,1,2,3,4+): 383 262 102 43 43
- Spearman rho [95% CI], n=998: time_first vs excess_first HTM 0.678 [0.641, 0.713]

### 5a. Cross time by optimal HTM length (chosen face). Columns: group=opt len, n, cross time s, excess HTM
| group | n | time med | time mean | exc med | exc mean |
|---|---|---|---|---|---|
| 2 LOW-N | 2 | 0.29 | 0.29 | 0.00 | 0.00 |
| 3 LOW-N | 6 | 0.72 | 0.72 | 0.00 | 0.50 |
| 4 | 53 | 1.32 | 1.51 | 1.00 | 0.89 |
| 5 | 253 | 1.71 | 2.09 | 1.00 | 1.54 |
| 6 | 508 | 2.40 | 3.11 | 1.00 | 2.77 |
| 7 | 176 | 2.88 | 3.58 | 1.00 | 2.73 |

### 5b. Cross time by excess HTM. Columns: group=excess, n, cross time s, used HTM, TPS
| group | n | time med | time mean | used med | used mean | tps med | tps mean |
|---|---|---|---|---|---|---|---|
| 0 | 331 | 1.69 | 1.78 | 6.00 | 5.63 | 3.34 | 3.50 |
| 1 | 323 | 2.13 | 2.27 | 7.00 | 6.77 | 3.17 | 3.21 |
| 2 | 172 | 2.69 | 2.88 | 8.00 | 7.98 | 2.92 | 2.99 |
| 3 | 75 | 3.21 | 3.51 | 9.00 | 8.92 | 2.73 | 2.74 |
| 4+ | 97 | 5.79 | 7.67 | 12.00 | 20.75 | 2.67 | 2.77 |
- Mean diff [95% CI] (4+ minus 0): time +5.89 [+4.86, +7.08]; used +15.12 [+11.94, +18.39]; tps -0.73 [-0.95, -0.51]

### 5c. Cross time by used HTM length. Columns: group=used len, n, cross time s, excess
| group | n | time med | time mean | exc med | exc mean |
|---|---|---|---|---|---|
| 2 LOW-N | 2 | 0.29 | 0.29 | 0.00 | 0.00 |
| 3 LOW-N | 4 | 0.62 | 0.60 | 0.00 | 0.00 |
| 4 LOW-N | 25 | 0.98 | 1.10 | 0.00 | 0.04 |
| 5 | 124 | 1.43 | 1.47 | 0.00 | 0.18 |
| 6 | 244 | 1.77 | 1.89 | 0.00 | 0.41 |
| 7 | 230 | 2.31 | 2.42 | 1.00 | 0.93 |
| 8 | 179 | 2.73 | 2.88 | 2.00 | 1.76 |
| 9 | 87 | 3.27 | 3.58 | 3.00 | 2.64 |
| 10 LOW-N | 29 | 3.81 | 3.94 | 4.00 | 3.69 |
| 11 LOW-N | 17 | 4.62 | 5.08 | 5.00 | 4.71 |
| 12+ | 57 | 7.93 | 9.95 | 14.00 | 22.09 |
- Spearman rho [95% CI], n=998: cross time vs excess HTM 0.677 [0.638, 0.715]; vs used HTM 0.808 [0.779, 0.833]; vs opt HTM 0.505 [0.455, 0.555]; vs excess QTM 0.762 [0.729, 0.792]

### 6. By totalTime quintile (Q1 fastest). Columns: group, n, cross time s, excess HTM, cross share of total %
| group | n | time med | time mean | exc med | exc mean | share% med | share% mean |
|---|---|---|---|---|---|---|---|
| Q1 (11.22-16.74 s) | 200 | 1.74 | 1.83 | 0.50 | 0.78 | 11.47 | 11.84 |
| Q2 (16.75-18.05 s) | 200 | 2.04 | 2.14 | 1.00 | 1.18 | 11.65 | 12.26 |
| Q3 (18.06-19.47 s) | 200 | 2.35 | 2.52 | 1.00 | 1.60 | 12.43 | 13.42 |
| Q4 (19.50-21.30 s) | 199 | 2.48 | 2.81 | 1.00 | 2.01 | 12.12 | 13.79 |
| Q5 (21.33-38.89 s) | 199 | 3.36 | 4.86 | 2.00 | 6.10 | 14.70 | 19.56 |
- Mean diff [95% CI] (Q5 (21.33-38.89 s) minus Q1 (11.22-16.74 s)): time +3.03 [+2.46, +3.71]; exc +5.32 [+3.68, +7.21]; share% +7.72 [+5.49, +10.04]
- Spearman rho [95% CI], n=998: totalTime vs cross time 0.466 [0.413, 0.517]; totalTime vs excess HTM 0.311 [0.251, 0.371]

### 7. Blocks of 100 solves in chronological order (B1 oldest; position in the 1000). Columns: group, n, cross time s, excess HTM, used HTM, opt HTM chosen, longest pause s
| group | n | time med | time mean | exc med | exc mean | used med | used mean | opt med | opt mean | pause med | pause mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 2026-11-05..2026-11-05 | 100 | 2.06 | 3.67 | 1.00 | 5.45 | 7.00 | 11.19 | 6.00 | 5.74 | 0.54 | 0.76 |
| B2 2026-11-05..2026-11-06 | 99 | 2.22 | 2.92 | 1.00 | 2.22 | 7.00 | 7.87 | 6.00 | 5.65 | 0.64 | 0.78 |
| B3 2026-11-06..2026-11-10 | 99 | 2.22 | 2.79 | 1.00 | 1.88 | 7.00 | 7.70 | 6.00 | 5.82 | 0.61 | 0.80 |
| B4 2026-11-10..2026-11-11 | 100 | 1.97 | 2.29 | 1.00 | 1.22 | 6.00 | 6.92 | 6.00 | 5.70 | 0.57 | 0.68 |
| B5 2026-11-11..2026-11-12 | 100 | 2.37 | 2.66 | 1.00 | 1.46 | 7.00 | 7.39 | 6.00 | 5.93 | 0.66 | 0.80 |
| B6 2026-11-12..2026-11-13 | 100 | 2.37 | 2.89 | 1.00 | 2.10 | 7.00 | 7.98 | 6.00 | 5.88 | 0.64 | 0.77 |
| B7 2026-11-13..2026-11-17 | 100 | 2.29 | 2.79 | 1.00 | 2.12 | 7.00 | 7.89 | 6.00 | 5.77 | 0.66 | 0.76 |
| B8 2026-11-17..2026-11-18 | 100 | 2.25 | 2.48 | 1.00 | 1.63 | 7.00 | 7.45 | 6.00 | 5.82 | 0.56 | 0.68 |
| B9 2026-11-18..2026-11-19 | 100 | 2.33 | 3.13 | 1.00 | 2.94 | 7.00 | 8.72 | 6.00 | 5.78 | 0.63 | 0.78 |
| B10 2026-11-19..2026-11-20 | 100 | 2.25 | 2.70 | 1.00 | 2.29 | 7.00 | 8.11 | 6.00 | 5.82 | 0.60 | 0.71 |
- Mean diff [95% CI] (B10 2026-11-19..2026-11-20 minus B1 2026-11-05..2026-11-05): time -0.98 [-2.01, +0.07]; exc -3.16 [-6.24, -0.06]; used -3.08 [-5.99, -0.05]; opt +0.08 [-0.15, +0.30]; pause -0.05 [-0.22, +0.10]
- Spearman rho [95% CI], n=998: position vs cross time 0.017 [-0.043, 0.082]; vs excess HTM -0.021 [-0.083, 0.042]; vs longest pause 0.028 [-0.038, 0.090]

## Planning proxies

### 8a. Longest inter-move pause inside cross. Columns: stat, value
| stat | value |
|---|---|
| n | 998 |
| median s | 0.60 |
| mean s | 0.75 |
| p90 s | 1.23 |
| crosses with any pause > 400 ms | 885 (88.7%) |
| crosses with any pause > 800 ms | 288 (28.9%) |
| crosses with zero pauses > 300 ms | 17 (1.7%) |

### 8b. By longest pause bucket. Columns: group, n, cross time s, excess HTM, used HTM
| group | n | time med | time mean | exc med | exc mean | used med | used mean |
|---|---|---|---|---|---|---|---|
| no pause > 400 | 113 | 1.44 | 1.43 | 0.00 | 0.62 | 6.00 | 5.88 |
| pause 400-800 | 597 | 2.04 | 2.17 | 1.00 | 1.24 | 7.00 | 7.00 |
| pause > 800 | 288 | 3.51 | 4.75 | 2.00 | 5.27 | 8.00 | 11.32 |
- Mean diff [95% CI] (pause > 800 minus no pause > 400): time +3.32 [+2.90, +3.76]; exc +4.65 [+3.38, +6.06]; used +5.43 [+4.15, +6.80]
- Spearman rho [95% CI], n=998: longest pause vs excess HTM 0.391 [0.333, 0.444]; vs cross time 0.758 [0.727, 0.786]

### 8c. By inspectionTime tercile (T1 shortest). Columns: group, n, cross time s, excess HTM, longest pause s, opt HTM
| group | n | time med | time mean | exc med | exc mean | pause med | pause mean | opt med | opt mean |
|---|---|---|---|---|---|---|---|---|---|
| T1 (3.33-8.43 s) | 333 | 1.86 | 2.16 | 1.00 | 1.20 | 0.54 | 0.64 | 6.00 | 5.50 |
| T2 (8.43-13.77 s) | 333 | 2.25 | 2.86 | 1.00 | 2.39 | 0.63 | 0.75 | 6.00 | 5.83 |
| T3 (13.80-197.14 s) | 332 | 2.70 | 3.47 | 1.00 | 3.41 | 0.70 | 0.87 | 6.00 | 6.04 |
- Mean diff [95% CI] (T3 (13.80-197.14 s) minus T1 (3.33-8.43 s)): time +1.31 [+0.96, +1.69]; exc +2.20 [+1.25, +3.27]; pause +0.23 [+0.16, +0.31]; opt +0.54 [+0.42, +0.66]
- Spearman rho [95% CI], n=998: inspection vs excess HTM 0.255 [0.195, 0.309]; vs cross time 0.359 [0.303, 0.414]; vs longest pause 0.261 [0.199, 0.320]; vs opt HTM 0.319 [0.262, 0.375]

Inspection time: median 10.48 s, mean 13.74 s, min 3.33, max 197.14.

## Cross to first pair

### 9a. First-pair recognition (stage f2l1 recognition) s. Columns: n, min, p10, p25, median, p75, p90, max, mean, >1.0 s, >1.5 s, >2.0 s
| n | min | p10 | p25 | med | p75 | p90 | max | mean | >1.0 | >1.5 | >2.0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 998 | 0.00 | 0.27 | 0.51 | 0.91 | 1.53 | 2.13 | 4.29 | 1.08 | 451 (45.2%) | 257 (25.8%) | 124 (12.4%) |

Missing f2l1 recognition: 0. Recognition == 0 at pair 1: 33.

### 9b. Recognition by F2L pair order. Columns: pair, n, median s, mean s, >1.0, >1.5, >2.0
| pair | n | median | mean | >1.0 | >1.5 | >2.0 |
|---|---|---|---|---|---|---|
| pair 1 | 998 | 0.91 | 1.08 | 451 (45.2%) | 257 (25.8%) | 124 (12.4%) |
| pair 2 | 998 | 0.93 | 1.04 | 458 (45.9%) | 211 (21.1%) | 88 (8.8%) |
| pair 3 | 998 | 0.94 | 1.01 | 461 (46.2%) | 162 (16.2%) | 60 (6.0%) |
| pair 4 | 998 | 0.91 | 0.99 | 442 (44.3%) | 148 (14.8%) | 42 (4.2%) |

- Paired mean diff recognition, same solve, n=998, s [95% CI]: pair1 minus mean(pairs 2-4) +0.06 [+0.01, +0.11]; minus pair2 +0.03 [-0.03, +0.10]; minus pair3 +0.07 [+0.01, +0.13]; minus pair4 +0.09 [+0.03, +0.14]
- Pair 1 execution median 1.59 mean 1.80; pair 2-4 execution medians 1.53/1.41/1.08 mean 1.76/1.59/1.20 (s).
- Spearman rho [95% CI], n=998: first-pair recognition vs cross excess HTM -0.059 [-0.125, 0.006]; vs cross time -0.037 [-0.099, 0.029]; vs cross longest pause -0.028 [-0.089, 0.035]; vs inspection 0.055 [-0.010, 0.114]; vs cross used HTM -0.020 [-0.086, 0.048]; vs opt HTM 0.071 [0.014, 0.130]

### 9c. First-pair recognition by cross excess HTM. Columns: group=excess, n, rec median, rec mean, share above thresholds
| group | n | rec med s | rec mean s | >1.0 | >1.5 | >2.0 |
|---|---|---|---|---|---|---|
| 0 | 331 | 0.90 | 1.09 | 149 (45.0%) | 89 (26.9%) | 41 (12.4%) |
| 1 | 323 | 0.99 | 1.11 | 158 (48.9%) | 84 (26.0%) | 41 (12.7%) |
| 2 | 172 | 0.94 | 1.12 | 78 (45.3%) | 48 (27.9%) | 24 (14.0%) |
| 3+ | 172 | 0.84 | 0.93 | 66 (38.4%) | 36 (20.9%) | 18 (10.5%) |
- Mean diff recognition s [95% CI] (3+ minus 0): -0.16 [-0.30, -0.02]

### 9d. First-pair recognition by longest cross pause bucket
| group | n | rec med s | rec mean s | >1.0 | >1.5 | >2.0 |
|---|---|---|---|---|---|---|
| no pause > 400 | 113 | 0.88 | 1.13 | 55 (48.7%) | 32 (28.3%) | 14 (12.4%) |
| pause 400-800 | 597 | 0.92 | 1.06 | 265 (44.4%) | 144 (24.1%) | 65 (10.9%) |
| pause > 800 | 288 | 0.92 | 1.10 | 131 (45.5%) | 81 (28.1%) | 45 (15.6%) |
- Mean diff recognition s [95% CI] (pause > 800 minus no pause > 400): -0.03 [-0.20, +0.13]

### 9e. First-pair recognition by inspection tercile
| group | n | rec med s | rec mean s | >1.0 | >1.5 | >2.0 |
|---|---|---|---|---|---|---|
| inspection T1 (3.33-8.43 s) | 333 | 0.88 | 1.02 | 142 (42.6%) | 72 (21.6%) | 35 (10.5%) |
| inspection T2 (8.43-13.77 s) | 333 | 0.96 | 1.06 | 156 (46.8%) | 92 (27.6%) | 41 (12.3%) |
| inspection T3 (13.80-197.14 s) | 332 | 0.95 | 1.14 | 153 (46.1%) | 93 (28.0%) | 48 (14.5%) |
- Mean diff recognition s [95% CI] (inspection T3 (13.80-197.14 s) minus inspection T1 (3.33-8.43 s)): +0.11 [+0.01, +0.23]

### 9f. First-pair recognition by cross time tercile
| group | n | rec med s | rec mean s | >1.0 | >1.5 | >2.0 |
|---|---|---|---|---|---|---|
| cross time T1 (0.12-1.88 s) | 333 | 0.88 | 1.10 | 153 (45.9%) | 95 (28.5%) | 45 (13.5%) |
| cross time T2 (1.89-2.70 s) | 333 | 0.96 | 1.08 | 152 (45.6%) | 76 (22.8%) | 35 (10.5%) |
| cross time T3 (2.70-27.06 s) | 332 | 0.90 | 1.05 | 146 (44.0%) | 86 (25.9%) | 44 (13.3%) |
- Mean diff recognition s [95% CI] (cross time T3 (2.70-27.06 s) minus cross time T1 (0.12-1.88 s)): -0.06 [-0.17, +0.06]

### 9g. First-pair recognition by pair already solved at cross end
| group | n | rec med s | rec mean s | >1.0 | >1.5 | >2.0 |
|---|---|---|---|---|---|---|
| no pair solved at cross end | 965 | 0.96 | 1.11 | 451 (46.7%) | 257 (26.6%) | 124 (12.8%) |
| >=1 pair solved at cross end | 33 | 0.00 | 0.00 | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) |
- Mean diff recognition s [95% CI] (>=1 pair solved at cross end minus no pair solved at cross end): -1.11 [-1.16, -1.07]

First-pair recognition vs total F2L pair-1 time: pair 1 stage time median 2.67 s mean 2.88 s.

## Face choice quality

### 10a. Optimal cross length under face policies. Columns: policy, n, median, mean, mean diff vs chosen face with CI (negative = shorter than chosen)
| policy | n | median | mean | mean diff vs chosen [CI] |
|---|---|---|---|---|
| chosen face HTM | 998 | 6.00 | 5.79 | - |
| best of 6 HTM | 998 | 5.00 | 4.80 | -0.99 [-1.06, -0.92] |
| best of used faces (U) HTM | 998 | 6.00 | 5.79 | +0.00 [-0.07, +0.07] |
| U only HTM | 998 | 6.00 | 5.79 | +0.00 [-0.07, +0.07] |
| D only HTM | 998 | 6.00 | 5.80 | +0.01 [-0.06, +0.08] |
| best of U,D HTM | 998 | 5.00 | 5.36 | -0.43 [-0.50, -0.36] |
| chosen face QTM | 998 | 7.00 | 6.61 | - |
| best of 6 QTM | 998 | 6.00 | 5.47 | -1.14 [-1.21, -1.06] |
| best of used faces QTM | 998 | 7.00 | 6.60 | -0.00 [-0.08, +0.08] |
| U only QTM | 998 | 7.00 | 6.60 | -0.00 [-0.08, +0.08] |
| D only QTM | 998 | 7.00 | 6.59 | -0.02 [-0.09, +0.07] |
| best of U,D QTM | 998 | 6.00 | 6.14 | -0.46 [-0.54, -0.39] |

### 10b. Moves lost by chosen face vs better available face (HTM). Columns: lost, n vs best of 6, n vs best of used faces
| lost | vs best6 n | vs used-faces n |
|---|---|---|
| 0 | 350 | 998 |
| 1 | 374 | 0 |
| 2 | 214 | 0 |
| 3+ | 60 | 0 |

Mean lost vs best6 0.99, vs used faces 0.00. Chosen face is a (tied-)best of 6 in 350 of 998; (tied-)best of used faces in 998 of 998.

Chosen face is the unique best of 6 in 81 of 998.

### 10c. Actual used HTM versus alternatives (mean over solves). Columns: quantity, n, median, mean, mean diff vs used with CI
| quantity | n | median | mean | mean diff [CI] |
|---|---|---|---|---|
| used HTM | 998 | 7.00 | 8.12 | - |
| opt chosen | 998 | 6.00 | 5.79 | -2.33 [-2.80, -1.92] |
| opt best6 | 998 | 5.00 | 4.80 | -3.33 [-3.79, -2.89] |
| opt best of used faces | 998 | 6.00 | 5.79 | -2.33 [-2.77, -1.93] |

### 10d. Cross time and excess when chosen face is (tied) best of 6 vs not. Columns: group, n, cross time s, excess HTM, used HTM
| group | n | time med | time mean | exc med | exc mean | used med | used mean |
|---|---|---|---|---|---|---|---|
| chosen is best | 350 | 1.83 | 2.23 | 1.00 | 1.64 | 6.00 | 6.76 |
| chosen not best | 648 | 2.46 | 3.15 | 1.00 | 2.70 | 7.00 | 8.86 |
- Mean diff [95% CI] (chosen not best minus chosen is best): time +0.92 [+0.64, +1.18]; exc +1.06 [+0.30, +1.83]; used +2.10 [+1.36, +2.84]
- Pairs in place at acubemy cross end, counts for 0..4 pairs: 965 15 2 2 14
