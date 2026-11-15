// 批次 t6：待辦四象限 / 睡眠週期 / 番茄鐘週報與護眼 / 世界時鐘 純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

// ---- 待辦四象限 ----
{
    const m = load('fun/todo.html', 'QUADS, quadOf, setQuad, validItem');
    assert.equal(m.quadOf({ id: 'a', t: 'x', due: '', done: false }), 'drop', '舊資料缺欄位 = 不重要不緊急');
    assert.equal(m.quadOf({ important: true, urgent: true }), 'do');
    assert.equal(m.quadOf({ important: true, urgent: false }), 'plan');
    assert.equal(m.quadOf({ important: false, urgent: true }), 'delegate');
    assert.equal(m.quadOf({ important: 'yes', urgent: 1 }), 'drop', '非布林不算');
    const it = { id: 'a', t: 'x', due: '', done: false };
    for (const [k] of m.QUADS) { assert.ok(m.setQuad(it, k)); assert.equal(m.quadOf(it), k); }
    assert.equal(m.setQuad(it, 'zzz'), false);
    assert.ok(m.validItem({ ...it, important: true }), '多的選填欄位不影響驗證');
    ok('todo quadrants');
}

// ---- 睡眠週期 ----
{
    const m = load('fun/sleep-log.html', 'cyclePlan, fmtMin');
    // 07:00 起床、入睡需 15 分：6 個週期 = 540 分 → 07:00 - 9h - 15m = 21:45
    const bed = m.cyclePlan('bed', 7 * 60, 15);
    assert.deepEqual(bed.map(p => p.cycles), [6, 5, 4]);
    assert.equal(m.fmtMin(bed[0].mins), '21:45');
    assert.equal(m.fmtMin(bed[1].mins), '23:15');
    assert.equal(m.fmtMin(bed[2].mins), '00:45', '跨午夜');
    // 23:00 入睡 → 4 個週期 + 15 分 = 05:15
    const wake = m.cyclePlan('wake', 23 * 60, 15);
    assert.deepEqual(wake.map(p => p.cycles), [4, 5, 6]);
    assert.equal(m.fmtMin(wake[0].mins), '05:15');
    assert.equal(m.fmtMin(wake[2].mins), '08:15');
    assert.equal(m.cyclePlan('wake', 0, 999)[0].mins, 60 + 360, '入睡所需上限 60');
    assert.equal(m.cyclePlan('wake', 0, NaN)[0].mins, 15 + 360, '壞值回 15');
    ok('sleep cycles');
}

// ---- 番茄鐘週報 / 護眼 ----
{
    const m = load('fun/pomodoro.html', 'lastDays, streak, weekReport, cleanEye, eyeStep');
    const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    const today = '2026-11-16', hist = {};
    hist[today] = { count: 2, minutes: 50 }; hist[shift(today, -1)] = { count: 1, minutes: 25 };
    hist[shift(today, -7)] = { count: 4, minutes: 100 };
    const w = m.weekReport(hist, today, shift);
    assert.equal(w.days.length, 7);
    assert.deepEqual(w.cur, { count: 3, minutes: 75, active: 2 });
    assert.deepEqual(w.prev, { count: 4, minutes: 100, active: 1 });
    assert.equal(w.diff, -25);
    assert.equal(w.streak, 2);
    assert.deepEqual(m.weekReport({}, today, shift).cur, { count: 0, minutes: 0, active: 0 });

    assert.deepEqual(m.cleanEye(null), { on: false, quiet: true, beep: true });
    assert.deepEqual(m.cleanEye([1]), { on: false, quiet: true, beep: true });
    assert.deepEqual(m.cleanEye({ on: 1, quiet: false, beep: 'x' }), { on: false, quiet: false, beep: true });
    assert.deepEqual(m.cleanEye({ on: true, beep: false }), { on: true, quiet: true, beep: false });

    const I = 20 * 60000;
    assert.deepEqual(m.eyeStep(1000, 500, I, false), { fire: false, nextAt: 1000 });
    assert.deepEqual(m.eyeStep(1000, 1000, I, false), { fire: true, nextAt: 1000 + I });
    assert.deepEqual(m.eyeStep(1000, 5 * I, I, false), { fire: true, nextAt: 5 * I + I }, '背景補算只觸發一次');
    assert.deepEqual(m.eyeStep(1000, 2000, I, true), { fire: false, nextAt: 1000 }, '專注中擋住，維持到期');
    assert.equal(m.eyeStep(1000, 2001, I, false).fire, true, '解除後立刻觸發');
    ok('pomodoro week / eye');
}

// ---- 世界時鐘 ----
{
    const m = load('utils/timezone.html', 'normClocks, isDayHour, diffMin, localDiffText, fmtClock, DEFAULT_CLOCKS, MAX_CLOCKS');
    const isZone = (z) => { try { new Intl.DateTimeFormat('en', { timeZone: z }); return true; } catch (e) { return false; } };
    assert.ok(m.DEFAULT_CLOCKS.length >= 8);
    assert.deepEqual(m.normClocks(null, isZone), { zones: m.DEFAULT_CLOCKS, h12: false });
    assert.deepEqual(m.normClocks('x', isZone).zones, m.DEFAULT_CLOCKS);
    assert.deepEqual(m.normClocks({ zones: 5 }, isZone).zones, m.DEFAULT_CLOCKS);
    const r = m.normClocks({ zones: ['Asia/Tokyo', 'Asia/Tokyo', 'Nope/Zone', 7, null, 'Europe/London'], h12: true }, isZone);
    assert.deepEqual(r, { zones: ['Asia/Tokyo', 'Europe/London'], h12: true });
    assert.equal(m.normClocks({ zones: [] }, isZone).zones.length, 0, '空清單合法');
    const many = Array.from({ length: 40 }, (_, i) => `Etc/GMT+${(i % 12) + 1}`);
    assert.ok(m.normClocks({ zones: many }, isZone).zones.length <= m.MAX_CLOCKS);
    assert.equal(m.isDayHour(5), false); assert.equal(m.isDayHour(6), true); assert.equal(m.isDayHour(17), true); assert.equal(m.isDayHour(18), false);
    const t = Date.UTC(2026, 0, 15, 12);   // 冬季，無夏令
    assert.equal(m.diffMin(t, 'Asia/Tokyo', 'Asia/Taipei'), 60);
    assert.equal(m.diffMin(t, 'Europe/London', 'Asia/Taipei'), -480);
    assert.equal(m.diffMin(t, 'Asia/Kolkata', 'Asia/Taipei'), -150);
    assert.equal(m.localDiffText(0), '與本地相同');
    assert.equal(m.localDiffText(60), '比本地快 1 小時');
    assert.equal(m.localDiffText(-150), '比本地慢 2:30 小時');
    assert.equal(m.fmtClock({ h: 0, mi: 5, s: 9 }, false, true), '00:05:09');
    assert.equal(m.fmtClock({ h: 0, mi: 5, s: 9 }, true, false), '上午 12:05');
    assert.equal(m.fmtClock({ h: 15, mi: 30, s: 0 }, true, false), '下午 3:30');
    ok('world clock');
}
