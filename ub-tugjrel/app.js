(function (root) {
  'use strict';

  var TXT = {
    mn: {
      budL: 'Төсөв', unit: 'тэрбум₮', jamL: 'Түгжрэл',
      speed: 'Хурд', pause: 'Түр зогсоох', resume: 'Үргэлжлүүлэх',
      road: 'Шинэ зам', oddeven: 'Тэгш-сондгой', hot: 'Дараагийн түгжрэл',
      overpass: 'Гүүрэн гарц', roundabout: 'Тойрог', lights: 'Гэрлэн дохио', widen: 'Эгнээ нэмэх',
      build: 'Барих', cancel: 'Болих', junction: 'Уулзвар', unnamed: 'Нэргүй зам', km: 'км',
      pickA: 'Эхлэх цэгээ сонго', pickB: 'Төгсөх цэгээ сонго', noJam: 'Түгжрэл алга',
      pickNode: 'Уулзвар дээр дар', pickEdge: 'Зам дээр дар', finish: 'Дуусгах',
      goal: function (n) { return 'Түгжрэлийг 🚗 ' + n + ' хүртэл бууруул'; },
      done: {
        overpass: 'Гүүрэн гарц баригдлаа', roundabout: 'Тойрог баригдлаа', lights: 'Гэрлэн дохио тавигдлаа', widen: 'Эгнээ нэмэгдлээ',
        road: 'Шинэ зам баригдлаа', oddeven: 'Тэгш-сондгой эхэллээ'
      },
      why: {
        budget: 'Төсөв хүрэлцэхгүй', notJunction: 'Уулзвар биш', already: 'Аль хэдийн бий',
        maxLanes: 'Эгнээ дүүрсэн', tooLong: 'Хэт урт', same: 'Ижил цэг', exists: 'Зам бий', outside: 'Бүсээс гадна'
      },
      nope: 'Болохгүй',
      cleared: 'Түгжрэл арилсан!', timeUp: 'Цаг дууслаа',
      fixes: 'Засвар', spent: 'Зарцуулсан', best: 'Шилдэг', newBest: 'Шинэ рекорд!',
      saving: 'Хадгалж байна…', saved: 'Хадгалагдлаа', failed: 'Хадгалагдсангүй',
      guest: 'Нэвтэрч хадгална уу', retry: 'Дахин оролдох',
      thisSpot: 'Энэ газар', friends: 'Найзууд', global: 'Нийт', me: 'Та',
      loading: 'Ачаалж байна…', empty: 'Рекорд алга байна', noFriends: 'Найзууд хараахан тоглоогүй',
      error: 'Рекорд ачаалсангүй',
      again: 'Дахин', next: 'Дараагийн газар', spots: 'Газрууд', close: 'Хаах', locked: 'Түгжээтэй',
      share: 'Хуваалцах', shared: 'Хуваалцлаа', shareFail: 'Хуваалцаж чадсангүй',
      shareText: function (name, tm) { return 'Би «' + name + '»-ийн түгжрэлийг ' + tm + '-д арилгалаа! 🚗💨 Чи үүнээс хурдан чадах уу?'; }
    },
    en: {
      budL: 'Budget', unit: 'bn₮', jamL: 'Jam',
      speed: 'Speed', pause: 'Pause', resume: 'Resume',
      road: 'New road', oddeven: 'Odd-even', hot: 'Next jam',
      overpass: 'Overpass', roundabout: 'Roundabout', lights: 'Smart lights', widen: 'Add lane',
      build: 'Build', cancel: 'Cancel', junction: 'Junction', unnamed: 'Unnamed road', km: 'km',
      pickA: 'Tap the start point', pickB: 'Tap the end point', noJam: 'No jams',
      pickNode: 'Tap a junction', pickEdge: 'Tap a road', finish: 'Finish',
      goal: function (n) { return 'Cut the jam to 🚗 ' + n; },
      done: {
        overpass: 'Overpass built', roundabout: 'Roundabout built', lights: 'Lights installed', widen: 'Lane added',
        road: 'Road built', oddeven: 'Odd-even on'
      },
      why: {
        budget: 'Not enough budget', notJunction: 'Not a junction', already: 'Already built',
        maxLanes: 'Max lanes', tooLong: 'Too long', same: 'Same point', exists: 'Road exists', outside: 'Outside the area'
      },
      nope: 'Not possible',
      cleared: 'Jam cleared!', timeUp: "Time's up",
      fixes: 'Fixes', spent: 'Spent', best: 'Best', newBest: 'New best!',
      saving: 'Saving…', saved: 'Saved', failed: 'Not saved',
      guest: 'Sign in to save', retry: 'Retry',
      thisSpot: 'This spot', friends: 'Friends', global: 'Global', me: 'You',
      loading: 'Loading…', empty: 'No records yet', noFriends: 'No friends have played yet',
      error: 'Could not load records',
      again: 'Retry', next: 'Next spot', spots: 'Spots', close: 'Close', locked: 'Locked',
      share: 'Share', shared: 'Shared', shareFail: 'Could not share',
      shareText: function (name, tm) { return 'I cleared the «' + name + '» jam in ' + tm + '! 🚗💨 Can you beat that?'; }
    }
  };
  var NODE_PX = 30;
  var EDGE_PX = 20;
  var SLOP_PX = 6;
  var DOUBLE_MS = 300;
  var HOT_SCALE = 0.22;
  var AREA_M = 2400;
  var NO_TIME = 3600;
  var BANNER_MS = 1500;
  var FRIENDS_TTL = 60000;
  var KEY_PROG = 'spots3';
  var KEY_PEND = 'pending3';
  var TOOLS = ['overpass', 'roundabout', 'lights', 'widen', 'road', 'oddeven'];
  var JUNCTION = { overpass: 1, roundabout: 1, lights: 1 };
  var ICONS = { overpass: '🌉', roundabout: '⭕', lights: '🚦', widen: '↔️', road: '🛣️' };

  var doc = root.document;
  var S, r, cv, stage, card;
  var SP = [];
  var lang = 'mn';
  var t = TXT.mn;
  var userId = null;
  var hostReady = false;
  var started = false;
  var prog = {};
  var progSeq = 0;
  var idx = 0;
  var spot = null;
  var city = null;
  var ch = null;
  var jam0 = 1;
  var phase = 'play';
  var listOpen = false;
  var run = null;
  var runSeq = 0;
  var speed = 1;
  var paused = false;
  var acc = 0;
  var lastNow = 0;
  var skipDt = true;
  var tickAt = 0;
  var fixes = 0;
  var hot = [];
  var hotAt = -1e9;
  var hotIdx = -1;
  var hotTop = -1;
  var jamAt = -1e9;
  var tool = '';
  var road = null;
  var sel = null;
  var view = { now: 0, lang: 'mn', selection: null, pending: null, hot: [], area: null, targets: null };
  var ptrs = {};
  var gest = null;
  var lastTap = null;
  var anim = null;
  var current = null;
  var saving = null;
  var saveState = '';
  var saveInfo = null;
  var tab = 'spot';
  var boardSeq = 0;
  var flushing = false;
  var fcache = {};
  var ac = null;

  function $(id) { return doc.getElementById(id); }
  function noop() {}
  function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
  function setAttr(el, k, v) { if (el.getAttribute(k) !== v) el.setAttribute(k, v); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtT(s) {
    s = Math.max(0, Math.round(Number(s) || 0));
    return Math.floor(s / 60) + ':' + pad(s % 60);
  }
  function fmtLong(s) {
    s = Math.max(0, Math.round(Number(s) || 0));
    return s >= 3600 ? Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) : fmtT(s);
  }
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
  function spotName(p) { return p && p.name ? p.name[lang] || p.name.mn || '' : ''; }
  function starsFor(s, par) { return s <= par[0] ? 3 : s <= par[1] ? 2 : 1; }
  function fillStars(el, n) {
    el.textContent = '';
    for (var i = 0; i < 3; i++) {
      var s = doc.createElement('span');
      s.textContent = '⭐';
      if (i >= n) s.className = 'off';
      el.appendChild(s);
    }
  }
  function rec(p) {
    var v = p && prog[p.id];
    return v && typeof v.best === 'number' ? v : null;
  }
  function isOpen(i) { return i === 0 || !!rec(SP[i - 1]); }
  function totals() {
    var s = 0;
    var n = 0;
    SP.forEach(function (p) {
      var v = rec(p);
      if (v) { s += v.best; n++; } else s += NO_TIME;
    });
    return { total: s, cleared: n };
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
  function cloudF(m) {
    var u = usion();
    var f = hostReady && u && u.cloud && u.cloud.friends;
    return f && typeof f[m] === 'function' ? f : null;
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

  function mergeProg(list) {
    var o = {};
    list.forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      Object.keys(p).forEach(function (k) {
        var v = p[k];
        if (!v || typeof v.best !== 'number' || !(v.best >= 0)) return;
        var c = o[k];
        o[k] = { best: c ? Math.min(c.best, v.best) : v.best, stars: Math.max(Number(v.stars) || 0, c ? c.stars : 0) };
      });
    });
    return o;
  }
  function loadProg() {
    var local = lsGet(KEY_PROG);
    if (!remote()) return Promise.resolve(mergeProg([local]));
    return timed(attempt(function () { return Usion.storage.get(KEY_PROG); }), 4000).then(function (v) {
      return mergeProg([local, v]);
    }, function () { return mergeProg([local]); });
  }
  function syncProg() {
    var seq = ++progSeq;
    return loadProg().then(function (p) {
      if (seq !== progSeq) return;
      prog = p;
      renderList();
      if (!city) startSpot(launchSpot());
      else if (phase !== 'play' && !$('end').hidden) renderEnd();
    });
  }
  function firstSpot() {
    for (var i = 0; i < SP.length; i++) if (!rec(SP[i])) return i;
    return 0;
  }
  function launchSpot() {
    var path = '';
    var u = usion();
    try { if (hostReady && u && typeof u.getLaunchParams === 'function') path = String((Usion.getLaunchParams() || {}).path || ''); } catch (e) {}
    var m = /^\/spot\/([A-Za-z0-9_-]+)\/?$/.exec(path);
    if (m) for (var i = 0; i < SP.length; i++) if (SP[i].id === m[1] && isOpen(i)) return i;
    return firstSpot();
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
      setTool('');
      tick();
      updateHud();
    }
    if (phase !== 'play' && run) renderEnd();
    renderList();
  }

  function updateHud() {
    var box = $('jam');
    var clk = $('clock');
    var won = !!(run && run.won);
    var ok = (Number(ch.smooth) || 0) <= ch.target;
    setText($('spotName'), spotName(spot));
    setText(clk, won ? '✓ ' + fmtT(run.time) : fmtT(city.time - ch.start));
    if (clk.classList.contains('won') !== won) clk.classList.toggle('won', won);
    setText($('jamTxt'), '🚗 ' + Math.round((Number(ch.smooth) || 0) / 10) * 10 + ' → ' + ch.target);
    if (box.classList.contains('ok') !== ok) box.classList.toggle('ok', ok);
    $('jamFill').style.width = (clamp((Number(ch.smooth) || 0) / jam0, 0, 1) * 100).toFixed(1) + '%';
    $('jamGoal').style.left = (clamp(ch.target / jam0, 0, 1) * 100).toFixed(1) + '%';
    setText($('bud'), '💰 ' + fmtCost(city.budget));
  }
  function tick() {
    refreshCard();
    refreshCtl();
    setAttr($('jam'), 'aria-label', t.jamL + ' ' + Math.round(Number(ch.smooth) || 0) + ' → ' + ch.target);
    setAttr($('bud'), 'aria-label', t.budL + ' ' + fmtCost(city.budget) + ' ' + t.unit);
  }
  function toolCost(k) {
    var C = S.COSTS || {};
    return k === 'widen' ? C.widenPerKm : k === 'road' ? C.roadPerKm : C[k];
  }
  function refreshCtl() {
    TOOLS.forEach(function (k) {
      var b = $('tool-' + k);
      var cost = toolCost(k);
      var perKm = k === 'widen' || k === 'road';
      var s = fmtCost(cost) + (perKm ? '/' + t.km : '');
      var off = phase !== 'play';
      var label = s;
      if (k === 'oddeven') {
        var q = S.quote(city, { type: 'oddeven' }) || {};
        if (city.oddEven) s = label = '✓';
        else if (q.ok !== true) label = why(q);
        off = off || !!city.oddEven || q.ok !== true;
      }
      b.disabled = off;
      setText(b.querySelector('.cost'), s);
      b.classList.toggle('poor', !off && typeof cost === 'number' && city.budget < cost);
      setAttr(b, 'aria-label', t[k] + ', ' + label);
    });
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
    var s = '';
    if (tool === 'road') s = road.b < 0 ? (road.a < 0 ? t.pickA : t.pickB) : '';
    else if (JUNCTION[tool]) s = t.pickNode;
    else if (tool === 'widen') s = t.pickEdge;
    if (s) s = ICONS[tool] + ' ' + s;
    h.hidden = !s;
    setText(h, s);
  }
  function toast(s, kind) {
    var box = $('toasts');
    var b = stage.getBoundingClientRect();
    var el = doc.createElement('div');
    box.style.top = Math.round(Math.max(8, b.top + 10)) + 'px';
    box.style.left = Math.round(b.left + 8) + 'px';
    box.style.right = Math.round(Math.max(8, root.innerWidth - b.right + 8)) + 'px';
    el.className = 'toast ' + (kind || '');
    el.textContent = s;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
  }
  function banner(s) {
    var b = $('banner');
    setText(b, s);
    b.hidden = false;
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
  function fanfare() {
    tone('triangle', 523, 0, 0, 0.16, 0.1);
    tone('triangle', 659, 0, 0.12, 0.16, 0.1);
    tone('triangle', 784, 0, 0.24, 0.16, 0.1);
    tone('triangle', 1046, 0, 0.36, 0.4, 0.12);
  }

  function edgeName(e) {
    var i = city.ename[e];
    var names = root.UBMap && root.UBMap.names;
    return (i >= 0 && names && names[i]) || t.unnamed;
  }
  function busiestEdge(n, named) {
    var best = -1;
    var bl = -1;
    for (var e = 0; e < city.edgeCount; e++) {
      if ((named && city.ename[e] < 0) || (city.ea[e] !== n && city.eb[e] !== n)) continue;
      var l = Number(S.edgeLoad(city, e)) || 0;
      if (l > bl) { bl = l; best = e; }
    }
    return best;
  }
  function nodeName(n) {
    var e = busiestEdge(n, true);
    return e < 0 ? t.junction : edgeName(e);
  }
  function junctionActs(n) {
    return [{ type: 'overpass', node: n }, { type: 'roundabout', node: n }, { type: 'lights', node: n }];
  }
  function nearJunction(e, x, y) {
    var best = -1;
    var bd = Infinity;
    [city.ea[e], city.eb[e]].forEach(function (n) {
      var d = Math.hypot(city.nx[n] - x, city.ny[n] - y);
      if (S.isJunction(city, n) && d < bd) { bd = d; best = n; }
    });
    return best;
  }
  function targetsFor(type) {
    var out = [];
    for (var n = 0; n < city.nodeCount; n++) {
      if (Math.hypot(city.nx[n] - spot.x, city.ny[n] - spot.y) > spot.r || !S.isJunction(city, n)) continue;
      var q = S.quote(city, { type: type, node: n }) || {};
      if (q.ok || q.reason === 'budget') out.push(n);
    }
    return out;
  }
  function km(a, b) {
    var d = Math.hypot(city.nx[a] - city.nx[b], city.ny[a] - city.ny[b]) / 1000;
    return (d < 10 ? d.toFixed(1) : String(Math.round(d))) + ' ' + t.km;
  }
  function syncView() {
    view.selection = sel && sel.kind !== 'road' ? { type: sel.kind, id: sel.id }
      : tool === 'road' && road.a >= 0 && road.b < 0 ? { type: 'node', id: road.a } : null;
    view.pending = tool === 'road' && road.b >= 0 ? { type: 'road', a: road.a, b: road.b, ok: road.ok } : null;
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
      acts = junctionActs(id);
      var be = busiestEdge(id, false);
      if (be >= 0) acts.push({ type: 'widen', edge: be });
    } else if (kind === 'edge') {
      name = edgeName(id);
      acts = [{ type: 'widen', edge: id }];
      var j = nearJunction(id, x, y);
      if (j >= 0) acts = acts.concat(junctionActs(j));
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
      x2.addEventListener('click', function () { setTool(''); });
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
  function setTool(k) {
    tool = k;
    road = k === 'road' ? { a: -1, b: -1, ok: false } : null;
    closeCard();
    TOOLS.forEach(function (n) { if (n !== 'oddeven') setAttr($('tool-' + n), 'aria-pressed', String(n === k)); });
    view.targets = JUNCTION[k] && city ? targetsFor(k) : null;
    hint();
  }
  function onTool(k) {
    if (phase !== 'play' || !city) return;
    if (k === 'oddeven') { doAct({ type: 'oddeven' }); return; }
    blip();
    setTool(tool === k ? '' : k);
  }

  function act(a) {
    if (phase !== 'play' || listOpen || !a) return { ok: false, reason: 'over' };
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
      if (tool) setTool('');
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
    var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
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
    if (hidden || !city) return;
    if (phase === 'play' && !paused && !listOpen) {
      acc += dt * S.TIME_SCALE * speed;
      while (acc >= S.DT && !city.done) {
        S.step(city, S.DT);
        S.updateChallenge(ch, city);
        acc -= S.DT;
      }
    }
    if (anim) stepAnim(now);
    drain();
    checkRun();
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
    if (!city || (e.pointerType === 'mouse' && e.button !== 0)) return;
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
    if (gest && gest.mode === 'tap' && !p.length && e.type === 'pointerup') tap(e.clientX, e.clientY);
    if (!p.length) gest = null;
    else if (p.length === 1) gest = { mode: 'pan', w: r.screenToWorld(p[0].x, p[0].y) };
    else beginPinch();
  }
  function onWheel(e) {
    e.preventDefault();
    if (!city) return;
    anim = null;
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    zoomAround(r.screenToWorld(e.clientX, e.clientY), e.clientX, e.clientY, r.getCamera().scale * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)));
  }
  function tap(cx, cy) {
    var now = root.performance.now();
    if (lastTap && now - lastTap.t < DOUBLE_MS && Math.hypot(cx - lastTap.x, cy - lastTap.y) < 30) {
      lastTap = null;
      if (tool !== 'road') closeCard();
      var c = r.getCamera();
      anim = { t0: now, dur: 260, s0: c.scale, s1: c.scale * 2, w: r.screenToWorld(cx, cy), cx: cx, cy: cy };
      return;
    }
    lastTap = { t: now, x: cx, y: cy };
    if (phase === 'play') pick(cx, cy);
  }
  function pick(cx, cy) {
    var w = r.screenToWorld(cx, cy);
    var s = r.getCamera().scale;
    if (tool === 'road') { roadPick(w, s); return; }
    if (JUNCTION[tool]) {
      var j = S.nearestNode(city, w.x, w.y, NODE_PX / s, true);
      if (j < 0) { toast(t.pickNode, 'bad'); honk(); return; }
      doAct({ type: tool, node: j });
      return;
    }
    if (tool === 'widen') {
      var we = S.nearestEdge(city, w.x, w.y, EDGE_PX / s);
      if (we < 0) { toast(t.pickEdge, 'bad'); honk(); return; }
      doAct({ type: 'widen', edge: we });
      return;
    }
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

  function spotScale() {
    var b = cv.getBoundingClientRect();
    return Math.max(0.005, Math.min(b.width, b.height) / AREA_M);
  }
  function startSpot(i) {
    if (!SP.length) return;
    idx = clamp(Math.floor(Number(i) || 0), 0, SP.length - 1);
    spot = SP[idx];
    runSeq++;
    city = S.createCity(root.UBMap, root.UBScenario);
    ch = S.createChallenge(city, spot);
    jam0 = Math.max(Number(ch.jam) || 0, Number(ch.smooth) || 0, ch.target * 2, 1);
    phase = 'play';
    run = null;
    acc = 0;
    fixes = 0;
    hot = [];
    view.hot = hot;
    view.area = spot;
    hotAt = -1e9;
    hotIdx = -1;
    hotTop = -1;
    lastTap = null;
    resetGesture();
    setTool('');
    setPause(false);
    $('finishBtn').hidden = true;
    $('end').hidden = true;
    $('banner').hidden = true;
    closeList();
    r.clearEffects();
    r.fitCity(city);
    var c = r.getCamera();
    anim = { t0: root.performance.now(), dur: 1100, s0: c.scale, s1: spotScale(), x0: c.x, y0: c.y, x1: spot.x, y1: spot.y };
    updateHud();
    tick();
    toast(t.goal(ch.target), '');
  }

  function snapshot() {
    return { spent: Math.round((Number(city.spent) || 0) * 10) / 10, fixes: fixes, oddEven: !!city.oddEven };
  }
  function checkRun() {
    if (phase !== 'play' || run || !ch) return;
    if (ch.cleared) onClear();
    else if (ch.failed) onFail();
  }
  function onClear() {
    var prev = rec(spot);
    var tm = Math.round(Number(ch.time) || 0);
    var seq = runSeq;
    var st = starsFor(tm, spot.par);
    run = { spot: spot, idx: idx, won: true, time: tm, stars: st, isBest: !prev || tm < prev.best, snap: snapshot() };
    if (run.isBest) {
      prog[spot.id] = { best: tm, stars: Math.max(st, prev ? prev.stars : 0) };
      sSet(KEY_PROG, prog);
      shareFriendTime(spot, tm);
      submitTotal();
    }
    tab = 'spot';
    $('finishBtn').hidden = false;
    banner(t.cleared + ' ' + fmtT(tm) + ' ' + '⭐'.repeat(st));
    fanfare();
    r.effect('built', spot.x, spot.y);
    setTimeout(function () { if (seq === runSeq) $('banner').hidden = true; }, BANNER_MS);
  }
  function onFail() {
    var seq = runSeq;
    run = { spot: spot, idx: idx, won: false, time: 0, stars: 0, isBest: false, snap: snapshot() };
    phase = 'fail';
    tab = 'spot';
    setTool('');
    resetGesture();
    refreshCtl();
    honk();
    setTimeout(function () { if (seq === runSeq && phase === 'fail') showEnd(); }, 400);
  }
  function finish() {
    if (phase !== 'play' || !run || !run.won) return;
    phase = 'clear';
    run.snap = snapshot();
    $('finishBtn').hidden = true;
    setTool('');
    resetGesture();
    refreshCtl();
    showEnd();
  }
  function showEnd() {
    $('banner').hidden = true;
    $('toasts').textContent = '';
    $('end').hidden = false;
    renderEnd();
    loadBoard();
  }
  function submitTotal() {
    var tot = totals();
    current = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      uid: userId, total: tot.total, cleared: tot.cleared
    };
    var res = current;
    saveState = lbApi('submit') ? 'saving' : 'failed';
    saveInfo = null;
    writePending(res).then(function () { saveRun(res); });
  }
  function pendingOf(res) {
    return { id: res.id, uid: res.uid, total: res.total, cleared: res.cleared };
  }
  function writePending(res) {
    return sGet(KEY_PEND).then(function (p) {
      if (p && p.uid === res.uid && p.id !== res.id && typeof p.total === 'number' && p.total <= res.total) return;
      return sSet(KEY_PEND, pendingOf(res));
    });
  }
  function clearPendingAfter(res) {
    return sGet(KEY_PEND).then(function (p) {
      if (!p) return;
      if (p.id === res.id || !(p.total < res.total)) return sSet(KEY_PEND, null);
      flushPending();
    });
  }
  function submit(res) {
    var l = lbApi('submit');
    if (!l) return Promise.reject({ code: 'UNAVAILABLE' });
    return timed(attempt(function () {
      return Usion.leaderboard.submit(res.total, { cleared: res.cleared });
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
      if (res === current && phase !== 'play' && tab !== 'spot') loadBoard();
    }, function (e) {
      saving = null;
      setSave(res, e && e.code === 'AUTH_REQUIRED' ? 'guest' : 'failed');
    });
  }
  function flushPending() {
    if (flushing || !userId || /^guest_/.test(userId) || !lbApi('submit')) return;
    flushing = true;
    var done = function () { flushing = false; };
    sGet(KEY_PEND).then(function (p) {
      if (!p || p.uid !== userId || typeof p.total !== 'number' || (current && p.id === current.id)) return;
      return submit(p).then(function () { return clearPendingAfter(p); });
    }).then(done, done);
  }

  function shareFriendTime(p, s) {
    if (!cloudF('set')) return;
    attempt(function () { return Usion.cloud.friends.set('best:' + p.id, { t: s }); }).catch(noop);
  }
  function friendTimes(p) {
    var c = fcache[p.id];
    if (c && Date.now() - c.at < FRIENDS_TTL) return c.p;
    if (!cloudF('list')) return Promise.reject({ code: 'UNAVAILABLE' });
    var pr = timed(attempt(function () { return Usion.cloud.friends.list('best:' + p.id); }), 10000).then(function (rows) {
      var out = [];
      (Array.isArray(rows) ? rows : []).forEach(function (x) {
        var v = x && x.value ? Number(x.value.t) : NaN;
        if (x && x.userId && v >= 0) out.push({ id: x.userId, name: x.name || '—', avatar: x.avatar, t: v });
      });
      return out.sort(function (a, b) { return a.t - b.t; });
    });
    fcache[p.id] = { at: Date.now(), p: pr };
    pr.catch(function () { if (fcache[p.id] && fcache[p.id].p === pr) delete fcache[p.id]; });
    return pr;
  }

  function canShare() {
    var u = usion();
    try { return !!(hostReady && u && typeof u.canShareToFeed === 'function' && Usion.canShareToFeed()); } catch (e) { return false; }
  }
  function onShare() {
    if (!run || !run.won || !canShare()) return;
    var name = spotName(run.spot);
    var tm = fmtT(run.time);
    var id = run.spot.id;
    var b = $('shareBtn');
    b.disabled = true;
    attempt(function () {
      return Usion.shareToFeed('text', {
        text: t.shareText(name, tm),
        card: { title: name, subtitle: tm },
        path: '/spot/' + id
      });
    }).then(function () { toast(t.shared, 'ok'); }, function (e) {
      if (!(e && e.code === 'CANCELLED')) toast(t.shareFail, 'bad');
    }).then(function () { b.disabled = false; });
  }

  function renderEnd() {
    if (!run) return;
    var won = run.won;
    var head = $('endHead');
    var b = rec(run.spot);
    var ni = run.idx + 1;
    var nb = $('nextBtn');
    setText(head, won ? t.cleared : t.timeUp);
    head.className = 'head' + (won ? '' : ' fail');
    setText($('endSpot'), spotName(run.spot));
    $('endTotal').hidden = !won;
    setText($('endTotal'), fmtT(run.time));
    $('endStars').hidden = !won;
    fillStars($('endStars'), run.stars);
    setAttr($('endStars'), 'aria-label', run.stars + '/3');
    $('endRec').hidden = !run.isBest;
    setText($('endBest'), !run.isBest && b ? t.best + ' ' + fmtT(b.best) : '');
    setText($('fFix'), String(run.snap.fixes));
    setText($('fSpent'), '💰' + fmtCost(run.snap.spent));
    setText($('fOdd'), run.snap.oddEven ? '✓' : '—');
    $('saveRow').hidden = !current;
    var txt = { saving: t.saving, saved: t.saved, failed: t.failed, guest: t.guest }[saveState] || '';
    if (saveState === 'saved' && saveInfo && saveInfo.rank) txt += ' · #' + saveInfo.rank;
    setText($('saveText'), txt);
    $('saveRow').className = 'save ' + saveState;
    $('retry').hidden = !(saveState === 'failed' || saveState === 'guest');
    $('shareBtn').hidden = !(won && canShare());
    nb.hidden = ni >= SP.length;
    nb.disabled = !(ni < SP.length && isOpen(ni));
    nb.classList.toggle('primary', won);
    $('again').classList.toggle('primary', !won);
  }

  function msgEl(s, retry) {
    var m = doc.createElement('div');
    var p = doc.createElement('span');
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
    var el = doc.createElement(o.me ? 'div' : 'button');
    var name = o.name || '—';
    var rk = doc.createElement('span');
    var nm = doc.createElement('span');
    var sc = doc.createElement('span');
    var av;
    el.className = 'row' + (o.me ? ' me' : '');
    rk.className = 'rk';
    rk.textContent = String(o.rank);
    if (typeof o.avatar === 'string' && /^https?:/.test(o.avatar)) {
      av = doc.createElement('img');
      av.src = o.avatar;
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
    sc.textContent = o.score;
    el.appendChild(rk);
    el.appendChild(av);
    el.appendChild(nm);
    el.appendChild(sc);
    if (!o.me) {
      el.type = 'button';
      el.setAttribute('aria-label', o.rank + '. ' + name + ', ' + o.score);
      el.addEventListener('click', function () { openProfile(o.id); });
    }
    return el;
  }
  function loadBoard() {
    var seq = ++boardSeq;
    var which = tab;
    var box = $('lb');
    setAttr($('tabS'), 'aria-selected', String(which === 'spot'));
    setAttr($('tabF'), 'aria-selected', String(which === 'friends'));
    setAttr($('tabG'), 'aria-selected', String(which === 'global'));
    if (!run) return;
    boardMsg(t.loading);
    if (which === 'spot') {
      var p = run.spot;
      friendTimes(p).then(function (rows) {
        if (seq !== boardSeq) return;
        var all = rows.slice();
        var mine = rec(p);
        if (mine) all.push({ me: true, name: t.me, t: mine.best });
        all.sort(function (a, b) { return a.t - b.t; });
        box.textContent = '';
        if (!rows.length) box.appendChild(msgEl(t.noFriends));
        all.forEach(function (x, i) {
          box.appendChild(boardRow({ me: !!x.me, id: x.id, name: x.name, avatar: x.avatar, rank: i + 1, score: fmtT(x.t) }));
        });
      }, function () {
        if (seq === boardSeq) boardMsg(t.error, true);
      });
      return;
    }
    var l = lbApi(which === 'friends' ? 'friends' : 'top');
    if (!l) { boardMsg(t.error, true); return; }
    timed(attempt(function () {
      return which === 'friends' ? Usion.leaderboard.friends({ limit: 20 }) : Usion.leaderboard.top({ limit: 10 });
    }), 10000).then(function (rows) {
      if (seq !== boardSeq) return;
      rows = Array.isArray(rows) ? rows : [];
      if (!rows.length) { boardMsg(t.empty); return; }
      box.textContent = '';
      rows.forEach(function (e, i) {
        e = e || {};
        box.appendChild(boardRow({ me: !!e.is_me, id: e.user_id, name: e.name, avatar: e.avatar, rank: e.rank || i + 1, score: fmtLong(e.score) }));
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

  function openList() {
    if (!SP.length) return;
    listOpen = true;
    closeCard();
    $('list').hidden = false;
    renderList();
  }
  function closeList() {
    listOpen = false;
    $('list').hidden = true;
  }
  function renderList() {
    if (!listOpen) return;
    var box = $('spots');
    box.textContent = '';
    SP.forEach(function (p, i) {
      var open = isOpen(i);
      var v = rec(p);
      var b = doc.createElement('button');
      var num = doc.createElement('span');
      var si = doc.createElement('span');
      var nm = doc.createElement('b');
      var fr = doc.createElement('small');
      var sr = doc.createElement('span');
      b.type = 'button';
      b.className = 'spot' + (i === idx ? ' cur' : '') + (v ? ' done' : '');
      b.disabled = !open;
      num.className = 'num';
      num.textContent = String(i + 1);
      si.className = 'si';
      nm.textContent = spotName(p);
      si.appendChild(nm);
      si.appendChild(fr);
      sr.className = 'sr';
      if (open) {
        var st = doc.createElement('span');
        var bt = doc.createElement('b');
        st.className = 'st';
        fillStars(st, v ? v.stars : 0);
        bt.textContent = v ? fmtT(v.best) : '—';
        sr.appendChild(st);
        sr.appendChild(bt);
      } else {
        sr.className = 'sr lock';
        sr.textContent = '🔒';
      }
      b.appendChild(num);
      b.appendChild(si);
      b.appendChild(sr);
      b.setAttribute('aria-label', spotName(p) + ', ' + (open ? (v ? fmtT(v.best) + ', ' + v.stars + '/3' : '—') : t.locked));
      b.addEventListener('click', function () { if (isOpen(i)) startSpot(i); });
      box.appendChild(b);
      friendTimes(p).then(function (rows) {
        if (rows.length) setText(fr, rows[0].name + ' ' + fmtT(rows[0].t));
      }, noop);
    });
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
      if (e.key !== 'Escape') return;
      if (listOpen) closeList();
      else if (tool) setTool('');
      else closeCard();
    });
    $('speed').addEventListener('click', function () { setSpeed(speed === 1 ? 3 : 1); });
    $('pause').addEventListener('click', function () { setPause(!paused); });
    TOOLS.forEach(function (k) { $('tool-' + k).addEventListener('click', function () { onTool(k); }); });
    $('finishBtn').addEventListener('click', finish);
    $('hotBtn').addEventListener('click', function () { if (city) nextHot(); });
    $('mapBtn').addEventListener('click', openList);
    $('endMap').addEventListener('click', openList);
    $('listX').addEventListener('click', closeList);
    $('list').addEventListener('click', function (e) { if (e.target === $('list')) closeList(); });
    $('bud').addEventListener('animationend', function () { $('bud').classList.remove('low'); });
    card.addEventListener('animationend', function () { card.classList.remove('in'); });
    $('again').addEventListener('click', function () { startSpot(run ? run.idx : idx); });
    $('nextBtn').addEventListener('click', function () {
      var ni = (run ? run.idx : idx) + 1;
      if (ni < SP.length && isOpen(ni)) startSpot(ni);
    });
    $('shareBtn').addEventListener('click', onShare);
    $('retry').addEventListener('click', function () { saveRun(current); });
    $('tabS').addEventListener('click', function () { showTab('spot'); });
    $('tabF').addEventListener('click', function () { showTab('friends'); });
    $('tabG').addEventListener('click', function () { showTab('global'); });
    root.addEventListener('resize', onResize);
    if (typeof root.ResizeObserver === 'function') new root.ResizeObserver(onResize).observe(stage);
  }

  function installTest() {
    root.UBT = {
      city: function () { return city; },
      challenge: function () { return ch; },
      state: function () { return listOpen ? 'list' : phase; },
      act: function (a) { return doAct(a); },
      finishNow: function () {
        if (!ch || phase !== 'play') return phase;
        var guard = Math.ceil((city.end - city.time) / S.DT) + 100;
        while (!ch.cleared && !ch.failed && !city.done && guard-- > 0) {
          S.step(city, S.DT);
          S.updateChallenge(ch, city);
        }
        drain();
        checkRun();
        return phase;
      },
      screenOf: function (x, y) { return r.worldToScreen(x, y); },
      start: function (i) { startSpot(i); return idx; }
    };
  }

  function start() {
    if (started) return;
    started = true;
    S = root.Sim;
    SP = (root.UBScenario && root.UBScenario.spots) || [];
    cv = $('cv');
    stage = $('stage');
    card = $('card');
    r = root.Render.create(cv);
    bind();
    applyHost();
    r.resize();
    if (/[?&]test=1(&|$)/.test(String(root.location.search)) && root.__UBT_TEST === true) installTest();
    root.requestAnimationFrame(frame);
    syncProg();
    flushPending();
  }
  function adopt() {
    if (current && !current.saved && current.uid !== userId) {
      current = null;
      saveState = '';
    }
    syncProg();
    flushPending();
    if (phase !== 'play' && !$('end').hidden) loadBoard();
  }
  function onInit() {
    var u = usion();
    hostReady = true;
    fcache = {};
    try { userId = (u && u.user && typeof u.user.getId === 'function' && Usion.user.getId()) || null; } catch (e) { userId = null; }
    if (started) {
      applyHost();
      adopt();
    } else start();
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
