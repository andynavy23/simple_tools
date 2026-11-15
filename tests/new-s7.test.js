// 批次 s7：演算法實驗室（生命遊戲 / 排序）、記憶序列的數字記憶廣度
const { load, ok } = require('./_load');
const assert = require('assert');

const L = load('utils/algo-lab.html', 'parseRule, lifeStep, lifePop, PATTERNS, placePattern, SORTS, makeData');
const rule = L.parseRule('B3/S23');
const run = (cells, n, gens, wrap = false) => { for (let i = 0; i < gens; i++) cells = L.lifeStep(cells, n, rule, wrap); return cells; };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const shift = (cells, n, dx, dy) => { const o = new Uint8Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (cells[y * n + x]) o[((y + dy + n) % n) * n + (x + dx + n) % n] = 1; return o; };

// ---- 規則解析 ----
assert.deepEqual(L.parseRule('B3/S23').b.map(Number), [0, 0, 0, 1, 0, 0, 0, 0, 0]);
assert.ok(L.parseRule('b36/s23') && L.parseRule('B2/S') && !L.parseRule('B9/S1') && !L.parseRule('abc') && !L.parseRule('S23/B3'));

// ---- 已知週期 ----
const N = 40;
const at = (name) => L.placePattern(N, L.PATTERNS[name]);
const blinker = at('閃爍器');
assert.ok(!same(run(blinker, N, 1), blinker) && same(run(blinker, N, 2), blinker), '閃爍器週期 2');
for (const [name, p] of [['蟾蜍', 2], ['燈塔', 2], ['脈衝星', 3], ['十五宮（Pentadecathlon）', 15]]) {
    const c = at(name);
    assert.ok(same(run(c, N, p), c), name + ' 週期 ' + p);
    for (let q = 1; q < p; q++) if (p % q === 0) assert.ok(!same(run(c, N, q), c), name + ' 不是週期 ' + q);
}
const glider = at('滑翔機');
assert.ok(same(run(glider, N, 4), shift(glider, N, 1, 1)), '滑翔機 4 步位移 (1,1)');
const lw = at('輕型太空船'), lw4 = run(lw, N, 4);
assert.ok(same(lw4, shift(lw, N, -2, 0)) || same(lw4, shift(lw, N, 2, 0)), '輕型太空船 4 步位移 2');
// 環形邊界：滑翔機在 20×20 繞 80 步回原位
const g20 = L.placePattern(20, L.PATTERNS['滑翔機']);
assert.ok(same(run(g20, 20, 80, true), g20), '環形滑翔機繞一圈');
assert.equal(L.lifePop(run(g20, 20, 80, false)) < 5, true, '非環形撞牆後不再是滑翔機');
// 死硬派 130 代後全滅
assert.equal(L.lifePop(run(L.placePattern(60, L.PATTERNS['死硬派（130 代後消失）']), 60, 130)), 0);
assert.ok(L.lifePop(run(L.placePattern(60, L.PATTERNS['死硬派（130 代後消失）']), 60, 129)) > 0);
// 滑翔機槍：36 格，30 代後 41 格（多一隻滑翔機）
const gun = L.placePattern(100, L.PATTERNS['高斯珀滑翔機槍']);
assert.equal(L.lifePop(gun), 36); assert.equal(L.lifePop(run(gun, 100, 30)), 41);
assert.equal(L.placePattern(10, L.PATTERNS['高斯珀滑翔機槍']), null);
// 其他規則：Seeds B2/S 單格不增生；HighLife 規則可解析並運作
assert.equal(L.lifePop(L.lifeStep(L.placePattern(9, ['OO']), 9, L.parseRule('B2/S'), false)), 4);
ok('algo-lab 生命遊戲');

// ---- 排序：最終正確、穩定性標示正確 ----
let seed = 7; const rand = (k) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % k; };
const sorted = (a) => a.every((v, i) => !i || a[i - 1] <= v);
for (const [name, s] of Object.entries(L.SORTS)) {
    for (const kind of ['random', 'nearly', 'reversed', 'dups']) for (const n of [10, 37, 120]) {
        const a = L.makeData(n, kind, rand), exp = [...a].sort((x, y) => x - y), cnt = { c: 0, s: 0, w: 0 };
        for (const e of s.f(a)) { assert.ok(e.t in cnt); cnt[e.t]++; }
        assert.deepEqual(a, exp, `${name} ${kind} ${n}`);
        if (name === 'merge') assert.ok(cnt.w > 0 && cnt.s === 0); else assert.ok(cnt.w === 0);
        if (kind === 'reversed' && n > 10) assert.ok(cnt.c > 0);
    }
    // 空 / 單元素 / 已排序
    for (const a of [[], [1], [1, 2, 3], [2, 2, 2]]) { const b = [...a]; for (const _ of s.f(b)); assert.deepEqual(b, a); }
    // 穩定性：用物件值與自訂比較
    let stable = true;
    for (let t = 0; t < 30; t++) {
        const a = Array.from({ length: 40 }, (_, id) => ({ k: rand(5), id }));
        for (const _ of s.f(a, (x, y) => x.k < y.k)) { }
        for (let i = 1; i < a.length; i++) { assert.ok(a[i - 1].k <= a[i].k); if (a[i - 1].k === a[i].k && a[i - 1].id > a[i].id) stable = false; }
    }
    if (s.stable) assert.ok(stable, name + ' 標示穩定卻不穩定');
}
assert.ok(!L.SORTS.selection.stable);
{ const a = [{ k: 2, id: 0 }, { k: 2, id: 1 }, { k: 1, id: 2 }]; for (const _ of L.SORTS.selection.f(a, (x, y) => x.k < y.k)); assert.equal(a[1].id, 1); assert.equal(a[2].id, 0, '選擇排序確實不穩定'); }
// 資料分布
assert.deepEqual(L.makeData(5, 'reversed', rand), [5, 4, 3, 2, 1]);
assert.ok(new Set(L.makeData(100, 'dups', rand)).size <= 10);
assert.equal(L.makeData(50, 'random', rand).length, 50);
ok('algo-lab 排序');

// ---- 數字記憶廣度 ----
const S = load('mini-games/simon.html', 'digitSeq, digitExpect, digitJudge, digitBest, DIGIT_MAX, DIGIT_MODES');
for (const mode of ['digit', 'rev', 'alpha']) {
    const q = S.digitSeq(12, mode, rand);
    assert.equal(q.length, 12);
    assert.ok(q.every((c, i) => S.DIGIT_MODES[mode].pool.includes(c) && c !== q[i - 1]));
}
assert.ok(S.digitSeq(5, 'alpha', rand).every(c => /[A-Z]/.test(c)));
assert.equal(S.digitExpect(['1', '2', '3'], 'digit'), '123'); assert.equal(S.digitExpect(['1', '2', '3'], 'rev'), '321');
assert.ok(S.digitJudge(['1', '2', '3'], 'rev', '3 2,1') && !S.digitJudge(['1', '2', '3'], 'rev', '123'));
assert.ok(S.digitJudge(['A', 'B'], 'alpha', 'ab') && S.digitJudge(['1', '2'], 'digit', '12 ') && !S.digitJudge(['1', '2'], 'digit', '1'));
assert.equal(S.digitBest(5, 7), 7); assert.equal(S.digitBest(9, 4), 9);
assert.equal(S.digitBest('x', 0), 0); assert.equal(S.digitBest(null, 3), 3); assert.equal(S.digitBest(999, 2), S.DIGIT_MAX); assert.equal(S.digitBest(-4, 0), 0);
ok('simon 數字記憶廣度');
