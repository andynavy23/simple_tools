// 點子批次：待辦重複 / 白噪音設定 / 貪睡 / 各種 CSV 與 ICS 匯出的純邏輯
const assert = require('assert');
const { load, ok } = require('./_load');

{   // todo：每月月底進位、搜尋比對
    const { nextDue, matchQ, REPS } = load('fun/todo.html', 'nextDue, matchQ, REPS');
    assert.equal(nextDue('2026-01-31', 'm'), '2026-02-28');
    assert.equal(nextDue('2028-01-31', 'm'), '2028-02-29');
    assert.equal(nextDue('2026-12-15', 'm'), '2027-01-15');
    assert.equal(nextDue('2026-02-28', 'd'), '2026-03-01');
    assert.equal(nextDue('2026-02-28', 'w'), '2026-03-07');
    assert.deepEqual(REPS, ['d', 'w', 'm']);
    assert.ok(matchQ({ t: '繳費：水' }, '繳費') && !matchQ({ t: '倒垃圾' }, '繳費') && matchQ({ t: 'abc' }, ''));
    ok('todo rep / search');
}
{   // white-noise：wn_opts 容錯
    const { cleanOpts } = load('fun/white-noise.html', 'cleanOpts');
    assert.deepEqual(cleanOpts(null), { s: ['rain'], v: 40, t: 0 });
    assert.deepEqual(cleanOpts({ s: ['rain', 'wind', 'rain', 'x', 'pink', 'white'], v: 150, t: 30 }), { s: ['rain', 'wind', 'pink'], v: 100, t: 30 });
    assert.deepEqual(cleanOpts({ s: 'x', v: 'a', t: 7 }), { s: ['rain'], v: 40, t: 0 });
    assert.deepEqual(cleanOpts([1]), { s: ['rain'], v: 40, t: 0 });
    ok('white-noise opts');
}
{   // alarm：貪睡分鐘數
    const { cleanSnz } = load('fun/alarm.html', 'cleanSnz');
    assert.deepEqual([5, 10, 15, '10', 7, null, 'x', undefined].map(cleanSnz), [5, 10, 15, 10, 5, 5, 5, 5]);
    ok('alarm snooze minutes');
}
{   // workout-log CSV：每組一列、公式注入防護、單位
    const { workoutCsv } = load('fun/workout-log.html', 'workoutCsv');
    const log = [
        { id: 'a', d: '2026-01-02', m: 'squat', s: [[100, 5], [100, 5, 8], [90, 8]], n: '=SUM(1)', rpe: null },
        { id: 'b', d: '2026-01-05', m: 'bench', s: [[60, 10], [60, 8], [60, 6]], n: '', rpe: 7 },
    ];
    const csv = workoutCsv(log, (id) => (id === 'squat' ? '深蹲' : '臥推'), false, 'epley').split('\r\n');
    assert.equal(csv.length, 7);
    assert.ok(csv[0].includes('重量(kg)'));
    assert.ok(csv[1].endsWith(",'=SUM(1)"));
    assert.ok(workoutCsv(log, () => 'x', true, 'epley').includes('重量(lb)'));
    ok('workout csv');
}
{   // habit-tracker CSV
    const { habitCsv } = load('fun/habit-tracker.html', 'habitCsv');
    const mk = (n) => Array.from({ length: 5 }, (_, i) => `2026-03-0${i + 1}`);
    const csv = habitCsv([{ id: 'a', name: '運動, 慢跑', dates: mk() }, { id: 'b', name: '喝水', type: 'count', goal: 2000, unit: 'ml', logs: Object.fromEntries(mk().map((d, i) => [d, 500 * (i + 1)])), dates: [] }]).split('\r\n');
    assert.equal(csv.length, 11);
    assert.ok(csv[1].startsWith('"運動, 慢跑",2026-03-01,1') || csv[1].startsWith('喝水,2026-03-01,500,ml'));
    assert.ok(csv.some(l => l === '喝水,2026-03-05,2500,ml'));
    assert.ok(habitCsv([{ id: 'c', name: '=cmd', dates: ['2026-03-01'] }]).includes("'=cmd"));
    ok('habit csv');
}
{   // sleep-log CSV
    const { sleepCsv } = load('fun/sleep-log.html', 'sleepCsv');
    const csv = sleepCsv([{ d: '2026-02-02', bt: '23:30', wt: '07:00', q: 4, n: '@x' }, { d: '2026-02-01', bt: '00:00', wt: '08:00', q: 3, n: '' }]).split('\r\n');
    assert.equal(csv[1], '2026-02-01,00:00,08:00,8,3,');
    assert.equal(csv[2], "2026-02-02,23:30,07:00,7.5,4,'@x");
    ok('sleep csv');
}
{   // duty-roster ICS
    const { buildRoster, rosterIcs } = load('utils/duty-roster.html', 'buildRoster, rosterIcs');
    const rows = buildRoster({ names: ['A', 'B', 'C', 'D'], start: '2026-03-02', period: 'week', count: 12 });
    const all = rosterIcs(rows, new Date('2026-01-01T00:00:00Z'));
    assert.equal(all.split('BEGIN:VEVENT').length - 1, 12);
    assert.ok(all.includes('DTSTART;VALUE=DATE:20260302') && all.includes('DTEND;VALUE=DATE:20260303') && all.includes('SUMMARY:輪值：A'));
    const b = rosterIcs(rows, new Date(), 'B');
    assert.equal(b.split('BEGIN:VEVENT').length - 1, 3);
    assert.ok(!b.includes('輪值：A'));
    assert.equal(rosterIcs(buildRoster({ names: ['A'], start: '2026-03-02', period: 'day', count: 120 }), new Date()).split('BEGIN:VEVENT').length - 1, 52);
    ok('roster ics');
}
{   // tw-holidays ICS：春節連假起訖與清單一致，補班日單獨一筆
    const { buildMap, restRuns, runsIcs } = load('utils/tw-holidays.html', 'buildMap, restRuns, runsIcs');
    const map = buildMap([2025, 2026, 2027], []);
    const ics = runsIcs(map, '2026', new Date('2026-01-01T00:00:00Z'));
    const cny = restRuns(map, '2026-01-01', '2026-12-31').find(r => r.names.some(n => n.includes('春節')));
    assert.ok(cny);
    const d8 = (d) => d.replace(/-/g, ''), end = new Date(Date.parse(cny.to) + 864e5).toISOString().slice(0, 10);
    assert.ok(ics.includes(`DTSTART;VALUE=DATE:${d8(cny.from)}`) && ics.includes(`DTEND;VALUE=DATE:${d8(end)}`));
    const ics25 = runsIcs(map, '2025', new Date());
    assert.ok(ics25.includes('SUMMARY:補班：') && ics25.includes('DTSTART;VALUE=DATE:20250208'));
    ok('tw-holidays ics');
}
