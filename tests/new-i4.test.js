// 批次 i4：薪資試算新增分頁（勞健保勞退 / 假勤資遣 / Offer 與薪資檢查）的純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');
const m = load('utils/salary-calc.html', 'RATES, LABOR_TIERS, HEALTH_TIERS, tierUp, laborPremium, healthPremium, suppPremium, pensionEst, arrears, annualLeave, noticeDays, severance, unemployment, maternity, childcare, leaveDeduct, otVsComp, offerTotal, pctFrom, raiseEffect, inflate, slipCheck');

{ // 級距邊界
    const t = (s) => m.laborPremium(s).insured;
    assert.strictEqual(t(0), 0); assert.strictEqual(t(-5), 0); assert.strictEqual(t(1), 29500); assert.strictEqual(t(29500), 29500); assert.strictEqual(t(29501), 30300);
    assert.strictEqual(t(43900), 43900); assert.strictEqual(t(43901), 45800); assert.strictEqual(t(45800), 45800); assert.strictEqual(t(45801), 45800); assert.strictEqual(t(1e9), 45800);
    const h = (s) => m.healthPremium(s).insured;
    assert.strictEqual(h(45801), 48200); assert.strictEqual(h(313000), 313000); assert.strictEqual(h(1e9), 313000); assert.strictEqual(h(150001), 156400);
    assert.ok(m.HEALTH_TIERS.every((v, i, a) => i === 0 || v > a[i - 1]));
    const L = m.laborPremium(45000);
    assert.deepStrictEqual([L.total, L.emp, L.er, L.gov], [5725, 1145, 4008, 573]);
    const H = m.healthPremium(45000, 2);
    assert.strictEqual(H.one, 710); assert.strictEqual(H.emp, 2130); assert.strictEqual(m.healthPremium(45000, 9).emp, 710 * 4); assert.strictEqual(m.healthPremium(45000, -1).emp, 710);
    assert.strictEqual(H.er, Math.round(45800 * 0.0517 * 0.6 * 1.57));
    assert.deepStrictEqual(m.laborPremium(0), { insured: 0, total: 0, emp: 0, er: 0, gov: 0 });
    ok('i4: 勞保 / 健保級距與負擔');
}
{ // 補充保費
    const S = (o) => m.suppPremium(o);
    assert.deepStrictEqual(S({ kind: 'bonus', amount: 200000, cum: 0, insured: 45800 }), { base: 200000 - 183200, fee: Math.round(16800 * 0.0211) });
    assert.strictEqual(S({ kind: 'bonus', amount: 100000, cum: 0, insured: 45800 }).fee, 0);
    assert.strictEqual(S({ kind: 'bonus', amount: 100000, cum: 150000, insured: 45800 }).base, 250000 - 183200);   // 累計已超過部分只計超過的新增
    assert.strictEqual(S({ kind: 'bonus', amount: 100000, cum: 300000, insured: 45800 }).base, 100000);
    assert.strictEqual(S({ kind: 'parttime', amount: 29499 }).fee, 0); assert.strictEqual(S({ kind: 'parttime', amount: 29500 }).fee, Math.round(29500 * 0.0211));
    assert.strictEqual(S({ kind: 'other', amount: 19999 }).fee, 0); assert.strictEqual(S({ kind: 'other', amount: 20000 }).fee, 422);
    assert.strictEqual(S({ kind: 'other', amount: 5e7 }).base, 1e7); assert.strictEqual(S({ kind: 'other', amount: -1 }).fee, 0); assert.strictEqual(S({ kind: 'other', amount: 0 }).fee, 0);
    ok('i4: 補充保費門檻與上限');
}
{ // 勞退 / 欠費
    const P = m.pensionEst({ salary: 45000, selfPct: 0, age: 30, retAge: 60, rate: 0, payYears: 20 });
    assert.strictEqual(P.wage, 45800); assert.strictEqual(P.er, 2748); assert.strictEqual(P.months, 360); assert.strictEqual(P.principal, 2748 * 360); near(P.fv, 2748 * 360); near(P.monthly, 2748 * 360 / 240);
    const P2 = m.pensionEst({ salary: 45000, selfPct: 6, age: 30, retAge: 60, rate: 0.02, payYears: 20 });
    assert.strictEqual(P2.self, 2748); assert.ok(P2.fv > P2.principal); assert.ok(P2.monthly > 0);
    assert.strictEqual(m.pensionEst({ salary: 1e9, selfPct: 99, age: 30, retAge: 60, rate: 0, payYears: 1 }).self, 9000);          // 提繳工資上限 150,000，自提 clamp 6%
    assert.strictEqual(m.pensionEst({ salary: 0, age: 30, retAge: 60, rate: 0.02, payYears: 20 }).fv, 0);
    const P3 = m.pensionEst({ salary: 45000, age: 60, retAge: 55, rate: 0.02, payYears: 0 }); assert.strictEqual(P3.months, 0); assert.strictEqual(P3.monthly, 0);
    near(m.pensionEst({ salary: 45000, age: 59, retAge: 60, rate: 0.02, payYears: 1 }).fv, 2748 * ((Math.pow(1.02, 1) - 1) / (Math.pow(1.02, 1 / 12) - 1)));
    assert.strictEqual(m.arrears({ prem: 1000, n: 1, days: 15, cap: 0.15 }).fee, 0); assert.strictEqual(m.arrears({ prem: 1000, n: 1, days: 16, cap: 0.15 }).fee, 1);
    assert.strictEqual(m.arrears({ prem: 1000, n: 1, days: 1000, cap: 0.15 }).fee, 150); assert.strictEqual(m.arrears({ prem: 1000, n: 1, days: 1000, cap: 0.05 }).fee, 50);
    const A = m.arrears({ prem: 1500, n: 3, days: 75, cap: 0.15 }); assert.strictEqual(A.principal, 4500); assert.strictEqual(A.fee, 90 + 45 + 0); assert.strictEqual(A.total, 4635);
    assert.strictEqual(m.arrears({ prem: 1500, n: 0, days: 75, cap: 0.15 }).total, 0); assert.ok(m.arrears({ prem: 1, n: 1e9, days: 0, cap: 0.15 }).principal <= 120);
    ok('i4: 勞退累積 / 健保欠費滯納金');
}
{ // 特休 / 預告 / 資遣 / 失業
    const exp = [[0, 0], [5, 0], [6, 3], [11, 3], [12, 7], [23, 7], [24, 10], [35, 10], [36, 14], [59, 14], [60, 15], [119, 15], [120, 16], [132, 17], [288, 30], [10000, 30]];
    exp.forEach(([mo, d]) => assert.strictEqual(m.annualLeave(mo), d, 'leave ' + mo));
    [[0, 0], [2, 0], [3, 10], [11, 10], [12, 20], [35, 20], [36, 30], [600, 30]].forEach(([mo, d]) => assert.strictEqual(m.noticeDays(mo), d, 'notice ' + mo));
    const S = m.severance({ oldMonths: 0, newMonths: 36, avg: 40000 }); assert.strictEqual(S.nw, 60000); assert.strictEqual(S.old, 0);
    assert.strictEqual(m.severance({ oldMonths: 0, newMonths: 6, avg: 36000 }).total, 9000);
    assert.strictEqual(m.severance({ oldMonths: 0, newMonths: 1000, avg: 40000 }).nw, 240000);          // 新制最高 6 個月
    assert.strictEqual(m.severance({ oldMonths: 24, newMonths: 0, avg: 40000 }).total, 80000);
    assert.strictEqual(m.severance({ oldMonths: 120, newMonths: 36, avg: 30000 }).total, 300000 + 45000);
    assert.strictEqual(m.severance({ oldMonths: 0, newMonths: 0, avg: 40000 }).total, 0); assert.strictEqual(m.severance({ oldMonths: -3, newMonths: -3, avg: 100 }).total, 0);
    const U = m.unemployment({ insured: 45800, months: 36, mid: true, deps: 2 }); assert.strictEqual(U.monthly, 36640); assert.strictEqual(U.pays, 9); assert.strictEqual(U.total, 36640 * 9); assert.ok(U.eligible);
    assert.strictEqual(m.unemployment({ insured: 45800, months: 36, mid: false, deps: 5 }).pct, 0.8);
    assert.strictEqual(m.unemployment({ insured: 30000, months: 11, mid: false, deps: 0 }).eligible, false); assert.strictEqual(m.unemployment({ insured: 30000, months: 12, mid: false, deps: 0 }).eligible, true);
    assert.strictEqual(m.unemployment({ insured: 30000, months: 12, mid: false, deps: 0 }).monthly, 18000); assert.strictEqual(m.unemployment({ insured: 0, months: 0, mid: false, deps: 0 }).total, 0);
    ok('i4: 特休 / 預告期 / 資遣費 / 失業給付');
}
{ // 產假 / 請假 / 補休
    assert.strictEqual(m.maternity({ wage: 30000, months: 6, kind: 'birth' }).pay, 56000); assert.strictEqual(m.maternity({ wage: 30000, months: 5, kind: 'birth' }).pay, 28000);
    assert.strictEqual(m.maternity({ wage: 30000, months: 24, kind: 'miscarry2' }).days, 7); assert.strictEqual(m.maternity({ wage: 30000, months: 24, kind: 'x' }).pay, 0);
    assert.strictEqual(m.childcare({ insured: 40000, months: 6, pct: 0.8 }), 192000); assert.strictEqual(m.childcare({ insured: 0, months: 6, pct: 0.8 }), 0);
    const D = m.leaveDeduct({ monthly: 30000, sick: 2, personal: 1, menstrual: 1 }); assert.strictEqual(D.day, 1000); assert.strictEqual(D.deduct, 1000 + 1000 + 500); assert.deepStrictEqual(D.warns, []);
    assert.strictEqual(m.leaveDeduct({ monthly: 30000, menstrual: 5 }).deduct, 3 * 500 + 2 * 500);       // 3 天不併入、2 天併入病假，皆半薪
    const big = m.leaveDeduct({ monthly: 30000, sick: 31, personal: 15 }); assert.strictEqual(big.deduct, 30 * 500 + 1000 + 15000); assert.strictEqual(big.warns.length, 2);
    assert.strictEqual(m.leaveDeduct({ monthly: 30000, personal: 14 }).warns.length, 0); assert.strictEqual(m.leaveDeduct({ monthly: 0, sick: 5 }).deduct, 0);
    const O = m.otVsComp({ monthly: 24000, kind: 'weekday', perDay: 2, days: 5 }); near(O.pay, 100 * 2 * 1.34 * 5); assert.strictEqual(O.hours, 10); assert.strictEqual(O.compValue, 1000); near(O.diff, 340);
    assert.strictEqual(m.otVsComp({ monthly: 24000, kind: 'weekday', perDay: 6, days: 1 }).hours, 4);   // 超過每日上限的部分不計
    assert.strictEqual(m.otVsComp({ monthly: 0, kind: 'rest', perDay: 3, days: 1 }).pay, 0);
    ok('i4: 產假 / 請假扣薪 / 加班 vs 補休');
}
{ // Offer / 加薪 / 通膨
    assert.deepStrictEqual(m.offerTotal({ base: 50000, months: 2, bonus: 0, allow: 0, welfare: 0 }), { year: 700000, monthly: 700000 / 12 });
    assert.strictEqual(m.offerTotal({ base: 55000, months: 1, bonus: 10000, allow: 2000, welfare: 5000 }).year, 55000 * 13 + 10000 + 24000 + 5000);
    assert.strictEqual(m.offerTotal({ base: -1, months: -1, bonus: -1, allow: -1, welfare: -1 }).year, 0); assert.ok(m.offerTotal({ base: 1e9, months: 12, bonus: 0, allow: 0, welfare: 0 }).year > 2e10);
    near(m.pctFrom(40000, 42000), 5); assert.strictEqual(m.pctFrom(0, 5), 0); near(m.pctFrom(40000, 36000), -10);
    const R = m.raiseEffect({ cur: 40000, pct: 10, months: 2 }); near(R.nw, 44000); near(R.diff, 4000); near(R.yearDiff, 56000); near(R.hourlyNew, 44000 / 240);
    assert.strictEqual(R.pensionDiff, 2748 - 2406);
    assert.strictEqual(m.raiseEffect({ cur: 0, pct: 5, months: 2 }).nw, 0); assert.strictEqual(m.raiseEffect({ cur: 45000, pct: 0, months: 2 }).insDiff, 0);
    near(m.inflate(40000, 2, 5), 40000 * Math.pow(1.02, 5)); assert.strictEqual(m.inflate(40000, 0, 5), 40000); assert.strictEqual(m.inflate(40000, 3, 0), 40000);
    ok('i4: Offer / 加薪 / 通膨');
}
{ // 薪資單檢查
    const base = { gross: 45000, insuredBase: 0, labor: 1145, health: 710, pension: 0, tax: 0, deps: 0 };
    const lv = (o) => m.slipCheck({ ...base, ...o }).map(x => x.level);
    assert.deepStrictEqual(lv({}), ['ok', 'ok', 'ok', 'ok']);
    assert.strictEqual(lv({ labor: 1200 })[0], 'bad'); assert.strictEqual(lv({ labor: 1050 })[0], 'warn');   // 1050 = 42,000 級距
    assert.strictEqual(lv({ health: 2130, deps: 2 })[1], 'ok'); assert.strictEqual(lv({ health: 0 })[1], 'bad');
    assert.strictEqual(lv({ pension: 2748 })[2], 'ok'); assert.strictEqual(lv({ pension: 2800 })[2], 'bad');
    assert.strictEqual(lv({ tax: 2250 })[3], 'ok'); assert.strictEqual(lv({ tax: 4500 })[3], 'warn'); assert.strictEqual(lv({ tax: 20000 })[3], 'bad');
    assert.strictEqual(lv({ gross: 0, tax: 0, labor: 0, health: 0 })[3], 'ok');
    assert.strictEqual(m.slipCheck({ ...base, insuredBase: 30300, labor: 758, health: 471 })[0].level, 'ok');
    ok('i4: 薪資單檢查');
}
