(function () {
  var store = {};
  var calls = { submit: [], profile: [], friendsSet: [], friendsList: [], share: [] };
  var failFirst = true;
  var launchPath = (/[?&]path=([^&]*)/.exec(location.search) || [])[1] || '';
  window.__stub = { calls: calls, store: store };
  window.Usion = {
    init: function (cb) {
      setTimeout(function () { cb({ userId: 'u_test', language: 'mn', theme: 'light' }); }, 50);
      return Promise.resolve({});
    },
    getLanguage: function () { return 'mn'; },
    getTheme: function () { return 'light'; },
    getLaunchParams: function () { return { path: decodeURIComponent(launchPath), mode: 'single' }; },
    canShareToFeed: function () { return true; },
    shareToFeed: function (type, data) {
      calls.share.push({ type: type, data: data });
      return Promise.resolve({ success: true, postId: 'p1' });
    },
    user: {
      getId: function () { return 'u_test'; },
      openProfile: function (id) { calls.profile.push(id); }
    },
    storage: {
      get: function (k) { return Promise.resolve(k in store ? store[k] : null); },
      set: function (k, v) { store[k] = v; return Promise.resolve(true); },
      remove: function (k) { delete store[k]; return Promise.resolve(true); }
    },
    cloud: {
      friends: {
        set: function (k, v) { calls.friendsSet.push({ key: k, value: v }); return Promise.resolve({ success: true }); },
        list: function (k) {
          calls.friendsList.push(k);
          return Promise.resolve(k === 'best:zaisan' ? [{ userId: 'u2', name: 'Бат', avatar: '', value: { t: 171 }, updatedAt: 1 }] : []);
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
          { user_id: 'u2', name: 'Бат', score: 9800, rank: 1, is_me: false },
          { user_id: 'u_test', name: 'Би', score: 14520, rank: 2, is_me: true }
        ]);
      },
      top: function () { return Promise.resolve([{ user_id: 'u9', name: 'Top', score: 4200, rank: 1, is_me: false }]); }
    }
  };
})();
