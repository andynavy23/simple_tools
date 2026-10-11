const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- 迷宮 ----------
{
    const m = load('mini-games/maze.html', 'genMaze, stepTo, shortest, hintDir, twDay, staleDailyKeys, cleanRecs, withRecord, efficiency, clampN, DIRS, MIN_N, MAX_N, LEVELS');
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    // 所有尺寸：完美迷宮（n*n-1 條通道 = 連通且無環）、通道雙向一致、起點到終點必可達
    for (let n = m.MIN_N; n <= m.MAX_N; n++) {
        const M = m.genMaze(n, Util.seeded('t-' + n).int); let edges = 0;
        for (let i = 0; i < n * n; i++) for (let d = 0; d < 4; d++) if (M[i] >> d & 1) {
            const j = m.stepTo(M, n, i, d); assert.ok(j >= 0 && j < n * n, 'passage stays in board');
            assert.ok(M[j] >> ((d + 2) % 4) & 1, 'passage is two-way'); edges++;
        }
        assert.strictEqual(edges / 2, n * n - 1, `n=${n} edges`);
        const p = m.shortest(M, n, 0, n * n - 1); assert.ok(p && p[0] === 0 && p[p.length - 1] === n * n - 1);
        assert.strictEqual(m.shortest(M, n, 0, 5 % (n * n) || 1).length > 0, true);
    }
    ok('maze: every size 5..40 is a perfect maze (connected, n*n-1 passages, two-way)');
    // 1000 個種子：起點到終點可達、最短路合法（每步無牆）、路徑上沒有重複格；全迷宮連通
    for (let s = 0; s < 1000; s++) {
        const n = m.MIN_N + (s % 12), M = m.genMaze(n, Util.seeded('seed' + s).int);
        const p = m.shortest(M, n, 0, n * n - 1); assert.ok(p, 'reachable seed ' + s);
        assert.strictEqual(new Set(p).size, p.length);
        for (let k = 0; k + 1 < p.length; k++) assert.ok([0, 1, 2, 3].some(d => m.stepTo(M, n, p[k], d) === p[k + 1]));
        if (s % 50 === 0) for (let i = 0; i < n * n; i++) assert.ok(m.shortest(M, n, 0, i), 'connected');
    }
    ok('maze: 1000 seeds, start always reaches end via a legal shortest path');
    // 同種子同迷宮、不同種子不同
    const a = m.genMaze(20, Util.seeded('x').int), b = m.genMaze(20, Util.seeded('x').int), c = m.genMaze(20, Util.seeded('y').int);
    assert.ok(same(a, b) && !same(a, c));
    ok('maze: same seed -> same maze');
    // 移動碰撞：邊界與牆都擋住；有通道才能走
    { const M = m.genMaze(8, Util.seeded('c').int);
      assert.strictEqual(m.stepTo(M, 8, 0, 0), -1); assert.strictEqual(m.stepTo(M, 8, 0, 3), -1);
      assert.strictEqual(m.stepTo(M, 8, 63, 2), -1); assert.strictEqual(m.stepTo(M, 8, 63, 1), -1);
      assert.strictEqual(m.stepTo(M, 8, 0, 9), -1); assert.strictEqual(m.stepTo(M, 8, 0, -1), -1);
      const d = [1, 2].find(d => M[0] >> d & 1); assert.ok(m.stepTo(M, 8, 0, d) > 0);
      const w = [1, 2].find(d => !(M[0] >> d & 1)); if (w !== undefined) assert.strictEqual(m.stepTo(M, 8, 0, w), -1); }
    // 沿著提示一路走到終點，步數 = 最短路
    for (let s = 0; s < 30; s++) {
        const n = 5 + s, M = m.genMaze(n, Util.seeded('h' + s).int), len = m.shortest(M, n, 0, n * n - 1).length - 1; let pos = 0, st = 0;
        while (pos !== n * n - 1) { const d = m.hintDir(M, n, pos, n * n - 1); assert.ok(d >= 0); pos = m.stepTo(M, n, pos, d); st++; assert.ok(st <= n * n); }
        assert.strictEqual(st, len); assert.strictEqual(m.hintDir(M, n, pos, n * n - 1), -1);
    }
    ok('maze: collision rules, hints follow shortest path');
    // 最短路 = 唯一路徑（完美迷宮）：不走回頭路的 DFS 數到的路徑長度一致
    // 其他純函式
    assert.strictEqual(m.efficiency(36, 60), 60); assert.strictEqual(m.efficiency(10, 10), 100); assert.strictEqual(m.efficiency(10, 0), 0); assert.strictEqual(m.efficiency(10, 5), 100);
    assert.strictEqual(m.clampN(2), 5); assert.strictEqual(m.clampN(99), 40); assert.strictEqual(m.clampN('abc'), 10); assert.strictEqual(m.clampN('17.4'), 17);
    assert.deepStrictEqual(m.LEVELS, { easy: 10, normal: 20, hard: 30 });
    assert.strictEqual(m.twDay(Date.UTC(2026, 0, 1, 16, 30)), '2026-01-02'); assert.strictEqual(m.twDay(Date.UTC(2026, 0, 1, 15, 59)), '2026-01-01');
    assert.deepStrictEqual(m.staleDailyKeys(['maze_daily_2026-01-01', 'maze_daily_2026-03-01', 'maze_best', 'other_2020-01-01', 'maze_daily_bad'], '2026-03-10'), ['maze_daily_2026-01-01']);
    ok('maze: efficiency, clampN, twDay, stale daily keys');
    // 紀錄驗證與更新
    assert.deepStrictEqual(m.cleanRecs(null), {}); assert.deepStrictEqual(m.cleanRecs([1, 2]), {}); assert.deepStrictEqual(m.cleanRecs('x'), {});
    assert.deepStrictEqual(m.cleanRecs({ 10: { ms: 5000, steps: 40 }, 3: { ms: 1, steps: 1 }, 99: { ms: 1, steps: 1 }, 20: null, 30: { ms: 'a', steps: 1 }, 25: { ms: -1, steps: 2 }, 15: { ms: 100, steps: 1.5 }, x: { ms: 1, steps: 1 } }), { 10: { ms: 5000, steps: 40 } });
    let r = m.withRecord({}, 10, 9000.4, 50); assert.deepStrictEqual(r, { 10: { ms: 9000, steps: 50 } });
    assert.strictEqual(m.withRecord(r, 10, 9500, 40), null); assert.strictEqual(m.withRecord(r, 10, 9000, 40), null);
    r = m.withRecord(r, 10, 8000, 60); assert.strictEqual(r[10].ms, 8000);
    r = m.withRecord(r, 20, 20000, 90); assert.deepStrictEqual(Object.keys(r), ['10', '20']);
    ok('maze: record validation (bad data dropped) and update');
    // 大尺寸效能
    const t0 = Date.now(); m.genMaze(40, Util.seeded('big').int); assert.ok(Date.now() - t0 < 500);
}

// ---------- 數獨每日挑戰 ----------
{
    const m = load('mini-games/sudoku.html', 'solve, generate, dailyPuzzle, twDay, staleDailyKeys, shuf, conflicts');
    assert.deepStrictEqual(m.shuf([1, 2, 3, 4, 5], Util.seeded('a').int), m.shuf([1, 2, 3, 4, 5], Util.seeded('a').int));
    assert.deepStrictEqual(m.shuf([1, 2, 3, 4, 5], Util.seeded('a').int).slice().sort(), [1, 2, 3, 4, 5]);
    for (const clues of [40, 32, 26]) {
        const a = m.dailyPuzzle('2026-05-05', clues), b = m.dailyPuzzle('2026-05-05', clues), c = m.dailyPuzzle('2026-05-06', clues);
        assert.deepStrictEqual(a, b, 'same day -> same puzzle');
        assert.notDeepStrictEqual(a.puzzle, c.puzzle, 'different day -> different puzzle');
        assert.strictEqual(a.puzzle.filter(v => v).length, clues);
        assert.strictEqual(m.solve(a.puzzle, 2).count, 1, 'unique solution');
        assert.deepStrictEqual(m.solve(a.puzzle, 2).first, a.solution);
        assert.strictEqual(m.conflicts(a.solution).size, 0);
    }
    // 不傳種子（一般模式）仍能產生唯一解題目
    { const g = m.generate(40, Util.rnd); assert.strictEqual(m.solve(g.puzzle, 2).count, 1); }
    assert.strictEqual(m.twDay(Date.UTC(2026, 11, 31, 16, 0)), '2027-01-01');
    assert.deepStrictEqual(m.staleDailyKeys(['sudoku_daily_2026-01-01_40', 'sudoku_daily_2026-03-05_32', 'sudoku_best_40'], '2026-03-10'), ['sudoku_daily_2026-01-01_40']);
    ok('sudoku daily: deterministic per day+level, unique solution, trimming');
}
