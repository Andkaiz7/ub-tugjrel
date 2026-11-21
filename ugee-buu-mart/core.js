(function (root) {
  "use strict";

  var SCHEDULE = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
  var COUNTS = [5, 10, 20, 30];
  var ROUND = 10;
  var LIVES = 3;
  var SPEED_MS = 15000;
  var COMBO_STEP = 3;
  var NORM_RE = /^[.,!?;:"'«»()…–—-]+|[.,!?;:"'«»()…–—-]+$/g;

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedOf(str) {
    var s = String(str);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function words(line) {
    return String(line).trim().split(/\s+/).filter(Boolean);
  }

  function norm(w) {
    if (w == null) return "";
    return String(w).toLowerCase().replace(NORM_RE, "");
  }

  function blanksFor(q, wordCount) {
    var idx = q < 0 ? 0 : q >= SCHEDULE.length ? SCHEDULE.length - 1 : q;
    return Math.max(1, Math.min(SCHEDULE[idx], wordCount - 2));
  }

  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function pickFrom(group, songIdx, seenList, seenSet, count, rnd) {
    var byId = new Map();
    var songBuckets = [];
    for (var t = 0; t < songIdx.length; t++) {
      var s = songIdx[t];
      var xs = group.songs[s].x;
      var bucket = [];
      for (var e = 0; e < xs.length; e++) {
        var ref = { s: s, e: e, id: xs[e][0] };
        byId.set(ref.id, ref);
        if (!seenSet.has(ref.id)) {
          bucket.push(ref);
        }
      }
      if (bucket.length > 0) {
        songBuckets.push(shuffle(bucket, rnd));
      }
    }
    var firstPass = [];
    var restUnseen = [];
    var shuffledBuckets = shuffle(songBuckets, rnd);
    for (var i = 0; i < shuffledBuckets.length; i++) {
      var b = shuffledBuckets[i];
      firstPass.push(b[0]);
      for (var j = 1; j < b.length; j++) {
        restUnseen.push(b[j]);
      }
    }
    var result = firstPass.concat(shuffle(restUnseen, rnd));
    if (result.length < count) {
      var used = new Set();
      for (var i = 0; i < result.length; i++) {
        used.add(result[i].id);
      }
      for (var i = 0; i < seenList.length && result.length < count; i++) {
        var id = seenList[i];
        if (!used.has(id) && byId.has(id)) {
          used.add(id);
          result.push(byId.get(id));
        }
      }
    }
    return result.slice(0, count);
  }

  function pickRefs(group, seen, n, rnd) {
    var count = n === undefined ? ROUND : n;
    var seenList = seen || [];
    var seenSet = new Set(seenList);
    if (!group.mix) {
      var all = [];
      for (var s = 0; s < group.songs.length; s++) all.push(s);
      return pickFrom(group, all, seenList, seenSet, count, rnd);
    }
    var bySinger = {};
    var cap = {};
    var keys = [];
    for (var s = 0; s < group.songs.length; s++) {
      var k = group.songs[s].gid;
      if (!bySinger[k]) {
        bySinger[k] = [];
        cap[k] = 0;
        keys.push(k);
      }
      bySinger[k].push(s);
      cap[k] += group.songs[s].x.length;
    }
    keys = shuffle(keys, rnd);
    var quota = {};
    for (var i = 0; i < keys.length; i++) quota[keys[i]] = 0;
    var left = count;
    var moved = true;
    while (left > 0 && moved) {
      moved = false;
      for (var i = 0; i < keys.length && left > 0; i++) {
        if (quota[keys[i]] < cap[keys[i]]) {
          quota[keys[i]]++;
          left--;
          moved = true;
        }
      }
    }
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      if (quota[keys[i]] > 0) out = out.concat(pickFrom(group, bySinger[keys[i]], seenList, seenSet, quota[keys[i]], rnd));
    }
    return shuffle(out, rnd);
  }

  function question(group, ref, q, rnd) {
    var song = group.songs[ref.s];
    var ex = song.x[ref.e];
    var targetWords = words(ex[2]);
    var n = blanksFor(q, targetWords.length);
    var split = targetWords.length - n;
    var shown = targetWords.slice(0, split);
    var answer = targetWords.slice(split);

    var answerNorms = new Set();
    var totalLen = 0;
    for (var i = 0; i < answer.length; i++) {
      var an = norm(answer[i]);
      answerNorms.add(an);
      totalLen += an.length;
    }
    var meanLen = totalLen / answer.length;

    var seenNorms = new Set(answerNorms);
    var near = [];
    var far = [];
    for (var s = 0; s < group.songs.length; s++) {
      var xs = group.songs[s].x;
      for (var e = 0; e < xs.length; e++) {
        if (s === ref.s && e === ref.e) continue;
        var tw = words(xs[e][2]);
        for (var k = 0; k < tw.length; k++) {
          var cw = tw[k];
          var cn = norm(cw);
          if (!cn || seenNorms.has(cn)) continue;
          seenNorms.add(cn);
          if (Math.abs(cn.length - meanLen) <= 2) {
            near.push(cw);
          } else {
            far.push(cw);
          }
        }
      }
    }

    var need = 2 + Math.floor(n / 2);
    var decoys = [];
    var nearShuffled = shuffle(near, rnd);
    for (var i = 0; i < nearShuffled.length && decoys.length < need; i++) {
      decoys.push(nearShuffled[i]);
    }
    if (decoys.length < need) {
      var farShuffled = shuffle(far, rnd);
      for (var i = 0; i < farShuffled.length && decoys.length < need; i++) {
        decoys.push(farShuffled[i]);
      }
    }
    if (decoys.length < need) {
      var extra = [];
      for (var s = 0; s < group.songs.length; s++) {
        var xs = group.songs[s].x;
        for (var e = 0; e < xs.length; e++) {
          var pw = words(xs[e][1]);
          for (var k = 0; k < pw.length; k++) {
            var pcn = norm(pw[k]);
            if (!pcn || seenNorms.has(pcn)) continue;
            seenNorms.add(pcn);
            extra.push(pw[k]);
          }
        }
      }
      for (var k = 0; k < shown.length; k++) {
        var scn = norm(shown[k]);
        if (!scn || seenNorms.has(scn)) continue;
        seenNorms.add(scn);
        extra.push(shown[k]);
      }
      var extraShuffled = shuffle(extra, rnd);
      for (var i = 0; i < extraShuffled.length && decoys.length < need; i++) {
        decoys.push(extraShuffled[i]);
      }
    }

    var tiles = shuffle(answer.concat(decoys), rnd);
    return {
      id: ex[0],
      gid: song.gid || group.id,
      song: song.t,
      prev: ex[1],
      shown: shown,
      answer: answer,
      tiles: tiles
    };
  }

  function mix(groups) {
    if (!Array.isArray(groups) || !groups.length) return null;
    var sorted = groups.slice().sort(function (a, b) {
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    if (sorted.length === 1) return sorted[0];
    var ids = [];
    var songs = [];
    for (var i = 0; i < sorted.length; i++) {
      var g = sorted[i];
      ids.push(g.id);
      var gs = g.songs || [];
      for (var j = 0; j < gs.length; j++) {
        var s = gs[j];
        var copy = {};
        for (var k in s) {
          if (Object.prototype.hasOwnProperty.call(s, k)) copy[k] = s[k];
        }
        copy.gid = g.id;
        songs.push(copy);
      }
    }
    return {
      id: ids.join("+"),
      name: (sorted[0].name.length > 14 ? sorted[0].name.slice(0, 13) + "…" : sorted[0].name) + " +" + (sorted.length - 1),
      mix: ids,
      songs: songs
    };
  }

  function round(group, refs, rnd) {
    var out = [];
    for (var i = 0; i < refs.length; i++) {
      out.push(question(group, refs[i], i, rnd));
    }
    return out;
  }

  function tileOk(Q, filled, tile) {
    if (!Q || !Q.answer || filled < 0 || filled >= Q.answer.length) return false;
    return norm(tile) === norm(Q.answer[filled]);
  }

  function comboMul(streak) {
    return streak >= 2 * COMBO_STEP ? 3 : streak >= COMBO_STEP ? 2 : 1;
  }

  function refills(streak) {
    return streak > 0 && streak % COMBO_STEP === 0;
  }

  function lineScore(ms, streak) {
    var t = ms < 0 ? 0 : ms;
    return (100 + Math.round(50 * Math.max(0, 1 - t / SPEED_MS))) * comboMul(streak | 0);
  }

  function maxScore(n) {
    var total = 0;
    for (var i = 1; i <= n; i++) total += lineScore(0, i);
    return total;
  }

  function standings(roster, acts, total) {
    var list = roster || [];
    var entries = acts || [];
    var n = total > 0 ? total | 0 : ROUND;
    var rowsById = new Map();
    var orderById = new Map();
    var rows = [];
    for (var i = 0; i < list.length; i++) {
      var id = list[i];
      if (rowsById.has(id)) continue;
      var row = {
        id: id,
        score: 0,
        answered: 0,
        lives: LIVES,
        done: false,
        ms: 0,
        streak: 0
      };
      rowsById.set(id, row);
      orderById.set(id, i);
      rows.push(row);
    }
    var seenActs = new Set();
    var actsById = new Map();
    for (var i = 0; i < entries.length; i++) {
      var act = entries[i];
      if (!rowsById.has(act.player_id)) continue;
      var q = act.q | 0;
      if (q < 0 || q >= n) continue;
      var key = act.player_id + "\0" + q;
      if (seenActs.has(key)) continue;
      seenActs.add(key);
      if (!actsById.has(act.player_id)) actsById.set(act.player_id, []);
      actsById.get(act.player_id).push(act);
    }
    actsById.forEach(function (list, id) {
      var row = rowsById.get(id);
      list.sort(function (a, b) { return (a.q | 0) - (b.q | 0); });
      for (var j = 0; j < list.length; j++) {
        var act = list[j];
        var ms = Math.max(0, +act.ms || 0);
        row.answered += 1;
        row.ms += ms;
        row.streak = act.ok && act.c === true ? row.streak + 1 : 0;
        if (act.ok) {
          row.score += lineScore(ms, row.streak);
        }
        row.lives = Math.max(0, Math.min(LIVES, act.lives | 0));
      }
    });
    for (var i = 0; i < rows.length; i++) {
      rows[i].done = rows[i].answered >= n || rows[i].lives <= 0;
    }
    rows.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.ms !== b.ms) return a.ms - b.ms;
      return orderById.get(a.id) - orderById.get(b.id);
    });
    return rows;
  }

  var UBMCore = {
    SCHEDULE: SCHEDULE,
    COUNTS: COUNTS,
    ROUND: ROUND,
    LIVES: LIVES,
    SPEED_MS: SPEED_MS,
    COMBO_STEP: COMBO_STEP,
    rng: rng,
    seedOf: seedOf,
    words: words,
    norm: norm,
    blanksFor: blanksFor,
    pickRefs: pickRefs,
    question: question,
    round: round,
    mix: mix,
    tileOk: tileOk,
    lineScore: lineScore,
    comboMul: comboMul,
    refills: refills,
    maxScore: maxScore,
    standings: standings
  };

  if (typeof module !== "undefined" && module.exports) module.exports = UBMCore;
  else root.UBMCore = UBMCore;
})(this);
