import json
import math
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tools' / 'osm-cache.json'
OUT = ROOT / 'ub-tugjrel' / 'map-data.js'
BBOX = (47.85, 106.75, 47.985, 107.08)
QUERY = """[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](47.85,106.75,47.985,107.08);
  way["waterway"="river"](47.80,106.68,48.02,107.12);
  way["railway"="rail"](47.85,106.75,47.985,107.08);
  node["place"~"^(suburb|quarter|neighbourhood)$"](47.85,106.75,47.985,107.08);
);
out body geom;"""
LAT0 = (BBOX[0] + BBOX[2]) / 2
KX = math.cos(math.radians(LAT0)) * 111320.0
KY = 110574.0
CLS = {'motorway': 0, 'trunk': 0, 'primary': 1, 'secondary': 2, 'tertiary': 3}
DEF_LANES = {0: 2, 1: 2, 2: 1, 3: 1}
DEF_KMH = {0: 60, 1: 50, 2: 40, 3: 30}


def load():
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    data = urllib.parse.urlencode({'data': QUERY}).encode()
    req = urllib.request.Request('https://overpass-api.de/api/interpreter', data=data, headers={'User-Agent': 'ub-traffic-game-map-build/1.0'})
    raw = urllib.request.urlopen(req, timeout=240).read()
    CACHE.write_bytes(raw)
    return json.loads(raw)


def proj(lat, lon):
    return ((lon - BBOX[1]) * KX, (BBOX[2] - lat) * KY)


def dp(pts, tol):
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    n = math.hypot(dx, dy) or 1e-9
    best, idx = -1, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * px - dx * py + bx * ay - by * ax) / n
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return dp(pts[:idx + 1], tol)[:-1] + dp(pts[idx:], tol)


def clean(s):
    s = ''.join(ch for ch in (s or '') if not ('\u1800' <= ch <= '\u18af'))
    return ' '.join(s.split())


def num(v, default):
    try:
        return float(str(v).split(';')[0].split()[0])
    except (TypeError, ValueError, IndexError):
        return default


def main():
    d = load()
    ways, rivers, rails, places = [], [], [], []
    for e in d['elements']:
        t = e.get('tags', {})
        if e['type'] == 'node':
            nm = clean(t.get('name'))
            if nm:
                x, y = proj(e['lat'], e['lon'])
                places.append({'mn': nm, 'en': clean(t.get('name:en')) or nm, 'x': round(x), 'y': round(y)})
            continue
        geom = [proj(p['lat'], p['lon']) for p in e.get('geometry', [])]
        if 'highway' in t:
            ways.append((e['nodes'], geom, t))
        elif t.get('waterway') == 'river':
            rivers.append({'name': clean(t.get('name')), 'pts': dp(geom, 25)})
        elif t.get('railway') == 'rail' and 'service' not in t:
            rails.append(dp(geom, 15))

    use = {}
    for nodes, _, _ in ways:
        for i, n in enumerate(nodes):
            use[n] = use.get(n, 0) + (2 if i in (0, len(nodes) - 1) else 1)
    pos = {}
    edges = []
    for nodes, geom, t in ways:
        hw = t['highway'].replace('_link', '')
        cls = CLS.get(hw, 3)
        link = t['highway'].endswith('_link')
        ow = t.get('oneway', '')
        oneway = 1 if ow in ('yes', '1', 'true') or t.get('junction') == 'roundabout' or (link and ow != 'no') else (-1 if ow == '-1' else 0)
        total = num(t.get('lanes'), 0)
        if oneway:
            lanes = int(total) if total else (1 if link else DEF_LANES[cls])
        else:
            lanes = int(math.ceil(total / 2)) if total else (1 if link else DEF_LANES[cls])
        lanes = max(1, min(4, lanes))
        kmh = num(t.get('maxspeed'), DEF_KMH[cls] if not link else 30)
        name = clean(t.get('name'))
        for n, p in zip(nodes, geom):
            pos[n] = p
        start = 0
        for i in range(1, len(nodes)):
            if use[nodes[i]] >= 2 or i == len(nodes) - 1:
                seg = nodes[start:i + 1]
                pts = geom[start:i + 1]
                if oneway == -1:
                    seg, pts = seg[::-1], pts[::-1]
                edges.append({'a': seg[0], 'b': seg[-1], 'pts': pts, 'oneway': 1 if oneway else 0, 'lanes': lanes, 'kmh': kmh, 'cls': cls, 'name': name})
                start = i

    adj = {}
    for i, e in enumerate(edges):
        adj.setdefault(e['a'], []).append(i)
        adj.setdefault(e['b'], []).append(i)
    alive = [True] * len(edges)
    for n in list(adj):
        lst = [i for i in adj[n] if alive[i]]
        if len(lst) != 2:
            continue
        e1, e2 = edges[lst[0]], edges[lst[1]]
        if (e1['oneway'], e1['lanes'], e1['kmh'], e1['cls'], e1['name']) != (e2['oneway'], e2['lanes'], e2['kmh'], e2['cls'], e2['name']):
            continue
        if e1['a'] == e1['b'] or e2['a'] == e2['b'] or lst[0] == lst[1]:
            continue
        if e1['oneway']:
            if e1['b'] == n and e2['a'] == n:
                first, second = e1, e2
            elif e2['b'] == n and e1['a'] == n:
                first, second = e2, e1
            else:
                continue
            first['pts'] = first['pts'] + second['pts'][1:]
            first['b'] = second['b']
        else:
            p1 = e1['pts'] if e1['b'] == n else e1['pts'][::-1]
            a1 = e1['a'] if e1['b'] == n else e1['b']
            p2 = e2['pts'] if e2['a'] == n else e2['pts'][::-1]
            b2 = e2['b'] if e2['a'] == n else e2['a']
            e1['pts'], e1['a'], e1['b'] = p1 + p2[1:], a1, b2
            second = e2
        k = edges.index(second) if second is not e2 else lst[1]
        alive[k] = False
        keep = lst[0] if k == lst[1] else lst[1]
        other = second['b'] if second['a'] == n else second['a']
        adj[other] = [keep if j == k else j for j in adj[other]]
        adj[n] = []
    edges = [e for i, e in enumerate(edges) if alive[i] and e['a'] != e['b']]

    parent = {}
    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for e in edges:
        parent[find(e['a'])] = find(e['b'])
    comp = {}
    for e in edges:
        r = find(e['a'])
        comp[r] = comp.get(r, 0) + 1
    main_root = max(comp, key=comp.get)
    edges = [e for e in edges if find(e['a']) == main_root]

    ids = {}
    nx, ny = [], []
    def nid(n):
        if n not in ids:
            ids[n] = len(nx)
            x, y = pos[n]
            nx.append(round(x))
            ny.append(round(y))
        return ids[n]
    names = []
    name_ix = {}
    out_edges = []
    for e in edges:
        pts = dp(e['pts'], 6)
        flat = []
        for x, y in pts[1:-1]:
            flat += [round(x), round(y)]
        length = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
        if e['name'] and e['name'] not in name_ix:
            name_ix[e['name']] = len(names)
            names.append(e['name'])
        out_edges.append([nid(e['a']), nid(e['b']), e['oneway'], e['lanes'], round(e['kmh']), e['cls'], name_ix.get(e['name'], -1), round(length), flat])

    w = round((BBOX[3] - BBOX[1]) * KX)
    h = round((BBOX[2] - BBOX[0]) * KY)
    data = {
        'w': w, 'h': h,
        'origin': {'lat': BBOX[2], 'lon': BBOX[1], 'kx': round(KX, 3), 'ky': KY},
        'nodes': [v for pair in zip(nx, ny) for v in pair],
        'edges': out_edges,
        'names': names,
        'rivers': [{'name': r['name'], 'pts': [round(v) for p in r['pts'] for v in p]} for r in rivers if len(r['pts']) > 1],
        'rails': [[round(v) for p in r for v in p] for r in rails if len(r) > 1],
        'places': places,
        'attribution': '© OpenStreetMap contributors (ODbL)'
    }
    js = '(function (root) {\n  var UBMap = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n  if (typeof module !== \'undefined\' && module.exports) module.exports = UBMap;\n  else root.UBMap = UBMap;\n})(this);\n'
    OUT.write_text(js)
    print('nodes', len(nx), 'edges', len(out_edges), 'names', len(names), 'rivers', len(data['rivers']), 'rails', len(data['rails']), 'places', len(places), 'bytes', len(js.encode()), 'size_m', w, h)


main()
