// 批次 s2：logic-puzzles 新增 Kakuro 數和 / Flow 連線 純邏輯
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('mini-games/logic-puzzles.html', 'PZ, kkErrs, kkRuns, kkSolve, kkHint, flGen, flSolve, flWon, flInfo, flApply, flStep, flPathTo, flBase, flHint, flCut, okSave, saveFits, startBoard');
const { PZ } = m, S = (x) => Util.seeded(x);

// ---- Kakuro：固定種子抽樣，恰 1 解且等於答案 ----
for (let s = 0; s < 36; s++) {
    const n = [5, 7, 9][s % 3], lv = s % 3 + (s > 17 ? 0 : 0), p = PZ.kakuro.gen(n, lv, S('kk' + s));
    const sols = PZ.kakuro.solve(p, 2);
    assert.strictEqual(sols.length, 1, `kakuro ${s} 解數 ${sols.length}`);
    assert.deepStrictEqual(sols[0], p.sol);
    assert.ok(PZ.kakuro.won(p, p.sol)); assert.strictEqual(PZ.kakuro.errs(p, p.sol).size, 0);
    assert.ok(p.g.every((v, i) => (i < n || i % n === 0) ? v === 10 : true), '首列首行都是線索格');
    assert.ok(kkRunsOk(p), '每段長度 ≥ 2、總和等於答案');
}
function kkRunsOk(p) { return m.kkRuns(p).runs.every(r => r.cells.length >= 2 && r.cells.reduce((t, i) => t + p.sol[i], 0) === r.sum && new Set(r.cells.map(i => p.sol[i])).size === r.cells.length); }
ok('kakuro：36 題唯一解');
assert.deepStrictEqual(PZ.kakuro.gen(7, 1, S('d')), PZ.kakuro.gen(7, 1, S('d')), '同種子同題');
// 手造 3x3：一段橫 2 格和 3、一段豎 2 格和 4、另一段豎 2 格和 3 …（盤面 [黑 黑 黑 / 黑 白 白 / 黑 白 白]）
const k3 = { t: 'kakuro', n: 3, g: [10, 10, 10, 10, 0, 0, 10, 0, 0], a: [0, 0, 0, 0, 0, 0, 0, 0, 0], d: [0, 4, 6, 0, 0, 0, 0, 0, 0] };
k3.a[3] = 3; k3.a[6] = 7;     // 第二列 a=3、第三列 a=7（左邊黑格）
k3.sol = [10, 10, 10, 10, 1, 2, 10, 3, 4];
const w = m.kkSolve(k3, 5);
assert.deepStrictEqual(w.map(x => x.join()), ['10,10,10,10,1,2,10,3,4']);
assert.strictEqual(m.kkErrs(k3, [10, 10, 10, 10, 1, 2, 10, 3, 4]).size, 0);
assert.ok(m.kkErrs(k3, [10, 10, 10, 10, 1, 1, 10, 0, 0]).size >= 2, '同段重複');
assert.ok(m.kkErrs(k3, [10, 10, 10, 10, 2, 2, 10, 0, 0]).has(4), '段總和超過 / 重複');
assert.ok(m.kkErrs(k3, [10, 10, 10, 10, 1, 2, 10, 4, 3]).size > 0, '填滿但總和不對');
assert.strictEqual(m.kkErrs(k3, [10, 10, 10, 10, 1, 0, 10, 0, 0]).size, 0, '未填完且沒超過不算錯');
// 提示：填錯優先；單一候選
let h = m.kkHint(k3, [10, 10, 10, 10, 2, 0, 10, 0, 0], -1); assert.ok(h.wrong && h.cell === 4);
h = m.kkHint(k3, [10, 10, 10, 10, 0, 0, 10, 0, 0], -1); assert.ok(h.cell >= 0 && h.v >= 1);
// 存檔驗證
const sv = (p, over = {}) => Object.assign({ t: p.t, level: 1, size: p.n, seed: 'x', sig: p.sol.join(''), daily: null, board: m.startBoard(p), notes: Array(p.n * p.n).fill(0), secs: 5, done: false }, over);
{
    const p = PZ.kakuro.gen(5, 1, S('sv'));
    assert.ok(m.okSave(sv(p)) && m.saveFits(p, sv(p)));
    assert.ok(m.okSave(sv(p, { notes: Array(25).fill(1022) })), 'Kakuro 筆記可到 1022');
    assert.ok(!m.okSave(sv(p, { notes: Array(25).fill(1024) })));
    const b = m.startBoard(p), g = b.findIndex(v => v === 10); b[g] = 3;
    assert.ok(!m.saveFits(p, sv(p, { board: b })), '線索格不可被改');
}
ok('kakuro：規則 / 提示 / 存檔');

// ---- Flow：固定種子抽樣 ----
let uniq = 0, total = 0;
for (let s = 0; s < 30; s++) {
    const n = [5, 6, 7][s % 3], lv = s % 3, p = PZ.flow.gen(n, lv, S('fl' + s));
    total++; if (p.uniq) uniq++;
    // 保證有解：答案通過驗證；路徑互不重疊、覆蓋整盤、相鄰
    assert.ok(PZ.flow.won(p, p.sol), `flow ${s} 答案不合法`);
    assert.strictEqual(p.paths.flat().length, n * n); assert.strictEqual(new Set(p.paths.flat()).size, n * n);
    p.paths.forEach(pa => { assert.ok(pa.length >= 2); for (let i = 1; i < pa.length; i++) assert.strictEqual(Math.abs(pa[i] - pa[i - 1]) === 1 && ((pa[i] / n | 0) === (pa[i - 1] / n | 0)) || Math.abs(pa[i] - pa[i - 1]) === n, true); });
    assert.strictEqual(p.g.filter(Boolean).length, 2 * p.k);
    const sols = PZ.flow.solve(p, 2);
    assert.ok(sols.length >= 1 || sols.over, `flow ${s} 求解器找不到答案`);
    if (p.uniq) { assert.strictEqual(sols.length, 1); assert.deepStrictEqual(sols[0], p.sol); }
}
assert.ok(uniq / total >= 0.8, `5–7 尺寸唯一解比例 ${uniq}/${total}`);
for (const n of [8, 9]) { const p = PZ.flow.gen(n, 1, S('big' + n)); assert.ok(PZ.flow.won(p, p.sol)); }
assert.deepStrictEqual(PZ.flow.gen(6, 1, S('d')).sol, PZ.flow.gen(6, 1, S('d')).sol, '同種子同題');
ok(`flow：30 題有解（唯一 ${uniq}/${total}）`);

// 手造 3x3：色 1 = 0 → 2（上排）、色 2 = 3 → 5 、色 3 = 6 → 8
const f3 = { t: 'flow', n: 3, k: 3, g: [1, 0, 1, 2, 0, 2, 3, 0, 3], ends: [null, [0, 2], [3, 5], [6, 8]] };
f3.sol = [1, 1, 1, 2, 2, 2, 3, 3, 3]; f3.paths = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];
assert.ok(m.flWon(f3, f3.sol)); assert.ok(!m.flWon(f3, [1, 1, 1, 2, 2, 2, 3, 0, 3]), '沒填滿');
assert.ok(!m.flWon(f3, [1, 2, 1, 2, 2, 2, 3, 3, 3]), '顏色 1 沒連通');
assert.deepStrictEqual(m.flInfo(f3, [1, 1, 1, 2, 0, 0, 0, 0, 0]), { conn: 1, filled: 4 });
assert.strictEqual(m.flSolve(f3, 3).length, 1);
// 路徑規則：壓到別色 = 切斷
let b = m.startBoard(f3);
b = m.flApply(f3, m.flBase(f3, b, 1), 1, [0, 1, 2]); assert.deepStrictEqual(b, [1, 1, 1, 2, 0, 2, 3, 0, 3]);
b = m.flApply(f3, m.flBase(f3, b, 2), 2, [3, 4, 5]); assert.deepStrictEqual(b, [1, 1, 1, 2, 2, 2, 3, 0, 3]);
// 顏色 1 改走 0 → 3? 端點 3 是別色端點 → flStep 禁止
assert.deepStrictEqual(m.flStep(f3, 1, [0], 3), [0]);
assert.deepStrictEqual(m.flStep(f3, 1, [0], 2), [0], '非相鄰不動');
assert.deepStrictEqual(m.flStep(f3, 1, [0], 1), [0, 1]);
assert.deepStrictEqual(m.flStep(f3, 1, [0, 1], 0), [0], '走回自己 = 回退');
assert.deepStrictEqual(m.flStep(f3, 1, [0, 1, 2], 5), [0, 1, 2], '到達另一端點後只能回退');
// 切斷：色 2 的路徑被色 1 壓到中間格 → 與端點不相連的片段消失
const f4 = { t: 'flow', n: 4, k: 2, g: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1], ends: [null, [0, 15], [12, 12]] };
f4.ends[2] = [12, 13];
const bb = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 1];
{ const c = bb.slice(); m.flCut(f4, c, 2, 13); assert.deepStrictEqual(c.slice(12), [2, 0, 0, 1], '遠離端點的片段被移除'); }
// 從中段接著畫
const pt = m.flPathTo(f3, [1, 1, 0, 0, 0, 0, 0, 0, 0], 1); assert.deepStrictEqual(pt, [0, 1]);
assert.strictEqual(m.flPathTo(f4, [1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1], 5), null);
// 提示：第一條不同的顏色，前半段（至少 3 格）
let fh = m.flHint(f3, m.startBoard(f3)); assert.strictEqual(fh.c, 1); assert.deepStrictEqual(fh.cells, [0, 1, 2]);
assert.strictEqual(m.flHint(f3, f3.sol), null);
fh = m.flHint(f3, [1, 1, 1, 2, 2, 2, 0, 0, 3]); assert.strictEqual(fh.c, 3);
// 存檔：Flow 端點不可改
{
    const p = PZ.flow.gen(5, 1, S('svf')), s = sv(p);
    assert.ok(m.okSave(s) && m.saveFits(p, s));
    const bd = m.startBoard(p), e = p.g.findIndex(Boolean); bd[e] = 0;
    assert.ok(!m.saveFits(p, sv(p, { board: bd })));
    assert.ok(!m.okSave(sv(p, { board: Array(25).fill(99) })));
}
// 求解器預算：極端情況會標記 over 而不是卡死
{ const p = PZ.flow.gen(8, 1, S('o')); const r = m.flSolve(p, 2, 50); assert.ok(r.over === true || r.length >= 1); }
ok('flow：規則 / 路徑 / 提示 / 存檔');
