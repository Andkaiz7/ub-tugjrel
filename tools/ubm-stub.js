(function () {
  var KEY = '__ubmstub';
  var store = {};
  try { store = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  function persist() { try { sessionStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  var calls = { submit: [], profile: [] };
  var failFirst = true;
  var lang = (/[?&]lang=([a-z]+)/.exec(location.search) || [])[1] || 'mn';
  window.__stub = { calls: calls, store: store };
  window.Usion = {
    init: function (cb) {
      setTimeout(function () { cb({ userId: 'u_test', userName: 'Тест', language: lang, theme: 'dark', mode: 'single' }); }, 50);
      return Promise.resolve({});
    },
    getLanguage: function () { return lang; },
    getTheme: function () { return 'dark'; },
    getLaunchParams: function () { return { path: '', mode: 'single' }; },
    user: {
      getId: function () { return 'u_test'; },
      getName: function () { return 'Тест'; },
      openProfile: function (id) { calls.profile.push(id); }
    },
    storage: {
      get: function (k) { return Promise.resolve(k in store ? JSON.parse(JSON.stringify(store[k])) : null); },
      set: function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); persist(); return Promise.resolve(true); },
      remove: function (k) { delete store[k]; persist(); return Promise.resolve(true); }
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
