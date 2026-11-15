(function (root) {
  'use strict';

  var TXT = {
    mn: {
      perMin: '/мин', rateL: 'Урсгал', spdL: 'Дундаж хурд', kmh: 'км/ц', budL: 'Төсөв', unit: 'тэрбум₮',
      speed: 'Хурд', pause: 'Түр зогсоох', resume: 'Үргэлжлүүлэх',
      road: 'Шинэ зам', oddeven: 'Тэгш-сондгой', hot: 'Дараагийн түгжрэл',
      overpass: 'Гүүрэн гарц', lights: 'Гэрлэн дохио', widen: 'Эгнээ нэмэх',
      build: 'Барих', cancel: 'Болих', junction: 'Уулзвар', unnamed: 'Нэргүй зам', km: 'км',
      pickA: 'Эхлэх цэгээ сонго', pickB: 'Төгсөх цэгээ сонго', noJam: 'Түгжрэл алга',
      done: {
        overpass: 'Гүүрэн гарц баригдлаа', lights: 'Гэрлэн дохио тавигдлаа', widen: 'Эгнээ нэмэгдлээ',
        road: 'Шинэ зам баригдлаа', oddeven: 'Тэгш-сондгой эхэллээ'
      },
      why: {
        budget: 'Төсөв хүрэлцэхгүй', notJunction: 'Уулзвар биш', already: 'Аль хэдийн бий',
        maxLanes: 'Эгнээ дүүрсэн', tooLong: 'Хэт урт', same: 'Ижил цэг', exists: 'Зам бий'
      },
      nope: 'Болохгүй',
      avg: 'дундаж хурд', fixes: 'Засвар', spent: 'Зарцуулсан',
      best: 'Шилдэг', record: 'Шинэ рекорд!',
      saving: 'Хадгалж байна…', saved: 'Хадгалагдлаа', failed: 'Хадгалагдсангүй',
      guest: 'Нэвтэрч хадгална уу', retry: 'Дахин оролдох',
      friends: 'Найзууд', global: 'Нийт', loading: 'Ачаалж байна…',
      empty: 'Рекорд алга байна', error: 'Рекорд ачаалсангүй',
      again: 'Дахин тоглох'
    },
    en: {
      perMin: '/min', rateL: 'Flow', spdL: 'Average speed', kmh: 'km/h', budL: 'Budget', unit: 'bn₮',
      speed: 'Speed', pause: 'Pause', resume: 'Resume',
      road: 'New road', oddeven: 'Odd-even', hot: 'Next jam',
      overpass: 'Overpass', lights: 'Smart lights', widen: 'Add lane',
      build: 'Build', cancel: 'Cancel', junction: 'Junction', unnamed: 'Unnamed road', km: 'km',
      pickA: 'Tap the start point', pickB: 'Tap the end point', noJam: 'No jams',
      done: {
        overpass: 'Overpass built', lights: 'Lights installed', widen: 'Lane added',
        road: 'Road built', oddeven: 'Odd-even on'
      },
      why: {
        budget: 'Not enough budget', notJunction: 'Not a junction', already: 'Already built',
        maxLanes: 'Max lanes', tooLong: 'Too long', same: 'Same point', exists: 'Road exists'
      },
      nope: 'Not possible',
      avg: 'average speed', fixes: 'Fixes', spent: 'Spent',
      best: 'Best', record: 'New record!',
      saving: 'Saving…', saved: 'Saved', failed: 'Not saved',
      guest: 'Sign in to save', retry: 'Retry',
      friends: 'Friends', global: 'Global', loading: 'Loading…',
      empty: 'No records yet', error: 'Could not load records',
      again: 'Play again'
    }
  };
  var NODE_PX = 30;
  var EDGE_PX = 20;
  var SLOP_PX = 6;
  var DOUBLE_MS = 300;
  var HOT_SCALE = 0.22;

  var doc = root.document;
  var S, r, cv, stage, card;
  var lang = 'mn';
  var t = TXT.mn;
  var userId = null;
  var hostReady = false;
  var started = false;
  var city = null;
  var phase = 'play';
  var speed = 1;
  var paused = false;
  var acc = 0;
  var lastNow = 0;
  var skipDt = true;
  var tickAt = 0;
  var fixes = 0;
  var trail = [];
  var hot = [];
  var hotAt = -1e9;
  var hotIdx = -1;
  var hotTop = -1;
  var jamAt = -1e9;
  var mode = '';
  var road = null;
  var sel = null;
  var view = { now: 0, lang: 'mn', selection: null, pending: null, hot: [] };
  var ptrs = {};
  var gest = null;
  var lastTap = null;
  var anim = null;
  var current = null;
  var saving = null;
  var saveState = '';
  var saveInfo = null;
  var newRecord = false;
  var bestScore = null;
  var tab = 'friends';
  var boardSeq = 0;
  var flushing = false;
  var ac = null;

  function $(id) { return doc.getElementById(id); }
  function noop() {}
  function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
  function setAttr(el, k, v) { if (el.getAttribute(k) !== v) el.setAttribute(k, v); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(sec) {
    var m = Math.floor((Number(sec) || 0) / 60);
    return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
  }
  function kmh(score) { return ((Number(score) || 0) / 10).toFixed(1) + ' ' + t.kmh; }
  function fmtCost(v) {
    v = Number(v) || 0;
    return String(v >= 10 || v === Math.round(v) ? Math.round(v) : Math.round(v * 10) / 10);
  }
  function why(q) { return (q && t.why[q.reason]) || t.nope; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function flash(el, c) {
    el.classList.remove(c);
    void el.offsetWidth;
    el.classList.add(c);
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
    var i;
    var els = doc.querySelectorAll('[data-t]');
    for (i = 0; i < els.length; i++) els[i].textContent = t[els[i].getAttribute('data-t')];
    els = doc.querySelectorAll('[data-ta]');
    for (i = 0; i < els.length; i++) els[i].setAttribute('aria-label', t[els[i].getAttribute('data-ta')]);
    setSpeed(speed);
    setPause(paused);
    if (city) {
      setMode('');
      tick();
    }
    if (phase === 'end') renderEnd();
  }

  function hudSpeed() {
    return Number(typeof city.speedNow === 'number' ? city.speedNow : city.speed) || 0;
  }
  function trend() {
    var v = hudSpeed();
    var last = trail[trail.length - 1];
    if (!last || city.time !== last.t) trail.push({ t: city.time, v: v });
    while (trail.length > 1 && trail[1].t <= city.time - 60) trail.shift();
    var d = city.time - trail[0].t >= 30 ? v - trail[0].v : 0;
    return d > 0.05 ? 'up' : d < -0.05 ? 'down' : '';
  }
  function updateHud() {
    var tr = trend();
    var el = $('trend');
    setText($('clock'), hhmm(city.time));
    setText($('spd'), kmh(Math.round(hudSpeed() * 10)));
    setText(el, tr === 'up' ? '▲' : tr === 'down' ? '▼' : '');
    if (el.className !== tr) el.className = tr;
    setText($('rate'), '🚗 ' + Math.round(Number(city.rate) || 0) + t.perMin);
    setText($('bud'), '💰 ' + fmtCost(city.budget));
  }
  function tick() {
    refreshCard();
    refreshCtl();
    setAttr($('rate'), 'aria-label', t.rateL + ' ' + Math.round(Number(city.rate) || 0) + t.perMin);
    setAttr($('spdBox'), 'aria-label', t.spdL + ' ' + kmh(Math.round(hudSpeed() * 10)));
    setAttr($('bud'), 'aria-label', t.budL + ' ' + fmtCost(city.budget) + ' ' + t.unit);
  }
  function refreshCtl() {
    var b = $('oddBtn');
    var used = !!city.oddEven;
    var q = S.quote(city, { type: 'oddeven' }) || {};
    var s = used ? '✓' : '💰' + fmtCost(q.cost);
    b.disabled = used || q.ok !== true || phase !== 'play';
    setText($('oddCost'), s);
    setAttr(b, 'aria-label', t.oddeven + ', ' + (used || q.ok ? s : why(q)));
  }
  function setSpeed(v) {
    speed = v;
    var b = $('speed');
    setText(b, v + '×');
    setAttr(b, 'aria-pressed', String(v !== 1));
    setAttr(b, 'aria-label', t.speed + ' ' + v + '×');
  }
  function setPause(p) {
    paused = p;
    var b = $('pause');
    setAttr(b, 'aria-pressed', String(p));
    setAttr(b, 'aria-label', p ? t.resume : t.pause);
  }
  function hint() {
    var h = $('hint');
    var s = mode === 'road' && road.b < 0 ? (road.a < 0 ? t.pickA : t.pickB) : '';
    h.hidden = !s;
    setText(h, s);
  }
  function toast(s, kind) {
    var box = $('toasts');
    var el = doc.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = s;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1800);
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
  function blip() { tone('sine', 880, 0, 0, 0.06, 0.05); }
  function ding() { tone('sine', 1046, 0, 0, 0.12, 0.12); tone('sine', 1568, 0, 0.06, 0.2, 0.08); }
  function honk() { tone('square', 370, 340, 0, 0.24, 0.05); tone('square', 466, 430, 0, 0.24, 0.04); }
  function fanfare() { tone('triangle', 523, 0, 0, 0.16, 0.1); tone('triangle', 659, 0, 0.12, 0.16, 0.1); tone('triangle', 784, 0, 0.24, 0.3, 0.12); }

  function edgeName(e) {
    var i = city.ename[e];
    var names = root.UBMap && root.UBMap.names;
    return (i >= 0 && names && names[i]) || t.unnamed;
  }
  function nodeName(n) {
    var best = -1;
    var bl = -1;
    for (var e = 0; e < city.edgeCount; e++) {
      if (city.ename[e] < 0 || (city.ea[e] !== n && city.eb[e] !== n)) continue;
      var l = Number(S.edgeLoad(city, e)) || 0;
      if (l > bl) { bl = l; best = e; }
    }
    return best < 0 ? t.junction : edgeName(best);
  }
  function km(a, b) {
    var d = Math.hypot(city.nx[a] - city.nx[b], city.ny[a] - city.ny[b]) / 1000;
    return (d < 10 ? d.toFixed(1) : String(Math.round(d))) + ' ' + t.km;
  }
  function syncView() {
    view.selection = sel && sel.kind !== 'road' ? { type: sel.kind, id: sel.id }
      : mode === 'road' && road.a >= 0 && road.b < 0 ? { type: 'node', id: road.a } : null;
    view.pending = mode === 'road' && road.b >= 0 ? { type: 'road', a: road.a, b: road.b, ok: road.ok } : null;
  }
  function actButton(cls, label) {
    var b = doc.createElement('button');
    var s = doc.createElement('span');
    b.type = 'button';
    b.className = 'act ' + cls;
    s.textContent = label;
    b.appendChild(s);
    return b;
  }
  function openCard(kind, id, x, y) {
    var acts;
    var name;
    if (kind === 'node') {
      x = city.nx[id];
      y = city.ny[id];
      name = nodeName(id);
      acts = [{ type: 'overpass', node: id }, { type: 'lights', node: id }];
    } else if (kind === 'edge') {
      name = edgeName(id);
      acts = [{ type: 'widen', edge: id }];
    } else {
      x = city.nx[road.b];
      y = city.ny[road.b];
      name = t.road + ' · ' + km(road.a, road.b);
      acts = [{ type: 'road', a: road.a, b: road.b }];
    }
    sel = { kind: kind, id: id, x: x, y: y, btns: [] };
    setText($('cardName'), name);
    $('meter').hidden = kind === 'road';
    var box = $('cardActs');
    box.textContent = '';
    acts.forEach(function (a) {
      var label = kind === 'road' ? t.build : t[a.type];
      var b = actButton('a-' + a.type, label);
      var c = doc.createElement('b');
      b.appendChild(c);
      b.addEventListener('click', function () { doAct(a); });
      box.appendChild(b);
      sel.btns.push({ el: b, cost: c, a: a, label: label });
    });
    if (kind === 'road') {
      var x2 = actButton('a-cancel', t.cancel);
      x2.addEventListener('click', function () { setMode(''); });
      box.appendChild(x2);
    }
    card.hidden = false;
    flash(card, 'in');
    refreshCard();
    placeCard();
  }
  function closeCard() {
    sel = null;
    card.hidden = true;
    syncView();
  }
  function refreshCard() {
    if (!sel) return;
    if (sel.kind !== 'road') {
      var l = clamp(Number(sel.kind === 'node' ? S.nodeLoad(city, sel.id) : S.edgeLoad(city, sel.id)) || 0, 0, 1);
      var m = $('meterFill');
      m.style.width = Math.round(l * 100) + '%';
      m.style.background = 'hsl(' + Math.round(130 * (1 - l)) + ',78%,45%)';
    }
    sel.btns.forEach(function (o) {
      var q = S.quote(city, o.a) || {};
      var ok = q.ok === true && phase === 'play';
      var s = q.ok ? '💰' + fmtCost(q.cost) : why(q) + (q.reason === 'budget' && q.cost ? ' · 💰' + fmtCost(q.cost) : '');
      o.el.disabled = !ok;
      setText(o.cost, s);
      setAttr(o.el, 'aria-label', o.label + ', ' + s);
      if (o.a.type === 'road') road.ok = ok;
    });
    syncView();
  }
  function placeCard() {
    if (!sel) return;
    var p = r.worldToScreen(sel.x, sel.y);
    var b = stage.getBoundingClientRect();
    var w = card.offsetWidth;
    var h = card.offsetHeight;
    var x = p.x - b.left - w / 2;
    var y = p.y - b.top - h - 22;
    if (y < 8) y = p.y - b.top + 22;
    x = clamp(x, 8, Math.max(8, b.width - w - 8));
    y = clamp(y, 8, Math.max(8, b.height - h - 8));
    card.style.left = Math.round(x) + 'px';
    card.style.top = Math.round(y) + 'px';
  }
  function setMode(m) {
    mode = m;
    road = m === 'road' ? { a: -1, b: -1, ok: false } : null;
    closeCard();
    setAttr($('roadBtn'), 'aria-pressed', String(m === 'road'));
    hint();
  }

  function act(a) {
    if (phase !== 'play' || !a) return { ok: false, reason: 'over' };
    var res = S.apply(city, a) || { ok: false };
    if (res.ok) {
      if (a.type !== 'oddeven') fixes++;
      toast((t.done[a.type] || t.build) + ' −' + fmtCost(res.cost), 'ok');
      ding();
      drain();
      flash($('bud'), 'low');
    } else {
      toast(why(res), 'bad');
      honk();
    }
    refreshCtl();
    return res;
  }
  function doAct(a) {
    var res = act(a);
    if (res.ok) {
      if (mode === 'road') setMode('');
      else closeCard();
    } else refreshCard();
    return res;
  }
  function nextHot() {
    if (phase !== 'play') return;
    updateHot(root.performance.now());
    if (!hot.length) { toast(t.noJam, ''); return; }
    hotIdx = (hotIdx + 1) % hot.length;
    var n = hot[hotIdx];
    var c = r.getCamera();
    anim = { t0: root.performance.now(), dur: 480, s0: c.scale, s1: Math.max(c.scale, HOT_SCALE), x0: c.x, y0: c.y, x1: city.nx[n], y1: city.ny[n] };
    blip();
  }
  function updateHot(now) {
    hotAt = now;
    hot = S.hotspots(city, 5) || [];
    view.hot = hot;
    var top = hot.length ? hot[0] : -1;
    if (top >= 0 && top !== hotTop && now - jamAt > 6000 && phase === 'play' && (Number(S.nodeLoad(city, top)) || 0) > 0.75) {
      jamAt = now;
      r.effect('jam', city.nx[top], city.ny[top]);
    }
    hotTop = top;
  }

  function drain() {
    var evs = city.events;
    if (!evs || !evs.length) return;
    var list = evs.splice(0, evs.length);
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e && e.type === 'built' && isFinite(e.x) && isFinite(e.y)) r.effect('built', e.x, e.y);
    }
  }
  function stepAnim(now) {
    var k = clamp((now - anim.t0) / anim.dur, 0, 1);
    var e = 1 - Math.pow(1 - k, 3);
    var s = anim.s0 * Math.pow(anim.s1 / anim.s0, e);
    if (anim.w) zoomAround(anim.w, anim.cx, anim.cy, s);
    else r.setCamera(anim.x0 + (anim.x1 - anim.x0) * e, anim.y0 + (anim.y1 - anim.y0) * e, s);
    if (k >= 1) anim = null;
  }
  function frame(now) {
    root.requestAnimationFrame(frame);
    var hidden = doc.hidden;
    var dt = skipDt || hidden ? 0 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    skipDt = hidden;
    if (hidden) return;
    if (phase === 'play' && !paused) {
      acc += dt * S.TIME_SCALE * speed;
      while (acc >= S.DT && !city.done) { S.step(city, S.DT); acc -= S.DT; }
    }
    if (anim) stepAnim(now);
    drain();
    if (phase === 'play' && city.done) finishRun();
    if (now - hotAt >= 500) updateHot(now);
    if (now - tickAt >= 250) { tickAt = now; tick(); }
    view.now = now;
    view.lang = lang;
    r.draw(city, view);
    placeCard();
    updateHud();
  }

  function anchor(w, cx, cy) {
    var p = r.worldToScreen(w.x, w.y);
    var c = r.getCamera();
    r.setCamera(c.x + (p.x - cx) / c.scale, c.y + (p.y - cy) / c.scale, c.scale);
  }
  function zoomAround(w, cx, cy, s) {
    var c = r.getCamera();
    r.setCamera(c.x, c.y, s);
    anchor(w, cx, cy);
  }
  function pts() {
    var a = [];
    for (var k in ptrs) a.push(ptrs[k]);
    return a;
  }
  function beginPinch() {
    var p = pts();
    var mx = (p[0].x + p[1].x) / 2;
    var my = (p[0].y + p[1].y) / 2;
    gest = { mode: 'pinch', d0: Math.max(10, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)), s0: r.getCamera().scale, w: r.screenToWorld(mx, my) };
  }
  function resetGesture() {
    ptrs = {};
    gest = null;
  }
  function onDown(e) {
    if (phase !== 'play' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    anim = null;
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var n = pts().length;
    if (n === 1) gest = { mode: 'tap', sx: e.clientX, sy: e.clientY, w: r.screenToWorld(e.clientX, e.clientY) };
    else if (n === 2) beginPinch();
  }
  function onMove(e) {
    var q = ptrs[e.pointerId];
    if (!q || !gest) return;
    q.x = e.clientX;
    q.y = e.clientY;
    if (gest.mode === 'pinch') {
      var p = pts();
      if (p.length < 2) return;
      var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      zoomAround(gest.w, (p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, gest.s0 * d / gest.d0);
      return;
    }
    if (gest.mode === 'tap') {
      if (Math.hypot(q.x - gest.sx, q.y - gest.sy) < SLOP_PX) return;
      gest.mode = 'pan';
    }
    anchor(gest.w, q.x, q.y);
  }
  function onUp(e) {
    if (!ptrs[e.pointerId]) return;
    delete ptrs[e.pointerId];
    var p = pts();
    if (gest && gest.mode === 'tap' && !p.length && e.type === 'pointerup' && phase === 'play') tap(e.clientX, e.clientY);
    if (!p.length) gest = null;
    else if (p.length === 1) gest = { mode: 'pan', w: r.screenToWorld(p[0].x, p[0].y) };
    else beginPinch();
  }
  function onWheel(e) {
    e.preventDefault();
    if (phase !== 'play') return;
    anim = null;
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    zoomAround(r.screenToWorld(e.clientX, e.clientY), e.clientX, e.clientY, r.getCamera().scale * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
  }
  function tap(cx, cy) {
    var now = root.performance.now();
    if (lastTap && now - lastTap.t < DOUBLE_MS && Math.hypot(cx - lastTap.x, cy - lastTap.y) < 30) {
      lastTap = null;
      if (mode !== 'road') closeCard();
      var c = r.getCamera();
      anim = { t0: now, dur: 260, s0: c.scale, s1: c.scale * 2, w: r.screenToWorld(cx, cy), cx: cx, cy: cy };
      return;
    }
    lastTap = { t: now, x: cx, y: cy };
    pick(cx, cy);
  }
  function pick(cx, cy) {
    var w = r.screenToWorld(cx, cy);
    var s = r.getCamera().scale;
    if (mode === 'road') { roadPick(w, s); return; }
    if (sel) { closeCard(); return; }
    var n = S.nearestNode(city, w.x, w.y, NODE_PX / s, true);
    if (n >= 0) { blip(); openCard('node', n); return; }
    var e = S.nearestEdge(city, w.x, w.y, EDGE_PX / s);
    if (e >= 0) { blip(); openCard('edge', e, w.x, w.y); }
  }
  function roadPick(w, s) {
    var n = S.nearestNode(city, w.x, w.y, NODE_PX / s, false);
    if (n < 0) return;
    blip();
    if (road.a < 0) road.a = n;
    else road.b = n;
    hint();
    if (road.b >= 0) openCard('road', n);
    else syncView();
  }

  function newCity() {
    city = S.createCity(root.UBMap, root.UBScenario);
    phase = 'play';
    acc = 0;
    fixes = 0;
    trail = [];
    hot = [];
    view.hot = hot;
    hotAt = -1e9;
    hotIdx = -1;
    hotTop = -1;
    anim = null;
    lastTap = null;
    resetGesture();
    setMode('');
    setPause(false);
    r.clearEffects();
    r.fitCity(city);
    $('end').hidden = true;
    updateHud();
    tick();
  }

  function finishRun() {
    phase = 'end';
    setMode('');
    resetGesture();
    anim = null;
    current = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      uid: userId,
      score: Math.max(0, Math.round(Number(city.score) || 0)),
      spent: Math.round((Number(city.spent) || 0) * 10) / 10,
      fixes: fixes,
      oddEven: !!city.oddEven
    };
    var res = current;
    saveState = lbApi('submit') ? 'saving' : 'failed';
    saveInfo = null;
    newRecord = false;
    bestScore = null;
    tab = 'friends';
    $('end').hidden = false;
    fanfare();
    refreshCtl();
    renderEnd();
    evalBest(res);
    writePending(res).then(function () { saveRun(res); });
    loadBoard();
  }
  function evalBest(res) {
    sGet('best2').then(function (b) {
      if (res !== current) return;
      if (b && b.id === res.id) return;
      var prev = b && typeof b.score === 'number' ? b.score : null;
      var better = prev == null ? res.score > 0 : res.score > prev;
      bestScore = better ? res.score : prev;
      if (!(res.saved && saveInfo)) newRecord = better;
      if (better) sSet('best2', { id: res.id, score: res.score });
      renderEnd();
    });
  }
  function pendingOf(res) {
    return { id: res.id, uid: res.uid, score: res.score, spent: res.spent, fixes: res.fixes };
  }
  function writePending(res) {
    return sGet('pending2').then(function (p) {
      if (p && p.uid === res.uid && p.id !== res.id && typeof p.score === 'number' && p.score >= res.score) return;
      return sSet('pending2', pendingOf(res));
    });
  }
  function clearPendingAfter(res) {
    return sGet('pending2').then(function (p) {
      if (!p) return;
      if (p.id === res.id || !(p.score > res.score)) return sSet('pending2', null);
      flushPending();
    });
  }
  function submit(res) {
    var l = lbApi('submit');
    if (!l) return Promise.reject({ code: 'UNAVAILABLE' });
    return timed(attempt(function () {
      return Usion.leaderboard.submit(res.score, { spent: res.spent, fixes: res.fixes });
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
      if (res === current && typeof a.best === 'number') newRecord = a.previous == null || res.score > a.previous;
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
    sGet('pending2').then(function (p) {
      if (!p || p.uid !== userId || typeof p.score !== 'number' || (current && p.id === current.id)) return;
      return submit(p).then(function () { return clearPendingAfter(p); });
    }).then(done, done);
  }

  function renderEnd() {
    if (!current) return;
    setText($('endTotal'), kmh(current.score));
    var rec = $('endRec');
    rec.hidden = !newRecord;
    setText(rec, t.record);
    var b = saveInfo && typeof saveInfo.best === 'number' ? saveInfo.best : bestScore;
    setText($('endBest'), !newRecord && b != null ? t.best + ' ' + kmh(b) : '');
    setText($('fFix'), String(current.fixes));
    setText($('fSpent'), '💰' + fmtCost(current.spent));
    setText($('fOdd'), current.oddEven ? '✓' : '—');
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
    sc.textContent = kmh(e.score);
    el.appendChild(rk);
    el.appendChild(av);
    el.appendChild(nm);
    el.appendChild(sc);
    if (!me) {
      el.type = 'button';
      el.setAttribute('aria-label', rank + '. ' + name + ', ' + kmh(e.score));
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
    if (!city) { r.resize(); return; }
    var c = r.getCamera();
    r.resize();
    r.fitCity(city);
    if (c && c.scale > r.getCamera().scale * 1.01) r.setCamera(c.x, c.y, c.scale);
  }
  function bind() {
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    cv.addEventListener('lostpointercapture', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    ['pointerdown', 'pointerup', 'touchend', 'click'].forEach(function (n) { doc.addEventListener(n, audio, true); });
    root.addEventListener('blur', resetGesture);
    doc.addEventListener('visibilitychange', function () { skipDt = true; resetGesture(); });
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || phase !== 'play') return;
      if (mode) setMode('');
      else closeCard();
    });
    $('speed').addEventListener('click', function () { setSpeed(speed === 1 ? 3 : 1); });
    $('pause').addEventListener('click', function () { setPause(!paused); });
    $('roadBtn').addEventListener('click', function () { if (phase === 'play') setMode(mode === 'road' ? '' : 'road'); });
    $('oddBtn').addEventListener('click', function () { doAct({ type: 'oddeven' }); });
    $('hotBtn').addEventListener('click', nextHot);
    $('bud').addEventListener('animationend', function () { $('bud').classList.remove('low'); });
    card.addEventListener('animationend', function () { card.classList.remove('in'); });
    $('again').addEventListener('click', newCity);
    $('retry').addEventListener('click', function () { saveRun(current); });
    $('tabF').addEventListener('click', function () { showTab('friends'); });
    $('tabG').addEventListener('click', function () { showTab('global'); });
    root.addEventListener('resize', onResize);
    if (typeof root.ResizeObserver === 'function') new root.ResizeObserver(onResize).observe(stage);
  }

  function installTest() {
    root.UBT = {
      city: function () { return city; },
      state: function () { return phase; },
      finishNow: function () {
        if (phase !== 'play') return false;
        var guard = Math.ceil((city.end - city.time) / S.DT) + 100;
        while (!city.done && guard-- > 0) S.step(city, S.DT);
        drain();
        if (city.done) finishRun();
        return !!city.done;
      },
      act: function (a) { return doAct(a); }
    };
  }

  function start() {
    if (started) return;
    started = true;
    S = root.Sim;
    cv = $('cv');
    stage = $('stage');
    card = $('card');
    r = root.Render.create(cv);
    bind();
    r.resize();
    newCity();
    applyHost();
    if (/[?&]test=1(&|$)/.test(String(root.location.search)) && root.__UBT_TEST === true) installTest();
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
