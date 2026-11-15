// 批次 r9：骰子遊戲（大話骰 / Yahtzee）純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

const m = load('mini-games/dice-games.html', 'bidGt, bidOk, countFace, resolveCall, binomTail, ldNew, ldBid, ldCall, ldNext, ldAi, totalDice, yzScore, yzLegal, yzPlace, yzTotal, yzNewCard, yzDone, yzBest, yzKeep, yzNew, yzRoll, yzFill, cleanOpts, cleanStats, validView');

// ---- 叫點大小 ----
assert.ok(m.bidGt({ n: 3, f: 2 }, { n: 2, f: 6 })); assert.ok(m.bidGt({ n: 2, f: 4 }, { n: 2, f: 3 }));
assert.ok(!m.bidGt({ n: 2, f: 3 }, { n: 2, f: 3 })); assert.ok(!m.bidGt({ n: 2, f: 6 }, { n: 3, f: 1 })); assert.ok(m.bidGt({ n: 1, f: 1 }, null));
assert.ok(m.bidOk(2, 3, null, 10, false) && !m.bidOk(11, 3, null, 10, false) && !m.bidOk(2, 7, null, 10, false) && !m.bidOk(0, 3, null, 10, false));
assert.ok(!m.bidOk(2, 1, null, 10, true), '萬用時不能叫 1 點'); assert.ok(m.bidOk(2, 1, null, 10, false));
assert.ok(!m.bidOk(2.5, 3, null, 10, false) && !m.bidOk('2', 3, null, 10, false));

// ---- 開盅結算 ----
const hands = [[1, 2, 3, 3, 6], [3, 4, 5, 1, 1]];
assert.equal(m.countFace(hands, 3, false), 3); assert.equal(m.countFace(hands, 3, true), 6); assert.equal(m.countFace(hands, 1, true), 3);
assert.deepEqual(m.resolveCall({ n: 3, f: 3 }, hands, false), { count: 3, bidderWins: true });
assert.equal(m.resolveCall({ n: 4, f: 3 }, hands, false).bidderWins, false);
assert.equal(m.resolveCall({ n: 6, f: 3 }, hands, true).bidderWins, true);

// ---- 二項分布（已知答案） ----
near(m.binomTail(2, 0.5, 1), 0.75); near(m.binomTail(5, 1 / 6, 1), 1 - Math.pow(5 / 6, 5)); near(m.binomTail(10, 0.5, 5), 0.623046875);
assert.equal(m.binomTail(5, 0.3, 0), 1); assert.equal(m.binomTail(5, 0.3, 6), 0); near(m.binomTail(3, 0.5, 3), 0.125);

// ---- 整局流程 ----
const opts = { wild: false, joker: false, bonus: false, lvl: 'normal' };
let g = m.ldNew(['甲', '乙', '丙'], 1, opts); assert.equal(m.totalDice(g), 15);
g.starter = 0; g.turn = 0; g.hands = [[1, 1, 2, 3, 4], [3, 3, 3, 5, 6], [2, 2, 2, 2, 2]];
assert.ok(m.ldCall(g, 0), '第一手不能開'); assert.ok(m.ldBid(g, 1, 1, 1), '還沒輪到');
assert.equal(m.ldBid(g, 0, 2, 3), null); assert.equal(g.turn, 1);
assert.ok(m.ldBid(g, 1, 2, 3), '沒有提高'); assert.ok(m.ldBid(g, 1, 99, 3), '超過總骰數');
assert.equal(m.ldBid(g, 1, 2, 4), null);
assert.equal(m.ldCall(g, 2), null);                         // 丙開乙：全場 4 點 = 1 個 < 2? 實際 4 點有 1 個
assert.deepEqual([g.res.count, g.res.bidderWins, g.res.loser], [1, false, 1]);
assert.equal(g.seats[1].dice, 4); assert.equal(g.phase, 'reveal'); assert.equal(g.starter, 1);
assert.equal(m.ldNext(g), null); assert.equal(g.round, 2); assert.equal(g.turn, 1); assert.equal(g.hands[1].length, 4);
// 叫點成立 → 開的人輸
g.hands = [[3, 3, 3, 3, 3], [1, 2, 4, 5], [2, 2, 2, 2, 2]]; g.turn = 1;
m.ldBid(g, 1, 4, 3); assert.equal(g.turn, 2); m.ldBid(g, 2, 5, 3); m.ldCall(g, 0);   // 0 開 2 的「5 個 3」：全場 5 個 → 成立，0 輸
assert.deepEqual([g.res.bidderWins, g.res.loser, g.seats[0].dice], [true, 0, 4]);
// 淘汰與勝負
g = m.ldNew(['甲', '乙'], 1, opts); g.seats[1].dice = 1; g.hands = [[1, 1, 1, 1, 1], [2]]; g.starter = g.turn = 1;
m.ldBid(g, 1, 1, 5); m.ldCall(g, 0); assert.equal(g.seats[1].alive, false); assert.equal(g.phase, 'over'); assert.equal(g.winner, 0);
// 淘汰後輪替跳過死者
g = m.ldNew(['甲', '乙', '丙'], 1, opts); g.seats[1].alive = false; g.seats[1].dice = 0; g.hands[1] = []; g.turn = 0; m.ldBid(g, 0, 1, 2); assert.equal(g.turn, 2);

// ---- 電腦：不偷看、必定合法、機率直覺 ----
assert.deepEqual(m.ldAi([1, 2, 3, 4, 5], 30, { n: 25, f: 3 }, false, 'normal'), { call: true });
assert.deepEqual(m.ldAi([1, 2, 3, 4, 5], 30, { n: 25, f: 3 }, false, 'easy'), { call: true });
assert.equal(m.ldAi([3, 3, 3, 3, 3], 10, { n: 1, f: 3 }, false, 'normal').call, undefined, '低叫點不開');
assert.deepEqual(m.ldAi([1, 1, 1, 1, 1], 5, { n: 5, f: 6 }, false, 'normal'), { call: true }, '無處可叫就開');
let bad = 0;
for (let t = 0; t < 400; t++) {
    const wild = t % 2 === 0, lvl = t % 3 === 0 ? 'easy' : 'normal', total = 4 + (t % 20), hand = Array.from({ length: 1 + (t % 5) }, (_, i) => 1 + ((t * 7 + i * 3) % 6));
    const prev = t % 4 === 0 ? null : { n: 1 + (t % total), f: wild ? 2 + (t % 5) : 1 + (t % 6) };
    const d = m.ldAi(hand, Math.max(total, hand.length), prev, wild, lvl);
    if (!d.call && !m.bidOk(d.n, d.f, prev, Math.max(total, hand.length), wild)) bad++;
    if (d.call && !prev) bad++;
}
assert.equal(bad, 0, '電腦輸出不合法');
// 整局都由電腦打完：一定結束、骰子總數守恆遞減
g = m.ldNew(['a', 'b', 'c', 'd'], 0, { ...opts, wild: true }); let guard = 0;
while (g.phase !== 'over' && guard++ < 2000) { if (g.phase === 'reveal') { m.ldNext(g); continue; } const d = m.ldAi(g.hands[g.turn], m.totalDice(g), g.bid, true, 'normal'); const e = d.call ? m.ldCall(g, g.turn) : m.ldBid(g, g.turn, d.n, d.f); assert.equal(e, null); }
assert.equal(g.phase, 'over'); assert.ok(g.winner >= 0);

// ---- Yahtzee 各格計分（正反例） ----
const S = m.yzScore;
assert.deepEqual([0, 1, 2, 3, 4, 5].map(c => S(c, [1, 2, 2, 4, 6, 6].slice(0, 5))), [1, 4, 0, 4, 0, 6]);
assert.equal(S(5, [6, 6, 6, 2, 1]), 18);
assert.equal(S(6, [2, 2, 2, 5, 6]), 17); assert.equal(S(6, [2, 2, 5, 5, 6]), 0); assert.equal(S(6, [3, 3, 3, 3, 3]), 15);
assert.equal(S(7, [3, 3, 3, 3, 5]), 17); assert.equal(S(7, [3, 3, 3, 5, 5]), 0);
assert.equal(S(8, [2, 2, 3, 3, 3]), 25); assert.equal(S(8, [2, 2, 3, 3, 4]), 0); assert.equal(S(8, [3, 3, 3, 3, 2]), 0);
assert.equal(S(8, [4, 4, 4, 4, 4], false), 0); assert.equal(S(8, [4, 4, 4, 4, 4], true), 25);
assert.equal(S(9, [1, 2, 3, 4, 4]), 30); assert.equal(S(9, [1, 2, 3, 4, 6]), 30); assert.equal(S(9, [3, 4, 5, 6, 6]), 30); assert.equal(S(9, [2, 3, 4, 5, 6]), 30);
assert.equal(S(9, [1, 2, 3, 5, 6]), 0); assert.equal(S(9, [1, 2, 2, 3, 5]), 0); assert.equal(S(9, [2, 2, 2, 2, 2], true), 30);
assert.equal(S(10, [1, 2, 3, 4, 5]), 40); assert.equal(S(10, [2, 3, 4, 5, 6]), 40); assert.equal(S(10, [1, 2, 3, 4, 4]), 0); assert.equal(S(10, [1, 2, 3, 5, 6]), 0); assert.equal(S(10, [6, 6, 6, 6, 6], true), 40);
assert.equal(S(11, [5, 5, 5, 5, 5]), 50); assert.equal(S(11, [5, 5, 5, 5, 4]), 0);
assert.equal(S(12, [1, 2, 3, 4, 6]), 16);

// ---- 上段獎勵 / 總分 ----
let c = m.yzNewCard(); [3, 6, 9, 12, 15, 18].forEach((v, i) => { c.s[i] = v; });
assert.deepEqual(m.yzTotal(c), { upper: 63, bonus: 35, lower: 0, yb: 0, total: 98 });
c.s[5] = 17; assert.equal(m.yzTotal(c).bonus, 0); assert.equal(m.yzTotal(c).total, 62);
c.s[8] = 25; c.s[11] = 50; c.yb = 2; assert.equal(m.yzTotal(c).total, 62 + 75 + 200);

// ---- Yahtzee 獎勵與 Joker ----
const yo = { joker: true, bonus: true };
let k = m.yzNewCard(); k.s[11] = 50;
const Y = [4, 4, 4, 4, 4];
assert.deepEqual(m.yzLegal(k, Y, yo).cats, [3], '先填上段對應格');
let k2 = m.yzPlace(k, 3, Y, yo); assert.equal(k2.s[3], 20); assert.equal(k2.yb, 1, '獎勵 100');
assert.equal(m.yzPlace(k, 8, Y, yo), null, 'Joker：上段未填不可填下段');
assert.deepEqual(m.yzLegal(k2, Y, yo), { cats: [6, 7, 8, 9, 10, 12], joker: true });
assert.equal(m.yzPlace(k2, 10, Y, yo).s[10], 40, 'Joker 大順滿分'); assert.equal(m.yzPlace(k2, 0, Y, yo), null);
let k3 = m.yzNewCard(); k3.s[11] = 0; assert.equal(m.yzPlace(k3, 3, Y, yo).yb, 0, 'Yahtzee 格填 0 無獎勵');
assert.equal(m.yzPlace(k, 8, Y, { joker: false, bonus: false }).s[8], 0, '關閉 Joker：任意格、葫蘆 0');
assert.equal(m.yzPlace(k, 8, Y, { joker: false, bonus: true }).yb, 1);
let k4 = m.yzNewCard(); k4.s.fill(1); k4.s[0] = null; k4.s[11] = 50; assert.deepEqual(m.yzLegal(k4, [5, 5, 5, 5, 5], yo).cats, [0], '下段全滿只剩上段');
assert.equal(m.yzPlace(k4, 0, [5, 5, 5, 5, 5], yo).s[0], 0);
assert.equal(m.yzPlace(k, 3, [1, 2, 3, 4, 5], yo).s[3], 4); assert.equal(m.yzPlace(k, 11, [1, 2, 3, 4, 5], yo), null, '已填的格不能再填');

// ---- 電腦保留策略 ----
const emp = m.yzNewCard(), no = { joker: false, bonus: false };
assert.deepEqual(m.yzKeep(emp, [6, 6, 6, 6, 2], no), [true, true, true, true, false]);
assert.deepEqual(m.yzKeep(emp, [5, 5, 5, 5, 5], no), [true, true, true, true, true]);
assert.deepEqual(m.yzKeep(emp, [1, 2, 3, 4, 5], no), [true, true, true, true, true], '大順已成形就收手');
assert.equal(m.yzBest(emp, [1, 1, 1, 1, 1], no).c, 11);
assert.equal(m.yzBest(emp, [2, 3, 4, 5, 6], no).c, 10);
const t0 = Date.now(); m.yzKeep(emp, [1, 3, 4, 6, 6], no); assert.ok(Date.now() - t0 < 300, '單步 < 300ms');

// ---- 完整一局（兩個電腦座位，擲骰 / 保留 / 填格都走引擎） ----
let y = m.yzNew(['a', 'b'], 0, no), steps = 0;
assert.ok(m.yzFill(y, 0, 0), '沒擲不能填'); assert.equal(m.yzRoll(y, 0, null), null); assert.ok(m.yzRoll(y, 1, null), '輪不到');
assert.ok(m.yzRoll(y, 0, [1, 0, 0, 0, 0]), '格式錯誤'); const keep = y.dice[0];
assert.equal(m.yzRoll(y, 0, [true, false, false, false, false]), null); assert.equal(y.dice[0], keep, '保留的骰子不變');
assert.equal(m.yzRoll(y, 0, [true, true, true, true, true]), null); assert.ok(m.yzRoll(y, 0, [false, false, false, false, false]), '第 4 次不能擲');
assert.ok(m.yzFill(y, 0, 13) && m.yzFill(y, 0, -1) && m.yzFill(y, 0, 1.5));
while (y.phase !== 'over' && steps++ < 400) {
    const i = y.turn, card = y.seats[i].card;
    if (y.rolls === 0) m.yzRoll(y, i, null); else { const kp = y.rolls < 3 ? [true, true, true, true, true] : null; if (kp) m.yzFill(y, i, m.yzBest(card, y.dice, no).c); else m.yzFill(y, i, m.yzBest(card, y.dice, no).c); }
}
assert.equal(y.phase, 'over'); assert.ok(y.seats.every(s => m.yzDone(s.card)));

// ---- 選項 / 統計驗證 ----
assert.deepEqual(m.cleanOpts(null), { wild: false, joker: false, bonus: false, lvl: 'normal' });
assert.deepEqual(m.cleanOpts({ wild: 1, joker: true, lvl: 'easy', x: 5 }), { wild: false, joker: true, bonus: false, lvl: 'easy' });
assert.deepEqual(m.cleanStats('x'), { ld: { p: 0, w: 0 }, yz: { p: 0, w: 0, best: 0 } });
assert.deepEqual(m.cleanStats({ ld: { p: 5, w: 9 }, yz: { p: -1, w: 'a', best: 99999 } }), { ld: { p: 5, w: 5 }, yz: { p: 0, w: 0, best: 0 } });
assert.equal(m.cleanStats({ yz: { p: 3, w: 2, best: 250 } }).yz.best, 250);

// ---- 成員端驗證房主狀態 ----
const mk = (id = 'abcd1234') => { const gg = m.ldNew(['a', 'b'], 1, opts); return { game: 'ld', my: 0, id, seats: gg.seats, turn: gg.turn, phase: 'bid', round: 1, opts, bid: null, res: null, winner: -1, commits: ['', ''], hand: gg.hands[0] }; };
assert.ok(m.validView(mk())); assert.ok(!m.validView(null)); assert.ok(!m.validView({ ...mk(), my: 5 })); assert.ok(!m.validView({ ...mk(), hand: [7] }));
assert.ok(!m.validView({ ...mk(), phase: 'zzz' })); assert.ok(!m.validView({ ...mk(), bid: { n: 'x', f: 1, by: 0 } })); assert.ok(!m.validView({ ...mk(), seats: [] }));
const yv = { game: 'yz', my: 0, id: 'x', seats: y.seats, turn: 0, phase: 'over', round: 13, opts: no, dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rolls: 1 };
assert.ok(m.validView(yv)); assert.ok(!m.validView({ ...yv, dice: [1, 2, 3] })); assert.ok(!m.validView({ ...yv, rolls: 9 }));
assert.ok(m.validView({ lobby: true, game: 'ld', names: ['a'], act: [true] })); assert.ok(!m.validView({ lobby: true, game: 'zz', names: [], act: [] }));

ok('dice-games');
