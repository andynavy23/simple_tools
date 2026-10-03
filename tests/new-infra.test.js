// 備份 / 還原（shared/js/chrome.js 的純函式）
const assert = require('assert');
const { ok } = require('./_load');
const { matcher, buildBackup, parseBackup, fmtBytes } = require('../shared/js/chrome.js');

const fake = (obj) => { const keys = Object.keys(obj); return { length: keys.length, key: (i) => keys[i], getItem: (k) => obj[k] }; };

{
    const m = matcher(['a', 'p_*', '']);
    assert.ok(m('a') && m('p_') && m('p_xyz') && m('p_中文') && !m('b') && !m('pa') && !m('') && !m(null) && !m(5));
    const all = matcher(['*']); assert.ok(all('anything') && all('erp_prog_我的小說.txt') && !all('') && !all('bad\nkey') && !all('x'.repeat(201)));
    assert.ok(!matcher([])('a'));
    const st = fake({ a: '1', p_1: '2', other: '3', st_style: '"neon"' });
    assert.deepEqual(buildBackup(m, st, 'x').data, { a: '1', p_1: '2' });
    assert.deepEqual(Object.keys(buildBackup(all, st, 'all').data).sort(), ['a', 'other', 'p_1', 'st_style']);
    const b = buildBackup(m, st, 'utils/x.html', new Date('2024-05-06T07:08:09Z')); assert.equal(b.app, 'simple_tools'); assert.equal(b.v, 1); assert.equal(b.scope, 'utils/x.html'); assert.equal(b.exportedAt, '2024-05-06T07:08:09.000Z');
    assert.deepEqual(buildBackup(m, fake({}), 's').data, {});
    ok('backup: matcher / buildBackup');
}
{
    const m = matcher(['a', 'p_*']);
    const good = JSON.stringify({ app: 'simple_tools', v: 1, scope: 'x', exportedAt: '2024-05-06T07:08:09.000Z', data: { a: '[1,2]', p_1: '{"x":1}', other: 'z', p_bad: 5 } });
    const r = parseBackup(good, m); assert.ok(r.ok); assert.deepEqual(r.items, { a: '[1,2]', p_1: '{"x":1}' }); assert.equal(r.skipped, 2); assert.equal(r.scope, 'x');
    // 來回：匯出的檔案能被同範圍載入、內容一致
    const st = fake({ a: '[1]', p_k: '"v"', zz: '9' }); const back = parseBackup(JSON.stringify(buildBackup(m, st, 's')), m); assert.deepEqual(back.items, { a: '[1]', p_k: '"v"' }); assert.equal(back.skipped, 0);
    // 壞檔案
    for (const [t, msg] of [['', '空'], ['   ', '空'], [null, '空'], ['not json', 'JSON'], ['[]', 'Simple Tools'], ['null', 'Simple Tools'], ['{"app":"other","data":{}}', 'Simple Tools'], ['{"app":"simple_tools"}', 'data'], ['{"app":"simple_tools","data":[1]}', 'data'], ['{"app":"simple_tools","data":"x"}', 'data']]) { const x = parseBackup(t, m); assert.ok(!x.ok && x.error.includes(msg), JSON.stringify(t) + ' → ' + x.error); }
    assert.ok(!parseBackup('x'.repeat(6000001), m).ok);
    // 原型污染與怪鍵：只當一般字串鍵處理，不會污染
    const evil = parseBackup('{"app":"simple_tools","data":{"__proto__":"x","a":"1","constructor":"y"}}', matcher(['*'])); assert.ok(evil.ok); assert.equal(({}).x, undefined); assert.equal(evil.items.a, '1');
    // 總量限制
    const big = parseBackup(JSON.stringify({ app: 'simple_tools', data: { a: 'x'.repeat(2000000), p_1: 'y'.repeat(2000000), p_2: 'z'.repeat(1000000) } }), m); assert.ok(!big.ok && big.error.includes('太大'));
    assert.equal(parseBackup(JSON.stringify({ app: 'simple_tools', data: { a: 'x'.repeat(2000001) } }), m).skipped, 1);
    assert.equal(fmtBytes(500), '500 B'); assert.equal(fmtBytes(2048), '2.0 KB'); assert.equal(fmtBytes(3 * 1048576), '3.0 MB');
    ok('backup: parseBackup validation / roundtrip / hostile input');
}
