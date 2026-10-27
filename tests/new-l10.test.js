// 批次 l10：學科速查資料完整性、搜尋、速算技巧驗算
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('utils/study-ref.html', 'TOPICS, CATS, searchTopics, checkData, parseRow');
assert.deepEqual(m.checkData(m.TOPICS, m.CATS), []);
for (const c of m.CATS) assert.ok(m.TOPICS.some(t => t.cat === c), '分類無內容：' + c);
assert.ok(m.checkData([{ id: 'a', cat: '理化', title: 'x', rows: ['y'] }, { id: 'a', cat: 'zz', title: '', rows: [] }], m.CATS).length >= 4);
assert.equal(m.searchTopics(m.TOPICS, '').length, m.TOPICS.length);
assert.equal(m.searchTopics(m.TOPICS, '', '生物').length, m.TOPICS.filter(t => t.cat === '生物').length);
assert.equal(m.searchTopics(m.TOPICS, 'zzzqqq').length, 0);
assert.ok(m.searchTopics(m.TOPICS, '畢氏').some(x => x.t.id === 'jh-tri'));
assert.ok(m.searchTopics(m.TOPICS, 'pH').some(x => x.t.id === 'ph-acid'));
const gr = m.searchTopics(m.TOPICS, '花崗岩'); assert.ok(gr.length >= 1 && gr[0].t.cat === '岩石礦物');
assert.ok(m.searchTopics(m.TOPICS, '社死').some(x => x.t.id === 'net-tw' && x.rows.some(r => r.text === '社死')));
// 莫氏硬度 1..10 依序
const mohs = m.TOPICS.find(t => t.id === 'rk-mohs').rows.map(s => parseInt(m.parseRow(s).text, 10));
assert.deepEqual(mohs, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// 速算：所有「算式 = 答案」列用程式驗算
const norm = (s) => s.replace(/²/g, '**2').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
let checked = 0;
for (const t of m.TOPICS.filter(t => t.cat === '速算技巧'))
    for (const s of t.rows) {
        const x = m.parseRow(s).text, eq = x.split(' = ');
        if (eq.length !== 2 || !/^[\d\s*+\-/()²×÷−]+$/.test(eq[0]) || !/^\d+$/.test(eq[1])) continue;
        assert.equal(Function('return ' + norm(eq[0]))(), Number(eq[1]), '算式錯：' + x); checked++;
    }
assert.ok(checked >= 20, 'checked ' + checked);
// 乘 11：兩位數全部驗證
for (let n = 10; n <= 99; n++) {
    const a = Math.floor(n / 10), b = n % 10, s = a + b;
    assert.equal(s >= 10 ? (a + 1) * 100 + (s - 10) * 10 + b : a * 100 + s * 10 + b, n * 11, '乘 11：' + n);
}
// 尾數 5 的平方：5..95 + 105
for (let a = 0; a <= 10; a++) assert.equal(a * (a + 1) * 100 + 25, (10 * a + 5) ** 2);
// 十位相同、個位和為 10
for (let a = 1; a <= 9; a++) for (let x = 1; x <= 9; x++) assert.equal(a * (a + 1) * 100 + x * (10 - x), (10 * a + x) * (10 * a + 10 - x));
// 乘 5 / 25 / 9 / 99 / 差平方
for (let n = 10; n <= 99; n++) { assert.equal(n * 10 / 2, n * 5); assert.equal(n * 100 / 4, n * 25); assert.equal(n * 10 - n, n * 9); assert.equal(n * 100 - n, n * 99); }
for (let a = 1; a < 60; a++) for (let b = 1; b < a; b++) assert.equal((a + b) * (a - b), a * a - b * b);
// 棄九法：數字和 mod 9 與數值 mod 9 相同
const dsum = (n) => String(n).split('').reduce((p, c) => p + Number(c), 0);
for (let n = 1; n < 3000; n++) assert.equal(dsum(n) % 9, n % 9);
// 9 的乘法規律
for (let n = 1; n <= 9; n++) assert.equal(9 * n, (n - 1) * 10 + (10 - n));
ok('study-ref: data integrity, search, mental-math checks');
