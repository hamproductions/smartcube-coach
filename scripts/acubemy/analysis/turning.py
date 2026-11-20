import sys, os, json, re, math, bisect, collections
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib

SEED = 20261120
NB = 2000
STG = lib.STAGES
FACES = 'UDLRFB'
OUTJ = {}
MD = []
_IDX = {}


def boot_idx(n):
    if n not in _IDX:
        _IDX[n] = np.random.default_rng(SEED + n).integers(0, n, (NB, n))
    return _IDX[n]


def rank(a):
    a = np.asarray(a, float)
    o = np.argsort(a, kind='mergesort')
    sa = a[o]
    flag = np.r_[True, sa[1:] != sa[:-1]]
    grp = np.cumsum(flag) - 1
    first = np.flatnonzero(flag)
    last = np.r_[first[1:], len(a)]
    avg = (first + last - 1) / 2 + 1
    r = np.empty(len(a))
    r[o] = avg[grp]
    return r


def pear(x, y):
    x = x - x.mean()
    y = y - y.mean()
    d = math.sqrt((x * x).sum() * (y * y).sum())
    return float((x * y).sum() / d) if d > 0 else float('nan')


def spearman(x, y):
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    n = len(x)
    rho = pear(rank(x), rank(y))
    idx = boot_idx(n)
    bs = np.array([pear(rank(x[i]), rank(y[i])) for i in idx])
    bs = bs[~np.isnan(bs)]
    return rho, float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))


def sp(x, y):
    r, lo, hi = spearman(x, y)
    return '%.2f [%.2f, %.2f]' % (r, lo, hi)


def mean_ci(d):
    d = np.asarray(d, float)
    idx = boot_idx(len(d))
    m = d[idx].mean(1)
    return float(d.mean()), float(np.percentile(m, 2.5)), float(np.percentile(m, 97.5))


def fci(t, k=2):
    m, lo, hi = t
    return '%.*f [%.*f, %.*f]' % (k, m, k, lo, k, hi)


def low(n):
    return ' LOW-N' if n < 30 else ''


def mm(a, k=2, scale=1.0):
    a = np.asarray(a, float) * scale
    if len(a) == 0:
        return 'n/a'
    return '%.*f / %.*f' % (k, np.median(a), k, a.mean())


def table(sid, title, defs, header, rows):
    MD.append('')
    MD.append('### %s %s' % (sid, title))
    MD.append('Columns: ' + defs)
    MD.append('')
    MD.append('| ' + ' | '.join(header) + ' |')
    MD.append('|' + '|'.join(['---'] * len(header)) + '|')
    for r in rows:
        MD.append('| ' + ' | '.join(str(c) for c in r) + ' |')
    OUTJ[sid] = {'title': title, 'columns': header, 'rows': rows}


def note(s):
    MD.append('')
    MD.append(s)


def norm_tok(t):
    if t[0] in 'xyz':
        return t[0]
    b = t.rstrip("'")
    if len(b) > 1 and b[-1].isdigit():
        return b
    return t


def cons(tok):
    b = tok[0]
    if b in 'xyz':
        return 0
    base = tok.rstrip("'")
    m = re.match(r'^[A-Za-z](\d?)', base)
    k = int(m.group(1)) if m.group(1) else 1
    if b in 'MSE':
        return 2 * k
    if b in 'rludfb':
        return k
    return k


def align(raw, sol):
    n = len(raw)
    pos = 0
    toks = []
    resync = 0
    for m in sol:
        tok = m['sliceTurn']
        if tok[0] in 'xyz':
            toks.append({'tok': tok, 'rot': True, 'pos': pos})
            continue
        c = cons(tok)
        end = pos + c - 1
        if tok[0] in FACES and pos > 0 and (end >= n or raw[end]['timeStamp'] != m['timeStamp']):
            best = None
            for j in range(max(pos, end - 2), min(n, end + 3)):
                if raw[j]['timeStamp'] == m['timeStamp']:
                    if best is None or abs(j - end) < abs(best - end):
                        best = j
            if best is not None:
                if best != end:
                    resync += 1
                end = best
        if pos >= n:
            toks.append({'tok': tok, 'rot': False, 'norm': norm_tok(tok), 's': None, 'e': None,
                         'face': tok[0].upper() if tok[0] in FACES else 'W'})
            continue
        end = min(end, n - 1)
        toks.append({'tok': tok, 'rot': False, 'norm': norm_tok(tok), 's': pos, 'e': end,
                     'face': tok[0] if tok[0] in FACES else 'W'})
        pos = end + 1
    return toks, pos, resync


def qangle(a, b):
    d = np.abs((a * b).sum(-1)).clip(0, 1)
    return np.degrees(2 * np.arccos(d))


R = lib.load()
N = len(R)
cf = [lib.stages(r) is not None for r in R]
S = []
align_bad = 0
align_resync = 0
align_over = 0
for r in R:
    d = r['detail']
    raw = d['rawSolutionSequence']
    ts = np.array([m['timeStamp'] for m in raw], float)
    toks, pos, rs = align(raw, d['solutionSequence'])
    align_resync += rs
    if pos != len(raw):
        align_bad += 1
        if pos > len(raw):
            align_over += 1
    st = lib.stages(r)
    ends = [s['end'] for s in st] if st else None
    stg = None
    if ends:
        stg = np.array([min(bisect.bisect_left(ends, t), 6) for t in ts])
    S.append({'T': d['totalTime'], 'ts': ts, 'raw': [m['sliceTurn'] for m in raw], 'toks': toks, 'stg': stg,
              'turns': r['list']['turnCount'], 'tps': r['list']['tps'], 'fl': r['list']['fluencyPercent'],
              'ends': ends, 'st': st, 'd': d})
T = np.array([s['T'] for s in S], float)
TURNS = np.array([s['turns'] for s in S], float)
NRAW = np.array([len(s['ts']) for s in S], float)
cfidx = np.array([i for i in range(N) if cf[i]])
ncf = len(cfidx)
GAPS = [np.diff(s['ts']) for s in S]
allg = np.concatenate(GAPS)
MEDGAP = float(np.median(allg))

MD.append('# Turning mechanics, pauses, fumbles, rotations, gyro')
MD.append('')
MD.append('Source: acubemy last %d solves (GAN i4), sorted oldest to newest. Times in seconds (2 dp) unless marked ms. '
          'Non-CFOP solves: %d (excluded from every stage-based table; included in whole-solve tables). '
          'Bootstrap: %d resamples of solves, seed %d, 95%% percentile CI. LOW-N = group n<30.' % (N, N - ncf, NB, SEED))
MD.append('Move units: "raw" = quarter turns as reported by the cube (half turn = 2 raw); "turns" = acubemy turnCount (half turn = 1; app TPS = turns/totalTime).')
MD.append('Gap = ts[i]-ts[i-1] between consecutive raw quarter turns. Pause = gap > 500 ms unless stated. Stage k owns raw moves with stage.start < ts <= stage.end (ts 0 belongs to cross); stage-leading gap = gap before the first raw move of the stage (equals recognition).')
MD.append('Alignment of raw moves to reconstruction tokens (needed for solver-frame faces): solves fully aligned %d/%d; %d have raw moves left over after the last token or a token mismatch (unmapped raw moves are labelled unmapped); %d resyncs by timestamp.' % (N - align_bad, N, align_bad, align_resync))
MD[-1] += ' Overall median raw gap = %.0f ms (n=%d gaps).' % (MEDGAP, len(allg))

# ---------------- 1 gap distribution ----------------
pcts = [10, 25, 30, 50, 75, 80, 90, 95, 99]
rows = [[p, '%.0f' % np.percentile(allg, p)] for p in pcts]
OUTJ['1a_all_percentiles'] = {str(p): float(np.percentile(allg, p)) for p in range(10, 100)}
rows.append(['mean', '%.0f' % allg.mean()])
table('1a', 'Inter-move gap distribution, all raw moves, all 1000 solves',
      'percentile of all %d gaps; gap in ms (percentiles 20, 40, 60, 70 are in out/turning.json)' % len(allg), ['percentile', 'gap ms'], rows)

TH = [300, 500, 800, 1200]
cnt = {h: np.array([(g > h).sum() for g in GAPS], float) for h in TH}
dur = {h: np.array([g[g > h].sum() for g in GAPS], float) / 1000 for h in TH}
p500 = dur[500]
share = p500 / (T / 1000)
fast = T / 1000 - p500
burst = TURNS / fast
overall = TURNS / (T / 1000)
rawov = NRAW / (T / 1000)
rawburst = NRAW / fast
ratio = burst / overall
q_edges = np.percentile(T, [20, 40, 60, 80])
qi = np.searchsorted(q_edges, T, side='right')
Q = [np.flatnonzero(qi == k) for k in range(5)]
hdr = ['metric (median / mean per solve)'] + ['Q%d n=%d T %.2f-%.2f s' % (k + 1, len(Q[k]), T[Q[k]].min() / 1000, T[Q[k]].max() / 1000) for k in range(5)] + ['Spearman vs totalTime [95% CI]']
mets = [('turns (turnCount)', TURNS, 1), ('overall TPS (app, turns/s)', overall, 2), ('raw quarter turns', NRAW, 1)]
for h in TH:
    mets.append(('# gaps > %d ms' % h, cnt[h], 1))
    mets.append(('time in gaps > %d ms (s)' % h, dur[h], 2))
mets += [('pause share = time in gaps>500 / totalTime (%)', share * 100, 1),
         ('burst TPS = turns / (totalTime - gaps>500 time)', burst, 2),
         ('burst TPS / overall TPS', ratio, 3)]
rows = []
for name, arr, k in mets:
    rows.append([name] + [mm(arr[Q[j]], k) for j in range(5)] + [sp(arr, T)])
table('1b', 'Pause metrics by totalTime quintile (Q1 fastest), n=1000',
      'cells are median / mean of the per-solve metric; last column Spearman rho between the metric and totalTime over all 1000 solves with bootstrap CI',
      hdr, rows)
OUTJ['1b_raw'] = {m[0]: {'median': float(np.median(m[1])), 'mean': float(m[1].mean())} for m in mets}

# ---------------- 2 where pauses are ----------------
lead_sum = np.zeros((N, 7))
mid_sum = np.zeros((N, 7))
lead_cnt = np.zeros((N, 7))
mid_cnt = np.zeros((N, 7))
lead_all = np.zeros((N, 7))
for i in cfidx:
    s = S[i]
    g = np.r_[np.nan, np.diff(s['ts'])]
    stg = s['stg']
    for j in range(1, len(stg)):
        k = stg[j]
        lead = stg[j - 1] != k
        if lead:
            lead_all[i, k] += g[j]
        if g[j] > 500:
            if lead:
                lead_sum[i, k] += g[j]
                lead_cnt[i, k] += 1
            else:
                mid_sum[i, k] += g[j]
                mid_cnt[i, k] += 1
stime = np.array([[x['time'] for x in S[i]['st']] for i in cfidx], float) / 1000
rows = []
tot_pause = (lead_sum[cfidx].sum() + mid_sum[cfidx].sum())
for k in range(7):
    a = lead_sum[cfidx, k] / 1000
    b = mid_sum[cfidx, k] / 1000
    rows.append([STG[k], '%.2f' % stime[:, k].mean(), '%.2f / %.2f' % (np.median(a), a.mean()), '%.2f / %.2f' % (np.median(b), b.mean()),
                 '%.2f' % (lead_all[cfidx, k].mean() / 1000), '%.2f' % lead_cnt[cfidx, k].mean(), '%.2f' % mid_cnt[cfidx, k].mean(),
                 '%.0f%%' % (100 * (lead_cnt[cfidx, k] > 0).mean()), '%.0f%%' % (100 * (mid_cnt[cfidx, k] > 0).mean()),
                 '%.1f%%' % (100 * (lead_sum[cfidx, k].sum() + mid_sum[cfidx, k].sum()) / tot_pause)])
a = lead_sum[cfidx].sum(1) / 1000
b = mid_sum[cfidx].sum(1) / 1000
rows.append(['ALL', '%.2f' % stime.sum(1).mean(), '%.2f / %.2f' % (np.median(a), a.mean()), '%.2f / %.2f' % (np.median(b), b.mean()),
             '%.2f' % (lead_all[cfidx].sum(1).mean() / 1000), '%.2f' % lead_cnt[cfidx].sum(1).mean(), '%.2f' % mid_cnt[cfidx].sum(1).mean(),
             '%.0f%%' % (100 * (lead_cnt[cfidx].sum(1) > 0).mean()), '%.0f%%' % (100 * (mid_cnt[cfidx].sum(1) > 0).mean()), '100%'])
table('2', 'Pauses (gap > 500 ms) by stage and position, CFOP solves n=%d' % ncf,
      'mean stage time (s); seconds per solve in stage-leading pauses (median / mean, zeros included); seconds per solve in mid-stage pauses (median / mean); mean seconds of the stage-leading gap at any size; mean # leading pauses and # mid pauses per solve; % of solves with at least one; stage share of all pause time. Cross has no leading gap in the data (inspection is outside the recording).',
      ['stage', 'mean stage time', 'leading pause s med/mean', 'mid pause s med/mean', 'leading gap any size mean s', 'lead # /solve', 'mid # /solve', '% solves lead', '% solves mid', 'share of pause time'], rows)

# ---------------- 3 decomposition ----------------
pause = p500
P25, P10 = np.percentile(pause, 25), np.percentile(pause, 10)
TU25, TU10 = np.percentile(TURNS, 25), np.percentile(TURNS, 10)
B75, B90 = np.percentile(burst, 75), np.percentile(burst, 90)
Tsec = T / 1000


def scen(pz=None, tz=None, bz=None, frac=None):
    p = pause.copy()
    tu = TURNS.copy()
    b = burst.copy()
    if frac is not None:
        p = p * (1 - frac)
    if pz is not None:
        p = np.minimum(p, pz)
    if tz is not None:
        tu = np.minimum(tu, tz)
    if bz is not None:
        b = np.maximum(b, bz)
    return tu / b + p


scs = [('actual', Tsec)]
for f in (0.10, 0.25, 0.50, 1.0):
    scs.append(('pause time -%d%% (moves, burst TPS unchanged)' % (f * 100), scen(frac=f)))
scs += [('pause capped at own p25 (%.2f s) [own-best benchmark]' % P25, scen(pz=P25)),
        ('pause capped at own p10 (%.2f s) [own-best benchmark]' % P10, scen(pz=P10)),
        ('moves capped at own p25 (%.0f turns) [own-best benchmark]' % TU25, scen(tz=TU25)),
        ('moves capped at own p10 (%.0f turns) [own-best benchmark]' % TU10, scen(tz=TU10)),
        ('burst TPS floored at own p75 (%.2f) [own-best benchmark]' % B75, scen(bz=B75)),
        ('burst TPS floored at own p90 (%.2f) [own-best benchmark]' % B90, scen(bz=B90)),
        ('pause p25 + moves p25', scen(pz=P25, tz=TU25)),
        ('pause p10 + moves p10', scen(pz=P10, tz=TU10)),
        ('pause p25 + moves p25 + burst p75', scen(pz=P25, tz=TU25, bz=B75)),
        ('pause p10 + moves p10 + burst p90', scen(pz=P10, tz=TU10, bz=B90))]
rows = []
for name, arr in scs:
    d = Tsec - arr
    rows.append([name, '%.2f' % np.median(arr), '%.2f' % arr.mean(), fci(mean_ci(d)) if name != 'actual' else '-', '%.1f%%' % (100 * d.mean() / Tsec.mean())])
table('3a', 'Counterfactual totals using only the solver\'s own distribution, n=1000 (pause = time in gaps > 500 ms; total = turns / burst TPS + pause)',
      'median and mean counterfactual total (s); mean saving vs actual (s) with bootstrap CI; saving as %% of mean actual. Benchmarks p25/p10 are percentiles of this solver\'s own per-solve values (own-best benchmark, not a prediction). Solves already better than the benchmark are unchanged. Mean actual pause = %.2f s, mean fast time = %.2f s, mean turns = %.1f, median burst TPS = %.2f.' % (pause.mean(), fast.mean(), TURNS.mean(), np.median(burst)),
      ['scenario', 'median T\'', 'mean T\'', 'mean saving s [CI]', 'saving % of mean T'], rows)

cor = [('turns', TURNS), ('pause time s (>500)', pause), ('fast time s (T - pause)', fast), ('burst TPS', burst), ('pause share', share)]
note('Spearman of totalTime (n=1000): ' + '; '.join('%s %s' % (n_, sp(a, T)) for n_, a in cor) + '.')


def comp(ix):
    return np.array([Tsec[ix].mean(), pause[ix].mean(), fast[ix].mean(), TURNS[ix].mean()])


def split(c1, c5):
    dT = c5[0] - c1[0]
    dP = c5[1] - c1[1]
    dF = c5[2] - c1[2]
    dln_f = math.log(c5[2] / c1[2])
    dln_t = math.log(c5[3] / c1[3])
    mv = dF * dln_t / dln_f if dln_f != 0 else float('nan')
    rt = dF - mv
    return np.array([dT, dP, dF, mv, rt])


rng = np.random.default_rng(SEED + 77)
c1, c5 = comp(Q[0]), comp(Q[4])
pt = split(c1, c5)
bs = []
for _ in range(NB):
    i1 = rng.choice(Q[0], len(Q[0]))
    i5 = rng.choice(Q[4], len(Q[4]))
    bs.append(split(comp(i1), comp(i5)))
bs = np.array(bs)
names = ['totalTime', 'pause time (gaps > 500)', 'fast time (T - pause)', '  of which move count (log-share of fast time)', '  of which turn rate (log-share of fast time)']
m1 = [c1[0], c1[1], c1[2], c1[3], float('nan')]
m5 = [c5[0], c5[1], c5[2], c5[3], float('nan')]
rows = []
for k in range(5):
    lo, hi = np.percentile(bs[:, k], [2.5, 97.5])
    rows.append([names[k], '%.2f' % c1[k] if k < 3 else '', '%.2f' % c5[k] if k < 3 else '', '%.2f [%.2f, %.2f]' % (pt[k], lo, hi), '%.0f%%' % (100 * pt[k] / pt[0])])
rows.append(['mean turns (Q1 vs Q5)', '%.1f' % c1[3], '%.1f' % c5[3], '%.1f' % (c5[3] - c1[3]), ''])
table('3c', 'What separates the slowest quintile from the fastest (Q5 - Q1), n=%d vs %d' % (len(Q[0]), len(Q[4])),
      'Q1 mean, Q5 mean, difference with bootstrap CI (resampling within each quintile), difference as % of the totalTime difference. fast time = turns / burst TPS, so its difference is split into move-count and turn-rate parts by the log shares ln(turns5/turns1) and -ln(b5/b1).',
      ['component (s)', 'Q1 mean', 'Q5 mean', 'Q5-Q1 [CI]', '% of totalTime diff'], rows)

# ---------------- 4 fumbles ----------------
FUM = ['inverse pair X X\' <=1500 ms', 'same turn x3 in a row', 'same turn x4+ in a row']
fcount = np.zeros((N, 3))
fcost = np.zeros((N, 3))
fstage = np.zeros((7, 3))
fstage_cost = np.zeros((7, 3))
fface = collections.defaultdict(lambda: np.zeros(3))
fevents = []
tokface_by_raw = []
for s in S:
    f = ['unmapped'] * len(s['ts'])
    for t in s['toks']:
        if t.get('rot') or t['s'] is None:
            continue
        for j in range(t['s'], t['e'] + 1):
            f[j] = t['face'] if t['face'] in FACES else 'wide/slice'
    tokface_by_raw.append(f)
for i, s in enumerate(S):
    ts = s['ts']
    rw = s['raw']
    n = len(ts)
    evs = []
    j = 0
    while j < n - 1:
        if rw[j][0] == rw[j + 1][0] and rw[j] != rw[j + 1] and ts[j + 1] - ts[j] <= 1500:
            evs.append((0, j, j + 1))
            j += 2
        else:
            j += 1
    j = 0
    while j < n:
        k = j
        while k + 1 < n and rw[k + 1] == rw[j]:
            k += 1
        L = k - j + 1
        if L == 3:
            evs.append((1, j, k))
        elif L >= 4:
            evs.append((2, j, k))
        j = k + 1
    for ty, a, b in evs:
        after = ts[b + 1] - ts[b] if b + 1 < n else 0
        cost = (ts[b] - ts[a]) + after - MEDGAP
        fcount[i, ty] += 1
        fcost[i, ty] += cost
        face = tokface_by_raw[i][a]
        fface[face][ty] += 1
        if s['stg'] is not None:
            fstage[s['stg'][a], ty] += 1
            fstage_cost[s['stg'][a], ty] += cost
rows = []
for ty in range(3):
    c = fcount[:, ty]
    cs = fcost[:, ty] / 1000
    nev = int(c.sum())
    rows.append([FUM[ty], nev, '%.3f' % c.mean(), '%.1f%%' % (100 * (c > 0).mean()), '%.2f' % (fcost[:, ty].sum() / 1000 / max(nev, 1)), '%.3f / %.3f' % (np.median(cs), cs.mean()), sp(c, T)])
call = fcount.sum(1)
cost_all = fcost.sum(1) / 1000
rows.append(['any of the three', int(call.sum()), '%.3f' % call.mean(), '%.1f%%' % (100 * (call > 0).mean()), '%.2f' % (cost_all.sum() / max(call.sum(), 1)), '%.3f / %.3f' % (np.median(cost_all), cost_all.mean()), sp(call, T)])
table('4a', 'Fumbles in the raw stream, n=1000 solves',
      'total events; mean events per solve; %% of solves with at least one; mean cost per event (s) = first-to-last move duration + following gap - median gap (%.0f ms); cost per solve median / mean (s); Spearman of events per solve vs totalTime. Patterns can overlap (an X X\' X\' run is counted in both a and b).' % MEDGAP,
      ['pattern', 'events', 'mean/solve', '% solves', 'mean cost/event s', 'cost per solve med/mean s', 'Spearman events vs totalTime'], rows)
dts_inv = []
for s_ in S:
    for j in range(len(s_['ts']) - 1):
        if s_['raw'][j][0] == s_['raw'][j + 1][0] and s_['raw'][j] != s_['raw'][j + 1]:
            dts_inv.append(s_['ts'][j + 1] - s_['ts'][j])
dts_inv = np.array(dts_inv)
note('Gap between the two moves of every adjacent opposite-direction same-face pair in the raw stream (n=%d, any gap): percentiles 10/25/50/75/90 = %s ms; share <=300 ms = %.1f%%, 300-1500 ms = %.1f%%, >1500 ms = %.1f%%.' % (len(dts_inv), '/'.join('%.0f' % v for v in np.percentile(dts_inv, [10, 25, 50, 75, 90])), 100 * (dts_inv <= 300).mean(), 100 * ((dts_inv > 300) & (dts_inv <= 1500)).mean(), 100 * (dts_inv > 1500).mean()))
has = call > 0
dd = (mean_ci(T[has] / 1000) , )
bs1 = boot_idx(len(has))
Th = T / 1000
dm = []
rng = np.random.default_rng(SEED + 5)
a_, b_ = Th[has], Th[~has]
for _ in range(NB):
    dm.append(rng.choice(a_, len(a_)).mean() - rng.choice(b_, len(b_)).mean())
ptd = a_.mean() - b_.mean()
note('Solves with >=1 fumble: n=%d (median %.2f s, mean %.2f s); without: n=%d (median %.2f s, mean %.2f s); mean difference %.2f s [%.2f, %.2f]%s%s.' % (
    len(a_), np.median(a_), a_.mean(), len(b_), np.median(b_), b_.mean(), ptd, np.percentile(dm, 2.5), np.percentile(dm, 97.5), low(len(a_)), low(len(b_))))
rows = []
for k in range(7):
    nc = fstage[k].sum()
    rows.append([STG[k], int(fstage[k, 0]), int(fstage[k, 1]), int(fstage[k, 2]), '%.3f' % (nc / ncf), '%.3f' % (fstage_cost[k].sum() / 1000 / ncf)])
table('4b', 'Fumbles by stage of the first move of the pattern, CFOP n=%d' % ncf,
      'events per pattern type; total events per solve; summed time cost per solve (s)',
      ['stage', 'inverse pair', 'x3', 'x4+', 'events/solve', 'cost s/solve'], rows)
facetot = collections.Counter()
for s in S:
    for t in s['toks']:
        if not t.get('rot') and t['s'] is not None:
            facetot[t['face'] if t['face'] in FACES else 'wide/slice'] += 1
rows = []
for fc in list(FACES) + ['wide/slice']:
    v = fface.get(fc, np.zeros(3))
    nm = facetot.get(fc, 0)
    rows.append([fc, int(v[0]), int(v[1]), int(v[2]), int(v.sum()), nm if fc != 'unmapped' else '-', '%.2f' % (1000 * v.sum() / nm) if nm else '-'])
table('4c', 'Fumbles by face in the solver frame (face of the reconstruction token owning the first move)',
      'events per pattern; all events; reconstruction tokens of that face; events per 1000 tokens',
      ['face', 'inverse', 'x3', 'x4+', 'all', 'tokens', 'per 1000 tokens'], rows)

# ---------------- 5 per-move mechanics (CFOP) ----------------
mv_gap = collections.defaultdict(list)
mv_cnt = collections.defaultdict(lambda: np.zeros(N))
half_gap = collections.defaultdict(list)
rot_cnt = np.zeros((N, 3))
rot_mid = np.zeros((N, 3))
rot_events = []
for i in cfidx:
    s = S[i]
    ts = s['ts']
    toks = s['toks']
    stg = s['stg']
    nr = [t for t in toks if not t.get('rot') and t['s'] is not None]
    for k, t in enumerate(nr):
        mv_cnt[t['norm']][i] += 1
        sidx = t['s']
        lead = sidx == 0 or stg[sidx - 1] != stg[sidx]
        if k >= 2 and sidx >= 1:
            pidx = nr[k - 1]['s']
            if pidx >= 1 and ts[pidx] - ts[pidx - 1] < 300 and not lead:
                mv_gap[t['norm']].append(ts[sidx] - ts[sidx - 1])
        if t['face'] in FACES and t['norm'][-1] == '2' and t['e'] == t['s'] + 1:
            half_gap[t['face']].append(ts[t['e']] - ts[t['s']])
    ax = 'xyz'
    for t in toks:
        if t.get('rot'):
            rot_cnt[i, ax.index(t['tok'][0])] += 1
for i in range(N):
    for t in S[i]['toks']:
        pass
fluent_all = np.concatenate([np.array(v) for v in mv_gap.values()])
keys = sorted(mv_cnt.keys(), key=lambda k: -mv_cnt[k][cfidx].sum())
rows = []
for k in keys:
    tot = int(mv_cnt[k][cfidx].sum())
    if tot < 30:
        continue
    g = np.array(mv_gap.get(k, []))
    rows.append([k, tot, '%.2f' % mv_cnt[k][cfidx].mean(), len(g), '%.0f' % np.median(g) if len(g) else '-', '%.0f' % g.mean() if len(g) else '-', '%.0f' % np.percentile(g, 90) if len(g) else '-', low(len(g)).strip()])
rows.append(['ALL moves in fluent runs', int(sum(mv_cnt[k][cfidx].sum() for k in keys)), '', len(fluent_all), '%.0f' % np.median(fluent_all), '%.0f' % fluent_all.mean(), '%.0f' % np.percentile(fluent_all, 90), ''])
table('5a', 'Gap before each move type (solver frame, reconstruction tokens), CFOP n=%d' % ncf,
      'move token (half turns merged: X2 and X2\' are one row; prime = counter-clockwise); total occurrences; mean per solve; n of occurrences inside a fluent run = the gap before the previous token < 300 ms, and the move is not stage-leading; median / mean / p90 of the gap before the move (ms, measured from the previous raw move to this token\'s first raw quarter turn); LOW-N if n<30. Types with <30 occurrences omitted.',
      ['move', 'total', 'per solve', 'n fluent', 'median gap ms', 'mean gap ms', 'p90 gap ms', 'flag'], rows)
rows = []
for fc in FACES:
    g = np.array(half_gap.get(fc, []))
    rows.append([fc + '2', len(g), '%.0f' % np.median(g) if len(g) else '-', '%.0f' % g.mean() if len(g) else '-', '%.0f' % np.percentile(g, 90) if len(g) else '-', low(len(g)).strip()])
ga = np.concatenate([np.array(v) for v in half_gap.values()])
rows.append(['all half turns', len(ga), '%.0f' % np.median(ga), '%.0f' % ga.mean(), '%.0f' % np.percentile(ga, 90), ''])
table('5b', 'Half turns: gap between the two raw quarter turns, solver-frame face, CFOP n=%d' % ncf,
      'tokens X2 mapped to exactly two raw quarter turns; n; median / mean / p90 ms',
      ['face', 'n', 'median ms', 'mean ms', 'p90 ms', 'flag'], rows)


def per_solve(keys_):
    v = np.zeros(N)
    for k in keys_:
        if k in mv_cnt:
            v += mv_cnt[k]
    return v[cfidx]


groups = [('B / B\'', [k for k in mv_cnt if k in ('B', "B'")]), ('F / F\'', [k for k in mv_cnt if k in ('F', "F'")]),
          ('D / D\'', [k for k in mv_cnt if k in ('D', "D'")]), ('L / L\'', [k for k in mv_cnt if k in ('L', "L'")]),
          ('wide r l u d f b (any direction)', [k for k in mv_cnt if k[0] in 'rludfb' and k[0] not in 'D']),
          ('slice M S E', [k for k in mv_cnt if k[0] in 'MSE'])]
Tc = T[cfidx]
rows = []
for name, ks in groups:
    v = per_solve(ks)
    rows.append([name, '%.2f / %.2f' % (np.median(v), v.mean()), '%.1f%%' % (100 * (v > 0).mean()), sp(v, Tc)])
rows_c = rows
allrot = rot_cnt[cfidx].sum(1)
rows = []
for a_i, a in enumerate('xyz'):
    v = rot_cnt[cfidx, a_i]
    rows.append(['all %s tokens' % a, '%.2f / %.2f' % (np.median(v), v.mean()), '%.1f%%' % (100 * (v > 0).mean()), sp(v, Tc)])
rows.append(['all rotation tokens', '%.2f / %.2f' % (np.median(allrot), allrot.mean()), '%.1f%%' % (100 * (allrot > 0).mean()), sp(allrot, Tc)])

# rotation events
ev_sum = collections.defaultdict(lambda: np.zeros(N))
ev_cnt = collections.defaultdict(lambda: np.zeros(N))
ev_gaps = collections.defaultdict(list)
mid_events = np.zeros(N)
rot_ev_times = [[] for _ in range(N)]
for i in cfidx:
    s = S[i]
    ts = s['ts']
    toks = s['toks']
    stg = s['stg']
    j = 0
    L = len(toks)
    prev = None
    while j < L:
        t = toks[j]
        if not t.get('rot'):
            if t['s'] is not None:
                prev = t
            j += 1
            continue
        k = j
        while k < L and toks[k].get('rot'):
            k += 1
        axes = set(x['tok'][0] for x in toks[j:k])
        nxt = toks[k] if k < L and not toks[k].get('rot') else None
        if prev is not None and nxt is not None and nxt['s'] is not None:
            g = ts[nxt['s']] - ts[prev['e']]
            lab = list(axes)[0] if len(axes) == 1 else 'mixed'
            same = stg[nxt['s']] == stg[prev['e']]
            for key in (lab, 'ALL', lab + ('|same-stage' if same else '|cross-stage'), 'ALL|' + ('same-stage' if same else 'cross-stage')):
                ev_sum[key][i] += g
                ev_cnt[key][i] += 1
                ev_gaps[key].append(g)
            mid_events[i] += len(toks[j:k])
            rot_ev_times[i].append(ts[nxt['s']])
        j = k
rot_mid_all = mid_events[cfidx]
rows.append(['mid-solve rotation tokens (between two moves)', '%.2f / %.2f' % (np.median(rot_mid_all), rot_mid_all.mean()), '%.1f%%' % (100 * (rot_mid_all > 0).mean()), sp(rot_mid_all, Tc)])
table('5d', 'Move-type frequency and cube rotation tokens per solve, CFOP n=%d' % ncf,
      'median / mean count per solve; % solves with >=1; Spearman vs totalTime. Rotations are inferred by acubemy (they share a timestamp with a neighbour), so a rotation at the start (before the first turn) is counted in "all" but not in "mid-solve".',
      ['count', 'median / mean per solve', '% solves >=1', 'Spearman vs totalTime'], rows_c + rows)


def boot_ratio(sm, ct):
    idx = boot_idx(N)
    smb = sm[idx].sum(1)
    ctb = ct[idx].sum(1)
    ok = ctb > 0
    v = smb[ok] / ctb[ok]
    return float(sm.sum() / ct.sum()), float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))


rows = []
for key in ['x', 'y', 'z', 'mixed', 'ALL', 'x|same-stage', 'y|same-stage', 'z|same-stage', 'mixed|same-stage', 'ALL|same-stage', 'ALL|cross-stage']:
    if key not in ev_gaps:
        continue
    g = np.array(ev_gaps[key])
    m, lo, hi = boot_ratio(ev_sum[key], ev_cnt[key])
    rows.append([key, len(g), '%.0f' % np.median(g), '%.0f' % g.mean(), '%+.0f [%+.0f, %+.0f]' % (m - MEDGAP, lo - MEDGAP, hi - MEDGAP), '%+.0f' % (np.median(g) - MEDGAP), low(len(g)).strip()])
table('5e', 'Time cost of a rotation: gap between the move before and the move after a run of rotation tokens, CFOP n=%d' % ncf,
      'axis (mixed = run with several axes; same-stage = both neighbours in the same stage, cross-stage = rotation straddles a stage boundary); events; median / mean gap ms; mean gap minus the overall median raw gap (%.0f ms) with solve-cluster bootstrap CI; median gap minus median gap; flag' % MEDGAP,
      ['axis', 'events', 'median gap ms', 'mean gap ms', 'mean cost ms [CI]', 'median cost ms', 'flag'], rows)

# ---------------- 6 n-grams ----------------
for nlen, sid in ((3, '6a'), (4, '6b')):
    D = collections.defaultdict(list)
    solves_by = collections.defaultdict(set)
    for i in cfidx:
        s = S[i]
        ts = s['ts']
        stg = s['stg']
        run = []
        runs = []
        for t in s['toks']:
            if t.get('rot') or t['s'] is None:
                if run:
                    runs.append(run)
                run = []
                continue
            if run and stg[t['s']] != stg[run[-1]['s']]:
                runs.append(run)
                run = []
            run.append(t)
        if run:
            runs.append(run)
        for r_ in runs:
            for a in range(len(r_) - nlen + 1):
                w = r_[a:a + nlen]
                key = ' '.join(x['norm'] for x in w)
                d_ = ts[w[-1]['e']] - ts[w[0]['s']]
                pz = any(ts[w[b]['s']] - ts[w[b - 1]['e']] > 500 for b in range(1, nlen))
                D[key].append((d_, pz))
                solves_by[key].add(i)
    alld = np.array([x[0] for v in D.values() for x in v])
    med_all = np.median(alld)
    top = sorted(D.items(), key=lambda kv: -len(kv[1]))[:30]
    rows = []
    for key, v in top:
        dv = np.array([x[0] for x in v])
        rows.append([key, len(v), len(solves_by[key]), '%.0f' % np.median(dv), '%.0f' % np.percentile(dv, 90), '%.0f%%' % (100 * np.mean([x[1] for x in v])), '%.2f' % (np.median(dv) / med_all), low(len(v)).strip()])
    table(sid, 'Top 30 %d-move sequences in the solver frame, CFOP n=%d' % (nlen, ncf),
          'sequence (contiguous non-rotation tokens within one stage, X2/X2\' merged); occurrences; distinct solves; duration median / p90 ms from the first raw move of the first token to the last raw move of the last token (%d-token windows overlap, so one longer sequence feeds several windows); %% of occurrences containing an internal gap > 500 ms; median duration relative to the median of all %d-windows (%.0f ms, n=%d)' % (nlen, nlen, med_all, len(alld)),
          ['sequence', 'count', 'solves', 'median ms', 'p90 ms', '% with gap>500', 'rel median', 'flag'], rows)

# ---------------- 7 gyro ----------------
G = []
first_q = []
cover = []
for i, s in enumerate(S):
    g = s['d']['gyroData']
    t = np.array([x['t'] for x in g], float)
    q = np.array([[x['q'][k] for k in 'wxyz'] for x in g], float)
    o = np.argsort(t, kind='mergesort')
    t, q = t[o], q[o]
    G.append((t, q))
nsamp = np.array([len(g[0]) for g in G], float)
rate = np.array([(len(g[0]) - 1) / (g[0][-1] - g[0][0]) * 1000 for g in G])
tfirst = np.array([g[0][0] for g in G])
tlast = np.array([g[0][-1] for g in G])
tail = tlast - T
dups = np.array([(np.diff(g[0]) == 0).sum() for g in G])
maxdt = np.array([np.diff(g[0]).max() for g in G])
covg = np.array([(min(g[0][-1], T[i]) - max(g[0][0], 0)) / T[i] for i, g in enumerate(G)])
alldt = np.concatenate([np.diff(g[0]) for g in G])
rows = [
    ['samples per solve (min / p5 / median / p95 / max)', ' / '.join('%.0f' % v for v in np.percentile(nsamp, [0, 5, 50, 95, 100]))],
    ['solves at the 410-sample cap', int((nsamp >= 410).sum())],
    ['sample rate Hz (min / median / max)', ' / '.join('%.1f' % v for v in np.percentile(rate, [0, 50, 100]))],
    ['sample interval ms (p1 / p10 / p50 / p90 / p99 / max)', ' / '.join('%.0f' % v for v in np.percentile(alldt, [1, 10, 50, 90, 99, 100]))],
    ['solves with duplicate timestamps (n; total duplicates)', '%d; %d' % ((dups > 0).sum(), dups.sum())],
    ['first sample t ms (min / median / max)', ' / '.join('%.0f' % v for v in np.percentile(tfirst, [0, 50, 100]))],
    ['last sample t minus totalTime ms (min / median / max)', ' / '.join('%.0f' % v for v in np.percentile(tail, [0, 50, 100]))],
    ['coverage of [0, totalTime] by [first, last] sample (min / median)', '%.3f / %.3f' % (covg.min(), np.median(covg))],
]
table('7a', 'Gyro sampling and coverage, n=1000',
      'statistic over solves; t in ms from solve start as stored',
      ['statistic', 'value'], rows)

ang_tot = np.zeros(N)
ang_tot_tail = np.zeros(N)
ang_stage = np.zeros((N, 7))
big = np.zeros(N)
big_stage = np.zeros((N, 7))
samp_ang = []
big_times = [[] for _ in range(N)]
for i, (t, q) in enumerate(G):
    a = qangle(q[1:], q[:-1])
    tm = (t[1:] + t[:-1]) / 2
    samp_ang.append(a)
    ang_tot_tail[i] = a.sum()
    inside = tm <= T[i]
    ang_tot[i] = a[inside].sum()
    if S[i]['ends']:
        ends = S[i]['ends']
        sk = np.minimum(np.searchsorted(ends, tm, side='left'), 6)
        for k in range(7):
            ang_stage[i, k] = a[inside & (sk == k)].sum()
    j = 0
    n = len(t)
    while j < n - 1:
        hit = None
        k = j + 1
        while k < n and t[k] - t[j] <= 400:
            if qangle(q[j], q[k]) > 60:
                hit = k
                break
            k += 1
        if hit is not None:
            big[i] += 1
            big_times[i].append((t[j] + t[hit]) / 2)
            if S[i]['ends']:
                kk = min(bisect.bisect_left(S[i]['ends'], (t[j] + t[hit]) / 2), 6)
                if (t[j] + t[hit]) / 2 <= T[i]:
                    big_stage[i, kk] += 1
            j = hit
        else:
            j += 1
sa = np.concatenate(samp_ang)
note('Per-sample angular step (deg between consecutive samples, angle = 2*acos|q1.q2|): p10 %.1f, median %.1f, p90 %.1f, p99 %.1f, n=%d. Because the cube is turned by hand the whole time, this includes hand shake and face-turn vibration; travel is an upper bound on deliberate reorientation.' % (tuple(np.percentile(sa, [10, 50, 90, 99])) + (len(sa),)))
trav_rate = ang_tot / (T / 1000)
rows = [
    ['total travel in [0, totalTime] (deg)', '%.0f / %.0f' % (np.median(ang_tot), ang_tot.mean()), sp(ang_tot, T), sp(ang_tot[cfidx], rot_mid_all)],
    ['total travel incl. tail after last move (deg)', '%.0f / %.0f' % (np.median(ang_tot_tail), ang_tot_tail.mean()), sp(ang_tot_tail, T), '-'],
    ['travel rate (deg/s)', '%.0f / %.0f' % (np.median(trav_rate), trav_rate.mean()), sp(trav_rate, T), sp(trav_rate[cfidx], rot_mid_all)],
    ['large reorientations (>60 deg within 400 ms) per solve', '%.2f / %.2f' % (np.median(big), big.mean()), sp(big, T), sp(big[cfidx], rot_mid_all)],
]
table('7b', 'Gyro angular travel and large reorientations, n=1000 (rotation correlation: CFOP n=%d vs mid-solve rotation tokens)' % ncf,
      'median / mean per solve; Spearman vs totalTime; Spearman vs mid-solve rotation-token count',
      ['metric', 'median / mean', 'Spearman vs totalTime', 'Spearman vs rotation tokens'], rows)
rows = []
for k in range(7):
    v = ang_stage[cfidx, k]
    okk = stime[:, k] > 0
    r_ = v[okk] / stime[okk, k]
    b = big_stage[cfidx, k]
    rows.append([STG[k], '%.0f / %.0f' % (np.median(v), v.mean()), '%.0f / %.0f' % (np.median(r_), r_.mean()), '%.3f / %.3f' % (np.median(b), b.mean()), '%.1f%%' % (100 * (b > 0).mean())])
table('7c', 'Gyro travel and large reorientations by stage, CFOP n=%d' % ncf,
      'travel deg per solve median / mean; travel deg per second of stage median / mean; large reorientations per solve median / mean; % solves with >=1. Samples assigned to stages by midpoint time using the move timeline (stage ends); tail after the last move excluded.',
      ['stage', 'travel deg', 'deg/s', 'big reorient /solve', '% solves >=1'], rows)

tol = 500
mt = 0
mr = 0
tot_big = 0
tot_rot = 0
for i in cfidx:
    rt = rot_ev_times[i]
    bt = big_times[i]
    tot_big += len(bt)
    tot_rot += len(rt)
    for b in bt:
        if any(abs(b - r_) <= tol for r_ in rt):
            mt += 1
    for r_ in rt:
        if any(abs(b - r_) <= tol for b in bt):
            mr += 1
shuf = {}
for sh in (-4000, -3000, -2000, 2000, 3000, 4000):
    m1 = m2 = n1 = n2 = 0
    for i in cfidx:
        rt = [(r_ + sh) % T[i] for r_ in rot_ev_times[i]]
        bt = big_times[i]
        n1 += len(bt)
        n2 += len(rt)
        m1 += sum(1 for b in bt if any(abs(b - r_) <= tol for r_ in rt))
        m2 += sum(1 for r_ in rt if any(abs(b - r_) <= tol for b in bt))
    shuf[sh] = (100 * m1 / max(n1, 1), 100 * m2 / max(n2, 1))
bins = np.arange(-1000, 1001, 250)
acc = np.zeros(len(bins) - 1)
cn = np.zeros(len(bins) - 1)
allspeed = []
for i in cfidx:
    t, q = G[i]
    a = qangle(q[1:], q[:-1])
    dt = np.diff(t)
    ok = dt > 0
    sp_ = a[ok] / dt[ok] * 1000
    tm = ((t[1:] + t[:-1]) / 2)[ok]
    allspeed.append(sp_)
    for rt in rot_ev_times[i]:
        off = tm - rt
        for b in range(len(bins) - 1):
            m = (off >= bins[b]) & (off < bins[b + 1])
            acc[b] += sp_[m].sum()
            cn[b] += m.sum()
base = np.concatenate(allspeed).mean()
rows = [['%+d..%+d' % (bins[b], bins[b + 1]), int(cn[b]), '%.0f' % (acc[b] / cn[b]), '%.2f' % (acc[b] / cn[b] / base)] for b in range(len(bins) - 1)]
table('7d', 'Gyro time-alignment check: angular speed relative to mid-solve rotation-token timestamps, CFOP n=%d (%d rotation events)' % (ncf, tot_rot),
      'gyro sample time minus rotation timestamp (ms); samples; mean angular speed deg/s; ratio to the overall mean speed (%.0f deg/s)' % base,
      ['offset bin ms', 'samples', 'mean deg/s', 'ratio to overall'], rows)
note('Large reorientations within +-%d ms of a mid-solve rotation event: %d of %d (%.1f%%); rotation events with a large reorientation within +-%d ms: %d of %d (%.1f%%). Chance baseline (rotation times shifted by +-2000/3000/4000 ms, wrapped within the solve): reorientations matched %.1f%% (range %.1f-%.1f), rotation events matched %.1f%% (range %.1f-%.1f).' % (tol, mt, tot_big, 100 * mt / max(tot_big, 1), tol, mr, tot_rot, 100 * mr / max(tot_rot, 1), np.mean([v[0] for v in shuf.values()]), min(v[0] for v in shuf.values()), max(v[0] for v in shuf.values()), np.mean([v[1] for v in shuf.values()]), min(v[1] for v in shuf.values()), max(v[1] for v in shuf.values())))

q0 = np.array([g[1][0] for g in G])
M_ = (q0[:, :, None] * q0[:, None, :]).sum(0)
w_, v_ = np.linalg.eigh(M_)
qm = v_[:, -1]
a0 = 2 * np.degrees(np.arccos(np.abs(q0 @ qm).clip(0, 1)))
a1 = a0[:500]
a2 = a0[500:]
rows = [['all 1000', '%.0f / %.0f / %.0f / %.0f' % tuple(np.percentile(a0, [50, 75, 90, 100])), '%.1f%%' % (100 * (a0 < 20).mean()), '%.1f%%' % (100 * (a0 < 45).mean())],
        ['oldest 500', '%.0f / %.0f / %.0f / %.0f' % tuple(np.percentile(a1, [50, 75, 90, 100])), '%.1f%%' % (100 * (a1 < 20).mean()), '%.1f%%' % (100 * (a1 < 45).mean())],
        ['newest 500', '%.0f / %.0f / %.0f / %.0f' % tuple(np.percentile(a2, [50, 75, 90, 100])), '%.1f%%' % (100 * (a2 < 20).mean()), '%.1f%%' % (100 * (a2 < 45).mean())]]
table('7e', 'Orientation of the first gyro sample relative to the mean start orientation, n=1000',
      'angle (deg) between each solve\'s first quaternion and the principal-axis mean of all first quaternions: p50 / p75 / p90 / max; % within 20 deg; % within 45 deg. The gyro frame can be re-zeroed by the app, so this measures consistency in the stored frame, not in the room.',
      ['group', 'angle deg p50/p75/p90/max', '<20 deg', '<45 deg'], rows)

# ---------------- 8 fluency ----------------
def fluency(s, th=400):
    ts = s['ts']
    if len(ts) < 2:
        return 100
    p = ts[-1] - ts[0]
    if p <= 0:
        return 100
    r = np.diff(ts)
    r = r[r > th].sum()
    return 100 - math.floor(r / p * 100 + 0.5)


fl = np.array([fluency(s) for s in S])
flapp = np.array([s['fl'] for s in S])
flold = [S[i]['d']['fluencyPercent'] for i in range(N)]
mism = int((fl != flapp).sum())
mism_d = int((np.array(flold) != flapp).sum())
share400 = np.array([g[g > 400].sum() for g in GAPS]) / T
rows = [
    ['formula recomputed from rawSolutionSequence == list.fluencyPercent', '%d / %d match (%d mismatches)' % (N - mism, N, mism)],
    ['list.fluencyPercent == detail.fluencyPercent', '%d / %d' % (N - mism_d, N)],
    ['fluencyPercent median / mean', '%.1f / %.2f' % (np.median(flapp), flapp.mean())],
    ['Spearman fluency vs share of time in gaps > 400 ms', sp(flapp, share400)],
    ['Spearman fluency vs pause share (gaps > 500 ms)', sp(flapp, share)],
    ['Spearman fluency vs app TPS', sp(flapp, overall)],
    ['Spearman fluency vs totalTime', sp(flapp, T)],
    ['Spearman fluency vs burst TPS', sp(flapp, burst)],
]
table('8a', 'fluencyPercent verification, n=1000',
      'check; result. Bundle code (chunk 7769, module 85350): extractFluencyPercent=function(e,s){let U=arguments.length>2&&void 0!==arguments[2]?arguments[2]:R.EXECUTION_GAP_THRESHOLD_MS,t=e.moves;if(t.length<2||s<=0)return 100;let n=t.findIndex(e=>!e.sliceTurn.isCubeRotation());if(-1===n)return 100;let M=t[n].timeStamp,p=t[t.length-1].timeStamp-M;if(p<=0)return 100;let r=0;for(let e=n;e<t.length-1;e++){let s=t[e+1].timeStamp-t[e].timeStamp;s>U&&(r+=s)}return 100-Math.round(r/p*100)} with EXECUTION_GAP_THRESHOLD_MS=400 and the first argument the raw (cube-reported) sequence. Python port: 100 - floor(sum(gaps>400 ms)/(last ts - first ts)*100 + 0.5). UI tooltip: "What proportion of your solve you have been turning instead of pausing".',
      ['check', 'result'], rows)

# ---------------- tpsInsights ----------------
ins = json.load(open(os.path.join(lib.RAW, 'stats-tpsInsights-859c481a.json')))['json']
sv = ins['solves']
st_t = np.array([x['stepTimes'] for x in sv], float)
tt = np.array([x['totalTime'] for x in sv], float)
rec_ = np.array([x['stepRecognition'] for x in sv], float)
trn = np.array([x['stepTurns'] for x in sv], float)
by_tt = collections.defaultdict(list)
for i, s in enumerate(S):
    by_tt[s['T']].append(i)
mt_ = sum(1 for x in sv if x['totalTime'] in by_tt)
eq_all = eq_nr = eq_raw = 0
for x in sv:
    for i in by_tt.get(x['totalTime'], []):
        d = S[i]['d']
        a = [m['timeStamp'] for m in d['solutionSequence']]
        b = [m['timeStamp'] for m in d['solutionSequence'] if m['sliceTurn'][0] not in 'xyz']
        c = [m['timeStamp'] for m in d['rawSolutionSequence']]
        if a == x['timestamps']:
            eq_all += 1
            break
        elif b == x['timestamps']:
            eq_nr += 1
            break
        elif c == x['timestamps']:
            eq_raw += 1
            break
AS = ins['averageSplits']
rows = []
for a in AS:
    rows.append([a['name'], a['time'], '%.2f' % a['percentage'], a['turns'], '%.3f' % a['tps'], a['recognition'], a['execution']])
    for b in a.get('subSteps', []):
        rows.append(['  ' + b['name'], b['time'], '%.2f' % b['percentage'], b['turns'], '%.3f' % b['tps'], b['recognition'], b['execution']])
table('8b', 'tpsInsights Default Session (859c481a) averageSplits, as returned',
      'step; mean time ms; percentage of mean total; mean turns; tps; mean recognition ms; mean execution ms',
      ['step', 'time ms', '%', 'turns', 'tps', 'recog ms', 'exec ms'], rows)
cum = np.cumsum([a['time'] for a in AS]) / sum(a['time'] for a in AS)
note('tpsInsights structure: top-level {json}; json keys = method ("%s"), stepDefinitions[4] (name,label,color for cross,f2l,oll,pll), solves[%d] (newest %d solves of the session; keys timestamps[], totalTime, stepTimes[4], stepTurns[4], stepRecognition[4], slotTimes[4], slotTurns[4], slotRecognition[4]), stageBoundaries[3] = %s, averageSplits[4] (above; f2l carries subSteps slot1..slot4), averageTotalTime = %d.' % (ins['method'], len(sv), len(sv), [round(x, 4) for x in ins['stageBoundaries']], ins['averageTotalTime']))
note('Checks: mean(totalTime) over solves[] = %.0f vs averageTotalTime %d; mean stepTimes [cross,f2l,oll,pll] = %s equals averageSplits times; mean of per-solve cumulative step fractions = %s vs stageBoundaries %s (ratio-of-means cumulative = %s); mean stepTurns = %s; solves matched to our data by totalTime: %d of %d; timestamps equal solutionSequence timestamps incl. rotations: %d, non-rotation tokens only: %d, raw sequence: %d. No per-gap or per-percent TPS aggregate is in the file: the page itself derives median TPS per percent-done bucket from solves[].timestamps with TPS = min(1000/gap, 20) per consecutive timestamp pair.' % (
    tt.mean(), ins['averageTotalTime'], [round(float(v)) for v in st_t.mean(0)],
    [round(float(v), 4) for v in np.cumsum(st_t / tt[:, None], 1).mean(0)[:3]], [round(x, 4) for x in ins['stageBoundaries']], [round(float(x), 4) for x in cum[:3]],
    [round(float(v), 1) for v in trn.mean(0)], mt_, len(sv), eq_all, eq_nr, eq_raw))

# ---------------- 9 turn-rate ceiling ----------------
W = 8
ceil = np.full(N, np.nan)
for i, s in enumerate(S):
    ts = s['ts']
    if len(ts) > W:
        d = ts[W:] - ts[:-W]
        d = d[d > 0]
        ceil[i] = W * 1000 / d.min()
okc = ~np.isnan(ceil)
cc = ceil[okc]
dd = cc - rawburst[okc]
dd2 = cc - rawov[okc]
rows = [['fastest 8-move window TPS (raw)', len(cc), '%.2f' % np.median(cc), '%.2f' % cc.mean(), ' / '.join('%.2f' % v for v in np.percentile(cc, [10, 25, 75, 90])), sp(cc, T[okc])],
        ['overall raw TPS (raw quarter turns / totalTime)', len(cc), '%.2f' % np.median(rawov[okc]), '%.2f' % rawov[okc].mean(), ' / '.join('%.2f' % v for v in np.percentile(rawov[okc], [10, 25, 75, 90])), sp(rawov[okc], T[okc])],
        ['burst raw TPS (raw / time excluding gaps>500)', len(cc), '%.2f' % np.median(rawburst[okc]), '%.2f' % rawburst[okc].mean(), ' / '.join('%.2f' % v for v in np.percentile(rawburst[okc], [10, 25, 75, 90])), sp(rawburst[okc], T[okc])],
        ['app TPS (turns / totalTime)', len(cc), '%.2f' % np.median(overall[okc]), '%.2f' % overall[okc].mean(), ' / '.join('%.2f' % v for v in np.percentile(overall[okc], [10, 25, 75, 90])), sp(overall[okc], T[okc])],
        ['burst TPS (turns)', len(cc), '%.2f' % np.median(burst[okc]), '%.2f' % burst[okc].mean(), ' / '.join('%.2f' % v for v in np.percentile(burst[okc], [10, 25, 75, 90])), sp(burst[okc], T[okc])]]
table('9a', 'Demonstrated hand speed: fastest 8-move window per solve, n=%d' % len(cc),
      'window = 8 consecutive raw quarter-turn gaps (TPS = 8000 / (ts[i+8]-ts[i]) ms, includes the gap before the first move); median; mean; p10 / p25 / p75 / p90; Spearman vs totalTime',
      ['metric', 'n', 'median', 'mean', 'p10/p25/p75/p90', 'Spearman vs totalTime'], rows)
rows = [['ceiling - burst raw TPS', fci(mean_ci(dd))], ['ceiling - overall raw TPS', fci(mean_ci(dd2))], ['ceiling / overall raw TPS (median of ratios)', '%.2f' % np.median(cc / rawov[okc])], ['ceiling / burst raw TPS (median of ratios)', '%.2f' % np.median(cc / rawburst[okc])]]
note('Ceiling vs others, paired per solve (n=%d): ceiling minus burst raw TPS = %s; ceiling minus overall raw TPS = %s; median ratio ceiling/overall raw TPS = %.2f; ceiling/burst raw TPS = %.2f.' % (len(cc), fci(mean_ci(dd)), fci(mean_ci(dd2)), np.median(cc / rawov[okc]), np.median(cc / rawburst[okc])))
OUTJ['9b'] = {rows_[0]: rows_[1] for rows_ in rows}

# ---------------- data quality ----------------
dq = [
    ['solves with raw first timestamp != 0', sum(1 for s in S if s['ts'][0] != 0)],
    ['solves where raw last ts != totalTime', sum(1 for s in S if s['ts'][-1] != s['T'])],
    ['solves where solutionSequence last ts != totalTime', sum(1 for s in S if s['d']['solutionSequence'][-1]['timeStamp'] != s['T'])],
    ['solves whose raw count != turnCount (half turns merge two raw into one turn)', int((NRAW != TURNS).sum())],
    ['solves with duplicate raw timestamps', sum(1 for s in S if len(set(s['ts'])) != len(s['ts']))],
    ['gaps of 0 ms between raw moves', int((allg == 0).sum())],
    ['raw/token alignment not exact', align_bad],
    ['solves with a gap > 5 s', int(sum(1 for g in GAPS if g.max() > 5000))],
    ['max gap ms', int(allg.max())],
    ['non-CFOP solves excluded from stage tables', N - ncf],
]
note('Data-quality counts: ' + '; '.join('%s = %s' % (a_, b_) for a_, b_ in dq) + '.')
OUTJ['Q'] = {a_: b_ for a_, b_ in dq}

os.makedirs(lib.OUT, exist_ok=True)
with open(os.path.join(lib.OUT, 'turning.md'), 'w') as f:
    f.write('\n'.join(MD) + '\n')


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, (np.integer,)):
        return int(o)
    return o


per = {'totalTime': T.tolist(), 'turns': TURNS.tolist(), 'pause500_s': pause.tolist(), 'burst_tps': burst.tolist(),
       'n_gt500': cnt[500].tolist(), 'fumbles': call.tolist(), 'gyro_travel_deg': ang_tot.tolist(), 'big_reorient': big.tolist()}
OUTJ['per_solve'] = per
OUTJ['params'] = {'seed': SEED, 'bootstrap': NB, 'median_gap_ms': MEDGAP, 'own_benchmarks': {'pause_p25_s': P25, 'pause_p10_s': P10, 'turns_p25': TU25, 'turns_p10': TU10, 'burst_p75': B75, 'burst_p90': B90}}
json.dump(clean(OUTJ), open(os.path.join(lib.OUT, 'turning.json'), 'w'))
print('written', len(MD), 'md lines')
