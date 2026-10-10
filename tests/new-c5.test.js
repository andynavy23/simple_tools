// 批次 c5：四個遊戲的動畫純計算
const assert = require('assert');
const { load, ok } = require('./_load');
{
    const m = load('mini-games/othello.html', 'N, newBoard, newGame, play, legalMoves, animPlan, DROP_MS, FLIP_MS, FLIP_STEP');
    for (let g = 0; g < 50; g++) {
        const s = m.newGame();
        while (!s.over) {
            const prev = s.board.map(r => r.slice()), mv = m.legalMoves(s.board, s.turn), [r, c] = mv[Math.floor(Math.random() * mv.length)];
            m.play(s, s.turn, r, c);
            const p = m.animPlan(prev, s.board, s.last);
            assert.deepStrictEqual(p.drop, [r, c]);
            const changed = [];
            for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (prev[i][j] && prev[i][j] !== s.board[i][j]) changed.push(i * 8 + j);
            assert.deepStrictEqual(p.flips.map(f => f.r * 8 + f.c).sort((a, b) => a - b), changed);
            p.flips.forEach(f => { assert.ok(f.delay >= m.DROP_MS - 30); assert.ok(f.delay + m.FLIP_MS <= p.total); });
        }
    }
    const b = m.newBoard(), s = m.newGame(); m.play(s, 1, 2, 3);                                  // 黑下 D3，翻 D4（距離 1）
    const p = m.animPlan(b, s.board, s.last);
    assert.deepStrictEqual(p.flips.map(f => f.delay), [m.DROP_MS - 30]);
    assert.strictEqual(m.animPlan(s.board, b, s.last), null);                                      // 悔棋（子變少）
    assert.strictEqual(m.animPlan(null, s.board, s.last), null);
    assert.strictEqual(m.animPlan(b, s.board, null), null);
    // 距離越遠延遲越大（40ms 階梯）
    const line = m.newBoard().map(r => r.map(() => 0)); line[0] = [1, 2, 2, 2, 0, 0, 0, 0];
    const after = line.map(r => r.slice()); after[0] = [1, 1, 1, 1, 1, 0, 0, 0];
    const q = m.animPlan(line, after, [0, 4]);
    assert.deepStrictEqual(q.flips.map(f => f.delay), [m.DROP_MS - 30 + 2 * m.FLIP_STEP, m.DROP_MS - 30 + m.FLIP_STEP, m.DROP_MS - 30]);
    ok('othello animPlan');
}
{
    const m = load('mini-games/connect-four.html', 'ROWS, COLS, newBoard, newGame, play, dropRow, dropPlan, dropMs, DROP_MAX');
    const s = m.newGame(1), b0 = s.board.map(r => r.slice());
    m.play(s, 1, 3);
    const p = m.dropPlan(b0, s.board);
    assert.deepStrictEqual([p.r, p.c, p.dist], [5, 3, 6]); assert.strictEqual(p.ms, m.dropMs(6));
    assert.ok(m.dropMs(1) < m.dropMs(6)); assert.ok(m.dropMs(99) === m.DROP_MAX); assert.ok(m.dropMs(6) <= m.DROP_MAX);
    assert.strictEqual(m.dropPlan(s.board, b0), null); assert.strictEqual(m.dropPlan(null, b0), null);
    const g = m.newGame(1); let prev = g.board.map(r => r.slice());
    for (let i = 0; i < 30 && !g.winner && !g.draw; i++) {                                         // 隨機對局：每步剛好是 dropRow 預測的格子
        const cols = [...Array(7).keys()].filter(c => m.dropRow(g.board, c) >= 0), c = cols[(i * 5) % cols.length], r = m.dropRow(g.board, c);
        m.play(g, g.turn, c); const q = m.dropPlan(prev, g.board);
        assert.deepStrictEqual([q.r, q.c], [r, c]); prev = g.board.map(r => r.slice());
    }
    ok('connect-four dropPlan');
}
{
    const m = load('mini-games/tetris.html', 'W, H, newBoard, spawn, cellsOf, lock, clearPlan, FX_FLASH, FX_FALL');
    for (let t = 0; t < 400; t++) {
        const b = m.newBoard();
        for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) b[y][x] = (y > 8 && Math.random() < .85) ? 'T' : 0;
        const p = { type: ['I', 'O', 'T', 'S', 'Z', 'J', 'L'][t % 7], rot: t % 4, x: Math.floor(Math.random() * 7), y: 14 + (t % 4) };
        if (!m.cellsOf(p).every(([x, y]) => x >= 0 && x < m.W && y < m.H && (y < 0 || !b[y][x]))) continue;
        const l = m.lock(b, p), c = m.clearPlan(b, p);
        assert.strictEqual(c.rows.length, l.cleared); assert.strictEqual(c.total, m.FX_FLASH + m.FX_FALL);
        for (let y = l.cleared; y < m.H; y++) {                                                    // 每個新列 = 舊列內容，且 y - shift 就是舊列索引
            const o = y - c.shift[y]; assert.ok(!c.rows.includes(o)); assert.deepStrictEqual(l.board[y], c.before[o]);
        }
        for (let y = 0; y < l.cleared; y++) assert.strictEqual(c.shift[y], 0);
    }
    const b = m.newBoard(); for (let y = 16; y < 20; y++) for (let x = 0; x < 10; x++) b[y][x] = x < 9 ? 'T' : 0;
    const c = m.clearPlan(b, { type: 'I', rot: 1, x: 7, y: 16 });                                  // 直 I 插進最右欄：一次 4 行
    assert.deepStrictEqual(c.rows, [16, 17, 18, 19]); assert.strictEqual(c.tetris, true);
    ok('tetris clearPlan');
}
{
    const m = load('mini-games/snake.html', 'SIZE, step, lerpSnake');
    const snake = [[5, 5], [4, 5], [3, 5]], st = { snake, dir: [1, 0], food: [10, 10], score: 0, dead: false, won: false }, n = m.step(st, 'solid', () => 0);
    const l0 = m.lerpSnake(snake, n.snake, 0), l1 = m.lerpSnake(snake, n.snake, 1), lh = m.lerpSnake(snake, n.snake, .5);
    assert.deepStrictEqual(l0.map(([x, y]) => [x, y]), snake); assert.deepStrictEqual(l1.map(([x, y]) => [x, y]), n.snake);
    assert.deepStrictEqual(lh[0], [5.5, 5, 0]); assert.deepStrictEqual(lh[2], [3.5, 5, 2]);          // 蛇頭與蛇尾都在中間
    const eat = m.step({ ...st, food: [6, 5] }, 'solid', () => 0), le = m.lerpSnake(snake, eat.snake, .5);
    assert.strictEqual(le.length, 4); assert.deepStrictEqual(le[3], [3, 5, 3]);                       // 長大時新尾節原地不動
    // 穿牆：沒有橫跨盤面的線段，且每節的兩份座標相距剛好一個盤面
    const ws = { snake: [[19, 3], [18, 3], [17, 3]], dir: [1, 0], food: [0, 0], score: 0, dead: false, won: false }, wn = m.step(ws, 'wrap', () => 0);
    assert.deepStrictEqual(wn.snake[0], [0, 3]);
    for (let k = 0; k <= 10; k++) {
        const pts = m.lerpSnake(ws.snake, wn.snake, k / 10);
        for (const [x] of pts) assert.ok(x >= -1 && x <= m.SIZE, 'x ' + x);
        const head = pts.filter(q => q[2] === 0);
        if (k > 0 && k < 10) assert.strictEqual(head.length, 2);
        if (head.length === 2) assert.ok(Math.abs(head[0][0] - head[1][0]) === m.SIZE);
        assert.ok(pts.every(([x, y]) => y === 3));
        const body = pts.filter(q => q[2] === 1); assert.ok(body.every(([x]) => Math.abs(x - 19) <= 1.0001 || Math.abs(x - 18) <= 1.0001));
    }
    ok('snake lerpSnake');
}
