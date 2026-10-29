// 批次 n4：運動與戶外計算（utils/sport-calc.html）純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');
const m = load('utils/sport-calc.html', 'parseNum, parseTime, fmtTime, TRAIN, weeksUntil, trainPlan, fuelPlan, plateCombo, caliPlan, CALI_DAYS, gearSpeed, powerSpeed, swimCalc, hikeTime, fmtH, addClock, walkCalc, eloExpect, eloUpdate, parseNameList, shuffleSeeded, roundRobin, singleElim, doubleElim, parseGear, packAnalyze, campFood, DEF, TAB_IDS, TABS, loadOpts');

{ // 解析
    assert.strictEqual(m.parseTime('4:00:00'), 14400); assert.strictEqual(m.parseTime('20:00'), 1200); assert.ok(Number.isNaN(m.parseTime('x')));
    assert.strictEqual(m.fmtTime(3725), '1:02:05'); assert.ok(Number.isNaN(m.parseNum('-3')));
    ok('sport: parse / format');
}
{ // 訓練計畫
    assert.strictEqual(m.weeksUntil('2026-11-18', '2026-11-04'), 2); assert.strictEqual(m.weeksUntil('2026-11-05', '2026-11-04'), 1);
    assert.ok(Number.isNaN(m.weeksUntil('2026-11-04', '2026-11-04'))); assert.ok(Number.isNaN(m.weeksUntil('', '2026-11-04')));
    for (const [d, c] of [['5k', 5], ['10k', 10], ['half', 20], ['full', 30]]) for (const w of [4, 8, 12, 16, 30]) {
        const p = m.trainPlan(d, c, w), T = m.TRAIN[d];
        assert.strictEqual(p.weeks.length, w, d + w); assert.strictEqual(p.weeks[w - 1].type, '比賽週');
        const taper = p.weeks.filter(x => x.type === '賽前減量' || x.type === '比賽週'); assert.strictEqual(taper.length, T.taper);
        taper.forEach(x => assert.ok(x.km < p.peak, 'taper < peak'));
        assert.ok(p.weeks.every(x => x.km <= T.cap && x.long <= T.lcap), 'caps');
        p.weeks.filter(x => x.type === '減量週').forEach(x => assert.ok(x.km < p.weeks[x.wk - 2].km));
    }
    const f = m.trainPlan('full', 30, 12); assert.strictEqual(f.weeks[0].km, 30); assert.strictEqual(f.weeks[3].type, '減量週'); assert.strictEqual(f.weeks[2].km, 36);
    assert.ok(m.trainPlan('full', 30, 3).err); assert.ok(m.trainPlan('full', -1, 12).err); assert.ok(m.trainPlan('x', 10, 12).err);
    assert.ok(m.trainPlan('full', 5, 6).warn);
    ok('sport: train plan (length, taper, deload, caps)');
}
{ // 補給
    const p = m.fuelPlan({ distKm: 42.195, timeSec: 14400, carbPerHr: 60, gelCarb: 25, waterPerHr: 500, sodiumPerHr: 500 });
    assert.strictEqual(p.gels, 8); assert.strictEqual(p.carbs, 200); assert.strictEqual(p.rows.filter(r => r.drink).length, 15); near(p.water, 15 * 125);
    near(p.rows.find(r => r.t === 7200).km, 21.0975);
    assert.strictEqual(m.fuelPlan({ distKm: 5, timeSec: 1500, carbPerHr: 60, gelCarb: 25, waterPerHr: 500, sodiumPerHr: 500 }).gels, 0);
    assert.strictEqual(m.fuelPlan({ distKm: 42, timeSec: 14400, carbPerHr: 0, gelCarb: 25, waterPerHr: 0, sodiumPerHr: 0 }).gels, 0);
    assert.ok(m.fuelPlan({ distKm: 0, timeSec: 14400, carbPerHr: 60, gelCarb: 25, waterPerHr: 1, sodiumPerHr: 1 }).err);
    ok('sport: fuel plan');
}
{ // 配重
    const K = [25, 20, 15, 10, 5, 2.5, 1.25], r = m.plateCombo(100, 20, K);
    assert.deepStrictEqual(r.side, [{ w: 25, n: 1 }, { w: 15, n: 1 }]); assert.strictEqual(r.count, 2); assert.strictEqual(r.total, 100); assert.strictEqual(r.diff, 0);
    assert.strictEqual(m.plateCombo(60, 20, K).count, 1);
    // 貪婪不是最少的案例：片 [30, 25, 1]，每側 50 → 25+25（2 片），貪婪會 30+...
    assert.strictEqual(m.plateCombo(120, 20, [30, 25, 1]).count, 2);
    const lb = m.plateCombo(225, 45, [45, 35, 25, 10, 5, 2.5]); assert.deepStrictEqual(lb.side, [{ w: 45, n: 2 }]);
    const x = m.plateCombo(61, 20, K); assert.strictEqual(x.total, 60);
    const y = m.plateCombo(61, 20, [20, 10]); assert.strictEqual(y.total, 60); near(y.diff, 1);
    assert.strictEqual(m.plateCombo(20, 20, K).count, 0); assert.ok(m.plateCombo(10, 20, K).err); assert.ok(m.plateCombo(100, 20, []).err);
    for (let t = 20; t <= 300; t += 2.5) { const q = m.plateCombo(t, 20, K); assert.ok(q.total <= t && q.diff < 2.5 + 1e-9); }
    ok('sport: plate combo (min plates, closest below)');
}
{ // 徒手
    for (const lv of ['beg', 'mid', 'adv']) for (const d of [2, 3, 4, 5, 6]) {
        const p = m.caliPlan(lv, d); assert.strictEqual(p.days.length, d);
        const cats = new Set(p.days.flatMap(x => x.items.map(i => i.cat)));
        assert.ok(['推', '拉', '腿', '核心'].every(c => cats.has(c)) || d === 6 && ['推', '拉', '腿'].every(c => cats.has(c)), lv + d);
        assert.ok(p.rules.length >= 3);
    }
    assert.ok(m.caliPlan('x', 3).err); assert.ok(m.caliPlan('beg', 7).err);
    ok('sport: calisthenics plan');
}
{ // 自行車
    near(m.gearSpeed(90, 50, 15, 2096), 90 * (50 / 15) * 2.096 * 60 / 1000, 1e-9); near(m.gearSpeed(90, 50, 15, 2096), 37.728, 1e-4);
    assert.ok(Number.isNaN(m.gearSpeed(0, 50, 15, 2096)));
    const v = m.powerSpeed(200, 78, 0), vc = m.powerSpeed(250, 75, 8);
    assert.ok(v > 28 && v < 35, '平路 200W ' + v); assert.ok(vc > 12 && vc < 15, '8% ' + vc);
    // 殘差：代回方程式功率相符
    const ms = v / 3.6, P = (.005 * 78 * 9.80665 * Math.cos(0) * ms + .5 * 1.226 * .32 * ms ** 3) / .975; near(P, 200, 1e-4);
    assert.ok(m.powerSpeed(300, 78, 0) > v); assert.ok(m.powerSpeed(200, 78, 5) < v); assert.ok(m.powerSpeed(200, 78, -5) > v);
    assert.ok(Number.isNaN(m.powerSpeed(200, 78, 40)));
    ok('sport: bike gear speed / power speed');
}
{ // 游泳
    const r = m.swimCalc(25, 40, 1200, 18); assert.strictEqual(r.dist, 1000); near(r.pace, 120); near(r.perLen, 30); near(r.swolf, 48);
    assert.ok(Number.isNaN(m.swimCalc(25, 40, 1200, NaN).swolf)); assert.ok(m.swimCalc(25, 0, 1200, 1).err); assert.ok(m.swimCalc(25, 2.5, 1200, 1).err);
    ok('sport: swim');
}
{ // Naismith
    near(m.hikeTime(10, 600, 0, 1, 0).walkH, 3); near(m.hikeTime(10, 600, 900, 1, 0).walkH, 3.5);
    near(m.hikeTime(10, 600, 0, 1.5, 0).walkH, 4.5); near(m.hikeTime(10, 600, 0, 1, 10).totalH, 3 + 3 * 10 / 60);
    assert.strictEqual(m.fmtH(3.5), '3:30'); assert.strictEqual(m.addClock('07:00', 3.5), '10:30'); assert.strictEqual(m.addClock('23:00', 2), '1:00'); assert.strictEqual(m.addClock('x', 1), '');
    assert.ok(m.hikeTime(0, 0, 0, 1, 0).err); assert.ok(m.hikeTime(5, 0, 0, 0.1, 0).err);
    ok('sport: hike time');
}
{ // 健走
    const r = m.walkCalc(170, 10000, 65, 5, 0); near(r.stride, 70.55); near(r.km, 7.055); near(r.h, 1.411); near(r.kcal, 3.5 * 65 * 1.411, 1e-9);
    near(m.walkCalc(170, 10000, 65, 5, 80).km, 8);
    assert.ok(m.walkCalc(170, 0, 65, 5, 0).err);
    ok('sport: walk');
}
{ // ELO
    near(m.eloExpect(1500, 1500), .5); near(m.eloExpect(1900, 1500), 1 / (1 + 10 ** (-1)), 1e-12); near(m.eloExpect(1900, 1500) + m.eloExpect(1500, 1900), 1);
    const r = m.eloUpdate(1500, 1500, 1, 32); near(r.na, 1516); near(r.nb, 1484);
    for (const [a, b, s, k] of [[1800, 1400, 1, 20], [1400, 1800, 1, 40], [1234, 1999, .5, 16], [1600, 1500, 0, 32]]) {
        const q = m.eloUpdate(a, b, s, k); near(q.na + q.nb, a + b, 1e-12); near(q.ea + q.eb, 1);
        const q2 = m.eloUpdate(b, a, 1 - s, k); near(q2.na, q.nb, 1e-12);
    }
    near(m.eloUpdate(1500, 1500, .5, 32).d, 0); assert.ok(m.eloUpdate(1500, 1500, 2, 32).err);
    ok('sport: elo symmetry and conservation');
}
{ // 籤表
    assert.deepStrictEqual(m.parseNameList(' a \n\nb\na\r\nc'), ['a', 'b', 'c']);
    const names = Array.from({ length: 12 }, (_, i) => 'p' + i), s1 = m.shuffleSeeded(names, 'x'), s2 = m.shuffleSeeded(names, 'x');
    assert.deepStrictEqual(s1, s2); assert.deepStrictEqual([...s1].sort(), [...names].sort()); assert.notDeepStrictEqual(s1, names);
    for (let n = 2; n <= 17; n++) {
        const t = Array.from({ length: n }, (_, i) => 'p' + i), rr = m.roundRobin(t), seen = new Set();
        assert.strictEqual(rr.length, n % 2 ? n : n - 1, 'rounds ' + n);
        rr.forEach(rd => { const in1 = new Set(); rd.forEach(([a, b]) => { for (const x of [a, b]) if (x) { assert.ok(!in1.has(x)); in1.add(x); } if (a && b) { const k = [a, b].sort().join('|'); assert.ok(!seen.has(k), 'dup'); seen.add(k); } }); assert.strictEqual(in1.size, n); });
        assert.strictEqual(seen.size, n * (n - 1) / 2);
        let size = 1; while (size < n) size *= 2;
        const se = m.singleElim(t); assert.strictEqual(se.size, size); assert.strictEqual(se.byes, size - n); assert.strictEqual(se.r1.length, size / 2);
        assert.strictEqual(se.r1.filter(x => !x[0] || !x[1]).length, size - n); assert.ok(se.r1.every(x => x[0] || x[1]));
        assert.strictEqual(new Set(se.r1.flat().filter(Boolean)).size, n); assert.strictEqual(se.realMatches, n - 1);
        const de = m.doubleElim(t); assert.strictEqual(de.total, 2 * n - 2); assert.strictEqual(de.lbRounds, Math.max(0, 2 * (Math.log2(size) - 1)));
    }
    const s8 = m.singleElim(['1', '2', '3', '4', '5', '6', '7', '8']); assert.deepStrictEqual(s8.r1, [['1', '8'], ['4', '5'], ['2', '7'], ['3', '6']]);
    assert.deepStrictEqual(m.singleElim(['1', '2', '3']).r1, [['1', null], ['2', '3']]); assert.ok(m.singleElim(['1']).err);
    ok('sport: bracket (round robin, byes, seeding, determinism)');
}
{ // 背包
    const g = m.parseGear('背包 1200\n帳篷 1.8kg\n水 2 公斤\n  \n壞行\n外套, 350g\n拖鞋：200');
    assert.deepStrictEqual(g.items.map(x => [x.name, x.g]), [['背包', 1200], ['帳篷', 1800], ['水', 2000], ['外套', 350], ['拖鞋', 200]]); assert.deepStrictEqual(g.bad, ['壞行']);
    const a = m.packAnalyze(g.items, 70); near(a.total, 5550); near(a.ratio, 5550 / 70000); assert.strictEqual(a.level, '很輕'); assert.strictEqual(a.top[0].name, '水');
    assert.strictEqual(m.packAnalyze([{ name: 'x', g: 16000 }], 70).level, '偏重'); assert.strictEqual(m.packAnalyze([{ name: 'x', g: 20000 }], 70).level, '過重');
    assert.ok(m.packAnalyze([], 70).err); assert.ok(m.packAnalyze([{ name: 'x', g: 1 }], 5).err);
    assert.strictEqual(m.parseGear(Array.from({ length: 300 }, (_, i) => 'a ' + i).join('\n')).items.length, 200);
    ok('sport: pack weight');
}
{ // 露營
    const a = m.campFood(4, 2, 'normal', 'normal'), b = m.campFood(8, 2, 'normal', 'normal'), c = m.campFood(4, 4, 'normal', 'normal');
    near(a.foods[0].kg, 2.8); near(b.foods[0].kg, a.foods[0].kg * 2); near(c.foods[0].kg, a.foods[0].kg * 2); near(a.waterL, 24); near(m.campFood(2, 1, 'normal', 'hot').waterL, 9);
    near(a.foods[0].lo, 2.8 * .85); assert.ok(m.campFood(0, 2, 'normal', 'normal').err); assert.ok(m.campFood(2, 1.5, 'normal', 'normal').err); assert.ok(m.campFood(2, 1, 'x', 'normal').err);
    ok('sport: camp food');
}
{ // 讀取容錯
    const d = m.loadOpts(null); assert.strictEqual(d.tab, 'train'); assert.strictEqual(d.v.plate_unit, 'kg');
    for (const bad of [[], 'x', 5, { tab: 5, v: 7 }, { tab: 'zzz', v: [] }, { v: { plate_unit: 'zz', train_cur: 9, train_dist: { a: 1 } } }]) assert.deepStrictEqual(m.loadOpts(bad), d);
    const r = m.loadOpts({ tab: 'elo', v: { elo_ra: '1700', plate_unit: 'lb', train_cur: 'x'.repeat(101), bracket_names: 'a\nb' } });
    assert.strictEqual(r.tab, 'elo'); assert.strictEqual(r.v.elo_ra, '1700'); assert.strictEqual(r.v.plate_unit, 'lb'); assert.strictEqual(r.v.train_cur, '20'); assert.strictEqual(r.v.bracket_names, 'a\nb');
    ok('sport: loadOpts validation');
}
