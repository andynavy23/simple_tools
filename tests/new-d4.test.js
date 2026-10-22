// d4 批次：買房 vs 租房（loan-calculator）、習慣週期型提醒（habit-tracker）、購物與保固記錄（warranty-log）
const { load, ok, near } = require('./_load');
const assert = require('assert');

// ---------- 買房 vs 租房 ----------
const L = load('utils/loan-calculator.html', 'amortize, mortgageSchedule, buyVsRent, checkBuyRent, fmtYM');
const base = { price: 1e7, down: 2e6, rate: 2.2, loanYears: 30, grace: 0, hold: 10, growth: 1, feePct: 2, holdCost: 60000, rent: 22000, rentGrowth: 1, invest: 3 };
{
    const s = L.mortgageSchedule(8e6, 2.2, 30, 0);
    assert.strictEqual(s.length, 360); near(s[0].payment, 30376.0673, 1e-6); assert.strictEqual(s[359].balance, 0);
    const g = L.mortgageSchedule(8e6, 2.4, 20, 5);
    assert.strictEqual(g.length, 240); near(g[0].payment, 8e6 * 0.002); assert.strictEqual(g[59].balance, 8e6); assert.ok(g[60].payment > g[0].payment); assert.strictEqual(g[239].balance, 0);
    assert.deepStrictEqual(L.mortgageSchedule(0, 2, 10), []); assert.deepStrictEqual(L.mortgageSchedule(-5, 2, 10), []);
    assert.strictEqual(L.mortgageSchedule(1200, 0, 1).length, 12); near(L.mortgageSchedule(1200, 0, 1)[0].payment, 100);
    assert.strictEqual(L.mortgageSchedule(1000, 1, 1, 99).length, 12);     // 寬限期過長被夾住，仍有攤還期
    assert.strictEqual(L.mortgageSchedule(1000, 1, 1, 99)[11].balance, 0);
    ok('buy-rent: mortgage schedule (normal / grace / zero loan / rate 0 / 1 year)');
}
{
    const r = L.buyVsRent(base), e = r.months[120];
    assert.strictEqual(r.months.length, 121); assert.strictEqual(r.years.length, 10); assert.strictEqual(r.years[9].year, 10);
    near(r.monthlyPay, 30376.0673, 1e-6); assert.strictEqual(r.fees, 200000); assert.strictEqual(r.loan, 8e6);
    near(e.buy, 1292483.81, 1e-6); near(e.rent, 1757274.59, 1e-6); assert.strictEqual(r.breakevenMonths, 39);
    assert.strictEqual(r.months[0].buy, 200000); assert.strictEqual(r.months[0].rent, 0);
    ok('buy-rent: baseline numbers & breakeven');
}
{
    // 全部歸零：利率 0、無成長、無費用、無租金、無投資 → 買房成本 0 = 租房成本 0
    const z = { price: 1.2e6, down: 0, rate: 0, loanYears: 1, grace: 0, hold: 1, growth: 0, feePct: 0, holdCost: 0, rent: 0, rentGrowth: 0, invest: 0 };
    const r = L.buyVsRent(z);
    near(r.monthlyPay, 100000); near(r.months[12].buy, 0, 1e-9); assert.strictEqual(r.months[12].rent, 0); assert.strictEqual(r.breakevenMonths, 0);
    // 利率 0 + 年限 1：貸款全還完、房價不變 → 買房淨成本 = 費用 + 持有成本；租房 = 租金
    const r2 = L.buyVsRent({ ...z, down: 200000, feePct: 1, holdCost: 12000, rent: 5000 });
    near(r2.months[12].buy, 12000 + 12000, 1e-9); near(r2.months[12].rent, 60000, 1e-9);
    assert.strictEqual(r2.breakevenMonths, 3);   // 買 12000+1000m，租 5000m：第 3 個月起不高於租房
    // 持有年數 > 貸款年限：貸款還完後月付 0，買房成本只剩持有成本
    const r3 = L.buyVsRent({ ...base, loanYears: 5, hold: 8, growth: 0, rent: 0, invest: 0, holdCost: 12000, feePct: 0 });
    near(r3.months[96].buy - r3.months[60].buy, 12000 * 3, 1e-6);
    near(r3.months[96].buy - r3.months[95].buy, 1000, 1e-6);
    assert.strictEqual(r3.months.length, 97);
    // 租金漲幅 0：每年租金固定；投資 0 → 租房成本 = 租金 × 月數
    const r4 = L.buyVsRent({ ...base, rentGrowth: 0, invest: 0 });
    near(r4.months[120].rent, 22000 * 120); near(r4.months[13].rent, 22000 * 13);
    // 租金漲幅 10%：第 13 個月起租金為 1.1 倍
    const r5 = L.buyVsRent({ ...base, rentGrowth: 10, invest: 0 });
    near(r5.months[13].rent - r5.months[12].rent, 24200); near(r5.months[12].rent - r5.months[11].rent, 22000);
    // 全額付現（頭期款 = 房價）
    const r6 = L.buyVsRent({ ...base, down: 1e7 }); assert.strictEqual(r6.loan, 0); assert.strictEqual(r6.monthlyPay, 0);
    ok('buy-rent: zero rate / 1-year / hold > loan / rent growth 0 & 10% / cash purchase');
}
{
    // 恆等式：買房成本 − 租房成本 = 租房者資產 − 買房者淨值（用另一條獨立路徑驗算）
    const o = { ...base, grace: 3, hold: 15, growth: 2.5, invest: 4 };
    const r = L.buyVsRent(o), N = 180, im = Math.pow(1.04, 1 / 12) - 1, s = L.mortgageSchedule(o.price - o.down, o.rate, o.loanYears, o.grace);
    let port = o.down + o.price * 0.02;
    for (let m = 1; m <= N; m++) port = port * (1 + im) + s[m - 1].payment + o.holdCost / 12 - o.rent * Math.pow(1.01, Math.floor((m - 1) / 12));
    const equity = o.price * Math.pow(1.025, 15) - s[N - 1].balance;
    near(r.months[N].buy - r.months[N].rent, port - equity, 1e-9);
    // 無寬限期的 breakeven 與有寬限期不同；寬限期內月付較低
    assert.ok(L.buyVsRent({ ...base, grace: 5 }).monthlyPay < L.buyVsRent(base).monthlyPay);
    // 租金高 → 提早損益平衡；租金低 → 永遠不划算（null）；單調
    const a = L.buyVsRent({ ...base, rent: 30000 }).breakevenMonths, b = L.buyVsRent({ ...base, rent: 22000 }).breakevenMonths;
    assert.ok(a < b); assert.strictEqual(L.buyVsRent({ ...base, rent: 10000, growth: 0 }).breakevenMonths, null);
    // 損益平衡之後一直都不高於租房
    const rr = L.buyVsRent(base); for (let m = rr.breakevenMonths; m < rr.months.length; m++) assert.ok(rr.months[m].buy <= rr.months[m].rent + 1e-6);
    assert.ok(rr.months[rr.breakevenMonths - 1].buy > rr.months[rr.breakevenMonths - 1].rent);
    ok('buy-rent: identity vs independent calc / monotonic breakeven / null');
}
{
    assert.strictEqual(L.checkBuyRent(base), '');
    for (const bad of [{ price: 0 }, { price: NaN }, { down: -1 }, { down: 2e7 }, { rate: -1 }, { loanYears: 0 }, { loanYears: 51 }, { grace: 30 }, { grace: -1 }, { hold: 0 }, { hold: 51 }, { feePct: -1 }, { holdCost: -1 }, { rent: -1 }, { growth: -100 }, { invest: -100 }, { rentGrowth: NaN }])
        assert.ok(L.checkBuyRent({ ...base, ...bad }), JSON.stringify(bad));
    assert.strictEqual(L.checkBuyRent({ ...base, down: 0, hold: 1, loanYears: 1, rate: 0, growth: -5 }), '');
    assert.strictEqual(L.fmtYM(5), '5 個月'); assert.strictEqual(L.fmtYM(12), '1 年'); assert.strictEqual(L.fmtYM(39), '3 年 3 個月'); assert.strictEqual(L.fmtYM(11), '11 個月');
    ok('buy-rent: input validation / fmtYM');
}

// ---------- 習慣：週期型提醒 ----------
const H = load('fun/habit-tracker.html', 'validDay, normCycle, isDue, prevDue, cycleLabel, streaks, normHabit, doneDates, atDayCap, dueHabits, MAX_DATES, MAX_HABITS');
{
    const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
    assert.strictEqual(dow('2026-10-10'), 6);
    // normCycle：壞資料一律回每天
    const D = { t: 'daily' };
    for (const bad of [undefined, null, 5, 'x', [], {}, { t: 'weekly' }, { t: 'weekly', days: [] }, { t: 'weekly', days: ['1'] }, { t: 'weekly', days: [7, -1, 1.5] }, { t: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] }, { t: 'every', n: 1, start: '2026-01-01' }, { t: 'every', n: 2 }, { t: 'every', n: 'a', start: '2026-01-01' }, { t: 'every', n: 400, start: '2026-01-01' }, { t: 'every', n: 3, start: '2026-02-30' }, { t: 'monthly', day: 0 }, { t: 'monthly', day: 32 }, { t: 'monthly', day: 'x' }, { t: 'nope' }])
        assert.deepStrictEqual(H.normCycle(bad), D, JSON.stringify(bad));
    assert.deepStrictEqual(H.normCycle({ t: 'weekly', days: [5, 1, 1, 3, 9] }), { t: 'weekly', days: [1, 3, 5] });
    assert.deepStrictEqual(H.normCycle({ t: 'every', n: 3, start: '2026-10-01', extra: 1 }), { t: 'every', n: 3, start: '2026-10-01' });
    assert.deepStrictEqual(H.normCycle({ t: 'monthly', day: 31 }), { t: 'monthly', day: 31 });
    assert.ok(H.validDay('2024-02-29')); assert.ok(!H.validDay('2026-02-29')); assert.ok(!H.validDay('1999-01-01')); assert.ok(!H.validDay('2101-01-01')); assert.ok(!H.validDay(20260101)); assert.ok(!H.validDay('2026-13-01')); assert.ok(!H.validDay('2026-1-01'));
    ok('habit cycle: normCycle / validDay');
}
{
    // isDue
    assert.ok(H.isDue(undefined, '2026-10-10')); assert.ok(H.isDue({ t: 'daily' }, '2030-01-01'));
    const mwf = { t: 'weekly', days: [1, 3, 5] };
    assert.deepStrictEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'].map(d => H.isDue(mwf, d)), [false, true, false, true, false, true, false]);
    const e3 = { t: 'every', n: 3, start: '2026-10-01' };
    assert.deepStrictEqual(['2026-09-28', '2026-09-29', '2026-10-01', '2026-10-02', '2026-10-04', '2026-10-31', '2026-11-01'].map(d => H.isDue(e3, d)), [true, false, true, false, true, true, false]);   // 往前、跨月都對得上
    const m31 = { t: 'monthly', day: 31 };
    assert.ok(H.isDue(m31, '2026-10-31')); assert.ok(!H.isDue(m31, '2026-10-30')); assert.ok(H.isDue(m31, '2026-11-30')); assert.ok(!H.isDue(m31, '2026-11-29'));
    assert.ok(H.isDue(m31, '2026-02-28')); assert.ok(!H.isDue(m31, '2026-02-27')); assert.ok(H.isDue(m31, '2024-02-29')); assert.ok(!H.isDue(m31, '2024-02-28'));
    const m15 = { t: 'monthly', day: 15 }; assert.ok(H.isDue(m15, '2026-02-15')); assert.ok(!H.isDue(m15, '2026-02-28'));
    const m29 = { t: 'monthly', day: 29 }; assert.ok(H.isDue(m29, '2026-02-28')); assert.ok(!H.isDue(m29, '2024-02-28')); assert.ok(H.isDue(m29, '2024-02-29'));
    assert.ok(H.isDue(mwf, '2026-10-05'));
    assert.strictEqual(H.prevDue(mwf, '2026-10-10'), '2026-10-09'); assert.strictEqual(H.prevDue(mwf, '2026-10-05'), '2026-10-05'); assert.strictEqual(H.prevDue(mwf, '2026-10-04'), '2026-10-02');
    assert.strictEqual(H.prevDue({ t: 'every', n: 365, start: '2026-10-01' }, '2026-09-30'), '2025-10-01');
    assert.strictEqual(H.cycleLabel(null), '每天'); assert.strictEqual(H.cycleLabel(mwf), '每週 一、三、五'); assert.strictEqual(H.cycleLabel(e3), '每 3 天'); assert.strictEqual(H.cycleLabel(m15), '每月 15 日'); assert.ok(H.cycleLabel(m31).includes('月底'));
    // dueHabits：舊資料與壞週期都算每天
    const hs = [{ id: 'a', name: 'a', dates: [] }, { id: 'b', name: 'b', dates: [], cycle: mwf }, { id: 'c', name: 'c', dates: [], cycle: { t: 'weekly', days: 'x' } }];
    assert.deepStrictEqual(H.dueHabits(hs, '2026-10-10').map(h => h.id), ['a', 'c']); assert.deepStrictEqual(H.dueHabits(hs, '2026-10-09').map(h => h.id), ['a', 'b', 'c']);
    ok('habit cycle: isDue weekly / every / monthly (month-end, leap) / prevDue / dueHabits');
}
{
    const mwf = { t: 'weekly', days: [1, 3, 5] }, sat = '2026-10-10';
    // 向下相容：不給週期 = 每天
    assert.deepStrictEqual(H.streaks([], sat), { current: 0, longest: 0, total: 0 });
    assert.deepStrictEqual(H.streaks(['2026-10-10', '2026-10-09', '2026-10-08'], sat), { current: 3, longest: 3, total: 3 });
    // 週一三五：週六（非排程日）沒打 → 從週五往回算；週二、週四沒打不斷連
    assert.strictEqual(H.streaks(['2026-10-05', '2026-10-07', '2026-10-09'], sat, mwf).current, 3);
    assert.strictEqual(H.streaks(['2026-10-05', '2026-10-09'], sat, mwf).current, 1);          // 週三漏了 → 只剩週五
    assert.strictEqual(H.streaks(['2026-10-05', '2026-10-07'], sat, mwf).current, 0);          // 最近的排程日（週五）沒做 → 斷
    assert.strictEqual(H.streaks(['2026-10-05', '2026-10-07'], '2026-10-09', mwf).current, 2); // 今天（週五）還沒做，不算斷：從週三算
    assert.strictEqual(H.streaks(['2026-10-05', '2026-10-07', '2026-10-09'], '2026-10-09', mwf).current, 3);
    // 跨週、非排程日提前打卡不加分也不斷連
    assert.strictEqual(H.streaks(['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-06'], '2026-10-06', mwf).current, 4);   // 週二（10-06）是非排程日的額外打卡
    const r = H.streaks(['2026-09-28', '2026-09-30', '2026-10-05', '2026-10-06'], '2026-10-06', mwf);   // 10-02（週五）漏
    assert.deepStrictEqual([r.current, r.longest, r.total], [1, 2, 4]);
    // 每 3 天
    const e3 = { t: 'every', n: 3, start: '2026-10-01' };
    assert.strictEqual(H.streaks(['2026-10-01', '2026-10-04', '2026-10-07', '2026-10-10'], sat, e3).current, 4);
    assert.strictEqual(H.streaks(['2026-10-01', '2026-10-04', '2026-10-10'], sat, e3).current, 1);
    assert.strictEqual(H.streaks(['2026-10-01', '2026-10-04', '2026-10-07'], '2026-10-11', e3).current, 0);     // 最近排程日 10-10 沒做 → 斷
    assert.strictEqual(H.streaks(['2026-10-01', '2026-10-04', '2026-10-07'], sat, e3).current, 3);              // 今天 10-10 還沒做，不算斷
    // 每月 31 日：2 月月底算數
    const m31 = { t: 'monthly', day: 31 };
    assert.strictEqual(H.streaks(['2026-01-31', '2026-02-28', '2026-03-31'], '2026-04-15', m31).current, 3);
    assert.strictEqual(H.streaks(['2026-01-31', '2026-03-31'], '2026-04-15', m31).current, 1);
    // 最長紀錄只算排程日
    const L2 = H.streaks(['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-23', '2026-09-25'], '2026-10-10', mwf);
    assert.strictEqual(L2.longest, 4); assert.strictEqual(L2.total, 6); assert.strictEqual(L2.current, 0);
    // 全部打在非排程日：current / longest 都是 0，total 仍計
    assert.deepStrictEqual(H.streaks(['2026-10-06', '2026-10-08'], '2026-10-08', mwf), { current: 0, longest: 0, total: 2 });
    // 很久以前才有紀錄：不會當掉
    assert.strictEqual(H.streaks(['2001-01-01'], sat, mwf).current, 0);
    assert.strictEqual(H.streaks(['2026-10-09'], sat, { t: 'every', n: 365, start: '2026-10-01' }).current, 0);
    ok('habit cycle: streaks (weekly skip / every N / monthly month-end / longest / far past)');
}
{
    // 舊資料與載入驗證
    const old = H.normHabit({ id: 'a', name: '運動', dates: ['2026-10-01', '2026-10-02'] });
    assert.deepStrictEqual(old, { id: 'a', name: '運動', dates: ['2026-10-01', '2026-10-02'] });   // 每天不加欄位
    assert.strictEqual(H.normHabit({ id: 'a', name: 'x', dates: [], cycle: { t: 'weekly', days: [1] } }).cycle.t, 'weekly');
    assert.deepStrictEqual(H.normHabit({ id: 'a', name: 'x', dates: [], cycle: 'garbage' }), { id: 'a', name: 'x', dates: [] });
    assert.deepStrictEqual(H.normHabit({ id: 'a', name: 'x', dates: [], cycle: { t: 'every', n: 0 } }), { id: 'a', name: 'x', dates: [] });
    const c = H.normHabit({ id: 'w', name: '水', type: 'count', goal: 3, unit: 'l', logs: {}, cycle: { t: 'monthly', day: 5 } });
    assert.deepStrictEqual(c.cycle, { t: 'monthly', day: 5 }); assert.strictEqual(c.type, 'count');
    // 日期驗證：假日期、超出範圍、重複、亂序
    assert.deepStrictEqual(H.normHabit({ id: 'a', name: 'x', dates: ['2026-02-30', '0001-01-01', '9999-12-31', '2026-10-02', '2026-10-01', '2026-10-02'] }).dates, ['2026-10-01', '2026-10-02']);
    assert.deepStrictEqual(H.normHabit({ id: 'w', name: 'x', type: 'count', goal: 2, logs: { '2026-02-30': 5, '2026-10-01': 5 } }).logs, { '2026-10-01': 5 });
    // 上限：載入時只留最近 MAX_DATES 天
    const many = []; for (let i = 0; i < H.MAX_DATES + 50; i++) { const d = new Date(Date.UTC(2005, 0, 1) + i * 864e5); many.push(d.toISOString().slice(0, 10)); }
    const capped = H.normHabit({ id: 'a', name: 'x', dates: many });
    assert.strictEqual(capped.dates.length, H.MAX_DATES); assert.strictEqual(capped.dates.at(-1), many.at(-1)); assert.strictEqual(capped.dates[0], many[50]);
    const logs = {}; many.forEach(d => { logs[d] = 1; });
    const cl = H.normHabit({ id: 'w', name: 'x', type: 'count', goal: 1, logs });
    assert.strictEqual(Object.keys(cl.logs).length, H.MAX_DATES); assert.ok(!(many[0] in cl.logs)); assert.ok(many.at(-1) in cl.logs);
    // atDayCap：滿了不能加新日子，但已有的日子可以操作
    assert.ok(H.atDayCap(capped, '2026-10-10')); assert.ok(!H.atDayCap(capped, capped.dates[5])); assert.ok(!H.atDayCap(old, '2026-10-10'));
    assert.ok(H.atDayCap(cl, '2026-10-10')); assert.ok(!H.atDayCap(cl, many.at(-1)));
    assert.ok(H.MAX_DATES >= 3650 && H.MAX_HABITS === 50);
    // 備份還原的壞資料：整包都是垃圾也不炸
    const mapped = [null, 5, 'x', [], { name: 5 }, { name: 'ok', dates: { a: 1 }, cycle: 7 }, { name: 'ok2', type: 'count', goal: 'z', logs: [1], cycle: { t: 'weekly', days: null } }].map(H.normHabit).filter(Boolean);
    assert.strictEqual(mapped.length, 2); assert.strictEqual(mapped[1].goal, 1);
    ok('habit cycle: load validation / old data = daily / caps / garbage');
}

// ---------- 購物與保固記錄 ----------
const W = load('utils/warranty-log.html', 'WL, CATS, twToday, validDate, expiryOf, statusOf, sortItems, filterItems, statsOf, normItem, normList, checkForm, addItem, updateItem, removeItem, csvGuard, toCsv');
{
    // 台灣時間：UTC 16:00 之後已是隔天
    assert.strictEqual(W.twToday(Date.UTC(2026, 9, 10, 15, 59)), '2026-10-10'); assert.strictEqual(W.twToday(Date.UTC(2026, 9, 10, 16, 0)), '2026-10-11');
    assert.strictEqual(W.twToday(Date.UTC(2026, 11, 31, 16, 0)), '2027-01-01'); assert.strictEqual(W.twToday(Date.UTC(2024, 1, 28, 16, 0)), '2024-02-29');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(W.twToday()));
    // 到期日：月底進位、閏年、跨年
    assert.strictEqual(W.expiryOf('2026-01-31', 1), '2026-02-28'); assert.strictEqual(W.expiryOf('2024-01-31', 1), '2024-02-29');
    assert.strictEqual(W.expiryOf('2026-03-10', 36), '2029-03-10'); assert.strictEqual(W.expiryOf('2026-12-15', 1), '2027-01-15');
    assert.strictEqual(W.expiryOf('2026-08-31', 6), '2027-02-28'); assert.strictEqual(W.expiryOf('2024-02-29', 12), '2025-02-28'); assert.strictEqual(W.expiryOf('2024-02-29', 48), '2028-02-29');
    assert.strictEqual(W.expiryOf('2026-05-31', 1), '2026-06-30'); assert.strictEqual(W.expiryOf('2026-10-10', 0), '2026-10-10'); assert.strictEqual(W.expiryOf('2026-01-01', 600), '2076-01-01');
    assert.ok(W.validDate('2024-02-29')); assert.ok(!W.validDate('2026-02-29')); assert.ok(!W.validDate('1989-12-31')); assert.ok(!W.validDate('2101-01-01')); assert.ok(!W.validDate('')); assert.ok(!W.validDate(null)); assert.ok(!W.validDate('2026-1-1'));
    ok('warranty: twToday UTC+8 / expiry month-end clamp / validDate');
}
const T0 = '2026-10-10';
const mk = (o) => ({ id: o.id || o.name, name: o.name, cat: o.cat || '家電', date: o.date, price: o.price || 0, shop: o.shop || '', months: o.months ?? 12, loc: o.loc || '', note: o.note || '' });
{
    const st = (date, months) => W.statusOf(mk({ name: 'x', date, months }), T0);
    assert.deepStrictEqual(st('2025-10-10', 12), { key: 'soon', days: 0, expiry: '2026-10-10' });      // 到期當天仍在保固內
    assert.deepStrictEqual(st('2025-10-09', 12), { key: 'expired', days: -1, expiry: '2026-10-09' });
    assert.strictEqual(st('2025-11-09', 12).key, 'soon'); assert.strictEqual(st('2025-11-09', 12).days, 30);   // 剛好 30 天
    assert.strictEqual(st('2025-11-10', 12).key, 'ok'); assert.strictEqual(st('2025-11-10', 12).days, 31);
    assert.deepStrictEqual(st('2026-10-01', 0), { key: 'none', days: null, expiry: null });
    assert.strictEqual(st('2026-10-10', 1).expiry, '2026-11-10'); assert.strictEqual(st('2026-10-10', 1).days, 31);
    assert.strictEqual(st('2026-01-31', 1).key, 'expired');                                          // 2/28 到期
    ok('warranty: status expired / soon / ok / none boundaries');
}
{
    const items = [
        mk({ name: 'ok-far', date: '2026-01-01', months: 36 }), mk({ name: 'soon-late', date: '2025-11-20', months: 12 }), mk({ name: 'soon-early', date: '2025-10-15', months: 12 }),
        mk({ name: 'exp-old', date: '2020-01-01', months: 12 }), mk({ name: 'exp-recent', date: '2025-05-01', months: 12 }),
        mk({ name: 'none-old', date: '2020-01-01', months: 0 }), mk({ name: 'none-new', date: '2026-09-01', months: 0 }), mk({ name: 'ok-near', date: '2026-01-01', months: 12 }),
    ];
    assert.deepStrictEqual(W.sortItems(items, T0).map(x => x.name), ['soon-early', 'soon-late', 'ok-near', 'ok-far', 'exp-recent', 'exp-old', 'none-new', 'none-old']);
    assert.strictEqual(items[0].name, 'ok-far');                                                          // 不改動原陣列
    assert.deepStrictEqual(W.sortItems([], T0), []);
    // 同到期日：品名排序，穩定
    assert.deepStrictEqual(W.sortItems([mk({ name: 'b', date: '2026-01-01' }), mk({ name: 'a', date: '2026-01-01' })], T0).map(x => x.name), ['a', 'b']);
    // 搜尋 / 類別
    const f = [mk({ name: 'iPhone', cat: '3C 數位', shop: '蝦皮', note: 'SN123' }), mk({ name: '冰箱', cat: '家電', loc: '抽屜 A' }), mk({ name: 'Mac', cat: '3C 數位' })];
    assert.strictEqual(W.filterItems(f, '', '').length, 3); assert.deepStrictEqual(W.filterItems(f, 'IPHONE', '').map(x => x.name), ['iPhone']);
    assert.deepStrictEqual(W.filterItems(f, '蝦皮', '').map(x => x.name), ['iPhone']); assert.deepStrictEqual(W.filterItems(f, 'sn12', '').map(x => x.name), ['iPhone']);
    assert.deepStrictEqual(W.filterItems(f, '抽屜', '').map(x => x.name), ['冰箱']); assert.deepStrictEqual(W.filterItems(f, '', '3C 數位').map(x => x.name), ['iPhone', 'Mac']);
    assert.deepStrictEqual(W.filterItems(f, 'mac', '家電'), []); assert.strictEqual(W.filterItems(f, '  ', '').length, 3); assert.strictEqual(W.filterItems(f, null, undefined).length, 3);
    // 統計
    assert.deepStrictEqual(W.statsOf([], T0), { count: 0, total: 0, soon: 0, expired: 0 });
    const s = W.statsOf([mk({ name: 'a', date: '2025-10-15', price: 100.1 }), mk({ name: 'b', date: '2020-01-01', price: 200.2 }), mk({ name: 'c', date: '2026-01-01', months: 0, price: 0.3 })], T0);
    assert.deepStrictEqual(s, { count: 3, total: 300.6, soon: 1, expired: 1 });
    ok('warranty: sort order / search / category filter / stats');
}
{
    // 載入驗證
    assert.deepStrictEqual(W.normList(null), []); assert.deepStrictEqual(W.normList({}), []); assert.deepStrictEqual(W.normList('x'), []);
    const l = W.normList([null, 5, 'x', [], {}, { name: '', date: '2026-01-01' }, { name: 'a', date: 'bad' }, { name: 'a', date: '2026-02-30' },
        { id: 'k', name: ' 好 ', date: '2026-01-01', months: '24', price: '1999.999', cat: '不存在', shop: 9, note: 'n'.repeat(500), loc: 'l'.repeat(500) },
        { id: 'k', name: 'dup', date: '2026-01-01' }, { name: 'neg', date: '2026-01-01', months: -3, price: -5 }, { name: 'frac', date: '2026-01-01', months: 1.5, price: 'abc' }, { name: 'big', date: '2026-01-01', months: 99999, price: 1e12 }]);
    assert.strictEqual(l.length, 4);
    const k = l[0]; assert.deepStrictEqual([k.id, k.name, k.months, k.price, k.cat, k.shop], ['k', '好', 24, 2000, '其他', '']); assert.strictEqual(k.note.length, 200); assert.strictEqual(k.loc.length, 100);
    assert.deepStrictEqual(l.slice(1).map(x => [x.months, x.price]), [[0, 0], [0, 0], [0, 0]]); assert.ok(l.every(x => x.id));
    assert.strictEqual(W.normList(Array.from({ length: 600 }, (_, i) => ({ id: 'i' + i, name: 'n' + i, date: '2026-01-01' }))).length, 500);
    assert.strictEqual(new Set(W.normList([{ name: 'a', date: '2026-01-01' }, { name: 'b', date: '2026-01-01' }]).map(x => x.id)).size, 2);
    ok('warranty: normList garbage / caps / defaults');
}
{
    const good = { name: '冰箱', cat: '家電', date: '2026-01-31', months: '12', price: '25000', shop: '燦坤', loc: '抽屜', note: '' };
    assert.strictEqual(W.checkForm(good), ''); assert.strictEqual(W.checkForm({ ...good, price: '' }), ''); assert.strictEqual(W.checkForm({ ...good, months: '0' }), '');
    for (const bad of [{ name: '  ' }, { name: 'x'.repeat(61) }, { shop: 's'.repeat(41) }, { loc: 'l'.repeat(101) }, { note: 'n'.repeat(201) }, { date: '' }, { date: '2026-02-30' }, { months: '' }, { months: '-1' }, { months: '1.5' }, { months: '601' }, { months: 'abc' }, { price: '-1' }, { price: 'abc' }, { price: '1e10' }])
        assert.ok(W.checkForm({ ...good, ...bad }), JSON.stringify(bad));
    const a = W.addItem([], good, 'id1'); assert.strictEqual(a.err, ''); assert.deepStrictEqual(a.list[0], { id: 'id1', name: '冰箱', cat: '家電', date: '2026-01-31', price: 25000, shop: '燦坤', months: 12, loc: '抽屜', note: '', cons: [] });
    assert.strictEqual(W.addItem([], { ...good, price: '' }).list[0].price, 0);
    assert.ok(W.addItem([], { ...good, name: '' }).err); assert.strictEqual(W.addItem([], { ...good, name: '' }).list.length, 0);
    // 上限 500：拒絕新增，不刪舊的
    const full = Array.from({ length: W.WL.MAX }, (_, i) => mk({ id: 'f' + i, name: 'n' + i, date: '2026-01-01' }));
    const r = W.addItem(full, good); assert.ok(r.err.includes('500')); assert.strictEqual(r.list, full); assert.strictEqual(r.list.length, 500);
    assert.strictEqual(W.updateItem(full, 'f3', good).err, '');                                            // 滿了仍可修改
    // 用 id 修改 / 刪除（排序、篩選後都不會錯）
    const list = W.addItem(W.addItem([], { ...good, name: 'A' }, 'a').list, { ...good, name: 'B' }, 'b').list;
    const u = W.updateItem(list, 'b', { ...good, name: 'B2', months: '6' }); assert.deepStrictEqual(u.list.map(x => x.name), ['A', 'B2']); assert.strictEqual(u.list[1].id, 'b'); assert.strictEqual(u.list[1].months, 6);
    assert.ok(W.updateItem(list, 'zzz', good).err); assert.ok(W.updateItem(list, 'a', { ...good, name: '' }).err); assert.deepStrictEqual(list.map(x => x.name), ['A', 'B']);
    assert.deepStrictEqual(W.removeItem(list, 'a').map(x => x.id), ['b']); assert.strictEqual(W.removeItem(list, 'nope').length, 2); assert.deepStrictEqual(W.removeItem(W.removeItem(list, 'a'), 'b'), []);
    ok('warranty: form check / add / cap 500 / update / remove by id');
}
{
    assert.strictEqual(W.csvGuard('=SUM(A1)'), "'=SUM(A1)"); assert.strictEqual(W.csvGuard('+1'), "'+1"); assert.strictEqual(W.csvGuard('-1'), "'-1"); assert.strictEqual(W.csvGuard('@x'), "'@x"); assert.strictEqual(W.csvGuard('ok'), 'ok'); assert.strictEqual(W.csvGuard(null), '');
    const csv = W.toCsv([mk({ id: '1', name: '=evil, "q"', date: '2025-10-15', shop: 'a\nb', note: '@n', price: 1234.5 }), mk({ id: '2', name: '無保固品', date: '2026-01-01', months: 0 }), mk({ id: '3', name: '過期', date: '2020-01-01' })], T0);
    const rows = Util.parseCSV(csv);
    assert.strictEqual(rows.length, 4); assert.deepStrictEqual(rows[0], ['品名', '類別', '購買日', '價格', '店家', '保固月數', '保固到期日', '狀態', '發票/保固卡位置', '備註']);
    assert.deepStrictEqual(rows[1], ["'=evil, \"q\"", '家電', '2025-10-15', '1234.5', 'a\nb', '12', '2026-10-15', '30 天內到期', '', "'@n"]);   // 逗號、引號、換行都正確跳脫
    assert.strictEqual(rows[2][7], '已過期'); assert.strictEqual(rows[2][6], '2021-01-01'); assert.strictEqual(rows[3][7], '無保固'); assert.strictEqual(rows[3][6], '');
    assert.strictEqual(W.toCsv([], T0), '品名,類別,購買日,價格,店家,保固月數,保固到期日,狀態,發票/保固卡位置,備註');
    ok('warranty: CSV escaping / formula guard / columns');
}
