// i6 批次：biz-calc（商業計算）與 quote-gen（報價單）的純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

{
    const B = load('utils/biz-calc.html', 'rd, pricing, bep, taxSplit, shopProfit, deliveryProfit, volWeight, specCheck, adMetrics, adBreakEven, funnel, normCdf, normInv, abTest, sampleSize, newsletter, normOpts');
    // 定價
    let p = B.pricing('margin', 100, NaN, 40); near(p.price, 166.6666667); near(p.markup, 66.6666667); near(p.margin, 40);
    p = B.pricing('markup', 100, NaN, 50); near(p.price, 150); near(p.margin, 33.3333333);
    p = B.pricing('price', 60, 100, NaN); near(p.margin, 40); near(p.markup, 66.6666667);
    p = B.pricing('cost', NaN, 200, 25); near(p.cost, 150);
    assert.strictEqual(B.pricing('margin', 100, NaN, 100), null); assert.strictEqual(B.pricing('margin', NaN, NaN, 10), null); assert.strictEqual(B.pricing('price', 5, 0, NaN), null);
    // BEP
    let b = B.bep(50000, 300, 500, 0); assert.strictEqual(b.units, 250); assert.strictEqual(b.revenue, 125000); near(b.cmRatio, 40);
    assert.strictEqual(B.bep(1000, 3, 10, 0).units, 143); assert.strictEqual(B.bep(1000, 3, 10, 400).units, 200);
    assert.strictEqual(B.bep(1000, 10, 10, 0), null); assert.strictEqual(B.bep(1000, 12, 10, 0), null);
    // 稅
    assert.deepStrictEqual(B.taxSplit(1050, 'incl', 5, 'round'), { net: 1000, tax: 50, total: 1050 });
    assert.deepStrictEqual(B.taxSplit(1000, 'excl', 5, 'round'), { net: 1000, tax: 50, total: 1050 });
    for (const net of [1, 7, 99, 100, 333, 12345, 99999]) { const t = B.taxSplit(net, 'excl', 5, 'round'), r = B.taxSplit(t.total, 'incl', 5, 'round'); assert.strictEqual(r.net, net, 'round-trip ' + net); assert.strictEqual(r.tax, t.tax); }
    assert.deepStrictEqual(B.taxSplit(100, 'incl', 5, 'floor'), { net: 95, tax: 5, total: 100 });
    assert.deepStrictEqual(B.taxSplit(100, 'incl', 5, 'ceil'), { net: 96, tax: 4, total: 100 });
    assert.strictEqual(B.taxSplit(10, 'excl', 5, 'round').tax, 1);
    assert.strictEqual(B.taxSplit(10, 'excl', 5, 'floor').tax, 0); assert.strictEqual(B.taxSplit(10, 'excl', 5, 'ceil').tax, 1);
    near(B.taxSplit(100, 'excl', 5, 'none').tax, 5); assert.strictEqual(B.taxSplit(-1, 'incl', 5, 'round'), null);
    assert.strictEqual(B.rd(1.005, 'round'), 1); assert.strictEqual(B.rd(2.5, 'round'), 3);
    // 網店 / 外送
    let s = B.shopProfit(500, 250, 60, 5, 2.8, 0); near(s.plat, 25); near(s.pay, 14); near(s.profit, 151); near(s.margin, 30.2);
    near(B.shopProfit(s.breakeven, 250, 60, 5, 2.8, 0).profit, 0, 1e-9);
    s = B.shopProfit(100, 10, 0, 0, 0, 5); near(s.profit, 85); assert.strictEqual(B.shopProfit(100, 10, 0, 60, 40, 0), null);
    let d = B.deliveryProfit(200, 10, 30, 'before', 5, 70); near(d.net, 180); near(d.comm, 60); near(d.profit, 45);
    d = B.deliveryProfit(200, 10, 30, 'after', 5, 70); near(d.comm, 54); near(d.profit, 51); assert.strictEqual(B.deliveryProfit(200, 101, 30, 'after', 0, 0), null);
    // 材積
    let v = B.volWeight(40, 30, 20, 3, 6000, 0.5); near(v.vol, 4); assert.strictEqual(v.byVol, true); assert.strictEqual(v.bill, 4);
    v = B.volWeight(40, 30, 20, 7, 6000, 0.5); assert.strictEqual(v.byVol, false); assert.strictEqual(v.bill, 7);
    v = B.volWeight(50, 40, 30, 1, 6000, 0.5); near(v.vol, 10); assert.strictEqual(v.bill, 10);
    v = B.volWeight(31, 30, 20, 1, 6000, 0.5); near(v.vol, 3.1); assert.strictEqual(v.bill, 3.5); assert.strictEqual(B.volWeight(31, 30, 20, 1, 6000, 0).bill, 3.1);
    assert.strictEqual(B.volWeight(0, 1, 1, 1, 6000, 0), null); assert.strictEqual(B.volWeight(1, 1, 1, 1, 0, 0), null);
    // 規格
    assert.deepStrictEqual(B.specCheck(30, 20, 10, 2, { max: 45, sum: 105, kg: 5 }), []);
    assert.strictEqual(B.specCheck(50, 20, 10, 2, { max: 45, sum: 105, kg: 5 }).length, 1);
    assert.strictEqual(B.specCheck(50, 40, 30, 9, { max: 45, sum: 105, kg: 5 }).length, 3);
    assert.deepStrictEqual(B.specCheck(500, 500, 500, 99, { max: NaN, sum: NaN, kg: NaN }), []);
    assert.deepStrictEqual(B.specCheck(45, 30, 30, 5, { max: 45, sum: 105, kg: 5 }), []);
    // 廣告
    const a = B.adMetrics(100000, 2000, 20000, 80, 60000); near(a.ctr, 2); near(a.cpc, 10); near(a.cpm, 200); near(a.cvr, 4); near(a.cpa, 250); near(a.roas, 3);
    assert.ok(isNaN(B.adMetrics(0, 0, 100, NaN, NaN).cpc)); assert.ok(isNaN(B.adMetrics(NaN, 5, 10, 1, NaN).ctr));
    const e = B.adBreakEven(10, 4, 800, 35); near(e.cpa, 250); near(e.beRoas, 1 / 0.35); near(e.beCpa, 280);
    // 漏斗
    const f = B.funnel('訪客,10000\n加入購物車,1200\n結帳,600\n付款,420\n壞行\n,5');
    assert.strictEqual(f.rows.length, 4); near(f.rows[1].step, 12); near(f.rows[3].total, 4.2); assert.strictEqual(f.rows[1].lost, 8800); assert.strictEqual(f.worst, 1);
    assert.strictEqual(B.funnel('a,1,000\nb,500').rows[0].n, 1000); assert.strictEqual(B.funnel('').worst, -1);
    assert.strictEqual(B.funnel(Array.from({ length: 30 }, (_, i) => 's' + i + ',' + (100 - i)).join('\n')).rows.length, 20);
    // 常態分布已知值
    near(B.normCdf(0), 0.5); near(B.normCdf(1.96), 0.9750021048517795, 1e-9); near(B.normCdf(-1.96), 0.0249978951482205, 1e-9);
    near(B.normCdf(1), 0.8413447460685429, 1e-9); near(B.normCdf(3), 0.9986501019683699, 1e-9); near(B.normCdf(-4), 3.167124183311992e-5, 1e-9); near(B.normCdf(6), 0.9999999990134123, 1e-9);
    near(B.normInv(0.975), 1.959963984540054, 1e-9); near(B.normInv(0.5), 0, 1e-9); near(B.normInv(0.8), 0.8416212335729143, 1e-9); near(B.normInv(0.995), 2.5758293035489, 1e-9); near(B.normInv(0.001), -3.090232306167813, 1e-9);
    assert.ok(isNaN(B.normInv(0)) && isNaN(B.normInv(1)));
    near(2 * (1 - B.normCdf(1.96)), 0.04999579, 1e-6);
    // A/B：1000/100 vs 1000/130
    let t = B.abTest(1000, 100, 1000, 130, 0.95);
    near(t.pA, 0.1); near(t.pB, 0.13); near(t.z, 0.03 / Math.sqrt(0.115 * 0.885 * 0.002), 1e-9); near(t.z, 2.1027, 1e-3); near(t.p, 0.03548, 1e-2); assert.strictEqual(t.sig, true);
    assert.ok(t.ci[0] > 0 && t.ci[1] > t.ci[0] && Math.abs((t.ci[0] + t.ci[1]) / 2 - 0.03) < 1e-12);
    t = B.abTest(1000, 100, 1000, 110, 0.95); assert.strictEqual(t.sig, false); assert.ok(t.ci[0] < 0 && t.ci[1] > 0);
    t = B.abTest(1000, 100, 1000, 100, 0.95); near(t.z, 0); near(t.p, 1);
    t = B.abTest(100, 0, 100, 0, 0.95); assert.strictEqual(t.p, 1);
    assert.strictEqual(B.abTest(10, 11, 10, 1, 0.95), null); assert.strictEqual(B.abTest(0, 0, 10, 1, 0.95), null); assert.strictEqual(B.abTest(10.5, 1, 10, 1, 0.95), null);
    // 樣本數：10% → 12%（相對 +20%）、95%、80%
    assert.strictEqual(B.sampleSize(0.1, 0.2, 0.95, 0.8), 3841);
    assert.ok(B.sampleSize(0.1, 0.1, 0.95, 0.8) > B.sampleSize(0.1, 0.2, 0.95, 0.8)); assert.ok(B.sampleSize(0.1, 0.2, 0.99, 0.9) > 3841);
    assert.ok(isNaN(B.sampleSize(0.1, 0, 0.95, 0.8))); assert.ok(isNaN(B.sampleSize(0.6, 1, 0.95, 0.8)));
    // 電子報
    const n = B.newsletter(5000, 50, 1200, 200, 10, 80, 5000);
    assert.strictEqual(n.dlv, 4950); near(n.open, 1200 / 4950 * 100); near(n.click, 200 / 4950 * 100); near(n.ctor, 200 / 1200 * 100); near(n.unsub, 10 / 4950 * 100); near(n.growth, 1.4); near(n.bounceRate, 1);
    // 還原
    const ids = ['a', 'b'];
    assert.deepStrictEqual(B.normOpts(null, ids), { tab: 0, v: {} }); assert.deepStrictEqual(B.normOpts({ tab: 7, v: [1] }, ids), { tab: 0, v: {} });
    assert.deepStrictEqual(B.normOpts({ tab: 2, v: { a: '1', b: 5, c: 'x' } }, ids), { tab: 2, v: { a: '1' } });
    assert.deepStrictEqual(B.normOpts({ tab: '1', v: { a: 'x'.repeat(2001) } }, ids), { tab: 0, v: {} });
    ok('biz-calc 純邏輯');
}

{
    const Q = load('utils/quote-gen.html', 'toCents, lineCents, fmt, quoteTotals, chineseUpper, csvSafe, quoteCsv, moveItem, normQuoteOpts, TYPES, MAX_ITEMS');
    const up = (yuan) => Q.chineseUpper(Math.round(yuan * 100));
    assert.strictEqual(up(12345), '新台幣 壹萬貳仟參佰肆拾伍元整'); assert.strictEqual(up(0), '新台幣 零元整'); assert.strictEqual(up(10), '新台幣 壹拾元整');
    assert.strictEqual(up(10005), '新台幣 壹萬零伍元整'); assert.strictEqual(up(100000), '新台幣 壹拾萬元整'); assert.strictEqual(up(1050), '新台幣 壹仟零伍拾元整');
    assert.strictEqual(up(105), '新台幣 壹佰零伍元整'); assert.strictEqual(up(110), '新台幣 壹佰壹拾元整'); assert.strictEqual(up(1000000), '新台幣 壹佰萬元整');
    assert.strictEqual(up(20300400), '新台幣 貳仟零參拾萬零肆佰元整'); assert.strictEqual(up(100000005), '新台幣 壹億零伍元整'); assert.strictEqual(up(37800), '新台幣 參萬柒仟捌佰元整');
    assert.strictEqual(up(1234.56), '新台幣 壹仟貳佰參拾肆元伍角陸分'); assert.strictEqual(up(0.05), '新台幣 零元零伍分'); assert.strictEqual(up(0.5), '新台幣 零元伍角'); assert.strictEqual(up(7.05), '新台幣 柒元零伍分');
    assert.strictEqual(up(1e8 + 1e4), '新台幣 壹億零壹萬元整'); assert.strictEqual(up(1e12), '新台幣 壹兆元整');
    assert.strictEqual(Q.chineseUpper(-1), ''); assert.strictEqual(Q.chineseUpper(1.5), ''); assert.strictEqual(Q.chineseUpper(1e17), '');
    // 小計 / 稅 / 總計
    const items = [{ qty: '1', price: '30000' }, { qty: '3', price: '2000' }];
    let t = Q.quoteTotals(items, { taxMode: 'excl', rate: 5, disc: '', discKind: 'amt' });
    assert.deepStrictEqual(t, { sub: 3600000, disc: 0, net: 3600000, tax: 180000, total: 3780000 });
    t = Q.quoteTotals(items, { taxMode: 'incl', rate: 5, disc: '', discKind: 'amt' }); assert.strictEqual(t.total, 3600000); assert.strictEqual(t.net, 3428600); assert.strictEqual(t.tax + t.net, t.total);
    t = Q.quoteTotals(items, { taxMode: 'none', rate: 5, disc: 600, discKind: 'amt' }); assert.deepStrictEqual(t, { sub: 3600000, disc: 60000, net: 3540000, tax: 0, total: 3540000 });
    t = Q.quoteTotals(items, { taxMode: 'excl', rate: 5, disc: 10, discKind: 'pct' }); assert.strictEqual(t.disc, 360000); assert.strictEqual(t.total, 3240000 + 162000);
    t = Q.quoteTotals(items, { taxMode: 'none', rate: 5, disc: 99999999, discKind: 'amt' }); assert.strictEqual(t.total, 0);
    t = Q.quoteTotals(items, { taxMode: 'none', rate: 5, disc: 500, discKind: 'pct' }); assert.strictEqual(t.total, 0);
    // 含稅 / 未稅往返（整數元金額）
    for (const net of [1, 7, 99, 333, 12345, 99999]) {
        const x = Q.quoteTotals([{ qty: 1, price: net }], { taxMode: 'excl', rate: 5, disc: 0, discKind: 'amt' }), y = Q.quoteTotals([{ qty: 1, price: x.total / 100 }], { taxMode: 'incl', rate: 5, disc: 0, discKind: 'amt' });
        assert.strictEqual(y.net, net * 100, '往返 ' + net); assert.strictEqual(y.tax, x.tax);
    }
    assert.strictEqual(Q.lineCents('0.1', '3'), 30);
    assert.strictEqual(Q.lineCents('x', 5), 0); assert.strictEqual(Q.lineCents(-1, 5), 0); assert.strictEqual(Q.lineCents(2.5, 19.99), 4998);
    assert.strictEqual(Q.fmt(123456), '1,234.56'); assert.strictEqual(Q.fmt(100000), '1,000');
    // CSV
    assert.strictEqual(Q.csvSafe('=1+1'), "'=1+1"); assert.strictEqual(Q.csvSafe('設計'), '設計');
    const c = Q.quoteCsv([{ name: '=cmd', qty: '2', unit: '式', price: '100' }], { taxMode: 'excl', rate: 5, disc: 0, discKind: 'amt' });
    assert.deepStrictEqual(c.rows[0], ["'=cmd", '2', '式', '100', 200]); assert.deepStrictEqual(c.rows.at(-1), ['', '', '', '總計', 210]); assert.strictEqual(c.rows.length, 5);
    // 排序
    assert.deepStrictEqual(Q.moveItem([1, 2, 3], 0, 1), [2, 1, 3]); assert.deepStrictEqual(Q.moveItem([1, 2, 3], 0, -1), [1, 2, 3]); assert.deepStrictEqual(Q.moveItem([1, 2, 3], 2, 1), [1, 2, 3]);
    // 還原
    assert.deepStrictEqual(Q.normQuoteOpts(null), { type: '報價單', seller: '', note: '', taxMode: 'excl', rate: 5, discKind: 'amt' });
    assert.deepStrictEqual(Q.normQuoteOpts({ type: '收據', seller: 5, note: 'x'.repeat(900), taxMode: 'zzz', rate: 'abc', discKind: 'pct' }), { type: '收據', seller: '', note: 'x'.repeat(500), taxMode: 'excl', rate: 5, discKind: 'pct' });
    assert.strictEqual(Q.normQuoteOpts({ type: 'constructor', rate: 0 }).type, '報價單'); assert.strictEqual(Q.normQuoteOpts({ rate: 0 }).rate, 0); assert.strictEqual(Q.normQuoteOpts({ rate: 101 }).rate, 5); assert.strictEqual(Q.normQuoteOpts({ rate: null }).rate, 5);
    assert.strictEqual(Q.MAX_ITEMS, 200); assert.strictEqual(Q.TYPES['收據'].valid, null);
    ok('quote-gen 純邏輯');
}
