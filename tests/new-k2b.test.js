// 批次 k2：logic-puzzles（Takuzu / 不等式 / 摩天樓 / 關燈 / Akari）純邏輯
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('mini-games/logic-puzzles.html', 'PZ, wt, loBest, loSolutions, loPress, skErrs, akErrs, akWon, akLit, okSave, saveFits, staleDaily, twDay, digitHint, akHint, startBoard, fuErrs, tkErrs');
const { PZ } = m, S = (x) => Util.seeded(x);

// 每種謎題 200 個種子：恰有 1 個解，且解通過規則驗證、等於生成時的答案
const plan = { takuzu: [6, 8], futoshiki: [4, 5], skyscrapers: [4, 5], akari: [5, 7] };
for (const [t, sizes] of Object.entries(plan)) {
    for (let s = 0; s < 200; s++) {
        const n = sizes[s % sizes.length], lv = s % 3, p = PZ[t].gen(n, lv, S(`${t}-${s}`));
        const sols = PZ[t].solve(p, 2);
        assert.strictEqual(sols.length, 1, `${t} 種子 ${s} 解數 ${sols.length}`);
        assert.deepStrictEqual(sols[0], p.sol, `${t} 種子 ${s} 解與答案不同`);
        assert.ok(PZ[t].won(p, p.sol), `${t} 答案未通過規則`);
        assert.strictEqual(PZ[t].errs(p, p.sol).size, 0);
    }
    ok(`${t}：200 題唯一解`);
}
// 大尺寸各抽幾題
for (const [t, n] of [['takuzu', 10], ['futoshiki', 6], ['skyscrapers', 6]]) for (let s = 0; s < 6; s++) { const p = PZ[t].gen(n, s % 3, S('big' + s)); assert.strictEqual(PZ[t].solve(p, 2).length, 1); }
ok('大尺寸唯一解');
// 同種子同題
assert.deepStrictEqual(PZ.akari.gen(7, 1, S('d')), PZ.akari.gen(7, 1, S('d')));
assert.notDeepStrictEqual(PZ.takuzu.gen(8, 1, S('d1')).sol, PZ.takuzu.gen(8, 1, S('d2')).sol);

// Takuzu 手造
assert.ok([0, 1, 2].every(i => m.tkErrs([1, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1, 2, 1], 4).has(i)));
assert.strictEqual(m.tkErrs([1, 1, 2, 2, 2, 2, 1, 1, 1, 2, 1, 2, 2, 1, 2, 1], 4).size, 0);
assert.ok(m.tkErrs([1, 1, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 1, 1], 4).size > 0, '重複行 / 列');
// Futoshiki 手造
const f = { n: 2, h: [1, 0], v: [0, 0] };
assert.strictEqual(m.fuErrs(f, [2, 1, 0, 0]).size, 2); assert.strictEqual(m.fuErrs(f, [1, 2, 0, 0]).size, 0); assert.strictEqual(m.fuErrs(f, [1, 1, 0, 0]).size, 4 - 2);
// Skyscrapers 手造（4x4，行 = 1234 / 2143 / 3412 / 4321）
const sk = { n: 4, g: Array(16).fill(0), c: Array(16).fill(0) };
const sb = [1, 2, 3, 4, 2, 1, 4, 3, 3, 4, 1, 2, 4, 3, 2, 1];
sk.c[8] = 4; assert.strictEqual(m.skErrs(sk, sb).size, 0);       // 第一列左側看到 4 棟
sk.c[8] = 3; assert.ok(m.skErrs(sk, sb).has('c8'));
assert.ok(m.skErrs({ ...sk, c: Object.assign(Array(16).fill(0), { 0: 1 }) }, [1, 2, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).has('c0'), '上方線索 1 但第一欄 1,3 已看到 2 棟');
assert.ok(m.skErrs(sk, [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).has(0), '重複');
sk.c = Array(16).fill(0); sk.c[3] = 2; sk.c[11] = 1;               // 無法同時成立的線索組合 → 無解
assert.strictEqual(PZ.skyscrapers.solve({ n: 4, g: Array(16).fill(0), c: Object.assign(Array(16).fill(0), { 0: 1, 4: 1 }) }, 2).length, 0, '上下都是 1 的同一欄不可能（雙向最高）');
// Akari 手造（3x3，中心黑格 4）：四周四盞燈
const ak = { n: 3, g: [-1, -1, -1, -1, 4, -1, -1, -1, -1].map((v, i) => i % 2 === 0 ? -2 : v), sol: [] };
ak.g = [-2, -1, -2, -1, 4, -1, -2, -1, -2];
const lamps = [0, 1, 0, 1, 0, 1, 0, 1, 0];
assert.ok(m.akWon(ak, lamps)); assert.strictEqual(PZ.akari.solve(ak, 2).length, 1);
assert.ok(!m.akWon(ak, [0, 1, 0, 1, 0, 1, 0, 0, 0]), '少一盞');
const row = { n: 3, g: [-1, -1, -1, -2, -2, -2, -2, -2, -2], sol: [] };
assert.ok(m.akErrs(row, [1, 0, 1, 0, 0, 0, 0, 0, 0]).size === 2, '同列互照');
assert.ok(m.akErrs({ n: 3, g: [-1, 0, -1, -2, -2, -2, -2, -2, -2] }, [1, 0, 0, 0, 0, 0, 0, 0, 0]).has(1) === true, '0 的黑格旁有燈');
assert.deepStrictEqual(m.akLit({ n: 3, g: [-1, -1, -1, -2, -1, -1, -1, -1, -1] }, [1, 0, 0, 0, 0, 0, 0, 0, 0]).join(''), '111000000');
assert.ok(!m.akWon({ n: 3, g: [-1, -1, -1, -1, -1, -1, -1, -1, -1] }, [1, 0, 0, 0, 0, 0, 0, 0, 0]));

// Lights Out：n=3、4 窮舉比對（所有盤面：可解性與最少步數）
for (const n of [3, 4]) {
    const M = n * n, best = new Map();
    for (let s = 0; s < 1 << M; s++) {
        let b = new Array(M).fill(0), w = 0;
        for (let i = 0; i < M; i++) if (s >> i & 1) { b = m.loPress(b, n, i); w++; }
        const k = b.join(''); if (!best.has(k) || w < best.get(k)) best.set(k, w);
    }
    let cnt = 0;
    for (let s = 0; s < 1 << M; s++) {
        const b = Array.from({ length: M }, (_, i) => s >> i & 1), r = m.loBest(b, n), want = best.get(b.join(''));
        if (want === undefined) assert.strictEqual(r, null, `n=${n} 不可解盤面`);
        else { assert.strictEqual(m.wt(r), want, `n=${n} 最少步數`); assert.deepStrictEqual(r.reduce((bb, v, i) => v ? m.loPress(bb, n, i) : bb, b), new Array(M).fill(0)); cnt++; }
    }
    assert.strictEqual(cnt, best.size);
}
ok('關燈：3、4 尺寸窮舉一致');
for (const n of [3, 5, 6, 7]) for (let s = 0; s < 40; s++) {
    const p = PZ.lightsout.gen(n, s % 3, S('lo' + n + s)), sols = m.loSolutions(p.g, n);
    assert.ok(p.g.some(Boolean) && sols.length >= 1 && (sols.length & (sols.length - 1)) === 0);
    for (const x of sols.slice(0, 4)) assert.ok(m.loPress && x.reduce((bb, v, i) => v ? m.loPress(bb, n, i) : bb, p.g).every(v => !v));
}
assert.strictEqual(m.loSolutions(new Array(25).fill(1), 5).length, 4);   // 5x5 零空間 2 維
ok('關燈：生成可解');

// 提示
{ const p = PZ.takuzu.gen(6, 1, S('h')); const b = startB(p); const h = m.digitHint(PZ.takuzu, p, b, -1); assert.ok(h && p.sol[h.cell] === h.v);
  const w = b.slice(); const i = w.findIndex(v => !v); w[i] = 3 - p.sol[i]; assert.strictEqual(m.digitHint(PZ.takuzu, p, w, -1).wrong, true);
  const a = PZ.akari.gen(5, 1, S('ha')); const ah = m.akHint(a, new Array(25).fill(0)); assert.ok(a.sol[ah.cell] === 1); }
function startB(p) { return m.startBoard(p); }

// 存檔驗證與每日修剪
const good = { t: 'takuzu', level: 1, size: 6, seed: 'x', sig: 'y', daily: null, secs: 5, done: false, board: new Array(36).fill(0), notes: new Array(36).fill(0) };
assert.ok(m.okSave(good));
for (const bad of [null, 5, [], { ...good, t: 'zzz' }, { ...good, t: '__proto__' }, { ...good, level: 3 }, { ...good, size: 7 }, { ...good, seed: 5 }, { ...good, board: [1] }, { ...good, board: new Array(36).fill(3) }, { ...good, notes: new Array(36).fill(-1) }, { ...good, secs: -1 }, { ...good, secs: NaN }, { ...good, daily: 'x' }, { ...good, done: 1 }]) assert.ok(!m.okSave(bad));
const days = Array.from({ length: 40 }, (_, i) => 'logicp_daily_' + new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
const st = m.staleDaily([...days, 'logicp_best', 'x_daily_2020-01-01']);
assert.strictEqual(st.length, 10); assert.ok(st.every(k => k <= 'logicp_daily_2026-01-10'));
assert.strictEqual(m.twDay(Date.UTC(2026, 0, 1, 16, 30)), '2026-01-02');
ok('k2b 全部');
