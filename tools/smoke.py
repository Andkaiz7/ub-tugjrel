import functools
import http.server
import pathlib
import sys
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = ROOT / 'ub-tugjrel'
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(tempfile.mkdtemp())
STUB = (ROOT / 'tools' / 'stub-usion.js').read_text()

YARMAG_ROADS = [[(2, 12), (2, 8)], [(2, 5), (2, 1), (6, 1)]]
YARMAG_BRIDGE = ((2, 8), (2, 5))


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(GAME))
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def center(pg, x, y):
    p = pg.evaluate('t => UBT.tileXY(t)', y * 9 + x)
    assert p, 'tile not on screen'
    return p['x'], p['y']


def drag(pg, points):
    x, y = center(pg, *points[0])
    pg.mouse.move(x, y)
    pg.mouse.down()
    for a, b in zip(points, points[1:]):
        steps = abs(a[0] - b[0]) + abs(a[1] - b[1])
        bx, by = center(pg, *b)
        pg.mouse.move(bx, by, steps=steps * 3)
    pg.mouse.up()


def finish_all(pg):
    for i in range(5):
        pg.wait_for_function("UBT.state() === 'play'", timeout=8000)
        assert pg.evaluate('UBT.finishDistrict()')
    pg.wait_for_selector('#end:not([hidden])', timeout=8000)


def run(base, stub, viewport, name):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport=viewport, device_scale_factor=2, has_touch=False)
        if stub:
            ctx.add_init_script(STUB)
        pg = ctx.new_page()
        errors = []
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(base + '/index.html?test=1')
        pg.wait_for_function('window.UBT && UBT.world()', timeout=8000)
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / (name + '-d1.png')))
        for pts in YARMAG_ROADS:
            drag(pg, pts)
        pg.click('#tool-bridge')
        drag(pg, list(YARMAG_BRIDGE))
        pg.click('#tool-road')
        w = pg.evaluate('({e: UBT.world().edges.size, b: UBT.world().bridges.length})')
        assert w['e'] >= 12 and w['b'] == 1, w
        pg.wait_for_timeout(2500)
        pg.screenshot(path=str(OUT / (name + '-playing.png')))
        pg.wait_for_function("UBT.state() !== 'play' || UBT.levelIndex() > 0", timeout=60000)
        assert pg.evaluate('UBT.world().penalties') == 0
        pg.wait_for_function("UBT.state() === 'play'", timeout=8000)
        assert pg.evaluate('UBT.levelIndex()') == 1
        for i in range(4):
            pg.wait_for_function("UBT.state() === 'play'", timeout=8000)
            assert pg.evaluate('UBT.finishDistrict()')
        pg.wait_for_selector('#end:not([hidden])', timeout=8000)
        pg.wait_for_timeout(600)
        pg.screenshot(path=str(OUT / (name + '-end.png')))
        if stub:
            assert pg.is_visible('#retry'), 'retry visible after first failed submit'
            pg.click('#retry')
            pg.wait_for_function("document.getElementById('saveText').textContent.indexOf('Хадгалагдлаа') === 0", timeout=5000)
            assert pg.evaluate('window.__stub.store.pending') is None, 'pending cleared after ack'
            sub = pg.evaluate('window.__stub.calls.submit')
            assert len(sub) == 2 and sub[0]['score'] == sub[1]['score'], sub
            pg.click('#lb button.row')
            assert pg.evaluate('window.__stub.calls.profile') == ['u2']
            pg.screenshot(path=str(OUT / (name + '-saved.png')))
        else:
            assert pg.is_visible('#retry')
        pg.click('#again')
        pg.wait_for_function("UBT.state() === 'play' && UBT.levelIndex() === 0", timeout=4000)
        assert not errors, errors
        b.close()


httpd = serve()
base = 'http://127.0.0.1:%d' % httpd.server_address[1]
run(base, False, {'width': 390, 'height': 844}, 'portrait')
run(base, True, {'width': 390, 'height': 844}, 'portrait-stub')
run(base, False, {'width': 844, 'height': 390}, 'landscape')
httpd.shutdown()
print('SMOKE OK', OUT)
