import json
import os
import re
import sys
from collections import Counter, defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import OUT, load, stages  # noqa: E402
import cubesim as cs  # noqa: E402

B = 2000
SEED = 20261120
THR = (400, 700, 1000)
LOWN = 30
SLOTS = ['FR', 'FL', 'BL', 'BR']
ROT_RE = re.compile(r'^[xyz]')
TOK_RE = re.compile(r"^([A-Za-z])(\d?)('?)$")

CASES = {c['caseIndex']: c for c in json.load(open(os.path.join(HERE, 'f2l_cases.json')))}
rng = np.random.default_rng(SEED)
J = {}
MD = []


def s2(ms):
    return '' if ms is None or (isinstance(ms, float) and np.isnan(ms)) else '%.2f' % (ms / 1000.0)


def f2(v):
    return '' if v is None or (isinstance(v, float) and np.isnan(v)) else '%.2f' % v


def f3(v):
    return '' if v is None or (isinstance(v, float) and np.isnan(v)) else '%.3f' % v


def nflag(n):
    return '%d%s' % (n, ' LOW-N' if n < LOWN else '')


def med(a):
    return float(np.median(a)) if len(a) else float('nan')


def mean(a):
    return float(np.mean(a)) if len(a) else float('nan')


def rank(x):
    x = np.asarray(x, dtype=float)
    u, inv, cnt = np.unique(x, return_inverse=True, return_counts=True)
    cs_ = np.cumsum(cnt)
    return (cs_ - (cnt - 1) / 2.0)[inv]


def spearman(x, y):
    if len(x) < 3:
        return float('nan')
    rx, ry = rank(x), rank(y)
    if rx.std() == 0 or ry.std() == 0:
        return float('nan')
    return float(np.corrcoef(rx, ry)[0, 1])


def pct(lo_hi):
    return '[%s, %s]' % (f2(lo_hi[0]), f2(lo_hi[1]))


def ci_str(d, ci, fmt=f2):
    return '%s [%s, %s]' % (fmt(d), fmt(ci[0]), fmt(ci[1]))


def table(title, defs, cols, rows):
    MD.append('')
    MD.append('**%s**' % title)
    MD.append('_%s_' % defs)
    MD.append('')
    MD.append('| ' + ' | '.join(cols) + ' |')
    MD.append('|' + '|'.join(['---'] * len(cols)) + '|')
    for r in rows:
        MD.append('| ' + ' | '.join(str(c) for c in r) + ' |')


def normalise(tokens):
    out = []
    for t in tokens:
        m = TOK_RE.match(t)
        if not m:
            continue
        letter, num, pr = m.groups()
        q = int(num) if num else 1
        q = (-q if pr else q) % 4
        if out and out[-1][0] == letter:
            q = (out[-1][1] + q) % 4
            out.pop()
        if q:
            out.append((letter, q))
    return out


def fmt_seq(seq):
    return ' '.join(l + {1: '', 2: '2', 3: "'"}[q] for l, q in seq)


def core(seq):
    s = list(seq)
    while s and s[0][0] == 'U':
        s.pop(0)
    while s and s[-1][0] == 'U':
        s.pop()
    return s


R = load()
sol = []
SEGFAIL = []
for i, r in enumerate(R):
    st = stages(r)
    if st is None:
        continue
    if sum(st[k]['time'] for k in range(1, 5)) == 0:
        SEGFAIL.append(r['detail']['uuid'])
        continue
    sol.append((i, r, st))
nS = len(sol)
EXCL = len(R) - nS
J['meta'] = {'solves_loaded': len(R), 'analysed_solves': nS, 'excluded_non_cfop': 2, 'excluded_f2l_segmentation_failed': len(SEGFAIL), 'segfail_uuids': SEGFAIL, 'bootstrap_resamples': B, 'seed': SEED,
             'date_first': sol[0][1]['detail']['date'], 'date_last': sol[-1][1]['detail']['date']}

P = []
for si, (ri, r, st) in enumerate(sol):
    d = r['detail']
    for k in range(1, 5):
        x = st[k]
        toks = [(m['sliceTurn'], m['timeStamp']) for m in x['moves']]
        nr = [(n, t) for n, t in toks if not ROT_RE.match(n)]
        rots = [n for n, t in toks if ROT_RE.match(n)]
        du = [n for n, t in toks if n[0] in 'ud']
        wo = [n for n, t in toks if n[0] in 'lrfb']
        sl = [n for n, t in toks if n[0] in 'MES']
        ts = [t for n, t in nr]
        gapsA = [(b - a, a) for a, b in zip(ts, ts[1:])]
        rec_end = x['start'] + (x['recognition'] or 0)
        gapsB = [g for g, a in gapsA if a >= rec_end - 1]
        gapsA = [g for g, a in gapsA]
        runs, undone, triple = 0, 0, False
        seq = [n for n, t in nr]
        for a, b in zip(seq, seq[1:]):
            ma, mb = TOK_RE.match(a), TOK_RE.match(b)
            if ma and mb and ma.group(1) == mb.group(1):
                qa = (-1 if ma.group(3) else 1) * int(ma.group(2) or 1)
                qb = (-1 if mb.group(3) else 1) * int(mb.group(2) or 1)
                if (qa + qb) % 4 == 0:
                    undone += 1
        for n in seq:
            m = TOK_RE.match(n)
            if m and m.group(2) in ('3', '4'):
                triple = True
        for j in range(len(seq) - 2):
            if seq[j][0] == seq[j + 1][0] == seq[j + 2][0]:
                triple = True
        mv = len(nr)
        lead = (ts[0] - x['start']) if ts else None
        P.append(dict(
            s=si, uuid=d['uuid'], date=d['date'], pos=k, time=x['time'], rec=x['recognition'], exe=x['execution'], case=x['case'],
            slot=x['slotIndex'], mv=mv, rot=len(rots), du=len(du), wo=len(wo), sl=len(sl), has=mv > 0,
            yrot=sum(1 for n in rots if n[0] == 'y'), xrot=sum(1 for n in rots if n[0] == 'x'), zrot=sum(1 for n in rots if n[0] == 'z'),
            gA=gapsA, gB=gapsB, undone=undone, triple=triple, lead=lead, start=x['start'], toks=toks,
            seq=normalise(seq), tps=(mv / (x['execution'] / 1000.0)) if x['execution'] and x['execution'] > 0 and mv else None))
assert len(P) == nS * 4


def arr(key, dtype=float):
    return np.array([p[key] if p[key] is not None else np.nan for p in P], dtype=dtype)


POS = arr('pos', int)
T, REC, EXE = arr('time'), arr('rec'), arr('exe')
MV, ROT, DU = arr('mv', int), arr('rot', int), arr('du', int)
HAS = arr('has', bool)
SID = arr('s', int)
CASE = arr('case', int)
SLOT = arr('slot', int)
UNDONE = np.array([p['undone'] > 0 for p in P])
TRIPLE = np.array([p['triple'] for p in P])
nA = lambda g, th: sum(1 for v in g if v > th)  # noqa: E731
sA = lambda g, th: sum(v for v in g if v > th)  # noqa: E731
G = {}
for tag in ('gA', 'gB'):
    for th in THR:
        G[(tag, th, 'n')] = np.array([nA(p[tag], th) for p in P], float)
        G[(tag, th, 's')] = np.array([sA(p[tag], th) for p in P], float)

SIDS = rng.integers(0, nS, (B, nS))
PIDX = (SIDS[:, :, None] * 4 + np.arange(4)).reshape(B, -1)


def cl_ci(fn):
    v = np.array([fn(PIDX[b]) for b in range(B)], float)
    return (float(np.nanpercentile(v, 2.5)), float(np.nanpercentile(v, 97.5)))


def sv_ci(fn):
    v = np.array([fn(SIDS[b]) for b in range(B)], float)
    return (float(np.nanpercentile(v, 2.5)), float(np.nanpercentile(v, 97.5)))


def grp_ci(a, b, seed):
    g = np.random.default_rng(seed)
    a, b = np.asarray(a, float), np.asarray(b, float)
    ia = g.integers(0, len(a), (B, len(a)))
    ib = g.integers(0, len(b), (B, len(b)))
    v = a[ia].mean(1) - b[ib].mean(1)
    return (float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5)))


def deciles(a):
    return np.percentile(a, [10, 20, 30, 40, 50, 60, 70, 80, 90]) if len(a) else [np.nan] * 9


solve_arr = lambda key: np.array([sum(P[s * 4 + k][key] or 0 for k in range(4)) for s in range(nS)], float)  # noqa: E731
F2L_T = solve_arr('time')
F2L_R = solve_arr('rec')
F2L_E = solve_arr('exe')
F2L_M = solve_arr('mv')
F2L_ROT = solve_arr('rot')
F2L_DU = solve_arr('du')
F2L_WO = solve_arr('wo')
TOT = np.array([sol[s][1]['detail']['totalTime'] for s in range(nS)], float)
SG = {(tag, th, kind): np.array([sum(G[(tag, th, kind)][s * 4:(s + 1) * 4]) for s in range(nS)]) for tag in ('gA', 'gB') for th in THR for kind in ('n', 's')}
assert np.all(F2L_T == np.array([sol[s][1]['detail']['analysis']['f2l']['totalTime'] for s in range(nS)]))
assert np.all(np.abs(F2L_R + F2L_E - F2L_T) <= 1)

MD.append('# F2L analysis (acubemy, last 1000 smart-cube solves, one solver)')
MD.append('')
MD.append('Scope: %d solves loaded, %d analysed. Excluded: 2 non-CFOP (1 Roux, 1 ZZ) and %d CFOP solves where acubemy attributed the whole cross+F2L stretch to the cross stage (all four F2L stages time 0, no moves; uuids in f2l.json meta). Dates %s to %s. Times in seconds (2 decimals) unless stated; raw data in ms. Bootstrap: %d resamples, seed %d, percentile 95%% CI; pair-level statistics resample whole solves (cluster bootstrap), solve-level statistics resample solves. Groups n<%d flagged LOW-N.' % (
    len(R), nS, len(SEGFAIL), J['meta']['date_first'][:10], J['meta']['date_last'][:10], B, SEED, LOWN))
MD.append('')
MD.append('Definitions: pair k = k-th F2L stage in acubemy order (stage time = end of previous stage to its last move). "moves" = non-rotation tokens, each = 1 (X2, X2\', wide d/u/r/l/f/b, slices M/E/S, merged tokens such as U3 all = 1). "rots" = x/y/z tokens (any suffix), 0 moves. exec TPS = moves / execution seconds. Zero-move pairs (acubemy case -1, time 0.00: slot already solved) are excluded from pair-level tables unless stated, but included in solve-level F2L sums.')

n_zero = [int((~HAS[POS == k]).sum()) for k in range(1, 5)]
J['zero_move_pairs_by_pos'] = n_zero
J['zero_move_pairs_total'] = int((~HAS).sum())

# 1 ---------------------------------------------------------------
rows, J1 = [], {}
metrics = [('time', T / 1000), ('rec', REC / 1000), ('exe', EXE / 1000), ('moves', MV.astype(float)), ('rots', ROT.astype(float))]
tps_arr = np.array([p['tps'] if p['tps'] is not None else np.nan for p in P])
metrics.append(('tps', tps_arr))
labels = ['1st', '2nd', '3rd', '4th']
for k in range(1, 5):
    m = HAS & (POS == k)
    rec = [labels[k - 1], nflag(int(m.sum())), n_zero[k - 1]]
    J1[labels[k - 1]] = {'n': int(m.sum()), 'n_zero_move': n_zero[k - 1]}
    for name, a in metrics:
        v = a[m]
        v = v[~np.isnan(v)]
        rec.append('%s / %s' % (f2(med(v)), f2(mean(v))))
        J1[labels[k - 1]][name] = {'median': med(v), 'mean': mean(v), 'n': len(v), 'deciles': [float(q) for q in deciles(v)]}
    sh = REC[m].sum() / T[m].sum()
    rec.append('%.1f%%' % (100 * sh))
    J1[labels[k - 1]]['rec_share_pooled'] = float(sh)
    rows.append(rec)
tot_rows = [('F2L total', 'solves', F2L_T / 1000), ]
rec = ['F2L total (per solve)', nflag(nS), int(sum(n_zero))]
J1['F2L'] = {'n': nS}
tpsF = F2L_M / (F2L_E / 1000)
for name, a in [('time', F2L_T / 1000), ('rec', F2L_R / 1000), ('exe', F2L_E / 1000), ('moves', F2L_M), ('rots', F2L_ROT), ('tps', tpsF)]:
    rec.append('%s / %s' % (f2(med(a)), f2(mean(a))))
    J1['F2L'][name] = {'median': med(a), 'mean': mean(a), 'n': len(a), 'deciles': [float(q) for q in deciles(a)]}
shs = F2L_R / F2L_T
rec.append('%.1f%%' % (100 * F2L_R.sum() / F2L_T.sum()))
J1['F2L']['rec_share_pooled'] = float(F2L_R.sum() / F2L_T.sum())
J1['F2L']['rec_share_per_solve_median'] = med(shs)
rows.append(rec)
J['1_position'] = J1
table('1a. F2L by pair position (pairs with >=1 move)', 'n = pairs; zero = zero-move pairs excluded from n. Each cell median / mean. time/rec/exe in s, moves and rots counts, tps = moves per execution second. rec share = sum(recognition)/sum(time) pooled. Last row is per solve (4 pairs summed, zero-move pairs count as 0).',
      ['pair', 'n', 'zero', 'time', 'recognition', 'execution', 'moves', 'rots', 'exec TPS', 'rec share'], rows)
J['1_rec_share_per_solve_median'] = med(shs)
rows = []
for k in range(1, 5):
    m = HAS & (POS == k)
    for name, a in metrics[:4]:
        v = a[m]
        v = v[~np.isnan(v)]
        rows.append([labels[k - 1], name] + [f2(q) for q in deciles(v)])
for name, a in [('time', F2L_T / 1000), ('rec', F2L_R / 1000), ('exe', F2L_E / 1000), ('moves', F2L_M)]:
    rows.append(['F2L total', name] + [f2(q) for q in deciles(a)])
table('1b. Deciles', 'p10..p90 of the metric; pairs with >=1 move (rows 1st-4th), solves (F2L total). time/rec/exe in s, moves in count.',
      ['pair', 'metric', 'p10', 'p20', 'p30', 'p40', 'p50', 'p60', 'p70', 'p80', 'p90'], rows)

# 2 ---------------------------------------------------------------
J2 = {}
for tag, tname in (('gA', 'A: all gaps after the first move'), ('gB', 'B: gaps that start at/after acubemy recognition end (no overlap with recognition)')):
    rows = []
    for k in list(range(1, 5)) + [0]:
        m = (HAS & (MV >= 2)) if k == 0 else (HAS & (MV >= 2) & (POS == k))
        rec = ['All' if k == 0 else labels[k - 1], nflag(int(m.sum()))]
        d = {'n': int(m.sum())}
        for th in THR:
            rec.append(f2(G[(tag, th, 'n')][m].mean()))
            d['mean_count_gt%d' % th] = float(G[(tag, th, 'n')][m].mean())
        rec.append('%.1f%%' % (100 * (G[(tag, 700, 'n')][m] > 0).mean()))
        rec.append(s2(G[(tag, 400, 's')][m].mean()))
        d['mean_s_in_gt400'] = float(G[(tag, 400, 's')][m].mean() / 1000)
        d['share_pairs_with_gt700'] = float((G[(tag, 700, 'n')][m] > 0).mean())
        rec.append(s2(med(T[m])))
        rows.append(rec)
        J2['%s_%s' % (tag, 'All' if k == 0 else labels[k - 1])] = d
    table('2%s. Mid-pair gaps, variant %s' % ('a' if tag == 'gA' else 'b', tname),
          'n = pairs with >=2 moves. Columns: mean count per pair of inter-move gaps >400 / >700 / >1000 ms; share of pairs with >=1 gap >700 ms; mean seconds per pair spent inside gaps >400 ms; median pair time (s).',
          ['pair', 'n', 'gaps>400', 'gaps>700', 'gaps>1000', 'pairs with >700', 'sec in >400 gaps', 'median pair time'], rows)
rows = []
for tag, tname in (('gA', 'A'), ('gB', 'B')):
    d = {}
    rec = [tname, nS]
    for th in THR:
        rec.append('%s / %s' % (f2(med(SG[(tag, th, 'n')])), f2(mean(SG[(tag, th, 'n')]))))
        d['count_gt%d' % th] = {'median': med(SG[(tag, th, 'n')]), 'mean': mean(SG[(tag, th, 'n')])}
    rec.append('%s / %s' % (s2(med(SG[(tag, 400, 's')])), s2(mean(SG[(tag, 400, 's')]))))
    rec.append('%.1f%%' % (100 * SG[(tag, 400, 's')].sum() / F2L_T.sum()))
    d['sec_in_gt400'] = {'median': med(SG[(tag, 400, 's')]) / 1000, 'mean': mean(SG[(tag, 400, 's')]) / 1000}
    d['share_of_f2l_time'] = float(SG[(tag, 400, 's')].sum() / F2L_T.sum())
    J2['per_solve_' + tag] = d
    rows.append(rec)
table('2c. Mid-pair gaps per solve (4 pairs summed)', 'n = solves. Each cell median / mean. gaps>400/>700/>1000 = count per solve; sec in >400 gaps = total seconds per solve inside gaps >400 ms; share = that time / total F2L time pooled. Variant A includes gaps that overlap acubemy recognition.',
      ['variant', 'n', 'gaps>400', 'gaps>700', 'gaps>1000', 'sec in >400', 'share of F2L time'], rows)
lead = np.array([p['lead'] for p in P if p['lead'] is not None], float)
rec_a = REC[HAS]
J2['lead_gap_vs_recognition'] = {'lead_median_s': med(lead) / 1000, 'rec_median_s': med(rec_a) / 1000,
                                 'share_pairs_rec_gt_lead': float(np.mean([p['rec'] > p['lead'] + 1 for p in P if p['has']])),
                                 'share_pairs_rec_eq_lead': float(np.mean([abs(p['rec'] - p['lead']) <= 1 for p in P if p['has']])),
                                 'share_pairs_rec_lt_lead': float(np.mean([p['rec'] < p['lead'] - 1 for p in P if p['has']]))}
J['2_gaps'] = J2
MD.append('')
MD.append('Note: acubemy recognition is not the leading gap. Median leading gap (stage start to first move) %s s vs median recognition %s s; recognition > leading gap in %.1f%% of pairs (it then ends at a later move, typically after 1-2 setup/AUF/rotation moves and a pause), equal in %.1f%%, smaller in %.1f%%.' % (
    s2(med(lead)), s2(med(rec_a)), 100 * J2['lead_gap_vs_recognition']['share_pairs_rec_gt_lead'], 100 * J2['lead_gap_vs_recognition']['share_pairs_rec_eq_lead'], 100 * J2['lead_gap_vs_recognition']['share_pairs_rec_lt_lead']))

# 3 ---------------------------------------------------------------
J3 = {}


def bins(v):
    return np.minimum(v, 4)


rows = []
for lab, a in (('rots (x/y/z tokens)', F2L_ROT), ('d/u wide moves', F2L_DU)):
    b = bins(a)
    for c in range(5):
        m = b == c
        if not m.any():
            continue
        rows.append([lab, '4+' if c == 4 else c, nflag(int(m.sum())), '%.1f%%' % (100 * m.mean()), f2(med(F2L_T[m] / 1000)) + ' / ' + f2(mean(F2L_T[m] / 1000)),
                     f2(mean(F2L_R[m] / 1000)), f2(mean(F2L_E[m] / 1000)), f2(mean(F2L_M[m]))])
        J3['bin_%s_%s' % (lab.split()[0], c)] = {'n': int(m.sum()), 'median_time': med(F2L_T[m] / 1000), 'mean_time': mean(F2L_T[m] / 1000)}
table('3a. F2L time by rotation count per solve', 'Per solve (n = solves in bin), rotation family is the row label; bin = count in F2L (4+ pooled). time median / mean (s); rec, exe = mean seconds; moves = mean non-rotation moves in F2L.',
      ['count of', 'bin', 'n', 'share', 'F2L time', 'rec', 'exe', 'moves'], rows)
rows = []
tests = [('rots vs F2L time', F2L_ROT, F2L_T), ('rots vs F2L moves', F2L_ROT, F2L_M), ('rots vs F2L recognition', F2L_ROT, F2L_R), ('rots vs F2L execution', F2L_ROT, F2L_E),
         ('d/u vs F2L time', F2L_DU, F2L_T), ('rots+d/u vs F2L time', F2L_ROT + F2L_DU, F2L_T), ('F2L moves vs F2L time', F2L_M, F2L_T)]
for lab, x, y in tests:
    r_ = spearman(x, y)
    ci = sv_ci(lambda idx, x=x, y=y: spearman(x[idx], y[idx]))
    rows.append([lab, nS, ci_str(r_, ci, f3)])
    J3['spearman_' + lab] = {'rho': r_, 'ci': ci, 'n': nS}
table('3b. Spearman rank correlations (solve level)', 'rho with bootstrap 95% CI over solves; n = solves.', ['pair', 'n', 'rho [95% CI]'], rows)
rows = []
for lab, x in (('y', arr('yrot', int)), ('x', arr('xrot', int)), ('z', arr('zrot', int)), ('d/u wide', DU), ('l/r/f/b wide', arr('wo', int))):
    r_ = [lab]
    for k in range(1, 5):
        m = HAS & (POS == k)
        r_.append('%.2f / %.1f%%' % (x[m].mean(), 100 * (x[m] > 0).mean()))
    m = HAS
    r_.append('%.2f' % (x[m].sum() / nS))
    rows.append(r_)
    J3['per_pos_' + lab] = {labels[k - 1]: float(x[HAS & (POS == k)].mean()) for k in range(1, 5)}
table('3c. Rotation-like tokens by pair position', 'Each cell: mean tokens per pair / share of pairs with >=1 such token (pairs with moves). Last column: mean tokens per solve across F2L.',
      ['token family', '1st', '2nd', '3rd', '4th', 'per solve'], rows)
rows = []
BUCK = np.clip(MV, 4, 15)
NB = 16
bl = lambda b: ('<=4' if b == 4 else '15+' if b == 15 else str(b))  # noqa: E731


def strat(idx, y, flag, strata, mask):
    i = idx[mask[idx]]
    s, f, v = strata[i], flag[i], y[i]
    n1 = np.bincount(s[f], minlength=NB).astype(float)
    n0 = np.bincount(s[~f], minlength=NB).astype(float)
    s1 = np.bincount(s[f], weights=v[f], minlength=NB)
    s0 = np.bincount(s[~f], weights=v[~f], minlength=NB)
    ok = (n1 >= 2) & (n0 >= 2)
    if not ok.any():
        return float('nan')
    d = s1[ok] / n1[ok] - s0[ok] / n0[ok]
    w = n1[ok] * n0[ok] / (n1[ok] + n0[ok])
    return float((w * d).sum() / w.sum())


def raw_diff(idx, y, flag, mask):
    i = idx[mask[idx]]
    f = flag[i]
    if f.sum() < 1 or (~f).sum() < 1:
        return float('nan')
    return float(y[i][f].mean() - y[i][~f].mean())


ALL = np.arange(len(P))
HASROT = ROT > 0
HASDU = DU > 0
for lab, flag in (('>=1 rotation token vs 0', HASROT), ('>=1 d/u wide vs 0', HASDU & ~HASROT)):
    for yname, y in (('time', T / 1000), ('rec', REC / 1000), ('exe', EXE / 1000)):
        base = HAS if 'd/u' not in lab else (HAS & (ROT == 0))
        d_s = strat(ALL, y, flag, BUCK, base)
        ci_s = cl_ci(lambda idx, y=y, flag=flag, base=base: strat(idx, y, flag, BUCK, base))
        d_r = raw_diff(ALL, y, flag, base)
        ci_r = cl_ci(lambda idx, y=y, flag=flag, base=base: raw_diff(idx, y, flag, base))
        J3['contrast_%s_%s' % (lab, yname)] = {'stratified_diff_s': d_s, 'ci': ci_s, 'raw_diff_s': d_r, 'raw_ci': ci_r,
                                               'n_flag': int((flag & base).sum()), 'n_ref': int((~flag & base).sum())}
        rows.append([lab, yname, int((flag & base).sum()), int((~flag & base).sum()), ci_str(d_r, ci_r), ci_str(d_s, ci_s)])
table('3d. Rotation cost at pair level, raw and controlled for move count', 'Difference in mean seconds (with-token minus without) over pairs with moves; n_with / n_without = pairs. Controlled = weighted mean of within-move-count-bucket differences (buckets by non-rotation move count: <=4,5,...,14,15+; weight n1*n0/(n1+n0); buckets with <2 in either arm dropped). CI = cluster bootstrap over solves. d/u rows exclude pairs with rotation tokens.',
      ['contrast', 'metric', 'n with', 'n without', 'raw diff [95% CI]', 'controlled diff [95% CI]'], rows)
rows = []
for b in range(4, 16):
    m = HAS & (BUCK == b)
    f1, f0 = m & HASROT, m & ~HASROT
    if f1.sum() < 1 or f0.sum() < 1:
        rows.append([bl(b), nflag(int(f0.sum())), nflag(int(f1.sum())), '', '', ''])
        continue
    y = T / 1000
    ci = cl_ci(lambda idx, y=y, m=m: raw_diff(idx, y, HASROT, m))
    d = raw_diff(ALL, y, HASROT, m)
    rows.append([bl(b), nflag(int(f0.sum())), nflag(int(f1.sum())), f2(mean(y[f0])), f2(mean(y[f1])), ci_str(d, ci)])
    J3['bucket_%s' % bl(b)] = {'n0': int(f0.sum()), 'n1': int(f1.sum()), 'mean0': mean(y[f0]), 'mean1': mean(y[f1]), 'diff': d, 'ci': ci}
table('3e. Pair time with vs without rotation token, within move-count bucket', 'Bucket = non-rotation move count of the pair. n0 / n1 = pairs without / with >=1 x/y/z token. Mean pair time (s) in each arm; diff = mean1 - mean0 (s) with cluster-bootstrap CI.',
      ['moves', 'n0', 'n1', 'mean time 0 rot', 'mean time >=1 rot', 'diff [95% CI]'], rows)
J['3_rotations'] = J3

# 4 ---------------------------------------------------------------
J4 = {}
rows = []
mvh = MV[HAS]
for v in list(range(3, 20)) + [20]:
    m = (mvh == v) if v < 20 else (mvh >= 20)
    rows.append(['20+' if v == 20 else v, int(m.sum()), '%.1f%%' % (100 * m.mean())])
table('4a. Distribution of moves per pair', 'moves = non-rotation tokens in the pair (pairs with moves, n=%d); count and share of pairs.' % int(HAS.sum()), ['moves', 'pairs', 'share'], rows)
rows = []
for k in list(range(1, 5)) + [0]:
    m = HAS if k == 0 else (HAS & (POS == k))
    rec = ['All' if k == 0 else labels[k - 1], nflag(int(m.sum()))]
    d = {}
    for th in (10, 12, 15):
        rec.append('%.1f%%' % (100 * (MV[m] >= th).mean()))
        d['share_ge%d' % th] = float((MV[m] >= th).mean())
    rec.append('%.1f%%' % (100 * (UNDONE[m]).mean()))
    rec.append('%.1f%%' % (100 * TRIPLE[m].mean()))
    d['share_undone'] = float(UNDONE[m].mean())
    d['share_triple'] = float(TRIPLE[m].mean())
    rec.append('%.1f%%' % (100 * (UNDONE[m] | TRIPLE[m]).mean()))
    rows.append(rec)
    J4['shares_' + ('All' if k == 0 else labels[k - 1])] = d
table('4b. Long pairs and wasted-move pairs', 'Share of pairs (with moves) with >=10, >=12, >=15 moves; with an adjacent same-face pair that nets to zero (X X\', X2 X2); with a same-face run of >=3 tokens or a merged token such as U3; either.',
      ['pair', 'n', '>=10', '>=12', '>=15', 'undone adj.', 'triple/merged', 'either'], rows)
rows = []
y = T / 1000
for lab, flag in (('undone adjacent (X X\')', UNDONE), ('triple / merged token', TRIPLE), ('either', UNDONE | TRIPLE)):
    for yname, yy in (('time', T / 1000), ('exe', EXE / 1000)):
        d_r = raw_diff(ALL, yy, flag, HAS)
        ci_r = cl_ci(lambda idx, yy=yy, flag=flag: raw_diff(idx, yy, flag, HAS))
        d_s = strat(ALL, yy, flag, BUCK, HAS)
        ci_s = cl_ci(lambda idx, yy=yy, flag=flag: strat(idx, yy, flag, BUCK, HAS))
        rows.append([lab, yname, int((flag & HAS).sum()), int((~flag & HAS).sum()), ci_str(d_r, ci_r), ci_str(d_s, ci_s)])
        J4['cost_%s_%s' % (lab, yname)] = {'raw_diff': d_r, 'raw_ci': ci_r, 'controlled_diff': d_s, 'controlled_ci': ci_s, 'n_with': int((flag & HAS).sum())}
table('4c. Time cost of wasted-move pairs', 'Mean seconds with-flag minus without; raw and controlled for non-rotation move-count bucket (same method as 3d, so the flagged pair is compared to a pair of equal length). CI = cluster bootstrap.',
      ['flag', 'metric', 'n with', 'n without', 'raw diff [95% CI]', 'controlled diff [95% CI]'], rows)
rows = []


def slope(idx, x, y, mask):
    i = idx[mask[idx]]
    xx, yy = x[i], y[i]
    vx = xx.var()
    if len(xx) < 5 or vx == 0:
        return float('nan')
    return float(((xx - xx.mean()) * (yy - yy.mean())).mean() / vx)


def icept(x, y, mask):
    xx, yy = x[mask], y[mask]
    b = ((xx - xx.mean()) * (yy - yy.mean())).mean() / xx.var()
    return float(yy.mean() - b * xx.mean())


MVf = MV.astype(float)
for lab, mask in (('all pairs with moves', HAS), ('pairs with >=10 moves', HAS & (MV >= 10)), ('pairs with >=12 moves', HAS & (MV >= 12))):
    for yname, yy in (('time', T / 1000), ('exe', EXE / 1000), ('rec', REC / 1000)):
        b = slope(ALL, MVf, yy, mask)
        ci = cl_ci(lambda idx, yy=yy, mask=mask: slope(idx, MVf, yy, mask))
        rows.append([lab, yname, nflag(int(mask.sum())), ci_str(b, ci, f3), f2(icept(MVf, yy, mask))])
        J4['slope_%s_%s' % (lab, yname)] = {'sec_per_move': b, 'ci': ci, 'intercept_s': icept(MVf, yy, mask), 'n': int(mask.sum())}
table('4d. OLS slope of pair seconds on move count', 'slope = extra seconds per extra non-rotation move (with cluster-bootstrap CI over solves); intercept in s; n = pairs.', ['subset', 'y', 'n', 'slope s/move [95% CI]', 'intercept'], rows)
J['4_efficiency'] = J4

# 5 ---------------------------------------------------------------
M0 = med(T[HAS])
J['5_case_meta'] = {'solver_median_pair_time_s': M0 / 1000}
byc = defaultdict(list)
for i, p in enumerate(P):
    if p['has']:
        byc[p['case']].append(i)
crow = []
for c, ids in byc.items():
    ids = np.array(ids)
    t = T[ids]
    seqs = Counter(fmt_seq(P[i]['seq']) for i in ids)
    cores = Counter(fmt_seq(core(P[i]['seq'])) for i in ids)
    cs_ = CASES.get(c, {})
    crow.append(dict(case=c, name=cs_.get('name', '?'), type=cs_.get('type', '?'), setup=cs_.get('setup'), n=len(ids), share=len(ids) / HAS.sum(),
                     med_t=med(t) / 1000, mean_t=mean(t) / 1000, med_rec=med(REC[ids]) / 1000, med_exe=med(EXE[ids]) / 1000, med_mv=med(MV[ids]),
                     rot=float((ROT[ids] > 0).mean()), gap700=float(np.mean([any(g > 700 for g in P[i]['gA']) for i in ids])),
                     excess=float((t - M0).sum() / 1000), top3=seqs.most_common(3), top3core=cores.most_common(3), ndistinct=len(seqs), ndistinct_core=len(cores),
                     slots=dict(Counter(SLOTS[int(SLOT[i])] for i in ids))))
crow.sort(key=lambda r: -r['excess'])
J['5_cases'] = crow


def case_rows(rs, with_seq=True):
    out = []
    for r in rs:
        top = '; '.join('%s (%d)' % (s, n) for s, n in r['top3'])
        topc = '; '.join('%s (%d)' % (s, n) for s, n in r['top3core'])
        out.append([r['case'], r['name'], r['type'], nflag(r['n']), '%.1f%%' % (100 * r['share']), '%s / %s' % (f2(r['med_t']), f2(r['mean_t'])), f2(r['med_rec']), f2(r['med_exe']),
                    f2(r['med_mv']), '%.0f%%' % (100 * r['rot']), '%.0f%%' % (100 * r['gap700']), f2(r['excess']), '%d/%d' % (r['ndistinct'], r['ndistinct_core']), top, topc])
    return out


ccols = ['caseIndex', 'name', 'type', 'n', 'share', 'time med / mean', 'med rec', 'med exe', 'med moves', 'with rot', 'gap>700', 'excess s', 'distinct seq (full/core)', 'top 3 sequences', 'top 3 AUF-stripped']
cdefs = 'Pairs with moves grouped by acubemy caseIndex (name from acubemy F2L table, bundle 7769 module 39452). n = pairs; share of all pairs; time in s; med rec/exe in s; with rot = share with an x/y/z token; gap>700 = share with an inter-move gap >700 ms after the first move; excess = sum over pairs of (pair time - solver median pair time %s s), sorted descending; sequences = rotation-stripped, adjacent same-face tokens merged, X2\'=X2, in the solver\'s frame (count in brackets); AUF-stripped = same with leading/trailing U moves removed.' % s2(M0)
table('5a. Top 18 caseIndex by excess seconds (all %d cases in out/f2l-cases.md and f2l.json)' % len(crow), cdefs, ccols[:13] + ['top 3 sequences'], [r[:13] + [r[13]] for r in case_rows(crow[:18])])
allcase = ['# F2L per-caseIndex table (all %d cases)' % len(crow), '', '_%s_' % cdefs, '', '| ' + ' | '.join(ccols) + ' |', '|' + '|'.join(['---'] * len(ccols)) + '|']
allcase[4] = allcase[4].replace('type |', 'type | setup alg (FR slot, from solved) |')
allcase[5] = allcase[5] + '---|'
for r, cr in zip(case_rows(crow), crow):
    r = r[:3] + [cr['setup']] + r[3:]
    allcase.append('| ' + ' | '.join(str(c) for c in r) + ' |')
open(os.path.join(OUT, 'f2l-cases.md'), 'w').write('\n'.join(allcase) + '\n')
big = [r for r in crow if r['n'] >= LOWN]
J['5_case_summary'] = {'n_cases_seen': len(crow), 'n_cases_ge30': len(big), 'pairs_in_cases_ge30': int(sum(r['n'] for r in big)),
                       'excess_top10_s': float(sum(r['excess'] for r in crow[:10])), 'excess_total_positive_s': float(sum(r['excess'] for r in crow if r['excess'] > 0))}
byt = defaultdict(list)
for i, p in enumerate(P):
    if p['has']:
        byt[CASES.get(p['case'], {}).get('type', '?')].append(i)
rows = []
for ty, ids in sorted(byt.items(), key=lambda kv: -sum(T[kv[1]] - M0)):
    ids = np.array(ids)
    rows.append([ty, nflag(len(ids)), '%.1f%%' % (100 * len(ids) / HAS.sum()), f2(med(T[ids] / 1000)) + ' / ' + f2(mean(T[ids] / 1000)), f2(med(REC[ids] / 1000)), f2(med(EXE[ids] / 1000)), f2(med(MV[ids])),
                 '%.0f%%' % (100 * (ROT[ids] > 0).mean()), f2((T[ids] - M0).sum() / 1000)])
table('5b. By acubemy case type', 'Pairs with moves grouped by the case type string in acubemy\'s F2L table; time median / mean s; med rec/exe s; med moves; share with rotation token; excess s vs solver median pair time.',
      ['type', 'n', 'share', 'time', 'med rec', 'med exe', 'med moves', 'with rot', 'excess s'], rows)
byg = defaultdict(list)
for i, p in enumerate(P):
    if p['has']:
        byg[(p['case'], p['slot'])].append(i)
rows = []
for lab, key in (('caseIndex', lambda i: P[i]['case']), ('caseIndex x slotIndex', lambda i: (P[i]['case'], P[i]['slot']))):
    gg = defaultdict(list)
    for i in np.where(HAS)[0]:
        gg[key(i)].append(i)
    for minn in (3, 10):
        grp = [v for v in gg.values() if len(v) >= minn]
        n_tot = sum(len(v) for v in grp)
        hit = sum(Counter(fmt_seq(P[i]['seq']) for i in v).most_common(1)[0][1] for v in grp)
        hitc = sum(Counter(fmt_seq(core(P[i]['seq'])) for i in v).most_common(1)[0][1] for v in grp)
        rows.append([lab, '>=%d' % minn, len(grp), n_tot, '%.1f%%' % (100 * hit / n_tot), '%.1f%%' % (100 * hitc / n_tot)])
        J['5_consistency_%s_ge%d' % (lab, minn)] = {'groups': len(grp), 'pairs': n_tot, 'modal_share_full': hit / n_tot, 'modal_share_core': hitc / n_tot}
table('5c. Solution consistency', 'Groups of pairs sharing the key; only groups with n >= threshold; share of those pairs whose normalised move sequence equals the group modal sequence (full) or modal AUF-stripped sequence (core). Sequences are in the solver frame, so the same case in different slots/rotations splits under caseIndex alone.',
      ['key', 'min n', 'groups', 'pairs', 'modal full', 'modal AUF-stripped'], rows)

# 6 ---------------------------------------------------------------
J6 = {}
rows = []
for k in range(1, 5):
    m = HAS & (POS == k)
    rows.append([labels[k - 1]] + ['%d (%.1f%%)' % ((SLOT[m] == s).sum(), 100 * (SLOT[m] == s).mean()) for s in range(4)] + [int(m.sum())])
    J6['freq_' + labels[k - 1]] = {SLOTS[s]: int((SLOT[m] == s).sum()) for s in range(4)}
m = HAS
rows.append(['All'] + ['%d (%.1f%%)' % ((SLOT[m] == s).sum(), 100 * (SLOT[m] == s).mean()) for s in range(4)] + [int(m.sum())])
table('6a. slotIndex frequency by pair position', 'Count (share of pairs at that position, pairs with moves). slotIndex 0..3 = FR, FL, BL, BR (see 6d).', ['pair', 'FR(0)', 'FL(1)', 'BL(2)', 'BR(3)', 'n'], rows)
rows = []
for s in range(4):
    m = HAS & (SLOT == s)
    rest = HAS & (SLOT != s)
    d = mean(T[m] / 1000) - mean(T[rest] / 1000)
    ci = cl_ci(lambda idx, m=m, rest=rest: raw_diff(idx, T / 1000, (SLOT == s), HAS))
    ds = strat(ALL, T / 1000, (SLOT == s), BUCK, HAS)
    cis = cl_ci(lambda idx, s=s: strat(idx, T / 1000, (SLOT == s), BUCK, HAS))
    rows.append([SLOTS[s], nflag(int(m.sum())), '%s / %s' % (f2(med(T[m] / 1000)), f2(mean(T[m] / 1000))), f2(med(REC[m] / 1000)), f2(med(EXE[m] / 1000)), f2(med(MV[m])), '%.0f%%' % (100 * (ROT[m] > 0).mean()),
                 ci_str(d, ci), ci_str(ds, cis)])
    J6['slot_' + SLOTS[s]] = {'n': int(m.sum()), 'median_time': med(T[m]) / 1000, 'mean_time': mean(T[m]) / 1000, 'median_rec': med(REC[m]) / 1000, 'median_moves': med(MV[m]),
                              'diff_vs_rest': d, 'ci': ci, 'controlled_diff_vs_rest': ds, 'controlled_ci': cis}
table('6b. Pair time by slotIndex', 'Pairs with moves. time median / mean (s); med rec / exe (s); med moves; share with rotation token; diff = mean time of slot minus mean of other slots (s, raw) and controlled for move-count bucket; cluster-bootstrap CI.',
      ['slot', 'n', 'time', 'med rec', 'med exe', 'med moves', 'with rot', 'raw diff vs others [95% CI]', 'controlled diff [95% CI]'], rows)
rows = []
for k in range(1, 5):
    rec = [labels[k - 1]]
    for s in range(4):
        m = HAS & (POS == k) & (SLOT == s)
        rec.append('%s / %s / %s (n=%d%s)' % (f2(med(T[m] / 1000)), f2(med(REC[m] / 1000)), f2(med(MV[m])), m.sum(), ' LOW-N' if m.sum() < LOWN else ''))
    rows.append(rec)
table('6c. Median time / rec / moves by position and slotIndex', 'Median pair time s / median recognition s / median moves; n = pairs.', ['pair', 'FR(0)', 'FL(1)', 'BL(2)', 'BR(3)'], rows)

# slot meaning check by cube simulation
L = SLOTS
agree = Counter()
detail = Counter()
for si, (ri, r, st) in enumerate(sol):
    d = r['detail']
    toks = d['solutionSequence']
    cube = cs.apply(cs.SOLVED, d['scramble'].split())
    try:
        if not cs.solved_up_to_orientation(cs.apply(cube, [m['sliceTurn'] for m in toks])):
            agree['replay_fail'] += 1
            continue
    except ValueError:
        agree['replay_fail'] += 1
        continue
    idx = 0

    def adv(cube, idx, t):
        while idx < len(toks) and toks[idx]['timeStamp'] <= t:
            cube = cs.move(cube, toks[idx]['sliceTurn'])
            idx += 1
        return cube, idx

    cube, idx = adv(cube, idx, st[0]['end'])
    if not cs.cross_down_solved(cube):
        agree['cross_not_down'] += 1
        continue
    prev = cs.solved_slots(cube)
    for k in range(1, 5):
        x = st[k]
        start_cube = cube
        cube, idx = adv(cube, idx, x['end'])
        cur = cs.solved_slots(cube)
        new = [l for l in cur if l not in prev]
        prev = cur
        if not x['moves'] or len(new) != 1:
            agree['skip_pair'] += 1
            continue
        nr = sum(1 for m in x['moves'] if ROT_RE.match(m['sliceTurn']))
        wide = any(m['sliceTurn'][0] in 'udlrfbMES' for m in x['moves'])
        grp = 'no rotation, no wide' if not nr and not wide else 'no rotation, wide' if not nr else 'rotation token(s)'
        lab_start = cs.label_of(start_cube, cur[new[0]])
        lab_end = new[0]
        si_lab = L[x['slotIndex']]
        detail[(grp, k, 'start-frame', lab_start == si_lab)] += 1
        detail[(grp, k, 'end-frame', lab_end == si_lab)] += 1
rows = []
J6['slot_sim'] = {}
for grp in ('no rotation, no wide', 'no rotation, wide', 'rotation token(s)'):
    for fr in ('start-frame', 'end-frame'):
        hit = sum(v for (g, k, f, ok), v in detail.items() if g == grp and f == fr and ok)
        tot = sum(v for (g, k, f, ok), v in detail.items() if g == grp and f == fr)
        if grp == 'no rotation, no wide' and fr == 'end-frame':
            continue
        r_ = [grp, fr if grp != 'no rotation, no wide' else 'start = end frame', tot, '%.1f%%' % (100 * hit / tot) if tot else '']
        for k in range(1, 5):
            h = detail[(grp, k, fr, True)]
            t_ = h + detail[(grp, k, fr, False)]
            r_.append('%.0f%% (%d)' % (100 * h / t_, t_) if t_ else '')
        rows.append(r_)
        J6['slot_sim'][grp + '|' + fr] = {'pairs': tot, 'agree': hit}
table('6d. Does slotIndex equal the physical slot in the solver frame? (cube simulation)', 'Each pair\'s newly solved slot was found by replaying acubemy\'s reconstructed solution (rotations and wide moves included) on the scrambled cube; slot label (FR/FL/BL/BR, cross on D, front = F center in the solver frame at the stated moment) compared with F2L_SLOT_LABELS[slotIndex]. Cells = share agreeing (pairs). %d solves failed replay, %d replayed but cross not on D after cross stage.' % (agree['replay_fail'], agree['cross_not_down']),
      ['pair group', 'frame', 'pairs', 'agree', 'pos 1', 'pos 2', 'pos 3', 'pos 4'], rows)
J6['slot_sim']['replay_fail'] = agree['replay_fail']
J['6_slot'] = J6

# 7 ---------------------------------------------------------------
J7 = {}
order = np.argsort(TOT, kind='stable')
quint = np.zeros(nS, int)
for q in range(5):
    quint[order[q * nS // 5:(q + 1) * nS // 5]] = q
rows = []
for q in range(5):
    m = quint == q
    rows.append([q + 1, int(m.sum()), '%s-%s' % (s2(TOT[m].min()), s2(TOT[m].max())), '%s / %s' % (s2(med(F2L_T[m])), s2(mean(F2L_T[m]))), s2(mean(F2L_R[m])), s2(mean(F2L_E[m])), f2(mean(F2L_M[m])),
                 f2(mean(F2L_ROT[m])), f2(mean(F2L_DU[m])), f2(mean(SG[('gA', 700, 'n')][m])), f2(mean(SG[('gB', 700, 'n')][m])), s2(mean(SG[('gB', 400, 's')][m])), '%.1f%%' % (100 * F2L_T[m].sum() / TOT[m].sum())])
    J7['Q%d' % (q + 1)] = {'n': int(m.sum()), 'total_range_s': [TOT[m].min() / 1000, TOT[m].max() / 1000], 'f2l_median': med(F2L_T[m]) / 1000, 'f2l_mean': mean(F2L_T[m]) / 1000, 'rec_mean': mean(F2L_R[m]) / 1000, 'exe_mean': mean(F2L_E[m]) / 1000,
                           'moves_mean': mean(F2L_M[m]), 'rots_mean': mean(F2L_ROT[m]), 'gapsB700_mean': mean(SG[('gB', 700, 'n')][m]), 'f2l_share': float(F2L_T[m].sum() / TOT[m].sum())}
table('7a. F2L by totalTime quintile (Q1 fastest)', 'n = solves per quintile; total range in s; F2L time median / mean s; rec, exe = mean sum over 4 pairs (s); moves, rots, d/u = mean per solve; gaps>700 A/B = mean mid-pair gaps >700 ms per solve (A all after first move, B after recognition end); sec>400 B = mean seconds in B gaps >400 ms; F2L share = sum F2L / sum total.',
      ['Q', 'n', 'total s', 'F2L time', 'rec', 'exe', 'moves', 'rots', 'd/u', 'gaps>700 A', 'gaps>700 B', 'sec>400 B', 'F2L share'], rows)
rows = []
SP = np.array([[P[s * 4 + k]['time'] for k in range(4)] for s in range(nS)], float)
SR = np.array([[P[s * 4 + k]['rec'] for k in range(4)] for s in range(nS)], float)
SE = np.array([[P[s * 4 + k]['exe'] for k in range(4)] for s in range(nS)], float)
SM = np.array([[P[s * 4 + k]['mv'] for k in range(4)] for s in range(nS)], float)
best = None
for k in range(4):
    for name, a in (('time', SP / 1000), ('rec', SR / 1000), ('exe', SE / 1000), ('moves', SM)):
        f, sl_ = a[quint == 0, k], a[quint == 4, k]
        d = mean(sl_) - mean(f)
        ci = grp_ci(sl_, f, SEED + 10 * k + len(name))
        rows.append([labels[k], name, f2(mean(f)), f2(mean(sl_)), ci_str(d, ci), f2(mean(sl_) / mean(f) if mean(f) else np.nan)])
        J7['Q5-Q1_%s_%s' % (labels[k], name)] = {'q1_mean': mean(f), 'q5_mean': mean(sl_), 'diff': d, 'ci': ci}
table('7b. Slowest minus fastest quintile, per pair position (zero-move pairs count as 0)', 'n = %d solves in Q1 (fastest) and %d in Q5 (slowest).' % (int((quint == 0).sum()), int((quint == 4).sum())) + ' Mean per-position time/rec/exe in s, moves in count; diff = Q5 - Q1 with bootstrap 95% CI; ratio = Q5/Q1.',
      ['pair', 'metric', 'Q1 mean', 'Q5 mean', 'Q5-Q1 [95% CI]', 'ratio'], rows)
J['7_quintiles'] = J7

# 8 ---------------------------------------------------------------
J8 = {}
rows = []
nb = (nS + 99) // 100
for b in range(nb):
    sl_ = slice(b * 100, min(nS, (b + 1) * 100))
    dates = [sol[s][1]['detail']['date'][5:10] for s in range(sl_.start, sl_.stop)]
    rows.append([b + 1, sl_.stop - sl_.start, '%s..%s' % (dates[0], dates[-1]), '%s / %s' % (s2(med(TOT[sl_])), s2(mean(TOT[sl_]))), '%s / %s' % (s2(med(F2L_T[sl_])), s2(mean(F2L_T[sl_]))), s2(mean(F2L_R[sl_])), s2(mean(F2L_E[sl_])),
                 f2(mean(F2L_M[sl_])), f2(mean(F2L_ROT[sl_])), f2(mean(F2L_DU[sl_])), f2(mean(SG[('gB', 700, 'n')][sl_])), '%.1f%%' % (100 * F2L_R[sl_].sum() / F2L_T[sl_].sum())])
    J8['block%d' % (b + 1)] = {'n': sl_.stop - sl_.start, 'f2l_median': med(F2L_T[sl_]) / 1000, 'f2l_mean': mean(F2L_T[sl_]) / 1000, 'rec_mean': mean(F2L_R[sl_]) / 1000, 'exe_mean': mean(F2L_E[sl_]) / 1000,
                               'moves_mean': mean(F2L_M[sl_]), 'rots_mean': mean(F2L_ROT[sl_]), 'total_median': med(TOT[sl_]) / 1000}
table('8a. Blocks of 100 solves, oldest to newest', 'Block of 100 CFOP solves in date order (last block has %d); dates MM-DD; total and F2L time median / mean s; rec, exe = mean seconds summed over the 4 pairs; moves, rots, d/u = mean per solve; gaps>700 B = mean mid-pair gaps >700 ms after recognition end per solve; rec share = pooled recognition / F2L time.' % (nS - 100 * (nb - 1)),
      ['block', 'n', 'dates', 'total', 'F2L time', 'rec', 'exe', 'moves', 'rots', 'd/u', 'gaps>700 B', 'rec share'], rows)
rows = []
ordr = np.arange(nS, dtype=float)
for lab, a in (('F2L time', F2L_T), ('F2L recognition', F2L_R), ('F2L execution', F2L_E), ('F2L moves', F2L_M), ('F2L rots', F2L_ROT), ('total time', TOT)):
    r_ = spearman(ordr, a)
    ci = sv_ci(lambda idx, a=a: spearman(ordr[idx], a[idx]))
    rows.append([lab, nS, ci_str(r_, ci, f3)])
    J8['trend_' + lab] = {'rho': r_, 'ci': ci}
table('8b. Trend over solve order (Spearman)', 'rho between chronological solve index and the metric; n = solves; bootstrap 95% CI over solves. Solves in one session are autocorrelated, so the CI is optimistic.', ['metric', 'n', 'rho [95% CI]'], rows)
J['8_trend'] = J8

# 9 ---------------------------------------------------------------
worst = sorted([i for i in range(len(P)) if P[i]['has']], key=lambda i: -P[i]['time'])[:20]
lines = ['# 20 worst F2L pairs by pair time', '', 'Sequence tokens are acubemy reconstruction in the solver frame, `token@ms` with ms since solve start; rotations share timestamps with neighbouring moves. Times in s. rec/exe = acubemy recognition/execution split. Pair start (ms) = end of previous stage.', '']
J9 = []
for r_, i in enumerate(worst, 1):
    p = P[i]
    cinfo = CASES.get(p['case'], {})
    lines.append('%d. %s | solve %s | pair %d | caseIndex %d (%s, %s) | slotIndex %d (%s) | time %s s (rec %s, exe %s) | %d moves, %d rots | pair start %d ms' % (
        r_, p['date'], p['uuid'], p['pos'], p['case'], cinfo.get('name', '?'), cinfo.get('type', '?'), p['slot'], SLOTS[p['slot']], s2(p['time']), s2(p['rec']), s2(p['exe']), p['mv'], p['rot'], p['start']))
    lines.append('   `%s`' % ' '.join('%s@%d' % (n, t) for n, t in p['toks']))
    J9.append({'rank': r_, 'date': p['date'], 'uuid': p['uuid'], 'pos': p['pos'], 'case': p['case'], 'slot': p['slot'], 'time_s': p['time'] / 1000, 'rec_s': p['rec'] / 1000, 'exe_s': p['exe'] / 1000,
               'moves': [[n, t] for n, t in p['toks']]})
open(os.path.join(OUT, 'f2l-worst.md'), 'w').write('\n'.join(lines) + '\n')
J['9_worst'] = J9

# 10 --------------------------------------------------------------
J10 = {}
pi, pj = [], []
for s in range(nS):
    for k in range(3):
        a, b = s * 4 + k, s * 4 + k + 1
        if P[a]['has'] and P[b]['has'] and P[a]['tps'] is not None:
            pi.append(a)
            pj.append(b)
pi, pj = np.array(pi), np.array(pj)
PAIRPOS = POS[pi]
TPSa = tps_arr[pi]


def pair_stat(fn, idx_s):
    cnt = np.zeros(nS, int)
    return fn


sel = np.zeros(len(P), bool)
rows = []
sol_of = SID[pi]
byS = defaultdict(list)
for q, s in enumerate(sol_of):
    byS[s].append(q)
off = [np.array(byS.get(s, []), int) for s in range(nS)]


def resample_q(sids):
    parts = [off[s] for s in sids]
    return np.concatenate(parts) if parts else np.array([], int)


def cl_ci_q(fn):
    v = []
    for b in range(B):
        q = resample_q(SIDS[b])
        v.append(fn(q))
    return (float(np.nanpercentile(v, 2.5)), float(np.nanpercentile(v, 97.5)))


for lab, x in (('pair N time', T[pi]), ('pair N execution', EXE[pi]), ('pair N moves', MV[pi].astype(float)), ('pair N exec TPS', TPSa), ('pair N recognition', REC[pi])):
    for sub, mk in (('N=1,2,3 pooled', np.ones(len(pi), bool)), ('N=1', PAIRPOS == 1), ('N=2', PAIRPOS == 2), ('N=3', PAIRPOS == 3)):
        if lab == 'pair N recognition' and sub != 'N=1,2,3 pooled':
            continue
        r_ = spearman(x[mk], REC[pj][mk])
        ci = cl_ci_q(lambda q, x=x, mk=mk: spearman(x[q][mk[q]], REC[pj][q][mk[q]]))
        rows.append([lab, sub, nflag(int(mk.sum())), ci_str(r_, ci, f3)])
        J10['spearman_%s_%s' % (lab, sub)] = {'rho': r_, 'ci': ci, 'n': int(mk.sum())}
table('10a. Spearman of pair N vs recognition of pair N+1', 'Consecutive pairs in the same solve, both with moves; n = (N, N+1) couples. rho between the row metric of pair N and recognition of pair N+1; cluster-bootstrap 95% CI over solves. Negative rho for execution / time would mean slower pair N goes with shorter next recognition (look-ahead).',
      ['x (pair N)', 'subset', 'n', 'rho [95% CI]'], rows)
cuts = np.percentile(TPSa, [100 / 3, 200 / 3])
terc = np.digitize(TPSa, cuts)
rows = []
for t_ in range(3):
    m = terc == t_
    rows.append(['T%d (%s)' % (t_ + 1, ['slowest', 'middle', 'fastest'][t_]), nflag(int(m.sum())), '%s-%s' % (f2(TPSa[m].min()), f2(TPSa[m].max())), f2(med(EXE[pi][m] / 1000)), f2(med(MV[pi][m])), '%s / %s' % (s2(med(REC[pj][m])), s2(mean(REC[pj][m]))), s2(mean(T[pj][m]))])
    J10['tercile_%d' % (t_ + 1)] = {'n': int(m.sum()), 'tps_range': [float(TPSa[m].min()), float(TPSa[m].max())], 'next_rec_median': med(REC[pj][m]) / 1000, 'next_rec_mean': mean(REC[pj][m]) / 1000}
table('10b. Recognition of pair N+1 by execution-TPS tercile of pair N', 'Terciles of pair N execution TPS (pooled over N=1,2,3; n = couples; cut points %s and %s tps). median exe (s) and median moves of pair N; recognition of pair N+1 median / mean (s); mean time of pair N+1 (s).' % (f2(cuts[0]), f2(cuts[1])),
      ['tercile', 'n', 'TPS range', 'N med exe', 'N med moves', 'rec N+1 med / mean', 'time N+1 mean'], rows)


def tdiff(q, a, b):
    m1 = terc[q] == a
    m0 = terc[q] == b
    if m1.sum() < 2 or m0.sum() < 2:
        return float('nan')
    return float(REC[pj][q][m1].mean() - REC[pj][q][m0].mean()) / 1000


notes = []
for a, b, lab in ((2, 0, 'fastest tercile minus slowest'), (1, 0, 'middle minus slowest')):
    d = tdiff(np.arange(len(pi)), a, b)
    ci = cl_ci_q(lambda q, a=a, b=b: tdiff(q, a, b))
    notes.append('%s %s s' % (lab, ci_str(d, ci)))
    J10['diff_' + lab] = {'diff_s': d, 'ci': ci}
MD.append('')
MD.append('Mean recognition of pair N+1, difference between TPS terciles of pair N (s, cluster-bootstrap 95%% CI): %s.' % '; '.join(notes))
for k in (1, 2, 3):
    J10['by_pos_%d' % k] = [s2(med(REC[pj][(PAIRPOS == k) & (terc == t_)])) for t_ in range(3)]
rows = []
for k in (1, 2, 3):
    mk = PAIRPOS == k
    cuts_k = np.percentile(TPSa[mk], [100 / 3, 200 / 3])
    tk = np.digitize(TPSa[mk], cuts_k)
    r2 = ['N=%d' % k]
    for t_ in range(3):
        m = tk == t_
        r2.append('%s (n=%d)' % (s2(med(REC[pj][mk][m])), m.sum()))
    rows.append(r2)
    J10['within_pos_%d' % k] = r2
table('10c. Median recognition of pair N+1 by TPS tercile of pair N, within N', 'Terciles computed within each N (removes position effects); cell = median recognition of pair N+1 in s (n = couples).', ['N', 'T1 slowest', 'T2 middle', 'T3 fastest'], rows)
J['10_dependence'] = J10

# fast/slow overall facts used by the coach
J['solver_median_pair_time_s'] = M0 / 1000
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'f2l.md'), 'w').write('\n'.join(MD) + '\n')


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        return None if np.isnan(o) else round(float(o), 5)
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


json.dump(clean(J), open(os.path.join(OUT, 'f2l.json'), 'w'), indent=1)
print('md lines', len(MD) + 0, 'written')
