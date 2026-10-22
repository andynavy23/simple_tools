// 批次 i1：finance-calc（理財規劃計算）純邏輯，已知答案對照
const assert = require('assert');
const { load, ok, near } = require('./_load');
const m = load('utils/finance-calc.html', 'tvSolve, rule72, rateToDouble, npv, cagr, irr, xirr, parseList, parseDated, parsePay, policyFlows, installmentRate, fxDeposit, dca, inflFuture, inflPast, fire, emergency, bondPrice, bondYield, forecast, cleanCf, cleanOpts');

// 時間價值：標準公式
near(m.tvSolve('fv', { rate: .05, n: 10, pv: 100000 }), 162889.46267, 1e-9);
near(m.tvSolve('fv', { rate: .05, n: 10, pv: 100000, pmt: 10000 }), 100000 * 1.05 ** 10 + 10000 * (1.05 ** 10 - 1) / .05, 1e-9);
near(m.tvSolve('fv', { rate: .05, n: 10, pmt: 10000, type: 1 }), 10000 * 1.05 * (1.05 ** 10 - 1) / .05, 1e-9);
near(m.tvSolve('fv', { rate: 0, n: 10, pv: 100, pmt: 10 }), 200);
near(m.tvSolve('fv', { rate: -.02, n: 5, pv: 1000 }), 1000 * .98 ** 5, 1e-9);
assert.strictEqual(m.tvSolve('fv', { rate: -1, n: 5, pv: 1 }), null);
near(m.tvSolve('fv', { rate: .05, n: 0, pv: 1000, pmt: 50 }), 1000);                       // 期數 0
// 往返：任求一個再代回
for (const type of [0, 1]) for (const rate of [0, .005, .05, -.01]) {
    const base = { rate, n: 24, pv: 5000, pmt: 300, type }, fv = m.tvSolve('fv', base);
    near(m.tvSolve('pv', { ...base, pv: 0, fv }), 5000, 1e-8);
    near(m.tvSolve('pmt', { ...base, pmt: 0, fv }), 300, 1e-8);
    near(m.tvSolve('n', { ...base, n: 0, fv }), 24, 1e-7);
    near(m.tvSolve('rate', { ...base, rate: 0, fv }), rate, 1e-7);
}
near(m.tvSolve('n', { rate: .05, pv: 1, fv: 2 }), Math.log(2) / Math.log(1.05), 1e-9);
assert.strictEqual(m.tvSolve('n', { rate: .05, pv: 1, fv: -2 }), null);
assert.strictEqual(m.tvSolve('n', { rate: 0, pv: 1, fv: 2, pmt: 0 }), null);
assert.strictEqual(m.tvSolve('rate', { n: 0, pv: 1, fv: 2 }), null);
const big = m.tvSolve('fv', { rate: .05, n: 1e4, pv: 1 }); assert.ok(big === null || big > 1e200);   // 巨大值不當機
assert.ok(m.tvSolve('fv', { rate: .5, n: 100, pv: 1e12 }) > 1e12);

// 72 法則
let r = m.rule72(6); near(r.approx, 12); near(r.exact, 11.8957, 1e-4); assert.ok(Math.abs(r.approx - r.exact) < .2);
assert.strictEqual(m.rule72(0), null); near(m.rateToDouble(10), 2 ** .1 - 1); assert.strictEqual(m.rateToDouble(0), null);

// NPV / CAGR
near(m.npv(.1, [-1000, 500, 500, 500]), -1000 + 500 / 1.1 + 500 / 1.21 + 500 / 1.331);
near(m.npv(0, [-100, 50, 60]), 10);
near(m.cagr(100, 200, 10), 2 ** .1 - 1); near(m.cagr(100, 0, 3), -1); assert.strictEqual(m.cagr(0, 1, 1), null); assert.strictEqual(m.cagr(1, 1, 0), null);

// IRR
let rs = m.irr([-1000, 300, 400, 500]); assert.strictEqual(rs.length, 1); near(rs[0], 0.0889, 1e-3);
near(m.npv(rs[0], [-1000, 300, 400, 500]), 0, 1e-6);
near(m.irr([-100, 110])[0], .1, 1e-9); near(m.irr([-100, 50, 50])[0], 0, 1e-9);
assert.ok(m.irr([-100, 40, 40])[0] < 0);
assert.deepStrictEqual(m.irr([100, 200]), []); assert.deepStrictEqual(m.irr([-100, -5]), []);
rs = m.irr([-100, 230, -132]); assert.strictEqual(rs.length, 2); near(rs[0], .1, 1e-6); near(rs[1], .2, 1e-6);   // 多解
assert.strictEqual(m.irr([-1, 50]).length, 1);

// XIRR：Excel 說明範例（結果 0.373362535）
const D = (s) => { const [y, mo, d] = s.split('-').map(Number); return Date.UTC(y, mo - 1, d); };
const ex = [['2008-01-01', -10000], ['2008-03-01', 2750], ['2008-10-30', 4250], ['2009-02-15', 3250], ['2009-04-01', 2750]].map(([d, v]) => ({ t: D(d), v }));
near(m.xirr(ex)[0], 0.373362535, 1e-6);
near(m.xirr([{ t: D('2020-01-01'), v: -100 }, { t: D('2021-01-01'), v: 110 }])[0], 1.1 ** (365 / 366) - 1, 1e-6);   // 366 天 / 365
assert.deepStrictEqual(m.xirr([{ t: 0, v: 5 }, { t: 864e5, v: 5 }]), []);

// 解析
assert.deepStrictEqual(m.parseList('-1000, 300\n400;500'), [-1000, 300, 400, 500]); assert.strictEqual(m.parseList('1,000x'), null); assert.strictEqual(m.parseList(''), null);
assert.ok(m.parseDated('2024-02-30 100\n2024-03-01 -5').err.includes('第 1 行')); assert.strictEqual(m.parseDated('2024-01-01 100').err, '至少需要兩行');
assert.strictEqual(m.parseDated('2024/1/5, -100\n2024-3-1 120').rows.length, 2);
assert.deepStrictEqual(m.parsePay('10 620000\n15,100000'), [{ y: 10, amt: 620000 }, { y: 15, amt: 100000 }]); assert.strictEqual(m.parsePay('0 5'), null); assert.strictEqual(m.parsePay('x'), null);

// 儲蓄險：繳 2 年各 100、第 3 年底領 250
assert.deepStrictEqual(m.policyFlows(100, 2, [{ y: 3, amt: 250 }]), [-100, -100, 0, 250]);
near(m.npv(m.irr([-100, -100, 0, 250])[0], [-100, -100, 0, 250]), 0, 1e-6);

// 年繳月繳隱含利率：用已知月利率造一筆，反推
{
    const j = .01, A = 1000, mm = A / ((1 + j) * (1 - (1 + j) ** -12) / j), x = m.installmentRate(A, mm, 12);
    near(x.period, j, 1e-7); near(x.nominal, .12, 1e-6); near(x.effective, 1.01 ** 12 - 1, 1e-6);
    assert.ok(Math.abs(m.installmentRate(1000, 1000 / 12, 12).nominal) < 1e-6);                  // 分期不加價 → 約 0
}

// 外幣定存
{
    const x = m.fxDeposit({ principal: 315000, buy: 31.5, sell: 31.5, ratePct: 4, days: 365, fee: 0 });
    near(x.f0, 10000); near(x.f1, 10400); near(x.back, 327600); near(x.annual, .04, 1e-9); near(x.breakEven, 315000 / 10400, 1e-9);
    const y = m.fxDeposit({ principal: 315000, buy: 31.5, sell: 30, ratePct: 4, days: 365, fee: 100 }); near(y.back, 10400 * 30 - 100); assert.ok(y.pnl < 0);
    assert.strictEqual(m.fxDeposit({ principal: 0, buy: 1, sell: 1, ratePct: 1, days: 1 }), null);
    near(m.fxDeposit({ principal: 1000, buy: 1, sell: 1, ratePct: 0, days: 10, twdPct: 3.65 }).twdInterest, 1);
}

// 定期定額
{
    const s = m.dca(10000, 6, 20, 0), l = s[20]; near(l.invested, 2400000);
    near(l.value, m.tvSolve('fv', { rate: .005, n: 240, pmt: 10000 }), 1e-9); assert.strictEqual(s.length, 21);
    near(m.dca(100, 0, 3, 50)[3].value, 50 + 3600);
}
near(m.inflFuture(100, 2, 10), 100 * 1.02 ** 10); near(m.inflPast(m.inflFuture(777, 3, 7), 3, 7), 777);

// FIRE
{
    let f = m.fire(1e7, 4, 0, 0, 40); assert.strictEqual(f.w1, 4e5); assert.strictEqual(f.depletedYear, 26); near(f.series[25], 0, 1e-9); assert.strictEqual(f.series.length, 27);
    f = m.fire(1e7, 4, 0, 0, 25); assert.strictEqual(f.depletedYear, null);
    f = m.fire(1e7, 4, 2, 5, 40); assert.strictEqual(f.depletedYear, null);
    f = m.fire(1e7, 4, 3, 0, 30); assert.ok(f.depletedYear < 26);
    assert.strictEqual(m.fire(0, 4, 0, 0, 10), null); assert.strictEqual(m.fire(100, 0, 0, 0, 10), null);
}
assert.deepStrictEqual(m.emergency(40000, 'normal', false), { months: 6, amount: 240000 }); assert.strictEqual(m.emergency(40000, 'risky', true).months, 13);
assert.strictEqual(m.emergency(0, 'normal', false), null); assert.strictEqual(m.emergency(1, 'zzz', false), null);

// 債券
near(m.bondPrice(100, 5, 5, 10, 2), 100, 1e-12);                                               // 票面 = 殖利率 → 平價
near(m.bondPrice(100, 0, 5, 10, 1), 100 / 1.05 ** 10, 1e-12);                                  // 零息債
near(m.bondPrice(100, 5, 0, 10, 1), 150, 1e-12);                                               // 殖利率 0
{
    const p = m.bondPrice(100, 6, 4, 5, 2); near(p, 6 / 2 * (1 - 1.02 ** -10) / .02 + 100 / 1.02 ** 10, 1e-12); assert.ok(p > 100);
    near(m.bondYield(100, 6, p, 5, 2), 4, 1e-6);
    for (const [c, y, yrs, q] of [[2, 3, 10, 2], [0, 1.5, 7, 1], [8, 12, 3, 4], [3, -0.5, 4, 1]]) near(m.bondYield(1000, c, m.bondPrice(1000, c, y, yrs, q), yrs, q), y, 1e-6);
}
assert.strictEqual(m.bondPrice(100, 5, 5, 2.3, 2), null); assert.strictEqual(m.bondPrice(100, 5, NaN, 2, 2), null); assert.strictEqual(m.bondYield(100, 5, 0, 5, 1), null);

// 現金流
{
    const items = [{ id: 1, name: '薪', kind: 'm', amt: 50000, from: 1, to: 0 }, { id: 2, name: '房租', kind: 'm', amt: -30000, from: 1, to: 3 }, { id: 3, name: '保費', kind: 'o', amt: -100000, from: 2, to: 0 }];
    const f = m.forecast(10000, items, 6);
    assert.deepStrictEqual(f.bal, [10000, 30000, -50000, -30000, 20000, 70000, 120000]);
    assert.deepStrictEqual(f.gaps, [2, 3]); assert.strictEqual(f.min, -50000); assert.strictEqual(f.minMonth, 2);
}
// 載入驗證
{
    let c = m.cleanCf(null); assert.deepStrictEqual(c, { open: 0, months: 12, items: [] });
    c = m.cleanCf({ open: 'x', months: 7, items: [null, 5, { id: 1, name: 'a'.repeat(99), kind: 'zz', amt: 1e12, from: 1 }, { id: 2, name: 3, kind: 'o', amt: -5, from: 40 }, { id: 3, name: 'ok', kind: 'm', amt: -5, from: 5, to: 2 }, { id: 3, kind: 'm', amt: 1, from: 1 }, { id: 4, kind: 'o', amt: 7, from: 2, to: 9 }] });
    assert.strictEqual(c.open, 0); assert.strictEqual(c.months, 12); assert.deepStrictEqual(c.items.map(x => [x.id, x.to, x.kind]), [[3, 0, 'm'], [4, 0, 'o']]);
    const many = Array.from({ length: 150 }, (_, i) => ({ id: i + 1, kind: 'm', amt: 1, from: 1 })); assert.strictEqual(m.cleanCf({ items: many }).items.length, 100);
    assert.strictEqual(m.cleanCf({ months: 36, open: -5 }).months, 36); assert.strictEqual(m.cleanCf({ open: 1e11 }).open, 0);
}
assert.deepStrictEqual(m.cleanOpts({ tab: 'bond' }), { tab: 'bond' }); assert.deepStrictEqual(m.cleanOpts({ tab: 'x' }), { tab: 'tv' }); assert.deepStrictEqual(m.cleanOpts(null), { tab: 'tv' });
ok('i1 finance-calc 純邏輯');
