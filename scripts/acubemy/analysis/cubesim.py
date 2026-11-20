import itertools
import re
import numpy as np

N = {'R': (1, 0, 0), 'L': (-1, 0, 0), 'U': (0, 1, 0), 'D': (0, -1, 0), 'F': (0, 0, 1), 'B': (0, 0, -1)}
FACE_OF = {v: k for k, v in N.items()}


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _rot(n, v):
    d = n[0] * v[0] + n[1] * v[1] + n[2] * v[2]
    c = _cross(n, v)
    return (n[0] * d - c[0], n[1] * d - c[1], n[2] * d - c[2])


STICKERS = []
for p in itertools.product((-1, 0, 1), repeat=3):
    for f, n in N.items():
        ax = [i for i in range(3) if n[i]][0]
        if p[ax] == n[ax]:
            STICKERS.append((p, n))
IDX = {s: i for i, s in enumerate(STICKERS)}
SOLVED = np.array([['R', 'L', 'U', 'D', 'F', 'B'].index(FACE_OF[n]) for p, n in STICKERS])
CENTER_IDX = {f: IDX[(n, n)] for f, n in N.items()}

_TOK = re.compile(r"^([RLUDFBrludfbMESxyz])(\d?)('?)$")
_LAYERS = {
    'R': ('R', (1,)), 'L': ('L', (-1,)), 'U': ('U', (1,)), 'D': ('D', (-1,)), 'F': ('F', (1,)), 'B': ('B', (-1,)),
    'r': ('R', (1, 0)), 'l': ('L', (-1, 0)), 'u': ('U', (1, 0)), 'd': ('D', (-1, 0)), 'f': ('F', (1, 0)), 'b': ('B', (-1, 0)),
    'M': ('L', (0,)), 'E': ('D', (0,)), 'S': ('F', (0,)),
    'x': ('R', (-1, 0, 1)), 'y': ('U', (-1, 0, 1)), 'z': ('F', (-1, 0, 1)),
}
_PERM = {}


def perm(tok):
    if tok in _PERM:
        return _PERM[tok]
    m = _TOK.match(tok)
    if not m:
        raise ValueError(tok)
    base, num, pr = m.groups()
    q = int(num) if num else 1
    q = (-q if pr else q) % 4
    face, layers = _LAYERS[base]
    n = N[face]
    ax = [i for i in range(3) if n[i]][0]
    out = np.arange(len(STICKERS))
    for i, (p, nn) in enumerate(STICKERS):
        if p[ax] in layers:
            for _ in range(q):
                p, nn = _rot(n, p), _rot(n, nn)
            out[i] = IDX[(p, nn)]
    _PERM[tok] = out
    return out


def move(st, tok):
    ns = np.empty_like(st)
    ns[perm(tok)] = st
    return ns


def apply(st, toks):
    for t in toks:
        st = move(st, t)
    return st


def solved_up_to_orientation(st):
    cen = {f: st[i] for f, i in CENTER_IDX.items()}
    return all(st[i] == cen[FACE_OF[n]] for i, (p, n) in enumerate(STICKERS))


def centers(st):
    return {f: st[i] for f, i in CENTER_IDX.items()}


SLOT_POS = {'FR': (1, 1), 'FL': (-1, 1), 'BL': (-1, -1), 'BR': (1, -1)}
SLOT_FACES = {'FR': ('F', 'R'), 'FL': ('F', 'L'), 'BL': ('B', 'L'), 'BR': ('B', 'R')}
_SLOT_IDX = {}
for lab, (sx, sz) in SLOT_POS.items():
    _SLOT_IDX[lab] = [i for i, (p, n) in enumerate(STICKERS) if p in ((sx, -1, sz), (sx, 0, sz))]
_CROSS_IDX = [i for i, (p, n) in enumerate(STICKERS) if p in ((1, -1, 0), (-1, -1, 0), (0, -1, 1), (0, -1, -1))]
_FACE_NAME = [FACE_OF[n] for p, n in STICKERS]


def _ok(st, idxs, cen):
    return all(st[i] == cen[_FACE_NAME[i]] for i in idxs)


def cross_down_solved(st):
    return _ok(st, _CROSS_IDX, centers(st))


def solved_slots(st):
    cen = centers(st)
    return {lab: frozenset(cen[f] for f in SLOT_FACES[lab]) for lab, idxs in _SLOT_IDX.items() if _ok(st, idxs, cen)}


def label_of(st, colour_pair):
    cen = centers(st)
    for lab, fp in SLOT_FACES.items():
        if frozenset(cen[f] for f in fp) == colour_pair:
            return lab
    return None
