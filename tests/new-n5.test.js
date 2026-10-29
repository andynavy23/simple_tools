// 批次 n5：生活百科速查資料完整性與搜尋
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('utils/life-ref.html', 'TOPICS, CATS, searchTopics, checkData, parseRow');
assert.deepEqual(m.checkData(m.TOPICS, m.CATS), []);
for (const c of m.CATS) assert.ok(m.TOPICS.some(t => t.cat === c), '分類無內容：' + c);
for (const t of m.TOPICS) {
    assert.ok(t.rows.length >= 8, '列數過少：' + t.id);
    assert.ok(t.kw.split(/\s+/).length >= 4, '關鍵字過少：' + t.id);
    for (const s of t.rows) assert.equal(s.split(' ~~ ').length, 2, '列格式：' + t.id + ' ' + s.slice(0, 12));
}
assert.ok(m.checkData([{ id: 'a', cat: '寵物', title: 'x', rows: ['y'] }, { id: 'a', cat: 'zz', title: '', rows: [] }], m.CATS).length >= 4);
assert.equal(m.searchTopics(m.TOPICS, '').length, m.TOPICS.length);
assert.equal(m.searchTopics(m.TOPICS, '', '寵物').length, m.TOPICS.filter(t => t.cat === '寵物').length);
assert.equal(m.searchTopics(m.TOPICS, 'zzzqqq').length, 0);
assert.ok(m.searchTopics(m.TOPICS, 'CPR').some(x => x.t.id === 'fa-cpr'));
assert.ok(m.searchTopics(m.TOPICS, '咖啡 汙漬').some(x => x.t.id === 'lw-coffee'));
assert.ok(m.searchTopics(m.TOPICS, '稱人結').some(x => x.t.id === 'ou-knot1' && x.rows.some(r => r.text.startsWith('稱人結'))));
assert.ok(m.searchTopics(m.TOPICS, '巧克力').some(x => x.t.id === 'pt-dog'));
assert.ok(m.searchTopics(m.TOPICS, '母乳 冷凍').some(x => x.t.id === 'bb-milk'));
// 月曆 12 個月、依序
assert.deepEqual(m.TOPICS.find(t => t.id === 'gd-calendar').rows.map(s => parseInt(m.parseRow(s).text, 10)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
// 急救 / 寵物 / 嬰幼兒主題都有免責或參考提示（note 或列內容）
for (const id of ['fa-cpr', 'pt-dog', 'pt-cat', 'pt-toxplant', 'bb-solid', 'bb-milk']) assert.ok(m.TOPICS.find(t => t.id === id).note, '缺提示：' + id);
ok('life-ref: data integrity and search');
