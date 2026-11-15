// 批次 s8：fun/party-kit.html 純邏輯（洗牌、不重複抽題、發牌、交換禮物配對、國王指令、自訂驗證、題庫數量）
const { load, ok } = require('./_load');
const assert = require('assert');

const m = load('fun/party-kit.html', 'TOD, CHA, BRAIN, KING, MAXC, shuf, rngOf, pickNew, todPool, makeDeck, deal, pairUp, parseBanned, kingGen, remain, cleanCustom');

// 題庫數量
for (const lv of ['easy', 'mid', 'hot']) assert.ok(m.TOD[lv].T.length + m.TOD[lv].D.length >= 40, lv);
for (const [k, a] of Object.entries(m.CHA)) { assert.ok(a.length >= 30, k); assert.strictEqual(new Set(a).size, a.length, k + ' 重複'); }
assert.ok(m.BRAIN.length >= 80); assert.ok(m.BRAIN.every(b => b.q && b.a && b.cat));
assert.ok(m.KING.easy.length >= 20 && m.KING.mid.length >= 20);

// 洗牌：保持元素、可重現
const a = Array.from({ length: 20 }, (_, i) => i);
assert.deepStrictEqual(m.shuf(a).sort((x, y) => x - y), a);
assert.deepStrictEqual(m.shuf(a, m.rngOf('s1')), m.shuf(a, m.rngOf('s1')));
assert.notDeepStrictEqual(m.shuf(a, m.rngOf('s1')), m.shuf(a, m.rngOf('s2')));
const cnt = [0, 0, 0]; for (let i = 0; i < 3000; i++) cnt[m.shuf([0, 1, 2])[0]]++;
assert.ok(cnt.every(c => c > 800), '洗牌明顯偏差 ' + cnt);

// 不重複抽題：抽滿 len 次都不重複，下一次 reset
let used = [], seen = new Set();
for (let i = 0; i < 7; i++) { const r = m.pickNew(7, used); assert.ok(!r.reset && !seen.has(r.i)); seen.add(r.i); used = r.used; }
assert.ok(m.pickNew(7, used).reset);
assert.strictEqual(m.pickNew(0, []), null);

// 題池
assert.strictEqual(m.todPool('easy', 'R').length, m.TOD.easy.T.length + m.TOD.easy.D.length);
assert.deepStrictEqual(m.todPool('mine', 'T', [{ t: 'T', q: 'x' }, { t: 'D', q: 'y' }]), [{ t: 'T', q: 'x' }]);

// 發牌
const deck = m.makeDeck(2); assert.strictEqual(deck.length, 54); assert.strictEqual(m.makeDeck(0).length, 52); assert.strictEqual(m.makeDeck(1).length, 53);
const d = m.deal(deck, 4, 5);
assert.strictEqual(d.rest.length, 34);
assert.strictEqual(new Set([...d.hands.flat(), ...d.rest]).size, 54);
assert.strictEqual(m.deal(deck, 10, 6), null);
assert.deepStrictEqual(m.deal(deck, 3, 5, m.rngOf('k')), m.deal(deck, 3, 5, m.rngOf('k')));

// 交換禮物：無自配、無排除、每人恰被抽一次
const names = ['a', 'b', 'c', 'd', 'e', 'f'], ban = [['a', 'b'], ['c', 'd']];
for (let i = 0; i < 300; i++) {
    const r = m.pairUp(names, ban);
    assert.ok(r && new Set(r).size === 6);
    r.forEach((to, k) => { assert.notStrictEqual(to, names[k]); assert.ok(!ban.some(([x, y]) => (x === names[k] && y === to) || (y === names[k] && x === to))); });
}
assert.ok(m.pairUp(['a', 'b'], []) && m.pairUp(['a', 'b'], []).join() === 'b,a');
assert.strictEqual(m.pairUp(['a'], []), null);
assert.strictEqual(m.pairUp(['a', 'b'], [['a', 'b']]), null, '兩人互斥無解');
assert.strictEqual(m.pairUp(['a', 'b', 'c'], [['a', 'b'], ['a', 'c']]), null, 'a 被全排除無解');
assert.deepStrictEqual(m.parseBanned('a,b\nx,y\na,a\n  c  d ', ['a', 'b', 'c', 'd']), { pairs: [['a', 'b'], ['c', 'd']], bad: ['x,y', 'a,a'] });

// 國王指令
for (let i = 0; i < 100; i++) {
    const c = m.kingGen(m.KING.easy, [1, 2, 3]); assert.ok(c && !/[{}]/.test(c));
    const two = m.kingGen(['{a}號對{b}號笑'], [4, 5]); assert.ok(/^[45]號對[45]號笑$/.test(two) && two[0] !== two[3]);
}
assert.strictEqual(m.kingGen(['{a}號和{b}號握手'], [1]), null);
assert.ok(m.kingGen(['大家乾杯'], [1]) === '大家乾杯');

// 倒數用時間戳
assert.strictEqual(m.remain(10000, 0), 10); assert.strictEqual(m.remain(10000, 9500), 1); assert.strictEqual(m.remain(10000, 10000), 0); assert.strictEqual(m.remain(10000, 20000), 0);

// 自訂驗證
const long = 'x'.repeat(200);
const c = m.cleanCustom({ tod: [{ id: 'a', t: 'T', q: ' hi ' }, { id: 'a', t: 'D', q: long }, null, { t: 'Z', q: 'bad' }, { t: 'T', q: '' }, 5], king: 'x', seen: [0, 0, 1.5, -1, 9999, 3, 'a'] });
assert.strictEqual(c.tod.length, 2); assert.strictEqual(c.tod[0].q, 'hi'); assert.strictEqual(c.tod[1].q.length, 80);
assert.strictEqual(new Set(c.tod.map(x => x.id)).size, 2, 'id 重複要重編');
assert.deepStrictEqual(c.king, []); assert.deepStrictEqual(c.seen, [0, 3]);
for (const bad of [null, 1, 'x', [], undefined]) assert.deepStrictEqual(m.cleanCustom(bad), { tod: [], king: [], seen: [] });
const many = m.cleanCustom({ tod: Array.from({ length: 300 }, (_, i) => ({ id: 'i' + i, t: 'T', q: 'q' + i })), king: Array.from({ length: 300 }, (_, i) => ({ id: 'k' + i, q: 'q' })) });
assert.strictEqual(many.tod.length, 200); assert.strictEqual(many.king.length, 200);
ok('s8 party-kit');
