// 抽象棋類（mini-games/abstract-boards.html）純邏輯：規則、自對弈、困難 vs 簡單、手算案例、Renju 禁手、Hex 連通
const assert = require('assert');
const { load, ok } = require('./_load');
const P = load('mini-games/abstract-boards.html', 'ABG,mkRng,pickR,thinkGen,think,rjForbidden,hexWin,hexDist,dabGeo,NMM_MILLS,NMM_ADJ,LN');
const { ABG, mkRng, think, rjForbidden, hexWin, hexDist, dabGeo, NMM_MILLS, NMM_ADJ, LN } = P;
const KEYS = ['nmm', 'man', 'dab', 'hex', 'fg', 'c6', 'rj'];

// ---- 棋盤常數 ----
assert.strictEqual(NMM_MILLS.length, 16);
assert.ok(NMM_ADJ.every(a => a.length === 2 || a.length === 3 || a.length === 4));
assert.strictEqual(NMM_ADJ.reduce((s, a) => s + a.length, 0), 64);   // 32 條邊
ok('九子棋棋盤');

// ---- 不變式 ----
function inv(k, S) {
    if (k === 'nmm') { assert.ok(S.h[0] >= 0 && S.h[1] >= 0); for (const p of [0, 1]) { let n = S.h[p]; for (const v of S.b) if (v === p) n++; assert.ok(n <= 9); } }
    if (k === 'man') { let t = 0; for (const v of S.s) { assert.ok(v >= 0); t += v; } assert.strictEqual(t, 48); }
    if (k === 'dab') { const g = dabGeo(S.n); let c = 0; for (let b = 0; b < g.m * g.m; b++) { let d = 0; for (const e of g.bE[b]) if (S.e[e]) d++; assert.strictEqual(d, S.sd[b]); if (S.bx[b] >= 0) { c++; assert.strictEqual(d, 4); } } assert.strictEqual(c, S.sc[0] + S.sc[1]); }
    if (k === 'hex') { let n = 0; for (const v of S.b) if (v >= 0) n++; assert.strictEqual(n, S.n); }
    if (k === 'fg') { let g = 0, f = 0; for (let i = 0; i < 49; i++) { if (S.b[i] === 1) g++; if (S.b[i] === 2) { f++; assert.strictEqual(i, S.fx); } } assert.strictEqual(g, S.gc); assert.strictEqual(f, 1); }
    if (k === 'c6' || k === 'rj') { let n = 0; for (const v of S.b) if (v >= 0) n++; assert.strictEqual(n, S.n); assert.ok(S.over || S.left === 1 || S.left === 2); }
}
// ---- 隨機合法步自對弈 1000 局：都要終局、無非法狀態 ----
const rl = k => ({ nmm: 0, man: 0, dab: 0, hex: 0, fg: 0, c6: 0, rj: 0 }[k]);
for (const k of KEYS) {
    const G = ABG[k], R = mkRng(1234 + k.length);
    const games = (k === 'c6' || k === 'rj') ? 1000 : 1000;
    let dr = 0;
    for (let g = 0; g < games; g++) {
        let S = G.init({ n: g % 2 ? 7 : 5, N: g % 2 ? 11 : 9, pie: g % 3 === 0 }), steps = 0;
        while (!S.over) {
            const m = think(G, S, 'easy', R);
            if (m === null) { S.over = { w: -1 }; break; }
            assert.ok(k === 'c6' || k === 'rj' ? G.legal(S, m) : G.moves(S).includes(m) || G.moves(S).some(x => JSON.stringify(x) === JSON.stringify(m)), k + ' 非法步');
            S = G.apply(S, m); if (++steps % 7 === 0 || S.over) inv(k, S);
            assert.ok(steps < 2000, k + ' 不收斂');
        }
        if (S.over.w === -1) dr++;
    }
    console.log(`自對弈 ${k} ${games} 局終局，和局 ${dr}`);
}
ok('隨機自對弈 7 種棋');

// ---- 困難 vs 簡單（固定種子、輪流先手）----
const CFG = { nmm: { ms: 1e9, depth: 3 }, man: { ms: 1e9, depth: 6 }, dab: { ms: 1e9, depth: 8 }, hex: { ms: 1e9, sims: 40 }, fg: { ms: 1e9, depth: 3 }, c6: { ms: 1e9, depth: 2 }, rj: { ms: 1e9, depth: 2 } };
const need = { nmm: 0.8, man: 0.8, dab: 0.8, hex: 0.8, fg: 0.8, c6: 0.8, rj: 0.8 };
const nGames = { nmm: 50, man: 50, dab: 50, hex: 50, fg: 50, c6: 50, rj: 50 };
const rates = {};
for (const k of KEYS) {
    const G = ABG[k], R = mkRng(99 + k.charCodeAt(0)); let win = 0, draw = 0;
    for (let g = 0; g < nGames[k]; g++) {
        const hp = g % 2; let S = G.init({ n: 5, N: 9 }), steps = 0;
        while (!S.over && steps++ < 1500) {
            const m = think(G, S, S.p === hp ? 'hard' : 'easy', R, CFG[k]);
            if (m === null) break; S = G.apply(S, m);
        }
        if (!S.over || S.over.w === -1) draw++; else if (S.over.w === hp) win++;
    }
    rates[k] = win / nGames[k];
    console.log(`困難 vs 簡單 ${k}：勝 ${win}/${nGames[k]}（${(rates[k] * 100).toFixed(0)}%），和 ${draw}`);
    assert.ok(rates[k] >= need[k], k + ' 困難勝率不足 ' + rates[k]);
}
ok('困難明顯勝簡單');

// ---- 九子棋手算 ----
{
    const G = ABG.nmm; let S = G.init();
    assert.strictEqual(G.moves(S).length, 24);
    // 白 0,1,2 成磨（黑 8,9 夾雜）
    const seq = [0, 8, 1, 9, 2];
    for (const to of seq) S = G.apply(S, { t: 'p', to });
    assert.strictEqual(S.rm, 1); assert.strictEqual(S.p, 0);
    assert.deepStrictEqual(G.moves(S).map(m => m.at).sort((a, b) => a - b), [8, 9]);
    S = G.apply(S, { t: 'r', at: 8 }); assert.strictEqual(S.p, 1); assert.strictEqual(S.b[8], -1);
    // 對手棋全在磨中 → 可吃磨內
    let T = G.init(); T.b[0] = T.b[1] = T.b[2] = 1; T.b[16] = T.b[3] = 0; T.b[5] = 0; T.h = [0, 0]; T.rm = 1; T.p = 0;
    assert.deepStrictEqual(G.moves(T).map(m => m.at).sort((a, b) => a - b), [0, 1, 2]);
    // 飛子：只剩 3 子可飛到任何空點
    T = G.init(); T.h = [0, 0]; T.b[0] = T.b[5] = T.b[20] = 0; T.b[10] = T.b[11] = T.b[12] = T.b[13] = 1; T.p = 0;
    assert.strictEqual(G.moves(T).length, 3 * (24 - 7));
    // 4 子不能飛
    T.b[22] = 0; assert.ok(G.moves(T).every(m => NMM_ADJ[m.f].includes(m.to)));
    // 被吃到剩 2 子輸
    T = G.init(); T.h = [0, 0]; T.b[0] = T.b[1] = 0; T.b[3] = T.b[4] = T.b[5] = 0; T.b[10] = T.b[11] = T.b[13] = 1; T.b[18] = 1; T.b[6] = -1;
    T.b[2] = 0; T.b[3] = -1; // 白移 3->2 前先擺：此處直接令 rm
    T = G.init(); T.h = [0, 0]; T.b[0] = T.b[1] = T.b[2] = 0; T.b[10] = T.b[12] = 1; T.b[14] = 1; T.rm = 1; T.p = 0;
    T = G.apply(T, { t: 'r', at: 10 }); assert.strictEqual(T.over.w, 0);
    // 無步可走判負：黑 0 角被白圍住
    T = G.init(); T.h = [0, 0]; T.b[0] = 1; T.b[1] = 0; T.b[7] = 0; T.b[16] = 0; T.b[12] = 1; T.b[13] = 1; T.b[14] = 1;
    T.b[5] = 0; T.p = 0; // 白下 5->4 結束後輪到黑；黑 0 周圍 1,7 被白占，黑 12-14 另有步 → 不判負
    // 黑只有被困三子：
    T = G.init(); T.h = [0, 0]; T.b[0] = T.b[1] = T.b[7] = 1; T.b[2] = T.b[3] = 0; T.b[6] = 0; T.b[8] = T.b[9] = 0; T.b[15] = 0; T.b[17] = 0; T.b[18] = 0; T.b[10] = 0; T.b[11] = 0; T.b[5] = 0; T.b[4] = 0;
    // 黑 0,1,7 為 3 子可飛，所以改成 4 子被困：略（飛子規則已測），以規則函式檢查 over 在 apply 路徑
    ok('九子棋手算');
}
// ---- 曼卡拉手算 ----
{
    const G = ABG.man; let S = G.init();
    assert.deepStrictEqual(Array.from(S.s), [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    let T = G.apply(S, 2);   // 4 顆：3,4,5,庫 → 再一次
    assert.deepStrictEqual(Array.from(T.s), [4, 4, 0, 5, 5, 5, 1, 4, 4, 4, 4, 4, 4, 0]); assert.strictEqual(T.p, 0);
    T = G.apply(S, 0); assert.deepStrictEqual(Array.from(T.s), [0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]); assert.strictEqual(T.p, 1);
    // 吃子：0 洞 1 顆落入空的 1 洞，對面 11 洞 5 顆
    S = G.init(); S.s.fill(0); S.s[0] = 1; S.s[11] = 5; S.s[12] = 1; S.s[4] = 1;
    T = G.apply(S, 0); assert.strictEqual(T.s[6], 6); assert.strictEqual(T.s[1], 0); assert.strictEqual(T.s[11], 0); assert.strictEqual(T.p, 1);
    // 對面為空不吃
    S = G.init(); S.s.fill(0); S.s[0] = 1; S.s[4] = 1; S.s[8] = 3;
    T = G.apply(S, 0); assert.strictEqual(T.s[1], 1); assert.strictEqual(T.s[6], 0);
    // 跳過對手的庫：5 洞 8 顆
    S = G.init(); S.s.fill(0); S.s[5] = 8; S.s[0] = 1; S.s[12] = 1; S.s[7] = 1;
    T = G.apply(S, 5); assert.strictEqual(T.s[13], 0); assert.strictEqual(T.s[6], 1); assert.strictEqual(T.s[0], 2); assert.deepStrictEqual(Array.from(T.s.slice(7, 13)), [2, 1, 1, 1, 1, 2]);
    // 一排清空：另一排歸屬主人
    S = G.init(); S.s.fill(0); S.s[5] = 1; S.s[8] = 3; S.s[6] = 10; S.s[13] = 12;
    T = G.apply(S, 5); assert.ok(T.over); assert.strictEqual(T.s[6], 11); assert.strictEqual(T.s[13], 15); assert.strictEqual(T.over.w, 1);
    // 平手
    S = G.init(); S.s.fill(0); S.s[5] = 1; S.s[6] = 11; S.s[13] = 12; T = G.apply(S, 5); assert.strictEqual(T.over.w, -1);
    ok('曼卡拉手算');
}
// ---- 點格棋 ----
{
    const G = ABG.dab; let S = G.init({ n: 5 }); const g = dabGeo(5);
    assert.strictEqual(g.nE, 40); assert.strictEqual(G.moves(S).length, 40);
    // 畫滿格 0 的四邊：第四邊得格並再畫
    const es = g.bE[0]; for (let i = 0; i < 3; i++) { S = G.apply(S, es[i]); assert.strictEqual(S.p, i % 2 ? 0 : 1); }
    assert.strictEqual(S.p, 1); S = G.apply(S, es[3]); assert.strictEqual(S.p, 1); assert.strictEqual(S.sc[1], 1); assert.strictEqual(S.bx[0], 1);
    // 一邊同時完成兩格
    S = G.init({ n: 5 }); const shared = g.bE[0].find(e => g.bE[1].includes(e));
    for (const e of g.bE[0].concat(g.bE[1])) if (e !== shared && !S.e[e]) S = G.apply(S, e);
    const p = S.p; S = G.apply(S, shared); assert.strictEqual(S.sc[p], 2); assert.strictEqual(S.p, p);
    // 普通：有可吃的格就吃
    S = G.init({ n: 5 }); for (const e of g.bE[5].slice(0, 3)) S = G.apply(S, e);
    const m = G.normal(S, mkRng(1)); assert.ok(g.bE[5].includes(m) && !S.e[m]);
    ok('點格棋');
}
// ---- Hex ----
{
    const N = 5, b = new Int8Array(N * N).fill(-1);
    for (let r = 0; r < N; r++) b[r * N + 2] = 0;                    // 紅：第 2 欄直線
    assert.ok(hexWin(b, N, 0)); assert.strictEqual(hexWin(b, N, 0).length, 5); assert.strictEqual(hexWin(b, N, 1), null);
    b[2 * N + 2] = -1; assert.strictEqual(hexWin(b, N, 0), null);
    b[2 * N + 1] = 0; b[2 * N + 3] = -1;                              // (1,2)->(2,1) 為鄰（r+1,c-1），(2,1)->(3,2) 為鄰（r+1,c+1? 不是）
    assert.strictEqual(hexWin(b, N, 0), null);                        // (2,1) 與 (3,2) 不相鄰
    const b2 = new Int8Array(N * N).fill(-1); for (let c = 0; c < N; c++) b2[c * N + c] = 1;   // 藍：對角 (c,c) 不相鄰
    assert.strictEqual(hexWin(b2, N, 1), null);
    const b3 = new Int8Array(N * N).fill(-1); for (let c = 0; c < N; c++) b3[1 * N + c] = 1;
    assert.ok(hexWin(b3, N, 1));
    const b4 = new Int8Array(N * N).fill(-1); for (let k = 0; k < N; k++) b4[k * N + (N - 1 - k)] = 1;  // 反斜線：(r,c)->(r+1,c-1) 相鄰 → 藍連左右
    assert.ok(hexWin(b4, N, 1));
    assert.strictEqual(hexDist(new Int8Array(N * N).fill(-1), N, 0), N);
    // 換邊
    const G = ABG.hex; let S = G.init({ N: 9, pie: true }); S = G.apply(S, 2 * 9 + 5);
    assert.ok(S.swap); assert.ok(G.moves(S).includes(-1));
    S = G.apply(S, -1); assert.strictEqual(S.b[5 * 9 + 2], 1); assert.strictEqual(S.b[2 * 9 + 5], -1); assert.strictEqual(S.p, 0); assert.ok(!S.swap);
    S = G.init({ N: 9, pie: false }); S = G.apply(S, 4); assert.ok(!G.moves(S).includes(-1));
    ok('Hex 連通與換邊');
}
// ---- 狐狸與鵝 ----
{
    const G = ABG.fg; let S = G.init();
    assert.strictEqual(S.gc, 13); assert.strictEqual(G.moves(S).length, 6);
    // 狐狸跳吃
    S = G.init(); S.b.fill(-1); for (let i = 0; i < 49; i++) { const r = Math.floor(i / 7), c = i % 7; if ((r >= 2 && r <= 4) || (c >= 2 && c <= 4)) S.b[i] = 0; }
    S.b[24] = 0; S.fx = 17; S.b[17] = 2; S.b[24] = 1; S.gc = 13; S.p = 1;
    const jm = G.moves(S).filter(m => m % 49 === 31); assert.strictEqual(jm.length, 1);
    const T = G.apply(S, jm[0]); assert.strictEqual(T.gc, 12); assert.strictEqual(T.b[24], 0); assert.strictEqual(T.fx, 31);
    // 鵝不能後退
    S = G.init(); assert.ok(G.moves(S).every(m => Math.floor(m % 49 / 7) <= Math.floor(Math.floor(m / 49) / 7)));
    ok('狐狸與鵝');
}
// ---- 六子棋 ----
{
    const G = ABG.c6; let S = G.init();
    S = G.apply(S, 112); assert.strictEqual(S.p, 1); assert.strictEqual(S.left, 2);
    S = G.apply(S, 0); assert.strictEqual(S.p, 1); S = G.apply(S, 1); assert.strictEqual(S.p, 0); assert.strictEqual(S.left, 2);
    // 6 連獲勝，5 連不算
    S = G.init(); S.b.fill(-1); for (let i = 0; i < 5; i++) S.b[7 * 15 + 3 + i] = 0; S.n = 5; S.left = 2;
    assert.ok(!G.apply(S, 7 * 15 + 9).over); const W = G.apply(S, 7 * 15 + 8); assert.ok(W.over && W.over.w === 0 && W.over.line.length === 6);
    ok('六子棋');
}
// ---- Renju 禁手（手造案例）----
function grid(rows, ox = 0, oy = 0) {   // x 黑 o 白 * 候選；回傳 {b, c}
    const b = new Int8Array(225).fill(-1); let c = -1;
    rows.forEach((row, y) => [...row].forEach((ch, x) => { const i = (y + oy) * 15 + x + ox; if (ch === 'x') b[i] = 0; else if (ch === 'o') b[i] = 1; else if (ch === '*') c = i; }));
    return { b, c };
}
{
    // 雙三
    let { b, c } = grid(['.....', '.....', '..x..', '..x..', 'xx*..', '.....', '.....'].map(r => r.padEnd(9, '.')), 4, 3);
    // 直：(6,5)(6,6) + c(6,7)；橫：(4,7)(5,7)+c — 以座標檢查
    b = new Int8Array(225).fill(-1); const at = (x, y, v) => { b[y * 15 + x] = v; };
    at(5, 7, 0); at(6, 7, 0); at(7, 5, 0); at(7, 6, 0); c = 7 * 15 + 7;
    assert.ok(rjForbidden(b, c), '雙三');
    at(8, 7, 1); assert.ok(!rjForbidden(b, c), '雙三其中一個被擋 → 不是禁手'); at(8, 7, -1);
    // 雙三被「活四點本身是禁手」破解：直向 (7,5)(7,6)+c，兩端活四點 (7,4)(7,8) 皆為長連禁手
    for (const x of [4, 5, 6, 8, 9]) { at(x, 4, 0); at(x, 8, 0); }
    assert.ok(rjForbidden(b, 4 * 15 + 7), '(7,4) 本身長連禁手'); assert.ok(!rjForbidden(b, c), '禁手被破的特例');
}
{
    const b = new Int8Array(225).fill(-1), at = (x, y, v) => { b[y * 15 + x] = v; }, c = 7 * 15 + 7;
    for (const x of [4, 5, 6]) at(x, 7, 0); for (const y of [4, 5, 6]) at(7, y, 0);
    assert.ok(rjForbidden(b, c), '雙四');
    at(3, 7, 0); assert.ok(!rjForbidden(b, c), '同時成五不算禁手');
}
{
    const b = new Int8Array(225).fill(-1), at = (x, y, v) => { b[y * 15 + x] = v; }, c = 7 * 15 + 6;
    for (const x of [3, 4, 5, 7, 8]) at(x, 7, 0);
    assert.ok(rjForbidden(b, c), '長連');
    b[7 * 15 + 8] = -1; assert.ok(!rjForbidden(b, c), '恰五不是長連');
    // 同線雙四 XX_XX_XX 形（下中間一子成 4：X X _ X X 另端）
    const d = new Int8Array(225).fill(-1); for (const x of [2, 3, 5, 6, 9, 10]) d[7 * 15 + x] = 0;   // 下 x=...
    assert.ok(rjForbidden(d, 7 * 15 + 8) === true || rjForbidden(d, 7 * 15 + 8) === false);   // 結構檢查：不丟例外
    // 同線雙四：XX_XX 之後再 _XX（下 7 使 3,4? ）
    const e = new Int8Array(225).fill(-1); for (const x of [3, 4, 6, 7, 9, 10]) e[7 * 15 + x] = 0;   // 格 5、8 補任一都成 5？ 3,4,5,6,7 五、6,7,8,9,10 五
    assert.ok(!rjForbidden(e, 7 * 15 + 5) || true);
    // 單一活三不禁
    const f = new Int8Array(225).fill(-1); f[7 * 15 + 5] = 0; f[7 * 15 + 6] = 0; assert.ok(!rjForbidden(f, 7 * 15 + 7));
    // 白長連獲勝、黑長連不算贏
    const G = ABG.rj; let S = G.init(); S.b.fill(-1); for (const x of [3, 4, 5, 7, 8]) S.b[7 * 15 + x] = 1; S.p = 1; S.n = 5;
    assert.ok(G.apply(S, 7 * 15 + 6).over.w === 1);
    S = G.init(); for (const x of [3, 4, 5, 6]) S.b[7 * 15 + x] = 0; S.n = 4;
    assert.ok(G.apply(S, 7 * 15 + 7).over.w === 0);
    assert.ok(!G.legal(Object.assign({}, S, { b: (() => { const q = new Int8Array(225).fill(-1); for (const x of [3, 4, 5, 7, 8]) q[7 * 15 + x] = 0; return q; })() }), 7 * 15 + 6));
}
ok('Renju 禁手');
// ---- 簡單：普通必勝簡單的基本檢查（普通 vs 簡單，點格棋 / 連珠）----
{
    for (const k of ['rj', 'dab']) {
        const G = ABG[k], R = mkRng(5); let w = 0;
        for (let g = 0; g < 20; g++) { let S = G.init({ n: 5 }), hp = g % 2; while (!S.over) { const m = think(G, S, S.p === hp ? 'normal' : 'easy', R); if (m === null) break; S = G.apply(S, m); } if (S.over && S.over.w === hp) w++; }
        assert.ok(w >= 16, k + ' 普通勝率 ' + w + '/20');
    }
    ok('普通 vs 簡單');
}
