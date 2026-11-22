// 批次 s9：約時間投票（live-poll）與台灣連假（tw-holidays）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

{
    const m = load('fun/live-poll.html', 'validSlot, slotError, schedVote, tallySched, rankSched, schedText, validBallot, validSState, MAX_SLOTS');
    const A = { d: '2025-03-01', s: '19:00', e: '21:00' }, B = { d: '2025-03-02', s: '14:00', e: '16:00' };
    assert.ok(m.validSlot(A)); for (const bad of [null, { ...A, d: '2025-02-30' }, { ...A, e: '19:00' }, { ...A, s: '25:00' }, { ...A, d: '3/1' }]) assert.ok(!m.validSlot(bad));
    assert.ok(m.slotError([A], A) && m.slotError([], { ...A, e: '08:00' }) && !m.slotError([A], B));
    assert.ok(m.slotError(Array(30).fill(A), B));
    const st = { phase: 'open', slots: [A, B], ballots: new Map() };
    assert.ok(m.schedVote(st, '小明', 0, 2) && m.schedVote(st, '小明', 1, 0) && m.schedVote(st, '小華', 0, 2) && m.schedVote(st, '小華', 1, 1));
    assert.ok(!m.schedVote(st, '小明', 2, 1) && !m.schedVote(st, '小明', -1, 1) && !m.schedVote(st, '小明', 0, 3) && !m.schedVote(st, '小明', 0.5, 1) && !m.schedVote(st, '', 0, 1) && !m.schedVote({ ...st, phase: 'closed' }, '小明', 0, 1));
    assert.ok(m.schedVote(st, '小明', 0, 1));  // 重投覆蓋
    assert.deepEqual(st.ballots.get('小明'), [1, 0]);
    m.schedVote(st, '小明', 0, 2);
    const t = m.tallySched(st.slots, st.ballots);
    assert.deepEqual(t[0], { y: 2, m: 0, n: 0, who: [] }); assert.deepEqual(t[1], { y: 0, m: 1, n: 1, who: ['小明'] });
    const order = m.rankSched(st.slots, t); assert.deepEqual(order, [0, 1]);
    assert.ok(m.schedText(st.slots, t, order, 2).includes('不能：小明'));
    const full = { phase: 'open', slots: [A], ballots: new Map() }; for (let i = 0; i < 30; i++) assert.ok(m.schedVote(full, 'u' + i, 0, 2)); assert.ok(!m.schedVote(full, 'extra', 0, 2));
    const S = { phase: 'open', slots: [A, B], tally: t, order, people: 2, voted: 2 };
    assert.ok(m.validSState(S)); for (const bad of [null, { ...S, phase: 'x' }, { ...S, tally: [] }, { ...S, order: [0, 5] }, { ...S, slots: [A, { d: 'x' }] }, { ...S, voted: -1 }]) assert.ok(!m.validSState(bad));
    assert.ok(m.validBallot([null, 0, 2]) && !m.validBallot([3]) && !m.validBallot('x') && !m.validBallot(Array(31).fill(1)));
    ok('live-poll sched');
}

{
    const m = load('utils/tw-holidays.html', 'lunarOf, qingming, lunarEvents, autoHolidays, buildMap, isRest, restRuns, nextRun, optimizeLeave, cleanCustom, validCustom');
    // 農曆節日
    assert.equal(m.lunarEvents(2025).ny, '2025-01-29'); assert.equal(m.lunarEvents(2026).ny, '2026-02-17');
    assert.equal(m.lunarEvents(2025).dw, '2025-05-31'); assert.equal(m.lunarEvents(2025).mf, '2025-10-06');
    assert.equal(m.lunarEvents(2026).dw, '2026-06-19'); assert.equal(m.lunarEvents(2026).mf, '2026-09-25');
    assert.deepEqual([2025, 2026, 2027].map(m.qingming), [4, 5, 5]);
    // 補假規則：2025 端午週六 → 5/30、光復節週六 → 10/24、教師節週日 → 9/29
    const h25 = m.autoHolidays(2025).map(x => x.d);
    for (const d of ['2025-05-30', '2025-10-24', '2025-09-29', '2025-04-03', '2025-04-04']) assert.ok(h25.includes(d), d);
    // 2026 兒童節 / 清明週六日 → 4/3、4/6
    const h26 = m.autoHolidays(2026).map(x => x.d); assert.ok(h26.includes('2026-04-03') && h26.includes('2026-04-06'));
    // 2025 春節連假：1/25–2/2 共 9 天，2/8 補班
    const map = m.buildMap([2024, 2025, 2026], []);
    const runs = m.restRuns(map, '2025-01-01', '2025-12-31');
    const cny = runs.find(r => r.from === '2025-01-25'); assert.ok(cny && cny.to === '2025-02-02' && cny.len === 9);
    assert.ok(!m.isRest(map, '2025-02-08') && m.isRest(map, '2025-02-09'));
    const nx = m.nextRun(runs, '2025-01-01'); assert.ok(nx.until >= 0);
    // 請假最佳化：構造日曆（週一至五上班，週末休）：請 1 天最長 4 連休；週三有國定假日 → 請 2 天（週一二）連休 ... 
    const simple = new Map([['2025-06-18', { kind: 'off', name: 'X' }]]);   // 2025-06-18 是週三
    const ps = m.optimizeLeave(simple, 2025, 2);
    const c1 = ps.filter(p => p.cost === 1).sort((a, b) => b.len - a.len)[0]; assert.ok(c1 && c1.len >= 3);
    const c2 = ps.find(p => p.from <= '2025-06-18' && p.to >= '2025-06-18'); assert.ok(c2); assert.ok(c2.len >= 5);
    assert.ok(ps.every(p => p.cost <= 2 && p.leave.length === p.cost));
    // 2025 春節：N=2 方案存在且包含 9 天連假以上
    const p2 = m.optimizeLeave(map, 2025, 2); assert.ok(p2.some(p => p.len >= 9));
    // 自訂資料驗證
    assert.equal(m.cleanCustom([{ id: 'a', d: '2025-01-01', kind: 'off', name: 'x' }, null, { id: 'b', d: '2025-13-01', kind: 'off', name: 'x' }, { id: 'c', d: '2025-01-02', kind: 'bad', name: '' }, 5]).length, 1);
    assert.deepEqual(m.cleanCustom('x'), []); assert.equal(m.cleanCustom(Array(300).fill({ id: 'a', d: '2025-01-01', kind: 'work', name: '' })).length, 200);
    // 農曆校正：Intl 對 2027 春節差一天（算 2/7，實為 2/6）；初一 / 端午 / 中秋 對照權威日期
    assert.equal(m.lunarEvents(2027).ny, '2027-02-06'); assert.equal(m.lunarEvents(2027).dw, '2027-06-09'); assert.equal(m.lunarEvents(2027).mf, '2027-09-15');
    assert.deepEqual(m.lunarOf('2027-02-05'), { m: 12, d: 29, leap: false }); assert.deepEqual(m.lunarOf('2027-03-07'), { m: 1, d: 30, leap: false }); assert.deepEqual(m.lunarOf('2027-03-08'), { m: 2, d: 1, leap: false });
    assert.equal(m.lunarEvents(2030).ny, '2030-02-03');
    assert.deepEqual([2025, 2026, 2027].map(y => m.autoHolidays(y).filter(x => x.name === '除夕').map(x => x.d)[0]), ['2025-01-28', '2026-02-16', '2027-02-05']);
    // 116 年辦公日曆表（查證 2026-11-22）：總放假日數 121 日 = 平日放假 17 天 + 週末 104 天
    assert.equal(m.autoHolidays(2027).filter(x => { const w = TwHol.dow(x.d); return w > 0 && w < 6; }).length, 17);
    // 人事行政總處辦公日曆表：2026 春節 2/14–2/22 共 9 天（2/15 補假在 2/20）、無補班；2027 春節 2/4–2/10 共 7 天
    const map2 = m.buildMap([2025, 2026, 2027, 2028], []);
    const has = (y, a, b, len) => { const r = m.restRuns(map2, y + '-01-01', y + '-12-31').find(x => x.from === a); assert.ok(r && r.to === b && r.len === len, a + ' ' + JSON.stringify(r)); };
    has(2026, '2026-02-14', '2026-02-22', 9); has(2026, '2026-02-27', '2026-03-01', 3); has(2026, '2026-04-03', '2026-04-06', 4); has(2026, '2026-05-01', '2026-05-03', 3);
    has(2026, '2026-06-19', '2026-06-21', 3); has(2026, '2026-09-25', '2026-09-28', 4); has(2026, '2026-10-09', '2026-10-11', 3); has(2026, '2026-10-24', '2026-10-26', 3); has(2026, '2026-12-25', '2026-12-27', 3);
    has(2027, '2027-02-04', '2027-02-10', 7); has(2027, '2027-04-03', '2027-04-06', 4); has(2027, '2027-04-30', '2027-05-02', 3); has(2027, '2027-12-24', '2027-12-26', 3); has(2027, '2027-12-31', '2028-01-02', 3);
    // 全年總放假日數（含週末）：2026 = 120、2027 = 121（人事行政總處公告）
    const rest = (y) => { let n = 0; for (let d = y + '-01-01'; d <= y + '-12-31'; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)) if (m.isRest(map2, d)) n++; return n; };
    assert.equal(rest(2026), 120); assert.equal(rest(2027), 121);
    assert.ok(![...map2].some(([d, e]) => e.kind === 'work' && d >= '2026-01-01'), '2026 起無補班');
    // 真實資料的請假最佳化：2026 春節 N=4 可得 ≥ 9 天、且請的日子都是平日
    const real = m.optimizeLeave(map2, 2026, 4); assert.ok(real.some(p => p.len >= 9) && real.every(p => p.leave.every(d => !m.isRest(map2, d))));
    ok('tw-holidays');
}
