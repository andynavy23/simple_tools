const { load, ok } = require('./_load'); const assert = require('assert');
const m = load('utils/dev-cheatsheets.html', 'TOPICS, CATS, parseRow, searchTopics, checkTopics');
// 資料完整性
assert.deepStrictEqual(m.checkTopics(m.TOPICS), []);
for (const t of m.TOPICS) assert.ok(t.rows.length >= 8 && t.rows.length <= 25, t.id + ' rows=' + t.rows.length);
assert.ok(m.TOPICS.length >= 40);
assert.ok(m.CATS.every(c => m.TOPICS.some(t => t.cat === c)), '每個分類都有主題');
ok('dev-cheatsheets: data integrity');
// parseRow
assert.deepStrictEqual(m.parseRow('!!rm -rf x ~~ 刪'), { cmd: 'rm -rf x', desc: '刪', lv: 2 });
assert.strictEqual(m.parseRow('!kill 1 ~~ a').lv, 1);
assert.strictEqual(m.parseRow('ls ~~ b').lv, 0);
// checkTopics 能抓到問題
const bad = m.checkTopics([{ id: 'a', cat: 'x', title: '', rows: [] }, { id: 'a', cat: '命令列', title: 't', rows: ['rm -rf / ~~ d'] }]);
assert.ok(bad.length >= 5, bad.join('|'));
// 搜尋
const s = (q, c) => m.searchTopics(m.TOPICS, q, c);
assert.strictEqual(s('').length, m.TOPICS.length);
assert.strictEqual(s('', '資料庫').length, m.TOPICS.filter(t => t.cat === '資料庫').length);
assert.strictEqual(s('vim')[0].t.id, 'vim');
assert.strictEqual(s('vim')[0].rows.length, m.TOPICS.find(t => t.id === 'vim').rows.length, '標題符合 → 整張卡');
const r = s('1062'); assert.ok(r.length && r[0].t.id === 'mysql-err');
assert.strictEqual(s('zzzzqqq').length, 0);
assert.ok(s('ssh tunnel').some(x => x.t.id === 'ssh'));
assert.ok(s('VIM')[0].t.id === 'vim', '不分大小寫');
assert.ok(s('openssl', '安全').length >= 1 && s('openssl', '命令列').length === 0);
ok('dev-cheatsheets: search / filter');
