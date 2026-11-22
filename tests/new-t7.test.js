// 批次 t7：家人生日（農曆換算）/ 節慶倒數 / 寵物體重趨勢 / 稍後閱讀
const { load, ok } = require('./_load');
const assert = require('assert');

// ---- date-calc：農曆生日 ----
{
    const m = load('utils/date-calc.html', 'lunarToSolar, nextLunarBirthday, cleanPeople, personInfo, sortPeople, soonTag, peopleText, peopleIcs, lunarMonthNum, realDate');
    assert.equal(m.lunarToSolar(2025, 1, 1, false), '2025-01-29', '2025 春節');
    assert.equal(m.lunarToSolar(2026, 1, 1, false), '2026-02-17', '2026 春節');
    assert.equal(m.lunarToSolar(2025, 8, 15, false), '2025-10-06', '2025 中秋');
    // 2025 有閏六月：閏六月 1 日 = 2025-07-25；沒有閏月的年改用平月
    assert.equal(m.lunarToSolar(2025, 6, 1, true), '2025-07-25');
    assert.equal(m.lunarToSolar(2026, 6, 1, true), m.lunarToSolar(2026, 6, 1, false), '無閏月改平月');
    // 30 日不足：2025 年二月只有 29 天，30 日取月底
    assert.equal(m.lunarToSolar(2025, 2, 30, false), m.lunarToSolar(2025, 2, 29, false));
    assert.notEqual(m.lunarToSolar(2025, 2, 29, false), m.lunarToSolar(2025, 2, 28, false));
    // Intl 對 2027 春節差一天（算 2/7，實為 2/6）：校正後 初一 2/6、正月最後一日 3/7（30 日）、2030 初一 2/3
    assert.equal(m.lunarToSolar(2027, 1, 1, false), '2027-02-06'); assert.equal(m.lunarToSolar(2027, 1, 30, false), '2027-03-07'); assert.equal(m.lunarToSolar(2027, 2, 1, false), '2027-03-08');
    assert.equal(m.lunarToSolar(2027, 12, 1, false) > '2027-12-01', true); assert.equal(m.lunarToSolar(2030, 1, 1, false), '2030-02-03'); assert.equal(m.lunarToSolar(2029, 12, 30, false), '2030-02-02');
    assert.equal(m.lunarToSolar(2027, 5, 5, false), '2027-06-09'); assert.equal(m.lunarToSolar(2027, 8, 15, false), '2027-09-15');
    ok('lunarToSolar');
    const nb = m.nextLunarBirthday(1, 1, false, '2025-02-01');
    assert.equal(nb.date, '2026-02-17'); assert.equal(nb.days, day(nb.date, '2025-02-01'));
    assert.equal(m.nextLunarBirthday(1, 1, false, '2025-01-29').days, 0, '今天就是');
    // 臘月 20 日：年底前
    assert.equal(m.nextLunarBirthday(12, 20, false, '2026-01-01').date.slice(0, 4), '2026');
    ok('nextLunarBirthday');
    const arr = [{ id: 'a', name: ' 媽 ', cal: 's', date: '1970-03-04' }, { name: 'x' }, null, { id: 'a', name: '爸', cal: 'l', ly: 1968, lm: 8, ld: 15 }, { id: 'c', name: '壞', cal: 'l', ly: 1968, lm: 13, ld: 1 }, { id: 'd', name: '壞2', cal: 's', date: '2020-02-30' }];
    const c = m.cleanPeople(arr);
    assert.equal(c.length, 2); assert.equal(c[0].name, '媽'); assert.notEqual(c[0].id, c[1].id);
    assert.deepEqual(m.cleanPeople('x'), []); assert.deepEqual(m.cleanPeople(null), []);
    assert.equal(m.cleanPeople(Array.from({ length: 300 }, (_, i) => ({ id: 'i' + i, name: 'n' + i, cal: 's', date: '2000-01-01' }))).length, 200);
    const sp = m.sortPeople([{ id: '1', name: 'A', cal: 's', date: '2000-12-31', note: '' }, { id: '2', name: 'B', cal: 's', date: '2000-11-20', note: '' }], '2026-11-16');
    assert.equal(sp[0].p.name, 'B'); assert.equal(sp[0].info.days, 4); assert.equal(sp[0].info.age, 25); assert.equal(sp[0].info.turning, 26);
    assert.equal(m.soonTag(0), '今天'); assert.equal(m.soonTag(7), '7 天內'); assert.equal(m.soonTag(8), '30 天內'); assert.equal(m.soonTag(31), '');
    const lp = m.personInfo({ id: 'l', name: 'L', cal: 'l', ly: 1990, lm: 1, ld: 1, leap: false }, '2026-11-16');
    assert.equal(lp.zodiac, '馬'); assert.equal(lp.birth, '1990-01-27'); assert.equal(lp.next, '2027-02-06'); assert.equal(lp.turning, 37);
    assert.ok(m.peopleText(c, '2026-11-16').includes('媽'));
    const ics = m.peopleIcs(c, '2026-11-16');
    assert.ok(ics.startsWith('BEGIN:VCALENDAR') && ics.includes('RRULE:FREQ=YEARLY') && (ics.match(/BEGIN:VEVENT/g) || []).length === 1 + 5);
    ok('people');
    function day(a, b) { return Math.round((Date.parse(a) - Date.parse(b)) / 864e5); }
}

// ---- countdown：節慶 ----
{
    const m = load('utils/countdown.html', 'festivalsOfYear, nextFestivals, addFestival, solarTermDay, nthWeekday');
    const f25 = Object.fromEntries(m.festivalsOfYear(2025).map(f => [f.name, f.date]));
    assert.equal(f25['農曆新年'], '2025-01-29'); assert.equal(f25['元宵節'], '2025-02-12');
    assert.equal(f25['端午節'], '2025-05-31'); assert.equal(f25['中秋節'], '2025-10-06'); assert.equal(f25['重陽節'], '2025-10-29');
    assert.equal(f25['清明'], '2025-04-04'); assert.equal(f25['冬至'], '2025-12-21');
    assert.equal(f25['母親節'], '2025-05-11'); assert.equal(f25['父親節（台灣 8/8）'], '2025-08-08');
    assert.equal(Object.fromEntries(m.festivalsOfYear(2026).map(f => [f.name, f.date]))['農曆新年'], '2026-02-17');
    assert.equal(m.nthWeekday(2026, 5, 0, 2), 10, '2026 母親節 5/10');
    assert.equal(f25['冬至'] && m.festivalsOfYear(2026).find(f => f.name === '冬至').date, '2026-12-22');
    const nf = m.nextFestivals('2026-11-16');
    assert.equal(nf[0].name, '冬至'); assert.equal(nf[0].days, 36);
    assert.ok(nf.some(f => f.name === '農曆新年' && f.date === '2027-02-06'));
    // Intl 在 2027 春節差一天，已校正：初一 2/6、元宵 2/20、端午 6/9、中秋 9/15；2030 初一 2/3
    const f27 = Object.fromEntries(m.festivalsOfYear(2027).map(f => [f.name, f.date]));
    assert.equal(f27['農曆新年'], '2027-02-06'); assert.equal(f27['元宵節'], '2027-02-20'); assert.equal(f27['端午節'], '2027-06-09'); assert.equal(f27['中秋節'], '2027-09-15');
    assert.equal(Object.fromEntries(m.festivalsOfYear(2030).map(f => [f.name, f.date]))['農曆新年'], '2030-02-03');
    assert.ok(nf.every((f, i) => i === 0 || nf[i - 1].days <= f.days) && new Set(nf.map(f => f.name)).size === nf.length);
    assert.ok(nf.find(f => f.name === '冬至').approx);
    const a = m.addFestival([], nf[0]); assert.ok(a.added && a.events.length === 1);
    assert.ok(!m.addFestival(a.events, nf[0]).added, '同名同日不重複');
    assert.ok(!m.addFestival(Array(200).fill({ name: 'x', date: '2000-01-01' }), nf[0]).added, '上限');
    ok('festivals');
}

// ---- pet-log：體重異常 ----
{
    const m = load('fun/pet-log.html', 'weightAlert');
    assert.equal(m.weightAlert([{ date: '2026-01-01', kg: 4 }]).alert, false);
    assert.equal(m.weightAlert(null).alert, false);
    const a = m.weightAlert([{ date: '2026-01-01', kg: 4 }, { date: '2026-01-25', kg: 4.5 }]);   // 24 天 +12.5%
    assert.ok(a.alert && a.pct7 === null && Math.abs(a.pct30 - 12.5) < 1e-9);
    const b = m.weightAlert([{ date: '2026-01-01', kg: 4 }, { date: '2026-01-05', kg: 4.1 }, { date: '2026-01-08', kg: 3.8 }]);  // 7 天內 4 → 3.8 = -5%
    assert.ok(b.alert && b.reasons.length >= 1 && b.pct7 <= -5 + 1e-9);
    assert.equal(m.weightAlert([{ date: '2026-01-01', kg: 4 }, { date: '2026-01-20', kg: 4.2 }]).alert, false, '5% 以內');
    assert.equal(m.weightAlert([{ date: '2025-01-01', kg: 4 }, { date: '2026-01-20', kg: 6 }]).alert, false, '窗外不算');
    ok('weightAlert');
}

// ---- reading-list：稍後閱讀 ----
{
    const m = load('fun/reading-list.html', 'laterUrl, parseTags, cleanLater, addLater, toggleLater, delLater, laterStats, filterLater');
    assert.equal(m.laterUrl('https://a.com/x?y=1'), 'https://a.com/x?y=1');
    for (const bad of ['javascript:alert(1)', 'ftp://a.com', 'data:text/html,x', 'a.com', '', null, 5]) assert.equal(m.laterUrl(bad), '', String(bad));
    assert.deepEqual(m.parseTags('a, b，c  a'), ['a', 'b', 'c']);
    const c = m.cleanLater([{ url: 'https://a.com', title: '', read: true, readDate: '2026-11-10' }, { url: 'javascript:1' }, null, { url: 'http://b.com', id: 'x', tags: ['t'] }], '2026-11-16');
    assert.equal(c.length, 2); assert.equal(c[0].title, 'a.com'); assert.equal(c[0].added, '2026-11-16'); assert.equal(c[1].read, false);
    assert.deepEqual(m.cleanLater('x', ''), []);
    let r = m.addLater([], { url: 'https://a.com', title: 'A', tags: 'x y', note: 'n' }, '2026-11-16');
    assert.ok(!r.err && r.list.length === 1 && r.list[0].tags.length === 2);
    assert.ok(m.addLater(r.list, { url: 'https://a.com' }, '2026-11-16').err, '重複');
    assert.ok(m.addLater(r.list, { url: 'ftp://a.com' }, '2026-11-16').err, '非 http');
    const full = Array.from({ length: 500 }, (_, i) => ({ id: 'i' + i, url: 'https://x.com/' + i, title: 't', note: '', tags: [], added: '2026-01-01', read: false, readDate: '' }));
    assert.ok(m.addLater(full, { url: 'https://new.com' }, '2026-11-16').err, '上限');
    assert.equal(m.cleanLater(Array.from({ length: 600 }, (_, i) => ({ url: 'https://x.com/' + i })), '2026-01-01').length, 500);
    let l = m.toggleLater(r.list, r.list[0].id, '2026-11-16'); assert.ok(l[0].read && l[0].readDate === '2026-11-16');
    l = [...l, ...m.cleanLater([{ url: 'https://old.com', read: true, readDate: '2026-09-01' }], '2026-11-16')];
    const st = m.laterStats(l, '2026-11-20'); assert.deepEqual(st, { unread: 0, read: 2, read30: 1 });
    assert.equal(m.filterLater(l, 'unread', '').length, 0); assert.equal(m.filterLater(l, 'read', 'old').length, 1);
    assert.equal(m.delLater(l, l[0].id).length, 1);
    ok('later');
}
