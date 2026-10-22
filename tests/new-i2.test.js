// i2 批次：loan-calculator 的債務 / 購屋與租屋純函式
const { load, ok, near } = require('./_load');
const assert = require('assert');
const L = load('utils/loan-calculator.html', 'amortize, pmtOf, nperOf, simPay, balAfter, ccRevolve, installmentIRR, snowAvalanche, prepay, refinance, studentLoan, affordability, rentalYield, parseD, prorate, leaseSettle');
const D = (s) => L.parseD(s);

{ // 攤還公式往返：月付 / 期數 / 餘額
    near(L.pmtOf(1e6, 2.2, 240), 5154.0, 1); near(L.pmtOf(1e6, 2.2, 240), L.amortize(1e6, 2.2, 240).rows[0].payment, 1e-6);
    near(L.pmtOf(1200, 0, 12), 100); assert.ok(Number.isNaN(L.pmtOf(1, 1, 0)));
    near(L.nperOf(1e6, 2.2, L.pmtOf(1e6, 2.2, 240)), 240, 1e-6); near(L.nperOf(1200, 0, 100), 12);
    assert.strictEqual(L.nperOf(1e6, 12, 9999), Infinity); assert.strictEqual(L.nperOf(1e6, 12, 10000), Infinity); assert.strictEqual(L.nperOf(0, 5, 1), 0);
    near(L.balAfter(1e6, 2.2, 240, 0), 1e6, 1e-6); near(L.balAfter(1e6, 2.2, 240, 240), 0, 1e-4);
    near(L.balAfter(1e6, 2.2, 240, 60), L.amortize(1e6, 2.2, 240).rows[59].balance, 1e-4); near(L.balAfter(1200, 0, 12, 6), 600);
    const s = L.simPay(1e6, 2.2, L.pmtOf(1e6, 2.2, 240)); assert.strictEqual(s.months, 240); near(s.interest, L.amortize(1e6, 2.2, 240).totalInterest, 1e-3);
    assert.strictEqual(L.simPay(1e6, 12, 5000).months, Infinity);
    ok('攤還公式往返');
}
{ // 信用卡循環
    const r = L.ccRevolve(10000, 0, 10, 0); assert.strictEqual(r.totalInterest, 0); assert.ok(r.months > 50);
    const f = L.ccRevolve(1200, 0, 0, 100); assert.strictEqual(f.months, 12); assert.strictEqual(f.totalInterest, 0);
    const a = L.ccRevolve(50000, 15, 5, 500); assert.ok(!a.never && a.totalInterest > 0 && a.months > 36);
    near(a.firstPay, 2500); near(a.firstInterest, 625);
    const n = L.ccRevolve(100000, 24, 1, 0); assert.ok(n.never); assert.strictEqual(n.totalInterest, Infinity);
    const g = L.ccRevolve(100000, 12, 1, 0); assert.ok(g.never);
    assert.ok(L.ccRevolve(1000, 15, 0, 5000).months === 1);
    ok('信用卡循環');
}
{ // 分期實質利率（IRR 驗證）
    const r = L.installmentIRR(30000, 2500, 12, 0); near(r.nominal, 0, 1e-3); assert.strictEqual(r.extra, 0);
    const z = L.installmentIRR(30000, 2500, 12, 600); assert.ok(z.nominal > 3 && z.effective > z.nominal);
    let pv = 0; for (let k = 1; k <= 12; k++) pv += 2500 / Math.pow(1 + z.monthly, k); near(pv, 29400, 1e-4); near(z.extra, 600);
    const k = L.installmentIRR(100000, L.pmtOf(100000, 12, 24), 24, 0); near(k.nominal, 12, 1e-6); near(k.monthly, 0.01, 1e-9);
    near(k.effective, (Math.pow(1.01, 12) - 1) * 100, 1e-6);
    assert.ok(Number.isNaN(L.installmentIRR(1000, 100, 12, 1000).nominal)); assert.ok(Number.isNaN(L.installmentIRR(1000, 0, 12).nominal));
    assert.ok(L.installmentIRR(1000, 50, 12).nominal < 0);
    ok('分期實質利率 IRR');
}
{ // 雪球 vs 雪崩
    const ds = [{ name: 'A', bal: 50000, rate: 15, min: 1500 }, { name: 'B', bal: 200000, rate: 8, min: 4000 }, { name: 'C', bal: 20000, rate: 5, min: 2000 }];
    const s = L.snowAvalanche(ds, 5000, 'snow'), a = L.snowAvalanche(ds, 5000, 'aval');
    assert.ok(!s.never && !a.never); assert.ok(a.totalInterest <= s.totalInterest + 1e-6);
    assert.strictEqual(s.order[0].name, 'C'); assert.strictEqual(a.order[0].name, 'A'); assert.strictEqual(s.order.length, 3);
    assert.ok(a.months <= s.months);
    const z = L.snowAvalanche([{ name: 'X', bal: 1000, rate: 0, min: 100 }, { name: 'Y', bal: 500, rate: 0, min: 50 }], 0, 'aval');
    assert.strictEqual(z.totalInterest, 0); assert.strictEqual(z.months, 10);
    const one = L.snowAvalanche([{ name: 'X', bal: 1e6, rate: 2.2, min: L.pmtOf(1e6, 2.2, 240) }], 0, 'snow'); near(one.totalInterest, L.amortize(1e6, 2.2, 240).totalInterest, 1e-3);
    assert.ok(L.snowAvalanche([{ name: 'X', bal: 1e6, rate: 20, min: 100 }], 0, 'snow').never);
    assert.ok(!L.snowAvalanche([{ name: 'X', bal: 1e5, rate: 20, min: 100 }], 5000, 'aval').never);
    assert.ok(L.snowAvalanche(ds, 10000, 'aval').totalInterest < a.totalInterest);
    assert.strictEqual(L.snowAvalanche([{ name: 'X', bal: 0, rate: 5, min: 0 }], 0, 'snow').months, 0);
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let t = 0; t < 40; t++) {
        const d = [0, 1, 2, 3].map(i => ({ name: 'D' + i, bal: 1000 + Math.floor(rnd() * 200000), rate: Math.floor(rnd() * 25), min: 0 })); d.forEach(x => x.min = Math.round(x.bal * 0.02));
        assert.ok(L.snowAvalanche(d, 3000, 'aval').totalInterest <= L.snowAvalanche(d, 3000, 'snow').totalInterest + 1e-6, 'case ' + t);
    }
    ok('雪球 / 雪崩');
}
{ // 提前還款
    const r = L.prepay(1e7, 2.2, 30, 60, 1e6, 0), n = 360, pay = L.pmtOf(1e7, 2.2, n);
    near(r.bal, L.amortize(1e7, 2.2, n).rows[59].balance, 1e-3); near(r.pay, pay);
    near(r.baseInterest, L.amortize(1e7, 2.2, n).rows.slice(60).reduce((s, x) => s + x.interest, 0), 1e-2);
    assert.ok(r.shorten.months < 300 && r.shorten.saved > 0 && r.lower.saved > 0 && r.lower.pay < pay);
    assert.ok(r.shorten.saved >= r.lower.saved - 1e-6);
    near(r.lower.saved, r.baseInterest - L.amortize(r.bal - 1e6, 2.2, 300).totalInterest, 1e-2);
    const f = L.prepay(1e7, 2.2, 30, 60, 1e6, 1); near(r.shorten.saved - f.shorten.saved, 1e4, 1e-6);
    const z = L.prepay(1.2e6, 0, 10, 0, 120000, 0); assert.strictEqual(z.baseInterest, 0); assert.strictEqual(z.shorten.months, 108); assert.strictEqual(z.shorten.saved, 0);
    ok('提前還款');
}
{ // 轉貸
    const r = L.refinance(8e6, 2.6, 240, 2.2, 240, 30000);
    near(r.oldPay, L.pmtOf(8e6, 2.6, 240)); near(r.saving, r.oldPay - r.newPay); near(r.breakeven, 30000 / r.saving); near(r.total, r.saving * 240 - 30000, 1e-6);
    assert.strictEqual(L.refinance(8e6, 2.2, 240, 2.6, 240, 0).breakeven, null);
    const z = L.refinance(120000, 0, 12, 0, 12, 600); assert.strictEqual(z.saving, 0); assert.strictEqual(z.breakeven, null);
    ok('房貸轉貸');
}
{ // 就學貸款
    const a = L.studentLoan(400000, 1.5, 12, 8, true); near(a.graceMonthly, 500); near(a.graceInterest, 6000); assert.strictEqual(a.balAfterGrace, 400000); near(a.pay, L.pmtOf(4e5, 1.5, 96));
    near(a.totalInterest, 6000 + a.pay * 96 - 4e5, 1e-6);
    const b = L.studentLoan(400000, 1.5, 12, 8, false); near(b.balAfterGrace, 4e5 * Math.pow(1.00125, 12), 1e-6); assert.ok(b.pay > a.pay); near(b.totalInterest, b.pay * 96 - 4e5, 1e-6);
    const z = L.studentLoan(120000, 0, 12, 1, false); near(z.pay, 10000); assert.strictEqual(z.totalInterest, 0);
    ok('就學貸款');
}
{ // 購屋能力
    const a = L.affordability(90000, 0, 100 / 3, 2.2, 30, 2e6);
    near(a.maxPay, 30000, 1e-6); near(L.pmtOf(a.loan, 2.2, 360), 30000, 1e-6); near(a.price, a.loan + 2e6); near(a.ltv, a.loan / a.price * 100);
    assert.strictEqual(L.affordability(30000, 20000, 33, 2, 30, 1e6).loan, 0);
    near(L.affordability(50000, 0, 40, 0, 10, 0).loan, 20000 * 120); assert.strictEqual(L.affordability(50000, 0, 40, 0, 10, 0).ltv, 100);
    assert.strictEqual(L.affordability(30000, 20000, 33, 2, 30, 0).ltv, 0);
    ok('購屋能力');
}
{ // 租金投報率
    const r = L.rentalYield(1.2e7, 30000, 0, 0, 0, 0); near(r.grossYield, 3); near(r.netYield, 3); near(r.payback, 1.2e7 / 360000);
    const n = L.rentalYield(1.2e7, 30000, 8, 10, 30000, 20000); near(n.noi, 360000 * 0.92 * 0.9 - 50000, 1e-6); assert.ok(n.netYield < n.grossYield);
    const neg = L.rentalYield(1e7, 10000, 0, 0, 200000, 0); assert.ok(neg.netYield < 0 && neg.payback === null);
    ok('租金投報率');
}
{ // 日期 / 按日計租 / 退租結算
    assert.ok(Number.isNaN(D('2026-02-30'))); assert.ok(Number.isNaN(D('')) && Number.isNaN(D('abc')) && !Number.isNaN(D('2024-02-29')) && Number.isNaN(D('2026-02-29')));
    near(L.prorate(30000, D('2026-03-01'), D('2026-03-31')).amount, 30000); assert.strictEqual(L.prorate(30000, D('2026-03-01'), D('2026-03-31')).days, 31);
    near(L.prorate(30000, D('2026-02-01'), D('2026-02-14')).amount, 15000);
    near(L.prorate(31000, D('2026-03-16'), D('2026-03-31')).amount, 16000);
    near(L.prorate(30000, D('2026-01-16'), D('2026-02-14')).amount, 30000 * 16 / 31 + 15000, 1e-6);
    assert.strictEqual(L.prorate(30000, D('2026-03-05'), D('2026-03-04')).days, 0);
    assert.strictEqual(L.prorate(30000, D('2024-12-20'), D('2025-01-10')).days, 22);
    const a = L.leaseSettle(31000, 62000, D('2026-03-15'), D('2026-03-31'), 0); near(a.owed, 16000); near(a.refund, 62000 - a.owed);
    const b = L.leaseSettle(28000, 56000, D('2026-02-28'), D('2026-02-14'), 1000); near(b.credit, 14000); near(b.refund, 56000 + 14000 - 1000);
    const c = L.leaseSettle(20000, 40000, D('2026-03-31'), D('2026-03-31'), 0); assert.strictEqual(c.owed + c.credit, 0); assert.strictEqual(c.refund, 40000);
    assert.ok(L.leaseSettle(20000, 0, D('2026-03-01'), D('2026-03-31'), 5000).refund < 0);
    ok('日期 / 按日計租 / 退租結算');
}
