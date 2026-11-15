(function (root) {
  var W = 9;
  var H = 14;
  var N = W * H;
  var M = N * 2;
  var K = { GRASS: 0, RIVER: 1, RAIL: 2, BLOCK: 3, SRC: 4, DST: 5 };
  var DT = 1 / 60;
  var QUEUE_MAX = 5;
  var QUEUE_FULL_S = 4;
  var STUCK_S = 4;
  var STUCK_CLEAR_S = 1.5;
  var LOST_S = 1;
  var PENALTY_S = 10;
  var JUNCTION_COST = 1;
  var JUNCTION_SLOW = 0.5;
  var MAX_MIDDLE = 4;
  var COLOR_SLOTS = 5;

  function dirOf(a, b) {
    var d = b - a;
    if (d === 1) return 0;
    if (d === W) return 1;
    if (d === -1) return 2;
    if (d === -W) return 3;
    return -1;
  }

  function adjacent(a, b) {
    if (!(a >= 0 && b >= 0 && a < N && b < N)) return false;
    return Math.abs((a % W) - (b % W)) + Math.abs(((a / W) | 0) - ((b / W) | 0)) === 1;
  }

  function edgeKey(a, b) {
    return a < b ? a + '-' + b : b + '-' + a;
  }

  function isThrough(world, c) {
    return c >= world.quota.length;
  }

  function intervalFor(world, c) {
    return isThrough(world, c) ? world.level.throughInterval || world.level.interval : world.level.interval;
  }

  function createWorld(level) {
    var kind = new Uint8Array(N);
    var color = new Int8Array(N).fill(-1);
    var prebuilt = new Uint8Array(N);
    var chars = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x;
        var ch = level.rows[y].charAt(x);
        chars[i] = ch;
        if (ch === '~') kind[i] = K.RIVER;
        else if (ch === '=') kind[i] = K.RAIL;
        else if (ch === '#') kind[i] = K.BLOCK;
        else if (ch === '+') prebuilt[i] = 1;
        else if (ch >= 'A' && ch <= 'E') {
          kind[i] = K.SRC;
          color[i] = ch.charCodeAt(0) - 65;
        } else if (ch >= 'a' && ch <= 'e') {
          kind[i] = K.DST;
          color[i] = ch.charCodeAt(0) - 97;
        }
      }
    }
    var world = {
      level: level,
      w: W,
      h: H,
      kind: kind,
      color: color,
      prebuilt: prebuilt,
      edges: new Map(),
      bridges: [],
      budget: { roads: level.roads, bridges: level.bridges },
      sources: [],
      cars: [],
      delivered: level.quota.map(function () { return 0; }),
      quota: level.quota.slice(),
      time: 0,
      penaltyTime: 0,
      penalties: 0,
      cleared: false,
      events: [],
      _nextCar: 1,
      _nextBridge: 1,
      _pdeg: new Uint8Array(N),
      _deg: new Uint8Array(N),
      _ramp: new Uint8Array(N),
      _mid: new Int16Array(N),
      _junction: new Uint8Array(N),
      _exists: new Uint8Array(M),
      _adj: [],
      _next: [],
      _dist: new Float64Array(M),
      _done: new Uint8Array(M),
      _occ: new Int16Array(M),
      _lane: new Int16Array(M * 4)
    };
    for (var c = 0; c < COLOR_SLOTS; c++) world._next.push(new Int32Array(M));
    var pre = function (ch) { return ch === '+' || ch === 'E' || ch === 'e'; };
    for (var j = 0; j < N; j++) {
      if (!pre(chars[j])) continue;
      if (j % W < W - 1 && pre(chars[j + 1])) world.edges.set(edgeKey(j, j + 1), { a: j, b: j + 1, prebuilt: true });
      if (j + W < N && pre(chars[j + W])) world.edges.set(edgeKey(j, j + W), { a: j, b: j + W, prebuilt: true });
    }
    for (var s = 0; s < N; s++) {
      if (kind[s] === K.SRC) {
        world.sources.push({ tile: s, color: color[s], queue: 0, timer: intervalFor(world, color[s]), fullFor: 0 });
      }
    }
    rebuild(world);
    return world;
  }

  function isJunctionNode(world, n) {
    return (n & 1) === 0 && world._junction[n >> 1] === 1;
  }

  function isEndpointNode(world, n) {
    var k = world.kind[n >> 1];
    return (n & 1) === 0 && (k === K.SRC || k === K.DST);
  }

  function routeColor(world, c) {
    var next = world._next[c];
    var dist = world._dist;
    var done = world._done;
    var adj = world._adj;
    next.fill(-1);
    dist.fill(Infinity);
    done.fill(0);
    var seeds = 0;
    for (var i = 0; i < N; i++) {
      if (world.kind[i] === K.DST && world.color[i] === c) {
        dist[i * 2] = 0;
        seeds++;
      }
    }
    if (!seeds) return;
    for (;;) {
      var u = -1;
      var best = Infinity;
      for (var n = 0; n < M; n++) {
        if (!done[n] && dist[n] < best) {
          best = dist[n];
          u = n;
        }
      }
      if (u < 0) break;
      done[u] = 1;
      if (best > 0 && isEndpointNode(world, u)) continue;
      var cost = 1 + (isJunctionNode(world, u) ? JUNCTION_COST : 0);
      var list = adj[u];
      for (var k = 0; k < list.length; k++) {
        var v = list[k];
        if (done[v]) continue;
        var nd = best + cost;
        if (nd < dist[v]) {
          dist[v] = nd;
          next[v] = u;
        }
      }
    }
  }

  function laneIndex(car) {
    return car.node * 4 + dirOf(car.prev >> 1, car.node >> 1);
  }

  function occupy(world, car, delta) {
    if (isEndpointNode(world, car.node)) return;
    world._occ[car.node] += delta;
    world._lane[laneIndex(car)] += delta;
  }

  function rebuild(world) {
    var deg = world._deg;
    var ramp = world._ramp;
    var mid = world._mid;
    deg.fill(0);
    ramp.fill(0);
    mid.fill(-1);
    var adj = [];
    for (var n = 0; n < M; n++) adj.push([]);
    world.edges.forEach(function (e) {
      deg[e.a]++;
      deg[e.b]++;
      adj[e.a * 2].push(e.b * 2);
      adj[e.b * 2].push(e.a * 2);
    });
    world.bridges.forEach(function (b) {
      var t = b.tiles;
      ramp[t[0]]++;
      ramp[t[t.length - 1]]++;
      var seq = [];
      for (var i = 0; i < t.length; i++) {
        var inner = i > 0 && i < t.length - 1;
        if (inner) mid[t[i]] = b.id;
        seq.push(t[i] * 2 + (inner ? 1 : 0));
      }
      for (var j = 1; j < seq.length; j++) {
        adj[seq[j - 1]].push(seq[j]);
        adj[seq[j]].push(seq[j - 1]);
      }
    });
    world._adj = adj;
    for (var i = 0; i < N; i++) {
      var k = world.kind[i];
      var endpoint = k === K.SRC || k === K.DST;
      var d = deg[i] + ramp[i];
      world._junction[i] = !endpoint && d >= 3 ? 1 : 0;
      world._exists[i * 2] = endpoint || d > 0 ? 1 : 0;
      world._exists[i * 2 + 1] = mid[i] >= 0 ? 1 : 0;
    }
    for (var c = 0; c < COLOR_SLOTS; c++) routeColor(world, c);
    world._occ.fill(0);
    world._lane.fill(0);
    world.cars = world.cars.filter(function (car) {
      if (!world._exists[car.node]) return false;
      occupy(world, car, 1);
      return true;
    });
  }

  function roomIn(world, from, to) {
    if (isEndpointNode(world, to)) return true;
    if (isJunctionNode(world, to)) return world._occ[to] === 0;
    return world._lane[to * 4 + dirOf(from >> 1, to >> 1)] === 0;
  }

  function canEnter(world, from, to, c) {
    if (isEndpointNode(world, to)) return true;
    if (isJunctionNode(world, to)) {
      if (world._occ[to] > 0) return false;
      var after = world._next[c][to];
      return after >= 0 && roomIn(world, to, after);
    }
    return world._lane[to * 4 + dirOf(from >> 1, to >> 1)] === 0;
  }

  function penalty(world, reason, tile) {
    world.penalties++;
    world.penaltyTime += PENALTY_S;
    world.events.push({ type: 'penalty', reason: reason, tile: tile });
  }

  function countable(world, t) {
    return world.kind[t] === K.GRASS && !world.prebuilt[t];
  }

  function usage(world) {
    var roads = 0;
    for (var i = 0; i < N; i++) if (countable(world, i) && world._pdeg[i] > 0) roads++;
    return { roads: roads, bridges: world.bridges.length };
  }

  function roadStroke(world, tiles) {
    var added = 0;
    var stop = null;
    var used = usage(world).roads;
    var local = {};
    var busyEnd = function (t) {
      var k = world.kind[t];
      return (k === K.SRC || k === K.DST) && world._deg[t] + world._ramp[t] + (local[t] || 0) >= 1;
    };
    for (var k = 1; k < tiles.length; k++) {
      var a = tiles[k - 1];
      var b = tiles[k];
      if (!adjacent(a, b)) { stop = 'notAdjacent'; break; }
      var ka = world.kind[a];
      var kb = world.kind[b];
      if (ka === K.RIVER || ka === K.RAIL || kb === K.RIVER || kb === K.RAIL) { stop = 'water'; break; }
      if (ka === K.BLOCK || kb === K.BLOCK) { stop = 'blocked'; break; }
      var key = edgeKey(a, b);
      if (world.edges.has(key)) continue;
      var extra = (countable(world, a) && !world._pdeg[a] ? 1 : 0) + (countable(world, b) && !world._pdeg[b] ? 1 : 0);
      if (busyEnd(a) || busyEnd(b)) { stop = 'blocked'; break; }
      if (used + extra > world.budget.roads) { stop = 'budget'; break; }
      local[a] = (local[a] || 0) + 1;
      local[b] = (local[b] || 0) + 1;
      world.edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), prebuilt: false });
      world._pdeg[a]++;
      world._pdeg[b]++;
      used += extra;
      added++;
    }
    if (added) rebuild(world);
    return { added: added, stop: stop };
  }

  function isMiddle(world, t) {
    for (var i = 0; i < world.bridges.length; i++) {
      var tiles = world.bridges[i].tiles;
      for (var j = 1; j < tiles.length - 1; j++) if (tiles[j] === t) return true;
    }
    return false;
  }

  function spanTiles(s, e) {
    var out = [s];
    var step = (e % W) !== (s % W) ? Math.sign(e - s) : Math.sign(e - s) * W;
    for (var t = s + step; t !== e; t += step) out.push(t);
    out.push(e);
    return out;
  }

  function bridgeCheck(world, s, e) {
    if (!(s >= 0 && e >= 0 && s < N && e < N) || s === e) return { ok: false, reason: 'axis' };
    var sx = s % W, sy = (s / W) | 0, ex = e % W, ey = (e / W) | 0;
    if (sx !== ex && sy !== ey) return { ok: false, reason: 'axis' };
    var middles = Math.abs(ex - sx) + Math.abs(ey - sy) - 1;
    if (middles < 1 || middles > MAX_MIDDLE) return { ok: false, reason: 'length' };
    var endOk = function (t) {
      var k = world.kind[t];
      if (k === K.SRC || k === K.DST) return world._deg[t] + world._ramp[t] === 0;
      return k === K.GRASS && !isMiddle(world, t);
    };
    if (!endOk(s) || !endOk(e)) return { ok: false, reason: 'end' };
    for (var i = 0; i < world.bridges.length; i++) {
      var bt = world.bridges[i].tiles;
      var a = bt[0], b = bt[bt.length - 1];
      if ((a === s && b === e) || (a === e && b === s)) return { ok: false, reason: 'overlap' };
    }
    var tiles = spanTiles(s, e);
    for (var j = 1; j < tiles.length - 1; j++) {
      var k = world.kind[tiles[j]];
      if (k === K.BLOCK || k === K.SRC || k === K.DST || isMiddle(world, tiles[j])) return { ok: false, reason: 'middle' };
    }
    if (world.bridges.length >= world.budget.bridges) return { ok: false, reason: 'budget' };
    return { ok: true };
  }

  function placeBridge(world, s, e) {
    var r = bridgeCheck(world, s, e);
    if (!r.ok) return r;
    world.bridges.push({ id: world._nextBridge++, tiles: spanTiles(s, e) });
    rebuild(world);
    return r;
  }

  function eraseAt(world, tile) {
    var any = false;
    world.edges.forEach(function (e, key) {
      if (!e.prebuilt && (e.a === tile || e.b === tile)) {
        world.edges.delete(key);
        world._pdeg[e.a]--;
        world._pdeg[e.b]--;
        any = true;
      }
    });
    var before = world.bridges.length;
    world.bridges = world.bridges.filter(function (b) { return b.tiles.indexOf(tile) < 0; });
    if (world.bridges.length !== before) any = true;
    if (any) rebuild(world);
    return any;
  }

  function stepCars(world, dt) {
    var speed = world.level.speed;
    var dead = false;
    for (var i = 0; i < world.cars.length; i++) {
      var car = world.cars[i];
      car.t += speed * dt * (isJunctionNode(world, car.node) ? JUNCTION_SLOW : 1);
      if (car.t < 1) {
        car.wait = 0;
        continue;
      }
      var tile = car.node >> 1;
      if ((car.node & 1) === 0 && world.kind[tile] === K.DST && world.color[tile] === car.color) {
        car.dead = true;
        dead = true;
        if (!isThrough(world, car.color)) {
          world.delivered[car.color]++;
          world.events.push({ type: 'deliver', color: car.color, tile: tile });
        }
        continue;
      }
      var next = world._next[car.color][car.node];
      if (next < 0) {
        car.t = 1;
        car.lost += dt;
        if (car.lost >= LOST_S) {
          occupy(world, car, -1);
          car.dead = true;
          dead = true;
        }
        continue;
      }
      car.lost = 0;
      if (canEnter(world, car.node, next, car.color)) {
        occupy(world, car, -1);
        car.prev = car.node;
        car.node = next;
        occupy(world, car, 1);
        car.t -= 1;
        car.wait = 0;
      } else {
        car.t = 1;
        car.wait += dt;
      }
    }
    if (dead) world.cars = world.cars.filter(function (c) { return !c.dead; });
  }

  function stepSources(world, dt) {
    var inflight = [0, 0, 0, 0, 0];
    var queued = [0, 0, 0, 0, 0];
    world.cars.forEach(function (c) { inflight[c.color]++; });
    world.sources.forEach(function (s) { queued[s.color] += s.queue; });
    for (var i = 0; i < world.sources.length; i++) {
      var s = world.sources[i];
      var c = s.color;
      var from = s.tile * 2;
      var to = world._next[c][from];
      var connected = to >= 0;
      var need = isThrough(world, c) ? Infinity : world.quota[c] - world.delivered[c] - inflight[c] - queued[c];
      var interval = intervalFor(world, c);
      if (connected && need > 0) {
        s.timer += dt;
        if (s.timer >= interval) {
          if (s.queue < QUEUE_MAX) {
            s.timer -= interval;
            s.queue++;
            queued[c]++;
          } else {
            s.timer = interval;
          }
        }
      }
      if (connected && s.queue > 0 && canEnter(world, from, to, c)) {
        var car = { id: world._nextCar++, color: c, node: to, prev: from, t: 0, wait: 0, lost: 0 };
        occupy(world, car, 1);
        world.cars.push(car);
        s.queue--;
        queued[c]--;
        inflight[c]++;
      }
      if (connected && s.queue >= QUEUE_MAX - 1) {
        s.fullFor += dt;
        if (s.fullFor >= QUEUE_FULL_S) {
          penalty(world, 'queue', s.tile);
          queued[c] -= s.queue;
          s.queue = 0;
          s.fullFor = 0;
        }
      } else {
        s.fullFor = 0;
      }
    }
  }

  function stepJams(world) {
    var stuck = null;
    for (var i = 0; i < world.cars.length; i++) {
      if (world.cars[i].wait >= STUCK_S) {
        stuck = world.cars[i];
        break;
      }
    }
    if (!stuck) return;
    penalty(world, 'gridlock', stuck.node >> 1);
    world.cars = world.cars.filter(function (c) {
      if (c.wait < STUCK_CLEAR_S) return true;
      occupy(world, c, -1);
      return false;
    });
  }

  function step(world, dt) {
    if (world.cleared) return;
    world.time += dt;
    stepCars(world, dt);
    stepSources(world, dt);
    stepJams(world);
    for (var c = 0; c < world.quota.length; c++) if (world.delivered[c] < world.quota[c]) return;
    world.cleared = true;
    world.events.push({ type: 'cleared' });
  }

  function isRoad(world, t) {
    return world._deg[t] + world._ramp[t] > 0;
  }

  function groundDegree(world, t) {
    return world._deg[t] + world._ramp[t];
  }

  function isJunction(world, t) {
    return world._junction[t] === 1;
  }

  function carPos(world, car) {
    var a = car.prev >> 1;
    var b = car.node >> 1;
    var t = Math.max(0, Math.min(1, car.t));
    var ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
    return {
      x: ax + (bx - ax) * t + 0.5,
      y: ay + (by - ay) * t + 0.5,
      layer: (car.node & 1) || (car.prev & 1) ? 1 : 0,
      dir: Math.max(0, dirOf(a, b))
    };
  }

  var Sim = {
    K: K,
    DT: DT,
    QUEUE_MAX: QUEUE_MAX,
    PENALTY_S: PENALTY_S,
    W: W,
    H: H,
    createWorld: createWorld,
    roadStroke: roadStroke,
    bridgeCheck: bridgeCheck,
    placeBridge: placeBridge,
    eraseAt: eraseAt,
    step: step,
    usage: usage,
    isRoad: isRoad,
    groundDegree: groundDegree,
    isJunction: isJunction,
    carPos: carPos
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.Sim = Sim;
})(this);
