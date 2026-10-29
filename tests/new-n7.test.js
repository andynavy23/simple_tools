// n7 批次：home-keeper 純邏輯 + duty-roster 公平度
const { load, ok } = require('./_load');
const assert = require('assert');
const H = load('utils/home-keeper.html', 'HK, TPLS, normLists, createList, copyList, addListItem, removeListItem, listScore, compareLists, normExpiry, addExpiry, expStatus, needShort, sortExpiry, normChores, toggleChore, addChore, normMeters, putMeter, meterUsage, normTrash, trashSoon, weekdayOf');

// 檢查表
{
    assert.ok(H.TPLS.length >= 9 && H.TPLS.every(t => t.items.length && t.items.every(x => x.length <= H.HK.ITEM)));
    let r = H.createList([], 'house', '', 'a'); assert.strictEqual(r.lists[0].name, '看屋檢查'); assert.strictEqual(r.lists[0].items.length, 10);
    assert.ok(H.createList([], '__blank', '').err); assert.deepStrictEqual(H.createList([], '__blank', '空').lists[0].items, []);
    const full = Array.from({ length: 40 }, (_, i) => ({ id: 'x' + i, name: 'n' + i, tpl: '', items: [] }));
    assert.ok(H.createList(full, 'car', '').err); assert.ok(H.copyList(full, 'x1').err);
    let L = H.createList([], 'car', 'A車', 'a').lists; L = H.createList(L, 'car', 'B車', 'b').lists;
    const ids = L[0].items.map(i => i.id);
    L = L.map(l => l.id === 'a' ? { ...l, items: l.items.map((i, k) => k < 4 ? { ...i, c: true, n: '備註' } : i) } : l);
    assert.strictEqual(H.listScore(L[0]).pct, Math.round(4 * 100 / 11));
    assert.strictEqual(H.compareLists(L, 'car')[0].id, 'a'); assert.deepStrictEqual(H.compareLists(L, 'lease-in'), []);
    r = H.copyList(L, 'a', 'c'); const c = r.lists[2]; assert.strictEqual(c.name, 'A車（複製）'); assert.ok(c.items.every(i => !i.c && !i.n) && c.items.length === 11);
    assert.ok(!c.items.some(i => ids.includes(i.id)));
    assert.ok(H.addListItem(L, 'a', '').err && H.addListItem(L, 'a', 'x'.repeat(81)).err && H.addListItem(L, 'zz', 'x').err);
    assert.strictEqual(H.addListItem(L, 'a', '新項目', 'n1').lists[0].items.at(-1).id, 'n1');
    const big = [{ id: 'a', name: 'a', tpl: '', items: Array.from({ length: 200 }, (_, i) => ({ id: 'i' + i, t: 't' })) }];
    assert.ok(H.addListItem(big, 'a', 'x').err);
    assert.strictEqual(H.removeListItem(L, 'a', ids[0])[0].items.length, 10);
    // 載入驗證
    assert.deepStrictEqual(H.normLists(null), []); assert.deepStrictEqual(H.normLists('x'), []);
    const n = H.normLists([null, 5, { name: '' }, { id: 'd', name: 'ok', tpl: 'bad', items: [null, { t: '  ', c: true }, { t: 'a'.repeat(200), c: 1, n: 'n'.repeat(500) }] }, { id: 'd', name: 'dup' }]);
    assert.strictEqual(n.length, 1); assert.strictEqual(n[0].tpl, ''); assert.strictEqual(n[0].items.length, 1);
    assert.strictEqual(n[0].items[0].t.length, 80); assert.strictEqual(n[0].items[0].c, false); assert.strictEqual(n[0].items[0].n.length, 200);
    assert.strictEqual(H.normLists(Array.from({ length: 60 }, (_, i) => ({ id: 'q' + i, name: 'n' }))).length, 40);
}
// 效期
{
    const it = (date, warn = 30, need = 0, cat = '證件') => H.normExpiry([{ id: 'a', name: 'x', cat, date, warn, need }])[0];
    assert.strictEqual(H.expStatus(it('2026-10-27'), '2026-10-28').key, 'expired');
    assert.strictEqual(H.expStatus(it('2026-10-28'), '2026-10-28').key, 'soon'); assert.strictEqual(H.expStatus(it('2026-10-28'), '2026-10-28').left, 0);
    assert.strictEqual(H.expStatus(it('2026-11-27'), '2026-10-28').key, 'soon'); assert.strictEqual(H.expStatus(it('2026-11-28'), '2026-10-28').key, 'ok');
    assert.strictEqual(H.expStatus(it('2026-11-05', 3), '2026-10-28').key, 'ok');
    // 證件效期不足：6 個月
    assert.ok(H.needShort(it('2027-03-01', 30, 6), '2026-10-28')); assert.ok(!H.needShort(it('2027-04-28', 30, 6), '2026-10-28')); assert.ok(!H.needShort(it('2027-03-01', 30, 0), '2026-10-28'));
    assert.ok(H.needShort(it('2027-04-27', 30, 6), '2026-10-28'));
    assert.strictEqual(it('2030-01-01', 30, 6, '藥箱').need, 0);               // 非證件不檢查
    assert.ok(!H.needShort(it('2027-02-28', 30, 4), '2026-10-31'));             // 10/31 + 4 月 = 2/28（月底進位），剛好夠
    assert.strictEqual(H.sortExpiry([it('2027-01-01'), it('2026-01-01')]).map(x => x.date)[0], '2026-01-01');
    // 載入
    assert.deepStrictEqual(H.normExpiry(null), []);
    const n = H.normExpiry([null, { name: 'a', date: '2026-02-30' }, { name: 'b', date: '2026-02-28', cat: '怪', warn: 9999, need: 'x' }, { name: '', date: '2026-01-01' }]);
    assert.strictEqual(n.length, 1); assert.strictEqual(n[0].cat, '其他'); assert.strictEqual(n[0].warn, 30);
    assert.strictEqual(H.normExpiry(Array.from({ length: 600 }, (_, i) => ({ id: 'e' + i, name: 'n', date: '2026-01-01' }))).length, 500);
    // 新增
    const f = { name: '護照', cat: '證件', date: '2027-03-01', warn: '60', need: '6' };
    const r = H.addExpiry([], f, 'p'); assert.strictEqual(r.list[0].need, 6); assert.strictEqual(r.list[0].warn, 60);
    for (const bad of [{ ...f, name: ' ' }, { ...f, name: 'x'.repeat(41) }, { ...f, date: '' }, { ...f, date: '2026-02-30' }, { ...f, warn: '-1' }, { ...f, warn: '1.5' }, { ...f, need: '61' }]) assert.ok(H.addExpiry([], bad).err);
    assert.ok(H.addExpiry(Array.from({ length: 500 }, (_, i) => ({ id: 'e' + i })), f).err);
}
// 家事
{
    const d = H.normChores(null); assert.strictEqual(d.length, 12); assert.ok(d.every(m => m.length >= 2 && m.every(c => c.y === 0)));
    assert.strictEqual(H.normChores([[{ t: 'a', y: 2026 }], 'bad', null])[1].length, d[1].length);
    assert.strictEqual(H.normChores([[{ id: 'a', t: 'a', y: 2026 }]])[0].length, 1);
    assert.strictEqual(H.normChores([Array.from({ length: 50 }, (_, i) => ({ id: 'i' + i, t: 'a' }))])[0].length, 30);
    const ch = H.toggleChore(d, 0, d[0][0].id, 2026); assert.strictEqual(ch[0][0].y, 2026); assert.strictEqual(ch[1][0].y, 0);
    assert.strictEqual(H.toggleChore(ch, 0, d[0][0].id, 2026)[0][0].y, 0);
    assert.ok(H.addChore(d, 0, '').err && H.addChore(d, 0, 'x'.repeat(41)).err);
    const full = H.normChores([Array.from({ length: 30 }, (_, i) => ({ id: 'i' + i, t: 'a' }))]); assert.ok(H.addChore(full, 0, 'x').err);
    assert.strictEqual(H.addChore(d, 2, '新', 'z').ch[2].at(-1).id, 'z');
}
// 抄表
{
    const M = (a) => H.normMeters(a), ym = (i) => `${1990 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`;
    assert.deepStrictEqual(M(null), { th: 30, rows: [] }); assert.strictEqual(M([{ ym: '2026-01', k: 'e', v: 5 }]).rows.length, 1);
    assert.strictEqual(M({ th: 9999, rows: [] }).th, 30); assert.strictEqual(M({ th: 50, rows: [] }).th, 50);
    assert.strictEqual(M([{ ym: '2026-13', k: 'e', v: 1 }, { ym: '2026-01', k: 'x', v: 1 }, { ym: '2026-01', k: 'e', v: -1 }, { ym: '2026-01', k: 'e', v: 'a' }]).rows.length, 0);
    assert.strictEqual(M([{ ym: '2026-01', k: 'e', v: 1 }, { ym: '2026-01', k: 'e', v: 2 }]).rows.length, 1);
    assert.strictEqual(M(Array.from({ length: 300 }, (_, i) => ({ ym: ym(i), k: 'e', v: i }))).rows.length, 240);
    let r = H.putMeter([], { ym: '2026-01', k: 'e', v: '100' }, 'a'); r = H.putMeter(r.rows, { ym: '2026-01', k: 'e', v: '120' }); assert.strictEqual(r.rows.length, 1); assert.strictEqual(r.rows[0].v, 120);
    assert.ok(H.putMeter([], { ym: '', k: 'e', v: '1' }).err && H.putMeter([], { ym: '2026-01', k: 'x', v: '1' }).err && H.putMeter([], { ym: '2026-01', k: 'e', v: '' }).err && H.putMeter([], { ym: '2026-01', k: 'e', v: '-1' }).err);
    const full = M(Array.from({ length: 240 }, (_, i) => ({ ym: ym(i), k: 'e', v: i }))).rows;
    assert.ok(H.putMeter(full, { ym: '2026-01', k: 'w', v: '1' }).err); assert.ok(!H.putMeter(full, { ym: '1990-01', k: 'e', v: '5' }).err);   // 滿了仍可覆蓋
    // 用量與異常：1200、1300、1390、1480 → 100、90、90；再 1700 → 220，平均 93.33 → +136%
    const rows = [['2026-09', 1200], ['2026-10', 1300], ['2026-11', 1390], ['2026-12', 1480], ['2027-01', 1700]].map(([m, v], i) => ({ id: 'r' + i, ym: m, k: 'e', v }));
    let u = H.meterUsage(rows.slice().reverse(), 'e', 30);
    assert.deepStrictEqual(u.map(x => x.use), [null, 100, 90, 90, 220]);
    assert.deepStrictEqual(u.map(x => x.flag), [false, false, false, false, true]);
    assert.strictEqual(u[4].over, 136); assert.strictEqual(u[2].avg, null); assert.strictEqual(u[3].avg, 95);
    assert.ok(!H.meterUsage(rows, 'e', 200)[4].flag);
    assert.deepStrictEqual(H.meterUsage(rows, 'w', 30), []);
    // 倒退（換表）不算入平均
    u = H.meterUsage([['2026-01', 100], ['2026-02', 200], ['2026-03', 300], ['2026-04', 5], ['2026-05', 105]].map(([m, v]) => ({ id: m, ym: m, k: 'g', v })), 'g', 30);
    assert.ok(u[3].back && !u[3].flag); assert.strictEqual(u[4].avg, 100); assert.ok(!u[4].flag);
    // 平均為 0 不誤報
    u = H.meterUsage([['2026-01', 5], ['2026-02', 5], ['2026-03', 5], ['2026-04', 9]].map(([m, v]) => ({ id: m, ym: m, k: 'w', v })), 'w', 30); assert.ok(!u[3].flag);
}
// 垃圾
{
    const t = H.normTrash(null); assert.strictEqual(t.length, 7); assert.ok(t.every(x => !x.g && !x.r && x.t === ''));
    assert.strictEqual(H.weekdayOf('2026-10-28'), 3);            // 週三
    assert.strictEqual(H.weekdayOf('2026-11-01'), 0);
    const tt = H.normTrash([{}, { g: true, t: '19:30' }, { r: 1 }, 'x']);
    assert.ok(tt[1].g && tt[1].t === '19:30' && !tt[2].r);
    const [a, b] = H.trashSoon(tt, '2026-10-26');                // 週一、週二
    assert.ok(a.g && a.wd === 1 && !b.g && b.wd === 2);
    assert.strictEqual(H.trashSoon(tt, '2026-10-31')[1].wd, 0);  // 週六 → 週日（跨週）
    assert.strictEqual(H.normTrash([{ t: 'x'.repeat(50) }])[0].t.length, 20);
}
ok('home-keeper: pure');

// duty-roster 公平度
{
    const D = load('utils/duty-roster.html', 'fairness');
    let f = D.fairness({ 甲: { n: 3, score: 6 }, 乙: { n: 1, score: 2 } }, ['甲', '乙', '丙']);   // 平均 8/3
    assert.deepStrictEqual(f.map(r => r.dev), [125, -25, -100]);
    assert.deepStrictEqual(D.fairness({}, ['a', 'b']).map(r => r.dev), [0, 0]);
    assert.deepStrictEqual(D.fairness({}, []), []);
    f = D.fairness({ x: { n: 1, score: 3 }, y: { n: 1, score: 3 } }, []); assert.deepStrictEqual(f.map(r => r.dev), [0, 0]);
    ok('duty-roster: fairness');
}
