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
OUT.mkdir(parents=True, exist_ok=True)
STUB = (ROOT / 'tools' / 'stub-usion.js').read_text()

WORST = """() => {
  const c = UBT.city();
  let best = -1;
  for (let n = 0; n < c.nodeCount; n++) if (Sim.isJunction(c, n) && (best < 0 || c._jam[n] > c._jam[best])) best = n;
  return best;
}"""

OTHER = """(skip) => {
  const c = UBT.city(), z = UBT.challenge().spot, cv = document.getElementById('cv').getBoundingClientRect();
  for (let n = 0; n < c.nodeCount; n++) {
    if (n === skip || !Sim.isJunction(c, n) || Math.hypot(c.nx[n] - z.x, c.ny[n] - z.y) > z.r * 0.7) continue;
    const p = UBT.screenOf(c.nx[n], c.ny[n]);
    if (p.x > cv.left + 40 && p.x < cv.right - 40 && p.y > cv.top + 140 && p.y < cv.bottom - 40) return {n: n, x: p.x, y: p.y};
  }
  return null;
}"""

TOOLS = ['overpass', 'roundabout', 'lights', 'widen', 'road']

CORNER_LUM = """() => {
  const cv = document.getElementById('cv');
  const d = cv.getContext('2d').getImageData(4, 4, 1, 1).data;
  return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
}"""


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(GAME)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def spot_id(pg):
    return pg.evaluate('UBT.challenge().spot.id')


def wait_end(pg, state):
    pg.wait_for_function("UBT.state() === '%s'" % state, timeout=20000)
    pg.wait_for_selector('#end:not([hidden])', timeout=5000)
    pg.wait_for_timeout(300)


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
        pg.goto(base + '/index.html?test=1&path=%2Fspot%2Fchuluun')
        pg.wait_for_function('window.UBT && UBT.challenge()', timeout=15000)
        assert pg.evaluate('UBT.state()') == 'play'
        assert spot_id(pg) == 'zaisan', 'locked deep link falls back to the first open spot'
        pg.wait_for_timeout(1500)
        lum = pg.evaluate(CORNER_LUM)
        assert lum < 200, 'area overlay dims the outside: %s' % lum
        assert pg.text_content('#spotName') == 'Зайсан'
        assert '→' in pg.text_content('#jamTxt')
        pg.screenshot(path=str(OUT / (name + '-play.png')))

        for k in TOOLS:
            pg.click('#tool-' + k)
            assert pg.get_attribute('#tool-' + k, 'aria-pressed') == 'true', k
            assert pg.is_visible('#hint'), k
            pg.click('#tool-' + k)
            assert pg.get_attribute('#tool-' + k, 'aria-pressed') == 'false', k
        assert '60' in pg.text_content('#tool-oddeven')

        node = pg.evaluate("() => { UBT.start(0); document.getElementById('pause').click(); return (" + WORST + ")(); }")
        assert node >= 0 and pg.get_attribute('#pause', 'aria-pressed') == 'true'
        pg.wait_for_timeout(1400)
        pg.click('#tool-roundabout')
        pt = pg.evaluate('n => UBT.screenOf(UBT.city().nx[n], UBT.city().ny[n])', node)
        pg.mouse.click(pt['x'], pt['y'])
        pg.wait_for_function('n => UBT.city().roundabout[n] === 1', arg=node, timeout=3000)
        assert pg.evaluate('UBT.city().budget') == 150 - pg.evaluate('Sim.COSTS.roundabout')
        assert pg.get_attribute('#tool-roundabout', 'aria-pressed') == 'false'
        pg.wait_for_timeout(400)
        other = pg.evaluate('(' + OTHER + ')(%d)' % node)
        assert other, 'a free junction on screen'
        pg.mouse.click(other['x'], other['y'])
        pg.wait_for_selector('#card:not([hidden])', timeout=3000)
        labels = pg.evaluate("[...document.querySelectorAll('#cardActs button span')].map(e => e.textContent)")
        assert labels == ['Гүүрэн гарц', 'Тойрог', 'Гэрлэн дохио', 'Эгнээ нэмэх'], labels
        pg.screenshot(path=str(OUT / (name + '-card.png')))
        pg.keyboard.press('Escape')

        assert pg.evaluate('UBT.finishNow()') == 'play'
        assert pg.evaluate('UBT.challenge().cleared') and pg.is_visible('#finishBtn') and pg.is_visible('#banner')
        assert pg.text_content('#clock').startswith('✓') and 'won' in pg.get_attribute('#clock', 'class')
        t0 = pg.evaluate('UBT.city().time')
        pg.click('#pause')
        pg.wait_for_function('t => UBT.city().time > t + 20', arg=t0, timeout=5000)
        assert pg.evaluate('UBT.state()') == 'play' and pg.is_hidden('#end')
        pg.screenshot(path=str(OUT / (name + '-cleared.png')))
        pg.click('#finishBtn')
        wait_end(pg, 'clear')
        ch = pg.evaluate('({t: UBT.challenge().time, par: UBT.challenge().spot.par})')
        stars = 3 if ch['t'] <= ch['par'][0] else 2 if ch['t'] <= ch['par'][1] else 1
        assert pg.evaluate("document.querySelectorAll('#endStars span:not(.off)').length") == stars
        assert pg.is_visible('#endRec')
        assert pg.text_content('#endTotal') == '%d:%02d' % (ch['t'] // 60, ch['t'] % 60)
        pg.screenshot(path=str(OUT / (name + '-clear.png')))

        if stub:
            pg.wait_for_selector('#retry:not([hidden])', timeout=5000)
            pg.click('#retry')
            pg.wait_for_function("document.getElementById('saveText').textContent.indexOf('Хадгалагдлаа') === 0", timeout=5000)
            sub = pg.evaluate('__stub.calls.submit')
            assert len(sub) == 2 and sub[0]['score'] == sub[1]['score'] == ch['t'] + 4 * 3600 and sub[1]['meta']['cleared'] == 1, sub
            fs = pg.evaluate('__stub.calls.friendsSet')
            assert fs == [{'key': 'best:zaisan', 'value': {'t': ch['t']}}], fs
            pg.wait_for_function("document.querySelectorAll('#lb button.row').length === 1 && document.querySelectorAll('#lb div.row.me').length === 1", timeout=5000)
            pg.click('#lb button.row')
            assert pg.evaluate('__stub.calls.profile') == ['u2']
            pg.click('#tabF')
            pg.wait_for_function("document.getElementById('lb').textContent.indexOf('Бат') >= 0", timeout=5000)
            pg.click('#tabG')
            pg.wait_for_function("document.getElementById('lb').textContent.indexOf('Top') >= 0", timeout=5000)
            assert pg.is_visible('#shareBtn')
            pg.click('#shareBtn')
            pg.wait_for_function('__stub.calls.share.length === 1', timeout=5000)
            assert pg.evaluate('__stub.calls.share[0].data.path') == '/spot/zaisan'
        else:
            assert pg.is_visible('#retry') and pg.is_hidden('#shareBtn')

        pg.click('#endMap')
        assert pg.evaluate('UBT.state()') == 'list'
        assert pg.evaluate("[...document.querySelectorAll('#spots .spot')].map(e => e.disabled)") == [False, False, True, True, True]
        pg.screenshot(path=str(OUT / (name + '-list.png')))
        pg.click('#listX')
        assert pg.evaluate('UBT.state()') == 'clear'

        pg.click('#again')
        pg.wait_for_function("UBT.state() === 'play' && UBT.city().budget === 150", timeout=5000)
        assert spot_id(pg) == 'zaisan'
        assert pg.evaluate('UBT.finishNow()') == 'fail'
        wait_end(pg, 'fail')
        assert pg.text_content('#endHead') == 'Цаг дууслаа' and pg.is_hidden('#endTotal')
        assert not pg.is_disabled('#nextBtn')
        pg.screenshot(path=str(OUT / (name + '-fail.png')))
        pg.click('#nextBtn')
        pg.wait_for_function("UBT.state() === 'play'", timeout=5000)
        assert spot_id(pg) == 'chuluun'
        pg.click('#tool-oddeven')
        pg.wait_for_function('UBT.city().oddEven === true', timeout=3000)
        assert pg.is_disabled('#tool-oddeven') and '✓' in pg.text_content('#tool-oddeven')
        assert pg.evaluate('UBT.city().budget') == 150 - pg.evaluate('Sim.COSTS.oddeven')

        pg.click('#mapBtn')
        assert pg.evaluate('UBT.state()') == 'list'
        pg.click('#spots .spot >> nth=0')
        pg.wait_for_function("UBT.state() === 'play'", timeout=5000)
        assert spot_id(pg) == 'zaisan'

        if stub:
            pg.goto(base + '/index.html?test=1&path=%2Fspot%2Fchuluun')
            pg.wait_for_function('window.UBT && UBT.challenge()', timeout=15000)
            assert spot_id(pg) == 'chuluun', 'unlocked deep link opens its spot'
        assert not errors, errors
        b.close()


httpd = serve()
base = 'http://127.0.0.1:%d' % httpd.server_address[1]
run(base, False, {'width': 390, 'height': 780}, 'portrait')
run(base, True, {'width': 390, 'height': 780}, 'portrait-stub')
run(base, False, {'width': 844, 'height': 390}, 'landscape')
httpd.shutdown()
print('SMOKE OK', OUT)
