(function (root) {
  'use strict';

  var UBM = root.UBM;
  var C = root.UBMCore;
  if (!UBM || !C) return;

  var MAX = 8;
  var GRACE_MS = 20000;
  var MATCH_MS = 180000;
  var CHAT_MAX = 60;
  var CHAT_GAP = 700;
  var ECHO_MS = 6000;
  var QUIET_MS = 20000;
  var KEY_REP = 'ubm:rep:';
  var KEY_RACED = 'ubm:raced:';

  UBM.addStrings({
    mn: {
      players: 'Тоглогчид', host: 'Хост', ready: 'Бэлэн', readyOn: '✓ Бэлэн', start: 'Эхлэх', invite: '+ Урих',
      soloPlay: 'Ганцаараа тоглох', waitHost: 'Хост эхлүүлэхийг хүлээж байна…', hostPicks: 'Хост дуучин сонгоно',
      change: 'Дуучин солих', running: 'Тоглолт явж байна. Дараагийнхыг хүлээнэ үү.', waitOthers: 'Бусдыг хүлээж байна…',
      youWon: 'Чи түрүүллээ!', won: '%s түрүүллээ!', draw: 'Тэнцлээ!', hostLeft: 'Хост гарсан байна.', left: 'гарсан', away: 'ганцаараа', hallBack: 'Танхим руу',
      chat: 'Чат', chatPh: 'Өөрөө бичих…', send: 'Илгээх', reconnecting: 'Холболт сэргээж байна…',
      connecting: 'Холбогдож байна…', connFail: 'Холбогдож чадсангүй', reconnect: 'Дахин холбогдох', player: 'Тоглогч',
      phrases: ['Сайн уу! 👋', 'Амжилт!', 'Хурдан байна шүү!', 'Энийг мэдэхгүй нээ 😅', 'Ха ха 😂', 'Дахиад нэг!', 'Гайхалтай!', 'Би түрүүлнэ 😎']
    },
    en: {
      players: 'Players', host: 'Host', ready: 'Ready', readyOn: '✓ Ready', start: 'Start', invite: '+ Invite',
      soloPlay: 'Play solo', waitHost: 'Waiting for the host…', hostPicks: 'The host picks a singer',
      change: 'Change singer', running: 'A match is on. Wait for the next one.', waitOthers: 'Waiting for others…',
      youWon: 'You won!', won: '%s won!', draw: 'It is a draw!', hostLeft: 'The host has left.', left: 'left', away: 'solo', hallBack: 'Back to lobby',
      chat: 'Chat', chatPh: 'Type a message…', send: 'Send', reconnecting: 'Reconnecting…',
      connecting: 'Connecting…', connFail: 'Could not connect', reconnect: 'Reconnect', player: 'Player',
      phrases: ['Hi! 👋', 'Good luck!', 'You are fast!', 'No idea on this one 😅', 'Haha 😂', 'One more!', 'Amazing!', 'I am winning 😎']
    }
  });

  var doc = root.document;
  var me = null;
  var room = null;
  var inRoom = false;
  var joinedOk = false;
  var joinFail = false;
  var hostId = null;
  var order = [];
  var present = {};
  var infos = {};
  var leftAt = {};
  var ready = false;
  var away = false;
  var pickGid = null;
  var buf = {};
  var holeAt = 0;
  var syncAt = 0;
  var lastSeq = 0;
  var matches = {};
  var latest = null;
  var shownM = null;
  var racingM = null;
  var raceLive = false;
  var resM = null;
  var echo = null;
  var lastIn = 0;
  var lastTick = 0;
  var lastCatch = 0;
  var pump = 0;
  var lastChat = 0;
  var chatFrom = {};
  var reported = {};
  var sigs = {};
  var wired = false;
  var pendingStart = null;

  function $(id) { return doc.getElementById(id); }
  function noop() {}
  function t(k) { return UBM.t(k); }
  function now() { return Date.now(); }
  function el(tag, cls, txt) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function setText(e, s) { if (e.textContent !== s) e.textContent = s; }
  function attempt(f) {
    try { return Promise.resolve(f()); } catch (e) { return Promise.reject(e); }
  }
  function game(m) {
    var u = root.Usion;
    var g = u && u.game;
    return g && typeof g[m] === 'function' ? g : null;
  }
  function launchedSolo(config) {
    try {
      var lp = (root.Usion && Usion.getLaunchParams && Usion.getLaunchParams()) || {};
      if (lp.mode === 'single') return true;
      if (lp.mode === 'multiplayer') return false;
      if (Usion.game && typeof Usion.game.isMultiplayer === 'function') return !Usion.game.isMultiplayer();
      var rid = config && config.roomId ? String(config.roomId) : '';
      return !rid || /^standalone[_-]/i.test(rid);
    } catch (e) { return false; }
  }
  function str(v, max) {
    return typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
  }
  function isHost() { return !!me && hostId === me; }
  function here() { return order.filter(function (id) { return present[id]; }); }
  function players() { return here().filter(function (id) { return !(infos[id] && infos[id].away); }); }
  function isReady(id) { return id === me ? ready : !!(infos[id] && infos[id].ready); }
  function nameOf(id) {
    var n = infos[id] && infos[id].name;
    if (!n && id === me) n = myInfo().name;
    return n || t('player');
  }
  function mine(M) { return !!M && M.roster.indexOf(me) >= 0; }
  function gone(id) { return id !== me && !present[id] && !!leftAt[id] && now() - leftAt[id] >= GRACE_MS; }
  function defaultPick() {
    var gid = UBM.state().groupId;
    if (gid && UBM.groupById(gid)) return gid;
    var list = UBM.groups().filter(function (g) { return !g.pack; });
    return list.length ? list[0].id : null;
  }
  function avatarOf(id) {
    var a = infos[id] && infos[id].avatar;
    if (a) {
      var img = el('img', 'av');
      img.src = a;
      img.alt = '';
      img.draggable = false;
      img.onerror = function () { img.style.visibility = 'hidden'; };
      return img;
    }
    var s = el('span', 'av');
    s.setAttribute('aria-hidden', 'true');
    UBM.avatar(s, { id: String(id), name: nameOf(id) });
    return s;
  }

  function myInfo() {
    var u = root.Usion && root.Usion.user;
    var name = '';
    var av = '';
    try { name = str((u && typeof u.getName === 'function' && u.getName()) || '', 40); } catch (e) {}
    try { av = (u && typeof u.getAvatar === 'function' && u.getAvatar()) || ''; } catch (e) {}
    return { name: name, avatar: /^https?:/.test(av) ? av : '', ready: ready, away: away };
  }
  function rt(type, data) {
    if (!joinedOk || !game('realtime')) return;
    attempt(function () { return Usion.game.realtime(type, data); }).catch(noop);
  }
  function sendInfo() {
    if (!me) return;
    infos[me] = myInfo();
    rt('player_info', infos[me]);
    renderAll();
  }
  function sendPick() {
    if (isHost() && pickGid) rt('pick', { gid: pickGid });
  }
  function requestSync(seq) {
    if (!joinedOk || !game('requestSync')) return;
    syncAt = now();
    attempt(function () { return Usion.game.requestSync(seq); }).catch(noop);
  }
  function behind() {
    return (!!syncAt && now() - syncAt < 5000) || Object.keys(buf).length > 0;
  }
  function catchUp() {
    if (now() - lastCatch < 5000) return;
    lastCatch = now();
    requestSync(lastSeq);
  }
  function pumpSync() {
    var from = lastSeq;
    var until = now() + 60000;
    clearInterval(pump);
    requestSync(lastSeq);
    pump = setInterval(function () {
      if (lastSeq > from || now() > until || !inRoom) { clearInterval(pump); return; }
      requestSync(lastSeq);
    }, 1200);
  }

  function reset(roomId) {
    room = roomId;
    inRoom = true;
    joinedOk = false;
    joinFail = false;
    hostId = null;
    order = [];
    present = {};
    infos = {};
    leftAt = {};
    ready = false;
    away = false;
    buf = {};
    holeAt = 0;
    syncAt = 0;
    lastSeq = 0;
    matches = {};
    latest = null;
    shownM = null;
    racingM = null;
    raceLive = false;
    resM = null;
    echo = null;
    pendingStart = null;
    sigs = {};
    clearInterval(pump);
  }
  function enter(roomId, ids) {
    reset(roomId);
    (Array.isArray(ids) ? ids : []).forEach(function (id) { if (id && order.indexOf(id) < 0) order.push(id); });
    hostId = order[0] || null;
    if (me && order.indexOf(me) < 0) order.push(me);
    showHall();
    join();
  }
  function join() {
    joinFail = false;
    renderHall();
    if (!game('connect') || !game('join')) { joinFail = true; renderHall(); return; }
    attempt(function () { return Usion.game.connect(); }).then(function () {
      return Usion.game.join(room);
    }).then(noop, function () {
      if (joinedOk) return;
      joinFail = true;
      renderHall();
    });
  }
  function arrive(id) {
    if (!id) return;
    if (order.indexOf(id) < 0) order.push(id);
    present[id] = true;
    delete leftAt[id];
  }
  function depart(id) {
    if (!id || id === me || !present[id]) return;
    delete present[id];
    if (!leftAt[id]) leftAt[id] = now();
  }

  function onJoined(d) {
    if (!inRoom) return;
    d = d || {};
    joinedOk = true;
    joinFail = false;
    var ids = Array.isArray(d.player_ids) ? d.player_ids.filter(function (id) { return typeof id === 'string' && id; }) : [];
    if (ids.length) order = ids.slice();
    present = {};
    ids.forEach(arrive);
    arrive(me);
    hostId = d.host_id || ids[0] || hostId || order[0];
    if (hostId && !present[hostId] && !leftAt[hostId]) leftAt[hostId] = now();
    if (isHost() && !pickGid) pickGid = defaultPick();
    lastIn = now();
    sendInfo();
    sendPick();
    requestSync(lastSeq);
  }
  function onPlayerJoined(d) {
    if (!inRoom || !d) return;
    (Array.isArray(d.player_ids) ? d.player_ids : [d.player_id]).forEach(arrive);
    lastIn = now();
    sendInfo();
    sendPick();
  }
  function onPlayerLeft(d) {
    if (!inRoom || !d) return;
    depart(d.player_id);
    if (Array.isArray(d.player_ids)) here().forEach(function (id) { if (d.player_ids.indexOf(id) < 0) depart(id); });
    renderAll();
  }
  function onRoomAssigned(d) {
    reset(d && d.roomId);
    hostId = me;
    order = me ? [me] : [];
    if (!pickGid) pickGid = defaultPick();
    showHall();
  }
  function onConn(s) {
    $('conn').hidden = !(inRoom && (s === 'disconnected' || s === 'rejoining'));
    if (s === 'reconnected') pumpSync();
  }
  function onRealtime(m) {
    if (!inRoom || !m || m.player_id === me) return;
    var d = m.action_data || {};
    var id = m.player_id;
    lastIn = now();
    if (m.action_type === 'player_info') {
      infos[id] = { name: str(d.name, 40), avatar: typeof d.avatar === 'string' && /^https?:/.test(d.avatar) ? d.avatar : '', ready: d.ready === true, away: d.away === true };
      renderAll();
    } else if (m.action_type === 'pick') {
      if (id === hostId) setPick(d.gid, false);
    } else if (m.action_type === 'quick_chat') {
      var ph = normChat(d.phrase);
      if (ph && now() - (chatFrom[id] || 0) >= CHAT_GAP) {
        chatFrom[id] = now();
        bubble(id, ph);
      }
    }
  }
  function seqOf(a) { return a && typeof a.sequence === 'number' && a.sequence > 0 ? a.sequence : 0; }
  function drain() {
    var any = false;
    while (buf[lastSeq + 1]) {
      var a = buf[lastSeq + 1];
      delete buf[lastSeq + 1];
      lastSeq++;
      if (apply(a)) any = true;
    }
    if (!Object.keys(buf).length) holeAt = 0;
    else if (!holeAt) holeAt = now();
    return any;
  }
  function onAction(m) {
    if (!inRoom || !m || typeof m.action_type !== 'string') return;
    var seq = seqOf(m);
    var any = false;
    if (!seq) any = apply(m);
    else if (seq > lastSeq) {
      buf[seq] = m;
      any = drain();
      if (holeAt) pumpSync();
    }
    if (any) {
      lastIn = now();
      react();
    }
  }
  function onSync(d) {
    if (!inRoom) return;
    clearInterval(pump);
    syncAt = 0;
    lastIn = now();
    (d && Array.isArray(d.actions) ? d.actions : []).forEach(function (a) {
      var seq = seqOf(a);
      if (seq > lastSeq) buf[seq] = a;
      else if (!seq && a && typeof a.action_type === 'string') apply(a);
    });
    drain();
    if (holeAt && now() - holeAt > 10000) {
      lastSeq = Math.min.apply(null, Object.keys(buf).map(Number)) - 1;
      drain();
    }
    react();
  }
  function apply(a) {
    if (!a || typeof a.action_type !== 'string') return false;
    var seq = seqOf(a);
    var d = a.action_data || {};
    if (a.action_type === 'start') {
      if (typeof d.m !== 'string' || matches[d.m] || !UBM.groupById(d.gid) || !Array.isArray(d.roster)) return false;
      var roster = d.roster.filter(function (id, i) { return typeof id === 'string' && d.roster.indexOf(id) === i; }).slice(0, MAX);
      var M = matches[d.m] = { m: d.m, seed: d.seed >>> 0, gid: d.gid, roster: roster, acts: [], at: now(), seq: seq, ended: false, upto: 0 };
      if (!latest || seq >= latest.seq) latest = M;
      if (pendingStart && pendingStart.m === d.m) pendingStart = null;
      return true;
    }
    if (a.action_type === 'end') {
      var E = matches[d.m];
      if (!E || E.ended) return false;
      E.ended = true;
      E.upto = typeof d.upto === 'number' && d.upto >= 0 ? d.upto : seq;
      E.fresh = true;
      return true;
    }
    if (a.action_type === 'ans') {
      var M2 = matches[d.m];
      var q = d.q | 0;
      if (!M2 || M2.roster.indexOf(a.player_id) < 0 || q < 0 || q >= C.ROUND) return false;
      if (M2.ended && !(seq && seq <= M2.upto)) return false;
      M2.acts.push({ player_id: a.player_id, q: q, ok: d.ok === true, ms: Math.min(3600000, Math.max(0, +d.ms || 0)), lives: Math.max(0, Math.min(C.LIVES, d.lives | 0)), seq: seq });
      if (a.player_id === me && echo && echo.q === q) echo = null;
      return true;
    }
    return false;
  }

  function actsOf(M) {
    return M.ended ? M.acts.filter(function (a) { return !a.seq || a.seq <= M.upto; }) : M.acts;
  }
  function rowsOf(M) { return C.standings(M.roster, actsOf(M)); }
  function rowOf(M, id) { return rowsOf(M).filter(function (r) { return r.id === id; })[0] || null; }
  function isDraw(rs) {
    return !rs.length || rs[0].score === 0 || (!!rs[1] && rs[1].score === rs[0].score && rs[1].ms === rs[0].ms);
  }
  function okCount(M, id) {
    var qs = {};
    actsOf(M).forEach(function (a) { if (a.player_id === id && a.ok) qs[a.q] = true; });
    return Object.keys(qs).length;
  }
  function react() {
    var M = latest;
    if (M && shownM !== M.m) {
      shownM = M.m;
      ready = false;
      Object.keys(infos).forEach(function (id) { infos[id].ready = false; });
    }
    Object.keys(matches).forEach(function (k) {
      if (!matches[k].fresh) return;
      matches[k].fresh = false;
      onEnded(matches[k]);
    });
    if (M) {
      checkEnd(M);
      if (mine(M) && !M.ended && racingM !== M.m) enterRace(M);
    }
    renderAll();
  }
  function enterRace(M) {
    var g = UBM.groupById(M.gid);
    racingM = M.m;
    if (!M.qs) {
      var rnd = C.rng(M.seed);
      M.qs = C.round(g, C.pickRefs(g, [], C.ROUND, rnd), rnd);
    }
    var row = rowOf(M, me);
    if (row && row.done) { finishMine(M, null); return; }
    raceLive = true;
    closeChat();
    UBM.startRound({
      group: g, qs: M.qs, mode: 'race',
      from: row ? row.answered : 0, lives: row ? row.lives : C.LIVES, score: row ? row.score : 0, lines: okCount(M, me),
      onLine: function (q, ok, ms, lives) { sendAns(M, { m: M.m, q: q, ok: ok, ms: ms, lives: lives }, 1); },
      onEnd: function (res) { finishMine(M, res); }
    });
    renderStrip();
  }
  function sendAns(M, data, tries) {
    echo = { q: data.q, at: now() };
    if (!game('action')) return;
    attempt(function () { return Usion.game.action('ans', data); }).catch(function () {
      if (tries > 0 && inRoom && !M.ended) setTimeout(function () { sendAns(M, data, tries - 1); }, 1500);
    });
  }
  function buildRes(M) {
    var row = rowOf(M, me) || { score: 0, answered: 0, lives: 0 };
    return {
      id: 'race-' + M.m + '-' + me, uid: UBM.userId(), mode: 'race', gid: M.gid, score: row.score,
      lives: row.lives, lines: okCount(M, me), answered: row.answered, total: C.ROUND
    };
  }
  function raced() {
    try { return JSON.parse(root.localStorage.getItem(KEY_RACED + me) || '[]') || []; } catch (e) { return []; }
  }
  function submitMine(M, res) {
    if (M.res) return;
    var r = res || buildRes(M);
    r.id = 'race-' + M.m + '-' + me;
    r.mode = 'race';
    r.gid = M.gid;
    M.res = r;
    var list = raced();
    if (list.indexOf(M.m) >= 0) return;
    try { root.localStorage.setItem(KEY_RACED + me, JSON.stringify(list.concat([M.m]).slice(-30))); } catch (e) {}
    UBM.submitScore(r, function () { if (resM === M) renderResults(true); });
  }
  function finishMine(M, res) {
    raceLive = false;
    submitMine(M, res);
    showResults(M);
    checkEnd(M);
  }
  function checkEnd(M) {
    if (!M || M.ended || M.endSent || !joinedOk || behind()) return;
    M.roster.forEach(function (id) { if (id !== me && !present[id] && !leftAt[id]) leftAt[id] = now(); });
    var rs = C.standings(M.roster, M.acts);
    if (now() - M.at >= MATCH_MS || rs.every(function (r) { return r.done || gone(r.id); })) sendEnd(M);
  }
  function sendEnd(M) {
    if (!game('action')) return;
    M.endSent = true;
    attempt(function () { return Usion.game.action('end', { m: M.m, upto: lastSeq }); }).then(function (a) {
      if (a && a.success === false) M.endSent = false;
    }, function () { M.endSent = false; });
  }
  function onEnded(M) {
    if (mine(M)) {
      submitMine(M, null);
      if (raceLive && racingM === M.m) {
        raceLive = false;
        showResults(M);
      }
    }
    if (isHost()) report(M);
  }
  function report(M) {
    var key = KEY_REP + room;
    var done = [];
    try { done = JSON.parse(root.localStorage.getItem(key) || '[]'); } catch (e) {}
    if (!Array.isArray(done)) done = [];
    var rs = rowsOf(M);
    if (reported[M.m] || done.indexOf(M.m) >= 0 || !rs.length || !game('reportResult')) return;
    reported[M.m] = true;
    try { root.localStorage.setItem(key, JSON.stringify(done.concat([M.m]).slice(-30))); } catch (e) {}
    var scores = {};
    rs.forEach(function (r) { scores[r.id] = r.score; });
    var shown = rs.map(function (r) { return r.score; }).join(' : ');
    var data = isDraw(rs) ? { draw: true, scores: scores, displayScore: shown } : {
      winnerId: rs[0].id, standings: rs.map(function (r) { return r.id; }), scores: scores, displayScore: shown
    };
    var send = function (n) {
      attempt(function () { return Usion.game.reportResult(data); }).then(function (a) {
        if (a && a.success === false && n > 0) setTimeout(function () { send(n - 1); }, 2000);
      }, function () {
        if (n > 0) setTimeout(function () { send(n - 1); }, 2000);
      });
    };
    send(1);
  }
  function startMatch() {
    if (!canStart()) return;
    var roster = players().filter(isReady).slice(0, MAX);
    var data = {
      m: me + '-' + now().toString(36) + Math.random().toString(36).slice(2, 6),
      seed: (Math.random() * 4294967296) >>> 0, gid: pickGid, roster: roster
    };
    pendingStart = { m: data.m, at: now() };
    $('startBtn').disabled = true;
    var fail = function () {
      if (pendingStart && pendingStart.m === data.m) pendingStart = null;
      renderHall();
    };
    attempt(function () { return Usion.game.action('start', data); }).then(function (a) {
      if (a && a.success === false) fail();
    }, fail);
  }
  function canStart() {
    var ps = players();
    return isHost() && joinedOk && !!pickGid && ps.length >= 2 && ps.every(isReady) && !(latest && !latest.ended) && !pendingStart;
  }
  function setPick(gid, mineToo) {
    if (!UBM.groupById(gid) || gid === pickGid) return;
    pickGid = gid;
    Object.keys(infos).forEach(function (id) { infos[id].ready = false; });
    if (mineToo) sendPick();
    if (ready) {
      ready = false;
      sendInfo();
    } else renderAll();
  }

  function showHall() {
    raceLive = false;
    UBM.screen('hall');
    sigs = {};
    renderAll();
  }
  function backToHall() {
    ready = false;
    away = false;
    resM = null;
    showHall();
    sendInfo();
  }
  function showResults(M) {
    resM = M;
    UBM.screen('results');
    $('results').scrollTop = 0;
    sigs.res = '';
    renderResults(true);
  }

  function renderAll() {
    var scr = UBM.state().screen;
    if (scr === 'hall') renderHall();
    if (scr === 'results') renderResults(false);
    renderStrip();
    var ok = inRoom && joinedOk && !away && here().length >= 2;
    var bs = doc.querySelectorAll('.chatBtn');
    for (var i = 0; i < bs.length; i++) bs[i].hidden = !ok;
    if (!ok && !$('chat').hidden) closeChat();
    $('endHall').hidden = !(inRoom && away);
  }
  function renderHall() {
    if (!inRoom || UBM.state().screen !== 'hall') return;
    var g = UBM.groupById(pickGid);
    var host = isHost();
    var ids = here();
    var running = latest && !latest.ended;
    $('hallSinger').disabled = !host;
    $('hallAv').hidden = !g;
    if (g) UBM.avatar($('hallAv'), g);
    setText($('hallSN'), g ? g.name : t('hostPicks'));
    setText($('hallSS'), host ? t('change') : g ? '♪ ' + C.ROUND + ' ' + t('lines') : '');
    setText($('hallCount'), ids.length + '/' + MAX);
    $('hallInvite').hidden = !game('invite') || !joinedOk;
    var sig = JSON.stringify([ids, hostId, ids.map(function (id) { return [nameOf(id), isReady(id), !!(infos[id] && infos[id].away), infos[id] && infos[id].avatar]; })]);
    if (sigs.hall !== sig) {
      sigs.hall = sig;
      var box = $('hallList');
      box.textContent = '';
      ids.forEach(function (id) {
        var info = infos[id] || {};
        var row = el('div', 'pl' + (isReady(id) ? ' ok' : '') + (info.away ? ' away' : ''));
        var nm = el('span', 'nm', nameOf(id));
        row.setAttribute('data-pid', id);
        if (id === hostId) nm.appendChild(el('span', 'tag', t('host')));
        if (id === me) nm.appendChild(el('span', 'tag dim', t('me')));
        row.appendChild(avatarOf(id));
        row.appendChild(nm);
        row.appendChild(el('span', 'rd', info.away && id !== me ? t('away') : isReady(id) ? t('readyOn') : '…'));
        box.appendChild(row);
      });
    }
    var rb = $('readyBtn');
    setText(rb, joinFail ? t('reconnect') : ready ? t('readyOn') : t('ready'));
    rb.classList.toggle('on', ready && !joinFail);
    rb.disabled = !joinFail && (!joinedOk || !!(running && mine(latest)));
    rb.setAttribute('aria-pressed', String(ready));
    $('startBtn').hidden = !host;
    $('startBtn').disabled = !canStart();
    var hostGone = !!hostId && !host && gone(hostId);
    setText($('hallNote'), joinFail ? t('connFail') : !joinedOk ? t('connecting') : hostGone ? t('hostLeft') : running && !mine(latest) ? t('running') : !host ? t('waitHost') : '');
  }
  function renderStrip() {
    var M = latest;
    var show = !!(inRoom && raceLive && M && racingM === M.m && UBM.state().screen === 'round');
    $('stripRow').hidden = !show;
    if (!show) { sigs.strip = ''; return; }
    var rs = C.standings(M.roster, M.acts);
    var sig = JSON.stringify(rs.map(function (r) { return [r.id, r.answered, r.score, r.done, gone(r.id), nameOf(r.id)]; }));
    if (sigs.strip === sig) return;
    var prev = sigs.stripScores || {};
    sigs.strip = sig;
    sigs.stripScores = {};
    var box = $('strip');
    box.textContent = '';
    rs.forEach(function (r) {
      var c = el('div', 'pc' + (r.id === me ? ' me' : '') + (r.done ? ' done' : '') + (gone(r.id) ? ' gone' : ''));
      c.setAttribute('data-pid', r.id);
      c.setAttribute('aria-label', nameOf(r.id) + ' ' + r.answered + '/' + C.ROUND + ' ' + r.score);
      c.appendChild(avatarOf(r.id));
      c.appendChild(el('span', 'n', r.answered + '/' + C.ROUND));
      c.appendChild(el('span', 's', String(r.score)));
      if (prev[r.id] != null && prev[r.id] !== r.score) c.classList.add('bump');
      sigs.stripScores[r.id] = r.score;
      box.appendChild(c);
    });
  }
  function renderResults(force) {
    var M = resM;
    if (!M || UBM.state().screen !== 'results') return;
    var g = UBM.groupById(M.gid);
    var rs = rowsOf(M);
    var st = M.res && M.res.saveState;
    var sig = JSON.stringify([M.ended, st, M.res && M.res.saveInfo, rs.map(function (r) { return [r.id, r.answered, r.score, r.done, gone(r.id), nameOf(r.id)]; })]);
    if (!force && sigs.res === sig) return;
    sigs.res = sig;
    if (g) UBM.avatar($('resAv'), g);
    setText($('resSinger'), g ? g.name : '');
    var head = $('resHead');
    var draw = M.ended && isDraw(rs);
    setText(head, !M.ended ? t('waitOthers') : draw ? t('draw') : rs[0].id === me ? t('youWon') : t('won').replace('%s', nameOf(rs[0].id)));
    head.className = M.ended ? '' : 'wait';
    $('trophy').toggleAttribute('hidden', !(M.ended && !draw && rs[0].id === me));
    var box = $('resList');
    box.textContent = '';
    rs.forEach(function (r, i) {
      var isMe = r.id === me;
      var row = el(isMe ? 'div' : 'button', 'pl rr' + (M.ended && !draw && i === 0 ? ' win' : '') + (gone(r.id) ? ' gone' : ''));
      var nm = el('span', 'nm', nameOf(r.id));
      var sc = el('span', 'sc');
      row.setAttribute('data-pid', r.id);
      row.appendChild(el('span', 'pp' + (M.ended && !draw && i < 3 ? ' p' + (i + 1) : ''), draw && r.score === rs[0].score ? '=' : String(i + 1)));
      row.appendChild(avatarOf(r.id));
      if (isMe) nm.appendChild(el('span', 'tag dim', t('me')));
      if (gone(r.id)) nm.appendChild(el('span', 'tag dim', t('left')));
      row.appendChild(nm);
      sc.appendChild(el('b', '', String(r.score)));
      sc.appendChild(el('small', '', (r.done ? '' : '… ') + r.answered + '/' + C.ROUND));
      row.appendChild(sc);
      if (!isMe) {
        row.type = 'button';
        row.setAttribute('aria-label', (i + 1) + '. ' + nameOf(r.id) + ', ' + r.score);
        row.addEventListener('click', function () { UBM.openProfile(r.id); });
      }
      box.appendChild(row);
    });
    setText($('resSaveText'), st ? UBM.saveText(st, M.res.saveInfo) : '');
    $('resSave').className = 'save ' + (st || '');
    $('resRetry').hidden = !(st === 'failed' || st === 'guest');
    $('resAgain').hidden = !M.ended;
  }

  function normChat(v) {
    var m = str(v, CHAT_MAX + 1);
    return m && m.length <= CHAT_MAX ? m : '';
  }
  function bubble(id, text) {
    var scr = UBM.state().screen;
    var pid = root.CSS && typeof root.CSS.escape === 'function' ? root.CSS.escape(String(id)) : String(id).replace(/["\\]/g, '');
    var anchor = doc.querySelector('[data-screen="' + scr + '"] [data-pid="' + pid + '"]');
    var b = el('div', 'bubble', anchor ? text : nameOf(id) + ': ' + text);
    var w = root.innerWidth;
    var x = w / 2;
    var y = 70;
    if (anchor) {
      var r = anchor.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.bottom + 8;
    }
    b.style.left = Math.max(90, Math.min(w - 90, x)) + 'px';
    b.style.top = y + 'px';
    if (anchor) b.setAttribute('data-from', id);
    $('bubbles').appendChild(b);
    setTimeout(function () { b.classList.add('out'); }, 2200);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 2500);
  }
  function sendChat(v) {
    var ph = normChat(v);
    if (!ph || now() - lastChat < CHAT_GAP) return false;
    lastChat = now();
    bubble(me, ph);
    rt('quick_chat', { phrase: ph });
    return true;
  }
  function openChat() {
    var box = $('phrases');
    box.textContent = '';
    var list = t('phrases');
    (Array.isArray(list) ? list : []).forEach(function (p) {
      var b = el('button', 'ph', p);
      b.type = 'button';
      b.addEventListener('click', function () { if (sendChat(p)) closeChat(); });
      box.appendChild(b);
    });
    $('chatIn').value = '';
    $('chat').hidden = false;
  }
  function closeChat() { $('chat').hidden = true; }

  function tick() {
    var n = now();
    if (lastTick && n - lastTick > 3000 && inRoom) pumpSync();
    lastTick = n;
    if (!inRoom || !joinedOk) return;
    if (pendingStart && n - pendingStart.at > 30000) {
      pendingStart = null;
      renderHall();
    } else if (pendingStart && n - pendingStart.at > ECHO_MS) catchUp();
    if (holeAt) catchUp();
    var M = latest;
    if (M && !M.ended) {
      checkEnd(M);
      if (echo && n - echo.at > ECHO_MS) catchUp();
      if (mine(M) && !raceLive && n - lastIn > QUIET_MS) catchUp();
    }
    renderAll();
  }

  function bind() {
    $('hallSinger').addEventListener('click', function () {
      if (isHost()) UBM.openPicker(function (g) { setPick(g.id, true); }, pickGid);
    });
    $('readyBtn').addEventListener('click', function () {
      if (joinFail) { join(); return; }
      if (!joinedOk) return;
      ready = !ready;
      sendInfo();
    });
    $('startBtn').addEventListener('click', startMatch);
    $('hallInvite').addEventListener('click', function () {
      if (game('invite')) attempt(function () { return Usion.game.invite({ maxPlayers: MAX }); }).catch(noop);
    });
    $('soloBtn').addEventListener('click', function () {
      away = true;
      ready = false;
      sendInfo();
      UBM.solo();
    });
    $('endHall').addEventListener('click', backToHall);
    $('resAgain').addEventListener('click', backToHall);
    $('resRetry').addEventListener('click', function () { if (resM && resM.res) UBM.submitScore(resM.res); });
    var bs = doc.querySelectorAll('.chatBtn');
    for (var i = 0; i < bs.length; i++) bs[i].addEventListener('click', openChat);
    $('chatX').addEventListener('click', closeChat);
    $('chat').addEventListener('click', function (e) { if (e.target === $('chat')) closeChat(); });
    $('chatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (sendChat($('chatIn').value)) closeChat();
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChat(); });
  }
  function wire() {
    if (wired) return;
    wired = true;
    bind();
    setInterval(tick, 1000);
    var g = root.Usion && root.Usion.game;
    if (!g) return;
    var on = function (n, f) {
      if (typeof g[n] === 'function') {
        try { g[n](f); } catch (e) {}
      }
    };
    on('onJoined', onJoined);
    on('onPlayerJoined', onPlayerJoined);
    on('onPlayerLeft', onPlayerLeft);
    on('onRealtime', onRealtime);
    on('onAction', onAction);
    on('onSync', onSync);
    on('onRoomAssigned', onRoomAssigned);
    on('onConnectionState', onConn);
  }

  UBM.boot = function (cfg) {
    cfg = cfg || {};
    me = UBM.userId() || cfg.userId || null;
    wire();
    if (!launchedSolo(cfg) && cfg.roomId) enter(cfg.roomId, cfg.playerIds);
    else UBM.solo();
  };
  UBM.onInit = function (cfg) {
    cfg = cfg || {};
    me = UBM.userId() || cfg.userId || me;
    wire();
    if (!inRoom && !launchedSolo(cfg) && cfg.roomId) enter(cfg.roomId, cfg.playerIds);
  };
})(this);
