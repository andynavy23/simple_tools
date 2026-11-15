// 批次 v1：fun/collections.html 純邏輯
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('fun/collections.html', 'ST, MAX, CLEAN, cleanList, parseImport, nextAir, plusEp, seriesPct, updatesOf, addHours, isBelow, lowest, setPrice, sparkPoints, filterItems, sortItems, statLines, cleanUrl, parseEps');

// 壞資料
assert.deepStrictEqual(m.cleanList('movie', null), []);
assert.deepStrictEqual(m.cleanList('movie', [null, 5, [], { title: '' }, { title: '  ' }]), []);
const mv = m.cleanList('movie', [{ id: 'a', title: 'X', rating: 4.3, status: 'zzz', date: '2020-13-40', tags: 'a, b，a' }, { id: 'a', title: 'Y', rating: 9 }]);
assert.strictEqual(mv[0].rating, 4.5); assert.strictEqual(mv[0].status, 'want'); assert.strictEqual(mv[0].date, '');
assert.deepStrictEqual(mv[0].tags, ['a', 'b']); assert.strictEqual(mv[1].rating, 5); assert.notStrictEqual(mv[0].id, mv[1].id);
assert.strictEqual(m.cleanList('game', Array.from({ length: 1200 }, (_, i) => ({ title: 't' + i }))).length, 1000);
assert.strictEqual(m.CLEAN.movie({ title: 'x'.repeat(500) }).title.length, 100);
// 網址
assert.strictEqual(m.cleanUrl('javascript:alert(1)'), ''); assert.strictEqual(m.cleanUrl('https://a.com/x'), 'https://a.com/x'); assert.strictEqual(m.cleanUrl('ftp://a'), '');
// 匯入嚴格
const bad = (k, t) => assert.ok(m.parseImport(k, t).err, String(t));
bad('movie', ''); bad('movie', '{'); bad('movie', '{}'); bad('movie', '[1]'); bad('movie', '[{"title":""}]'); bad('movie', '[{"title":"a","status":"x"}]');
bad('movie', '[{"title":"a","rating":6}]'); bad('movie', '[{"title":"a","rating":"3"}]'); bad('movie', '[{"title":"a","date":"2020-02-31"}]');
bad('wish', '[{"title":"a","url":"javascript:1"}]'); bad('wish', '[{"title":"a","price":-1}]');
assert.ok(m.parseImport('movie', '[{"title":"a"}]'.replace('[', '[' + '{"title":"z"},'.repeat(1000))).err);
const good = m.parseImport('game', '[{"title":"a","status":"playing","hours":1.5,"rating":4.5}]');
assert.strictEqual(good.err, ''); assert.strictEqual(good.items[0].hours, 1.5);
// 影集進度
const s = m.CLEAN.series({ title: 'S', eps: '10,12', season: 1, ep: 9, status: 'want' });
assert.strictEqual(s.seasons, 2); assert.deepStrictEqual(m.parseEps('3, x, 0, 1000, 5'), [3, 5]);
let p = m.plusEp(s, '2026-01-01'); assert.strictEqual(p.ep, 10); assert.strictEqual(p.status, 'watching');
p = m.plusEp(p, '2026-01-01'); assert.deepStrictEqual([p.season, p.ep], [2, 1]);
assert.strictEqual(m.seriesPct(p), Math.round(11 / 22 * 100));
p = { ...p, ep: 12 }; p = m.plusEp(p, '2026-01-01'); assert.strictEqual(p.status, 'done'); assert.strictEqual(p.ep, 12); assert.strictEqual(m.seriesPct(p), 100);
assert.strictEqual(m.seriesPct(m.CLEAN.series({ title: 'n' })), null);
assert.strictEqual(m.plusEp(m.CLEAN.series({ title: 'n' }), '2026-01-01').ep, 1);
// 下一集 / 今日本週（2026-01-01 週四）
assert.strictEqual(m.nextAir({ nextDate: '', airDay: 4 }, '2026-01-01'), '2026-01-01');
assert.strictEqual(m.nextAir({ nextDate: '', airDay: 1 }, '2026-01-01'), '2026-01-05');
assert.strictEqual(m.nextAir({ nextDate: '2026-01-03', airDay: -1 }, '2026-01-01'), '2026-01-03');
assert.strictEqual(m.nextAir({ nextDate: '2025-12-01', airDay: -1 }, '2026-01-01'), '');
const w = m.cleanList('series', [{ title: 'A', status: 'watching', airDay: 4 }, { title: 'B', status: 'watching', nextDate: '2026-01-04' }, { title: 'C', status: 'watching', nextDate: '2026-01-20' }, { title: 'D', status: 'dropped', airDay: 4 }]);
const u = m.updatesOf(w, '2026-01-01'); assert.deepStrictEqual([u.today.map(e => e.s.title), u.week.map(e => e.s.title)], [['A'], ['B']]);
const aw = m.plusEp(m.CLEAN.series({ title: 'W', airDay: 4, nextDate: '2026-01-01', status: 'watching' }), '2026-01-01'); assert.strictEqual(aw.nextDate, '2026-01-08');
// 遊戲
assert.strictEqual(m.addHours({ hours: 1.5 }, '2.5').hours, 4); assert.strictEqual(m.addHours({ hours: 1 }, 'abc').hours, 1); assert.strictEqual(m.addHours({ hours: 99999 }, 5).hours, 99999);
const gs = m.cleanList('game', [{ title: 'a', status: 'want', hours: 2 }, { title: 'b', status: 'done', hours: 10 }, { title: 'c', status: 'dropped', hours: 1 }, { title: 'd', status: 'playing', hours: 3 }]);
const gl = Object.fromEntries(m.statLines('game', gs, '2026', '2026-01-01'));
assert.strictEqual(gl['總遊玩時數'], '16 小時'); assert.strictEqual(gl['Backlog 堆積（想玩）'], '1 款'); assert.ok(gl['通關率（通關 / 已開始）'].startsWith('33%'));
// 價格
let wi = m.CLEAN.wish({ title: 'w', target: 100 });
wi = m.setPrice(wi, 120, '2026-01-01'); wi = m.setPrice(wi, 120, '2026-01-02'); assert.strictEqual(wi.history.length, 1);
wi = m.setPrice(wi, 90, '2026-01-02'); assert.deepStrictEqual(wi.history, [{ d: '2026-01-01', p: 120 }, { d: '2026-01-02', p: 90 }]); // 同天覆蓋
wi = m.setPrice(wi, 95, '2026-01-03'); assert.strictEqual(m.lowest(wi), 90); assert.ok(m.isBelow(wi) && m.isBelow({ ...wi, price: 100 }) && !m.isBelow({ ...wi, price: 101 }));
assert.ok(!m.isBelow({ price: 5, target: 0 })); assert.strictEqual(m.setPrice(wi, 0, '2026-01-04').history.length, 3);
for (let i = 0; i < 40; i++) wi = m.setPrice(wi, 10 + i, '2026-02-' + String(i % 28 + 1).padStart(2, '0') + (i >= 28 ? '' : ''));
assert.ok(wi.history.length <= 30);
assert.strictEqual(m.cleanList('wish', [{ title: 'h', history: Array.from({ length: 50 }, (_, i) => ({ d: '2026-01-01', p: i + 1 })) }])[0].history.length, 30);
assert.strictEqual(m.sparkPoints([{ p: 5 }], 100, 30), ''); assert.strictEqual(m.sparkPoints([{ p: 1 }, { p: 3 }], 100, 30), '0.0,30.0 100.0,0.0');
const wl = Object.fromEntries(m.statLines('wish', m.cleanList('wish', [{ title: 'a', target: 100, price: 80 }, { title: 'b', target: 50 }, { title: 'c', status: 'bought', price: 30 }]), '2026', ''));
assert.strictEqual(wl['已低於目標價'], '1 項'); assert.ok(wl['總預算（想買，現價優先、無現價用目標價）'].endsWith('130')); assert.ok(wl['已購買'].includes('$30'));
// 篩選排序統計
const ml = m.cleanList('movie', [{ title: 'Beta', status: 'done', rating: 3, date: '2025-05-05', tags: ['科幻'] }, { title: 'Alpha', status: 'done', rating: 4.5, date: '2026-02-02' }, { title: 'Gamma' }]);
assert.deepStrictEqual(m.filterItems(ml, 'done', '').map(x => x.title), ['Beta', 'Alpha']); assert.strictEqual(m.filterItems(ml, 'all', '科幻').length, 1);
assert.deepStrictEqual(m.sortItems('movie', ml, 'rating', '').map(x => x.title)[0], 'Alpha'); assert.strictEqual(m.sortItems('movie', ml, 'date', '')[0].title, 'Alpha');
assert.strictEqual(m.sortItems('movie', ml, 'title', '')[0].title, 'Alpha'); assert.strictEqual(m.sortItems('movie', ml, 'added', '')[0].title, 'Gamma'); assert.strictEqual(m.sortItems('movie', ml, 'hours', '')[0].title, 'Gamma');
const ms = Object.fromEntries(m.statLines('movie', ml, '2026', ''));
assert.strictEqual(ms['2026 年看過'], '1 部，平均 4.5'); assert.strictEqual(ms['2025 年看過'], '1 部，平均 3'); assert.strictEqual(ms['累計看過'], '2 部'); assert.strictEqual(ms['平均評分'], '3.75');
ok('collections');
