(function (root) {
  'use strict';

  var TXT = {
    mn: {
      lives: 'Амь', score: 'Оноо', lines: 'мөр', pick: 'Дуучнаа сонго', search: 'Хайх', packs: 'Багц',
      singers: 'Дуучид', none: 'Олдсонгүй', close: 'Хаах', again: 'Дахин', friends: 'Найзууд',
      global: 'Дэлхий', next: 'Дараагийн дуучин', perfect: 'Төгс!', done: 'Дууслаа', out: 'Амь дууслаа',
      saving: 'Хадгалж байна…', saved: 'Хадгалагдлаа', failed: 'Хадгалагдаагүй', guest: 'Нэвтэрч байж хадгална',
      retry: 'Дахин илгээх', loading: 'Ачаалж байна…', empty: 'Одоохондоо хоосон', error: 'Ачаалж чадсангүй',
      me: 'Би', mute: 'Дуу хаах', board: 'Тэргүүлэгчид', skip: 'Алгасах', start: 'Эхлэх', count: 'Дууны тоо'
    },
    en: {
      lives: 'Lives', score: 'Score', lines: 'lines', pick: 'Pick a singer', search: 'Search', packs: 'Packs',
      singers: 'Singers', none: 'No match', close: 'Close', again: 'Again', friends: 'Friends',
      global: 'Global', next: 'Next singer', perfect: 'Perfect!', done: 'Finished', out: 'Out of lives',
      saving: 'Saving…', saved: 'Saved', failed: 'Not saved', guest: 'Sign in to save',
      retry: 'Retry', loading: 'Loading…', empty: 'No records yet', error: 'Could not load',
      me: 'Me', mute: 'Mute', board: 'Leaderboard', skip: 'Skip', start: 'Start', count: 'Songs'
    }
  };
  var KEY_LAST = 'ubm:last';
  var KEY_N = 'ubm:n';
  var KEY_PEND = 'ubm:pend';
  var KEY_MUTE = 'ubm:mute';
  var BGM_VOL = 0.3;
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
  var MIX = {};
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
  var boardOpen = false;
  var boardEl = null;
  var boardNext = null;
  var pickCb = null;
  var endRes = null;
  var current = null;
  var pickerSel = [];
  var pickerN = C ? C.ROUND : 10;
  var roundN = C ? C.ROUND : 10;
  var nTouched = false;
  var tab = 'friends';
  var boardSeq = 0;
  var flushing = false;
  var countSeq = 0;
  var reduce = false;
  var bootCfg = null;
  var waiting = false;
  var bgm = null;
  var actx = null;
  var gainNode = null;
  var muted = false;
  var muteTouched = false;
  var wantUrl = '';
  var curUrl = '';
  var audioTried = false;
  var fadeTimer = 0;
  var musicSeq = 0;
  var hasOwn = Object.prototype.hasOwnProperty;

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
  function validCount(v) {
    return typeof v === 'number' && C && C.COUNTS && C.COUNTS.indexOf(v) >= 0 ? v : (C ? C.ROUND : 10);
  }
  function groupById(id) {
    if (typeof id !== 'string' || !id) return null;
    if (hasOwn.call(BY_ID, id)) return BY_ID[id];
    if (hasOwn.call(MIX, id)) return MIX[id];
    if (id.indexOf('+') < 0) return null;
    var raw = id.split('+');
    var seen = {};
    var parts = [];
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i];
      if (!hasOwn.call(BY_ID, p)) return null;
      if (!seen[p] && parts.length < 20) {
        seen[p] = true;
        parts.push(BY_ID[p]);
      }
    }
    if (!parts.length) return null;
    var g = C.mix(parts);
    if (!g) return null;
    if (hasOwn.call(MIX, g.id)) return MIX[g.id];
    if (g.mix) MIX[g.id] = g;
    return g;
  }
  function sourceGids(g) {
    return g && Array.isArray(g.mix) ? g.mix : g ? [g.id] : [];
  }
  function loadAllSeen(g) {
    var gids = sourceGids(g);
    return Promise.all(gids.map(loadSeen)).then(function (list) {
      var all = [];
      var seenSet = {};
      for (var i = 0; i < list.length; i++) {
        var arr = list[i].ids;
        for (var j = 0; j < arr.length; j++) {
          if (!seenSet[arr[j]]) {
            seenSet[arr[j]] = true;
            all.push(arr[j]);
          }
        }
      }
      return all;
    });
  }
  function loadCount() {
    if (!nTouched) roundN = validCount(lsGet(KEY_N));
    return sGet(KEY_N, FAST_MS).then(function (v) {
      if (!nTouched) roundN = validCount(v);
      return roundN;
    });
  }
  function excerpts(g) {
    return g.songs.reduce(function (n, s) { return n + s.x.length; }, 0);
  }
  function autoGroup() {
    var list = SORTED.filter(function (g) { return !g.pack; });
    if (list.length) loadSeen(list[0].id);
    return sGet(KEY_LAST, FAST_MS).then(function (gid) {
      var saved = groupById(gid);
      if (saved) return saved;
      var i = 0;
      function next() {
        if (i >= list.length) return list[0] || SORTED[0];
        var g = list[i++];
        return loadSeen(g.id).then(function (s) { return excerpts(g) - s.ids.length >= roundN ? g : next(); });
      }
      return next();
    });
  }

  function mediaImg(gid) {
    var m = root.MEDIA;
    return m && m.img && hasOwn.call(m.img, gid) && typeof m.img[gid] === 'string' ? m.img[gid] : '';
  }
  function mediaPre(gid, song) {
    var m = root.MEDIA;
    var g = m && m.pre && hasOwn.call(m.pre, gid) ? m.pre[gid] : null;
    return g && hasOwn.call(g, song) && typeof g[song] === 'string' ? g[song] : '';
  }
  function initials(name) {
    var w = String(name || '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!w.length) return '♪';
    return (Array.from(w[0])[0] + (w.length > 1 ? Array.from(w[1])[0] : '')).toUpperCase();
  }
  function paintAv(e, g) {
    if (!g) {
      e.textContent = '';
      e._avG = '';
      e._avU = '';
      e._avFail = '';
      return;
    }
    var url = mediaImg(g.id);
    if (e._avG === g.id && e._avU === url && (e.querySelector('.avimg') || !url || e._avFail === url)) return;
    e._avG = g.id;
    e._avU = url;
    e._avFail = '';
    var c = AV[C.seedOf(g.id) % AV.length];
    e.textContent = initials(g.name);
    e.style.background = 'linear-gradient(145deg,' + c[0] + ',' + c[1] + ')';
    e.classList.toggle('pack', !!g.pack);
    if (!url) return;
    var img = doc.createElement('img');
    img.className = 'avimg';
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.draggable = false;
    img.onerror = function () {
      e._avFail = url;
      if (img.parentNode === e) e.removeChild(img);
    };
    img.src = url;
    e.appendChild(img);
  }
  function paintHearts(box, lives) {
    var hs = box.children;
    for (var k = 0; k < hs.length; k++) hs[k].classList.toggle('off', k >= lives);
    box.setAttribute('aria-label', t.lives + ': ' + lives);
  }

  function ensureAudio() {
    if (!bgm) {
      bgm = $('bgm');
      if (!bgm) return;
      bgm.muted = muted;
    }
    if (!audioTried) {
      audioTried = true;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (AC) {
        var ctx = null;
        try {
          ctx = new AC();
          var srcNode = ctx.createMediaElementSource(bgm);
          var gn = ctx.createGain();
          gn.gain.value = muted ? 0 : BGM_VOL;
          srcNode.connect(gn);
          gn.connect(ctx.destination);
          actx = ctx;
          gainNode = gn;
        } catch (e) {
          if (ctx && typeof ctx.close === 'function') attempt(function () { return ctx.close(); }).catch(noop);
          actx = null;
          gainNode = null;
        }
      }
      if (!gainNode) bgm.volume = muted ? 0 : BGM_VOL;
    }
  }
  function setGain(v, ms) {
    if (!bgm) return;
    var target = muted ? 0 : v;
    if (gainNode && actx && actx.state !== 'closed') {
      var now = actx.currentTime;
      var g = gainNode.gain;
      g.cancelScheduledValues(now);
      if (ms > 0 && actx.state === 'running') {
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(target, now + ms / 1000);
      } else {
        g.setValueAtTime(target, now);
      }
    } else {
      bgm.volume = target;
    }
  }
  function applyMute(on) {
    muted = !!on;
    if (bgm) {
      bgm.muted = muted;
      if (muted && !bgm.paused) bgm.pause();
    }
    setGain(muted ? 0 : BGM_VOL, 0);
    var btn = $('muteBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', String(muted));
      btn.classList.toggle('off', muted);
    }
  }
  function loadMute() {
    if (!muteTouched) applyMute(!!lsGet(KEY_MUTE));
    sGet(KEY_MUTE, FAST_MS).then(function (v) {
      if (!muteTouched && typeof v === 'boolean') {
        var wasMuted = muted;
        applyMute(v);
        if (wasMuted && !muted && wantUrl && shouldPlay()) musicResume();
      }
    });
  }
  function shouldPlay() {
    return scr === 'round' && !pickerOpen && !doc.hidden && !!R && !R.over;
  }
  function resumeActx() {
    if (actx && actx.state !== 'running' && actx.state !== 'closed') {
      attempt(function () { return actx.resume(); }).catch(noop);
    }
  }
  function tryPlay() {
    if (!bgm || muted || !shouldPlay()) return;
    resumeActx();
    attempt(function () { return bgm.play(); }).catch(noop);
  }
  function musicStop() {
    var seq = ++musicSeq;
    clearTimeout(fadeTimer);
    fadeTimer = 0;
    if (!bgm || bgm.paused) return;
    if (doc.hidden) {
      setGain(0, 0);
      bgm.pause();
      return;
    }
    setGain(0, 250);
    fadeTimer = setTimeout(function () {
      fadeTimer = 0;
      if (seq === musicSeq && bgm) bgm.pause();
    }, 250);
  }
  function musicPause() {
    musicSeq++;
    clearTimeout(fadeTimer);
    fadeTimer = 0;
    if (bgm && !bgm.paused) {
      setGain(0, 0);
      bgm.pause();
    }
  }
  function musicResume() {
    if (!wantUrl || muted || !shouldPlay()) return;
    ensureAudio();
    if (!bgm) return;
    musicSeq++;
    clearTimeout(fadeTimer);
    fadeTimer = 0;
    if (curUrl !== wantUrl) {
      curUrl = wantUrl;
      bgm.src = wantUrl;
    }
    if (bgm.paused) {
      setGain(0, 0);
      tryPlay();
      setGain(BGM_VOL, 400);
    } else {
      setGain(BGM_VOL, 400);
    }
  }
  function music(Q) {
    var gid = Q && Q.gid ? Q.gid : (R && R.g ? R.g.id : '');
    var url = Q && gid ? mediaPre(gid, Q.song) : '';
    var srcEl = $('songSrc');
    if (srcEl) srcEl.hidden = !url;
    if (!url) {
      wantUrl = '';
      musicStop();
      return;
    }
    wantUrl = url;
    ensureAudio();
    if (!bgm) return;
    var seq = ++musicSeq;
    clearTimeout(fadeTimer);
    fadeTimer = 0;
    if (curUrl === url) {
      if (!bgm.paused) {
        setGain(BGM_VOL, 400);
        return;
      }
      if (!muted && shouldPlay()) {
        setGain(0, 0);
        tryPlay();
        setGain(BGM_VOL, 400);
      }
      return;
    }
    if (curUrl && !bgm.paused && !muted && shouldPlay()) {
      setGain(0, 250);
      fadeTimer = setTimeout(function () {
        fadeTimer = 0;
        if (seq !== musicSeq || !bgm) return;
        curUrl = url;
        bgm.src = url;
        if (!muted && shouldPlay()) {
          tryPlay();
          setGain(BGM_VOL, 400);
        }
      }, 250);
      return;
    }
    curUrl = url;
    bgm.src = url;
    if (!muted && shouldPlay()) {
      setGain(0, 0);
      tryPlay();
      setGain(BGM_VOL, 400);
    }
  }
  function toggleMute() {
    muteTouched = true;
    applyMute(!muted);
    sSet(KEY_MUTE, muted);
    if (!muted && wantUrl && shouldPlay()) {
      ensureAudio();
      if (bgm && bgm.paused) {
        setGain(0, 0);
        tryPlay();
        setGain(BGM_VOL, 400);
      }
    }
  }
  function onVisChange() {
    syncClock();
    if (doc.hidden) musicPause();
    else if (wantUrl && !muted && shouldPlay()) musicResume();
  }
  function onUnlock() {
    resumeActx();
    if (wantUrl && !muted && shouldPlay()) {
      ensureAudio();
      if (bgm && bgm.paused) {
        musicResume();
      }
    }
  }

  function screen(name) {
    closeBoard();
    scr = name;
    var els = doc.querySelectorAll('[data-screen]');
    for (var i = 0; i < els.length; i++) els[i].hidden = els[i].getAttribute('data-screen') !== name;
    if (name !== 'round') {
      soloSeq++;
      if (R && !R.over) {
        R.over = true;
        clearTimeout(R.timer);
      }
      wantUrl = '';
      musicStop();
    }
    closePicker(true);
    return scr;
  }

  function syncClock() {
    if (!R || R.over) return;
    var stop = (doc.hidden && R.mode !== 'race') || pickerOpen || (boardOpen && R.mode !== 'race');
    if (stop && !R.pausedAt) R.pausedAt = clock();
    else if (!stop && R.pausedAt) {
      R.t0 += clock() - R.pausedAt;
      R.pausedAt = 0;
    }
  }
  function elapsed() { return Math.max(0, Math.round((R.pausedAt || clock()) - R.t0)); }

  function solo() {
    var seq = ++soloSeq;
    return Promise.all([autoGroup(), loadCount()]).then(function (res) {
      if (seq === soloSeq && res[0]) playSolo(res[0], res[1]);
    });
  }
  function playSolo(g, n) {
    var seq = ++soloSeq;
    var count = n != null ? validCount(n) : roundN;
    return loadAllSeen(g).then(function (seenIds) {
      if (seq !== soloSeq) return;
      var rnd = C.rng((Math.random() * 4294967296) >>> 0);
      var qs = C.round(g, C.pickRefs(g, seenIds, count, rnd), rnd);
      if (qs.length) startRound({ group: g, qs: qs, n: count, mode: 'solo' });
    });
  }
  function startRound(o) {
    o = o || {};
    var g = typeof o.group === 'string' ? groupById(o.group) : o.group;
    if (!g) return;
    var race = o.mode === 'race';
    if (!Array.isArray(o.qs) || !o.qs.length) {
      if (!race) playSolo(g, o.n);
      return;
    }
    var from = Math.max(0, Math.min(o.qs.length, o.from | 0));
    soloSeq++;
    if (R) {
      R.over = true;
      clearTimeout(R.timer);
    }
    R = {
      g: g, qs: o.qs, n: o.n != null ? validCount(o.n) : o.qs.length, mode: race ? 'race' : 'solo', onLine: o.onLine, onEnd: o.onEnd,
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
    if (R.mode === 'solo') markSeen(R.qs[R.i].gid || R.g.id, R.qs[R.i].id);
    renderQ();
    renderHud();
  }
  function renderHud() {
    var Q = R && R.i >= 0 && R.i < R.qs.length ? R.qs[R.i] : null;
    var qg = Q && Q.gid ? groupById(Q.gid) : null;
    var g = qg || (R && R.g);
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
    music(Q);
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
  function revealRest(then) {
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
    r.timer = setTimeout(function () { if (R === r && !r.over) then(); }, LOST_MS);
  }
  function lineLost() { revealRest(finish); }
  function skip() { if (R && !R.over && !R.lock) revealRest(nextQ); }
  function finish() {
    var r = R;
    r.over = true;
    clearTimeout(r.timer);
    var res = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      uid: userId, mode: r.mode, gid: r.g.id, n: r.n || r.qs.length, score: r.score, lives: r.lives, lines: r.lines,
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
    renderGrid($('endPk'), '', function (g) { pickSolo(g, roundN); });
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
    var g = groupById(r.gid);
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

  function boardScore(r) {
    return Math.round((r.score || 0) * C.ROUND / Math.max(1, r.total || r.n || C.ROUND));
  }
  function pendingOf(res) {
    return { id: res.id, uid: res.uid, score: res.score, lines: res.lines, gid: res.gid, n: res.n || res.total || C.ROUND, total: res.total || res.n || C.ROUND };
  }
  function writePending(res) {
    return sGet(KEY_PEND).then(function (p) {
      if (p && p.uid === res.uid && p.id !== res.id && typeof p.score === 'number' && boardScore(p) >= boardScore(res)) return;
      return sSet(KEY_PEND, pendingOf(res));
    });
  }
  function clearPendingAfter(res) {
    return sGet(KEY_PEND).then(function (p) {
      if (!p) return;
      if (p.id === res.id || !(boardScore(p) > boardScore(res))) return sSet(KEY_PEND, null);
      flushPending();
    });
  }
  function submit(res) {
    if (!lbApi('submit')) return Promise.reject({ code: 'UNAVAILABLE' });
    return timed(attempt(function () {
      return Usion.leaderboard.submit(boardScore(res), { lines: res.lines, singer: res.gid, n: res.total || res.n || C.ROUND, score: res.score });
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

  function checkBadge() {
    var s = el('span', 'ck');
    s.setAttribute('aria-hidden', 'true');
    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M3.2 8.4l3.1 3.1 6.5-6.8');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.6');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    s.appendChild(svg);
    return s;
  }
  function togglePick(g, b) {
    var at = pickerSel.indexOf(g.id);
    if (at >= 0) pickerSel.splice(at, 1);
    else {
      if (pickerSel.length >= 20) return;
      pickerSel.push(g.id);
    }
    var on = at < 0;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    renderPickerFoot();
  }
  function renderGrid(box, q, onPick, curId, opts) {
    var multi = !!(opts && opts.multi);
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
        var on = multi ? pickerSel.indexOf(g.id) >= 0 : g.id === cur;
        var b = el('button', 'sg' + (multi ? (on ? ' on' : '') : (on ? ' cur' : '')));
        var av = el('span', 'av');
        b.type = 'button';
        b.setAttribute('data-gid', g.id);
        if (multi) b.setAttribute('aria-pressed', String(on));
        av.setAttribute('aria-hidden', 'true');
        paintAv(av, g);
        b.appendChild(av);
        if (multi) b.appendChild(checkBadge());
        b.appendChild(el('span', 'nm' + (/[^\s.,()]{11,}/.test(g.name) ? ' sm' : ''), g.name));
        b.addEventListener('click', function () {
          if (multi) togglePick(g, b);
          else onPick(g);
        });
        grid.appendChild(b);
      });
      box.appendChild(grid);
    });
    if (!any) box.appendChild(el('p', 'none', t.none));
  }
  function renderPickerFoot() {
    var bs = $('pkCounts').querySelectorAll('button[data-n]');
    for (var i = 0; i < bs.length; i++) {
      var n = Number(bs[i].getAttribute('data-n'));
      bs[i].setAttribute('aria-checked', String(n === pickerN));
    }
    var k = pickerSel.length;
    var go = $('pkGo');
    go.disabled = k === 0;
    setText(go, k > 0 ? t.start + ' (' + k + ')' : t.start);
  }
  function pickSolo(g, n) {
    var count = n != null ? validCount(n) : roundN;
    nTouched = true;
    roundN = count;
    sSet(KEY_LAST, g.id);
    sSet(KEY_N, count);
    playSolo(g, count);
  }
  function openPicker(onPick, curId, curN) {
    pickCb = typeof onPick === 'function' ? onPick : pickSolo;
    var initId = curId !== undefined ? curId : (R && R.g ? R.g.id : '');
    var initG = initId ? groupById(initId) : null;
    pickerSel = initG ? sourceGids(initG).slice(0, 20) : [];
    pickerN = validCount(curN !== undefined ? curN : roundN);
    pickerOpen = true;
    $('pkQ').value = '';
    renderGrid($('pkList'), '', null, null, { multi: true });
    renderPickerFoot();
    $('pkList').scrollTop = 0;
    $('picker').hidden = false;
    syncClock();
    musicStop();
  }
  function closePicker(skipMusic) {
    if (!pickerOpen) return;
    pickerOpen = false;
    $('picker').hidden = true;
    syncClock();
    if (!skipMusic && wantUrl && !muted && shouldPlay()) musicResume();
  }
  function confirmPicker() {
    if (!pickerSel.length) return;
    var g = groupById(pickerSel.join('+'));
    if (!g) return;
    var n = pickerN;
    var cb = pickCb;
    closePicker(true);
    call(cb, g, n);
  }
  function openBoard() {
    if (boardOpen || !boardEl) return;
    boardOpen = true;
    $('boardBody').appendChild(boardEl);
    $('boardDlg').hidden = false;
    syncClock();
    loadBoard();
  }
  function closeBoard() {
    if (!boardOpen) return;
    boardOpen = false;
    $('boardDlg').hidden = true;
    boardNext.parentNode.insertBefore(boardEl, boardNext);
    syncClock();
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
    if (pickerOpen) {
      renderGrid($('pkList'), $('pkQ').value, null, null, { multi: true });
      renderPickerFoot();
    }
    if (scr === 'end' && endRes) {
      renderEnd();
      renderGrid($('endPk'), $('endQ').value, function (g) { pickSolo(g, roundN); });
      loadBoard();
    }
  }

  function bind() {
    try { reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    $('chip').addEventListener('click', function () { if (R && R.mode !== 'race') openPicker(); });
    $('pkX').addEventListener('click', function () { closePicker(); });
    boardEl = doc.querySelector('.board');
    boardNext = boardEl.nextSibling;
    $('lbBtn').addEventListener('click', openBoard);
    $('skipBtn').addEventListener('click', skip);
    $('boardX').addEventListener('click', closeBoard);
    $('boardDlg').addEventListener('click', function (e) { if (e.target === $('boardDlg')) closeBoard(); });
    $('picker').addEventListener('click', function (e) { if (e.target === $('picker')) closePicker(); });
    $('pkQ').addEventListener('input', function () { renderGrid($('pkList'), $('pkQ').value, null, null, { multi: true }); });
    $('pkCounts').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-n]');
      if (!b) return;
      pickerN = validCount(Number(b.getAttribute('data-n')));
      renderPickerFoot();
    });
    $('pkGo').addEventListener('click', confirmPicker);
    $('endQ').addEventListener('input', function () { renderGrid($('endPk'), $('endQ').value, function (g) { pickSolo(g, roundN); }); });
    $('again').addEventListener('click', function () {
      var g = endRes && groupById(endRes.gid);
      if (g) playSolo(g, roundN);
    });
    $('retry').addEventListener('click', function () { submitScore(current); });
    $('tabF').addEventListener('click', function () { showTab('friends'); });
    $('tabG').addEventListener('click', function () { showTab('global'); });
    $('muteBtn').addEventListener('click', toggleMute);
    doc.addEventListener('visibilitychange', onVisChange);
    doc.addEventListener('pointerdown', onUnlock, { capture: true, passive: true });
    doc.addEventListener('touchend', onUnlock, { capture: true, passive: true });
    doc.addEventListener('click', onUnlock, { capture: true, passive: true });
    doc.addEventListener('touchstart', noop, { passive: true });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePicker(); closeBoard(); } });
    doc.addEventListener('contextmenu', function (e) { if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); });
  }

  function start(cfg) {
    if (started) return;
    started = true;
    bind();
    loadMute();
    loadCount();
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
    loadMute();
    loadCount();
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
    groupById: groupById,
    groups: function () { return SORTED.slice(); },
    screen: screen,
    state: function () {
      return { screen: scr, groupId: R ? R.g.id : null, q: R ? R.i : -1, lives: R ? R.lives : C.LIVES, score: R ? R.score : 0, total: R ? R.qs.length : 0, n: roundN };
    },
    current: function () { return R && R.i >= 0 && R.i < R.qs.length ? R.qs[R.i] : null; },
    music: function () {
      return {
        src: bgm ? (bgm.getAttribute('src') || bgm.src || '') : '',
        playing: !!(bgm && !bgm.paused && !bgm.ended && !muted && !bgm.muted && (bgm.getAttribute('src') || bgm.src)),
        muted: !!muted
      };
    }
  };

  boot();
})(this);
