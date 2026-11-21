import functools
import http.server
import io
import json
import pathlib
import struct
import sys
import threading
import time
import wave
import zlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.superpowers' / 'sdd' / '2026-11-16-ugee-buu-mart' / 'task-3-shots'
OUT.mkdir(parents=True, exist_ok=True)
STUB = (ROOT / 'tools' / 'ubm-stub.js').read_text()
LYRICS = json.loads(
    (ROOT / 'ugee-buu-mart' / 'lyrics-data.js').read_text().split('window.LYRICS=', 1)[1].rstrip(';\n ')
)
START_GID = '2ca00e15'
PICK = '70357a81'
CHIP_PICK = '548ce743'
GUARANTEED_GID = '547916ab'
URL_IMG = 'https://is1-ssl.mzstatic.com/fake/a.jpg'
URL_A = 'https://audio-ssl.itunes.apple.com/fake/a.m4a'
URL_B = 'https://audio-ssl.itunes.apple.com/fake/b.m4a'
URL_C = 'https://audio-ssl.itunes.apple.com/fake/c.m4a'

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


def new_page(b, viewport, stub, query='', extra=None, setup=None, has_touch=False):
    ctx = b.new_context(viewport=viewport, device_scale_factor=2, has_touch=has_touch)
    if stub:
        ctx.add_init_script(STUB)
    if extra:
        ctx.add_init_script(extra)
    pg = ctx.new_page()
    pg.route('**/ugee-buu-mart/media-data.js', lambda r: r.fulfill(status=200, body='', content_type='application/javascript'))
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
    pg.click('#lbBtn')
    assert pg.is_visible('#boardDlg') and pg.text_content('#boardT') == 'Тэргүүлэгчид'
    pg.wait_for_function("document.querySelector('#boardDlg #lb').textContent.indexOf('Бат') >= 0", timeout=5000)
    pg.wait_for_timeout(500)
    assert pg.evaluate("document.elementFromPoint(195, 760).closest('#boardDlg') !== null")
    pg.screenshot(path=str(OUT / 'board-sheet.png'))
    pg.click('#boardX')
    assert pg.is_hidden('#boardDlg')
    assert pg.evaluate("!!document.querySelector('#end .board #lb')")
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
    assert pg.text_content('#saveText') == 'Хадгалагдлаа', pg.text_content('#saveText')
    assert pg.is_hidden('#retry')
    sub = pg.evaluate('__stub.calls.submit')
    assert len(sub) == 2 and sub[1]['score'] == score and sub[1]['meta']['lines'] == 2, sub
    pg.wait_for_function("!__stub.store['ubm:pend']", timeout=3000)

    pg.wait_for_function("s => __stub.fcloud['best:10'] && __stub.fcloud['best:10'].s === s", arg=score, timeout=5000)
    assert pg.evaluate("__stub.fcloud['best:10'].s") == score
    top10 = pg.evaluate("__stub.scloud['top:10']")
    assert any(e.get('u') == 'u_test' and e.get('s') == score for e in top10), top10
    assert pg.get_attribute('#lbCounts button[data-n="10"]', 'aria-checked') == 'true'

    pg.wait_for_function("document.querySelectorAll('#lb button.row').length === 2 && document.querySelectorAll('#lb div.row.me').length === 1", timeout=5000)
    pg.click('#lb button.row >> nth=0')
    assert pg.evaluate('__stub.calls.profile') == ['u2']
    pg.click('#tabG')
    pg.wait_for_function("document.getElementById('lb').textContent.indexOf('Top') >= 0", timeout=5000)
    assert pg.get_attribute('#tabG', 'aria-selected') == 'true'
    pg.click('#lbCounts button[data-n="5"]')
    assert pg.get_attribute('#lbCounts button[data-n="5"]', 'aria-checked') == 'true'
    pg.wait_for_function("document.getElementById('lb').textContent.indexOf('Одоохондоо хоосон') >= 0", timeout=5000)
    pg.click('#lbCounts button[data-n="10"]')
    assert pg.get_attribute('#lbCounts button[data-n="10"]', 'aria-checked') == 'true'
    pg.wait_for_function("document.getElementById('lb').textContent.indexOf('Top') >= 0", timeout=5000)
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
    assert s['lives'] == 3 and 2300 <= s['score'] <= 3450, s
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
    assert pg.evaluate("document.querySelector('#pkList .sg.on').dataset.gid") == PICK
    assert pg.get_attribute('#pkList .sg[data-gid="%s"]' % PICK, 'aria-pressed') == 'true'
    assert pg.is_visible('#pkSel')
    assert pg.evaluate("[...document.querySelectorAll('#pkSel .selc')].map(e => e.dataset.gid)") == [PICK]
    pg.wait_for_timeout(400)
    pg.screenshot(path=str(OUT / 'picker.png'))
    pg.click('#pkX')
    assert pg.is_hidden('#picker') and st(pg)['screen'] == 'round' and st(pg)['q'] == 1
    pg.click('#chip')
    pg.click('#pkList .sg[data-gid="%s"]' % PICK)
    assert pg.is_disabled('#pkGo')
    pg.fill('#pkQ', 'чойжоо')
    assert pg.evaluate("[...document.querySelectorAll('#pkList .sg')].map(e => e.dataset.gid)") == [CHIP_PICK]
    pg.click('#pkList .sg[data-gid="%s"]' % CHIP_PICK)
    assert not pg.is_disabled('#pkGo')
    assert pg.is_visible('#pkSel')
    assert pg.evaluate("[...document.querySelectorAll('#pkSel .selc')].map(e => e.dataset.gid)") == [CHIP_PICK]
    pg.click('#pkSel .selc[data-gid="%s"]' % CHIP_PICK)
    assert pg.is_hidden('#pkSel')
    assert pg.is_disabled('#pkGo')
    pg.click('#pkList .sg[data-gid="%s"]' % CHIP_PICK)
    assert not pg.is_disabled('#pkGo')
    pg.click('#pkGo')
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
    if 'lang=en' in query:
        assert pg.get_attribute('#muteBtn', 'aria-label') == 'Mute'
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
            body = r.text().replace('<script src="mp.js"></script>', '<script src="mp.js"></script>\n<script src="late-mp.js"></script>')
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
    pg.evaluate("document.querySelectorAll('#pkList .sg.on').forEach(e => e.click())")
    pg.click('#pkList .sg[data-gid="%s"]' % CHIP_PICK)
    pg.click('#pkGo')
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
    assert pg.evaluate('typeof window.MEDIA') == 'undefined'
    assert pg.evaluate("document.querySelectorAll('#chipAv .avimg').length") == 0
    assert pg.evaluate('UBM.music()') == {'src': '', 'playing': False, 'muted': False}
    assert pg.is_hidden('#songSrc')
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


PNG_BYTES = None
WAV_BYTES = None


def fake_png():
    global PNG_BYTES
    if PNG_BYTES is None:
        def chunk(t, d):
            c = t + d
            return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        row = b'\x00' + b'\x5a\xc8\xfa\xff' * 32
        ihdr = struct.pack('>IIBBBBB', 32, 32, 8, 6, 0, 0, 0)
        idat = zlib.compress(row * 32)
        PNG_BYTES = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    return PNG_BYTES


def fake_wav(sec=60):
    global WAV_BYTES
    if WAV_BYTES is None:
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(1)
            w.setframerate(8000)
            w.writeframes(b'\x80' * (8000 * sec))
        WAV_BYTES = buf.getvalue()
    return WAV_BYTES


def media_fixture(start_gid, all_pre=False):
    g_start = next(g for g in LYRICS['groups'] if g['id'] == start_gid)
    g_pick = next(g for g in LYRICS['groups'] if g['id'] == CHIP_PICK)
    g_other = next(g for g in LYRICS['groups'] if g['id'] == PICK)
    g_guar = next(g for g in LYRICS['groups'] if g['id'] == GUARANTEED_GID)
    start_titles = list(dict.fromkeys(s['t'] for s in g_start['songs']))
    no_pre_start = None if all_pre else start_titles[-1]
    pre_start = {t: URL_A for t in (start_titles if all_pre else start_titles[:-1])}
    pre_pick = {s['t']: URL_B for s in g_pick['songs']}
    pre_other = {s['t']: URL_C for s in g_other['songs']}
    guar_titles = list(dict.fromkeys(s['t'] for s in g_guar['songs']))
    no_pre_guar = guar_titles[-1]
    pre_guar = {t: URL_A for t in guar_titles[:-1]}
    data = {
        'img': {start_gid: URL_IMG},
        'pre': {start_gid: pre_start, CHIP_PICK: pre_pick, PICK: pre_other, GUARANTEED_GID: pre_guar},
    }
    js = 'window.MEDIA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';'
    return js, no_pre_start, no_pre_guar


def media_setup(js):
    png = fake_png()
    wav = fake_wav()
    def setup(pg):
        pg.route('**/ugee-buu-mart/media-data.js', lambda r: r.fulfill(status=200, body=js, content_type='application/javascript'))
        pg.route('https://is1-ssl.mzstatic.com/fake/**', lambda r: r.fulfill(status=200, body=png, content_type='image/png'))
        pg.route(
            'https://audio-ssl.itunes.apple.com/fake/**',
            lambda r: r.fulfill(
                status=200,
                body=wav,
                headers={'access-control-allow-origin': '*', 'content-type': 'audio/wav'},
            ),
        )
    return setup


def media_flow(b):
    js, no_pre_start, no_pre_guar = media_fixture(START_GID)
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True, setup=media_setup(js))
    wait_round(pg)
    assert st(pg)['groupId'] == START_GID
    pg.wait_for_function("(() => { const i = document.querySelector('#chipAv .avimg'); return !!(i && i.complete && i.naturalWidth > 0); })()", timeout=3000)

    seen_no_pre = False
    prev_url = None
    for q in range(10):
        cur = pg.evaluate('UBM.current()')
        assert cur is not None
        expect_url = '' if cur['song'] == no_pre_start else URL_A
        if expect_url:
            pg.wait_for_function("u => UBM.music().src === u && UBM.music().playing", arg=expect_url, timeout=3000)
            assert pg.is_visible('#songSrc')
            assert pg.text_content('#songSrc') == 'Apple Music'
            if prev_url == expect_url:
                assert pg.evaluate("document.getElementById('bgm').currentTime") >= 0.2
            pg.wait_for_function("document.getElementById('bgm').currentTime >= 0.25", timeout=3000)
        else:
            seen_no_pre = True
            pg.wait_for_function("!UBM.music().playing", timeout=2000)
            assert pg.is_hidden('#songSrc')
        prev_url = expect_url
        if q < 9:
            answer_line(pg)

    pg.evaluate("""gid => {
      const g = UBM.groupById(gid);
      const si = g.songs.findIndex(x => x.t.length >= 20 && x.t.length <= 26);
      const q = UBMCore.round(g, [{ s: si, e: 0 }], UBMCore.rng(1))[0];
      UBM.startRound({ group: g, qs: [q], mode: 'solo' });
    }""", START_GID)
    wait_round(pg)
    assert len(pg.evaluate("UBM.current().song")) >= 20
    pg.wait_for_function("u => UBM.music().src === u && UBM.music().playing", arg=URL_A, timeout=3000)
    assert pg.evaluate("(() => { const e = document.getElementById('songT'); return e.scrollWidth <= e.clientWidth; })()"), pg.text_content('#songT')
    assert pg.evaluate("document.getElementById('songSrc').getBoundingClientRect().top > document.getElementById('song').getBoundingClientRect().bottom - 1")
    pg.wait_for_timeout(450)
    pg.screenshot(path=str(OUT / 'round-photo.png'))

    assert pg.is_visible('#muteBtn')
    pg.wait_for_timeout(200)
    box = pg.locator('#muteBtn').bounding_box()
    assert box['width'] >= 40 and box['height'] >= 40, box
    assert pg.get_attribute('#muteBtn', 'aria-pressed') == 'false'
    assert pg.get_attribute('#muteBtn', 'aria-label') == 'Дуу хаах'
    assert pg.evaluate('UBM.music().muted') is False

    pg.click('#muteBtn')
    assert pg.evaluate('UBM.music().muted') is True
    assert pg.evaluate("document.getElementById('bgm').muted") is True
    assert pg.evaluate('UBM.music().playing') is False
    assert pg.get_attribute('#muteBtn', 'aria-pressed') == 'true'
    assert pg.is_visible('#muteBtn .muted') and not pg.is_visible('#muteBtn .unmuted')
    pg.reload()
    wait_round(pg)
    assert pg.evaluate('UBM.music().muted') is True
    assert pg.evaluate("document.getElementById('bgm').muted") is True
    assert pg.evaluate('UBM.music().playing') is False
    assert pg.get_attribute('#muteBtn', 'aria-pressed') == 'true'
    pg.click('#muteBtn')
    assert pg.evaluate('UBM.music().muted') is False
    assert pg.evaluate("document.getElementById('bgm').muted") is False
    assert pg.get_attribute('#muteBtn', 'aria-pressed') == 'false'
    assert pg.is_visible('#muteBtn .unmuted') and not pg.is_visible('#muteBtn .muted')
    if pg.evaluate('UBM.current().song') == no_pre_start:
        answer_line(pg)
    pg.wait_for_function("UBM.music().playing", timeout=3000)

    pg.evaluate(HIDE, True)
    pg.wait_for_function("!UBM.music().playing", timeout=2000)
    pg.evaluate(HIDE, False)
    pg.wait_for_function("UBM.music().playing", timeout=3000)

    pg.evaluate("document.getElementById('bgm').pause()")
    pg.wait_for_function("!UBM.music().playing", timeout=2000)
    q_before = st(pg)['q']
    i = pg.evaluate(WRONG_TILE)
    assert i >= 0
    tap(pg, i)
    pg.wait_for_function("UBM.music().playing", timeout=2000)
    assert st(pg)['q'] == q_before

    pg.click('#chip')
    assert pg.is_visible('#picker')
    pg.wait_for_function("!UBM.music().playing", timeout=2000)
    assert pg.evaluate("document.querySelectorAll('#pkList .sg[data-gid=\"%s\"] .avimg').length" % CHIP_PICK) == 0
    assert pg.text_content('#pkList .sg[data-gid="%s"] .av' % CHIP_PICK).strip() != ''
    pg.click('#pkX')
    assert pg.is_hidden('#picker')
    pg.wait_for_function("UBM.music().playing", timeout=3000)

    pg.click('#chip')
    assert pg.is_visible('#picker')
    pg.wait_for_function("!UBM.music().playing", timeout=2000)
    pg.evaluate("document.querySelectorAll('#pkList .sg.on').forEach(e => e.click())")
    pg.click('#pkList .sg[data-gid="%s"]' % CHIP_PICK)
    pg.click('#pkGo')
    wait_round(pg)
    assert st(pg)['groupId'] == CHIP_PICK
    assert pg.evaluate("document.querySelectorAll('#chipAv .avimg').length") == 0
    assert pg.text_content('#chipAv').strip() != ''
    pg.wait_for_function("u => UBM.music().src === u && UBM.music().playing", arg=URL_B, timeout=3000)
    assert pg.is_visible('#songSrc')

    pg.evaluate("""(args) => {
      const g1 = UBM.groupById(args[0]);
      const q1 = UBMCore.round(g1, [{ s: 0, e: 0 }], UBMCore.rng(1))[0];
      UBM.startRound({ group: g1, qs: [q1], mode: 'solo' });
    }""", [START_GID])
    pg.wait_for_timeout(50)
    pg.evaluate("""(args) => {
      const g2 = UBM.groupById(args[0]);
      const q2 = UBMCore.round(g2, [{ s: 0, e: 0 }], UBMCore.rng(1))[0];
      UBM.startRound({ group: g2, qs: [q2], mode: 'solo' });
    }""", [PICK])
    pg.wait_for_function("u => UBM.music().src === u && UBM.music().playing", arg=URL_C, timeout=3000)

    if not seen_no_pre:
        pg.click('#chip')
        pg.evaluate("document.querySelectorAll('#pkList .sg.on').forEach(e => e.click())")
        pg.click('#pkList .sg[data-gid="%s"]' % GUARANTEED_GID)
        pg.click('#pkGo')
        wait_round(pg)
        for q in range(7):
            if pg.evaluate('UBM.current().song') == no_pre_guar:
                seen_no_pre = True
                pg.wait_for_function("!UBM.music().playing", timeout=2000)
                assert pg.is_hidden('#songSrc')
                answer_line(pg)
                break
            answer_line(pg)
    assert seen_no_pre
    while pg.evaluate('UBM.current().song') == no_pre_guar:
        answer_line(pg)
    pg.wait_for_function("UBM.music().playing", timeout=3000)

    for _ in range(3):
        wrong_tap(pg)
    pg.wait_for_function("UBM.state().screen === 'end'", timeout=5000)
    pg.wait_for_function("!UBM.music().playing", timeout=2000)
    assert not errors, errors

    page_errs = []
    pg.on('pageerror', lambda e: page_errs.append(str(e)))
    pg.route('https://is1-ssl.mzstatic.com/fake/**', lambda r: r.fulfill(status=404))
    pg.click('#endPk .sg[data-gid="%s"]' % START_GID)
    wait_round(pg)
    pg.reload()
    wait_round(pg)
    pg.wait_for_function("document.querySelectorAll('#chipAv .avimg').length === 0", timeout=3000)
    assert pg.text_content('#chipAv').strip() != ''
    assert not page_errs, page_errs
    pg.context.close()


AUTOPLAY_GATE = """(() => {
  let active = false;
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    get: () => ({ hasBeenActive: active, isActive: active })
  });
  for (const ev of ['pointerup', 'touchend', 'click']) {
    window.addEventListener(ev, e => { if (e.isTrusted) active = true; }, { capture: true, passive: true });
  }
  const origPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!navigator.userActivation || !navigator.userActivation.hasBeenActive) {
      return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    }
    return origPlay.apply(this, arguments);
  };
  const OrigAC = window.AudioContext || window.webkitAudioContext;
  if (OrigAC) {
    const proto = Object.getPrototypeOf(OrigAC.prototype);
    const stateDesc = Object.getOwnPropertyDescriptor(proto, 'state') || Object.getOwnPropertyDescriptor(OrigAC.prototype, 'state');
    const origResume = OrigAC.prototype.resume;
    const WrappedAC = function () {
      const ctx = new OrigAC(...arguments);
      let unlocked = false;
      Object.defineProperty(ctx, 'state', {
        configurable: true,
        get: function () {
          const real = stateDesc && stateDesc.get ? stateDesc.get.call(ctx) : 'running';
          if (real === 'closed') return 'closed';
          return unlocked ? real : 'suspended';
        }
      });
      ctx.resume = function () {
        if (!navigator.userActivation || !navigator.userActivation.hasBeenActive) {
          return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
        }
        unlocked = true;
        window.__ubmResumeCalls = (window.__ubmResumeCalls || 0) + 1;
        return origResume.call(ctx);
      };
      window.__ubmActx = ctx;
      return ctx;
    };
    WrappedAC.prototype = OrigAC.prototype;
    window.AudioContext = WrappedAC;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAC;
  }
})();"""


def default_autoplay_flow(b):
    js, _, _ = media_fixture(START_GID, all_pre=True)
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True, extra=AUTOPLAY_GATE, setup=media_setup(js), has_touch=True)
    wait_round(pg)
    pg.wait_for_timeout(300)
    assert pg.evaluate("UBM.music().src") == URL_A
    assert pg.evaluate("UBM.music().playing") is False
    assert pg.evaluate("window.__ubmActx && window.__ubmActx.state") == 'suspended'
    assert pg.is_visible('#songSrc')
    assert not errors, errors
    i = pg.evaluate(WRONG_TILE)
    assert i >= 0
    pg.tap('#tray .tile[data-i="%d"]' % i)
    pg.wait_for_function("UBM.music().playing", timeout=2000)
    assert st(pg)['q'] == 0
    pg.wait_for_function("window.__ubmActx && window.__ubmActx.state === 'running'", timeout=2000)
    assert pg.evaluate("window.__ubmResumeCalls >= 1")
    assert not errors, errors
    pg.context.close()


def skip_flow(b):
    pg, errors = new_page(b, {'width': 360, 'height': 640}, True)
    wait_round(pg)
    s0 = st(pg)
    assert pg.is_visible('#skipBtn') and pg.get_attribute('#skipBtn', 'aria-label') == 'Алгасах'
    pg.click('#skipBtn')
    pg.wait_for_function("document.querySelectorAll('#line .slot.miss').length > 0", timeout=2000)
    pg.wait_for_function("UBM.state().q === %d" % (s0['q'] + 1), timeout=4000)
    s1 = st(pg)
    assert s1['lives'] == s0['lives'] and s1['score'] == s0['score'] and s1['screen'] == 'round', (s0, s1)
    assert not errors, errors
    pg.context.close()


OSC_SPY = """(() => {
  window.__osc = [];
  const AC = window.AudioContext || window.webkitAudioContext;
  const make = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function () {
    const o = make.call(this);
    const set = o.frequency.setValueAtTime.bind(o.frequency);
    o.frequency.setValueAtTime = (v, t) => { window.__osc.push(Math.round(v)); return set(v, t); };
    return o;
  };
})();"""


def refill_flow(b):
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True)
    wait_round(pg)
    wrong_tap(pg)
    answer_line(pg)
    assert st(pg)['lives'] == 2
    for _ in range(2):
        answer_line(pg)
    assert st(pg)['lives'] == 2
    answer_line(pg)
    assert st(pg)['lives'] == 3, 'three clean lines in a row give a heart back'
    assert pg.evaluate("document.querySelectorAll('#hearts i.off').length") == 0
    assert not errors, errors
    pg.context.close()


def sfx_flow(b):
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True, extra=OSC_SPY)
    wait_round(pg)
    wrong_tap(pg)
    assert pg.evaluate('__osc') == [196, 147], pg.evaluate('__osc')
    pg.evaluate('__osc.length = 0')
    pg.click('#muteBtn')
    wrong_tap(pg)
    assert st(pg)['lives'] == 1
    assert pg.evaluate('__osc') == [], 'muted: no sfx'
    pg.click('#muteBtn')
    w = pg.evaluate('UBM.current().answer[0]')
    tap(pg, pg.evaluate(TILE_FOR, w))
    assert pg.evaluate('__osc') == [880, 1319], pg.evaluate('__osc')
    assert not errors, errors
    pg.context.close()


def multi_flow(b):
    js, _, _ = media_fixture(START_GID, all_pre=True)
    pg, errors = new_page(b, {'width': 390, 'height': 844}, True, setup=media_setup(js))
    wait_round(pg)
    pg.click('#chip')
    assert pg.is_visible('#picker')
    assert pg.get_attribute('#pkCounts', 'role') == 'radiogroup'
    radios = pg.evaluate("[...document.querySelectorAll('#pkCounts [role=\"radio\"]')].map(e => ({n: +e.dataset.n, checked: e.getAttribute('aria-checked'), h: e.getBoundingClientRect().height}))")
    assert [r['n'] for r in radios] == [5, 10, 20, 30] and all(r['h'] >= 44 for r in radios), radios
    assert [r['checked'] for r in radios] == ['false', 'true', 'false', 'false']

    pg.evaluate("document.querySelectorAll('#pkList .sg.on').forEach(e => e.click())")
    assert pg.is_disabled('#pkGo')
    pg.click('#pkList .sg[data-gid="%s"]' % START_GID)
    assert pg.get_attribute('#pkList .sg[data-gid="%s"]' % START_GID, 'aria-pressed') == 'true'
    pg.fill('#pkQ', 'чойжоо')
    pg.click('#pkList .sg[data-gid="%s"]' % CHIP_PICK)
    pg.fill('#pkQ', '')
    sel = pg.evaluate("[...document.querySelectorAll('#pkList .sg.on')].map(e => e.dataset.gid).sort()")
    assert sel == sorted([START_GID, CHIP_PICK]), sel
    assert pg.evaluate("getComputedStyle(document.querySelector('#pkList .sg.on .ck')).display") != 'none'
    assert not pg.is_disabled('#pkGo') and '(2)' in pg.text_content('#pkGo')
    pg.click('#pkCounts button[data-n="5"]')
    assert pg.get_attribute('#pkCounts button[data-n="5"]', 'aria-checked') == 'true'
    pg.wait_for_timeout(400)
    layout = pg.evaluate("""() => {
      const f = document.getElementById('pkFoot').getBoundingClientRect();
      const l = document.getElementById('pkList').getBoundingClientRect();
      return { fh: f.height, ftop: f.top, fbot: f.bottom, lbot: l.bottom, ih: innerHeight };
    }""")
    assert layout['fh'] > 0 and layout['fbot'] <= layout['ih'] + 1 and layout['lbot'] <= layout['ftop'] + 1, layout
    pg.screenshot(path=str(OUT / 'picker-multi.png'))

    pg.click('#pkGo')
    wait_round(pg)
    mix_id = '+'.join(sorted([START_GID, CHIP_PICK]))
    s = st(pg)
    assert s['groupId'] == mix_id and s['total'] == 5 and s['n'] == 5, s
    assert pg.text_content('#qn') == '1/5'

    q_gids = []
    for k in range(5):
        cur = pg.evaluate('UBM.current()')
        assert cur['gid'] in (START_GID, CHIP_PICK), cur
        assert pg.text_content('#chipName') == pg.evaluate("g => UBM.groupById(g).name", cur['gid'])
        if cur['gid'] == START_GID:
            pg.wait_for_function("u => UBM.music().src === u", arg=URL_A, timeout=3000)
            pg.wait_for_function("document.querySelectorAll('#chipAv .avimg').length === 1", timeout=3000)
        else:
            pg.wait_for_function("u => UBM.music().src === u", arg=URL_B, timeout=3000)
            assert pg.evaluate("document.querySelectorAll('#chipAv .avimg').length") == 0
        q_gids.append(cur['gid'])
        answer_line(pg)
    assert set(q_gids) == {START_GID, CHIP_PICK}, q_gids
    pg.wait_for_function("UBM.state().screen === 'end'", timeout=3000)
    assert pg.text_content('#endLines').startswith('5/5')
    pg.wait_for_selector('#retry:not([hidden])', timeout=5000)
    sub = pg.evaluate('__stub.calls.submit')
    assert len(sub) == 1 and sub[0]['meta']['singer'] == mix_id and sub[0]['meta']['n'] == 5, sub

    pg.click('#again')
    wait_round(pg)
    assert st(pg)['groupId'] == mix_id and st(pg)['total'] == 5

    pg.reload()
    wait_round(pg)
    s = st(pg)
    assert s['groupId'] == mix_id and s['total'] == 5 and pg.text_content('#qn') == '1/5', s
    assert pg.evaluate("__stub.store['ubm:last']") == mix_id
    assert pg.evaluate("__stub.store['ubm:n']") == 5

    res20 = pg.evaluate("""ids => {
      const g = UBM.groupById(ids);
      const r = UBMCore.rng(42);
      const qs = UBMCore.round(g, UBMCore.pickRefs(g, [], 20, r), r);
      return qs.map(q => ({ len: q.answer.length, gid: q.gid }));
    }""", mix_id)
    assert len(res20) == 20 and all(isinstance(x['len'], int) and 1 <= x['len'] <= 5 and x['gid'] in (START_GID, CHIP_PICK) for x in res20), res20
    assert not errors, errors
    pg.context.close()


httpd = serve()
BASE = 'http://127.0.0.1:%d' % httpd.server_address[1]
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    main_flow(browser)
    media_flow(browser)
    skip_flow(browser)
    sfx_flow(browser)
    refill_flow(browser)
    multi_flow(browser)
    shots(browser, {'width': 360, 'height': 640}, 'small')
    shots(browser, {'width': 390, 'height': 844}, 'en', '?lang=en')
    no_host(browser)
    boot_seam(browser)
    hung_storage(browser)
    browser.close()
    default_browser = p.chromium.launch()
    default_autoplay_flow(default_browser)
    default_browser.close()
httpd.shutdown()
print('UBM SMOKE OK', OUT)
