const assert = require('assert');
const path = require('path');
const M = require(path.join(__dirname, '../ub-tugjrel/map-data.js'));
const S = require(path.join(__dirname, '../ub-tugjrel/scenario.js'));
const Sim = require(path.join(__dirname, '../ub-tugjrel/sim.js'));

function run(policy) {
  const c = Sim.createCity(M, S);
  while (!c.done) {
    Sim.step(c, Sim.DT);
    if (policy && (c.time - S.start) % 300 === 0) policy(c);
  }
  return c;
}

function firstSignal(c, skip) {
  let k = 0;
  for (let n = 0; n < c.nodeCount; n++) if (c.signal[n] && k++ >= (skip || 0)) return n;
  return -1;
}

const base = run();

const tests = {
  map_and_city() {
    assert(M.nodes.length / 2 > 1000 && M.edges.length > 1500, 'real network loaded');
    assert(M.attribution.includes('OpenStreetMap'));
    const c = Sim.createCity(M, S);
    assert.strictEqual(c.nodeCount, M.nodes.length / 2);
    assert.strictEqual(c.edgeCount, M.edges.length);
    assert.strictEqual(c.time, 25200);
    assert(c._homes.length === 13 && c._works.length === 6);
    let signals = 0;
    for (let n = 0; n < c.nodeCount; n++) signals += c.signal[n];
    assert(signals > 50, 'signalized junctions exist');
    for (const e of [0, 100, c.edgeCount - 1]) assert(c.epts[e].length >= 4 && c.elen[e] > 0);
  },

  full_run_is_deterministic_and_plausible() {
    const again = run();
    assert.strictEqual(again.speed, base.speed);
    assert.strictEqual(again.score, Math.round(again.speed * 10));
    assert(base.done && base.time === S.end);
    assert(base.speed > 8 && base.speed < 25, 'rush-hour speed ' + base.speed);
    assert(base.arrived > 30000, 'cars arrive ' + base.arrived);
  },

  actions_and_costs() {
    const c = Sim.createCity(M, S);
    let plain = -1;
    for (let n = 0; n < c.nodeCount; n++) if (c.deg[n] >= 3 && !c.signal[n]) { plain = n; break; }
    assert.strictEqual(Sim.quote(c, { type: 'overpass', node: plain }).reason, 'notJunction');
    const j = firstSignal(c);
    let r = Sim.apply(c, { type: 'overpass', node: j });
    assert(r.ok && r.cost === Sim.COSTS.overpass && c.budget === S.budget - Sim.COSTS.overpass && c.overpass[j] === 1);
    assert.strictEqual(Sim.quote(c, { type: 'overpass', node: j }).reason, 'already');
    assert.strictEqual(Sim.quote(c, { type: 'lights', node: j }).reason, 'already');
    assert.strictEqual(c.events[0].type, 'built');
    let e = 0;
    while (c.lanes[e] >= 4) e++;
    while (Sim.quote(c, { type: 'widen', edge: e }).ok && c.lanes[e] < 4) Sim.apply(c, { type: 'widen', edge: e });
    assert(c.lanes[e] === 4 ? Sim.quote(c, { type: 'widen', edge: e }).reason === 'maxLanes' : Sim.quote(c, { type: 'widen', edge: e }).reason === 'budget');
    assert.strictEqual(Sim.quote(c, { type: 'road', a: 5, b: 5 }).reason, 'same');
    assert.strictEqual(Sim.quote(c, { type: 'road', a: c.ea[0], b: c.eb[0] }).reason, 'exists');
    let far = -1;
    for (let n = 0; n < c.nodeCount; n++) if (Math.hypot(c.nx[n] - c.nx[0], c.ny[n] - c.ny[0]) > 5000) { far = n; break; }
    assert.strictEqual(Sim.quote(c, { type: 'road', a: 0, b: far }).reason, 'tooLong');
    const fresh = Sim.createCity(M, S);
    assert(Sim.apply(fresh, { type: 'oddeven' }).ok && fresh.oddEven);
    assert.strictEqual(Sim.quote(fresh, { type: 'oddeven' }).reason, 'already');
    const poor = Sim.createCity(M, S);
    poor.budget = 5;
    assert.strictEqual(Sim.quote(poor, { type: 'overpass', node: j }).reason, 'budget');
  },

  new_road_and_bridge_cost() {
    const c = Sim.createCity(M, S);
    let pair = null;
    let bridged = null;
    for (let a = 0; a < c.nodeCount && !(pair && bridged); a += 7) {
      for (let b = a + 1; b < c.nodeCount; b += 13) {
        const d = Math.hypot(c.nx[a] - c.nx[b], c.ny[a] - c.ny[b]);
        if (d < 600 || d > 2000) continue;
        const q = Sim.quote(c, { type: 'road', a, b });
        if (!q.ok) continue;
        const plainCost = Math.max(4, Math.round(d / 1000 * Sim.COSTS.roadPerKm));
        if (q.cost === plainCost && !pair) pair = [a, b];
        if (q.cost === plainCost + Sim.COSTS.bridge && !bridged) bridged = [a, b];
        if (pair && bridged) break;
      }
    }
    assert(pair && bridged, 'found plain and river-crossing roads');
    const before = c.edgeCount;
    assert(Sim.apply(c, { type: 'road', a: pair[0], b: pair[1] }).ok);
    assert.strictEqual(c.edgeCount, before + 1);
    assert.strictEqual(c.added[before], 1);
    for (let i = 0; i < 600; i++) Sim.step(c, Sim.DT);
  },

  targeted_fixes_beat_random() {
    const lights = run((c) => Sim.hotspots(c, 2).forEach((n) => Sim.apply(c, { type: 'lights', node: n })));
    const random = run((c) => { const n = (c.time * 7919) % c.nodeCount; if (c.signal[n]) Sim.apply(c, { type: 'lights', node: n }); });
    assert(lights.speed > base.speed * 1.05, 'hotspot lights help: ' + lights.speed.toFixed(2) + ' vs ' + base.speed.toFixed(2));
    assert(lights.speed > random.speed, 'targeting matters');
    const oe = run((c) => Sim.apply(c, { type: 'oddeven' }));
    assert(oe.speed > base.speed, 'odd-even helps');
    console.log('   speed base ' + base.speed.toFixed(2) + ', hotspot lights ' + lights.speed.toFixed(2) + ', random lights ' + random.speed.toFixed(2) + ', odd-even ' + oe.speed.toFixed(2));
  },

  poses_and_picking() {
    const c = Sim.createCity(M, S);
    for (let i = 0; i < 1500; i++) Sim.step(c, Sim.DT);
    assert(c.cars.length > 100);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let n = 0; n < c.nodeCount; n++) { minX = Math.min(minX, c.nx[n]); maxX = Math.max(maxX, c.nx[n]); minY = Math.min(minY, c.ny[n]); maxY = Math.max(maxY, c.ny[n]); }
    for (const car of c.cars) {
      const p = Sim.carPose(c, car);
      assert(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.angle));
      assert(p.x > minX - 50 && p.x < maxX + 50 && p.y > minY - 50 && p.y < maxY + 50);
    }
    const hot = Sim.hotspots(c, 5);
    assert(hot.length > 0 && hot.every((n) => c.signal[n]));
    const e = 10;
    const p = c.epts[e];
    assert.strictEqual(Sim.nearestEdge(c, (p[0] + p[2]) / 2, (p[1] + p[3]) / 2, 30), e);
    const j = firstSignal(c, 3);
    assert.strictEqual(Sim.nearestNode(c, c.nx[j] + 2, c.ny[j] - 2, 50, true), j);
    for (let k = 0; k < c.edgeCount; k++) { const l = Sim.edgeLoad(c, k); assert(l >= 0 && l <= 1); }
  },
};

tests.challenges = function () {
  assert.strictEqual(S.spots.length, 5);
  function play(spot, policy) {
    const c = Sim.createCity(M, S);
    const ch = Sim.createChallenge(c, spot);
    assert(ch.edges.length > 5 && ch.jam > 0 && ch.target >= 20 && c.time > spot.start && ch.start === c.time && c.focus);
    if (policy) policy(c, ch);
    while (!c.done && !ch.cleared) { Sim.step(c, Sim.DT); Sim.updateChallenge(ch, c); }
    return ch;
  }
  const z = S.spots[0];
  const none = play(z);
  assert(none.failed && !none.cleared, 'doing nothing does not clear ' + z.id);
  const fixed = play(z, (c) => {
    let best = -1;
    for (let n = 0; n < c.nodeCount; n++) if (c.signal[n] && Math.hypot(c.nx[n] - z.x, c.ny[n] - z.y) <= z.r && (best < 0 || c._jam[n] > c._jam[best])) best = n;
    assert(Sim.apply(c, { type: 'overpass', node: best }).ok);
  });
  assert(fixed.cleared && fixed.time > 0 && fixed.time <= z.par[1], 'one overpass clears ' + z.id + ' in ' + fixed.time);
  const again = play(z, (c) => {
    let best = -1;
    for (let n = 0; n < c.nodeCount; n++) if (c.signal[n] && Math.hypot(c.nx[n] - z.x, c.ny[n] - z.y) <= z.r && (best < 0 || c._jam[n] > c._jam[best])) best = n;
    Sim.apply(c, { type: 'overpass', node: best });
  });
  assert.strictEqual(again.time, fixed.time, 'deterministic');
  console.log('   ' + z.id + ': nothing fails, one overpass clears in ' + Math.round(fixed.time / 60) + ' min');
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log('ok ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
}
process.exit(failed ? 1 : 0);
