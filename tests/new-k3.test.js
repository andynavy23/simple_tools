// 批次 k3：經典益智（mini-games/classic-puzzles.html）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('mini-games/classic-puzzles.html', 'hanoiStart,hanoiMove,hanoiWon,hanoiPlan,KLEVELS,kParse,kSolve,kMove,kDirs,kWon,pegStart,pegMoves,pegApply,pegCount,pegSolve,pegGen,wPour,wWon,wSolve,wGen,qConf,qSolve,qCount,qTrace,knMoves,knTour,magicSum,magicBase,magicVariants,magicCheck,magicHint,JLEVELS,jApply,jWon,jSolve,RLEVELS,rApply,rSolve');

{ // 河內塔
    for (let n = 3; n <= 10; n++) {
        let s = m.hanoiStart(n); const pl = m.hanoiPlan(s, 2);
        assert.equal(pl.length, 2 ** n - 1);
        for (const [f, t] of pl) { s = m.hanoiMove(s, f, t); assert.ok(s); }
        assert.ok(m.hanoiWon(s));
    }
    let s = m.hanoiStart(3);
    assert.equal(m.hanoiMove(s, 1, 2), null); assert.equal(m.hanoiMove(s, 0, 0), null);
    s = m.hanoiMove(s, 0, 1); assert.equal(m.hanoiMove(s, 0, 1), null);          // 大盤不能壓小盤
    const p = m.hanoiPlan(s, 2); assert.equal(m.hanoiMove(s, ...p[0]).flat().length, 3);
    ok('hanoi: plan = 2^n-1, rules, plan from mid-state');
}
{ // 華容道
    assert.ok(m.KLEVELS.length >= 6);
    const mins = m.KLEVELS.map(l => { const ps = m.kParse(l.g); assert.equal(ps.reduce((a, p) => a + p.w * p.h, 0), 18); const sol = m.kSolve(ps); assert.ok(sol, l.name); let c = ps; for (const [i, dr, dc] of sol) { c = m.kMove(c, i, dr, dc); assert.ok(c); } assert.ok(m.kWon(c)); return sol.length; });
    assert.equal(mins[0], 116);                                                    // 橫刀立馬：一格算一步 = 116
    assert.equal(new Set(m.KLEVELS.map(l => JSON.stringify(m.kParse(l.g)))).size, m.KLEVELS.length);
    const ps = m.kParse(m.KLEVELS[0].g); assert.equal(m.kMove(ps, 0, -1, 0), null); assert.ok(m.kDirs(ps, 8).length >= 1);
    ok('klotski: all levels solvable, 橫刀立馬 = 116');
}
{ // 孔明棋
    for (const [k, n] of [['eng', 32], ['eu', 36]]) assert.equal(m.pegCount(m.pegStart(k)), n);
    const s = m.pegStart('eng'); assert.equal(m.pegMoves(s).length, 4);
    assert.equal(m.pegApply(s, 0, 1), null);
    const p = m.pegSolve(s); assert.ok(p); assert.equal(p.length, 31);
    let c = s; for (const [f, t] of p) c = m.pegApply(c, f, t); assert.equal(m.pegCount(c), 1);
    for (let i = 0; i < 5; i++) { const g = m.pegGen('eu'); const sol = m.pegSolve(g); assert.ok(sol, 'gen solvable'); }
    ok('peg solitaire: english solvable in 31, generated endgames solvable');
}
{ // 倒水排序
    let t = [[0, 1, 0, 1], [1, 0, 1, 0], []];
    assert.equal(m.wPour(t, 0, 0), null); const n1 = m.wPour(t, 0, 2); assert.deepEqual(n1[2], [1]); assert.equal(m.wPour(t, 0, 1), null);
    assert.ok(m.wWon([[1, 1, 1, 1], [], [2, 2, 2, 2]])); assert.ok(!m.wWon([[1, 1, 1], [1]]));
    for (const c of [4, 6, 8, 10]) for (let i = 0; i < 3; i++) { let g = m.wGen(c, 2); const sol = m.wSolve(g); assert.ok(sol); for (const [a, b] of sol) g = m.wPour(g, a, b); assert.ok(m.wWon(g)); }
    ok('water sort: generated puzzles solvable');
}
{ // N 皇后
    assert.equal(m.qCount(8), 92); assert.equal(m.qCount(6), 4); assert.equal(m.qCount(4), 2); assert.equal(m.qCount(12), 14200);
    for (let n = 4; n <= 12; n++) { const s = m.qSolve(n); assert.equal(s.length, n); assert.equal(m.qConf(s, n).size, 0); }
    assert.equal(m.qSolve(3), null);
    assert.equal(m.qConf([0, 1], 4).size, 2); assert.equal(m.qConf([0, 5], 4).size, 2); assert.equal(m.qConf([0, 6], 4).size, 0);
    const f = m.qSolve(8, [0]); assert.ok(f && f.includes(0));
    assert.equal(m.qSolve(4, [0]), null);
    const tr = m.qTrace(8); assert.equal(tr[tr.length - 1].length, 8); assert.equal(m.qConf(tr[tr.length - 1], 8).size, 0);
    ok('queens: counts 92/4/14200, solver, trace');
}
{ // 騎士巡邏
    assert.equal(m.knMoves(8, 0).length, 2); assert.equal(m.knMoves(8, 27).length, 8);
    for (let n = 5; n <= 8; n++) { const t = m.knTour(n, [0]); assert.equal(t.length, n * n); for (let i = 1; i < t.length; i++) assert.ok(m.knMoves(n, t[i - 1]).includes(t[i])); assert.equal(new Set(t).size, n * n); }
    ok('knight: tours from corner');
}
{ // 幻方
    for (const n of [3, 4, 5]) { const v = m.magicVariants(n); assert.ok(v.length >= 8); assert.ok(v.every(g => m.magicCheck(g, n).won)); }
    assert.equal(m.magicSum(3), 15); assert.equal(m.magicSum(5), 65);
    const g = Array(9).fill(0); assert.ok(!m.magicCheck(g, 3).won);
    const bad = m.magicBase(3).slice(); [bad[0], bad[1]] = [bad[1], bad[0]]; assert.ok(!m.magicCheck(bad, 3).won);
    const h = m.magicHint(Array(9).fill(0), 3); assert.ok(h && h.v >= 1);
    const part = Array(9).fill(0); part[4] = 5; assert.ok(m.magicHint(part, 3)); part[4] = 1; assert.equal(m.magicHint(part, 3), null);
    ok('magic square: variants valid, check, hint');
}
{ // 倒水問題
    assert.equal(m.jSolve(m.JLEVELS[0], m.JLEVELS[0].start).length, 6);
    assert.equal(m.jSolve(m.JLEVELS[3], m.JLEVELS[3].start).length, 7);
    for (const l of m.JLEVELS) { let s = l.start; const p = m.jSolve(l, s); assert.ok(p); for (const op of p) s = m.jApply(l, s, op); assert.ok(m.jWon(l, s)); }
    assert.equal(m.jApply(m.JLEVELS[3], [8, 0, 0], ['fill', 1]), null);
    assert.deepEqual(m.jApply(m.JLEVELS[0], [3, 0], ['pour', 0, 1]), [0, 3]);
    ok('jugs: min steps 6 / 7, all levels solvable');
}
{ // 過河
    const mins = m.RLEVELS.map(l => m.rSolve(l, { L: l.total.slice(), side: 0 }).length);
    assert.deepEqual(mins, [7, 11, 9]);
    const w = m.RLEVELS[0], s0 = { L: [1, 1, 1], side: 0 };
    assert.equal(m.rApply(w, s0, [1, 0, 0]), null);                               // 帶狼走，羊菜留下 → 羊吃菜
    assert.deepEqual(m.rApply(w, s0, [0, 1, 0]), { L: [1, 0, 1], side: 1 });
    assert.equal(m.rApply(w, s0, [1, 1, 0]), null);                               // 超過載重
    const mc = m.RLEVELS[1]; assert.equal(m.rApply(mc, { L: [3, 3], side: 0 }, [0, 0]), null);
    assert.ok(m.rApply(mc, { L: [3, 3], side: 0 }, [0, 2]));                       // 右岸沒有傳教士，可以
    assert.equal(m.rApply(mc, { L: [3, 3], side: 0 }, [1, 1]) !== null, true);
    assert.equal(m.rApply(mc, { L: [3, 3], side: 0 }, [2, 0]), null);              // 右岸 2 傳教士 0 食人族可以，但左岸 1 傳教士 vs 3 食人族不行
    ok('river: min 7 / 11 / 9, rules');
}
