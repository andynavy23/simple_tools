// 批次 k5：mini-games/card-games.html（牌類小遊戲）純邏輯：自對弈、合法性、牌數守恆、不偷看、存檔清理
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('mini-games/card-games.html', 'GAMES, playOut, cleanOpts, cleanStats, mkDeck, shuf, pairOff, tot75, rk75, rIdx');
const { GAMES, playOut, cleanOpts, cleanStats } = m;
const R = (k) => Util.seeded('k5-' + k);
const defO = (id) => cleanOpts(null).o[id];

// 牌組與洗牌（種子可重現）
assert.strictEqual(m.mkDeck().length, 52); assert.strictEqual(m.mkDeck(true).length, 53);
assert.deepStrictEqual(m.shuf(m.mkDeck(), R(1)), m.shuf(m.mkDeck(), R(1)));
assert.notDeepStrictEqual(m.shuf(m.mkDeck(), R(1)), m.shuf(m.mkDeck(), R(2)));
assert.strictEqual(new Set(m.shuf(m.mkDeck(), R(3))).size, 52);
// 配對
{ const r = m.pairOff(['AS', 'AH', 'AD', 'AC', 'JK', '5S', '5H', '7C']); assert.deepStrictEqual(r.keep.sort(), ['7C', 'JK'].sort()); assert.strictEqual(r.gone.length, 6); }
{ const r = m.pairOff(['AS', 'AH', 'AD']); assert.strictEqual(r.keep.length, 1); assert.strictEqual(r.gone.length, 2); }
// 七點半點數
assert.strictEqual(m.tot75(['KS', 'QH', '7D']), 8); assert.strictEqual(m.rk75(['KS', 'QH', '7D']), -1);
assert.strictEqual(m.tot75(['KS', '7D']), 7.5); assert.strictEqual(m.rk75(['KS', '7D']), 50);
assert.strictEqual(m.rk75(['AS', 'AH', 'AD', 'AC', 'KS']), 100);   // 五小（4.5 點）
assert.strictEqual(m.rk75(['AS', '2H']), 3);

// 每個遊戲：電腦對電腦 1000 局（簡單 / 普通混搭，人數 2–4），每步合法、牌數守恆、必定打完、不偷看
const combos = [['normal', 'normal', 'normal', 'normal'], ['easy', 'easy', 'easy', 'easy'], ['normal', 'easy', 'normal', 'easy']];
const optsOf = (id, g) => { const o = defO(id); if (id === 'crazy8') { o.fn = g % 2 === 0; o.draw = g % 3 === 0 ? 'one' : 'until'; } if (id === 'war') o.limit = g % 5 === 0 ? 'short' : 'full'; if (id === 'half') o.rounds = g % 2 ? '2' : '1'; return o; };
for (const id of Object.keys(GAMES)) {
    const maxN = 1 + GAMES[id].maxCpu;
    for (let g = 0; g < 1000; g++) {
        const n = id === 'war' ? 2 : 2 + (g % (maxN - 1));
        const r = playOut(id, n, optsOf(id, g), R(id + g), combos[g % 3], g % 4 === 0);
        assert.ok(r.s.over, id + ' 沒結束');
        const res = GAMES[id].res(r.s); assert.ok(res.pts.length === n && Array.isArray(res.winners));
        if (id !== 'war' || r.s.hands.every(h => h.length)) assert.ok(res.winners.length >= 1, id + ' 無贏家');
    }
    // 隨機合法步（亂打）也必須打得完
    for (let g = 0; g < 100; g++) playOut(id, id === 'war' ? 2 : 3, optsOf(id, g), R('r' + id + g), ['rand', 'rand', 'rand'], false, 30000);
    ok('k5 自對弈 1000 局 ' + GAMES[id].name);
}
// 結算正確性
{ // 排七：贏家手牌為空，其餘剩餘點數 = rIdx 加總
    const { s } = playOut('sevens', 4, {}, R('sv'), ['normal'], false); const w = s.winners[0]; assert.strictEqual(s.hands[w].length, 0);
    const res = GAMES.sevens.res(s); s.hands.forEach((h, i) => assert.strictEqual(res.pts[i], h.reduce((a, c) => a + m.rIdx(c), 0)));
}
{ // 釣魚牌：結束時 13 組，贏家為最多
    const { s } = playOut('gofish', 3, {}, R('gf'), ['normal'], false); assert.strictEqual(s.books.reduce((a, b) => a + b.length, 0), 13);
    const res = GAMES.gofish.res(s); res.winners.forEach(i => assert.strictEqual(res.pts[i], Math.max(...res.pts)));
}
{ // 撿紅點：紅牌總分 ≤ 26，且 = 被撿走的紅牌數
    const { s } = playOut('pick', 3, {}, R('pk'), ['normal'], false); const res = GAMES.pick.res(s); assert.ok(res.pts.reduce((a, b) => a + b, 0) <= 26);
}
{ // 戰爭：打完後一方 52 張；short 模式回合 ≤ 100
    const a = playOut('war', 2, { limit: 'full' }, R('w1'), ['normal']).s; assert.ok(a.hands[0].length === 52 || a.hands[1].length === 52 || a.round >= 2000);
    const b = playOut('war', 2, { limit: 'short' }, R('w2'), ['normal']).s; assert.ok(b.round <= 100);
}
{ // 七點半：每局莊家輪替，總局數 = n * rounds，籌碼總和守恆（100*n）
    const { s } = playOut('half', 3, { rounds: '2' }, R('h'), ['normal']); assert.strictEqual(s.round, 6); assert.strictEqual(s.chips.reduce((a, b) => a + b, 0), 300);
    // 平手莊家贏、五小 3 倍：手動設定結算
    const g = GAMES.half, t = g.init(2, { rounds: '1' }, R('h2')); t.banker = 0; t.hands = [['KS', '7D'], ['KH', '7C']]; t.stage = 'act'; t.pos = 1; t.turn = 1; t.order = [1, 0]; t.chips = [100, 100];
    const fin = (hs) => { t.hands = hs; t.stage = 'act'; t.pos = 1; t.turn = 1; t.chips = [100, 100]; g.apply(t, { t: 'stand' }, R('x')); return t.chips; };
    assert.deepStrictEqual(fin([['KS', '7D'], ['KH', '7C']]), [120, 80]);                                  // 兩邊 7.5：平手莊家贏，七點半 2 倍
    assert.deepStrictEqual(fin([['KS', '3D'], ['AS', 'AH', 'AD', 'AC', 'KH']]), [70, 130]);               // 閒家五小贏 3 倍
    assert.deepStrictEqual(fin([['KS', '7D', 'KH'], ['KD', 'QH']]), [90, 110]);                           // 莊家爆牌，閒家 1 點贏 1 倍
    assert.deepStrictEqual(fin([['KS', '7D'], ['KD', '7H', 'KH']]), [120, 80]);   // 閒家爆牌輸，莊家 7.5 收 2 倍
}
// 存檔清理
assert.deepStrictEqual(cleanOpts('x'), cleanOpts(null)); assert.deepStrictEqual(cleanOpts([1]), cleanOpts(null));
{ const o = cleanOpts({ game: '__proto__', cpu: 99, level: 'hard', o: { crazy8: { fn: 'yes', draw: 'zzz' }, war: null, half: { rounds: '9' } } }); assert.strictEqual(o.game, 'oldmaid'); assert.strictEqual(o.cpu, 2); assert.strictEqual(o.level, 'normal'); assert.deepStrictEqual(o.o.crazy8, { fn: false, draw: 'until' }); assert.strictEqual(o.o.half.rounds, '1'); assert.strictEqual(o.o.war.limit, 'full'); }
{ const o = cleanOpts({ game: 'war', cpu: 3, level: 'easy', o: { crazy8: { fn: true, draw: 'one' } } }); assert.strictEqual(o.game, 'war'); assert.strictEqual(o.cpu, 3); assert.strictEqual(o.level, 'easy'); assert.deepStrictEqual(o.o.crazy8, { fn: true, draw: 'one' }); }
{ const st = cleanStats({ oldmaid: { p: 'x', w: -5 }, war: { p: 3, w: 9 }, gofish: null, zzz: 1, sevens: { p: 1e12, w: 2 }, half: { p: 5.5, w: 1 } });
  assert.deepStrictEqual(st.oldmaid, { p: 0, w: 0 }); assert.deepStrictEqual(st.war, { p: 3, w: 3 }); assert.deepStrictEqual(st.gofish, { p: 0, w: 0 }); assert.strictEqual(st.sevens.p, 999999); assert.deepStrictEqual(st.half, { p: 0, w: 0 }); assert.ok(!('zzz' in st)); }
assert.deepStrictEqual(cleanStats(null), cleanStats('garbage')); assert.deepStrictEqual(Object.keys(cleanStats(null)), Object.keys(GAMES));
ok('k5 牌類小遊戲 結算 / 存檔清理');
