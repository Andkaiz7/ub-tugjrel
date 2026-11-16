import functools
import http.server
import pathlib
import sys
import threading
import time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.superpowers' / 'sdd' / '2026-11-16-ugee-buu-mart' / 'task-3-shots'
OUT.mkdir(parents=True, exist_ok=True)
STUB = (ROOT / 'tools' / 'ubm-stub.js').read_text()
PICK = '70357a81'
CHIP_PICK = '548ce743'

TILE_FOR = """w => {
  const b = [...document.querySelectorAll('#tray .tile')].find(x => !x.classList.contains('used') && x.textContent === w);
  return b ? +b.dataset.i : -1;
}"""

WRONG_TILE = """() => {
  const q = UBM.current();
  const want = UBMCore.norm(q.answer[document.querySelectorAll('#line .slot.on').length]);
  const b = [...document.querySelectorAll('#tray .tile')].find(x => !x.classList.contains('used') && !x.classList.contains('bad') && UBMCore.norm(x.textContent) !== want);
  return b ? +b.dataset.i : -1;
}"""

NO_HSCROLL = "document.getElementById('app').scrollWidth <= innerWidth && [...document.querySelectorAll('*')].every(e => e.scrollLeft === 0)"

HIDE = """h => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
}"""


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def st(pg):
    return pg.evaluate('UBM.state()')


def wait_round(pg, timeout=3000):
    pg.wait_for_function("window.UBM && UBM.state().screen === 'round' && !!UBM.current()", timeout=timeout)


def tap(pg, i):
    pg.click('#tray .tile[data-i="%d"]' % i)


def answer_line(pg):
    before = pg.evaluate('({id: UBM.current().id, q: UBM.state().q})')
    for w in pg.evaluate('UBM.current().answer'):
        i = pg.evaluate(TILE_FOR, w)
        assert i >= 0, w
        tap(pg, i)
    pg.wait_for_function(
        "b => UBM.state().screen !== 'round' || (UBM.state().q === b.q + 1 && UBM.current().id !== b.id)",
        arg=before, timeout=4000)


def wrong_tap(pg):
    pg.wait_for_function('(' + WRONG_TILE + ')() >= 0', timeout=2000)
    i = pg.evaluate(WRONG_TILE)
    assert i >= 0
    tap(pg, i)
    return i


def new_page(b, viewport, stub, query='', extra=None, setup=None):
    ctx = b.new_context(viewport=viewport, device_scale_factor=2)
    if stub:
        ctx.add_init_script(STUB)
    if extra:
        ctx.add_init_script(extra)
    pg = ctx.new_page()
    if setup:
        setup(pg)
    errors = []
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(BASE + '/ugee-buu-mart/index.html' + query)
    return pg, errors


def main_flow(b):
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True)
    wait_round(pg)
    s = st(pg)
    assert s['q'] == 0 and s['lives'] == 3 and s['score'] == 0, s
    assert pg.text_content('#chipName').strip(), 'header shows a singer name'
    assert pg.text_content('#chipName') == pg.evaluate('UBM.groupById(UBM.state().groupId).name')
    assert pg.text_content('#qn') == '1/10', pg.text_content('#qn')
    tile = pg.query_selector('#tray .tile')
    assert pg.evaluate("e => getComputedStyle(e).userSelect", tile) == 'none'
    assert pg.evaluate("e => e.getBoundingClientRect().height", tile) >= 44
    pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT / 'round.png'))

    answer_line(pg)
    s = st(pg)
    assert s['score'] > 0 and s['q'] == 1 and s['screen'] == 'round', s
    assert pg.text_content('#qn') == '2/10'

    bad = pg.evaluate(WRONG_TILE)
    assert bad >= 0
    pg.dblclick('#tray .tile[data-i="%d"]' % bad)
    s = st(pg)
    assert s['lives'] == 2, 'a double tap on a wrong tile costs one life: %s' % s
    cls = pg.get_attribute('#tray .tile[data-i="%d"]' % bad, 'class')
    assert 'bad' in cls and 'used' not in cls, cls
    assert pg.is_visible('#tray .tile[data-i="%d"]' % bad)
    assert pg.evaluate("document.querySelectorAll('#hearts i.off').length") == 1
    pg.wait_for_timeout(250)
    pg.screenshot(path=str(OUT / 'round-wrong.png'))
    pg.wait_for_timeout(500)
    assert 'bad' not in pg.get_attribute('#tray .tile[data-i="%d"]' % bad, 'class')

    score0 = st(pg)['score']
    pg.evaluate(HIDE, True)
    pg.wait_for_timeout(5000)
    pg.evaluate(HIDE, False)
    assert st(pg)['lives'] == 2
    answer_line(pg)
    s = st(pg)
    assert s['lives'] == 2 and s['q'] == 2, s
    assert s['score'] - score0 >= 140, 'hidden time is not counted: %s' % (s['score'] - score0)

    played = pg.evaluate('UBM.current().id')
    gid0 = s['groupId']
    pg.wait_for_function("id => (__stub.store['ubm:seen:' + UBM.state().groupId] || []).indexOf(id) >= 0", arg=played, timeout=3000)
    assert len(pg.evaluate("__stub.store['ubm:seen:' + UBM.state().groupId]")) == 3

    score = st(pg)['score']
    wrong_tap(pg)
    assert st(pg)['lives'] == 1
    wrong_tap(pg)
    assert st(pg)['lives'] == 0
    pg.wait_for_function("UBM.state().screen === 'end'", timeout=5000)
    assert pg.is_hidden('#round') and pg.is_visible('#end')
    pg.wait_for_function("s => document.getElementById('endScore').textContent === String(s)", arg=score, timeout=3000)
    assert pg.text_content('#again') == 'Дахин'
    assert pg.text_content('#endLines').startswith('2/10')
    assert pg.is_visible('#tabF') and pg.is_visible('#tabG')
    assert pg.text_content('#tabF') == 'Найзууд' and pg.text_content('#tabG') == 'Дэлхий'
    assert pg.is_visible('#endQ')
    n_groups = pg.evaluate('LYRICS.groups.length')
    assert pg.evaluate("document.querySelectorAll('#endPk .sg').length") == n_groups
    assert pg.evaluate("document.querySelector('#endPk h4').textContent") == 'Багц'

    pg.wait_for_selector('#retry:not([hidden])', timeout=5000)
    assert pg.text_content('#saveText') == 'Хадгалагдаагүй', pg.text_content('#saveText')
    sub = pg.evaluate('__stub.calls.submit')
    assert len(sub) == 1 and sub[0]['score'] == score, sub
    assert pg.evaluate("__stub.store['ubm:pend'].score") == score
    pg.click('#retry')
    pg.wait_for_function("document.getElementById('saveText').textContent.indexOf('Хадгалагдлаа') === 0", timeout=5000)
    assert pg.is_hidden('#retry')
    sub = pg.evaluate('__stub.calls.submit')
    assert len(sub) == 2 and sub[1]['score'] == score and sub[1]['meta']['lines'] == 2, sub
    pg.wait_for_function("!__stub.store['ubm:pend']", timeout=3000)

    pg.wait_for_function("document.querySelectorAll('#lb button.row').length === 2 && document.querySelectorAll('#lb div.row.me').length === 1", timeout=5000)
    pg.click('#lb button.row >> nth=0')
    assert pg.evaluate('__stub.calls.profile') == ['u2']
    pg.click('#tabG')
    pg.wait_for_function("document.getElementById('lb').textContent.indexOf('Top') >= 0", timeout=5000)
    assert pg.get_attribute('#tabG', 'aria-selected') == 'true'
    pg.click('#tabF')
    pg.wait_for_function("document.getElementById('lb').textContent.indexOf('Бат') >= 0", timeout=5000)
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / 'end.png'))
    pg.evaluate("document.getElementById('end').scrollTop = 1e6")
    pg.wait_for_timeout(200)
    pg.screenshot(path=str(OUT / 'end-grid.png'))

    pg.fill('#endQ', 'ХАРАНГА')
    names = pg.evaluate("[...document.querySelectorAll('#endPk .sg .nm')].map(e => e.textContent)")
    assert names and all('харанга' in x.lower() for x in names), names
    pg.fill('#endQ', 'zzzz')
    assert pg.evaluate("document.querySelectorAll('#endPk .sg').length") == 0
    assert pg.is_visible('#endPk .none')
    pg.fill('#endQ', '')
    pg.click('#endPk .sg[data-gid="%s"]' % PICK)
    wait_round(pg)
    s = st(pg)
    assert s['groupId'] == PICK and s['q'] == 0 and s['lives'] == 3 and s['score'] == 0, s
    first = pg.evaluate('UBM.current().id')
    answer_line(pg)
    second = pg.evaluate('UBM.current().id')
    pg.wait_for_function("ids => { const s = __stub.store['ubm:seen:%s'] || []; return ids.every(i => s.indexOf(i) >= 0); }" % PICK, arg=[first, second], timeout=3000)
    pg.wait_for_function("__stub.store['ubm:last'] === '%s'" % PICK, timeout=3000)
    seen_before = pg.evaluate("__stub.store['ubm:seen:%s']" % PICK)
    assert seen_before == [first, second], seen_before
    assert len(pg.evaluate('__stub.calls.submit')) == 2

    pg.reload()
    wait_round(pg)
    assert st(pg)['groupId'] == PICK, 'last picked singer opens after reload'
    assert pg.evaluate("__stub.store['ubm:seen:%s']" % PICK)[:2] == seen_before
    ids = []
    for k in range(10):
        ids.append(pg.evaluate('UBM.current().id'))
        assert pg.text_content('#qn') == '%d/10' % (k + 1)
        if k == 4:
            pg.screenshot(path=str(OUT / 'round-mid.png'))
        answer_line(pg)
    assert len(set(ids)) == 10 and not set(ids) & set(seen_before), (ids, seen_before)
    pg.wait_for_function("UBM.state().screen === 'end'", timeout=3000)
    s = st(pg)
    assert s['lives'] == 3 and 1000 <= s['score'] <= 1500, s
    assert pg.text_content('#endHead') == 'Төгс!'
    assert pg.evaluate("__stub.store['ubm:seen:%s'].length" % PICK) == 12

    pg.click('#again')
    wait_round(pg)
    assert st(pg)['groupId'] == PICK and st(pg)['q'] == 0
    n_sub = len(pg.evaluate('__stub.calls.submit'))
    answer_line(pg)
    pg.click('#chip')
    assert pg.is_visible('#picker')
    assert pg.evaluate("document.querySelector('#pkList h4').textContent") == 'Багц'
    assert pg.evaluate("document.querySelectorAll('#pkList .sg').length") == n_groups
    assert pg.evaluate("document.querySelector('#pkList .sg.cur').dataset.gid") == PICK
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / 'picker.png'))
    pg.click('#pkX')
    assert pg.is_hidden('#picker') and st(pg)['screen'] == 'round' and st(pg)['q'] == 1
    pg.click('#chip')
    pg.fill('#pkQ', 'чойжоо')
    assert pg.evaluate("[...document.querySelectorAll('#pkList .sg')].map(e => e.dataset.gid)") == [CHIP_PICK]
    pg.click('#pkList .sg[data-gid="%s"]' % CHIP_PICK)
    wait_round(pg)
    s = st(pg)
    assert s['groupId'] == CHIP_PICK and s['q'] == 0 and s['score'] == 0, s
    assert pg.is_hidden('#picker')
    assert pg.text_content('#chipName') == 'Чойжоо'
    pg.wait_for_timeout(300)
    assert len(pg.evaluate('__stub.calls.submit')) == n_sub, 'abandon via picker does not submit'
    assert gid0 != CHIP_PICK
    assert not errors, errors
    pg.context.close()


def shots(b, viewport, name, query=''):
    pg, errors = new_page(b, viewport, True, query)
    wait_round(pg)
    answer_line(pg)
    answer_line(pg)
    i = pg.evaluate(TILE_FOR, pg.evaluate('UBM.current().answer[0]'))
    tap(pg, i)
    pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT / (name + '-round.png')))
    pg.click('#chip')
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / (name + '-picker.png')))
    pg.click('#pkX')
    for _ in range(3):
        wrong_tap(pg)
    pg.wait_for_function("UBM.state().screen === 'end'", timeout=5000)
    pg.wait_for_selector('#retry:not([hidden])', timeout=5000)
    pg.wait_for_timeout(900)
    pg.screenshot(path=str(OUT / (name + '-end.png')))
    assert pg.evaluate(NO_HSCROLL), 'no horizontal scroll'
    assert not errors, errors
    pg.context.close()


SLOW_BOOT = "UBM.boot = function (cfg) { window.__booted = cfg; UBM.screen('hall'); };"
THROW_BOOT = "UBM.boot = function () { throw new Error('boot-fail'); };"


def with_late_script(js):
    def setup(pg):
        def page(route):
            r = route.fetch()
            body = r.text().replace('<script src="app.js"></script>', '<script src="app.js"></script>\n<script src="late-mp.js"></script>')
            route.fulfill(response=r, body=body)

        def script(route):
            time.sleep(0.4)
            route.fulfill(status=200, body=js, content_type='application/javascript')
        pg.route('**/ugee-buu-mart/index.html', page)
        pg.route('**/late-mp.js', script)
    return setup


def boot_seam(b):
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True, setup=with_late_script(SLOW_BOOT))
    pg.wait_for_function('window.__booted', timeout=5000)
    pg.wait_for_timeout(600)
    assert pg.evaluate('__booted.userId') == 'u_test', 'boot gets the init config'
    s = st(pg)
    assert s['screen'] == 'hall' and s['groupId'] is None, 'invite launch never starts a solo round: %s' % s
    assert pg.is_hidden('#round') and pg.is_hidden('#end')
    assert not errors, errors
    pg.context.close()
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True, setup=with_late_script(THROW_BOOT))
    wait_round(pg, 5000)
    assert st(pg)['groupId'], 'a throwing boot falls back to solo'
    pg.wait_for_timeout(200)
    assert len(errors) == 1 and 'boot-fail' in errors[0], errors
    pg.context.close()


HUNG = "window.Usion.storage.get = function () { return new Promise(function () {}); };"


def hung_storage(b):
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True, extra=HUNG)
    wait_round(pg, 3000)
    t = pg.evaluate('performance.now()')
    assert t < 3000, 'round visible within 3 s of navigation with hung storage: %d ms' % t
    pg.click('#chip')
    pg.click('#pkList .sg[data-gid="%s"]' % CHIP_PICK)
    pg.wait_for_function("UBM.state().groupId === '%s' && UBM.state().screen === 'round'" % CHIP_PICK, timeout=2000)
    for _ in range(3):
        wrong_tap(pg)
    pg.wait_for_function("UBM.state().screen === 'end'", timeout=5000)
    pg.wait_for_timeout(500)
    assert st(pg)['score'] == 0
    assert pg.evaluate('__stub.calls.submit') == [], 'a 0 score is not submitted'
    assert pg.text_content('#saveText') == '' and pg.is_hidden('#retry')
    assert not errors, errors
    pg.context.close()


def no_host(b):
    pg, errors = new_page(b, {'width': 390, 'height': 844}, False)
    wait_round(pg)
    assert pg.evaluate('typeof window.Usion') == 'undefined'
    answer_line(pg)
    for _ in range(3):
        wrong_tap(pg)
    pg.wait_for_function("UBM.state().screen === 'end'", timeout=5000)
    pg.wait_for_selector('#retry:not([hidden])', timeout=5000)
    assert pg.is_visible('#again') and pg.is_visible('#endQ')
    pg.click('#endPk .sg >> nth=3')
    wait_round(pg)
    before = st(pg)
    pg.evaluate("UBM.startRound({group: {id: 'empty', name: 'Empty', pack: false, views: 0, songs: []}})")
    pg.wait_for_timeout(300)
    assert st(pg) == before, 'an empty round is ignored without looping'
    assert not errors, errors
    pg.context.close()


httpd = serve()
BASE = 'http://127.0.0.1:%d' % httpd.server_address[1]
with sync_playwright() as p:
    browser = p.chromium.launch()
    main_flow(browser)
    shots(browser, {'width': 360, 'height': 640}, 'small')
    shots(browser, {'width': 390, 'height': 844}, 'en', '?lang=en')
    no_host(browser)
    boot_seam(browser)
    hung_storage(browser)
    browser.close()
httpd.shutdown()
print('UBM SMOKE OK', OUT)
