// l8 批次：親子生活小幫手（fun/kids-routine.html）的純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('fun/kids-routine.html', 'phaseAt, cleanOpts, addKid, removeKid, cleanStars, pruneStars, addStar, toggleStep, removeStep, dayStars, totalStars, bedDone, streak, cleanSteps, cleanSegs, segDur, inSeg, segAt, arcOf, arcPath, hhmm, parseHM, balance, nonNeg, progress, cleanGoal, cleanBank, addRec, delRec, twDay, twMin, isDay, BRUSH, WASH, DEF_SEGS, MAX_KIDS, MAX_STEPS, MAX_SEGS, MAX_RECS');

{ // 計時
    const bs = m.BRUSH.map(z => z.s), ws = m.WASH.map(z => z.s);
    assert.strictEqual(bs.reduce((a, b) => a + b), 120); assert.strictEqual(ws.reduce((a, b) => a + b), 20);
    let r = m.phaseAt(0, bs); assert.deepStrictEqual([r.done, r.idx, r.left, r.totalLeft], [false, 0, 20000, 120000]);
    r = m.phaseAt(19999, bs); assert.strictEqual(r.idx, 0); assert.strictEqual(r.left, 1);
    r = m.phaseAt(20000, bs); assert.strictEqual(r.idx, 1); assert.strictEqual(r.left, 20000);
    r = m.phaseAt(119999, bs); assert.strictEqual(r.idx, 5); assert.ok(!r.done);
    r = m.phaseAt(120000, bs); assert.ok(r.done); assert.strictEqual(r.totalLeft, 0);
    assert.ok(m.phaseAt(9e9, bs).done); assert.strictEqual(m.phaseAt(-5, bs).idx, 0);   // 時鐘倒退不當機
    assert.strictEqual(m.phaseAt(2999, ws).idx, 0); assert.strictEqual(m.phaseAt(3000, ws).idx, 1); assert.strictEqual(m.phaseAt(18000, ws).idx, 6); assert.ok(m.phaseAt(20000, ws).done);
    assert.strictEqual(m.phaseAt(1000, ws, 0.1).idx, 3);                                  // scale 縮短
    ok('l8: 計時分段');
}
{ // 日期（UTC+8、跨午夜）
    const t = Date.UTC(2026, 0, 1, 15, 59, 59);            // 台灣 23:59:59
    assert.strictEqual(m.twDay(t), '2026-01-01'); assert.strictEqual(m.twDay(t + 1000), '2026-01-02'); assert.strictEqual(m.twMin(t), 1439); assert.strictEqual(m.twMin(t + 1000), 0);
    assert.ok(m.isDay('2024-02-29') && !m.isDay('2023-02-29') && !m.isDay('2024-2-1') && !m.isDay(5) && !m.isDay('2024-13-01'));
    ok('l8: 台灣時間');
}
{ // 小朋友
    let o = m.cleanOpts(null); assert.strictEqual(o.kids.length, 1); assert.strictEqual(o.cur, o.kids[0].id); assert.strictEqual(o.sound, false);
    o = m.cleanOpts({ kids: [null, 'x', { id: 'a', name: '  小明  ' }, { id: 'a', name: '重複' }, { id: '__proto__', name: 'x' }, { id: 'b' }], cur: 'zz', sound: 'yes' });
    assert.deepStrictEqual(o.kids, [{ id: 'a', name: '小明' }, { id: 'b', name: '小朋友' }]); assert.strictEqual(o.cur, 'a'); assert.strictEqual(o.sound, false);
    o = m.cleanOpts({ kids: Array.from({ length: 10 }, (_, i) => ({ id: 'k' + i, name: 'n' })) }); assert.strictEqual(o.kids.length, m.MAX_KIDS);
    o = m.cleanOpts({ kids: [{ id: 'a', name: 'x' }], sound: true }); assert.strictEqual(o.sound, true);
    for (let i = 0; i < 5; i++) assert.strictEqual(m.addKid(o, '孩' + i), '');
    assert.ok(m.addKid(o, '第七位').includes('最多')); assert.strictEqual(o.kids.length, 6);
    // 刪除連帶刪星星與記錄
    const ids = o.kids.map(k => k.id), id = ids[1], st = m.cleanStars({}, ids, '2026-01-10'), bk = m.cleanBank({}, ids);
    m.addStar(st, id, '2026-01-10', 'b'); bk[id].recs.push({ id: 'r1', t: '2026-01-10', a: 5, n: '' });
    o.cur = id;
    assert.strictEqual(m.removeKid(o, st, bk, id), ''); assert.ok(!(id in st) && !(id in bk) && o.cur === ids[0] && o.kids.length === 5);
    assert.ok(m.removeKid(o, st, bk, 'nope')); const one = m.cleanOpts(null); assert.ok(m.removeKid(one, {}, {}, one.kids[0].id).includes('至少'));
    ok('l8: 小朋友與連帶刪除');
}
{ // 星星與修剪
    const today = '2026-04-30';
    const cut90 = Util.day.shift(today, -89);
    const raw = { a: { [cut90]: { b: 1 }, [Util.day.shift(cut90, -1)]: { b: 1 }, [today]: { w: 2, s: ['x', 'x', 5, 'y'] }, '2026-05-01': { b: 1 }, 'bad': { b: 1 }, '2026-03-01': { b: 99, w: -3, s: 'z' }, '2026-03-02': null, '2026-03-03': { b: 0, w: 0, s: [] } }, zz: { [today]: { b: 1 } }, 7: 1 };
    const s = m.cleanStars(raw, ['a', 'c'], today);
    assert.deepStrictEqual(Object.keys(s), ['a', 'c']);       // 沒列在小朋友清單的鍵被丟掉
    assert.deepStrictEqual(Object.keys(s.a).sort(), [cut90, today].sort());   // 邊界：剛好 90 天保留，再早一天、未來、壞日期都丟掉；全 0 與壞值被清掉
    assert.deepStrictEqual(s.a[today], { b: 0, w: 2, s: ['x', 'y'] });
    assert.deepStrictEqual(m.cleanStars('壞', ['a'], today), { a: {} }); assert.deepStrictEqual(m.cleanStars([1], ['a'], today), { a: {} });
    // 修剪
    const p = { a: { [Util.day.shift(cut90, -1)]: { b: 1, w: 0, s: [] }, [cut90]: { b: 1, w: 0, s: [] }, [today]: { b: 1, w: 0, s: [] } } }; m.pruneStars(p, today); assert.deepStrictEqual(Object.keys(p.a).sort(), [cut90, today].sort());
    // 上限
    const q = {}; let got = 0; for (let i = 0; i < 10; i++) if (m.addStar(q, 'a', today, 'b')) got++; assert.strictEqual(got, 6);
    got = 0; for (let i = 0; i < 30; i++) if (m.addStar(q, 'a', today, 'w')) got++; assert.strictEqual(got, 20);
    ok('l8: 星星與 90 天修剪');
}
{ // 睡前打勾與連續天數
    const ids = ['s1', 's2'], T = '2026-03-10', st = {};
    assert.ok(m.toggleStep(st, 'a', T, 's1')); assert.ok(!m.toggleStep(st, 'a', T, 's1')); m.toggleStep(st, 'a', T, 's1');
    assert.strictEqual(m.dayStars(st, 'a', T, ids), 1); assert.ok(!m.bedDone(st, 'a', T, ids)); assert.strictEqual(m.streak(st, 'a', ids, T), 0);
    m.toggleStep(st, 'a', T, 's2'); assert.ok(m.bedDone(st, 'a', T, ids)); assert.strictEqual(m.streak(st, 'a', ids, T), 1);
    for (const d of ['2026-03-09', '2026-03-08', '2026-03-06']) ids.forEach(i => m.toggleStep(st, 'a', d, i));
    assert.strictEqual(m.streak(st, 'a', ids, T), 3);                           // 3/7 沒做 → 斷
    assert.strictEqual(m.streak(st, 'a', ids, '2026-03-11'), 3);                // 今天還沒做：從昨天算，不歸零
    assert.strictEqual(m.streak(st, 'a', ids, '2026-03-12'), 0);
    assert.strictEqual(m.streak(st, 'a', [], T), 0);                            // 沒有步驟不算完成
    assert.strictEqual(m.streak(st, 'zz', ids, T), 0);
    const y = {}; ['2025-12-31', '2026-01-01'].forEach(d => ids.forEach(i => m.toggleStep(y, 'a', d, i))); assert.strictEqual(m.streak(y, 'a', ids, '2026-01-01'), 2);   // 跨年
    m.removeStep(st, 's2'); assert.strictEqual(m.dayStars(st, 'a', T, ['s1']), 1); assert.ok(!st.a[T].s.includes('s2'));
    assert.strictEqual(m.totalStars(st, 'a', ['s1']), 4);
    ok('l8: 睡前與連續天數');
}
{ // 清單驗證
    assert.strictEqual(m.cleanSteps(undefined).length, 4); assert.strictEqual(m.cleanSteps('x').length, 4); assert.deepStrictEqual(m.cleanSteps([]), []);
    const s = m.cleanSteps([{ id: 'a', name: ' 洗澡 ', emoji: '🛁' }, { id: 'a', name: '重複' }, { id: 'b', name: '' }, null, { id: 'c', name: 'x'.repeat(30) }]);
    assert.deepStrictEqual(s.map(x => x.id), ['a', 'c']); assert.strictEqual(s[1].name.length, 12); assert.strictEqual(s[1].emoji, '⭐');
    assert.strictEqual(m.cleanSteps(Array.from({ length: 40 }, (_, i) => ({ id: 'i' + i, name: 'n' }))).length, m.MAX_STEPS);
    assert.strictEqual(m.cleanSegs(null).length, 7);
    const g = m.cleanSegs([{ id: 'a', name: 'n', start: 5, end: 5 }, { id: 'b', name: 'n', start: 1440, end: 1 }, { id: 'c', name: 'n', start: '60', end: 90, color: 'red' }, { id: 'd', name: 'n', start: null, end: 3 }]);
    assert.strictEqual(g.length, 1); assert.strictEqual(g[0].color, '#9ad1ff'); assert.strictEqual(g[0].start, 60);
    assert.strictEqual(m.cleanSegs(Array.from({ length: 30 }, (_, i) => ({ id: 'i' + i, name: 'n', start: 0, end: 5 }))).length, m.MAX_SEGS);
    ok('l8: 清單驗證');
}
{ // 作息圓弧
    const night = { start: 1260, end: 420 }, day = { start: 480, end: 720 };
    assert.strictEqual(m.segDur(night), 600); assert.strictEqual(m.segDur(day), 240);
    assert.ok(m.inSeg(night, 1300) && m.inSeg(night, 0) && m.inSeg(night, 419) && !m.inSeg(night, 420) && m.inSeg(night, 1260) && !m.inSeg(night, 1259));   // 跨午夜
    assert.ok(m.inSeg(day, 480) && !m.inSeg(day, 720));
    const a = m.arcOf(day); assert.strictEqual(a.a0, 120); assert.strictEqual(a.sweep, 60);
    assert.strictEqual(m.arcOf(night).sweep, 150);
    assert.strictEqual(m.DEF_SEGS.reduce((s, x) => s + m.segDur(x), 0), 1440);                // 預設作息剛好涵蓋一天
    for (let t = 0; t < 1440; t += 7) assert.ok(m.segAt(m.DEF_SEGS, t));
    assert.strictEqual(m.segAt([day], 0), null);
    assert.ok(m.arcPath(100, 100, 46, 92, 0, 90).startsWith('M100 8A92 92 0 0 1 192 100L146 100A46 46 0 0 0 100 54Z'));
    assert.ok(m.arcPath(100, 100, 46, 92, 0, 200).includes('0 1 1'));                         // 超過半圈 large-arc
    assert.strictEqual(m.hhmm(65), '01:05'); assert.strictEqual(m.parseHM('7:05'), 425); assert.ok(isNaN(m.parseHM('24:00')) && isNaN(m.parseHM('')) && isNaN(m.parseHM('09:60')));
    ok('l8: 作息圓弧');
}
{ // 存錢筒
    assert.strictEqual(m.progress(50, 200), .25); assert.strictEqual(m.progress(500, 200), 1); assert.strictEqual(m.progress(-5, 200), 0); assert.strictEqual(m.progress(5, 0), 0);
    assert.strictEqual(m.cleanGoal({ name: 'x', target: 0 }), null); assert.strictEqual(m.cleanGoal({ target: '1.5' }), null); assert.deepStrictEqual(m.cleanGoal({ name: '樂高', target: '800', reward: '吃冰' }), { name: '樂高', target: 800, reward: '吃冰' });
    const e = { goal: null, recs: [] };
    assert.strictEqual(m.addRec(e, 100, '2026-03-01', '紅包'), ''); assert.strictEqual(m.addRec(e, -30, '2026-03-02', ''), ''); assert.strictEqual(m.balance(e.recs), 70);
    assert.ok(m.addRec(e, -71, '2026-03-02', '')); assert.ok(m.addRec(e, 0, 'x', '')); assert.ok(m.addRec(e, 'abc', 'x', '')); assert.ok(m.addRec(e, 1.5, 'x', '')); assert.ok(m.addRec(e, 2e6, 'x', ''));
    assert.strictEqual(e.recs.length, 2);
    assert.ok(m.delRec(e, e.recs[0].id).includes('不夠')); assert.strictEqual(e.recs.length, 2);   // 刪存入會讓提領不夠 → 拒絕
    assert.strictEqual(m.delRec(e, e.recs[1].id), ''); assert.strictEqual(m.delRec(e, e.recs[0].id), ''); assert.strictEqual(e.recs.length, 0); assert.ok(m.delRec(e, 'zz'));
    const f = { goal: null, recs: [] }; for (let i = 0; i < m.MAX_RECS; i++) assert.strictEqual(m.addRec(f, 1, '2026-03-01', ''), '');
    assert.ok(m.addRec(f, 1, '2026-03-01', '').includes('已滿')); assert.strictEqual(f.recs.length, 500);   // 滿了拒絕新增
    const b = m.cleanBank({ a: { goal: { target: 'x' }, recs: Array.from({ length: 600 }, (_, i) => ({ id: 'r' + i, t: '2026-03-01', a: 1 })).concat([{ id: 'r0', t: '2026-03-01', a: 1 }, { id: 'bad', t: 'x', a: 1 }, { id: 'z', t: '2026-03-01', a: 0 }, null]) }, b: 'x', zz: {} }, ['a', 'b', 'c']);
    assert.deepStrictEqual(Object.keys(b), ['a', 'b', 'c']); assert.strictEqual(b.a.recs.length, 500); assert.strictEqual(b.a.goal, null); assert.deepStrictEqual(b.b, { goal: null, recs: [] });
    assert.strictEqual(b.a.recs[499].id, 'r599');
    assert.deepStrictEqual(m.cleanBank(null, ['a']), { a: { goal: null, recs: [] } }); assert.deepStrictEqual(m.cleanBank([], ['a']), { a: { goal: null, recs: [] } });
    assert.ok(m.nonNeg([{ a: 5 }, { a: -5 }]) && !m.nonNeg([{ a: -1 }]));
    ok('l8: 存錢筒');
}
