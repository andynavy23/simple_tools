// n6 批次：home-calc 與 fuel-log 輪胎規格解讀的純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

{
    const H = load('utils/home-calc.html', 'fertMix, potSoil, compostMix, compostRatio, tankWater, dose, windChill, heatIndex, heatLevel, dewPoint, absHumidity, condRisk, AQI_TW, AQI_US, pmToAqi, aqiToPm, aqiLevel, co2Level, co2Vent, acNeed, lightNeed, rectFits, doorCheck, cornerMax, cornerCheck, elevCheck, petFeed, diaperDaily, diaperPlan, normOpts');
    // 肥料
    let f = H.fertMix(20, 20, 20, 1000, 2); near(f.perL, 1); near(f.total, 2); near(f.ppm[0], 200); assert.deepStrictEqual(f.ratio, [1, 1, 1]);
    f = H.fertMix(30, 10, 10, 500, NaN); near(f.ppm[0], 600); near(f.ratio[0], 3);
    f = H.fertMix(20, 20, 20, NaN, 1, 100); near(f.dil, 2000);
    f = H.fertMix(0, 10, 10, 1000, 1); assert.ok(f && f.ratio[0] === 0);
    assert.strictEqual(H.fertMix(0, 10, 10, 1000, 1, 100), null);
    assert.strictEqual(H.fertMix(0, 0, 0, 1000, 1), null); assert.strictEqual(H.fertMix(20, 20, 20, 0, 1), null); assert.strictEqual(H.fertMix(120, 1, 1, 100, 1), null); assert.strictEqual(H.fertMix(20, 20, 20, NaN, 1), null);
    // 盆土
    let p = H.potSoil('round', 20, 20, 20, 0, 0, 25); near(p.soil, Math.PI * 100 * 20 / 1000); near(p.bags, p.soil / 25);
    p = H.potSoil('rect', 50, 20, 20, 2, 2, NaN); near(p.total, 20); near(p.drain, 2); near(p.soil, 16);
    p = H.potSoil('round', 20, 10, 15, 0, 0); near(p.total, Math.PI * 15 / 3 * (100 + 50 + 25) / 1000);
    p = H.potSoil('round', 20, 10, 15, 3, 2); assert.ok(p.soil > 0 && p.soil + p.drain < p.total);
    assert.strictEqual(H.potSoil('round', 20, 10, 10, 6, 5), null); assert.strictEqual(H.potSoil('round', 0, 10, 10, 0, 0), null); assert.strictEqual(H.potSoil('round', NaN, 10, 10, 0, 0), null);
    // 堆肥
    let c = H.compostMix('枯葉,60,2\n廚餘,15,1\n壞行\n,1,1\nx,0,1\ny,abc,2'); assert.strictEqual(c.rows.length, 2); near(c.cn, 3 / (2 / 60 + 1 / 15));
    near(H.compostMix('a,30,5').cn, 30); assert.strictEqual(H.compostMix(''), null); assert.strictEqual(H.compostMix(null), null);
    near(H.compostRatio(15, 60, 30), 2); near(H.compostMix('b,60,2\ng,15,1').cn, 30);
    assert.strictEqual(H.compostRatio(40, 60, 30), null); assert.strictEqual(H.compostRatio(15, 25, 30), null);
    // 水族
    let t = H.tankWater(60, 30, 36, 3, 10, 25); near(t.full, 64.8); near(t.water, 60 * 30 * 33 / 1000 * 0.9); near(t.change, t.water / 4);
    assert.ok(isNaN(H.tankWater(60, 30, 36, 3, 10, 0).change)); assert.strictEqual(H.tankWater(60, 30, 36, 40, 0, 25), null);
    let d = H.dose(60, 10, 1, 2, 10); near(d.label, 6); near(d.byPpm, 12);
    d = H.dose(100, NaN, NaN, 2, 10); assert.ok(isNaN(d.label)); near(d.byPpm, 20); assert.strictEqual(H.dose(0, 1, 1), null);
    // 風寒 / 熱指數
    near(H.windChill(-10, 20), -17.86, 0.005); assert.ok(isNaN(H.windChill(15, 20)) && isNaN(H.windChill(0, 4)));
    assert.strictEqual(Math.round(H.windChill(0, 10)), -3);
    const hiF = (tf, rh) => H.heatIndex((tf - 32) * 5 / 9, rh) * 9 / 5 + 32;
    assert.ok(Math.abs(hiF(90, 70) - 106) <= 1, String(hiF(90, 70))); assert.ok(Math.abs(hiF(90, 50) - 95) <= 1, String(hiF(90, 50)));
    assert.ok(isNaN(H.heatIndex(20, 50)) && isNaN(H.heatIndex(30, 120)));
    assert.strictEqual(H.heatLevel(30), '注意（久站活動可能疲勞）'); assert.ok(H.heatLevel(45).startsWith('危險')); assert.strictEqual(H.heatLevel(20), '');
    // 露點
    near(H.dewPoint(25, 60), 16.7, 0.01); near(H.dewPoint(20, 100), 20, 1e-9); near(H.dewPoint(30, 50), 18.4, 0.01); assert.ok(isNaN(H.dewPoint(20, 0)));
    near(H.absHumidity(25, 60), 13.8, 0.01); near(H.absHumidity(20, 100), 17.3, 0.01);
    assert.ok(H.condRisk(16.7, 16).startsWith('會結露') && H.condRisk(16.7, 18).startsWith('接近') && H.condRisk(16.7, 25).startsWith('暫無'));
    // AQI
    const TW = H.AQI_TW, US = H.AQI_US;
    assert.strictEqual(H.pmToAqi(15.4, TW), 50); assert.strictEqual(H.pmToAqi(15.5, TW), 51); assert.strictEqual(H.pmToAqi(35.4, TW), 100);
    assert.strictEqual(H.pmToAqi(35.5, TW), 101); assert.strictEqual(H.pmToAqi(25, TW), 74); assert.strictEqual(H.pmToAqi(0, TW), 0);
    assert.strictEqual(H.pmToAqi(500.4, TW), 500); assert.ok(isNaN(H.pmToAqi(600, TW))); assert.ok(isNaN(H.pmToAqi(-1, TW)));
    assert.strictEqual(H.pmToAqi(9.0, US), 50); assert.strictEqual(H.pmToAqi(35.4, US), 100); assert.strictEqual(H.pmToAqi(55.4, US), 150); assert.strictEqual(H.pmToAqi(12, US), 56);
    assert.strictEqual(H.aqiToPm(50, TW), 15.4); assert.strictEqual(H.aqiToPm(100, TW), 35.4); assert.strictEqual(H.aqiToPm(500, TW), 500.4); assert.strictEqual(H.aqiToPm(0, TW), 0);
    assert.ok(isNaN(H.aqiToPm(501, TW)));
    for (const x of [3, 20, 40, 100, 200]) assert.ok(Math.abs(H.pmToAqi(H.aqiToPm(x, TW), TW) - x) <= 1);
    assert.deepStrictEqual([50, 51, 100, 101, 150, 151, 200, 201, 300, 301].map(H.aqiLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
    // CO2
    assert.strictEqual(H.co2Level(500), '良好'); assert.strictEqual(H.co2Level(900), '尚可'); assert.ok(H.co2Level(1200).includes('通風')); assert.strictEqual(H.co2Level(NaN), '');
    let v = H.co2Vent(1, 30, 420, 1000); near(v.flow, 32.28, 0.001); near(v.rate, 624, 0.001); near(v.hours, 580 / 624);
    assert.strictEqual(H.co2Vent(1, 30, 420, 400), null); assert.strictEqual(H.co2Vent(0, 30, 420, 1000), null);
    // 冷氣 / 照度
    let a = H.acNeed(6, 'low', 'mid', 2, 0); near(a.kw, 3.6); assert.strictEqual(a.model, 3.6);
    a = H.acNeed(10, 'high', 'top', 4, 500); near(a.kw, 10 * 0.6 * 1.2 * 1.15 + 0.2 + 0.5); near(a.tons, a.kw / 3.517);
    assert.strictEqual(H.acNeed(100, 'low', 'mid', 2, 0).model, null); assert.strictEqual(H.acNeed(0, 'low', 'mid', 2, 0), null); near(H.acNeed(6, 'x', 'y', NaN, NaN).kw, 3.96);
    let l = H.lightNeed(150, 6, 0.5, 800); near(l.m2, 6 * 3.305785); near(l.lm, 150 * 6 * 3.305785 / 0.5);
    assert.strictEqual(l.lamps, Math.ceil(l.lm / 800)); assert.strictEqual(H.lightNeed(150, 6, 1.5, 800), null); assert.strictEqual(H.lightNeed(0, 6, 0.5, 800), null);
    // 家具
    assert.ok(H.rectFits(50, 40, 60, 45)); assert.ok(!H.rectFits(50, 50, 60, 45)); assert.ok(H.rectFits(140, 1, 100, 100)); assert.ok(!H.rectFits(141, 1, 100, 100));
    assert.ok(H.rectFits(40, 50, 45, 60) && !H.rectFits(NaN, 1, 1, 1) && !H.rectFits(0, 1, 5, 5));
    assert.ok(H.rectFits(100, 100, 100, 100)); assert.ok(!H.rectFits(101, 100, 100, 100)); assert.ok(H.rectFits(160, 10, 150, 80));
    let dc = H.doorCheck([200, 90, 80], 80, 200, 0); assert.ok(dc.ok && !dc.tilt);
    dc = H.doorCheck([200, 100, 90], 80, 200, 0); assert.ok(!dc.ok);
    dc = H.doorCheck([300, 120, 30], 90, 200, 0); assert.ok(dc.ok && !dc.tilt);
    dc = H.doorCheck([200, 80, 60], 80, 200, 5); assert.ok(dc.ok);
    dc = H.doorCheck([200, 80, 80], 80, 200, 5); assert.ok(!dc.ok);
    dc = H.doorCheck([200, 190, 100], 80, 200, 0); assert.ok(!dc.ok);
    dc = H.doorCheck([500, 140, 1], 100, 100, 0); assert.ok(dc.ok && dc.tilt);
    assert.strictEqual(H.doorCheck([NaN, 1, 1], 80, 200), null);
    near(H.cornerMax(100, 100, 0), 100 * 2 ** 1.5, 0.001); near(H.cornerMax(100, 100, 20), 100 * 2 ** 1.5 - 40, 0.001);
    near(H.cornerMax(60, 120, 0), Math.pow(60 ** (2 / 3) + 120 ** (2 / 3), 1.5), 0.001);
    assert.ok(isNaN(H.cornerMax(80, 80, 80))); assert.ok(isNaN(H.cornerMax(80, 80, 100)));
    let cc = H.cornerCheck([200, 90, 80], 90, 90, 220, 0); assert.ok(cc.ok); near(cc.mx, 90 * 2 ** 1.5 - 160, 0.001);
    assert.strictEqual(H.cornerCheck([300, 100, 100], 90, 90, 220, 0), null);
    cc = H.cornerCheck([300, 60, 60], 90, 90, 220, 0); assert.ok(!cc.ok); near(cc.mx, 90 * 2 ** 1.5 - 120, 0.001);
    cc = H.cornerCheck([150, 60, 40], 90, 90, 220, 0); assert.ok(cc.ok);
    assert.strictEqual(H.cornerCheck([300, 50, 50], 90, 90, 40, 0), null);
    let el = H.elevCheck([200, 90, 80], 80, 210, 110, 140, 230, 0); assert.ok(el.ok && el.door.ok && el.car);
    el = H.elevCheck([220, 90, 80], 80, 210, 110, 140, 210, 0); assert.ok(el.door.ok && !el.car && !el.ok);
    assert.ok(H.elevCheck([220, 90, 80], 80, 210, 110, 140, 230, 0).car);
    // 寵物
    let pf = H.petFeed('dog', 10, 'neuter', 350, 2); near(pf.rer, 70 * 10 ** 0.75); near(pf.der, pf.rer * 1.6); near(pf.grams, pf.der / 3.5); near(pf.perMeal, pf.grams / 2); near(pf.grams, 179.9, 0.001);
    pf = H.petFeed('cat', 4, 'neuter', 400, NaN); near(pf.der, 70 * 4 ** 0.75 * 1.2); assert.ok(isNaN(pf.perMeal));
    assert.strictEqual(H.petFeed('cat', 4, 'bad', 400, 2), null); assert.strictEqual(H.petFeed('fish', 4, 'neuter', 400, 2), null); assert.strictEqual(H.petFeed('dog', -1, 'neuter', 350, 2), null); assert.strictEqual(H.petFeed('dog', 10, 'neuter', 0, 2), null);
    near(H.petFeed('dog', 16, 'neuter', 100, 2).rer, 560);
    // 尿布
    assert.deepStrictEqual([0, 0.5, 1, 2.9, 3, 5, 6, 11, 12, 23, 24, 35, 36, 60].map(H.diaperDaily), [11, 11, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4]); assert.ok(isNaN(H.diaperDaily(-1)));
    let dp = H.diaperPlan(4, 5, NaN, 64, 520); near(dp.nowDay, 8); near(dp.monthPcs, 240); assert.strictEqual(dp.monthPacks, 4); near(dp.monthCost, 240 * 520 / 64); near(dp.unit, 8.125); near(dp.cost, dp.monthCost);
    dp = H.diaperPlan(0, 2, 10, 50, 500); near(dp.pieces, 600); assert.strictEqual(dp.packs, 12); near(dp.cost, 6000);
    dp = H.diaperPlan(0, 3, NaN, 100, 1000); near(dp.pieces, (11 + 9 + 9) * 30);
    assert.strictEqual(H.diaperPlan(5, 5, NaN, 64, 520), null); assert.strictEqual(H.diaperPlan(0, 99, NaN, 64, 520), null); assert.strictEqual(H.diaperPlan(0, 5, NaN, 0, 520), null);
    // 還原驗證
    assert.deepStrictEqual(H.normOpts(null, ['a']), { tab: 0, v: {} }); assert.deepStrictEqual(H.normOpts({ tab: 9, v: [] }, ['a']), { tab: 0, v: {} });
    assert.deepStrictEqual(H.normOpts({ tab: 6, v: { a: '1', b: '2', c: 3 } }, ['a', 'c']), { tab: 6, v: { a: '1' } });
    assert.strictEqual(H.normOpts({ v: { a: 'x'.repeat(2001) } }, ['a']).v.a, undefined);
    ok('home-calc pure');
}

{
    const F = load('utils/fuel-log.html', 'LOAD_INDEX, SPEED_SYM, loadKg, parseTire, tireCompare');
    let t = F.parseTire('205/55R16 91V');
    assert.deepStrictEqual([t.w, t.a, t.rim, t.li, t.kg, t.sp, t.kmh], [205, 55, 16, 91, 615, 'V', 240]);
    near(t.side, 112.75); near(t.dia, 631.9, 1e-9); near(t.circ, Math.PI * t.dia);
    t = F.parseTire(' 225/45zr17 94w '); assert.deepStrictEqual([t.w, t.a, t.rim, t.li, t.kg, t.sp, t.kmh], [225, 45, 17, 94, 670, 'W', 270]);
    t = F.parseTire('P215/65R15'); assert.ok(t.li === null && t.kg === null && t.sp === null && t.kmh === null); near(t.dia, 15 * 25.4 + 2 * 215 * 0.65);
    t = F.parseTire('195 65 15 91 H'); assert.ok(t && t.w === 195 && t.kg === 615 && t.kmh === 210);
    t = F.parseTire('185/60-14 82T'); assert.ok(t && t.kg === 475 && t.kmh === 190);
    for (const bad of ['', null, undefined, 'abc', '205/55R', '20/55R16', '205/5R16', '205/55R99', '205/55R16 91', '1000/55R16', '205/55R16 91VV']) assert.strictEqual(F.parseTire(bad), null, String(bad));
    const K = { 60: 250, 70: 335, 80: 450, 85: 515, 88: 560, 90: 600, 91: 615, 94: 670, 95: 690, 100: 800, 105: 925, 110: 1060, 120: 1400 };
    for (const [i, kg] of Object.entries(K)) assert.strictEqual(F.loadKg(+i), kg, i);
    assert.strictEqual(F.LOAD_INDEX.length, 61); for (let i = 1; i < 61; i++) assert.ok(F.LOAD_INDEX[i] > F.LOAD_INDEX[i - 1]);
    assert.strictEqual(F.loadKg(59), null); assert.strictEqual(F.loadKg(121), null); assert.strictEqual(F.loadKg(NaN), null); assert.strictEqual(F.loadKg(91.5), null);
    assert.deepStrictEqual(Object.values(F.SPEED_SYM), [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 240, 270, 300]);
    assert.strictEqual(F.parseTire('205/55R16 91Z').kmh, null);
    let c = F.tireCompare(F.parseTire('205/55R16'), F.parseTire('215/50R17'));
    near(c.diff, 14.9, 1e-9); near(c.pct, 14.9 / 631.9 * 100, 1e-9); near(c.actual100, 102.358, 0.0001);
    c = F.tireCompare(F.parseTire('205/55R16'), F.parseTire('205/55R16')); assert.strictEqual(c.diff, 0); assert.strictEqual(c.actual100, 100);
    c = F.tireCompare(F.parseTire('205/55R16'), F.parseTire('195/55R16')); assert.ok(c.diff < 0 && c.actual100 < 100);
    assert.strictEqual(F.tireCompare(null, F.parseTire('205/55R16')), null);
    ok('fuel-log tire');
}
