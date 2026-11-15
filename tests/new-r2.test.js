// 批次 r2：飛行棋（mini-games/ludo.html）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('mini-games/ludo.html', 'RING, LANE, GOAL, absOf, isSafe, cellXY, cleanOpts, newGame, destOf, blocked, legalMoves, rollDice, applyMove, cpuMove, validPublic, cleanStats, addResult');
const { RING, LANE, GOAL, absOf, isSafe, cellXY, cleanOpts, newGame, destOf, blocked, legalMoves, rollDice, applyMove, cpuMove, validPublic, cleanStats, addResult } = m;

// 棋盤資料：52 格相連成環、每色通道 5 格接在主道最後一格旁
assert.equal(RING.length, 52);
RING.forEach((c, i) => { const n = RING[(i + 1) % 52]; assert.equal(Math.max(Math.abs(c[0] - n[0]), Math.abs(c[1] - n[1])), 1, '相鄰 ' + i); });
assert.equal(new Set(RING.map(c => c + '')).size, 52);
for (let c = 0; c < 4; c++) {
    const last = RING[(13 * c + 50) % 52], first = LANE[c][0];
    assert.equal(Math.abs(last[0] - first[0]) + Math.abs(last[1] - first[1]), 1);
    assert.equal(LANE[c].length, 5);
    assert.ok(cellXY(c, -1, 3).every(Number.isFinite) && cellXY(c, GOAL, 0).every(Number.isFinite));
}
assert.ok(isSafe(0) && isSafe(8) && isSafe(13) && !isSafe(5));
assert.equal(absOf(1, 0), 13); assert.equal(absOf(3, 20), 7); assert.equal(absOf(0, 51), -1); assert.equal(absOf(0, -1), -1);
ok('ludo 棋盤資料');

const mk = (o) => newGame(4, o);
{ // 起飛：需要指定點數；可選 5
    let g = mk(); assert.deepEqual(legalMoves(g, 0, 5), []); assert.deepEqual(legalMoves(g, 0, 6), [0, 1, 2, 3]);
    g = mk({ need: 5 }); assert.deepEqual(legalMoves(g, 0, 6), []); assert.equal(destOf(g, 0, 0, 5), 0);
    // 沒有合法步：自動換人；擲 6 沒有合法步仍可再擲
    g = mk(); assert.ok(rollDice(g, 0, 3)); assert.equal(g.turn, 1); assert.equal(g.roll, null);
    g = mk({ need: 5 }); rollDice(g, 0, 6); assert.equal(g.turn, 0);
    // 非法：非自己回合、已擲、點數不合
    g = mk(); assert.ok(!rollDice(g, 1, 6)); assert.ok(!rollDice(g, 0, 7)); assert.ok(!rollDice(g, 0, 2.5)); assert.ok(rollDice(g, 0, 6)); assert.ok(!rollDice(g, 0, 6));
    assert.ok(!applyMove(g, 1, 0)); assert.ok(!applyMove(g, 0, 9));
    assert.ok(applyMove(g, 0, 0)); assert.equal(g.pos[0][0], 0); assert.equal(g.turn, 0); assert.equal(g.roll, null);   // 6 再擲一次
    assert.ok(!applyMove(g, 0, 0));                                                                                       // 還沒擲
    ok('ludo 起飛與回合');
}
{ // 連續三次 6：第三次作廢，最後走的飛機回基地；關閉時不處罰
    let g = mk(); rollDice(g, 0, 6); applyMove(g, 0, 0); rollDice(g, 0, 6); applyMove(g, 0, 0);
    assert.equal(g.pos[0][0], 6); rollDice(g, 0, 6);
    assert.equal(g.pos[0][0], -1); assert.equal(g.turn, 1); assert.equal(g.sixes, 0);
    g = mk({ triple: false }); rollDice(g, 0, 6); applyMove(g, 0, 0); rollDice(g, 0, 6); applyMove(g, 0, 0); rollDice(g, 0, 6);
    assert.equal(g.roll, 6); assert.equal(g.turn, 0);
    ok('ludo 三連 6');
}
{ // 擊落、安全格、疊子
    let g = mk();
    g.pos[0][0] = 3; g.pos[1][0] = 0; g.turn = 0;                 // 綠色 rel 0 = abs 13；紅 rel 3 走到 abs 13 是安全格
    g.pos[0][0] = 10;                                             // 紅 rel 10 (abs 10) → 走 3 到 abs 13（綠起點，安全）
    rollDice(g, 0, 3); applyMove(g, 0, 0); assert.equal(g.pos[1][0], 0); assert.equal(g.caps[0], 0);
    g = mk(); g.pos[0][0] = 10; g.pos[1][0] = 1 + 0; g.pos[1][0] = 0;
    g.pos[1][1] = 51 - 51 + 0;                                    // 兩架綠都在 abs 13（安全格），沒有影響
    g = mk(); g.pos[0][0] = 20; g.pos[2][0] = 0; g.pos[2][0] = 0;                 // 黃 rel 0 = abs 26
    g.pos[0][0] = 22; g.pos[1][0] = 9;                            // 綠 rel 9 = abs 22 → 紅 rel 22 同格
    g.pos[0][0] = 20; rollDice(g, 0, 2); assert.equal(g.roll, 2); assert.ok(applyMove(g, 0, 0));
    assert.equal(g.pos[1][0], -1); assert.equal(g.caps[0], 1); assert.ok(g.log.includes('擊落'));
    // 疊子：兩架綠在 abs 22 → 紅不能停，也不能擊落
    g = mk(); g.pos[0][0] = 20; g.pos[1][0] = 9; g.pos[1][1] = 9;
    assert.ok(blocked(g, 0, 22)); assert.deepEqual(legalMoves(g, 0, 2), []);          // 其他飛機都在基地且 2 無法起飛
    assert.deepEqual(legalMoves(g, 0, 3), [0]);                                       // 越過去可以
    g.opts.stack = false; assert.ok(!blocked(g, 0, 22)); assert.deepEqual(legalMoves(g, 0, 2), [0]);
    rollDice(g, 0, 2); applyMove(g, 0, 0); assert.deepEqual([g.pos[1][0], g.pos[1][1]], [-1, -1]); assert.equal(g.caps[0], 2);
    ok('ludo 擊落 / 安全格 / 疊子');
}
{ // 終點精確點數與反彈
    let g = mk(); g.pos[0][0] = 53;
    assert.equal(destOf(g, 0, 0, 3), 56); assert.equal(destOf(g, 0, 0, 4), -1);
    g.opts.bounce = true; assert.equal(destOf(g, 0, 0, 4), 55); assert.equal(destOf(g, 0, 0, 6), 53);
    assert.equal(destOf(g, 0, 1, 6), 0);
    g.pos[0][0] = 56; assert.equal(destOf(g, 0, 0, 1), -1);
    // 終點通道不會被擊落
    g = mk(); g.pos[0][0] = 52; g.pos[1][0] = 51; rollDice(g, 0, 1); applyMove(g, 0, 0); assert.equal(g.pos[1][0], 51);
    ok('ludo 終點');
}
{ // 勝負：四架都進終點
    const g = mk(); g.pos[2] = [56, 56, 56, 55]; g.turn = 2; rollDice(g, 2, 1); assert.ok(applyMove(g, 2, 3));
    assert.equal(g.winner, 2); assert.ok(!rollDice(g, 2, 3)); assert.ok(!applyMove(g, 2, 0));
    ok('ludo 勝負');
}
{ // 兩人用對角顏色；電腦只走合法步且不會丟例外；整局能跑完
    assert.deepEqual(newGame(2).colors, [0, 2]); assert.deepEqual(newGame(3).colors, [0, 1, 2]);
    for (const lvl of [0, 1]) {
        const g = newGame(4, { need: 5 }); let steps = 0;
        while (g.winner < 0 && steps++ < 20000) {
            const p = g.turn, d = cpuMove(g, p, lvl);
            if (d.t === 'ROLL') assert.ok(rollDice(g, p, 1 + Math.floor(Math.random() * 6)));
            else { assert.ok(legalMoves(g, p).includes(d.i)); assert.ok(applyMove(g, p, d.i)); }
        }
        assert.ok(g.winner >= 0, '整局應該跑完 lvl' + lvl);
    }
    // 普通：能進終點 / 擊落時優先
    const g = mk(); g.pos[0][0] = 53; g.pos[0][1] = 10; g.roll = 3; g.turn = 0;
    assert.equal(cpuMove(g, 0, 1).i, 0);
    g.pos[0][0] = 5; g.pos[0][1] = 10; g.pos[1][0] = 25; g.pos[1][1] = 25 - 25 + 0; g.pos[1][0] = 0; g.roll = 6;       // 起飛可走（隨便）
    const h = mk(); h.pos[0][0] = 20; h.pos[0][1] = 30; h.pos[1][0] = 9; h.roll = 2; h.turn = 0;                      // 飛機 0 走 2 擊落綠（abs 22）
    assert.equal(cpuMove(h, 0, 1, () => 0.5).i, 0);
    ok('ludo 電腦');
}
{ // 設定 / 公開狀態 / 戰績驗證
    assert.deepEqual(cleanOpts(null), { need: 6, triple: true, stack: true, bounce: false, timer: 0, total: 4, lvl: 1 });
    assert.equal(cleanOpts({ need: 9, timer: 7, total: 8, lvl: 5 }).need, 6); assert.equal(cleanOpts({ timer: 30 }).timer, 30);
    const g = newGame(2); const s = { phase: 'play', names: ['a', 'b'], active: [true, true], colors: g.colors, pos: g.pos, turn: 0, roll: null, lastRoll: 0, winner: -1, caps: g.caps, opts: g.opts, log: 'x', bots: [false, true], tleft: 0 };
    assert.ok(validPublic(s));
    for (const bad of [null, { ...s, phase: 'x' }, { ...s, pos: [[0, 0, 0, 99], [0, 0, 0, 0]] }, { ...s, colors: [0, 0] }, { ...s, turn: 2 }, { ...s, roll: 7 }, { ...s, opts: { need: 4 } }, { ...s, names: ['a'], active: [true] }, { ...s, tleft: -1 }])
        assert.ok(!validPublic(bad));
    assert.ok(validPublic({ phase: 'lobby', names: ['a'], active: [true], log: '' }));
    assert.deepEqual(cleanStats('x'), { games: 0, wins: 0, caps: 0, recent: [] });
    assert.equal(cleanStats({ games: -3, wins: 'a', caps: 1.5 }).games, 0);
    let st = null; for (let i = 0; i < 30; i++) st = addResult(st, { d: '2026-11-08', n: 3, w: i % 2 === 0, c: 2 });
    assert.equal(st.games, 30); assert.equal(st.wins, 15); assert.equal(st.caps, 60); assert.equal(st.recent.length, 20);
    assert.equal(cleanStats({ recent: [{ d: 1 }, null, { d: 'a', n: 3, w: true, c: 1 }] }).recent.length, 1);
    ok('ludo 設定 / 驗證 / 戰績');
}
