// utils：清理 / 上限 / 刪除級聯 / 壞資料驗證（批次 f3）
const assert = require('assert');
const { load, ok } = require('./_load');

// 記帳本
{
    const m = load('utils/expense-tracker.html', 'validEntry, pruneBefore, MAX_ENTRIES');
    const E = (id, d) => ({ id, d, type: 'out', cat: '餐飲', amt: 10, note: '' });
    assert.deepEqual(m.pruneBefore([E('a', '2024-01-01'), E('b', '2025-06-01'), E('c', '2025-06-02')], '2025-06-01').map(e => e.id), ['b', 'c']);
    assert.equal(m.validEntry({ d: '2024-01-01', type: 'out', cat: 'x', amt: 1, note: '' }), false, '缺 id 的壞資料要擋掉');
    assert.equal(m.validEntry(E('a', '2024-01-01')), true);
    assert.equal(m.MAX_ENTRIES, 20000);
    ok('expense-tracker: pruneBefore / validEntry needs id');
}
// 油耗：刪除中間一筆後重算、沒加滿併入下一次
{
    const m = load('utils/fuel-log.html', 'segments, overall');
    const F = (id, odo, l, full) => ({ id, d: '2024-01-01', odo, l, p: 30, full });
    const all = [F('a', 1000, 40, true), F('b', 1400, 30, false), F('c', 1800, 30, true), F('d', 2200, 40, true)];
    let s = m.segments(all);
    assert.equal(s.length, 2); assert.equal(s[0].km, 800); assert.equal(s[0].liters, 60); assert.equal(s[1].km, 400); assert.equal(s[1].liters, 40);
    // 刪掉沒加滿的 b：第一段油量少 30 L
    s = m.segments(all.filter(e => e.id !== 'b')); assert.equal(s[0].liters, 30); assert.equal(s[0].km, 800);
    // 刪掉中間加滿的 c：b 的油量併入 d
    s = m.segments(all.filter(e => e.id !== 'c')); assert.equal(s.length, 1); assert.equal(s[0].km, 1200); assert.equal(s[0].liters, 30 + 40);
    assert.equal(m.segments(all.filter(e => e.id === 'a' || e.id === 'b')).length, 0);
    ok('fuel-log: segments recalc after delete');
}
// 倒數日
{
    const m = load('utils/countdown.html', 'validEvent, MAX_EVENTS');
    assert.equal(m.validEvent({ name: 'a', date: '2025-01-01' }), true);
    assert.equal(!!m.validEvent(null), false); assert.equal(m.validEvent({ name: 5, date: '2025-01-01' }), false); assert.equal(m.validEvent({ name: 'a', date: 'x' }), false);
    assert.equal(m.MAX_EVENTS, 200);
    ok('countdown: validEvent');
}
// 色票庫
{
    const m = load('utils/color-tools.html', 'addSwatch, MAX_SW');
    let l = m.addSwatch([], 'a', '#000000'); assert.equal(l.length, 1);
    assert.equal(m.addSwatch(l, 'a', '#000000'), l, '重複回傳原陣列');
    const full = Array.from({ length: m.MAX_SW }, (_, i) => ({ name: 'n' + i, hex: '#000000' }));
    assert.equal(m.addSwatch(full, 'new', '#ffffff'), null, '滿了不收、不偷刪最舊');
    ok('color-tools: addSwatch cap');
}
// 輪值 / 家事
{
    const m = load('utils/duty-roster.html', 'dropRows, normChoreData, MAX_CHORES');
    const R = (cid, member, done) => ({ cid, name: cid, score: 2, i: 0, n: 1, freq: 'week', member, done });
    const d = { chores: [], members: '', period: 'week', log: [{ member: 'x', score: 1, date: '2025-01-01', name: '' }], table: { period: 'week', rows: [R('c1', 'A', '2025-02-01'), R('c1', 'B', ''), R('c2', 'A', '')] } };
    let r = m.dropRows(d, x => x.cid === 'c1');
    assert.deepEqual(r.table.rows.map(x => x.cid), ['c2']); assert.equal(r.log.length, 2, '已完成的併入紀錄'); assert.equal(r.log[1].member, 'A');
    assert.equal(d.table.rows.length, 3, '不改動輸入');
    r = m.dropRows(d, x => x.member === 'A'); assert.deepEqual(r.table.rows.map(x => x.member), ['B']);
    assert.equal(m.dropRows(d, () => true).table, null);
    assert.equal(m.dropRows({ ...d, table: null }, () => true).table, null);
    const many = { chores: Array.from({ length: 100 }, (_, i) => ({ id: 'c' + i, name: 'n' + i, freq: 'week', score: 1 })) };
    assert.equal(m.normChoreData(many).chores.length, m.MAX_CHORES);
    const big = m.normChoreData({ log: Array.from({ length: 1500 }, () => ({ member: 'a', score: 1, date: '2025-01-01' })) });
    assert.equal(big.log.length, 1000);
    ok('duty-roster: dropRows cascade / caps');
}
// 比價
{
    const m = load('utils/price-compare.html', 'normRows, normTax, MAX_ROWS, MAX_LAYERS');
    const rows = m.normRows([null, { unit: 'zz' }, { unit: 'g', price: 12, name: 5 }, { unit: 'kg' }]);
    assert.equal(rows.length, 2); assert.equal(rows[0].price, '12'); assert.equal(rows[0].name, '5'); assert.equal(rows[1].count, '1');
    assert.deepEqual(m.normRows('bad'), []);
    assert.equal(m.normRows(Array.from({ length: 80 }, () => ({ unit: 'g' }))).length, m.MAX_ROWS);
    assert.equal(m.normTax({ layers: Array.from({ length: 50 }, () => ({ kind: 'zhe' })) }).layers.length, m.MAX_LAYERS);
    ok('price-compare: normRows / layer cap');
}
// 分帳
{
    const m = load('utils/split-bill.html', 'normBill, settle, MAX_PEOPLE');
    assert.deepEqual(m.normBill(null), { people: [], expenses: [] });
    assert.deepEqual(m.normBill({ people: 5, expenses: 'x' }), { people: [], expenses: [] });
    const r = m.normBill({ people: ['A', 'B', 'A', '', 3], expenses: [
        { payer: 'A', amount: 100, shares: ['A', 'B'], desc: 'ok' }, { payer: 'Z', amount: 100, shares: ['A'] }, { payer: 'A', amount: 100, shares: ['A', 'Q'] },
        { payer: 'A', amount: 100, shares: [] }, { payer: 'A', amount: -5, shares: ['A'] }, null] });
    assert.deepEqual(r.people, ['A', 'B']); assert.equal(r.expenses.length, 1);
    assert.deepEqual(m.settle(r.people, r.expenses).transfers, [{ from: 'B', to: 'A', amount: 50 }]);
    ok('split-bill: normBill drops dangling refs');
}
// 歷史
{
    const m = load('utils/qr-scan.html', 'addHistory, cleanHistory');
    assert.deepEqual(m.addHistory([], { t: 1, text: 'x'.repeat(4001), format: 'qr_code' }), []);
    assert.equal(m.addHistory([], { t: 1, text: 'ok' }).length, 1);
    ok('qr-scan: addHistory skips oversized');
}
{
    const m = load('utils/voice-memo.html', 'addMemo, cleanMemos, MEMO_MAX');
    let l = []; for (let i = 0; i < m.MEMO_MAX + 5; i++) l = m.addMemo(l, 'm' + i, i);
    assert.equal(l.length, m.MEMO_MAX); assert.equal(l[0].text, 'm' + (m.MEMO_MAX + 4));
    assert.deepEqual(m.cleanMemos({}), []);
    ok('voice-memo: cap');
}
