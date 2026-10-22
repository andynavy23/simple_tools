// 批次 i3：stock-cost 進階試算、income-tax 進階估算（手算驗證）
const { load, ok, near } = require('./_load');
const assert = require('assert');
{
    const m = load('utils/stock-cost.html', 'DEFAULTS, exDividend, averageDown, marginLong, marginShort, dayTradeCompare, etfDividend, feeImpact, valuation, breakEven, trade');
    const o = m.DEFAULTS;
    let r = m.exDividend(100, 3, 1, 1000, 0);
    near(r.ref, 97 / 1.1); near(r.yieldPct, 3); assert.equal(r.newShares, 1100); assert.equal(r.cashGot, 3000);
    near(r.newAvg, 100000 / 1100); near(r.newAvgNet, 97000 / 1100); near(r.fillPct, (100 / (97 / 1.1) - 1) * 100);
    assert.equal(m.exDividend(100, 100, 0, 1, 0), null); assert.equal(m.exDividend(0, 1, 0, 1, 0), null); assert.equal(m.exDividend(100, -1, 0, 1, 0), null);
    assert.equal(m.exDividend(100, 0, 0, 1000, 80).newAvg, 80);
    // 攤平：180,114 / 2000；回本價滿足淨損益 >= 0 且低 0.01 就 < 0
    r = m.averageDown(1000, 100, 80, 1000, o);
    assert.equal(r.total, 180114); near(r.avg, 90.057); assert.ok(r.be > 90.4 && r.be < 90.5);
    const net = (p) => { const a = Math.round(p * 2000); return a - Math.max(20, Math.floor(a * 0.1425 / 100)) - Math.floor(a * 0.003) - 180114; };
    const bp = Math.ceil(r.be * 100 - 1e-6) / 100;
    assert.ok(net(bp) >= 0 && net(bp - 0.01) < 0);
    assert.equal(m.averageDown(0, 0, 50, 1000, o).drop, 0); assert.equal(m.averageDown(1000, 100, 0, 1, o), null);
    // 融資
    r = m.marginLong(100, 1000, 60, 6.5, 30, 130, 110, o);
    assert.deepEqual([r.amt, r.loan, r.fee, r.own, r.interest], [100000, 60000, 142, 40142, 321]);
    near(r.ratioNow, 166.6667, 1e-5); near(r.callPrice, 78); assert.equal(r.net, 110000 - 156 - 330 - 100000 - 142 - 321);
    assert.equal(m.marginLong(100, 1000, 100, 6, 1, 130, 0, o), null); assert.equal(m.marginLong(100, 1000, 60, 6, 1, 130, 0, o).net, null);
    // 融券
    r = m.marginShort(100, 1000, 90, 0.08, 130, 90, o);
    assert.deepEqual([r.fee, r.tax, r.borrow, r.collateral, r.margin], [142, 300, 80, 99478, 90000]);
    near(r.ratioNow, 189.478); near(r.callPrice, 189478 / 1300); assert.equal(r.net, 99478 - 90000 - 128);
    // 當沖
    r = m.dayTradeCompare(100, 101, 1000, 0.15, o);
    assert.equal(r.day.tax, 151); assert.equal(r.normal.tax, 303); assert.equal(r.saved, 152);
    // ETF 配息
    assert.deepEqual(m.etfDividend(20000, 0, 0, o, 10, 20000), { gross: 20000, nhi: 422, wh: 0, net: 19578 });
    assert.deepEqual(m.etfDividend(0, 30000, 5000, o, 10, 20000), { gross: 35000, nhi: 633, wh: 3000, net: 31367 });
    assert.equal(m.etfDividend(19999, 0, 0, o, 10, 20000).nhi, 0); assert.equal(m.etfDividend(1e8, 0, 0, o, 10, 20000).nhi, 211000);
    assert.equal(m.etfDividend(0, 0, 0, o, 10, 0), null);
    // 費用
    r = m.feeImpact(100, 1, 5, { ter: 0, load: 0 }, { ter: 1, load: 1 });
    near(r.A, 105); near(r.B, 99 * 1.04); near(r.diff, 105 - 102.96);
    assert.equal(m.feeImpact(100, 1, 5, { ter: -1, load: 0 }, { ter: 0, load: 0 }), null); assert.equal(m.feeImpact(100, 1, 5, { ter: 0, load: 100 }, { ter: 0, load: 0 }), null);
    // 估值
    r = m.valuation({ price: 100, eps: 6, peLo: 12, peHi: 18, bvps: 50, pbLo: 1, pbHi: 2, d0: 4, g: 3, r: 8 });
    assert.deepEqual(r.pe, [72, 108]); assert.deepEqual(r.pb, [50, 100]); near(r.ddm, 82.4); near(r.curPE, 100 / 6); near(r.curPB, 2);
    assert.equal(m.valuation({ eps: 6, peLo: 1, peHi: 2, d0: 4, g: 8, r: 8 }).ddm, null);
    assert.equal(m.valuation({ eps: 0, bvps: NaN, d0: 4, g: 3, r: 8 }).pe, null);
    ok('i3 stock-cost: 股利 / 攤平 / 融資融券 / 當沖 / ETF 配息 / 費用 / 估值');
}
{
    const m = load('utils/income-tax.html', 'TAX, computeTax, pensionSaving, dividendCompare, bonusTax, dependentCheck');
    const base = { salary: 900000 };
    assert.equal(m.computeTax(base).tax, 22700); assert.equal(m.computeTax(base, m.TAX, 0).tax, 22700);
    let r = m.pensionSaving(base, 50000, 6); assert.deepEqual([r.amount, r.before, r.after, r.saved], [36000, 22700, 20900, 1800]);
    r = m.pensionSaving(base, 50000, 10); assert.equal(r.amount, 36000);
    r = m.pensionSaving(base, 999999, 6); assert.equal(r.amount, 150000 * 0.06 * 12);
    assert.equal(m.pensionSaving(base, 0, 6).saved, 0);
    r = m.pensionSaving({ salary: 3000000 }, 150000, 6); assert.equal(r.before, 363100); assert.equal(r.saved, Math.round(108000 * 0.2));
    // 股利
    r = m.dividendCompare(base, 100000); assert.deepEqual([r.mergedTax, r.credit, r.sepTax, r.nhi, r.better, r.diff], [19200, 8500, 50700, 2110, 'merged', 31500]);
    r = m.dividendCompare({ salary: 3000000 }, 1000000); assert.deepEqual([r.baseTax, r.mergedTax, r.sepTax, r.better], [363100, 572500, 643100, 'merged']);
    r = m.dividendCompare({ salary: 10000000 }, 1000000); assert.deepEqual([r.baseTax, r.mergedTax, r.sepTax, r.better, r.diff], [2909900, 3229900, 3189900, 'sep', 40000]);
    r = m.dividendCompare(base, 19999); assert.equal(r.nhi, 0);
    // 獎金
    r = m.bonusTax(base, 100000, 40000); assert.deepEqual([r.extraTax, r.nhi, r.net], [5000, 0, 95000]);
    r = m.bonusTax(base, 100000, 20000); assert.deepEqual([r.nhi, r.net], [Math.round(20000 * 0.0211), 100000 - 5000 - 422]);
    r = m.bonusTax({ salary: 0 }, 100000, 0); assert.equal(r.extraTax, 0);
    assert.equal(m.bonusTax(base, 0, 0).net, 0);
    // 扶養
    assert.equal(m.dependentCheck({ rel: 'parent', age: 65 }).amount, 97000);
    assert.equal(m.dependentCheck({ rel: 'parent', age: 70 }).amount, 145500);
    assert.equal(m.dependentCheck({ rel: 'parent', age: 59 }).ok, false); assert.equal(m.dependentCheck({ rel: 'parent', age: 59, disabled: true }).ok, true);
    assert.equal(m.dependentCheck({ rel: 'child', age: 19 }).ok, true); assert.equal(m.dependentCheck({ rel: 'child', age: 22 }).ok, false);
    assert.equal(m.dependentCheck({ rel: 'child', age: 22, inSchool: true }).ok, true);
    assert.equal(m.dependentCheck({ rel: 'sibling', age: 10 }).ok, true); assert.ok(m.dependentCheck({ rel: 'sibling', age: 10 }).why.length);
    assert.equal(m.dependentCheck({ rel: 'other', age: 10 }).ok, false); assert.equal(m.dependentCheck({ rel: 'other', age: 10, cohabit: true }).ok, true);
    assert.equal(m.dependentCheck({ rel: 'child', age: NaN }).ok, false);
    ok('i3 income-tax: 勞退自提 / 股利 / 獎金 / 扶養');
}
