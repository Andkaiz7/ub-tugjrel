(function () {
  var KEY = '__ubmstub';
  var store = {};
  try { store = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function param(k, d) {
    var m = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : d;
  }
  var NAMES = { u1: 'Бат', u2: 'Сараа', u3: 'Дорж' };
  var lang = param('lang', 'mn');
  var uid = param('uid', 'u_test');
  var mode = param('mode', 'single');
  var room = mode === 'multiplayer' ? param('room', 'r1') : '';
  var calls = { submit: [], profile: [], invite: 0, report: [], sync: 0, actions: [], cloud: [] };
  var fcloud = {};
  var scloud = {
    'top:10': [{ u: 'u9', n: 'Top', s: 1500 }, { u: 'u8', n: 'Номин', s: 1462 }]
  };
  var failFirst = true;
  var H = {};
  var held = {};
  var joined = false;
  var bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ubm-relay') : null;
  function rk(k) { return 'ubm-relay:' + room + ':' + k; }
  function rget(k) { try { return JSON.parse(localStorage.getItem(rk(k)) || 'null'); } catch (e) { return null; } }
  function rset(k, v) { localStorage.setItem(rk(k), JSON.stringify(v)); }
  function fire(n, d) { setTimeout(function () { if (H[n]) H[n](d); }, 0); }
  function post(x) { x.room = room; if (bc) bc.postMessage(x); }
  function locked(f) {
    return navigator.locks ? navigator.locks.request('ubm-relay', function () { return f(); }) : Promise.resolve(f());
  }
  if (bc) {
    bc.onmessage = function (e) {
      var x = e.data;
      if (!joined || x.room !== room) return;
      if (x.k === 'join') fire('playerJoined', { player_id: x.id, player_ids: x.ids });
      else if (x.k === 'left') fire('playerLeft', { player_id: x.id, player_ids: x.ids });
      else if (x.k === 'rt') fire('realtime', x.m);
      else if (x.k === 'act') {
        var ms = held[x.m.action_type];
        if (ms) {
          delete held[x.m.action_type];
          setTimeout(function () { if (H.action) H.action(x.m); }, ms);
        } else fire('action', x.m);
      }
    };
  }
  function roster() {
    var ids = room ? (rget('roster') || []).slice() : [];
    if (room && ids.indexOf(uid) < 0) ids.push(uid);
    return ids;
  }
  function leave() {
    if (!joined) return;
    joined = false;
    var ids = (rget('roster') || []).filter(function (i) { return i !== uid; });
    rset('roster', ids);
    post({ k: 'left', id: uid, ids: ids });
  }
  window.addEventListener('pagehide', leave);
  window.addEventListener('beforeunload', leave);
  function join(rid) {
    if (rid) room = rid;
    return locked(function () {
      var ids = roster();
      rset('roster', ids);
      if (!rget('host')) rset('host', ids[0]);
      joined = true;
      var n = (rget('log') || []).length;
      post({ k: 'join', id: uid, ids: ids });
      fire('joined', { player_ids: ids, host_id: rget('host'), sequence: n, game_state: null });
      return { room_id: room, player_id: uid, sequence: n };
    });
  }
  var game = {
    connect: function () { fire('connectionState', 'connected'); return Promise.resolve(true); },
    join: join,
    leave: function () { leave(); return Promise.resolve(true); },
    isMultiplayer: function () { return !!room; },
    action: function (type, data) {
      return locked(function () {
        var log = rget('log') || [];
        var m = { player_id: uid, action_type: type, action_data: data, sequence: log.length + 1 };
        log.push(m);
        rset('log', log);
        calls.actions.push(m);
        post({ k: 'act', m: m });
        fire('action', m);
        return { success: true, sequence: m.sequence };
      });
    },
    realtime: function (type, data) {
      post({ k: 'rt', m: { player_id: uid, action_type: type, action_data: data } });
      return Promise.resolve(true);
    },
    requestSync: function (last) {
      calls.sync++;
      var log = rget('log') || [];
      fire('sync', { actions: log.filter(function (a) { return a.sequence > (last || 0); }), game_state: null, sequence: log.length });
    },
    invite: function () { calls.invite++; return Promise.resolve({ success: true, roomId: room, invited: [] }); },
    reportResult: function (r) { calls.report.push(r); return Promise.resolve({ success: true }); }
  };
  ['joined', 'playerJoined', 'playerLeft', 'realtime', 'action', 'sync', 'roomAssigned', 'connectionState'].forEach(function (n) {
    game['on' + n.charAt(0).toUpperCase() + n.slice(1)] = function (cb) {
      H[n] = cb;
      return function () { if (H[n] === cb) delete H[n]; };
    };
  });
  window.__stub = {
    calls: calls,
    store: store,
    fcloud: fcloud,
    scloud: scloud,
    assignRoom: function (r) {
      room = r;
      fire('roomAssigned', { roomId: r });
      join(r);
    },
    log: function () { return rget('log') || []; },
    delayNext: function (type, ms) { held[type] = ms; }
  };
  window.Usion = {
    init: function (cb) {
      setTimeout(function () {
        cb({ userId: uid, userName: NAMES[uid] || 'Тест', language: lang, theme: 'dark', mode: mode, roomId: room || null, playerIds: roster() });
      }, 50);
      return Promise.resolve({});
    },
    getLanguage: function () { return lang; },
    getTheme: function () { return 'dark'; },
    getLaunchParams: function () { return { path: '', mode: mode, roomId: room || null }; },
    user: {
      getId: function () { return uid; },
      getName: function () { return NAMES[uid] || 'Тест'; },
      getAvatar: function () { return ''; },
      openProfile: function (id) { calls.profile.push(id); }
    },
    game: game,
    storage: {
      get: function (k) { return Promise.resolve(k in store ? JSON.parse(JSON.stringify(store[k])) : null); },
      set: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); persist(); return Promise.resolve(true); },
      remove: function (k) { delete store[k]; persist(); return Promise.resolve(true); }
    },
    cloud: {
      friends: {
        get: function (k) {
          calls.cloud.push({ op: 'friends.get', key: k });
          return Promise.resolve(k in fcloud ? JSON.parse(JSON.stringify(fcloud[k])) : null);
        },
        set: function (k, v) {
          calls.cloud.push({ op: 'friends.set', key: k, value: v });
          fcloud[k] = v == null ? null : JSON.parse(JSON.stringify(v));
          return Promise.resolve(true);
        },
        list: function (k) {
          calls.cloud.push({ op: 'friends.list', key: k });
          return Promise.resolve(/^best:\d+$/.test(k) ? [
            { userId: 'u2', name: 'Бат', avatar: '', value: { s: 1320 }, updatedAt: 0 },
            { userId: 'u3', name: 'Сараа', avatar: '', value: { s: 640 }, updatedAt: 0 }
          ] : []);
        }
      },
      shared: {
        get: function (k) {
          calls.cloud.push({ op: 'shared.get', key: k });
          return Promise.resolve(k in scloud ? JSON.parse(JSON.stringify(scloud[k])) : null);
        },
        set: function (k, v) {
          calls.cloud.push({ op: 'shared.set', key: k, value: v });
          scloud[k] = v == null ? null : JSON.parse(JSON.stringify(v));
          return Promise.resolve(true);
        }
      }
    },
    leaderboard: {
      submit: function (score, meta) {
        calls.submit.push({ score: score, meta: meta });
        if (failFirst) { failFirst = false; return Promise.reject({ code: 'NETWORK' }); }
        return Promise.resolve({ success: true, score: score, best: score, previous: null, rank: 3, updated: true });
      },
      friends: function () {
        return Promise.resolve([
          { user_id: 'u2', name: 'Бат', score: 1320, rank: 1, is_me: false },
          { user_id: 'u_test', name: 'Би', score: 980, rank: 2, is_me: true },
          { user_id: 'u3', name: 'Сараа', score: 640, rank: 3, is_me: false }
        ]);
      },
      top: function () {
        return Promise.resolve([
          { user_id: 'u9', name: 'Top', score: 1500, rank: 1, is_me: false },
          { user_id: 'u8', name: 'Номин', score: 1462, rank: 2, is_me: false }
        ]);
      }
    }
  };
})();
