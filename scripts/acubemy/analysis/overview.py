import sys, os, json, math, datetime as dt, collections
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib
from lib import load, load_export, stages, RAW, OUT

B = 2000
SEED = 20261120
rng = np.random.default_rng(SEED)
J = {'meta': {'bootstrap_resamples': B, 'seed': SEED, 'tz': 'UTC+9', 'time_unit_in_json': 'seconds (2dp) unless a key says ms',
              'ci': 'percentile 95% bootstrap; whole-sitting (cluster) resampling unless marked iid'}}
MD = []
STN = lib.STAGES
EK = ['cross', 'f2l_pair1', 'f2l_pair2', 'f2l_pair3', 'f2l_pair4', 'oll', 'pll']
TZ = dt.timedelta(hours=9)
GAP = 600


def S(ms):
    return round(float(ms) / 1000, 2)


def fm(v):
    return f"{v / 1000:.2f}"


def fci(c, d=2, sc=1000.0):
    return f"[{c[0] / sc:.{d}f}, {c[1] / sc:.{d}f}]"


def fdc(v, c, d=2, sc=1000.0):
    return f"{v / sc:+.{d}f} {fci(c, d, sc)}"


def sci(c):
    return [S(c[0]), S(c[1])]


def low(n):
    return f"{n} LOW-N" if n < 30 else f"{n}"


def ci(v):
    v = np.asarray(v, float)
    v = v[~np.isnan(v)]
    lo, hi = np.percentile(v, [2.5, 97.5])
    return (float(lo), float(hi))


def desc(x):
    x = np.asarray(x, float)
    return {'n': len(x), 'mean': float(x.mean()), 'median': float(np.median(x)), 'sd': float(x.std(ddof=1)) if len(x) > 1 else float('nan'),
            'min': float(x.min()), 'max': float(x.max())}


def sec(t):
    MD.append(f"## {t}")


def table(title, defs, header, rows):
    MD.append(f"**{title}** — {defs}")
    MD.append("| " + " | ".join(header) + " |")
    MD.append("|" + "|".join(["---"] * len(header)) + "|")
    for r in rows:
        MD.append("| " + " | ".join(str(c) for c in r) + " |")
    MD.append("")


def iid_counts(n):
    idx = rng.integers(0, n, (B, n))
    flat = (idx + np.arange(B)[:, None] * n).ravel()
    return np.bincount(flat, minlength=B * n).reshape(B, n).astype(float)


def cluster_counts(sid):
    return iid_counts(int(sid.max()) + 1)[:, sid]


def block_counts(m, L=25):
    nb = math.ceil(m / L)
    st = rng.integers(0, m, (B, nb))
    idx = ((st[:, :, None] + np.arange(L)) % m).reshape(B, -1)
    flat = (idx + np.arange(B)[:, None] * m).ravel()
    return np.bincount(flat, minlength=B * m).reshape(B, m).astype(float)


def wmean(W, x, mask=None):
    if mask is not None:
        W = W[:, mask]
        x = x[mask]
    return (W @ x) / W.sum(1)


def wmean_mat(W, X, mask):
    Wg = W[:, mask]
    return (Wg @ X[mask]) / Wg.sum(1)[:, None]


def wmedian(W, x, mask=None):
    if mask is not None:
        W = W[:, mask]
        x = x[mask]
    o = np.argsort(x, kind='stable')
    xs = x[o]
    cs = np.cumsum(W[:, o], axis=1)
    tot = cs[:, -1]
    i = (cs >= (tot / 2)[:, None]).argmax(1)
    r = xs[i]
    r = np.where(tot > 0, r, np.nan)
    return r


def wslope(W, t, y):
    N = W.sum(1)
    mt = (W @ t) / N
    my = (W @ y) / N
    cov = (W @ (t * y)) / N - mt * my
    vt = (W @ (t * t)) / N - mt ** 2
    return cov / vt


def wcorr(W, x, y):
    N = W.sum(1)
    mx = (W @ x) / N
    my = (W @ y) / N
    cov = (W @ (x * y)) / N - mx * my
    vx = (W @ (x * x)) / N - mx ** 2
    vy = (W @ (y * y)) / N - my ** 2
    return cov / np.sqrt(vx * vy)


class Ranker:
    def __init__(s, x):
        s.o = np.argsort(x, kind='stable')
        xs = x[s.o]
        n = len(x)
        ng = np.r_[True, xs[1:] != xs[:-1]]
        gid = np.cumsum(ng) - 1
        st = np.flatnonzero(ng)
        en = np.r_[st[1:] - 1, n - 1]
        s.gs = st[gid]
        s.ge = en[gid]

    def __call__(s, W):
        cs = np.cumsum(W[:, s.o], axis=1)
        below = np.where(s.gs > 0, cs[:, np.maximum(s.gs - 1, 0)], 0.0)
        tie = cs[:, s.ge] - below
        r = np.empty_like(cs)
        r[:, s.o] = below + (tie + 1) / 2
        return r


def spearman(W, x, y):
    rx = Ranker(x)(W)
    ry = Ranker(y)(W)
    N = W.sum(1)
    mx = (W * rx).sum(1) / N
    my = (W * ry).sum(1) / N
    cov = (W * rx * ry).sum(1) / N - mx * my
    vx = (W * rx * rx).sum(1) / N - mx ** 2
    vy = (W * ry * ry).sum(1) / N - my ** 2
    return cov / np.sqrt(vx * vy)


def sp_ci(W, x, y):
    p = float(spearman(np.ones((1, len(x))), x, y)[0])
    b = spearman(W, x, y)
    return p, ci(b)


def slope_pt(t, y):
    return float(wslope(np.ones((1, len(t))), t, y)[0])


def groupdiff(W, y, ma, mb):
    d = {'nA': int(ma.sum()), 'nB': int(mb.sum())}
    d['mean_diff'] = float(y[ma].mean() - y[mb].mean())
    d['mean_ci'] = ci(wmean(W, y, ma) - wmean(W, y, mb))
    d['median_diff'] = float(np.median(y[ma]) - np.median(y[mb]))
    d['median_ci'] = ci(wmedian(W, y, ma) - wmedian(W, y, mb))
    return d


def sitting_ids(ts):
    return np.r_[0, np.cumsum(np.diff(ts) > GAP)].astype(int)


def pdt(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))


def ld(u):
    return (u + TZ).strftime('%Y-%m-%d')


def ldt(u):
    return (u + TZ).strftime('%m-%d %H:%M')


np.seterr(all='ignore')
R = load()
n = len(R)
D = [r['detail'] for r in R]
tot = np.array([d['totalTime'] for d in D], float)
turns = np.array([d['turnCount'] for d in D], float)
tps = np.array([d['tps'] for d in D], float)
flu = np.array([d['fluencyPercent'] for d in D], float)
insp = np.array([d['inspectionTime'] for d in D], float)
utc = [pdt(d['date']) for d in D]
ts = np.array([u.timestamp() for u in utc])
assert (np.diff(ts) >= 0).all()
cf = np.array([d['analysis']['type'] == 'CFOP' for d in D])
cfi = np.flatnonzero(cf)
ncf = int(cf.sum())
ST = np.full((n, 7), np.nan)
REC = np.full((n, 7), np.nan)
EXE = np.full((n, 7), np.nan)
for i in cfi:
    for k, s in enumerate(stages(R[i])):
        ST[i, k], REC[i, k], EXE[i, k] = s['time'], s['recognition'], s['execution']
    REC[i, 0] = ST[i, 0] - EXE[i, 0]
STc, RECc, EXEc = ST[cf], REC[cf], EXE[cf]
assert not np.isnan(STc).any() and not np.isnan(RECc).any() and not np.isnan(EXEc).any()
dq = {}
dq['non_cfop'] = [(int(i), D[i]['analysis']['type'], int(tot[i])) for i in np.flatnonzero(~cf)]
dq['rec_plus_exe_ne_time_stages_before_cross_derivation'] = int((np.abs(np.where(np.arange(7) == 0, 0, RECc) + EXEc - STc) > 0).sum())
dq['rec_plus_exe_ne_time_stages'] = int((np.abs(RECc + EXEc - STc) > 0).sum())
dq['stage_sum_ne_total_solves'] = int((np.abs(STc.sum(1) - tot[cf]) > 0).sum())
dq['zero_time_stage_counts'] = {STN[k]: int((STc[:, k] == 0).sum()) for k in range(7)}
dq['cross_recognition_derived_nonzero_n'] = int((RECc[:, 0] > 0).sum())
dq['cross_recognition_derived_max_s'] = S(RECc[:, 0].max())
dq['cross_recognition_derived_sum_s'] = S(RECc[:, 0].sum())
dq['f2l_solves_with_4_distinct_slotIndex'] = int(sum(len({s['slotIndex'] for s in stages(R[i])[1:5]}) == 4 for i in cfi))
dq['inspection_gt_60s'] = int((insp > 60000).sum())
dq['inspection_gt_30s'] = int((insp > 30000).sum())
dq['flags'] = dict(collections.Counter(d['flag'] for d in D))
dq['sessions_in_1000'] = dict(collections.Counter(d['session']['name'] for d in D))
dq['session_inspection_flag'] = sorted({d['session']['inspectionTime'] for d in D})
dq['devices_in_1000'] = dict(collections.Counter(d['usedDevice']['deviceId'] for d in D))
recS = np.where(cf, REC.sum(1), np.nan)
exeS = np.where(cf, EXE.sum(1), np.nan)
f2lS = np.where(cf, ST[:, 1:5].sum(1), np.nan)
sid = sitting_ids(ts)
nsit = int(sid.max()) + 1
Wi = iid_counts(n)
Wc = cluster_counts(sid)
Wc_cf = Wc[:, cf]
Wi_cf = Wi[:, cf]
t100 = np.arange(n) / 100.0
tday = (ts - ts[0]) / 86400.0
dq['n_sittings'] = nsit
J['data_quality'] = dq

EX = sorted(load_export(), key=lambda e: e['date'])
newest = sorted(EX, key=lambda e: e['date'], reverse=True)[:1000]
dq['newest1000_of_export_equals_the_1000'] = set(e['scramble'] for e in newest) == set(d['scramble'] for d in D)
dq['export_newest1000_not_in_the_1000'] = [(e['date'], e['session_name']) for e in newest if e['scramble'] not in set(d['scramble'] for d in D)]
dq['the_1000_not_in_export_newest1000'] = [d['date'] for d in D if d['scramble'] not in set(e['scramble'] for e in newest)]
dq['export_newest1000_sessions'] = dict(collections.Counter(e['session_name'] for e in newest))

MD.append("# Overview analysis: last 1000 smart-cube solves (CFOP, acubemy)")
MD.append(f"Times in seconds (2dp). Local time = UTC+9. All CI: 95% percentile bootstrap, {B} resamples, seed {SEED}; resampling whole sittings (gap>10 min) so serial dependence is kept, unless marked iid. LOW-N = n<30. 2 non-CFOP solves (1 Roux, 1 ZZ) are excluded from every stage-level number (stage n={ncf}); totalTime/turn/tps/fluency/inspection-only tables use all 1000 where stated. Totals are raw totalTime (the 1 plus_two solve is not +2'd).")
MD.append("")

sec("1. Distribution of totalTime (n=1000)")
dd = desc(tot)
pc = {p: float(np.percentile(tot, p)) for p in range(10, 100, 10)}
J['s1'] = {'total': {k: (S(v) if k != 'n' else v) for k, v in dd.items()}, 'deciles': {str(p): S(v) for p, v in pc.items()}}
table("T1a totalTime distribution", "n; mean; median; sd; min; max; p10..p90 = deciles (linear interpolation), all in s",
      ['n', 'mean', 'median', 'sd', 'min', 'max'] + [f"p{p}" for p in pc],
      [[dd['n'], fm(dd['mean']), fm(dd['median']), fm(dd['sd']), fm(dd['min']), fm(dd['max'])] + [fm(v) for v in pc.values()]])
thr = [('sub15', tot < 15000), ('sub18', tot < 18000), ('sub20', tot < 20000), ('over25', tot > 25000)]
J['s1']['thresholds'] = {k: {'n': int(m.sum()), 'pct': round(100 * float(m.mean()), 1)} for k, m in thr}
nplus = int(sum(d['flag'] == 'plus_two' for d in D))
ndnf = int(sum(d['flag'] == 'dnf' for d in D))
J['s1']['plus2'] = nplus
J['s1']['dnf'] = ndnf
table("T1b threshold shares", "each cell = count (percent of 1000) with strict inequality (<15.00, <18.00, <20.00, >25.00 s); +2 / DNF = solves with flag plus_two / dnf",
      ['sub-15', 'sub-18', 'sub-20', 'over-25', '+2', 'DNF'],
      [[f"{int(m.sum())} ({100 * m.mean():.1f}%)" for _, m in thr] + [nplus, ndnf]])


def roll(x, N):
    k = math.ceil(0.05 * N)
    w = np.lib.stride_tricks.sliding_window_view(x, N)
    s = np.sort(w, axis=1)
    return s[:, k:N - k].mean(1), s.mean(1), k


best_rows = []
J['s1']['best'] = {'single': {'value': S(tot.min()), 'date': ld(utc[int(tot.argmin())]), 'index': int(tot.argmin())}}
best_rows.append(['single', fm(tot.min()), ld(utc[int(tot.argmin())]), '-', fm(tot[-1]), '-', '-', '-'])
for N in (5, 12, 50, 100):
    tr, un, k = roll(tot, N)
    e = int(tr.argmin())
    e2 = int(un.argmin())
    J['s1']['best'][f'ao{N}'] = {'trim_each_side': k, 'best_trimmed': S(tr.min()), 'best_end_index': e, 'best_end_date': ld(utc[e + N - 1]), 'current_trimmed': S(tr[-1]),
                                 'best_untrimmed_mean': S(un.min()), 'current_untrimmed_mean': S(un[-1])}
    best_rows.append([f"ao{N}", fm(tr.min()), f"{ld(utc[e])}..{ld(utc[e + N - 1])}", k, fm(tr[-1]), fm(un.min()), fm(un[-1]), ''])
table("T1c best and current", "best = best rolling window of that size over the 1000 in date order (trimmed mean: drop k fastest + k slowest, k=ceil(5% of N), i.e. WCA rule: ao5 k=1, ao12 k=1, ao50 k=3, ao100 k=5); dates = first..last solve of best window; current = latest window (ending at newest solve); mean-of-N = untrimmed mean of same window (best / current)",
      ['stat', 'best (s)', 'best window dates', 'k', 'current (s)', 'best mean-of-N', 'current mean-of-N'], [r[:7] for r in best_rows])

sec("2. Trend across the 1000 (oldest -> newest)")
blk = np.arange(n) // 100
rows_a, rows_b = [], []
J['s2'] = {'blocks': []}
for b in range(10):
    m = blk == b
    mc = m & cf
    rec = {'block': b + 1, 'n': int(m.sum()), 'n_cfop': int(mc.sum()), 'dates': f"{ld(utc[int(np.flatnonzero(m)[0])])}..{ld(utc[int(np.flatnonzero(m)[-1])])}",
           'total_mean': S(tot[m].mean()), 'total_median': S(np.median(tot[m]))}
    for k in range(7):
        rec[f'{STN[k]}_mean'] = S(ST[mc, k].mean())
        rec[f'{STN[k]}_median'] = S(np.median(ST[mc, k]))
    for nm, arr, mm in (('rec_sum', recS, mc), ('exe_sum', exeS, mc), ('turns', turns, m), ('tps', tps, m), ('fluency', flu, m), ('inspection', insp, m)):
        sc = 1 if nm in ('turns', 'tps', 'fluency') else 1000
        rec[nm + '_mean'] = round(float(arr[mm].mean()) / sc, 2)
        rec[nm + '_median'] = round(float(np.median(arr[mm])) / sc, 2)
    J['s2']['blocks'].append(rec)
    rows_a.append([b + 1, rec['dates'], rec['n_cfop'], fm(tot[m].mean()), fm(np.median(tot[m]))] + [fm(ST[mc, k].mean()) for k in range(7)])
    rows_b.append([b + 1] + [fm(np.median(ST[mc, k])) for k in range(7)] + [f"{fm(recS[mc].mean())}/{fm(np.median(recS[mc]))}", f"{fm(exeS[mc].mean())}/{fm(np.median(exeS[mc]))}",
                   f"{turns[m].mean():.1f}/{np.median(turns[m]):.0f}", f"{tps[m].mean():.2f}/{np.median(tps[m]):.2f}", f"{flu[m].mean():.1f}/{np.median(flu[m]):.0f}", f"{fm(insp[m].mean())}/{fm(np.median(insp[m]))}"])
table("T2a blocks of 100 (block 1 = oldest): totals and stage means", "block; local dates; n_cfop = CFOP solves in block (stage columns use these; total columns use all solves in block); total mean/median; cross..pll = mean stage time",
      ['blk', 'dates', 'n_cfop', 'tot mean', 'tot med'] + STN, rows_a)
table("T2b blocks of 100: stage medians, recognition/execution, turns, tps, fluency, inspection", "cross..pll = median stage time; rec / exe = per-solve sum over 7 stages (cross recognition = cross_time - cross_execution_time, derived); each rec/exe/turns/tps/flu/insp cell = mean/median over the block (turns = turnCount, flu = fluencyPercent, insp = inspectionTime s; turns/tps/flu/insp use all solves in block)",
      ['blk'] + STN + ['rec', 'exe', 'turns', 'tps', 'flu', 'insp'], rows_b)

series = [('total (n=1000)', tot, np.ones(n, bool), 1000)]
for k in range(7):
    series.append((STN[k], ST[:, k], cf, 1000))
series += [('rec sum', recS, cf, 1000), ('exe sum', exeS, cf, 1000), ('turnCount', turns, np.ones(n, bool), 1), ('tps', tps, np.ones(n, bool), 1),
           ('fluency %', flu, np.ones(n, bool), 1), ('inspection s (all)', insp, np.ones(n, bool), 1000), ('inspection s (<=60s)', insp, insp <= 60000, 1000)]
rows_s = []
J['s2']['slopes'] = {}
for nm, y, m, sc in series:
    yy, tt, wi, wc = y[m], t100[m], Wi[:, m], Wc[:, m]
    td = tday[m]
    sl = slope_pt(tt, yy)
    sd_ = slope_pt(td, yy)
    ci_i = ci(wslope(wi, tt, yy))
    ci_c = ci(wslope(wc, tt, yy))
    ci_d = ci(wslope(wc, td, yy))
    ma = (blk == 9)[m]
    mb = (blk == 0)[m]
    gd = groupdiff(wc, yy, ma, mb)
    J['s2']['slopes'][nm] = {'n': int(m.sum()), 'mean': round(float(yy.mean()) / sc, 3), 'median': round(float(np.median(yy)) / sc, 3),
                             'slope_per_100': round(sl / sc, 3), 'slope_per_100_ci_cluster': [round(ci_c[0] / sc, 3), round(ci_c[1] / sc, 3)], 'slope_per_100_ci_iid': [round(ci_i[0] / sc, 3), round(ci_i[1] / sc, 3)],
                             'slope_per_day': round(sd_ / sc, 3), 'slope_per_day_ci_cluster': [round(ci_d[0] / sc, 3), round(ci_d[1] / sc, 3)],
                             'median_diff_last100_minus_first100': round(gd['median_diff'] / sc, 3), 'median_diff_ci': [round(gd['median_ci'][0] / sc, 3), round(gd['median_ci'][1] / sc, 3)],
                             'mean_diff_last100_minus_first100': round(gd['mean_diff'] / sc, 3), 'mean_diff_ci': [round(gd['mean_ci'][0] / sc, 3), round(gd['mean_ci'][1] / sc, 3)]}
    f = lambda v: f"{v / sc:.2f}"
    rows_s.append([nm, int(m.sum()), f(yy.mean()), f"{sl / sc:+.2f} {fci(ci_c, 2, sc)}", fci(ci_i, 2, sc), f"{sd_ / sc:+.2f} {fci(ci_d, 2, sc)}", f"{gd['median_diff'] / sc:+.2f} {fci(gd['median_ci'], 2, sc)}"])
table("T2d linear trend (OLS)", "n; mean; slope per 100 solves (s, or unit of the row: turns, tps, %, s) with sitting-cluster CI; iid CI of same slope; slope per calendar day (elapsed time, sitting-cluster CI); median(last 100) minus median(first 100) with CI. Negative = faster/lower",
      ['series', 'n', 'mean', 'slope/100 [CI cluster]', 'CI iid', 'slope/day [CI cluster]', 'med last100 - first100 [CI]'], rows_s)

loc_day = np.array([ld(u) for u in utc])
days = sorted(set(loc_day))
rows_d = []
J['s2']['by_day'] = []
for dd_ in days:
    m = loc_day == dd_
    mc = m & cf
    rec = {'day': dd_, 'n': int(m.sum()), 'n_cfop': int(mc.sum()), 'total_mean': S(tot[m].mean()), 'total_median': S(np.median(tot[m]))}
    for k in range(7):
        rec[STN[k] + '_mean'] = S(ST[mc, k].mean()) if mc.any() else None
    rec.update({'rec_sum_mean': S(recS[mc].mean()), 'exe_sum_mean': S(exeS[mc].mean()), 'turns_mean': round(float(turns[m].mean()), 1), 'tps_mean': round(float(tps[m].mean()), 2),
                'fluency_mean': round(float(flu[m].mean()), 1), 'inspection_median': S(np.median(insp[m]))})
    J['s2']['by_day'].append(rec)
    rows_d.append([dd_, low(rec['n']), fm(tot[m].mean()), fm(np.median(tot[m]))] + [fm(ST[mc, k].mean()) for k in range(7)] + [fm(recS[mc].mean()), fm(exeS[mc].mean()), f"{turns[m].mean():.1f}", f"{tps[m].mean():.2f}", f"{flu[m].mean():.1f}", fm(np.median(insp[m]))])
table("T2e by calendar day (UTC+9)", "day; n = solves that day (solves/day); tot mean/med; stage means (CFOP only); rec/exe = mean per-solve sum; turns; tps; fluency = means; insp = median inspection s",
      ['day', 'n', 'tot mean', 'tot med'] + STN + ['rec', 'exe', 'turns', 'tps', 'flu', 'insp med'], rows_d)

sec("3. Whole-history context (export.downloadSolves, all sessions)")
sess = collections.defaultdict(list)
for e in EX:
    sess[e['session_name']].append(e)
rows_se = []
J['s3'] = {'sessions': {}}
for nm_, lst in sorted(sess.items(), key=lambda kv: -len(kv[1])):
    tt_ = np.array([e['total_time'] for e in lst], float)
    devs = collections.Counter(e.get('device_name') for e in lst)
    J['s3']['sessions'][nm_] = {'n': len(lst), 'first': ld(pdt(lst[0]['date'])), 'last': ld(pdt(lst[-1]['date'])), 'median': S(np.median(tt_)), 'mean': S(tt_.mean()), 'devices': dict(devs)}
    rows_se.append([nm_, low(len(lst)), f"{ld(pdt(lst[0]['date']))}..{ld(pdt(lst[-1]['date']))}", fm(np.median(tt_)), fm(tt_.mean()), ', '.join(f"{k}:{v}" for k, v in devs.items())])
table("T3a sessions in export", "session_name; n solves; first..last local date; median and mean totalTime (s); device_name counts (None = missing)",
      ['session', 'n', 'dates', 'median', 'mean', 'devices'], rows_se)


def ex_valid(e):
    if e['analysis_type'] != 'CFOP' or e.get('cross_time') is None or e.get('cross_execution_time') is None:
        return False
    for k in EK[1:]:
        if e.get(k + '_time') is None or e.get(k + '_recognition_time') is None or e.get(k + '_execution_time') is None:
            return False
    return True


Ed = [e for e in EX if e['session_name'] == 'Default Session']
nd = len(Ed)
tsd = np.array([pdt(e['date']).timestamp() for e in Ed])
assert (np.diff(tsd) >= 0).all()
totd = np.array([e['total_time'] for e in Ed], float)
vd = np.array([ex_valid(e) for e in Ed])
STd = np.full((nd, 7), np.nan)
RCd = np.full((nd, 7), np.nan)
EXd = np.full((nd, 7), np.nan)
for i, e in enumerate(Ed):
    if vd[i]:
        for k, key in enumerate(EK):
            STd[i, k] = e[key + '_time']
            RCd[i, k] = e[key + '_recognition_time'] if k else e['cross_time'] - e['cross_execution_time']
            EXd[i, k] = e[key + '_execution_time']
dq['default_session_n'] = nd
dq['default_stage_valid_n'] = int(vd.sum())
dq['default_invalid_types'] = dict(collections.Counter(str(e['analysis_type']) for e, v in zip(Ed, vd) if not v))
dq['default_rec_plus_exe_ne_time'] = int((np.abs(RCd[vd] + EXd[vd] - STd[vd]) > 0).sum())
dq['default_stage_sum_ne_total'] = int((np.abs(STd[vd].sum(1) - totd[vd]) > 0).sum())
sidd = sitting_ids(tsd)
Wd = cluster_counts(sidd)
recd = RCd.sum(1)
exed = EXd.sum(1)
bi = np.arange(nd) // 250
nb = int(bi.max()) + 1
short = lambda s: (s or '?')[:4]
rows_a, rows_b = [], []
J['s3']['blocks'] = []
for b in range(nb):
    m = bi == b
    mv = m & vd
    idxs = np.flatnonzero(m)
    dv = collections.Counter(short(Ed[i].get('device_name')) for i in idxs)
    rec = {'block': b + 1, 'n': int(m.sum()), 'n_stage_valid': int(mv.sum()), 'first': ld(pdt(Ed[idxs[0]]['date'])), 'last': ld(pdt(Ed[idxs[-1]]['date'])), 'devices': dict(dv),
           'median_total': S(np.median(totd[m]))}
    for k in range(7):
        rec[STN[k] + '_median'] = S(np.median(STd[mv, k]))
        rec[STN[k] + '_recog_median'] = S(np.median(RCd[mv, k]))
        rec[STN[k] + '_exec_median'] = S(np.median(EXd[mv, k]))
    rec['rec_sum_median'] = S(np.median(recd[mv]))
    rec['exe_sum_median'] = S(np.median(exed[mv]))
    J['s3']['blocks'].append(rec)
    rows_a.append([b + 1 if rec['n'] >= 250 else f"{b + 1}(part)", f"{rec['first']}..{rec['last']}", f"{rec['n']}/{rec['n_stage_valid']}", '+'.join(f"{k}{v}" for k, v in dv.items()), fm(np.median(totd[m]))] + [fm(np.median(STd[mv, k])) for k in range(7)])
    rows_b.append([b + 1] + [f"{fm(np.median(RCd[mv, k]))}/{fm(np.median(EXd[mv, k]))}" for k in range(1, 7)] + [fm(np.median(recd[mv])), fm(np.median(exed[mv]))])
table("T3b Default Session in blocks of 250 (oldest -> newest): stage time medians", "blk (part = last partial block); local dates; n all/stage-valid CFOP; device_name (first 4 chars; QY-Q.. = QiYi, GANi = GAN) counts; median total (all solves in block); median of each stage time (stage-valid only)",
      ['blk', 'dates', 'n', 'device', 'tot med'] + STN, rows_a)
table("T3c same blocks: median recognition / execution", "each cell = median recognition / median execution (s) of that stage (cross recognition = cross_time - cross_execution_time; omitted here, see T3b for cross time); rec/exe sum = median of per-solve sums over 7 stages",
      ['blk'] + [s + ' rec/exe' for s in STN[1:]] + ['rec sum', 'exe sum'], rows_b)

lc = [('total', totd, np.ones(nd, bool), 'total (all Default)')]
for k in range(7):
    lc.append((STN[k], STd[:, k], vd, STN[k]))
lc += [('rec sum', recd, vd, 'rec sum'), ('exe sum', exed, vd, 'exe sum'),
       ('f2l rec sum', RCd[:, 1:5].sum(1), vd, 'f2l rec'), ('f2l exe sum', EXd[:, 1:5].sum(1), vd, 'f2l exe'),
       ('oll rec', RCd[:, 5], vd, 'oll rec'), ('oll exe', EXd[:, 5], vd, 'oll exe'), ('pll rec', RCd[:, 6], vd, 'pll rec'), ('pll exe', EXd[:, 6], vd, 'pll exe')]
rows_l = []
J['s3']['lifetime'] = {}
t1000 = np.arange(nd) / 1000.0
fullb = nb - 1 if (bi == nb - 1).sum() < 250 else nb
last_full = fullb - 1
for nm, y, m, lab in lc:
    yy, tt, wc = y[m], t1000[m], Wd[:, m]
    ma = (bi == last_full)[m]
    mb = (bi == 0)[m]
    gd = groupdiff(wc, yy, ma, mb)
    sl = slope_pt(tt, yy)
    cs_ = ci(wslope(wc, tt, yy))
    J['s3']['lifetime'][nm] = {'n': int(m.sum()), 'first_block_median': S(np.median(yy[mb])), 'last_full_block_median': S(np.median(yy[ma])), 'median_diff': S(gd['median_diff']), 'median_diff_ci': sci(gd['median_ci']),
                               'mean_diff': S(gd['mean_diff']), 'mean_diff_ci': sci(gd['mean_ci']), 'slope_per_1000': S(sl), 'slope_per_1000_ci': sci(cs_)}
    rows_l.append([lab, int(m.sum()), fm(np.median(yy[mb])), fm(np.median(yy[ma])), fdc(gd['median_diff'], gd['median_ci']), fdc(gd['mean_diff'], gd['mean_ci']), fdc(sl, cs_)])
table(f"T3d lifetime change in Default Session (block 1 vs block {last_full + 1}, each 250 solves)", "n used; median in first block; median in last full block; median diff (last - first) [CI]; mean diff [CI]; OLS slope per 1000 solves [CI]. CI: sitting-cluster bootstrap. Device changed over this span (see T3b/T3e), so this mixes skill and hardware",
      ['metric', 'n', 'med blk1', f'med blk{last_full + 1}', 'median diff [CI]', 'mean diff [CI]', 'slope/1000 [CI]'], rows_l)
devs = collections.OrderedDict()
for i, e in enumerate(Ed):
    devs.setdefault(e.get('device_name'), []).append(i)
rows_v = []
J['s3']['by_device'] = {}
for dn, ix in devs.items():
    ix = np.array(ix)
    mv = ix[vd[ix]]
    J['s3']['by_device'][str(dn)] = {'n': len(ix), 'first': ld(pdt(Ed[ix[0]]['date'])), 'last': ld(pdt(Ed[ix[-1]]['date'])), 'median_total': S(np.median(totd[ix])), 'median_cross': S(np.median(STd[mv, 0])) if len(mv) else None}
    if len(mv):
        rows_v.append([dn, low(len(ix)), f"{ld(pdt(Ed[ix[0]]['date']))}..{ld(pdt(Ed[ix[-1]]['date']))}", fm(np.median(totd[ix])), fm(np.median(STd[mv, 0])), fm(np.median(STd[mv, 1:5].sum(1))), fm(np.median(STd[mv, 5])), fm(np.median(STd[mv, 6])), fm(np.median(recd[mv])), fm(np.median(exed[mv]))])
table("T3e Default Session by device_name", "n; local dates; median total; median of cross, F2L (sum of 4 pairs), OLL, PLL time; median rec sum and exe sum (stage-valid solves)",
      ['device', 'n', 'dates', 'tot', 'cross', 'f2l', 'oll', 'pll', 'rec', 'exe'], rows_v)

sec("4. Sittings (gap between consecutive solve dates > 10 min), n=1000")
pos = np.zeros(n, int)
for s in range(nsit):
    ix = np.flatnonzero(sid == s)
    pos[ix] = np.arange(1, len(ix) + 1)
sizes = np.bincount(sid)
durs = np.array([(ts[sid == s][-1] - ts[sid == s][0]) / 60 for s in range(nsit)])
J['s4'] = {'n_sittings': nsit, 'sizes': {'mean': round(float(sizes.mean()), 1), 'median': float(np.median(sizes)), 'min': int(sizes.min()), 'max': int(sizes.max()), 'p25': float(np.percentile(sizes, 25)), 'p75': float(np.percentile(sizes, 75)), 'p90': float(np.percentile(sizes, 90))}, 'sittings': []}
rows_si = []
for s in range(nsit):
    ix = np.flatnonzero(sid == s)
    J['s4']['sittings'].append({'id': s + 1, 'start': ldt(utc[ix[0]]), 'n': len(ix), 'span_min': round(float(durs[s]), 1), 'median_total': S(np.median(tot[ix])), 'mean_total': S(tot[ix].mean())})
    rows_si.append([s + 1, ldt(utc[ix[0]]), low(len(ix)), f"{durs[s]:.0f}", fm(np.median(tot[ix])), fm(tot[ix].mean())])
MD.append(f"Sitting size distribution: n_sittings={nsit}; solves/sitting mean {sizes.mean():.1f}, median {np.median(sizes):.0f}, min {sizes.min()}, p25 {np.percentile(sizes, 25):.0f}, p75 {np.percentile(sizes, 75):.0f}, p90 {np.percentile(sizes, 90):.0f}, max {sizes.max()}; sitting span median {np.median(durs):.0f} min; sittings by size: <10 {int((sizes < 10).sum())}, 10-19 {int(((sizes >= 10) & (sizes < 20)).sum())}, 20-39 {int(((sizes >= 20) & (sizes < 40)).sum())}, 40+ {int((sizes >= 40).sum())}; sittings with n<30: {int((sizes < 30).sum())}. Per-sitting list (start, n, span, median) is in overview.json s4.sittings.")
MD.append("")
buckets = [(1, 5), (6, 10), (11, 20), (21, 40), (41, 80), (81, 10 ** 9)]
rows_p = []
J['s4']['by_position'] = {}
for lo, hi in buckets:
    m = (pos >= lo) & (pos <= hi)
    lab = f"{lo}-{hi}" if hi < 10 ** 9 else f"{lo}+"
    ns = len(set(sid[m]))
    if not m.any():
        J['s4']['by_position'][lab] = {'n': 0}
        rows_p.append([lab, 0, 0, '-', '-'])
        continue
    J['s4']['by_position'][lab] = {'n': int(m.sum()), 'n_sittings': ns, 'median': S(np.median(tot[m])), 'mean': S(tot[m].mean())}
    rows_p.append([lab, low(int(m.sum())), ns, fm(np.median(tot[m])), fm(tot[m].mean())])
table("T4b by position in sitting", "position range (1 = first solve of a sitting); n solves; n_sittings contributing; median and mean totalTime",
      ['pos', 'n', 'sittings', 'median', 'mean'], rows_p)
rows_h = []
lh = np.array([(u + TZ).hour for u in utc])
lw = np.array([(u + TZ).weekday() for u in utc])
J['s4']['by_hour'] = {}
for h in sorted(set(lh)):
    m = lh == h
    J['s4']['by_hour'][int(h)] = {'n': int(m.sum()), 'n_sittings': len(set(sid[m])), 'median': S(np.median(tot[m])), 'mean': S(tot[m].mean())}
    rows_h.append([f"{h:02d}", low(int(m.sum())), len(set(sid[m])), fm(np.median(tot[m])), fm(tot[m].mean())])
rows_w = []
dn_ = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
J['s4']['by_dow'] = {}
for w in range(7):
    m = lw == w
    if not m.any():
        continue
    J['s4']['by_dow'][dn_[w]] = {'n': int(m.sum()), 'n_days': len(set(loc_day[m])), 'n_sittings': len(set(sid[m])), 'median': S(np.median(tot[m])), 'mean': S(tot[m].mean())}
    rows_w.append([dn_[w], low(int(m.sum())), len(set(loc_day[m])), len(set(sid[m])), fm(np.median(tot[m])), fm(tot[m].mean())])
table("T4c by local hour of day (00-23) then day of week (UTC+9)", "label = hour (rows 00-23) or weekday; n solves; sittings = sittings touching that hour/weekday; median / mean totalTime",
      ['hour/dow', 'n', 'sittings', 'median', 'mean'], rows_h + [[r[0], r[1], r[3], r[4], r[5]] for r in rows_w])


def within_diff(vals, lo_a, hi_a, lo_b, hi_b):
    ds = []
    for s in range(nsit):
        m = sid == s
        a = vals[m & (pos >= lo_a) & (pos <= hi_a)]
        b = vals[m & (pos >= lo_b) & (pos <= hi_b)]
        if len(a) and len(b):
            ds.append(a.mean() - b.mean())
    if not ds:
        return None
    ds = np.array(ds)
    bm = ds[rng.integers(0, len(ds), (B, len(ds)))].mean(1)
    return {'n_sittings': len(ds), 'diff': float(ds.mean()), 'ci': ci(bm)}


rows_e = []
J['s4']['effects'] = {}
for nm, a, b in (('warm-up: pos 1-5 vs 11-40', (1, 5), (11, 40)), ('warm-up: pos 1-10 vs 11-40', (1, 10), (11, 40)),
                 ('fatigue: pos 41-80 vs 11-40', (41, 80), (11, 40)), ('fatigue: pos 81+ vs 11-40', (81, 10 ** 9), (11, 40))):
    ma = (pos >= a[0]) & (pos <= a[1])
    mb = (pos >= b[0]) & (pos <= b[1])
    if not ma.any() or not mb.any():
        J['s4']['effects'][nm] = {'n': 0, 'note': 'group empty (max sitting size %d)' % sizes.max()}
        rows_e.append([nm, '0', '-', '-', '-'])
        continue
    gd = groupdiff(Wc, tot, ma, mb)
    wd = within_diff(tot, a[0], a[1], b[0], b[1])
    J['s4']['effects'][nm] = {'nA': gd['nA'], 'nB': gd['nB'], 'pooled_mean_diff': S(gd['mean_diff']), 'pooled_mean_ci': sci(gd['mean_ci']), 'pooled_median_diff': S(gd['median_diff']), 'pooled_median_ci': sci(gd['median_ci']),
                              'within_sitting': None if wd is None else {'n_sittings': wd['n_sittings'], 'mean_diff': S(wd['diff']), 'ci': sci(wd['ci'])}}
    rows_e.append([nm, f"{low(gd['nA'])}/{low(gd['nB'])}", fdc(gd['mean_diff'], gd['mean_ci']), fdc(gd['median_diff'], gd['median_ci']),
                   '-' if wd is None else f"{low(wd['n_sittings'])}: {fdc(wd['diff'], wd['ci'])}"])
table("T4e warm-up and fatigue effects", "A vs B = group A minus group B in s (positive = A slower); nA/nB solves; pooled = difference of all solves in groups, sitting-cluster CI; within-sitting = per-sitting (mean A - mean B) averaged over sittings having both groups, CI over those sittings (n sittings shown)",
      ['contrast', 'nA/nB', 'pooled mean diff [CI]', 'pooled median diff [CI]', 'within-sitting mean diff [CI]'], rows_e)

sec("5. Sequential effects (n=1000, chronological)")
J['s5'] = {'autocorr': {}}
rows_ac = []
for k in (1, 2, 3):
    x0, x1 = tot[:-k], tot[k:]
    m_all = len(x0)
    p_all = float(np.corrcoef(x0, x1)[0, 1])
    c_all = ci(wcorr(block_counts(m_all), x0, x1))
    same = sid[:-k] == sid[k:]
    p_s = float(np.corrcoef(x0[same], x1[same])[0, 1])
    c_s = ci(wcorr(Wc[:, :-k][:, same], x0[same], x1[same]))
    smean = np.array([tot[sid == s].mean() for s in range(nsit)])[sid]
    res = tot - smean
    r0, r1 = res[:-k][same], res[k:][same]
    p_d = float(np.corrcoef(r0, r1)[0, 1])
    c_d = ci(wcorr(Wc[:, :-k][:, same], r0, r1))
    J['s5']['autocorr'][f'lag{k}'] = {'all_pairs': {'n': m_all, 'r': round(p_all, 3), 'ci_block25': [round(c_all[0], 3), round(c_all[1], 3)]},
                                      'same_sitting_pairs': {'n': int(same.sum()), 'r': round(p_s, 3), 'ci': [round(c_s[0], 3), round(c_s[1], 3)]},
                                      'same_sitting_demeaned': {'n': int(same.sum()), 'r': round(p_d, 3), 'ci': [round(c_d[0], 3), round(c_d[1], 3)]}}
    rows_ac.append([k, m_all, f"{p_all:+.3f} [{c_all[0]:.3f}, {c_all[1]:.3f}]", int(same.sum()), f"{p_s:+.3f} [{c_s[0]:.3f}, {c_s[1]:.3f}]", f"{p_d:+.3f} [{c_d[0]:.3f}, {c_d[1]:.3f}]"])
table("T5a autocorrelation of totalTime", "Pearson r between solve t and t+lag; all pairs = n pairs, CI = circular block bootstrap (block 25); same-sitting = only pairs inside one sitting, CI = sitting-cluster; demeaned = same pairs after subtracting each sitting's mean time",
      ['lag', 'n all', 'r all pairs [CI]', 'n same-sit', 'r same-sitting [CI]', 'r demeaned [CI]'], rows_ac)
p10, p90 = np.percentile(tot, 10), np.percentile(tot, 90)
smean_full = np.array([tot[sid == s].mean() for s in range(nsit)])[sid]
res_full = tot - smean_full
jidx = np.arange(1, n)
prev_top = np.zeros(n, bool)
prev_bot = np.zeros(n, bool)
prev_top[1:] = tot[:-1] <= p10
prev_bot[1:] = tot[:-1] >= p90
has_prev = np.arange(n) >= 1
same_prev = np.zeros(n, bool)
same_prev[1:] = sid[1:] == sid[:-1]
rows_n = []
J['s5']['next_solve'] = {'p10_s': S(p10), 'p90_s': S(p90)}
for vn, base in (('all consecutive', has_prev), ('same sitting only', same_prev)):
    for gn, g in (('after top10%', prev_top & base), ('after bottom10%', prev_bot & base)):
        gd = groupdiff(Wc, tot, g, base)
        gr = groupdiff(Wc, res_full, g, base)
        J['s5']['next_solve'][f'{vn} | {gn}'] = {'n': gd['nA'], 'mean': S(tot[g].mean()), 'median': S(np.median(tot[g])), 'baseline_n': gd['nB'], 'baseline_mean': S(tot[base].mean()), 'baseline_median': S(np.median(tot[base])),
                                                 'mean_diff': S(gd['mean_diff']), 'mean_ci': sci(gd['mean_ci']), 'median_diff': S(gd['median_diff']), 'median_ci': sci(gd['median_ci']),
                                                 'resid_mean_diff': S(gr['mean_diff']), 'resid_ci': sci(gr['mean_ci'])}
        rows_n.append([vn, gn, low(gd['nA']), fm(tot[g].mean()), fm(np.median(tot[g])), f"{fm(tot[base].mean())}/{fm(np.median(tot[base]))} (n={gd['nB']})", fdc(gd['mean_diff'], gd['mean_ci']), fdc(gd['median_diff'], gd['median_ci']), fdc(gr['mean_diff'], gr['mean_ci'])])
table("T5b time of the solve right after an own-top-10% / bottom-10% solve", f"top10% = totalTime <= {fm(p10)} s; bottom10% = >= {fm(p90)} s (own p10/p90 of the 1000); n followers; mean/median follower time; baseline mean/median over all solves with a predecessor (same-sitting variant: predecessor in same sitting); diff = follower minus baseline [sitting-cluster CI]; resid = same diff after subtracting each solve's sitting mean",
      ['predecessor set', 'group', 'n', 'mean', 'median', 'baseline mean/med', 'mean diff [CI]', 'median diff [CI]', 'resid mean diff [CI]'], rows_n)

sec(f"6. Time decomposition (CFOP only, n={ncf})")
tcf = tot[cf]
W6 = Wc_cf
recc, exec_ = recS[cf], exeS[cf]
rows_sh = []
J['s6'] = {'stage_stats': {}}
for k in range(7):
    x = STc[:, k]
    shr = x / tcf
    sumr = RECc[:, k].sum()
    J['s6']['stage_stats'][STN[k]] = {'mean': S(x.mean()), 'median': S(np.median(x)), 'sd': S(x.std(ddof=1)), 'min': S(x.min()), 'max': S(x.max()), 'mean_per_solve_share_pct': round(100 * float(shr.mean()), 1),
                                       'share_of_summed_time_pct': round(100 * float(x.sum() / tcf.sum()), 1), 'mean_recognition': S(RECc[:, k].mean()), 'mean_execution': S(EXEc[:, k].mean()),
                                       'recognition_pct_of_stage_time': round(100 * float(sumr / x.sum()), 1), 'n_zero': int((x == 0).sum())}
    rows_sh.append([STN[k], fm(x.mean()), fm(np.median(x)), fm(x.std(ddof=1)), fm(x.min()), fm(x.max()), f"{100 * shr.mean():.1f}", f"{100 * x.sum() / tcf.sum():.1f}", fm(RECc[:, k].mean()), fm(EXEc[:, k].mean()), f"{100 * sumr / x.sum():.1f}"])
for nm, x in (('sum rec', recc), ('sum exe', exec_)):
    shr = x / tcf
    J['s6']['stage_stats'][nm] = {'mean': S(x.mean()), 'median': S(np.median(x)), 'sd': S(x.std(ddof=1)), 'min': S(x.min()), 'max': S(x.max()), 'mean_per_solve_share_pct': round(100 * float(shr.mean()), 1), 'share_of_summed_time_pct': round(100 * float(x.sum() / tcf.sum()), 1)}
    rows_sh.append([nm, fm(x.mean()), fm(np.median(x)), fm(x.std(ddof=1)), fm(x.min()), fm(x.max()), f"{100 * shr.mean():.1f}", f"{100 * x.sum() / tcf.sum():.1f}", '', '', ''])
table("T6a stage and recognition/execution shares", "mean/median/sd/min/max of stage time (s); share1 = mean over solves of stage/total (%); share2 = sum of stage time / sum of totals (%); rec/exe = mean recognition / execution time (s); rec% = recognition as % of that stage's time. sum rec/sum exe = per-solve totals over 7 stages",
      ['stage', 'mean', 'median', 'sd', 'min', 'max', 'share1 %', 'share2 %', 'mean rec', 'mean exe', 'rec %'], rows_sh)

order = np.argsort(tcf, kind='stable')
qs = np.array_split(order, 5)
qid = np.zeros(ncf, int)
for qi, ix in enumerate(qs):
    qid[ix] = qi
insp_c, turns_c, tps_c, flu_c = insp[cf], turns[cf], tps[cf], flu[cf]
rows_q = []
J['s6']['quintiles'] = []
for qi in range(5):
    m = qid == qi
    rec = {'quintile': qi + 1, 'n': int(m.sum()), 'total_min': S(tcf[m].min()), 'total_max': S(tcf[m].max()), 'total_mean': S(tcf[m].mean())}
    for k in range(7):
        rec[STN[k]] = S(STc[m, k].mean())
    rec.update({'rec_sum': S(recc[m].mean()), 'exe_sum': S(exec_[m].mean()), 'turns': round(float(turns_c[m].mean()), 1), 'tps': round(float(tps_c[m].mean()), 2), 'inspection_mean': S(insp_c[m].mean()),
                'inspection_median': S(np.median(insp_c[m])), 'fluency': round(float(flu_c[m].mean()), 1)})
    J['s6']['quintiles'].append(rec)
    rows_q.append([f"Q{qi + 1}", int(m.sum()), f"{fm(tcf[m].min())}-{fm(tcf[m].max())}", fm(tcf[m].mean())] + [fm(STc[m, k].mean()) for k in range(7)] + [fm(recc[m].mean()), fm(exec_[m].mean()), f"{turns_c[m].mean():.1f}", f"{tps_c[m].mean():.2f}", f"{fm(insp_c[m].mean())}/{fm(np.median(insp_c[m]))}", f"{flu_c[m].mean():.1f}"])
table("T6b quintiles by totalTime (Q1 fastest fifth ... Q5 slowest)", "n; total range; every column = mean over the quintile (stage times in s; rec/exe = per-solve sums; turns; tps; insp = mean/median inspection s; flu = fluencyPercent)",
      ['Q', 'n', 'range', 'total'] + STN + ['rec', 'exe', 'turns', 'tps', 'insp mean/med', 'flu'], rows_q)


def gap_table(qa, qb, title):
    ma, mb = qid == qa, qid == qb
    mT = lambda X: X[mb].mean(0) - X[ma].mean(0)
    pt_t, pt_r, pt_e = mT(STc), mT(RECc), mT(EXEc)
    bt = wmean_mat(W6, STc, mb) - wmean_mat(W6, STc, ma)
    br = wmean_mat(W6, RECc, mb) - wmean_mat(W6, RECc, ma)
    be = wmean_mat(W6, EXEc, mb) - wmean_mat(W6, EXEc, ma)
    tot_t, tot_b = pt_t.sum(), bt.sum(1)
    rows, js = [], {}
    items = [(STN[k], pt_t[k], bt[:, k], pt_r[k], br[:, k], pt_e[k], be[:, k]) for k in range(7)]
    items.insert(5, ('f2l (4 pairs)', pt_t[1:5].sum(), bt[:, 1:5].sum(1), pt_r[1:5].sum(), br[:, 1:5].sum(1), pt_e[1:5].sum(), be[:, 1:5].sum(1)))
    items.append(('TOTAL', tot_t, tot_b, pt_r.sum(), br.sum(1), pt_e.sum(), be.sum(1)))
    for nm, p_t, b_t, p_r, b_r, p_e, b_e in items:
        sh = p_t / tot_t
        sc_ = ci(b_t / tot_b)
        js[nm] = {'time_diff': S(p_t), 'time_ci': sci(ci(b_t)), 'share_pct': round(100 * sh, 1), 'share_ci_pct': [round(100 * sc_[0], 1), round(100 * sc_[1], 1)],
                  'rec_diff': S(p_r), 'rec_ci': sci(ci(b_r)), 'exe_diff': S(p_e), 'exe_ci': sci(ci(b_e))}
        rows.append([nm, fdc(p_t, ci(b_t)), f"{100 * sh:.1f}% [{100 * sc_[0]:.0f}, {100 * sc_[1]:.0f}]", fdc(p_r, ci(b_r)), fdc(p_e, ci(b_e))])
    table(title, f"difference in mean (Q{qb + 1} mean minus Q{qa + 1} mean), s, per stage; share = stage diff / total diff (%); rec / exe = same difference for recognition / execution time alone (stage time = rec + exe); [CI] sitting-cluster bootstrap. Q{qa + 1} mean total {fm(tcf[ma].mean())}, Q{qb + 1} {fm(tcf[mb].mean())}",
          ['stage', 'time diff [CI]', 'share of gap', 'rec diff [CI]', 'exe diff [CI]'], rows)
    return js


J['s6']['gap_Q1_to_Q3'] = gap_table(0, 2, "T6c gap fastest fifth -> median fifth")
J['s6']['gap_Q3_to_Q5'] = gap_table(2, 4, "T6d gap median fifth -> slowest fifth")

XV = np.column_stack([STc, STc[:, 1:5].sum(1), recc, exec_])
names_v = STN + ['f2l (4 pairs)', 'sum rec', 'sum exe']
Nn = W6.sum(1)
mX = (W6 @ XV) / Nn[:, None]
mT = (W6 @ tcf) / Nn
covb = (W6 @ (XV * tcf[:, None])) / Nn[:, None] - mX * mT[:, None]
varT = (W6 @ (tcf ** 2)) / Nn - mT ** 2
shb = covb / varT[:, None]
W1 = np.ones((1, ncf))
cov_p = np.cov(XV.T, tcf)[:-1, -1] if False else np.array([np.cov(XV[:, j], tcf, ddof=0)[0, 1] for j in range(XV.shape[1])])
var_p = tcf.var()
rows_v = []
J['s6']['variance'] = {}
sp_all = {}
extra = [('turnCount', turns_c), ('tps', tps_c), ('inspectionTime', insp_c), ('fluencyPercent', flu_c)]
for j, nm in enumerate(names_v):
    p, c = sp_ci(W6, XV[:, j], tcf)
    sp_all[nm] = (p, c)
    shp = cov_p[j] / var_p
    shc = ci(shb[:, j])
    J['s6']['variance'][nm] = {'var_s2': round(float(XV[:, j].var(ddof=1)) / 1e6, 2), 'sd_s': S(XV[:, j].std(ddof=1)), 'cov_share_pct': round(100 * shp, 1), 'cov_share_ci_pct': [round(100 * shc[0], 1), round(100 * shc[1], 1)], 'spearman_with_total': round(p, 3), 'spearman_ci': [round(c[0], 3), round(c[1], 3)]}
    rows_v.append([nm, f"{XV[:, j].var(ddof=1) / 1e6:.2f}", f"{100 * shp:.1f}% [{100 * shc[0]:.0f}, {100 * shc[1]:.0f}]", f"{p:+.3f} [{c[0]:.3f}, {c[1]:.3f}]"])
J['s6']['variance']['TOTAL'] = {'var_s2': round(float(tcf.var(ddof=1)) / 1e6, 2)}
rows_v.append(['total', f"{tcf.var(ddof=1) / 1e6:.2f}", '100%', '-'])
for nm, x in extra:
    p, c = sp_ci(W6, x, tcf)
    J['s6']['variance'][nm] = {'spearman_with_total': round(p, 3), 'spearman_ci': [round(c[0], 3), round(c[1], 3)]}
    rows_v.append([nm, '-', '-', f"{p:+.3f} [{c[0]:.3f}, {c[1]:.3f}]"])
table("T6e variance attribution and Spearman with totalTime", "var = sample variance (s^2); cov share = Cov(stage, total)/Var(total) (stage shares of the 7 sum to 100%; f2l row = 4 pairs combined; sum rec + sum exe = 100%) [sitting-cluster CI]; Spearman rho with totalTime [CI] (stage rows are parts of the total, so positive by construction; tps = turns/time is mechanically related)",
      ['variable', 'var s^2', 'cov share of total var [CI %]', 'Spearman rho [CI]'], rows_v)
J['s6']['spearman_rec_exe_per_stage'] = {}
for k in range(7):
    for lab, X in (('rec', RECc), ('exe', EXEc)):
        p, c = sp_ci(W6, X[:, k], tcf)
        J['s6']['spearman_rec_exe_per_stage'][f'{STN[k]}_{lab}'] = {'rho': round(p, 3), 'ci': [round(c[0], 3), round(c[1], 3)]}

sec(f"7. Inspection time")
dI = desc(insp)
pI = {p: float(np.percentile(insp, p)) for p in (5, 25, 75, 95, 99)}
ok = insp <= 60000
J['s7'] = {'distribution': {'n': n, 'mean': S(dI['mean']), 'median': S(dI['median']), 'sd': S(dI['sd']), 'min': S(dI['min']), 'max': S(dI['max']), 'pcts': {str(p): S(v) for p, v in pI.items()},
                            'n_gt_30s': int((insp > 30000).sum()), 'n_gt_60s': int((insp > 60000).sum()), 'mean_excl_gt60': S(insp[ok].mean()), 'sd_excl_gt60': S(insp[ok].std(ddof=1))}}
table("T7a inspectionTime distribution (all 1000)", "mean; median; sd; min; p5/p25/p75/p95/p99; max (all s); n>30 s and n>60 s; mean / sd after excluding >60 s",
      ['mean', 'median', 'sd', 'min', 'p5', 'p25', 'p75', 'p95', 'p99', 'max', 'n>30s', 'n>60s', 'mean/sd excl>60s'],
      [[fm(dI['mean']), fm(dI['median']), fm(dI['sd']), fm(dI['min'])] + [fm(v) for v in pI.values()] + [fm(dI['max']), int((insp > 30000).sum()), int((insp > 60000).sum()), f"{fm(insp[ok].mean())}/{fm(insp[ok].std(ddof=1))}"]])
io = np.argsort(insp_c, kind='stable')
tq = np.array_split(io, 3)
tid = np.zeros(ncf, int)
for qi, ix in enumerate(tq):
    tid[ix] = qi
vars7 = [('cross time', STc[:, 0]), ('pair-1 recognition', RECc[:, 1]), ('total', tcf)]
rows_t = []
J['s7']['terciles'] = []
for qi in range(3):
    m = tid == qi
    rec = {'tercile': qi + 1, 'n': int(m.sum()), 'insp_min': S(insp_c[m].min()), 'insp_max': S(insp_c[m].max()), 'insp_median': S(np.median(insp_c[m]))}
    row = [f"T{qi + 1}", int(m.sum()), f"{fm(insp_c[m].min())}-{fm(insp_c[m].max())}", fm(np.median(insp_c[m]))]
    for nm, y in vars7:
        rec[nm] = {'mean': S(y[m].mean()), 'median': S(np.median(y[m]))}
        row += [fm(y[m].mean()), fm(np.median(y[m]))]
    J['s7']['terciles'].append(rec)
    rows_t.append(row)
row = ['T3-T1', '', '', '']
J['s7']['tercile_diff_T3_minus_T1'] = {}
for nm, y in vars7:
    gd = groupdiff(W6, y, tid == 2, tid == 0)
    J['s7']['tercile_diff_T3_minus_T1'][nm] = {'mean_diff': S(gd['mean_diff']), 'mean_ci': sci(gd['mean_ci']), 'median_diff': S(gd['median_diff']), 'median_ci': sci(gd['median_ci'])}
    row += [fdc(gd['mean_diff'], gd['mean_ci']), fdc(gd['median_diff'], gd['median_ci'])]
rows_t.append(row)
table("T7b by inspection tercile (CFOP, n=998; T1 shortest inspection)", "n; inspection range s; median inspection; then mean and median of cross time, pair-1 (first F2L pair) recognition time, and total (s); last row = T3 minus T1 [sitting-cluster CI]",
      ['tercile', 'n', 'insp range', 'insp med', 'cross mean', 'cross med', 'p1 rec mean', 'p1 rec med', 'total mean', 'total med'], rows_t)
rows_r = []
J['s7']['spearman'] = {}
for nm, y in [('cross time', STc[:, 0]), ('pair-1 recognition', RECc[:, 1]), ('pair-1 time', STc[:, 1]), ('pair-1 execution', EXEc[:, 1]), ('total', tcf)]:
    p, c = sp_ci(W6, insp_c, y)
    J['s7']['spearman'][nm] = {'n': ncf, 'rho': round(p, 3), 'ci': [round(c[0], 3), round(c[1], 3)]}
    rows_r.append([nm, ncf, f"{p:+.3f} [{c[0]:.3f}, {c[1]:.3f}]"])
table("T7c Spearman of inspectionTime with", "variable; n; Spearman rho [sitting-cluster CI]", ['vs', 'n', 'rho [CI]'], rows_r)

sec("8. Small acubemy-computed files (raw/)")
rj = lambda f: json.load(open(os.path.join(RAW, f)))
prof = rj('profile.json')['json']
avg = rj('stats-averages.json')['json']
amc = rj('stats-averageMoveCount.json')['json']
sess_j = rj('sessions.json')
dev_j = rj('devices.json')
wr = rj('stats-wrapped.json')['json']
J['s8'] = {'profile': {k: prof[k] for k in ('solvingMethod', 'goalTime', 'subscriptionPlan', 'badges', 'tournamentCounts')}, 'stats_averages': avg, 'averageMoveCount': amc,
           'sessions': sess_j, 'devices': collections.Counter(d['deviceId'] for d in dev_j), 'wrapped_all_zero_or_null': True}
MD.append(f"- profile.json: solvingMethod={prof['solvingMethod']}, goalTime={prof['goalTime']} ms ({prof['goalTime'] / 1000:.2f} s), plan={prof['subscriptionPlan']}, badges={len(prof['badges'])}, tournaments top3 = {prof['tournamentCounts']}. (name/email omitted)")
own = {'solveAvgMs': tcf.mean(), 'crossAvgMs': STc[:, 0].mean(), 'f2lAvgMs': STc[:, 1:5].sum(1).mean(), 'ollAvgMs': STc[:, 5].mean(), 'pllAvgMs': STc[:, 6].mean(),
       'ollRecognitionAvgMs': RECc[:, 5].mean(), 'ollExecutionAvgMs': EXEc[:, 5].mean(), 'pllRecognitionAvgMs': RECc[:, 6].mean(), 'pllExecutionAvgMs': EXEc[:, 6].mean()}
J['s8']['stats_averages_vs_own_mean_of_998_cfop'] = {k: {'acubemy_s': S(avg[k]), 'own_s': S(own[k])} for k in own}
MD.append(f"- stats-averages.json (sampleSize {avg['sampleSize']}; acubemy / own mean over the 998 CFOP, s): " + '; '.join(f"{k[:-2]} {fm(avg[k])}/{fm(own[k])}" for k in own) + f". acubemy pll rec+exe = {fm(avg['pllRecognitionAvgMs'] + avg['pllExecutionAvgMs'])} vs its pllAvg {fm(avg['pllAvgMs'])}; own {fm(own['pllRecognitionAvgMs'] + own['pllExecutionAvgMs'])} vs {fm(own['pllAvgMs'])}.")
rl = lambda key: float(np.mean([len(d[key]) for d in D]))
J['s8']['averageMoveCount_vs_own'] = {'acubemy': round(amc, 2), 'own_mean_turnCount_1000': round(float(turns.mean()), 2), 'own_mean_turnCount_998cfop': round(float(turns_c.mean()), 2),
                                      'own_mean_len_solutionSequence': round(rl('solutionSequence'), 2), 'own_mean_len_rawSolutionSequence': round(rl('rawSolutionSequence'), 2)}
MD.append(f"- stats-averageMoveCount.json: {amc:.2f}. Own on the 1000: mean turnCount {turns.mean():.2f} (998 CFOP {turns_c.mean():.2f}); mean len(solutionSequence) {rl('solutionSequence'):.2f}; mean len(rawSolutionSequence) {rl('rawSolutionSequence'):.2f}.")
MD.append("- sessions.json: " + '; '.join(f"{s['name']} (inspection {'on' if s['inspectionTime'] else 'off'}, scrambleMode {s['scrambleMode']}, export n={len(sess.get(s['name'], []))})" for s in sess_j) + f"; all event 333, excludeFromStats false for {sum(not s['excludeFromStats'] for s in sess_j)}/{len(sess_j)}.")
dc = collections.Counter(d['deviceId'] for d in dev_j)
dtr = {}
for e in EX:
    dtr.setdefault(e.get('device_name'), []).append(e['date'])
MD.append("- devices.json (MAC omitted): " + f"{len(dev_j)} entries, " + ', '.join(f"{k} x{v}" for k, v in dc.items()) + "; export solves per device_name/date range: " +
          '; '.join(f"{k}: {len(v)} ({ld(pdt(min(v)))}..{ld(pdt(max(v)))})" for k, v in dtr.items()) + ".")
MD.append(f"- stats-wrapped.json: every value zero/null (totalSolves {wr['solves']['totalSolves']}, activeDays {wr['activeDays']}, ollSkip {wr['ollSkipCount']}, pllSkip {wr['pllSkipCount']}, sessionCount {wr['sessionStats']['sessionCount']}); no information.")
MD.append("")
sec("Data-quality notes (numbers)")
MD.append(f"- The 1000 vs newest 1000 of the export: identical={dq['newest1000_of_export_equals_the_1000']} (export-only: {dq['export_newest1000_not_in_the_1000']}; 1000-only: {dq['the_1000_not_in_export_newest1000']}); session of all 1000: {dq['sessions_in_1000']}; date span {ld(utc[0])}..{ld(utc[-1])} ({len(set(loc_day))} calendar days, {nsit} sittings). Export Default Session n={nd}, stage-valid {int(vd.sum())}.")
MD.append(f"- after derivation, rec+exe != stage time: {dq['rec_plus_exe_ne_time_stages']} of {ncf * 7} stage values; stage sum != total: {dq['stage_sum_ne_total_solves']} solves. Cross recognition (derived = cross_time - cross_execution_time so rec+exe=time holds) is >0 in {dq['cross_recognition_derived_nonzero_n']} solves (max {dq['cross_recognition_derived_max_s']} s, sum {dq['cross_recognition_derived_sum_s']} s); with cross rec=0 instead, rec+exe != time in {dq['rec_plus_exe_ne_time_stages_before_cross_derivation']} stage values. Zero-time stages per stage: {dq['zero_time_stage_counts']}.")
MD.append(f"- F2L slotIndex has 4 distinct values in only {dq['f2l_solves_with_4_distinct_slotIndex']} of {ncf} solves (pairs are time-ordered segments, not guaranteed 1 per slot). Inspection >30 s: {dq['inspection_gt_30s']}, >60 s: {dq['inspection_gt_60s']} (max {fm(insp.max())} s); session inspectionTime flag = {dq['session_inspection_flag']}. Flags: {dq['flags']}. Non-CFOP: {dq['non_cfop']} (index, type, ms).")

os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'overview.md'), 'w').write('\n'.join(MD) + '\n')


def default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    if isinstance(o, set):
        return sorted(o)
    return str(o)


json.dump(J, open(os.path.join(OUT, 'overview.json'), 'w'), indent=1, default=default)
print('md lines', len(MD) + 0, 'sittings', nsit)
