const { load, ok } = require('./_load');
const assert = require('assert');
const seeded = () => { const r = Util.seeded(7); return (n) => (n === undefined ? r() : Math.floor(r() * n)); };

// ---------- 四子棋 ----------
{
    const m = load('mini-games/connect-four.html', 'newGame, play, cpuChoose, undoTo, snap, hintCol, dropRow, COLS');
    const rand = seeded();
    // 模擬一局：我(1) 隨機、電腦(2) 普通；每步都存快照，驗證悔棋
    const g = m.newGame(1), H = [];
    const mv = (who, c) => { const s = m.snap(g); if (!m.play(g, who, c)) return false; H.push(s); return true; };
    while (!g.winner && !g.draw) {
        if (g.turn === 1) { let c; do c = rand(m.COLS); while (m.dropRow(g.board, c) < 0); assert(mv(1, c)); }
        else { const c = m.cpuChoose(g.board, 2, 'normal', rand); assert(m.dropRow(g.board, c) >= 0); assert(mv(2, c)); }
    }
    assert(g.winner === 2 || g.draw || g.winner === 1);
    const n = g.moves;
    // 悔棋回到「我的回合」：結局被撤銷
    const s = m.undoTo(H, 1);
    assert(s && s.turn === 1 && !s.winner && !s.draw && s.moves <= n - 1);
    assert.strictEqual(m.undoTo([], 1), null);
    assert.strictEqual(m.undoTo([{ turn: 2 }], 1), null);
    assert.strictEqual(m.undoTo([{ turn: 2 }], 0).turn, 2);
    // 提示：合法欄，且不改動棋盤；能一步贏時一定提示那一步
    const b = m.newGame(1);
    for (const c of [0, 1, 0, 1, 0, 1]) m.play(b, b.turn, c);
    const before = JSON.stringify(b.board);
    assert.strictEqual(m.hintCol(b), 0);       // 紅 0 欄已三顆，輪到紅 -> 提示 0 欄贏
    assert.strictEqual(JSON.stringify(b.board), before);
    m.play(b, 1, 0);
    assert.strictEqual(m.hintCol(b), -1);
    ok('connect-four solo: cpu legal, undo to my turn, hint wins');
}

// ---------- 黑白棋 ----------
{
    const m = load('mini-games/othello.html', 'newGame, play, cpuMove, undoTo, snap, hintMove, legalMoves, count');
    const rand = seeded();
    const g = m.newGame(), H = [];
    const mv = (who, r, c) => { const s = m.snap(g); if (!m.play(g, who, r, c)) return false; H.push(s); return true; };
    let guard = 0;
    while (!g.over && guard++ < 200) {
        if (g.turn === 1) { const ms = m.legalMoves(g.board, 1); const [r, c] = ms[rand(ms.length)]; assert(mv(1, r, c)); }
        else { const x = m.cpuMove(g.board, 2, 'normal', rand); assert(x && m.legalMoves(g.board, 2).some(([r, c]) => r === x[0] && c === x[1])); assert(mv(2, x[0], x[1])); }
    }
    assert(g.over);
    const s = m.undoTo(H, 1);
    assert(s && s.turn === 1 && !s.over);
    // 提示是合法步，且不改棋盤
    const n = m.newGame(), before = JSON.stringify(n.board);
    const h = m.hintMove(n);
    assert(m.legalMoves(n.board, 1).some(([r, c]) => r === h[0] && c === h[1]));
    assert.strictEqual(JSON.stringify(n.board), before);
    assert.strictEqual(m.hintMove({ over: true }), null);
    ok('othello solo: cpu legal, game finishes, undo, hint legal');
}

// ---------- 五子棋 ----------
{
    const m = load('mini-games/gobang.html', 'cpuGomoku, undoTo, snap, hintGomoku, gomokuWin');
    const rand = () => 0.5;
    const empty = () => Array.from({ length: 15 }, () => new Array(15).fill(null));
    // 提示：黑棋已四連（兩端空）-> 提示出五連
    const b = empty();
    for (let c = 3; c < 7; c++) b[7][c] = 'black';
    b[6][4] = 'white'; b[8][5] = 'white';
    const h = m.hintGomoku(b, 'black');
    assert(h && m.gomokuWin((b[h[0]][h[1]] = 'black', b), h[0], h[1], 'black'));
    b[h[0]][h[1]] = null;
    // 提示不改動棋盤、禁手會被避開
    const forbidAll = (r, c) => r === 7 && (c === 2 || c === 7);
    const h2 = m.hintGomoku(b, 'black', forbidAll);
    assert(h2 && !forbidAll(h2[0], h2[1]) && b[h2[0]][h2[1]] === null);
    // 模擬一段對局：人(黑)亂下、電腦(白)出的步一定在空格；悔棋回到黑的回合
    const g = empty(), H = [], seedR = Util.seeded(3);
    let turn = 'black';
    for (let i = 0; i < 40; i++) {
        H.push(m.snap({ board: g, turn }));
        let r, c;
        if (turn === 'black') { do { r = Math.floor(seedR() * 15); c = Math.floor(seedR() * 15); } while (g[r][c]); }
        else { [r, c] = m.cpuGomoku(g, 'white', 'normal', rand); assert(g[r][c] === null); }
        g[r][c] = turn;
        if (m.gomokuWin(g, r, c, turn)) break;
        turn = turn === 'black' ? 'white' : 'black';
    }
    const s = m.undoTo(H, 'black');
    assert(s && s.turn === 'black');
    assert.strictEqual(m.undoTo([{ turn: 'white' }], 'black'), null);
    assert.strictEqual(m.undoTo([{ turn: 'white' }], null).turn, 'white');
    ok('gobang solo: hint wins/avoids forbidden, cpu legal, undo to my turn');
}
