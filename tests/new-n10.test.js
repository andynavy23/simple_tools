// 批次 n10：health-calc 蛋白質 / 目標日期 / 腰臀比 / 血型；其餘頁面的純函式見下方各區段
const { load, ok, near } = require('./_load');
const assert = require('assert');

{ // ---------- health-calc ----------
    const m = load('utils/health-calc.html', 'proteinRange, goalForecast, whr, bgChild, bgCross, PROTEIN_LEVELS');
    const p = m.proteinRange(70, 3); assert.deepStrictEqual([p.lo, p.hi, p.mealLo, p.mealHi], [112, 154, 37, 51]);
    assert.deepStrictEqual([m.proteinRange(60, 0).lo, m.proteinRange(60, 0).hi], [48, 60]);
    assert.strictEqual(m.proteinRange(5, 0), null); assert.strictEqual(m.proteinRange(70, 9), null); assert.strictEqual(m.proteinRange('x', 0), null);
    // 減 5 kg、每日赤字 500 → 5*7700/500 = 77 天
    let g = m.goalForecast(70, 65, 500, '2026-01-01', 170);
    assert.strictEqual(g.days, 77); assert.strictEqual(g.date, '2026-03-19'); assert.ok(g.loss); near(g.perWeek, 0.4545, 1e-3); assert.deepStrictEqual(g.warns, []);
    g = m.goalForecast(70, 75, 250, '2026-01-01'); assert.ok(!g.loss); assert.strictEqual(g.days, 154);
    assert.ok(m.goalForecast(60, 50, 1000, '2026-01-01').warns.some(w => w.includes('偏快')));   // 1.27 kg/週
    assert.ok(m.goalForecast(60, 50, 700, '2026-01-01').warns.some(w => w.includes('偏快')));    // 0.636 > 1% (0.6)
    assert.ok(m.goalForecast(60, 50, 500, '2026-01-01').warns.length === 0);
    assert.ok(m.goalForecast(60, 62, 500, '2026-01-01').warns.some(w => w.includes('偏快')) === false);
    assert.ok(m.goalForecast(60, 62, 800, '2026-01-01').warns.some(w => w.includes('增重')));
    assert.ok(m.goalForecast(60, 40, 300, '2026-01-01', 170).warns.some(w => w.includes('BMI')));
    assert.ok(m.goalForecast(60, 59, 50, '2026-01-01').warns.some(w => w.includes('很慢')));
    assert.strictEqual(m.goalForecast(60, 400, 50, '2026-01-01').date, null);
    assert.ok(m.goalForecast(60, 60, 500, '2026-01-01').reached);
    for (const bad of [[5, 60, 500], [60, 500, 500], [60, 50, 0], [60, 50, 5000], ['a', 50, 500]]) assert.ok(m.goalForecast(...bad, '2026-01-01').err);
    // 腰臀比：男 0.90、女 0.85 為界
    let w = m.whr(90, 100, 'm'); assert.ok(w.high); near(w.r, 0.9); assert.ok(w.waistHigh);
    w = m.whr(89, 100, 'm'); assert.ok(!w.high && !w.waistHigh);
    w = m.whr(85, 100, 'f'); assert.ok(w.high); assert.ok(w.waistHigh);
    w = m.whr(80, 100, 'f'); assert.ok(!w.high); assert.ok(w.waistHigh);
    w = m.whr(79, 100, 'f'); assert.ok(!w.high && !w.waistHigh);
    assert.strictEqual(m.whr(0, 100, 'm'), null); assert.strictEqual(m.whr(80, 'x', 'f'), null);
    // 血型：孟德爾比例
    const pc = (o) => Object.fromEntries(Object.entries(o).map(([k, [a, b]]) => [k, [a, b]]));
    assert.deepStrictEqual(pc(m.bgChild('AO', 'BO')), { A: [.25, .25], B: [.25, .25], AB: [.25, .25], O: [.25, .25] });
    assert.deepStrictEqual(pc(m.bgChild('AB', 'OO')), { A: [.5, .5], B: [.5, .5] });
    assert.deepStrictEqual(pc(m.bgChild('OO', 'OO')), { O: [1, 1] });
    assert.deepStrictEqual(pc(m.bgChild('AB', 'AB')), { A: [.25, .25], B: [.25, .25], AB: [.5, .5] });
    assert.deepStrictEqual(pc(m.bgChild('A', 'B')), { AB: [1, 1] });
    assert.deepStrictEqual(pc(m.bgChild('AO', 'OO')), { A: [.5, .5], O: [.5, .5] });
    assert.deepStrictEqual(pc(m.bgChild('A', 'OO')), { A: [1, 1] });
    assert.deepStrictEqual(pc(m.bgChild('A?', 'OO')), { A: [.5, 1], O: [0, .5] });
    assert.deepStrictEqual(pc(m.bgChild('AB', 'A')), { A: [.5, .5], AB: [.5, .5] });
    assert.strictEqual(m.bgChild('Z', 'OO'), null);
    // O 型父母不可能生 A/B/AB；機率總和 1
    for (const a of ['A', 'A?', 'AO', 'B', 'B?', 'BO', 'AB', 'OO']) for (const b of ['A', 'A?', 'AO', 'B', 'B?', 'BO', 'AB', 'OO']) {
        const c = m.bgChild(a, b); assert.ok(Object.values(c).every(([lo, hi]) => lo <= hi));
        if (a === 'OO' && b === 'OO') continue;
        for (const g1 of ['AA', 'AO', 'BB', 'BO', 'AB', 'OO']) near(Object.values(m.bgCross(g1, 'AO')).reduce((x, y) => x + y), 1);
    }
    ok('n10 health-calc');
}

{ // ---------- workout-log：每組 RPE / 週負荷 / 菜單 ----------
    const m = load('fun/workout-log.html', 'cleanEntry, weeklyLoad, genPlan, cleanPlan, planWithoutMove, validRpe, entryText, BUILTIN, GOALS, SPLITS, monOf');
    assert.deepStrictEqual(m.cleanEntry({ id: 'a', d: '2026-01-05', m: 'squat', s: [[100, 5, 8], [100, 5], [100, 5, 11], [100, 5, 7.3], [100, 5, '8']] }).s, [[100, 5, 8], [100, 5], [100, 5], [100, 5], [100, 5]]);
    assert.ok(m.validRpe(7.5) && !m.validRpe(0.5) && !m.validRpe(10.5) && !m.validRpe(null));
    assert.ok(m.entryText({ d: 'd', s: [[100, 5, 8]], rpe: null, n: '' }, 'X', false).includes('@RPE 8'));
    // 2026-01-05 是週一
    const log = [
        { id: '1', d: '2026-01-05', m: 'squat', s: [[100, 5, 9], [100, 5]], rpe: 8, n: '' },     // 量 1000、RPE 9 與 8（沿用整次）
        { id: '2', d: '2026-01-07', m: 'bench', s: [[50, 10]], rpe: null, n: '' },              // 量 500、無 RPE
        { id: '3', d: '2025-12-30', m: 'squat', s: [[100, 4, 9.5]], rpe: null, n: '' },         // 上一週：量 400
        { id: '4', d: '2024-01-01', m: 'squat', s: [[100, 4]], rpe: null, n: '' },              // 超出 8 週
    ];
    const w = m.weeklyLoad(log, '2026-01-09');
    assert.strictEqual(w.length, 8); assert.strictEqual(w[7].wk, '2026-01-05'); assert.strictEqual(w[6].wk, '2025-12-29');
    assert.deepStrictEqual([w[7].sets, w[7].vol, w[7].avgRpe, w[7].hard, w[7].chg], [3, 1500, 8.5, 1, 275]);
    assert.deepStrictEqual([w[6].sets, w[6].vol, w[6].avgRpe, w[6].hard, w[6].chg], [1, 400, 9.5, 1, null]);
    assert.deepStrictEqual([w[0].sets, w[0].avgRpe, w[0].chg], [0, null, null]);
    // 菜單
    assert.strictEqual(m.genPlan(7, 'muscle'), null); assert.strictEqual(m.genPlan(0, 'muscle'), null); assert.strictEqual(m.genPlan(3, 'x'), null);
    const ids = new Set(m.BUILTIN.map(b => b.id));
    for (const d of [1, 2, 3, 4, 5, 6]) for (const g of Object.keys(m.GOALS)) {
        const p = m.genPlan(d, g); assert.strictEqual(p.days.length, d);
        for (const x of p.days) { assert.ok(x.items.length >= 5 && x.items.length <= 12); for (const i of x.items) assert.ok(ids.has(i.m) && i.sets >= 3 && i.reps >= 5); }
        assert.deepStrictEqual(m.cleanPlan(JSON.parse(JSON.stringify(p))), p);   // 產生的菜單一定能通過載入驗證
    }
    const p3 = m.genPlan(3, 'strength'); assert.deepStrictEqual(p3.days.map(x => x.name), ['推', '拉', '腿']);
    assert.deepStrictEqual(p3.days[0].items[0], { m: 'bench', sets: 4, reps: 5 }); assert.deepStrictEqual(p3.days[0].items[4], { m: 'pushdown', sets: 3, reps: 8 });
    assert.deepStrictEqual(m.genPlan(4, 'muscle').days.map(x => x.name), ['上肢 A', '下肢 A', '上肢 B', '下肢 B']);
    assert.deepStrictEqual(m.genPlan(1, 'endure').days[0].items.map(i => [i.sets, i.reps]), Array(6).fill([3, 15]));
    assert.deepStrictEqual(m.genPlan(5, 'muscle').days.map(x => x.name), ['推', '拉', '腿', '上肢', '下肢']);
    // 載入驗證
    for (const bad of [null, 5, 'x', [], {}, { days: 'a' }, { days: [] }, { days: [null, { name: 1, items: [] }] }]) assert.strictEqual(m.cleanPlan(bad), null);
    const c = m.cleanPlan({ goal: 'zzz', days: [{ name: 'x'.repeat(50), items: [{ m: 'a', sets: 3, reps: 5 }, { m: '', sets: 3, reps: 5 }, { m: 'b', sets: 0, reps: 5 }, { m: 'c', sets: 3, reps: 5.5 }, null] }, null] });
    assert.strictEqual(c.goal, 'muscle'); assert.strictEqual(c.days.length, 1); assert.strictEqual(c.days[0].name.length, 20); assert.deepStrictEqual(c.days[0].items, [{ m: 'a', sets: 3, reps: 5 }]);
    const many = m.cleanPlan({ days: Array.from({ length: 20 }, () => ({ name: 'd', items: Array.from({ length: 30 }, () => ({ m: 'a', sets: 3, reps: 5 })) })) });
    assert.strictEqual(many.days.length, 7); assert.strictEqual(many.days[0].items.length, 12);
    // 刪動作連帶清計畫
    const pl = { goal: 'muscle', days: [{ name: 'A', items: [{ m: 'x', sets: 3, reps: 5 }, { m: 'y', sets: 3, reps: 5 }] }, { name: 'B', items: [{ m: 'x', sets: 3, reps: 5 }] }] };
    const r = m.planWithoutMove(pl, 'x'); assert.deepStrictEqual(r.days.map(d => [d.name, d.items.length]), [['A', 1]]);
    assert.strictEqual(m.planWithoutMove(r, 'y'), null); assert.strictEqual(m.planWithoutMove(null, 'y'), null);
    assert.strictEqual(pl.days[0].items.length, 2);   // 不改動原物件
    ok('n10 workout-log');
}

{ // ---------- pace-calc：越野跑爬升 ----------
    const m = load('utils/pace-calc.html', 'trailEffort, trailFromPace, trailFromTime, naismithSec, rateToSecPerKm, parseTime');
    assert.strictEqual(m.trailEffort(25, 1200), 37); assert.strictEqual(m.trailEffort(10, 0), 10);
    for (const b of [[0, 100], [-1, 0], [25, -5], [20000, 0], [NaN, 0], [10, 200000]]) assert.ok(Number.isNaN(m.trailEffort(...b)));
    let r = m.trailFromPace(25, 1200, 360); assert.strictEqual(r.timeSec, 13320); near(r.actualSpk, 532.8); near(r.slowPct, 48);
    r = m.trailFromPace(20, 1000, 360); assert.strictEqual(r.timeSec, 10800); assert.strictEqual(r.actualSpk, 540);
    assert.strictEqual(m.trailFromPace(10, 0, 300).timeSec, 3000);                      // 無爬升 = 一般配速
    assert.strictEqual(m.trailFromPace(10, 0, 300).slowPct, 0);
    r = m.trailFromTime(20, 1000, 10800); assert.strictEqual(r.flatSpk, 360); assert.strictEqual(r.effortKm, 30);
    for (const b of [[0, 0, 300], [10, 0, 0], [10, 0, NaN], [10, 0, 1e9]]) assert.strictEqual(m.trailFromTime(...b), null);
    assert.strictEqual(m.trailFromPace(10, 100, 0), null); assert.strictEqual(m.trailFromPace(10, 100, NaN), null);
    // 兩個方向互為反運算
    const a = m.trailFromPace(42, 2500, 345), b = m.trailFromTime(42, 2500, a.timeSec); near(b.flatSpk, 345);
    // Naismith：20 km → 4 小時，+1000 m / 600 = 1.667 小時
    assert.strictEqual(Math.round(m.naismithSec(20, 1000)), 20400); assert.strictEqual(m.naismithSec(5, 0), 3600); assert.ok(Number.isNaN(m.naismithSec(0, 0)));
    assert.strictEqual(m.rateToSecPerKm('6:00', 'pkm'), 360);
    ok('n10 pace-calc');
}

{ // ---------- countdown：戒除計數 / 行前待辦 ----------
    const m = load('utils/countdown.html', 'cleanEvent, quitStats, describeQuit, nextMilestone, validPerDay, TRIP_TODO, PACKING, addItem, mergeTemplate, MAX_ITEMS, describe');
    const q = (date, perDay) => ({ name: '戒菸', date, yearly: false, items: [], quit: { perDay } });
    assert.deepStrictEqual(m.quitStats('2026-02-10', q('2026-01-01', 100)), { days: 40, saved: 4000, next: 60, toNext: 20 });
    assert.deepStrictEqual(m.quitStats('2026-01-01', q('2026-01-01', 100)), { days: 0, saved: 0, next: 1, toNext: 1 });
    assert.deepStrictEqual(m.quitStats('2026-01-01', q('2026-01-11', 100)), { pending: 10 });
    assert.strictEqual(m.quitStats('2040-01-01', q('2026-01-01', 1)).next, null);
    assert.strictEqual(m.quitStats('2027-01-01', q('2026-01-01', 50)).saved, 365 * 50);
    assert.strictEqual(m.nextMilestone(7), 14); assert.strictEqual(m.nextMilestone(0), 1); assert.strictEqual(m.nextMilestone(3650), null);
    let d = m.describeQuit('2026-02-10', q('2026-01-01', 1234)); assert.strictEqual(d.text, '40 天'); assert.ok(d.sub.includes('NT$ 49,360') && d.sub.includes('60 天'));
    d = m.describeQuit('2026-01-01', q('2026-01-11', 100)); assert.strictEqual(d.kind, 'future'); assert.strictEqual(d.text, '10 天');
    // 載入驗證：舊資料不受影響、壞 quit 拿掉、花費取整
    const old = { name: 'a', date: '2026-01-01', yearly: true, items: [] }; assert.deepStrictEqual(m.cleanEvent(old), old);
    for (const bad of [null, 1, { name: '', date: '2026-01-01' }, { name: 'a', date: 'x' }]) assert.strictEqual(m.cleanEvent(bad), null);
    for (const bq of [null, 'x', {}, { perDay: -1 }, { perDay: '5' }, { perDay: NaN }, { perDay: 1e9 }]) assert.ok(!('quit' in m.cleanEvent({ ...old, quit: bq })));
    assert.deepStrictEqual(m.cleanEvent({ ...old, quit: { perDay: 99.6 } }).quit, { perDay: 100 });
    assert.ok(m.validPerDay(0) && !m.validPerDay(-0.1));
    // 行前待辦範本：長度合法、不重複、能與行李範本合併且不超過上限
    assert.ok(m.TRIP_TODO.every(t => t.length >= 1 && t.length <= 30)); assert.strictEqual(new Set(m.TRIP_TODO).size, m.TRIP_TODO.length);
    let items = m.mergeTemplate([], m.PACKING); items = m.mergeTemplate(items, m.TRIP_TODO); assert.strictEqual(items.length, m.PACKING.length + m.TRIP_TODO.length); assert.ok(items.length <= m.MAX_ITEMS);
    assert.strictEqual(m.mergeTemplate(items, m.TRIP_TODO).length, items.length);
    ok('n10 countdown');
}

{ // ---------- mood-journal：感恩日記 ----------
    const m = load('fun/mood-journal.html', 'normEntry, cleanEntries, saveEntry, cleanGrat, gratStats, gratRecent, gratPick, clearGrat, exportText, search, MAX_ENTRIES');
    assert.deepStrictEqual(m.normEntry({ date: '2024-01-01', mood: 3 }), { date: '2024-01-01', mood: 3, tags: [], text: '' });   // 舊資料沒有 g
    const n = m.normEntry({ date: '2024-01-01', mood: 3, g: [' 家人 ', '', 5, 'b'.repeat(150), 'c', 'd'] });
    assert.deepStrictEqual(n.g, ['家人', 'b'.repeat(100), 'c']);
    for (const bad of ['x', null, 5, {}, [null, '', '  ']]) assert.ok(!('g' in m.normEntry({ date: '2024-01-01', mood: 3, g: bad })));
    assert.deepStrictEqual(m.cleanGrat(undefined), []);
    // 儲存 / 覆蓋 / 追加
    let l = m.saveEntry([], { date: '2024-03-01', mood: 4, g: ['a', 'b'], text: 'x' });
    assert.deepStrictEqual(l[0].g, ['a', 'b']);
    l = m.saveEntry(l, { date: '2024-03-01', mood: 4, g: ['a', 'b', 'c'], text: 'y' }, true); assert.deepStrictEqual(l[0].g, ['a', 'b', 'c']); assert.strictEqual(l[0].text, 'x\ny');
    l = m.saveEntry(l, { date: '2024-03-01', mood: 4, g: [], text: 'z' }); assert.ok(!('g' in l[0]));                 // 清空感恩
    // 統計
    const L = m.cleanEntries([
        { date: '2024-03-01', mood: 3, g: ['a', 'b', 'c'] }, { date: '2024-03-02', mood: 3, g: ['d'] }, { date: '2024-03-03', mood: 3 },
        { date: '2024-03-04', mood: 3, g: ['e', 'f'] }, { date: '2024-03-05', mood: 3, g: ['g'] },
    ]);
    assert.deepStrictEqual(m.gratStats(L, '2024-03-05'), { days: 4, items: 7, streak: 2 });
    assert.deepStrictEqual(m.gratStats(L, '2024-03-06'), { days: 4, items: 7, streak: 2 });          // 今天沒寫，從昨天算
    assert.deepStrictEqual(m.gratStats(L, '2024-03-08'), { days: 4, items: 7, streak: 0 });
    assert.deepStrictEqual(m.gratStats([], '2024-03-08'), { days: 0, items: 0, streak: 0 });
    assert.deepStrictEqual(m.gratRecent(L, 2).map(e => e.date), ['2024-03-05', '2024-03-04']);
    assert.strictEqual(m.gratRecent(L).length, 4);
    assert.deepStrictEqual(m.gratPick(L, '2024-03-05', 0), { date: '2024-03-01', t: 'a' });
    assert.deepStrictEqual(m.gratPick(L, '2024-03-05', 0.9999), { date: '2024-03-04', t: 'f' });   // 排除今天的 g
    assert.strictEqual(m.gratPick(L, '2024-03-05', 1).t, 'f'); assert.strictEqual(m.gratPick([], '2024-03-05', 0.5), null);
    assert.strictEqual(m.gratPick([{ date: '2024-03-05', mood: 3, tags: [], text: '', g: ['x'] }], '2024-03-05', 0.5), null);
    // 清除只動 g
    const c = m.clearGrat(L); assert.ok(c.every(e => !('g' in e))); assert.strictEqual(c.length, 5); assert.strictEqual(c[0].mood, 3); assert.ok('g' in L[0]);
    // 匯出 / 搜尋
    assert.ok(m.exportText([L[0]], false).includes('感恩：a；b；c')); assert.ok(m.exportText([L[0]], true).includes('- 感恩：a；b；c'));
    assert.ok(!m.exportText([L[2]], false).includes('感恩'));
    assert.strictEqual(m.search(L, 'e').length >= 1, true); assert.strictEqual(m.search(L, 'f')[0].date, '2024-03-04');
    ok('n10 mood-journal');
}

{ // ---------- health-log：症狀記錄 / 看診問題 ----------
    const m = load('utils/health-log.html', 'normSym, normQ, normSymList, normQList, addSym, addQ, patchQ, symSummary, symText, qText, SY');
    const ok1 = { date: '2026-03-01', time: '08:30', sym: '頭痛', sev: '6', trig: '熬夜', note: '' };
    let r = m.addSym([], ok1); assert.strictEqual(r.err, ''); assert.deepStrictEqual({ ...r.list[0], id: 0 }, { id: 0, date: '2026-03-01', time: '08:30', sym: '頭痛', sev: 6, trig: '熬夜', note: '' });
    for (const [patch, key] of [[{ date: '2026-02-30' }, '日期'], [{ time: '25:00' }, '時間'], [{ sym: '  ' }, '症狀'], [{ sym: 'x'.repeat(41) }, '症狀'], [{ sev: '' }, '強度'], [{ sev: '0' }, '強度'], [{ sev: '11' }, '強度'], [{ sev: '5.5' }, '強度'], [{ sev: 'a' }, '強度'], [{ trig: 'x'.repeat(61) }, '誘因'], [{ note: 'x'.repeat(201) }, '備註']]) {
        const e = m.addSym([], { ...ok1, ...patch }); assert.ok(e.err.includes(key), key + ':' + e.err); assert.strictEqual(e.list.length, 0);
    }
    assert.strictEqual(m.addSym([], { ...ok1, sev: '1' }).err, ''); assert.strictEqual(m.addSym([], { ...ok1, sev: '10' }).err, '');
    // 上限 2000：滿了拒絕、不刪舊資料
    const full = Array.from({ length: 2000 }, (_, i) => ({ id: 'i' + i, date: '2026-03-01', time: '08:30', sym: 's', sev: 3, trig: '', note: '' }));
    r = m.addSym(full, ok1); assert.ok(r.err.includes('2000')); assert.strictEqual(r.list.length, 2000); assert.strictEqual(r.list[0].id, 'i0');
    assert.strictEqual(m.normSymList(Array.from({ length: 2500 }, (_, i) => ({ ...full[0], id: 'k' + i }))).length, 2000);
    // 載入驗證
    assert.deepStrictEqual(m.normSymList('x'), []); assert.deepStrictEqual(m.normSymList(null), []);
    const nl = m.normSymList([null, 5, { ...full[0], id: 'a', sev: 11 }, { ...full[0], id: 'a', sym: '' }, { ...full[0], id: 'b' }, { ...full[0], id: 'b', sym: 'dup' }, { ...full[0], id: 'c', sev: 6.4, note: 'n'.repeat(500) }, { ...full[0], id: 'd', date: 'bad' }]);
    assert.deepStrictEqual(nl.map(x => x.id), ['b', 'c']); assert.strictEqual(nl[1].sev, 6); assert.strictEqual(nl[1].note.length, 200);
    // 摘要與匯出文字
    const L = [{ id: '1', date: '2026-03-02', time: '09:00', sym: '頭痛', sev: 4, trig: '', note: '' }, { id: '2', date: '2026-03-01', time: '08:00', sym: '頭痛', sev: 8, trig: '熬夜', note: '吃止痛藥' }, { id: '3', date: '2026-03-03', time: '10:00', sym: '胸悶', sev: 5, trig: '', note: '' }];
    assert.deepStrictEqual(m.symSummary(L), [{ sym: '頭痛', n: 2, avg: 6, max: 8, last: '2026-03-02 09:00' }, { sym: '胸悶', n: 1, avg: 5, max: 5, last: '2026-03-03 10:00' }]);
    const t = m.symText(L, '2026-03-10'); assert.ok(t.includes('2026-03-01 ～ 2026-03-03，共 3 筆') && t.includes('頭痛：2 次，平均強度 6/10，最高 8/10') && t.includes('誘因：熬夜  備註：吃止痛藥') && t.includes('非醫療診斷'));
    assert.ok(t.indexOf('2026-03-01 08:00  ') < t.indexOf('2026-03-02 09:00  ')); assert.strictEqual(m.symText([], 'x'), '');
    // 問題清單
    r = m.addQ([], { q: ' 這藥吃多久？ ', date: '2026-04-01' }); assert.deepStrictEqual({ ...r.list[0], id: 0 }, { id: 0, q: '這藥吃多久？', a: '', done: false, date: '2026-04-01' });
    assert.ok(m.addQ([], { q: '' }).err); assert.ok(m.addQ([], { q: 'x'.repeat(201) }).err); assert.ok(m.addQ([], { q: 'a', date: '2026-13-01' }).err); assert.strictEqual(m.addQ([], { q: 'a', date: '' }).err, '');
    const qfull = Array.from({ length: 100 }, (_, i) => ({ id: 'q' + i, q: 'q', a: '', done: false, date: '' })); r = m.addQ(qfull, { q: 'z' }); assert.ok(r.err.includes('100')); assert.strictEqual(r.list.length, 100);
    assert.strictEqual(m.normQList(Array.from({ length: 150 }, (_, i) => ({ id: 'q' + i, q: 'q' }))).length, 100);
    let ql = m.patchQ(qfull.slice(0, 2), 'q1', { a: 'a'.repeat(600), done: true }); assert.strictEqual(ql[1].a.length, 500); assert.strictEqual(ql[1].done, true); assert.strictEqual(ql[0].done, false); assert.strictEqual(ql[1].id, 'q1');
    assert.deepStrictEqual(m.normQ({ id: 'x', q: 'a', done: 'yes', date: 'bad', a: 5 }), { id: 'x', q: 'a', a: '', done: false, date: '' });
    assert.strictEqual(m.normQ({ q: '' }), null);
    assert.strictEqual(m.qText([{ q: '問一', a: '吃七天', done: true, date: '' }, { q: '問二', a: '', done: false, date: '2026-04-01' }]), '1. [x] 問一\n   重點：吃七天\n2. [ ] 問二（就診日 2026-04-01）');
    ok('n10 health-log');
}

{ // ---------- timezone：出差 / 旅行版 ----------
    const m = load('utils/timezone.html', 'tripRows, tripText, diffLabel, MAX_TRIP_DAYS');
    // 台北 21:00 → 紐約：2026-03-08 美國夏令開始（台北無夏令）
    let r = m.tripRows('2026-03-07', '2026-03-09', '21:00', 'Asia/Taipei', 'America/New_York').rows;
    assert.deepStrictEqual(r.map(x => [x.d, x.to, x.tag, x.diff, x.shift, x.gap]), [['2026-03-07', '08:00', '', -780, false, false], ['2026-03-08', '09:00', '', -720, true, false], ['2026-03-09', '09:00', '', -720, false, false]]);
    assert.deepStrictEqual(r.map(x => x.wd), [6, 0, 1]);
    // 倫敦 10:00 → 台北：英國夏令 2026-10-25 結束
    r = m.tripRows('2026-10-24', '2026-10-26', '10:00', 'Europe/London', 'Asia/Taipei').rows;
    assert.deepStrictEqual(r.map(x => [x.to, x.diff, x.shift]), [['17:00', 420, false], ['18:00', 480, true], ['18:00', 480, false]]);
    // 跨日標記：台北 23:00 → 紐約（冬令）= 前一天 10:00；東京 → 台北 00:30 = 前一天
    assert.strictEqual(m.tripRows('2026-01-10', '2026-01-10', '03:00', 'Asia/Taipei', 'America/New_York').rows[0].tag, '（前一天）');
    assert.strictEqual(m.tripRows('2026-01-10', '2026-01-10', '00:30', 'Asia/Tokyo', 'Asia/Taipei').rows[0].tag, '（前一天）');
    assert.strictEqual(m.tripRows('2026-01-10', '2026-01-10', '23:30', 'Asia/Taipei', 'Asia/Tokyo').rows[0].tag, '（後一天）');
    // 夏令轉換日不存在的時間（紐約 2026-03-08 02:30）
    r = m.tripRows('2026-03-07', '2026-03-09', '02:30', 'America/New_York', 'Asia/Taipei').rows;
    assert.deepStrictEqual(r.map(x => x.gap), [false, true, false]);
    // 單日、驗證
    assert.strictEqual(m.tripRows('2026-05-01', '2026-05-01', '09:00', 'Asia/Taipei', 'Asia/Taipei').rows.length, 1);
    assert.strictEqual(m.tripRows('2026-05-01', '2026-05-31', '09:00', 'Asia/Taipei', 'Asia/Tokyo').rows.length, 31);
    assert.ok(m.tripRows('2026-05-01', '2026-06-01', '09:00', 'Asia/Taipei', 'Asia/Tokyo').err.includes('31'));
    assert.ok(m.tripRows('2026-05-02', '2026-05-01', '09:00', 'Asia/Taipei', 'Asia/Tokyo').err);
    assert.ok(m.tripRows('2026-02-30', '2026-03-01', '09:00', 'Asia/Taipei', 'Asia/Tokyo').err);
    assert.ok(m.tripRows('', '', '09:00', 'Asia/Taipei', 'Asia/Tokyo').err); assert.ok(m.tripRows('2026-05-01', '2026-05-01', '', 'Asia/Taipei', 'Asia/Tokyo').err);
    assert.ok(m.tripRows('2026-05-01', '2026-05-01', '24:00', 'Asia/Taipei', 'Asia/Tokyo').err);
    assert.strictEqual(m.diffLabel(-780), '慢 13 小時'); assert.strictEqual(m.diffLabel(330), '快 5:30 小時');
    const t = m.tripText(m.tripRows('2026-03-07', '2026-03-08', '21:00', 'Asia/Taipei', 'America/New_York').rows, '台北', '紐約');
    assert.ok(t.startsWith('台北 → 紐約') && t.includes('03-07（六）台北 21:00 = 紐約 08:00') && t.includes('時差變動（紐約慢 12 小時）'));
    ok('n10 timezone');
}
