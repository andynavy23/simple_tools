// 批次 r4：Quoridor 步步為營（純函式）
const assert = require('assert');
const { load, ok } = require('./_load');

const L = load('mini-games/quoridor.html', 'initState, wallSet, blocked, bfs, pawnMoves, wallLegal, applyMove, validState, aiMove, cleanOpts, cleanStats, recordWin');
const { initState, wallSet, blocked, bfs, pawnMoves, wallLegal, applyMove, validState, aiMove, cleanOpts, cleanStats, recordWin } = L;
const has = (ms, r, c) => ms.some(m => m[0] === r && m[1] === c);
const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

// 初始與最短路
{
    const s = initState(2);
    assert.deepStrictEqual(s.pawns, [[8, 4], [0, 4]]); assert.deepStrictEqual(s.left, [10, 10]);
    assert.strictEqual(bfs(wallSet([]), s, 0).d, 8); assert.strictEqual(bfs(wallSet([]), s, 1).d, 8);
    const s4 = initState(4); assert.deepStrictEqual(s4.left, [5, 5, 5, 5]); assert.deepStrictEqual(s4.pawns, [[8, 4], [4, 0], [0, 4], [4, 8]]);
    assert.ok([0, 1, 2, 3].every(p => bfs(wallSet([]), s4, p).d === 8));
    ok('quoridor: 初始狀態');
}
// 牆的阻擋方向
{
    const ws = wallSet([{ o: 'h', r: 3, c: 4 }]);        // 第 3、4 列之間，欄 4、5
    assert.ok(blocked(ws, 3, 4, 1, 0) && blocked(ws, 4, 4, -1, 0) && blocked(ws, 3, 5, 1, 0));
    assert.ok(!blocked(ws, 3, 3, 1, 0) && !blocked(ws, 3, 6, 1, 0));
    const wv = wallSet([{ o: 'v', r: 2, c: 2 }]);        // 欄 2、3 之間，列 2、3
    assert.ok(blocked(wv, 2, 2, 0, 1) && blocked(wv, 3, 3, 0, -1) && !blocked(wv, 4, 2, 0, 1) && !blocked(wv, 1, 2, 0, 1));
    assert.ok(blocked(wallSet([]), 0, 0, -1, 0) && blocked(wallSet([]), 8, 8, 0, 1));
    ok('quoridor: 牆阻擋');
}
// 移動：一般 / 跳過 / 被牆擋或被占時側跳
{
    let s = initState(2); assert.strictEqual(pawnMoves(s, 0).length, 3);
    s.pawns = [[4, 4], [3, 4]];                          // 相鄰：可跳到 (2,4)
    let m = pawnMoves(s, 0); assert.ok(has(m, 2, 4) && !has(m, 3, 4) && m.length === 4);
    s.walls = [{ o: 'h', r: 2, c: 4 }];                  // 對手後方有牆：側跳 (3,3)(3,5)
    m = pawnMoves(s, 0); assert.ok(!has(m, 2, 4) && has(m, 3, 3) && has(m, 3, 5) && m.length === 5);
    s.walls = [{ o: 'h', r: 2, c: 4 }, { o: 'v', r: 3, c: 4 }];   // 右側側跳被牆擋
    m = pawnMoves(s, 0); assert.ok(has(m, 3, 3) && !has(m, 3, 5));
    s.walls = []; s.pawns = [[0, 4], [1, 4]]; m = pawnMoves(s, 0);   // 邊界：背後是盤外 → 側跳
    s.pawns = [[1, 4], [0, 4]]; s.turn = 0; m = pawnMoves(s, 0); assert.ok(has(m, 0, 3) && has(m, 0, 5) && !has(m, -1, 4));
    const s4 = initState(4); s4.pawns = [[4, 4], [3, 4], [2, 4], [4, 0]];  // 跳過後落點被第三顆棋占據 → 側跳
    m = pawnMoves(s4, 0); assert.ok(!has(m, 2, 4) && has(m, 3, 3) && has(m, 3, 5));
    ok('quoridor: 移動 / 跳躍 / 側跳');
}
// 牆合法性：重疊、交叉、範圍、封死
{
    const s = initState(2);
    s.walls = [{ o: 'h', r: 3, c: 3 }];
    assert.ok(!wallLegal(s, { o: 'h', r: 3, c: 3 }) && !wallLegal(s, { o: 'h', r: 3, c: 4 }) && !wallLegal(s, { o: 'h', r: 3, c: 2 }));
    assert.ok(!wallLegal(s, { o: 'v', r: 3, c: 3 }), '交叉');
    assert.ok(wallLegal(s, { o: 'h', r: 3, c: 5 }) && wallLegal(s, { o: 'h', r: 4, c: 3 }) && wallLegal(s, { o: 'v', r: 3, c: 4 }) && wallLegal(s, { o: 'v', r: 2, c: 3 }));
    assert.ok(!wallLegal(s, { o: 'h', r: 8, c: 0 }) && !wallLegal(s, { o: 'v', r: 0, c: 8 }) && !wallLegal(s, { o: 'x', r: 0, c: 0 }) && !wallLegal(s, { o: 'h', r: 1.5, c: 0 }) && !wallLegal(s, null));
    ok('quoridor: 牆合法性');
}
// 封死：角落兩格被 h(7,0) 蓋住後，再封 (8,1)|(8,2) 之間就完全無路
{
    const w = initState(2); w.pawns = [[8, 0], [0, 4]]; w.walls = [{ o: 'h', r: 7, c: 0 }];
    assert.ok(wallLegal(initState(2), { o: 'h', r: 7, c: 0 }));
    assert.strictEqual(wallLegal(w, { o: 'v', r: 7, c: 1 }), false, '完全封死必須被拒');
    assert.ok(wallLegal(w, { o: 'v', r: 6, c: 1 }), '沒有封死的牆仍合法');
    assert.strictEqual(applyMove(w, { t: 'm', r: 8, c: 1 }) !== null, true);
    ok('quoridor: 禁止完全封死');
}
// applyMove：回合、勝負、牆數、非法
{
    let s = initState(2);
    assert.strictEqual(applyMove(s, { t: 'm', r: 5, c: 4 }), null);           // 非相鄰
    const a = applyMove(s, { t: 'm', r: 7, c: 4 }); assert.deepStrictEqual(a.pawns[0], [7, 4]); assert.strictEqual(a.turn, 1); assert.deepStrictEqual(s.pawns[0], [8, 4]);
    const b = applyMove(a, { t: 'w', o: 'h', r: 6, c: 4 }); assert.strictEqual(b.left[1], 9); assert.strictEqual(b.walls.length, 1); assert.strictEqual(b.turn, 0);
    assert.strictEqual(applyMove(b, { t: 'w', o: 'h', r: 6, c: 4 }), null);
    assert.strictEqual(applyMove(b, { t: 'z' }), null); assert.strictEqual(applyMove(b, null), null);
    const e = initState(2); e.left[0] = 0; assert.strictEqual(applyMove(e, { t: 'w', o: 'h', r: 0, c: 0 }), null);
    const w = initState(2); w.pawns = [[1, 4], [0, 0]]; const win = applyMove(w, { t: 'm', r: 0, c: 4 }); assert.strictEqual(win.win, 0); assert.strictEqual(applyMove(win, { t: 'm', r: 0, c: 3 }), null);
    const w1 = initState(2); w1.pawns = [[8, 0], [7, 4]]; w1.turn = 1; assert.strictEqual(applyMove(w1, { t: 'm', r: 8, c: 4 }).win, 1);
    const f = initState(4); f.pawns[1] = [4, 7]; f.pawns[3] = [5, 8]; f.turn = 1; assert.strictEqual(applyMove(f, { t: 'm', r: 4, c: 8 }).win, 1);   // 左家目標第 8 欄
    const f3 = initState(4); f3.pawns[3] = [4, 1]; f3.pawns[1] = [5, 0]; f3.turn = 3; assert.strictEqual(applyMove(f3, { t: 'm', r: 4, c: 0 }).win, 3);
    ok('quoridor: applyMove / 勝負');
}
// validState
{
    const s = initState(4); assert.ok(validState(s));
    assert.ok(!validState(null) && !validState({}) && !validState({ ...s, np: 3 }) && !validState({ ...s, pawns: [[0, 0]] }) && !validState({ ...s, turn: 9 }) && !validState({ ...s, walls: [{ o: 'q', r: 0, c: 0 }] }) && !validState({ ...s, left: [1, 2, 3, 99] }) && !validState({ ...s, pawns: [[9, 0], [0, 0], [0, 0], [0, 0]] }));
    ok('quoridor: validState');
}
// 隨機對局：電腦走的每一步都合法、每位玩家永遠有路、能結束；單步 < 300ms
{
    for (const [np, lv, seed] of [[2, 'easy', 1], [2, 'normal', 2], [4, 'normal', 3], [4, 'easy', 4]]) {
        const rng = seeded(seed); let s = initState(np), maxMs = 0, n = 0;
        while (s.win < 0 && n < 400) {
            const t0 = Date.now(), m = aiMove(s, lv, rng); maxMs = Math.max(maxMs, Date.now() - t0);
            const nx = applyMove(s, m); assert.ok(nx, JSON.stringify(m));
            for (let p = 0; p < np; p++) assert.ok(bfs(wallSet(nx.walls), nx, p).d >= 0);
            s = nx; n++;
        }
        assert.ok(maxMs < 300, `${np}p ${lv} 單步 ${maxMs}ms`);
        if (lv === 'normal' && np === 2) assert.ok(s.win >= 0, '普通 vs 普通應在 400 步內分出勝負');
    }
    // 普通電腦勝過只走最短路的對手
    let wins = 0;
    for (let g = 0; g < 3; g++) {
        const rng = seeded(10 + g); let s = initState(2), n = 0;
        while (s.win < 0 && n < 300) { s = applyMove(s, aiMove(s, s.turn === 0 ? 'normal' : 'step', rng)); n++; }
        if (s.win === 0) wins++;
    }
    assert.ok(wins >= 2, `普通電腦對最短路機器人勝 ${wins}/3`);
    // 只剩一步可贏時一定走
    const w = initState(2); w.pawns = [[1, 4], [0, 0]]; const m = aiMove(w, 'normal', seeded(1)); assert.deepStrictEqual([m.t, m.r, m.c], ['m', 0, 4]);
    ok('quoridor: 電腦合法 / 效能 / 強度');
}
// 設定與戰績
{
    assert.deepStrictEqual(cleanOpts(null), { mode: 'ai', np: 2, level: 'normal', time: 0 });
    assert.deepStrictEqual(cleanOpts({ mode: 'x', np: 4, level: 'easy', time: 45 }), { mode: 'ai', np: 4, level: 'easy', time: 0 });
    assert.deepStrictEqual(cleanStats('x'), {}); assert.deepStrictEqual(cleanStats([1]), {});
    assert.deepStrictEqual(cleanStats({ '2e': { w: -1, l: 'a', best: 1e9 }, zz: { w: 1 }, '4n': null }), { '2e': { w: 0, l: 0, best: 99999 } });
    let st = recordWin({}, 2, 'normal', true, 20); st = recordWin(st, 2, 'normal', true, 15); st = recordWin(st, 2, 'normal', false, 30);
    assert.deepStrictEqual(st, { '2n': { w: 2, l: 1, best: 15 } });
    assert.ok(Object.keys(recordWin(recordWin(recordWin(recordWin({}, 2, 'easy', true, 1), 2, 'normal', true, 1), 4, 'easy', true, 1), 4, 'normal', true, 1)).length === 4);
    assert.strictEqual(recordWin({ '2e': { w: 99999, l: 0, best: 5 } }, 2, 'easy', true, 9)['2e'].w, 99999);
    ok('quoridor: 設定 / 戰績');
}
