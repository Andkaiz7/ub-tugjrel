const assert = require("assert");
const core = require("../ugee-buu-mart/core.js");

const group = {
  id: "grp00001",
  name: "Тест хамтлаг",
  pack: false,
  views: 12345,
  songs: [
    {
      t: "Дуу Нэг",
      x: [
        ["e01", "Өмнөх мөр нэг", "Би чамдаа юм даа юм"],
        ["e02", "Өмнөх мөр хоёр", "Сарны гэрэл шөнөжин тусна шүү"],
        ["e03", "Өмнөх мөр гурав", "Уулын орой дээр цас гялалзана"],
        ["e04", "Өмнөх мөр дөрөв", "Зүрхний минь гүнд чи л оршино"],
        ["e05", "Өмнөх мөр тав", "Хаврын салхи зөөлөн сэвэлзэж байна"],
        ["e06", "Өмнөх мөр зургаа", "Алтан наран тэнгэрт мандаж ирлээ"]
      ]
    },
    {
      t: "Дуу Хоёр",
      x: [
        ["e07", "Өмнөх мөр долоо", "Baby, чи «Хайр» гэж"],
        ["e08", "Өмнөх мөр найм", "Улаанбаатар хотын үдэш гэрэлтэнэ"],
        ["e09", "Өмнөх мөр ес", "Хөх тэнгэрийн доор бид хамтдаа"],
        ["e10", "Өмнөх мөр арав", "Мөрөөдлийн жигүүр биднийг хөтөлнө"],
        ["e11", "Өмнөх мөр арваннэг", "Сэтгэлийн дуу хоолой цуурайтна"],
        ["e12", "Өмнөх мөр арванхоёр", "Маргаашийн наран дахин гийнэ дээ"]
      ]
    }
  ]
};

assert.strictEqual(core.ROUND, 10);
assert.strictEqual(core.LIVES, 3);
assert.strictEqual(core.SPEED_MS, 15000);
assert.deepStrictEqual(core.SCHEDULE, [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);

assert.deepStrictEqual(core.words("  Сайн   байна  уу  "), ["Сайн", "байна", "уу"]);
assert.strictEqual(core.norm(".,!?;:\"'«»()…–—-Хайр-.,!?;:\"'«»()…–—-"), "хайр");
assert.strictEqual(core.norm("Baby,"), "baby");

const s1 = core.seedOf("room-alpha");
const s2 = core.seedOf("room-beta");
assert.strictEqual(typeof s1, "number");
assert.strictEqual(s1 >= 0 && s1 <= 0xffffffff, true);
assert.notStrictEqual(s1, s2);

const refsA = core.pickRefs(group, [], 10, core.rng(s1));
const refsB = core.pickRefs(group, [], 10, core.rng(s1));
const roundA = core.round(group, refsA, core.rng(s1));
const roundB = core.round(group, refsB, core.rng(s1));
assert.strictEqual(JSON.stringify(roundA), JSON.stringify(roundB));

let diffTileOrder = false;
for (let attempt = 1; attempt <= 10; attempt++) {
  const rAlt = core.round(group, refsA, core.rng(s2 + attempt));
  for (let i = 0; i < roundA.length; i++) {
    if (JSON.stringify(roundA[i].tiles) !== JSON.stringify(rAlt[i].tiles)) {
      diffTileOrder = true;
    }
  }
}
assert.strictEqual(diffTileOrder, true);

assert.strictEqual(core.blanksFor(9, 5), 3);
assert.strictEqual(core.blanksFor(0, 4), 1);
assert.strictEqual(core.blanksFor(8, 12), 5);
assert.strictEqual(core.blanksFor(9, 2), 1);

for (let i = 0; i < roundA.length; i++) {
  const q = roundA[i];
  const ref = refsA[i];
  const song = group.songs[ref.s];
  const ex = song.x[ref.e];
  assert.strictEqual(q.id, ex[0]);
  assert.strictEqual(q.song, song.t);
  assert.strictEqual(q.prev, ex[1]);
  assert.strictEqual(q.shown.concat(q.answer).join(" "), ex[2]);
  const n = q.answer.length;
  assert.strictEqual(n, core.blanksFor(i, core.words(ex[2]).length));
  assert.strictEqual(q.tiles.length, n + 2 + Math.floor(n / 2));

  const ansNorms = new Set(q.answer.map(core.norm));
  const remaining = q.tiles.slice();
  for (let a = 0; a < q.answer.length; a++) {
    const idx = remaining.indexOf(q.answer[a]);
    assert.notStrictEqual(idx, -1);
    remaining.splice(idx, 1);
  }
  const decoyNorms = new Set();
  for (let d = 0; d < remaining.length; d++) {
    const dn = core.norm(remaining[d]);
    assert.strictEqual(ansNorms.has(dn), false);
    assert.strictEqual(decoyNorms.has(dn), false);
    decoyNorms.add(dn);
  }
}

const dupQ = core.question(group, { s: 0, e: 0, id: "e01" }, 4, core.rng(11));
assert.deepStrictEqual(dupQ.answer, ["юм", "даа", "юм"]);
assert.strictEqual(core.tileOk(dupQ, 0, "юм"), true);
assert.strictEqual(core.tileOk(dupQ, 2, "юм"), true);
assert.strictEqual(core.tileOk(dupQ, 1, "юм"), false);

const babyGroup = {
  id: "grp00002",
  name: "Baby Test",
  pack: false,
  views: 100,
  songs: [
    group.songs[0],
    {
      t: "Дуу Хоёр",
      x: [
        ["e07", "Өмнөх мөр долоо", "Чи «Хайр» гэж Baby,"],
        group.songs[1].x[1],
        group.songs[1].x[2],
        group.songs[1].x[3],
        group.songs[1].x[4],
        group.songs[1].x[5]
      ]
    }
  ]
};
const babyQ = core.question(babyGroup, { s: 1, e: 0, id: "e07" }, 0, core.rng(22));
assert.deepStrictEqual(babyQ.answer, ["Baby,"]);
assert.strictEqual(core.tileOk(babyQ, 0, "baby"), true);
assert.notStrictEqual(babyQ.tiles.indexOf("Baby,"), -1);

const punctQ = core.question(group, { s: 1, e: 0, id: "e07" }, 2, core.rng(33));
assert.deepStrictEqual(punctQ.answer, ["«Хайр»", "гэж"]);
assert.strictEqual(core.tileOk(punctQ, 0, "хайр"), true);
assert.notStrictEqual(punctQ.tiles.indexOf("«Хайр»"), -1);

const picked10 = core.pickRefs(group, [], 10, core.rng(77));
assert.strictEqual(picked10.length, 10);
assert.strictEqual(new Set(picked10.map(function (r) { return r.id; })).size, 10);
assert.notStrictEqual(picked10[0].s, picked10[1].s);

const elevenSeen = ["e01", "e02", "e03", "e04", "e05", "e06", "e07", "e08", "e09", "e10", "e11"];
const pickedTopped = core.pickRefs(group, elevenSeen, 10, core.rng(88));
assert.strictEqual(pickedTopped.length, 10);
assert.strictEqual(pickedTopped[0].id, "e12");
assert.deepStrictEqual(
  pickedTopped.slice(1).map(function (r) { return r.id; }),
  elevenSeen.slice(0, 9)
);

assert.strictEqual(core.lineScore(0), 150);
assert.strictEqual(core.lineScore(15000), 100);
assert.strictEqual(core.lineScore(99999), 100);

const roster = ["p1", "p2", "p3", "p4"];
const acts = [
  { player_id: "p1", q: 0, ok: true, ms: 0, lives: 3 },
  { player_id: "p1", q: 0, ok: false, ms: 9000, lives: 2 },
  { player_id: "p1", q: 1, ok: false, ms: 5000, lives: 2 },
  { player_id: "p2", q: 0, ok: true, ms: 15000, lives: 3 },
  { player_id: "p2", q: 1, ok: true, ms: 15000, lives: 3 },
  { player_id: "p3", q: 0, ok: true, ms: 15000, lives: 3 },
  { player_id: "p3", q: 1, ok: true, ms: 0, lives: 3 },
  { player_id: "p1", q: 2, ok: true, ms: 15000, lives: 2 },
  { player_id: "p1", q: 3, ok: false, ms: 1000, lives: 0 }
];
const rows = core.standings(roster, acts);
assert.strictEqual(rows.length, 4);
assert.strictEqual(rows[0].id, "p3");
assert.strictEqual(rows[0].score, 250);
assert.strictEqual(rows[0].ms, 15000);
assert.strictEqual(rows[1].id, "p1");
assert.strictEqual(rows[1].score, 250);
assert.strictEqual(rows[1].answered, 4);
assert.strictEqual(rows[1].lives, 0);
assert.strictEqual(rows[1].done, true);
assert.strictEqual(rows[1].ms, 21000);
assert.strictEqual(rows[2].id, "p2");
assert.strictEqual(rows[2].score, 200);
assert.strictEqual(rows[2].done, false);
assert.strictEqual(rows[3].id, "p4");
assert.strictEqual(rows[3].score, 0);
assert.strictEqual(rows[3].answered, 0);
assert.strictEqual(rows[3].lives, 3);
assert.strictEqual(rows[3].done, false);
assert.strictEqual(rows[3].ms, 0);

const tenActs = [];
for (let q = 0; q < 10; q++) {
  tenActs.push({ player_id: "p4", q: q, ok: true, ms: 15000, lives: 3 });
}
const rowsDone = core.standings(["p4"], tenActs);
assert.strictEqual(rowsDone[0].answered, 10);
assert.strictEqual(rowsDone[0].done, true);
assert.strictEqual(rowsDone[0].score, 1000);

console.log("ok");
