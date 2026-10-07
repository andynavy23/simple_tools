// 批次 a4：2048 動畫軌跡 moveTrace 必須與 move() 一致
const assert = require('assert');
const { load, ok } = require('./_load');
{
    const m = load('mini-games/game-2048.html', 'N, emptyBoard, move, moveTrace');
    const dirs = ['left', 'right', 'up', 'down'], pick = [0, 0, 0, 2, 2, 4, 8, 16, 1024, 2048];
    for (let t = 0; t < 5000; t++) {
        const b = m.emptyBoard().map(r => r.map(() => pick[Math.floor(Math.random() * pick.length)]));
        for (const d of dirs) {
            const r = m.move(b, d), tr = m.moveTrace(b, d);
            assert.deepStrictEqual(tr.board, r.board); assert.strictEqual(tr.gained, r.gained); assert.strictEqual(tr.moved, r.moved);
            assert.strictEqual(tr.moves.length, b.flat().filter(Boolean).length);                    // 每個方塊一筆
            const out = m.emptyBoard(), seen = new Set();
            tr.moves.forEach(x => {
                assert.strictEqual(b[x.from[0]][x.from[1]], x.v); seen.add(x.from.join());
                const [y, c] = x.to; out[y][c] += x.merged ? x.v : x.v;                              // 套用軌跡：合併者兩塊相加
            });
            assert.strictEqual(seen.size, tr.moves.length);
            assert.deepStrictEqual(out, r.board);
            tr.moves.filter(x => x.merged).forEach(x => assert.strictEqual(tr.moves.filter(y => y.to.join() === x.to.join()).length, 2));
        }
    }
    assert.deepStrictEqual(m.moveTrace([[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left').moves.map(x => [x.from[1], x.to[1], x.merged]), [[0, 0, true], [1, 0, true], [2, 1, false]]);
    ok('game-2048 moveTrace matches move');
}
