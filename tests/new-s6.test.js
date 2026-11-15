// 批次 s6：music-lab 鋼琴與鼓機純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

const m = load('utils/music-lab.html', 'KB_MAP, kbMidi, keyFreq, isBlack, adsr, textToRec, recToText, stepDur, stepTime, emptyPat, cleanPat, loadDrum, patToText, textToPat, DRUMS, loadOpts');

// 鍵位與頻率
near(m.keyFreq(69), 440); near(m.keyFreq(57), 220); near(m.keyFreq(60), 261.6256, 1e-3);
assert.equal(m.kbMidi('a', 4), 60); assert.equal(m.kbMidi('k', 4), 72); assert.equal(m.kbMidi('w', 4), 61); assert.equal(m.kbMidi('z', 4), null); assert.equal(m.kbMidi('a', 9), null);
assert.ok(m.isBlack(61) && !m.isBlack(60) && m.isBlack(70));

// ADSR
const p = { a: 0.1, d: 0.2, s: 0.5, r: 0.4 };
near(m.adsr(0, null, p), 0); near(m.adsr(0.05, null, p), 0.5); near(m.adsr(0.1, null, p), 1); near(m.adsr(0.2, null, p), 0.75); near(m.adsr(0.3, null, p), 0.5); near(m.adsr(5, null, p), 0.5);
near(m.adsr(1.2, 1, p), 0.25); near(m.adsr(1.4, 1, p), 0); near(m.adsr(2, 1, p), 0); near(m.adsr(0.9, 1, p), 0.5);
near(m.adsr(0.15, 0.05, p), 0.5 * (1 - 0.1 / 0.4)); // 起音中途放開：從當時位準衰減
near(m.adsr(1, 0.5, { a: 0, d: 0, s: 0.6, r: 0 }), 0);

// 錄音文字
const r = m.textToRec('64@500+200 60@0+300');
assert.deepEqual(r.events, [{ m: 60, t: 0, d: 300 }, { m: 64, t: 500, d: 200 }]);
assert.equal(m.recToText(r.events), '60@0+300 64@500+200');
assert.ok(m.textToRec('').events.length === 0);
for (const bad of ['60', '60@x+1', '200@0+10', '60@0+0', '60@999999+10', '60@0+99999']) assert.ok(m.textToRec(bad).error, bad);
assert.ok(m.textToRec(Array(2001).fill('60@0+10').join(' ')).error); assert.equal(m.textToRec(Array(2000).fill('60@0+10').join(' ')).events.length, 2000);

// 步進時間
near(m.stepDur(120), 0.125); near(m.stepDur(60), 0.25);
near(m.stepTime(1, 0, 120, 60), 1); near(m.stepTime(1, 1, 120, 0), 1); near(m.stepTime(1, 1, 120, 60), 1 + 0.6 * 0.125); near(m.stepTime(1, 3, 120, 30), 1 + 0.3 * 0.125); near(m.stepTime(1, 2, 120, 60), 1);

// 樣式驗證
assert.equal(m.DRUMS.length, 8);
const e = m.emptyPat(); assert.ok(m.cleanPat(e));
const row = '1000100010001000';
const c = m.cleanPat({ name: '  a|b/c  ', bpm: 999, swing: -5, tr: Array(8).fill(row) });
assert.equal(c.bpm, 240); assert.equal(c.swing, 0); assert.equal(c.name, 'a b c');
assert.equal(m.cleanPat({ name: 'x', bpm: 'abc', swing: 'zz', tr: Array(8).fill(row) }).bpm, 100);
assert.equal(m.cleanPat({ name: 1, bpm: 40, swing: 61, tr: Array(8).fill(row) }).name, '未命名');
assert.equal(m.cleanPat({ name: 'x', bpm: 40, swing: 61, tr: Array(8).fill(row) }).swing, 60);
for (const bad of [null, 5, {}, { tr: [] }, { tr: Array(7).fill(row) }, { tr: Array(8).fill('10') }, { tr: Array(8).fill('100010001000100a') }, { tr: Array(8).fill(5) }]) assert.equal(m.cleanPat(bad), null);
assert.equal(m.cleanPat({ name: 'x'.repeat(50), tr: Array(8).fill(row) }).name.length, 20);

// 載入：壞資料丟棄、補 id、上限 20、id 不重複
assert.deepEqual(m.loadDrum(null), { pats: [] }); assert.deepEqual(m.loadDrum({ pats: 'x' }), { pats: [] });
const many = Array.from({ length: 30 }, (_, i) => ({ id: 'same', name: 'p' + i, bpm: 100, swing: 0, tr: Array(8).fill(row) }));
const ld = m.loadDrum({ pats: [null, 3, ...many] });
assert.equal(ld.pats.length, 20); assert.equal(new Set(ld.pats.map(x => x.id)).size, 20);

// 序列化來回
const q = { name: '搖滾', bpm: 120, swing: 20, tr: ['1000100010001000', '0000100000001000', ...Array(6).fill('0'.repeat(16))] };
const t = m.patToText(q); assert.deepEqual(m.textToPat(t), q);
for (const bad of ['', 'a|b', 'a|100|0|' + Array(7).fill(row).join('/'), 'a|100|0|' + Array(8).fill('x').join('/'), 'a|100|0|' + Array(8).fill(row).join('/') + '|z']) assert.equal(m.textToPat(bad), null, bad);

// 分頁清單向下相容
assert.equal(m.loadOpts({ tab: 'chord', v: {} }).tab, 'chord'); assert.equal(m.loadOpts({ tab: 'piano' }).tab, 'piano'); assert.equal(m.loadOpts({ tab: 'drum' }).tab, 'drum'); assert.equal(m.loadOpts({ tab: 'zzz' }).tab, 'chord');
ok('music-lab: piano & drum pure');
