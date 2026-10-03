// 心情日記：標籤管理（刪除 / 改名 / 上限）
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('fun/mood-journal.html', 'cleanTags, tagUsage, removeTag, renameTag, MAX_TAGS');
const E = (date, tags) => ({ date, mood: 3, tags, text: '' });
const entries = [E('2024-01-01', ['工作', '運動']), E('2024-01-02', ['工作']), E('2024-01-03', [])];
const list = ['工作', '家人', '運動'];
assert.equal(m.tagUsage(entries, '工作'), 2); assert.equal(m.tagUsage(entries, '家人'), 0);
// 只從選項移除：舊日記保留
let r = m.removeTag(entries, list, '工作', false); assert.deepEqual(r.tagList, ['家人', '運動']); assert.deepEqual(r.entries, entries);
// 連日記一起移除
r = m.removeTag(entries, list, '工作', true); assert.deepEqual(r.tagList, ['家人', '運動']); assert.deepEqual(r.entries.map(e => e.tags), [['運動'], [], []]);
assert.deepEqual(entries[0].tags, ['工作', '運動'], '不改動輸入'); assert.deepEqual(list, ['工作', '家人', '運動']);
assert.deepEqual(m.removeTag(entries, list, '不存在', true).tagList, list);
// 改名
r = m.renameTag(entries, list, '工作', '上班'); assert.equal(r.name, '上班'); assert.deepEqual(r.tagList, ['上班', '家人', '運動']); assert.deepEqual(r.entries.map(e => e.tags), [['上班', '運動'], ['上班'], []]);
// 改成已存在的名稱 → 合併，不重複
r = m.renameTag(entries, list, '工作', '運動'); assert.deepEqual(r.tagList, ['運動', '家人']); assert.deepEqual(r.entries.map(e => e.tags), [['運動'], ['運動'], []]);
// 不合法
assert.equal(m.renameTag(entries, list, '工作', ''), null); assert.equal(m.renameTag(entries, list, '工作', '   '), null); assert.equal(m.renameTag(entries, list, '工作', '工作'), null); assert.equal(m.renameTag(entries, list, '工作', 'x'.repeat(13)), null);
assert.equal(m.renameTag(entries, list, '工作', '  新名  ').name, '新名');
assert.equal(m.MAX_TAGS, 40);
ok('mood-journal: tag remove / rename / merge');
