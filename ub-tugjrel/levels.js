(function (root) {
  var UBLevels = {
    COLORS: ['#2f7cf6', '#ef4444', '#22c55e', '#f59e0b', '#facc15'],
    LANDMARKS: {
      G: 'ger',
      H: 'flats',
      M: 'memorial',
      N: 'market',
      P: 'palace',
      S: 'skytower',
      T: 'pines',
      U: 'hill'
    },
    LEVELS: [
      {
        id: 'yarmag',
        name: { mn: 'Яармаг', en: 'Yarmag' },
        map: { x: 0.24, y: 0.78 },
        rows: [
          '..TT....T',
          '......a..',
          '.........',
          '...HH....',
          '.........',
          'T........',
          '~~~~~~~~~',
          '~~~~~~~~~',
          'T.......T',
          '.........',
          '.H.....H.',
          '.........',
          '..A......',
          '.......TT'
        ],
        labels: {
          A: { mn: 'Яармаг', en: 'Yarmag', art: 'flats' },
          a: { mn: 'Ажил', en: 'Work' }
        },
        roads: 20,
        bridges: 1,
        quota: [8],
        interval: 1.2,
        speed: 3
      },
      {
        id: 'zaisan',
        name: { mn: 'Зайсан', en: 'Zaisan' },
        map: { x: 0.5, y: 0.8 },
        rows: [
          'T.......T',
          '.b.....a.',
          '.........',
          '.........',
          '...MMM...',
          '...MMM...',
          '...UUU...',
          '.........',
          '.........',
          '.........',
          'T.......T',
          '.........',
          '.A.....B.',
          '.........'
        ],
        labels: {
          A: { mn: 'Зайсан', en: 'Zaisan', art: 'flats' },
          B: { mn: 'Хан-Уул', en: 'Khan-Uul', art: 'flats' },
          a: { mn: 'Ажил', en: 'Work' },
          b: { mn: 'Сургууль', en: 'School' }
        },
        roads: 36,
        bridges: 2,
        quota: [10, 10],
        interval: 1,
        speed: 3
      },
      {
        id: 'tov',
        name: { mn: 'Сүхбаатарын талбай', en: 'Sukhbaatar Square' },
        map: { x: 0.47, y: 0.44 },
        rows: [
          '..PPPPP..',
          '.a..c..b.',
          '.........',
          '..H...S..',
          '..H...S..',
          '.........',
          '.........',
          'E+++++++e',
          '.........',
          '.........',
          '...T.T...',
          '.........',
          '.A..C..B.',
          '.........'
        ],
        labels: {
          A: { mn: 'Баянгол', en: 'Bayangol', art: 'flats' },
          B: { mn: 'Баянзүрх', en: 'Bayanzurkh', art: 'flats' },
          C: { mn: 'Чингэлтэй', en: 'Chingeltei', art: 'ger' },
          a: { mn: 'Их дэлгүүр', en: 'Store' },
          b: { mn: 'Оффис', en: 'Office' },
          c: { mn: 'Төрийн ордон', en: 'Palace' }
        },
        roadName: { mn: 'Энхтайваны өргөн чөлөө', en: 'Peace Avenue' },
        roads: 28,
        bridges: 2,
        quota: [8, 8, 8],
        interval: 1.2,
        throughInterval: 1,
        speed: 3
      },
      {
        id: 'narantuul',
        name: { mn: 'Нарантуул', en: 'Naran Tuul' },
        map: { x: 0.66, y: 0.5 },
        rows: [
          'T.......T',
          '.b..a..c.',
          '.........',
          '=========',
          '.........',
          '.NN.N.NN.',
          '.NN...NN.',
          '.........',
          '....N....',
          '.........',
          '.........',
          '.........',
          '.A..B..C.',
          'GG.....GG'
        ],
        labels: {
          A: { mn: 'Сонгино', en: 'Songino', art: 'ger' },
          B: { mn: 'Баянзүрх', en: 'Bayanzurkh', art: 'ger' },
          C: { mn: 'Амгалан', en: 'Amgalan', art: 'flats' },
          a: { mn: 'Зах', en: 'Market' },
          b: { mn: 'Сургууль', en: 'School' },
          c: { mn: 'Эмнэлэг', en: 'Hospital' }
        },
        roads: 32,
        bridges: 2,
        quota: [8, 8, 8],
        interval: 1.4,
        speed: 3
      },
      {
        id: 'khoroolol13',
        name: { mn: '13-р хороолол', en: '13th District' },
        map: { x: 0.76, y: 0.36 },
        rows: [
          '.........',
          'a..c.b..d',
          '.........',
          '=========',
          '.........',
          '..HH.HH..',
          '.........',
          '.........',
          '~~~~~~~~~',
          '~~~~~~~~~',
          '.........',
          '..G...G..',
          'B..A.D..C',
          '.........'
        ],
        labels: {
          A: { mn: '13-р хороолол', en: '13th', art: 'flats' },
          B: { mn: 'Сансар', en: 'Sansar', art: 'flats' },
          C: { mn: 'Амгалан', en: 'Amgalan', art: 'ger' },
          D: { mn: 'Хүнну', en: 'Khunnu', art: 'flats' },
          a: { mn: 'Сургууль', en: 'School' },
          b: { mn: 'Зах', en: 'Market' },
          c: { mn: 'Ажил', en: 'Work' },
          d: { mn: 'Эмнэлэг', en: 'Hospital' }
        },
        roads: 36,
        bridges: 4,
        quota: [8, 8, 8, 8],
        interval: 1.5,
        speed: 3
      }
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = UBLevels;
  else root.UBLevels = UBLevels;
})(this);
