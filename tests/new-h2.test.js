// h2 批次：doc-templates 文件範本產生器純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const D = load('utils/doc-templates.html', 'TPL, tbl, escCell, allocMinutes, slideStats, slideCheck, cleanVals, loadOpts, hasContent, sizeBytes, overLimit, toPlain, emptyVals, FIELD_MAX, ROWS_MAX, TOTAL_MAX');

// 13 個範本：範例都能輸出完整 Markdown
assert.strictEqual(Object.keys(D.TPL).length, 13);
for (const [k, t] of Object.entries(D.TPL)) {
    const v = D.cleanVals(t, t.ex), md = t.md(v);
    assert.ok(md.startsWith('# '), k);
    assert.ok(!md.includes('（待補）'), k + ' 範例不應有待補');
    assert.ok(t.hint.length > 10, k);
    assert.ok(D.hasContent(t, v) && !D.hasContent(t, D.emptyVals(t)), k);
}
ok('範本範例');

// 表格逸出
assert.strictEqual(D.escCell(' a|b\nc '), 'a\\|b<br>c');
assert.strictEqual(D.tbl(['A', 'B'], [['x|y', '1'], ['', '']]), '| A | B |\n| --- | --- |\n| x\\|y | 1 |');
assert.strictEqual(D.tbl(['A'], [['']]), '（待補）');
assert.ok(D.TPL.api.md(D.cleanVals(D.TPL.api, D.TPL.api.ex)).includes('a\\|b 皆可'));
ok('表格逸出');

// 會議記錄、使用者故事
let md = D.TPL.meeting.md(D.cleanVals(D.TPL.meeting, D.TPL.meeting.ex));
assert.ok(md.includes('## 待辦') && md.includes('| 補齊 API 測試 | 小明 | 10/23 |') && md.includes('1. 上週進度'));
md = D.TPL.story.md(D.cleanVals(D.TPL.story, D.TPL.story.ex));
assert.ok(md.includes('As a 忘記密碼的使用者') && md.includes('1. Given') && md.includes('Then 收到'));
ok('會議與故事');

// 簡報時間
assert.deepStrictEqual(D.allocMinutes(20, 3), [7, 7, 6]);
assert.deepStrictEqual(D.allocMinutes(20, 5), [4, 4, 4, 4, 4]);
assert.deepStrictEqual(D.allocMinutes(0, 3), []);
assert.deepStrictEqual(D.allocMinutes(10, 0), []);
assert.deepStrictEqual(D.slideStats('20', [['a', '5'], ['b', 'x'], ['c', '-3'], ['d', '4.5']]), { sum: 9.5, total: 20, diff: 10.5 });
assert.ok(D.slideCheck('20', [['a', '20']]).includes('相符'));
assert.ok(D.slideCheck('20', [['a', '15']]).includes('差少 5'));
assert.ok(D.slideCheck('10', [['a', '15']]).includes('超出 5'));
assert.ok(D.slideCheck('', []).includes('未填'));
ok('簡報時間');

// 草稿驗證與上限
const t = D.TPL.meeting;
let c = D.cleanVals(t, { title: 5, date: 'x'.repeat(30000), actions: 'bad', attendees: null });
assert.strictEqual(c.title, ''); assert.strictEqual(c.date.length, D.FIELD_MAX); assert.deepStrictEqual(c.actions, [['', '', '']]);
c = D.cleanVals(t, { actions: Array.from({ length: 150 }, () => ['a', 1, 'c', 'extra']).concat([null, 'x']) });
assert.strictEqual(c.actions.length, D.ROWS_MAX); assert.deepStrictEqual(c.actions[0], ['a', '', 'c']);
assert.strictEqual(D.cleanVals(D.TPL.adr, { status: 'Bogus' }).status, 'Proposed');
assert.strictEqual(D.cleanVals(D.TPL.adr, { status: 'Accepted' }).status, 'Accepted');
assert.strictEqual(D.cleanVals(t, null).title, '');
const o = D.loadOpts({ type: 'nope', drafts: { meeting: { title: 'T' }, zzz: {}, adr: 'bad' } });
assert.strictEqual(o.type, 'meeting'); assert.strictEqual(o.drafts.meeting.title, 'T'); assert.ok(!('zzz' in o.drafts) && !('adr' in o.drafts));
assert.strictEqual(D.loadOpts([]).type, 'meeting'); assert.strictEqual(D.loadOpts('x').type, 'meeting');
assert.strictEqual(D.loadOpts({ type: 'bug' }).type, 'bug');
assert.ok(!D.overLimit(D.loadOpts(null)));
const big = { type: 'meeting', drafts: {} };
for (const k of ['meeting', 'adr', 'prd', 'design', 'bug', 'postmortem', 'api', 'release']) big.drafts[k] = { title: '中'.repeat(20000) };
assert.ok(D.sizeBytes(big) > D.TOTAL_MAX && D.overLimit(big));
ok('草稿驗證與上限');

// 純文字
const p = D.toPlain('# 標題\n\n## 待辦\n\n| 事項 | 負責人 |\n| --- | --- |\n| a\\|b | 小明 |\n\n- [ ] 做\n```json\n{}\n```\n');
assert.ok(p.startsWith('標題') && p.includes('事項 / 負責人') && p.includes('a|b / 小明') && p.includes('□ 做') && !p.includes('---') && !p.includes('```'));
ok('純文字');
