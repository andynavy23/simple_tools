// 批次 s3：連連看 / 麻將消除（tile-match）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('mini-games/tile-match.html', 'llLink, llHint, llShuffle, llDeal, LL_LEVELS, MJ_LAYOUTS, mjParse, mjFree, mjMoves, mjMatch, mjGroup, mjLabel, mjPool, mjPairsOf, mjDeal, mjNew, mjStuck, cleanBest, twDay');
const rnd = (seed) => Util.seeded(seed);

// ---- 連連看：轉角 ----
// 5x5（含外圈）：W=H=5，內部 3x3
const mk = (rows) => rows.flatMap(r => [...r].map(Number));
{
    const g = mk(['00000', '01010', '00000', '00000', '00000']);          // 同列，中間空 → 直線
    assert.deepStrictEqual(m.llLink(g, 5, 5, 6, 8), [6, 8]);
    const g2 = mk(['00000', '01020', '01000', '00000', '00000']);          // 1 在 (1,1)(1,2) 垂直相鄰
    assert.ok(m.llLink(g2, 5, 5, 6, 11));
    const g3 = mk(['00000', '01000', '00000', '00010', '00000']);          // (1,1) 與 (3,3)：一個轉角
    assert.strictEqual(m.llLink(g3, 5, 5, 6, 18).length, 3);
    // 兩個轉角（繞過擋路的牌）：兩張 1 同列、中間一張 2 擋住
    const g4 = mk(['00000', '01210', '00000', '00000', '00000']);
    const p4 = m.llLink(g4, 5, 5, 6, 8); assert.strictEqual(p4.length, 4);
    // 不同牌 / 同一格 / 空格不可連
    assert.strictEqual(m.llLink(g4, 5, 5, 6, 7), null); assert.strictEqual(m.llLink(g4, 5, 5, 6, 6), null); assert.strictEqual(m.llLink(g4, 5, 5, 0, 6), null);
    // 需要 3 個轉角才連得到 → 不可：中間用牆擋
    const g5 = mk(['0000000', '0100000', '0222220', '0200020', '0202020', '0200020', '0000100']);
    // (1,1) 與 (4,6)... 以圍牆隔開：只靠外圈可連（外圈可走）所以 g5 這對在外圈是可連的
    assert.ok(m.llLink(g5, 7, 7, 8, 46));
}
// 抽樣：隨機盤面，連線一定 ≤ 4 點且端點正確；llHint 與暴力一致
for (let s = 0; s < 6; s++) {
    const n = [6, 8, 10][s % 3], [, k] = m.LL_LEVELS[['easy', 'normal', 'hard'][s % 3]], r = rnd('ll' + s);
    const g = m.llDeal(n, k, r), W = n + 2;
    assert.strictEqual(g.filter(Boolean).length, n * n);
    for (let i = 0; i < W; i++) assert.ok(!g[i] && !g[(W - 1) * W + i] && !g[i * W] && !g[i * W + W - 1], '外圈需為空');
    const h = m.llHint(g, W, W); assert.ok(h, '發牌後需有可消');
    assert.strictEqual(g[h.a], g[h.b]); assert.ok(h.path.length <= 4 && h.path[0] === h.a && h.path.at(-1) === h.b);
    // 一路消到沒牌（遇到無解就洗牌）
    let guard = 0;
    while (g.some(Boolean) && guard++ < 500) {
        let hh = m.llHint(g, W, W);
        if (!hh) { assert.ok(m.llShuffle(g, W, W, r)); hh = m.llHint(g, W, W); }
        g[hh.a] = g[hh.b] = 0;
    }
    assert.ok(!g.some(Boolean), '連連看可以清空');
}
ok('連連看連線 / 發牌 / 洗牌');

// ---- 麻將消除：牌堆 ----
assert.ok(m.MJ_LAYOUTS.length >= 6);
m.MJ_LAYOUTS.forEach((l, li) => {
    const L = m.mjParse(l.rects);
    assert.ok(L.length >= 40 && L.length % 2 === 0 && L.length <= 144, l.name + ' 張數');
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        assert.ok(!(a.z === b.z && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2), l.name + ' 同層重疊');
    }
    for (const t of L) if (t.z > 0) assert.ok(L.some(b => b.z === t.z - 1 && Math.abs(b.x - t.x) < 2 && Math.abs(b.y - t.y) < 2), l.name + ' 懸空');
    // 發牌可解：依 order 重播
    for (let s = 0; s < 3; s++) {
        const g = m.mjNew(li, rnd('mj' + li + s)); assert.ok(g, l.name + ' 發牌失敗');
        const alive = [...g.alive], cnt = {};
        g.kinds.forEach(k => { cnt[k] = (cnt[k] || 0) + 1; });
        for (const k in cnt) assert.ok(cnt[k] <= 4 && k >= 0);
        for (const [i, j] of g.order) { assert.ok(m.mjFree(L, alive, i) && m.mjFree(L, alive, j) && m.mjMatch(g.kinds[i], g.kinds[j]), l.name + ' 解序不合法'); alive[i] = alive[j] = false; }
        assert.ok(!alive.some(Boolean));
        assert.ok(m.mjMoves(L, g.kinds, g.alive).length > 0);
    }
});
ok('麻將牌堆合法與保證可解');

// ---- 可選判定 ----
{
    const L = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }, { x: 8, y: 0, z: 0 }, { x: 5, y: 2, z: 0 }];
    const al = L.map(() => true);
    assert.ok(m.mjFree(L, al, 0), '左端空');
    assert.ok(!m.mjFree(L, al, 1), '被壓住且左右皆有');
    assert.ok(m.mjFree(L, al, 2), '右側空（x=5,y=2 不在同列，dy=2）');
    assert.ok(m.mjFree(L, al, 3), '最上層');
    al[3] = false; assert.ok(!m.mjFree(L, al, 1), '壓住拿掉後仍左右皆有');
    al[0] = false; assert.ok(m.mjFree(L, al, 1));
    assert.ok(!m.mjFree(L, al, 0), '已消除不可選');
    // 半格錯位也算相鄰
    const L2 = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 3, y: 1, z: 0 }];
    assert.ok(!m.mjFree(L2, L2.map(() => true), 1));
}
// ---- 配對規則 ----
assert.ok(m.mjMatch(34, 37) && m.mjMatch(38, 41) && m.mjMatch(5, 5) && !m.mjMatch(34, 38) && !m.mjMatch(5, 6) && !m.mjMatch(0, 9));
assert.strictEqual(m.mjPool().length, 72);
for (let k = 0; k < 42; k++) assert.strictEqual(m.mjLabel(k).length, 3);
// ---- 提示、無解偵測、洗牌 ----
{
    const L = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 6, y: 0, z: 0 }];
    const al = [true, true, true, true];
    assert.ok(m.mjStuck(L, [1, 2, 1, 2], al), '1 2 1 2：中間被夾，兩端 1、2 不同 → 無解');
    assert.deepStrictEqual(m.mjMoves(L, [1, 2, 3, 1], al), [[0, 3]]);
    assert.ok(!m.mjStuck(L, [1, 2, 3, 1], al));
    assert.ok(!m.mjStuck(L, [1, 1, 1, 1], [false, false, false, false]), '全消不算卡住');
    // 洗牌後仍可解
    const g = m.mjNew(1, rnd('sh')), alive = [...g.alive];
    for (const [i, j] of g.order.slice(0, 20)) alive[i] = alive[j] = false;
    const d = m.mjDeal(g.L, alive, m.mjPairsOf(g.kinds, alive), rnd('sh2'));
    assert.ok(d && d.order.length === (alive.filter(Boolean).length / 2));
    const al2 = [...alive]; for (const [i, j] of d.order) { assert.ok(m.mjFree(g.L, al2, i) && m.mjFree(g.L, al2, j) && m.mjMatch(d.kinds[i], d.kinds[j])); al2[i] = al2[j] = false; }
}
ok('麻將可選 / 提示 / 無解 / 洗牌');

// ---- 最佳紀錄驗證 / 日期 ----
assert.deepStrictEqual(m.cleanBest(null), {}); assert.deepStrictEqual(m.cleanBest([1]), {}); assert.deepStrictEqual(m.cleanBest('x'), {});
assert.deepStrictEqual(m.cleanBest({ lk_easy: 31.4, lk_bad: 5, mj_3: -1, mj_2: 'a', lk_hard: Infinity, mj_1: 90 }), { lk_easy: 31, mj_1: 90 });
assert.strictEqual(m.twDay(Date.UTC(2026, 0, 1, 16, 0)), '2026-01-02'); assert.strictEqual(m.twDay(Date.UTC(2026, 0, 1, 15, 59)), '2026-01-01');
ok('tile-match 最佳紀錄與日期');
