# Overview analysis: last 1000 smart-cube solves (CFOP, acubemy)
Times in seconds (2dp). Local time = UTC+9. All CI: 95% percentile bootstrap, 2000 resamples, seed 20261120; resampling whole sittings (gap>10 min) so serial dependence is kept, unless marked iid. LOW-N = n<30. 2 non-CFOP solves (1 Roux, 1 ZZ) are excluded from every stage-level number (stage n=998); totalTime/turn/tps/fluency/inspection-only tables use all 1000 where stated. Totals are raw totalTime (the 1 plus_two solve is not +2'd).

## 1. Distribution of totalTime (n=1000)
**T1a totalTime distribution** — n; mean; median; sd; min; max; p10..p90 = deciles (linear interpolation), all in s
| n | mean | median | sd | min | max | p10 | p20 | p30 | p40 | p50 | p60 | p70 | p80 | p90 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1000 | 19.27 | 18.74 | 3.39 | 11.22 | 38.89 | 15.69 | 16.75 | 17.43 | 18.06 | 18.74 | 19.48 | 20.32 | 21.34 | 23.13 |

**T1b threshold shares** — each cell = count (percent of 1000) with strict inequality (<15.00, <18.00, <20.00, >25.00 s); +2 / DNF = solves with flag plus_two / dnf
| sub-15 | sub-18 | sub-20 | over-25 | +2 | DNF |
|---|---|---|---|---|---|
| 50 (5.0%) | 393 (39.3%) | 665 (66.5%) | 56 (5.6%) | 1 | 0 |

**T1c best and current** — best = best rolling window of that size over the 1000 in date order (trimmed mean: drop k fastest + k slowest, k=ceil(5% of N), i.e. WCA rule: ao5 k=1, ao12 k=1, ao50 k=3, ao100 k=5); dates = first..last solve of best window; current = latest window (ending at newest solve); mean-of-N = untrimmed mean of same window (best / current)
| stat | best (s) | best window dates | k | current (s) | best mean-of-N | current mean-of-N |
|---|---|---|---|---|---|---|
| single | 11.22 | 2026-11-08 | - | 19.95 | - | - |
| ao5 | 14.66 | 2026-11-13..2026-11-14 | 1 | 19.05 | 14.87 | 18.43 |
| ao12 | 16.43 | 2026-11-19..2026-11-20 | 1 | 18.53 | 16.27 | 19.28 |
| ao50 | 17.77 | 2026-11-19..2026-11-20 | 3 | 18.61 | 17.97 | 19.04 |
| ao100 | 18.21 | 2026-11-05..2026-11-06 | 5 | 18.26 | 18.36 | 18.72 |

## 2. Trend across the 1000 (oldest -> newest)
**T2a blocks of 100 (block 1 = oldest): totals and stage means** — block; local dates; n_cfop = CFOP solves in block (stage columns use these; total columns use all solves in block); total mean/median; cross..pll = mean stage time
| blk | dates | n_cfop | tot mean | tot med | cross | f2l1 | f2l2 | f2l3 | f2l4 | oll | pll |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-11-05..2026-11-05 | 100 | 19.33 | 18.21 | 3.67 | 2.81 | 2.55 | 2.50 | 2.08 | 2.59 | 3.13 |
| 2 | 2026-11-06..2026-11-06 | 99 | 19.24 | 18.58 | 2.92 | 2.98 | 2.77 | 2.55 | 2.19 | 2.66 | 3.14 |
| 3 | 2026-11-06..2026-11-10 | 99 | 19.64 | 19.01 | 2.79 | 3.04 | 2.87 | 2.61 | 2.28 | 2.64 | 3.27 |
| 4 | 2026-11-10..2026-11-11 | 100 | 18.80 | 18.54 | 2.29 | 3.00 | 3.00 | 2.52 | 2.18 | 2.59 | 3.23 |
| 5 | 2026-11-12..2026-11-12 | 100 | 19.15 | 18.75 | 2.66 | 2.94 | 2.80 | 2.58 | 2.19 | 2.68 | 3.31 |
| 6 | 2026-11-12..2026-11-14 | 100 | 19.57 | 19.21 | 2.89 | 2.77 | 2.86 | 2.62 | 2.16 | 2.80 | 3.47 |
| 7 | 2026-11-14..2026-11-17 | 100 | 19.69 | 19.10 | 2.79 | 3.05 | 2.86 | 2.75 | 2.19 | 2.76 | 3.30 |
| 8 | 2026-11-17..2026-11-18 | 100 | 19.04 | 18.53 | 2.48 | 2.75 | 2.86 | 2.74 | 2.14 | 2.55 | 3.52 |
| 9 | 2026-11-18..2026-11-19 | 100 | 19.55 | 19.14 | 3.13 | 3.00 | 2.68 | 2.52 | 2.23 | 2.57 | 3.42 |
| 10 | 2026-11-19..2026-11-20 | 100 | 18.72 | 17.77 | 2.70 | 2.47 | 2.80 | 2.55 | 2.29 | 2.43 | 3.49 |

**T2b blocks of 100: stage medians, recognition/execution, turns, tps, fluency, inspection** — cross..pll = median stage time; rec / exe = per-solve sum over 7 stages (cross recognition = cross_time - cross_execution_time, derived); each rec/exe/turns/tps/flu/insp cell = mean/median over the block (turns = turnCount, flu = fluencyPercent, insp = inspectionTime s; turns/tps/flu/insp use all solves in block)
| blk | cross | f2l1 | f2l2 | f2l3 | f2l4 | oll | pll | rec | exe | turns | tps | flu | insp |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2.06 | 2.52 | 2.36 | 2.43 | 2.14 | 2.40 | 3.11 | 5.65/5.65 | 13.68/12.62 | 72.9/71 | 3.83/3.83 | 55.5/56 | 15.96/12.94 |
| 2 | 2.22 | 2.73 | 2.63 | 2.46 | 2.16 | 2.56 | 3.14 | 6.28/5.90 | 12.92/12.15 | 71.5/72 | 3.76/3.79 | 52.5/52 | 11.85/9.67 |
| 3 | 2.22 | 2.89 | 2.46 | 2.52 | 2.14 | 2.63 | 3.24 | 6.15/6.11 | 13.34/12.93 | 73.2/72 | 3.77/3.80 | 54.4/55 | 12.26/9.59 |
| 4 | 1.97 | 2.78 | 2.71 | 2.38 | 2.03 | 2.40 | 3.27 | 6.01/5.79 | 12.80/12.61 | 72.8/72 | 3.91/3.89 | 55.0/55 | 15.34/9.67 |
| 5 | 2.37 | 2.77 | 2.50 | 2.42 | 2.07 | 2.40 | 3.23 | 6.09/6.09 | 13.06/12.76 | 75.7/75 | 3.99/4.04 | 55.5/56 | 14.76/9.84 |
| 6 | 2.37 | 2.63 | 2.66 | 2.46 | 2.04 | 2.54 | 3.26 | 6.05/6.03 | 13.53/13.21 | 72.4/70 | 3.73/3.74 | 55.3/55 | 11.51/9.68 |
| 7 | 2.29 | 2.84 | 2.70 | 2.58 | 2.13 | 2.56 | 3.23 | 6.22/5.94 | 13.46/12.87 | 74.5/73 | 3.82/3.86 | 55.5/55 | 14.03/12.24 |
| 8 | 2.25 | 2.65 | 2.65 | 2.71 | 2.04 | 2.43 | 3.12 | 6.15/6.04 | 12.89/12.71 | 72.2/72 | 3.84/3.81 | 55.0/55 | 15.50/10.92 |
| 9 | 2.33 | 2.82 | 2.58 | 2.40 | 2.08 | 2.53 | 3.30 | 6.21/6.42 | 13.34/12.78 | 72.4/72 | 3.74/3.73 | 54.0/54 | 12.12/10.50 |
| 10 | 2.25 | 2.24 | 2.56 | 2.34 | 2.01 | 2.32 | 3.04 | 5.79/5.69 | 12.93/11.86 | 72.3/70 | 3.91/3.87 | 55.8/55 | 13.98/10.59 |

**T2d linear trend (OLS)** — n; mean; slope per 100 solves (s, or unit of the row: turns, tps, %, s) with sitting-cluster CI; iid CI of same slope; slope per calendar day (elapsed time, sitting-cluster CI); median(last 100) minus median(first 100) with CI. Negative = faster/lower
| series | n | mean | slope/100 [CI cluster] | CI iid | slope/day [CI cluster] | med last100 - first100 [CI] |
|---|---|---|---|---|---|---|
| total (n=1000) | 1000 | 19.27 | -0.02 [-0.12, 0.10] | [-0.09, 0.06] | -0.01 [-0.07, 0.05] | -0.44 [-2.28, 1.23] |
| cross | 998 | 2.83 | -0.04 [-0.13, 0.04] | [-0.12, 0.02] | -0.02 [-0.07, 0.02] | +0.19 [-0.96, 0.56] |
| f2l1 | 998 | 2.88 | -0.02 [-0.06, 0.01] | [-0.05, 0.01] | -0.01 [-0.03, 0.00] | -0.28 [-0.42, 0.72] |
| f2l2 | 998 | 2.80 | +0.01 [-0.02, 0.04] | [-0.02, 0.04] | +0.01 [-0.01, 0.03] | +0.21 [-0.12, 1.17] |
| f2l3 | 998 | 2.59 | +0.01 [-0.01, 0.03] | [-0.01, 0.03] | +0.01 [-0.00, 0.02] | -0.10 [-0.27, 0.75] |
| f2l4 | 998 | 2.19 | +0.01 [-0.01, 0.03] | [-0.02, 0.03] | +0.00 [-0.01, 0.01] | -0.13 [-0.36, 0.30] |
| oll | 998 | 2.63 | -0.01 [-0.03, 0.01] | [-0.03, 0.01] | -0.01 [-0.02, 0.01] | -0.08 [-0.27, 0.78] |
| pll | 998 | 3.33 | +0.04 [0.02, 0.06] | [0.01, 0.08] | +0.02 [0.01, 0.04] | -0.06 [-0.30, 0.12] |
| rec sum | 998 | 6.06 | +0.01 [-0.04, 0.06] | [-0.02, 0.04] | +0.00 [-0.02, 0.04] | +0.04 [-0.55, 1.26] |
| exe sum | 998 | 13.20 | -0.02 [-0.11, 0.07] | [-0.09, 0.05] | -0.01 [-0.06, 0.04] | -0.76 [-1.89, -0.04] |
| turnCount | 1000 | 73.00 | -0.02 [-0.20, 0.18] | [-0.23, 0.19] | +0.01 [-0.10, 0.12] | -1.00 [-4.97, 3.00] |
| tps | 1000 | 3.83 | +0.00 [-0.02, 0.02] | [-0.01, 0.01] | +0.00 [-0.01, 0.01] | +0.04 [-0.17, 0.25] |
| fluency % | 1000 | 54.85 | +0.10 [-0.16, 0.32] | [-0.05, 0.26] | +0.06 [-0.09, 0.19] | -1.00 [-4.00, 2.00] |
| inspection s (all) | 1000 | 13.73 | -0.06 [-0.37, 0.28] | [-0.29, 0.18] | -0.00 [-0.18, 0.18] | -2.35 [-5.28, -1.14] |
| inspection s (<=60s) | 992 | 12.97 | +0.02 [-0.27, 0.31] | [-0.17, 0.22] | +0.03 [-0.13, 0.18] | -2.31 [-5.16, -0.90] |

**T2e by calendar day (UTC+9)** — day; n = solves that day (solves/day); tot mean/med; stage means (CFOP only); rec/exe = mean per-solve sum; turns; tps; fluency = means; insp = median inspection s
| day | n | tot mean | tot med | cross | f2l1 | f2l2 | f2l3 | f2l4 | oll | pll | rec | exe | turns | tps | flu | insp med |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-05 | 100 | 19.33 | 18.21 | 3.67 | 2.81 | 2.55 | 2.50 | 2.08 | 2.59 | 3.13 | 5.65 | 13.68 | 72.9 | 3.83 | 55.5 | 12.94 |
| 2026-11-06 | 116 | 19.12 | 18.58 | 2.86 | 2.98 | 2.72 | 2.52 | 2.20 | 2.67 | 3.15 | 6.26 | 12.83 | 71.4 | 3.78 | 52.6 | 9.47 |
| 2026-11-07 | 12 LOW-N | 20.32 | 19.68 | 4.17 | 2.64 | 2.39 | 2.63 | 2.13 | 2.50 | 3.86 | 5.40 | 14.92 | 71.3 | 3.57 | 55.1 | 9.84 |
| 2026-11-08 | 56 | 19.30 | 18.75 | 2.41 | 3.10 | 2.99 | 2.74 | 2.34 | 2.58 | 3.14 | 6.34 | 12.96 | 73.0 | 3.83 | 55.1 | 9.24 |
| 2026-11-09 | 10 LOW-N | 20.22 | 19.41 | 3.63 | 2.64 | 3.24 | 2.52 | 2.13 | 2.97 | 3.09 | 6.03 | 14.20 | 74.6 | 3.71 | 53.5 | 12.02 |
| 2026-11-10 | 39 | 19.96 | 18.93 | 2.45 | 3.35 | 3.14 | 2.58 | 2.22 | 2.54 | 3.29 | 6.32 | 13.26 | 74.8 | 3.79 | 53.5 | 9.28 |
| 2026-11-11 | 67 | 18.58 | 18.51 | 2.25 | 2.90 | 2.95 | 2.47 | 2.15 | 2.63 | 3.24 | 5.83 | 12.75 | 72.6 | 3.94 | 55.6 | 10.05 |
| 2026-11-12 | 133 | 19.09 | 18.81 | 2.66 | 2.89 | 2.80 | 2.63 | 2.17 | 2.63 | 3.30 | 6.14 | 12.95 | 74.6 | 3.95 | 55.1 | 9.64 |
| 2026-11-13 | 56 | 20.38 | 19.63 | 3.16 | 2.86 | 2.84 | 2.56 | 2.20 | 3.01 | 3.75 | 6.02 | 14.36 | 73.5 | 3.64 | 55.3 | 9.85 |
| 2026-11-14 | 35 | 18.93 | 18.33 | 2.61 | 2.69 | 2.76 | 2.77 | 2.21 | 2.86 | 3.04 | 5.60 | 13.33 | 74.0 | 3.94 | 58.4 | 11.66 |
| 2026-11-16 | 75 | 19.69 | 19.14 | 2.80 | 3.14 | 2.91 | 2.70 | 2.14 | 2.70 | 3.32 | 6.42 | 13.27 | 73.9 | 3.79 | 54.6 | 12.18 |
| 2026-11-17 | 96 | 18.97 | 18.50 | 2.44 | 2.64 | 2.89 | 2.73 | 2.15 | 2.57 | 3.55 | 6.17 | 12.80 | 72.4 | 3.86 | 55.2 | 10.48 |
| 2026-11-18 | 59 | 19.12 | 18.84 | 2.74 | 3.10 | 2.77 | 2.53 | 2.22 | 2.45 | 3.31 | 6.17 | 12.96 | 71.5 | 3.77 | 54.5 | 9.64 |
| 2026-11-19 | 49 | 20.02 | 19.56 | 3.54 | 3.01 | 2.57 | 2.52 | 2.22 | 2.67 | 3.49 | 6.18 | 13.83 | 73.0 | 3.69 | 53.5 | 11.73 |
| 2026-11-20 | 97 | 18.79 | 17.79 | 2.71 | 2.46 | 2.82 | 2.56 | 2.29 | 2.43 | 3.51 | 5.79 | 13.00 | 72.4 | 3.90 | 55.7 | 10.65 |

## 3. Whole-history context (export.downloadSolves, all sessions)
**T3a sessions in export** — session_name; n solves; first..last local date; median and mean totalTime (s); device_name counts (None = missing)
| session | n | dates | median | mean | devices |
|---|---|---|---|---|---|
| Default Session | 3569 | 2026-07-30..2026-11-20 | 20.16 | 20.94 | QY-QYSC-S-23C0:1944, None:3, GANi4_9072:1622 |
| Slow Solve | 377 | 2026-07-31..2026-09-12 | 21.96 | 23.13 | QY-QYSC-S-23C0:374, None:3 |
| OH | 32 | 2026-08-22..2026-11-03 | 49.54 | 52.69 | QY-QYSC-S-23C0:10, GANi4_9072:22 |
| Daily Scramble | 6 LOW-N | 2026-07-31..2026-08-27 | 20.34 | 21.31 | QY-QYSC-S-23C0:6 |

**T3b Default Session in blocks of 250 (oldest -> newest): stage time medians** — blk (part = last partial block); local dates; n all/stage-valid CFOP; device_name (first 4 chars; QY-Q.. = QiYi, GANi = GAN) counts; median total (all solves in block); median of each stage time (stage-valid only)
| blk | dates | n | device | tot med | cross | f2l1 | f2l2 | f2l3 | f2l4 | oll | pll |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-07-30..2026-08-01 | 250/250 | QY-Q250 | 23.42 | 2.65 | 3.68 | 3.42 | 3.04 | 2.52 | 2.93 | 3.87 |
| 2 | 2026-08-01..2026-08-05 | 250/249 | QY-Q249+?1 | 23.04 | 2.83 | 3.33 | 3.47 | 2.98 | 2.43 | 2.92 | 3.87 |
| 3 | 2026-08-05..2026-08-07 | 250/250 | QY-Q250 | 23.15 | 2.86 | 3.60 | 3.15 | 3.06 | 2.36 | 2.79 | 3.83 |
| 4 | 2026-08-07..2026-08-18 | 250/248 | QY-Q248+?2 | 22.81 | 2.79 | 3.44 | 3.19 | 2.90 | 2.47 | 2.79 | 3.62 |
| 5 | 2026-08-18..2026-09-03 | 250/250 | QY-Q250 | 21.01 | 2.47 | 3.24 | 2.92 | 2.75 | 2.25 | 2.78 | 3.60 |
| 6 | 2026-09-03..2026-09-12 | 250/250 | QY-Q250 | 20.34 | 2.48 | 3.06 | 2.81 | 2.56 | 2.25 | 2.63 | 3.60 |
| 7 | 2026-09-12..2026-10-05 | 250/250 | QY-Q250 | 20.24 | 2.47 | 2.95 | 2.88 | 2.63 | 2.21 | 2.65 | 3.51 |
| 8 | 2026-10-05..2026-11-02 | 250/250 | QY-Q197+GANi53 | 18.96 | 2.20 | 2.83 | 2.75 | 2.48 | 2.10 | 2.62 | 3.35 |
| 9 | 2026-11-02..2026-11-03 | 250/247 | GANi250 | 18.68 | 2.09 | 2.65 | 2.73 | 2.52 | 2.16 | 2.57 | 3.21 |
| 10 | 2026-11-03..2026-11-04 | 250/250 | GANi250 | 18.60 | 2.11 | 2.72 | 2.70 | 2.43 | 2.10 | 2.52 | 3.24 |
| 11 | 2026-11-04..2026-11-06 | 250/250 | GANi250 | 18.60 | 2.19 | 2.65 | 2.58 | 2.50 | 2.16 | 2.58 | 3.18 |
| 12 | 2026-11-06..2026-11-12 | 250/248 | GANi250 | 18.84 | 2.13 | 2.86 | 2.60 | 2.42 | 2.11 | 2.50 | 3.24 |
| 13 | 2026-11-12..2026-11-16 | 250/250 | GANi250 | 19.11 | 2.34 | 2.73 | 2.67 | 2.48 | 2.04 | 2.52 | 3.26 |
| 14 | 2026-11-16..2026-11-20 | 250/250 | GANi250 | 18.70 | 2.22 | 2.67 | 2.56 | 2.46 | 2.06 | 2.46 | 3.15 |
| 15(part) | 2026-11-20..2026-11-20 | 69/69 | GANi69 | 17.98 | 2.31 | 2.28 | 2.58 | 2.34 | 2.04 | 2.28 | 3.03 |

**T3c same blocks: median recognition / execution** — each cell = median recognition / median execution (s) of that stage (cross recognition = cross_time - cross_execution_time; omitted here, see T3b for cross time); rec/exe sum = median of per-solve sums over 7 stages
| blk | f2l1 rec/exe | f2l2 rec/exe | f2l3 rec/exe | f2l4 rec/exe | oll rec/exe | pll rec/exe | rec sum | exe sum |
|---|---|---|---|---|---|---|---|---|
| 1 | 1.26/2.25 | 1.16/2.11 | 1.10/1.64 | 1.16/1.22 | 1.17/1.63 | 1.21/2.47 | 7.46 | 15.45 |
| 2 | 1.08/2.07 | 1.26/2.02 | 1.17/1.62 | 1.22/1.08 | 1.17/1.71 | 1.22/2.52 | 7.74 | 15.30 |
| 3 | 1.19/2.23 | 1.06/1.87 | 1.17/1.75 | 1.17/1.13 | 1.08/1.71 | 1.22/2.43 | 7.47 | 15.25 |
| 4 | 1.24/1.96 | 1.17/1.89 | 1.22/1.71 | 1.22/1.12 | 1.08/1.66 | 1.12/2.43 | 7.52 | 15.19 |
| 5 | 1.08/1.98 | 0.99/1.68 | 0.95/1.60 | 1.05/1.17 | 1.04/1.62 | 1.17/2.43 | 6.77 | 14.20 |
| 6 | 1.10/1.89 | 0.94/1.78 | 1.03/1.44 | 0.99/1.08 | 0.94/1.62 | 1.08/2.38 | 6.46 | 13.68 |
| 7 | 1.08/1.75 | 1.08/1.71 | 1.03/1.44 | 1.01/1.04 | 0.95/1.68 | 1.08/2.36 | 6.66 | 13.63 |
| 8 | 1.06/1.73 | 0.99/1.58 | 0.95/1.44 | 0.99/1.05 | 0.90/1.63 | 0.99/2.25 | 6.34 | 12.57 |
| 9 | 0.96/1.47 | 0.93/1.59 | 0.94/1.51 | 0.99/1.01 | 0.91/1.59 | 0.93/2.23 | 6.08 | 12.48 |
| 10 | 1.01/1.59 | 0.99/1.56 | 0.90/1.42 | 0.96/1.06 | 0.92/1.59 | 0.91/2.27 | 6.12 | 12.30 |
| 11 | 0.91/1.56 | 0.87/1.59 | 0.98/1.38 | 0.99/1.07 | 0.86/1.59 | 0.88/2.19 | 5.91 | 12.55 |
| 12 | 0.96/1.63 | 0.98/1.47 | 0.93/1.35 | 0.84/1.13 | 0.84/1.58 | 0.90/2.25 | 5.93 | 12.87 |
| 13 | 0.96/1.64 | 0.99/1.64 | 0.96/1.44 | 0.93/1.05 | 0.87/1.56 | 0.87/2.34 | 6.03 | 13.05 |
| 14 | 0.96/1.62 | 0.93/1.55 | 0.95/1.47 | 0.96/1.05 | 0.87/1.44 | 0.93/2.13 | 6.13 | 12.46 |
| 15 | 0.78/1.38 | 0.93/1.53 | 0.87/1.41 | 0.90/1.08 | 0.78/1.53 | 0.84/2.07 | 5.68 | 12.33 |

**T3d lifetime change in Default Session (block 1 vs block 14, each 250 solves)** — n used; median in first block; median in last full block; median diff (last - first) [CI]; mean diff [CI]; OLS slope per 1000 solves [CI]. CI: sitting-cluster bootstrap. Device changed over this span (see T3b/T3e), so this mixes skill and hardware
| metric | n | med blk1 | med blk14 | median diff [CI] | mean diff [CI] | slope/1000 [CI] |
|---|---|---|---|---|---|---|
| total (all Default) | 3569 | 23.42 | 18.70 | -4.71 [-5.79, -3.84] | -4.87 [-5.74, -4.02] | -1.71 [-1.92, -1.50] |
| cross | 3561 | 2.65 | 2.22 | -0.43 [-0.96, -0.24] | -0.60 [-1.11, -0.14] | -0.23 [-0.32, -0.15] |
| f2l1 | 3561 | 3.68 | 2.67 | -1.01 [-1.48, -0.60] | -0.98 [-1.43, -0.60] | -0.33 [-0.39, -0.26] |
| f2l2 | 3561 | 3.42 | 2.56 | -0.85 [-1.21, -0.58] | -0.90 [-1.30, -0.69] | -0.28 [-0.32, -0.23] |
| f2l3 | 3561 | 3.04 | 2.46 | -0.58 [-1.02, -0.26] | -0.57 [-0.90, -0.41] | -0.24 [-0.30, -0.19] |
| f2l4 | 3561 | 2.52 | 2.06 | -0.46 [-0.59, -0.23] | -0.46 [-0.61, -0.15] | -0.18 [-0.22, -0.14] |
| oll | 3561 | 2.93 | 2.46 | -0.47 [-0.59, -0.20] | -0.61 [-0.84, -0.31] | -0.18 [-0.22, -0.13] |
| pll | 3561 | 3.87 | 3.15 | -0.72 [-1.00, -0.45] | -0.75 [-1.06, -0.33] | -0.28 [-0.34, -0.22] |
| rec sum | 3561 | 7.46 | 6.13 | -1.32 [-1.99, -1.02] | -1.58 [-2.30, -1.29] | -0.60 [-0.71, -0.51] |
| exe sum | 3561 | 15.45 | 12.46 | -2.99 [-4.13, -2.34] | -3.29 [-4.01, -2.07] | -1.11 [-1.28, -0.94] |
| f2l rec | 3561 | 5.03 | 4.10 | -0.93 [-1.53, -0.67] | -1.00 [-1.74, -0.67] | -0.39 [-0.49, -0.30] |
| f2l exe | 3561 | 7.78 | 6.09 | -1.70 [-2.52, -1.21] | -1.90 [-2.55, -1.05] | -0.64 [-0.75, -0.52] |
| oll rec | 3561 | 1.17 | 0.87 | -0.30 [-0.34, -0.20] | -0.27 [-0.34, -0.17] | -0.09 [-0.11, -0.07] |
| oll exe | 3561 | 1.63 | 1.44 | -0.19 [-0.29, -0.00] | -0.34 [-0.52, -0.11] | -0.09 [-0.12, -0.05] |
| pll rec | 3561 | 1.21 | 0.93 | -0.28 [-0.33, -0.20] | -0.30 [-0.38, -0.22] | -0.12 [-0.14, -0.11] |
| pll exe | 3561 | 2.47 | 2.13 | -0.34 [-0.55, -0.21] | -0.45 [-0.78, -0.03] | -0.15 [-0.21, -0.10] |

**T3e Default Session by device_name** — n; local dates; median total; median of cross, F2L (sum of 4 pairs), OLL, PLL time; median rec sum and exe sum (stage-valid solves)
| device | n | dates | tot | cross | f2l | oll | pll | rec | exe |
|---|---|---|---|---|---|---|---|---|---|
| QY-QYSC-S-23C0 | 1944 | 2026-07-30..2026-10-29 | 21.66 | 2.61 | 11.97 | 2.75 | 3.62 | 7.09 | 14.44 |
| GANi4_9072 | 1622 | 2026-11-01..2026-11-20 | 18.72 | 2.19 | 10.36 | 2.52 | 3.22 | 6.01 | 12.60 |

## 4. Sittings (gap between consecutive solve dates > 10 min), n=1000
Sitting size distribution: n_sittings=38; solves/sitting mean 26.3, median 24, min 1, p25 10, p75 41, p90 52, max 63; sitting span median 22 min; sittings by size: <10 8, 10-19 6, 20-39 13, 40+ 11; sittings with n<30: 21. Per-sitting list (start, n, span, median) is in overview.json s4.sittings.

**T4b by position in sitting** — position range (1 = first solve of a sitting); n solves; n_sittings contributing; median and mean totalTime
| pos | n | sittings | median | mean |
|---|---|---|---|---|
| 1-5 | 171 | 38 | 18.96 | 19.57 |
| 6-10 | 151 | 31 | 18.75 | 19.19 |
| 11-20 | 255 | 28 | 18.66 | 19.54 |
| 21-40 | 322 | 22 | 18.63 | 18.93 |
| 41-80 | 101 | 10 | 18.54 | 19.33 |
| 81+ | 0 | 0 | - | - |

**T4c by local hour of day (00-23) then day of week (UTC+9)** — label = hour (rows 00-23) or weekday; n solves; sittings = sittings touching that hour/weekday; median / mean totalTime
| hour/dow | n | sittings | median | mean |
|---|---|---|---|---|
| 00 | 98 | 3 | 18.66 | 19.03 |
| 01 | 48 | 2 | 18.36 | 19.23 |
| 07 | 45 | 2 | 19.17 | 19.35 |
| 08 | 13 LOW-N | 1 | 18.69 | 18.51 |
| 10 | 30 | 2 | 17.85 | 18.91 |
| 11 | 93 | 6 | 19.05 | 19.53 |
| 12 | 84 | 5 | 19.09 | 19.51 |
| 13 | 87 | 5 | 18.22 | 19.12 |
| 14 | 111 | 5 | 18.99 | 19.35 |
| 15 | 51 | 5 | 19.38 | 20.21 |
| 16 | 96 | 7 | 18.74 | 19.35 |
| 17 | 27 LOW-N | 1 | 18.51 | 18.71 |
| 18 | 1 LOW-N | 1 | 20.55 | 20.55 |
| 19 | 33 | 2 | 18.53 | 18.82 |
| 20 | 52 | 2 | 19.88 | 20.31 |
| 21 | 9 LOW-N | 1 | 18.27 | 19.51 |
| 22 | 104 | 3 | 18.37 | 18.78 |
| 23 | 18 LOW-N | 2 | 17.00 | 17.88 |
| Mon | 85 | 4 | 19.23 | 19.76 |
| Tue | 135 | 7 | 18.57 | 19.26 |
| Wed | 126 | 7 | 18.69 | 18.84 |
| Thu | 282 | 8 | 18.81 | 19.34 |
| Fri | 269 | 10 | 18.60 | 19.27 |
| Sat | 47 | 2 | 18.48 | 19.29 |
| Sun | 56 | 1 | 18.75 | 19.30 |

**T4e warm-up and fatigue effects** — A vs B = group A minus group B in s (positive = A slower); nA/nB solves; pooled = difference of all solves in groups, sitting-cluster CI; within-sitting = per-sitting (mean A - mean B) averaged over sittings having both groups, CI over those sittings (n sittings shown)
| contrast | nA/nB | pooled mean diff [CI] | pooled median diff [CI] | within-sitting mean diff [CI] |
|---|---|---|---|---|
| warm-up: pos 1-5 vs 11-40 | 171/577 | +0.37 [-0.22, 1.00] | +0.30 [-0.23, 0.96] | 28 LOW-N: +0.50 [-0.19, 1.17] |
| warm-up: pos 1-10 vs 11-40 | 322/577 | +0.19 [-0.25, 0.64] | +0.21 [-0.24, 0.67] | 28 LOW-N: +0.28 [-0.18, 0.76] |
| fatigue: pos 41-80 vs 11-40 | 101/577 | +0.13 [-0.82, 0.99] | -0.12 [-1.26, 0.59] | 10 LOW-N: -0.81 [-2.10, 0.29] |
| fatigue: pos 81+ vs 11-40 | 0 | - | - | - |

## 5. Sequential effects (n=1000, chronological)
**T5a autocorrelation of totalTime** — Pearson r between solve t and t+lag; all pairs = n pairs, CI = circular block bootstrap (block 25); same-sitting = only pairs inside one sitting, CI = sitting-cluster; demeaned = same pairs after subtracting each sitting's mean time
| lag | n all | r all pairs [CI] | n same-sit | r same-sitting [CI] | r demeaned [CI] |
|---|---|---|---|---|---|
| 1 | 999 | +0.037 [-0.032, 0.112] | 962 | +0.028 [-0.053, 0.116] | -0.031 [-0.106, 0.050] |
| 2 | 998 | +0.050 [-0.009, 0.102] | 928 | +0.056 [-0.008, 0.113] | -0.000 [-0.053, 0.052] |
| 3 | 997 | +0.048 [-0.010, 0.104] | 894 | +0.048 [-0.006, 0.095] | -0.002 [-0.056, 0.051] |

**T5b time of the solve right after an own-top-10% / bottom-10% solve** — top10% = totalTime <= 15.69 s; bottom10% = >= 23.13 s (own p10/p90 of the 1000); n followers; mean/median follower time; baseline mean/median over all solves with a predecessor (same-sitting variant: predecessor in same sitting); diff = follower minus baseline [sitting-cluster CI]; resid = same diff after subtracting each solve's sitting mean
| predecessor set | group | n | mean | median | baseline mean/med | mean diff [CI] | median diff [CI] | resid mean diff [CI] |
|---|---|---|---|---|---|---|---|---|
| all consecutive | after top10% | 100 | 19.38 | 18.62 | 19.28/18.75 (n=999) | +0.11 [-0.60, 0.83] | -0.13 [-0.89, 0.66] | +0.38 [-0.33, 1.11] |
| all consecutive | after bottom10% | 101 | 19.87 | 19.38 | 19.28/18.75 (n=999) | +0.59 [-0.04, 1.17] | +0.63 [-0.24, 0.99] | +0.08 [-0.50, 0.58] |
| same sitting only | after top10% | 93 | 19.52 | 18.72 | 19.26/18.71 (n=962) | +0.26 [-0.48, 1.00] | +0.02 [-0.83, 0.69] | +0.54 [-0.21, 1.31] |
| same sitting only | after bottom10% | 98 | 19.76 | 19.25 | 19.26/18.71 (n=962) | +0.50 [-0.14, 1.09] | +0.55 [-0.28, 0.95] | -0.03 [-0.61, 0.47] |

## 6. Time decomposition (CFOP only, n=998)
**T6a stage and recognition/execution shares** — mean/median/sd/min/max of stage time (s); share1 = mean over solves of stage/total (%); share2 = sum of stage time / sum of totals (%); rec/exe = mean recognition / execution time (s); rec% = recognition as % of that stage's time. sum rec/sum exe = per-solve totals over 7 stages
| stage | mean | median | sd | min | max | share1 % | share2 % | mean rec | mean exe | rec % |
|---|---|---|---|---|---|---|---|---|---|---|
| cross | 2.83 | 2.22 | 2.48 | 0.12 | 27.06 | 14.2 | 14.7 | 0.01 | 2.82 | 0.5 |
| f2l1 | 2.88 | 2.67 | 1.36 | 0.00 | 11.46 | 15.0 | 15.0 | 1.08 | 1.80 | 37.4 |
| f2l2 | 2.80 | 2.61 | 1.24 | 0.00 | 9.69 | 14.6 | 14.6 | 1.04 | 1.76 | 37.3 |
| f2l3 | 2.59 | 2.46 | 1.07 | 0.00 | 11.01 | 13.6 | 13.5 | 1.01 | 1.59 | 38.9 |
| f2l4 | 2.19 | 2.10 | 0.95 | 0.00 | 17.91 | 11.5 | 11.4 | 0.99 | 1.20 | 45.1 |
| oll | 2.63 | 2.49 | 0.95 | 0.00 | 10.83 | 13.8 | 13.6 | 0.96 | 1.66 | 36.7 |
| pll | 3.33 | 3.21 | 1.50 | 0.00 | 23.04 | 17.3 | 17.3 | 0.96 | 2.37 | 28.9 |
| sum rec | 6.06 | 5.94 | 1.41 | 1.31 | 10.83 | 31.9 | 31.5 |  |  |  |
| sum exe | 13.20 | 12.66 | 3.23 | 6.84 | 30.14 | 68.1 | 68.5 |  |  |  |

**T6b quintiles by totalTime (Q1 fastest fifth ... Q5 slowest)** — n; total range; every column = mean over the quintile (stage times in s; rec/exe = per-solve sums; turns; tps; insp = mean/median inspection s; flu = fluencyPercent)
| Q | n | range | total | cross | f2l1 | f2l2 | f2l3 | f2l4 | oll | pll | rec | exe | turns | tps | insp mean/med | flu |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Q1 | 200 | 11.22-16.74 | 15.49 | 1.83 | 2.28 | 2.16 | 2.15 | 1.92 | 2.27 | 2.87 | 5.34 | 10.15 | 64.5 | 4.17 | 11.43/9.33 | 59.3 |
| Q2 | 200 | 16.75-18.05 | 17.44 | 2.14 | 2.59 | 2.62 | 2.41 | 2.13 | 2.45 | 3.10 | 5.74 | 11.70 | 68.9 | 3.95 | 13.78/10.22 | 56.8 |
| Q3 | 200 | 18.06-19.47 | 18.74 | 2.52 | 2.84 | 2.87 | 2.59 | 2.16 | 2.50 | 3.25 | 6.06 | 12.69 | 72.3 | 3.86 | 13.08/10.12 | 55.0 |
| Q4 | 199 | 19.50-21.30 | 20.34 | 2.81 | 3.29 | 3.05 | 2.84 | 2.33 | 2.76 | 3.26 | 6.56 | 13.77 | 75.3 | 3.71 | 15.07/11.20 | 53.3 |
| Q5 | 199 | 21.33-38.89 | 24.29 | 4.86 | 3.39 | 3.33 | 2.98 | 2.41 | 3.15 | 4.17 | 6.61 | 17.68 | 83.8 | 3.47 | 15.33/11.92 | 49.9 |

**T6c gap fastest fifth -> median fifth** — difference in mean (Q3 mean minus Q1 mean), s, per stage; share = stage diff / total diff (%); rec / exe = same difference for recognition / execution time alone (stage time = rec + exe); [CI] sitting-cluster bootstrap. Q1 mean total 15.49, Q3 18.74
| stage | time diff [CI] | share of gap | rec diff [CI] | exe diff [CI] |
|---|---|---|---|---|
| cross | +0.68 [0.50, 0.91] | 21.1% [15, 28] | -0.01 [-0.02, 0.00] | +0.69 [0.50, 0.92] |
| f2l1 | +0.56 [0.42, 0.70] | 17.3% [13, 21] | +0.16 [0.04, 0.28] | +0.40 [0.25, 0.54] |
| f2l2 | +0.71 [0.54, 0.87] | 21.8% [17, 27] | +0.18 [0.06, 0.29] | +0.53 [0.37, 0.68] |
| f2l3 | +0.44 [0.30, 0.57] | 13.5% [9, 18] | +0.13 [0.04, 0.24] | +0.30 [0.16, 0.44] |
| f2l4 | +0.24 [0.12, 0.36] | 7.4% [4, 11] | +0.07 [-0.02, 0.16] | +0.17 [0.05, 0.28] |
| f2l (4 pairs) | +1.95 [1.67, 2.18] | 59.9% [52, 67] | +0.55 [0.34, 0.75] | +1.40 [1.17, 1.59] |
| oll | +0.23 [0.12, 0.34] | 7.0% [4, 11] | +0.06 [0.00, 0.12] | +0.17 [0.09, 0.25] |
| pll | +0.39 [0.26, 0.52] | 12.0% [8, 16] | +0.11 [0.06, 0.17] | +0.28 [0.15, 0.40] |
| TOTAL | +3.25 [3.09, 3.41] | 100.0% [100, 100] | +0.71 [0.51, 0.93] | +2.53 [2.30, 2.78] |

**T6d gap median fifth -> slowest fifth** — difference in mean (Q5 mean minus Q3 mean), s, per stage; share = stage diff / total diff (%); rec / exe = same difference for recognition / execution time alone (stage time = rec + exe); [CI] sitting-cluster bootstrap. Q3 mean total 18.74, Q5 24.29
| stage | time diff [CI] | share of gap | rec diff [CI] | exe diff [CI] |
|---|---|---|---|---|
| cross | +2.35 [1.66, 3.03] | 42.3% [30, 54] | +0.02 [0.00, 0.03] | +2.33 [1.64, 3.02] |
| f2l1 | +0.55 [0.25, 0.84] | 9.9% [4, 16] | +0.16 [0.02, 0.31] | +0.38 [0.10, 0.67] |
| f2l2 | +0.45 [0.07, 0.91] | 8.2% [1, 17] | +0.10 [-0.09, 0.30] | +0.36 [0.05, 0.73] |
| f2l3 | +0.39 [0.17, 0.60] | 7.0% [3, 11] | +0.06 [-0.05, 0.17] | +0.33 [0.11, 0.53] |
| f2l4 | +0.25 [0.05, 0.49] | 4.5% [1, 9] | +0.04 [-0.06, 0.13] | +0.21 [0.01, 0.45] |
| f2l (4 pairs) | +1.64 [1.08, 2.28] | 29.6% [19, 42] | +0.36 [0.07, 0.64] | +1.28 [0.86, 1.78] |
| oll | +0.64 [0.36, 0.98] | 11.6% [7, 18] | +0.15 [0.08, 0.22] | +0.50 [0.24, 0.80] |
| pll | +0.92 [0.56, 1.32] | 16.5% [10, 23] | +0.03 [-0.04, 0.09] | +0.89 [0.51, 1.33] |
| TOTAL | +5.55 [5.13, 5.93] | 100.0% [100, 100] | +0.55 [0.27, 0.82] | +5.00 [4.54, 5.43] |

**T6e variance attribution and Spearman with totalTime** — var = sample variance (s^2); cov share = Cov(stage, total)/Var(total) (stage shares of the 7 sum to 100%; f2l row = 4 pairs combined; sum rec + sum exe = 100%) [sitting-cluster CI]; Spearman rho with totalTime [CI] (stage rows are parts of the total, so positive by construction; tps = turns/time is mechanically related)
| variable | var s^2 | cov share of total var [CI %] | Spearman rho [CI] |
|---|---|---|---|
| cross | 6.17 | 36.8% [26, 50] | +0.466 [0.401, 0.526] |
| f2l1 | 1.84 | 9.7% [6, 14] | +0.310 [0.256, 0.370] |
| f2l2 | 1.54 | 9.8% [5, 15] | +0.337 [0.253, 0.417] |
| f2l3 | 1.15 | 7.3% [5, 10] | +0.306 [0.242, 0.355] |
| f2l4 | 0.91 | 5.6% [2, 10] | +0.204 [0.148, 0.265] |
| oll | 0.90 | 9.4% [6, 13] | +0.304 [0.227, 0.378] |
| pll | 2.24 | 21.5% [13, 30] | +0.317 [0.253, 0.372] |
| f2l (4 pairs) | 6.03 | 32.4% [24, 42] | +0.685 [0.627, 0.739] |
| sum rec | 1.99 | 12.5% [10, 16] | +0.366 [0.315, 0.417] |
| sum exe | 10.42 | 87.5% [84, 90] | +0.855 [0.822, 0.878] |
| total | 11.25 | 100% | - |
| turnCount | - | - | +0.719 [0.689, 0.748] |
| tps | - | - | -0.602 [-0.651, -0.549] |
| inspectionTime | - | - | +0.137 [0.070, 0.202] |
| fluencyPercent | - | - | -0.442 [-0.486, -0.397] |

## 7. Inspection time
**T7a inspectionTime distribution (all 1000)** — mean; median; sd; min; p5/p25/p75/p95/p99; max (all s); n>30 s and n>60 s; mean / sd after excluding >60 s
| mean | median | sd | min | p5 | p25 | p75 | p95 | p99 | max | n>30s | n>60s | mean/sd excl>60s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 13.73 | 10.48 | 12.19 | 3.33 | 5.19 | 7.55 | 16.30 | 31.24 | 53.65 | 197.14 | 53 | 8 | 12.97/8.02 |

**T7b by inspection tercile (CFOP, n=998; T1 shortest inspection)** — n; inspection range s; median inspection; then mean and median of cross time, pair-1 (first F2L pair) recognition time, and total (s); last row = T3 minus T1 [sitting-cluster CI]
| tercile | n | insp range | insp med | cross mean | cross med | p1 rec mean | p1 rec med | total mean | total med |
|---|---|---|---|---|---|---|---|---|---|
| T1 | 333 | 3.33-8.43 | 6.54 | 2.16 | 1.86 | 1.02 | 0.88 | 18.80 | 18.18 |
| T2 | 333 | 8.43-13.77 | 10.50 | 2.86 | 2.25 | 1.06 | 0.96 | 19.27 | 18.82 |
| T3 | 332 | 13.80-197.14 | 19.58 | 3.47 | 2.70 | 1.14 | 0.94 | 19.70 | 19.12 |
| T3-T1 |  |  |  | +1.31 [0.86, 1.85] | +0.84 [0.64, 1.05] | +0.11 [0.00, 0.22] | +0.07 [-0.06, 0.21] | +0.90 [0.29, 1.49] | +0.94 [0.24, 1.59] |

**T7c Spearman of inspectionTime with** — variable; n; Spearman rho [sitting-cluster CI]
| vs | n | rho [CI] |
|---|---|---|
| cross time | 998 | +0.359 [0.289, 0.416] |
| pair-1 recognition | 998 | +0.055 [-0.002, 0.117] |
| pair-1 time | 998 | +0.017 [-0.037, 0.076] |
| pair-1 execution | 998 | -0.036 [-0.087, 0.018] |
| total | 998 | +0.137 [0.070, 0.202] |

## 8. Small acubemy-computed files (raw/)
- profile.json: solvingMethod=CFOP, goalTime=15000 ms (15.00 s), plan=basic, badges=0, tournaments top3 = {'first': 0, 'second': 0, 'third': 0}. (name/email omitted)
- stats-averages.json (sampleSize 998; acubemy / own mean over the 998 CFOP, s): solveAvg 19.26/19.26; crossAvg 2.83/2.83; f2lAvg 10.47/10.47; ollAvg 2.63/2.63; pllAvg 3.33/3.33; ollRecognitionAvg 0.96/0.96; ollExecutionAvg 1.66/1.66; pllRecognitionAvg 0.97/0.96; pllExecutionAvg 2.40/2.37. acubemy pll rec+exe = 3.37 vs its pllAvg 3.33; own 3.33 vs 3.33.
- stats-averageMoveCount.json: 74.68. Own on the 1000: mean turnCount 73.00 (998 CFOP 72.96); mean len(solutionSequence) 78.49; mean len(rawSolutionSequence) 82.58.
- sessions.json: Default Session (inspection off, scrambleMode random, export n=3569); Daily Scramble (inspection on, scrambleMode random, export n=6); Slow Solve (inspection off, scrambleMode random, export n=377); OH (inspection off, scrambleMode random, export n=32); all event 333, excludeFromStats false for 4/4.
- devices.json (MAC omitted): 12 entries, QY-QYSC-S-23C0 x10, GANi4_9072 x2; export solves per device_name/date range: QY-QYSC-S-23C0: 2334 (2026-07-30..2026-10-29); None: 6 (2026-08-02..2026-08-20); GANi4_9072: 1644 (2026-11-01..2026-11-20).
- stats-wrapped.json: every value zero/null (totalSolves 0, activeDays 0, ollSkip 0, pllSkip 0, sessionCount 0); no information.

## Data-quality notes (numbers)
- The 1000 vs newest 1000 of the export: identical=False (export-only: [('2026-11-20T05:38:12.354Z', 'Default Session')]; 1000-only: ['2026-11-05T06:16:20.602Z']); session of all 1000: {'Default Session': 1000}; date span 2026-11-05..2026-11-20 (15 calendar days, 38 sittings). Export Default Session n=3569, stage-valid 3561.
- after derivation, rec+exe != stage time: 0 of 6986 stage values; stage sum != total: 0 solves. Cross recognition (derived = cross_time - cross_execution_time so rec+exe=time holds) is >0 in 34 solves (max 0.99 s, sum 14.48 s); with cross rec=0 instead, rec+exe != time in 34 stage values. Zero-time stages per stage: {'cross': 0, 'f2l1': 33, 'f2l2': 19, 'f2l3': 17, 'f2l4': 15, 'oll': 2, 'pll': 6}.
- F2L slotIndex has 4 distinct values in only 235 of 998 solves (pairs are time-ordered segments, not guaranteed 1 per slot). Inspection >30 s: 53, >60 s: 8 (max 197.14 s); session inspectionTime flag = [False]. Flags: {'none': 999, 'plus_two': 1}. Non-CFOP: [(191, 'Roux', 22781), (296, 'ZZ', 34659)] (index, type, ms).
