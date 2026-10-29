// 批次 n1：飲食與食材速查（資料完整性、搜尋、酒精計算）
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('utils/food-ref.html', 'TOPICS, CATS, searchTopics, checkData, parseRow, alcoholCalc');
assert.deepEqual(m.checkData(m.TOPICS, m.CATS), []);
for (const c of m.CATS) assert.ok(m.TOPICS.some(t => t.cat === c), '分類無內容：' + c);
assert.ok(m.TOPICS.length >= 25);
// 資料檢查會抓到：重複 id、缺標題 / 關鍵字、空列、缺說明、格式不符
const base = { id: 'a', cat: '營養健康', title: 'x', kw: 'k', rows: ['y ~~ z'] };
assert.deepEqual(m.checkData([base], m.CATS), []);
assert.ok(m.checkData([base, base], m.CATS).length >= 1);
assert.equal(m.checkData([{ ...base, title: '' }], m.CATS).length, 1);
assert.equal(m.checkData([{ ...base, kw: '' }], m.CATS).length, 1);
assert.equal(m.checkData([{ ...base, rows: [' ~~ z'] }], m.CATS).length, 1);
assert.equal(m.checkData([{ ...base, rows: ['y'] }], m.CATS).length, 1);
assert.equal(m.checkData([{ ...base, must: /約/ }], m.CATS).length, 1);
assert.equal(m.checkData([{ ...base, rows: [] }], m.CATS).length, 1);
// 搜尋
assert.equal(m.searchTopics(m.TOPICS, '').length, m.TOPICS.length);
assert.equal(m.searchTopics(m.TOPICS, '', '飲品酒類').length, m.TOPICS.filter(t => t.cat === '飲品酒類').length);
assert.equal(m.searchTopics(m.TOPICS, 'zzzqqq').length, 0);
assert.ok(m.searchTopics(m.TOPICS, '發煙點').some(x => x.t.id === 'oil'));
assert.ok(m.searchTopics(m.TOPICS, '花生 交叉').some(x => x.t.id === 'allergen-x'));
assert.ok(m.searchTopics(m.TOPICS, '尼格羅尼').some(x => x.t.id === 'cock-short'));
// 必備主題
for (const id of ['dri-energy', 'gi-grain', 'alcohol', 'caffeine', 'allergen', 'vit', 'min', 'label-nutri', 'oil', 'rice', 'safe-temp', 'safe-steak', 'safe-fish', 'safe-store', 'safe-leftover', 'season-fruit', 'substitute', 'snack-kcal', 'pairing', 'sauce', 'tea', 'cock-short', 'cock-long'])
    assert.ok(m.TOPICS.some(t => t.id === id), id);
// 調酒至少 25 款
assert.ok(m.TOPICS.filter(t => t.id.startsWith('cock-')).reduce((n, t) => n + t.rows.length, 0) >= 25);
// 酒精計算：啤酒 250 mL 5% ≈ 1 標準杯；威士忌 30 mL 40% ≈ 1 杯
const a = m.alcoholCalc(250, 5);
assert.ok(Math.abs(a.drinks - 0.986) < 0.01 && Math.abs(a.kcal - 69) < 1);
assert.ok(Math.abs(m.alcoholCalc(30, 40).drinks - 0.947) < 0.01);
assert.equal(m.alcoholCalc('', 5), null);
assert.equal(m.alcoholCalc(100, 0), null);
assert.equal(m.alcoholCalc(100, 101), null);
assert.equal(m.alcoholCalc(-5, 5), null);
ok('food-ref: data integrity, search, alcohol calc');
