import sys, os, re, json, collections, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy import stats as sps
import lib

SEED = 20261120
NBOOT = 2000
BUNDLE = os.path.join(lib.ROOT, 'bundles', '__next_static_chunks_7769-81bf347805ab6137.js')
ROT = set('xyz')
TOKRE = re.compile(r"^([UDLRFBudlrfbMESxyz])(\d*)('?)$")
SYM = {0: '', 1: '', 2: '2', 3: "'"}


def parse_tok(t):
    m = TOKRE.match(t)
    if not m:
        return None
    n = int(m.group(2)) if m.group(2) else 1
    net = (-n if m.group(3) else n) % 4
    return m.group(1), net


def disp(face, net):
    return face + ('' if net == 1 else '2' if net == 2 else "'")


def load_tables():
    s = open(BUNDLE).read()
    i = s.index('s.ollCases=[')
    t = s[i:s.index('}]', i) + 2]
    oll = {}
    for ci, typ, name, setup, ranks in re.findall(r'\{caseIndex:(\d+),type:"([^"]*)",name:"([^"]*)",setup:"([^"]*)",lexicographicRanks:\[([\d,]*)\]\}', t):
        oll[int(ci)] = {'name': name, 'type': typ, 'setup': setup, 'n_states': len(ranks.split(','))}
    i = s.index('s.pllCases=[')
    t = s[i:s.index('}]', i) + 2]
    pll = {}
    for name, ci, typ, ranks, setup in re.findall(r'\{name:"([^"]*)",caseIndex:(\d+),type:"([^"]*)",lexicographicRanks:\[([\d,]*)\],setup:"([^"]*)"\}', t):
        pll[name] = {'idx': int(ci), 'type': typ, 'setup': setup, 'n_states': len(ranks.split(','))}
    i = s.index('s.zbllCases=[')
    zb = {}
    for name, ci in re.findall(r'\{name:"([^"]*)",caseIndex:(\d+),setup:', s[i:i + 400000]):
        zb[int(ci)] = name
    return oll, pll, zb


def inverse_alg(setup):
    toks = []
    for t in setup.split():
        p = parse_tok(t)
        if p and p[0] not in ROT and p[1]:
            toks.append((p[0], p[1]))
    return canon_key([(f, (4 - n) % 4) for f, n in reversed(toks)])


OPP = {'U': 'D', 'D': 'U', 'L': 'R', 'R': 'L', 'F': 'B', 'B': 'F'}
YMAP = {'R': 'F', 'F': 'L', 'L': 'B', 'B': 'R', 'r': 'f', 'f': 'l', 'l': 'b', 'b': 'r'}


def simplify(seq):
    seq = list(seq)
    changed = True
    while changed:
        changed = False
        for i in range(len(seq) - 1):
            a_, b_ = seq[i], seq[i + 1]
            if OPP.get(a_[0]) == b_[0] and a_[0] > b_[0]:
                seq[i], seq[i + 1] = b_, a_
                changed = True
        out = []
        for f, n in seq:
            if out and out[-1][0] == f:
                m = (out[-1][1] + n) % 4
                out.pop()
                if m:
                    out.append((f, m))
                changed = True
            else:
                out.append((f, n))
        seq = out
    return seq


SORTTR = str.maketrans('RFLB', '0123')


def canon_key(seq, ycanon=True):
    seq = simplify(seq)
    i = 0
    while i < len(seq) and seq[i][0] in ('U', 'd'):
        i += 1
    j = len(seq)
    while j > i and seq[j - 1][0] == 'U':
        j -= 1
    seq = seq[i:j]
    forms = [seq]
    if ycanon and not any(f in 'MES' for f, _ in seq):
        cur = seq
        for _ in range(3):
            cur = [(YMAP.get(f, f), n) for f, n in cur]
            forms.append(cur)
    return min((' '.join(disp(f, n) for f, n in fm) for fm in forms), key=lambda t: t.translate(SORTTR))


def analyse_stage(st):
    raw = []
    for tok, ts in st['moves']:
        p = parse_tok(tok)
        if p is None or p[1] == 0:
            continue
        raw.append((p[0], p[1], ts))
    mv = [(f, n, ts) for f, n, ts in raw if f not in ROT]
    k = 0
    while k < len(mv) and mv[k][0] in ('U', 'd'):
        k += 1
    if k == len(mv):
        lead, trail, body = [], list(mv), []
    else:
        e = len(mv)
        while e > k and mv[e - 1][0] == 'U':
            e -= 1
        lead, body, trail = mv[:k], mv[k:e], mv[e:]
    fumble = False
    for a, b in zip(raw, raw[1:]):
        if a[0] not in ROT and a[0] == b[0] and (a[1] + b[1]) % 4 == 0:
            fumble = True
    tsb = [m[2] for m in body]
    gaps = [tsb[i + 1] - tsb[i] for i in range(len(tsb) - 1)]
    key = canon_key([(f, n) for f, n, _ in body])
    grip = canon_key([(f, n) for f, n, _ in body], False)
    exe = st['execution']
    nm = len(mv)
    return {
        'case': st['case'], 'time': st['time'], 'rec': st['recognition'], 'exec': exe,
        'moves': nm, 'tps': (nm / (exe / 1000.0)) if (exe and exe > 0 and nm >= 2) else None,
        'lead': len(lead), 'trail': len(trail), 'lead_net': sum(m[1] for m in lead) % 4,
        'trail_net': sum(m[1] for m in trail) % 4, 'trail_toks': [disp(f, n) for f, n, _ in trail],
        'body_len': len(body), 'key': key, 'grip': grip, 'fumble': fumble,
        'maxgap': max(gaps) if gaps else 0,
        'pause400': any(g > 400 for g in gaps),
        'pause500_4': any(g > 500 for i, g in enumerate(gaps) if i >= 3),
        'first_gap': (mv[0][2] - st['start']) if mv else None,
        'trail_gap_before': ((trail[0][2] - body[-1][2]) if (trail and body) else None),
        'trail_dur': ((trail[-1][2] - trail[0][2]) if trail else None),
        'last_gap': ((mv[-1][2] - mv[-2][2]) if len(mv) >= 2 else None),
        'seq': [(f if f in ROT else disp(f, n), ts) for f, n, ts in raw],
        'start': st['start'],
        'empty': len(mv) == 0,
        'ntok': len(st['moves']),
    }


def build_A():
    out = []
    ncf = 0
    for r in lib.load():
        st = lib.stages(r)
        if st is None:
            ncf += 1
            continue
        d = r['detail']
        sd = {s['name']: {**s, 'moves': [(m['sliceTurn'], m['timeStamp']) for m in s['moves']]} for s in st}
        f4 = sd['f2l4']
        out.append({
            'id': d['uuid'], 'date': d['date'], 'total': d['totalTime'],
            'f2l4': {'time': f4['time'], 'rec': f4['recognition'], 'exec': f4['execution']},
            'oll': analyse_stage(sd['oll']), 'pll': analyse_stage(sd['pll']),
            'zbll': d['analysis']['oll']['zbllCase'],
        })
    return out, ncf


def export_stages(x):
    names = [('cross', 'cross'), ('f2l1', 'f2l_pair1'), ('f2l2', 'f2l_pair2'), ('f2l3', 'f2l_pair3'),
             ('f2l4', 'f2l_pair4'), ('oll', 'oll'), ('pll', 'pll')]
    mt = x['move_times']
    off, t, res = 0, 0, {}
    for nm, k in names:
        toks = x[k + '_moves']
        time = x[k + '_time']
        res[nm] = {
            'name': nm, 'start': t, 'end': t + time, 'time': time,
            'recognition': x.get(k + '_recognition_time', 0 if nm == 'cross' else None),
            'execution': x.get(k + '_execution_time'),
            'moves': list(zip(toks, mt[off:off + len(toks)])),
            'case': x.get('oll_case_id') if nm == 'oll' else x.get('pll_case_name') if nm == 'pll' else None,
        }
        off += len(toks)
        t += time
    return res


def build_B(export):
    rows = [x for x in export if x['session_name'] == 'Default Session']
    rows.sort(key=lambda x: x['date'], reverse=True)
    rows = rows[:2000]
    out, excl = [], 0
    for x in rows:
        if x['analysis_type'] != 'CFOP' or x.get('oll_case_id') is None or x.get('pll_case_name') is None \
                or x.get('f2l_pair4_time') is None or x.get('move_times') is None:
            excl += 1
            continue
        sd = export_stages(x)
        f4 = sd['f2l4']
        out.append({
            'id': x['solve_id'], 'date': x['date'], 'total': x['total_time'],
            'f2l4': {'time': f4['time'], 'rec': f4['recognition'], 'exec': f4['execution']},
            'oll': analyse_stage(sd['oll']), 'pll': analyse_stage(sd['pll']), 'zbll': None,
        })
    out.sort(key=lambda r: r['date'])
    return out, len(rows), excl


def okey(c):
    return 'skip' if c == -1 else int(c)


def pkey(c):
    return 'skip' if c == 'Unknown' else c


def sec(ms):
    return None if ms is None else ms / 1000.0


def f2(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return '-'
    return '%.2f' % v


def f1(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return '-'
    return '%.1f' % v


def med(a):
    return float(np.median(a)) if len(a) else None


def mean(a):
    return float(np.mean(a)) if len(a) else None


def pct(a, q):
    return float(np.percentile(a, q)) if len(a) else None


def rng_for(tag):
    return np.random.default_rng([SEED, sum(ord(c) * (i + 1) for i, c in enumerate(tag))])


def boot_median_ci(v, tag):
    v = np.asarray(v, float)
    if len(v) < 2:
        return None
    r = rng_for(tag)
    idx = r.integers(0, len(v), (NBOOT, len(v)))
    m = np.median(v[idx], axis=1)
    return [float(np.percentile(m, 2.5)), float(np.percentile(m, 97.5))]


def boot_diff_median(a, b, tag):
    a, b = np.asarray(a, float), np.asarray(b, float)
    r = rng_for(tag)
    ia = r.integers(0, len(a), (NBOOT, len(a)))
    ib = r.integers(0, len(b), (NBOOT, len(b)))
    d = np.median(a[ia], axis=1) - np.median(b[ib], axis=1)
    return {'diff': float(np.median(a) - np.median(b)), 'ci': [float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))],
            'n_a': len(a), 'n_b': len(b)}


def boot_corr(x, y, tag):
    x, y = np.asarray(x, float), np.asarray(y, float)
    n = len(x)
    r = rng_for(tag)
    idx = r.integers(0, n, (NBOOT, n))

    def pear(X, Y):
        X = X - X.mean(axis=1, keepdims=True)
        Y = Y - Y.mean(axis=1, keepdims=True)
        return (X * Y).sum(axis=1) / np.sqrt((X * X).sum(axis=1) * (Y * Y).sum(axis=1))
    pb = pear(x[idx], y[idx])
    sb = pear(sps.rankdata(x[idx], axis=1), sps.rankdata(y[idx], axis=1))
    return {
        'n': n,
        'pearson': float(np.corrcoef(x, y)[0, 1]), 'pearson_ci': [float(np.nanpercentile(pb, 2.5)), float(np.nanpercentile(pb, 97.5))],
        'spearman': float(sps.spearmanr(x, y)[0]), 'spearman_ci': [float(np.nanpercentile(sb, 2.5)), float(np.nanpercentile(sb, 97.5))],
    }


def deciles(a):
    a = np.asarray(a, float)
    return {'n': len(a), 'mean': mean(a), **{'p%d' % q: pct(a, q) for q in range(10, 100, 10)}}


def vals(S, st, f, skip_ok=False):
    out = []
    for r in S:
        s = r[st]
        if s['case'] in (-1, 'Unknown') and not skip_ok:
            continue
        v = f(r, s)
        if v is not None:
            out.append(v)
    return out


def is_skip(s):
    return s['case'] in (-1, 'Unknown')


def stage_level(S, st):
    NS = [r for r in S if not is_skip(r[st])]
    g = lambda f: np.array([f(r) for r in NS if f(r) is not None], float)
    return {
        'n': len(NS),
        'time_s': deciles(g(lambda r: sec(r[st]['time']))),
        'rec_s': deciles(g(lambda r: sec(r[st]['rec']))),
        'exec_s': deciles(g(lambda r: sec(r[st]['exec']))),
        'moves': deciles(g(lambda r: r[st]['moves'])),
        'tps': deciles(g(lambda r: r[st]['tps'])),
        'share_pct': deciles(g(lambda r: 100.0 * r[st]['time'] / r['total'])),
    }


def quintiles(S):
    order = np.argsort([r['total'] for r in S], kind='stable')
    grp = np.empty(len(S), int)
    for rank, i in enumerate(order):
        grp[i] = rank * 5 // len(S)
    res = []
    for q in range(5):
        G = [S[i] for i in range(len(S)) if grp[i] == q]
        row = {'q': q + 1, 'n': len(G), 'total_min': sec(min(r['total'] for r in G)), 'total_max': sec(max(r['total'] for r in G))}
        for st in ('oll', 'pll'):
            NS = [r for r in G if not is_skip(r[st])]
            row[st + '_time'] = med([sec(r[st]['time']) for r in NS])
            row[st + '_rec'] = med([sec(r[st]['rec']) for r in NS])
            row[st + '_exec'] = med([sec(r[st]['exec']) for r in NS])
            row[st + '_moves'] = med([r[st]['moves'] for r in NS])
        row['ll_time'] = med([sec(r['oll']['time'] + r['pll']['time']) for r in G])
        row['ll_share_pct'] = med([100.0 * (r['oll']['time'] + r['pll']['time']) / r['total'] for r in G])
        res.append(row)
    G1 = [S[i] for i in range(len(S)) if grp[i] == 0]
    G5 = [S[i] for i in range(len(S)) if grp[i] == 4]
    diffs = {}
    fns = {'ll_time_s': lambda r: sec(r['oll']['time'] + r['pll']['time']),
           'll_share_pct': lambda r: 100.0 * (r['oll']['time'] + r['pll']['time']) / r['total'],
           'oll_time_s_nonskip': lambda r: None if is_skip(r['oll']) else sec(r['oll']['time']),
           'pll_time_s_nonskip': lambda r: None if is_skip(r['pll']) else sec(r['pll']['time'])}
    for k, f in fns.items():
        a = [f(r) for r in G5 if f(r) is not None]
        b = [f(r) for r in G1 if f(r) is not None]
        diffs[k] = boot_diff_median(a, b, 'q51' + k)
    return res, diffs


def blocks(S):
    res = []
    for b in range(0, len(S), 100):
        G = S[b:b + 100]
        row = {'block': b // 100 + 1, 'n': len(G), 'from': G[0]['date'][:10], 'to': G[-1]['date'][:10],
               'total': med([sec(r['total']) for r in G]),
               'll_time': med([sec(r['oll']['time'] + r['pll']['time']) for r in G]),
               'll_share_pct': med([100.0 * (r['oll']['time'] + r['pll']['time']) / r['total'] for r in G])}
        for st in ('oll', 'pll'):
            NS = [r for r in G if not is_skip(r[st])]
            row[st + '_n'] = len(NS)
            row[st + '_time'] = med([sec(r[st]['time']) for r in NS])
            row[st + '_rec'] = med([sec(r[st]['rec']) for r in NS])
            row[st + '_exec'] = med([sec(r[st]['exec']) for r in NS])
            row[st + '_moves'] = med([r[st]['moves'] for r in NS])
        res.append(row)
    return res


def trend(S):
    first, last = S[:100], S[-100:] if len(S) >= 200 else S[-100:]
    d = {}
    for st in ('oll', 'pll'):
        for nm, f in (('time', lambda r, s: sec(s['time'])), ('rec', lambda r, s: sec(s['rec'])), ('exec', lambda r, s: sec(s['exec']))):
            a = [f(r, r[st]) for r in last if not is_skip(r[st])]
            b = [f(r, r[st]) for r in first if not is_skip(r[st])]
            d[st + '_' + nm] = boot_diff_median(a, b, 'trend' + st + nm)
    x = np.arange(len(S))
    ll = np.array([sec(r['oll']['time'] + r['pll']['time']) for r in S])
    d['spearman_index_vs_ll_time'] = boot_corr(x, ll, 'trendsp')
    return d


def case_groups(S, st, keyf):
    g = collections.defaultdict(list)
    for r in S:
        g[keyf(r[st]['case'])].append(r)
    return g


def top_algs(rows, st, k=3):
    c = collections.Counter(r[st]['key'] for r in rows if r[st]['key'])
    grips = collections.defaultdict(collections.Counter)
    for r in rows:
        if r[st]['key']:
            grips[r[st]['key']][r[st]['grip']] += 1
    return [(grips[key].most_common(1)[0][0], n) for key, n in c.most_common(k)], len(c)


def dist_str(rows, st, field):
    c = collections.Counter(min(r[st][field], 3) for r in rows)
    return '/'.join(str(c.get(i, 0)) for i in range(4))


def case_table(S, st, keyf, keys, theory, ref_median):
    G = case_groups(S, st, keyf)
    N = len(S)
    res = {}
    for k in keys:
        rows = G.get(k, [])
        n = len(rows)
        row = {'n': n, 'obs_pct': 100.0 * n / N, 'theory_pct': 100.0 * theory[k], 'expected_n': N * theory[k]}
        if n:
            T = [sec(r[st]['time']) for r in rows]
            rec = [sec(r[st]['rec']) for r in rows if r[st]['rec'] is not None]
            ex = [sec(r[st]['exec']) for r in rows if r[st]['exec'] is not None]
            tp = [r[st]['tps'] for r in rows if r[st]['tps'] is not None]
            row.update({
                'time_med': med(T), 'time_mean': mean(T), 'time_med_ci': boot_median_ci(T, 'cm%s%s%s' % (st, k, N)) if n >= 3 else None,
                'rec_med': med(rec), 'exec_med': med(ex), 'moves_med': med([r[st]['moves'] for r in rows]),
                'tps_med': med(tp), 'tps_n': len(tp),
                'rec_gt1_pct': 100.0 * sum(1 for v in rec if v > 1.0) / len(rec) if rec else None,
                'lead_dist': dist_str(rows, st, 'lead'), 'trail_dist': dist_str(rows, st, 'trail'),
                'fumble_pct': 100.0 * sum(r[st]['fumble'] for r in rows) / n,
                'pause400_pct': 100.0 * sum(r[st]['pause400'] for r in rows) / n,
                'excess_pos_s': float(sum(max(0.0, v - ref_median) for v in T)),
                'excess_signed_s': float(sum(v - ref_median for v in T)),
            })
            ta, nd = top_algs(rows, st)
            row['top_algs'] = ta
            row['top_grips'] = collections.Counter(r[st]['grip'] for r in rows if r[st]['grip']).most_common(5)
            row['n_distinct_algs'] = nd
            nz = [r for r in rows if r[st]['key']]
            row['top1_share_pct'] = 100.0 * ta[0][1] / len(nz) if ta else None
            if ta:
                mlen = len(ta[0][0].split())
                row['modal_len'] = mlen
                row['long_pct'] = 100.0 * sum(1 for r in nz if r[st]['body_len'] > mlen + 4) / len(nz)
                row['pause500_4_pct'] = 100.0 * sum(r[st]['pause500_4'] for r in nz) / len(nz)
        res[k] = row
    return res


def classify(row):
    n = row['n']
    if n < 5 or not row.get('top_algs'):
        return 'N/A'
    tag = 'MULTI-STEP' if (row['long_pct'] >= 30 or row['pause500_4_pct'] >= 30) else \
        'CONSISTENT' if row['top1_share_pct'] >= 60 else 'MIXED'
    return tag + (' LOW-N' if n < 30 else '')


def multi_examples(S, st, keyf, key, k=3):
    G = [r for r in case_groups(S, st, keyf).get(key, []) if r[st]['key']]
    ta, _ = top_algs(G, st, 1)
    mlen = len(ta[0][0].split())
    cand = sorted(G, key=lambda r: -(r[st]['body_len'] + (100 if r[st]['pause500_4'] else 0)))
    out = []
    for r in cand[:k]:
        s = r[st]
        out.append({'id': r['id'], 'body_len': s['body_len'], 'maxgap_ms': s['maxgap'], 'seq': ' '.join('%s@%d' % (m, ts - s['start']) for m, ts in s['seq'])})
    return out


def chi_square(counts, probs, tag):
    counts = np.asarray(counts, float)
    p = np.asarray(probs, float)
    N = counts.sum()
    p = p / p.sum()
    E = N * p
    stat = float(((counts - E) ** 2 / E).sum())
    r = rng_for(tag)
    sim = r.multinomial(int(N), p, size=20000)
    simstat = ((sim - E) ** 2 / E).sum(axis=1)
    return {'chi2': stat, 'df': len(p) - 1, 'p_mc': float((simstat >= stat).mean()), 'N': int(N),
            'cells_expected_lt5': int((E < 5).sum())}


def potential(S, st, keyf, keys, theory, tag):
    N = len(S)
    G = case_groups(S, st, keyf)
    elig = [k for k in keys if k != 'skip' and len(G.get(k, [])) >= 15]
    arr = {}
    for k in elig:
        rows = [r for r in G[k] if r[st]['rec'] is not None and r[st]['exec'] is not None]
        arr[k] = (np.array([sec(r[st]['exec']) for r in rows]), np.array([sec(r[st]['rec']) for r in rows]))
    per = {}
    tot = {'exec_obs': 0.0, 'rec_obs': 0.0, 'exec_theory': 0.0, 'rec_theory': 0.0, 'cov_obs': 0.0, 'cov_theory': 0.0}
    for k in elig:
        e, rc = arr[k]
        f = len(G[k]) / N
        ge = med(e) - pct(e, 10)
        gr = med(rc) - pct(rc, 10)
        per[k] = {'n': len(G[k]), 'freq': f, 'exec_med': med(e), 'exec_p10': pct(e, 10), 'exec_gap': ge, 'exec_gain': f * ge,
                  'rec_med': med(rc), 'rec_p10': pct(rc, 10), 'rec_gap': gr, 'rec_gain': f * gr}
        tot['exec_obs'] += f * ge
        tot['rec_obs'] += f * gr
        tot['exec_theory'] += theory[k] * ge
        tot['rec_theory'] += theory[k] * gr
        tot['cov_obs'] += f
        tot['cov_theory'] += theory[k]
    r = rng_for(tag)
    cases = list(elig)
    pr = np.array([len(G.get(k, [])) for k in keys], float)
    pr /= pr.sum()
    keyidx = {k: i for i, k in enumerate(keys)}
    be, br = np.empty(NBOOT), np.empty(NBOOT)
    for b in range(NBOOT):
        cnt = r.multinomial(N, pr)
        se = sr = 0.0
        for k in cases:
            m = cnt[keyidx[k]]
            if m < 2:
                continue
            e, rc = arr[k]
            ii = r.integers(0, len(e), m)
            ee, rr = e[ii], rc[ii]
            se += m / N * (np.median(ee) - np.percentile(ee, 10))
            sr += m / N * (np.median(rr) - np.percentile(rr, 10))
        be[b], br[b] = se, sr
    tot['exec_obs_ci'] = [float(np.percentile(be, 2.5)), float(np.percentile(be, 97.5))]
    tot['rec_obs_ci'] = [float(np.percentile(br, 2.5)), float(np.percentile(br, 97.5))]
    tot['n_eligible_cases'] = len(elig)
    return per, tot


def case_adjust(S, st, field):
    G = collections.defaultdict(list)
    for r in S:
        if not is_skip(r[st]) and r[st][field] is not None:
            G[r[st]['case']].append(r[st][field])
    M = {k: np.median(v) for k, v in G.items()}
    return M


def recognition_section(S):
    out = {}
    for st in ('oll', 'pll'):
        NS = [r for r in S if not is_skip(r[st]) and r[st]['rec'] is not None]
        rec = np.array([sec(r[st]['rec']) for r in NS])
        out[st + '_rec'] = {'n': len(rec), **{'p%d' % q: pct(rec, q) for q in range(10, 100, 10)}, 'mean': mean(rec),
                            'gt1.0_pct': 100.0 * float((rec > 1.0).mean()), 'gt1.5_pct': 100.0 * float((rec > 1.5).mean()),
                            'gt2.0_pct': 100.0 * float((rec > 2.0).mean()), 'zero_pct': 100.0 * float((rec == 0).mean())}
    pairs = [r for r in S if not is_skip(r['oll']) and not is_skip(r['pll'])
             and None not in (r['oll']['exec'], r['pll']['rec'], r['oll']['rec'])]
    mo = case_adjust(S, 'oll', 'exec')
    mp = case_adjust(S, 'pll', 'rec')
    mor = case_adjust(S, 'oll', 'rec')
    oe = np.array([sec(r['oll']['exec']) for r in pairs])
    pr = np.array([sec(r['pll']['rec']) for r in pairs])
    oe_adj = np.array([r['oll']['exec'] / mo[r['oll']['case']] if mo[r['oll']['case']] > 0 else np.nan for r in pairs])
    pr_adj = np.array([r['pll']['rec'] / mp[r['pll']['case']] if mp[r['pll']['case']] > 0 else np.nan for r in pairs])
    ok = ~np.isnan(oe_adj) & ~np.isnan(pr_adj)
    out['lookahead'] = {
        'oll_exec_vs_pll_rec': boot_corr(oe, pr, 'la1'),
        'oll_exec_ratio_vs_pll_rec_ratio': boot_corr(oe_adj[ok], pr_adj[ok], 'la2'),
        'pll_rec_zero_pct': 100.0 * float((pr == 0).mean()),
    }
    order = np.argsort(oe_adj[ok], kind='stable')
    pq = pr[ok][order]
    n = len(pq)
    grp = np.arange(n) * 5 // n
    qrows = []
    for q in range(5):
        sel = grp == q
        qrows.append({'q': q + 1, 'n': int(sel.sum()), 'oll_exec_ratio_med': med(oe_adj[ok][order][sel]),
                      'pll_rec_med': med(pq[sel]), 'pll_rec_mean': mean(pq[sel])})
    out['lookahead_quintiles'] = qrows
    out['lookahead_q5_minus_q1'] = boot_diff_median(pq[grp == 4], pq[grp == 0], 'laq')
    tr = [r for r in S if not is_skip(r['oll']) and None not in (r['f2l4']['time'], r['f2l4']['exec'], r['oll']['rec'])]
    ft = np.array([sec(r['f2l4']['time']) for r in tr])
    fe = np.array([sec(r['f2l4']['exec']) for r in tr])
    orc = np.array([sec(r['oll']['rec']) for r in tr])
    orc_adj = np.array([r['oll']['rec'] / mor[r['oll']['case']] if mor[r['oll']['case']] > 0 else np.nan for r in tr])
    okk = ~np.isnan(orc_adj)
    out['transition'] = {
        'f2l4_time_vs_oll_rec': boot_corr(ft, orc, 'tr1'),
        'f2l4_exec_vs_oll_rec': boot_corr(fe, orc, 'tr2'),
        'f2l4_time_vs_oll_rec_ratio': boot_corr(ft[okk], orc_adj[okk], 'tr3'),
        'oll_rec_zero_pct': 100.0 * float((orc == 0).mean()),
    }
    order = np.argsort(ft, kind='stable')
    n = len(order)
    grp = np.arange(n) * 5 // n
    qrows = []
    for q in range(5):
        sel = order[grp == q]
        qrows.append({'q': q + 1, 'n': len(sel), 'f2l4_time_min': float(ft[sel].min()), 'f2l4_time_max': float(ft[sel].max()),
                      'oll_rec_med': med(orc[sel]), 'oll_rec_mean': mean(orc[sel])})
    out['transition_quintiles'] = qrows
    out['transition_q5_minus_q1'] = boot_diff_median(orc[order[grp == 4]], orc[order[grp == 0]], 'trq')
    return out


def rec_vs_gap(S):
    out = {}
    for st in ('oll', 'pll'):
        rows = [r[st] for r in S if not r[st]['empty'] and r[st]['rec'] is not None and r[st]['first_gap'] is not None]
        res = {}
        for lab, sel in (('lead0', lambda s: s['lead'] == 0), ('lead1', lambda s: s['lead'] == 1), ('lead2+', lambda s: s['lead'] >= 2), ('all', lambda s: True)):
            G = [s for s in rows if sel(s)]
            d = np.array([s['first_gap'] - s['rec'] for s in G])
            res[lab] = {'n': len(G), 'rec_zero_n': sum(1 for s in G if s['rec'] == 0),
                        'within_50ms_pct': 100.0 * float((np.abs(d) <= 50).mean()) if len(d) else None,
                        'rec_gt_gap_50_pct': 100.0 * float((d < -50).mean()) if len(d) else None,
                        'gap_minus_rec_median_ms': float(np.median(d)) if len(d) else None,
                        'gap_minus_rec_p10_ms': float(np.percentile(d, 10)) if len(d) else None}
        out[st] = res
    return out


def auf_section(S):
    res = {}
    tot = []
    comps = {'pre_oll': [], 'pre_pll': [], 'final': []}
    for r in S:
        o, p = r['oll'], r['pll']
        c = (o['lead'], p['lead'], p['trail'])
        comps['pre_oll'].append(c[0])
        comps['pre_pll'].append(c[1])
        comps['final'].append(c[2])
        tot.append(sum(c))
    N = len(S)

    def dist(v):
        cnt = collections.Counter(min(x, 4) for x in v)
        return {('4+' if k == 4 else str(k)): cnt.get(k, 0) for k in range(5)}
    res['n'] = N
    res['total_per_solve'] = {'dist': dist(tot), 'mean': mean(tot), 'median': med(tot)}
    for k, v in comps.items():
        res[k] = {'dist': dist(v), 'mean': mean(v), 'share_ge1_pct': 100.0 * sum(1 for x in v if x >= 1) / N}
    fin = [r['pll'] for r in S if r['pll']['trail'] > 0]
    net = collections.Counter(s['trail_net'] for s in fin)
    two_q = [s for s in fin if s['trail_net'] == 2 and s['trail'] == 2]
    one_tok2 = [s for s in fin if s['trail_net'] == 2 and s['trail'] == 1]
    multi2 = [s for s in fin if s['trail_net'] == 2 and s['trail'] > 2]
    over = [s for s in fin if s['trail'] > (1 if s['trail_net'] else 0)]
    res['final_net'] = {'with_final_auf': len(fin), 'U': net.get(1, 0), "U'": net.get(3, 0), 'U2': net.get(2, 0), 'net0_cancelling': net.get(0, 0),
                        'U2_as_two_quarter_turns': len(two_q), 'U2_as_single_token': len(one_tok2), 'U2_as_3plus_tokens': len(multi2),
                        'final_auf_more_tokens_than_needed': len(over)}
    res['final_net']['two_quarter_share_of_U2_pct'] = 100.0 * len(two_q) / max(1, net.get(2, 0))
    res['final_tok_patterns_top'] = collections.Counter(' '.join(s['trail_toks']) for s in fin).most_common(8)

    def st(vals):
        a = np.array(vals, float) / 1000.0
        return {'n': len(a), 'median_s': med(a), 'mean_s': mean(a), 'p10_s': pct(a, 10), 'p90_s': pct(a, 90)}
    res['gap_before_first_final_auf_move'] = st([s['trail_gap_before'] for s in fin if s['trail_gap_before'] is not None])
    res['final_auf_duration_multi_token'] = st([s['trail_dur'] for s in fin if s['trail'] >= 2])
    res['gap_before_last_move_with_auf'] = st([s['last_gap'] for s in fin if s['last_gap'] is not None and s['body_len'] > 0])
    nof = [r['pll'] for r in S if r['pll']['trail'] == 0 and r['pll']['body_len'] > 0]
    res['gap_before_last_move_without_auf'] = st([s['last_gap'] for s in nof if s['last_gap'] is not None])
    res['final_auf_gap_vs_no_auf_last_gap'] = boot_diff_median(
        [s['last_gap'] / 1000.0 for s in fin if s['last_gap'] is not None and s['body_len'] > 0],
        [s['last_gap'] / 1000.0 for s in nof if s['last_gap'] is not None], 'aufgap')
    return res


def alg_match(S, st, keyf, keys, table_alg):
    G = case_groups(S, st, keyf)
    res = {}
    for k in keys:
        rows = G.get(k, [])
        ta = collections.Counter(r[st]['key'] for r in rows if r[st]['key']).most_common()
        res[k] = {'top1': ta[0][0] if ta else None, 'all': [a for a, _ in ta]}
    return res


def worst(S, st, label, tables, k=15):
    rows = [r for r in S if not is_skip(r[st]) and r[st]['exec'] is not None]
    rows.sort(key=lambda r: -r[st]['exec'])
    lines = []
    for r in rows[:k]:
        s = r[st]
        case = ('OLL %d' % (s['case'] + 1)) if st == 'oll' else s['case']
        seq = ' '.join('%s@%d' % (m, ts - s['start']) for m, ts in s['seq'])
        lines.append('| %s | %s | %s | %s | %.2f | %.2f | %.2f | %d | %s |' % (
            r['date'][:19], r['id'], case, label, s['time'] / 1000.0, (s['rec'] or 0) / 1000.0, s['exec'] / 1000.0, s['moves'], seq))
    return lines


def table_md(title, defs, header, rows):
    out = ['', '### ' + title, defs, '', '| ' + ' | '.join(header) + ' |', '|' + '|'.join(['---'] * len(header)) + '|']
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return out


def ci_s(ci):
    return '[%s, %s]' % (f2(ci[0]), f2(ci[1])) if ci else '-'


def lown(n):
    return '%d%s' % (n, ' LOW-N' if n < 30 else '')


def algs_s(ta, k=3):
    return '; '.join('%s (%d)' % (a if a else '-', c) for a, c in ta[:k])


def main():
    OLL, PLL, ZB = load_tables()
    A, nonCFOP = build_A()
    export = lib.load_export()
    B, B_rows, B_excl = build_B(export)

    okeys = list(range(57)) + ['skip']
    pnames = sorted(PLL, key=lambda n: PLL[n]['idx'])
    pkeys = pnames + ['skip']
    o_theory = {i: OLL[i]['n_states'] / 216.0 for i in range(57)}
    o_theory['skip'] = 1 / 216.0
    p_theory = {n: PLL[n]['n_states'] / 72.0 for n in pnames}
    p_theory['skip'] = 1 / 72.0

    ex_chk = collections.Counter()
    for rr in lib.load():
        st = lib.stages(rr)
        if st is None:
            continue
        x = rr['export']
        sd = export_stages(x)
        for nm in ('oll', 'pll'):
            a = [s for s in st if s['name'] == nm][0]
            b = sd[nm]
            ex_chk['checked'] += 1
            same = a['time'] == b['time'] and a['recognition'] == b['recognition'] and a['execution'] == b['execution'] \
                and [m['sliceTurn'] for m in a['moves']] == [m[0] for m in b['moves']] \
                and [m['timeStamp'] for m in a['moves']] == [m[1] for m in b['moves']]
            ex_chk['mismatch'] += 0 if same else 1

    a_dates = {r['date'] for r in A}
    b_dates = {r['date'] for r in B}
    overlap = len(a_dates & b_dates)

    result = {'meta': {'seed': SEED, 'n_boot': NBOOT, 'A_n': len(A), 'A_excluded_non_cfop': nonCFOP,
                       'B_rows_taken': B_rows, 'B_n': len(B), 'B_excluded': B_excl, 'A_B_overlap_by_date': overlap,
                       'A_range': [A[0]['date'], A[-1]['date']], 'B_range': [B[0]['date'], B[-1]['date']],
                       'A_vs_export_stage_check': dict(ex_chk)}}

    ds = {'A': A, 'B': B}
    R = {}
    for name, S in ds.items():
        d = {'n': len(S)}
        skips = {
            'oll_skip_n': sum(1 for r in S if r['oll']['case'] == -1),
            'oll_skip_empty_n': sum(1 for r in S if r['oll']['case'] == -1 and r['oll']['empty']),
            'oll_skip_time0_n': sum(1 for r in S if r['oll']['case'] == -1 and r['oll']['time'] == 0),
            'pll_skip_n': sum(1 for r in S if r['pll']['case'] == 'Unknown'),
            'pll_skip_empty_n': sum(1 for r in S if r['pll']['case'] == 'Unknown' and r['pll']['empty']),
            'pll_skip_auf_only_n': sum(1 for r in S if r['pll']['case'] == 'Unknown' and not r['pll']['empty'] and r['pll']['body_len'] == 0),
            'pll_skip_other_n': sum(1 for r in S if r['pll']['case'] == 'Unknown' and r['pll']['body_len'] > 0),
            'pll_time0_n': sum(1 for r in S if r['pll']['time'] == 0),
            'pll_nonunknown_empty_n': sum(1 for r in S if r['pll']['case'] != 'Unknown' and r['pll']['empty']),
            'oll_nonskip_empty_n': sum(1 for r in S if r['oll']['case'] != -1 and r['oll']['empty']),
            'double_skip_n': sum(1 for r in S if r['oll']['case'] == -1 and r['pll']['case'] == 'Unknown'),
            'oll_skip_then_pll_empty_n': sum(1 for r in S if r['oll']['case'] == -1 and r['pll']['empty']),
        }
        N = len(S)
        skips['oll_skip_binom_p_vs_1_216'] = float(sps.binomtest(skips['oll_skip_n'], N, 1 / 216.0).pvalue)
        skips['pll_skip_binom_p_vs_1_72'] = float(sps.binomtest(skips['pll_skip_n'], N, 1 / 72.0).pvalue)
        d['skips'] = skips
        d['zbll_values'] = collections.Counter(r['zbll'] for r in S if r['zbll'] is not None)
        ocount = [sum(1 for r in S if okey(r['oll']['case']) == k) for k in okeys]
        pcount = [sum(1 for r in S if pkey(r['pll']['case']) == k) for k in pkeys]
        d['chi_oll'] = chi_square(ocount, [o_theory[k] for k in okeys], 'chio' + name)
        d['chi_pll'] = chi_square(pcount, [p_theory[k] for k in pkeys], 'chip' + name)
        d['stage'] = {'oll': stage_level(S, 'oll'), 'pll': stage_level(S, 'pll')}
        d['stage_noskip_time_median'] = {st: med([sec(r[st]['time']) for r in S if not is_skip(r[st])]) for st in ('oll', 'pll')}
        d['quintiles'], d['quintile_diffs'] = quintiles(S)
        d['blocks'] = blocks(S)
        d['trend'] = trend(S)
        d['oll_cases'] = case_table(S, 'oll', okey, okeys, o_theory, d['stage_noskip_time_median']['oll'])
        d['pll_cases'] = case_table(S, 'pll', pkey, pkeys, p_theory, d['stage_noskip_time_median']['pll'])
        for k, row in d['oll_cases'].items():
            row['class'] = classify(row) if k != 'skip' else 'N/A'
        d['potential_oll'] = potential(S, 'oll', okey, okeys, o_theory, 'po' + name)
        d['potential_pll'] = potential(S, 'pll', pkey, pkeys, p_theory, 'pp' + name)
        d['recognition'] = recognition_section(S)
        d['rec_vs_gap'] = rec_vs_gap(S)
        d['auf'] = auf_section(S)
        R[name] = d
    result['data'] = R

    oam = alg_match(A, 'oll', okey, okeys, None)
    pam = alg_match(A, 'pll', pkey, pkeys, None)
    om = {'exact_top1_eq_bundle': 0, 'bundle_used_any': 0, 'top1_eq_prev_case_alg': 0, 'top1_eq_next_case_alg': 0, 'cases_checked': 0, 'rows': {}}
    inv = {i: inverse_alg(OLL[i]['setup']) for i in range(57)}
    for i in range(57):
        a = oam[i]
        if not a['top1']:
            continue
        om['cases_checked'] += 1
        om['exact_top1_eq_bundle'] += a['top1'] == inv[i]
        om['bundle_used_any'] += inv[i] in a['all']
        om['top1_eq_prev_case_alg'] += i > 0 and a['top1'] == inv[i - 1]
        om['top1_eq_next_case_alg'] += i < 56 and a['top1'] == inv[i + 1]
        om['rows'][i] = {'top1': a['top1'], 'bundle_inverse_setup': inv[i]}
    om['solve_level'] = {'solves': 0, 'key_eq_bundle_of_labelled_case': 0, 'key_eq_bundle_of_prev_case': 0, 'key_eq_bundle_of_next_case': 0, 'key_eq_bundle_of_any_other_case': 0}
    allinv = {}
    for i in range(57):
        allinv.setdefault(inv[i], set()).add(i)
    for r in A:
        o = r['oll']
        if o['case'] < 0 or not o['key']:
            continue
        i = o['case']
        om['solve_level']['solves'] += 1
        hit = allinv.get(o['key'], set())
        om['solve_level']['key_eq_bundle_of_labelled_case'] += i in hit
        om['solve_level']['key_eq_bundle_of_prev_case'] += (i - 1) in hit
        om['solve_level']['key_eq_bundle_of_next_case'] += (i + 1) in hit
        om['solve_level']['key_eq_bundle_of_any_other_case'] += bool(hit - {i})
    pm = {'exact_top1_eq_bundle': 0, 'bundle_used_any': 0, 'cases_checked': 0}
    for n in pnames:
        a = pam[n]
        if not a['top1']:
            continue
        pm['cases_checked'] += 1
        b = inverse_alg(PLL[n]['setup'])
        pm['exact_top1_eq_bundle'] += a['top1'] == b
        pm['bundle_used_any'] += b in a['all']
    result['numbering_check'] = {'oll': om, 'pll': pm}

    sq = json.load(open(os.path.join(lib.RAW, 'stats-smartQueue.json')))['json']
    dp = sq['drillPool']
    qs = {'gate': sq['gate'], 'method': sq['method'], 'due_cards': sq['dueCards'], 'n_due': len(sq['dueCards']),
          'drill_pool_n': len(dp), 'drill_pool_by_type': dict(collections.Counter(x['algorithmType'] for x in dp)),
          'proficiency_values': dict(collections.Counter(round(x['proficiency']) for x in dp)),
          'executions_per_case': dict(collections.Counter(len(x['executions']) for x in dp)),
          'oll_cases_missing_from_pool': [i for i in range(57) if i not in {x['caseIndex'] for x in dp if x['algorithmType'] == 'OLL'}],
          'per_case': []}
    for x in dp:
        ex = [e['executionTime'] / 1000.0 for e in x['executions']]
        nm = ('OLL %d' % (x['caseIndex'] + 1)) if x['algorithmType'] == 'OLL' else pnames[x['caseIndex']]
        qs['per_case'].append({'case': nm, 'type': x['algorithmType'], 'proficiency': x['proficiency'], 'n': len(ex),
                               'exec_median_s': med(ex), 'exec_min_s': min(ex), 'exec_max_s': max(ex)})
    result['smart_queue'] = qs

    a = R['A']
    multi_ex = {}
    for k in range(57):
        row = a['oll_cases'][k]
        if row.get('class', '').startswith('MULTI-STEP'):
            multi_ex[k] = multi_examples(A, 'oll', okey, k)
    result['oll_multistep_examples'] = multi_ex
    zb = []
    for r in A:
        if r['zbll'] is not None and r['zbll'] != -1:
            zb.append({'id': r['id'], 'zbll_index': r['zbll'], 'zbll_name': ZB.get(r['zbll']), 'oll_case': r['oll']['case'],
                       'oll_time_s': sec(r['oll']['time']), 'pll_case': r['pll']['case'], 'pll_time_s': sec(r['pll']['time']),
                       'oll_seq': ' '.join('%s@%d' % (m, ts - r['oll']['start']) for m, ts in r['oll']['seq']),
                       'pll_seq': ' '.join('%s@%d' % (m, ts - r['pll']['start']) for m, ts in r['pll']['seq'])})
    result['zbll_solves'] = zb

    wl = ['# LL worst executions (data A: newest 1000 solves, CFOP only, skips excluded)', '',
          'Ranked by stage execution time (ms from first move to last move of the stage; recognition excluded). Sequence format: token@ms-from-stage-start (stage start = end of previous stage). Rotation tokens kept as acubemy reconstructed them. time/rec/exec in seconds.', '',
          '## 15 slowest OLL executions', '', '| date (UTC) | uuid | case | stage | time | rec | exec | moves | sequence |', '|---|---|---|---|---|---|---|---|---|']
    wl += worst(A, 'oll', 'OLL', None)
    wl += ['', '## 15 slowest PLL executions', '', '| date (UTC) | uuid | case | stage | time | rec | exec | moves | sequence |', '|---|---|---|---|---|---|---|---|---|']
    wl += worst(A, 'pll', 'PLL', None)
    open(os.path.join(lib.OUT, 'll-worst.md'), 'w').write('\n'.join(wl) + '\n')

    md = build_md(result, A, B, OLL, PLL, okeys, pkeys, pnames)
    open(os.path.join(lib.OUT, 'll.md'), 'w').write('\n'.join(md) + '\n')
    json.dump(result, open(os.path.join(lib.OUT, 'll.json'), 'w'), indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
    print('ll.md lines:', len(md))


def dec_rows(sl, scale_name):
    rows = []
    for nm, key, fmt in (('time s', 'time_s', f2), ('recognition s', 'rec_s', f2), ('execution s', 'exec_s', f2),
                         ('moves HTM', 'moves', f1), ('exec TPS', 'tps', f2), ('share of solve %', 'share_pct', f1)):
        d = sl[key]
        rows.append([nm, d['n'], fmt(d['mean'])] + [fmt(d['p%d' % q]) for q in range(10, 100, 10)])
    return rows


def build_md(res, A, B, OLL, PLL, okeys, pkeys, pnames):
    m = res['meta']
    a, b = res['data']['A'], res['data']['B']
    L = []
    L += ['# Last layer (OLL / PLL) analysis', '',
          'A = the 1000 newest solves of detail data minus the %d non-CFOP (Roux, ZZ) = n %d, %s to %s. B = Default Session, newest %d export rows (%d excluded: non-CFOP or missing analysis) = n %d, %s to %s; B contains A (%d shared timestamps). All times seconds. Seed %d, %d bootstrap resamples, 95%% percentile CIs. LOW-N = n<30. Stage "time" = recognition + execution as acubemy reports it; moves = HTM, one token = 1 (X2 = 1, wide/slice = 1, rotations = 0, identity tokens = 0), matches acubemy turnCount on 1000/1000. TPS = stage moves / stage execution seconds (moves >= 2, exec > 0). Skip stages are excluded from time/rec/exec statistics unless the row says skip.' % (
              m['A_excluded_non_cfop'], m['A_n'], m['A_range'][0][:10], m['A_range'][1][:10], m['B_rows_taken'], m['B_excluded'], m['B_n'], m['B_range'][0][:10], m['B_range'][1][:10], m['A_B_overlap_by_date'], m['seed'], m['n_boot'])]
    ec = m['A_vs_export_stage_check']
    nc = res['numbering_check']
    L += ['', '## Numbering and skip encoding (evidence)',
          '- OLL: bundle chunk 7769 `ollCases` has 57 entries, `caseIndex` 0..56, `name` = "OLL "+(caseIndex+1). UI shows `"OLL "+(analysis.oll.case+1)`. So `oll.case` = standard OLL number minus 1; -1 = no OLL (skip). Export `oll_case_id` equals `oll.case` on %d/%d CFOP solves.' % (a['n'], a['n']),
          '- Bundle `setup` is the inverse of the solving alg (inverse(setup of OLL 48) = F R U R\' U\' R U R\' U\' F\', the observed idx-47 solve). Alg comparison uses the normalised key (see 3b). Cases whose most common solver alg equals the bundle alg of the labelled case: %d/%d (bundle alg appears at least once in %d); equals the bundle alg of case idx-1: %d, of idx+1: %d. Per solve (n %d): key equals bundle alg of labelled case %d, of idx-1 %d, of idx+1 %d, of any other case %d. PLL: top alg equals bundle alg in %d/%d, appears at least once in %d (solver uses other algs for the rest).' % (
              nc['oll']['exact_top1_eq_bundle'], nc['oll']['cases_checked'], nc['oll']['bundle_used_any'], nc['oll']['top1_eq_prev_case_alg'], nc['oll']['top1_eq_next_case_alg'], nc['oll']['solve_level']['solves'], nc['oll']['solve_level']['key_eq_bundle_of_labelled_case'], nc['oll']['solve_level']['key_eq_bundle_of_prev_case'], nc['oll']['solve_level']['key_eq_bundle_of_next_case'], nc['oll']['solve_level']['key_eq_bundle_of_any_other_case'], nc['pll']['exact_top1_eq_bundle'], nc['pll']['cases_checked'], nc['pll']['bundle_used_any']),
          '- Theory: OLL P = (#orientation states in bundle `lexicographicRanks`)/216, total 215 + skip 1; PLL P = states/72, total 71 + skip 1. Both read from the bundle, not memory.',
          '- Detail vs export consistency: %d of %d LL stages (time, rec, exec, tokens, timestamps) differ between `detail` and `export` rows.' % (ec['mismatch'], ec['checked']),
          '- zbllCase: -1 on %d of %d solves; set on %d: %s.' % (a['n'] - len(res['zbll_solves']), a['n'], len(res['zbll_solves']), '; '.join('%s idx %d (%s) with oll.case %d, pll.case %s' % (z['id'][:8], z['zbll_index'], z['zbll_name'], z['oll_case'], z['pll_case']) for z in res['zbll_solves']))]
    rows = []
    for nm, d, N in (('A', a, a['n']), ('B', b, b['n'])):
        s = d['skips']
        rows.append([nm, N, s['oll_skip_n'], s['oll_skip_empty_n'], s['oll_skip_time0_n'], f1(100.0 * s['oll_skip_n'] / N), '%.3f' % s['oll_skip_binom_p_vs_1_216'],
                     s['pll_skip_n'], s['pll_skip_empty_n'], s['pll_skip_auf_only_n'], s['pll_skip_other_n'], f1(100.0 * s['pll_skip_n'] / N), '%.3f' % s['pll_skip_binom_p_vs_1_72'], s['double_skip_n'],
                     s['pll_nonunknown_empty_n'], s['oll_nonskip_empty_n']])
    L += table_md('Skip encoding and rate',
                  'Columns: dataset; n solves; OLL skip = case -1 (n, of which empty moveSequence, of which time 0, % of solves, exact binomial p vs 1/216); PLL skip = case "Unknown" (n, of which empty moveSequence/time 0, AUF-only moveSequence, other non-AUF moves), % of solves, binomial p vs 1/72); double skips; PLL empty but case named; OLL empty but case set.',
                  ['set', 'n', 'OLL skip', 'empty', 't=0', '%', 'p', 'PLL skip', 'empty', 'AUF-only', 'other', '%', 'p', 'both', 'PLL empty named', 'OLL empty set'], rows)
    L += table_md('Chi-square vs theory (Monte-Carlo p, 20000 draws)', 'Columns: dataset, cells, N, chi2, df, MC p, cells with expected <5. OLL cells = 57 cases + skip; PLL cells = 21 cases + skip.',
                  ['set', 'table', 'N', 'chi2', 'df', 'p', 'cells E<5'],
                  [[nm, t, d['chi_' + t]['N'], f1(d['chi_' + t]['chi2']), d['chi_' + t]['df'], '%.3f' % d['chi_' + t]['p_mc'], d['chi_' + t]['cells_expected_lt5']] for nm, d in (('A', a), ('B', b)) for t in ('oll', 'pll')])

    rows = []
    for nm, d in (('A', a), ('B', b)):
        for st in ('oll', 'pll'):
            rows += [[nm, st.upper(), d['stage'][st]['n']] + r[:1] + r[2:] for r in dec_rows(d['stage'][st], nm)]
    L += table_md('1. Stage level distributions (skips excluded)', 'Columns: dataset, stage, n non-skip, metric, mean, then p10..p90 (p50 = median). Share = stage time / totalTime x 100.',
                  ['set', 'stage', 'n', 'metric', 'mean', 'p10', 'p20', 'p30', 'p40', 'p50', 'p60', 'p70', 'p80', 'p90'], rows)
    rows = [[q['q'], q['n'], '%s-%s' % (f2(q['total_min']), f2(q['total_max'])), f2(q['oll_time']), f2(q['pll_time']), f2(q['oll_rec']), f2(q['pll_rec']), f2(q['oll_exec']), f2(q['pll_exec']), f1(q['oll_moves']), f1(q['pll_moves']), f2(q['ll_time']), f1(q['ll_share_pct'])] for q in a['quintiles']]
    L += table_md('1b. By totalTime quintile (A)', 'Columns: quintile of totalTime (1 fastest), n, totalTime range, then medians: OLL time, PLL time, OLL rec, PLL rec, OLL exec, PLL exec, OLL moves, PLL moves (non-skip stages), LL time (OLL+PLL all solves), LL share % of solve.',
                  ['Q', 'n', 'total range', 'OLL t', 'PLL t', 'OLL rec', 'PLL rec', 'OLL ex', 'PLL ex', 'OLL mv', 'PLL mv', 'LL t', 'LL %'], rows)
    qd = a['quintile_diffs']
    L += ['', 'Q5 minus Q1 median difference (A, bootstrap CI): ' + '; '.join('%s %s %s' % (k, f2(v['diff']), ci_s(v['ci'])) for k, v in qd.items())]
    rows = [[q['block'], q['n'], q['from'] + '..' + q['to'], f2(q['total']), q['oll_n'], f2(q['oll_time']), f2(q['oll_rec']), f2(q['oll_exec']), f1(q['oll_moves']), q['pll_n'], f2(q['pll_time']), f2(q['pll_rec']), f2(q['pll_exec']), f1(q['pll_moves']), f2(q['ll_time']), f1(q['ll_share_pct'])] for q in a['blocks']]
    L += table_md('1c. Trend by blocks of 100 (A, oldest to newest)', 'Columns: block, n solves, date range, median totalTime, then per stage (non-skip n) medians of time, rec, exec, moves; LL time median, LL share %.',
                  ['blk', 'n', 'dates', 'total', 'OLL n', 't', 'rec', 'ex', 'mv', 'PLL n', 't', 'rec', 'ex', 'mv', 'LL t', 'LL %'], rows)
    tr = a['trend']
    L += ['', 'Newest 100 minus oldest 100 median (A): ' + '; '.join('%s %s %s' % (k, f2(v['diff']), ci_s(v['ci'])) for k, v in tr.items() if k.startswith(('oll', 'pll'))) + '; Spearman(index, LL time) %.2f [%.2f, %.2f] n=%d' % (tr['spearman_index_vs_ll_time']['spearman'], *tr['spearman_index_vs_ll_time']['spearman_ci'], tr['spearman_index_vs_ll_time']['n'])]
    tb = b['trend']
    L += ['B newest 100 minus oldest 100 median: ' + '; '.join('%s %s %s' % (k, f2(v['diff']), ci_s(v['ci'])) for k, v in tb.items() if k.startswith(('oll', 'pll'))), 'B Q5-Q1 totalTime quintile medians: ' + '; '.join('%s %s %s' % (k, f2(v['diff']), ci_s(v['ci'])) for k, v in b['quintile_diffs'].items())]

    def case_name_o(k):
        return 'skip' if k == 'skip' else 'OLL %d' % (k + 1)
    for st, keys, cname, ta_, nm_ in (('pll', pkeys, lambda k: k, 'pll_cases', 'PLL'), ('oll', okeys, case_name_o, 'oll_cases', 'OLL')):
        ref = a['stage_noskip_time_median'][st]
        order = sorted([k for k in keys if k != 'skip'], key=lambda k: -a[ta_][k].get('excess_pos_s', 0)) + ['skip']
        rows = []
        for k in order:
            ra, rb = a[ta_][k], b[ta_][k]
            flag = ''
            if ra['n'] >= 3 and rb['n'] >= 3 and ra.get('time_med_ci') and rb.get('time_med_ci'):
                if ra['time_med_ci'][1] < rb['time_med_ci'][0] or rb['time_med_ci'][1] < ra['time_med_ci'][0]:
                    flag = 'DISAGREE'
            if ra['n'] == 0:
                rows.append([cname(k), 0, rb['n'], f1(ra['theory_pct']), '-', f1(rb['obs_pct'])] + ['-'] * 14)
                continue
            rows.append([cname(k), lown(ra['n']), lown(rb['n']), f2(ra['theory_pct']), f2(ra['obs_pct']), f2(rb['obs_pct']),
                         f2(ra['time_med']), f2(ra['time_mean']), ci_s(ra['time_med_ci']), f2(rb['time_med']), ci_s(rb.get('time_med_ci')),
                         f2(ra['rec_med']), f2(ra['exec_med']), f1(ra['moves_med']), f2(ra['tps_med']), f1(ra['rec_gt1_pct']),
                         f2(rb['rec_med']), f2(rb['exec_med']), f2(ra['excess_pos_s']), flag])
        L += table_md('%s per case (%s), sorted by excess' % ('3. PLL' if st == 'pll' else '4. OLL', 'A with B alongside'),
                      'Columns: case; n A; n B; theory %% of solves; observed %% A; observed %% B; A median stage time, mean, bootstrap CI of median; B median, CI; A median rec, exec, moves, TPS, %% rec>1.0 s; B median rec, exec; excess = sum over A executions of max(0, time - A median %s time of non-skip %.2f); DISAGREE = median CIs of A and B do not overlap. skip row = case %s: time/rec/exec there are AUF-only or empty stages.' % (nm_, ref, '-1' if st == 'oll' else 'Unknown'),
                      ['case', 'nA', 'nB', 'theory%', 'A%', 'B%', 'A med t', 'A mean', 'A CI', 'B med t', 'B CI', 'A rec', 'A exec', 'A mv', 'A TPS', 'rec>1s%', 'B rec', 'B exec', 'excess s', 'flag'], rows)
        rows = []
        for k in order:
            ra = a[ta_][k]
            if ra['n'] == 0 or k == 'skip':
                continue
            cl = ra.get('class', '') if st == 'oll' else ''
            rows.append([cname(k), lown(ra['n']), ra['lead_dist'], ra['trail_dist'], f1(ra['fumble_pct']), f1(ra['pause400_pct']),
                         ra.get('modal_len', '-'), f1(ra.get('long_pct')), f1(ra.get('pause500_4_pct')), ra['n_distinct_algs'], f1(ra.get('top1_share_pct'))] + ([cl] if st == 'oll' else []) + [algs_s(ra['top_algs'], 3)])
        hdr = ['case', 'n', 'pre-AUF 0/1/2/3+', 'post-AUF 0/1/2/3+', 'fumble%', 'pause>400%', 'modal len', 'long%', 'pause500@4+%', 'distinct', 'top1%'] + (['class'] if st == 'oll' else []) + ['top 3 algs (count)']
        L += table_md('%s behaviour and algs (A)' % ('3b. PLL' if st == 'pll' else '4b. OLL'),
                      'Columns: case; n; pre-AUF = leading U/d turns before the alg, counts of executions with 0/1/2/3+ such tokens; post-AUF = trailing U tokens, same buckets; fumble = % with an adjacent same-face inverse pair (no rotation between); pause>400 = % with a gap >400 ms between consecutive alg moves (AUF excluded); modal len = tokens of the top alg; long = % with alg length > modal+4; pause500@4+ = % with a gap >500 ms after >=4 alg moves; distinct = number of distinct normalised algs; top1 = share of top alg; class (OLL) = MULTI-STEP if long>=30 or pause500@4+>=30, else CONSISTENT if top1>=60, else MIXED; long and pause use the raw alg moves; top algs use the normalised key: rotation tokens, leading U/d and trailing U stripped, adjacent same-face turns merged or cancelled, commuting opposite-face pairs sorted, X2 and X2\' unified, and the four y-relabelled grips (R/F/L/B) merged into the first-sorting one (raw-grip counts in ll.json).',
                      hdr, rows)
    cls = collections.defaultdict(list)
    for k in range(57):
        c = a['oll_cases'][k].get('class', 'N/A')
        cls[c].append('OLL %d' % (k + 1))
    L += ['', 'OLL class summary (A): ' + '; '.join('%s %d: %s' % (c, len(v), ' '.join(v)) for c, v in sorted(cls.items()))]
    for k, exs in res['oll_multistep_examples'].items():
        e = exs[0]
        L.append('Example OLL %d (%s, %d tokens, max gap %d ms): %s' % (k + 1, e['id'][:8], e['body_len'], e['maxgap_ms'], e['seq']))

    rows = []
    for nm, d in (('A', a), ('B', b)):
        for st in ('oll', 'pll'):
            r = d['recognition'][st + '_rec']
            rows.append([nm, st.upper(), r['n'], f2(r['mean'])] + [f2(r['p%d' % q]) for q in (10, 30, 50, 70, 90)] + [f1(r['gt1.0_pct']), f1(r['gt1.5_pct']), f1(r['gt2.0_pct']), f1(r['zero_pct'])])
    L += table_md('5. Recognition distributions (non-skip)', 'Columns: dataset, stage, n, mean, p10/p30/p50/p70/p90, % of executions with recognition >1.0, >1.5, >2.0 s, % exactly 0.',
                  ['set', 'stage', 'n', 'mean', 'p10', 'p30', 'p50', 'p70', 'p90', '>1.0%', '>1.5%', '>2.0%', '=0%'], rows)
    rows = []
    for nm, d in (('A', a), ('B', b)):
        for st in ('oll', 'pll'):
            for lab, g in d['rec_vs_gap'][st].items():
                rows.append([nm, st.upper(), lab, g['n'], g['rec_zero_n'], f1(g['within_50ms_pct']), f1(g['rec_gt_gap_50_pct']), f1(g['gap_minus_rec_median_ms']), f1(g['gap_minus_rec_p10_ms'])])
    L += table_md('5b. Recognition vs measured pause before first move', 'Columns: dataset, stage, number of leading U/d tokens in the stage (lead0, lead1, lead2+, all), n with moves, n with rec=0, % with |gap - rec| <= 50 ms, % with rec more than 50 ms longer than gap, median (gap - rec) ms, p10 (gap - rec) ms. gap = first non-rotation move timestamp - stage start. Shows how well acubemy recognition equals the visible pre-move pause.',
                  ['set', 'stage', 'lead', 'n', 'rec=0', 'within50 %', 'rec>gap %', 'med gap-rec', 'p10 gap-rec'], rows)
    rows = []
    for nm, d in (('A', a), ('B', b)):
        la, tr_ = d['recognition']['lookahead'], d['recognition']['transition']
        for lab, c in (('OLL exec vs PLL rec', la['oll_exec_vs_pll_rec']), ('OLL exec / case median vs PLL rec / case median', la['oll_exec_ratio_vs_pll_rec_ratio']),
                       ('F2L4 time vs OLL rec', tr_['f2l4_time_vs_oll_rec']), ('F2L4 exec vs OLL rec', tr_['f2l4_exec_vs_oll_rec']), ('F2L4 time vs OLL rec / case median', tr_['f2l4_time_vs_oll_rec_ratio'])):
            rows.append([nm, lab, c['n'], '%.2f %s' % (c['pearson'], ci_s(c['pearson_ci'])), '%.2f %s' % (c['spearman'], ci_s(c['spearman_ci']))])
    L += table_md('5c. Correlations (bootstrap CI)', 'Columns: dataset, pair, n, Pearson r with CI, Spearman rho with CI. Non-skip stages only. Case medians are computed within the same dataset.',
                  ['set', 'pair', 'n', 'Pearson', 'Spearman'], rows)
    rows = []
    for nm, d in (('A', a), ('B', b)):
        for q in d['recognition']['lookahead_quintiles']:
            rows.append([nm, 'OLL exec ratio Q%d' % q['q'], q['n'], f2(q['oll_exec_ratio_med']), f2(q['pll_rec_med']), f2(q['pll_rec_mean'])])
        c = d['recognition']['lookahead_q5_minus_q1']
        rows.append([nm, 'Q5-Q1 median PLL rec', '', '', '%s %s' % (f2(c['diff']), ci_s(c['ci'])), ''])
        for q in d['recognition']['transition_quintiles']:
            rows.append([nm, 'F2L4 time Q%d (%s-%s)' % (q['q'], f2(q['f2l4_time_min']), f2(q['f2l4_time_max'])), q['n'], '', f2(q['oll_rec_med']), f2(q['oll_rec_mean'])])
        c = d['recognition']['transition_q5_minus_q1']
        rows.append([nm, 'Q5-Q1 median OLL rec', '', '', '%s %s' % (f2(c['diff']), ci_s(c['ci'])), ''])
    L += table_md('5d. Lookahead and transition quintiles', 'Columns: dataset, group, n, median OLL exec as ratio to its case median (lookahead rows), median outcome (PLL recognition for OLL-exec quintiles, OLL recognition for F2L4-time quintiles), mean outcome. Q5 = slowest.',
                  ['set', 'group', 'n', 'x', 'median s', 'mean s'], rows)

    rows = []
    for nm, d in (('A', a), ('B', b)):
        for st in ('oll', 'pll'):
            t = d['potential_' + st][1]
            rows.append([nm, st.upper(), t['n_eligible_cases'], f2(t['exec_obs']), ci_s(t['exec_obs_ci']), f2(t['exec_theory']), f2(t['rec_obs']), ci_s(t['rec_obs_ci']), f2(t['rec_theory']), f2(t['cov_obs']), f2(t['cov_theory'])])
    L += table_md('6. Own-best potential per solve (median minus own p10), cases with n>=15',
                  'Columns: dataset, stage, eligible cases, expected seconds per solve if every eligible case ran at own p10 execution (weights = observed case frequency over all solves incl. skips; bootstrap CI), same with theoretical case probabilities, same for recognition (obs, CI, theory), probability mass covered by eligible cases (observed, theory). Own-best benchmark only; p10 of n=15-60 values is close to the fastest few executions.',
                  ['set', 'stage', 'cases', 'exec s', 'exec CI', 'exec s (theory wt)', 'rec s', 'rec CI', 'rec s (theory wt)', 'cov obs', 'cov theory'], rows)
    for st, nmx, cn in (('oll', 'OLL', case_name_o), ('pll', 'PLL', lambda k: k)):
        per = a['potential_' + st][0]
        top = sorted(per.items(), key=lambda kv: -(kv[1]['exec_gain'] + kv[1]['rec_gain']))[:8]
        rows = [[cn(k), v['n'], f2(v['freq'] * 100), f2(v['exec_med']), f2(v['exec_p10']), '%.3f' % v['exec_gain'], f2(v['rec_med']), f2(v['rec_p10']), '%.3f' % v['rec_gain']] for k, v in top]
        L += table_md('6%s. Top 8 %s cases by weighted exec+rec potential (A)' % (('b' if st == 'oll' else 'c'), nmx), 'Columns: case, n, frequency %, execution median, execution p10, freq x (median-p10) seconds per solve, recognition median, recognition p10, same gain. Full list in ll.json.',
                      ['case', 'n', 'freq%', 'exec med', 'exec p10', 'exec gain', 'rec med', 'rec p10', 'rec gain'], rows)

    rows = []
    for nm, d in (('A', a), ('B', b)):
        u = d['auf']
        for lab, k in (('pre-OLL', 'pre_oll'), ('pre-PLL', 'pre_pll'), ('final', 'final')):
            x = u[k]
            rows.append([nm, lab] + [x['dist'][c] for c in ('0', '1', '2', '3', '4+')] + [f2(x['mean']), f1(x['share_ge1_pct'])])
        x = u['total_per_solve']
        rows.append([nm, 'LL total'] + [x['dist'][c] for c in ('0', '1', '2', '3', '4+')] + [f2(x['mean']), '-'])
    L += table_md('7. AUF moves per solve in LL', 'Columns: dataset, component (pre-OLL = leading U/d tokens in OLL stage; pre-PLL = leading U/d tokens in PLL stage; final = trailing U tokens in PLL stage, also all U tokens of a PLL-skip stage), number of solves with 0,1,2,3,4+ tokens, mean tokens, % of solves with >=1.',
                  ['set', 'component', '0', '1', '2', '3', '4+', 'mean', '>=1 %'], rows)
    rows = []
    for nm, d in (('A', a), ('B', b)):
        u = d['auf']
        fn = u['final_net']
        rows.append([nm, fn['with_final_auf'], fn['U'], fn["U'"], fn['U2'], fn['U2_as_two_quarter_turns'], fn['U2_as_single_token'], fn['U2_as_3plus_tokens'], f1(fn['two_quarter_share_of_U2_pct']), fn['final_auf_more_tokens_than_needed']])
    L += table_md('7b. Final AUF form', 'Columns: dataset, solves with final AUF, net U, net U\', net U2, U2 done as two quarter-turn tokens, U2 as one token, U2 as 3+ tokens, % of net-U2 done as two quarter-turn tokens, solves where final AUF used more tokens than the minimum.',
                  ['set', 'with AUF', 'U', "U'", 'U2', 'U2 as 2xquarter', 'U2 one token', 'U2 3+ tok', '2xquarter % of U2', 'over-spent'], rows)
    rows = []
    for nm, d in (('A', a), ('B', b)):
        u = d['auf']
        for lab, k in (('gap before first final-AUF move', 'gap_before_first_final_auf_move'), ('final AUF duration (>=2 tokens)', 'final_auf_duration_multi_token'),
                       ('gap before last move, with final AUF', 'gap_before_last_move_with_auf'), ('gap before last move, no final AUF', 'gap_before_last_move_without_auf')):
            x = u[k]
            rows.append([nm, lab, x['n'], f2(x['median_s']), f2(x['mean_s']), f2(x['p10_s']), f2(x['p90_s'])])
        c = u['final_auf_gap_vs_no_auf_last_gap']
        rows.append([nm, 'with-AUF minus no-AUF median last gap', c['n_a'], '%s %s' % (f2(c['diff']), ci_s(c['ci'])), '', '', ''])
    L += table_md('7c. Time on final AUF', 'Columns: dataset, measure, n, median, mean, p10, p90 seconds. gap before first final-AUF move = timestamp(first trailing U) - timestamp(last alg move); last gap = timestamp(last move) - timestamp(previous move) within the PLL stage.',
                  ['set', 'measure', 'n', 'median', 'mean', 'p10', 'p90'], rows)

    qs = res['smart_queue']
    pc = qs['per_case']
    L += ['', '### 8. acubemy smartQueue (raw/stats-smartQueue.json)',
          'gate: %s. method %s. dueCards: %d (%s). drillPool: %d entries (%s), every entry proficiency %s, executions per entry %s (list of executionTime ms only). OLL cases absent from drillPool: %s. No per-case solve statistics, best times or dates are carried except the one due card (proficiency %.1f, bestTimeInTraining null, bestTimeInSolve null, empty solve/training executions, nextReviewDate %s). Drill pool exec medians (s): OLL min %s max %s; PLL min %s max %s.' % (
              qs['gate'], qs['method'], qs['n_due'], ', '.join('%s idx %d' % (c['caseInformation']['name'], c['caseInformation']['caseIndex']) for c in qs['due_cards']), qs['drill_pool_n'], qs['drill_pool_by_type'], qs['proficiency_values'], qs['executions_per_case'],
              ['OLL %d' % (i + 1) for i in qs['oll_cases_missing_from_pool']], qs['due_cards'][0]['caseStatistics']['proficiency'], qs['due_cards'][0]['caseStatistics']['nextReviewDate'],
              f2(min(x['exec_median_s'] for x in pc if x['type'] == 'OLL')), f2(max(x['exec_median_s'] for x in pc if x['type'] == 'OLL')), f2(min(x['exec_median_s'] for x in pc if x['type'] == 'PLL')), f2(max(x['exec_median_s'] for x in pc if x['type'] == 'PLL')))]
    rows = [[x['case'], f2(x['exec_median_s']), x['proficiency'] and round(x['proficiency'])] for x in sorted(pc, key=lambda x: -x['exec_median_s'])[:6]]
    L += table_md('8b. smartQueue 6 slowest median drill executions', 'Columns: case, median of the 15 drill executionTime values (s), proficiency.', ['case', 'median exec s', 'proficiency'], rows)
    return L


if __name__ == '__main__':
    main()
