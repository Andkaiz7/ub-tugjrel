import functools
import http.server
import pathlib
import sys
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.superpowers' / 'sdd' / '2026-11-16-ugee-buu-mart' / 'task-4-shots'
OUT.mkdir(parents=True, exist_ok=True)
STUB = (ROOT / 'tools' / 'ubm-stub.js').read_text()
DEFAULT = '2ca00e15'
PICK = '70357a81'
VIEW = {'width': 390, 'height': 844}

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

EXPECT_Q = """q => {
  const s = __stub.log().find(a => a.action_type === 'start').action_data;
  const g = UBM.groupById(s.gid);
  const r = UBMCore.rng(s.seed);
  return UBMCore.round(g, UBMCore.pickRefs(g, [], s.n || 10, r), r)[q].id;
}"""

SLOW_START = """() => {
  const g = Usion.game, orig = g.action;
  g.action = function (t, d) { return t === 'start' ? new Promise(r => setTimeout(() => r(orig(t, d)), 1500)) : orig(t, d); };
}"""

FINAL = "[...document.querySelectorAll('#resList .rr')].map(e => [e.dataset.pid, e.querySelector('.sc').textContent])"

NO_SEEN = "Object.keys(__stub.store).concat(Object.keys(localStorage)).filter(k => k.indexOf('ubm:seen:') >= 0).length"


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def open_page(ctx, query):
    pg = ctx.new_page()
    pg.route('**/ugee-buu-mart/media-data.js', lambda r: r.fulfill(status=200, body='window.MEDIA={"img":{},"pre":{}};', content_type='application/javascript'))
    errors = []
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(BASE + '/ugee-buu-mart/index.html' + query)
    return pg, errors


def st(pg):
    return pg.evaluate('UBM.state()')


def wait_screen(pg, name, timeout=5000):
    pg.wait_for_function("n => window.UBM && UBM.state().screen === n", arg=name, timeout=timeout)


def wait_rows(pg, n):
    pg.wait_for_function("n => document.querySelectorAll('#hallList .pl').length === n", arg=n, timeout=5000)


def rows(pg, sel='#hallList .pl'):
    return pg.evaluate("s => [...document.querySelectorAll(s)].map(e => e.dataset.pid)", sel)


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
    tap(pg, pg.evaluate(WRONG_TILE))


def die(pg):
    for _ in range(3):
        wrong_tap(pg)


def ready_both(p1, p2):
    p1.click('#readyBtn')
    assert p1.get_attribute('#readyBtn', 'aria-pressed') == 'true'
    p2.wait_for_function("document.querySelector('#hallList .pl[data-pid=\"u1\"]').classList.contains('ok')", timeout=5000)
    p1.wait_for_timeout(300)
    assert p1.is_disabled('#startBtn'), 'Start stays disabled until everyone is ready'
    p2.click('#readyBtn')
    p1.wait_for_function("!document.getElementById('startBtn').disabled", timeout=5000)


def main_match(b):
    ctx = b.new_context(viewport=VIEW, device_scale_factor=2)
    ctx.add_init_script(STUB)
    p1, e1 = open_page(ctx, '?mode=multiplayer&uid=u1')
    wait_screen(p1, 'hall')
    p2, e2 = open_page(ctx, '?mode=multiplayer&uid=u2')
    wait_screen(p2, 'hall')
    wait_rows(p1, 2)
    wait_rows(p2, 2)
    assert rows(p1) == rows(p2) == ['u1', 'u2']
    p2.wait_for_function("document.querySelector('#hallList .pl[data-pid=\"u1\"] .nm').textContent.indexOf('Бат') === 0", timeout=5000)
    assert 'Хост' in p2.text_content('#hallList .pl[data-pid="u1"]')
    assert 'Хост' not in p2.text_content('#hallList .pl[data-pid="u2"]')
    assert p1.text_content('#hallCount') == '2/8'
    assert p1.is_visible('#startBtn') and p1.is_disabled('#startBtn')
    assert p2.is_hidden('#startBtn') and p2.text_content('#hallNote') == 'Хост эхлүүлэхийг хүлээж байна…'
    assert p2.is_disabled('#hallSinger')
    assert p1.is_visible('#hall .chatBtn') and p2.is_visible('#hall .chatBtn')
    p2.wait_for_function("document.getElementById('hallSN').textContent === 'Хурд'", timeout=5000)

    p1.click('#hallSinger')
    assert p1.is_visible('#picker')
    assert p1.evaluate("document.querySelector('#pkList .sg.on').dataset.gid") == DEFAULT
    p1.click('#pkList .sg[data-gid="%s"]' % DEFAULT)
    p1.click('#pkList .sg[data-gid="%s"]' % PICK)
    p1.click('#pkGo')
    assert p1.is_hidden('#picker') and p1.text_content('#hallSN') == 'Харанга'
    p2.wait_for_function("document.getElementById('hallSN').textContent === 'Харанга'", timeout=5000)
    p1.click('#hallSinger')
    assert p1.evaluate("document.querySelector('#pkList .sg.on').dataset.gid") == PICK
    p1.click('#pkX')

    ready_both(p1, p2)
    p1.click('#hallInvite')
    p1.wait_for_function('__stub.calls.invite === 1', timeout=3000)
    p1.wait_for_timeout(400)
    p1.screenshot(path=str(OUT / 'hall.png'))
    p2.screenshot(path=str(OUT / 'hall-guest.png'))

    p1.click('#startBtn')
    for pg in (p1, p2):
        pg.wait_for_function("UBM.state().screen === 'round' && !!UBM.current()", timeout=5000)
        assert st(pg)['groupId'] == PICK and st(pg)['q'] == 0
        assert pg.is_visible('#stripRow') and rows(pg, '#strip .pc') == ['u1', 'u2']
    assert p1.evaluate('UBM.current().id') == p2.evaluate('UBM.current().id'), 'same questions for everyone'
    assert p1.evaluate('UBM.current().id') == p1.evaluate(EXPECT_Q, 0), 'questions derive from the start seed'
    assert p1.evaluate('__stub.log().filter(a => a.action_type === "start").length') == 1
    start = p1.evaluate('__stub.log()[0].action_data')
    assert start['roster'] == ['u1', 'u2'] and start['gid'] == PICK

    for _ in range(5):
        answer_line(p1)
    for _ in range(3):
        answer_line(p2)
    assert p1.evaluate('UBM.current().id') != p2.evaluate('UBM.current().id'), 'race, not lockstep'
    p1.wait_for_function("document.querySelector('#strip .pc[data-pid=\"u2\"] .n').textContent === '3/10'", timeout=5000)
    p2.wait_for_function("document.querySelector('#strip .pc[data-pid=\"u1\"] .n').textContent === '5/10'", timeout=5000)
    p1.wait_for_timeout(500)
    p1.screenshot(path=str(OUT / 'race.png'))

    for _ in range(5):
        answer_line(p1)
    wait_screen(p1, 'results')
    assert p1.text_content('#resHead') == 'Бусдыг хүлээж байна…'
    assert p1.is_hidden('#resAgain')
    assert not p1.evaluate('__stub.calls.report.length')
    my = p1.evaluate("__stub.log().filter(a => a.action_type === 'ans' && a.player_id === 'u1')")
    assert len(my) == 10 and all(a['action_data']['ok'] for a in my)
    p1.wait_for_function('__stub.calls.submit.length === 1', timeout=5000)
    assert p1.evaluate(NO_SEEN) == 0 and p2.evaluate(NO_SEEN) == 0, 'a race never touches solo seen-progress'
    score1 = p1.evaluate('__stub.calls.submit[0].score')
    assert 1000 <= score1 <= 1500 and p1.evaluate('__stub.calls.submit[0].meta.lines') == 10

    p1.click('#results .chatBtn')
    assert p1.is_visible('#chat')
    assert p1.evaluate("document.querySelectorAll('#phrases .ph').length") == 8
    msg = '<b>Сайн</b> уу'
    p1.fill('#chatIn', msg)
    p1.press('#chatIn', 'Enter')
    assert p1.is_hidden('#chat')
    p2.wait_for_function("m => [...document.querySelectorAll('#bubbles .bubble')].some(b => b.textContent === m)", arg=msg, timeout=3000)
    assert p2.evaluate("document.querySelector('#bubbles .bubble[data-from=\"u1\"]').children.length") == 0, 'chat text is set via textContent'
    assert p2.evaluate("!document.querySelector('#bubbles b')")
    p2.wait_for_timeout(250)
    p2.screenshot(path=str(OUT / 'chat.png'))
    p1.wait_for_timeout(800)
    p1.click('#results .chatBtn')
    p1.click('#phrases .ph >> nth=0')
    p2.wait_for_function("[...document.querySelectorAll('#bubbles .bubble')].some(b => b.textContent === 'Сайн уу! 👋')", timeout=3000)
    assert not e2, e2

    p2.close(run_before_unload=True)
    p1.wait_for_function("document.getElementById('resHead').textContent === 'Чи түрүүллээ!'", timeout=30000)
    assert rows(p1, '#resList .rr') == ['u1', 'u2'], 'results list both, winner first'
    assert 'гарсан' in p1.text_content('#resList .rr[data-pid="u2"]')
    assert p1.text_content('#resList .rr[data-pid="u2"] .sc small') == '… 3/10'
    assert p1.is_visible('#resAgain')
    rep = p1.evaluate('__stub.calls.report')
    assert len(rep) == 1 and rep[0]['winnerId'] == 'u1' and rep[0]['standings'] == ['u1', 'u2'], rep
    assert 'draw' not in rep[0]
    assert p1.evaluate("__stub.log().filter(a => a.action_type === 'end').length") >= 1, 'the end of the match is a stored action'
    assert rep[0]['scores']['u1'] == score1 and rep[0]['scores']['u2'] > 0
    p1.wait_for_selector('#resRetry:not([hidden])', timeout=5000)
    assert p1.text_content('#resSaveText') == 'Хадгалагдаагүй'
    p1.click('#resRetry')
    p1.wait_for_function("document.getElementById('resSaveText').textContent.indexOf('Хадгалагдлаа') === 0", timeout=5000)
    assert [x['score'] for x in p1.evaluate('__stub.calls.submit')] == [score1, score1]
    p1.wait_for_timeout(1500)
    assert len(p1.evaluate('__stub.calls.report')) == 1, 'reportResult once per match'
    p1.click('#resList .rr[data-pid="u2"]')
    assert p1.evaluate('__stub.calls.profile') == ['u2']
    p1.screenshot(path=str(OUT / 'results.png'))

    p1.click('#resAgain')
    wait_screen(p1, 'hall')
    assert p1.get_attribute('#readyBtn', 'aria-pressed') == 'false' and p1.is_disabled('#startBtn')
    assert rows(p1) == ['u1'] and p1.is_hidden('#hall .chatBtn')
    assert not e1, e1
    ctx.close()


def rematch(b):
    ctx = b.new_context(viewport=VIEW, device_scale_factor=2)
    ctx.add_init_script(STUB)
    p1, e1 = open_page(ctx, '?mode=multiplayer&uid=u1&room=r2')
    wait_screen(p1, 'hall')
    p2, e2 = open_page(ctx, '?mode=multiplayer&uid=u2&room=r2')
    wait_rows(p1, 2)
    wait_rows(p2, 2)
    ready_both(p1, p2)
    p1.click('#startBtn')
    for pg in (p1, p2):
        pg.wait_for_function("UBM.state().screen === 'round' && !!UBM.current()", timeout=5000)
        assert st(pg)['groupId'] == DEFAULT
    p3, e3 = open_page(ctx, '?mode=multiplayer&uid=u3&room=r2')
    wait_screen(p3, 'hall')
    p3.wait_for_function("document.getElementById('hallNote').textContent === 'Тоглолт явж байна. Дараагийнхыг хүлээнэ үү.'", timeout=5000)
    p3.wait_for_timeout(500)
    assert st(p3)['screen'] == 'hall' and st(p3)['groupId'] is None, 'late joiner waits for the next match'
    answer_line(p2)
    score2 = st(p2)['score']
    p2.wait_for_function("__stub.log().filter(a => a.action_type === 'ans' && a.player_id === 'u2').length === 1", timeout=3000)
    p2.reload()
    p2.wait_for_function("UBM.state().screen === 'round' && !!UBM.current()", timeout=5000)
    s2 = st(p2)
    assert s2['q'] == 1 and s2['score'] == score2 and s2['lives'] == 3, 'onSync resumes at the next question: %s' % s2
    assert p2.evaluate('UBM.current().id') == p2.evaluate(EXPECT_Q, 1)
    assert p2.text_content('#qn') == '2/10' and p2.is_visible('#stripRow')
    p1.wait_for_function("document.querySelector('#strip .pc[data-pid=\"u2\"] .n').textContent === '1/10'", timeout=5000)
    die(p2)
    syncs2 = p2.evaluate('__stub.calls.sync')
    p2.evaluate("__stub.delayNext('ans', 6000)")
    die(p1)
    for pg in (p1, p2):
        wait_screen(pg, 'results')
        pg.wait_for_selector('#resAgain:not([hidden])', timeout=5000)
    assert rows(p1, '#resList .rr') == rows(p2, '#resList .rr') == ['u2', 'u1']
    assert p1.evaluate(FINAL) == p2.evaluate(FINAL), 'identical final standings on every phone'
    assert p2.evaluate('__stub.calls.sync') > syncs2, 'an end that overtakes an earlier ans triggers a sync instead of being applied early'
    final_a = p1.evaluate(FINAL)
    p2.evaluate("() => Usion.game.action('ans', {m: __stub.log().find(a => a.action_type === 'start').action_data.m, q: 9, ok: true, ms: 0, lives: 3})")
    p1.wait_for_timeout(600)
    assert p1.evaluate(FINAL) == p2.evaluate(FINAL) == final_a, 'an ans after the end never changes the final standings'
    assert p2.text_content('#resHead') == 'Чи түрүүллээ!' and p1.text_content('#resHead') == 'Сараа түрүүллээ!'
    p1.wait_for_function('__stub.calls.report.length === 1', timeout=3000)
    assert p1.evaluate('__stub.calls.report[0].winnerId') == 'u2'
    assert p2.evaluate('__stub.calls.report.length') == 0, 'only the host reports'
    assert p1.evaluate('__stub.calls.submit.length') == 0, 'a 0 race score is not submitted'
    p2.wait_for_selector('#resRetry:not([hidden])', timeout=5000)
    p2.click('#resRetry')
    p2.wait_for_function("document.getElementById('resSaveText').textContent.indexOf('Хадгалагдлаа') === 0", timeout=5000)
    p3.wait_for_function("document.getElementById('hallNote').textContent === 'Хост эхлүүлэхийг хүлээж байна…'", timeout=5000)
    for pg in (p1, p2):
        pg.click('#resAgain')
        wait_screen(pg, 'hall')
    for pg in (p1, p2):
        wait_rows(pg, 3)
        pg.wait_for_function("[...document.querySelectorAll('#hallList .pl')].every(e => !e.classList.contains('ok'))", timeout=5000)
        assert pg.get_attribute('#readyBtn', 'aria-pressed') == 'false'
    assert p1.is_disabled('#startBtn'), 'READY is reset for the rematch'

    p2.reload()
    wait_screen(p2, 'hall')
    p2.wait_for_timeout(1500)
    assert st(p2)['screen'] == 'hall' and st(p2)['groupId'] is None, 'a guest reloading after the end is not pulled into the old race'
    assert p2.evaluate('__stub.calls.submit.length') == 0, 'no second race submit after reload'
    p1.reload()
    wait_screen(p1, 'hall')
    wait_rows(p1, 3)
    p1.wait_for_timeout(1500)
    assert st(p1)['screen'] == 'hall' and st(p1)['groupId'] is None
    assert p1.evaluate('__stub.calls.report.length') == 0, 'host leave and return sends no second result'

    for pg in (p1, p2, p3):
        wait_rows(pg, 3)
        pg.click('#readyBtn')
    p1.wait_for_function("!document.getElementById('startBtn').disabled", timeout=5000)
    p1.evaluate(SLOW_START)
    p1.click('#startBtn')
    p1.wait_for_timeout(1300)
    p1.evaluate("document.getElementById('startBtn').click()")
    for pg in (p1, p2, p3):
        pg.wait_for_function("UBM.state().screen === 'round' && !!UBM.current()", timeout=5000)
    p1.wait_for_timeout(1700)
    assert p1.evaluate("__stub.log().filter(a => a.action_type === 'start').length") == 2, 'two rapid Start taps send one start'
    for pg in (p1, p2, p3):
        die(pg)
    for pg in (p1, p2, p3):
        wait_screen(pg, 'results')
        pg.wait_for_selector('#resAgain:not([hidden])', timeout=5000)
        assert pg.text_content('#resHead') == 'Тэнцлээ!' and pg.is_hidden('#trophy')
    assert p1.evaluate(FINAL) == p2.evaluate(FINAL) == p3.evaluate(FINAL)
    p1.wait_for_function('__stub.calls.report.length === 1', timeout=3000)
    drawn = p1.evaluate('__stub.calls.report[0]')
    assert drawn.get('draw') is True and 'winnerId' not in drawn, drawn
    p1.screenshot(path=str(OUT / 'draw.png'))
    p2.evaluate("() => { const s = __stub.log().find(a => a.action_type === 'start').action_data; return Usion.game.action('start', {m: 'forged', seed: 1, gid: s.gid, roster: s.roster}); }")
    p1.wait_for_timeout(800)
    assert st(p1)['screen'] == 'results' and st(p3)['screen'] == 'results', 'a start from a non-host is ignored'
    p1.reload()
    wait_screen(p1, 'hall')
    p1.wait_for_timeout(1500)
    assert p1.evaluate('__stub.calls.report.length') == 0, 'a host reload after two matches re-reports neither'
    assert not (e1 or e2 or e3), (e1, e2, e3)
    ctx.close()


def promoted(b):
    ctx = b.new_context(viewport=VIEW, device_scale_factor=2)
    ctx.add_init_script(STUB)
    pg, errors = open_page(ctx, '?uid=u3')
    pg.wait_for_function("UBM.state().screen === 'round' && !!UBM.current()", timeout=5000)
    assert pg.is_hidden('#stripRow')
    pg.evaluate("__stub.assignRoom('r3')")
    wait_screen(pg, 'hall')
    wait_rows(pg, 1)
    assert 'Хост' in pg.text_content('#hallList .pl[data-pid="u3"]')
    assert pg.is_visible('#startBtn') and pg.is_disabled('#startBtn')
    assert not pg.is_disabled('#hallSinger')
    pg.wait_for_timeout(1200)
    assert st(pg)['screen'] == 'hall', 'no solo round is drawn over the hall'
    pg.click('#soloBtn')
    pg.wait_for_function("UBM.state().screen === 'round' && !!UBM.current()", timeout=5000)
    for _ in range(3):
        wrong_tap(pg)
    wait_screen(pg, 'end')
    assert pg.is_visible('#endHall')
    pg.click('#endHall')
    wait_screen(pg, 'hall')
    assert not errors, errors
    ctx.close()


def mix_match(b):
    ctx = b.new_context(viewport=VIEW, device_scale_factor=2)
    ctx.add_init_script(STUB)
    p1, e1 = open_page(ctx, '?mode=multiplayer&uid=u1&room=r4')
    wait_screen(p1, 'hall')
    p2, e2 = open_page(ctx, '?mode=multiplayer&uid=u2&room=r4')
    wait_screen(p2, 'hall')
    wait_rows(p1, 2)
    wait_rows(p2, 2)

    mix_id = '+'.join(sorted([DEFAULT, PICK]))
    p1.click('#hallSinger')
    assert p1.is_visible('#picker')
    p1.click('#pkList .sg[data-gid="%s"]' % PICK)
    p1.click('#pkCounts button[data-n="5"]')
    p1.click('#pkGo')
    assert p1.is_hidden('#picker')
    assert p1.text_content('#hallSN') == 'Хурд +1'
    assert '2 дуучин' in p1.text_content('#hallSS') and '5 мөр' in p1.text_content('#hallSS')
    p2.wait_for_function("document.getElementById('hallSN').textContent === 'Хурд +1'", timeout=5000)
    assert '2 дуучин' in p2.text_content('#hallSS') and '5 мөр' in p2.text_content('#hallSS')

    ready_both(p1, p2)
    p1.click('#startBtn')
    for pg in (p1, p2):
        pg.wait_for_function("UBM.state().screen === 'round' && !!UBM.current()", timeout=5000)
        s = st(pg)
        assert s['groupId'] == mix_id and s['total'] == 5, s
        assert pg.text_content('#qn') == '1/5'

    p1_ids = []
    for _ in range(5):
        p1_ids.append(p1.evaluate('UBM.current().id'))
        answer_line(p1)
    p2_ids = []
    for _ in range(5):
        p2_ids.append(p2.evaluate('UBM.current().id'))
        answer_line(p2)
    assert len(p1_ids) == 5 and p1_ids == p2_ids, (p1_ids, p2_ids)
    for pg in (p1, p2):
        wait_screen(pg, 'results')
        pg.wait_for_selector('#resAgain:not([hidden])', timeout=5000)
        assert pg.text_content('#resSinger') == 'Хурд +1'
        assert pg.text_content('#resList .rr[data-pid="u1"] .sc small') == '5/5'
        assert pg.text_content('#resList .rr[data-pid="u2"] .sc small') == '5/5'
    p1.wait_for_function('__stub.calls.submit.length === 1', timeout=5000)
    sub = p1.evaluate('__stub.calls.submit[0]')
    assert sub['meta']['singer'] == mix_id and sub['meta']['n'] == 5, sub
    assert not (e1 or e2), (e1, e2)
    ctx.close()


httpd = serve()
BASE = 'http://127.0.0.1:%d' % httpd.server_address[1]
with sync_playwright() as p:
    browser = p.chromium.launch()
    main_match(browser)
    rematch(browser)
    promoted(browser)
    mix_match(browser)
    browser.close()
httpd.shutdown()
print('UBM MP SMOKE OK', OUT)
