// 批次 s1：關卡益智（推箱子 / 塞車）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('mini-games/level-puzzles.html', 'SOK, RH, sokParse, sokMove, sokWon, sokWalk, sokReplay, rhParse, rhMove, rhWon, rhSolve, rhStars, cleanProgress');

// ---- 推箱子：關卡數、每關內建解答重播後確實過關（解答由 BFS 產生，長度即最少步數） ----
assert.ok(m.SOK.length >= 30);
m.SOK.forEach((lv, i) => {
    const { L, S } = m.sokParse(lv.m);
    assert.ok(S.p >= 0 && S.b.length >= 1, `第 ${i + 1} 關缺玩家 / 箱子`);
    assert.ok(!m.sokWon(L, S), `第 ${i + 1} 關一開始就過關`);
    const r = m.sokReplay(L, S, lv.s);
    assert.ok(r && m.sokWon(L, r.S) && r.moves === lv.s.length, `第 ${i + 1} 關解答不成立`);
    for (let k = 1; k < lv.s.length; k++) assert.ok(!m.sokWon(L, m.sokReplay(L, S, lv.s.slice(0, k)).S) || k === lv.s.length, '解答提早過關');
});
ok('sokoban levels solvable');

// ---- 推箱子規則 ----
{
    const { L, S } = m.sokParse('#####|#@$ .#|#####');
    const a = m.sokMove(L, S, 'r'); assert.ok(a && a.push && a.b[0] === 6 + 3);
    assert.equal(m.sokMove(L, S, 'l'), null, '撞牆');
    assert.equal(m.sokMove(L, S, 'u'), null);
    const b = m.sokMove(L, a, 'r'); assert.ok(b && m.sokWon(L, b), '推到目標');
    assert.equal(m.sokMove(L, b, 'r'), null, '箱子後面是牆');
    // 兩個箱子連排推不動
    const t = m.sokParse('######|#@$$ #|######'); assert.equal(m.sokMove(t.L, t.S, 'r'), null);
    // 走位：不推箱子繞過去
    const w = m.sokParse('#####|#@  #|# $ #|#   #|#####'); assert.equal(m.sokWalk(w.L, w.S, 3 * 5 + 3).length > 0, true);
    assert.equal(m.sokWalk(w.L, w.S, 2 * 5 + 2), null, '箱子格不能走');
    assert.equal(m.sokWalk(w.L, w.S, 0), null);
}
ok('sokoban rules');

// ---- 塞車 ----
assert.ok(m.RH.length >= 30);
let prev = 0;
m.RH.forEach((lv, i) => {
    assert.equal(lv.b.length, 36);
    const { cars, pos } = m.rhParse(lv.b);
    assert.ok(cars.some(c => c.id === 'A' && c.h && c.r === 2), `第 ${i + 1} 關缺紅車`);
    assert.ok(!m.rhWon(cars, pos));
    const s = m.rhSolve(cars, pos);
    assert.ok(s && s.length === lv.n, `第 ${i + 1} 關最少步數 ${s && s.length} != ${lv.n}`);
    let p = pos; s.forEach(mv => { p = m.rhMove(cars, p, mv.i, mv.np); assert.ok(p); });
    assert.ok(m.rhWon(cars, p));
    assert.ok(lv.n >= prev, '關卡應由易到難'); prev = lv.n;
});
ok('rush hour levels solvable');
{
    const { cars, pos } = m.rhParse('............AA' + '.'.repeat(22));
    const ai = cars.findIndex(c => c.id === 'A');
    assert.equal(m.rhMove(cars, pos, ai, 4)[ai], 4);
    assert.equal(m.rhMove(cars, pos, ai, 0), null, '原地');
    assert.equal(m.rhMove(cars, pos, ai, 5), null, '出界');
    assert.deepEqual(m.rhSolve(cars, pos).length, 1);
    const b = m.rhParse('...B..' + '...B..' + 'AAAB..' + '......' + '......' + '......');
    assert.equal(m.rhMove(b.cars, b.pos, 0, 4), null, '被擋住不能穿過');
    assert.equal(m.rhStars(5, 5), 3); assert.equal(m.rhStars(7, 5), 2); assert.equal(m.rhStars(9, 5), 1);
}
ok('rush hour rules');

// ---- 進度驗證 ----
{
    assert.deepEqual(m.cleanProgress(null), { s: {}, r: {} });
    assert.deepEqual(m.cleanProgress('x'), { s: {}, r: {} });
    const c = m.cleanProgress({ s: { 0: [10, 3], 1: [0, 1], 2: 'a', 3: [5.5, 1], 999: [1, 1] }, r: { 0: 7, 1: -1, 2: 'z', 999: 3 } });
    assert.deepEqual(c, { s: { 0: [10, 3] }, r: { 0: 7 } });
    assert.deepEqual(m.cleanProgress({ s: [1], r: 5 }), { s: {}, r: {} });
}
ok('progress validation');
