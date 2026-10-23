// 批次 k4：arcade（迷你街機）純邏輯：碰撞幾何、種子序列、難度曲線、固定步長、計分、最高分驗證
const assert = require('assert');
const { load, ok } = require('./_load');
const A = load('mini-games/arcade.html', 'rectHit, circleRect, circleHit, segCircle, bounceAxis, paddleBounce, fixedSteps, moleParams, fruitParams, ballSpeed, dinoSpeed, flappyParams, moleNext, fruitSpawn, makeDinoGen, makeFlappyGen, brickLevel, moleScore, sliceScore, cleanBest, cleanMap, taipeiDay, dailyPrune, DINO, W, H');
const R = (seed) => Util.seeded(seed);

// 碰撞邊界
const r = (x, y, w, h) => ({ x, y, w, h });
assert.ok(A.rectHit(r(0, 0, 10, 10), r(9.99, 0, 10, 10)));
assert.ok(!A.rectHit(r(0, 0, 10, 10), r(10, 0, 10, 10)), '邊緣相碰不算');
assert.ok(!A.rectHit(r(0, 0, 10, 10), r(0, 10, 10, 10)));
assert.ok(A.rectHit(r(0, 0, 10, 10), r(2, 2, 2, 2)), '包含');
assert.ok(A.circleRect(5, 5, 1, 0, 0, 10, 10), '圓在矩形內');
assert.ok(A.circleRect(11.9, 5, 2, 0, 0, 10, 10));
assert.ok(!A.circleRect(12, 5, 2, 0, 0, 10, 10), '相切不算');
assert.ok(A.circleRect(11, 11, 1.5, 0, 0, 10, 10), '角落內');
assert.ok(!A.circleRect(11, 11, 1.4, 0, 0, 10, 10), '角落外（距離 √2 ≈ 1.414）');
assert.ok(A.circleHit(0, 0, 5, 9, 0, 5) && !A.circleHit(0, 0, 5, 10, 0, 5));
assert.ok(A.segCircle(0, 0, 10, 0, 5, 3, 3), '線段切到圓（相切算）');
assert.ok(!A.segCircle(0, 0, 10, 0, 5, 3.01, 3));
assert.ok(!A.segCircle(0, 0, 10, 0, 14, 0, 3), '線段外端點之外');
assert.ok(A.segCircle(0, 0, 10, 0, 12, 0, 2), '端點剛好碰到');
assert.ok(A.segCircle(5, 5, 5, 5, 5, 5, 1), '零長度線段');
assert.ok(!A.segCircle(5, 5, 5, 5, 9, 9, 1));
const brick = r(100, 100, 40, 16);
assert.strictEqual(A.bounceAxis(95, 108, 6, brick), 'x');   // 從左側撞
assert.strictEqual(A.bounceAxis(120, 95, 6, brick), 'y');   // 從上方撞
assert.strictEqual(A.bounceAxis(120, 120, 6, brick), 'y');
assert.strictEqual(A.bounceAxis(50, 50, 6, brick), null);
for (const off of [-3, -1, -.5, 0, .5, 1, 3]) { const v = A.paddleBounce(off, 300); assert.ok(Math.abs(Math.hypot(v.vx, v.vy) - 300) < 1e-9); assert.ok(v.vy < 0); }
assert.ok(A.paddleBounce(-1, 100).vx < 0 && A.paddleBounce(1, 100).vx > 0 && Math.abs(A.paddleBounce(0, 100).vx) < 1e-9);
assert.deepStrictEqual(A.paddleBounce(9, 100), A.paddleBounce(1, 100), '偏移夾在 ±1');

// 固定步長積分：不同 delta 切法，總步數與位置一致
const integrate = (deltas, stepMs = 10) => { let acc = 0, steps = 0, x = 0; const v = 3; for (const d of deltas) { const s = A.fixedSteps(acc, d, stepMs, 1e9); acc = s.acc; for (let i = 0; i < s.n; i++) { x += v * stepMs / 1000; steps++; } } return { steps, x }; };
const ref = integrate([1000]);
assert.strictEqual(ref.steps, 100);
for (const ch of [[500, 500], [10, 10, 980], [3, 7, 11, 9, 970], Array(1000).fill(1), [1, 999], [250, 250, 250, 250]]) { const q = integrate(ch); assert.strictEqual(q.steps, ref.steps); assert.ok(Math.abs(q.x - ref.x) < 1e-9); }
// 60Hz 預設步長：16.667ms 切法（總長剛好是步長整數倍）
let n60 = 0, a60 = 0; for (let i = 0; i < 60; i++) { const s = A.fixedSteps(a60, 1000 / 60); a60 = s.acc; n60 += s.n; } assert.strictEqual(n60, 60);
assert.strictEqual(A.fixedSteps(0, 5000).n, 6, '單次上限 100ms：只補 6 步');
assert.strictEqual(A.fixedSteps(0, -50).n, 0);
assert.ok(A.fixedSteps(0, 10).acc > 9.9 && A.fixedSteps(0, 10).n === 0);

// 難度曲線單調
const mono = (f, xs, key, dir) => { let p = null; for (const x of xs) { const o = f(x), v = key ? o[key] : o; if (p !== null) assert.ok(dir > 0 ? v >= p : v <= p, `${key} 在 ${x} 不單調`); p = v; } };
const xs = Array.from({ length: 200 }, (_, i) => i * 1.5);
mono(A.moleParams, xs, 'gap', -1); mono(A.moleParams, xs, 'life', -1);
mono(A.fruitParams, xs, 'interval', -1); mono(A.fruitParams, xs, 'speed', 1); mono(A.fruitParams, xs, 'bombP', 1);
mono(A.flappyParams, xs, 'gap', -1); mono(A.flappyParams, xs, 'speed', 1);
mono(A.dinoSpeed, xs.map(x => x * 100), null, 1); mono(A.ballSpeed, [1, 2, 3, 5, 8, 20], null, 1);
assert.ok(A.moleParams(0).gap > A.moleParams(30).gap && A.dinoSpeed(0) < A.dinoSpeed(1e5) && A.dinoSpeed(1e9) <= 600 && A.ballSpeed(99) <= 420);
assert.ok(A.flappyParams(1e6).gap >= 105 && A.moleParams(1e6).gap >= .35 && A.fruitParams(1e6).bombP <= .3);

// 同種子同序列、不同種子不同
const seq = (f, n) => Array.from({ length: n }, f);
const mseq = (seed) => { const rd = R(seed); let last = -1; return seq((_, i) => { const m = A.moleNext(rd, i, last); last = m.hole; return m; }, 50); };
assert.deepStrictEqual(mseq('a'), mseq('a')); assert.notDeepStrictEqual(mseq('a'), mseq('b'));
for (const m of mseq('z')) { assert.ok(m.hole >= 0 && m.hole < 9 && Number.isInteger(m.hole)); assert.ok(m.gap > 0 && m.life > 0); }
{ const rd = R('q'); let last = -1; for (let i = 0; i < 500; i++) { const m = A.moleNext(rd, i * .1, last); assert.notStrictEqual(m.hole, last); last = m.hole; } }
const dseq = (s) => { const g = A.makeDinoGen(s); return seq(() => g(), 100); };
assert.deepStrictEqual(dseq('2026-10-22'), dseq('2026-10-22')); assert.notDeepStrictEqual(dseq('2026-10-22'), dseq('2026-10-23'));
dseq('x').forEach((o, i) => { assert.ok(o.gap >= 280 + Math.min(i, 30) * 8 && o.gap < 580 + Math.min(i, 30) * 8); assert.ok(A.DINO[o.kind]); if (i < 3) assert.notStrictEqual(o.kind, 'bird'); });
assert.ok(new Set(dseq('x').map(o => o.kind)).size === 3, '三種障礙都會出現');
const fseq = (s) => { const g = A.makeFlappyGen(s); return seq(() => g(), 200); };
assert.deepStrictEqual(fseq('d'), fseq('d')); assert.notDeepStrictEqual(fseq('d'), fseq('e'));
fseq('d').forEach((y, i, a) => { assert.ok(y >= 100 && y <= 340); if (i) assert.ok(Math.abs(y - a[i - 1]) <= 140 + 1e-9); });
const fr = (s) => { const rd = R(s); return seq((_, i) => A.fruitSpawn(rd, i), 100); };
assert.deepStrictEqual(fr('f'), fr('f'));
for (const f of fr('f')) { assert.ok(f.x >= 20 && f.x <= 340 && f.vy > 0 && ['bomb', 'fruit'].includes(f.type) && f.kind >= 0 && f.kind < 5); }
// 炸彈比例大致符合機率（種子固定，不會隨機失敗）
{ const rd = R('bombs'); const k = seq(() => A.fruitSpawn(rd, 0), 3000).filter(f => f.type === 'bomb').length / 3000; assert.ok(Math.abs(k - .12) < .03, String(k)); }

// 磚塊關卡
for (let n = 1; n <= 12; n++) {
    const L = A.brickLevel(n); assert.ok(L.length > 0); assert.ok(L.every(b => b.c >= 0 && b.c < 8 && b.r >= 0 && b.r < 8 && (b.hp === 1 || b.hp === 2)));
    assert.strictEqual(new Set(L.map(b => b.r * 8 + b.c)).size, L.length, '格子不重複');
}
assert.strictEqual(A.brickLevel(1).length, 24); assert.strictEqual(A.brickLevel(3).length, 5 * 4);
assert.ok(A.brickLevel(30).length <= 64);
assert.ok(A.brickLevel(1).every(b => b.hp === 1) && A.brickLevel(2).filter(b => b.hp === 2).length === 8);

// 計分
assert.deepStrictEqual([0, 4, 5, 9, 10, 24, 25, 99].map(A.moleScore), [10, 10, 20, 20, 30, 50, 50, 50]);
assert.deepStrictEqual([1, 2, 3, 4, 5].map(A.sliceScore), [1, 2, 6, 8, 10]);

// 最高分資料驗證
assert.strictEqual(A.cleanBest(-1), 0); assert.strictEqual(A.cleanBest('9'), 0); assert.strictEqual(A.cleanBest(NaN), 0); assert.strictEqual(A.cleanBest(Infinity), 0); assert.strictEqual(A.cleanBest(null), 0);
assert.strictEqual(A.cleanBest(12.9), 12); assert.strictEqual(A.cleanBest(1e20), 1e9);
assert.deepStrictEqual(A.cleanMap({ mole: 5, dino: -2, flappy: 'x', hack: 9, slice: 1e30 }), { mole: 5, slice: 1e9 });
for (const bad of [null, undefined, 5, 'x', [1, 2], true]) assert.deepStrictEqual(A.cleanMap(bad), {});
assert.deepStrictEqual(A.cleanMap({ mole: 5, dino: 7 }, ['dino', 'flappy']), { dino: 7 });
// 台灣時間日期（UTC+8）
assert.strictEqual(A.taipeiDay(Date.UTC(2026, 9, 21, 15, 59, 59)), '2026-10-21'); assert.strictEqual(A.taipeiDay(Date.UTC(2026, 9, 21, 16, 0, 0)), '2026-10-22');
// 每日鍵只留 30 筆
{
    const keys = Array.from({ length: 45 }, (_, i) => 'arcade_daily_' + A.taipeiDay(Date.UTC(2026, 0, 1 + i)));
    const del = A.dailyPrune([...keys, 'other_key', 'arcade_daily_junk']);
    assert.strictEqual(del.length, 16); assert.ok(del.includes('arcade_daily_junk')); assert.ok(del.includes(keys[0]) && del.includes(keys[14]) && !del.includes(keys[15]) && !del.includes('other_key'));
    assert.deepStrictEqual(A.dailyPrune(keys.slice(0, 30)), []); assert.deepStrictEqual(A.dailyPrune([]), []);
}
ok('k4 arcade: 碰撞 / 種子序列 / 難度單調 / 固定步長 / 計分 / 最高分驗證');
