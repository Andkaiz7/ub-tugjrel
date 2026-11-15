(function () {
  var store = {};
  var calls = { submit: [], profile: [] };
  var failFirst = true;
  window.__stub = { calls: calls, store: store };
  window.Usion = {
    init: function (cb) {
      setTimeout(function () { cb({ userId: 'u_test', language: 'mn', theme: 'light' }); }, 50);
      return Promise.resolve({});
    },
    getLanguage: function () { return 'mn'; },
    getTheme: function () { return 'light'; },
    user: {
      getId: function () { return 'u_test'; },
      openProfile: function (id) { calls.profile.push(id); }
    },
    storage: {
      get: function (k) { return Promise.resolve(k in store ? store[k] : null); },
      set: function (k, v) { store[k] = v; return Promise.resolve(true); },
      remove: function (k) { delete store[k]; return Promise.resolve(true); }
    },
    leaderboard: {
      submit: function (score, meta) {
        calls.submit.push({ score: score, meta: meta });
        if (failFirst) { failFirst = false; return Promise.reject({ code: 'NETWORK' }); }
        return Promise.resolve({ success: true, score: score, best: score, previous: null, rank: 3, updated: true });
      },
      friends: function () {
        return Promise.resolve([
          { user_id: 'u2', name: 'Бат', score: 95, rank: 1, is_me: false },
          { user_id: 'u_test', name: 'Би', score: 120, rank: 2, is_me: true }
        ]);
      },
      top: function () { return Promise.resolve([{ user_id: 'u9', name: 'Top', score: 60, rank: 1, is_me: false }]); }
    }
  };
})();
