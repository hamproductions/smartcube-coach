# Last layer (OLL / PLL) analysis

A = the 1000 newest solves of detail data minus the 2 non-CFOP (Roux, ZZ) = n 998, 2026-11-05 to 2026-11-20. B = Default Session, newest 2000 export rows (5 excluded: non-CFOP or missing analysis) = n 1995, 2026-09-16 to 2026-11-20; B contains A (998 shared timestamps). All times seconds. Seed 20261120, 2000 bootstrap resamples, 95% percentile CIs. LOW-N = n<30. Stage "time" = recognition + execution as acubemy reports it; moves = HTM, one token = 1 (X2 = 1, wide/slice = 1, rotations = 0, identity tokens = 0), matches acubemy turnCount on 1000/1000. TPS = stage moves / stage execution seconds (moves >= 2, exec > 0). Skip stages are excluded from time/rec/exec statistics unless the row says skip.

## Numbering and skip encoding (evidence)
- OLL: bundle chunk 7769 `ollCases` has 57 entries, `caseIndex` 0..56, `name` = "OLL "+(caseIndex+1). UI shows `"OLL "+(analysis.oll.case+1)`. So `oll.case` = standard OLL number minus 1; -1 = no OLL (skip). Export `oll_case_id` equals `oll.case` on 998/998 CFOP solves.
- Bundle `setup` is the inverse of the solving alg (inverse(setup of OLL 48) = F R U R' U' R U R' U' F', the observed idx-47 solve). Alg comparison uses the normalised key (see 3b). Cases whose most common solver alg equals the bundle alg of the labelled case: 26/57 (bundle alg appears at least once in 34); equals the bundle alg of case idx-1: 0, of idx+1: 0. Per solve (n 996): key equals bundle alg of labelled case 356, of idx-1 0, of idx+1 0, of any other case 0. PLL: top alg equals bundle alg in 8/21, appears at least once in 9 (solver uses other algs for the rest).
- Theory: OLL P = (#orientation states in bundle `lexicographicRanks`)/216, total 215 + skip 1; PLL P = states/72, total 71 + skip 1. Both read from the bundle, not memory.
- Detail vs export consistency: 0 of 1996 LL stages (time, rec, exec, tokens, timestamps) differ between `detail` and `export` rows.
- zbllCase: -1 on 996 of 998 solves; set on 2: f824aef6 idx 367 (ZBLL S 40) with oll.case 26, pll.case Unknown; f68d8356 idx 465 (ZBLL AS 66) with oll.case 25, pll.case Unknown.

### Skip encoding and rate
Columns: dataset; n solves; OLL skip = case -1 (n, of which empty moveSequence, of which time 0, % of solves, exact binomial p vs 1/216); PLL skip = case "Unknown" (n, of which empty moveSequence/time 0, AUF-only moveSequence, other non-AUF moves), % of solves, binomial p vs 1/72); double skips; PLL empty but case named; OLL empty but case set.

| set | n | OLL skip | empty | t=0 | % | p | PLL skip | empty | AUF-only | other | % | p | both | PLL empty named | OLL empty set |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 998 | 2 | 2 | 2 | 0.2 | 0.344 | 15 | 6 | 7 | 2 | 1.5 | 0.685 | 0 | 0 | 0 |
| B | 1995 | 4 | 4 | 4 | 0.2 | 0.096 | 34 | 8 | 24 | 2 | 1.7 | 0.214 | 0 | 0 | 0 |

### Chi-square vs theory (Monte-Carlo p, 20000 draws)
Columns: dataset, cells, N, chi2, df, MC p, cells with expected <5. OLL cells = 57 cases + skip; PLL cells = 21 cases + skip.

| set | table | N | chi2 | df | p | cells E<5 |
|---|---|---|---|---|---|---|
| A | oll | 998 | 53.9 | 57 | 0.590 | 2 |
| A | pll | 998 | 16.9 | 21 | 0.727 | 0 |
| B | oll | 1995 | 59.9 | 57 | 0.371 | 0 |
| B | pll | 1995 | 20.3 | 21 | 0.504 | 0 |

### 1. Stage level distributions (skips excluded)
Columns: dataset, stage, n non-skip, metric, mean, then p10..p90 (p50 = median). Share = stage time / totalTime x 100.

| set | stage | n | metric | mean | p10 | p20 | p30 | p40 | p50 | p60 | p70 | p80 | p90 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | OLL | 996 | time s | 2.63 | 1.74 | 1.98 | 2.13 | 2.28 | 2.49 | 2.64 | 2.85 | 3.15 | 3.57 |
| A | OLL | 996 | recognition s | 0.97 | 0.57 | 0.66 | 0.72 | 0.78 | 0.84 | 0.96 | 1.11 | 1.23 | 1.47 |
| A | OLL | 996 | execution s | 1.67 | 0.96 | 1.17 | 1.31 | 1.44 | 1.53 | 1.66 | 1.83 | 1.98 | 2.28 |
| A | OLL | 996 | moves HTM | 11.6 | 8.0 | 9.0 | 10.0 | 10.0 | 11.0 | 12.0 | 13.0 | 14.0 | 15.0 |
| A | OLL | 996 | exec TPS | 7.42 | 5.44 | 6.15 | 6.52 | 6.97 | 7.37 | 7.69 | 8.12 | 8.57 | 9.50 |
| A | OLL | 996 | share of solve % | 13.8 | 9.4 | 10.4 | 11.4 | 12.2 | 13.0 | 14.0 | 15.2 | 16.5 | 19.1 |
| A | PLL | 983 | time s | 3.37 | 2.49 | 2.76 | 2.91 | 3.06 | 3.21 | 3.35 | 3.51 | 3.71 | 4.11 |
| A | PLL | 983 | recognition s | 0.97 | 0.61 | 0.71 | 0.75 | 0.84 | 0.90 | 0.99 | 1.11 | 1.20 | 1.41 |
| A | PLL | 983 | execution s | 2.40 | 1.62 | 1.83 | 1.98 | 2.07 | 2.22 | 2.34 | 2.52 | 2.73 | 3.03 |
| A | PLL | 983 | moves HTM | 16.3 | 12.0 | 13.0 | 14.0 | 15.0 | 16.0 | 17.0 | 17.0 | 18.0 | 19.0 |
| A | PLL | 983 | exec TPS | 7.20 | 5.39 | 5.97 | 6.39 | 6.66 | 7.02 | 7.38 | 7.80 | 8.33 | 9.21 |
| A | PLL | 983 | share of solve % | 17.5 | 12.6 | 14.2 | 15.3 | 16.2 | 17.0 | 17.9 | 19.0 | 20.1 | 22.1 |
| B | OLL | 1991 | time s | 2.71 | 1.80 | 2.03 | 2.19 | 2.37 | 2.55 | 2.73 | 2.93 | 3.21 | 3.68 |
| B | OLL | 1991 | recognition s | 0.99 | 0.57 | 0.66 | 0.72 | 0.81 | 0.89 | 0.99 | 1.14 | 1.29 | 1.52 |
| B | OLL | 1991 | execution s | 1.72 | 0.99 | 1.18 | 1.35 | 1.44 | 1.58 | 1.71 | 1.86 | 2.01 | 2.36 |
| B | OLL | 1991 | moves HTM | 11.7 | 8.0 | 9.0 | 10.0 | 11.0 | 11.0 | 12.0 | 13.0 | 14.0 | 15.0 |
| B | OLL | 1991 | exec TPS | 7.30 | 5.32 | 5.98 | 6.43 | 6.88 | 7.22 | 7.59 | 7.99 | 8.50 | 9.33 |
| B | OLL | 1991 | share of solve % | 14.1 | 9.5 | 10.6 | 11.6 | 12.5 | 13.4 | 14.3 | 15.6 | 16.8 | 19.4 |
| B | PLL | 1961 | time s | 3.43 | 2.50 | 2.76 | 2.94 | 3.10 | 3.27 | 3.42 | 3.60 | 3.81 | 4.23 |
| B | PLL | 1961 | recognition s | 1.00 | 0.61 | 0.72 | 0.78 | 0.84 | 0.93 | 1.02 | 1.14 | 1.26 | 1.49 |
| B | PLL | 1961 | execution s | 2.43 | 1.65 | 1.83 | 1.98 | 2.11 | 2.25 | 2.40 | 2.53 | 2.76 | 3.10 |
| B | PLL | 1961 | moves HTM | 16.3 | 12.0 | 13.0 | 14.0 | 15.0 | 16.0 | 17.0 | 17.0 | 18.0 | 19.0 |
| B | PLL | 1961 | exec TPS | 7.11 | 5.30 | 5.83 | 6.25 | 6.58 | 6.93 | 7.27 | 7.73 | 8.31 | 9.23 |
| B | PLL | 1961 | share of solve % | 17.7 | 12.8 | 14.4 | 15.4 | 16.3 | 17.2 | 18.1 | 19.2 | 20.3 | 22.3 |

### 1b. By totalTime quintile (A)
Columns: quintile of totalTime (1 fastest), n, totalTime range, then medians: OLL time, PLL time, OLL rec, PLL rec, OLL exec, PLL exec, OLL moves, PLL moves (non-skip stages), LL time (OLL+PLL all solves), LL share % of solve.

| Q | n | total range | OLL t | PLL t | OLL rec | PLL rec | OLL ex | PLL ex | OLL mv | PLL mv | LL t | LL % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 200 | 11.22-16.74 | 2.19 | 3.06 | 0.78 | 0.87 | 1.38 | 2.06 | 10.0 | 16.0 | 5.13 | 33.2 |
| 2 | 200 | 16.75-18.05 | 2.34 | 3.06 | 0.81 | 0.84 | 1.44 | 2.16 | 11.0 | 16.0 | 5.49 | 31.5 |
| 3 | 199 | 18.06-19.47 | 2.40 | 3.24 | 0.84 | 0.95 | 1.49 | 2.19 | 11.0 | 16.5 | 5.64 | 30.2 |
| 4 | 200 | 19.47-21.30 | 2.64 | 3.27 | 0.90 | 0.96 | 1.65 | 2.20 | 12.0 | 16.0 | 5.91 | 29.2 |
| 5 | 199 | 21.33-38.89 | 2.76 | 3.58 | 0.99 | 0.93 | 1.74 | 2.53 | 12.0 | 17.0 | 6.56 | 27.9 |

Q5 minus Q1 median difference (A, bootstrap CI): ll_time_s 1.43 [1.14, 1.65]; ll_share_pct -5.38 [-6.69, -3.53]; oll_time_s_nonskip 0.57 [0.36, 0.76]; pll_time_s_nonskip 0.52 [0.42, 0.69]

### 1c. Trend by blocks of 100 (A, oldest to newest)
Columns: block, n solves, date range, median totalTime, then per stage (non-skip n) medians of time, rec, exec, moves; LL time median, LL share %.

| blk | n | dates | total | OLL n | t | rec | ex | mv | PLL n | t | rec | ex | mv | LL t | LL % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 100 | 2026-11-05..2026-11-05 | 18.21 | 100 | 2.40 | 0.84 | 1.54 | 11.0 | 100 | 3.11 | 0.90 | 2.13 | 16.0 | 5.58 | 30.1 |
| 2 | 100 | 2026-11-05..2026-11-06 | 18.51 | 100 | 2.55 | 0.84 | 1.57 | 11.5 | 98 | 3.19 | 0.88 | 2.18 | 16.0 | 5.71 | 30.4 |
| 3 | 100 | 2026-11-06..2026-11-10 | 19.12 | 99 | 2.64 | 0.87 | 1.62 | 12.0 | 99 | 3.24 | 0.94 | 2.26 | 16.0 | 5.88 | 30.2 |
| 4 | 100 | 2026-11-10..2026-11-11 | 18.51 | 100 | 2.40 | 0.78 | 1.57 | 11.0 | 98 | 3.27 | 0.89 | 2.24 | 17.0 | 5.66 | 30.8 |
| 5 | 100 | 2026-11-11..2026-11-12 | 18.84 | 100 | 2.40 | 0.85 | 1.51 | 12.0 | 99 | 3.23 | 0.84 | 2.34 | 17.0 | 5.62 | 30.4 |
| 6 | 100 | 2026-11-12..2026-11-13 | 19.17 | 100 | 2.55 | 0.87 | 1.56 | 11.0 | 96 | 3.33 | 0.90 | 2.31 | 17.0 | 5.84 | 31.1 |
| 7 | 100 | 2026-11-13..2026-11-17 | 19.01 | 100 | 2.53 | 0.91 | 1.50 | 11.0 | 98 | 3.25 | 0.93 | 2.28 | 16.0 | 5.78 | 30.9 |
| 8 | 100 | 2026-11-17..2026-11-18 | 18.53 | 99 | 2.43 | 0.90 | 1.44 | 11.0 | 100 | 3.09 | 0.90 | 2.13 | 16.0 | 5.57 | 30.5 |
| 9 | 100 | 2026-11-18..2026-11-19 | 19.13 | 100 | 2.53 | 0.87 | 1.56 | 11.0 | 99 | 3.30 | 0.96 | 2.16 | 16.0 | 5.71 | 30.4 |
| 10 | 98 | 2026-11-19..2026-11-20 | 17.77 | 98 | 2.32 | 0.80 | 1.48 | 10.5 | 96 | 3.11 | 0.84 | 2.07 | 16.0 | 5.57 | 30.2 |

Newest 100 minus oldest 100 median (A): oll_time -0.08 [-0.36, 0.19]; oll_rec -0.04 [-0.17, 0.03]; oll_exec -0.07 [-0.18, 0.11]; pll_time -0.03 [-0.26, 0.11]; pll_rec -0.06 [-0.16, 0.11]; pll_exec -0.06 [-0.18, 0.10]; Spearman(index, LL time) -0.02 [-0.08, 0.04] n=998
B newest 100 minus oldest 100 median: oll_time -0.42 [-0.62, -0.11]; oll_rec -0.15 [-0.26, -0.06]; oll_exec -0.23 [-0.45, -0.08]; pll_time -0.38 [-0.63, -0.23]; pll_rec -0.31 [-0.36, -0.13]; pll_exec -0.31 [-0.46, -0.12]
B Q5-Q1 totalTime quintile medians: ll_time_s 1.55 [1.35, 1.71]; ll_share_pct -4.31 [-5.45, -3.43]; oll_time_s_nonskip 0.58 [0.47, 0.71]; pll_time_s_nonskip 0.59 [0.48, 0.75]

### 3. PLL per case (A with B alongside), sorted by excess
Columns: case; n A; n B; theory % of solves; observed % A; observed % B; A median stage time, mean, bootstrap CI of median; B median, CI; A median rec, exec, moves, TPS, % rec>1.0 s; B median rec, exec; excess = sum over A executions of max(0, time - A median PLL time of non-skip 3.21); DISAGREE = median CIs of A and B do not overlap. skip row = case Unknown: time/rec/exec there are AUF-only or empty stages.

| case | nA | nB | theory% | A% | B% | A med t | A mean | A CI | B med t | B CI | A rec | A exec | A mv | A TPS | rec>1s% | B rec | B exec | excess s | flag |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gc | 52 | 106 | 5.56 | 5.21 | 5.31 | 3.66 | 4.37 | [3.49, 3.75] | 3.76 | [3.66, 3.96] | 1.10 | 2.58 | 17.0 | 6.62 | 61.5 | 1.11 | 2.66 | 60.79 |  |
| Rb | 61 | 115 | 5.56 | 6.11 | 5.76 | 3.31 | 3.83 | [3.21, 3.45] | 3.48 | [3.38, 3.64] | 1.11 | 2.13 | 15.0 | 7.20 | 65.6 | 1.17 | 2.22 | 42.58 |  |
| Gd | 68 | 134 | 5.56 | 6.81 | 6.72 | 3.57 | 3.81 | [3.45, 3.72] | 3.57 | [3.45, 3.69] | 1.11 | 2.52 | 17.0 | 6.59 | 58.8 | 1.03 | 2.54 | 42.25 |  |
| Ga | 55 | 107 | 5.56 | 5.51 | 5.36 | 3.45 | 3.61 | [3.33, 3.72] | 3.54 | [3.45, 3.69] | 0.93 | 2.56 | 17.0 | 6.59 | 36.4 | 0.96 | 2.53 | 25.64 |  |
| Ra | 59 | 116 | 5.56 | 5.91 | 5.81 | 3.30 | 3.49 | [3.12, 3.36] | 3.33 | [3.24, 3.38] | 0.84 | 2.35 | 17.0 | 7.41 | 30.5 | 0.90 | 2.37 | 23.77 |  |
| V | 62 | 113 | 5.56 | 6.21 | 5.66 | 3.32 | 3.41 | [3.21, 3.44] | 3.36 | [3.27, 3.51] | 0.97 | 2.38 | 18.0 | 7.62 | 41.9 | 0.97 | 2.40 | 18.61 |  |
| Aa | 56 | 115 | 5.56 | 5.61 | 5.76 | 3.35 | 3.40 | [3.17, 3.52] | 3.39 | [3.27, 3.48] | 1.35 | 1.87 | 12.0 | 6.28 | 78.6 | 1.38 | 1.86 | 18.25 |  |
| Ab | 62 | 107 | 5.56 | 6.21 | 5.36 | 3.21 | 3.31 | [3.08, 3.35] | 3.30 | [3.19, 3.42] | 1.21 | 1.92 | 11.5 | 6.02 | 77.4 | 1.32 | 1.92 | 16.52 |  |
| Gb | 55 | 111 | 5.56 | 5.51 | 5.56 | 3.27 | 3.39 | [3.12, 3.48] | 3.27 | [3.18, 3.47] | 0.84 | 2.53 | 17.0 | 6.82 | 29.1 | 0.81 | 2.52 | 16.12 |  |
| Ua | 47 | 92 | 5.56 | 4.71 | 4.61 | 2.93 | 3.21 | [2.79, 3.01] | 2.87 | [2.78, 2.95] | 0.81 | 2.07 | 13.0 | 6.30 | 23.4 | 0.77 | 2.02 | 15.82 |  |
| Ub | 56 | 100 | 5.56 | 5.61 | 5.01 | 2.67 | 2.95 | [2.56, 2.76] | 2.67 | [2.62, 2.78] | 0.73 | 1.85 | 13.0 | 6.93 | 16.1 | 0.73 | 1.92 | 15.73 |  |
| F | 53 | 110 | 5.56 | 5.31 | 5.51 | 3.36 | 3.39 | [3.18, 3.54] | 3.36 | [3.24, 3.51] | 0.75 | 2.58 | 20.0 | 7.63 | 9.4 | 0.75 | 2.61 | 15.48 |  |
| H | 8 LOW-N | 23 LOW-N | 1.39 | 0.80 | 1.15 | 2.43 | 4.49 | [2.34, 2.82] | 2.73 | [2.43, 3.15] | 0.70 | 1.71 | 9.5 | 5.59 | 0.0 | 0.73 | 1.92 | 15.37 |  |
| Na | 13 LOW-N | 28 LOW-N | 1.39 | 1.30 | 1.40 | 3.69 | 4.27 | [3.48, 4.38] | 3.77 | [3.57, 4.14] | 0.81 | 3.00 | 22.0 | 7.35 | 15.4 | 0.89 | 2.58 | 14.35 |  |
| Nb | 18 LOW-N | 29 LOW-N | 1.39 | 1.80 | 1.45 | 3.76 | 3.80 | [3.24, 4.08] | 3.84 | [3.31, 4.05] | 0.96 | 2.79 | 17.0 | 6.29 | 44.4 | 0.91 | 2.97 | 11.84 |  |
| E | 22 LOW-N | 49 | 2.78 | 2.20 | 2.46 | 3.65 | 3.69 | [3.36, 3.91] | 3.60 | [3.38, 3.90] | 1.24 | 2.23 | 18.0 | 7.88 | 100.0 | 1.26 | 2.29 | 11.58 |  |
| Ja | 61 | 131 | 5.56 | 6.11 | 6.57 | 2.93 | 3.01 | [2.82, 3.06] | 2.97 | [2.87, 3.06] | 0.78 | 2.13 | 14.0 | 6.53 | 11.5 | 0.81 | 2.17 | 7.26 |  |
| Z | 22 LOW-N | 45 | 2.78 | 2.20 | 2.26 | 3.27 | 3.32 | [3.00, 3.35] | 3.34 | [3.27, 3.60] | 1.27 | 2.07 | 12.5 | 6.09 | 77.3 | 1.35 | 2.01 | 5.52 |  |
| Jb | 47 | 103 | 5.56 | 4.71 | 5.16 | 2.61 | 2.62 | [2.37, 2.79] | 2.52 | [2.40, 2.61] | 0.63 | 1.92 | 15.0 | 7.93 | 6.4 | 0.69 | 1.83 | 2.71 |  |
| Y | 46 | 107 | 5.56 | 4.61 | 5.36 | 2.86 | 2.86 | [2.73, 2.91] | 2.90 | [2.85, 2.97] | 0.81 | 2.01 | 19.0 | 9.34 | 10.9 | 0.81 | 2.09 | 2.65 |  |
| T | 60 | 120 | 5.56 | 6.01 | 6.02 | 2.40 | 2.50 | [2.25, 2.49] | 2.40 | [2.31, 2.50] | 0.75 | 1.67 | 16.0 | 9.57 | 8.3 | 0.77 | 1.65 | 1.63 |  |
| skip | 15 LOW-N | 34 | 1.39 | 1.50 | 1.70 | 0.48 | 0.43 | [0.00, 0.71] | 0.54 | [0.47, 0.61] | 0.45 | 0.00 | 1.0 | 4.78 | 0.0 | 0.47 | 0.00 | 0.00 |  |

### 3b. PLL behaviour and algs (A)
Columns: case; n; pre-AUF = leading U/d turns before the alg, counts of executions with 0/1/2/3+ such tokens; post-AUF = trailing U tokens, same buckets; fumble = % with an adjacent same-face inverse pair (no rotation between); pause>400 = % with a gap >400 ms between consecutive alg moves (AUF excluded); modal len = tokens of the top alg; long = % with alg length > modal+4; pause500@4+ = % with a gap >500 ms after >=4 alg moves; distinct = number of distinct normalised algs; top1 = share of top alg; class (OLL) = MULTI-STEP if long>=30 or pause500@4+>=30, else CONSISTENT if top1>=60, else MIXED; long and pause use the raw alg moves; top algs use the normalised key: rotation tokens, leading U/d and trailing U stripped, adjacent same-face turns merged or cancelled, commuting opposite-face pairs sorted, X2 and X2' unified, and the four y-relabelled grips (R/F/L/B) merged into the first-sorting one (raw-grip counts in ll.json).

| case | n | pre-AUF 0/1/2/3+ | post-AUF 0/1/2/3+ | fumble% | pause>400% | modal len | long% | pause500@4+% | distinct | top1% | top 3 algs (count) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gc | 52 | 19/23/10/0 | 22/28/2/0 | 17.3 | 59.6 | 15 | 5.8 | 17.3 | 18 | 65.4 | R2 U' R U' R U R' U R2 D' U R U' R' D (34); F l' R' U' R U' R U R' U R2 D' U R U' R' D (2); B2 R2 B' R B' R B R' B R2 S D B' D' B2 F (1) |
| Rb | 61 | 15/28/17/1 | 17/42/2/0 | 29.5 | 19.7 | 13 | 4.9 | 8.2 | 12 | 78.7 | R' U2 R U2 R' F R U R' U' R' F' R2 (48); F' R' F2 R F2 l' F R U R' U' R' F' R2 (2); F2 R' F2 R F2 R' D R U R' U' R' F' R2 (2) |
| Gd | 68 | 33/31/4/0 | 19/43/6/0 | 17.6 | 45.6 | 15 | 5.9 | 23.5 | 12 | 76.5 | R U R' D U' R2 U' R U' R' U R' U R2 D' (52); F R U R' D U' R2 U' R U' R' U R' U R2 D' (3); F2 R F R' B F' R2 F' R F' R' F R' F R2 B' (2) |
| Ga | 55 | 23/25/6/1 | 20/32/3/0 | 10.9 | 27.3 | 15 | 0.0 | 7.3 | 20 | 63.6 | R2 U R' U R' U' R U' R2 D U' R' U R D' (35); R2 U R' U R' U' R U' R2 D F' R' F R B' (2); R2 U R' U R' U' R U' R2 D U' R' F R B' (1) |
| Ra | 59 | 17/41/0/1 | 13/41/5/0 | 15.3 | 33.9 | 15 | 1.7 | 11.9 | 18 | 62.7 | R U' R' U' R U R D R' U' R D' R' U2 R' (37); R U' R' U' R U R D R' U' R D' R' F U R' (3); R U' R' U' R U R D R' U' l B' R' F2 l' (2) |
| V | 62 | 21/40/1/0 | 12/28/22/0 | 8.1 | 41.9 | 13 | 12.9 | 24.2 | 25 | 22.6 | R' U R U' R' B' U2 R' U' R U' R' B (14); R' U R U' R' f' U' R U2 R' U' R U' R' B (13); R' U R U' R' B' U2 R' U' R U' R' f R (4) |
| Aa | 56 | 16/30/8/2 | 39/16/1/0 | 21.4 | 80.4 | 11 | 1.8 | 12.5 | 31 | 14.3 | R' F R' B D R U' R' D2 R2 B (8); R' F R' B D R U' R' D2 R l (7); R' F l' D2 R U' R' D2 R2 B (4) |
| Ab | 62 | 28/29/5/0 | 19/40/3/0 | 9.7 | 61.3 | 9 | 6.5 | 9.7 | 36 | 9.7 | R2 B2 R U R' D2 R U' l (6); R2 B D R U R' D2 R (6); R2 B D R U R' D2 R U' l (6) |
| Gb | 55 | 17/28/10/0 | 18/33/4/0 | 20.0 | 34.5 | 15 | 0.0 | 16.4 | 13 | 74.5 | R' U' R D' U R2 U R' U R U' R U' R2 D (41); R' F' R D' U R2 U R' U R U' R U' R2 D (2); F' R' F' R D' U R2 U R' U R U' R U' R2 D (2) |
| Ua | 47 | 16/25/6/0 | 9/35/3/0 | 23.4 | 29.8 | 11 | 4.3 | 6.4 | 11 | 78.7 | R U' R U R U R U' R' U' R2 (37); F R U' R U R U R U' R' U' R2 (1); F U' F d R U R U' R' U' R2 (1) |
| Ub | 56 | 13/38/5/0 | 13/37/6/0 | 8.9 | 14.3 | 11 | 1.8 | 5.4 | 6 | 91.1 | R2 U R U R' U' R' U' R' U R' (51); F R2 F R F R' F' R' F' R' F R' F2 (1); F2 U R2 U R U R' U' R' U' R' U R' (1) |
| F | 53 | 20/31/2/0 | 18/33/1/1 | 13.2 | 26.4 | 18 | 0.0 | 7.5 | 8 | 81.1 | R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R (43); R' F2 R U R' U' R' F R2 U' R' U' R U R' U R (4); F' R' F2 R U R' U' R' F R2 U' R' U' R U R' U R (1) |
| H | 8 LOW-N | 4/4/0/0 | 6/2/0/0 | 0.0 | 37.5 | 7 | 25.0 | 25.0 | 7 | 25.0 | M2 U M2 U2 M2 U M2 (2); M2 U M2 U2 L2 R2 D M2 (1); R S2 F L2 R2 B2 L2 R2 F L2 R2 (1) |
| Na | 13 LOW-N | 10/0/3/0 | 4/9/0/0 | 30.8 | 38.5 | 21 | 15.4 | 23.1 | 4 | 76.9 | R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R' (10); R D R' D R D R' B' R D R' D' R' B R2 D' R' D2 R D' R' D2 (1); D B D' R' D B D' B' D' R D2 B' D' B2 D B D' B D B D' R' D B D' B' D' R D2 B' D' B2 D B' D' B2 D L D' B' D L D' L' D' B D2 L' D' L' (1) |
| Nb | 18 LOW-N | 14/3/1/0 | 10/8/0/0 | 22.2 | 55.6 | 16 | 5.6 | 33.3 | 14 | 16.7 | r' D' F L F' L' F' D L2 D L' U' L' U L D' (3); F' L' F' D L2 D L' F' L' F L D' (2); L' F' U L U' r' F' D L2 D L' F' L' U L F' (2) |
| E | 22 LOW-N | 14/8/0/0 | 20/2/0/0 | 31.8 | 50.0 | 17 | 0.0 | 27.3 | 16 | 9.1 | R B' R' D R U R' D' R U R' D R U' R' D' F (2); l U' R' D R U R' D' R U R' D R U' R' D' F' (2); R U' R' D R U R' D' R U R' D R U' R' D' F2 (2) |
| Ja | 61 | 21/37/3/0 | 37/24/0/0 | 19.7 | 36.1 | 12 | 1.6 | 14.8 | 32 | 32.8 | L R2 D R D' R F2 L' U L F2 L' (20); L R2 D R D' R F2 L' U L F2 L' U' F' (5); L R2 D R D' R F2 L' U L F2 (3) |
| Z | 22 LOW-N | 8/13/1/0 | 15/6/1/0 | 9.1 | 40.9 | 9 | 18.2 | 27.3 | 17 | 27.3 | M U M2 U M2 U M U2 M2 (6); M U L R' M' F L2 R2 B L' R D U M2 (1); M U L R' M' F M2 F L' R U2 M2 B D (1) |
| Jb | 47 | 14/33/0/0 | 15/26/6/0 | 17.0 | 25.5 | 13 | 2.1 | 6.4 | 7 | 85.1 | R U R' F' R U R' U' R' F R2 U' R' (40); F R F R' D' R U R' U' R' F R2 U' R' (2); r' U2 R U R' F' R U R' U' R' F R2 U' R' (1) |
| Y | 46 | 18/28/0/0 | 14/32/0/0 | 2.2 | 17.4 | 17 | 2.2 | 6.5 | 7 | 80.4 | F R U' R' U' R U R' F' R U R' U' R' F R F' (37); F2 R U' R' U' R U R' F' R U R' U' R' F R F' (3); F' U' F R U' R' U' R U R' F' R U R' U' R' F R F' (2) |
| T | 60 | 23/36/1/0 | 16/43/1/0 | 8.3 | 18.3 | 14 | 0.0 | 10.0 | 10 | 78.3 | R U R' U' R' F R2 U' R' U' R U R' F' (47); F' R F R' F' R' D R2 U' R' U' R U R' F' (4); l F R' F' l' F R2 U' R' U' R U R' F' (2) |

### 4. OLL per case (A with B alongside), sorted by excess
Columns: case; n A; n B; theory % of solves; observed % A; observed % B; A median stage time, mean, bootstrap CI of median; B median, CI; A median rec, exec, moves, TPS, % rec>1.0 s; B median rec, exec; excess = sum over A executions of max(0, time - A median OLL time of non-skip 2.49); DISAGREE = median CIs of A and B do not overlap. skip row = case -1: time/rec/exec there are AUF-only or empty stages.

| case | nA | nB | theory% | A% | B% | A med t | A mean | A CI | B med t | B CI | A rec | A exec | A mv | A TPS | rec>1s% | B rec | B exec | excess s | flag |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OLL 12 | 20 LOW-N | 45 | 1.85 | 2.00 | 2.26 | 3.83 | 4.08 | [3.54, 4.25] | 3.68 | [3.58, 3.93] | 1.53 | 2.06 | 13.0 | 6.02 | 85.0 | 1.50 | 2.10 | 31.83 |  |
| OLL 42 | 21 LOW-N | 38 | 1.85 | 2.10 | 1.90 | 3.34 | 3.45 | [3.18, 3.55] | 3.36 | [3.17, 3.65] | 1.38 | 2.01 | 14.0 | 7.35 | 85.7 | 1.36 | 1.99 | 20.24 |  |
| OLL 29 | 22 LOW-N | 43 | 1.85 | 2.20 | 2.16 | 2.73 | 3.36 | [2.52, 2.94] | 2.65 | [2.53, 2.85] | 0.86 | 1.85 | 14.0 | 7.67 | 31.8 | 0.90 | 1.80 | 20.16 |  |
| OLL 47 | 19 LOW-N | 41 | 1.85 | 1.90 | 2.06 | 3.36 | 3.53 | [3.12, 4.08] | 3.34 | [3.10, 3.67] | 1.62 | 1.89 | 14.0 | 7.40 | 73.7 | 1.38 | 1.76 | 19.84 |  |
| OLL 3 | 22 LOW-N | 43 | 1.85 | 2.20 | 2.16 | 3.06 | 3.24 | [2.77, 3.42] | 3.09 | [2.91, 3.30] | 1.20 | 1.92 | 14.0 | 7.53 | 77.3 | 1.14 | 1.93 | 16.49 |  |
| OLL 4 | 21 LOW-N | 38 | 1.85 | 2.10 | 1.90 | 3.12 | 3.23 | [2.94, 3.21] | 3.15 | [3.00, 3.30] | 1.17 | 1.95 | 14.0 | 7.40 | 71.4 | 1.17 | 1.98 | 15.60 |  |
| OLL 19 | 21 LOW-N | 40 | 1.85 | 2.10 | 2.01 | 3.15 | 3.17 | [2.97, 3.28] | 3.23 | [3.07, 3.39] | 1.14 | 1.86 | 14.0 | 7.15 | 76.2 | 1.12 | 2.04 | 14.30 |  |
| OLL 11 | 17 LOW-N | 36 | 1.85 | 1.70 | 1.80 | 3.27 | 3.33 | [2.81, 3.68] | 3.16 | [2.81, 3.34] | 1.26 | 1.77 | 12.0 | 6.80 | 82.4 | 1.26 | 1.75 | 14.26 |  |
| OLL 17 | 22 LOW-N | 50 | 1.85 | 2.20 | 2.51 | 3.00 | 3.13 | [2.79, 3.31] | 3.04 | [2.88, 3.22] | 0.91 | 2.05 | 14.0 | 7.13 | 36.4 | 0.95 | 2.03 | 14.12 |  |
| OLL 52 | 14 LOW-N | 35 | 1.85 | 1.40 | 1.75 | 2.88 | 3.45 | [2.68, 3.20] | 2.94 | [2.79, 3.15] | 1.15 | 1.59 | 12.0 | 7.31 | 78.6 | 1.17 | 1.75 | 13.53 |  |
| OLL 41 | 15 LOW-N | 33 | 1.85 | 1.50 | 1.65 | 2.88 | 3.36 | [2.67, 3.54] | 3.04 | [2.76, 3.48] | 1.22 | 1.74 | 14.0 | 7.85 | 73.3 | 1.26 | 1.66 | 13.17 |  |
| OLL 20 | 5 LOW-N | 8 LOW-N | 0.46 | 0.50 | 0.40 | 3.93 | 5.08 | [2.67, 10.53] | 4.05 | [2.67, 5.58] | 1.08 | 3.03 | 15.0 | 5.02 | 60.0 | 1.03 | 3.25 | 12.92 |  |
| OLL 18 | 16 LOW-N | 31 | 1.85 | 1.60 | 1.55 | 3.01 | 3.15 | [2.79, 3.40] | 3.27 | [2.98, 3.51] | 0.73 | 2.30 | 14.0 | 6.11 | 25.0 | 0.72 | 2.36 | 10.51 |  |
| OLL 49 | 21 LOW-N | 43 | 1.85 | 2.10 | 2.16 | 2.64 | 2.90 | [2.46, 3.09] | 2.88 | [2.52, 3.03] | 0.90 | 1.65 | 10.0 | 6.17 | 42.9 | 1.05 | 1.71 | 10.21 |  |
| OLL 9 | 7 LOW-N | 26 LOW-N | 1.85 | 0.70 | 1.30 | 3.45 | 3.86 | [2.70, 5.40] | 3.02 | [2.79, 3.41] | 0.87 | 2.22 | 12.0 | 5.15 | 42.9 | 1.14 | 1.81 | 9.64 |  |
| OLL 8 | 22 LOW-N | 41 | 1.85 | 2.20 | 2.06 | 2.35 | 2.64 | [1.98, 2.55] | 2.41 | [2.19, 2.85] | 0.84 | 1.19 | 8.0 | 6.78 | 45.5 | 0.94 | 1.45 | 9.18 |  |
| OLL 30 | 17 LOW-N | 39 | 1.85 | 1.70 | 1.95 | 2.61 | 2.87 | [2.23, 2.90] | 2.61 | [2.39, 2.82] | 0.78 | 1.77 | 12.0 | 7.26 | 11.8 | 0.78 | 1.80 | 9.08 |  |
| OLL 15 | 25 LOW-N | 41 | 1.85 | 2.51 | 2.06 | 2.33 | 2.67 | [2.19, 2.76] | 2.33 | [2.22, 2.66] | 0.69 | 1.62 | 10.0 | 6.17 | 16.0 | 0.72 | 1.57 | 8.86 |  |
| OLL 16 | 21 LOW-N | 39 | 1.85 | 2.10 | 1.95 | 2.88 | 2.86 | [2.70, 3.03] | 2.87 | [2.73, 3.03] | 1.38 | 1.41 | 12.0 | 8.17 | 95.2 | 1.38 | 1.41 | 8.49 |  |
| OLL 10 | 17 LOW-N | 34 | 1.85 | 1.70 | 1.70 | 2.70 | 2.93 | [2.49, 3.03] | 2.84 | [2.67, 3.25] | 0.96 | 1.74 | 12.0 | 7.10 | 47.1 | 1.14 | 1.81 | 8.39 |  |
| OLL 50 | 28 LOW-N | 47 | 1.85 | 2.81 | 2.36 | 2.61 | 2.70 | [2.53, 2.75] | 2.60 | [2.46, 2.73] | 1.08 | 1.59 | 11.0 | 6.53 | 60.7 | 1.08 | 1.56 | 8.30 |  |
| OLL 2 | 19 LOW-N | 45 | 1.85 | 1.90 | 2.26 | 2.61 | 2.88 | [2.49, 2.70] | 2.70 | [2.58, 2.88] | 0.74 | 1.89 | 13.0 | 6.88 | 31.6 | 0.78 | 1.89 | 8.04 |  |
| OLL 38 | 14 LOW-N | 30 | 1.85 | 1.40 | 1.50 | 2.66 | 2.95 | [2.40, 3.00] | 2.65 | [2.45, 2.92] | 0.93 | 1.68 | 13.0 | 7.71 | 42.9 | 1.06 | 1.67 | 7.28 |  |
| OLL 27 | 17 LOW-N | 28 LOW-N | 1.85 | 1.70 | 1.40 | 1.89 | 2.22 | [1.62, 1.95] | 1.89 | [1.65, 1.98] | 0.72 | 0.96 | 8.0 | 8.89 | 5.9 | 0.72 | 1.04 | 6.52 |  |
| OLL 55 | 8 LOW-N | 22 LOW-N | 0.93 | 0.80 | 1.10 | 3.09 | 3.25 | [2.85, 3.36] | 3.18 | [2.92, 3.21] | 1.05 | 2.10 | 17.0 | 7.91 | 62.5 | 1.05 | 2.07 | 6.12 |  |
| OLL 34 | 16 LOW-N | 35 | 1.85 | 1.60 | 1.75 | 2.75 | 2.87 | [2.63, 2.97] | 2.67 | [2.55, 2.77] | 0.88 | 1.84 | 12.0 | 6.51 | 18.8 | 0.84 | 1.83 | 6.07 |  |
| OLL 13 | 15 LOW-N | 33 | 1.85 | 1.50 | 1.65 | 2.63 | 2.74 | [2.22, 2.87] | 2.61 | [2.49, 2.79] | 1.16 | 1.47 | 11.0 | 7.80 | 66.7 | 1.17 | 1.45 | 5.84 |  |
| OLL 56 | 7 LOW-N | 20 LOW-N | 0.93 | 0.70 | 1.00 | 3.27 | 3.32 | [3.07, 3.54] | 3.07 | [2.85, 3.25] | 1.45 | 1.72 | 15.0 | 8.72 | 85.7 | 1.35 | 1.64 | 5.80 |  |
| OLL 32 | 19 LOW-N | 34 | 1.85 | 1.90 | 1.70 | 2.13 | 2.47 | [2.01, 2.39] | 2.21 | [2.07, 2.40] | 0.81 | 1.35 | 11.0 | 7.97 | 36.8 | 0.87 | 1.35 | 5.46 |  |
| OLL 1 | 9 LOW-N | 14 LOW-N | 0.93 | 0.90 | 0.70 | 2.70 | 3.04 | [2.55, 3.18] | 3.32 | [2.64, 4.60] | 0.69 | 1.95 | 12.0 | 5.82 | 22.2 | 0.73 | 2.38 | 4.99 |  |
| OLL 35 | 29 LOW-N | 48 | 1.85 | 2.91 | 2.41 | 2.43 | 2.46 | [2.19, 2.58] | 2.57 | [2.40, 2.69] | 0.84 | 1.56 | 10.0 | 6.82 | 20.7 | 0.81 | 1.59 | 4.40 |  |
| OLL 36 | 15 LOW-N | 31 | 1.85 | 1.50 | 1.55 | 2.70 | 2.70 | [2.58, 2.88] | 2.70 | [2.66, 2.88] | 0.69 | 1.92 | 13.0 | 6.77 | 6.7 | 0.71 | 1.94 | 3.69 |  |
| OLL 22 | 14 LOW-N | 34 | 1.85 | 1.40 | 1.70 | 2.62 | 2.65 | [2.40, 2.80] | 2.59 | [2.36, 2.78] | 0.94 | 1.69 | 10.0 | 6.05 | 28.6 | 0.91 | 1.64 | 3.64 |  |
| OLL 53 | 22 LOW-N | 42 | 1.85 | 2.20 | 2.11 | 2.57 | 2.54 | [2.34, 2.73] | 2.50 | [2.34, 2.64] | 0.84 | 1.52 | 12.0 | 7.82 | 45.5 | 0.86 | 1.50 | 3.46 |  |
| OLL 39 | 19 LOW-N | 34 | 1.85 | 1.90 | 1.70 | 2.37 | 2.46 | [2.16, 2.64] | 2.40 | [2.20, 2.58] | 0.72 | 1.68 | 10.0 | 6.18 | 5.3 | 0.71 | 1.68 | 2.78 |  |
| OLL 48 | 24 LOW-N | 44 | 1.85 | 2.40 | 2.21 | 2.18 | 2.29 | [2.10, 2.28] | 2.22 | [2.16, 2.34] | 0.81 | 1.18 | 11.0 | 9.13 | 37.5 | 0.94 | 1.25 | 2.27 |  |
| OLL 31 | 17 LOW-N | 32 | 1.85 | 1.70 | 1.60 | 2.28 | 2.40 | [2.13, 2.61] | 2.50 | [2.28, 2.73] | 0.84 | 1.42 | 10.0 | 6.94 | 47.1 | 0.97 | 1.44 | 2.05 |  |
| OLL 5 | 17 LOW-N | 41 | 1.85 | 1.70 | 2.06 | 2.22 | 2.32 | [2.07, 2.64] | 2.40 | [2.22, 2.43] | 0.90 | 1.29 | 8.0 | 6.66 | 35.3 | 0.99 | 1.29 | 1.63 |  |
| OLL 54 | 15 LOW-N | 36 | 1.85 | 1.50 | 1.80 | 2.37 | 2.40 | [2.16, 2.55] | 2.41 | [2.31, 2.52] | 0.75 | 1.56 | 12.0 | 7.60 | 13.3 | 0.80 | 1.58 | 1.53 |  |
| OLL 23 | 21 LOW-N | 36 | 1.85 | 2.10 | 1.80 | 2.23 | 2.28 | [2.10, 2.39] | 2.26 | [2.10, 2.37] | 0.63 | 1.59 | 10.0 | 6.13 | 0.0 | 0.67 | 1.51 | 1.21 |  |
| OLL 26 | 20 LOW-N | 43 | 1.85 | 2.00 | 2.16 | 1.94 | 2.08 | [1.86, 2.19] | 1.92 | [1.85, 2.10] | 0.94 | 1.02 | 8.0 | 8.23 | 45.0 | 0.84 | 0.99 | 1.19 |  |
| OLL 25 | 20 LOW-N | 44 | 1.85 | 2.00 | 2.21 | 1.94 | 2.07 | [1.80, 2.21] | 2.10 | [1.89, 2.29] | 0.70 | 1.17 | 9.0 | 7.49 | 15.0 | 0.74 | 1.29 | 0.95 |  |
| OLL 14 | 17 LOW-N | 39 | 1.85 | 1.70 | 1.95 | 2.40 | 2.44 | [2.34, 2.64] | 2.46 | [2.37, 2.61] | 0.72 | 1.45 | 11.0 | 6.94 | 29.4 | 0.72 | 1.63 | 0.89 |  |
| OLL 57 | 5 LOW-N | 14 LOW-N | 0.93 | 0.50 | 0.70 | 1.95 | 2.17 | [1.71, 3.10] | 1.95 | [1.84, 2.17] | 0.81 | 1.30 | 10.0 | 8.47 | 20.0 | 0.62 | 1.39 | 0.60 |  |
| OLL 51 | 24 LOW-N | 43 | 1.85 | 2.40 | 2.16 | 2.09 | 2.12 | [1.99, 2.16] | 2.10 | [2.04, 2.16] | 0.78 | 1.31 | 11.0 | 8.33 | 16.7 | 0.78 | 1.32 | 0.58 |  |
| OLL 40 | 14 LOW-N | 30 | 1.85 | 1.40 | 1.50 | 1.89 | 2.03 | [1.80, 2.25] | 2.02 | [1.86, 2.20] | 0.69 | 1.20 | 10.0 | 8.34 | 7.1 | 0.76 | 1.20 | 0.48 |  |
| OLL 21 | 14 LOW-N | 21 LOW-N | 0.93 | 1.40 | 1.05 | 2.04 | 2.14 | [1.88, 2.34] | 2.16 | [2.04, 2.20] | 0.81 | 1.30 | 11.5 | 9.01 | 14.3 | 0.83 | 1.32 | 0.45 |  |
| OLL 7 | 14 LOW-N | 29 LOW-N | 1.85 | 1.40 | 1.45 | 1.82 | 1.89 | [1.65, 2.03] | 1.82 | [1.71, 1.94] | 0.68 | 1.13 | 8.0 | 6.93 | 7.1 | 0.69 | 1.11 | 0.18 |  |
| OLL 44 | 16 LOW-N | 32 | 1.85 | 1.60 | 1.60 | 1.62 | 1.75 | [1.45, 1.96] | 1.79 | [1.62, 1.94] | 0.91 | 0.87 | 7.0 | 8.41 | 50.0 | 1.00 | 0.87 | 0.15 |  |
| OLL 28 | 19 LOW-N | 39 | 1.85 | 1.90 | 1.95 | 2.10 | 2.08 | [1.98, 2.19] | 2.07 | [2.02, 2.16] | 0.57 | 1.38 | 10.0 | 7.40 | 5.3 | 0.57 | 1.44 | 0.05 |  |
| OLL 43 | 19 LOW-N | 34 | 1.85 | 1.90 | 1.70 | 1.98 | 1.98 | [1.80, 2.07] | 1.98 | [1.86, 2.09] | 0.93 | 1.05 | 7.0 | 7.21 | 36.8 | 0.90 | 1.05 | 0.02 |  |
| OLL 6 | 23 LOW-N | 44 | 1.85 | 2.30 | 2.21 | 1.83 | 1.88 | [1.65, 2.04] | 1.98 | [1.83, 2.04] | 0.75 | 1.11 | 8.0 | 7.44 | 8.7 | 0.78 | 1.16 | 0.00 |  |
| OLL 24 | 17 LOW-N | 26 LOW-N | 1.85 | 1.70 | 1.30 | 1.74 | 1.80 | [1.59, 1.95] | 1.72 | [1.62, 1.95] | 0.68 | 1.05 | 9.0 | 8.57 | 17.6 | 0.68 | 1.08 | 0.00 |  |
| OLL 33 | 16 LOW-N | 31 | 1.85 | 1.60 | 1.55 | 1.30 | 1.47 | [1.28, 1.50] | 1.38 | [1.29, 1.48] | 0.61 | 0.75 | 9.0 | 11.98 | 6.2 | 0.58 | 0.78 | 0.00 |  |
| OLL 37 | 9 LOW-N | 22 LOW-N | 1.85 | 0.90 | 1.10 | 1.83 | 1.82 | [1.59, 2.13] | 1.75 | [1.62, 2.02] | 0.87 | 0.91 | 10.0 | 10.10 | 22.2 | 0.73 | 0.95 | 0.00 |  |
| OLL 45 | 16 LOW-N | 30 | 1.85 | 1.60 | 1.50 | 1.60 | 1.62 | [1.48, 1.71] | 1.66 | [1.58, 1.72] | 0.57 | 0.98 | 7.0 | 7.27 | 6.2 | 0.67 | 0.95 | 0.00 |  |
| OLL 46 | 23 LOW-N | 40 | 1.85 | 2.30 | 2.01 | 1.80 | 1.84 | [1.69, 1.92] | 1.80 | [1.71, 1.89] | 0.64 | 1.17 | 9.0 | 7.67 | 0.0 | 0.63 | 1.16 | 0.00 |  |
| skip | 2 LOW-N | 4 LOW-N | 0.46 | 0.20 | 0.20 | 0.00 | 0.00 | - | 0.00 | [0.00, 0.00] | 0.00 | 0.00 | 0.0 | - | 0.0 | 0.00 | 0.00 | 0.00 |  |

### 4b. OLL behaviour and algs (A)
Columns: case; n; pre-AUF = leading U/d turns before the alg, counts of executions with 0/1/2/3+ such tokens; post-AUF = trailing U tokens, same buckets; fumble = % with an adjacent same-face inverse pair (no rotation between); pause>400 = % with a gap >400 ms between consecutive alg moves (AUF excluded); modal len = tokens of the top alg; long = % with alg length > modal+4; pause500@4+ = % with a gap >500 ms after >=4 alg moves; distinct = number of distinct normalised algs; top1 = share of top alg; class (OLL) = MULTI-STEP if long>=30 or pause500@4+>=30, else CONSISTENT if top1>=60, else MIXED; long and pause use the raw alg moves; top algs use the normalised key: rotation tokens, leading U/d and trailing U stripped, adjacent same-face turns merged or cancelled, commuting opposite-face pairs sorted, X2 and X2' unified, and the four y-relabelled grips (R/F/L/B) merged into the first-sorting one (raw-grip counts in ll.json).

| case | n | pre-AUF 0/1/2/3+ | post-AUF 0/1/2/3+ | fumble% | pause>400% | modal len | long% | pause500@4+% | distinct | top1% | class | top 3 algs (count) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OLL 12 | 20 LOW-N | 6/7/5/2 | 20/0/0/0 | 35.0 | 75.0 | 10 | 15.0 | 25.0 | 15 | 30.0 | MIXED LOW-N | L R2 F' R F' R' F2 R F' M (6); B L R2 U' R U' R' U2 R U' M (1); B2 F R' B R' B' R2 B R' B F' (1) |
| OLL 42 | 21 LOW-N | 3/10/8/0 | 21/0/0/0 | 14.3 | 33.3 | 13 | 4.8 | 9.5 | 6 | 66.7 | CONSISTENT LOW-N | R' U' R U' R' U2 R F R U R' U' F' (14); B' U' B U' B' U2 B F R U R' U' F' (3); F' U' F U' F' U2 F2 R U R' U' F' (1) |
| OLL 29 | 22 LOW-N | 9/10/2/1 | 22/0/0/0 | 22.7 | 22.7 | 13 | 9.1 | 13.6 | 5 | 81.8 | CONSISTENT LOW-N | R U R' U' R U' R' F' U' F R U R' (18); F' R U R' U' R U' R' F' U' F R U R' (1); B U B' d' R U R' U' f' S U' F R U R' U2 R U' R' U' L' B' L F' R' F R F' R' F L' R U r (1) |
| OLL 47 | 19 LOW-N | 7/4/4/4 | 19/0/0/0 | 31.6 | 47.4 | 12 | 5.3 | 5.3 | 9 | 57.9 | MIXED LOW-N | F R' F' R U2 R U' R' U R U2 R' (11); F2 R' F' R U2 R U' R' U R U2 R' (1); D' U' F R' F' R U2 R U' R' U R U2 R' (1) |
| OLL 3 | 22 LOW-N | 8/12/2/0 | 22/0/0/0 | 13.6 | 36.4 | 13 | 4.5 | 13.6 | 9 | 45.5 | MIXED LOW-N | f R U R' U' f' U' F R U R' U' F' (10); B U2 R' U' f' U' F R U R' U' F' (5); F' U f' U' f R U R' U' f' U' F R U R' U' F' (1) |
| OLL 4 | 21 LOW-N | 6/9/6/0 | 20/1/0/0 | 23.8 | 23.8 | 13 | 0.0 | 4.8 | 11 | 38.1 | MIXED LOW-N | f R U R' U' f' U F R U R' U' F' (8); B U2 R' U' f' U F R U R' U' F' (3); B U2 R' U' B' R b R U R' U' F' (2) |
| OLL 19 | 21 LOW-N | 6/14/1/0 | 20/1/0/0 | 14.3 | 57.1 | 13 | 0.0 | 19.0 | 16 | 14.3 | MIXED LOW-N | M U R U R' U' L R' M' L' F R F' (3); M U R U R' U' L R2 D R F' (3); M U R U R' U' M' R' F R F' (2) |
| OLL 11 | 17 LOW-N | 2/7/8/0 | 17/0/0/0 | 29.4 | 52.9 | 11 | 0.0 | 11.8 | 8 | 35.3 | MIXED LOW-N | L' R2 B R' B R B2 R' B L R' (6); M R U R' U R U2 R' U L R' (3); L' R2 B R' B R B2 R' B M' (2) |
| OLL 17 | 22 LOW-N | 11/9/1/1 | 21/1/0/0 | 22.7 | 40.9 | 13 | 0.0 | 18.2 | 4 | 81.8 | CONSISTENT LOW-N | R U R' U R' F R F' U2 R' F R F' (18); F2 R U R' U R' F R F' U2 R' F R F' (2); B' R B R' B R' U R U' B2 R' U R (1) |
| OLL 52 | 14 LOW-N | 2/5/7/0 | 14/0/0/0 | 7.1 | 35.7 | 10 | 7.1 | 21.4 | 4 | 78.6 | CONSISTENT LOW-N | R' F' U' F U' R U R' U R (11); F' l' F' U' F U' R U R' U R (1); L' d' F' U' F U' R U R' U R2 U2 R' F' U2 L U2 L' U L U2 R U2 R2 F R F' R U2 R' (1) |
| OLL 41 | 15 LOW-N | 5/10/0/0 | 15/0/0/0 | 20.0 | 46.7 | 13 | 20.0 | 26.7 | 3 | 80.0 | CONSISTENT LOW-N | R U R' U R U2 R' F R U R' U' F' (12); F' U' F U' F' U2 F U2 F U F' U F' L F L' F U2 F' (2); F' R U R' U R U2 R' F R U R' U' F' (1) |
| OLL 20 | 5 LOW-N | 5/0/0/0 | 5/0/0/0 | 40.0 | 60.0 | 13 | 40.0 | 60.0 | 5 | 20.0 | MULTI-STEP LOW-N | M U R U R' U' M' L R' F R F' L' (1); M U R U R' U' L2 R2 D R F' L' (1); L' R U R U R' U' L R' F R F' R' F U' M U R U R' U' L R' F R F' L' M' r F R' F' L' R U R U' R' (1) |
| OLL 18 | 16 LOW-N | 7/8/1/0 | 16/0/0/0 | 18.8 | 68.8 | 13 | 0.0 | 18.8 | 2 | 93.8 | CONSISTENT LOW-N | R U2 R2 F R F' U2 L R' F R F' L' (15); F U2 F2 L F L' U2 S U F U' f' (1) |
| OLL 49 | 21 LOW-N | 8/12/0/1 | 21/0/0/0 | 14.3 | 42.9 | 9 | 0.0 | 19.0 | 10 | 57.1 | MIXED LOW-N | L F' L2 B L2 F L2 B' L (12); F r F' L2 B L2 F L2 B' L (1); r U' L' r' B L2 F L' r' B' L (1) |
| OLL 9 | 7 LOW-N | 2/5/0/0 | 7/0/0/0 | 28.6 | 57.1 | 11 | 28.6 | 42.9 | 3 | 71.4 | MULTI-STEP LOW-N | R U R' U' R' F R2 U R' U' F' (5); F2 R F R' F l' F R F' R U2 R' U R' F' U' F U' R U R' U R (1); R U R' U R' F R F' R U2 R' U R' F' U' F U' R U R' U R (1) |
| OLL 8 | 22 LOW-N | 3/15/4/0 | 22/0/0/0 | 22.7 | 27.3 | 7 | 9.1 | 18.2 | 8 | 40.9 | MIXED LOW-N | r' U' R U' R' U2 r (9); r' U' R U' R' U2 L (6); F' L' B L' B' L2 F (2) |
| OLL 30 | 17 LOW-N | 9/7/1/0 | 17/0/0/0 | 23.5 | 35.3 | 11 | 11.8 | 29.4 | 3 | 82.4 | CONSISTENT LOW-N | F U R U2 R' U' R U2 R' U' F' (14); R U2 R' U' R U2 R' U' F' (2); F L U L2 U' L' U L2 U' L' F' (1) |
| OLL 15 | 25 LOW-N | 8/17/0/0 | 25/0/0/0 | 8.0 | 44.0 | 9 | 8.0 | 28.0 | 16 | 16.0 | MIXED LOW-N | r' U' M' U' R U L' B L (4); L' B' M' U' R U L' B L (4); r' U' L R' F' R U L' B L (3) |
| OLL 16 | 21 LOW-N | 5/2/11/3 | 21/0/0/0 | 19.0 | 19.0 | 10 | 0.0 | 0.0 | 11 | 42.9 | MIXED LOW-N | L F L' R U R' U' L F' L' (9); L F M U R' U' L F' L' (3); r F L' R U R' U' L F' L' (1) |
| OLL 10 | 17 LOW-N | 4/9/4/0 | 17/0/0/0 | 5.9 | 23.5 | 11 | 5.9 | 11.8 | 6 | 70.6 | CONSISTENT LOW-N | R U R' U R' F R F' R U2 R' (12); B U B2 R U R' F R F' R U2 R' (1); F2 R F R' F R' D R D' R F2 R' (1) |
| OLL 50 | 28 LOW-N | 6/18/3/1 | 27/1/0/0 | 17.9 | 32.1 | 9 | 0.0 | 21.4 | 17 | 25.0 | MIXED LOW-N | L' B L2 F' L2 B' L2 F L' (7); L' B L2 F' L2 B' L r F L' (3); r' U L2 D' L2 U' r L F L' (2) |
| OLL 2 | 19 LOW-N | 6/12/1/0 | 19/0/0/0 | 5.3 | 31.6 | 11 | 5.3 | 10.5 | 8 | 31.6 | MIXED LOW-N | F R U R' U' B F' U2 R' U' f' (6); F R U R' U' B F' U L U' L' B' (5); F R U R' U' B F' U L R' U' f' (2) |
| OLL 38 | 14 LOW-N | 6/8/0/0 | 14/0/0/0 | 14.3 | 28.6 | 12 | 7.1 | 14.3 | 2 | 92.9 | CONSISTENT LOW-N | R U R' U R U' R' U' R' F R F' (13); F2 R U R' U R U' R' U' R' f B' b R F' (1) |
| OLL 27 | 17 LOW-N | 8/9/0/0 | 16/1/0/0 | 17.6 | 41.2 | 7 | 11.8 | 17.6 | 3 | 88.2 | CONSISTENT LOW-N | R U R' U R U2 R' (15); L F' L' U B' r' U L U L F l' U' L' U R U' R' U R U' R' f' U' R U2 R' U' R U' R' f R (1); F' U2 R U R' U R U2 R' (1) |
| OLL 55 | 8 LOW-N | 3/2/3/0 | 8/0/0/0 | 50.0 | 62.5 | 15 | 0.0 | 12.5 | 5 | 50.0 | MIXED LOW-N | R' F R U R U' R2 F' R2 U' R' U R U R' (4); F l' F R U R U' R2 F' R2 U' R' U R U R' (1); R' F R U R U' R' l' F' R2 U' R' F R F l' (1) |
| OLL 34 | 16 LOW-N | 2/10/4/0 | 16/0/0/0 | 31.2 | 50.0 | 11 | 12.5 | 18.8 | 4 | 81.2 | CONSISTENT LOW-N | R U R2 U' R' F R U R U' F' (13); B' d' U R U' R U R2 U' R' F R U R U' F' (1); F U F2 U' R' F R U R U' F' (1) |
| OLL 13 | 15 LOW-N | 5/8/1/1 | 15/0/0/0 | 13.3 | 46.7 | 10 | 6.7 | 46.7 | 5 | 53.3 | MULTI-STEP LOW-N | F U R U2 R' U' R U R' F' (8); L F' L' U' L F L' R' U R (3); L F' L' U' L F L' F' U F (2) |
| OLL 56 | 7 LOW-N | 2/4/1/0 | 7/0/0/0 | 28.6 | 28.6 | 14 | 14.3 | 14.3 | 6 | 28.6 | MIXED LOW-N | L' B' L F' R' F R F' R' F L' R U L (2); B' R' B U' F' U F U' F' U B' F R B (1); r' U' L F' R' F R F' R' F M F L (1) |
| OLL 32 | 19 LOW-N | 6/13/0/0 | 19/0/0/0 | 10.5 | 68.4 | 10 | 10.5 | 15.8 | 12 | 21.1 | MIXED LOW-N | B F' U L U' L' U' F R f' (4); S R U R' U' R' F R f' (3); L R' U F U' F' U' F R f' (2) |
| OLL 1 | 9 LOW-N | 5/4/0/0 | 9/0/0/0 | 11.1 | 55.6 | 11 | 11.1 | 22.2 | 4 | 66.7 | CONSISTENT LOW-N | R U2 R2 F R F' U2 R' F R F' (6); B U2 B2 R B F' U2 R' F R F' (1); F R U R' U' B F' U2 R' U' B' L R2 F R' F' L' F R F' (1) |
| OLL 35 | 29 LOW-N | 7/15/6/1 | 29/0/0/0 | 34.5 | 31.0 | 9 | 3.4 | 3.4 | 7 | 72.4 | CONSISTENT LOW-N | R U2 R2 F R F' R U2 R' (21); B U2 B2 R2 F' R U2 R' (3); F U2 F' R F' R U2 R' (1) |
| OLL 36 | 15 LOW-N | 1/13/1/0 | 1/14/0/0 | 0.0 | 13.3 | 11 | 0.0 | 0.0 | 4 | 53.3 | MIXED LOW-N | R' U' R U' R' U R U l U' R' (8); R' U' R U' R' U R U R B' R' (5); F l' U' R U' R' U R U l U' R' (1) |
| OLL 22 | 14 LOW-N | 2/10/2/0 | 13/1/0/0 | 21.4 | 28.6 | 9 | 0.0 | 21.4 | 1 | 100.0 | CONSISTENT LOW-N | R U2 R2 U' R2 U' R2 U2 R (14) |
| OLL 53 | 22 LOW-N | 8/11/2/1 | 22/0/0/0 | 9.1 | 18.2 | 11 | 0.0 | 0.0 | 11 | 36.4 | MIXED LOW-N | r' U' R U' R' U R U' R' U2 L (8); L' B' l U' R' U R U' R' U2 L (3); r' U' R U' R' U R U' R' U2 r (2) |
| OLL 39 | 19 LOW-N | 8/11/0/0 | 19/0/0/0 | 10.5 | 63.2 | 9 | 0.0 | 15.8 | 9 | 52.6 | MIXED LOW-N | L F' L' U' L U F U' L' (10); F R' F' U' F U F U' L' (2); r F' L' U' L U F U' L' (1) |
| OLL 48 | 24 LOW-N | 9/13/2/0 | 24/0/0/0 | 16.7 | 16.7 | 10 | 0.0 | 0.0 | 6 | 79.2 | CONSISTENT LOW-N | F R U R' U' R U R' U' F' (19); F' R U R' U' R U R' U' F' (1); B U B' U' B U B' U' R' (1) |
| OLL 31 | 17 LOW-N | 7/8/2/0 | 17/0/0/0 | 11.8 | 29.4 | 9 | 5.9 | 11.8 | 7 | 64.7 | CONSISTENT LOW-N | R' U' F U R U' R' F' R (11); R' U' F' U F R U' L F R' F' r' F R F' (1); B R' B' U B R B' R' U' R (1) |
| OLL 5 | 17 LOW-N | 4/8/4/1 | 17/0/0/0 | 23.5 | 29.4 | 7 | 0.0 | 5.9 | 9 | 47.1 | MIXED LOW-N | r' U2 R U R' U L (8); r' U2 R U R' U r (2); L' U2 R U R' U L (1) |
| OLL 54 | 15 LOW-N | 3/11/1/0 | 13/2/0/0 | 0.0 | 6.7 | 11 | 0.0 | 0.0 | 6 | 40.0 | MIXED LOW-N | L F R' F R U' R' U R U2 r' (6); L F l' U R U' R' U R U2 r' (5); L F R' F R U' R' U R (1) |
| OLL 23 | 21 LOW-N | 10/9/2/0 | 21/0/0/0 | 23.8 | 33.3 | 9 | 0.0 | 4.8 | 8 | 66.7 | CONSISTENT LOW-N | R2 D R' U2 R D' R' U2 R' (14); F' R2 D R' U2 R D' R' U2 R' (1); R l B R' F2 R B' R' F2 l' (1) |
| OLL 26 | 20 LOW-N | 6/9/5/0 | 20/0/0/0 | 20.0 | 10.0 | 7 | 0.0 | 5.0 | 3 | 90.0 | CONSISTENT LOW-N | R U2 R' U' R U' R' (18); F R U2 R' U' R U' R' (1); F' U2 R U2 R' U' R U' R' (1) |
| OLL 25 | 20 LOW-N | 10/10/0/0 | 20/0/0/0 | 10.0 | 30.0 | 8 | 0.0 | 5.0 | 7 | 30.0 | MIXED LOW-N | F R' F' L F R U' r' (6); F R' F' L F R F' L' (5); F R' F' r U R U' r' (3) |
| OLL 14 | 17 LOW-N | 10/6/1/0 | 17/0/0/0 | 5.9 | 35.3 | 10 | 0.0 | 5.9 | 6 | 70.6 | CONSISTENT LOW-N | R' F R U R' F' R F U' F' (12); F2 R' D R U R' F' R F U' F' (1); R' F R U R' F' R F U' f' S (1) |
| OLL 57 | 5 LOW-N | 3/2/0/0 | 5/0/0/0 | 20.0 | 20.0 | 10 | 0.0 | 0.0 | 1 | 100.0 | CONSISTENT LOW-N | R U R' U' L R' F R F' L' (5) |
| OLL 51 | 24 LOW-N | 8/16/0/0 | 24/0/0/0 | 4.2 | 25.0 | 9 | 0.0 | 4.2 | 6 | 41.7 | MIXED LOW-N | B U2 R' U' R U R' U' f' (10); f R U R' U' R U R' U' f' (9); B F2 U2 R' U' R U R' U' f' (2) |
| OLL 40 | 14 LOW-N | 5/9/0/0 | 14/0/0/0 | 7.1 | 21.4 | 9 | 0.0 | 21.4 | 6 | 64.3 | CONSISTENT LOW-N | R' F R U R' U' F' U R (9); F' L R U R' U' F' U R (1); F' R' D R U R' U' F' U R (1) |
| OLL 21 | 14 LOW-N | 10/4/0/0 | 14/0/0/0 | 28.6 | 14.3 | 11 | 0.0 | 0.0 | 2 | 92.9 | CONSISTENT LOW-N | R U R' U R U' R' U R U2 R' (13); R B R' B R B' R' B R B2 R' (1) |
| OLL 7 | 14 LOW-N | 4/9/1/0 | 13/1/0/0 | 14.3 | 21.4 | 7 | 0.0 | 0.0 | 5 | 50.0 | MIXED LOW-N | L F l' U R U2 r' (7); L F R' F R U2 r' (4); L F R' F R (1) |
| OLL 44 | 16 LOW-N | 7/8/0/1 | 15/1/0/0 | 12.5 | 31.2 | 5 | 0.0 | 0.0 | 9 | 31.2 | MIXED LOW-N | B U2 R' U' f' (5); f R U R' U' f' (3); R U B U' B' R' (2) |
| OLL 28 | 19 LOW-N | 6/11/1/1 | 19/0/0/0 | 15.8 | 57.9 | 9 | 0.0 | 26.3 | 8 | 31.6 | MIXED LOW-N | L F l' U' M U R U' R' (6); L F R' F' M U R U' R' (5); L F R' F' M F R F' R' (2) |
| OLL 43 | 19 LOW-N | 2/11/5/1 | 19/0/0/0 | 15.8 | 10.5 | 6 | 0.0 | 0.0 | 5 | 78.9 | CONSISTENT LOW-N | R' U' F' U F R (15); R' B' R' F' U F R (1); F U' F2 U F R (1) |
| OLL 6 | 23 LOW-N | 11/12/0/0 | 22/1/0/0 | 4.3 | 4.3 | 7 | 0.0 | 0.0 | 9 | 26.1 | MIXED LOW-N | L F2 l' U' R U' r' (6); L F2 R' F' R U' r' (6); L F U R' U' R U' r' (4) |
| OLL 24 | 17 LOW-N | 5/11/1/0 | 10/7/0/0 | 11.8 | 5.9 | 8 | 0.0 | 0.0 | 7 | 41.2 | MIXED LOW-N | L F R' F' L' F R F' (7); L F l' U' L' U R (5); L F l' U' L' U l F' (1) |
| OLL 33 | 16 LOW-N | 6/10/0/0 | 16/0/0/0 | 6.2 | 6.2 | 8 | 0.0 | 0.0 | 4 | 81.2 | CONSISTENT LOW-N | R U R' U' R' F R F' (13); F2 R F R' F' R' D R F' (1); R U R' F' l' F R F' (1) |
| OLL 37 | 9 LOW-N | 2/6/1/0 | 9/0/0/0 | 0.0 | 0.0 | 9 | 0.0 | 0.0 | 2 | 88.9 | CONSISTENT LOW-N | F R U' R' U' R U R' F' (8); R2 U' R' U' R U R' F' (1) |
| OLL 45 | 16 LOW-N | 2/14/0/0 | 16/0/0/0 | 12.5 | 6.2 | 6 | 0.0 | 6.2 | 2 | 93.8 | CONSISTENT LOW-N | F R U R' U' F' (15); D R U R' U' F' (1) |
| OLL 46 | 23 LOW-N | 3/18/2/0 | 23/0/0/0 | 8.7 | 17.4 | 8 | 0.0 | 13.0 | 4 | 82.6 | CONSISTENT LOW-N | R' U' R' F R F' U R (19); B' d' R' F R F' U R (2); B' D' B' r u B' L D (1) |

OLL class summary (A): CONSISTENT LOW-N 27: OLL 1 OLL 10 OLL 14 OLL 17 OLL 18 OLL 21 OLL 22 OLL 23 OLL 26 OLL 27 OLL 29 OLL 30 OLL 31 OLL 33 OLL 34 OLL 35 OLL 37 OLL 38 OLL 40 OLL 41 OLL 42 OLL 43 OLL 45 OLL 46 OLL 48 OLL 52 OLL 57; MIXED LOW-N 27: OLL 2 OLL 3 OLL 4 OLL 5 OLL 6 OLL 7 OLL 8 OLL 11 OLL 12 OLL 15 OLL 16 OLL 19 OLL 24 OLL 25 OLL 28 OLL 32 OLL 36 OLL 39 OLL 44 OLL 47 OLL 49 OLL 50 OLL 51 OLL 53 OLL 54 OLL 55 OLL 56; MULTI-STEP LOW-N 3: OLL 9 OLL 13 OLL 20
Example OLL 9 (a6413f11, 25 tokens, max gap 958 ms): U2@962 R@1140 U@1319 R'@1440 U@1562 R'@1682 F@1800 R@1919 F'@2162 R@2399 U2@2730 R'@2822 U@3780 R'@4020 F'@4291 U'@4530 F@4592 U'@4862 R@5070 R'@5220 R@5251 U2@5520 U'@5729 R'@5939 U@6062 R@6223
Example OLL 13 (eef02b15, 24 tokens, max gap 539 ms): U'@574 U@844 d'@1146 R'@1585 F@1591 R@1822 U@1923 R@1956 U'@2058 R2@2261 F'@2361 R2@2564 U'@2700 R'@2902 U@2969 R@3071 U@3205 R'@3341 U'@3880 F@4084 R'@4218 F'@4555 L@4692 F@4792 x@4892 R@4926 U'@5061 r'@5230
Example OLL 20 (bde33797, 38 tokens, max gap 1650 ms): R@990 L'@990 U@1081 R@1200 U@1651 R'@1681 U'@1800 L@1981 R'@2071 F@2281 R@2370 F'@2522 R'@2761 F@3150 x@3749 U'@4591 M@5255 U@5552 R@6093 U@6212 R'@6216 U'@6331 L@6571 R'@6601 F@6722 R@6811 F'@6931 L'@7051 x@8250 M'@8701 r@9451 F@9511 R'@9631 F'@9751 L'@10111 R@10143 U@10231 R@10321 U'@10411 R'@10531

### 5. Recognition distributions (non-skip)
Columns: dataset, stage, n, mean, p10/p30/p50/p70/p90, % of executions with recognition >1.0, >1.5, >2.0 s, % exactly 0.

| set | stage | n | mean | p10 | p30 | p50 | p70 | p90 | >1.0% | >1.5% | >2.0% | =0% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | OLL | 996 | 0.97 | 0.57 | 0.72 | 0.84 | 1.11 | 1.47 | 37.3 | 9.0 | 2.7 | 0.1 |
| A | PLL | 983 | 0.97 | 0.61 | 0.75 | 0.90 | 1.11 | 1.41 | 38.5 | 7.6 | 1.3 | 0.2 |
| B | OLL | 1991 | 0.99 | 0.57 | 0.72 | 0.89 | 1.14 | 1.52 | 39.8 | 10.3 | 2.9 | 0.1 |
| B | PLL | 1961 | 1.00 | 0.61 | 0.78 | 0.93 | 1.14 | 1.49 | 41.9 | 9.4 | 1.6 | 0.1 |

### 5b. Recognition vs measured pause before first move
Columns: dataset, stage, number of leading U/d tokens in the stage (lead0, lead1, lead2+, all), n with moves, n with rec=0, % with |gap - rec| <= 50 ms, % with rec more than 50 ms longer than gap, median (gap - rec) ms, p10 (gap - rec) ms. gap = first non-rotation move timestamp - stage start. Shows how well acubemy recognition equals the visible pre-move pause.

| set | stage | lead | n | rec=0 | within50 % | rec>gap % | med gap-rec | p10 gap-rec |
|---|---|---|---|---|---|---|---|---|
| A | OLL | lead0 | 324 | 1 | 72.5 | 17.6 | 0.0 | -466.3 |
| A | OLL | lead1 | 535 | 0 | 72.1 | 15.7 | 0.0 | -508.6 |
| A | OLL | lead2+ | 137 | 0 | 8.8 | 90.5 | -480.0 | -1107.6 |
| A | OLL | all | 996 | 1 | 63.6 | 26.6 | 0.0 | -601.0 |
| A | PLL | lead0 | 373 | 2 | 72.7 | 13.1 | 0.0 | -330.0 |
| A | PLL | lead1 | 531 | 0 | 65.7 | 20.0 | 0.0 | -482.0 |
| A | PLL | lead2+ | 88 | 0 | 20.5 | 79.5 | -361.0 | -1030.5 |
| A | PLL | all | 992 | 2 | 64.3 | 22.7 | 0.0 | -504.6 |
| B | OLL | lead0 | 596 | 1 | 71.8 | 18.8 | 0.0 | -494.5 |
| B | OLL | lead1 | 1104 | 1 | 69.0 | 19.7 | 0.0 | -538.7 |
| B | OLL | lead2+ | 291 | 0 | 9.6 | 89.0 | -498.0 | -1167.0 |
| B | OLL | all | 1991 | 2 | 61.2 | 29.6 | 0.0 | -633.0 |
| B | PLL | lead0 | 718 | 2 | 73.1 | 12.0 | 0.0 | -330.0 |
| B | PLL | lead1 | 1072 | 0 | 64.9 | 22.6 | 0.0 | -510.0 |
| B | PLL | lead2+ | 197 | 0 | 16.8 | 83.2 | -388.0 | -1033.0 |
| B | PLL | all | 1987 | 2 | 63.1 | 24.8 | 0.0 | -539.0 |

### 5c. Correlations (bootstrap CI)
Columns: dataset, pair, n, Pearson r with CI, Spearman rho with CI. Non-skip stages only. Case medians are computed within the same dataset.

| set | pair | n | Pearson | Spearman |
|---|---|---|---|---|
| A | OLL exec vs PLL rec | 981 | 0.01 [-0.05, 0.06] | 0.01 [-0.06, 0.07] |
| A | OLL exec / case median vs PLL rec / case median | 981 | 0.01 [-0.05, 0.07] | 0.01 [-0.06, 0.07] |
| A | F2L4 time vs OLL rec | 996 | -0.04 [-0.13, 0.04] | -0.08 [-0.14, -0.02] |
| A | F2L4 exec vs OLL rec | 996 | -0.01 [-0.10, 0.06] | -0.04 [-0.11, 0.02] |
| A | F2L4 time vs OLL rec / case median | 996 | -0.06 [-0.13, -0.00] | -0.06 [-0.12, 0.01] |
| B | OLL exec vs PLL rec | 1957 | 0.01 [-0.03, 0.05] | 0.02 [-0.02, 0.07] |
| B | OLL exec / case median vs PLL rec / case median | 1957 | 0.02 [-0.02, 0.06] | 0.02 [-0.03, 0.06] |
| B | F2L4 time vs OLL rec | 1991 | 0.00 [-0.05, 0.05] | -0.01 [-0.06, 0.03] |
| B | F2L4 exec vs OLL rec | 1991 | -0.00 [-0.05, 0.05] | -0.01 [-0.05, 0.03] |
| B | F2L4 time vs OLL rec / case median | 1991 | -0.01 [-0.06, 0.03] | -0.02 [-0.06, 0.02] |

### 5d. Lookahead and transition quintiles
Columns: dataset, group, n, median OLL exec as ratio to its case median (lookahead rows), median outcome (PLL recognition for OLL-exec quintiles, OLL recognition for F2L4-time quintiles), mean outcome. Q5 = slowest.

| set | group | n | x | median s | mean s |
|---|---|---|---|---|---|
| A | OLL exec ratio Q1 | 197 | 0.80 | 0.84 | 0.94 |
| A | OLL exec ratio Q2 | 196 | 0.92 | 0.91 | 0.98 |
| A | OLL exec ratio Q3 | 196 | 1.00 | 0.96 | 1.01 |
| A | OLL exec ratio Q4 | 196 | 1.09 | 0.89 | 0.96 |
| A | OLL exec ratio Q5 | 196 | 1.37 | 0.88 | 0.98 |
| A | Q5-Q1 median PLL rec |  |  | 0.04 [-0.06, 0.09] |  |
| A | F2L4 time Q1 (0.00-1.59) | 200 |  | 0.94 | 1.04 |
| A | F2L4 time Q2 (1.59-1.95) | 199 |  | 0.81 | 0.94 |
| A | F2L4 time Q3 (1.95-2.28) | 199 |  | 0.87 | 0.95 |
| A | F2L4 time Q4 (2.28-2.73) | 199 |  | 0.82 | 0.96 |
| A | F2L4 time Q5 (2.74-17.91) | 199 |  | 0.81 | 0.94 |
| A | Q5-Q1 median OLL rec |  |  | -0.13 [-0.22, -0.04] |  |
| B | OLL exec ratio Q1 | 392 | 0.79 | 0.90 | 0.97 |
| B | OLL exec ratio Q2 | 391 | 0.92 | 0.96 | 1.01 |
| B | OLL exec ratio Q3 | 392 | 1.00 | 0.95 | 1.00 |
| B | OLL exec ratio Q4 | 391 | 1.10 | 0.94 | 1.00 |
| B | OLL exec ratio Q5 | 391 | 1.40 | 0.93 | 1.01 |
| B | Q5-Q1 median PLL rec |  |  | 0.03 [-0.05, 0.09] |  |
| B | F2L4 time Q1 (0.00-1.62) | 399 |  | 0.87 | 0.98 |
| B | F2L4 time Q2 (1.62-1.96) | 398 |  | 0.90 | 0.99 |
| B | F2L4 time Q3 (1.96-2.28) | 398 |  | 0.93 | 1.01 |
| B | F2L4 time Q4 (2.29-2.73) | 398 |  | 0.86 | 0.98 |
| B | F2L4 time Q5 (2.73-17.91) | 398 |  | 0.87 | 1.00 |
| B | Q5-Q1 median OLL rec |  |  | 0.00 [-0.06, 0.06] |  |

### 6. Own-best potential per solve (median minus own p10), cases with n>=15
Columns: dataset, stage, eligible cases, expected seconds per solve if every eligible case ran at own p10 execution (weights = observed case frequency over all solves incl. skips; bootstrap CI), same with theoretical case probabilities, same for recognition (obs, CI, theory), probability mass covered by eligible cases (observed, theory). Own-best benchmark only; p10 of n=15-60 values is close to the fastest few executions.

| set | stage | cases | exec s | exec CI | exec s (theory wt) | rec s | rec CI | rec s (theory wt) | cov obs | cov theory |
|---|---|---|---|---|---|---|---|---|---|---|
| A | OLL | 44 | 0.23 | [0.21, 0.26] | 0.22 | 0.21 | [0.19, 0.24] | 0.20 | 0.86 | 0.81 |
| A | PLL | 19 | 0.42 | [0.38, 0.46] | 0.42 | 0.25 | [0.22, 0.28] | 0.25 | 0.96 | 0.96 |
| B | OLL | 54 | 0.28 | [0.26, 0.30] | 0.28 | 0.27 | [0.25, 0.29] | 0.26 | 0.98 | 0.97 |
| B | PLL | 21 | 0.42 | [0.39, 0.45] | 0.42 | 0.25 | [0.23, 0.27] | 0.25 | 0.98 | 0.99 |

### 6b. Top 8 OLL cases by weighted exec+rec potential (A)
Columns: case, n, frequency %, execution median, execution p10, freq x (median-p10) seconds per solve, recognition median, recognition p10, same gain. Full list in ll.json.

| case | n | freq% | exec med | exec p10 | exec gain | rec med | rec p10 | rec gain |
|---|---|---|---|---|---|---|---|---|
| OLL 50 | 28 | 2.81 | 1.59 | 1.34 | 0.007 | 1.08 | 0.54 | 0.015 |
| OLL 47 | 19 | 1.90 | 1.89 | 1.61 | 0.005 | 1.62 | 0.80 | 0.016 |
| OLL 3 | 22 | 2.20 | 1.92 | 1.48 | 0.010 | 1.20 | 0.82 | 0.008 |
| OLL 42 | 21 | 2.10 | 2.01 | 1.65 | 0.008 | 1.38 | 0.96 | 0.009 |
| OLL 12 | 20 | 2.00 | 2.06 | 1.80 | 0.005 | 1.53 | 0.98 | 0.011 |
| OLL 35 | 29 | 2.91 | 1.56 | 1.20 | 0.010 | 0.84 | 0.65 | 0.006 |
| OLL 4 | 21 | 2.10 | 1.95 | 1.71 | 0.005 | 1.17 | 0.72 | 0.009 |
| OLL 30 | 17 | 1.70 | 1.77 | 1.17 | 0.010 | 0.78 | 0.57 | 0.004 |

### 6c. Top 8 PLL cases by weighted exec+rec potential (A)
Columns: case, n, frequency %, execution median, execution p10, freq x (median-p10) seconds per solve, recognition median, recognition p10, same gain. Full list in ll.json.

| case | n | freq% | exec med | exec p10 | exec gain | rec med | rec p10 | rec gain |
|---|---|---|---|---|---|---|---|---|
| Gd | 68 | 6.81 | 2.52 | 2.05 | 0.032 | 1.11 | 0.77 | 0.023 |
| Aa | 56 | 5.61 | 1.87 | 1.52 | 0.020 | 1.35 | 0.77 | 0.033 |
| V | 62 | 6.21 | 2.38 | 1.84 | 0.034 | 0.97 | 0.72 | 0.016 |
| Ab | 62 | 6.21 | 1.92 | 1.53 | 0.024 | 1.21 | 0.90 | 0.019 |
| Ja | 61 | 6.11 | 2.13 | 1.71 | 0.025 | 0.78 | 0.54 | 0.014 |
| Gb | 55 | 5.51 | 2.53 | 2.02 | 0.028 | 0.84 | 0.63 | 0.012 |
| Ra | 59 | 5.91 | 2.35 | 1.92 | 0.025 | 0.84 | 0.63 | 0.013 |
| Rb | 61 | 6.11 | 2.13 | 1.82 | 0.019 | 1.11 | 0.81 | 0.018 |

### 7. AUF moves per solve in LL
Columns: dataset, component (pre-OLL = leading U/d tokens in OLL stage; pre-PLL = leading U/d tokens in PLL stage; final = trailing U tokens in PLL stage, also all U tokens of a PLL-skip stage), number of solves with 0,1,2,3,4+ tokens, mean tokens, % of solves with >=1.

| set | component | 0 | 1 | 2 | 3 | 4+ | mean | >=1 % |
|---|---|---|---|---|---|---|---|---|
| A | pre-OLL | 326 | 535 | 117 | 20 | 0 | 0.83 | 67.3 |
| A | pre-PLL | 379 | 531 | 83 | 5 | 0 | 0.71 | 62.0 |
| A | final | 363 | 565 | 69 | 1 | 0 | 0.71 | 63.6 |
| A | LL total | 62 | 196 | 327 | 276 | 137 | 2.25 | - |
| B | pre-OLL | 600 | 1104 | 263 | 27 | 1 | 0.86 | 69.9 |
| B | pre-PLL | 726 | 1072 | 182 | 15 | 0 | 0.74 | 63.6 |
| B | final | 687 | 1181 | 124 | 3 | 0 | 0.72 | 65.6 |
| B | LL total | 114 | 353 | 643 | 594 | 291 | 2.32 | - |

### 7b. Final AUF form
Columns: dataset, solves with final AUF, net U, net U', net U2, U2 done as two quarter-turn tokens, U2 as one token, U2 as 3+ tokens, % of net-U2 done as two quarter-turn tokens, solves where final AUF used more tokens than the minimum.

| set | with AUF | U | U' | U2 | U2 as 2xquarter | U2 one token | U2 3+ tok | 2xquarter % of U2 | over-spent |
|---|---|---|---|---|---|---|---|---|---|
| A | 635 | 207 | 207 | 213 | 10 | 203 | 0 | 4.7 | 70 |
| B | 1308 | 431 | 430 | 434 | 22 | 411 | 1 | 5.1 | 127 |

### 7c. Time on final AUF
Columns: dataset, measure, n, median, mean, p10, p90 seconds. gap before first final-AUF move = timestamp(first trailing U) - timestamp(last alg move); last gap = timestamp(last move) - timestamp(previous move) within the PLL stage.

| set | measure | n | median | mean | p10 | p90 |
|---|---|---|---|---|---|---|
| A | gap before first final-AUF move | 628 | 0.27 | 0.29 | 0.09 | 0.50 |
| A | final AUF duration (>=2 tokens) | 70 | 0.36 | 0.42 | 0.15 | 0.69 |
| A | gap before last move, with final AUF | 628 | 0.30 | 0.30 | 0.09 | 0.54 |
| A | gap before last move, no final AUF | 356 | 0.13 | 0.18 | 0.06 | 0.34 |
| A | with-AUF minus no-AUF median last gap | 628 | 0.17 [0.12, 0.18] |  |  |  |
| B | gap before first final-AUF move | 1284 | 0.28 | 0.30 | 0.09 | 0.50 |
| B | final AUF duration (>=2 tokens) | 127 | 0.37 | 0.42 | 0.15 | 0.70 |
| B | gap before last move, with final AUF | 1284 | 0.30 | 0.31 | 0.10 | 0.51 |
| B | gap before last move, no final AUF | 678 | 0.14 | 0.18 | 0.06 | 0.39 |
| B | with-AUF minus no-AUF median last gap | 1284 | 0.16 [0.15, 0.18] |  |  |  |

### 8. acubemy smartQueue (raw/stats-smartQueue.json)
gate: {'unlocked': True, 'smartCubeSolveCount': 12, 'requiredSolveCount': 12, 'speedLaneOpen': True, 'knownCaseCount': 77, 'requiredKnownCases': 5, 'unknownCaseCount': 0, 'curriculumCaseCount': 78}. method CFOP. dueCards: 1 (OLL 20 idx 19). drillPool: 77 entries ({'OLL': 56, 'PLL': 21}), every entry proficiency {100: 76, 94: 1}, executions per entry {15: 77} (list of executionTime ms only). OLL cases absent from drillPool: ['OLL 20']. No per-case solve statistics, best times or dates are carried except the one due card (proficiency 42.0, bestTimeInTraining null, bestTimeInSolve null, empty solve/training executions, nextReviewDate 2026-11-19T03:14:23.503Z). Drill pool exec medians (s): OLL min 0.75 max 2.26; PLL min 1.29 max 3.01.

### 8b. smartQueue 6 slowest median drill executions
Columns: case, median of the 15 drill executionTime values (s), proficiency.

| case | median exec s | proficiency |
|---|---|---|
| Nb | 3.01 | 100 |
| Na | 3.00 | 94 |
| Ga | 2.52 | 100 |
| Gd | 2.49 | 100 |
| Gc | 2.43 | 100 |
| F | 2.40 | 100 |
