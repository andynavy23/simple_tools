// 批次 k8：西洋棋 mini-games/chess.html 的純邏輯（perft、規則、FEN / SAN、搜尋、自對弈）
const assert = require('assert');
const { load, ok } = require('./_load');
const C = load('mini-games/chess.html', 'START_FEN, parseFen, toFen, perft, legalMoves, hasLegal, inCheck, sanOf, parseSan, newGame, play, gameFrom, undo, judge, insufficient, canMate, captured, pgnText, chooseMove, evaluate, make, cleanOpts, cleanStats, tally, cleanSave, stateGame, fmtClock, nameSq, sqName, cur, hashOf, posKey');
const { START_FEN, parseFen, toFen, perft, legalMoves, newGame, play, gameFrom, undo, insufficient, canMate, captured, pgnText, chooseMove, parseSan, sanOf, cur, nameSq, hashOf } = C;
const P = (f) => { const p = parseFen(f); assert.ok(p, f); return p; };
const mv = (g, s) => { const m = parseSan(cur(g), s); assert.ok(m >= 0, 'SAN ' + s); assert.ok(play(g, m)); };

{ // perft：公認數字
    const T = [
        [START_FEN, [20, 400, 8902, 197281]],
        ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
        ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
        ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
        ['r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1', [6, 264, 9467]],
        ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
        ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]],
    ];
    for (const [fen, ns] of T) { const p = P(fen); ns.forEach((n, i) => assert.strictEqual(perft(p, i + 1), n, fen + ' d' + (i + 1))); }
    ok('chess perft');
}
{ // FEN 往返與驗證、雜湊一致
    for (const f of [START_FEN, 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2']) assert.strictEqual(toFen(P(f)), f);
    for (const bad of ['', 'x', '8/8/8/8/8/8/8/8 w - - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1', '4k3/8/8/8/8/8/8/4K3 x - - 0 1', 'P3k3/8/8/8/8/8/8/4K3 w - - 0 1', '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1', null, 5]) assert.strictEqual(parseFen(bad), null, String(bad));
    assert.strictEqual(P('4k3/8/8/8/8/8/8/R3K2R w KQkq - 0 1').c, 3);           // 黑方沒有車：只留白方權利
    const g = newGame(); for (const s of ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Bg5', 'e6', 'Be2', 'Be7', 'O-O']) mv(g, s);
    const p = cur(g); assert.strictEqual(p.h, hashOf(p));
    ok('chess FEN');
}
{ // 特殊規則
    let g = newGame();
    for (const s of ['f3', 'e5', 'g4', 'Qh4#']) mv(g, s);
    assert.deepStrictEqual(g.res, { r: '0-1', why: 'mate' });
    g = newGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); assert.strictEqual(g.res.why, 'stalemate');
    assert.ok(parseSan(P('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'O-O') >= 0);
    assert.strictEqual(parseSan(P('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1'), 'O-O'), -1);             // 經過 f1 被攻擊
    assert.strictEqual(parseSan(P('r3k2r/8/8/8/8/4r3/8/R3K2R w KQkq - 0 1'), 'O-O'), -1);             // 被將軍
    assert.ok(parseSan(P('r3k2r/8/8/8/8/1r6/8/R3K2R w KQkq - 0 1'), 'O-O-O') >= 0);                   // b 線被攻擊不影響長易位
    assert.strictEqual(parseSan(P('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1'), 'O-O'), -1);                  // 無權利
    g = newGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); ['Rb1', 'Rb8', 'Ra1', 'Ra8'].forEach(s => mv(g, s));
    assert.strictEqual(parseSan(cur(g), 'O-O-O'), -1); assert.ok(parseSan(cur(g), 'O-O') >= 0);        // 車動過後長易位失權
    g = newGame('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1'); mv(g, 'e4'); assert.strictEqual(sanOf(cur(g), parseSan(cur(g), 'dxe3')), 'dxe3');
    g = newGame('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1'); ['e4', 'Kd7', 'Kd2', 'Ke6'].forEach(s => mv(g, s)); assert.strictEqual(parseSan(cur(g), 'dxe3'), -1);   // 過路兵只有緊接著那一步
    g = newGame('8/P6k/8/8/8/8/8/K7 w - - 0 1'); assert.strictEqual(legalMoves(cur(g)).filter(m => (m >> 12)).length, 4); mv(g, 'a8=N'); assert.strictEqual(cur(g).b[0], 2);
    assert.ok(parseSan(P('8/P6k/8/8/8/8/8/K7 w - - 0 1'), 'a7a8q') >= 0);
    assert.strictEqual(legalMoves(P('4k3/8/8/8/8/8/4q3/4K3 w - - 0 1')).length, 1);                 // 王吃后
    assert.ok(!legalMoves(P('4k3/4r3/8/8/8/8/4N3/4K3 w - - 0 1')).some(m => (m & 63) === nameSq('e2')));   // 被釘住的馬不能動
    ok('chess rules');
}
{ // 和棋
    let g = newGame('4k3/8/8/8/8/8/8/4K3 w - - 0 1'); assert.strictEqual(g.res.why, 'material');
    assert.ok(insufficient(P('4k3/8/8/8/8/8/8/3BK3 w - - 0 1').b)); assert.ok(insufficient(P('4k3/8/8/8/8/8/8/3NK3 w - - 0 1').b));
    assert.ok(insufficient(P('2b1k3/8/8/8/8/8/8/3BK3 w - - 0 1').b));                 // c8 與 d1 同色格
    assert.ok(!insufficient(P('3bk3/8/8/8/8/8/8/3BK3 w - - 0 1').b));                // d8 深色 vs d1 淺色
    assert.ok(!insufficient(P('4k3/8/8/8/8/8/8/2NNK3 w - - 0 1').b));
    assert.ok(!insufficient(P('4k3/p7/8/8/8/8/8/4K3 w - - 0 1').b));
    assert.ok(canMate(P('4k3/8/8/8/8/8/8/2NNK3 w - - 0 1').b, 1)); assert.ok(!canMate(P('4k3/8/8/8/8/8/8/3BK3 w - - 0 1').b, 1));
    g = newGame('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    for (let i = 0; i < 2; i++) for (const s of ['Ra2', 'Kd8', 'Ra1', 'Ke8']) { assert.ok(!g.res); mv(g, s); }
    assert.deepStrictEqual(g.res, { r: '1/2-1/2', why: 'repeat' });
    g = newGame('4k3/8/8/8/8/8/8/R3K3 w - - 98 80'); mv(g, 'Ra2'); assert.ok(!g.res); mv(g, 'Kd8'); assert.strictEqual(g.res.why, 'fifty');
    g = newGame('6k1/5ppp/8/8/8/8/8/R3K3 w - - 99 60'); mv(g, 'Ra8#'); assert.strictEqual(g.res.why, 'mate');   // 第 100 步剛好將死：以將死為準
    ok('chess draws');
}
{ // SAN：往返、消歧、符號；悔棋；被吃子；PGN
    const g = newGame(), rnd = (n) => Math.floor(Math.random() * n);
    for (let i = 0; i < 80 && !g.res; i++) { const l = legalMoves(cur(g)); play(g, l[rnd(l.length)]); }
    const g2 = newGame(); g.sans.forEach(s => mv(g2, s)); assert.deepStrictEqual(g2.ms, g.ms);
    let p = P('7k/8/8/8/8/8/8/R3R1K1 w - - 0 1'); assert.strictEqual(sanOf(p, parseSan(p, 'Rad1')), 'Rad1'); assert.strictEqual(parseSan(p, 'Rd1'), -1);
    p = P('4k3/8/8/8/R7/8/8/R3K3 w - - 0 1'); assert.strictEqual(sanOf(p, parseSan(p, 'R4a2')), 'R4a2');
    p = P('6k1/8/8/8/8/8/8/R3K2R w KQ - 0 1'); assert.strictEqual(sanOf(p, parseSan(p, '0-0')), 'O-O'); assert.strictEqual(sanOf(p, parseSan(p, 'Ra8')), 'Ra8+');
    assert.strictEqual(parseSan(p, 'Zz9'), -1); assert.strictEqual(parseSan(p, null), -1);
    const h = newGame(); ['e4', 'e5', 'Nf3', 'Nc6'].forEach(s => mv(h, s));
    assert.ok(undo(h, 1)); assert.strictEqual(h.ms.length, 2); assert.strictEqual(h.keys.length, 3);
    assert.ok(undo(h, 0)); assert.strictEqual(h.ms.length, 1); assert.ok(!undo(newGame(), 0)); assert.ok(!undo(newGame(), 1));
    const c = newGame(); ['e4', 'd5', 'exd5', 'Qxd5'].forEach(s => mv(c, s)); const cp = captured(c); assert.deepStrictEqual(cp[1], [1]); assert.deepStrictEqual(cp[-1], [1]); assert.strictEqual(cp.diff, 0);
    const e = newGame('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'); mv(e, 'exd6'); assert.deepStrictEqual(captured(e)[1], [1]);
    const t = pgnText(c, { white: 'A', black: 'B' }); assert.ok(t.includes('[White "A"]') && t.includes('1. e4 d5 2. exd5 Qxd5 *') && !t.includes('SetUp'));
    const f = newGame('4k3/8/8/8/8/8/8/R3K3 b - - 0 7'); mv(f, 'Kd8'); assert.ok(pgnText(f).includes('7... Kd8') && pgnText(f).includes('[FEN '));
    ok('chess SAN');
}
{ // 搜尋
    const best = (fen, lvl = 'hard', ms = 400) => { const p = P(fen); return sanOf(p, chooseMove(p, [], lvl, ms)); };
    assert.strictEqual(best('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'), 'Ra8#');
    assert.strictEqual(best('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1'), 'Qxf7#');
    assert.ok(/^Rx[ad]8/.test(best('r3k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'normal')));
    assert.strictEqual(chooseMove(newGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').ps[0], [], 'hard'), -1);
    for (const lv of ['easy', 'normal', 'hard']) { const p = P(START_FEN); assert.ok(legalMoves(p).includes(chooseMove(p, [], lv, 100))); }
    let g = newGame('8/8/8/5k2/8/8/8/Q3K3 w - - 0 1'), n = 0;
    while (!g.res && n++ < 60) play(g, chooseMove(cur(g), g.ps.map(x => x.h), cur(g).t === 1 ? 'hard' : 'easy', 80));
    assert.strictEqual(g.res && g.res.why, 'mate', 'KQ vs K 應在 60 步內將死');
    const t0 = Date.now(); chooseMove(P('r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10'), [], 'hard'); assert.ok(Date.now() - t0 < 1500, 'hard 每步 ≤ ~1 秒：' + (Date.now() - t0));
    ok('chess search');
}
{ // 隨機自對弈 300 局：每步合法、能終局（含步數上限）
    let ended = 0, plies = 0;
    for (let i = 0; i < 300; i++) {
        const g = newGame();
        while (!g.res) { const l = legalMoves(cur(g)); const m = l[Math.floor(Math.random() * l.length)]; assert.ok(play(g, m)); }
        ended++; plies += g.ms.length;
        if (i < 30) { const r = gameFrom(g.fen, g.ms); assert.ok(r && r.res.why === g.res.why); }
    }
    assert.strictEqual(ended, 300); ok('chess 隨機自對弈 300 局（平均 ' + Math.round(plies / 300) + ' 步）');
}
{ // 強度：困難 vs 簡單 30 局（困難每步 40ms 以縮短測試；160 步未分勝負以子力評估裁定）
    let w = 0, l = 0, d = 0;
    for (let i = 0; i < 30; i++) {
        const g = newGame(), hardSide = i % 2 ? -1 : 1;
        while (!g.res && g.ms.length < 160) { const p = cur(g); play(g, chooseMove(p, g.ps.map(x => x.h), p.t === hardSide ? 'hard' : 'easy', 40)); }
        let r;
        if (g.res) r = g.res.r === '1/2-1/2' ? 'D' : (g.res.r === '1-0') === (hardSide === 1) ? 'H' : 'E';
        else { const e = C.evaluate(cur(g)) * cur(g).t * hardSide; r = e > 300 ? 'H' : e < -300 ? 'E' : 'D'; }
        if (r === 'H') w++; else if (r === 'E') l++; else d++;
    }
    console.log(`  困難 vs 簡單 30 局：困難勝 ${w}、和 ${d}、負 ${l}`);
    assert.ok(w >= 24 && l <= 1, `勝率不夠高 ${w}/${d}/${l}`); ok('chess 強度');
}
{ // 存檔 / 統計 / 連線驗證
    assert.deepStrictEqual(C.cleanOpts(null), { level: 'normal', side: 'w', drag: false }); assert.strictEqual(C.cleanOpts({ level: 'x', side: 'b', drag: 1 }).side, 'b');
    const s = C.cleanStats({ easy: [1, -2, 'a'], hard: 5, net: [1e9, 2, 3.5], bad: 1 }); assert.deepStrictEqual(s.easy, [1, 0, 0]); assert.deepStrictEqual(s.hard, [0, 0, 0]); assert.strictEqual(s.net[0], 99999); assert.ok(!('bad' in s));
    C.tally(s, 'normal', 'w'); C.tally(s, 'normal', 'd'); C.tally(s, 'zzz', 'l'); assert.deepStrictEqual(s.normal, [1, 0, 1]);
    const g = newGame(); ['e4', 'e5'].forEach(x => mv(g, x));
    assert.ok(C.cleanSave({ v: 1, mode: 'cpu', level: 'hard', me: -1, fen: g.fen, moves: g.ms }).g.ms.length === 2);
    for (const bad of [null, 5, { v: 2 }, { v: 1, mode: 'cpu', fen: g.fen, moves: [1, 2, 3] }, { v: 1, mode: 'x', fen: g.fen, moves: [] }, { v: 1, mode: 'cpu', fen: 'zz', moves: [] }, { v: 1, mode: 'cpu', fen: g.fen, moves: 'x' }]) assert.strictEqual(C.cleanSave(bad), null);
    assert.ok(C.stateGame({ fen: g.fen, moves: g.ms, res: { r: '1-0', why: 'resign' } }).res.why === 'resign');
    assert.strictEqual(C.stateGame({ fen: g.fen, moves: g.ms, res: { r: 'x', why: 'resign' } }).res, null);
    assert.strictEqual(C.stateGame({ fen: g.fen, moves: [g.ms[0], 5] }), null); assert.strictEqual(C.stateGame(null), null);
    assert.strictEqual(C.fmtClock(65000), '1:05'); assert.strictEqual(C.fmtClock(-5), '0:00');
    ok('chess 驗證');
}
