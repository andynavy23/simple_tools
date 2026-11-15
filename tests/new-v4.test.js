// 批次 v4：防詐騙主題、列印日曆純函式、會議成本、放大鏡裁切
const { load, ok } = require('./_load');
const assert = require('assert');
{
    const m = load('utils/life-ref.html', 'TOPICS, CATS, searchTopics, checkData');
    assert.deepEqual(m.checkData(m.TOPICS, m.CATS), []);
    const sc = m.TOPICS.filter(t => t.cat === '防詐騙');
    assert.ok(sc.length >= 13);
    for (const t of sc) assert.ok(t.title && t.kw.split(/\s+/).length >= 6 && t.rows.length >= 7, t.id);
    for (const w of ['165', '解除分期', '猜猜我是誰', '假檢警', '殺豬盤', '求職詐騙']) assert.ok(m.searchTopics(m.TOPICS, w, '防詐騙').length >= 1, w);
    ok('life-ref: 防詐騙');
}
{
    const T = load('utils/tw-holidays.html', 'monthGrid, lunarDayName, lunarLabel, validMark, cleanMarks, marksOn');
    const g0 = T.monthGrid(2026, 3, 0), g1 = T.monthGrid(2026, 3, 1);
    assert.equal(g0.length % 7, 0); assert.equal(g0.filter(Boolean).length, 31);
    assert.equal(g0.indexOf('2026-03-01'), 0);          // 2026-03-01 是週日
    assert.equal(g1.indexOf('2026-03-01'), 6);
    assert.equal(T.lunarDayName(1), '初一'); assert.equal(T.lunarDayName(10), '初十'); assert.equal(T.lunarDayName(15), '十五'); assert.equal(T.lunarDayName(20), '二十'); assert.equal(T.lunarDayName(21), '廿一'); assert.equal(T.lunarDayName(30), '三十');
    assert.equal(T.lunarLabel('2026-02-17'), '正月'); assert.equal(T.lunarLabel('2026-02-18'), '初二');
    const mk = { id: 'a', d: '2024-05-06', text: '生日', yearly: true };
    assert.ok(T.validMark(mk) && !T.validMark({ ...mk, d: '2024-02-30' }) && !T.validMark({ ...mk, text: '' }) && !T.validMark(null) && !T.validMark({ ...mk, yearly: 'y' }));
    assert.equal(T.cleanMarks('x').length, 0); assert.equal(T.cleanMarks([mk, null, 5, { ...mk, id: 3 }]).length, 1);
    assert.equal(T.cleanMarks(Array(150).fill(mk)).length, 100);
    assert.deepEqual(T.marksOn([mk], '2026-05-06'), ['生日']); assert.deepEqual(T.marksOn([{ ...mk, yearly: false }], '2026-05-06'), []);
    ok('tw-holidays: 列印日曆');
}
{
    const B = load('utils/biz-calc.html', 'parseMeeting, meetingCost, burned, fmtClock');
    const p = B.parseMeeting('主管,2,900\n工程師,5,500');
    assert.equal(p.err, null); assert.equal(p.groups.length, 2);
    const c = B.meetingCost(p.groups, 30, 52);
    assert.equal(c.perHour, 4300); assert.equal(c.people, 7); assert.equal(c.total, 2150); assert.equal(c.annual, 111800);
    for (const bad of ['', 'a,b,c', 'x,0,100', 'x,1.5,100', 'x,1,-5', 'x,1', Array(11).fill('a,1,1').join('\n')]) assert.ok(B.parseMeeting(bad).err, bad);
    assert.equal(B.burned(3600, 1000), 1); assert.equal(B.burned(3600, -5), 0);
    assert.equal(B.fmtClock(3723000), '01:02:03');
    ok('biz-calc: 會議成本');
}
{
    const M = load('utils/magnifier.html', 'splitZoom, cropRect, FILTERS');
    assert.deepEqual(M.splitZoom(3, null), { hw: 0, dig: 3 });
    assert.deepEqual(M.splitZoom(6, { min: 1, max: 4 }), { hw: 4, dig: 1.5 });
    assert.deepEqual(M.splitZoom(2, { min: 1, max: 4 }), { hw: 2, dig: 1 });
    assert.equal(M.splitZoom(99, null).dig, 8); assert.equal(M.splitZoom('x', null).dig, 1);
    const r = M.cropRect(1000, 800, 4);
    assert.deepEqual(r, { sx: 375, sy: 300, sw: 250, sh: 200 });
    assert.deepEqual(M.cropRect(1000, 800, 0.5), { sx: 0, sy: 0, sw: 1000, sh: 800 });
    assert.equal(M.FILTERS.length, 4);
    ok('magnifier: zoom/crop');
}
