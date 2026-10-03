// y3 批次：習慣打卡（數量型 / 提醒）、輪值表（家事分配）、比價（折扣 / 稅額）、文字工具（符號表）
const { load, ok, near } = require('./_load');
const assert = require('assert');

// ===== 習慣打卡 =====
{
    const m = load('fun/habit-tracker.html', 'streaks, normHabit, doneDates, addAmount, weekSeries, quickSteps, toMin, inWindow, shouldRemind');
    // 舊資料完全相容：只有 id/name/dates
    const old = m.normHabit({ id: 'a', name: '運動', dates: ['2026-10-01', '2026-10-02'] });
    assert.deepEqual(old, { id: 'a', name: '運動', dates: ['2026-10-01', '2026-10-02'] });
    assert.deepEqual(m.doneDates(old), ['2026-10-01', '2026-10-02']);
    // 壞資料容錯
    assert.equal(m.normHabit(null), null); assert.equal(m.normHabit({ id: 1 }), null); assert.equal(m.normHabit('x'), null);
    assert.deepEqual(m.normHabit({ id: 'b', name: 'x', dates: 'bad' }).dates, []);
    assert.deepEqual(m.normHabit({ id: 'b', name: 'x', dates: ['2026-10-01', 5, 'zz'] }).dates, ['2026-10-01']);
    assert.ok(m.normHabit({ name: 'noid', dates: [] }).id);
    const w = m.normHabit({ id: 'w', name: '喝水', type: 'count', goal: 2000, unit: 'ml', logs: { '2026-10-01': 2500, '2026-10-02': 1999, 'bad': 5, '2026-10-03': -3, '2026-10-04': 'abc' } });
    assert.deepEqual(w.logs, { '2026-10-01': 2500, '2026-10-02': 1999 });
    assert.equal(m.normHabit({ id: 'w', name: 'x', type: 'count', goal: -5 }).goal, 1);           // 壞目標補預設
    assert.deepEqual(m.normHabit({ id: 'w', name: 'x', type: 'count', goal: 3 }).logs, {});
    // 數量型：達標才算完成
    assert.deepEqual(m.doneDates(w), ['2026-10-01']);
    w.logs['2026-10-02'] = 2000; assert.deepEqual(m.doneDates(w), ['2026-10-01', '2026-10-02']);
    // 連續天數同時支援兩種型別
    w.logs['2026-10-03'] = 2000;
    assert.equal(m.streaks(m.doneDates(w), '2026-10-03').current, 3);
    assert.equal(m.streaks(m.doneDates(w), '2026-10-04').current, 3);                               // 今天還沒達標，從昨天算
    w.logs['2026-10-03'] = 100; assert.equal(m.streaks(m.doneDates(w), '2026-10-03').current, 2);   // 昨天往回
    assert.equal(m.streaks(m.doneDates(w), '2026-10-05').current, 0);
    // addAmount
    assert.deepEqual(m.addAmount({}, 'd', 250), { d: 250 });
    assert.deepEqual(m.addAmount({ d: 250 }, 'd', 500), { d: 750 });
    assert.deepEqual(m.addAmount({ d: 250 }, 'd', -1000), {});                                      // 不低於 0，歸零就移除
    assert.deepEqual(m.addAmount({ d: 0.1 }, 'd', 0.2), { d: 0.3 });                                // 浮點誤差
    const base = { d: 1 }; m.addAmount(base, 'd', 5); assert.deepEqual(base, { d: 1 });             // 不改原物件
    // 週圖表
    const ws = m.weekSeries(w, '2026-10-03');
    assert.equal(ws.length, 7); assert.equal(ws[6].day, '2026-10-03'); assert.equal(ws[0].day, '2026-09-27');
    assert.equal(ws[5].v, 2000); assert.equal(ws[5].done, true); assert.equal(ws[6].done, false); assert.equal(ws[0].v, 0);
    const wc = m.weekSeries(old, '2026-10-02');
    assert.deepEqual(wc.slice(-2).map(x => [x.v, x.done]), [[1, true], [1, true]]); assert.equal(wc[0].v, 0);
    assert.deepEqual(m.quickSteps(2000), [250, 500]); assert.deepEqual(m.quickSteps(300), [10, 50]); assert.deepEqual(m.quickSteps(8), [1, 5]);
    // 提醒時段 / 間隔
    assert.equal(m.toMin('08:30'), 510); assert.ok(isNaN(m.toMin('25:00'))); assert.ok(isNaN(m.toMin(''))); assert.ok(isNaN(m.toMin(null)));
    assert.equal(m.inWindow(600, '08:00', '22:00'), true); assert.equal(m.inWindow(420, '08:00', '22:00'), false); assert.equal(m.inWindow(1321, '08:00', '22:00'), false);
    assert.equal(m.inWindow(480, '08:00', '22:00'), true); assert.equal(m.inWindow(1320, '08:00', '22:00'), true);        // 邊界含
    assert.equal(m.inWindow(60, '22:00', '06:00'), true); assert.equal(m.inWindow(720, '22:00', '06:00'), false);          // 跨午夜
    assert.equal(m.inWindow(5, '', 'x'), true);                                                                             // 壞時間不限制
    const cfg = { on: true, every: 60, from: '08:00', to: '22:00' }, t0 = 1e12;
    assert.equal(m.shouldRemind(cfg, 600, t0, t0 + 59 * 60000), false);
    assert.equal(m.shouldRemind(cfg, 600, t0, t0 + 60 * 60000), true);
    assert.equal(m.shouldRemind({ ...cfg, on: false }, 600, t0, t0 + 1e9), false);                                          // 可關閉
    assert.equal(m.shouldRemind(cfg, 60, t0, t0 + 1e9), false);                                                             // 時段外
    assert.equal(m.shouldRemind({ ...cfg, every: 30 }, 600, t0, t0 + 30 * 60000), true);
    assert.equal(m.shouldRemind({ ...cfg, every: 'x' }, 600, t0, t0 + 60 * 60000), true);                                   // 壞間隔當 60
    assert.equal(m.shouldRemind(null, 600, 0, 1e12), false);
    ok('y3 habit-tracker: count habits / compat / week / reminder');
}

// ===== 輪值表：家事分配 =====
{
    const m = load('utils/duty-roster.html', 'buildRoster, tally, occurrences, assignChores, choreStats, choresText, normChoreData, FREQ');
    // 既有輪值表不變
    const r = m.buildRoster({ names: ['小明', '小華', '小美'], start: '2026-10-05', period: 'week', count: 4 });
    assert.deepEqual(r.map(x => x.name), ['小明', '小華', '小美', '小明']); assert.equal(r[1].date, '2026-10-12');

    const C = (id, freq, score) => ({ id, name: id, freq, score });
    assert.equal(m.occurrences([C('a', 'day', 1), C('b', 'week', 2), C('c', 'month', 3), C('d', 'once', 1)], 'week').length, 7 + 1 + 0 + 1);
    assert.equal(m.occurrences([C('a', 'day', 1), C('b', 'week', 2), C('c', 'month', 3), C('d', 'once', 1)], 'month').length, 30 + 4 + 1 + 1);
    // 空輸入
    assert.deepEqual(m.assignChores({ chores: [], members: ['A'], period: 'week' }).rows, []);
    assert.deepEqual(m.assignChores({ chores: [C('a', 'week', 1)], members: [], period: 'week' }).rows, []);
    // 單人：全部給他
    const one = m.assignChores({ chores: [C('a', 'day', 2)], members: ['A'], period: 'week' });
    assert.equal(one.rows.length, 7); assert.equal(one.totals.A, 14);
    // 總分差最小：與暴力窮舉比對（隨機小案例）
    let seed = 7; const rand = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
    const brute = (scores, M) => {
        let best = Infinity; const tot = Array(M).fill(0);
        (function go(i) { if (i === scores.length) { best = Math.min(best, Math.max(...tot) - Math.min(...tot)); return; } for (let k = 0; k < M; k++) { tot[k] += scores[i]; go(i + 1); tot[k] -= scores[i]; } })(0);
        return best;
    };
    for (let t = 0; t < 60; t++) {
        const M = 2 + rand(2), nCh = 2 + rand(4), chores = [], scores = [];
        for (let i = 0; i < nCh; i++) { const sc = 1 + rand(3), fr = ['week', 'once', 'week'][rand(3)]; chores.push(C('c' + i, fr, sc)); scores.push(sc); }
        const members = ['A', 'B', 'C'].slice(0, M), res = m.assignChores({ chores, members, period: 'week' });
        assert.equal(res.rows.length, nCh); assert.equal(res.spread, brute(scores, M), JSON.stringify({ scores, M }));
        assert.equal(Object.values(res.totals).reduce((a, b) => a + b, 0), scores.reduce((a, b) => a + b, 0));
    }
    // 每天的家事、3 人：不連續同一人，且次數平均
    const daily = m.assignChores({ chores: [C('dish', 'day', 1)], members: ['A', 'B', 'C'], period: 'week' });
    for (let i = 1; i < 7; i++) assert.notEqual(daily.rows[i].member, daily.rows[i - 1].member);
    assert.ok(daily.spread <= 1);
    // 有上一輪紀錄：第一次不要是上一輪最後一位
    const p1 = m.assignChores({ chores: [C('dish', 'day', 1)], members: ['A', 'B', 'C'], period: 'week', prev: { dish: 'A' } });
    assert.notEqual(p1.rows[0].member, 'A'); assert.equal(p1.repeats, 0);
    // 兩人兩件每週家事：上一輪 A 做 x、B 做 y → 這輪對調
    const sw = m.assignChores({ chores: [C('x', 'week', 2), C('y', 'week', 2)], members: ['A', 'B'], period: 'week', prev: { x: 'A', y: 'B' } });
    assert.equal(sw.spread, 0); assert.equal(sw.rows.find(z => z.cid === 'x').member, 'B'); assert.equal(sw.rows.find(z => z.cid === 'y').member, 'A');
    // 平衡優先於避免重複：單一家事只有一件、兩人 → 仍然分配
    const lone = m.assignChores({ chores: [C('x', 'week', 3)], members: ['A', 'B'], period: 'week', prev: { x: 'A' } });
    assert.equal(lone.rows[0].member, 'B');
    // 大案例效能與完整性
    const t0 = Date.now();
    const big = m.assignChores({ chores: [C('a', 'day', 1), C('b', 'day', 2), C('c', 'week', 3), C('d', 'month', 3), C('e', 'once', 2)], members: ['A', 'B', 'C', 'D'], period: 'month' });
    assert.equal(big.rows.length, 30 + 30 + 4 + 1 + 1); assert.ok(big.spread <= 1, 'spread ' + big.spread); assert.ok(Date.now() - t0 < 8000);
    // 統計：週一起算
    const recs = [
        { member: 'A', score: 2, date: '2026-10-05' }, { member: 'A', score: 1, date: '2026-10-07' },   // 本週（10/05 週一 ~ 10/11）
        { member: 'B', score: 3, date: '2026-10-04' },                                                   // 上週日：本月但不是本週
        { member: 'B', score: 1, date: '2026-09-30' }, { member: 'A', score: 1, date: '2026-10-09' },    // 上月；本週但還沒到（今天 10/07）
        null, { member: 'C', score: 1 }];
    const st = m.choreStats(recs, '2026-10-07');
    assert.deepEqual(st.week, { A: { n: 2, score: 3 } });
    assert.deepEqual(st.month, { A: { n: 2, score: 3 }, B: { n: 1, score: 3 } });
    assert.deepEqual(m.choreStats([], '2026-10-07'), { week: {}, month: {} });
    // 週日當天算在該週最後一天
    assert.deepEqual(m.choreStats([{ member: 'A', score: 1, date: '2026-10-05' }], '2026-10-11').week, { A: { n: 1, score: 1 } });
    // 複製文字
    const rows = [{ member: 'A', name: '洗碗', score: 1 }, { member: 'A', name: '洗碗', score: 1 }, { member: 'A', name: '倒垃圾', score: 2 }, { member: 'B', name: '拖地', score: 3 }];
    assert.equal(m.choresText(rows, ['A', 'B', 'C'], 'week'), '家事分配（本週）\nA（4 分）：洗碗 ×2、倒垃圾\nB（3 分）：拖地\nC（0 分）：無');
    assert.ok(m.choresText(rows, ['A'], 'month').startsWith('家事分配（本月）'));
    // 讀取驗證
    for (const bad of [null, undefined, 5, 'x', [], {}, { chores: 'x', table: 7, log: 3 }]) { const n = m.normChoreData(bad); assert.deepEqual(n.chores, []); assert.equal(n.table, null); assert.deepEqual(n.log, []); assert.equal(n.members, ''); }
    const nd = m.normChoreData({ members: 'A\nB', chores: [{ id: 'k', name: '洗碗', freq: 'zz', score: 9 }, { name: '' }, null, { name: '掃地', freq: 'day', score: 0 }], table: { period: 'month', rows: [{ cid: 'k', name: '洗碗', score: 2, member: 'A', done: '2026-10-01' }, { bad: 1 }] }, log: [{ member: 'A', score: 1, date: '2026-10-01' }, 7] });
    assert.deepEqual(nd.chores.map(c => [c.name, c.freq, c.score]), [['洗碗', 'week', 3], ['掃地', 'day', 1]]);
    assert.equal(nd.table.rows.length, 1); assert.equal(nd.table.period, 'month'); assert.equal(nd.log.length, 1);
    ok('y3 duty-roster: chores assign (vs brute force) / stats / text / normalize');
}

// ===== 比價：折扣 / 稅額 =====
{
    const m = load('utils/price-compare.html', 'UNITS, compare, rd, zheFactor, applyDiscounts, bogo, taxCalc, touristRefund, normTax');
    // 既有比價不變
    assert.equal(m.compare([{ price: 80, amount: 500, count: 1, unit: 'g' }, { price: 150, amount: 1, count: 1, unit: 'kg' }])[1].best, true);
    // 取整
    assert.equal(m.rd(2.5, 'round'), 3); assert.equal(m.rd(2.4, 'round'), 2); assert.equal(m.rd(2.9, 'floor'), 2); assert.equal(m.rd(2.1, 'ceil'), 3);
    assert.equal(m.rd(3, 'ceil'), 3); assert.equal(m.rd(2.345, 'none'), 2.35); assert.equal(m.rd(0.1 + 0.2, 'none'), 0.3); assert.equal(m.rd(1000 * 0.95, 'floor'), 950);
    // 折數
    near(m.zheFactor(8), 0.8); near(m.zheFactor(85), 0.85); near(m.zheFactor(9.5), 0.95); near(m.zheFactor(10), 1);
    assert.ok(isNaN(m.zheFactor(0))); assert.ok(isNaN(m.zheFactor(-1))); assert.ok(isNaN(m.zheFactor(100))); assert.ok(isNaN(m.zheFactor('x')));
    // 折上折：1000 → 8 折 800 → 9 折 720 = 7.2 折
    let d = m.applyDiscounts(1000, [{ kind: 'zhe', a: 8 }, { kind: 'zhe', a: 9 }]);
    assert.equal(d.final, 720); assert.equal(d.zhe, 7.2); assert.equal(d.saved, 280); assert.equal(d.steps.length, 2); assert.equal(d.steps[0].after, 800);
    d = m.applyDiscounts(1000, [{ kind: 'off', a: 20 }]); assert.equal(d.final, 800);
    d = m.applyDiscounts(1200, [{ kind: 'minus', a: 1000, b: 100 }]); assert.equal(d.final, 1100);
    d = m.applyDiscounts(900, [{ kind: 'minus', a: 1000, b: 100 }]); assert.equal(d.final, 900); assert.ok(d.steps[0].text.includes('未達'));
    d = m.applyDiscounts(2500, [{ kind: 'minusx', a: 1000, b: 100 }]); assert.equal(d.final, 2300);
    d = m.applyDiscounts(1500, [{ kind: 'full', a: 1000, b: 9 }]); assert.equal(d.final, 1350);
    d = m.applyDiscounts(500, [{ kind: 'full', a: 1000, b: 9 }]); assert.equal(d.final, 500);
    d = m.applyDiscounts(1200, [{ kind: 'full', a: 1000, b: 9 }, { kind: 'minus', a: 1000, b: 100 }]); assert.equal(d.final, 980);   // 1080 → 滿千再減百
    // 後面層是否達門檻看「折後」金額
    d = m.applyDiscounts(1000, [{ kind: 'zhe', a: 8 }, { kind: 'minus', a: 1000, b: 100 }]); assert.equal(d.final, 800);
    // 取整：1999 打 85 折 = 1699.15
    assert.equal(m.applyDiscounts(1999, [{ kind: 'zhe', a: 85 }], 'round').final, 1699);
    assert.equal(m.applyDiscounts(1999, [{ kind: 'zhe', a: 85 }], 'ceil').final, 1700);
    assert.equal(m.applyDiscounts(1999, [{ kind: 'zhe', a: 85 }], 'none').final, 1699.15);
    assert.equal(m.applyDiscounts(1999, [{ kind: 'zhe', a: 85 }], 'floor').final, 1699);
    // 每層取整與否會差 1 元：25 → 9 折 22.5 → 9 折 20.25
    assert.equal(m.applyDiscounts(25, [{ kind: 'zhe', a: 9 }, { kind: 'zhe', a: 9 }], 'floor', false).final, 20);
    assert.equal(m.applyDiscounts(25, [{ kind: 'zhe', a: 9 }, { kind: 'zhe', a: 9 }], 'floor', true).final, 19);
    // 壞輸入：無效層略過、負價 / NaN 回 null、折後不為負
    assert.equal(m.applyDiscounts(100, [{ kind: 'zhe', a: 'x' }, { kind: 'zzz', a: 1 }, { kind: 'off', a: 200 }]).final, 100);
    assert.equal(m.applyDiscounts(NaN, []), null); assert.equal(m.applyDiscounts(-5, []), null);
    assert.equal(m.applyDiscounts(50, [{ kind: 'minus', a: 10, b: 999 }]).final, 0);
    assert.equal(m.applyDiscounts(0, [{ kind: 'zhe', a: 8 }]).zhe, null);
    assert.equal(m.applyDiscounts(100, []).final, 100);
    // 買 N 送 M
    let b = m.bogo(100, 2, 1); assert.equal(b.zhe, 6.67); assert.equal(b.qty, 3); assert.equal(b.total, 200); assert.equal(b.per, 67);
    assert.equal(m.bogo(100, 1, 1).zhe, 5); assert.equal(m.bogo(100, 1, 0).zhe, 10); assert.equal(m.bogo(100, 3, 1, 'none').per, 75);
    assert.equal(m.bogo(100, 0, 1), null); assert.equal(m.bogo(100, 1.5, 1), null); assert.equal(m.bogo(-1, 1, 1), null);
    // 含稅 / 未稅
    assert.deepEqual(m.taxCalc(1050, 5, 'incl'), { net: 1000, tax: 50, gross: 1050 });
    assert.deepEqual(m.taxCalc(1000, 5, 'excl'), { net: 1000, tax: 50, gross: 1050 });
    assert.deepEqual(m.taxCalc(100, 5, 'incl', 'none'), { net: 95.24, tax: 4.76, gross: 100 });
    assert.deepEqual(m.taxCalc(100, 5, 'incl', 'floor'), { net: 96, tax: 4, gross: 100 });
    assert.deepEqual(m.taxCalc(100, 5, 'incl', 'ceil'), { net: 95, tax: 5, gross: 100 });
    assert.deepEqual(m.taxCalc(100, 10, 'excl'), { net: 100, tax: 10, gross: 110 });
    assert.deepEqual(m.taxCalc(100, 0, 'incl'), { net: 100, tax: 0, gross: 100 });
    assert.equal(m.taxCalc(-1, 5, 'incl'), null); assert.equal(m.taxCalc(100, NaN, 'incl'), null); assert.equal(m.taxCalc(100, -5, 'excl'), null);
    // 外國旅客退稅
    let t = m.touristRefund(2100); assert.deepEqual(t, { eligible: true, tax: 100, refund: 100 });
    t = m.touristRefund(1999); assert.equal(t.eligible, false);
    t = m.touristRefund(2000); assert.equal(t.eligible, true); assert.equal(t.tax, 95);
    t = m.touristRefund(2100, 10); assert.equal(t.refund, 90);
    assert.equal(m.touristRefund(-1), null); assert.equal(m.touristRefund(2000, 120), null);
    // 讀取驗證
    for (const bad of [null, 5, 'x', [], { layers: 'x', round: 'zz', tab: 3 }]) { const n = m.normTax(bad); assert.equal(n.round, 'round'); assert.equal(n.tab, 'cmp'); assert.equal(n.layers.length, 1); assert.equal(n.bN, '2'); }
    const nt = m.normTax({ tab: 'tax', round: 'floor', layers: [{ kind: 'off', a: '10' }, { kind: 'bad' }, null], tRate: 'custom', tCustom: 8, orig: 5 });
    assert.equal(nt.tab, 'tax'); assert.equal(nt.round, 'floor'); assert.deepEqual(nt.layers, [{ kind: 'off', a: '10', b: '' }]); assert.equal(nt.tCustom, '10'); assert.equal(nt.orig, '');
    ok('y3 price-compare: discounts / bogo / tax / tourist refund / normalize');
}

// ===== 文字工具：符號表 =====
{
    const m = load('utils/text-tools.html', 'OPS, SYMBOLS, SYM_DATA, SYM_CATS, searchSymbols, addRecent, normRecent, fwTable', '// 每個操作', 'const $ =');
    // 既有操作不變
    assert.equal(m.OPS['全形 → 半形']('ＡＢＣ１２３　！'), 'ABC123 !');
    // 資料完整
    for (const g of ['標點', '箭頭', '數學', '貨幣', '單位', '框線', '注音', '圈號數字', '羅馬數字', '日文假名', '表情']) assert.ok(m.SYM_CATS.includes(g), '缺分類 ' + g);
    for (const g of m.SYM_CATS) assert.ok(m.SYM_DATA[g].length >= 10, g + ' 太少');
    assert.ok(m.SYMBOLS.length > 400);
    const seen = new Set();
    for (const x of m.SYMBOLS) {
        assert.ok(typeof x.c === 'string' && [...x.c].length === 1, '單一字元：' + x.c);
        assert.ok(typeof x.n === 'string' && x.n && !x.n.includes('undefined'), '缺名稱：' + x.c + ' ' + x.g);
        assert.ok(!seen.has(x.c), '重複：' + x.c); seen.add(x.c);
    }
    assert.equal(m.SYM_DATA['注音'].filter(([c]) => /[ㄅ-ㄩ]/.test(c)).length, 37);
    assert.equal(m.SYM_DATA['圈號數字'][0][0], '①'); assert.equal(m.SYM_DATA['羅馬數字'][11][0], 'Ⅻ');
    const kana = m.SYM_DATA['日文假名'].map(([c]) => c); assert.ok(kana.includes('あ') && kana.includes('ア') && kana.includes('ん') && kana.includes('ン'));
    // 搜尋
    const has = (r, c) => r.some(x => x.c === c);
    assert.equal(m.searchSymbols('').length, m.SYMBOLS.length);
    assert.ok(has(m.searchSymbols('箭頭'), '→')); assert.ok(has(m.searchSymbols('ARROW', ''), '→') || has(m.searchSymbols('箭頭 right'), '→'));
    assert.ok(has(m.searchSymbols('heart'), '♥')); assert.ok(has(m.searchSymbols('HEART'), '♥'));
    assert.ok(has(m.searchSymbols('→'), '→'));                                           // 用字元搜尋
    assert.ok(has(m.searchSymbols('貨幣 歐元'), '€')); assert.ok(!has(m.searchSymbols('貨幣 歐元'), '$'));   // 多關鍵字 AND
    assert.equal(m.searchSymbols('不存在的詞zzqq').length, 0);
    assert.ok(m.searchSymbols('', '羅馬數字').every(x => x.g === '羅馬數字') && m.searchSymbols('', '羅馬數字').length === 24);
    assert.ok(has(m.searchSymbols('ka', '日文假名'), 'か') && has(m.searchSymbols('katakana ka'), 'カ'));
    assert.ok(has(m.searchSymbols('  攝氏  '), '℃'));                                      // 前後空白
    assert.equal(m.searchSymbols(null).length, m.SYMBOLS.length);
    // 最近使用
    assert.deepEqual(m.addRecent([], 'a'), ['a']); assert.deepEqual(m.addRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
    assert.equal(m.addRecent(Array.from({ length: 24 }, (_, i) => 'x' + i), 'n').length, 24); assert.equal(m.addRecent(Array.from({ length: 24 }, (_, i) => 'x' + i), 'n')[0], 'n');
    assert.deepEqual(m.normRecent(['→', 'zzz', 5, null, '€']), ['→', '€']); assert.deepEqual(m.normRecent('x'), []); assert.deepEqual(m.normRecent(null), []);
    // 全形半形對照表
    const fw = m.fwTable();
    assert.equal(fw.length, 95); assert.deepEqual(fw[0], { h: ' ', f: '　' }); assert.deepEqual(fw[1], { h: '!', f: '！' }); assert.deepEqual(fw.at(-1), { h: '~', f: '～' });
    assert.ok(fw.every(x => m.OPS['全形 → 半形'](x.f) === x.h) && fw.every(x => m.OPS['半形 → 全形'](x.h) === x.f));
    ok('y3 text-tools: symbols data / search / recent / fullwidth table');
}
