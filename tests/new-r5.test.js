// 批次 r5：麻將（台灣 16 張）規則引擎、算台、電腦玩家
const assert = require('assert');
const { load, ok } = require('./_load');

const m = load('mini-games/mahjong.html', 'tileName, newWall, toCounts, decompose, isWin, waitsOf, shanten, parseHand, analyze, analyzeFlowerWin, settle, defaultTai, cleanTai, cleanOpts, cleanStats, newMatch, newRound, act, nextRound, cpuAct, cpuClaim, claimPending, claimOpts, canZimo, selfKans');
const { tileName, newWall, toCounts, decompose, isWin, waitsOf, shanten, parseHand, analyze, analyzeFlowerWin, settle, defaultTai, cleanTai, cleanOpts, cleanStats, newMatch, newRound, act, nextRound, cpuAct, cpuClaim, claimPending, claimOpts, canZimo, selfKans } = m;
const T = defaultTai();
const P = parseHand;
const cnt = (s) => toCounts(P(s).concealed);
const H = (s, n) => { const h = P(s).concealed.sort((a, b) => a - b); if (n !== undefined) assert.equal(h.length, n, s); return h; };
// 算台：s = 手牌記法（最後一張 = 胡的牌）
const tai = (s, o = {}) => { const p = P(s); assert.equal(p.error, '', s); return analyze({ concealed: p.concealed, melds: p.melds, flowers: p.flowers, win: p.concealed[p.concealed.length - 1], zimo: false, seat: 0, round: 0, dealer: false, streak: 0, flags: {}, ...o }, T); };
const names = (r) => r.items.map(x => x.id + x.tai).sort().join(' ');
const has = (r, id) => r.items.some(x => x.id === id);

{ // ---------- 牌組 ----------
    assert.equal(tileName(0), '一萬'); assert.equal(tileName(8), '九萬'); assert.equal(tileName(9), '1筒'); assert.equal(tileName(26), '9條');
    assert.equal(tileName(27), '東'); assert.equal(tileName(33), '白'); assert.equal(tileName(34), '春'); assert.equal(tileName(41), '竹');
    const w = newWall((a) => a), c = new Array(42).fill(0); w.forEach(k => { c[k]++; });
    assert.equal(w.length, 144);
    for (let k = 0; k < 34; k++) assert.equal(c[k], 4); for (let k = 34; k < 42; k++) assert.equal(c[k], 1);
    ok('mahjong: 144 tiles (8 flowers)');
}

{ // ---------- 胡牌判定 / 拆解 ----------
    for (const w of ['123m456m789m123p456p77s', '111m222m333m444m55p123s', '111z222z333z444z55m123p', '111m123m234m345m456m55p']) assert.equal(isWin(cnt(w), 5), true, w);
    assert.equal(isWin(cnt('123m456m789m123p456p78s'), 5), false);
    assert.equal(isWin(cnt('123m456m789m123p456p7s'), 5), false);            // 張數不對一律 false
    assert.equal(decompose(cnt('123m456m789m123p456p77s'), 4).length, 0);
    // 七對子不是台灣 16 張的胡牌
    assert.equal(isWin(cnt('11m22m33m44m55m66m77m88m9m'), 5), false);
    assert.equal(isWin(cnt('11m22m33m44m55m66m77m135p'), 5), false);
    // 多種拆法：111222333m 可以是 3 個刻子或 3 個順子
    assert.ok(decompose(cnt('111222333m456p789s11z'), 5).length >= 2);
    // 有副露：手上 = 17 − 3×組數
    assert.equal(isWin(cnt('123m456m789m11p'), 3), true); assert.equal(isWin(cnt('11p'), 0), true); assert.equal(isWin(cnt('12p'), 0), false);
    assert.equal(isWin(cnt('123z11m'), 1), false);                            // 字牌不能成順子
    assert.equal(isWin(cnt('89m1p11z'), 1), false); assert.equal(isWin(cnt('789m11z'), 1), true); assert.equal(isWin(cnt('9m1p2p11z'), 1), false);   // 不能跨花色 / 9→1
    ok('mahjong: winning hands, non-winning, no seven pairs');
}

{ // ---------- 聽牌 / 向聽數 ----------
    assert.deepEqual(waitsOf(cnt('123m456m789m123p456p7s'), 5), [24]);        // 單吊 7 條
    assert.deepEqual(waitsOf(cnt('123m456m789m123p77p45s'), 5), [20, 23]);    // 兩面 3 / 6 條
    assert.deepEqual(waitsOf(cnt('123m456m789m123p77p46s'), 5), [22]);        // 嵌張 5 條
    assert.deepEqual(waitsOf(cnt('123m456m789m123p77p12s'), 5), [20]);        // 邊張 3 條
    assert.deepEqual(waitsOf(cnt('123m456m789m123p44p77p'), 5), [12, 15]);    // 雙碰 4 筒 / 7 筒
    assert.equal(shanten(cnt('123m456m789m123p456p77s'), 0), -1);
    assert.equal(shanten(cnt('123m456m789m123p456p7s'), 0), 0);
    assert.equal(shanten(cnt('123m456m789m123p77p45s'), 0), 0);
    assert.equal(shanten(cnt('123m456m789m123p77p4s9s'), 0), 1);
    assert.ok(shanten(cnt('1m4m7m1p4p7p1s4s7s1z2z3z4z5z6z7z'), 0) >= 6);      // 全散牌很遠
    assert.equal(shanten(cnt('11p'), 5), -1); assert.equal(shanten(cnt('1p'), 5), 0);   // 5 組副露：只剩將牌
    for (const s of ['123m456m789m123p77p45s', '123m456m789m123p456p7s', '1m4m7m1p4p7p1s4s7s1z2z3z4z5z6z7z']) { const c = cnt(s); assert.equal(shanten(c, 0) === 0, waitsOf(c, 5).length > 0, s); }   // 聽牌 ⇔ 有牌可胡
    ok('mahjong: waits and shanten');
}

{ // ---------- 手牌記法 ----------
    let p = P('123m 456p 789s 11z 3h');
    assert.deepEqual(p.concealed, [0, 1, 2, 12, 13, 14, 24, 25, 26, 27, 27]); assert.deepEqual(p.flowers, [36]); assert.equal(p.error, '');
    p = P('[123p][444m][1111s](2222z)'); assert.deepEqual(p.melds, [{ t: 'chi', k: 9 }, { t: 'pon', k: 3 }, { t: 'kan', k: 18 }, { t: 'ankan', k: 28 }]);
    for (const bad of ['135x', '[124p]', '[12p]', '(111z)', '[1h2h3h]', '18z', '12', '[891m]', '9'.repeat(300) + 'm']) assert.ok(P(bad).error, bad);
    assert.equal(P('').error, ''); assert.deepEqual(P('').concealed, []);
    ok('mahjong: hand notation parser');
}

{ // ---------- 台數明細（預設台數表）----------
    // 平胡：全順子、非字牌將、無花、兩面聽（胡 4 筒，2-3 筒等 1 / 4 筒）
    let r = tai('123m456m789m345s55p234p'); assert.equal(names(r), 'menqing1 pinghu2'); assert.equal(r.tai, 3);
    r = tai('123m456m789m345s55p234p', { zimo: true }); assert.equal(names(r), 'buqiuren3 pinghu2');
    r = tai('123m456m789m345s234p55p'); assert.equal(names(r), 'menqing1');         // 胡的是將牌（單吊）→ 不是平胡
    r = tai('123m456m789m345s55p234p', { flowers: [34, 38, 35] }); assert.equal(names(r), 'hua2 menqing1');     // 有花就沒有平胡；東家本位花（春 / 梅）每張 1 台
    r = tai('123m456m789m345s55p234p', { flowers: [35, 39], seat: 1 }); assert.equal(r.items.find(x => x.id === 'hua').tai, 2);
    r = tai('123m456m789m345s55p234p', { flowers: [34, 35, 36, 37] }); assert.ok(has(r, 'huagang'));
    r = tai('123m456m789m345s55p234p', { flowers: [38, 39, 40, 41, 34, 35, 36, 37] }); assert.ok(has(r, 'baxian') && !has(r, 'huagang'));
    // 色
    r = tai('123m456m789m234m567m55m', { zimo: true }); assert.equal(names(r), 'buqiuren3 pinghu2 qingyise8');
    r = tai('222m555m888m44z[777m][111z]'); assert.equal(names(r), 'dutin1 hunyise4 menfeng1 pengpeng4 quanfeng1 sananke2');
    r = tai('111z222z333z555z66z[777z]'); assert.equal(names(r), 'dutin1 menfeng1 pengpeng4 quanfeng1 sianke5 xsy4 ziyise16'); assert.equal(r.tai, 32);
    // 大四喜 + 四暗刻 + 獨聽（風牌台不重複計）
    r = tai('111z222z333z444z55m[123p]'); assert.equal(names(r), 'dsx16 dutin1 sianke5'); assert.equal(r.tai, 22);
    r = tai('111z222z333z44z[456m][789p]'); assert.equal(names(r), 'dutin1 sananke2 xsx8');
    r = tai('555z666z777z234m11p456s'); assert.equal(names(r), 'dsy8 menqing1 sananke2');     // 大三元不再計三元牌
    r = tai('555z666z77z234m567p789s'); assert.equal(names(r), 'menqing1 xsy4');
    r = tai('555z234m567m789p234s11s'); assert.equal(r.items.find(x => x.id === 'sanyuan').tai, 1);
    // 暗刻：點炮胡進來的刻子算明刻
    r = tai('222m333m444m555p123s66s', { win: 3 }); assert.equal(names(r), 'menqing1 sananke2');
    r = tai('222m333m444m555p123s66s', { win: 3, zimo: true }); assert.equal(names(r), 'buqiuren3 sianke5');
    // 全求
    r = tai('55m[123p][456p][789p][111z][222z]'); assert.ok(has(r, 'quanqiu') && !has(r, 'menqing'));
    // 斷么
    assert.ok(has(tai('234m456m234p567p33s678s'), 'duanyao')); assert.ok(!has(tai('123m456m789m234p33s678s'), 'duanyao'));
    // 風：門風 / 圈風各 1 台
    r = tai('111z234m567m789p234s55s'); assert.equal(names(r), 'menfeng1 menqing1 quanfeng1');
    r = tai('222z234m567m789p234s55s', { seat: 1, round: 0 }); assert.equal(names(r), 'menfeng1 menqing1');
    r = tai('222z234m567m789p234s55s', { seat: 0, round: 0 }); assert.equal(names(r), 'menqing1');
    // 莊家 / 連莊（連 2 拉 2 = 4 台）；閒家連莊數不計
    r = tai('123m456m789m345s55p234p', { dealer: true, streak: 2 }); assert.equal(names(r), 'dealer1 lian4 menqing1 pinghu2');
    r = tai('123m456m789m345s55p234p', { dealer: false, streak: 5 }); assert.ok(!has(r, 'lian'));
    // 特殊旗標
    r = tai('123m456m789m345s55p234p', { zimo: true, flags: { haidi: true, gangshang: true } }); assert.ok(has(r, 'haidi') && has(r, 'gangshang'));
    r = tai('123m456m789m345s55p234p', { flags: { hedi: true, qianggang: true, lili: true } }); assert.ok(has(r, 'hedi') && has(r, 'qianggang') && has(r, 'lili'));
    r = tai('123m456m789m345s55p234p', { zimo: true, dealer: true, flags: { tianhu: true, dihu: true, renhu: true } }); assert.deepEqual(['tianhu16', 'dihu16', 'renhu8'].every(x => names(r).includes(x)), true);
    // 取最高台的拆法
    r = tai('111m222m333m456p789s11p', { zimo: true }); assert.equal(names(r), 'buqiuren3 dutin1 sananke2');
    // 不是胡牌 / 張數不對 / 超過 4 張 → null
    assert.equal(tai('123m456m789m345s55p235p'), null); assert.equal(tai('123m456m789m345s55p23p'), null);
    assert.equal(analyze({ concealed: H('1111m2222m33m444p').concat([5, 5, 5]), melds: [], flowers: [], win: 0, zimo: false, seat: 0, round: 0, flags: {} }, T), null);
    assert.equal(analyze({ concealed: [0, 0], melds: [{ t: 'pon', k: 0 }, { t: 'chi', k: 0 }, { t: 'chi', k: 9 }, { t: 'pon', k: 5 }, { t: 'pon', k: 6 }], flowers: [], win: 0, zimo: false, seat: 0, round: 0, flags: {} }, T), null);   // 一萬超過 4 張
    // 台數表可調：0 = 不計
    r = analyze({ concealed: H('123m456m789m345s55p234p'), melds: [], flowers: [], win: 12, zimo: false, seat: 0, round: 0, flags: {} }, { ...T, pinghu: 0, menqing: 5 }); assert.equal(names(r), 'menqing5');
    // 花牌直接胡
    r = analyzeFlowerWin({ flowers: [34, 35, 36, 37, 38, 39, 40, 41], seat: 0, flags: {} }, T); assert.ok(has(r, 'baxian') && r.tai >= 8);
    r = analyzeFlowerWin({ flowers: [34, 35, 36, 37, 38, 39, 40], seat: 0, flags: { qiqiang: true } }, T); assert.ok(has(r, 'qiqiang'));
    ok('mahjong: tai items and exclusions');
}

{ // ---------- 結算 ----------
    const o = { base: 50, unit: 20 };
    assert.deepEqual(settle(1, -1, 3, 0, 0, o, T), [-130, 350, -110, -110]);          // 自摸三家付；輸家是莊家再加莊 1 台
    assert.deepEqual(settle(1, 2, 3, 0, 0, o, T), [0, 110, -110, 0]);                 // 點炮只有放槍者付
    assert.deepEqual(settle(1, 0, 3, 0, 2, o, T), [-(50 + 8 * 20), 50 + 8 * 20, 0, 0]);    // 莊家放槍：莊 1 + 連莊 2×2 = 5 台，共 3 + 5
    assert.deepEqual(settle(0, -1, 2, 0, 1, o, T), [3 * (50 + 5 * 20), -(50 + 5 * 20), -(50 + 5 * 20), -(50 + 5 * 20)]);   // 莊家自摸：2 + 莊 1 + 連莊 2 = 5 台
    for (const x of [settle(2, -1, 7, 1, 3, { base: 30, unit: 10 }, T), settle(3, 1, 0, 0, 0, { base: 30, unit: 10 }, T)]) assert.equal(x.reduce((a, b) => a + b, 0), 0);
    ok('mahjong: settlement');
}

{ // ---------- 載入驗證（壞資料）----------
    for (const bad of [null, undefined, 5, 'x', [], { pinghu: 'a', menqing: -1, lian: 1000, zimo: 1.5, dealer: null }]) { const t = cleanTai(bad); for (const k of Object.keys(T)) assert.ok(Number.isInteger(t[k]) && t[k] >= 0 && t[k] <= 99, k); }
    assert.equal(cleanTai({ pinghu: 7 }).pinghu, 7); assert.equal(cleanTai({ pinghu: 100 }).pinghu, T.pinghu); assert.equal(cleanTai({ lian: -1 }).lian, T.lian);
    assert.deepEqual(cleanOpts(null), { base: 50, unit: 20, rounds: 1, timer: 0, level: 1 });
    assert.deepEqual(cleanOpts({ base: 30, unit: 10, rounds: 4, timer: 60, level: 0 }), { base: 30, unit: 10, rounds: 4, timer: 60, level: 0 });
    assert.deepEqual(cleanOpts({ base: -1, unit: 'x', rounds: 3, timer: 5, level: 9 }), { base: 50, unit: 20, rounds: 1, timer: 0, level: 1 });
    assert.deepEqual(cleanOpts([]), cleanOpts({})); assert.equal(cleanOpts({ base: 99999 }).base, 50);
    const s = cleanStats({ rounds: 1e12, wins: -5, money: -1e12, best: 'x', zimo: 3.5, matches: 2 });
    assert.equal(s.rounds, 1e9); assert.equal(s.wins, 0); assert.equal(s.money, -1e9); assert.equal(s.best, 0); assert.equal(s.zimo, 0); assert.equal(s.matches, 2);
    assert.deepEqual(cleanStats(null), { matches: 0, rounds: 0, wins: 0, zimo: 0, lose: 0, best: 0, money: 0 });
    ok('mahjong: cleaners validate bad storage data');
}

// ---------- 牌局情境 ----------
const FILL = [0, 0, 8, 9, 9, 17, 18, 18, 26, 27, 28, 29, 30, 31, 32, 33];            // 16 張雜牌：不會有任何吃碰胡（沒有 4 / 5 / 6 萬）
const mk = (o = {}) => Object.assign({ wall: Array.from({ length: 40 }, (_, i) => i % 27), wall0: [], dealer: 0, streak: 0, rot: 0, o: cleanOpts(null), T, hands: [FILL.slice(), FILL.slice(), FILL.slice(), FILL.slice()], melds: [[], [], [], []], flowers: [[], [], [], []], rivers: [[], [], [], []], phase: 'discard', turn: 0, drawn: -1, last: null, claims: null, qiang: null, noCall: true, draws: [1, 0, 0, 0], discards: 0, afterKan: false, result: null, log: '' }, o);
const P0 = () => H('5m123p456p789p123s456s9m', 17);                                  // 0 號家的 17 張，打出 5 萬（k = 4）
const CHI = () => H('46m18m1z3z5z7z1p4p7p1s4s7s9s9p', 16);                          // 能吃 5 萬（4-6 萬）
const WAIT5 = () => H('123m456p789p123s456s5m', 16);                                // 單吊 5 萬
const PON5 = () => H('55m1z3z5z7z1p4p7p1s4s7s9s9p8m9m', 16);

{ // 吃只能吃上家；非法回應被拒絕且狀態不變
    const g = mk({ hands: [P0(), CHI(), CHI(), FILL.slice()] });
    assert.equal(act(g, 0, { t: 'discard', k: 4 }), true); assert.equal(g.phase, 'claim');
    assert.deepEqual(claimOpts(g, 1).chi, [3]);            // 4、6 萬 + 5 萬
    assert.deepEqual(claimOpts(g, 2).chi, []); assert.deepEqual(claimOpts(g, 3).chi, []);          // 只能吃上家
    assert.deepEqual(claimOpts(g, 0), { hu: false, pon: false, kan: false, chi: [] });
    for (const [q, r] of [[1, { t: 'chi', k: 2 }], [1, { t: 'pon' }], [1, { t: 'hu' }], [1, { t: 'kan' }], [2, { t: 'chi', k: 3 }], [0, { t: 'pass' }], [1, null], [1, {}], [1, { t: 'zz' }]]) assert.equal(act(g, q, { t: 'claim', r }), false, JSON.stringify(r));
    assert.deepEqual(claimPending(g), [1]); assert.equal(g.phase, 'claim');
    assert.equal(act(g, 1, { t: 'claim', r: { t: 'chi', k: 3 } }), true);
    assert.equal(g.phase, 'discard'); assert.equal(g.turn, 1); assert.deepEqual(g.melds[1], [{ t: 'chi', k: 3, from: 0, tile: 4 }]); assert.equal(g.rivers[0].length, 0); assert.equal(g.hands[1].length, 14); assert.equal(g.noCall, false);
    assert.equal(act(g, 1, { t: 'claim', r: { t: 'pass' } }), false);                // 已不在回應階段
    assert.equal(act(g, 2, { t: 'discard', k: 27 }), false);                         // 還沒輪到
    assert.equal(act(g, 1, { t: 'discard', k: 28 }), false);                         // 手上沒有這張
    assert.equal(act(g, 1, { t: 'discard', k: 'x' }), false); assert.equal(act(g, 1, { t: 'discard', k: 1.5 }), false);
    assert.equal(act(g, 1, { t: 'discard', k: 27 }), true);
    // 出牌階段不能打出：手牌不是 3n+2 張
    const g2 = mk({ hands: [FILL.slice(), FILL.slice(), FILL.slice(), FILL.slice()] }); assert.equal(act(g2, 0, { t: 'discard', k: 0 }), false);
    ok('mahjong: chi only from previous player, illegal actions rejected');
}

{ // 胡 > 碰槓 > 吃
    let g = mk({ hands: [P0(), CHI(), PON5(), WAIT5()] });
    assert.equal(act(g, 0, { t: 'discard', k: 4 }), true);
    assert.equal(claimOpts(g, 3).hu, true); assert.equal(claimOpts(g, 2).pon, true);
    assert.equal(act(g, 1, { t: 'claim', r: { t: 'chi', k: 3 } }), true); assert.equal(g.phase, 'claim');          // 還沒全部回應
    assert.equal(act(g, 2, { t: 'claim', r: { t: 'pon' } }), true); assert.equal(g.phase, 'claim');
    assert.equal(act(g, 3, { t: 'claim', r: { t: 'hu' } }), true);
    assert.equal(g.phase, 'over'); assert.equal(g.result.type, 'win'); assert.equal(g.result.w, 3); assert.equal(g.result.from, 0);
    assert.equal(g.result.deltas.reduce((a, b) => a + b, 0), 0); assert.ok(g.result.deltas[0] < 0 && g.result.deltas[1] === 0 && g.result.deltas[2] === 0 && g.result.deltas[3] > 0);
    // 碰 > 吃
    g = mk({ hands: [P0(), CHI(), PON5(), FILL.slice()] });
    act(g, 0, { t: 'discard', k: 4 }); act(g, 1, { t: 'claim', r: { t: 'chi', k: 3 } }); act(g, 2, { t: 'claim', r: { t: 'pon' } });
    assert.equal(g.turn, 2); assert.deepEqual(g.melds[2], [{ t: 'pon', k: 4, from: 0 }]); assert.deepEqual(g.melds[1], []); assert.equal(g.hands[2].length, 14);
    // 都過牌 → 下一家摸牌
    g = mk({ hands: [P0(), CHI(), FILL.slice(), FILL.slice()], wall: Array.from({ length: 21 }, (_, i) => 9 + (i % 18)) });
    act(g, 0, { t: 'discard', k: 4 }); act(g, 1, { t: 'claim', r: { t: 'pass' } });
    assert.equal(g.turn, 1); assert.equal(g.drawn, 9); assert.equal(g.hands[1].length, 17); assert.equal(g.draws[1], 1); assert.equal(g.rivers[0].length, 1);
    // 明槓：有 3 張 → 槓 → 從牌尾補一張
    g = mk({ hands: [P0(), FILL.slice(), H('555m1z3z5z7z1p4p7p1s4s7s9s9p8m', 16), FILL.slice()], wall: Array.from({ length: 30 }, () => 1).concat([22]) });
    act(g, 0, { t: 'discard', k: 4 }); assert.equal(claimOpts(g, 2).kan, true);
    assert.equal(act(g, 2, { t: 'claim', r: { t: 'kan' } }), true); assert.equal(g.melds[2][0].t, 'kan'); assert.equal(g.drawn, 22); assert.equal(g.afterKan, true); assert.equal(g.turn, 2); assert.equal(g.hands[2].length, 14);
    // 多人同時胡：離放槍者最近的先
    g = mk({ hands: [P0(), WAIT5(), FILL.slice(), WAIT5()] });
    act(g, 0, { t: 'discard', k: 4 }); act(g, 3, { t: 'claim', r: { t: 'hu' } }); assert.equal(g.phase, 'claim'); act(g, 1, { t: 'claim', r: { t: 'hu' } });
    assert.equal(g.result.w, 1);
    ok('mahjong: claim priority hu > pon/kan > chi');
}

{ // 流局：牌牆剩 16 張；海底 / 河底
    const g = mk({ hands: [P0(), FILL.slice(), FILL.slice(), FILL.slice()], wall: Array(16).fill(1) });
    assert.equal(act(g, 0, { t: 'discard', k: 4 }), true); assert.equal(g.phase, 'over'); assert.equal(g.result.type, 'draw');
    const g2 = mk({ hands: [P0(), FILL.slice(), FILL.slice(), FILL.slice()], wall: Array(17).fill(1) });
    act(g2, 0, { t: 'discard', k: 4 }); assert.equal(g2.phase, 'discard'); assert.equal(g2.wall.length, 16);      // 最後一張還能摸
    assert.equal(act(g2, 1, { t: 'discard', k: 1 }), true); assert.equal(g2.phase, 'over'); assert.equal(act(g2, 2, { t: 'discard', k: 0 }), false);
    // 海底撈月：最後一張自摸；河底撈魚：最後一張打出的點炮
    const w17 = () => Array(17).fill(1);
    const g3 = mk({ hands: [P0(), H('123m456m789m123p456p55s', 17).slice(0, 16), FILL.slice(), FILL.slice()], wall: w17() });
    g3.hands[1] = H('123m456m789m123p456p5s', 16); g3.wall[0] = 22;
    act(g3, 0, { t: 'discard', k: 21 }); assert.equal(g3.drawn, 22); assert.equal(g3.wall.length, 16); assert.equal(act(g3, 1, { t: 'zimo' }), true); assert.ok(has(g3.result, 'haidi'));
    const g4 = mk({ hands: [FILL.concat([4]).sort((a, b) => a - b).slice(0, 17), WAIT5(), FILL.slice(), FILL.slice()], wall: Array(16).fill(1), turn: 0 });
    act(g4, 0, { t: 'discard', k: 4 }); assert.equal(g4.phase, 'claim'); act(g4, 1, { t: 'claim', r: { t: 'hu' } }); assert.equal(g4.result.type, 'win'); assert.ok(g4.result.items.some(x => x.id === 'hedi'));
    ok('mahjong: exhaustive draw at 16 tiles, haidi, hedi');
}

{ // 自摸 / 暗槓 + 槓上開花 / 加槓 + 搶槓
    let g = mk({ turn: 0, drawn: 22, hands: [H('123m456m789m123p456p55s', 17), FILL.slice(), FILL.slice(), FILL.slice()] });
    assert.equal(canZimo(g, 0), true); assert.equal(canZimo(g, 1), false); assert.equal(act(g, 1, { t: 'zimo' }), false);
    g.drawn = -1; assert.equal(act(g, 0, { t: 'zimo' }), false); g.drawn = 22;
    assert.equal(act(g, 0, { t: 'zimo' }), true); assert.equal(g.result.type, 'win'); assert.equal(g.result.from, -1);
    assert.ok(g.result.items.some(x => x.id === 'buqiuren') && g.result.items.some(x => x.id === 'tianhu'));      // 莊家第一手、沒人吃碰
    assert.deepEqual(g.result.deltas.map(Math.sign), [1, -1, -1, -1]); assert.equal(g.result.deltas.reduce((a, b) => a + b, 0), 0);
    // 暗槓後從牌尾補到 5 條 → 槓上開花
    g = mk({ turn: 0, drawn: 22, hands: [H('5555m123p456p789p123s5s', 17), FILL.slice(), FILL.slice(), FILL.slice()], wall: Array(29).fill(2).concat([22]) });
    assert.deepEqual(selfKans(g, 0).ankan, [4]); assert.deepEqual(selfKans(g, 1).ankan, []);
    assert.equal(act(g, 1, { t: 'ankan', k: 4 }), false); assert.equal(act(g, 0, { t: 'ankan', k: 5 }), false);
    assert.equal(act(g, 0, { t: 'ankan', k: 4 }), true); assert.deepEqual(g.melds[0], [{ t: 'ankan', k: 4 }]); assert.equal(g.afterKan, true); assert.equal(g.drawn, 22); assert.equal(g.hands[0].length, 14);
    assert.equal(canZimo(g, 0), true); assert.equal(act(g, 0, { t: 'zimo' }), true); assert.ok(g.result.items.some(x => x.id === 'gangshang'));
    // 加槓：有人聽 5 萬 → 搶槓
    const mkJia = (p3) => mk({ turn: 0, drawn: 4, melds: [[{ t: 'pon', k: 4, from: 3 }], [], [], []], hands: [H('5m123p456p789p123s9s', 14), FILL.slice(), FILL.slice(), p3], wall: Array(30).fill(2) });
    g = mkJia(WAIT5()); assert.deepEqual(selfKans(g, 0).jia, [4]);
    assert.equal(act(g, 0, { t: 'jia', k: 4 }), true); assert.equal(g.phase, 'qiang'); assert.deepEqual(claimPending(g), [3]);
    assert.equal(act(g, 3, { t: 'claim', r: { t: 'chi', k: 3 } }), false);
    assert.equal(act(g, 3, { t: 'claim', r: { t: 'hu' } }), true); assert.equal(g.phase, 'over'); assert.equal(g.result.w, 3); assert.equal(g.result.from, 0); assert.ok(g.result.items.some(x => x.id === 'qianggang'));
    // 沒人搶 → 變明槓並補牌
    g = mkJia(FILL.slice()); assert.equal(act(g, 0, { t: 'jia', k: 4 }), true);
    assert.equal(g.phase, 'discard'); assert.equal(g.melds[0][0].t, 'kan'); assert.equal(g.drawn, 2); assert.equal(g.afterKan, true);
    ok('mahjong: zimo, ankan, jia-gang, qiang-gang, gang-shang');
}

{ // 補花
    const L = Array.from({ length: 136 }, (_, i) => i >> 2);                                // 非花牌 136 張
    const withFlowers = (fl) => { const w = L.slice(); fl.forEach(([pos, k]) => w.splice(pos, 0, k)); return w; };
    // 開局補花：0 號家的牌裡有 1 張花、1 號家有 2 張
    let w = withFlowers([[2, 34], [20, 35], [21, 36], [100, 37], [101, 38], [102, 39], [103, 40], [104, 41]]); assert.equal(w.length, 144);
    let g = newRound(newMatch(null), T, () => w.slice());
    assert.deepEqual(g.flowers[0], [34]); assert.deepEqual(g.flowers[1], [35, 36]);
    for (let p = 0; p < 4; p++) assert.ok(g.hands[p].every(k => k < 34)); assert.deepEqual(g.hands.map(h => h.length), [17, 16, 16, 16]);
    const total = () => g.wall.length + g.hands.reduce((s, h) => s + h.length, 0) + g.flowers.reduce((s, f) => s + f.length, 0);
    assert.equal(total(), 144);
    // 莊家摸牌摸到花：亮出再從牌尾補
    w = withFlowers([[64, 34], [100, 35], [101, 36], [102, 37], [103, 38], [104, 39], [105, 40], [106, 41]]);
    g = newRound(newMatch(null), T, () => w.slice());
    assert.deepEqual(g.flowers[0], [34]); assert.equal(g.hands[0].length, 17); assert.equal(g.drawn, 33); assert.equal(total(), 144);
    // 八仙過海：集滿 8 張花直接胡，三家付；莊家輸要加莊
    g = mk({ hands: [P0(), FILL.slice(), FILL.slice(), FILL.slice()], wall: [34].concat(Array.from({ length: 20 }, () => 5)), flowers: [[], [35, 36, 37, 38, 39, 40, 41], [], []] });
    act(g, 0, { t: 'discard', k: 4 });
    assert.equal(g.phase, 'over'); assert.equal(g.result.w, 1); assert.equal(g.result.from, -1); assert.equal(g.result.how, '八仙過海'); assert.equal(g.result.tai, 10);     // 八仙 8 + 本位花（夏 / 蘭）2
    assert.deepEqual(g.result.deltas, [-(50 + 11 * 20), 3 * 50 + 11 * 20 + 10 * 20 * 2, -(50 + 10 * 20), -(50 + 10 * 20)]);
    // 七搶一：2 號家已有 7 張花，1 號家補到第 8 張 → 2 號家胡，由 1 號家一人付
    g = mk({ hands: [P0(), FILL.slice(), FILL.slice(), FILL.slice()], wall: [41].concat(Array.from({ length: 20 }, () => 5)), flowers: [[], [], [34, 35, 36, 37, 38, 39, 40], []] });
    act(g, 0, { t: 'discard', k: 4 });
    assert.equal(g.result.w, 2); assert.equal(g.result.from, 1); assert.equal(g.result.how, '七搶一'); assert.equal(g.result.tai, 12);                                   // 七搶一 8 + 花槓 2 + 本位花（秋 / 菊）2
    assert.deepEqual(g.result.deltas, [0, -(50 + 12 * 20), 50 + 12 * 20, 0]);
    ok('mahjong: flower replacement, 8-flower win, 7-vs-1');
}

{ // 連莊 / 輪莊 / 圈數
    const win = (w) => ({ result: { type: 'win', w, deltas: [0, 1, 2, 3].map(i => i === w ? 30 : -10) } });
    const mm = newMatch({ rounds: 1 });
    nextRound(mm, win(0)); assert.equal(mm.dealer, 0); assert.equal(mm.streak, 1); assert.equal(mm.rot, 0); assert.equal(mm.scores[0], 30);
    nextRound(mm, win(2)); assert.equal(mm.dealer, 1); assert.equal(mm.streak, 0); assert.equal(mm.rot, 1);
    nextRound(mm, { result: { type: 'draw' } }); assert.equal(mm.dealer, 1); assert.equal(mm.streak, 1);
    nextRound(mm, win(3)); nextRound(mm, win(0)); assert.equal(mm.over, false); nextRound(mm, win(1)); assert.equal(mm.rot, 4); assert.equal(mm.over, true);
    const m2 = newMatch({ rounds: 2 }); for (let i = 0; i < 4; i++) nextRound(m2, win((m2.dealer + 1) & 3)); assert.equal(m2.over, false); assert.equal(m2.rot, 4);
    for (let i = 0; i < 4; i++) nextRound(m2, win((m2.dealer + 1) & 3)); assert.equal(m2.over, true);
    nextRound(mm, {}); // 沒有結果時不動
    ok('mahjong: dealer rotation, streak and round count');
}

{ // ---------- 電腦 ----------
    let g = mk({ turn: 0, drawn: 22, hands: [H('123m456m789m123p456p55s', 17), FILL.slice(), FILL.slice(), FILL.slice()] });
    assert.deepEqual(cpuAct(g, 0, 0), { t: 'zimo' }); assert.deepEqual(cpuAct(g, 0, 1), { t: 'zimo' });
    // 普通：打最孤立（沒有台的字牌）的牌，不拆面子
    g = mk({ turn: 0, drawn: 33, hands: [H('123m456m789m123p456p3z7z', 17), FILL.slice(), FILL.slice(), FILL.slice()] });
    assert.deepEqual(cpuAct(g, 0, 1), { t: 'discard', k: 29 }); assert.ok([29, 33].includes(cpuAct(g, 0, 0).k));
    // 回應：能胡就胡；簡單不吃碰；普通在向聽數下降時吃
    g = mk({ hands: [P0(), H('46m123p456p789p123s99s', 16), FILL.slice(), FILL.slice()] }); act(g, 0, { t: 'discard', k: 4 });
    assert.deepEqual(cpuClaim(g, 1, 0), { t: 'hu' }); assert.deepEqual(cpuClaim(g, 1, 1), { t: 'hu' });
    g = mk({ hands: [P0(), H('46m123p456p789p12s5z77z', 16), FILL.slice(), FILL.slice()] }); act(g, 0, { t: 'discard', k: 4 });
    assert.deepEqual(cpuClaim(g, 1, 0), { t: 'pass' }); assert.deepEqual(cpuClaim(g, 1, 1), { t: 'chi', k: 3 });
    // 搶槓：能胡就胡
    g = mk({ turn: 0, drawn: 4, melds: [[{ t: 'pon', k: 4, from: 3 }], [], [], []], hands: [H('5m123p456p789p123s9s', 14), FILL.slice(), FILL.slice(), WAIT5()], wall: Array(30).fill(2) });
    act(g, 0, { t: 'jia', k: 4 }); assert.deepEqual(cpuClaim(g, 3, 0), { t: 'hu' });
    // 完整模擬：兩種強度對打，所有動作合法、牌數守恆、每局結算總和為 0、每步 < 300ms
    let slow = 0, wins = 0, draws = 0;
    for (let i = 0; i < 16; i++) {
        const gg = newRound(newMatch({}), T), level = i % 2; let steps = 0;
        while (gg.phase !== 'over') {
            if (++steps > 2000) assert.fail('loop');
            const t0 = Date.now();
            if (gg.phase === 'discard') { const a = cpuAct(gg, gg.turn, level); assert.ok(act(gg, gg.turn, a), JSON.stringify(a)); }
            else for (const q of claimPending(gg)) { if (gg.phase === 'over' || !claimPending(gg).includes(q)) continue; const r = cpuClaim(gg, q, level); assert.ok(act(gg, q, { t: 'claim', r }), JSON.stringify(r)); }
            slow = Math.max(slow, Date.now() - t0);
            if (gg.phase === 'discard' || gg.phase === 'claim') {
                let tot = gg.wall.length; for (let p = 0; p < 4; p++) { tot += gg.hands[p].length + gg.rivers[p].length + gg.flowers[p].length; gg.melds[p].forEach(x => { tot += x.t === 'chi' || x.t === 'pon' ? 3 : 4; }); }
                assert.equal(tot, 144);
            }
        }
        if (gg.result.type === 'win') { wins++; assert.equal(gg.result.deltas.reduce((a, b) => a + b, 0), 0); } else draws++;
    }
    assert.ok(slow < 300, 'cpu step ' + slow + 'ms'); assert.equal(wins + draws, 16);
    ok('mahjong: cpu players, full simulated rounds');
}
