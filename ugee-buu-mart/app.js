(function (root) {
  'use strict';

  var TXT = {
    mn: {
      lives: 'Амь', score: 'Оноо', lines: 'мөр', pick: 'Дуучнаа сонго', search: 'Хайх', packs: 'Багц',
      singers: 'Дуучид', none: 'Олдсонгүй', close: 'Хаах', again: 'Дахин', friends: 'Найзууд',
      global: 'Дэлхий', next: 'Дараагийн дуучин', perfect: 'Төгс!', done: 'Дууслаа', out: 'Амь дууслаа',
      saving: 'Хадгалж байна…', saved: 'Хадгалагдлаа', failed: 'Хадгалагдаагүй', guest: 'Нэвтэрч байж хадгална',
      retry: 'Дахин илгээх', loading: 'Ачаалж байна…', empty: 'Одоохондоо хоосон', error: 'Ачаалж чадсангүй',
      me: 'Би'
    },
    en: {
      lives: 'Lives', score: 'Score', lines: 'lines', pick: 'Pick a singer', search: 'Search', packs: 'Packs',
      singers: 'Singers', none: 'No match', close: 'Close', again: 'Again', friends: 'Friends',
      global: 'Global', next: 'Next singer', perfect: 'Perfect!', done: 'Finished', out: 'Out of lives',
      saving: 'Saving…', saved: 'Saved', failed: 'Not saved', guest: 'Sign in to save',
      retry: 'Retry', loading: 'Loading…', empty: 'No records yet', error: 'Could not load',
      me: 'Me'
    }
  };
  var KEY_LAST = 'ubm:last';
  var KEY_PEND = 'ubm:pend';
  var NEXT_MS = 900;
  var AV = [
    ['#ff7eb3', '#d6246e'], ['#ffad5c', '#e2540f'], ['#ffd86b', '#e08a00'], ['#5fd4f4', '#1767c9'],
    ['#8f95ff', '#4a35d6'], ['#c79bff', '#8226c9'], ['#63e6a8', '#0e8f68'], ['#ff8a80', '#c8283c'],
    ['#7ab8ff', '#2556d8'], ['#f59bd6', '#9b2fc0'], ['#4fe0d0', '#0b8a8e'], ['#ffb39a', '#ef3d5e']
  ];
  var LOST_MS = 1600;
  var FAST_MS = 1200;

  var C = root.UBMCore;
  var GROUPS = root.LYRICS && Array.isArray(root.LYRICS.groups) ? root.LYRICS.groups : [];
  var SORTED = GROUPS.slice().sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
  var BY_ID = {};
  GROUPS.forEach(function (g) { BY_ID[g.id] = g; });

  var doc = root.document;
  var lang = 'mn';
  var t = TXT.mn;
  var userId = null;
  var hostReady = false;
  var started = false;
  var scr = 'round';
  var R = null;
  var soloSeq = 0;
  var seenP = {};
  var pickerOpen = false;
  var pickCb = null;
  var endRes = null;
  var current = null;
  var pickerCur = null;
  var tab = 'friends';
  var boardSeq = 0;
  var flushing = false;
  var countSeq = 0;
  var reduce = false;
  var bootCfg = null;
  var waiting = false;

  function $(id) { return doc.getElementById(id); }
  function noop() {}
  function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
  function el(tag, cls, txt) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function clock() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }
  function replay(e, cls) {
    e.classList.remove(cls);
    void e.offsetWidth;
    e.classList.add(cls);
  }
  function call(f) {
    if (typeof f !== 'function') return;
    try { f.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { root.setTimeout(function () { throw e; }); }
  }

  function usion() { return root.Usion; }
  function attempt(f) {
    try { return Promise.resolve(f()); } catch (e) { return Promise.reject(e); }
  }
  function timed(p, ms) {
    return new Promise(function (ok, no) {
      var id = setTimeout(function () { no({ code: 'TIMEOUT' }); }, ms);
      p.then(function (v) { clearTimeout(id); ok(v); }, function (e) { clearTimeout(id); no(e); });
    });
  }
  function lbApi(m) {
    var u = usion();
    var l = hostReady && u && u.leaderboard;
    return l && typeof l[m] === 'function' ? l : null;
  }
  function remote() {
    var u = usion();
    var st = hostReady && u && u.storage;
    return st && typeof st.get === 'function' && typeof st.set === 'function' ? st : null;
  }
  function lsKey(k) { return 'ubm:' + (userId || 'anon') + ':' + k; }
  function lsGet(k) {
    try { var v = root.localStorage.getItem(lsKey(k)); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try {
      if (v == null) root.localStorage.removeItem(lsKey(k));
      else root.localStorage.setItem(lsKey(k), JSON.stringify(v));
    } catch (e) {}
  }
  function rGet(k, ms) {
    return timed(attempt(function () { return Usion.storage.get(k); }), ms || 4000);
  }
  function rSet(k, v) {
    var st = remote();
    if (!st) return;
    attempt(function () {
      return v == null ? (typeof st.remove === 'function' ? Usion.storage.remove(k) : Usion.storage.set(k, null)) : Usion.storage.set(k, v);
    }).catch(noop);
  }
  function sGet(k, ms) {
    var local = lsGet(k);
    if (!remote()) return Promise.resolve(local);
    return rGet(k, ms).then(function (v) { return v == null ? local : v; }, function () { return local; });
  }
  function sSet(k, v) {
    lsSet(k, v);
    rSet(k, v);
    return Promise.resolve();
  }

  function seenKey(gid) { return 'ubm:seen:' + gid; }
  function ids(v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []; }
  function mergeIds(a, b) {
    var out = ids(a);
    ids(b).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  function loadSeen(gid) {
    if (!seenP[gid]) {
      var k = seenKey(gid);
      var local = lsGet(k);
      seenP[gid] = !remote() ? Promise.resolve({ ids: ids(local), synced: false }) : rGet(k, FAST_MS).then(function (v) {
        return { ids: mergeIds(v, local), synced: true };
      }, function () {
        return { ids: ids(local), synced: false };
      });
    }
    return seenP[gid];
  }
  function markSeen(gid, id) {
    var k = seenKey(gid);
    seenP[gid] = loadSeen(gid).then(function (s) {
      var at = s.ids.indexOf(id);
      if (at >= 0) s.ids.splice(at, 1);
      s.ids.push(id);
      lsSet(k, s.ids);
      if (s.synced) rSet(k, s.ids.slice());
      return s;
    });
  }
  function excerpts(g) {
    return g.songs.reduce(function (n, s) { return n + s.x.length; }, 0);
  }
  function autoGroup() {
    var list = SORTED.filter(function (g) { return !g.pack; });
    if (list.length) loadSeen(list[0].id);
    return sGet(KEY_LAST, FAST_MS).then(function (gid) {
      if (typeof gid === 'string' && BY_ID[gid]) return BY_ID[gid];
      var i = 0;
      function next() {
        if (i >= list.length) return list[0] || SORTED[0];
        var g = list[i++];
        return loadSeen(g.id).then(function (s) { return excerpts(g) - s.ids.length >= C.ROUND ? g : next(); });
      }
      return next();
    });
  }

  function initials(name) {
    var w = String(name || '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!w.length) return '♪';
    return (Array.from(w[0])[0] + (w.length > 1 ? Array.from(w[1])[0] : '')).toUpperCase();
  }
  function paintAv(e, g) {
    if (!g) { e.textContent = ''; return; }
    var c = AV[C.seedOf(g.id) % AV.length];
    e.textContent = initials(g.name);
    e.style.background = 'linear-gradient(145deg,' + c[0] + ',' + c[1] + ')';
    e.classList.toggle('pack', !!g.pack);
  }
  function paintHearts(box, lives) {
    var hs = box.children;
    for (var k = 0; k < hs.length; k++) hs[k].classList.toggle('off', k >= lives);
    box.setAttribute('aria-label', t.lives + ': ' + lives);
  }

  function screen(name) {
    scr = name;
    var els = doc.querySelectorAll('[data-screen]');
    for (var i = 0; i < els.length; i++) els[i].hidden = els[i].getAttribute('data-screen') !== name;
    if (name !== 'round') {
      soloSeq++;
      if (R && !R.over) {
        R.over = true;
        clearTimeout(R.timer);
      }
    }
    closePicker();
    return scr;
  }

  function syncClock() {
    if (!R || R.over) return;
    var stop = (doc.hidden && R.mode !== 'race') || pickerOpen;
    if (stop && !R.pausedAt) R.pausedAt = clock();
    else if (!stop && R.pausedAt) {
      R.t0 += clock() - R.pausedAt;
      R.pausedAt = 0;
    }
  }
  function elapsed() { return Math.max(0, Math.round((R.pausedAt || clock()) - R.t0)); }

  function solo() {
    var seq = ++soloSeq;
    return autoGroup().then(function (g) { if (seq === soloSeq && g) playSolo(g); });
  }
  function playSolo(g) {
    var seq = ++soloSeq;
    return loadSeen(g.id).then(function (s) {
      if (seq !== soloSeq) return;
      var rnd = C.rng((Math.random() * 4294967296) >>> 0);
      var qs = C.round(g, C.pickRefs(g, s.ids, C.ROUND, rnd), rnd);
      if (qs.length) startRound({ group: g, qs: qs, mode: 'solo' });
    });
  }
  function startRound(o) {
    o = o || {};
    var g = typeof o.group === 'string' ? BY_ID[o.group] : o.group;
    if (!g) return;
    var race = o.mode === 'race';
    if (!Array.isArray(o.qs) || !o.qs.length) {
      if (!race) playSolo(g);
      return;
    }
    var from = Math.max(0, Math.min(o.qs.length, o.from | 0));
    soloSeq++;
    if (R) {
      R.over = true;
      clearTimeout(R.timer);
    }
    R = {
      g: g, qs: o.qs, mode: race ? 'race' : 'solo', onLine: o.onLine, onEnd: o.onEnd,
      i: from - 1, lives: o.lives > 0 ? Math.min(C.LIVES, o.lives | 0) : C.LIVES,
      score: Math.max(0, o.score | 0), lines: Math.max(0, o.lines | 0), filled: 0, used: [], lock: false, over: false,
      t0: 0, pausedAt: 0, timer: 0
    };
    screen('round');
    nextQ();
  }
  function nextQ() {
    R.i++;
    if (R.i >= R.qs.length) { finish(); return; }
    R.filled = 0;
    R.used = [];
    R.lock = false;
    R.t0 = clock();
    R.pausedAt = 0;
    syncClock();
    if (R.mode === 'solo') markSeen(R.g.id, R.qs[R.i].id);
    renderQ();
    renderHud();
  }
  function renderHud() {
    var g = R && R.g;
    setText($('chipName'), g ? g.name : '');
    paintAv($('chipAv'), g);
    $('chip').disabled = !!(R && R.mode === 'race');
    $('chip').style.visibility = g ? '' : 'hidden';
    $('chip').setAttribute('aria-label', (g ? g.name + ', ' : '') + t.pick);
    setText($('qn'), R ? Math.min(R.i + 1, R.qs.length) + '/' + R.qs.length : '');
    paintHearts($('hearts'), R ? R.lives : C.LIVES);
    setText($('score'), String(R ? R.score : 0));
    $('score').setAttribute('aria-label', t.score + ': ' + (R ? R.score : 0));
  }
  function renderQ() {
    var Q = R.qs[R.i];
    var line = $('line');
    var tray = $('tray');
    setText($('songT'), Q.song);
    setText($('prev'), Q.prev);
    line.textContent = '';
    line.className = '';
    Q.shown.forEach(function (w) {
      line.appendChild(el('span', 'w', w));
      line.appendChild(doc.createTextNode(' '));
    });
    Q.answer.forEach(function (w, k) {
      line.appendChild(el('span', 'slot' + (k === 0 ? ' cur' : ''), ' '));
      if (k < Q.answer.length - 1) line.appendChild(doc.createTextNode(' '));
    });
    tray.textContent = '';
    Q.tiles.forEach(function (w, k) {
      var b = el('button', 'tile', w);
      b.type = 'button';
      b.setAttribute('data-i', String(k));
      b.style.animationDelay = k * 35 + 'ms';
      b.addEventListener('click', function () { tap(k, b); });
      tray.appendChild(b);
    });
    $('pop').classList.remove('go');
    replay($('card'), 'in');
    $('stage').scrollTop = 0;
  }
  function slots() { return $('line').querySelectorAll('.slot'); }
  function tap(k, b) {
    if (!R || R.over || R.lock || R.used[k]) return;
    var Q = R.qs[R.i];
    if (C.tileOk(Q, R.filled, Q.tiles[k])) {
      var ss = slots();
      R.used[k] = true;
      b.classList.add('used');
      b.disabled = true;
      ss[R.filled].textContent = Q.answer[R.filled];
      ss[R.filled].className = 'slot on';
      R.filled++;
      if (R.filled < ss.length) ss[R.filled].className = 'slot cur';
      else lineDone();
      return;
    }
    if (b.classList.contains('bad')) return;
    R.lives = Math.max(0, R.lives - 1);
    replay(b, 'bad');
    clearTimeout(b._bad);
    b._bad = setTimeout(function () { b.classList.remove('bad'); }, 600);
    renderHud();
    var h = $('hearts').children[R.lives];
    if (h) {
      replay(h, 'lose');
      setTimeout(function () { h.classList.remove('lose'); }, 700);
    }
    if (R.lives <= 0) lineLost();
  }
  function lineDone() {
    var ms = elapsed();
    var pts = C.lineScore(ms);
    var r = R;
    r.lock = true;
    r.score += pts;
    r.lines++;
    $('line').className = 'win';
    $('pop').textContent = '+' + pts;
    replay($('pop'), 'go');
    renderHud();
    replay($('score'), 'bump');
    call(r.onLine, r.i, true, ms, r.lives);
    r.timer = setTimeout(function () { if (R === r && !r.over) nextQ(); }, NEXT_MS);
  }
  function lineLost() {
    var ms = elapsed();
    var r = R;
    var Q = r.qs[r.i];
    var ss = slots();
    r.lock = true;
    for (var k = r.filled; k < ss.length; k++) {
      ss[k].textContent = Q.answer[k];
      ss[k].className = 'slot miss';
    }
    call(r.onLine, r.i, false, ms, r.lives);
    r.timer = setTimeout(function () { if (R === r && !r.over) finish(); }, LOST_MS);
  }
  function finish() {
    var r = R;
    r.over = true;
    clearTimeout(r.timer);
    var res = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      uid: userId, mode: r.mode, gid: r.g.id, score: r.score, lives: r.lives, lines: r.lines,
      answered: Math.min(r.i + 1, r.qs.length), total: r.qs.length
    };
    if (typeof r.onEnd === 'function') call(r.onEnd, res);
    else showEnd(res);
  }

  function showEnd(res) {
    if (!res) return;
    endRes = res;
    screen('end');
    $('end').scrollTop = 0;
    $('endQ').value = '';
    renderEnd();
    countUp($('endScore'), res.score || 0);
    renderGrid($('endPk'), '', pickSolo);
    if (current !== res) {
      current = res;
      renderSave();
      submitScore(res, function () { if (res === current) renderSave(); });
    }
    loadBoard();
  }
  function renderEnd() {
    var r = endRes;
    if (!r) return;
    var g = BY_ID[r.gid];
    var out = r.lives <= 0;
    setText($('endHead'), out ? t.out : r.lines >= r.total && r.lives >= C.LIVES ? t.perfect : t.done);
    $('endHead').className = out ? 'out' : '';
    setText($('endName'), g ? g.name : '');
    paintAv($('endAv'), g);
    paintHearts($('endHearts'), r.lives);
    setText($('endLines'), r.lines + '/' + r.total + ' ' + t.lines);
    renderSave();
  }
  function saveText(st, a) {
    var txt = { saving: t.saving, saved: t.saved, failed: t.failed, guest: t.guest }[st] || '';
    return st === 'saved' && a && a.rank ? txt + ' · #' + a.rank : txt;
  }
  function renderSave() {
    var st = (current && current.saveState) || '';
    setText($('saveText'), saveText(st, current && current.saveInfo));
    $('saveRow').className = 'save ' + st;
    $('retry').hidden = !(st === 'failed' || st === 'guest');
  }
  function countUp(e, to) {
    var seq = ++countSeq;
    if (reduce || to <= 0) { setText(e, String(to)); return; }
    var t0 = clock();
    setText(e, '0');
    (function step() {
      if (seq !== countSeq) return;
      var k = Math.min(1, (clock() - t0) / 800);
      setText(e, String(Math.round(to * (1 - Math.pow(1 - k, 3)))));
      if (k < 1) root.requestAnimationFrame(step);
    })();
  }

  function pendingOf(res) {
    return { id: res.id, uid: res.uid, score: res.score, lines: res.lines, gid: res.gid };
  }
  function writePending(res) {
    return sGet(KEY_PEND).then(function (p) {
      if (p && p.uid === res.uid && p.id !== res.id && typeof p.score === 'number' && p.score >= res.score) return;
      return sSet(KEY_PEND, pendingOf(res));
    });
  }
  function clearPendingAfter(res) {
    return sGet(KEY_PEND).then(function (p) {
      if (!p) return;
      if (p.id === res.id || !(p.score > res.score)) return sSet(KEY_PEND, null);
      flushPending();
    });
  }
  function submit(res) {
    if (!lbApi('submit')) return Promise.reject({ code: 'UNAVAILABLE' });
    return timed(attempt(function () {
      return Usion.leaderboard.submit(res.score, { lines: res.lines, singer: res.gid });
    }), 15000).then(function (a) {
      return a && a.success === true ? a : Promise.reject({ code: 'NOT_ACKED' });
    });
  }
  function saveNote(res, s, a) {
    res.saveState = s;
    if (a) res.saveInfo = a;
    call(res.onSave, s, res.saveInfo || null);
  }
  function submitScore(res, onSave) {
    if (!res || !(res.score > 0)) return;
    if (typeof onSave === 'function') res.onSave = onSave;
    if (res.saved || res.busy) { call(res.onSave, res.saveState, res.saveInfo || null); return; }
    if (!res.pend) {
      saveNote(res, lbApi('submit') ? 'saving' : 'failed');
      res.pend = writePending(res);
    }
    res.pend.then(function () { saveRun(res); });
  }
  function saveRun(res) {
    if (!res || res.saved || res.busy) return;
    if (!lbApi('submit')) { saveNote(res, 'failed'); return; }
    res.busy = true;
    saveNote(res, 'saving');
    submit(res).then(function (a) {
      res.busy = false;
      res.saved = true;
      saveNote(res, 'saved', a);
      clearPendingAfter(res);
      if (res === current && scr === 'end') loadBoard();
    }, function (e) {
      res.busy = false;
      saveNote(res, e && e.code === 'AUTH_REQUIRED' ? 'guest' : 'failed');
    });
  }
  function flushPending() {
    if (flushing || !userId || /^guest_/.test(userId) || !lbApi('submit')) return;
    flushing = true;
    var done = function () { flushing = false; };
    sGet(KEY_PEND).then(function (p) {
      if (!p || p.uid !== userId || typeof p.score !== 'number' || (current && p.id === current.id)) return;
      return submit(p).then(function () { return clearPendingAfter(p); });
    }).then(done, done);
  }

  function msgEl(s, retry) {
    var m = el('div', 'msg');
    m.appendChild(el('span', '', s));
    if (retry) {
      var b = el('button', 'btn2', t.retry);
      b.type = 'button';
      b.addEventListener('click', loadBoard);
      m.appendChild(b);
    }
    return m;
  }
  function boardMsg(s, retry) {
    var box = $('lb');
    box.textContent = '';
    box.appendChild(msgEl(s, retry));
  }
  function openProfile(id) {
    var u = usion();
    try { if (id && u && u.user && typeof u.user.openProfile === 'function') Usion.user.openProfile(id); } catch (e) {}
  }
  function boardRow(o) {
    var row = el(o.me ? 'div' : 'button', 'row' + (o.me ? ' me' : ''));
    var name = o.name || '—';
    var av;
    if (typeof o.avatar === 'string' && /^https?:/.test(o.avatar)) {
      av = el('img', 'av');
      av.src = o.avatar;
      av.alt = '';
      av.draggable = false;
      av.onerror = function () { av.style.visibility = 'hidden'; };
    } else {
      av = el('span', 'av', name.charAt(0).toUpperCase());
      av.setAttribute('aria-hidden', 'true');
    }
    row.appendChild(el('span', 'rk', String(o.rank)));
    row.appendChild(av);
    row.appendChild(el('span', 'nm', o.me && !o.name ? t.me : name));
    row.appendChild(el('span', 'sc', String(o.score)));
    if (!o.me) {
      row.type = 'button';
      row.setAttribute('aria-label', o.rank + '. ' + name + ', ' + o.score);
      row.addEventListener('click', function () { openProfile(o.id); });
    }
    return row;
  }
  function loadBoard() {
    var seq = ++boardSeq;
    var which = tab;
    var box = $('lb');
    $('tabF').setAttribute('aria-selected', String(which === 'friends'));
    $('tabG').setAttribute('aria-selected', String(which === 'global'));
    var l = lbApi(which === 'friends' ? 'friends' : 'top');
    if (!l) { boardMsg(t.error, true); return; }
    boardMsg(t.loading);
    timed(attempt(function () {
      return which === 'friends' ? Usion.leaderboard.friends({ limit: 20 }) : Usion.leaderboard.top({ limit: 10 });
    }), 10000).then(function (rows) {
      if (seq !== boardSeq) return;
      rows = Array.isArray(rows) ? rows : [];
      if (!rows.length) { boardMsg(t.empty); return; }
      box.textContent = '';
      rows.forEach(function (e, i) {
        e = e || {};
        box.appendChild(boardRow({ me: !!e.is_me, id: e.user_id, name: e.name, avatar: e.avatar, rank: e.rank || i + 1, score: e.score }));
      });
    }, function () {
      if (seq === boardSeq) boardMsg(t.error, true);
    });
  }
  function showTab(w) {
    if (tab === w) return;
    tab = w;
    loadBoard();
  }

  function renderGrid(box, q, onPick, curId) {
    var query = String(q || '').trim().toLowerCase();
    var cur = curId !== undefined ? curId : R && R.g ? R.g.id : '';
    var any = false;
    box.textContent = '';
    [[t.packs, true], [t.singers, false]].forEach(function (sec) {
      var list = SORTED.filter(function (g) {
        return !!g.pack === sec[1] && (!query || String(g.name).toLowerCase().indexOf(query) >= 0);
      });
      if (!list.length) return;
      any = true;
      var grid = el('div', 'grid');
      box.appendChild(el('h4', '', sec[0]));
      list.forEach(function (g) {
        var b = el('button', 'sg' + (g.id === cur ? ' cur' : ''));
        var av = el('span', 'av');
        b.type = 'button';
        b.setAttribute('data-gid', g.id);
        av.setAttribute('aria-hidden', 'true');
        paintAv(av, g);
        b.appendChild(av);
        b.appendChild(el('span', 'nm' + (/[^\s.,()]{11,}/.test(g.name) ? ' sm' : ''), g.name));
        b.addEventListener('click', function () { onPick(g); });
        grid.appendChild(b);
      });
      box.appendChild(grid);
    });
    if (!any) box.appendChild(el('p', 'none', t.none));
  }
  function pickSolo(g) {
    sSet(KEY_LAST, g.id);
    playSolo(g);
  }
  function openPicker(onPick, curId) {
    pickCb = typeof onPick === 'function' ? onPick : pickSolo;
    pickerCur = curId !== undefined ? curId : undefined;
    pickerOpen = true;
    $('pkQ').value = '';
    renderGrid($('pkList'), '', pickFromSheet, pickerCur);
    $('pkList').scrollTop = 0;
    $('picker').hidden = false;
    syncClock();
  }
  function closePicker() {
    if (!pickerOpen) return;
    pickerOpen = false;
    $('picker').hidden = true;
    syncClock();
  }
  function pickFromSheet(g) {
    var cb = pickCb;
    closePicker();
    call(cb, g);
  }

  function applyHost() {
    var u = usion();
    var lg = '';
    if (hostReady && u) {
      try { lg = String((typeof u.getLanguage === 'function' && Usion.getLanguage()) || ''); } catch (e) {}
    }
    lang = /^en/i.test(lg) ? 'en' : 'mn';
    t = TXT[lang];
    doc.documentElement.lang = lang;
    var i;
    var els = doc.querySelectorAll('[data-t]');
    for (i = 0; i < els.length; i++) els[i].textContent = t[els[i].getAttribute('data-t')];
    els = doc.querySelectorAll('[data-tp]');
    for (i = 0; i < els.length; i++) els[i].setAttribute('placeholder', t[els[i].getAttribute('data-tp')]);
    els = doc.querySelectorAll('[data-ta]');
    for (i = 0; i < els.length; i++) els[i].setAttribute('aria-label', t[els[i].getAttribute('data-ta')]);
    if (R) renderHud();
    if (pickerOpen) renderGrid($('pkList'), $('pkQ').value, pickFromSheet, pickerCur);
    if (scr === 'end' && endRes) {
      renderEnd();
      renderGrid($('endPk'), $('endQ').value, pickSolo);
      loadBoard();
    }
  }

  function bind() {
    try { reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    $('chip').addEventListener('click', function () { if (R && R.mode !== 'race') openPicker(); });
    $('pkX').addEventListener('click', closePicker);
    $('picker').addEventListener('click', function (e) { if (e.target === $('picker')) closePicker(); });
    $('pkQ').addEventListener('input', function () { renderGrid($('pkList'), $('pkQ').value, pickFromSheet, pickerCur); });
    $('endQ').addEventListener('input', function () { renderGrid($('endPk'), $('endQ').value, pickSolo); });
    $('again').addEventListener('click', function () { if (endRes && BY_ID[endRes.gid]) playSolo(BY_ID[endRes.gid]); });
    $('retry').addEventListener('click', function () { submitScore(current); });
    $('tabF').addEventListener('click', function () { showTab('friends'); });
    $('tabG').addEventListener('click', function () { showTab('global'); });
    doc.addEventListener('visibilitychange', syncClock);
    doc.addEventListener('touchstart', noop, { passive: true });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePicker(); });
    doc.addEventListener('contextmenu', function (e) { if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });
  }

  function start(cfg) {
    if (started) return;
    started = true;
    bind();
    applyHost();
    renderHud();
    if (C && GROUPS.length) {
      if (typeof UBM.boot !== 'function') solo();
      else {
        try { UBM.boot(cfg || {}); } catch (e) {
          solo();
          root.setTimeout(function () { throw e; });
        }
      }
    }
    flushPending();
  }
  function launch(cfg) {
    if (cfg && typeof cfg === 'object') bootCfg = cfg;
    if (doc.readyState !== 'loading') { start(bootCfg); return; }
    if (waiting) return;
    waiting = true;
    doc.addEventListener('DOMContentLoaded', function () { start(bootCfg); });
  }
  function onInit(cfg) {
    var u = usion();
    hostReady = true;
    try { userId = (u && u.user && typeof u.user.getId === 'function' && Usion.user.getId()) || (cfg && cfg.userId) || null; } catch (e) { userId = null; }
    if (!started) { launch(cfg); return; }
    seenP = {};
    if (current && !current.saved && current.uid !== userId) {
      current = null;
      renderSave();
    }
    applyHost();
    flushPending();
    if (typeof UBM.onInit === 'function') call(UBM.onInit, cfg || {});
  }
  function boot() {
    var u = usion();
    if (!u || typeof u.init !== 'function') { launch(); return; }
    var fallback = setTimeout(launch, 2500);
    try {
      var p = Usion.init(function (cfg) { clearTimeout(fallback); onInit(cfg); });
      if (p && typeof p.catch === 'function') p.catch(noop);
    } catch (e) {
      clearTimeout(fallback);
      launch();
    }
  }

  var UBM = root.UBM = {
    boot: null,
    onInit: null,
    solo: solo,
    submitScore: submitScore,
    saveText: function (st, a) { return saveText(st, a); },
    userId: function () { return userId; },
    lang: function () { return lang; },
    addStrings: function (o) {
      Object.keys(TXT).forEach(function (l) {
        var add = o && (o[l] || o.mn);
        if (add) Object.keys(add).forEach(function (k) { TXT[l][k] = add[k]; });
      });
    },
    avatar: function (e, g) { paintAv(e, g); },
    openProfile: openProfile,
    startRound: startRound,
    showEnd: showEnd,
    openPicker: openPicker,
    closePicker: closePicker,
    t: function (k) { return t[k] != null ? t[k] : TXT.mn[k] != null ? TXT.mn[k] : k; },
    groupById: function (id) { return BY_ID[id] || null; },
    groups: function () { return SORTED.slice(); },
    screen: screen,
    state: function () {
      return { screen: scr, groupId: R ? R.g.id : null, q: R ? R.i : -1, lives: R ? R.lives : C.LIVES, score: R ? R.score : 0 };
    },
    current: function () { return R && R.i >= 0 && R.i < R.qs.length ? R.qs[R.i] : null; }
  };

  boot();
})(this);
