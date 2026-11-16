import json
import math
import pathlib
import re
import statistics
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / 'tools' / 'osm-buildings-cache.json'
OUT = ROOT / 'ub-tugjrel' / 'buildings-data.js'

KX = 74606.66
KY = 110574.0
LON0 = 106.75
LAT0 = 47.985

RADIUS = 2200
CENTERS = [
    (12555, 10863),
    (16951, 8058),
    (14375, 7294),
    (13785, 6794),
    (10827, 8242),
]

LOW_TYPES = {'house', 'detached', 'garage', 'garages', 'shed', 'hut', 'ger', 'yurt', 'roof', 'kiosk'}
HIGH_TYPES = {'apartments', 'residential', 'office', 'commercial', 'hotel'}

MAX_BYTES = 650000


def build_query():
    parts = []
    for cx, cy in CENTERS:
        south = LAT0 - (cy + RADIUS) / KY
        north = LAT0 - (cy - RADIUS) / KY
        west = LON0 + (cx - RADIUS) / KX
        east = LON0 + (cx + RADIUS) / KX
        parts.append(f'  way["building"]({south:.6f},{west:.6f},{north:.6f},{east:.6f});')
    return '[out:json][timeout:180];\n(\n' + '\n'.join(parts) + '\n);\nout body geom;'


def load():
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    data = urllib.parse.urlencode({'data': build_query()}).encode()
    req = urllib.request.Request(
        'https://overpass-api.de/api/interpreter',
        data=data,
        headers={'User-Agent': 'ub-traffic-game-map-build/1.0'},
    )
    raw = urllib.request.urlopen(req, timeout=240).read()
    CACHE.write_bytes(raw)
    return json.loads(raw)


def proj(lat, lon):
    return ((lon - LON0) * KX, (LAT0 - lat) * KY)


def dp(pts, tol):
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    n = math.hypot(dx, dy) or 1e-9
    best, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = abs(dy * px - dx * py + bx * ay - by * ax) / n
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return dp(pts[:idx + 1], tol)[:-1] + dp(pts[idx:], tol)


def parse_num(v):
    if v is None:
        return None
    s = str(v).split(';')[0].replace(',', '.')
    m = re.search(r'[-+]?\d+(?:\.\d+)?', s)
    if not m:
        return None
    val = float(m.group(0))
    return val if val > 0 else None


def shoelace_sum(pts):
    s = 0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return s


def centroid(pts, s):
    if s == 0:
        return (sum(x for x, _ in pts) / len(pts), sum(y for _, y in pts) / len(pts))
    cx = 0.0
    cy = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        c = x1 * y2 - x2 * y1
        cx += (x1 + x2) * c
        cy += (y1 + y2) * c
    f = 3.0 * s
    return (cx / f, cy / f)


def in_circles(x, y):
    r2 = RADIUS * RADIUS
    for cx, cy in CENTERS:
        dx = x - cx
        dy = y - cy
        if dx * dx + dy * dy <= r2:
            return True
    return False


def simplify_ring(pts):
    if len(pts) > 1 and math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 1e-6:
        pts = pts[:-1]
    if len(pts) < 3:
        return None
    tol = 1.5
    while True:
        s = dp(pts, tol)
        rounded = []
        for x, y in s:
            p = (round(x), round(y))
            if not rounded or rounded[-1] != p:
                rounded.append(p)
        if len(rounded) > 1 and rounded[0] == rounded[-1]:
            rounded.pop()
        if len(rounded) <= 14 or tol > 200:
            break
        tol *= 1.5
    if len(rounded) < 3 or len(rounded) > 14:
        return None
    return rounded


def estimate_height(osm_id, tags, area):
    hv = parse_num(tags.get('height'))
    lv = parse_num(tags.get('building:levels'))
    btype = tags.get('building', '')
    tagged = hv is not None or lv is not None
    if hv is not None:
        h = hv
    elif lv is not None:
        h = lv * 3.2
    else:
        if area < 200:
            h = 4.0
        elif area < 600:
            h = 10.0
        elif area < 1500:
            h = 16.0
        elif area < 4000:
            h = 25.0
        else:
            h = 30.0
    if btype in LOW_TYPES:
        h = min(h, 4.0)
    if not tagged and btype in HIGH_TYPES:
        h = max(h, 16.0)
    if not tagged:
        v = math.sin(osm_id) * 43758.5453
        frac = v - math.floor(v)
        h *= 0.85 + 0.3 * frac
    return max(3, min(140, round(h)))


def encode_buildings(items):
    hs = []
    cs = []
    ps = []
    for pts, h, _, _ in items:
        hs.append(h)
        cs.append(len(pts))
        px, py = pts[0]
        ps.append(px)
        ps.append(py)
        for x, y in pts[1:]:
            ps.append(x - px)
            ps.append(y - py)
            px, py = x, y
    payload = {'r': RADIUS, 'n': len(items), 'h': hs, 'c': cs, 'p': ps}
    return (
        '(function (root) {\n'
        '  var UBBuildings = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n'
        "  if (typeof module !== 'undefined' && module.exports) module.exports = UBBuildings;\n"
        '  else root.UBBuildings = UBBuildings;\n'
        '})(this);\n'
    )


def main():
    raw = load()
    seen = set()
    candidates = []
    for e in raw.get('elements', []):
        if e.get('type') != 'way':
            continue
        oid = e['id']
        if oid in seen:
            continue
        seen.add(oid)
        geom = e.get('geometry') or []
        if len(geom) < 3:
            continue
        pts = [proj(p['lat'], p['lon']) for p in geom]
        ring = simplify_ring(pts)
        if ring is None:
            continue
        s = shoelace_sum(ring)
        if s == 0:
            continue
        cx, cy = centroid(ring, s)
        if not in_circles(cx, cy):
            continue
        if s < 0:
            ring.reverse()
            s = -s
        area = s * 0.5
        tags = e.get('tags') or {}
        hv = parse_num(tags.get('height'))
        lv = parse_num(tags.get('building:levels'))
        keep_small = (hv is not None) or (lv is not None and lv >= 2)
        h = estimate_height(oid, tags, area)
        max_y = max(y for _, y in ring)
        candidates.append((ring, h, area, keep_small, max_y))

    candidates.sort(key=lambda item: item[4])

    thresh = 90
    while True:
        filtered = [
            (ring, h, area, keep_small)
            for ring, h, area, keep_small, _ in candidates
            if area >= thresh or keep_small
        ]
        js = encode_buildings(filtered)
        size = len(js.encode('utf-8'))
        if size <= MAX_BYTES or not filtered:
            break
        thresh += 20

    OUT.write_text(js)
    heights = [item[1] for item in filtered]
    print(
        'buildings', len(filtered),
        'bytes', size,
        'height_min', min(heights) if heights else 0,
        'height_median', statistics.median(heights) if heights else 0,
        'height_max', max(heights) if heights else 0,
        'min_area_threshold', thresh,
    )


if __name__ == '__main__':
    main()
