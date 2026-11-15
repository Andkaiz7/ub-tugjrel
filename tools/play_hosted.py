import json
import pathlib
import sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT
URL = sys.argv[1]

SOLUTIONS = [
    [('r', [(2, 12), (2, 8)]), ('b', (2, 8), (2, 5)), ('r', [(2, 5), (2, 1), (6, 1)])],
    [('r', [(1, 12), (1, 8), (7, 8), (7, 1)]), ('r', [(7, 12), (6, 12), (6, 9)]), ('b', (6, 9), (6, 7)), ('r', [(6, 7), (1, 7), (1, 1)])],
    [('r', [(1, 12), (1, 1)]), ('r', [(4, 12), (4, 9)]), ('b', (4, 9), (4, 5)), ('r', [(4, 5), (4, 1)]), ('r', [(7, 12), (7, 9)]), ('b', (7, 9), (7, 5)), ('r', [(7, 5), (7, 1)])],
    [('r', [(7, 12), (8, 12), (8, 4)]), ('b', (8, 4), (8, 2)), ('r', [(8, 2), (8, 1), (7, 1)]), ('r', [(1, 12), (1, 9), (3, 9)]), ('r', [(4, 12), (4, 9), (3, 9)]), ('r', [(3, 9), (3, 4)]), ('b', (3, 4), (3, 2)), ('r', [(3, 2), (1, 2), (1, 1)]), ('r', [(3, 2), (4, 2), (4, 1)])],
    [('r', [(0, 12), (0, 10)]), ('r', [(3, 12), (3, 10), (0, 10)]), ('b', (0, 10), (0, 7)), ('r', [(0, 7), (0, 4)]), ('b', (0, 4), (0, 2)), ('r', [(0, 2), (0, 1)]), ('r', [(0, 2), (5, 2), (5, 1)]), ('r', [(5, 12), (5, 10), (8, 10)]), ('r', [(8, 12), (8, 10)]), ('b', (8, 10), (8, 7)), ('r', [(8, 7), (8, 4)]), ('b', (8, 4), (8, 2)), ('r', [(8, 2), (8, 1)]), ('r', [(8, 2), (3, 2), (3, 1)])],
]


def center(pg, x, y):
    p = pg.evaluate('t => UBT.tileXY(t)', y * 9 + x)
    assert p, (x, y)
    return p['x'], p['y']


def drag(pg, points):
    x, y = center(pg, *points[0])
    pg.mouse.move(x, y)
    pg.mouse.down()
    for a, b in zip(points, points[1:]):
        bx, by = center(pg, *b)
        pg.mouse.move(bx, by, steps=(abs(a[0] - b[0]) + abs(a[1] - b[1])) * 3)
    pg.mouse.up()


with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    ctx.add_init_script('window.__UBT_TEST = true;')
    pg = ctx.new_page()
    errors = []
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL + '?test=1')
    pg.wait_for_function('window.UBT && UBT.world()', timeout=15000)
    sdk = pg.evaluate("[...document.scripts].map(s => s.src).filter(Boolean)")
    print('scripts', sdk)
    for i, ops in enumerate(SOLUTIONS):
        pg.wait_for_function("UBT.state() === 'play' && UBT.levelIndex() === %d" % i, timeout=15000)
        pg.wait_for_timeout(300)
        for op in ops:
            if op[0] == 'r':
                drag(pg, op[1])
            else:
                pg.click('#tool-bridge')
                drag(pg, [op[1], op[2]])
                pg.click('#tool-road')
        w = pg.evaluate('({e: UBT.world().edges.size, b: UBT.world().bridges.length})')
        pg.wait_for_timeout(4000)
        pg.screenshot(path=str(OUT / ('hosted-d%d.png' % (i + 1))))
        pg.wait_for_function("UBT.state() !== 'play' || UBT.levelIndex() !== %d" % i, timeout=90000)
        print('district', i + 1, 'built', w)
    pg.wait_for_selector('#end:not([hidden])', timeout=15000)
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(OUT / 'hosted-end.png'))
    print('total', pg.text_content('#endTotal'), 'splits', [s.strip() for s in pg.locator('#endSplits li').all_text_contents()])
    print('save', pg.text_content('#saveText'))
    print('errors', errors)
    br.close()
