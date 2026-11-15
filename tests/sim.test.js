const assert = require('assert');
const path = require('path');
const { LEVELS, COLORS } = require(path.join(__dirname, '../ub-tugjrel/levels.js'));
const Sim = require(path.join(__dirname, '../ub-tugjrel/sim.js'));

const W = 9;
const t = (x, y) => y * W + x;

function lv(rows, extra) {
  const full = rows.slice();
  while (full.length < 14) full.push('.........');
  return Object.assign({ id: 'test', name: { mn: 'T', en: 'T' }, map: { x: 0.5, y: 0.5 }, rows: full, roads: 99, bridges: 9, quota: [5], interval: 1, speed: 3 }, extra || {});
}

function expand(points) {
  const out = [t(points[0][0], points[0][1])];
  for (let i = 1; i < points.length; i++) {
    let [x, y] = points[i - 1];
    const [tx, ty] = points[i];
    assert(x === tx || y === ty, 'waypoints must be straight');
    while (x !== tx || y !== ty) {
      x += Math.sign(tx - x);
      y += Math.sign(ty - y);
      out.push(t(x, y));
    }
  }
  return out;
}

function build(world, ops) {
  for (const op of ops) {
    if (op[0] === 'r') {
      const r = Sim.roadStroke(world, expand(op[1]));
      assert.strictEqual(r.stop, null, 'road stroke failed: ' + JSON.stringify(op) + ' ' + r.stop);
    } else {
      const r = Sim.placeBridge(world, t(op[1][0], op[1][1]), t(op[2][0], op[2][1]));
      assert(r.ok, 'bridge failed: ' + JSON.stringify(op) + ' ' + r.reason);
    }
  }
}

function runUntil(world, cond, maxSeconds) {
  const steps = Math.round(maxSeconds / Sim.DT);
  for (let i = 0; i < steps; i++) {
    Sim.step(world, Sim.DT);
    if (cond(world)) return true;
  }
  return false;
}

const SOLUTIONS = {
  yarmag: [
    ['r', [[2, 12], [2, 8]]],
    ['b', [2, 8], [2, 5]],
    ['r', [[2, 5], [2, 1], [6, 1]]],
  ],
  zaisan: [
    ['r', [[1, 12], [1, 8], [7, 8], [7, 1]]],
    ['r', [[7, 12], [6, 12], [6, 9]]],
    ['b', [6, 9], [6, 7]],
    ['r', [[6, 7], [1, 7], [1, 1]]],
  ],
  tov: [
    ['r', [[1, 12], [1, 1]]],
    ['r', [[4, 12], [4, 9]]],
    ['b', [4, 9], [4, 5]],
    ['r', [[4, 5], [4, 1]]],
    ['r', [[7, 12], [7, 9]]],
    ['b', [7, 9], [7, 5]],
    ['r', [[7, 5], [7, 1]]],
  ],
  narantuul: [
    ['r', [[7, 12], [8, 12], [8, 4]]],
    ['b', [8, 4], [8, 2]],
    ['r', [[8, 2], [8, 1], [7, 1]]],
    ['r', [[1, 12], [1, 9], [3, 9]]],
    ['r', [[4, 12], [4, 9], [3, 9]]],
    ['r', [[3, 9], [3, 4]]],
    ['b', [3, 4], [3, 2]],
    ['r', [[3, 2], [1, 2], [1, 1]]],
    ['r', [[3, 2], [4, 2], [4, 1]]],
  ],
  khoroolol13: [
    ['r', [[0, 12], [0, 10]]],
    ['r', [[3, 12], [3, 10], [0, 10]]],
    ['b', [0, 10], [0, 7]],
    ['r', [[0, 7], [0, 4]]],
    ['b', [0, 4], [0, 2]],
    ['r', [[0, 2], [0, 1]]],
    ['r', [[0, 2], [5, 2], [5, 1]]],
    ['r', [[5, 12], [5, 10], [8, 10]]],
    ['r', [[8, 12], [8, 10]]],
    ['b', [8, 10], [8, 7]],
    ['r', [[8, 7], [8, 4]]],
    ['b', [8, 4], [8, 2]],
    ['r', [[8, 2], [8, 1]]],
    ['r', [[8, 2], [3, 2], [3, 1]]],
  ],
};

const tests = {
  levels_shape() {
    assert.strictEqual(LEVELS.length, 5);
    assert.deepStrictEqual(LEVELS.map((l) => l.id), ['yarmag', 'zaisan', 'tov', 'narantuul', 'khoroolol13']);
    assert(COLORS.length >= 5);
    for (const l of LEVELS) {
      assert.strictEqual(l.rows.length, 14, l.id);
      for (const r of l.rows) assert.strictEqual(r.length, 9, l.id + ' ' + r);
      const letters = new Set(l.rows.join('').replace(/[^A-D]/g, '').split(''));
      const n = letters.size;
      for (let c = 0; c < n; c++) {
        assert(letters.has('ABCD'[c]), l.id + ' source colors not contiguous');
        assert(l.rows.join('').includes('abcd'[c]), l.id + ' missing destination ' + c);
      }
      assert.strictEqual(l.quota.length, n, l.id + ' quota length');
      assert(l.name.mn && l.name.en && l.map && l.roads > 0 && l.bridges > 0 && l.interval > 0 && l.speed > 0, l.id);
    }
  },

  road_rules() {
    const w = Sim.createWorld(lv(['A.......a', '.........', '~~~~~~~~~', '.........', '.........', '.........', '.........'], { roads: 99 }));
    let r = Sim.roadStroke(w, [t(1, 0), t(2, 0), t(3, 0)]);
    assert.deepStrictEqual(r, { added: 2, stop: null });
    assert.strictEqual(Sim.usage(w).roads, 3);
    r = Sim.roadStroke(w, [t(1, 1), t(1, 2)]);
    assert.deepStrictEqual(r, { added: 0, stop: 'water' });
    r = Sim.roadStroke(w, [t(5, 5), t(7, 5)]);
    assert.deepStrictEqual(r, { added: 0, stop: 'notAdjacent' });
    r = Sim.roadStroke(w, [t(0, 0), t(1, 0)]);
    assert.deepStrictEqual(r, { added: 1, stop: null });
    assert.strictEqual(Sim.usage(w).roads, 3);
    r = Sim.roadStroke(w, [t(0, 1), t(0, 0)]);
    assert.deepStrictEqual(r, { added: 0, stop: 'blocked' }, 'source has a single driveway');
    assert.strictEqual(Sim.bridgeCheck(w, t(0, 0), t(0, 3)).reason, 'end');
    r = Sim.roadStroke(w, [t(6, 0), t(7, 0), t(8, 0)]);
    assert.deepStrictEqual(r, { added: 2, stop: null });
    r = Sim.roadStroke(w, [t(8, 1), t(8, 0)]);
    assert.deepStrictEqual(r, { added: 0, stop: 'blocked' }, 'destination has a single driveway');
    const small = Sim.createWorld(lv(['A.......a'], { roads: 2 }));
    r = Sim.roadStroke(small, [t(4, 6), t(5, 6), t(6, 6), t(7, 6)]);
    assert.deepStrictEqual(r, { added: 1, stop: 'budget' });
    assert.strictEqual(Sim.usage(small).roads, 2);
    const blocked = Sim.createWorld(lv(['A...#...a']));
    r = Sim.roadStroke(blocked, [t(2, 0), t(3, 0), t(4, 0)]);
    assert.deepStrictEqual(r, { added: 1, stop: 'blocked' });
  },

  bridge_rules() {
    const rows = ['.A.......', '.........', '~~~~~~~~~', '~~~~~~~~~', '.........', '.........', '.........', '.........', '.....#...', '.........', '.........', '.........', '.........', '.a.......'];
    const w = Sim.createWorld(lv(rows));
    assert.strictEqual(Sim.bridgeCheck(w, t(1, 1), t(2, 4)).reason, 'axis');
    assert.strictEqual(Sim.bridgeCheck(w, t(0, 5), t(6, 5)).reason, 'length');
    assert.strictEqual(Sim.bridgeCheck(w, t(3, 8), t(6, 8)).reason, 'middle');
    assert.strictEqual(Sim.bridgeCheck(w, t(1, 2), t(1, 5)).reason, 'end');
    assert(Sim.bridgeCheck(w, t(1, 1), t(1, 4)).ok);
    assert(Sim.placeBridge(w, t(1, 1), t(1, 4)).ok);
    assert.strictEqual(Sim.bridgeCheck(w, t(1, 1), t(1, 4)).reason, 'overlap');
    build(w, [['r', [[1, 0], [1, 1]]], ['r', [[1, 4], [1, 13]]]]);
    assert(runUntil(w, (x) => x.delivered[0] > 0, 30), 'car crosses the bridge');
    const one = Sim.createWorld(lv(['A.......a'], { bridges: 1 }));
    assert(Sim.placeBridge(one, t(1, 2), t(1, 4)).ok);
    assert.strictEqual(Sim.bridgeCheck(one, t(3, 2), t(3, 4)).reason, 'budget');
    const cross = Sim.createWorld(lv(['A.......a']));
    build(cross, [['r', [[0, 10], [8, 10]]], ['b', [4, 9], [4, 11]]]);
    assert.strictEqual(Sim.isJunction(cross, t(4, 10)), false);
    assert.strictEqual(Sim.groundDegree(cross, t(4, 10)), 2);
    build(cross, [['r', [[2, 9], [2, 11]]]]);
    assert.strictEqual(Sim.isJunction(cross, t(2, 10)), true);
  },

  junction_capacity() {
    const rows = ['....B....', '.........', '.........', '.........', '.........', '.........', 'A.......a', '.........', '.........', '.........', '.........', '.........', '.........', '....b....'];
    const level = lv(rows, { quota: [12, 12], interval: 0.45 });
    const grade = Sim.createWorld(level);
    build(grade, [['r', [[0, 6], [8, 6]]], ['r', [[4, 0], [4, 13]]]]);
    assert(Sim.isJunction(grade, t(4, 6)));
    const over = Sim.createWorld(level);
    build(over, [['r', [[0, 6], [8, 6]]], ['r', [[4, 0], [4, 5]]], ['b', [4, 5], [4, 7]], ['r', [[4, 7], [4, 13]]]]);
    assert(runUntil(grade, (x) => x.cleared, 120), 'grade clears');
    assert(runUntil(over, (x) => x.cleared, 120), 'overpass clears');
    const tg = grade.time + grade.penaltyTime;
    const to = over.time + over.penaltyTime;
    assert(to < tg, 'overpass faster: ' + to.toFixed(2) + ' vs ' + tg.toFixed(2));
  },

  erase_safe() {
    const w = Sim.createWorld(LEVELS[0]);
    build(w, SOLUTIONS.yarmag);
    const onBridge = () => w.cars.some((c) => (c.node & 1) === 1);
    assert(runUntil(w, onBridge, 30), 'a car reaches the bridge');
    assert(Sim.eraseAt(w, t(2, 6)));
    assert.strictEqual(w.bridges.length, 0);
    Sim.step(w, Sim.DT);
    assert(!onBridge(), 'bridge cars removed');
    build(w, [['b', [2, 8], [2, 5]]]);
    assert(runUntil(w, () => w.cars.some((c) => (c.node >> 1) === t(2, 3)), 30));
    assert(Sim.eraseAt(w, t(2, 3)));
    for (let i = 0; i < 600; i++) Sim.step(w, Sim.DT);
    for (const c of w.cars) assert((c.node >> 1) !== t(2, 3), 'no car left on erased tile');
    assert.strictEqual(Sim.eraseAt(w, t(0, 0)), false);
  },

  penalties() {
    const flood = Sim.createWorld(lv(['A.......a'], { interval: 0.05, quota: [500] }));
    build(flood, [['r', [[0, 0], [8, 0]]]]);
    runUntil(flood, (x) => x.penalties > 0, 10);
    const ev = flood.events.find((e) => e.type === 'penalty');
    assert(ev && ev.reason === 'queue' && ev.tile === t(0, 0));
    assert.strictEqual(flood.penaltyTime, 10 * flood.penalties);
    const jam = Sim.createWorld(lv(['A.......a'], { quota: [3] }));
    build(jam, [['r', [[0, 0], [8, 0]]]]);
    runUntil(jam, (x) => x.cars.length > 0, 5);
    const lead = jam.cars[0];
    runUntil(jam, () => (lead.node >> 1) === t(3, 0), 5);
    lead.t = -1e9;
    assert(runUntil(jam, (x) => x.events.some((e) => e.type === 'penalty' && e.reason === 'gridlock'), 10), 'gridlock penalty');
    assert.strictEqual(jam.penaltyTime, 10 * jam.penalties);
  },

  scripted_solutions() {
    for (const level of LEVELS) {
      const w = Sim.createWorld(level);
      build(w, SOLUTIONS[level.id]);
      assert(Sim.usage(w).roads <= level.roads, level.id + ' road budget ' + Sim.usage(w).roads);
      assert(Sim.usage(w).bridges <= level.bridges, level.id + ' bridge budget');
      assert(runUntil(w, (x) => x.cleared, 200), level.id + ' clears');
      assert.strictEqual(w.penalties, 0, level.id + ' penalties');
      assert(w.time < 90, level.id + ' time ' + w.time.toFixed(1));
      assert(w.events.some((e) => e.type === 'cleared'));
      console.log('   ' + level.id + ' cleared in ' + w.time.toFixed(1) + 's, roads ' + Sim.usage(w).roads + '/' + level.roads + ', bridges ' + Sim.usage(w).bridges + '/' + level.bridges);
    }
  },

  car_pos() {
    const w = Sim.createWorld(LEVELS[0]);
    build(w, SOLUTIONS.yarmag);
    runUntil(w, (x) => x.cars.length > 0, 5);
    const p = Sim.carPos(w, w.cars[0]);
    assert(p.x >= 0 && p.x <= 9 && p.y >= 0 && p.y <= 14 && p.dir >= 0 && p.dir <= 3 && (p.layer === 0 || p.layer === 1));
  },
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
