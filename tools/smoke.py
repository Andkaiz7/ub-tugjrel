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


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(GAME)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def run(base, stub, viewport, name):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport=viewport, device_scale_factor=2)
        ctx.add_init_script('window.__UBT_TEST = true;')
        if stub:
            ctx.add_init_script(STUB)
        pg = ctx.new_page()
        errors = []
        pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(base + '/index.html?test=1')
        pg.wait_for_function('window.UBT && UBT.city() && UBT.city().time > 25260', timeout=15000)
        pg.wait_for_function('UBT.city().time > 26400', timeout=60000)
        pg.screenshot(path=str(OUT / (name + '-play.png')))
        assert 'км/ц' in pg.text_content('#spd'), pg.text_content('#spd')
        hot = pg.evaluate('(function(){var c=UBT.city();for(var n=0;n<c.nodeCount;n++)if(c.signal[n])return n;return -1})()')
        before = pg.evaluate('UBT.city().budget')
        res = pg.evaluate('n => UBT.act({type: "overpass", node: n})', hot)
        assert res['ok'] and pg.evaluate('UBT.city().budget') == before - res['cost'], res
        assert pg.evaluate('UBT.act({type: "oddeven"}).ok')
        pg.evaluate('UBT.finishNow()')
        pg.wait_for_function("UBT.state() === 'end'", timeout=60000)
        pg.wait_for_selector('#end:not([hidden])', timeout=5000)
        pg.wait_for_timeout(500)
        pg.screenshot(path=str(OUT / (name + '-end.png')))
        if stub:
            assert pg.is_visible('#retry'), 'first submit fails in stub'
            pg.click('#retry')
            pg.wait_for_function("document.getElementById('saveText').textContent.indexOf('Хадгалагдлаа') === 0", timeout=5000)
            sub = pg.evaluate('__stub.calls.submit')
            assert len(sub) == 2 and sub[0]['score'] == sub[1]['score'] == pg.evaluate('UBT.city().score'), sub
        pg.click('#again')
        pg.wait_for_function("UBT.state() === 'play' && UBT.city().budget === 150", timeout=5000)
        assert not errors, errors
        b.close()


httpd = serve()
base = 'http://127.0.0.1:%d' % httpd.server_address[1]
run(base, False, {'width': 390, 'height': 780}, 'portrait')
run(base, True, {'width': 390, 'height': 780}, 'portrait-stub')
run(base, False, {'width': 844, 'height': 390}, 'landscape')
httpd.shutdown()
print('SMOKE OK', OUT)
