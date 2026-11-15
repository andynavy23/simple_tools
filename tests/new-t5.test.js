// 批次 t5：健康小幫手（斷食 / 呼吸 / 伸展 / 運動紀錄）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('fun/wellness-kit.html', 'MAXH, MAXL, twDay, dayShift, fastHours, eatHours, fastInfo, fmtDur, fastStreak, cleanFast, BREATH, breathAt, cleanBreath, STRETCH, stretchPlan, planSecs, cleanLog, dayStats, last7, cleanOpts');
const H = 3600e3;

// 台灣時間 UTC+8
assert.equal(m.twDay(Date.parse('2026-11-15T16:30:00Z')), '2026-11-16');
assert.equal(m.dayShift('2026-03-01', -1), '2026-02-28');
ok('twDay / dayShift');

// 時間戳進度
assert.equal(m.fastHours('16:8'), 16); assert.equal(m.fastHours('omad'), 23); assert.equal(m.fastHours('custom', 99), 72); assert.equal(m.fastHours('custom', 'x'), 16);
assert.equal(m.eatHours(16), 8);
{
    const i = m.fastInfo(0, 4 * H, 16); assert.equal(i.pct, .25); assert.equal(i.remain, 12 * H); assert.ok(!i.done);
    const j = m.fastInfo(0, 20 * H, 16); assert.ok(j.done && j.pct === 1 && j.remain === 0);
    assert.equal(m.fastInfo(10, 5, 16).el, 0, '時鐘倒退不為負');
    assert.equal(m.fmtDur(3661000), '1:01:01'); assert.equal(m.fmtDur(-5), '0:00:00');
}
ok('fastInfo');

// 連續達標
{
    const e = (d, okk = true) => ({ id: d, s: 0, e: Date.parse(d + 'T04:00:00Z'), g: 16, ok: okk });
    const hist = [e('2026-11-13'), e('2026-11-14'), e('2026-11-15')];
    assert.equal(m.fastStreak(hist, '2026-11-16'), 3, '今天還沒有，從昨天算');
    assert.equal(m.fastStreak([...hist, e('2026-11-16')], '2026-11-16'), 4);
    assert.equal(m.fastStreak([e('2026-11-13'), e('2026-11-15')], '2026-11-16'), 1);
    assert.equal(m.fastStreak([e('2026-11-15', false)], '2026-11-16'), 0);
    assert.equal(m.fastStreak([], '2026-11-16'), 0);
}
ok('fastStreak');

// 載入驗證
{
    const bad = [null, 5, 'x', [], { hist: 'x' }, { cur: { s: 'a' }, eat: 3, hist: [null, 1, { id: 1 }] }];
    bad.forEach(b => { const c = m.cleanFast(b); assert.ok(Array.isArray(c.hist) && c.mode && c.cur === null || c.cur); });
    const c = m.cleanFast({ mode: 'zz', hist: [{ id: 'a', s: 1000, e: 1000 + 17 * H, g: 16, ok: false }, { id: 'b', s: 5, e: 2, g: 16 }] });
    assert.equal(c.mode, '16:8'); assert.equal(c.hist.length, 1); assert.equal(c.hist[0].ok, true, 'ok 由時長重算');
    const big = Array.from({ length: 400 }, (_, i) => ({ id: 'i' + i, s: 1000 + i, e: 2000 + i, g: 16 }));
    assert.equal(m.cleanFast({ hist: big }).hist.length, m.MAXH);
    assert.deepEqual(m.cleanFast({ cur: { s: 1e12, g: 16 }, eat: { s: 1e12, h: 8 } }).eat, null, '斷食中不留進食視窗');
}
ok('cleanFast');

// 呼吸排程
{
    const a = m.BREATH['478']; // 19 秒一回合
    let r = m.breathAt(a, 0, 4); assert.equal(r.k, 0); assert.equal(r.round, 1); assert.equal(r.rem, 4); assert.equal(r.size, .4);
    r = m.breathAt(a, 4, 4); assert.equal(r.k, 1); assert.equal(r.size, 1);
    r = m.breathAt(a, 15, 4); assert.equal(r.k, 2); assert.equal(r.name, '吐氣'); assert.ok(r.size < 1 && r.size > .4);
    r = m.breathAt(a, 19, 4); assert.equal(r.round, 2); assert.equal(r.k, 0);
    assert.ok(m.breathAt(a, 76, 4).done); assert.equal(m.breathAt(a, 76, 4).total, 76);
    const box = m.breathAt(m.BREATH.box, 13, 2); assert.equal(box.k, 3); assert.equal(box.size, .4);
    const res = m.breathAt(m.BREATH.res, 5.5, 1); assert.equal(res.k, 2);
    assert.ok(m.breathAt([0, 0, 0, 0], 0, 3).done);
    assert.deepEqual(m.cleanBreath([0, 0, 0, 0]), [4, 4, 4, 4]); assert.deepEqual(m.cleanBreath('x'), [4, 4, 4, 4]);
    assert.deepEqual(m.cleanBreath([99, -1, 2.3, 'a']), [20, 0, 2.5, 0]);
}
ok('breathAt');

// 伸展內容
{
    assert.equal(m.STRETCH.length, 6);
    m.STRETCH.forEach(p => { assert.ok(p.m.length >= 4, p.n); p.m.forEach(x => assert.ok(x.n && x.d && x.e && x.s >= 10 && x.s <= 60)); });
    const all = m.planSecs(m.stretchPlan('all')); assert.ok(all >= 180 && all <= 300, '全套 3–5 分鐘：' + all);
    assert.equal(m.stretchPlan('nope').length, 0);
}
ok('stretch');

// 運動紀錄
{
    const L = [{ id: 'a', d: '2026-11-16', it: '深蹲', n: 20 }, { id: 'b', d: '2026-11-16', it: '深蹲', n: 15 }, { id: 'c', d: '2026-11-16', it: '跳繩', n: 100 }, { id: 'd', d: '2026-11-12', it: '深蹲', n: 30 }, { id: 'e', d: '2026-11-01', it: '深蹲', n: 99 }];
    const s = m.dayStats(L, '2026-11-16'); assert.equal(s.find(x => x.it === '深蹲').n, 35); assert.equal(s.find(x => x.it === '深蹲').sets, 2);
    const w = m.last7(L, '2026-11-16', '深蹲'); assert.equal(w.length, 7); assert.equal(w[0].d, '2026-11-10'); assert.equal(w[6].n, 35); assert.equal(w[2].n, 30); assert.equal(w.reduce((x, y) => x + y.n, 0), 65);
    assert.equal(m.last7(L, '2026-11-16', '').reduce((x, y) => x + y.n, 0), 165);
    assert.equal(m.cleanLog([null, { id: 'x', d: 'bad', it: 'a', n: 1 }, { id: 'y', d: '2026-11-16', it: 'a', n: 1.5 }, { id: 'z', d: '2026-11-16', it: 'a', n: 1 }]).length, 1);
    assert.equal(m.cleanLog('x').length, 0);
    const big = Array.from({ length: 1200 }, (_, i) => ({ id: 'i' + i, d: '2026-11-16', it: 'a', n: 1 }));
    assert.equal(m.cleanLog(big).length, m.MAXL);
}
ok('workout log');

// 選項
{
    const o = m.cleanOpts({ bp: 'zz', br: 999, rest: -3, item: 5, tab: 'x', bc: null }); assert.equal(o.bp, '478'); assert.equal(o.br, 60); assert.equal(o.rest, 0); assert.equal(o.item, '伏地挺身'); assert.equal(o.tab, 'fast');
    assert.equal(m.cleanOpts(null).rest, 60); assert.equal(m.cleanOpts({ rest: 0 }).rest, 0);
}
ok('cleanOpts');
