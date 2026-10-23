// 批次 k1：單人紙牌（mini-games/solitaire.html）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const P = load('mini-games/solitaire.html', 'deal, legalMoves, apply, win, valid, hint, isStuck, autoCollect, play, undoMove, newG, msDeck, dailySeed, cleanBest, mergeBest, staleDaily, cleanGame, cleanOpt, deckFor, rank, suit, isLegal, normSeed, pFree, cp');
const cfg = [['klondike', 1], ['klondike', 3], ['freecell', 0], ['spider', 1], ['spider', 2], ['spider', 4], ['pyramid', 0], ['golf', 0]];
const lcg = (n) => { let x = n; return () => (x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296; };

// 微軟 FreeCell #1 / #617（已知牌面）
{
    const d = P.msDeck(1), nm = c => '?A23456789TJQK'[P.rank(c)] + 'SHDC'[P.suit(c)];
    assert.equal(d.slice(0, 8).map(nm).join(' '), 'JD 2D 9H JC 5D 7H 7C 5H');
    assert.equal(new Set(d).size, 52);
    ok('freecell #1');
}
// 同種子同牌局、不同種子不同
for (const [g, o] of cfg) {
    assert.deepEqual(P.deal(g, o, 77), P.deal(g, o, 77)); assert.notDeepEqual(P.deal(g, o, 77), P.deal(g, o, 78));
    assert.ok(P.valid(P.deal(g, o, 5)), g);
    assert.equal(P.dailySeed(g, o, '2026-10-22'), P.dailySeed(g, o, '2026-10-22'));
}
assert.ok(P.dailySeed('freecell', 0, '2026-10-22') <= 32000);
ok('deal');
// 隨機合法走法模擬
const N = 2000, STEPS = 150;
for (const [g, o] of cfg) {
    for (let n = 0; n < N; n++) {
        const r = lcg(n + 1), G = P.newG(g, o, n + 1);
        let prev = null;
        for (let k = 0; k < STEPS && !P.win(G.s); k++) {
            const L = P.legalMoves(G.s); if (!L.length) break;
            if (k % 7 === 0) { const h = P.hint(G.s); if (h) assert.ok(L.some(m => m.join() === h.join()), 'hint legal'); }
            const m = L[Math.floor(r() * L.length)];
            const before = P.cp(G.s);
            P.play(G, m, k % 2 === 0);
            assert.ok(P.valid(G.s), `${g}${o} seed${n + 1} step${k} ${m}`);
            if (k % 11 === 0) { const after = P.cp(G.s), mv = G.moves; assert.ok(P.undoMove(G)); assert.deepEqual(G.s, before, 'undo'); assert.equal(G.moves, mv + 1); G.s = after; }
        }
    }
    ok(`sim ${g}${o}`);
}
// 悔棋至少 50 步
{
    const G = P.newG('golf', 0, 3); let c = 0;
    for (let k = 0; k < 80 && !P.win(G.s); k++) { const L = P.legalMoves(G.s); if (!L.length) break; P.play(G, L[0], false); c++; }
    let u = 0; while (P.undoMove(G)) u++;
    assert.equal(u, c); assert.deepEqual(G.s, P.deal('golf', 0, 3)); ok('undo all');
}
// 勝負與規則細節
{
    const s = P.deal('pyramid', 0, 1); s.pyr.fill(-1); assert.ok(P.win(s));
    const s2 = P.deal('golf', 0, 1); s2.tab.forEach(p => p.length = 0); assert.ok(P.win(s2));
    const f = P.deal('klondike', 1, 1); f.found = [0, 1, 2, 3].map(k => Array.from({ length: 13 }, (_, j) => k * 13 + j)); assert.ok(P.win(f));
    // 金字塔：K 單張可移除、湊 13
    const p = P.deal('pyramid', 0, 1); p.pyr.fill(-1); p.pyr[27] = 12; p.pyr[26] = 0; p.pyr[25] = 11; p.stock = []; p.waste = [];
    assert.ok(P.legalMoves(p).some(m => m.join() === 'r,27,-1') && P.legalMoves(p).some(m => m.join() === 'r,25,26'));
    // 蜘蛛整排收走
    const sp = P.deal('spider', 1, 1); sp.tab[0] = Array.from({ length: 13 }, (_, i) => 12 - i); sp.dn[0] = 0;
    const t = P.apply(sp, ['m', 't', 1, sp.tab[1].length - 1, 't', 2]); assert.ok(t.done >= 0);
    const sp2 = P.cp(sp); sp2.tab[0] = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]; sp2.dn[0] = 0; sp2.tab[1] = [0]; sp2.dn[1] = 0;
    const r = P.apply(sp2, ['m', 't', 1, 0, 't', 0]); assert.equal(r.done, 1); assert.equal(r.tab[0].length, 0);
    ok('rules');
}
// 紀錄與存檔容錯
{
    assert.deepEqual(P.cleanBest(null), {}); assert.deepEqual(P.cleanBest([1]), {}); assert.deepEqual(P.cleanBest({ klondike1: { m: -1, t: 5 }, x: { m: 1, t: 1 }, golf: { m: 3, t: 9 } }), { golf: { m: 3, t: 9 } });
    let r = P.mergeBest({}, 'golf', 30, 100); assert.ok(r.newM && r.newT);
    r = P.mergeBest(r.best, 'golf', 40, 50); assert.ok(!r.newM && r.newT); assert.deepEqual(r.best.golf, { m: 30, t: 50 });
    assert.ok(P.staleDaily(['solit_daily_2026-01-01', 'solit_daily_2026-01-02', 'solit_daily_2026-01-03'], 2).join() === 'solit_daily_2026-01-01');
    assert.equal(P.staleDaily(Array.from({ length: 45 }, (_, i) => 'solit_daily_2026-' + String(1 + Math.floor(i / 28)).padStart(2, '0') + '-' + String(i % 28 + 1).padStart(2, '0'))).length, 15);
    const G = P.newG('freecell', 0, 9), raw = JSON.parse(JSON.stringify({ game: G.game, opt: 0, seed: 9, daily: '', s: G.s, moves: 0, t: 0, undo: [] }));
    assert.ok(P.cleanGame(raw));
    for (const bad of [null, 5, {}, { ...raw, seed: 0 }, { ...raw, moves: -1 }, { ...raw, daily: 'x' }, { ...raw, game: 'golf' }, { ...raw, s: { ...raw.s, tab: null } }, { ...raw, s: { ...raw.s, free: [0, 0, 0, 0] } }]) assert.equal(P.cleanGame(bad), null);
    const dup = JSON.parse(JSON.stringify(raw)); dup.s.tab[0][0] = dup.s.tab[1][0]; assert.equal(P.cleanGame(dup), null);
    const u = JSON.parse(JSON.stringify(raw)); u.undo = [5, null, raw.s]; assert.equal(P.cleanGame(u).undo.length, 1);
    assert.deepEqual(P.cleanOpt('x'), { auto: true, game: 'klondike', o: { klondike: 1, spider: 1 } });
    assert.equal(P.cleanOpt({ auto: false, game: 'golf', o: { klondike: 3, spider: 9 } }).o.spider, 1);
    ok('records');
}
