// 進行中存檔 / 草稿的驗證函式：數獨、數織、心情日記（2048 的在 tools.test.js）
const assert = require('assert');
const { load, ok } = require('./_load');
{
    const m = load('mini-games/sudoku.html', 'solve, generate, restoreSudoku');
    const { puzzle } = m.generate(40, Util.seeded('save1').int);
    const good = { lv: 40, puzzle, board: puzzle.slice(), notes: new Array(81).fill(0), sec: 12, daily: null };
    const r = m.restoreSudoku(good, [40, 32, 26]);
    assert.deepStrictEqual(r.board, puzzle); assert.strictEqual(r.sec, 12); assert.strictEqual(r.solution.length, 81);
    const bad = [null, 5, {}, { ...good, lv: 7 }, { ...good, sec: -1 }, { ...good, sec: 1.5 }, { ...good, daily: 5 }, { ...good, board: 'x' }, { ...good, board: good.board.slice(1) },
        { ...good, board: good.board.map((v, i) => i === 0 ? 10 : v) }, { ...good, notes: good.notes.map((v, i) => i === 0 ? 0x400 : v) },
        { ...good, puzzle: new Array(81).fill(0), board: new Array(81).fill(0) },                          // 非唯一解
        { ...good, board: good.board.map((v, i) => puzzle[i] ? (v % 9) + 1 : v) }];                        // 與題目矛盾
    bad.forEach((b, i) => assert.strictEqual(m.restoreSudoku(b, [40, 32, 26]), null, 'sudoku bad ' + i));
    ok('sudoku restoreSudoku');
}
{
    const m = load('mini-games/nonogram.html', 'restoreNono');
    const sq = (n, v) => Array.from({ length: n }, () => new Array(n).fill(v));
    const grid = sq(5, 0); grid[0][0] = 1;
    const good = { n: 5, grid, cells: sq(5, 2), sec: 3 };
    assert.deepStrictEqual(m.restoreNono(good, [5, 10, 15]), good);
    const bad = [null, 7, {}, { ...good, n: 6 }, { ...good, sec: -1 }, { ...good, grid: sq(5, 0) }, { ...good, grid: sq(4, 1) }, { ...good, cells: sq(5, 3) }, { ...good, cells: 'x' }, { ...good, cells: [null, ...sq(4, 0)] }];
    bad.forEach((b, i) => assert.strictEqual(m.restoreNono(b, [5, 10, 15]), null, 'nono bad ' + i));
    ok('nonogram restoreNono');
}
{
    const m = load('fun/mood-journal.html', 'cleanDraft');
    const d = m.cleanDraft({ date: '2026-01-02', text: 'x'.repeat(2500), mood: 4, tags: ['工作', 5, '工作'] }, '2026-01-03');
    assert.strictEqual(d.text.length, 2000); assert.strictEqual(d.mood, 4); assert.deepStrictEqual(d.tags, ['工作']);
    assert.strictEqual(m.cleanDraft({ date: '2026-01-02', text: 'a', mood: 9, tags: 'x' }, '2026-01-03').mood, 0);
    for (const b of [null, 'x', {}, { date: '2026-01-02', text: '   ' }, { date: '2026-01-02', text: 5 }, { date: '2026-02-30', text: 'a' }, { date: '2026-01-04', text: 'a' }]) assert.strictEqual(m.cleanDraft(b, '2026-01-03'), null);
    ok('mood-journal cleanDraft');
}
