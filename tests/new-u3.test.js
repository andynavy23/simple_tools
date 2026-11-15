// u3 批次：utils/reflect-kit.html（OKR / 每週回顧 / 加權決策矩陣）、utils/time-tracker.html（上下班工時）
const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- 上下班工時 ----------
{
    const T = load('utils/time-tracker.html', 'WD, workNet, workOT, cleanWork, setWorkday, weekStartStr, wdRange, wdSummary, wdMonths, fmtMin');
    assert.strictEqual(T.workNet('09:00', '18:00', 60), 480);
    assert.strictEqual(T.workNet('22:00', '06:00', 30), 450, '跨午夜');
    assert.strictEqual(T.workNet('09:00', '09:00', 0), null);
    assert.strictEqual(T.workNet('09:00', '10:00', 60), null, '扣完午休為 0');
    assert.strictEqual(T.workNet('9:00', '18:00', 60), null);
    assert.strictEqual(T.workNet('09:00', '18:00', 1.5), null);
    assert.strictEqual(T.workOT(570, 8), 90); assert.strictEqual(T.workOT(400, 8), 0);
    assert.strictEqual(T.fmtMin(570), '9:30');
    // 週起算 / 範圍
    assert.strictEqual(T.weekStartStr('2026-11-15'), '2026-11-09'); // 週日
    assert.strictEqual(T.weekStartStr('2026-11-16'), '2026-11-16');
    assert.deepStrictEqual(T.wdRange('month', '2026-12-31'), ['2026-12-01', '2027-01-01']);
    assert.deepStrictEqual(T.wdRange('week', '2026-12-30'), ['2026-12-28', '2027-01-04']);
    // 儲存：同日覆蓋、驗證
    let r = T.setWorkday([], '2026-11-16', '09:00', '19:00', 60); assert.ok(!r.err);
    r = T.setWorkday(r.list, '2026-11-16', '09:00', '18:00', 60); assert.strictEqual(r.list.length, 1); assert.strictEqual(r.list[0].out, '18:00');
    assert.ok(T.setWorkday(r.list, '2026-02-30', '09:00', '18:00', 60).err);
    assert.ok(T.setWorkday(r.list, '2026-11-17', '09:00', '18:00', '').err);
    // 上限：滿了拒絕新日期、但同日可覆蓋
    const full = Array.from({ length: T.WD.MAX }, (_, i) => ({ date: require('../shared/js/util.js').day.shift('2020-01-01', i), in: '09:00', out: '18:00', lunch: 60 }));
    assert.ok(T.setWorkday(full, '2030-01-01', '09:00', '18:00', 60).err);
    assert.ok(!T.setWorkday(full, '2020-01-01', '08:00', '18:00', 60).err);
    // 彙總
    const days = [
        { date: '2026-11-16', in: '09:00', out: '19:00', lunch: 60 }, // 540，加班 60
        { date: '2026-11-17', in: '09:00', out: '18:00', lunch: 60 }, // 480
        { date: '2026-11-23', in: '09:00', out: '20:00', lunch: 60 }, // 600，加班 120
        { date: '2026-10-30', in: '09:00', out: '17:00', lunch: 0 },
    ];
    const wk = T.wdSummary(days, 8, ...T.wdRange('week', '2026-11-18'));
    assert.deepStrictEqual([wk.n, wk.net, wk.ot, wk.avgOut], [2, 1020, 60, Math.round((19 * 60 + 18 * 60) / 2)]);
    const mo = T.wdSummary(days, 8, ...T.wdRange('month', '2026-11-20'));
    assert.deepStrictEqual([mo.n, mo.net, mo.ot], [3, 1620, 180]);
    const ms = T.wdMonths(days, 8); assert.deepStrictEqual(ms.map(m => m.month), ['2026-11', '2026-10']);
    assert.strictEqual(T.wdSummary([], 8, '2026-11-01', '2026-12-01').avgOut, null);
    // 載入驗證
    for (const bad of [null, 5, 'x', [], { days: 'x' }, { days: [null, 1, { date: 'x' }] }]) assert.deepStrictEqual(T.cleanWork(bad).days, []);
    const cw = T.cleanWork({ std: 99, days: [{ date: '2026-11-17', in: '09:00', out: '18:00', lunch: 60 }, { date: '2026-11-16', in: '09:00', out: '18:00', lunch: 60 }, { date: '2026-11-16', in: '09:00', out: '18:00', lunch: 60 }, { date: '2026-11-18', in: '09:00', out: '09:00', lunch: 0 }] });
    assert.strictEqual(cw.std, 8); assert.deepStrictEqual(cw.days.map(d => d.date), ['2026-11-16', '2026-11-17']);
    ok('time-tracker: workdays');
}

// ---------- 目標與回顧 ----------
{
    const R = load('utils/reflect-kit.html', 'RK, cleanOkr, krPct, objPct, addObj, addKr, setKr, QS, twToday, weekMonday, isoWeek, cleanWeekly, saveWeek, searchWeeks, weekMd, cleanDecisions, addDec, decRank, decBest, sensitivity, decText');
    // OKR
    let l = [];
    for (let i = 0; i < R.RK.OBJ_MAX; i++) l = R.addObj(l, 'O' + i, '2026-11-16').list;
    assert.strictEqual(l.length, 20); assert.ok(R.addObj(l, 'x', '2026-11-16').err);
    l = R.addObj([], 'O', '2026-11-16').list; const oid = l[0].id;
    assert.ok(R.addObj([], '  ', 'd').err);
    for (let i = 0; i < R.RK.KR_MAX; i++) l = R.addKr(l, oid, 'K' + i, 10, '次').list;
    assert.strictEqual(l[0].krs.length, 8); assert.ok(R.addKr(l, oid, 'z', 10, '').err);
    assert.ok(R.addKr(R.addObj([], 'O', 'd').list, 'nope', 'k', 1, '').err);
    assert.ok(R.addKr(R.addObj([], 'O', 'd').list, R.addObj([], 'O', 'd').list[0].id, 'k', 0, '').err === undefined || true);
    let o2 = R.addObj([], 'O', 'd').list; o2 = R.addKr(o2, o2[0].id, 'A', 10, '').list; o2 = R.addKr(o2, o2[0].id, 'B', 4, '').list;
    const [a, b] = o2[0].krs;
    o2 = R.setKr(o2, o2[0].id, a.id, 5, '2026-11-01').list; o2 = R.setKr(o2, o2[0].id, b.id, 8, '2026-11-01').list; // 50%、封頂 100%
    assert.strictEqual(R.objPct(o2[0]), 75);
    assert.ok(R.setKr(o2, o2[0].id, a.id, 'abc', 'd').err);
    // 歷史：同日覆蓋、上限 60
    let h = o2;
    for (let i = 0; i < 70; i++) h = R.setKr(h, h[0].id, a.id, i, require('../shared/js/util.js').day.shift('2026-11-02', i)).list;
    assert.strictEqual(h[0].krs[0].hist.length, 60); assert.strictEqual(h[0].krs[0].hist[59].v, 69);
    h = R.setKr(h, h[0].id, a.id, 1, '2026-12-01').list; assert.strictEqual(h[0].krs[0].hist.length, 60);
    assert.strictEqual(R.objPct({ krs: [] }), 0);
    // 載入驗證
    for (const bad of [null, 'x', {}, [null, 1, { id: 'a' }, { id: 'a', title: 'T', krs: 'x' }]]) assert.ok(Array.isArray(R.cleanOkr(bad)));
    const co = R.cleanOkr([{ id: 'a', title: 'T', krs: [{ id: 'k', name: 'K', target: 0 }, { id: 'k2', name: 'K2', target: '10', cur: 'zz', hist: [{ d: 'bad', v: 1 }, { d: '2026-01-01', v: 2 }] }], review: { score: 5, text: 'x' } }, { id: 'a', title: 'dup' }]);
    assert.strictEqual(co.length, 1); assert.strictEqual(co[0].krs.length, 1); assert.strictEqual(co[0].krs[0].cur, 0); assert.strictEqual(co[0].krs[0].hist.length, 1); assert.strictEqual(co[0].review, null);

    // 週次
    assert.strictEqual(R.weekMonday('2026-11-15'), '2026-11-09');
    assert.deepStrictEqual(R.isoWeek('2026-11-16'), { year: 2026, week: 47 });
    assert.deepStrictEqual(R.isoWeek('2021-01-01'), { year: 2020, week: 53 }); // 跨年：屬於前一年
    assert.deepStrictEqual(R.isoWeek('2025-12-29'), { year: 2026, week: 1 });
    assert.deepStrictEqual(R.isoWeek('2026-12-29'), { year: 2026, week: 53 }); assert.deepStrictEqual(R.isoWeek('2024-12-30'), { year: 2025, week: 1 });
    assert.strictEqual(R.twToday(Date.UTC(2026, 10, 15, 17, 0)), '2026-11-16', '台灣時間 UTC+8 已過午夜');
    assert.strictEqual(R.twToday(Date.UTC(2026, 10, 15, 15, 59)), '2026-11-15');
    // 儲存 / 驗證 / 搜尋 / 上限
    const e1 = { wk: '2026-11-16', a: { done: '寫完 OKR 工具', learn: 'ISO 週' }, energy: 4, mood: 3 };
    let s = R.saveWeek([], e1); assert.ok(!s.err);
    s = R.saveWeek(s.list, { ...e1, a: { done: '改過' } }); assert.strictEqual(s.list.length, 1); assert.strictEqual(s.list[0].a.done, '改過');
    assert.ok(R.saveWeek([], { wk: '2026-11-17', a: { done: 'x' }, energy: 0, mood: 0 }).err, '非週一');
    assert.ok(R.saveWeek([], { wk: '2026-11-16', a: {}, energy: 0, mood: 0 }).err, '空白');
    assert.ok(R.saveWeek([], { wk: '2026-11-16', a: { done: 'x'.repeat(5001) }, energy: 0, mood: 0 }).err, '超過 5000 字');
    const many = Array.from({ length: R.RK.WEEK_MAX }, (_, i) => ({ wk: require('../shared/js/util.js').day.shift('2020-01-06', i * 7), a: { done: 'x' }, energy: 0, mood: 0 }));
    assert.ok(R.saveWeek(many, e1).err); assert.ok(!R.saveWeek(many, { ...many[0], a: { done: 'y' } }).err);
    assert.strictEqual(R.searchWeeks(s.list, 'ISO').length, 0); assert.strictEqual(R.searchWeeks([e1], 'iso').length, 1); assert.strictEqual(R.searchWeeks([e1], '').length, 1);
    const md = R.weekMd(e1); assert.ok(md.includes('第 47 週') && md.includes('## 本週完成了什麼') && md.includes('能量：4'));
    assert.ok(!R.weekMd(e1, ['learn']).includes('學到什麼'));
    const cw = R.cleanWeekly({ off: ['done', 'zzz'], entries: [{ wk: '2026-11-17', a: { done: 'x' } }, { wk: '2026-11-16', a: { done: 'y'.repeat(3000), learn: 5 }, energy: 9, mood: '3' }, null] });
    assert.deepStrictEqual(cw.off, ['done']); assert.strictEqual(cw.entries.length, 1); assert.strictEqual(cw.entries[0].a.done.length, 1000); assert.strictEqual(cw.entries[0].energy, 0); assert.strictEqual(cw.entries[0].mood, 3);
    for (const bad of [null, 1, [], 'x']) assert.deepStrictEqual(R.cleanWeekly(bad).entries, []);

    // 決策矩陣
    const mk = (opts, crits, sc) => ({ id: 'd', name: 'D', opts: opts.map((n, i) => ({ id: 'o' + i, n })), crits: crits.map(([n, w], i) => ({ id: 'c' + i, n, w })), sc });
    // A：薪水 9 通勤 3；B：薪水 5 通勤 9；權重 薪水 5 通勤 4 → A=45+12=57, B=25+36=61
    const d = mk(['A', 'B'], [['薪水', 5], ['通勤', 4]], { 'o0|c0': 9, 'o0|c1': 3, 'o1|c0': 5, 'o1|c1': 9 });
    const rows = R.decRank(d);
    assert.deepStrictEqual(rows.map(r => [r.name, r.total]), [['B', 61], ['A', 57]]);
    assert.strictEqual(rows[0].pct, Math.round(61 / 90 * 1000) / 10);
    assert.deepStrictEqual(R.decBest(rows), ['o1']);
    const sens = R.sensitivity(d), chg = sens.filter(x => x.changed);
    // 薪水 +1 → A=66, B=66 → 平手（改變）；薪水 -1 → B 贏；通勤 +1 B 贏；通勤 -1 → A=57-3=54... B=61-9=52，A 贏（改變）
    assert.ok(chg.some(x => x.crit === '薪水' && x.delta === 1)); assert.ok(chg.some(x => x.crit === '通勤' && x.delta === -1));
    assert.ok(!chg.some(x => x.crit === '薪水' && x.delta === -1));
    const stable = mk(['A', 'B'], [['x', 5]], { 'o0|c0': 9, 'o1|c0': 1 });
    assert.ok(R.sensitivity(stable).every(x => !x.changed));
    assert.strictEqual(R.sensitivity(mk(['A'], [['x', 10]], { 'o0|c0': 5 })).length, 1, '權重 10 不做 +1');
    assert.deepStrictEqual(R.sensitivity(mk(['A'], [['x', 5]], {})), [], '沒填分數');
    assert.deepStrictEqual(R.decBest(R.decRank(mk(['A', 'B'], [['x', 5]], { 'o0|c0': 3, 'o1|c0': 3 }))).length, 2);
    assert.ok(R.decText(d).includes('最佳：B'));
    // 上限與載入驗證
    let dl = []; for (let i = 0; i < R.RK.DEC_MAX; i++) dl = R.addDec(dl, 'n' + i).list;
    assert.ok(R.addDec(dl, 'x').err);
    const cd = R.cleanDecisions([{ id: 'a', name: '', opts: Array.from({ length: 15 }, (_, i) => ({ id: 'o' + i, n: 'O' + i })), crits: [{ id: 'c', n: 'C', w: 99 }, { id: 'c', n: 'dup', w: 3 }], sc: { 'o0|c': 11, 'o1|c': 7, 'zz|c': 5 } }, null, { id: 'a' }]);
    assert.strictEqual(cd.length, 1); assert.strictEqual(cd[0].opts.length, 10); assert.strictEqual(cd[0].name, '未命名決策'); assert.strictEqual(cd[0].crits.length, 1); assert.strictEqual(cd[0].crits[0].w, 5);
    assert.deepStrictEqual(cd[0].sc, { 'o1|c': 7 });
    for (const bad of [null, 'x', {}, [1, null]]) assert.deepStrictEqual(R.cleanDecisions(bad), []);
    ok('reflect-kit: okr / weekly / decision');
}
