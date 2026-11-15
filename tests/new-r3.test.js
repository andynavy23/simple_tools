// 批次 r3：go9（圍棋 9×9）純邏輯：提子、禁著、劫、數子、SGF、存檔驗證、電腦
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('mini-games/go9.html', 'place, groupOf, newGame, check, play, gameFrom, undoMoves, score, suggestDead, toggleDead, cleanDead, sgf, cpuMove, evalMove, cleanOpts, cleanStats, cleanSave, cleanRes, stateGame, tally');
const P = (r, c) => r * 9 + c;
const empty = () => new Array(81).fill(0);
const setup = (stones, turn = 1, ko = 'super') => {
    const g = m.newGame(ko);
    for (const [r, c, v] of stones) g.b[P(r, c)] = v;
    g.turn = turn; g.cur = g.b.join(''); g.seen = new Set([g.cur]);
    return g;
};

// 角上提子：白 (0,0) 被黑 (0,1) 與 (1,0) 圍住
{
    const g = setup([[0, 0, 2], [0, 1, 1]]);
    assert.ok(m.play(g, P(1, 0)));
    assert.strictEqual(g.b[0], 0); assert.strictEqual(g.caps[1], 1); assert.strictEqual(g.turn, 2);
    // 氣數
    const t = setup([[4, 4, 1], [4, 5, 1], [0, 0, 2]]);
    assert.strictEqual(m.groupOf(t.b, P(4, 4)).libs.length, 6);
    assert.strictEqual(m.groupOf(t.b, P(0, 0)).libs.length, 2);
    // 多塊同時提
    const d = setup([[0, 1, 2], [1, 0, 2], [0, 2, 1], [1, 1, 1], [2, 0, 1]], 1);
    assert.ok(m.place(d.b, P(0, 0), 1));
}
ok('go9 提子與氣');

// 禁著：自殺不行、提子的自殺可以、已有子不行
{
    const g = setup([[0, 1, 1], [1, 0, 1]], 2);
    assert.strictEqual(m.check(g, P(0, 0)), 'suicide');
    assert.strictEqual(m.check(g, P(0, 1)), 'occupied');
    assert.strictEqual(m.check(g, P(4, 4)), '');
    assert.strictEqual(m.check(g, -1), '');
    assert.strictEqual(m.check(g, 99), 'occupied');
    assert.strictEqual(m.play(g, P(0, 0)), false); assert.strictEqual(g.moves.length, 0);
    // 白 (0,2)(1,1)(2,0) 圍住；黑 (0,1)(1,0) 只剩 (0,0) 一氣：白下 (0,0) 同時提掉兩子 → 合法
    const h = setup([[0, 1, 1], [1, 0, 1], [0, 2, 2], [1, 1, 2], [2, 0, 2]], 2);
    assert.strictEqual(m.check(h, P(0, 0)), '');
    assert.ok(m.play(h, P(0, 0))); assert.strictEqual(h.caps[2], 2);
}
ok('go9 禁著');

// 劫：黑 (2,3) 提 (2,2)，白不能立刻提回；下別處後可以
for (const ko of ['super', 'simple']) {
    const g = setup([[1, 2, 1], [3, 2, 1], [2, 1, 1], [2, 2, 2], [1, 3, 2], [3, 3, 2], [2, 4, 2]], 1, ko);
    assert.ok(m.play(g, P(2, 3)));
    assert.strictEqual(g.b[P(2, 2)], 0); assert.strictEqual(g.caps[1], 1);
    assert.strictEqual(m.check(g, P(2, 2)), 'ko', ko);
    assert.strictEqual(m.play(g, P(2, 2)), false);
    assert.ok(m.play(g, P(8, 8))); assert.ok(m.play(g, P(0, 8)));       // 找劫材
    assert.strictEqual(m.check(g, P(2, 2)), '', ko);
    assert.ok(m.play(g, P(2, 2))); assert.strictEqual(g.b[P(2, 3)], 0);
}
// 超劫：整盤重複（非立刻）也禁；簡單劫不禁
{
    const mk = (ko) => {
        const g = m.newGame(ko);
        g.b[P(0, 0)] = 1; g.cur = g.b.join(''); g.seen = new Set([g.cur, new Array(81).fill(0).join('')]);
        g.turn = 1; g.prev = null;
        return g;
    };
    const s = mk('super'), t = mk('simple');
    s.b[P(0, 0)] = 0; s.cur = s.b.join('');                       // 現在是空盤；曾出現「(0,0) 黑」的盤面
    t.b[P(0, 0)] = 0; t.cur = t.b.join('');
    assert.strictEqual(m.check(s, P(0, 0)), 'ko');
    assert.strictEqual(m.check(t, P(0, 0)), '');
}
ok('go9 劫');

// 虛手、雙方連續虛手結束、繼續對局、手序重播
{
    const g = m.newGame();
    assert.ok(m.play(g, P(4, 4))); assert.ok(m.play(g, -1)); assert.strictEqual(g.passes, 1); assert.strictEqual(g.over, false);
    assert.ok(m.play(g, -1)); assert.strictEqual(g.over, true);
    assert.strictEqual(m.play(g, P(0, 0)), false);
    assert.strictEqual(m.check(g, -1), 'over');
    assert.ok(m.play(g, -2)); assert.strictEqual(g.over, false); assert.strictEqual(g.turn, 2);
    assert.ok(m.play(g, P(0, 0))); assert.strictEqual(g.passes, 0);
    const g2 = m.gameFrom('super', g.moves);
    assert.deepStrictEqual(g2.b, g.b); assert.strictEqual(g2.turn, g.turn);
    assert.strictEqual(m.gameFrom('super', [40, 40]), null);        // 重複下同一點
    assert.strictEqual(m.gameFrom('super', [1.5]), null);
    assert.strictEqual(m.gameFrom('x', []), null);
    assert.strictEqual(m.gameFrom('super', [-2]), null);            // 沒結束不能繼續
    assert.strictEqual(m.gameFrom('super', new Array(401).fill(-1)), null);
    // 悔棋手序
    assert.deepStrictEqual(m.undoMoves([40, 41, 42], 0), [40, 41]);
    assert.deepStrictEqual(m.undoMoves([40, 41, 42], 1), [40, 41]);        // 退到輪到黑
    assert.deepStrictEqual(m.undoMoves([40, 41, 42, 43], 2), [40, 41, 42]);
    assert.deepStrictEqual(m.undoMoves([40, 41, 42, 43], 1), [40, 41]);
    assert.strictEqual(m.undoMoves([40], 1).length, 0);
    assert.strictEqual(m.undoMoves([], 0), null);
    assert.strictEqual(m.undoMoves([40], 2), null);
}
ok('go9 虛手與重播');

// 數子：黑牆第 3 行、白牆第 5 行，第 4 行為公共空點
{
    const wall = () => { const s = []; for (let r = 0; r < 9; r++) s.push([r, 3, 1], [r, 5, 2]); return s; };
    const g = setup(wall());
    let s = m.score(g, [], 'area', 7.5);
    assert.strictEqual(s.s1, 36); assert.strictEqual(s.s2, 43.5); assert.strictEqual(s.winner, 2); assert.strictEqual(s.rs, 'W+7.5');
    s = m.score(g, [], 'area', 0); assert.strictEqual(s.winner, 0); assert.strictEqual(s.rs, '0');
    s = m.score(g, [], 'terr', 7); assert.strictEqual(s.s1, 27); assert.strictEqual(s.s2, 34); assert.strictEqual(s.rs, 'W+7');
    // 黑地盤裡有一顆白子：沒標死子 → 那塊空點變成中立；標死子後歸黑，日本數目多一個提子
    const h = setup([...wall(), [4, 1, 2]]);
    s = m.score(h, [], 'area', 0); assert.strictEqual(s.own[P(4, 0)], 0);
    s = m.score(h, [P(4, 1)], 'area', 0); assert.strictEqual(s.s1, 36); assert.strictEqual(s.s2, 36);
    s = m.score(h, [P(4, 1)], 'terr', 0); assert.strictEqual(s.s1, 28);
    // 提子算進日本數目
    h.caps[1] = 3; s = m.score(h, [P(4, 1)], 'terr', 0); assert.strictEqual(s.s1, 31);
    // 標死子：只剩一口氣的整塊
    assert.deepStrictEqual(m.suggestDead(h.b), []);
    const a = setup([[4, 1, 2], [3, 1, 1], [5, 1, 1], [4, 0, 1]]);
    assert.deepStrictEqual(m.suggestDead(a.b), [P(4, 1)]);
    // 點選切換整塊
    const two = setup([[0, 0, 2], [0, 1, 2], [5, 5, 1]]);
    let d = m.toggleDead(two.b, [], P(0, 1)); assert.deepStrictEqual(d, [0, 1]);
    d = m.toggleDead(two.b, d, P(0, 0)); assert.deepStrictEqual(d, []);
    assert.deepStrictEqual(m.toggleDead(two.b, [], P(8, 8)), []);
    assert.deepStrictEqual(m.cleanDead(two.b, [0, 0, 1, 80, 'x', -1, 5 * 9 + 5]), [0, 1, 50]);
}
ok('go9 數子');

// SGF
{
    assert.strictEqual(m.sgf([40, -1, 0, -2, 80], { komi: 7.5, rule: 'area', pb: '你', pw: '電腦', re: 'W+3.5' }),
        '(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[7.5]RU[Chinese]PB[你]PW[電腦]RE[W+3.5];B[ee];W[];B[aa];W[ii])');
    assert.ok(m.sgf([], { rule: 'terr', pb: 'a]b' }).includes('RU[Japanese]PB[a\\]b]'));
}
ok('go9 SGF');

// 驗證與存檔
{
    assert.deepStrictEqual(m.cleanOpts(null), { level: 'normal', side: 'b', ko: 'super', rule: 'area', komi: 7.5 });
    assert.strictEqual(m.cleanOpts({ rule: 'terr', komi: 'x' }).komi, 7);
    assert.strictEqual(m.cleanOpts({ komi: 99, level: 'hard', ko: 3 }).level, 'normal');
    assert.deepStrictEqual(m.cleanStats([1]).easy, [0, 0, 0]);
    assert.deepStrictEqual(m.cleanStats({ net: [1, -2, 'a'] }).net, [1, 0, 0]);
    assert.deepStrictEqual(m.tally(m.cleanStats(null), 'easy', 'w').easy, [1, 0, 0]);
    for (const bad of [null, 1, 'x', [], {}, { v: 2 }, { v: 1, mode: 'cpu', ko: 'super', moves: 'a' }, { v: 1, mode: 'cpu', ko: 'super', moves: [] }, { v: 1, mode: 'net', ko: 'super', moves: [40] }, { v: 1, mode: 'cpu', ko: 'super', moves: [40, 40] }])
        assert.strictEqual(m.cleanSave(bad), null);
    const s = m.cleanSave({ v: 1, mode: 'cpu', level: 'zz', me: 7, ko: 'simple', rule: 'terr', komi: 5, moves: [40, 41] });
    assert.strictEqual(s.level, 'normal'); assert.strictEqual(s.me, 1); assert.strictEqual(s.cfg.komi, 7); assert.strictEqual(s.g.moves.length, 2);
    assert.strictEqual(m.cleanRes({ w: 3, why: 'score' }), null);
    assert.deepStrictEqual(m.cleanRes({ w: 1, why: 'score', s: '<b>' }), { w: 1, why: 'score', s: '' });
    assert.deepStrictEqual(m.cleanRes({ w: 2, why: 'score', s: 'W+7.5' }).s, 'W+7.5');
    const st = m.stateGame({ ko: 'super', rule: 'area', komi: 7.5, hostSide: 1, moves: [40, 41], dead: [40, 99], conf: [true], res: null });
    assert.deepStrictEqual(st.dead, [40]); assert.deepStrictEqual(st.conf, [true, false]);
    assert.strictEqual(m.stateGame({ ko: 'super', rule: 'area', komi: 7.5, hostSide: 1, moves: [40, 40] }), null);
    assert.strictEqual(m.stateGame({ ko: 'super', rule: 'x', komi: 7.5, hostSide: 1, moves: [] }), null);
    assert.strictEqual(m.stateGame(null), null);
}
ok('go9 驗證');

// 電腦：會提子、會救子、不填自己的眼、單步夠快、整局隨機對打不丟例外
{
    const g = setup([[0, 0, 2], [0, 1, 1]]);
    assert.strictEqual(m.cpuMove(g, 'normal', 7, () => .5), P(1, 0));
    const sv = setup([[4, 4, 1], [4, 3, 2], [3, 4, 2], [5, 4, 2]], 1);   // 黑 (4,4) 只剩 (4,5) 一氣：該長出
    assert.strictEqual(m.cpuMove(sv, 'normal', 7, () => .5), P(4, 5));
    const eye = setup([[0, 1, 1], [1, 0, 1], [1, 1, 1]], 1);
    assert.ok(m.evalMove(eye, P(0, 0)) <= -50);
    assert.strictEqual(m.cpuMove(m.newGame(), 'normal', 7, () => .5) >= 0, true);
    const t0 = Date.now(); let g1 = m.newGame();
    for (let k = 0; k < 30 && !g1.over; k++) { const mv = m.cpuMove(g1, k % 2 ? 'easy' : 'normal', 7); assert.ok(m.play(g1, mv), '電腦下了非法手 ' + mv); }
    assert.ok((Date.now() - t0) / 30 < 300, '單步太慢');
    // 對手剛虛手而自己領先 → 跟著虛手
    const lead = setup([[4, 4, 1]], 1); lead.passes = 1;
    assert.strictEqual(m.cpuMove(lead, 'normal', 0), -1);
}
ok('go9 電腦');
