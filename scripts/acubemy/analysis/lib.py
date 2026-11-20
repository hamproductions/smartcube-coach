import json, os

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
ROOT = os.environ.get('ACUBEMY_DATA', os.path.join(REPO, 'data', 'acubemy'))
RAW = os.path.join(ROOT, 'raw')
OUT = os.path.join(ROOT, 'out')
STAGES = ['cross', 'f2l1', 'f2l2', 'f2l3', 'f2l4', 'oll', 'pll']


def load_export():
    return json.load(open(os.path.join(RAW, 'export-all.json')))


def load():
    solves = json.load(open(os.path.join(RAW, 'solves.json')))
    by_scramble = {r['scramble']: r for r in load_export()}
    out = []
    for s in solves:
        d = s['detail']
        out.append({'detail': d, 'export': by_scramble[d['scramble']], 'list': s['list']})
    out.sort(key=lambda r: r['detail']['date'])
    return out


def stages(rec):
    d, e = rec['detail'], rec['export']
    a = d['analysis']
    if a['type'] != 'CFOP':
        return None
    parts = [('cross', a['cross'], 'cross')]
    parts += [('f2l%d' % (i + 1), sl, 'f2l_pair%d' % (i + 1)) for i, sl in enumerate(a['f2l']['slots'])]
    parts += [('oll', a['oll'], 'oll'), ('pll', a['pll'], 'pll')]
    res, t = [], 0
    for name, p, ek in parts:
        res.append({
            'name': name, 'start': t, 'end': t + p['time'], 'time': p['time'],
            'recognition': e.get(ek + '_recognition_time', 0 if name == 'cross' else None),
            'execution': e.get(ek + '_execution_time'),
            'moves': p['moveSequence'], 'case': p.get('case', p.get('caseIndex')),
            'slotIndex': p.get('slotIndex'),
        })
        t += p['time']
    return res
