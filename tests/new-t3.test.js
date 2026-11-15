// 批次 t3：數理計算的矩陣與方程式純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('utils/math-sci-calc.html', 'FR, Q0, Q1, qadd, qneg, qz, qeq, qNum, qStr, parseQ, isqrt, sqrtQ, qMatStr, parseMat, mAdd, mMul, mScale, mT, mTrace, qDet, qRref, mInv, solveLinear, solveLines, parseLinEqs, quad, cstr, polyEvalC, polyRoots, eqFn, findRoots, newton');
const P = (t) => m.parseMat(t);
const S = (M) => M.map(r => r.map(v => m.qStr(v)).join(' ')).join(';');
const isI = (M) => M.every((r, i) => r.every((v, j) => m.qeq(v, i === j ? m.Q1 : m.Q0)));

// ---- 有理數與解析 ----
assert.equal(m.qStr(m.parseQ('0.75')), '3/4');
assert.equal(m.qStr(m.parseQ('-6/4')), '-3/2');
assert.equal(m.qStr(m.parseQ('2')), '2');
assert.equal(m.parseQ('1/0'), null); assert.equal(m.parseQ('abc'), null); assert.equal(m.parseQ('1e3'), null);
assert.equal(m.qStr(m.parseQ('1/3'), true), '0.3333333333');
assert.equal(m.isqrt(10n ** 40n), 10n ** 20n); assert.equal(m.isqrt(99n), 9n);
assert.equal(m.qStr(m.sqrtQ(m.parseQ('9/16'))), '3/4'); assert.equal(m.sqrtQ(m.parseQ('2')), null);
ok('t3 rational');

// ---- 矩陣解析 ----
assert.equal(S(P('1 2\n3 4')), '1 2;3 4');
assert.equal(S(P('1,2;3,4')), '1 2;3 4');
assert.throws(() => P('1 2\n3'), /一樣/);
assert.throws(() => P('1 a'), /無法辨識/);
assert.throws(() => P(''), /請輸入/);
assert.throws(() => P(Array(9).fill('1').join('\n')), /8 列/);
assert.throws(() => P(Array(9).fill('1').join(' ')), /8 欄/);
ok('t3 parseMat');

// ---- 加減乘轉置跡 ----
const A = P('1 2\n3 4'), B = P('0 1\n1 0');
assert.equal(S(m.mAdd(A, B)), '1 3;4 4'); assert.equal(S(m.mAdd(A, B, true)), '1 1;2 4');
assert.equal(S(m.mMul(A, B)), '2 1;4 3');
assert.equal(S(m.mMul(P('1 2 3'), P('1\n2\n3'))), '14');
assert.throws(() => m.mMul(P('1 2'), P('1 2')), /欄數/);
assert.throws(() => m.mAdd(P('1 2'), P('1\n2')), /尺寸/);
assert.equal(S(m.mScale(A, m.parseQ('1/2'))), '1/2 1;3/2 2');
assert.equal(S(m.mT(P('1 2 3\n4 5 6'))), '1 4;2 5;3 6');
assert.equal(m.qStr(m.mTrace(P('1 2\n3 4'))), '5');
assert.throws(() => m.mTrace(P('1 2 3')), /方陣/);
ok('t3 basic ops');

// ---- 行列式 ----
const det = (t) => m.qStr(m.qDet(P(t)));
assert.equal(det('7'), '7');
assert.equal(det('1 2\n3 4'), '-2');
assert.equal(det('2 1 -1\n-3 -1 2\n-2 1 2'), '-1');
assert.equal(det('1 2 3\n4 5 6\n7 8 9'), '0');
assert.equal(det('0 1\n1 0'), '-1', '需要換列');
assert.equal(det('1 0 0 0\n0 2 0 0\n0 0 3 0\n0 0 0 4'), '24');
assert.equal(det('1/2 1/3\n1/4 1/5'), '1/60');
assert.equal(det('0 0\n0 0'), '0');
// det(AB) = det(A)det(B)；det(Aᵀ) = det(A)（偽隨機 5×5）
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 19 - 9;
const rm = (n) => Array.from({ length: n }, () => Array.from({ length: n }, () => m.FR.mk(BigInt(rnd()))));
for (let k = 0; k < 15; k++) {
    const X = rm(5), Y = rm(5);
    assert.ok(m.qeq(m.qDet(m.mMul(X, Y)), m.FR.mul(m.qDet(X), m.qDet(Y))));
    assert.ok(m.qeq(m.qDet(m.mT(X)), m.qDet(X)));
}
assert.throws(() => m.qDet(P('1 2 3')), /方陣/);
ok('t3 det');

// ---- 反矩陣 ----
const inv = (t) => m.mInv(P(t));
assert.equal(S(inv('2 1\n1 3')), '3/5 -1/5;-1/5 2/5');
assert.equal(S(inv('2 1 -1\n-3 -1 2\n-2 1 2')), '4 3 -1;-2 -2 1;5 4 -1');
assert.equal(inv('1 2\n2 4'), null, '奇異矩陣');
assert.equal(inv('1 2 3\n4 5 6\n7 8 9'), null);
assert.equal(inv('0 0\n0 0'), null);
assert.equal(S(inv('0 1\n1 0')), '0 1;1 0');
let invCount = 0;
for (let k = 0; k < 40; k++) {
    const X = rm(1 + (k % 6)), I = m.mInv(X);
    if (!I) { assert.ok(m.qz(m.qDet(X))); continue; }
    invCount++;
    assert.ok(isI(m.mMul(X, I)) && isI(m.mMul(I, X)));
}
assert.ok(invCount >= 5);
// 8×8 希爾伯特矩陣（分數精確）反矩陣乘回單位
{
    const H = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => m.FR.mk(1n, BigInt(i + j + 1))));
    const t0 = Date.now(), I = m.mInv(H);
    assert.ok(I && isI(m.mMul(H, I)) && Date.now() - t0 < 3000);
    assert.equal(m.qStr(I[0][0]), '64');
}
// log 有記錄
{ const log = []; m.mInv(P('2 1\n1 3'), log); assert.ok(log.length > 3 && log[0] === '[A | I]'); assert.ok(log.some(l => l.includes('R1'))); }
ok('t3 inverse');

// ---- 秩 / RREF ----
const rank = (t) => m.qRref(P(t), P(t)[0].length).piv.length;
assert.equal(rank('1 2 3\n4 5 6\n7 8 9'), 2);
assert.equal(rank('1 0\n0 1'), 2);
assert.equal(rank('0 0\n0 0'), 0);
assert.equal(rank('1 2 3 4'), 1);
assert.equal(rank('1 2\n2 4\n3 6'), 1);
assert.equal(rank('1 2 0\n0 0 1\n1 2 1'), 2);
assert.equal(rank('1\n2\n3'), 1);
{
    const log = ['start'], r = m.qRref(P('0 2 4\n1 1 1\n2 4 6'), 3, log);
    assert.equal(S(r.R), '1 0 -1;0 1 2;0 0 0');
    assert.deepEqual(r.piv, [0, 1]);
    assert.ok(log.some(l => l.includes('↔')), '有交換列');
    assert.ok(log.some(l => l.includes('÷')) && log.some(l => l.includes('−')));
}
// 秩 = 轉置的秩
for (let k = 0; k < 20; k++) { const X = rm(4); assert.equal(m.qRref(X, 4).piv.length, m.qRref(m.mT(X), 4).piv.length); }
ok('t3 rank rref');

// ---- 解線性方程組 ----
const solve = (a, b) => { const A = P(a), bb = P(b); return m.solveLinear(A.map((r, i) => [...r, bb[i][0]]), null); };
{
    const r = solve('2 1 -1\n-3 -1 2\n-2 1 2', '8\n-11\n-3');
    assert.equal(r.type, 'unique');
    assert.deepEqual(r.expr.map(e => m.qStr(e.c)), ['2', '3', '-1']);
    assert.deepEqual(m.solveLines(r, ['x1', 'x2', 'x3']).slice(1), ['x1 = 2', 'x2 = 3', 'x3 = -1']);
}
assert.equal(solve('1 1\n1 1', '1\n2').type, 'none');
assert.equal(solve('1 2 3\n4 5 6\n7 8 9', '1\n2\n4').type, 'none');
{
    const r = solve('1 1 1\n1 -1 0', '3\n1');   // x+y+z=3, x-y=1
    assert.equal(r.type, 'infinite'); assert.equal(r.rank, 2); assert.deepEqual(r.free, [2]);
    assert.deepEqual(m.solveLines(r, ['x', 'y', 'z']).slice(1), ['x = 2 − (1/2)t1', 'y = 1 − (1/2)t1', 'z = t1']);
    // 參數式代回：任取 t 都滿足
    for (const t of [0, 1, -3, 2.5]) {
        const v = r.expr.map(e => m.qNum(e.c) + e.ts.reduce((s, [k, i]) => s + m.qNum(k) * t, 0));
        assert.ok(Math.abs(v[0] + v[1] + v[2] - 3) < 1e-12 && Math.abs(v[0] - v[1] - 1) < 1e-12);
    }
}
{   // 全零：2 個自由變數
    const r = solve('0 0\n0 0', '0\n0'); assert.equal(r.type, 'infinite'); assert.equal(r.free.length, 2);
    assert.equal(solve('0 0', '1').type, 'none');
    // 多於方程式的未知數、方程式比未知數多（過定但一致）
    assert.equal(solve('1 1\n2 2\n3 3', '2\n4\n6').type, 'infinite');
    assert.equal(solve('1 0\n0 1\n1 1', '1\n2\n3').type, 'unique');
    assert.equal(solve('1 0\n0 1\n1 1', '1\n2\n4').type, 'none');
}
// 隨機可逆系統：Ax = b 的解乘回等於 b
for (let k = 0; k < 20; k++) {
    const X = rm(4), bv = Array.from({ length: 4 }, () => [m.FR.mk(BigInt(rnd()))]);
    const r = m.solveLinear(X.map((row, i) => [...row, bv[i][0]]));
    if (m.qz(m.qDet(X))) continue;
    assert.equal(r.type, 'unique');
    assert.deepEqual(m.mMul(X, r.expr.map(e => [e.c])), bv);
}
ok('t3 solve linear');

// ---- 聯立方程式文字 ----
{
    const { names, M } = m.parseLinEqs('2x + y = 5\nx - y = 1');
    assert.deepEqual(names, ['x', 'y']); assert.equal(S(M), '2 1 5;1 -1 1');
    const r = m.solveLinear(M); assert.deepEqual(r.expr.map(e => m.qStr(e.c)), ['2', '1']);
    const t3 = m.parseLinEqs('x + y + z = 6; 2y + 5z = -4; 2x + 5y - z = 27');
    assert.deepEqual(m.solveLinear(t3.M).expr.map(e => m.qStr(e.c)), ['5', '3', '-2']);
    // 移項、係數在右邊、分數與小數、省略 1
    assert.equal(S(m.parseLinEqs('3x = 2x + 4').M), '1 4');
    assert.equal(S(m.parseLinEqs('0.5x - y = 1/2').M), '1/2 -1 1/2');
}
assert.throws(() => m.parseLinEqs('x + y'), /剛好有一個/);
assert.throws(() => m.parseLinEqs('x + = 3'), /無法解析|內容/);
assert.throws(() => m.parseLinEqs('a+b+c+d+e=1'), /4 個變數/);
assert.throws(() => m.parseLinEqs('3 = 3'), /沒有變數/);
assert.throws(() => m.parseLinEqs(''), /請輸入/);
ok('t3 parseLinEqs');

// ---- 一元二次 ----
{
    let r = m.quad(...['1', '-3', '2'].map(m.parseQ));
    assert.equal(r.kind, 'two'); assert.deepEqual(r.exact.map(q => m.qStr(q)), ['1', '2']);
    assert.deepEqual(r.roots.map(z => z[0]), [1, 2]);
    assert.equal(r.factor, '(x − 1)(x − 2)'); assert.equal(m.qStr(r.D), '1');
    assert.equal(m.qStr(r.vertex.x), '3/2'); assert.equal(m.qStr(r.vertex.y), '-1/4');
    r = m.quad(...['1', '2', '5'].map(m.parseQ));   // 複根 -1 ± 2i
    assert.equal(r.kind, 'complex'); assert.deepEqual(r.roots, [[-1, 2], [-1, -2]]);
    assert.equal(m.cstr(r.roots[0]), '-1 + 2i'); assert.equal(m.cstr(r.roots[1]), '-1 − 2i'); assert.equal(r.factor, null);
    r = m.quad(...['1', '2', '1'].map(m.parseQ));
    assert.equal(r.kind, 'one'); assert.equal(r.factor, '(x + 1)²'); assert.equal(m.qStr(r.D), '0');
    r = m.quad(...['2', '-4', '-6'].map(m.parseQ));   // 2(x-3)(x+1)
    assert.equal(r.factor, '2(x + 1)(x − 3)'); assert.deepEqual(r.roots.map(z => z[0]), [-1, 3]);
    r = m.quad(...['1', '0', '-2'].map(m.parseQ));   // ±√2
    assert.equal(r.exact, null); assert.equal(r.factor, null);
    assert.ok(Math.abs(r.roots[0][0] + Math.SQRT2) < 1e-12 && Math.abs(r.roots[1][0] - Math.SQRT2) < 1e-12);
    r = m.quad(...['-1', '0', '4'].map(m.parseQ)); assert.equal(r.factor, '−(x + 2)(x − 2)');
    r = m.quad(...['1', '0', '1'].map(m.parseQ)); assert.deepEqual(r.roots, [[0, 1], [0, -1]]);
    r = m.quad(...['1/2', '0', '-8'].map(m.parseQ)); assert.deepEqual(r.roots.map(z => z[0]), [-4, 4]);
    r = m.quad(...['1', '0', '0'].map(m.parseQ)); assert.equal(r.factor, 'x²');
    assert.throws(() => m.quad(m.Q0, m.Q1, m.Q1), /不可為 0/);
    // 隨機係數：每個根代回殘差很小
    for (let k = 0; k < 60; k++) {
        const a = rnd() || 1, b = rnd(), c = rnd(), q = m.quad(m.FR.mk(BigInt(a)), m.FR.mk(BigInt(b)), m.FR.mk(BigInt(c)));
        for (const z of q.roots) {
            const [pr, pi] = m.polyEvalC([a, b, c], z);
            assert.ok(Math.hypot(pr, pi) < 1e-9, `${a},${b},${c} → ${z}`);
        }
    }
}
ok('t3 quadratic');

// ---- 多項式根（Durand–Kerner） ----
{
    const chk = (cs, tol = 1e-9) => {
        const rs = m.polyRoots(cs), lead = cs.slice(cs.findIndex(v => v !== 0));
        assert.equal(rs.length, lead.length - 1);
        for (const z of rs) assert.ok(Math.hypot(...m.polyEvalC(cs, z)) < tol, `${cs} 根 ${z} 殘差過大`);
        return rs;
    };
    let rs = chk([1, -6, 11, -6]);   // 1 2 3
    assert.ok([1, 2, 3].every((v, i) => Math.abs(rs[i][0] - v) < 1e-9 && rs[i][1] === 0));
    rs = chk([1, 0, 0, -1]);   // 三次方根單位根
    assert.equal(rs.filter(z => z[1] !== 0).length, 2); assert.ok(Math.abs(rs.find(z => z[1] === 0)[0] - 1) < 1e-9);
    rs = chk([2, -4, 2]);   // 重根 1（殘差仍很小）
    assert.ok(rs.every(z => Math.abs(z[0] - 1) < 1e-6));
    rs = chk([1, 0, 0, 0, -1]);   // x^4 = 1：±1, ±i
    assert.equal(rs.length, 4);
    rs = chk([1, 0, 1]); assert.deepEqual(rs.map(z => Math.abs(z[1])), [1, 1]);
    rs = chk([1, -3, 0, 0]);   // x^3 - 3x^2：0, 0, 3
    assert.equal(rs.filter(z => z[0] === 0 && z[1] === 0).length, 2);
    rs = chk([0, 0, 3, -6]);   // 前導 0 略過：x = 2
    assert.equal(rs.length, 1); assert.ok(Math.abs(rs[0][0] - 2) < 1e-12);
    chk([1, -10, 35, -50, 24]);   // 1 2 3 4
    chk([1, -1, 1, -1, 1, -1, 1, -1, 1, -1]);   // 9 次
    chk([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1024]);   // 10 次
    chk([0.001, 1, 1000]);
    // 偽隨機：3–7 次，係數 -9..9
    for (let k = 0; k < 40; k++) {
        const deg = 3 + (k % 5), cs = [rnd() || 1]; for (let i = 0; i < deg; i++) cs.push(rnd());
        chk(cs, 1e-8);
    }
    assert.throws(() => m.polyRoots([0, 0, 0]), /最高次/);
    assert.throws(() => m.polyRoots([5]), /最高次/);
    assert.throws(() => m.polyRoots(Array(12).fill(1)), /10 次/);
    assert.throws(() => m.polyRoots([1, NaN]), /有限/);
}
ok('t3 polyRoots');

// ---- 數值解 ----
{
    const f = m.eqFn('x^2 = 2');
    assert.equal(f(3), 7);
    const rs = m.findRoots(f, -5, 5);
    assert.equal(rs.length, 2); assert.ok(Math.abs(rs[0] + Math.SQRT2) < 1e-10 && Math.abs(rs[1] - Math.SQRT2) < 1e-10);
    assert.equal(m.eqFn('y = x - 1')(4), 3);
    assert.equal(m.eqFn('x^2 - 4')(3), 5);
    const tr = []; m.findRoots(m.eqFn('x^3 - 2x - 5'), -10, 10, tr);
    assert.ok(tr.length >= 5 && tr[0].startsWith('#1'));
    const c = m.findRoots(m.eqFn('cos(x) = x'), -10, 10); assert.equal(c.length, 1); assert.ok(Math.abs(c[0] - 0.7390851332151607) < 1e-9);
    assert.equal(m.findRoots(m.eqFn('1/x'), -1, 1).length, 0, '漸近線不是根');
    assert.equal(m.findRoots(m.eqFn('x^2 + 1'), -5, 5).length, 0);
    assert.equal(m.findRoots(m.eqFn('x'), -1, 1).length, 1, '恰好落在取樣點的根');
    assert.equal(m.findRoots(m.eqFn('sin(x)'), -10, 10).length, 7);
    assert.ok(m.findRoots(m.eqFn('x^3 - 2x - 5'), -10, 10).every(r => Math.abs(m.eqFn('x^3 - 2x - 5')(r)) < 1e-9));
    const n = m.newton(m.eqFn('x^2 - 2'), 1); assert.ok(n.ok && Math.abs(n.x - Math.SQRT2) < 1e-12 && n.rows.length >= 3);
    assert.ok(m.newton(m.eqFn('x^3 - 2x - 5'), 2).ok);
    assert.equal(m.newton(m.eqFn('x^2 + 1'), 1).ok, false);
    assert.equal(m.newton(m.eqFn('x^2'), 0).ok, false, '導數為 0');
    assert.throws(() => m.eqFn('x = = 1'), /只能有一個/);
    assert.throws(() => m.eqFn('x = '), /請輸入/);
    assert.throws(() => m.eqFn('foo(x)'), /未知/);
    assert.throws(() => m.eqFn('eval(1)'), /未知/);
}
ok('t3 numeric solve');
