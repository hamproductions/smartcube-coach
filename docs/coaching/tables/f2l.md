# F2L analysis (acubemy, last 1000 smart-cube solves, one solver)

Scope: 1000 solves loaded, 984 analysed. Excluded: 2 non-CFOP (1 Roux, 1 ZZ) and 14 CFOP solves where acubemy attributed the whole cross+F2L stretch to the cross stage (all four F2L stages time 0, no moves; uuids in f2l.json meta). Dates 2026-11-05 to 2026-11-20. Times in seconds (2 decimals) unless stated; raw data in ms. Bootstrap: 2000 resamples, seed 20261120, percentile 95% CI; pair-level statistics resample whole solves (cluster bootstrap), solve-level statistics resample solves. Groups n<30 flagged LOW-N.

Definitions: pair k = k-th F2L stage in acubemy order (stage time = end of previous stage to its last move). "moves" = non-rotation tokens, each = 1 (X2, X2', wide d/u/r/l/f/b, slices M/E/S, merged tokens such as U3 all = 1). "rots" = x/y/z tokens (any suffix), 0 moves. exec TPS = moves / execution seconds. Zero-move pairs (acubemy case -1, time 0.00: slot already solved) are excluded from pair-level tables unless stated, but included in solve-level F2L sums.

**1a. F2L by pair position (pairs with >=1 move)**
_n = pairs; zero = zero-move pairs excluded from n. Each cell median / mean. time/rec/exe in s, moves and rots counts, tps = moves per execution second. rec share = sum(recognition)/sum(time) pooled. Last row is per solve (4 pairs summed, zero-move pairs count as 0)._

| pair | n | zero | time | recognition | execution | moves | rots | exec TPS | rec share |
|---|---|---|---|---|---|---|---|---|---|
| 1st | 965 | 19 | 2.73 / 2.98 | 0.96 / 1.11 | 1.65 / 1.86 | 9.00 / 9.61 | 0.00 / 0.75 | 5.56 / 6.25 | 37.4% |
| 2nd | 979 | 5 | 2.64 / 2.86 | 0.96 / 1.07 | 1.56 / 1.79 | 9.00 / 9.65 | 0.00 / 0.73 | 5.77 / 6.47 | 37.3% |
| 3rd | 981 | 3 | 2.46 / 2.64 | 0.96 / 1.03 | 1.42 / 1.61 | 9.00 / 9.45 | 0.00 / 0.60 | 6.23 / 6.96 | 38.9% |
| 4th | 983 | 1 | 2.10 / 2.22 | 0.93 / 1.00 | 1.08 / 1.22 | 9.00 / 9.11 | 0.00 / 0.47 | 8.14 / 8.71 | 45.1% |
| F2L total (per solve) | 984 | 28 | 10.41 / 10.62 | 4.08 / 4.18 | 6.15 / 6.44 | 37.00 / 37.55 | 2.00 / 2.53 | 6.01 / 6.07 | 39.3% |

**1b. Deciles**
_p10..p90 of the metric; pairs with >=1 move (rows 1st-4th), solves (F2L total). time/rec/exe in s, moves in count._

| pair | metric | p10 | p20 | p30 | p40 | p50 | p60 | p70 | p80 | p90 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1st | time | 1.68 | 1.98 | 2.19 | 2.46 | 2.73 | 3.03 | 3.36 | 3.81 | 4.56 |
| 1st | rec | 0.33 | 0.48 | 0.60 | 0.78 | 0.96 | 1.14 | 1.38 | 1.69 | 2.15 |
| 1st | exe | 0.81 | 1.11 | 1.29 | 1.47 | 1.65 | 1.83 | 2.09 | 2.40 | 3.11 |
| 1st | moves | 6.00 | 7.00 | 8.00 | 8.00 | 9.00 | 10.00 | 11.00 | 12.00 | 13.60 |
| 2nd | time | 1.59 | 1.89 | 2.16 | 2.40 | 2.64 | 2.91 | 3.24 | 3.75 | 4.35 |
| 2nd | rec | 0.35 | 0.48 | 0.66 | 0.81 | 0.96 | 1.11 | 1.30 | 1.56 | 1.93 |
| 2nd | exe | 0.75 | 1.02 | 1.23 | 1.38 | 1.56 | 1.80 | 2.06 | 2.37 | 3.13 |
| 2nd | moves | 6.00 | 7.00 | 8.00 | 8.00 | 9.00 | 10.00 | 11.00 | 12.00 | 13.20 |
| 3rd | time | 1.53 | 1.83 | 2.07 | 2.28 | 2.46 | 2.73 | 3.03 | 3.37 | 3.94 |
| 3rd | rec | 0.41 | 0.54 | 0.69 | 0.81 | 0.96 | 1.08 | 1.23 | 1.41 | 1.74 |
| 3rd | exe | 0.66 | 0.93 | 1.08 | 1.26 | 1.42 | 1.65 | 1.94 | 2.25 | 2.76 |
| 3rd | moves | 6.00 | 7.00 | 8.00 | 8.00 | 9.00 | 10.00 | 11.00 | 12.00 | 13.00 |
| 4th | time | 1.38 | 1.62 | 1.80 | 1.95 | 2.10 | 2.28 | 2.49 | 2.74 | 3.10 |
| 4th | rec | 0.39 | 0.57 | 0.70 | 0.81 | 0.93 | 1.08 | 1.24 | 1.41 | 1.68 |
| 4th | exe | 0.54 | 0.78 | 0.88 | 0.96 | 1.08 | 1.20 | 1.35 | 1.55 | 1.98 |
| 4th | moves | 5.00 | 8.00 | 8.00 | 8.00 | 9.00 | 9.00 | 10.00 | 11.00 | 12.00 |
| F2L total | time | 8.19 | 8.88 | 9.39 | 9.91 | 10.41 | 10.98 | 11.59 | 12.27 | 13.36 |
| F2L total | rec | 2.73 | 3.13 | 3.45 | 3.75 | 4.08 | 4.41 | 4.71 | 5.11 | 5.85 |
| F2L total | exe | 4.27 | 5.01 | 5.37 | 5.77 | 6.15 | 6.68 | 7.12 | 7.80 | 8.76 |
| F2L total | moves | 30.00 | 32.00 | 34.00 | 36.00 | 37.00 | 39.00 | 41.00 | 43.00 | 45.00 |

**2a. Mid-pair gaps, variant A: all gaps after the first move**
_n = pairs with >=2 moves. Columns: mean count per pair of inter-move gaps >400 / >700 / >1000 ms; share of pairs with >=1 gap >700 ms; mean seconds per pair spent inside gaps >400 ms; median pair time (s)._

| pair | n | gaps>400 | gaps>700 | gaps>1000 | pairs with >700 | sec in >400 gaps | median pair time |
|---|---|---|---|---|---|---|---|
| 1st | 965 | 1.38 | 0.43 | 0.17 | 35.2% | 0.95 | 2.73 |
| 2nd | 979 | 1.35 | 0.44 | 0.17 | 35.3% | 0.93 | 2.64 |
| 3rd | 981 | 1.12 | 0.35 | 0.13 | 29.4% | 0.76 | 2.46 |
| 4th | 983 | 0.78 | 0.22 | 0.07 | 20.0% | 0.51 | 2.10 |
| All | 3908 | 1.16 | 0.36 | 0.13 | 30.0% | 0.79 | 2.46 |

**2b. Mid-pair gaps, variant B: gaps that start at/after acubemy recognition end (no overlap with recognition)**
_n = pairs with >=2 moves. Columns: mean count per pair of inter-move gaps >400 / >700 / >1000 ms; share of pairs with >=1 gap >700 ms; mean seconds per pair spent inside gaps >400 ms; median pair time (s)._

| pair | n | gaps>400 | gaps>700 | gaps>1000 | pairs with >700 | sec in >400 gaps | median pair time |
|---|---|---|---|---|---|---|---|
| 1st | 965 | 1.00 | 0.24 | 0.06 | 20.4% | 0.63 | 2.73 |
| 2nd | 979 | 0.90 | 0.23 | 0.06 | 19.3% | 0.57 | 2.64 |
| 3rd | 981 | 0.70 | 0.16 | 0.05 | 14.0% | 0.43 | 2.46 |
| 4th | 983 | 0.35 | 0.05 | 0.02 | 4.4% | 0.20 | 2.10 |
| All | 3908 | 0.73 | 0.17 | 0.05 | 14.5% | 0.46 | 2.46 |

**2c. Mid-pair gaps per solve (4 pairs summed)**
_n = solves. Each cell median / mean. gaps>400/>700/>1000 = count per solve; sec in >400 gaps = total seconds per solve inside gaps >400 ms; share = that time / total F2L time pooled. Variant A includes gaps that overlap acubemy recognition._

| variant | n | gaps>400 | gaps>700 | gaps>1000 | sec in >400 | share of F2L time |
|---|---|---|---|---|---|---|
| A | 984 | 4.00 / 4.59 | 1.00 / 1.43 | 0.00 / 0.53 | 2.94 / 3.13 | 29.5% |
| B | 984 | 3.00 / 2.92 | 0.00 / 0.67 | 0.00 / 0.19 | 1.54 / 1.82 | 17.1% |

Note: acubemy recognition is not the leading gap. Median leading gap (stage start to first move) 0.64 s vs median recognition 0.96 s; recognition > leading gap in 40.5% of pairs (it then ends at a later move, typically after 1-2 setup/AUF/rotation moves and a pause), equal in 54.3%, smaller in 5.2%.

**3a. F2L time by rotation count per solve**
_Per solve (n = solves in bin), rotation family is the row label; bin = count in F2L (4+ pooled). time median / mean (s); rec, exe = mean seconds; moves = mean non-rotation moves in F2L._

| count of | bin | n | share | F2L time | rec | exe | moves |
|---|---|---|---|---|---|---|---|
| rots (x/y/z tokens) | 0 | 122 | 12.4% | 9.96 / 10.00 | 3.99 | 6.01 | 36.34 |
| rots (x/y/z tokens) | 1 | 186 | 18.9% | 9.98 / 10.09 | 3.94 | 6.15 | 36.78 |
| rots (x/y/z tokens) | 2 | 227 | 23.1% | 10.20 / 10.38 | 4.22 | 6.17 | 37.04 |
| rots (x/y/z tokens) | 3 | 187 | 19.0% | 10.47 / 10.63 | 4.20 | 6.44 | 37.41 |
| rots (x/y/z tokens) | 4+ | 262 | 26.6% | 11.34 / 11.48 | 4.39 | 7.09 | 39.19 |
| d/u wide moves | 0 | 526 | 53.5% | 10.16 / 10.39 | 4.10 | 6.29 | 36.98 |
| d/u wide moves | 1 | 341 | 34.7% | 10.74 / 10.85 | 4.27 | 6.58 | 38.11 |
| d/u wide moves | 2 | 100 | 10.2% | 10.57 / 10.80 | 4.25 | 6.55 | 37.80 |
| d/u wide moves | 3 | 17 LOW-N | 1.7% | 12.48 / 12.07 | 4.46 | 7.62 | 42.24 |

**3b. Spearman rank correlations (solve level)**
_rho with bootstrap 95% CI over solves; n = solves._

| pair | n | rho [95% CI] |
|---|---|---|
| rots vs F2L time | 984 | 0.252 [0.191, 0.313] |
| rots vs F2L moves | 984 | 0.167 [0.104, 0.228] |
| rots vs F2L recognition | 984 | 0.126 [0.065, 0.193] |
| rots vs F2L execution | 984 | 0.199 [0.137, 0.259] |
| d/u vs F2L time | 984 | 0.115 [0.051, 0.173] |
| rots+d/u vs F2L time | 984 | 0.306 [0.245, 0.366] |
| F2L moves vs F2L time | 984 | 0.720 [0.685, 0.752] |

**3c. Rotation-like tokens by pair position**
_Each cell: mean tokens per pair / share of pairs with >=1 such token (pairs with moves). Last column: mean tokens per solve across F2L._

| token family | 1st | 2nd | 3rd | 4th | per solve |
|---|---|---|---|---|---|
| y | 0.28 / 25.0% | 0.38 / 32.7% | 0.36 / 30.9% | 0.32 / 29.8% | 1.33 |
| x | 0.42 / 28.9% | 0.26 / 19.7% | 0.20 / 15.6% | 0.10 / 9.8% | 0.97 |
| z | 0.05 / 5.4% | 0.09 / 8.8% | 0.04 / 3.7% | 0.04 / 4.0% | 0.23 |
| d/u wide | 0.08 / 7.7% | 0.15 / 14.3% | 0.19 / 18.0% | 0.19 / 18.4% | 0.60 |
| l/r/f/b wide | 0.16 / 12.7% | 0.13 / 10.9% | 0.09 / 7.4% | 0.04 / 4.0% | 0.42 |

**3d. Rotation cost at pair level, raw and controlled for move count**
_Difference in mean seconds (with-token minus without) over pairs with moves; n_with / n_without = pairs. Controlled = weighted mean of within-move-count-bucket differences (buckets by non-rotation move count: <=4,5,...,14,15+; weight n1*n0/(n1+n0); buckets with <2 in either arm dropped). CI = cluster bootstrap over solves. d/u rows exclude pairs with rotation tokens._

| contrast | metric | n with | n without | raw diff [95% CI] | controlled diff [95% CI] |
|---|---|---|---|---|---|
| >=1 rotation token vs 0 | time | 1696 | 2212 | 0.56 [0.48, 0.63] | 0.36 [0.32, 0.41] |
| >=1 rotation token vs 0 | rec | 1696 | 2212 | 0.19 [0.15, 0.23] | 0.19 [0.15, 0.23] |
| >=1 rotation token vs 0 | exe | 1696 | 2212 | 0.36 [0.29, 0.43] | 0.17 [0.14, 0.22] |
| >=1 d/u wide vs 0 | time | 386 | 1826 | 0.28 [0.17, 0.38] | 0.06 [-0.02, 0.13] |
| >=1 d/u wide vs 0 | rec | 386 | 1826 | 0.16 [0.10, 0.23] | 0.11 [0.05, 0.18] |
| >=1 d/u wide vs 0 | exe | 386 | 1826 | 0.11 [0.02, 0.20] | -0.06 [-0.12, 0.01] |

**3e. Pair time with vs without rotation token, within move-count bucket**
_Bucket = non-rotation move count of the pair. n0 / n1 = pairs without / with >=1 x/y/z token. Mean pair time (s) in each arm; diff = mean1 - mean0 (s) with cluster-bootstrap CI._

| moves | n0 | n1 | mean time 0 rot | mean time >=1 rot | diff [95% CI] |
|---|---|---|---|---|---|
| <=4 | 153 | 81 | 1.26 | 1.55 | 0.29 [0.16, 0.42] |
| 5 | 90 | 52 | 1.73 | 1.96 | 0.24 [0.04, 0.43] |
| 6 | 59 | 32 | 1.88 | 2.25 | 0.36 [0.12, 0.62] |
| 7 | 250 | 163 | 2.02 | 2.24 | 0.22 [0.11, 0.33] |
| 8 | 565 | 354 | 2.09 | 2.39 | 0.30 [0.22, 0.38] |
| 9 | 306 | 232 | 2.46 | 2.75 | 0.29 [0.18, 0.40] |
| 10 | 137 | 132 | 2.80 | 3.13 | 0.33 [0.17, 0.49] |
| 11 | 207 | 180 | 2.88 | 3.28 | 0.40 [0.24, 0.57] |
| 12 | 216 | 190 | 2.93 | 3.26 | 0.32 [0.15, 0.50] |
| 13 | 88 | 91 | 3.41 | 3.69 | 0.28 [0.04, 0.51] |
| 14 | 43 | 50 | 3.59 | 4.23 | 0.64 [0.24, 1.05] |
| 15+ | 98 | 139 | 4.26 | 5.40 | 1.14 [0.73, 1.61] |

**4a. Distribution of moves per pair**
_moves = non-rotation tokens in the pair (pairs with moves, n=3908); count and share of pairs._

| moves | pairs | share |
|---|---|---|
| 3 | 50 | 1.3% |
| 4 | 184 | 4.7% |
| 5 | 142 | 3.6% |
| 6 | 91 | 2.3% |
| 7 | 413 | 10.6% |
| 8 | 919 | 23.5% |
| 9 | 538 | 13.8% |
| 10 | 269 | 6.9% |
| 11 | 387 | 9.9% |
| 12 | 406 | 10.4% |
| 13 | 179 | 4.6% |
| 14 | 93 | 2.4% |
| 15 | 81 | 2.1% |
| 16 | 47 | 1.2% |
| 17 | 28 | 0.7% |
| 18 | 16 | 0.4% |
| 19 | 9 | 0.2% |
| 20+ | 56 | 1.4% |

**4b. Long pairs and wasted-move pairs**
_Share of pairs (with moves) with >=10, >=12, >=15 moves; with an adjacent same-face pair that nets to zero (X X', X2 X2); with a same-face run of >=3 tokens or a merged token such as U3; either._

| pair | n | >=10 | >=12 | >=15 | undone adj. | triple/merged | either |
|---|---|---|---|---|---|---|---|
| 1st | 965 | 44.6% | 24.7% | 7.0% | 20.3% | 5.6% | 22.1% |
| 2nd | 979 | 42.6% | 26.1% | 7.5% | 20.0% | 7.9% | 24.0% |
| 3rd | 981 | 42.2% | 24.9% | 6.6% | 19.7% | 9.3% | 24.5% |
| 4th | 983 | 31.5% | 18.0% | 3.2% | 17.6% | 8.3% | 21.9% |
| All | 3908 | 40.2% | 23.4% | 6.1% | 19.4% | 7.8% | 23.1% |

**4c. Time cost of wasted-move pairs**
_Mean seconds with-flag minus without; raw and controlled for non-rotation move-count bucket (same method as 3d, so the flagged pair is compared to a pair of equal length). CI = cluster bootstrap._

| flag | metric | n with | n without | raw diff [95% CI] | controlled diff [95% CI] |
|---|---|---|---|---|---|
| undone adjacent (X X') | time | 758 | 3150 | 0.78 [0.67, 0.88] | 0.10 [0.02, 0.18] |
| undone adjacent (X X') | exe | 758 | 3150 | 0.64 [0.54, 0.75] | 0.04 [-0.03, 0.12] |
| triple / merged token | time | 304 | 3604 | 0.65 [0.50, 0.81] | 0.26 [0.15, 0.36] |
| triple / merged token | exe | 304 | 3604 | 0.35 [0.21, 0.51] | -0.04 [-0.13, 0.06] |
| either | time | 903 | 3005 | 0.73 [0.63, 0.83] | 0.16 [0.08, 0.23] |
| either | exe | 903 | 3005 | 0.56 [0.46, 0.66] | 0.04 [-0.03, 0.10] |

**4d. OLS slope of pair seconds on move count**
_slope = extra seconds per extra non-rotation move (with cluster-bootstrap CI over solves); intercept in s; n = pairs._

| subset | y | n | slope s/move [95% CI] | intercept |
|---|---|---|---|---|
| all pairs with moves | time | 3908 | 0.252 [0.240, 0.265] | 0.29 |
| all pairs with moves | exe | 3908 | 0.250 [0.238, 0.263] | -0.74 |
| all pairs with moves | rec | 3908 | 0.002 [-0.003, 0.008] | 1.03 |
| pairs with >=10 moves | time | 1571 | 0.277 [0.251, 0.304] | -0.04 |
| pairs with >=10 moves | exe | 1571 | 0.293 [0.271, 0.317] | -1.31 |
| pairs with >=10 moves | rec | 1571 | -0.016 [-0.026, -0.006] | 1.27 |
| pairs with >=12 moves | time | 915 | 0.306 [0.277, 0.336] | -0.54 |
| pairs with >=12 moves | exe | 915 | 0.313 [0.286, 0.340] | -1.66 |
| pairs with >=12 moves | rec | 915 | -0.007 [-0.017, 0.004] | 1.13 |

**5a. Top 18 caseIndex by excess seconds (all 93 cases in out/f2l-cases.md and f2l.json)**
_Pairs with moves grouped by acubemy caseIndex (name from acubemy F2L table, bundle 7769 module 39452). n = pairs; share of all pairs; time in s; med rec/exe in s; with rot = share with an x/y/z token; gap>700 = share with an inter-move gap >700 ms after the first move; excess = sum over pairs of (pair time - solver median pair time 2.46 s), sorted descending; sequences = rotation-stripped, adjacent same-face tokens merged, X2'=X2, in the solver's frame (count in brackets); AUF-stripped = same with leading/trailing U moves removed._

| caseIndex | name | type | n | share | time med / mean | med rec | med exe | med moves | with rot | gap>700 | excess s | distinct seq (full/core) | top 3 sequences |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 35 | F2L 36 | Edge In Slot | 86 | 2.2% | 3.19 / 3.36 | 0.94 | 2.20 | 11.00 | 58% | 36% | 77.81 | 67/58 | F' U' F U' R U R' (5); U' F' U' F U' R U R' (5); U2 F' U' F U' R U R' (4) |
| 37 | AF2L 13 | Trapped Edge | 34 | 0.9% | 4.00 / 3.94 | 1.18 | 2.39 | 12.00 | 44% | 41% | 50.34 | 33/29 | U R U' R' U R U' R' f R' f' (2); U2 R U' R' U2 R' U2 R U' f R f' (1); U2 L' U L R U2 R' U F' U' R (1) |
| 33 | F2L 35 | Edge In Slot | 80 | 2.0% | 2.99 / 3.08 | 0.83 | 2.10 | 10.00 | 60% | 31% | 49.60 | 68/55 | U' R U R' U F' U' F (4); U R U R' U F' U' F (3); U' R U R' U R U' R' d R' U' R (2) |
| 19 | F2L 24 | Connected Pairs | 91 | 2.3% | 2.79 / 2.98 | 0.64 | 2.13 | 12.00 | 52% | 23% | 47.76 | 76/59 | U' R U2 R' U' R' U2 R U2 R' U R (6); R U2 R' U L' U2 L U2 L' U L (5); U2 R U B U' B' R' B U' B' (2) |
| 25 | AF2L 15 | Trapped Edge | 31 | 0.8% | 3.69 / 3.90 | 0.93 | 2.31 | 13.00 | 58% | 35% | 44.79 | 28/23 | U2 R' U R U2 R U2 R' U F' U' F (3); U' R' U R U2 R U2 R' U F' U' F (2); L' U L F2 L' F' L R F' R' F2 d R' U' M F L (1) |
| 45 | AF2L 17 | Trapped Edge | 37 | 0.9% | 3.33 / 3.59 | 0.99 | 2.52 | 11.00 | 54% | 49% | 41.86 | 36/32 | U2 L' U' L R U2 R' U B U' B' (2); U L' U' L R U2 R' U B U' B' (1); U R U2 R' d L' U' L U B' R B R' B U B' (1) |
| 42 | AF2L 14 | Trapped Edge | 40 | 1.0% | 3.33 / 3.50 | 1.14 | 2.03 | 12.00 | 38% | 40% | 41.82 | 35/30 | U L' U L R U2 R2 U' R (4); U R U' R' U R U' R' L U2 L' (2); U R' U R U2 R U2 R' U2 L' U' L (2) |
| 28 | AF2L 43 | Trapped Edge | 42 | 1.1% | 3.21 / 3.39 | 1.14 | 1.94 | 11.00 | 45% | 33% | 39.37 | 38/30 | R U R' L' U2 L U2 L' U L (3); U R' U R U2 R U R' (2); U R U R' L' U2 L U2 L' U L (2) |
| 17 | F2L 8 | Disconnected Pairs | 93 | 2.4% | 2.62 / 2.88 | 1.18 | 1.26 | 9.00 | 44% | 35% | 39.07 | 71/56 | L' U2 L U2 L' U L (5); U2 L' U2 L U2 L' U L (4); U' R' U2 R U2 R' U R (4) |
| 47 | AF2L 44 | Trapped Edge | 35 | 0.9% | 3.48 / 3.52 | 1.26 | 2.25 | 12.00 | 74% | 43% | 37.30 | 33/32 | L F' L' F l' U' R U' F' U F (2); U R U R' L' U2 L U' L' U L (2); U2 F R U R' F d R' U' R L' U L (1) |
| 26 | AF2L 12 | Trapped Edge | 45 | 1.2% | 3.15 / 3.26 | 1.05 | 2.04 | 11.00 | 47% | 40% | 36.14 | 34/28 | U' R U R' U2 L' U' L (3); U R' U R U R U R' U2 R U' R' (3); L' F' L R F2 R' L F' L' (3) |
| 29 | AF2L 21 | Trapped Edge | 42 | 1.1% | 3.27 / 3.31 | 1.08 | 2.11 | 11.00 | 64% | 55% | 36.01 | 39/33 | U' L' U' L U R' U' R L' U2 L (2); R U R' U' F U F' (2); U' L F' L' F l' U R U' f R f' (2) |
| 27 | AF2L 18 | Trapped Edge | 32 | 0.8% | 3.63 / 3.54 | 1.13 | 2.42 | 11.00 | 62% | 50% | 34.69 | 30/24 | R U' R' F U2 F' (2); L' U' L U' B' U' B (2); R' U R U' R' U R U2 F' U' F (1) |
| 41 | AF2L 19 | Trapped Edge | 38 | 1.0% | 3.07 / 3.33 | 0.96 | 2.21 | 12.00 | 50% | 42% | 33.12 | 35/30 | R U R' U f R f' (3); U' R U2 R' B U f' (2); U F L F' L' F l' U R U F U L' (1) |
| 63 | AF2L 4a | Trapped Corner | 17 LOW-N | 0.4% | 4.41 / 4.40 | 0.90 | 3.33 | 13.00 | 59% | 71% | 32.94 | 16/16 | R U R' U' R' U' R U2 R' U R (2); L' U2 L F' U2 F U' F' U F (1); R U R' U' R' U2 R U2 R' U R (1) |
| 44 | AF2L 11 | Trapped Edge | 44 | 1.1% | 3.21 / 3.19 | 1.11 | 1.81 | 11.00 | 41% | 43% | 32.15 | 34/26 | U' L' U' L R' U' R (3); U L' U' L R' U' R (3); R U' R' L U' L' (3) |
| 30 | F2L 32 | Edge In Slot | 81 | 2.1% | 2.43 / 2.83 | 0.84 | 1.56 | 12.00 | 38% | 28% | 30.52 | 59/51 | U R U' R' U R U' R' U R U' R' (8); R U' R' U R U' R' U R U' R' (5); U' R U' R' U2 R' U2 R2 U R' (4) |
| 43 | AF2L 23 | Trapped Edge | 30 | 0.8% | 2.90 / 3.42 | 1.00 | 1.73 | 9.00 | 67% | 53% | 28.80 | 30/27 | r U R' U R U L U' L' (1); R U R' U L' U' L (1); D' R D R' U' R' U D R2 D' R B R' B' (1) |

**5b. By acubemy case type**
_Pairs with moves grouped by the case type string in acubemy's F2L table; time median / mean s; med rec/exe s; med moves; share with rotation token; excess s vs solver median pair time._

| type | n | share | time | med rec | med exe | med moves | with rot | excess s |
|---|---|---|---|---|---|---|---|---|
| Trapped Edge | 660 | 16.9% | 3.17 / 3.33 | 1.05 | 2.03 | 11.00 | 50% | 573.70 |
| Trapped Corner | 143 | 3.7% | 3.64 / 3.93 | 0.90 | 2.46 | 12.00 | 51% | 210.25 |
| Edge In Slot | 493 | 12.6% | 2.73 / 2.86 | 0.87 | 1.75 | 10.00 | 46% | 198.85 |
| Disconnected Pairs | 878 | 22.5% | 2.37 / 2.61 | 1.11 | 1.18 | 8.00 | 41% | 137.23 |
| Corner In Slot | 294 | 7.5% | 2.34 / 2.60 | 1.02 | 1.20 | 9.00 | 44% | 43.25 |
| Pieces In Slot | 49 | 1.3% | 2.82 / 2.97 | 0.69 | 2.10 | 14.00 | 45% | 24.99 |
| Both Pieces Trapped | 54 | 1.4% | 2.72 / 2.86 | 0.67 | 1.96 | 10.00 | 54% | 21.50 |
| Connected Pairs | 919 | 23.5% | 2.25 / 2.41 | 0.75 | 1.38 | 9.00 | 40% | -42.64 |
| Free Pairs | 418 | 10.7% | 1.56 / 1.69 | 1.05 | 0.42 | 4.00 | 38% | -322.63 |

**5c. Solution consistency**
_Groups of pairs sharing the key; only groups with n >= threshold; share of those pairs whose normalised move sequence equals the group modal sequence (full) or modal AUF-stripped sequence (core). Sequences are in the solver frame, so the same case in different slots/rotations splits under caseIndex alone._

| key | min n | groups | pairs | modal full | modal AUF-stripped |
|---|---|---|---|---|---|
| caseIndex | >=3 | 83 | 3894 | 9.9% | 22.0% |
| caseIndex | >=10 | 63 | 3774 | 9.4% | 21.8% |
| caseIndex x slotIndex | >=3 | 250 | 3809 | 18.4% | 36.6% |
| caseIndex x slotIndex | >=10 | 169 | 3350 | 17.5% | 37.3% |

**6a. slotIndex frequency by pair position**
_Count (share of pairs at that position, pairs with moves). slotIndex 0..3 = FR, FL, BL, BR (see 6d)._

| pair | FR(0) | FL(1) | BL(2) | BR(3) | n |
|---|---|---|---|---|---|
| 1st | 238 (24.7%) | 261 (27.0%) | 225 (23.3%) | 241 (25.0%) | 965 |
| 2nd | 257 (26.3%) | 244 (24.9%) | 246 (25.1%) | 232 (23.7%) | 979 |
| 3rd | 363 (37.0%) | 244 (24.9%) | 191 (19.5%) | 183 (18.7%) | 981 |
| 4th | 476 (48.4%) | 237 (24.1%) | 111 (11.3%) | 159 (16.2%) | 983 |
| All | 1334 (34.1%) | 986 (25.2%) | 773 (19.8%) | 815 (20.9%) | 3908 |

**6b. Pair time by slotIndex**
_Pairs with moves. time median / mean (s); med rec / exe (s); med moves; share with rotation token; diff = mean time of slot minus mean of other slots (s, raw) and controlled for move-count bucket; cluster-bootstrap CI._

| slot | n | time | med rec | med exe | med moves | with rot | raw diff vs others [95% CI] | controlled diff [95% CI] |
|---|---|---|---|---|---|---|---|---|
| FR | 1334 | 2.28 / 2.49 | 0.90 | 1.26 | 9.00 | 37% | -0.28 [-0.35, -0.21] | -0.22 [-0.28, -0.17] |
| FL | 986 | 2.46 / 2.71 | 0.96 | 1.41 | 9.00 | 47% | 0.05 [-0.03, 0.14] | 0.05 [-0.01, 0.11] |
| BL | 773 | 2.70 / 2.92 | 1.02 | 1.63 | 9.00 | 51% | 0.31 [0.23, 0.40] | 0.20 [0.14, 0.27] |
| BR | 815 | 2.46 / 2.69 | 0.96 | 1.41 | 9.00 | 42% | 0.02 [-0.08, 0.11] | 0.05 [-0.01, 0.12] |

**6c. Median time / rec / moves by position and slotIndex**
_Median pair time s / median recognition s / median moves; n = pairs._

| pair | FR(0) | FL(1) | BL(2) | BR(3) |
|---|---|---|---|---|
| 1st | 2.55 / 0.87 / 9.00 (n=238) | 2.76 / 0.96 / 9.00 (n=261) | 2.76 / 0.88 / 9.00 (n=225) | 2.79 / 1.05 / 9.00 (n=241) |
| 2nd | 2.55 / 0.93 / 9.00 (n=257) | 2.67 / 0.97 / 9.00 (n=244) | 2.81 / 0.99 / 9.00 (n=246) | 2.50 / 0.96 / 9.00 (n=232) |
| 3rd | 2.40 / 0.96 / 9.00 (n=363) | 2.43 / 0.91 / 9.00 (n=244) | 2.58 / 1.05 / 9.00 (n=191) | 2.46 / 0.94 / 9.00 (n=183) |
| 4th | 2.04 / 0.87 / 8.00 (n=476) | 2.16 / 0.99 / 9.00 (n=237) | 2.55 / 1.26 / 9.00 (n=111) | 2.01 / 0.87 / 9.00 (n=159) |

**6d. Does slotIndex equal the physical slot in the solver frame? (cube simulation)**
_Each pair's newly solved slot was found by replaying acubemy's reconstructed solution (rotations and wide moves included) on the scrambled cube; slot label (FR/FL/BL/BR, cross on D, front = F center in the solver frame at the stated moment) compared with F2L_SLOT_LABELS[slotIndex]. Cells = share agreeing (pairs). 31 solves failed replay, 67 replayed but cross not on D after cross stage._

| pair group | frame | pairs | agree | pos 1 | pos 2 | pos 3 | pos 4 |
|---|---|---|---|---|---|---|---|
| no rotation, no wide | start = end frame | 1419 | 91.3% | 98% (380) | 91% (321) | 92% (313) | 85% (405) |
| no rotation, wide | start-frame | 286 | 19.9% | 75% (56) | 13% (45) | 3% (58) | 6% (127) |
| no rotation, wide | end-frame | 286 | 49.0% | 11% (56) | 20% (45) | 5% (58) | 96% (127) |
| rotation token(s) | start-frame | 987 | 46.3% | 80% (355) | 42% (219) | 38% (173) | 7% (240) |
| rotation token(s) | end-frame | 987 | 53.8% | 41% (355) | 46% (219) | 39% (173) | 91% (240) |

**7a. F2L by totalTime quintile (Q1 fastest)**
_n = solves per quintile; total range in s; F2L time median / mean s; rec, exe = mean sum over 4 pairs (s); moves, rots, d/u = mean per solve; gaps>700 A/B = mean mid-pair gaps >700 ms per solve (A all after first move, B after recognition end); sec>400 B = mean seconds in B gaps >400 ms; F2L share = sum F2L / sum total._

| Q | n | total s | F2L time | rec | exe | moves | rots | d/u | gaps>700 A | gaps>700 B | sec>400 B | F2L share |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 196 | 11.22-16.71 | 8.49 / 8.50 | 3.55 | 4.94 | 32.82 | 1.98 | 0.56 | 0.77 | 0.26 | 0.93 | 54.9% |
| 2 | 197 | 16.71-18.00 | 9.71 / 9.73 | 3.88 | 5.85 | 35.50 | 2.39 | 0.53 | 1.09 | 0.47 | 1.47 | 55.9% |
| 3 | 197 | 18.02-19.44 | 10.44 / 10.48 | 4.12 | 6.36 | 37.74 | 2.32 | 0.63 | 1.28 | 0.57 | 1.70 | 56.1% |
| 4 | 197 | 19.44-21.24 | 11.73 / 11.64 | 4.63 | 7.01 | 39.88 | 2.82 | 0.61 | 1.79 | 0.84 | 2.09 | 57.5% |
| 5 | 197 | 21.24-38.89 | 12.81 / 12.73 | 4.69 | 8.04 | 41.77 | 3.12 | 0.68 | 2.24 | 1.22 | 2.90 | 52.9% |

**7b. Slowest minus fastest quintile, per pair position (zero-move pairs count as 0)**
_n = 196 solves in Q1 (fastest) and 197 in Q5 (slowest). Mean per-position time/rec/exe in s, moves in count; diff = Q5 - Q1 with bootstrap 95% CI; ratio = Q5/Q1._

| pair | metric | Q1 mean | Q5 mean | Q5-Q1 [95% CI] | ratio |
|---|---|---|---|---|---|
| 1st | time | 2.28 | 3.54 | 1.27 [0.99, 1.55] | 1.56 |
| 1st | rec | 0.86 | 1.23 | 0.38 [0.24, 0.51] | 1.44 |
| 1st | exe | 1.42 | 2.31 | 0.89 [0.63, 1.15] | 1.62 |
| 1st | moves | 8.28 | 10.61 | 2.33 [1.44, 3.25] | 1.28 |
| 2nd | time | 2.14 | 3.53 | 1.38 [1.16, 1.63] | 1.65 |
| 2nd | rec | 0.91 | 1.25 | 0.35 [0.22, 0.48] | 1.38 |
| 2nd | exe | 1.24 | 2.28 | 1.04 [0.82, 1.25] | 1.84 |
| 2nd | moves | 7.91 | 10.92 | 3.01 [2.29, 3.70] | 1.38 |
| 3rd | time | 2.15 | 3.13 | 0.98 [0.77, 1.19] | 1.46 |
| 3rd | rec | 0.89 | 1.14 | 0.25 [0.14, 0.36] | 1.28 |
| 3rd | exe | 1.26 | 1.99 | 0.73 [0.55, 0.93] | 1.58 |
| 3rd | moves | 8.10 | 10.61 | 2.51 [1.76, 3.24] | 1.31 |
| 4th | time | 1.93 | 2.53 | 0.60 [0.39, 0.85] | 1.31 |
| 4th | rec | 0.91 | 1.07 | 0.16 [0.07, 0.26] | 1.18 |
| 4th | exe | 1.02 | 1.46 | 0.44 [0.26, 0.68] | 1.43 |
| 4th | moves | 8.52 | 9.62 | 1.10 [0.39, 1.85] | 1.13 |

**8a. Blocks of 100 solves, oldest to newest**
_Block of 100 CFOP solves in date order (last block has 84); dates MM-DD; total and F2L time median / mean s; rec, exe = mean seconds summed over the 4 pairs; moves, rots, d/u = mean per solve; gaps>700 B = mean mid-pair gaps >700 ms after recognition end per solve; rec share = pooled recognition / F2L time._

| block | n | dates | total | F2L time | rec | exe | moves | rots | d/u | gaps>700 B | rec share |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 100 | 11-05..11-05 | 17.98 / 18.95 | 10.25 / 10.40 | 3.92 | 6.48 | 36.74 | 2.31 | 0.52 | 0.69 | 37.7% |
| 2 | 100 | 11-05..11-06 | 18.61 / 19.25 | 10.60 / 10.69 | 4.45 | 6.23 | 37.29 | 2.62 | 0.67 | 0.58 | 41.7% |
| 3 | 100 | 11-06..11-10 | 19.23 / 19.52 | 10.71 / 10.97 | 4.22 | 6.75 | 37.53 | 2.47 | 0.62 | 0.81 | 38.5% |
| 4 | 100 | 11-10..11-11 | 18.50 / 18.60 | 10.21 / 10.55 | 4.07 | 6.48 | 38.46 | 2.35 | 0.61 | 0.76 | 38.6% |
| 5 | 100 | 11-11..11-12 | 18.84 / 19.16 | 10.46 / 10.53 | 4.29 | 6.24 | 38.89 | 2.12 | 0.67 | 0.62 | 40.8% |
| 6 | 100 | 11-12..11-13 | 19.21 / 19.79 | 10.44 / 10.70 | 4.08 | 6.63 | 37.35 | 2.51 | 0.67 | 0.63 | 38.1% |
| 7 | 100 | 11-13..11-17 | 18.95 / 19.46 | 10.51 / 10.85 | 4.28 | 6.56 | 38.93 | 2.90 | 0.63 | 0.64 | 39.5% |
| 8 | 100 | 11-17..11-18 | 18.56 / 19.01 | 10.38 / 10.58 | 4.25 | 6.33 | 36.63 | 2.70 | 0.56 | 0.63 | 40.2% |
| 9 | 100 | 11-18..11-20 | 18.78 / 19.05 | 10.43 / 10.50 | 4.20 | 6.30 | 36.74 | 2.64 | 0.59 | 0.59 | 40.0% |
| 10 | 84 | 11-20..11-20 | 18.04 / 18.93 | 10.11 / 10.37 | 3.97 | 6.40 | 36.77 | 2.65 | 0.45 | 0.80 | 38.3% |

**8b. Trend over solve order (Spearman)**
_rho between chronological solve index and the metric; n = solves; bootstrap 95% CI over solves. Solves in one session are autocorrelated, so the CI is optimistic._

| metric | n | rho [95% CI] |
|---|---|---|
| F2L time | 984 | -0.033 [-0.094, 0.034] |
| F2L recognition | 984 | -0.011 [-0.074, 0.053] |
| F2L execution | 984 | -0.031 [-0.088, 0.034] |
| F2L moves | 984 | -0.048 [-0.108, 0.014] |
| F2L rots | 984 | 0.067 [0.003, 0.136] |
| total time | 984 | -0.016 [-0.079, 0.047] |

**10a. Spearman of pair N vs recognition of pair N+1**
_Consecutive pairs in the same solve, both with moves; n = (N, N+1) couples. rho between the row metric of pair N and recognition of pair N+1; cluster-bootstrap 95% CI over solves. Negative rho for execution / time would mean slower pair N goes with shorter next recognition (look-ahead)._

| x (pair N) | subset | n | rho [95% CI] |
|---|---|---|---|
| pair N time | N=1,2,3 pooled | 2922 | -0.049 [-0.085, -0.014] |
| pair N time | N=1 | 964 | -0.115 [-0.177, -0.054] |
| pair N time | N=2 | 978 | -0.019 [-0.080, 0.042] |
| pair N time | N=3 | 980 | -0.012 [-0.075, 0.054] |
| pair N execution | N=1,2,3 pooled | 2922 | -0.056 [-0.092, -0.020] |
| pair N execution | N=1 | 964 | -0.117 [-0.177, -0.053] |
| pair N execution | N=2 | 978 | -0.018 [-0.081, 0.038] |
| pair N execution | N=3 | 980 | -0.039 [-0.098, 0.026] |
| pair N moves | N=1,2,3 pooled | 2922 | -0.010 [-0.045, 0.026] |
| pair N moves | N=1 | 964 | -0.072 [-0.132, -0.010] |
| pair N moves | N=2 | 978 | 0.014 [-0.050, 0.073] |
| pair N moves | N=3 | 980 | 0.034 [-0.026, 0.100] |
| pair N exec TPS | N=1,2,3 pooled | 2922 | 0.075 [0.040, 0.112] |
| pair N exec TPS | N=1 | 964 | 0.113 [0.053, 0.172] |
| pair N exec TPS | N=2 | 978 | 0.043 [-0.017, 0.105] |
| pair N exec TPS | N=3 | 980 | 0.077 [0.012, 0.135] |
| pair N recognition | N=1,2,3 pooled | 2922 | -0.019 [-0.055, 0.017] |

**10b. Recognition of pair N+1 by execution-TPS tercile of pair N**
_Terciles of pair N execution TPS (pooled over N=1,2,3; n = couples; cut points 5.13 and 6.67 tps). median exe (s) and median moves of pair N; recognition of pair N+1 median / mean (s); mean time of pair N+1 (s)._

| tercile | n | TPS range | N med exe | N med moves | rec N+1 med / mean | time N+1 mean |
|---|---|---|---|---|---|---|
| T1 (slowest) | 973 | 1.95-5.13 | 2.37 | 10.00 | 0.87 / 0.97 | 2.51 |
| T2 (middle) | 973 | 5.13-6.67 | 1.53 | 9.00 | 0.96 / 1.05 | 2.64 |
| T3 (fastest) | 976 | 6.67-222.22 | 0.98 | 8.00 | 0.98 / 1.07 | 2.56 |

Mean recognition of pair N+1, difference between TPS terciles of pair N (s, cluster-bootstrap 95% CI): fastest tercile minus slowest 0.09 [0.04, 0.14] s; middle minus slowest 0.08 [0.03, 0.13] s.

**10c. Median recognition of pair N+1 by TPS tercile of pair N, within N**
_Terciles computed within each N (removes position effects); cell = median recognition of pair N+1 in s (n = couples)._

| N | T1 slowest | T2 middle | T3 fastest |
|---|---|---|---|
| N=1 | 0.84 (n=321) | 0.96 (n=321) | 1.01 (n=322) |
| N=2 | 0.89 (n=326) | 1.01 (n=325) | 0.96 (n=327) |
| N=3 | 0.87 (n=327) | 0.99 (n=326) | 0.96 (n=327) |
