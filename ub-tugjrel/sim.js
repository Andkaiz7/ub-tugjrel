(function (root) {
  var TIME_SCALE = 50;
  var DT = 1;
  var CARS_PER_AGENT = 10;
  var LANE_FLOW = 0.5;
  var JAM_SPACING = 7.5;
  var MAJOR_CLS = 1;
  var NODE_FACTOR_PLAIN = 0.35;
  var NODE_FACTOR_LIGHTS = 0.55;
  var NODE_FACTOR_OVERPASS = 1.5;
  var DEMAND = 2.0;
  var ODD_EVEN_EVERY = 10;
  var HOME_RADIUS = 1400;
  var HOME_GATES = 6;
  var WORK_RADIUS = 700;
  var WORK_GATES = 5;
  var ROUTE_EVERY = 60;
  var GIVE_UP = 900;
  var LOST_AFTER = 30;
  var MAX_LANES = 4;
  var MAX_ROAD = 3000;
  var NEW_EDGES = 48;
  var COSTS = { overpass: 30, lights: 12, widenPerKm: 12, roadPerKm: 14, bridge: 25, oddeven: 60 };

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function polyLen(pts) {
    var cum = [0];
    var total = 0;
    for (var i = 2; i < pts.length; i += 2) {
      total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      cum.push(total);
    }
    return { cum: cum, len: Math.max(total, 10) };
  }

  function createCity(map, sc) {
    var nodeCount = map.nodes.length / 2;
    var cap = map.edges.length + NEW_EDGES;
    var city = {
      map: map,
      scenario: sc,
      time: sc.start,
      start: sc.start,
      end: sc.end,
      done: false,
      nodeCount: nodeCount,
      nx: new Float64Array(nodeCount),
      ny: new Float64Array(nodeCount),
      deg: new Uint8Array(nodeCount),
      signal: new Uint8Array(nodeCount),
      edgeCount: 0,
      ea: new Int32Array(cap),
      eb: new Int32Array(cap),
      lanes: new Uint8Array(cap),
      baseLanes: new Uint8Array(cap),
      oneway: new Uint8Array(cap),
      cls: new Uint8Array(cap),
      ename: new Int32Array(cap),
      added: new Uint8Array(cap),
      kmh: new Float64Array(cap),
      epts: [],
      ecum: [],
      elen: new Float64Array(cap),
      overpass: new Uint8Array(nodeCount),
      lights: new Uint8Array(nodeCount),
      oddEven: false,
      budget: sc.budget,
      spent: 0,
      fixes: 0,
      arrived: 0,
      failed: 0,
      rate: 0,
      active: 0,
      waiting: 0,
      score: 0,
      speed: 0,
      speedNow: 0,
      _stepMeters: 0,
      _meters: 0,
      _agentSec: 0,
      cars: [],
      events: [],
      _cap: cap,
      _lq: [],
      _lcount: new Int32Array(cap * 2),
      _lslow: new Float64Array(cap * 2),
      _lstore: new Float64Array(cap * 2),
      _lflow: new Float64Array(cap * 2),
      _ltok: new Float64Array(cap * 2),
      _lvf: new Float64Array(cap * 2),
      _lexists: new Uint8Array(cap * 2),
      _ntok: new Float64Array(nodeCount),
      _nrate: new Float64Array(nodeCount),
      _jam: new Float64Array(nodeCount),
      _in: [],
      _out: [],
      _homes: [],
      _works: [],
      _next: [],
      _dist: new Float64Array(nodeCount),
      _cost: new Float64Array(cap * 2),
      _rng: mulberry(20261115),
      _lastRoute: -1e9,
      _buckets: new Float64Array(Math.ceil((sc.end - sc.start) / 60) + 2),
      _nextAgent: 1,
      _oe: 0,
      _order: 0
    };
    for (var n = 0; n < nodeCount; n++) {
      city.nx[n] = map.nodes[n * 2];
      city.ny[n] = map.nodes[n * 2 + 1];
      city._in.push([]);
      city._out.push([]);
    }
    for (var l = 0; l < cap * 2; l++) city._lq.push([]);
    map.edges.forEach(function (e) {
      var pts = [city.nx[e[0]], city.ny[e[0]]].concat(e[8], [city.nx[e[1]], city.ny[e[1]]]);
      addEdge(city, e[0], e[1], e[2], e[3], e[4], e[5], e[6], pts, 0);
    });
    sc.zones.forEach(function (z) {
      var home = z.kind === 'home';
      var gates = gatesNear(city, z.x, z.y, home ? HOME_RADIUS : WORK_RADIUS, home ? HOME_GATES : WORK_GATES);
      var entry = { zone: z, node: gates[0], gates: gates, weight: z.weight, acc: 0, turn: 0, queues: gates.map(function () { return []; }) };
      if (home) city._homes.push(entry);
      else {
        entry.isDest = new Uint8Array(nodeCount);
        gates.forEach(function (g) { entry.isDest[g] = 1; });
        city._works.push(entry);
      }
    });
    city._workSum = 0;
    city._works.forEach(function (w) { city._workSum += w.weight; });
    city._homeSum = 0;
    city._homes.forEach(function (h) { city._homeSum += h.weight; });
    city._works.forEach(function () { city._next.push(new Int32Array(nodeCount)); });
    refreshNodes(city);
    route(city);
    return city;
  }

  function gatesNear(city, x, y, radius, count) {
    var list = [];
    for (var n = 0; n < city.nodeCount; n++) {
      if (!city.deg[n]) continue;
      var d = Math.hypot(city.nx[n] - x, city.ny[n] - y);
      list.push([d, n]);
    }
    list.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var out = [list[0][1]];
    for (var i = 1; i < list.length && out.length < count; i++) if (list[i][0] <= radius) out.push(list[i][1]);
    return out;
  }

  function addEdge(city, a, b, oneway, lanes, kmh, cls, name, pts, added) {
    var e = city.edgeCount++;
    city.ea[e] = a;
    city.eb[e] = b;
    city.oneway[e] = oneway;
    city.lanes[e] = lanes;
    city.baseLanes[e] = lanes;
    city.kmh[e] = kmh;
    city.cls[e] = cls;
    city.ename[e] = name;
    city.added[e] = added;
    city.epts[e] = pts;
    var pl = polyLen(pts);
    city.ecum[e] = pl.cum;
    city.elen[e] = pl.len;
    city._lexists[e * 2] = 1;
    city._lexists[e * 2 + 1] = oneway ? 0 : 1;
    city._out[a].push(e * 2);
    city._in[b].push(e * 2);
    if (!oneway) {
      city._out[b].push(e * 2 + 1);
      city._in[a].push(e * 2 + 1);
    }
    city.deg[a]++;
    city.deg[b]++;
    setLinkParams(city, e);
    return e;
  }

  function setLinkParams(city, e) {
    for (var d = 0; d < 2; d++) {
      var l = e * 2 + d;
      if (!city._lexists[l]) continue;
      var n = city.lanes[e];
      city._lstore[l] = Math.max(1.5, city.elen[e] * n / (JAM_SPACING * CARS_PER_AGENT));
      city._lflow[l] = n * LANE_FLOW / CARS_PER_AGENT;
      city._lvf[l] = Math.max(4, city.kmh[e] / 3.6);
    }
  }

  function linkFrom(city, l) { return (l & 1) ? city.eb[l >> 1] : city.ea[l >> 1]; }
  function linkTo(city, l) { return (l & 1) ? city.ea[l >> 1] : city.eb[l >> 1]; }

  function refreshNodes(city) {
    for (var m = 0; m < city.nodeCount; m++) city.signal[m] = 0;
    for (var e = 0; e < city.edgeCount; e++) {
      if (city.cls[e] <= MAJOR_CLS) {
        city.signal[city.ea[e]]++;
        city.signal[city.eb[e]]++;
      }
    }
    for (var k = 0; k < city.nodeCount; k++) city.signal[k] = city.deg[k] >= 3 && city.signal[k] >= 2 && city.signal[k] < city.deg[k] + 1 && majorCross(city, k) ? 1 : 0;
    for (var n = 0; n < city.nodeCount; n++) {
      if (!city.signal[n]) {
        city._nrate[n] = Infinity;
        continue;
      }
      var lanes = 0;
      var ins = city._in[n];
      for (var i = 0; i < ins.length; i++) lanes += city.lanes[ins[i] >> 1];
      var f = city.overpass[n] ? NODE_FACTOR_OVERPASS : city.lights[n] ? NODE_FACTOR_LIGHTS : NODE_FACTOR_PLAIN;
      city._nrate[n] = f * lanes * LANE_FLOW / CARS_PER_AGENT;
    }
  }

  function majorCross(city, n) {
    var major = 0;
    var minor = 0;
    var outs = city._out[n].concat(city._in[n]);
    var seen = {};
    for (var i = 0; i < outs.length; i++) {
      var e = outs[i] >> 1;
      if (seen[e]) continue;
      seen[e] = 1;
      if (city.cls[e] <= MAJOR_CLS) major++;
      else minor++;
    }
    return major >= 3;
  }

  function speedOf(city, l) {
    var occ = city._lcount[l] / city._lstore[l];
    return city._lvf[l] * Math.max(0.06, 1 - occ);
  }

  function linkCost(city, l) {
    var e = l >> 1;
    var t = city.elen[e] / speedOf(city, l);
    var to = linkTo(city, l);
    var q = city._lcount[l];
    var rate = Math.min(city._lflow[l], city._nrate[to]);
    return t + 0.6 * q / Math.max(rate, 1e-3);
  }

  function route(city) {
    city._lastRoute = city.time;
    var L = city.edgeCount * 2;
    for (var l = 0; l < L; l++) if (city._lexists[l]) city._cost[l] = linkCost(city, l);
    for (var w = 0; w < city._works.length; w++) dijkstra(city, city._works[w].gates, city._next[w]);
  }

  function dijkstra(city, targets, next) {
    var dist = city._dist;
    dist.fill(Infinity);
    next.fill(-1);
    var heap = [];
    var hd = [];
    targets.forEach(function (t) {
      dist[t] = 0;
      heap.push(t);
      hd.push(0);
    });
    while (heap.length) {
      var u = heap[0];
      var du = hd[0];
      var lastN = heap.pop();
      var lastD = hd.pop();
      if (heap.length) {
        var i = 0;
        var len = heap.length;
        for (;;) {
          var c = i * 2 + 1;
          if (c >= len) break;
          if (c + 1 < len && hd[c + 1] < hd[c]) c++;
          if (hd[c] >= lastD) break;
          heap[i] = heap[c];
          hd[i] = hd[c];
          i = c;
        }
        heap[i] = lastN;
        hd[i] = lastD;
      }
      if (du > dist[u]) continue;
      var ins = city._in[u];
      for (var k = 0; k < ins.length; k++) {
        var l = ins[k];
        var v = linkFrom(city, l);
        var nd = du + city._cost[l];
        if (nd < dist[v]) {
          dist[v] = nd;
          next[v] = l;
          var j = heap.length;
          heap.push(v);
          hd.push(nd);
          while (j > 0) {
            var p = (j - 1) >> 1;
            if (hd[p] <= nd) break;
            heap[j] = heap[p];
            hd[j] = hd[p];
            j = p;
          }
          heap[j] = v;
          hd[j] = nd;
        }
      }
    }
  }

  function profile(t) {
    var h = t / 3600;
    return 0.35 + 0.65 * Math.max(0, 1 - Math.abs(h - 8) / 1);
  }

  function pickWork(city) {
    var r = city._rng() * city._workSum;
    for (var i = 0; i < city._works.length; i++) {
      r -= city._works[i].weight;
      if (r <= 0) return i;
    }
    return city._works.length - 1;
  }

  function addCar(city, agent) {
    agent.ci = city.cars.length;
    city.cars.push(agent);
  }

  function removeCar(city, agent) {
    var last = city.cars.pop();
    if (last !== agent) {
      city.cars[agent.ci] = last;
      last.ci = agent.ci;
    }
    agent.ci = -1;
  }

  function enterLink(city, agent, l) {
    agent.link = l;
    agent.s = 0;
    agent.wait = 0;
    city._lq[l].push(agent);
    city._lcount[l]++;
  }

  function deliver(city) {
    city.arrived += CARS_PER_AGENT;
    var b = Math.floor((city.time - city.start) / 60);
    if (b >= 0 && b < city._buckets.length) city._buckets[b] += CARS_PER_AGENT;
  }

  function moveLinks(city, dt) {
    var L = city.edgeCount * 2;
    for (var l = 0; l < L; l++) {
      var q = city._lq[l];
      if (!q.length) continue;
      var len = city.elen[l >> 1];
      var v = city._lvf[l] * dt;
      var gap = len / city._lstore[l];
      var front = len + gap;
      var slow = 0;
      for (var i = 0; i < q.length; i++) {
        var a = q[i];
        var target = Math.min(a.s + v, front - gap, len);
        var moved = target > a.s ? target - a.s : 0;
        if (moved) {
          city._meters += moved;
          city._stepMeters += moved;
          a.s = target;
        }
        if (moved < v * 0.3) slow++;
        front = a.s;
      }
      city._lslow[l] = city._lslow[l] * 0.9 + (slow / q.length) * Math.min(1, q.length / 2) * 0.1;
    }
  }

  function dropHead(city, l, agent) {
    city._lq[l].shift();
    city._lcount[l]--;
    removeCar(city, agent);
  }

  function transfer(city, dt) {
    var L = city.edgeCount * 2;
    var start = city._order++ % Math.max(1, L);
    for (var j = 0; j < city.nodeCount; j++) city._jam[j] *= 0.97;
    for (var k = 0; k < L; k++) {
      var l = (start + k) % L;
      var q = city._lq[l];
      var moves = 0;
      while (q.length && moves < 3) {
        var a = q[0];
        if (a.s < city.elen[l >> 1] - 0.5) break;
        var node = linkTo(city, l);
        if (city._works[a.dest].isDest[node]) {
          dropHead(city, l, a);
          deliver(city);
          moves++;
          continue;
        }
        var next = city._next[a.dest][node];
        if (next < 0) {
          a.wait += dt;
          if (a.wait > LOST_AFTER) {
            dropHead(city, l, a);
            city.failed += CARS_PER_AGENT;
          }
          break;
        }
        if (!(city._lcount[next] < city._lstore[next] && city._ltok[l] >= 1 && city._ntok[node] >= 1)) {
          a.wait += dt;
          if (city._lcount[next] < city._lstore[next]) city._jam[node] += 1;
          if (a.wait > GIVE_UP) {
            dropHead(city, l, a);
            city.failed += CARS_PER_AGENT;
          }
          break;
        }
        q.shift();
        city._lcount[l]--;
        city._ltok[l] -= 1;
        if (city._nrate[node] !== Infinity) city._ntok[node] -= 1;
        enterLink(city, a, next);
        moves++;
      }
    }
  }

  function refill(city, dt) {
    var L = city.edgeCount * 2;
    for (var l = 0; l < L; l++) {
      if (!city._lexists[l]) continue;
      var f = city._lflow[l];
      city._ltok[l] = Math.min(Math.max(2, f * 2), city._ltok[l] + f * dt);
    }
    for (var n = 0; n < city.nodeCount; n++) {
      var r = city._nrate[n];
      city._ntok[n] = r === Infinity ? Infinity : Math.min(Math.max(2, r * 2), city._ntok[n] + r * dt);
    }
  }

  function spawn(city, dt) {
    var rate = DEMAND * profile(city.time);
    var waiting = 0;
    for (var i = 0; i < city._homes.length; i++) {
      var h = city._homes[i];
      h.acc += rate * h.weight / city._homeSum * dt;
      while (h.acc >= 1) {
        h.acc -= 1;
        if (city.oddEven && (++city._oe % ODD_EVEN_EVERY) === 0) continue;
        h.queues[h.turn].push({ id: city._nextAgent++, home: i, dest: pickWork(city), link: -1, s: 0, wait: 0, ci: -1 });
        h.turn = (h.turn + 1) % h.gates.length;
      }
      for (var g = 0; g < h.gates.length; g++) {
        var node = h.gates[g];
        var queue = h.queues[g];
        var entered = 0;
        while (queue.length && entered < 2) {
          var a = queue[0];
          if (city._works[a.dest].isDest[node]) {
            queue.shift();
            deliver(city);
            continue;
          }
          var next = city._next[a.dest][node];
          if (next < 0 || city._lcount[next] >= city._lstore[next]) break;
          queue.shift();
          enterLink(city, a, next);
          addCar(city, a);
          entered++;
        }
        waiting += queue.length;
      }
    }
    city.waiting = waiting;
  }

  function stats(city) {
    var b = Math.floor((city.time - city.start) / 60);
    var sum = 0;
    var n = 0;
    for (var i = Math.max(0, b - 5); i < b; i++) {
      sum += city._buckets[i];
      n++;
    }
    city.rate = n ? sum / n : 0;
    city.active = city.cars.length;
    city._agentSec += city.active + city.waiting;
    var inst = city.active + city.waiting ? city._stepMeters / (city.active + city.waiting) * 3.6 : city.speedNow;
    city.speedNow = city.speedNow ? city.speedNow * 0.98 + inst * 0.02 : inst;
    city._stepMeters = 0;
    city.speed = city._agentSec ? city._meters / city._agentSec * 3.6 : 0;
    city.score = Math.round(city.speed * 10);
  }

  function step(city, dt) {
    if (city.done) return;
    dt = dt || DT;
    city.time += dt;
    if (city.time - city._lastRoute >= ROUTE_EVERY) route(city);
    refill(city, dt);
    moveLinks(city, dt);
    transfer(city, dt);
    spawn(city, dt);
    stats(city);
    if (city.time >= city.end) {
      city.time = city.end;
      city.done = true;
    }
  }

  function linkLoad(city, l) {
    if (!city._lexists[l]) return 0;
    var occ = city._lcount[l] / city._lstore[l];
    if (!city._lq[l].length) city._lslow[l] *= 0.98;
    return Math.min(1, Math.max(occ * 1.15, city._lslow[l]));
  }

  function edgeLoad(city, e) {
    return Math.max(linkLoad(city, e * 2), linkLoad(city, e * 2 + 1));
  }

  function nodeLoad(city, n) {
    var ins = city._in[n];
    var m = 0;
    for (var i = 0; i < ins.length; i++) m = Math.max(m, linkLoad(city, ins[i]));
    return m;
  }

  function hotspots(city, k) {
    var list = [];
    for (var n = 0; n < city.nodeCount; n++) if (city.signal[n] && city._jam[n] >= 8) list.push(n);
    list.sort(function (a, b) { return city._jam[b] - city._jam[a] || a - b; });
    return list.slice(0, k);
  }

  function nearestNode(city, x, y, maxDist, junctionsOnly) {
    var best = -1;
    var bd = maxDist * maxDist;
    for (var n = 0; n < city.nodeCount; n++) {
      if (!city.deg[n] || (junctionsOnly && !city.signal[n])) continue;
      var dx = city.nx[n] - x;
      var dy = city.ny[n] - y;
      var d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax;
    var dy = by - ay;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function nearestEdge(city, x, y, maxDist) {
    var best = -1;
    var bd = maxDist;
    for (var e = 0; e < city.edgeCount; e++) {
      var p = city.epts[e];
      for (var i = 2; i < p.length; i += 2) {
        var d = segDist(x, y, p[i - 2], p[i - 1], p[i], p[i + 1]);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
    }
    return best;
  }

  function carPose(city, car) {
    var l = car.link;
    var e = l >> 1;
    var pts = city.epts[e];
    var cum = city.ecum[e];
    var len = city.elen[e];
    var s = Math.max(0, Math.min(len, car.s));
    var along = (l & 1) ? len - s : s;
    var i = 1;
    while (i < cum.length - 1 && cum[i] < along) i++;
    var segLen = cum[i] - cum[i - 1] || 1;
    var t = Math.max(0, Math.min(1, (along - cum[i - 1]) / segLen));
    var ax = pts[(i - 1) * 2];
    var ay = pts[(i - 1) * 2 + 1];
    var bx = pts[i * 2];
    var by = pts[i * 2 + 1];
    var dx = bx - ax;
    var dy = by - ay;
    if (l & 1) {
      dx = -dx;
      dy = -dy;
    }
    var nl = Math.hypot(dx, dy) || 1;
    var off = city.oneway[e] ? 0 : 3;
    return {
      x: ax + (bx - ax) * t - dy / nl * off,
      y: ay + (by - ay) * t + dx / nl * off,
      angle: Math.atan2(dy, dx)
    };
  }

  function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
    var d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    var d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    var d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    var d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  function crossesRiver(city, ax, ay, bx, by) {
    var rivers = city.map.rivers || [];
    for (var r = 0; r < rivers.length; r++) {
      var p = rivers[r].pts;
      for (var i = 2; i < p.length; i += 2) {
        if (segmentsCross(ax, ay, bx, by, p[i - 2], p[i - 1], p[i], p[i + 1])) return true;
      }
    }
    return false;
  }

  function edgeBetween(city, a, b) {
    var outs = city._out[a];
    for (var i = 0; i < outs.length; i++) if (linkTo(city, outs[i]) === b) return true;
    var ins = city._in[a];
    for (var j = 0; j < ins.length; j++) if (linkFrom(city, ins[j]) === b) return true;
    return false;
  }

  function quote(city, action) {
    var cost;
    var t = action && action.type;
    if (t === 'overpass' || t === 'lights') {
      var n = action.node;
      if (!(n >= 0 && n < city.nodeCount) || !city.signal[n]) return { ok: false, cost: 0, reason: 'notJunction' };
      if (city.overpass[n] || (t === 'lights' && city.lights[n])) return { ok: false, cost: 0, reason: 'already' };
      cost = t === 'overpass' ? COSTS.overpass : COSTS.lights;
    } else if (t === 'widen') {
      var e = action.edge;
      if (!(e >= 0 && e < city.edgeCount)) return { ok: false, cost: 0, reason: 'same' };
      if (city.lanes[e] >= MAX_LANES) return { ok: false, cost: 0, reason: 'maxLanes' };
      cost = Math.max(4, Math.round(city.elen[e] / 1000 * COSTS.widenPerKm));
    } else if (t === 'road') {
      var a = action.a;
      var b = action.b;
      if (!(a >= 0 && b >= 0 && a < city.nodeCount && b < city.nodeCount) || a === b) return { ok: false, cost: 0, reason: 'same' };
      if (edgeBetween(city, a, b)) return { ok: false, cost: 0, reason: 'exists' };
      var len = Math.hypot(city.nx[b] - city.nx[a], city.ny[b] - city.ny[a]);
      if (len > MAX_ROAD || city.edgeCount >= city._cap) return { ok: false, cost: 0, reason: 'tooLong' };
      cost = Math.max(4, Math.round(len / 1000 * COSTS.roadPerKm));
      if (crossesRiver(city, city.nx[a], city.ny[a], city.nx[b], city.ny[b])) cost += COSTS.bridge;
    } else if (t === 'oddeven') {
      if (city.oddEven) return { ok: false, cost: 0, reason: 'already' };
      cost = COSTS.oddeven;
    } else {
      return { ok: false, cost: 0, reason: 'same' };
    }
    if (cost > city.budget) return { ok: false, cost: cost, reason: 'budget' };
    return { ok: true, cost: cost, reason: null };
  }

  function apply(city, action) {
    var q = quote(city, action);
    if (!q.ok || city.done) return q;
    var x = 0;
    var y = 0;
    if (action.type === 'overpass' || action.type === 'lights') {
      if (action.type === 'overpass') city.overpass[action.node] = 1;
      else city.lights[action.node] = 1;
      x = city.nx[action.node];
      y = city.ny[action.node];
      refreshNodes(city);
    } else if (action.type === 'widen') {
      var e = action.edge;
      city.lanes[e]++;
      setLinkParams(city, e);
      refreshNodes(city);
      var p = city.epts[e];
      var mid = (p.length / 4) | 0;
      x = p[mid * 2];
      y = p[mid * 2 + 1];
    } else if (action.type === 'road') {
      var a = action.a;
      var b = action.b;
      addEdge(city, a, b, 0, 2, 50, 2, -1, [city.nx[a], city.ny[a], city.nx[b], city.ny[b]], 1);
      refreshNodes(city);
      x = (city.nx[a] + city.nx[b]) / 2;
      y = (city.ny[a] + city.ny[b]) / 2;
    } else {
      city.oddEven = true;
      x = city.map.w / 2;
      y = city.map.h / 2;
    }
    city.budget -= q.cost;
    city.spent += q.cost;
    city.fixes++;
    city.events.push({ type: 'built', action: action, x: x, y: y });
    route(city);
    return q;
  }

  var Sim = {
    TIME_SCALE: TIME_SCALE,
    DT: DT,
    CARS_PER_AGENT: CARS_PER_AGENT,
    COSTS: COSTS,
    createCity: createCity,
    step: step,
    carPose: carPose,
    edgeLoad: edgeLoad,
    nodeLoad: nodeLoad,
    hotspots: hotspots,
    nearestNode: nearestNode,
    nearestEdge: nearestEdge,
    quote: quote,
    apply: apply
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
  else root.Sim = Sim;
})(this);
