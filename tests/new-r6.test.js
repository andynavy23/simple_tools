// 批次 r6：鬥地主 mini-games/landlord.html 的純函式（牌型、比大小、叫分、出牌、倍數與結算、電腦、戰績）
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('mini-games/landlord.html', 'classify, beats, allPlays, beating, newGame, bid, playCards, passTurn, scoreRound, autoMove, cpuMove, viewOf, hintList, bidFor, cleanOpts, cleanStats, addStat, rankOf');
const { classify, beats, allPlays, newGame, bid, playCards, passTurn, scoreRound, autoMove, cpuMove, viewOf, hintList, cleanOpts, cleanStats, addStat } = m;

// 牌寫法：'3'~'10' 用 t = '3456789TJQKA2'，'x' 小王、'X' 大王；同點數依序取不同花色。例：K('33344455') → 3 張 3、3 張 4、2 張 5
const ORD = '3456789TJQKA2';
const K = (s) => { const used = {}; return [...s].map(ch => { if (ch === 'x') return 52; if (ch === 'X') return 53; const r = ORD.indexOf(ch); used[ch] = (used[ch] || 0); return r * 4 + used[ch]++; }); };
const kind = (s) => { const c = classify(K(s)); return c ? c.kind : null; };

// ===== 牌型：正例 =====
const good = { single: ['3', 'x', 'X', '2'], pair: ['33', '22', 'AA'], triple: ['333', '222'], tripleS: ['3335', '222x', 'AAA3'], tripleP: ['33355', 'AAA22'], bomb: ['3333', '2222'], rocket: ['xX'],
    straight: ['34567', '3456789TJQKA', '789TJ', '10JQKA'.replace('10', 'T'), 'TJQKA'], pairs: ['334455', 'QQKKAA', '33445566'], plane: ['333444', '333444555', 'KKKAAA'], planeS: ['33344456', '333444555678', 'JJJQQQ3x'],
    planeP: ['3334445566', '3334445599'], quadS: ['333345', '33334x', '333355'], quadP: ['33334455', '33334444'] };


for (const [k, list] of Object.entries(good)) for (const s of list) assert.strictEqual(kind(s), k, `${s} 應為 ${k}，實得 ${kind(s)}`);
ok('landlord: classify positive');

// ===== 牌型：反例與邊界 =====
for (const s of ['', '35', '3x', '3345', '33345', '3456', '34568', '2345A', 'JQKA2', 'QKA23', 'A2345', '33445', '3344', '334466', 'KKAA22', '333555', 'AAA222', '33337', '33344455x', '33344455xX']) assert.strictEqual(kind(s), null, `${s} 不該合法，卻是 ${kind(s)}`);

assert.strictEqual(kind('3334'), 'tripleS'); assert.strictEqual(kind('3456'), null); assert.strictEqual(kind('34568'), null);
assert.strictEqual(kind('2345A'), null, 'A2345 不是順子'); assert.strictEqual(kind('JQKA2'), null, '順子不含 2'); assert.strictEqual(kind('TJQKA'), 'straight');
assert.strictEqual(kind('KKAA22'), null, '連對不含 2'); assert.strictEqual(kind('3344'), null, '連對至少 3 對'); assert.strictEqual(kind('QQKKAA'), 'pairs');
assert.strictEqual(kind('AAA222'), null, '飛機不含 2'); assert.strictEqual(kind('333555'), null, '飛機要連續'); assert.strictEqual(kind('33344466'), 'planeS', '333444 + 66 當兩張單牌');
assert.strictEqual(kind('33344455x'), null); assert.strictEqual(kind('333444xX'), null, '王炸不能當飛機的翅膀');
assert.strictEqual(kind('3333xX'), null, '王炸不能當四帶二的牌'); assert.strictEqual(kind('333345'), 'quadS'); assert.strictEqual(kind('33334445'), null);
assert.strictEqual(kind('3x'), null); assert.strictEqual(kind('xx'), null);
assert.strictEqual(classify([0, 0]), null, '重複的牌'); assert.strictEqual(classify([54]), null); assert.strictEqual(classify([-1]), null); assert.strictEqual(classify(null), null); assert.strictEqual(classify([1.5]), null); assert.strictEqual(classify([]), null);
assert.strictEqual(classify(Array.from({ length: 21 }, (_, i) => i)), null);
// 長順子：12 張 3..A；點數與長度
const st = classify(K('3456789TJQKA')); assert.deepStrictEqual([st.rank, st.len, st.n], [0, 12, 12]);
// 飛機點數 = 最低那組三張；帶翅膀的比較
assert.strictEqual(classify(K('44455567' + '')).rank, 1); assert.strictEqual(classify(K('33344456')).kind, 'planeS');
// 四帶二、四帶兩對、四個 3 + 四個 4 視為四帶兩對
assert.strictEqual(classify(K('33334444')).kind, 'quadP');
ok('landlord: classify negative / edges');

// ===== 比大小 =====
const b = (a, c) => beats(classify(K(a)), classify(K(c)));
assert.ok(b('4', '3') && !b('3', '4') && !b('4', '4') && b('2', 'A') && b('x', '2') && b('X', 'x'));
assert.ok(b('55', '44') && !b('55', '4') && !b('555', '44') && b('5553', '4442'));
assert.ok(b('5553', '4442') && !b('55534', '4442'), '張數不同不能比');
assert.ok(b('55577', '44433'), '三帶一對');
assert.ok(b('45678', '34567') && !b('456789', '34567') && !b('34567', '34567'));
assert.ok(b('445566', '334455') && !b('44556677', '334455'));
assert.ok(b('444555', '333444') && b('44455567', '33344456') && !b('444555', '33344456') && b('4445556677', '3334445588'.slice(0, 10)));
assert.ok(b('3333', 'AAA2') && b('3333', '2') && b('3333', 'AA') && b('3333', '34567'), '炸彈壓任何非炸彈');
assert.ok(b('4444', '3333') && !b('3333', '4444') && !b('3333', '3333'));
assert.ok(b('xX', '2222') && b('xX', 'AAAA') && !b('2222', 'xX') && b('xX', '2'));
assert.ok(b('5555', '333345'));
assert.ok(b('444423', '333356') && b('444455', '333366') && !b('333366', '444423'));
assert.ok(!beats(null, classify(K('3'))) && !beats(classify(K('3')), null));
ok('landlord: beats');

// ===== 可出牌列舉 =====
{
    const hand = K('33344455567' + 'xX').sort((a, c) => a - c);
    const all = allPlays(hand);
    assert.ok(all.every(p => p.cards.every(c => hand.includes(c)) && classify(p.cards)), '列舉結果都合法且在手上');
    assert.ok(all.some(p => p.info.kind === 'rocket') && all.some(p => p.info.kind === 'plane' && p.n === 9) && all.some(p => p.info.kind === 'planeS') && all.some(p => p.info.kind === 'tripleP') && all.some(p => p.info.kind === 'straight' && p.n === 5));
    // 要壓 4 的對子：只列出更大的對子與炸彈 / 王炸
    const last = { cards: K('44'), info: classify(K('44')) };
    const bt = m.beating(hand, last);
    assert.ok(bt.length && bt.every(p => p.info.kind === 'pair' ? p.info.rank > 1 : p.info.kind === 'rocket'), '只剩更大的對子 / 王炸');
    // 沒有炸彈時無法壓炸彈
    assert.strictEqual(m.beating(K('3456789'), { cards: K('3333'), info: classify(K('3333')) }).length, 0);
    // 四帶二、四帶兩對列舉
    const h2 = K('3333445566');
    const a2 = allPlays(h2); assert.ok(a2.some(p => p.info.kind === 'quadS') && a2.some(p => p.info.kind === 'quadP') && a2.some(p => p.info.kind === 'bomb'));
    // 連對與順子邊界：A 在順子內可、2 不行
    const h3 = K('TJQKA2'); const a3 = allPlays(h3); assert.ok(a3.some(p => p.info.kind === 'straight' && p.n === 5) && !a3.some(p => p.info.kind === 'straight' && p.n === 6));
}
ok('landlord: allPlays / beating');

// ===== 叫分 =====
const deck = Array.from({ length: 54 }, (_, i) => i);
{
    let G = newGame(deck.slice(), 1);
    assert.deepStrictEqual(G.hands.map(h => h.length), [17, 17, 17]); assert.strictEqual(G.bottom.length, 3); assert.strictEqual(new Set([...G.hands.flat(), ...G.bottom]).size, 54);
    assert.ok(!bid(G, 0, 1), '還沒輪到'); assert.ok(!bid(G, 1, 4) && !bid(G, 1, -1) && !bid(G, 1, 1.5) && !bid(G, 1, '2'));
    assert.ok(bid(G, 1, 1) && G.turn === 2 && G.high === 1);
    assert.ok(!bid(G, 2, 1), '必須比 1 分高'); assert.ok(bid(G, 2, 2) && bid(G, 0, 0));
    assert.strictEqual(G.phase, 'play'); assert.strictEqual(G.landlord, 2); assert.strictEqual(G.hands[2].length, 20); assert.strictEqual(G.turn, 2); assert.strictEqual(G.high, 2);
    // 3 分立刻結束
    G = newGame(deck.slice(), 0); assert.ok(bid(G, 0, 0) && bid(G, 1, 3)); assert.strictEqual(G.phase, 'play'); assert.strictEqual(G.landlord, 1);
    // 都不叫：重發
    G = newGame(deck.slice(), 2); bid(G, 2, 0); bid(G, 0, 0); bid(G, 1, 0); assert.strictEqual(G.phase, 'redeal');
    // 只有最後一人叫
    G = newGame(deck.slice(), 0); bid(G, 0, 0); bid(G, 1, 0); bid(G, 2, 1); assert.strictEqual(G.landlord, 2);
    assert.ok(!playCards(newGame(deck.slice(), 0), 0, [0]), '叫分階段不能出牌');
}
ok('landlord: bidding');

// ===== 出牌 / 不出 / 領出 / 倍數 / 結算 =====
const mkPlay = (hands, landlord = 0) => { const G = newGame(deck.slice(), landlord); G.hands = hands.map(h => K(h).sort((a, c) => a - c)); G.bottom = []; G.phase = 'play'; G.landlord = landlord; G.high = 2; G.turn = landlord; return G; };
{
    const G = mkPlay(['3344556', '78', '9T'], 0);          // 手牌是自訂的小局面
    assert.ok(!playCards(G, 1, K('7')), '還沒輪到'); assert.ok(!passTurn(G, 0), '領出不能不出'); assert.ok(!playCards(G, 0, [51]), '不在手上'); assert.ok(!playCards(G, 0, K('35')), '非牌型');
    assert.ok(playCards(G, 0, K('33'))); assert.strictEqual(G.turn, 1); assert.ok(!playCards(G, 1, K('7')), '單張壓不了對子'); assert.ok(!passTurn(G, 2));
    assert.ok(passTurn(G, 1) && G.turn === 2 && G.last); assert.ok(passTurn(G, 2)); assert.strictEqual(G.last, null, '兩人不出 → 清桌'); assert.strictEqual(G.turn, 0, '由最後出牌者領出');
    assert.ok(!passTurn(G, 0));
    // 領出後下家可出更大的
    assert.ok(playCards(G, 0, K('4')) && playCards(G, 1, K('7')) && G.turn === 2);
}
{   // 春天：地主一路出完，農民沒出過
    const G = mkPlay(['33', '45', '67'], 0);
    assert.ok(playCards(G, 0, K('33'))); assert.strictEqual(G.phase, 'over'); assert.strictEqual(G.winner, 0); assert.strictEqual(G.spring, 1); assert.strictEqual(G.mult, 2);
    assert.deepStrictEqual(scoreRound(G), [8, -4, -4]);                  // 底分 2 × 倍數 2 = 4；地主 +2 份、農民各 −1 份
}
{   // 反春天：農民先出完，地主只出過第一手
    // 手動走：地主領出單張 → 農民 1 出完 → 反春天
    const H = mkPlay(['45', '6', '77'], 0); assert.ok(playCards(H, 0, K('4')) && playCards(H, 1, K('6'))); assert.strictEqual(H.winner, 1); assert.strictEqual(H.spring, 2); assert.strictEqual(H.mult, 2);
    assert.deepStrictEqual(scoreRound(H), [-8, 4, 4]);
}
{   // 炸彈 / 王炸加倍；一般勝利無春天
    const G = mkPlay(['33345', '4444', '5678'], 0); G.plays = [1, 1, 1];
    assert.ok(playCards(G, 0, K('3'))); assert.ok(playCards(G, 1, K('4444'))); assert.strictEqual(G.mult, 2); assert.strictEqual(G.bombs, 1);
    const R = mkPlay(['33', 'xX45', '5678'], 0); R.plays = [1, 1, 1]; assert.ok(playCards(R, 0, K('3'))); assert.ok(playCards(R, 1, K('xX'))); assert.strictEqual(R.mult, 2);
    const W = mkPlay(['33', '4', '5'], 0); W.plays = [1, 1, 1]; W.high = 3; assert.ok(playCards(W, 0, K('33'))); assert.strictEqual(W.mult, 1); assert.deepStrictEqual(scoreRound(W), [6, -3, -3]);
}
assert.deepStrictEqual(autoMove(mkPlay(['345', '6', '7'], 0), 0), { t: 'PLAY', cards: [K('3')[0]] }); { const G = mkPlay(['345', '6', '7'], 0); playCards(G, 0, K('3')); assert.deepStrictEqual(autoMove(G, 1), { t: 'PASS' }); assert.deepStrictEqual(autoMove(newGame(deck.slice(), 0), 0), { t: 'BID', v: 0 }); }
ok('landlord: play / pass / multiplier / score');

// ===== 電腦：合法性、不偷看、終局 =====
{
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const sh = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const t0 = Date.now(); let games = 0, over = 0, finished = 0;
    for (let g = 0; g < 80; g++) {
        const level = g % 2; let G = newGame(sh(deck), g % 3), guard = 0;
        while (G.phase !== 'over' && guard++ < 400) {
            if (G.phase === 'redeal') { G = newGame(sh(deck), g % 3); continue; }
            const pub = { phase: G.phase, counts: G.hands.map(h => h.length), last: G.last ? { p: G.last.p, cards: G.last.cards } : null, landlord: G.landlord, high: G.high };
            const hands0 = JSON.stringify(G.hands);
            const mv = cpuMove(viewOf(pub, G.turn, G.hands[G.turn]), level);
            assert.strictEqual(JSON.stringify(G.hands), hands0, '電腦不改牌局');
            const okMove = mv.t === 'BID' ? bid(G, G.turn, mv.v) : mv.t === 'PLAY' ? playCards(G, G.turn, mv.cards) : passTurn(G, G.turn);
            assert.ok(okMove, `電腦出了不合法動作 ${JSON.stringify(mv)}`);
        }
        games++; if (G.phase === 'over') { finished++; const d = scoreRound(G); assert.strictEqual(d[0] + d[1] + d[2], 0, '總和為零'); }
    }
    assert.strictEqual(finished, games, '每局都能打完');
    assert.ok(Date.now() - t0 < 9000, '電腦對戰耗時 ' + (Date.now() - t0));
    // 農民不壓隊友：普通電腦在隊友領先時不出
    const v = { me: 1, hand: K('45678'), counts: [10, 5, 8], last: { p: 2, cards: K('3'), info: classify(K('3')) }, landlord: 0, high: 2, phase: 'play' };
    assert.deepStrictEqual(cpuMove(v, 1), { t: 'PASS' }); assert.strictEqual(cpuMove(v, 0).t, 'PLAY');
    // 對手（地主）出的牌：普通電腦壓最小的
    v.last.p = 0; const mv = cpuMove(v, 1); assert.deepStrictEqual(mv, { t: 'PLAY', cards: K('4') });
    // 保留炸彈：手上有炸彈 + 能用小牌壓時不拆炸彈；非危急時不用炸彈
    const v2 = { me: 1, hand: K('55556789'), counts: [10, 8, 8], last: { p: 0, cards: K('3'), info: classify(K('3')) }, landlord: 0, high: 1, phase: 'play' };
    const mv2 = cpuMove(v2, 1); assert.strictEqual(mv2.t, 'PLAY'); assert.ok(!(mv2.cards.length > 1 && classify(mv2.cards).kind === 'bomb'));
    const v3 = { me: 1, hand: K('3333456789T'), counts: [10, 11, 8], last: { p: 0, cards: K('22'), info: classify(K('22')) }, landlord: 0, high: 1, phase: 'play' };
    assert.deepStrictEqual(cpuMove(v3, 1), { t: 'PASS' }, '沒有危險就不炸');
    v3.counts[0] = 3; assert.strictEqual(cpuMove(v3, 1).t, 'PLAY', '對手快出完才炸');
    // 能一次出完就出完
    const v4 = { me: 2, hand: K('33344456'), counts: [5, 5, 8], last: null, landlord: 2, high: 1, phase: 'play' };
    assert.strictEqual(cpuMove(v4, 1).cards.length, 8);
    // 領出：優先出多張的小牌型，不先出王炸 / 炸彈
    const v5 = { me: 0, hand: K('3456789' + 'XxAA22'), counts: [13, 17, 17], last: null, landlord: 0, high: 1, phase: 'play' };
    const mv5 = cpuMove(v5, 1); assert.strictEqual(classify(mv5.cards).kind, 'straight');
    // 提示：領出有提示、無法壓時回空
    assert.ok(hintList(viewOf({ phase: 'play', counts: [5, 5, 5], last: null, landlord: 0, high: 1 }, 0, K('3'))).length >= 1);
    assert.strictEqual(hintList(viewOf({ phase: 'play', counts: [5, 5, 5], last: { p: 1, cards: K('2') }, landlord: 0, high: 1 }, 0, K('345'))).length, 0);
    // 叫分：強牌叫高，弱牌不叫；不會叫不高於目前的分數
    assert.strictEqual(m.bidFor(K('3456789TJQK'), 0, 1), 0); assert.ok(m.bidFor(K('XxAA2222'), 0, 1) >= 2); assert.strictEqual(m.bidFor(K('XxAA2222'), 3, 1), 0);
    for (let i = 0; i < 40; i++) { const v = m.bidFor(K('3456789TJQK'), 1, 0); assert.ok(v === 0 || (v > 1 && v <= 3)); }
}
ok('landlord: cpu legality / strategy');

// ===== 選項與戰績 =====
assert.deepStrictEqual(cleanOpts(null), { level: 1, timer: 30 }); assert.deepStrictEqual(cleanOpts({ level: 0, timer: 60 }), { level: 0, timer: 60 }); assert.deepStrictEqual(cleanOpts({ level: 'x', timer: 7 }), { level: 1, timer: 30 }); assert.deepStrictEqual(cleanOpts([1]), { level: 1, timer: 30 });
const z = { g: 0, w: 0, lg: 0, lw: 0, pts: 0 };
for (const bad of [null, 'x', 5, [], {}, { g: 'a' }, { g: NaN, w: Infinity }]) assert.deepStrictEqual(cleanStats(bad), z);
assert.deepStrictEqual(cleanStats({ g: 3, w: 9, lg: 8, lw: 7, pts: 4.9 }), { g: 3, w: 3, lg: 3, lw: 3, pts: 4 }, '勝場不超過場數');
assert.deepStrictEqual(cleanStats({ g: 1e12, pts: -1e12 }), { g: 999999, w: 0, lg: 0, lw: 0, pts: -99999999 }, '上限');
let s = z; s = addStat(s, true, true, 8); s = addStat(s, false, false, -4); s = addStat(s, true, false, 4);
assert.deepStrictEqual(s, { g: 3, w: 2, lg: 1, lw: 1, pts: 8 });
assert.deepStrictEqual(addStat({ g: 999999, w: 1, lg: 0, lw: 0, pts: 0 }, true, false, 1).g, 999999, '滿了不再累計');
assert.deepStrictEqual(addStat('壞資料', true, true, 2), { g: 1, w: 1, lg: 1, lw: 1, pts: 2 });
ok('landlord: opts / stats');
