// i8 批次：fuel-log / power-cost / warranty-log / recipe-scaler / health-calc 新增純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

// ---------- fuel-log ----------
{
    const F = load('utils/fuel-log.html', 'TAXI_DEF, taxiFare, parkingFee, loanInterest, tco, plateTax, PLATE_TAX, normMaintList, addMaint, removeMaint, maintStatus, sortMaint, doneMaint, MAINT_MAX');
    // 計程車：預設 85 元起、1.25 km 內不加；超出 1.25 km 每 200 m 5 元（進位）
    assert.strictEqual(F.taxiFare(F.TAXI_DEF, 1, 0).fare, 85);
    assert.strictEqual(F.taxiFare(F.TAXI_DEF, 1.25, 0).fare, 85);
    assert.strictEqual(F.taxiFare(F.TAXI_DEF, 1.26, 0).fare, 90);
    assert.strictEqual(F.taxiFare(F.TAXI_DEF, 1.45, 0).fare, 90);
    assert.strictEqual(F.taxiFare(F.TAXI_DEF, 5, 0).fare, 85 + 19 * 5);      // (5-1.25)/0.2 = 18.75 → 19 段
    assert.strictEqual(F.taxiFare(F.TAXI_DEF, 5, 3).fare, 85 + 19 * 5 + 3 * 5); // 延滯 3 分 = 3 段（每 60 秒）
    assert.strictEqual(F.taxiFare(F.TAXI_DEF, 1, 0, true, false).fare, 105);
    assert.strictEqual(F.taxiFare(F.TAXI_DEF, 1, 0, true, true).fare, 135);
    assert.strictEqual(F.taxiFare({ ...F.TAXI_DEF, stepM: 0 }, 2, 0).fare > 0, true);   // 壞值不當機
    assert.strictEqual(F.taxiFare({}, 'x', -1).fare, 0);
    // 停車：免費 30 分，每小時 30，日上限 300
    const P = { freeMin: 30, hourFee: 30, dayCap: 300, nightFee: '', nightFrom: 22, nightTo: 6 };
    assert.strictEqual(F.parkingFee(P, 540, 20), 0);
    assert.strictEqual(F.parkingFee(P, 540, 30), 0);
    assert.strictEqual(F.parkingFee(P, 540, 31), 30);
    assert.strictEqual(F.parkingFee(P, 540, 210), 90);        // 210-30=180 分 = 3 段
    assert.strictEqual(F.parkingFee(P, 540, 24 * 60), 300);    // 超過日上限
    assert.strictEqual(F.parkingFee(P, 540, 48 * 60), 600);    // 兩個 24 小時段各 300
    assert.strictEqual(F.parkingFee({ ...P, dayCap: 0 }, 540, 5 * 60), 150);
    // 夜間費率 10：從 21:00 停 3 小時（扣免費 30 分 → 21:30 起計：21 點段 30、22 點段 10、23 點段 10 → 看起始小時）
    const PN = { ...P, nightFee: 10, freeMin: 0, dayCap: 0 };
    assert.strictEqual(F.parkingFee(PN, 21 * 60, 180), 30 + 10 + 10);
    assert.strictEqual(F.parkingFee(PN, 23 * 60, 240), 10 * 4);   // 23, 0, 1, 2 時
    assert.strictEqual(F.parkingFee(PN, 5 * 60, 120), 10 + 30);    // 5 點夜間、6 點日間
    assert.strictEqual(F.parkingFee(P, 0, -5), 0);
    // 貸款利息：10 萬、年利率 12%（月 1%）、12 期，總利息 6618.55；0% 無利息；只算前 N 年
    near(F.loanInterest(100000, 12, 1, 1), 100000 * 0.01 / (1 - Math.pow(1.01, -12)) * 12 - 100000, 1e-9);
    assert.ok(Math.abs(F.loanInterest(100000, 12, 1, 1) - 6618.55) < 0.5);
    assert.strictEqual(F.loanInterest(100000, 0, 5, 5), 0);
    assert.strictEqual(F.loanInterest(0, 5, 5, 5), 0);
    assert.ok(F.loanInterest(100000, 12, 1, 0.5) < F.loanInterest(100000, 12, 1, 1));
    assert.strictEqual(F.loanInterest(100000, 12, 1, 5), F.loanInterest(100000, 12, 1, 1)); // 貸款期滿後不再增加
    // 總持有成本
    const base = { years: 5, price: 800000, resalePct: 40, insurance: 25000, tax: 11230, maint: 15000, parking: 0, kmYear: 12000, kmPerL: 12, fuelPrice: 30, loan: 0, loanRate: 0, loanYears: 0, rentMonthly: 20000, rentExtra: 0 };
    let t = F.tco(base);
    assert.strictEqual(t.dep, 480000);
    assert.strictEqual(t.fuel, 12000 / 12 * 30 * 5);
    assert.strictEqual(t.yearly, (25000 + 11230 + 15000) * 5);
    assert.strictEqual(t.buy, 480000 + 150000 + 256150);
    assert.strictEqual(t.rent, 20000 * 60);
    assert.strictEqual(t.diff, t.buy - t.rent);
    assert.strictEqual(F.tco({ ...base, kmPerL: 0 }).fuel, 0);       // 沒油耗資料不當機
    assert.strictEqual(F.tco({ ...base, resalePct: 500 }).dep, 0);    // 殘值上限 100%
    assert.strictEqual(F.tco({ years: 0 }).buyPerYear, 0);
    // 牌照稅（財政部稅務入口網 115-04-09）
    for (const [cc, p, b] of [[500, 1620, 900], [501, 2160, 1260], [600, 2160, 1260], [1200, 4320, 2160], [1201, 7120, 3060], [1800, 7120, 3060], [1801, 11230, 6480], [2400, 11230, 6480], [2401, 15210, 9900], [3000, 15210, 9900], [3001, 28220, 16380], [4200, 28220, 16380], [4201, 46170, 24300], [5400, 46170, 24300], [5401, 69690, 33660], [6600, 69690, 33660], [6601, 117000, 44460], [7800, 117000, 44460], [7801, 151200, 56700], [9999, 151200, 56700]]) {
        assert.strictEqual(F.plateTax(cc, false).tax, p, 'p' + cc); assert.strictEqual(F.plateTax(cc, true).tax, b, 'b' + cc);
    }
    assert.strictEqual(F.plateTax(1998.5, false).tax, 11230);
    assert.strictEqual(F.plateTax(0, false), null); assert.strictEqual(F.plateTax('x', false), null); assert.strictEqual(F.plateTax(-5, false), null);
    assert.strictEqual(F.plateTax(7801, false).range, '7801 cc 以上');
    assert.strictEqual(F.plateTax(1800, false).range, '1201–1800 cc');
    // 保養提醒：驗證與容錯
    assert.deepStrictEqual(F.normMaintList(null), []); assert.deepStrictEqual(F.normMaintList('x'), []);
    let L = F.normMaintList([null, 5, { id: '' }, { id: 'a', kind: '不明', name: 'x'.repeat(99), date: '2026-13-40', odo: -5, days: 'x', km: 1.5 }, { id: 'a', kind: '機油' }, { id: 'b', kind: '機油', date: '2026-01-01', odo: 1000, days: 180, km: 5000 }]);
    assert.strictEqual(L.length, 2);
    assert.strictEqual(L[0].kind, '其他'); assert.strictEqual(L[0].name.length, 30); assert.strictEqual(L[0].date, ''); assert.strictEqual(L[0].odo, null); assert.strictEqual(L[0].days, 0); assert.strictEqual(L[0].km, 0);
    assert.strictEqual(F.normMaintList(Array.from({ length: 400 }, (_, i) => ({ id: 'i' + i, kind: '機油', date: '2026-01-01', days: 30 }))).length, F.MAINT_MAX);
    // 新增檢查
    assert.ok(F.addMaint([], { kind: '機油', date: '2026-01-01', odo: null, days: 0, km: 0 }, 'x').err);
    assert.ok(F.addMaint([], { kind: '機油', date: '', odo: null, days: 30, km: 0 }, 'x').err);
    assert.ok(F.addMaint([], { kind: '機油', date: '2026-01-01', odo: null, days: 0, km: 5000 }, 'x').err);
    let r = F.addMaint([], { kind: '機油', date: '2026-01-01', odo: 1000, days: 180, km: 5000 }, 'x'); assert.strictEqual(r.err, ''); assert.strictEqual(r.list.length, 1);
    const full = Array.from({ length: 300 }, (_, i) => ({ id: 'i' + i, kind: '機油', name: '', date: '2026-01-01', odo: null, days: 30, km: 0 }));
    assert.ok(F.addMaint(full, { kind: '機油', date: '2026-01-01', days: 30, km: 0 }, 'z').err.includes('300'));
    assert.strictEqual(F.removeMaint(full, 'i5').length, 299); assert.ok(!F.removeMaint(full, 'i5').some(x => x.id === 'i5'));
    // 狀態
    const m = { id: 'm', kind: '機油', name: '', date: '2026-01-01', odo: 1000, days: 180, km: 5000 };   // 到期 2026-06-30 或 6000 km
    assert.strictEqual(F.maintStatus(m, '2026-03-01', 2000).key, 'ok');
    assert.strictEqual(F.maintStatus(m, '2026-06-01', 2000).key, 'soon');      // 剩 29 天
    assert.strictEqual(F.maintStatus(m, '2026-03-01', 5600).key, 'soon');      // 剩 400 km
    assert.strictEqual(F.maintStatus(m, '2026-07-01', 2000).key, 'overdue');
    assert.strictEqual(F.maintStatus(m, '2026-06-30', 2000).key, 'soon');      // 到期當天不算逾期
    assert.strictEqual(F.maintStatus(m, '2026-03-01', 6001).key, 'overdue');
    assert.strictEqual(F.maintStatus(m, '2026-03-01', null).key, 'ok');        // 沒有目前里程只看日期
    assert.strictEqual(F.maintStatus({ ...m, days: 0 }, '2026-03-01', null).key, 'none');
    assert.strictEqual(F.maintStatus(m, '2026-03-01', 2000).dueDate, '2026-06-30');
    assert.strictEqual(F.maintStatus(m, '2026-03-01', 2000).dayLeft, 121);
    const sorted = F.sortMaint([{ ...m, id: 'ok' }, { ...m, id: 'od', date: '2020-01-01' }, { ...m, id: 'no', days: 0, km: 0 }], '2026-03-01', 2000);
    assert.deepStrictEqual(sorted.map(x => x.id), ['od', 'ok', 'no']);
    const d = F.doneMaint(m, '2026-07-01', 7000); assert.strictEqual(d.date, '2026-07-01'); assert.strictEqual(d.odo, 7000);
    assert.strictEqual(F.doneMaint(m, '2026-07-01', null).odo, 1000); assert.strictEqual(F.doneMaint({ ...m, km: 0 }, '2026-07-01', 7000).odo, 1000);
    ok('i8 fuel-log');
}

// ---------- power-cost ----------
{
    const W = load('utils/power-cost.html', 'WATER_DEF, tieredCost, waterBill, gasEstimate');
    const T = W.WATER_DEF.tiers;
    // 每月 8 度（第一級 10 度內）
    near(W.waterBill(8, T, 1, 0, 0).cost, 8 * 7.35);
    // 每月 30 度：10×7.35 + 20×9.45
    near(W.waterBill(30, T, 1, 0, 0).cost, 73.5 + 189);
    // 每月 60 度：10×7.35 + 20×9.45 + 20×11.55 + 10×12.075
    near(W.waterBill(60, T, 1, 0, 0).cost, 73.5 + 189 + 231 + 120.75);
    // 兩個月一期：級距加倍，60 度 = 20×7.35 + 40×9.45 → 只有 60 度
    near(W.waterBill(60, T, 2, 0, 0).cost, 20 * 7.35 + 40 * 9.45);
    // 基本費與下水道費
    near(W.waterBill(10, T, 2, 50, 2).cost, 73.5 + 100 + 20);
    assert.strictEqual(W.waterBill(0, T, 1, 0, 0).cost, 0);
    assert.strictEqual(W.waterBill(-5, T, 1, 'x', null).cost, 0);
    assert.strictEqual(W.waterBill(NaN, T, 1, 0, 0).cost, 0);
    // 使用者把級距改成相同單價 → 單價 × 度數
    near(W.waterBill(100, [[10, 5], [20, 5], [Infinity, 5]], 1, 0, 0).cost, 500);
    // 級距上限亂填（遞減）也不會算出超過度數
    const odd = W.tieredCost(50, [[30, 1], [10, 2], [Infinity, 3]], 1); near(odd.rows.reduce((a, r) => a + r.kwh, 0), 50);
    // 瓦斯：爐具 60 分 × 3000 + 熱水器 20 分 × 25000 → (3000 + 8333.3)/天
    const g = W.gasEstimate({ stoveMin: 60, stoveK: 3000, heatMin: 20, heatK: 25000, tubeKg: 20, tubePrice: 800, lpgKcal: 11000, ngKcal: 9000, ngPrice: 30 });
    near(g.kcalDay, 3000 + 20 * 25000 / 60);
    near(g.days, 20 * 11000 / g.kcalDay);
    near(g.lpgMonthly, 800 / g.days * 30);
    near(g.ngMonthKwh, g.kcalDay / 9000 * 30);
    near(g.ngMonthly, g.ngMonthKwh * 30);
    const g0 = W.gasEstimate({ stoveMin: 0, heatMin: 0, tubeKg: 20, lpgKcal: 11000 }); assert.strictEqual(g0.days, null); assert.strictEqual(g0.lpgMonthly, null);
    assert.strictEqual(W.gasEstimate({ stoveMin: 60, stoveK: 3000, tubeKg: 20, lpgKcal: 11000, ngKcal: 9000 }).ngMonthly, null);   // 沒填單價
    assert.strictEqual(W.gasEstimate({}).days, null);
    ok('i8 power-cost');
}

// ---------- warranty-log ----------
{
    const W = load('utils/warranty-log.html', 'normItem, normList, updateItem, addItem, removeItem, normCons, normConsList, consStatus, addCons, removeCons, doneCons, dueCons, CONS_MAX');
    // 舊資料沒有 cons 補空陣列
    const old = W.normItem({ id: 'a', name: '冰箱', date: '2026-01-01', months: 12 }); assert.deepStrictEqual(old.cons, []);
    assert.deepStrictEqual(W.normItem({ id: 'a', name: '冰箱', date: '2026-01-01', cons: 'x' }).cons, []);
    // 壞耗材略過、重複 id 略過、截斷到 20
    const c = W.normConsList([null, { id: '1', name: '', days: 30, last: '2026-01-01' }, { id: '2', name: '濾網', days: 0, last: '2026-01-01' }, { id: '3', name: '濾網', days: 1.5, last: '2026-01-01' }, { id: '4', name: '濾網', days: 30, last: '2026-02-30' }, { id: '5', name: '濾網', days: 30, last: '2026-01-01' }, { id: '5', name: '電池', days: 30, last: '2026-01-01' }]);
    assert.deepStrictEqual(c.map(x => x.id), ['5']);
    assert.strictEqual(W.normConsList(Array.from({ length: 50 }, (_, i) => ({ id: 'c' + i, name: 'n', days: 10, last: '2026-01-01' }))).length, W.CONS_MAX);
    assert.strictEqual(W.normCons({ name: 'x'.repeat(99), days: 10, last: '2026-01-01' }).name.length, 30);
    assert.strictEqual(W.normCons({ name: 'x', days: 3651, last: '2026-01-01' }), null);
    // 狀態
    const cc = { id: 'x', name: '濾網', days: 90, last: '2026-01-01' };   // 到期 2026-04-01
    assert.deepStrictEqual(W.consStatus(cc, '2026-01-02'), { key: 'ok', due: '2026-04-01', left: 89 });
    assert.strictEqual(W.consStatus(cc, '2026-03-02').key, 'soon');       // 剩 30 天
    assert.strictEqual(W.consStatus(cc, '2026-03-01').key, 'ok');         // 剩 31 天
    assert.strictEqual(W.consStatus(cc, '2026-04-01').key, 'soon');       // 當天
    assert.strictEqual(W.consStatus(cc, '2026-04-02').key, 'overdue');
    // 新增 / 刪除 / 完成
    let it = W.normItem({ id: 'a', name: '空氣清淨機', date: '2026-01-01', months: 12 });
    let r = W.addCons(it, { name: '濾網', days: '180', last: '2026-01-01' }, 'k1'); assert.strictEqual(r.err, ''); it = r.item; assert.strictEqual(it.cons.length, 1);
    assert.ok(W.addCons(it, { name: '', days: '30', last: '2026-01-01' }).err);
    assert.ok(W.addCons(it, { name: 'a', days: '', last: '2026-01-01' }).err);
    assert.ok(W.addCons(it, { name: 'a', days: '30', last: '' }).err);
    let full = it; for (let i = 0; i < 19; i++) full = W.addCons(full, { name: 'n' + i, days: 30, last: '2026-01-01' }, 'f' + i).item;
    assert.strictEqual(full.cons.length, 20); assert.ok(W.addCons(full, { name: 'z', days: 30, last: '2026-01-01' }).err.includes('20'));
    assert.strictEqual(full.cons.length, 20);
    assert.strictEqual(W.removeCons(it, 'k1').cons.length, 0); assert.strictEqual(W.removeCons(it, 'zz').cons.length, 1);
    assert.strictEqual(W.doneCons(it, 'k1', '2026-06-01').cons[0].last, '2026-06-01'); assert.strictEqual(W.doneCons(it, 'zz', '2026-06-01').cons[0].last, '2026-01-01');
    // 30 天內與逾期清單
    const items = [{ ...it, id: 'a', cons: [{ id: 'p', name: '濾網', days: 90, last: '2026-01-01' }, { id: 'q', name: '電池', days: 365, last: '2026-01-01' }] }, { ...it, id: 'b', cons: [{ id: 'r', name: '濾芯', days: 60, last: '2026-01-01' }] }];
    const due = W.dueCons(items, '2026-03-15');
    assert.deepStrictEqual(due.map(x => x.c.id), ['r', 'p']);     // r 3/2 到期已逾期；p 4/1 剩 17 天
    assert.strictEqual(W.dueCons([], '2026-03-15').length, 0);
    // 編輯項目不會丟掉耗材；刪除項目連帶耗材
    const list = [items[0]];
    const up = W.updateItem(list, 'a', { name: '新名', cat: '家電', date: '2026-01-01', months: '12', price: '', shop: '', loc: '', note: '' });
    assert.strictEqual(up.err, ''); assert.strictEqual(up.list[0].cons.length, 2); assert.strictEqual(up.list[0].name, '新名');
    assert.strictEqual(W.removeItem(list, 'a').length, 0);
    assert.strictEqual(W.addItem([], { name: 'x', cat: '家電', date: '2026-01-01', months: '12', price: '', shop: '', loc: '', note: '' }, 'n').list[0].cons.length, 0);
    assert.strictEqual(W.normList([{ id: 'a', name: '冰箱', date: '2026-01-01', cons: [{ id: 'k', name: '濾網', days: 30, last: '2026-01-01' }] }])[0].cons.length, 1);
    ok('i8 warranty-log');
}

// ---------- recipe-scaler ----------
{
    const R = load('utils/recipe-scaler.html', 'DENS, toGrams, fromGrams, cToF, fToC, gasMark, leaven, coffeeSteps, waterToCoffee, cleanSteps, stepNow, mmss, cleanCoffee, addCoffee, removeCoffee, CF');
    // 密度表
    assert.ok(R.DENS.length >= 10 && R.DENS.every(d => d[1] > 0 && d[1] < 2));
    near(R.toGrams(1, 'cup', 1), 250); near(R.toGrams(2, 'tbsp', 1), 30); near(R.toGrams(3, 'tsp', 1), 15); near(R.toGrams(100, 'ml', 0.53), 53);
    near(R.toGrams(0.5, 'cup', 0.53), 66.25);
    assert.strictEqual(R.toGrams(-1, 'cup', 1), null); assert.strictEqual(R.toGrams('x', 'cup', 1), null); assert.strictEqual(R.toGrams(1, 'xx', 1), null); assert.strictEqual(R.toGrams(1, 'cup', 0), null);
    // 往返
    const back = R.fromGrams(R.toGrams(1.5, 'cup', 0.85), 0.85); near(back.cup, 1.5); near(back.tbsp, 25); near(back.tsp, 75);
    assert.strictEqual(R.fromGrams(-1, 1), null);
    // 溫度
    near(R.cToF(0), 32); near(R.cToF(100), 212); near(R.cToF(180), 356); near(R.fToC(350), 176.666667, 1e-6); near(R.fToC(R.cToF(37)), 37);
    assert.strictEqual(R.gasMark(R.cToF(180)), '4');   // 356°F
    assert.strictEqual(R.gasMark(350), '4'); assert.strictEqual(R.gasMark(375), '5'); assert.strictEqual(R.gasMark(425), '7'); assert.strictEqual(R.gasMark(475), '9');
    assert.strictEqual(R.gasMark(225), '1/4'); assert.strictEqual(R.gasMark(250), '1/2'); assert.strictEqual(R.gasMark(275), '1');
    assert.strictEqual(R.gasMark(100), '低於 1/4 刻度'); assert.strictEqual(R.gasMark(600), '高於 9 刻度'); assert.strictEqual(R.gasMark(NaN), null);
    // 酵母 / 膨鬆劑
    let y = R.leaven(3, 'instant'); near(y[0][1], 3); near(y[1][1], 3.75); near(y[2][1], 9);
    y = R.leaven(9, 'fresh'); near(y[0][1], 3); y = R.leaven(5, 'dry'); near(y[0][1], 4);
    near(R.leaven(4, 'bp')[0][1], 1); near(R.leaven(1, 'bs')[0][1], 4);
    assert.strictEqual(R.leaven(-1, 'dry'), null); assert.strictEqual(R.leaven(1, 'zzz'), null); assert.strictEqual(R.leaven('x', 'dry'), null);
    // 咖啡
    near(R.waterToCoffee(300, 15), 20); assert.strictEqual(R.waterToCoffee(0, 15), null); assert.strictEqual(R.waterToCoffee(300, 0), null);
    assert.deepStrictEqual(R.coffeeSteps(20, 300), [{ sec: 0, ml: 40 }, { sec: 45, ml: 180 }, { sec: 90, ml: 300 }]);
    assert.deepStrictEqual(R.cleanSteps([{ sec: 90, ml: 300 }, { sec: 0, ml: 40 }, null, { sec: -1, ml: 5 }, { sec: 'x', ml: 5 }, { sec: 10, ml: 99999 }]), [{ sec: 0, ml: 40 }, { sec: 90, ml: 300 }]);
    assert.strictEqual(R.cleanSteps(Array.from({ length: 30 }, (_, i) => ({ sec: i, ml: i }))).length, 10);
    assert.deepStrictEqual(R.cleanSteps('x'), []);
    const st = R.coffeeSteps(20, 300);
    let s = R.stepNow(st, 0); assert.strictEqual(s.cur.ml, 40); assert.strictEqual(s.next.sec, 45); assert.strictEqual(s.untilNext, 45); assert.strictEqual(s.done, false);
    s = R.stepNow(st, 44.9); assert.strictEqual(s.cur.sec, 0);
    s = R.stepNow(st, 45); assert.strictEqual(s.cur.sec, 45); assert.strictEqual(s.untilNext, 45);
    s = R.stepNow(st, 500); assert.strictEqual(s.done, true); assert.strictEqual(s.next, null);
    s = R.stepNow([{ sec: 10, ml: 5 }], 3); assert.strictEqual(s.cur, null); assert.strictEqual(s.untilNext, 7);
    assert.strictEqual(R.stepNow([], 5).cur, null);
    assert.strictEqual(R.mmss(0), '0:00'); assert.strictEqual(R.mmss(75.9), '1:15'); assert.strictEqual(R.mmss(-3), '0:00'); assert.strictEqual(R.mmss(600), '10:00');
    // 配方：驗證 / 新增 / 上限 / 刪除
    assert.deepStrictEqual(R.cleanCoffee(null), []);
    const cl = R.cleanCoffee([null, { id: 'a', name: '日常', water: 300, ratio: 15, temp: 92, steps: st }, { id: 'a', name: '重複', water: 1 }, { id: 'b', name: '', water: 300 }, { id: 'c', name: 'x', water: 0 }, { id: 'd', name: 'y', water: 250, ratio: 'zz', temp: 5, steps: 'bad' }, { name: 'noid', water: 1 }]);
    assert.deepStrictEqual(cl.map(x => x.id), ['a', 'd']); assert.strictEqual(cl[1].ratio, 15); assert.strictEqual(cl[1].temp, 92); assert.deepStrictEqual(cl[1].steps, []);
    assert.strictEqual(R.cleanCoffee(Array.from({ length: 50 }, (_, i) => ({ id: 'i' + i, name: 'n', water: 300 }))).length, R.CF.MAX);
    let a = R.addCoffee([], { name: ' 手沖 ', water: 300, ratio: 16, temp: 90, steps: st }, 'x1'); assert.strictEqual(a.err, ''); assert.strictEqual(a.list[0].name, '手沖'); assert.strictEqual(a.list[0].steps.length, 3);
    assert.ok(R.addCoffee([], { name: '', water: 300 }, 'x').err); assert.ok(R.addCoffee([], { name: 'a', water: 0 }, 'x').err); assert.ok(R.addCoffee([], { name: 'a', water: 9999 }, 'x').err);
    const fullc = Array.from({ length: 30 }, (_, i) => ({ id: 'i' + i, name: 'n', water: 300, ratio: 15, temp: 92, steps: [] }));
    assert.ok(R.addCoffee(fullc, { name: 'z', water: 300 }, 'zz').err.includes('30'));
    assert.strictEqual(R.removeCoffee(fullc, 'i3').length, 29); assert.ok(!R.removeCoffee(fullc, 'i3').some(x => x.id === 'i3'));
    ok('i8 recipe-scaler');
}

// ---------- health-calc ----------
{
    const H = load('utils/health-calc.html', 'METS, metKcal, dueDate, gestAge, trimester, termLabel, preg');
    assert.ok(H.METS.length >= 15 && H.METS.every(m => m[1] > 0 && m[1] < 20));
    near(H.metKcal(7, 70, 60), 490); near(H.metKcal(8.3, 65, 30), 8.3 * 65 / 2); near(H.metKcal(3.5, 60, 45), 3.5 * 60 * 0.75);
    assert.strictEqual(H.metKcal(7, 5, 30), null); assert.strictEqual(H.metKcal(7, 70, 0), null); assert.strictEqual(H.metKcal(0, 70, 30), null); assert.strictEqual(H.metKcal('x', 70, 30), null); assert.strictEqual(H.metKcal(7, 70, 5000), null);
    // Naegele：末次月經 + 9 個月 + 7 天
    assert.strictEqual(H.dueDate('2026-01-01'), '2026-10-08');
    assert.strictEqual(H.dueDate('2026-03-15'), '2026-12-22');
    assert.strictEqual(H.dueDate('2026-04-01'), '2027-01-08');
    assert.strictEqual(H.dueDate('2025-12-25'), '2026-10-02');
    assert.strictEqual(H.dueDate('2026-05-31'), '2027-03-07');       // 2/28 + 7
    assert.strictEqual(H.dueDate('2026-01-01', 28), '2026-10-08');
    assert.strictEqual(H.dueDate('2026-01-01', 32), '2026-10-12');   // 週期 32 天 → 晚 4 天
    assert.strictEqual(H.dueDate('2026-01-01', 24), '2026-10-04');
    // 與 280 天法最多差 3 天（月份長度不同）
    for (const l of ['2026-01-01', '2026-02-10', '2026-07-04', '2026-11-11']) assert.ok(Math.abs(Util.day.between(H.dueDate(l), Util.day.shift(l, 280))) <= 3, l);
    // 週數
    assert.deepStrictEqual(H.gestAge('2026-01-01', '2026-01-01'), { weeks: 0, days: 0, total: 0 });
    assert.deepStrictEqual(H.gestAge('2026-01-01', '2026-01-08'), { weeks: 1, days: 0, total: 7 });
    assert.deepStrictEqual(H.gestAge('2026-01-01', '2026-03-12'), { weeks: 10, days: 0, total: 70 });
    assert.deepStrictEqual(H.gestAge('2026-01-01', '2026-03-14'), { weeks: 10, days: 2, total: 72 });
    assert.strictEqual(H.gestAge('2026-01-02', '2026-01-01'), null);
    assert.strictEqual(H.gestAge('2026-01-01', H.dueDate('2026-01-01')).weeks, 40);
    // 階段
    assert.strictEqual(H.trimester(0), 1); assert.strictEqual(H.trimester(13), 1); assert.strictEqual(H.trimester(14), 2); assert.strictEqual(H.trimester(27), 2); assert.strictEqual(H.trimester(28), 3); assert.strictEqual(H.trimester(41), 3);
    assert.strictEqual(H.termLabel(36), '未滿 37 週'); assert.strictEqual(H.termLabel(37), '早期足月'); assert.strictEqual(H.termLabel(39), '足月'); assert.strictEqual(H.termLabel(40), '足月'); assert.strictEqual(H.termLabel(41), '晚期足月'); assert.strictEqual(H.termLabel(42), '已超過 42 週');
    // 彙整
    let p = H.preg('2026-01-01', '2026-03-14', 28);
    assert.strictEqual(p.due, '2026-10-08'); assert.strictEqual(p.g.weeks, 10); assert.strictEqual(p.left, Util.day.between('2026-03-14', '2026-10-08'));
    assert.deepStrictEqual(p.marks.map(m => m[0]), [12, 20, 28, 37, 40]); assert.strictEqual(p.marks[0][1], '2026-03-26'); assert.strictEqual(p.marks[4][1], '2026-10-08');
    p = H.preg('2026-01-01', '2026-10-10', 28); assert.ok(p.left < 0);
    p = H.preg('2026-01-01', '2026-03-14', 32); assert.strictEqual(p.due, '2026-10-12'); assert.strictEqual(p.marks[4][1], '2026-10-12'); assert.strictEqual(p.g.total, 72 - 4);
    assert.strictEqual(H.preg('2026-03-01', '2026-01-01', 28).g, null);
    ok('i8 health-calc');
}
