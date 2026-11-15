// 批次 r1：mini-games/chinese-checkers.html 純邏輯（星盤、起始配置、單步 / 連跳、路徑驗證、勝負、電腦、清理）
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('mini-games/chinese-checkers.html', 'CK, CK_ZONES, ckNew, ckMoves, ckValidPath, ckAllMoves, ckWon, ckPlay, ckPick, ckEnc, ckDec, ckTarget, ckDistSum, cleanOpts, cleanStats, CK_CAP');
const { CK } = m;

// 星盤：121 格、六個區各 10 格、中央 61 格、鄰接對稱
assert.strictEqual(CK.N, 121);
for (let z = 0; z < 6; z++) assert.strictEqual(CK.zc[z].length, 10, 'zone ' + z);
assert.strictEqual(CK.zone.filter(z => z < 0).length, 61);
CK.nb.forEach((l, i) => l.forEach((j, d) => { if (j >= 0) assert.strictEqual(CK.nb[j][(d + 3) % 6], i); }));
// 各人數起始：每人 10 顆、各在自己的區、其餘全空
for (const n of [2, 3, 4, 6]) {
    const G = m.ckNew(n);
    assert.strictEqual(G.board.filter(v => v >= 0).length, n * 10, n + ' 人棋子數');
    for (let s = 0; s < n; s++) assert.ok(CK.zc[m.CK_ZONES[n][s]].every(i => G.board[i] === s));
    // 對角是別人（或空）的起始區，目標不重疊
    assert.strictEqual(new Set(m.CK_ZONES[n].map((_, s) => m.ckTarget(n, s))).size, n);
    assert.ok(!m.ckWon(G.board, n, 0));
}
// 單步 / 連跳：直線三顆 a b c，a 跳過 b 到空格
{
    const G = m.ckNew(2), b = G.board, from = CK.zc[0][0];       // 頂點格
    const mv = m.ckMoves(b, from);
    assert.strictEqual(mv.size, 0, '頂點被自己人包住，無處可走');
    // 前排棋子有單步
    const front = CK.zc[0].filter(i => CK.nb[i].some(j => j >= 0 && b[j] === -1));
    assert.ok(front.length > 0 && front.every(i => m.ckMoves(b, i).size > 0));
}
{
    // 自訂：清空盤面，在中央放移動者 + 兩顆棋子做連跳 A→B→C
    const b = new Array(CK.N).fill(-1), id = (q, r) => CK.cells.findIndex(c => c[0] === q && c[1] === r);
    b[id(0, 0)] = 0; b[id(1, 0)] = 1; b[id(2, 1)] = 1;     // 向右跳（→ (2,0)），再從 (2,0) 往 (1,-1)... 實際用方向 [1,0] 與 [0,1]
    const mv = m.ckMoves(b, id(0, 0));
    assert.ok(mv.has(id(2, 0)), '跳過 (1,0)');
    assert.deepStrictEqual(mv.get(id(2, 0)), [id(2, 0)]);
    assert.ok(mv.has(id(2, 2)), '從 (2,0) 再跳過 (2,1) 到 (2,2)：連跳');
    assert.deepStrictEqual(mv.get(id(2, 2)), [id(2, 0), id(2, 2)]);
    assert.ok(mv.has(id(0, 1)) && mv.has(id(-1, 0)), '單步');
    assert.ok(!mv.has(id(1, 0)), '不能走到有棋子的格');
    assert.ok(m.ckValidPath(b, id(0, 0), [id(2, 0), id(2, 2)]));
    assert.ok(m.ckValidPath(b, id(0, 0), [id(2, 0)]));
    assert.ok(m.ckValidPath(b, id(0, 0), [id(0, 1)]));
    assert.ok(!m.ckValidPath(b, id(0, 0), [id(2, 2)]), '不能略過中間落點');
    assert.ok(!m.ckValidPath(b, id(0, 0), [id(1, 0)]), '落在棋子上');
    assert.ok(!m.ckValidPath(b, id(0, 0), [id(0, 1), id(0, 2)]), '單步後不能再走');
    assert.ok(!m.ckValidPath(b, id(0, 0), [id(2, 0), id(2, 0)]), '重複落點');
    assert.ok(!m.ckValidPath(b, id(1, 1), [id(1, 2)]), '空格不能當起點');
    assert.ok(!m.ckValidPath(b, id(0, 0), []) && !m.ckValidPath(b, id(0, 0), 'x') && !m.ckValidPath(b, id(0, 0), [999]) && !m.ckValidPath(b, id(0, 0), [1.5]) && !m.ckValidPath(b, -1, [1]));
    // 兩顆都是 BFS 結果與驗證一致（抽樣）
    mv.forEach((p) => assert.ok(m.ckValidPath(b, id(0, 0), p)));
}
// 隨機對局：所有 BFS 路徑都通過驗證，走到結束（電腦互打，回合上限內分出結果）
{
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (const n of [2, 3]) {
        const G = m.ckNew(n); let steps = 0;
        while (G.winner === -1 && steps++ < 800) {
            const s = G.turn, mv = m.ckPick(G.board, n, s, steps % 2 ? 'easy' : 'normal', rnd);
            assert.ok(mv, '有棋可走');
            assert.ok(m.ckValidPath(G.board, mv.from, mv.path));
            if (steps % 25 === 0) m.ckAllMoves(G.board, s).slice(0, 30).forEach(x => assert.ok(m.ckValidPath(G.board, x.from, x.path)));
            assert.ok(m.ckPlay(G, mv.from, mv.path));
            assert.strictEqual(G.board.filter(v => v === s).length, 10, '棋子數不變');
        }
        assert.ok(G.winner >= 0, n + ' 人局有結果');
    }
}
// 勝負：目標區全滿且至少一顆是自己的；全被別人占滿則不算；非法 / 非輪到者被拒
{
    const G = m.ckNew(2), b = G.board;
    assert.ok(!m.ckWon(b, 2, 0));
    CK.zc[3].forEach((i, k) => { b[i] = 0; });
    assert.ok(m.ckWon(b, 2, 0));
    b[CK.zc[3][0]] = 1; assert.ok(m.ckWon(b, 2, 0), '混有對手棋子但已填滿且有自己的');
    CK.zc[3].forEach(i => { b[i] = 1; }); assert.ok(!m.ckWon(b, 2, 0));
    const H = m.ckNew(2), mv = m.ckAllMoves(H.board, 0)[0];
    assert.ok(!m.ckPlay(H, CK.zc[3][0], [1]), '不能動別人的棋子');
    assert.ok(m.ckPlay(H, mv.from, mv.path) && H.turn === 1);
    assert.ok(!m.ckPlay(H, mv.from, mv.path), '起點已空');
    // 勝利：差一步補滿
    const W = m.ckNew(2); W.board.fill(-1); const tz = CK.zc[3];
    tz.slice(1).forEach(i => { W.board[i] = 0; }); W.board[CK.zc[0][0]] = 1;
    const last = CK.nb[tz[0]].find(j => j >= 0 && W.board[j] === -1 && !tz.includes(j));
    W.board[last] = 0; assert.ok(m.ckPlay(W, last, [tz[0]]) && W.winner === 0 && W.why === 'win');
    assert.ok(!m.ckPlay(W, CK.zc[0][0], [CK.nb[CK.zc[0][0]].find(j => j >= 0)]), '結束後不能再走');
}
// 編碼 / 清理
{
    const G = m.ckNew(4);
    assert.deepStrictEqual(m.ckDec(m.ckEnc(G.board), 4), G.board);
    assert.strictEqual(m.ckDec(m.ckEnc(G.board), 2), null);
    assert.strictEqual(m.ckDec('abc', 4), null); assert.strictEqual(m.ckDec(null, 4), null);
    assert.deepStrictEqual(m.cleanOpts(null), { n: 2, level: 'normal', confirm: false, tmax: 0 });
    assert.deepStrictEqual(m.cleanOpts({ n: 5, level: 'x', confirm: 'y', tmax: 20 }), { n: 2, level: 'normal', confirm: false, tmax: 0 });
    assert.deepStrictEqual(m.cleanOpts({ n: 6, level: 'easy', confirm: true, tmax: 30 }), { n: 6, level: 'easy', confirm: true, tmax: 30 });
    const s = m.cleanStats({ s2: [1, 2, 3], s3: 'x', n2: [-1, 1e9, 99999.5], n6: [1], zzz: 1 });
    assert.deepStrictEqual(s.s2, [1, 2, 3]); assert.deepStrictEqual(s.s3, [0, 0, 0]); assert.deepStrictEqual(s.n2, [0, 0, 0]); assert.deepStrictEqual(s.n6, [1, 0, 0]);
    assert.ok(!('zzz' in s)); assert.deepStrictEqual(m.cleanStats([]).s2, [0, 0, 0]);
}
ok('new-r1 chinese-checkers');
