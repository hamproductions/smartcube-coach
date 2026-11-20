import sys, os, json, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import lib

OUT = lib.OUT
FACES = 'UDRLFB'
NORM = {'U': (0, 1, 0), 'D': (0, -1, 0), 'R': (1, 0, 0), 'L': (-1, 0, 0), 'F': (0, 0, 1), 'B': (0, 0, -1)}
NB = 2000
SEED = 20261120
LOW = 30

def cross3(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])

def dot(a, b):
    return sum(x * y for x, y in zip(a, b))

def rot_cw(n, v):
    c = cross3(n, v)
    d = dot(n, v)
    return tuple(-c[i] + n[i] * d for i in range(3))

STICKERS = []
for pos in itertools.product((-1, 0, 1), repeat=3):
    if pos == (0, 0, 0):
        continue
    for ax in range(3):
        if pos[ax]:
            nv = [0, 0, 0]
            nv[ax] = pos[ax]
            STICKERS.append((pos, tuple(nv)))
SIDX = {s: i for i, s in enumerate(STICKERS)}
NAME_OF = {v: k for k, v in NORM.items()}
SOLVED = [NAME_OF[s[1]] for s in STICKERS]
EDGE_SLOTS = [i for i, s in enumerate(STICKERS) if sum(1 for c in s[0] if c) == 2]
EDGE_ID = {sl: k for k, sl in enumerate(EDGE_SLOTS)}

def quarter_perm(face):
    n = NORM[face]
    p = list(range(54))
    for i, (pos, nv) in enumerate(STICKERS):
        if dot(pos, n) == 1:
            p[i] = SIDX[(rot_cw(n, pos), rot_cw(n, nv))]
    return p

def compose(p, q):
    return [q[p[i]] for i in range(54)]

QP = {f: quarter_perm(f) for f in FACES}
PERM = {}
for f in FACES:
    p1 = QP[f]
    p2 = compose(p1, p1)
    p3 = compose(p2, p1)
    PERM[f] = {1: p1, 2: p2, 3: p3}

def apply(state, perm):
    new = list(state)
    for i in range(54):
        new[perm[i]] = state[i]
    return new

def parse_tok(t):
    f = t[0]
    if t.endswith('2'):
        return f, 2
    if t.endswith("'"):
        return f, 3
    return f, 1

HTM_MOVES = [(f, k) for f in FACES for k in (1, 2, 3)]
QTM_MOVES = [(f, k) for f in FACES for k in (1, 3)]
def move_name(m):
    return m[0] + {1: '', 2: '2', 3: "'"}[m[1]]
def edge_tab(m):
    p = PERM[m[0]][m[1]]
    return np.array([EDGE_ID[p[sl]] for sl in EDGE_SLOTS], dtype=np.int64)
HTM_TAB = [edge_tab(m) for m in HTM_MOVES]
QTM_TAB = [edge_tab(m) for m in QTM_MOVES]
B3, B2, B1 = 24 ** 3, 24 ** 2, 24
NSTATE = 24 ** 4

def enc(a, b, c, d):
    return a * B3 + b * B2 + c * B1 + d

def cross_pieces(face):
    return [sl for sl in EDGE_SLOTS if SOLVED[sl] == face]

def bfs(face, tabs):
    pieces = cross_pieces(face)
    st = enc(*[EDGE_ID[s] for s in pieces])
    dist = np.full(NSTATE, -1, dtype=np.int8)
    dist[st] = 0
    fr = np.array([st])
    d = 0
    while fr.size:
        a, b, c, e = fr // B3, (fr // B2) % 24, (fr // B1) % 24, fr % 24
        nx = np.concatenate([enc(t[a], t[b], t[c], t[e]) for t in tabs])
        nx = np.unique(nx)
        nx = nx[dist[nx] == -1]
        d += 1
        dist[nx] = d
        fr = nx
    return dist

def get_tables():
    path = os.path.join(OUT, 'cross_bfs.npz')
    if os.path.exists(path):
        z = np.load(path)
        return z['htm'], z['qtm']
    htm = np.stack([bfs(f, HTM_TAB) for f in FACES])
    qtm = np.stack([bfs(f, QTM_TAB) for f in FACES])
    np.savez_compressed(path, htm=htm, qtm=qtm)
    return htm, qtm

def track(state_perm_moves, face):
    loc = [EDGE_ID[s] for s in cross_pieces(face)]
    return loc

def scramble_perm(tokens):
    p = list(range(54))
    for t in tokens:
        f, k = parse_tok(t)
        p = compose(p, PERM[f][k])
    return p

def state_index(perm, face):
    return enc(*[EDGE_ID[perm[s]] for s in cross_pieces(face)])

def cross_solved(state, face):
    return all(state[s] == face for s in cross_pieces(face))

def corner_edge_pairs(face):
    pos_groups = {}
    for i, (pos, nv) in enumerate(STICKERS):
        pos_groups.setdefault(pos, []).append(i)
    corners = [g for p, g in pos_groups.items() if len(g) == 3 and face in [SOLVED[i] for i in g]]
    pairs = []
    for cg in corners:
        others = set(SOLVED[i] for i in cg) - {face}
        for p, g in pos_groups.items():
            if len(g) == 2 and set(SOLVED[i] for i in g) == others:
                pairs.append(cg + g)
    return pairs

PAIRS = {f: corner_edge_pairs(f) for f in FACES}

def pairs_solved(state, face):
    return sum(1 for g in PAIRS[face] if all(state[i] == SOLVED[i] for i in g))

def descend(idx, dist, moves, tabs):
    d = int(dist[idx])
    sol = []
    while d > 0:
        a, b, c, e = idx // B3, (idx // B2) % 24, (idx // B1) % 24, idx % 24
        for m, t in zip(moves, tabs):
            ni = int(enc(t[a], t[b], t[c], t[e]))
            if dist[ni] == d - 1:
                sol.append(move_name(m))
                idx = ni
                d -= 1
                break
    return sol

def htm_groups(raw):
    groups = []
    for m in raw:
        f, k = parse_tok(m['sliceTurn'])
        if groups and groups[-1][0] == f:
            groups[-1][1] += k
        else:
            groups.append([f, k])
    return groups

def ranks(x):
    from scipy.stats import rankdata
    return rankdata(x)
try:
    import scipy.stats
    def ranks(x):
        return scipy.stats.rankdata(x)
except Exception:
    def ranks(x):
        x = np.asarray(x, float)
        o = np.argsort(x, kind='mergesort')
        r = np.empty(len(x))
        sx = x[o]
        i = 0
        while i < len(x):
            j = i
            while j + 1 < len(x) and sx[j + 1] == sx[i]:
                j += 1
            r[o[i:j + 1]] = (i + j) / 2 + 1
            i = j + 1
        return r

def spear(x, y):
    rx, ry = ranks(x), ranks(y)
    if rx.std() == 0 or ry.std() == 0:
        return float('nan')
    return float(np.corrcoef(rx, ry)[0, 1])

RNG = np.random.default_rng(SEED)

def boot_spear(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    n = len(x)
    if n < 5:
        return float('nan'), float('nan'), float('nan')
    r = spear(x, y)
    bs = []
    for _ in range(NB):
        ii = RNG.integers(0, n, n)
        v = spear(x[ii], y[ii])
        if v == v:
            bs.append(v)
    return r, float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))

def boot_diff(a, b, stat=np.mean):
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = stat(a) - stat(b)
    ia = RNG.integers(0, len(a), (NB, len(a)))
    ib = RNG.integers(0, len(b), (NB, len(b)))
    if stat is np.mean:
        bs = a[ia].mean(1) - b[ib].mean(1)
    else:
        bs = np.median(a[ia], 1) - np.median(b[ib], 1)
    return float(d), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))

def boot_paired(d):
    d = np.asarray(d, float)
    ii = RNG.integers(0, len(d), (NB, len(d)))
    bs = d[ii].mean(1)
    return float(d.mean()), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))

def f2(x):
    return 'nan' if x != x else '%.2f' % x

def fs(ms):
    return f2(ms / 1000.0)

def cell(v):
    return '%.2f' % v

def ci_txt(t, dec=2):
    return ('%+.' + str(dec) + 'f [%+.' + str(dec) + 'f, %+.' + str(dec) + 'f]') % t

def tbl(title, header, rows):
    L = ['', '### ' + title, '| ' + ' | '.join(header) + ' |', '|' + '---|' * len(header)]
    for r in rows:
        L.append('| ' + ' | '.join(str(c) for c in r) + ' |')
    return L

def sp_line(items):
    parts = []
    for nm, x, y in items:
        r, lo, hi = boot_spear(x, y)
        parts.append('%s %.3f [%.3f, %.3f]' % (nm, r, lo, hi))
    return ['- Spearman rho [95%% CI], n=%d: %s' % (len(items[0][1]), '; '.join(parts))]

def lab(label, n):
    return str(label) + (' LOW-N' if n < LOW else '')

def main():
    htm_d, qtm_d = get_tables()
    recs = lib.load()
    scrs = [r['detail']['scramble'] for r in recs]
    rows, excluded = [], []
    for pos, r in enumerate(recs):
        d = r['detail']
        if d['analysis']['type'] != 'CFOP' or 'cross' not in d['analysis']:
            excluded.append(d['uuid'] if 'uuid' in d else d['id'])
            continue
        st = lib.stages(r)
        raw = d['rawSolutionSequence']
        cr = st[0]
        cend = cr['end']
        face = d['analysis']['cross']['face']
        toks = d['scramble'].split()
        sp = scramble_perm(toks)
        state = [None] * 54
        for i in range(54):
            state[sp[i]] = SOLVED[i]
        s0 = list(state)
        pf = {f: state_index(sp, f) for f in FACES}
        opt_h = {f: int(htm_d[FACES.index(f)][pf[f]]) for f in FACES}
        opt_q = {f: int(qtm_d[FACES.index(f)][pf[f]]) for f in FACES}
        cur = list(state)
        full_ok = None
        nend, first_solved = None, (0 if cross_solved(cur, face) else None)
        flags = [cross_solved(cur, face)]
        ps_at_end = None
        for i, m in enumerate(raw):
            f, k = parse_tok(m['sliceTurn'])
            if m['timeStamp'] > cend and nend is None:
                nend = i
                ps_at_end = (cross_solved(cur, face), pairs_solved(cur, face))
            cur = apply(cur, PERM[f][k])
            flags.append(cross_solved(cur, face))
            if first_solved is None and flags[-1]:
                first_solved = i + 1
        if nend is None:
            nend = len(raw)
            ps_at_end = (cross_solved(cur, face), pairs_solved(cur, face))
        full_ok = cur == SOLVED
        cm = raw[:nend]
        fs_ = first_solved if first_solved is not None else nend
        broken = sum(1 for q in range(fs_, nend + 1) if not flags[q])
        cmf = raw[:fs_]
        used_hf = len(htm_groups(cmf))
        time_f = cmf[-1]['timeStamp'] if cmf else 0
        grp = htm_groups(cm)
        used_h = len(grp)
        used_q = len(cm)
        zero_net = sum(1 for g in grp if g[1] % 4 == 0)
        ts = [m['timeStamp'] for m in cm]
        gaps = [b - a for a, b in zip(ts, ts[1:])]
        maxgap = max(gaps) if gaps else 0
        tail = cend - ts[-1] if ts else cend
        rot = sum(1 for m in cr['moves'] if m['sliceTurn'][0] in 'xyz' and m['timeStamp'] > 0)
        rec1 = st[1]['recognition']
        rows.append(dict(
            uuid=d['uuid'], pos=pos, date=d['date'], scramble=d['scramble'], face=face,
            total=d['totalTime'], insp=d['inspectionTime'], ctime=cr['time'], cend=cend,
            opt_h=opt_h, opt_q=opt_q, used_h=used_h, used_q=used_q, zero_net=zero_net,
            exc_h=used_h - opt_h[face], exc_hf=used_hf - opt_h[face], exc_q=used_q - opt_q[face],
            used_hf=used_hf, time_f=time_f, broken=broken, used_qf=len(cmf),
            full_ok=full_ok, cross_ok=ps_at_end[0], npairs=ps_at_end[1],
            first_solved=first_solved, nend=nend, gaps=gaps, maxgap=maxgap, tail=tail, rot=rot,
            raw=[(m['sliceTurn'], m['timeStamp']) for m in cm],
            rec=[s['recognition'] for s in st[1:5]], exe=[s['execution'] for s in st[1:5]],
            f2l_times=[s['time'] for s in st[1:5]],
            state_idx=pf))
    N = len(rows)
    A = lambda k: np.array([r[k] for r in rows], float)
    ctime, total, insp = A('ctime') / 1000, A('total') / 1000, A('insp') / 1000
    exc = A('exc_h'); used_h = A('used_h'); used_q = A('used_q'); maxgap = A('maxgap')
    optc = np.array([r['opt_h'][r['face']] for r in rows], float)
    optcq = np.array([r['opt_q'][r['face']] for r in rows], float)
    best6 = np.array([min(r['opt_h'].values()) for r in rows], float)
    best6q = np.array([min(r['opt_q'].values()) for r in rows], float)
    faces = [r['face'] for r in rows]
    fcount = {f: faces.count(f) for f in FACES}
    used_faces = [f for f in FACES if fcount[f] >= 0.05 * N]
    bestused = np.array([min(r['opt_h'][f] for f in used_faces) for r in rows], float)
    bestusedq = np.array([min(r['opt_q'][f] for f in used_faces) for r in rows], float)
    oU = np.array([r['opt_h']['U'] for r in rows], float)
    oD = np.array([r['opt_h']['D'] for r in rows], float)
    oUq = np.array([r['opt_q']['U'] for r in rows], float)
    oDq = np.array([r['opt_q']['D'] for r in rows], float)
    tps_h = used_h / ctime
    tps_q = used_q / ctime
    nfull = sum(r['full_ok'] for r in rows)
    ncross = sum(r['cross_ok'] for r in rows)
    nfirst_eq = sum(1 for r in rows if r['first_solved'] == r['nend'])
    nfirst_lt = sum(1 for r in rows if r['first_solved'] is not None and r['first_solved'] < r['nend'])
    nfirst_gt = sum(1 for r in rows if r['first_solved'] is not None and r['first_solved'] > r['nend'])
    nfirst_none = sum(1 for r in rows if r['first_solved'] is None)
    exc_neg = int((exc < 0).sum())
    bad_cross = [r['uuid'] for r in rows if not r['cross_ok']]
    tail_pos = np.array([r['tail'] for r in rows])
    zero_net_tot = sum(r['zero_net'] for r in rows)
    pairs_end = np.array([r['npairs'] for r in rows])
    uniq_scr = len(set(scrs))

    def stat3(v):
        v = np.asarray(v, float)
        return [len(v), cell(np.median(v)), cell(v.mean())]

    def qs(v):
        return [cell(x) for x in np.percentile(v, [0, 10, 25, 50, 75, 90, 100])]

    md = []
    md.append('# Cross and cross-to-first-pair analysis')
    md.append('')
    md.append('Source: 1000 newest solves, GAN i4. Excluded: %d non-CFOP solves (no cross stage). Analysed N=%d. Times in seconds. CI = bootstrap 95%% percentile, %d resamples, seed %d. LOW-N = n<%d. Cube-frame raw moves (face turns only) applied to the scramble in standard orientation.' % (len(excluded), N, NB, SEED, LOW))
    md.append('Definitions: opt = optimal cross length for the chosen face from the scrambled state (BFS over 190,080 four-edge states); HTM = half-turn metric, QTM = quarter-turn metric. used HTM = raw face turns up to cross end (timestamp <= cross stage end) with consecutive same-face quarter turns collapsed to one move. used QTM = raw quarter-turn count. excess = used - opt (same metric). pause = gap between consecutive raw quarter-turn timestamps inside the cross.')
    md += tbl('1. Verification. Columns: check, count, of', ['check', 'count', 'of'], [
        ['scramble + full raw solution gives solved cube', nfull, N],
        ['4 cross edges of cross.face solved after raw moves with ts <= cross end', ncross, N],
        ['first raw prefix with cross solved == prefix at cross end', nfirst_eq, N],
        ['first solved prefix earlier than cross-end prefix (cross finished before acubemy end)', nfirst_lt, N],
        ['first solved prefix later than cross-end prefix', nfirst_gt, N],
        ['cross never solved in raw sequence', nfirst_none, N],
        ['excess < 0 (used < optimal)', exc_neg, N],
        ['crosses with >=1 collapsed same-face group of net 0 (e.g. D D\')', sum(1 for r in rows if r['zero_net']), N],
        ['unique scrambles among 1000 (export join key)', uniq_scr, len(scrs)],
    ])
    md.append('')
    md.append('Cross end minus last raw cross move timestamp (ms): median %d, max %d, n with gap > 100 ms: %d.' % (np.median(tail_pos), tail_pos.max(), int((tail_pos > 100).sum())))
    md.append('')
    base_ok = np.array([r['cross_ok'] for r in rows])

    md += tbl('2. Chosen cross face. Columns: face, n, share, cross time median, cross time mean, excess HTM median, excess HTM mean, opt HTM mean', ['face', 'n', 'share %', 'time med', 'time mean', 'exc med', 'exc mean', 'opt mean'], [
        [lab(f, fcount[f]), fcount[f], '%.1f' % (100 * fcount[f] / N)] + [cell(np.median(ctime[[x == f for x in faces]])), cell(ctime[[x == f for x in faces]].mean()), cell(np.median(exc[[x == f for x in faces]])), cell(exc[[x == f for x in faces]].mean()), cell(optc[[x == f for x in faces]].mean())] if fcount[f] else [f, 0, '0.0', '', '', '', '', ''] for f in FACES if fcount[f]])
    md.append('')
    md.append('Faces never chosen: %s. Faces used by >=5%% of solves (used-face set for item 7): %s.' % (' '.join(f for f in FACES if not fcount[f]) or 'none', ' '.join(used_faces)))

    def dist_rows(vals_list, labels, mx=None):
        out = []
        for v in range(2, 13):
            out.append([v if v < 12 else '12+'] + [int((np.asarray(vs) == v).sum() if v < 12 else (np.asarray(vs) >= 12).sum()) for vs in vals_list])
        return out
    md += tbl('3a. Length distribution, counts of solves. Columns: length, opt HTM chosen face, used HTM, opt HTM best of 6 faces, opt QTM chosen face, used QTM, opt QTM best of 6', ['len', 'opt HTM chosen', 'used HTM', 'opt HTM best6', 'opt QTM chosen', 'used QTM', 'opt QTM best6'],
              dist_rows([optc, used_h, best6, optcq, used_q, best6q], None))
    summ_rows = []
    for nm, v in [('opt HTM chosen', optc), ('used HTM', used_h), ('opt HTM best6', best6), ('opt QTM chosen', optcq), ('used QTM', used_q), ('opt QTM best6', best6q)]:
        summ_rows.append([nm] + stat3(v))
    eg = [(0, exc == 0), (1, exc == 1), (2, exc == 2), (3, exc == 3), ('4+', exc >= 4)]
    md += tbl('3c. Excess (HTM) distribution. Columns: excess, n, share %, cross time median, cross time mean', ['excess', 'n', 'share %', 'time med', 'time mean'],
              [[lab(l, int(m.sum())), int(m.sum()), '%.1f' % (100 * m.sum() / N)] + (stat3(ctime[m])[1:] if m.sum() else ['', '']) for l, m in eg])
    md.append('')
    md.append('Excess HTM: median %s, mean %s. Excess QTM: median %s, mean %s.' % (cell(np.median(exc)), cell(exc.mean()), cell(np.median(A('exc_q'))), cell(A('exc_q').mean())))

    summ2 = [r + [cell(np.percentile(v, 90))] for r, v in zip(summ_rows, [optc, used_h, best6, optcq, used_q, best6q])]
    cols = [('cross time s', ctime), ('used HTM', used_h), ('used QTM', used_q), ('HTM TPS', tps_h), ('QTM TPS', tps_q), ('longest pause s', maxgap / 1000), ('rotations in cross (ts>0)', A('rot'))]
    for nm, v in cols:
        summ2.append([nm] + stat3(v) + [cell(np.percentile(v, 90))])
    md += tbl('3b-4. Per-solve cross metrics (length rows in moves). Columns: metric, n, median, mean, p90', ['metric', 'n', 'median', 'mean', 'p90'], summ2)
    rotc = A('rot')
    md.append('')
    md.append('Crosses with >=1 mid-cross rotation token: %d of %d (%.1f%%). Crosses with an already-solved F2L pair (corner+edge in place) at cross end: %d of %d.' % (int((rotc > 0).sum()), N, 100 * (rotc > 0).mean(), int((pairs_end > 0).sum()), N))

    used_hf, exc_hf, time_f = A('used_hf'), A('exc_hf'), A('time_f') / 1000
    extra_h = used_h - used_hf
    extra_t = ctime - time_f
    brk = A('broken')
    sens = [['cross time to first prefix with 4 edges solved s'] + stat3(time_f), ['used HTM to that prefix'] + stat3(used_hf), ['excess HTM to that prefix'] + stat3(exc_hf),
            ['HTM moves after first solved prefix, up to acubemy cross end'] + stat3(extra_h), ['time after first solved prefix, up to acubemy cross end s'] + stat3(extra_t)]
    md += tbl('4b. Sensitivity: cross at first raw prefix where the 4 cross edges are solved vs acubemy cross end. Columns: metric, n, median, mean', ['metric', 'n', 'median', 'mean'], sens)
    md.append('')
    md.append('- Solves with >=1 extra HTM move after first solved prefix: %d of %d; >=3 extra: %d; >=6 extra: %d; cross unsolved again at some prefix between first-solved and acubemy end: %d; acubemy cross end with all four pairs in place: %d.' % (int((extra_h >= 1).sum()), N, int((extra_h >= 3).sum()), int((extra_h >= 6).sum()), int((brk > 0).sum()), int((pairs_end == 4).sum())))
    md.append('- Paired mean diff [95%% CI] excess HTM (acubemy end minus first-solved prefix): %s; cross time s: %s' % (ci_txt(boot_paired(exc - exc_hf)), ci_txt(boot_paired(ctime - time_f))))
    md.append('- First-solved-prefix excess HTM distribution (0,1,2,3,4+): %s' % ' '.join('%d' % (int((exc_hf == k).sum()) if k < 4 else int((exc_hf >= 4).sum())) for k in range(5)))
    md += sp_line([('time_first vs excess_first HTM', exc_hf, time_f)])

    def group_table(title, gdefs, mets, extra_diff=True):
        header = ['group', 'n'] + [m[0] + s for m in mets for s in (' med', ' mean')]
        out = []
        for l, m in gdefs:
            m = np.asarray(m)
            n = int(m.sum())
            row = [lab(l, n), n]
            for _, v in mets:
                row += [cell(np.median(v[m])), cell(v[m].mean())] if n else ['', '']
            out.append(row)
        L = tbl(title, header, out)
        if extra_diff:
            ok = [(l, np.asarray(m)) for l, m in gdefs if np.asarray(m).sum() >= 2]
            if len(ok) >= 2:
                a, b = ok[-1], ok[0]
                L.append('- Mean diff [95%% CI] (%s minus %s): %s' % (a[0], b[0], '; '.join('%s %s' % (nm, ci_txt(boot_diff(v[a[1]], v[b[1]]))) for nm, v in mets)))
        return L

    def val_groups(v, cap=12):
        g = [(int(x), v == x) for x in sorted(set(v.tolist())) if x < cap]
        g.append(('%d+' % cap, v >= cap))
        return [(l, m) for l, m in g if m.sum()]
    md += group_table('5a. Cross time by optimal HTM length (chosen face). Columns: group=opt len, n, cross time s, excess HTM', val_groups(optc, 99), [('time', ctime), ('exc', exc)], False)
    md += group_table('5b. Cross time by excess HTM. Columns: group=excess, n, cross time s, used HTM, TPS', [(l, m) for l, m in eg], [('time', ctime), ('used', used_h), ('tps', tps_h)], True)
    md += group_table('5c. Cross time by used HTM length. Columns: group=used len, n, cross time s, excess', val_groups(used_h), [('time', ctime), ('exc', exc)], False)
    md += sp_line([('cross time vs excess HTM', exc, ctime), ('vs used HTM', used_h, ctime), ('vs opt HTM', optc, ctime), ('vs excess QTM', A('exc_q'), ctime)])

    order = np.argsort(total, kind='mergesort')
    qidx = np.array_split(order, 5)
    qm = []
    for i, ix in enumerate(qidx):
        m = np.zeros(N, bool); m[ix] = True
        qm.append(('Q%d (%s-%s s)' % (i + 1, f2(total[ix].min()), f2(total[ix].max())), m))
    md += group_table('6. By totalTime quintile (Q1 fastest). Columns: group, n, cross time s, excess HTM, cross share of total %', qm, [('time', ctime), ('exc', exc), ('share%', ctime / total * 100)], True)
    md += sp_line([('totalTime vs cross time', total, ctime), ('totalTime vs excess HTM', total, exc)])

    pos = A('pos')
    bm = []
    for b in range(10):
        m = (pos // 100 == b)
        if m.sum():
            ds = [rows[i]['date'][:10] for i in np.where(m)[0]]
            bm.append(('B%d %s..%s' % (b + 1, ds[0], ds[-1]), m))
    md += group_table('7. Blocks of 100 solves in chronological order (B1 oldest; position in the 1000). Columns: group, n, cross time s, excess HTM, used HTM, opt HTM chosen, longest pause s', bm, [('time', ctime), ('exc', exc), ('used', used_h), ('opt', optc), ('pause', maxgap / 1000)], True)
    md += sp_line([('position vs cross time', pos, ctime), ('vs excess HTM', pos, exc), ('vs longest pause', pos, maxgap)])

    md.append('')
    md.append('## Planning proxies')
    thr = [(400, (maxgap > 400)), (800, (maxgap > 800))]
    md += tbl('8a. Longest inter-move pause inside cross. Columns: stat, value', ['stat', 'value'], [
        ['n', N], ['median s', cell(np.median(maxgap) / 1000)], ['mean s', cell(maxgap.mean() / 1000)], ['p90 s', cell(np.percentile(maxgap, 90) / 1000)],
        ['crosses with any pause > 400 ms', '%d (%.1f%%)' % (int(thr[0][1].sum()), 100 * thr[0][1].mean())],
        ['crosses with any pause > 800 ms', '%d (%.1f%%)' % (int(thr[1][1].sum()), 100 * thr[1][1].mean())],
        ['crosses with zero pauses > 300 ms', '%d (%.1f%%)' % (int((maxgap <= 300).sum()), 100 * (maxgap <= 300).mean())],
    ])
    pg = [('no pause > 400', maxgap <= 400), ('pause 400-800', (maxgap > 400) & (maxgap <= 800)), ('pause > 800', maxgap > 800)]
    md += group_table('8b. By longest pause bucket. Columns: group, n, cross time s, excess HTM, used HTM', pg, [('time', ctime), ('exc', exc), ('used', used_h)], True)
    md += sp_line([('longest pause vs excess HTM', maxgap, exc), ('vs cross time', maxgap, ctime)])
    oi = np.argsort(insp, kind='mergesort')
    tq = np.array_split(oi, 3)
    tm = []
    for i, ix in enumerate(tq):
        m = np.zeros(N, bool); m[ix] = True
        tm.append(('T%d (%s-%s s)' % (i + 1, f2(insp[ix].min()), f2(insp[ix].max())), m))
    md += group_table('8c. By inspectionTime tercile (T1 shortest). Columns: group, n, cross time s, excess HTM, longest pause s, opt HTM', tm, [('time', ctime), ('exc', exc), ('pause', maxgap / 1000), ('opt', optc)], True)
    md += sp_line([('inspection vs excess HTM', insp, exc), ('vs cross time', insp, ctime), ('vs longest pause', insp, maxgap), ('vs opt HTM', insp, optc)])
    md.append('')
    md.append('Inspection time: median %s s, mean %s s, min %s, max %s.' % (cell(np.median(insp)), cell(insp.mean()), cell(insp.min()), cell(insp.max())))

    md.append('')
    md.append('## Cross to first pair')
    rec = np.array([np.nan if r['rec'][0] is None else r['rec'][0] / 1000 for r in rows])
    ok = ~np.isnan(rec)
    nrec_none = int((~ok).sum())
    rv = rec[ok]
    md += tbl('9a. First-pair recognition (stage f2l1 recognition) s. Columns: n, min, p10, p25, median, p75, p90, max, mean, >1.0 s, >1.5 s, >2.0 s', ['n', 'min', 'p10', 'p25', 'med', 'p75', 'p90', 'max', 'mean', '>1.0', '>1.5', '>2.0'],
              [[len(rv)] + qs(rv) + [cell(rv.mean())] + ['%d (%.1f%%)' % (int((rv > t).sum()), 100 * (rv > t).mean()) for t in (1.0, 1.5, 2.0)]])
    md.append('')
    md.append('Missing f2l1 recognition: %d. Recognition == 0 at pair 1: %d.' % (nrec_none, int((rv == 0).sum())))
    pr = []
    allrec = []
    for k in range(4):
        v = np.array([np.nan if r['rec'][k] is None else r['rec'][k] / 1000 for r in rows])
        allrec.append(v)
        vv = v[~np.isnan(v)]
        pr.append([lab('pair %d' % (k + 1), len(vv)), len(vv), cell(np.median(vv)), cell(vv.mean())] + ['%d (%.1f%%)' % (int((vv > t).sum()), 100 * (vv > t).mean()) for t in (1.0, 1.5, 2.0)])
    md += tbl('9b. Recognition by F2L pair order. Columns: pair, n, median s, mean s, >1.0, >1.5, >2.0', ['pair', 'n', 'median', 'mean', '>1.0', '>1.5', '>2.0'], pr)
    ex = [np.array([np.nan if r['exe'][k] is None else r['exe'][k] / 1000 for r in rows]) for k in range(4)]
    both = ~np.isnan(allrec[0]) & ~np.isnan(allrec[1]) & ~np.isnan(allrec[2]) & ~np.isnan(allrec[3])
    oth = np.nanmean(np.vstack(allrec[1:]), axis=0)
    dm = (allrec[0] - oth)[both]
    md.append('')
    md.append('- Paired mean diff recognition, same solve, n=%d, s [95%% CI]: pair1 minus mean(pairs 2-4) %s; minus pair2 %s; minus pair3 %s; minus pair4 %s' % ((int(both.sum()), ci_txt(boot_paired(dm))) + tuple(ci_txt(boot_paired((allrec[0] - allrec[k])[both])) for k in (1, 2, 3))))
    md.append('- Pair 1 execution median %s mean %s; pair 2-4 execution medians %s mean %s (s).' % (cell(np.nanmedian(ex[0])), cell(np.nanmean(ex[0])), '/'.join(cell(np.nanmedian(e)) for e in ex[1:]), '/'.join(cell(np.nanmean(e)) for e in ex[1:])))

    def sub(v):
        return v[ok]
    c_exc, c_time, c_gap, c_ins, c_opt = sub(exc), sub(ctime), sub(maxgap), sub(insp), sub(optc)
    md += sp_line([('first-pair recognition vs cross excess HTM', c_exc, rv), ('vs cross time', c_time, rv), ('vs cross longest pause', c_gap, rv), ('vs inspection', c_ins, rv), ('vs cross used HTM', sub(used_h), rv), ('vs opt HTM', c_opt, rv)])
    xm = pairs_end[ok] > 0
    eg2 = [(0, c_exc == 0), (1, c_exc == 1), (2, c_exc == 2), ('3+', c_exc >= 3)]
    def gt(title, gd, vals, first):
        out = []
        for l, m in gd:
            n = int(m.sum())
            out.append([lab(l, n), n, cell(np.median(vals[m])) if n else '', cell(vals[m].mean()) if n else ''] + (['%d (%.1f%%)' % (int((vals[m] > t).sum()), 100 * (vals[m] > t).mean()) for t in (1.0, 1.5, 2.0)] if n else ['', '', '']))
        L = tbl(title, ['group', 'n', 'rec med s', 'rec mean s', '>1.0', '>1.5', '>2.0'], out)
        oks = [(l, m) for l, m in gd if m.sum() >= 2]
        if len(oks) >= 2:
            L.append('- Mean diff recognition s [95%% CI] (%s minus %s): %s' % (oks[-1][0], oks[0][0], ci_txt(boot_diff(vals[oks[-1][1]], vals[oks[0][1]]))))
        return L
    md += gt('9c. First-pair recognition by cross excess HTM. Columns: group=excess, n, rec median, rec mean, share above thresholds', eg2, rv, 0)
    md += gt('9d. First-pair recognition by longest cross pause bucket', [('no pause > 400', c_gap <= 400), ('pause 400-800', (c_gap > 400) & (c_gap <= 800)), ('pause > 800', c_gap > 800)], rv, 0)
    ioi = np.argsort(c_ins, kind='mergesort')
    tt = np.array_split(ioi, 3)
    gd = []
    for i, ix in enumerate(tt):
        m = np.zeros(len(rv), bool); m[ix] = True
        gd.append(('inspection T%d (%s-%s s)' % (i + 1, f2(c_ins[ix].min()), f2(c_ins[ix].max())), m))
    md += gt('9e. First-pair recognition by inspection tercile', gd, rv, 0)
    ci_ = np.argsort(c_time, kind='mergesort')
    tc = np.array_split(ci_, 3)
    gd = []
    for i, ix in enumerate(tc):
        m = np.zeros(len(rv), bool); m[ix] = True
        gd.append(('cross time T%d (%s-%s s)' % (i + 1, f2(c_time[ix].min()), f2(c_time[ix].max())), m))
    md += gt('9f. First-pair recognition by cross time tercile', gd, rv, 0)
    md += gt('9g. First-pair recognition by pair already solved at cross end', [('no pair solved at cross end', ~xm), ('>=1 pair solved at cross end', xm)], rv, 0)
    md.append('')
    md.append('First-pair recognition vs total F2L pair-1 time: pair 1 stage time median %s s mean %s s.' % (cell(np.median([r['f2l_times'][0] for r in rows]) / 1000), cell(np.mean([r['f2l_times'][0] for r in rows]) / 1000)))

    md.append('')
    md.append('## Face choice quality')
    def vs_chosen(nm, v, base):
        d, lo, hi = boot_diff(v, base)
        return [nm] + stat3(v) + [ci_txt((d, lo, hi))]
    md += tbl('10a. Optimal cross length under face policies. Columns: policy, n, median, mean, mean diff vs chosen face with CI (negative = shorter than chosen)', ['policy', 'n', 'median', 'mean', 'mean diff vs chosen [CI]'], [
        ['chosen face HTM'] + stat3(optc) + ['-'],
        vs_chosen('best of 6 HTM', best6, optc),
        vs_chosen('best of used faces (%s) HTM' % ''.join(used_faces), bestused, optc),
        vs_chosen('U only HTM', oU, optc), vs_chosen('D only HTM', oD, optc), vs_chosen('best of U,D HTM', np.minimum(oU, oD), optc),
        ['chosen face QTM'] + stat3(optcq) + ['-'],
        vs_chosen('best of 6 QTM', best6q, optcq),
        vs_chosen('best of used faces QTM', bestusedq, optcq),
        vs_chosen('U only QTM', oUq, optcq), vs_chosen('D only QTM', oDq, optcq), vs_chosen('best of U,D QTM', np.minimum(oUq, oDq), optcq),
    ])
    l6, lu = optc - best6, optc - bestused
    md += tbl('10b. Moves lost by chosen face vs better available face (HTM). Columns: lost, n vs best of 6, n vs best of used faces', ['lost', 'vs best6 n', 'vs used-faces n'], [
        [l if l < 3 else '3+', int((l6 == l).sum() if l < 3 else (l6 >= 3).sum()), int((lu == l).sum() if l < 3 else (lu >= 3).sum())] for l in range(4)])
    md.append('')
    md.append('Mean lost vs best6 %s, vs used faces %s. Chosen face is a (tied-)best of 6 in %d of %d; (tied-)best of used faces in %d of %d.' % (cell(l6.mean()), cell(lu.mean()), int((l6 == 0).sum()), N, int((lu == 0).sum()), N))
    md.append('')
    md.append('Chosen face is the unique best of 6 in %d of %d.' % (sum(1 for r in rows if sum(1 for f in FACES if r['opt_h'][f] == min(r['opt_h'].values())) == 1 and r['opt_h'][r['face']] == min(r['opt_h'].values())), N))
    md += tbl('10c. Actual used HTM versus alternatives (mean over solves). Columns: quantity, n, median, mean, mean diff vs used with CI', ['quantity', 'n', 'median', 'mean', 'mean diff [CI]'], [
        ['used HTM'] + stat3(used_h) + ['-'],
        vs_chosen('opt chosen', optc, used_h), vs_chosen('opt best6', best6, used_h), vs_chosen('opt best of used faces', bestused, used_h)])
    ch_best = np.array([r['opt_h'][r['face']] == min(r['opt_h'].values()) for r in rows])
    md += group_table('10d. Cross time and excess when chosen face is (tied) best of 6 vs not. Columns: group, n, cross time s, excess HTM, used HTM', [('chosen is best', ch_best), ('chosen not best', ~ch_best)], [('time', ctime), ('exc', exc), ('used', used_h)], True)
    md.append('- Pairs in place at acubemy cross end, counts for 0..4 pairs: %s' % ' '.join('%d' % int((pairs_end == k).sum()) for k in range(5)))

    if len(md) > 300:
        md.append('WARNING: over 300 lines')
    open(os.path.join(OUT, 'cross.md'), 'w').write('\n'.join(md) + '\n')

    def worst(key, title):
        idx = sorted(range(N), key=key)[:15]
        L = ['## ' + title, '']
        for r_i in idx:
            r = rows[r_i]
            f = r['face']
            fi = FACES.index(f)
            sol = descend(r['state_idx'][f], htm_d[fi], HTM_MOVES, HTM_TAB)
            L.append('### %s  %s  total %s s' % (r['uuid'], r['date'], fs(r['total'])))
            L.append('')
            L.append('- scramble: `%s`' % r['scramble'])
            L.append('- chosen face %s; cross time %s s; opt HTM %d (best of 6: %d on %s); used HTM %d; excess HTM %d; used QTM %d (opt QTM %d); longest pause %s s; mid-cross rotations %d; cross verified %s' % (
                f, fs(r['ctime']), r['opt_h'][f], min(r['opt_h'].values()), ''.join(g for g in FACES if r['opt_h'][g] == min(r['opt_h'].values())), r['used_h'], r['exc_h'], r['used_q'], r['opt_q'][f], fs(r['maxgap']), r['rot'], r['cross_ok']))
            L.append('- an optimal HTM solution (scramble frame, cube fixed orientation): `%s`' % ' '.join(sol))
            L.append('- raw moves used (move@ms, scramble frame): `%s`' % ' '.join('%s@%d' % m for m in r['raw']))
            L.append('')
        return L
    wl = ['# Worst crosses', '', 'Face letters and raw moves are in the scramble frame (white U, green F). Sorted by cross time desc / excess HTM desc (ties by cross time).', '']
    wl += worst(lambda i: -rows[i]['ctime'], '15 worst crosses by cross time')
    wl += worst(lambda i: (-rows[i]['exc_h'], -rows[i]['ctime']), '15 worst crosses by excess HTM')
    open(os.path.join(OUT, 'cross-worst.md'), 'w').write('\n'.join(wl) + '\n')

    per = {}
    for r in rows:
        f = r['face']
        per[r['uuid']] = dict(
            date=r['date'], position=r['pos'], face=f, total_ms=r['total'], inspection_ms=r['insp'], cross_time_ms=r['ctime'],
            opt_htm_by_face=r['opt_h'], opt_qtm_by_face=r['opt_q'], opt_htm_chosen=r['opt_h'][f], opt_qtm_chosen=r['opt_q'][f],
            used_htm=r['used_h'], used_qtm=r['used_q'], excess_htm=r['exc_h'], excess_qtm=r['exc_q'],
            cross_tps_htm=r['used_h'] / (r['ctime'] / 1000), cross_tps_qtm=r['used_q'] / (r['ctime'] / 1000),
            mid_cross_rotations=r['rot'], longest_pause_ms=r['maxgap'], cross_end_tail_ms=r['tail'],
            full_solve_verified=bool(r['full_ok']), cross_verified=bool(r['cross_ok']),
            pairs_solved_at_cross_end=r['npairs'], first_pair_recognition_ms=r['rec'][0],
            recognition_ms_pairs_1_to_4=r['rec'], raw_cross_moves=r['raw'])
    agg = dict(
        n_analysed=N, excluded_non_cfop=excluded, rng_seed=SEED, bootstrap_resamples=NB,
        verification=dict(full_solve_solved=nfull, cross_solved_at_end=ncross, first_solved_eq_end=nfirst_eq, first_solved_before_end=nfirst_lt, first_solved_after_end=nfirst_gt, never_solved=nfirst_none, excess_negative=exc_neg, cross_not_verified_uuids=bad_cross),
        chosen_face_counts=fcount, used_faces=used_faces,
        medians=dict(cross_time_s=float(np.median(ctime)), excess_htm=float(np.median(exc)), used_htm=float(np.median(used_h)), opt_htm_chosen=float(np.median(optc)), opt_htm_best6=float(np.median(best6))),
        means=dict(cross_time_s=float(ctime.mean()), excess_htm=float(exc.mean()), used_htm=float(used_h.mean()), opt_htm_chosen=float(optc.mean()), opt_htm_best6=float(best6.mean())),
        first_pair_recognition_s=dict(n=int(len(rv)), median=float(np.median(rv)), mean=float(rv.mean()), gt_1_0=int((rv > 1).sum()), gt_1_5=int((rv > 1.5).sum()), gt_2_0=int((rv > 2).sum())))
    json.dump(dict(aggregates=agg, per_solve=per), open(os.path.join(OUT, 'cross.json'), 'w'), indent=1)
    print('md lines', len(md), 'N', N, 'full', nfull, 'cross', ncross)

if __name__ == '__main__':
    main()
