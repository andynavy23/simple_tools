// 編輯功能純邏輯：health-log updateItem / errField、fuel-log updateEntry、expense-tracker updateEntry
const assert = require('assert');
const { load, ok } = require('./_load');

{
    const H = load('utils/health-log.html', 'addItem, updateItem, errField, HL');
    const r = { date: '2025-01-01', time: '08:00', sys: '120', dia: '80', hr: '', note: '' };
    let list = H.addItem([], 'bp', r).list;
    const id = list[0].id;
    const u = H.updateItem(list, id, { ...r, sys: '135' });
    assert.equal(u.err, ''); assert.equal(u.list.length, 1); assert.equal(u.list[0].id, id); assert.equal(u.list[0].sys, 135); assert.equal(u.list[0].time, '08:00'); assert.equal(u.list[0].k, 'bp');
    assert.ok(H.updateItem(list, id, { ...r, sys: '60' }).err, '收縮壓 <= 舒張壓要擋');
    assert.ok(H.updateItem(list, 'nope', r).err);
    assert.equal(H.errField('收縮壓請填 50–300'), 'f_sys'); assert.equal(H.errField('舒張壓請填 30–200'), 'f_dia'); assert.equal(H.errField('請選有效的日期'), 'f_date');
    ok('health-log updateItem');
}
{
    const F = load('utils/fuel-log.html', 'updateEntry, segments, overall');
    const E = (id, odo) => ({ id, d: '2025-01-01', odo, l: 30, p: 30, full: true });
    const list = [E('a', 11000), E('b', 12000), E('c', 13000)];
    const n = F.updateEntry(list, 'b', { ...E('x', 12100), l: 25 });
    assert.equal(n.length, 3); assert.equal(n[1].id, 'b'); assert.equal(n[1].odo, 12100);
    const s = F.segments(n); assert.equal(s[0].km, 1100); assert.equal(s[1].km, 900);
    assert.equal(F.updateEntry(list, 'b', E('x', 13000)), null, '里程重複');
    assert.equal(F.updateEntry(list, 'b', { ...E('x', 12000), l: 0 }), null, '公升需 > 0');
    assert.equal(F.updateEntry(list, 'zz', E('x', 5)), null);
    ok('fuel-log updateEntry');
}
{
    const X = load('utils/expense-tracker.html', 'updateEntry');
    const list = [{ id: 'a', d: '2025-02-10', type: 'out', cat: '餐飲', amt: 960, note: '', fx: 30, cur: 'USD', rate: 32, rid: 'r1' }, { id: 'b', d: '2025-02-11', type: 'out', cat: '交通', amt: 5, note: '' }];
    const n = X.updateEntry(list, 'a', { d: '2025-03-01', type: 'out', cat: '購物', amt: 960, note: '', fx: 30, cur: 'USD', rate: 32 });
    assert.equal(n.length, 2); assert.equal(n[0].cat, '購物'); assert.equal(n[0].rate, 32); assert.equal(n[0].rid, 'r1', '保留固定支出 rid'); assert.equal(n[1].cat, '交通');
    assert.equal(X.updateEntry(list, 'a', { d: 'x', type: 'out', cat: 'a', amt: 1, note: '' }), null);
    assert.equal(X.updateEntry(list, 'zz', { d: '2025-01-01', type: 'out', cat: 'a', amt: 1, note: '' }), null);
    ok('expense-tracker updateEntry');
}
