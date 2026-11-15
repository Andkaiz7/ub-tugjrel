(function (root) {
  'use strict';

  var TXT = {
    mn: {
      road: 'Зам', bridge: 'Гүүр', erase: 'Арилгах', left: 'үлдсэн',
      restart: 'Дахин эхлүүлэх', confirm: 'Дахин дарвал шинээр эхэлнэ',
      jam: 'Түгжрэл! +10с', best: 'Шилдэг', record: 'Шинэ рекорд!',
      saving: 'Хадгалж байна…', saved: 'Хадгалагдлаа', failed: 'Хадгалагдсангүй',
      guest: 'Нэвтэрч хадгална уу', retry: 'Дахин оролдох',
      friends: 'Найзууд', global: 'Нийт', loading: 'Ачаалж байна…',
      empty: 'Рекорд алга байна', error: 'Рекорд ачаалсангүй',
      again: 'Дахин тоглох', district: 'Дүүрэг', progress: 'Хүргэлт'
    },
    en: {
      road: 'Road', bridge: 'Bridge', erase: 'Erase', left: 'left',
      restart: 'Restart run', confirm: 'Tap again to restart',
      jam: 'Jam! +10s', best: 'Best', record: 'New record!',
      saving: 'Saving…', saved: 'Saved', failed: 'Not saved',
      guest: 'Sign in to save', retry: 'Retry',
      friends: 'Friends', global: 'Global', loading: 'Loading…',
      empty: 'No records yet', error: 'Could not load records',
      again: 'Play again', district: 'District', progress: 'Delivered'
    }
  };
  var TOOLS = ['road', 'bridge', 'erase'];
  var TRANSITION_MS = 2000;
  var ARM_MS = 2000;

  var doc = root.document;
  var L, S, r, cv;
  var lang = 'mn';
  var t = TXT.mn;
  var userId = null;
  var hostReady = false;
  var started = false;
  var li = 0;
  var world = null;
  var splits = [];
  var phase = 'play';
  var clockOn = false;
  var acc = 0;
  var lastNow = 0;
  var skipDt = true;
  var trans = 0;
  var tool = 'road';
  var drag = null;
  var preview = null;
  var waterGlow = 0;
  var armTimer = 0;
  var current = null;
  var saving = null;
  var saveState = '';
  var saveInfo = null;
  var newRecord = false;
  var bestMs = 0;
  var tab = 'friends';
  var boardSeq = 0;
  var flushing = false;
  var ac = null;
  var pills = [];

  function $(id) { return doc.getElementById(id); }
  function noop() {}
  function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(ms) {
    var ds = Math.floor(Math.max(0, ms) / 100);
    return Math.floor(ds / 600) + ':' + pad(Math.floor(ds / 10) % 60) + '.' + (ds % 10);
  }
  function fmtSec(sec) {
    var s = Math.max(0, Math.round(Number(sec) || 0));
    return Math.floor(s / 60) + ':' + pad(s % 60);
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

  function lsKey(k) { return 'ubt:' + (userId || 'anon') + ':' + k; }
  function lsGet(k) {
    try { var v = root.localStorage.getItem(lsKey(k)); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try {
      if (v == null) root.localStorage.removeItem(lsKey(k));
      else root.localStorage.setItem(lsKey(k), JSON.stringify(v));
    } catch (e) {}
  }
  function sGet(k) {
    var local = lsGet(k);
    var st = remote();
    if (!st) return Promise.resolve(local);
    return timed(attempt(function () { return Usion.storage.get(k); }), 4000).then(function (v) {
      return v == null ? local : v;
    }, function () { return local; });
  }
  function sSet(k, v) {
    lsSet(k, v);
    var st = remote();
    if (st) {
      attempt(function () {
        return v == null ? (typeof st.remove === 'function' ? Usion.storage.remove(k) : Usion.storage.set(k, null)) : Usion.storage.set(k, v);
      }).catch(noop);
    }
    return Promise.resolve();
  }

  function applyHost() {
    var u = usion();
    var lg = '';
    var th = '';
    if (hostReady && u) {
      try { lg = String((typeof u.getLanguage === 'function' && Usion.getLanguage()) || ''); } catch (e) {}
      try { th = typeof u.getTheme === 'function' ? Usion.getTheme() : ''; } catch (e) {}
    }
    if (th !== 'dark' && th !== 'light') {
      try { th = root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { th = 'light'; }
    }
    lang = /^en/i.test(lg) ? 'en' : 'mn';
    t = TXT[lang];
    doc.documentElement.lang = lang;
    doc.documentElement.classList.toggle('dark', th === 'dark');
    $('restart').setAttribute('aria-label', armTimer ? t.confirm : t.restart);
    $('tabF').textContent = t.friends;
    $('tabG').textContent = t.global;
    $('again').textContent = t.again;
    $('retry').textContent = t.retry;
    $('pills').setAttribute('aria-label', t.progress);
    if (world) { buildHud(); refreshTools(); }
    if (phase === 'end') renderEnd();
  }

  function buildHud() {
    var box = $('pills');
    var n = world.quota.length;
    box.textContent = '';
    pills = [];
    for (var c = 0; c < n; c++) {
      var p = doc.createElement('span');
      p.className = 'pill';
      p.style.background = L.COLORS[c];
      box.appendChild(p);
      pills.push(p);
    }
    markDots(li);
  }
  function markDots(k) {
    var box = $('dots');
    var n = L.LEVELS.length;
    if (box.children.length !== n) {
      box.textContent = '';
      for (var i = 0; i < n; i++) box.appendChild(doc.createElement('i'));
    }
    for (var j = 0; j < n; j++) box.children[j].className = j < k ? 'done' : j === k ? 'cur' : '';
    box.setAttribute('aria-label', t.district + ' ' + Math.min(k + 1, n) + '/' + n);
  }
  function updateHud() {
    var ms = phase === 'end' && current ? current.ms : sum(splits) + (phase === 'play' ? (world.time + world.penaltyTime) * 1000 : 0);
    setText($('clock'), fmt(ms));
    if (phase !== 'play') return;
    for (var c = 0; c < pills.length; c++) {
      var q = world.quota[c];
      var d = Math.min(world.delivered[c], q);
      setText(pills[c], d + '/' + q);
      var done = d >= q;
      if (pills[c].classList.contains('done') !== done) pills[c].classList.toggle('done', done);
    }
  }

  function setTool(n) {
    tool = n;
    for (var i = 0; i < TOOLS.length; i++) $('tool-' + TOOLS[i]).setAttribute('aria-pressed', String(TOOLS[i] === n));
  }
  function refreshTools() {
    var u = S.usage(world);
    var b = world.budget;
    var rl = Math.max(0, b.roads - u.roads);
    var bl = Math.max(0, b.bridges - u.bridges);
    var rb = $('tool-road');
    var bb = $('tool-bridge');
    setText(rb.querySelector('.cnt'), String(rl));
    setText(bb.querySelector('.cnt'), '×' + bl);
    rb.classList.toggle('empty', rl === 0);
    bb.classList.toggle('empty', bl === 0);
    rb.setAttribute('aria-label', t.road + ', ' + rl + ' ' + t.left);
    bb.setAttribute('aria-label', t.bridge + ', ' + bl + ' ' + t.left);
    $('tool-erase').setAttribute('aria-label', t.erase);
  }
  function flash(el, c) {
    el.classList.remove(c);
    void el.offsetWidth;
    el.classList.add(c);
  }
  function bump(stop) {
    if (stop === 'water') { waterGlow = 1; flash($('tool-bridge'), 'pulse'); }
    if (stop === 'budget') flash($('tool-' + tool), 'pulse');
    flash(cv, 'shake');
  }
  function toast(s) {
    var box = $('toasts');
    var el = doc.createElement('div');
    el.className = 'toast';
    el.textContent = s;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1600);
  }

  function audio() {
    if (!ac) {
      var C = root.AudioContext || root.webkitAudioContext;
      if (!C) return;
      try { ac = new C(); } catch (e) { return; }
    }
    if (ac.state === 'suspended') {
      try { var p = ac.resume(); if (p && p.catch) p.catch(noop); } catch (e) {}
    }
  }
  function tone(type, f1, f2, at, dur, vol) {
    if (!ac || ac.state !== 'running') return;
    try {
      var t0 = ac.currentTime + at;
      var o = ac.createOscillator();
      var g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    } catch (e) {}
  }
  function ding() { tone('sine', 1046, 0, 0, 0.12, 0.12); tone('sine', 1568, 0, 0.06, 0.2, 0.08); }
  function honk() { tone('square', 370, 340, 0, 0.24, 0.05); tone('square', 466, 430, 0, 0.24, 0.04); }

  function newWorld(i) {
    li = i;
    world = S.createWorld(L.LEVELS[i]);
    acc = 0;
    drag = null;
    preview = null;
    waterGlow = 0;
    r.fit(world);
    buildHud();
    refreshTools();
  }
  function restartRun() {
    disarm();
    splits = [];
    clockOn = false;
    phase = 'play';
    trans = 0;
    $('end').hidden = true;
    setTool('road');
    newWorld(0);
  }
  function onRestart() {
    if (armTimer) { restartRun(); return; }
    var b = $('restart');
    b.classList.add('armed');
    b.setAttribute('aria-label', t.confirm);
    armTimer = setTimeout(disarm, ARM_MS);
  }
  function disarm() {
    clearTimeout(armTimer);
    armTimer = 0;
    var b = $('restart');
    b.classList.remove('armed');
    b.setAttribute('aria-label', t.restart);
  }

  function drain() {
    var evs = world.events.splice(0, world.events.length);
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.type === 'deliver') { r.effect('deliver', e.tile, e.color); ding(); }
      else if (e.type === 'penalty') { r.effect('penalty', e.tile); honk(); toast(t.jam); }
      else if (e.type === 'cleared' && phase === 'play') districtCleared();
    }
  }
  function districtCleared() {
    splits.push(Math.round((world.time + world.penaltyTime) * 1000));
    drag = null;
    preview = null;
    if (li >= L.LEVELS.length - 1) finishRun();
    else { phase = 'transition'; trans = 0; }
  }
  function frame(now) {
    root.requestAnimationFrame(frame);
    var hidden = doc.hidden;
    var dt = skipDt || hidden ? 0 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    skipDt = hidden;
    if (hidden) return;
    if (phase === 'play') {
      if (clockOn) {
        acc += dt;
        while (acc >= S.DT && !world.cleared) { S.step(world, S.DT); acc -= S.DT; }
      }
      drain();
      if (phase === 'play' && world.cleared) districtCleared();
    }
    if (phase === 'transition') {
      trans += dt * 1000;
      if (trans >= TRANSITION_MS) { newWorld(li + 1); phase = 'play'; }
    }
    waterGlow = Math.max(0, waterGlow - dt);
    if (phase === 'transition') r.drawTransition(L.LEVELS, li, li + 1, Math.min(1, trans / TRANSITION_MS));
    else r.draw(world, { preview: preview, waterGlow: waterGlow, lang: lang, now: now });
    updateHud();
  }

  function fill(a, b) {
    var W = S.W;
    var ax = a % W;
    var ay = (a - ax) / W;
    var bx = b % W;
    var by = (b - bx) / W;
    var out = [];
    while (ax !== bx) { ax += ax < bx ? 1 : -1; out.push(ay * W + ax); }
    while (ay !== by) { ay += ay < by ? 1 : -1; out.push(ay * W + ax); }
    return out;
  }
  function eraseTile(tile) {
    S.eraseAt(world, tile);
    refreshTools();
  }
  function onDown(e) {
    if (phase !== 'play' || drag) return;
    clockOn = true;
    var tile = r.tileAt(e.clientX, e.clientY);
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    drag = { id: e.pointerId, last: tile, s: tile, dead: false };
    preview = null;
    if (tile >= 0 && tool === 'erase') eraseTile(tile);
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id || phase !== 'play') return;
    var tile = r.tileAt(e.clientX, e.clientY);
    if (tile < 0 || tile === drag.last) return;
    if (tool === 'bridge') {
      if (drag.s < 0) drag.s = tile;
      drag.last = tile;
      preview = tile === drag.s ? null : { s: drag.s, e: tile, ok: S.bridgeCheck(world, drag.s, tile).ok };
      return;
    }
    var from = drag.last;
    drag.last = tile;
    if (from < 0) { if (tool === 'erase') eraseTile(tile); return; }
    var path = fill(from, tile);
    if (tool === 'erase') { path.forEach(eraseTile); return; }
    if (drag.dead) return;
    var res = S.roadStroke(world, [from].concat(path));
    if (res && res.stop) { drag.dead = true; bump(res.stop); }
    refreshTools();
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (tool === 'bridge' && preview && phase === 'play') {
      var res = S.placeBridge(world, preview.s, preview.e);
      if (!res || !res.ok) bump(res && res.reason);
      refreshTools();
    }
    drag = null;
    preview = null;
  }
  function onCancel(e) {
    if (drag && e.pointerId === drag.id) { drag = null; preview = null; }
  }

  function finishRun() {
    phase = 'end';
    markDots(L.LEVELS.length);
    var ms = sum(splits);
    current = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      uid: userId, ms: ms, secs: Math.round(ms / 1000), splits: splits.slice()
    };
    var res = current;
    saveState = lbApi('submit') ? 'saving' : 'failed';
    saveInfo = null;
    newRecord = false;
    bestMs = 0;
    tab = 'friends';
    $('end').hidden = false;
    renderEnd();
    evalBest(res);
    writePending(res).then(function () { saveRun(res); });
    loadBoard();
  }
  function evalBest(res) {
    sGet('best').then(function (b) {
      if (res !== current) return;
      if (b && b.id === res.id) return;
      var prev = b && typeof b.ms === 'number' ? b.ms : 0;
      newRecord = !prev || res.ms < prev;
      bestMs = newRecord ? res.ms : prev;
      if (newRecord) sSet('best', { id: res.id, ms: res.ms, splits: res.splits });
      renderEnd();
    });
  }
  function pendingOf(res) {
    return { id: res.id, uid: res.uid, ms: res.ms, secs: res.secs, splits: res.splits };
  }
  function writePending(res) {
    return sGet('pending').then(function (p) {
      if (p && p.uid === res.uid && p.id !== res.id && p.ms <= res.ms) return;
      return sSet('pending', pendingOf(res));
    });
  }
  function clearPendingAfter(res) {
    return sGet('pending').then(function (p) {
      if (!p) return;
      if (p.id === res.id || p.ms >= res.ms) return sSet('pending', null);
      flushPending();
    });
  }
  function submit(res) {
    var l = lbApi('submit');
    if (!l) return Promise.reject({ code: 'UNAVAILABLE' });
    return timed(attempt(function () {
      return Usion.leaderboard.submit(res.secs, { ms: res.ms, splits: res.splits });
    }), 15000).then(function (a) {
      return a && a.success === true ? a : Promise.reject({ code: 'NOT_ACKED' });
    });
  }
  function setSave(res, s, a) {
    if (res !== current) return;
    saveState = s;
    if (a) saveInfo = a;
    renderEnd();
  }
  function saveRun(res) {
    if (!res || res.saved || saving === res) return;
    if (!lbApi('submit')) { setSave(res, 'failed'); return; }
    saving = res;
    setSave(res, 'saving');
    submit(res).then(function (a) {
      saving = null;
      res.saved = true;
      setSave(res, 'saved', a);
      clearPendingAfter(res);
      if (res === current && phase === 'end') loadBoard();
    }, function (e) {
      saving = null;
      setSave(res, e && e.code === 'AUTH_REQUIRED' ? 'guest' : 'failed');
    });
  }
  function flushPending() {
    if (flushing || !userId || /^guest_/.test(userId) || !lbApi('submit')) return;
    flushing = true;
    var done = function () { flushing = false; };
    sGet('pending').then(function (p) {
      if (!p || p.uid !== userId || (current && p.id === current.id)) return;
      return submit(p).then(function () { return clearPendingAfter(p); });
    }).then(done, done);
  }

  function renderEnd() {
    if (!current) return;
    setText($('endTotal'), fmt(current.ms));
    var rec = $('endRec');
    rec.hidden = !newRecord;
    setText(rec, t.record);
    var bt = bestMs ? fmt(bestMs) : '';
    var sb = saveInfo && typeof saveInfo.best === 'number' ? saveInfo.best : null;
    if (sb !== null && (!bestMs || sb < Math.round(bestMs / 1000))) bt = fmtSec(sb);
    setText($('endBest'), bt ? t.best + ' ' + bt : '');
    var ol = $('endSplits');
    ol.textContent = '';
    for (var i = 0; i < current.splits.length; i++) {
      var lv = L.LEVELS[i];
      var row = doc.createElement('li');
      var nm = doc.createElement('span');
      var tm = doc.createElement('b');
      nm.textContent = (i + 1) + '. ' + ((lv && lv.name && (lv.name[lang] || lv.name.mn)) || '');
      tm.textContent = fmt(current.splits[i]);
      row.appendChild(nm);
      row.appendChild(tm);
      ol.appendChild(row);
    }
    var txt = { saving: t.saving, saved: t.saved, failed: t.failed, guest: t.guest }[saveState] || '';
    if (saveState === 'saved' && saveInfo && saveInfo.rank) txt += ' · #' + saveInfo.rank;
    setText($('saveText'), txt);
    $('saveRow').className = 'save ' + saveState;
    $('retry').hidden = !(saveState === 'failed' || saveState === 'guest');
  }

  function boardMsg(s, retry) {
    var box = $('lb');
    var m = doc.createElement('div');
    var p = doc.createElement('span');
    box.textContent = '';
    m.className = 'msg';
    p.textContent = s;
    m.appendChild(p);
    if (retry) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'btn2';
      b.textContent = t.retry;
      b.addEventListener('click', loadBoard);
      m.appendChild(b);
    }
    box.appendChild(m);
  }
  function openProfile(id) {
    var u = usion();
    try { if (id && u && u.user && typeof u.user.openProfile === 'function') Usion.user.openProfile(id); } catch (e) {}
  }
  function boardRow(e, i) {
    var me = !!e.is_me;
    var el = doc.createElement(me ? 'div' : 'button');
    var name = e.name || '—';
    var rank = e.rank || i + 1;
    var rk = doc.createElement('span');
    var nm = doc.createElement('span');
    var sc = doc.createElement('span');
    var av;
    el.className = 'row' + (me ? ' me' : '');
    rk.className = 'rk';
    rk.textContent = String(rank);
    if (typeof e.avatar === 'string' && /^https?:/.test(e.avatar)) {
      av = doc.createElement('img');
      av.src = e.avatar;
      av.alt = '';
      av.draggable = false;
      av.onerror = function () { av.style.visibility = 'hidden'; };
    } else {
      av = doc.createElement('span');
      av.textContent = name.charAt(0).toUpperCase();
      av.setAttribute('aria-hidden', 'true');
    }
    av.className = 'av';
    nm.className = 'nm';
    nm.textContent = name;
    sc.className = 'sc';
    sc.textContent = fmtSec(e.score);
    el.appendChild(rk);
    el.appendChild(av);
    el.appendChild(nm);
    el.appendChild(sc);
    if (!me) {
      el.type = 'button';
      el.setAttribute('aria-label', rank + '. ' + name + ', ' + fmtSec(e.score));
      el.addEventListener('click', function () { openProfile(e.user_id); });
    }
    return el;
  }
  function loadBoard() {
    var seq = ++boardSeq;
    var which = tab;
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
      var box = $('lb');
      box.textContent = '';
      for (var i = 0; i < rows.length; i++) box.appendChild(boardRow(rows[i] || {}, i));
    }, function () {
      if (seq === boardSeq) boardMsg(t.error, true);
    });
  }
  function showTab(w) {
    if (tab === w) return;
    tab = w;
    loadBoard();
  }

  function onResize() {
    r.resize();
    if (world) r.fit(world);
  }
  function bind() {
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onCancel);
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('animationend', function () { cv.classList.remove('shake'); });
    doc.addEventListener('pointerdown', audio, true);
    doc.addEventListener('visibilitychange', function () { skipDt = true; });
    TOOLS.forEach(function (n) {
      var b = $('tool-' + n);
      b.addEventListener('click', function () { if (!drag) setTool(n); });
      b.addEventListener('animationend', function () { b.classList.remove('pulse'); });
    });
    $('restart').addEventListener('click', onRestart);
    $('again').addEventListener('click', restartRun);
    $('retry').addEventListener('click', function () { saveRun(current); });
    $('tabF').addEventListener('click', function () { showTab('friends'); });
    $('tabG').addEventListener('click', function () { showTab('global'); });
    root.addEventListener('resize', onResize);
    if (typeof root.ResizeObserver === 'function') new root.ResizeObserver(onResize).observe($('stage'));
  }

  function installTest() {
    root.UBT = {
      world: function () { return world; },
      levelIndex: function () { return li; },
      state: function () { return phase; },
      tileXY: function (tile) {
        var b = cv.getBoundingClientRect();
        var sx = 0, sy = 0, n = 0;
        for (var y = b.top; y < b.bottom; y += 2) {
          for (var x = b.left; x < b.right; x += 2) {
            if (r.tileAt(x, y) === tile) { sx += x; sy += y; n++; }
          }
        }
        return n ? { x: sx / n, y: sy / n } : null;
      },
      finishDistrict: function () {
        if (phase !== 'play') return false;
        for (var c = 0; c < world.quota.length; c++) world.delivered[c] = world.quota[c];
        world.cleared = true;
        world.events.push({ type: 'cleared' });
        drain();
        return true;
      }
    };
  }

  function start() {
    if (started) return;
    started = true;
    L = root.UBLevels;
    S = root.Sim;
    cv = $('cv');
    r = root.Render.create(cv);
    bind();
    applyHost();
    r.resize();
    restartRun();
    if (String(root.location.search).indexOf('test') !== -1) installTest();
    root.requestAnimationFrame(frame);
  }
  function adopt() {
    if (current && !current.saved) {
      current.uid = userId;
      evalBest(current);
      writePending(current).then(function () { saveRun(current); });
    } else flushPending();
    if (phase === 'end') loadBoard();
  }
  function onInit() {
    var u = usion();
    hostReady = true;
    try { userId = (u && u.user && typeof u.user.getId === 'function' && Usion.user.getId()) || null; } catch (e) { userId = null; }
    if (started) applyHost();
    else start();
    adopt();
  }
  function boot() {
    var u = usion();
    if (!u || typeof u.init !== 'function') { start(); return; }
    var fallback = setTimeout(start, 2500);
    try {
      var p = Usion.init(function () { clearTimeout(fallback); onInit(); });
      if (p && typeof p.catch === 'function') p.catch(noop);
    } catch (e) {
      clearTimeout(fallback);
      start();
    }
  }

  boot();
})(this);
