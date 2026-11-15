// v5：踩地雷每日日期（UTC+8）、終極井字棋困難強度與單步時間、方塊 / 貪吃蛇難度與動畫純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

{ // 踩地雷：每日挑戰的今天用台灣時間
    const m = load('mini-games/minesweeper.html', 'taipeiDay');
    assert.equal(m.taipeiDay(Date.UTC(2026, 0, 1, 15, 59, 59)), '2026-01-01');   // UTC 15:59 = 台灣 23:59
    assert.equal(m.taipeiDay(Date.UTC(2026, 0, 1, 16, 0, 0)), '2026-01-02');     // UTC 16:00 = 台灣隔天 00:00
    assert.equal(m.taipeiDay(Date.UTC(2026, 11, 31, 20, 0, 0)), '2027-01-01');
    ok('minesweeper taipeiDay');
}

{ // 終極井字棋：困難（深度 4）單步 < 300ms，且 30 局明顯贏過普通
    const m = load('mini-games/ultimate-ttt.html', 'newGame, play, legalMoves, cpuMove');
    let s = 7; const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    let worst = 0, win = 0, lose = 0;
    for (let i = 0; i < 30; i++) {
        const hs = 1 + (i % 2), g = m.newGame(hs);
        while (!g.winner && !g.draw) {
            const hard = g.turn === hs, t = process.hrtime.bigint();
            const mv = m.cpuMove(g, hard ? 'hard' : 'normal', r);
            if (hard) worst = Math.max(worst, Number(process.hrtime.bigint() - t) / 1e6);
            m.play(g, g.turn, mv[0], mv[1]);
        }
        if (g.winner === hs) win++; else if (g.winner) lose++;
    }
    assert.ok(worst < 300, `最長單步 ${worst.toFixed(0)}ms`);
    assert.ok(win >= lose + 10, `hard ${win} 勝 / ${lose} 負`);
    ok(`ultimate-ttt hard depth 4: worst ${worst.toFixed(0)}ms, ${win}W ${lose}L vs normal`);
}

{ // 方塊：難度速度、設定驗證、舊紀錄鍵、消行重疊判斷
    const m = load('mini-games/tetris.html', 'dropMs, cleanOpts, bestKeyOf, fxOverlap, newBoard, SPEEDS');
    assert.equal(m.dropMs(1), 800); assert.equal(m.dropMs(1, 'slow'), 1000); assert.equal(m.dropMs(1, 'fast'), 500); assert.equal(m.dropMs(1, 'x'), 800);
    for (const d of ['slow', 'normal', 'fast']) { assert.ok(m.dropMs(3, d) < m.dropMs(2, d)); assert.ok(m.dropMs(99, d) === m.SPEEDS[d][2]); }
    assert.ok(m.dropMs(1, 'slow') > m.dropMs(1) && m.dropMs(1) > m.dropMs(1, 'fast'));
    for (const bad of [null, 5, 'x', [], { diff: 'zzz' }, { diff: null }, { diff: '__proto__' }]) assert.equal(m.cleanOpts(bad).diff, 'normal');
    assert.equal(m.cleanOpts({ diff: 'fast' }).diff, 'fast');
    assert.equal(m.bestKeyOf('normal'), 'tetris_best'); assert.equal(m.bestKeyOf('fast'), 'tetris_best_fast'); assert.equal(m.bestKeyOf('zz'), 'tetris_best');
    const b = m.newBoard(); b[5][3] = 'T'; const shift = new Array(20).fill(0); shift[5] = 3;
    assert.ok(m.fxOverlap(b, shift, [[3, 2]], 0));            // 落下前，該列畫在第 2 列 → 重疊
    assert.ok(!m.fxOverlap(b, shift, [[3, 2]], 1));           // 落下完成，在第 5 列 → 不重疊
    assert.ok(!m.fxOverlap(b, shift, [[4, 2]], 0));           // 不同欄不重疊
    ok('tetris difficulty / fxOverlap');
}

{ // 貪吃蛇：速度檔位、設定驗證、舊紀錄鍵視為普通
    const m = load('mini-games/snake.html', 'tickMs, cleanOpts, bestKeyOf');
    assert.equal(m.tickMs(0), 150); assert.equal(m.tickMs(0, 'slow'), 220); assert.equal(m.tickMs(0, 'fast'), 100); assert.equal(m.tickMs(1000, 'fast'), 45); assert.equal(m.tickMs(0, 'x'), 150);
    assert.deepStrictEqual(m.cleanOpts({ wall: 'wrap', speed: 'fast' }), { wall: 'wrap', speed: 'fast' });
    for (const bad of [null, 1, 'a', { wall: 1, speed: '__proto__' }]) assert.deepStrictEqual(m.cleanOpts(bad), { wall: 'solid', speed: 'normal' });
    assert.equal(m.bestKeyOf('solid', 'normal'), 'snake_best_solid'); assert.equal(m.bestKeyOf('wrap', 'slow'), 'snake_best_wrap_slow');
    ok('snake speed / opts');
}
