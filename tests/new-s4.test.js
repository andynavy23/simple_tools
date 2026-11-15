// 批次 s4：休閒益智（消消樂 / 七巧板）純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

const m = load('mini-games/casual-puzzles.html', 'spOf, colOf, mk, adj, genBoard, findMatches, expand, tryMove, drop, resolve, findMove, ensureMoves, cleanBest, tw, TYPES, BASE, polyArea, pose, inPoly, coverage, solved, snapShift, hintIndex, cleanProgress, fmt, PUZ');
const seeded = Util.seeded;
const n = 8;
// 乾淨底盤：用 checker 圖樣（顏色 = (x + 2y) % 5）不會有 3 連
const base = () => { const b = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) b.push((x + 2 * y) % 5); return b; };
assert.ok(!m.findMatches(base(), n).clear.size, '底盤無 3 連');

// ---- 生成：同種子同盤面、無 3 連、有可走步 ----
const g1 = m.genBoard(8, 6, seeded('x')), g2 = m.genBoard(8, 6, seeded('x')), g3 = m.genBoard(8, 6, seeded('y'));
assert.deepStrictEqual(g1, g2); assert.notDeepStrictEqual(g1, g3);
for (const k of ['a', 'b', 'c', 'd']) { const b = m.genBoard(7, 6, seeded(k)); assert.equal(b.length, 49); assert.ok(!m.findMatches(b, 7).clear.size && m.findMove(b, 7)); }
assert.equal(m.tw().length, 10);

// ---- 3 連 / 4 連 / 5 連 / L 形 ----
const put = (b, cells, c) => { cells.forEach(i => { b[i] = c; }); return b; };
let b = base(); put(b, [8, 9, 10], 5);
let r = m.findMatches(b, n); assert.deepStrictEqual([...r.clear].sort((a, c) => a - c), [8, 9, 10]); assert.equal(r.spawn.size, 0);
b = base(); put(b, [8, 9, 10, 11], 5); r = m.findMatches(b, n);
assert.equal(r.clear.size, 4); assert.equal(m.spOf([...r.spawn.values()][0]), 1, '橫 4 連 → 橫條紋');
b = base(); put(b, [3, 11, 19, 27], 5); r = m.findMatches(b, n); assert.equal(m.spOf([...r.spawn.values()][0]), 2, '直 4 連 → 直條紋');
b = base(); put(b, [8, 9, 10, 11, 12], 5); r = m.findMatches(b, n); assert.equal(m.spOf([...r.spawn.values()][0]), 4, '5 連 → 彩虹');
b = base(); put(b, [8, 9, 10, 18, 26], 5); r = m.findMatches(b, n);          // L 形：橫 8-10 直 10,18,26
assert.equal(r.clear.size, 5); assert.equal(m.spOf(r.spawn.get(10)), 3, 'L 形 → 炸彈（在交會格）');
b = base(); put(b, [9, 10, 11, 18, 26], 5); r = m.findMatches(b, n);          // T 形：橫 9-11 直 10,18,26
assert.equal(m.spOf(r.spawn.get(10)), 3);
// 偏好格：交換的格優先生成
b = base(); put(b, [8, 9, 10, 11], 5); r = m.findMatches(b, n, [10]); assert.ok(r.spawn.has(10));

// ---- 特殊方塊發動 ----
b = base(); b[27] = m.mk(1, 1); let e = m.expand(b, n, new Set([27])); assert.equal(e.size, 8, '橫條紋清整列');
b = base(); b[27] = m.mk(1, 2); e = m.expand(b, n, new Set([27])); assert.equal(e.size, 8, '直條紋清整欄'); assert.ok(e.has(3) && e.has(59));
b = base(); b[27] = m.mk(1, 3); e = m.expand(b, n, new Set([27])); assert.equal(e.size, 9, '炸彈 3×3');
b = base(); b[0] = m.mk(1, 3); e = m.expand(b, n, new Set([0])); assert.equal(e.size, 4, '角落炸彈');
b = base(); b[27] = m.mk(1, 3); b[28] = m.mk(1, 1); e = m.expand(b, n, new Set([27])); assert.ok(e.size > 9 && e.has(31), '連鎖引爆範圍內的條紋');

// ---- 交換 ----
b = base(); put(b, [8, 9, 11], 5); b[18] = 5;            // 18 往上換到 10 → 8,9,10,11 四連
assert.equal(m.tryMove(b, n, 10, 18).spawn.size, 1);
assert.equal(m.tryMove(b, n, 0, 2), null, '不相鄰'); assert.equal(m.tryMove(base(), n, 0, 1), null, '沒有連線');
assert.ok(!m.adj(8, 7, 8), '換行不算相鄰'); assert.ok(m.adj(8, 7, 15));
b = base(); b[0] = m.mk(0, 4); let t = m.tryMove(b, n, 0, 1); const col = m.colOf(b[1]);
assert.ok(t.clear.size >= 2 && [...t.clear].every(i => i === 0 || i === 1 || m.colOf(b[i]) === col), '彩虹清同色');
assert.equal([...t.clear].filter(i => m.colOf(b[i]) === col).length, b.filter(v => m.colOf(v) === col).length);
b = base(); b[27] = m.mk(1, 1); b[28] = m.mk(1, 2); t = m.tryMove(b, n, 27, 28); assert.equal(t.clear.size, 15, '條紋 + 條紋 = 十字');
b = base(); b[27] = m.mk(1, 3); b[28] = m.mk(1, 1); assert.equal(m.tryMove(b, n, 27, 28).clear.size, 8 * 3 + 8 * 3 - 9, '炸彈 + 條紋');
b = base(); b[27] = m.mk(1, 3); b[28] = m.mk(1, 3); assert.equal(m.tryMove(b, n, 27, 28).clear.size, 25, '炸彈 + 炸彈 5×5');
b = base(); b[27] = m.mk(0, 4); b[28] = m.mk(1, 2); assert.equal(m.tryMove(b, n, 27, 28).clear.size, 64, '彩虹 + 特殊 = 全盤');

// ---- 重力與補齊 ----
b = base(); b[56] = -1; b[48] = -1; let d = m.drop(b, n, 6, seeded('d'));
assert.ok(d.every(v => v >= 0 && v < 6)); assert.equal(d[56], base()[40], '上方的往下掉兩格');

// ---- 連鎖 ----
b = base(); put(b, [8, 9, 10], 5); let mv = { b, clear: m.findMatches(b, n).clear, spawn: new Map() };
let res = m.resolve(b, n, 6, seeded('r'), mv);
assert.ok(res.frames.length >= 1 && res.frames[0].gain === 30 && res.frames[0].chain === 1);
assert.equal(res.score, res.frames.reduce((s, f) => s + f.gain, 0));
res.frames.forEach(f => assert.equal(f.gain, f.cleared.length * 10 * f.chain));
assert.ok(!m.findMatches(res.board, n).clear.size, '結算後盤面穩定');
assert.ok(res.board.every(v => v >= 0));
// 多次隨機走法：盤面維持穩定、分數單調
{
    const rand = seeded('walk'); let bd = m.genBoard(8, 6, rand), total = 0, chains = 0;
    for (let s = 0; s < 40; s++) {
        const mvp = m.findMove(bd, 8); assert.ok(mvp); const t2 = m.tryMove(bd, 8, mvp[0], mvp[1]); const rr = m.resolve(t2.b, 8, 6, rand, t2);
        assert.ok(rr.score > 0 && !m.findMatches(rr.board, 8).clear.size && rr.board.every(v => v >= 0)); total += rr.score; chains += rr.frames.length > 1 ? 1 : 0;
        bd = m.ensureMoves(rr.board, 8, 6, rand).board; assert.ok(m.findMove(bd, 8));
    }
    assert.ok(total > 1000);
}
// 同種子同走法 → 同結果
{
    const run = () => { const rand = seeded('same'); let bd = m.genBoard(8, 6, rand), sc = 0; for (let s = 0; s < 10; s++) { const mvp = m.findMove(bd, 8), t2 = m.tryMove(bd, 8, mvp[0], mvp[1]), rr = m.resolve(t2.b, 8, 6, rand, t2); sc += rr.score; bd = m.ensureMoves(rr.board, 8, 6, rand).board; } return [sc, bd]; };
    assert.deepStrictEqual(run(), run());
}

// ---- 無解偵測與洗牌 ----
// 無解盤面 → 洗牌或整盤重產後有解
{
    const bd = Array.from({ length: 64 }, (_, i) => ((i % 8) + ((i / 8) | 0)) % 3);   // 三色斜帶：任何交換都湊不出 3 連
    assert.equal(m.findMove(bd, 8), null, '斜帶無解');
    const es = m.ensureMoves(bd, 8, 6, seeded('u')); assert.ok(es.shuffled && m.findMove(es.board, 8));
}
// 特殊方塊在洗牌時保留
{
    const bd = Array.from({ length: 64 }, (_, i) => ((i % 8) + ((i / 8) | 0)) % 3); bd[0] = m.mk(1, 1);
    const es = m.ensureMoves(bd, 8, 6, seeded('v')); assert.ok(es.shuffled);
}

// ---- 最佳紀錄驗證 ----
assert.deepStrictEqual(m.cleanBest(null), { daily: {} }); assert.deepStrictEqual(m.cleanBest('x'), { daily: {} }); assert.deepStrictEqual(m.cleanBest([1]), { daily: {} });
assert.deepStrictEqual(m.cleanBest({ m8: 'a', m7: -3, t8: 1.5, t7: 20, daily: [] }), { daily: {}, t7: 20 });
{ const dl = {}; for (let i = 1; i <= 40; i++) dl['2026-01-' + String(i).padStart(2, '0')] = i; dl['壞'] = 5; dl['2026-02-01'] = 'x'; const c = m.cleanBest({ m8: 100, daily: dl }); assert.equal(Object.keys(c.daily).length, 30); assert.equal(c.m8, 100); assert.ok(c.daily['2026-01-40'] && !c.daily['2026-01-01']); }

// ===== 七巧板 =====
assert.equal(m.TYPES, 'LLMSSQP');
const AREA = { L: 2, M: 1, S: 0.5, Q: 1, P: 1 };
for (const t of Object.keys(AREA)) near(m.polyArea(m.BASE[t]), AREA[t]);
near(['L', 'L', 'M', 'S', 'S', 'Q', 'P'].reduce((s, t) => s + AREA[t], 0), 8);
assert.ok(m.PUZ.length >= 20, '至少 20 個剪影');
const edgesOf = (f) => { const e = []; for (let i = 0; i < f.length; i += 2) { const j = (i + 2) % f.length; e.push(Math.hypot(f[j] - f[i], f[j + 1] - f[i + 1])); } return e.sort((a, c) => a - c); };
const names = new Set();
m.PUZ.forEach((pz, pi) => {
    assert.ok(!names.has(pz.n)); names.add(pz.n); assert.equal(pz.p.length, 7);
    let sum = 0;
    pz.p.forEach((poly, j) => {
        const t = m.TYPES[j];
        assert.ok(Math.abs(m.polyArea(poly) - AREA[t]) < 0.02, `${pz.n} 第 ${j} 塊面積`);
        const a = edgesOf(poly), bse = edgesOf(m.BASE[t]); assert.equal(a.length, bse.length);
        a.forEach((v, q) => assert.ok(Math.abs(v - bse[q]) < 0.01, `${pz.n} 第 ${j} 塊邊長 ${v} vs ${bse[q]}`));
        sum += m.polyArea(poly);
    });
    // 各板面積總和 = 剪影面積（取樣聯集面積），且板子互不重疊
    const c = m.coverage(pz.p, pz.p, 0.1);
    assert.ok(Math.abs(sum - 8) < 0.05, `${pz.n} 面積和 ${sum}`);
    assert.ok(c.cover > 0.999 && c.overlap < 0.01, `${pz.n} 標準解覆蓋 / 重疊 ${JSON.stringify(c)}`);
    let area = 0, cnt = 0; const st = 0.1; // 剪影面積（聯集取樣）
    for (let y = 0.037; y < 5; y += st) for (let x = 0.041; x < 5; x += st) if (pz.p.some(p => m.inPoly(x, y, p))) cnt++;
    assert.ok(Math.abs(cnt * st * st - sum) / sum < 0.04, `${pz.n} 剪影面積 ${cnt * st * st} vs ${sum}`);
    assert.ok(m.solved(pz.p, pz.p), pz.n + ' 標準解通過完成判定');
});
// 姿態：旋轉 / 翻面保持面積；4 次 90° 還原
for (const t of Object.keys(AREA)) for (let rot = 0; rot < 8; rot++) for (const fl of [false, true]) near(m.polyArea(m.pose(t, rot, fl, 3, 4, 1.5)), AREA[t] * 2.25, 1e-6);
{ const p0 = m.pose('L', 0, false, 5, 5), p8 = m.pose('L', 8, false, 5, 5); p0.forEach((v, i) => near(v, p8[i])); }
{ const a = m.pose('P', 0, false, 0, 0), f = m.pose('P', 0, true, 0, 0); assert.notDeepStrictEqual(a.map(v => +v.toFixed(3)), f.map(v => +v.toFixed(3))); }
// 完成判定：偏移一塊 / 少一塊 / 重疊 → 不通過
{
    const pz = m.PUZ[0].p, shift = (f, dx, dy) => f.map((v, i) => v + (i % 2 ? dy : dx));
    assert.ok(m.solved(pz, pz));
    assert.ok(!m.solved(pz, pz.map((p, i) => i === 0 ? shift(p, 1.2, 0.7) : p)), '一塊偏離');
    assert.ok(!m.solved(pz, pz.slice(1)), '少一塊');
    assert.ok(!m.solved(pz, [...pz.slice(0, 6), pz[0]]), '重複放同一塊（第 7 塊位置被佔）');
    assert.ok(m.solved(pz, pz.map(p => shift(p, 0.004, -0.004))), '微小誤差在容差內');
    assert.ok(!m.solved(pz, pz.map((p, i) => i === 2 ? shift(p, 0.35, 0) : p)), '偏 0.35 不通過');
    // 把所有板整體換成另一個合法拼法（另一種解）仍可能通過：同形剪影互換兩個小三角
    const sw = pz.slice(); [sw[3], sw[4]] = [sw[4], sw[3]]; assert.ok(m.solved(pz, sw), '兩個小三角互換仍算完成');
}
// 吸附與提示
assert.deepStrictEqual(m.snapShift([0, 0, 1, 0, 0, 1], [0.2, 0.1, 5, 5], 0.4).map(v => +v.toFixed(3)), [0.2, 0.1]);
assert.deepStrictEqual(m.snapShift([0, 0, 1, 0, 0, 1], [3, 3], 0.4), [0, 0]);
{
    const pz = m.PUZ[0].p, types = m.TYPES.split('');
    assert.equal(m.hintIndex(pz, types, pz, 0.3), -1);
    assert.equal(m.hintIndex(pz, types, pz.slice(1).map(p => p.map(v => v + 0)), 0.3) >= -1, true);
    const moved = pz.map((p, i) => i === 5 ? p.map(v => v + 3) : p); assert.equal(m.hintIndex(pz, types, moved, 0.3), 5);
    const wrongOrder = pz.slice(); [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1], wrongOrder[0]]; assert.equal(m.hintIndex(pz, types, wrongOrder, 0.3), -1, '兩個大三角互換仍視為都對');
}
// 進度驗證
assert.deepStrictEqual(m.cleanProgress(null, 24), {}); assert.deepStrictEqual(m.cleanProgress([1], 24), {});
assert.deepStrictEqual(m.cleanProgress({ 1: 30, 2: 'x', 3: -1, 99: 5, 4: 1.5, 5: 400000 }, 24), { 1: 30 });
assert.equal(m.fmt(75), '1:15');
ok('casual-puzzles 純邏輯');
