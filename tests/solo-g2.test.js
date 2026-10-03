// 單機模式（g2）：猜拳、賓果、骰子賽跑、終極井字棋、翻牌記憶的電腦玩家邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const seededRand = (n) => Util.seeded('g2-' + n);

// ---- 猜拳 ----
{
    const m = load('fun/rps.html', 'cpuPick, beats, CHOICES');
    const r = seededRand(1);
    for (let i = 0; i < 200; i++) assert.ok(m.CHOICES.includes(m.cpuPick(i % 2 ? 'easy' : 'normal', ['rock', 'paper'].slice(0, i % 3), r)));
    // 玩家一直出石頭：普通電腦大多出布、對戰勝率遠高於簡單
    const rate = (level) => { let w = 0, l = 0; for (let i = 0; i < 400; i++) { const c = m.cpuPick(level, Array(5).fill('rock'), r); const x = m.beats(c, 'rock'); if (x > 0) w++; else if (x < 0) l++; } return [w, l]; };
    const [nw, nl] = rate('normal'), [ew, el] = rate('easy');
    assert.ok(nw > 250 && nl < 40, `normal ${nw}/${nl}`);
    assert.ok(ew < 190 && el > 100, `easy ${ew}/${el}`);
    // 沒有出拳紀錄時不會當掉、仍隨機
    assert.ok(new Set(Array.from({ length: 100 }, () => m.cpuPick('normal', [], r))).size === 3);
    ok('rps solo: cpuPick legal; normal counters your habit, easy is random');
}

// ---- 賓果 ----
{
    const m = load('fun/bingo.html', 'makeCard, hasBingo, minLeft, cpuWinners, drawOrder, validCard');
    const r = seededRand(2), shuf = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = r.int(i + 1);[b[i], b[j]] = [b[j], b[i]]; } return b; };
    // 多張電腦卡同場：叫號直到有人連線，一定在 75 號內分出勝負；minLeft 與 hasBingo 一致
    for (let g = 0; g < 50; g++) {
        const cards = new Map(Array.from({ length: 4 }, (_, i) => [i, m.makeCard(shuf)])), order = m.drawOrder(shuf), called = new Set();
        cards.forEach(c => assert.ok(m.validCard(c)));
        let won = [];
        for (const n of order) {
            called.add(n);
            cards.forEach(c => assert.strictEqual(m.minLeft(c, called) === 0, m.hasBingo(c, called)));
            won = m.cpuWinners(cards, called);
            if (won.length || [...cards.values()].some(c => m.hasBingo(c, called))) break;
        }
        assert.ok(called.size <= 75 && [...cards.values()].some(c => m.hasBingo(c, called)));
        assert.ok(won.every(i => i !== 0 && m.hasBingo(cards.get(i), called)), 'cpuWinners 只回傳電腦（不含 0 號＝玩家）且確實賓果');
    }
    // 新卡一開始最少還差 4 格（免費格已標）
    assert.strictEqual(m.minLeft(m.makeCard(shuf), new Set()), 4);
    ok('bingo solo: cpuWinners / minLeft consistent with hasBingo; every game ends within 75 calls');
}

// ---- 骰子賽跑 ----
{
    const m = load('fun/board-race.html', 'move, nextTurn, GOAL');
    const r = seededRand(3);
    // 1–3 位電腦 + 你，輪流擲骰（與頁面相同的 move / nextTurn）：每局都打得完、位置不出界
    for (let g = 0; g < 200; g++) {
        const n = 2 + r.int(3), pos = Array(n).fill(0); let skip = Array(n).fill(false), turn = r.int(n), won = -1;
        for (let step = 0; step < 2000 && won < 0; step++) {
            const roll = 1 + r.int(6), mv = m.move(pos[turn], roll);
            assert.ok(mv.pos >= 0 && mv.pos <= m.GOAL);
            pos[turn] = mv.pos;
            if (mv.win) { won = turn; break; }
            if (mv.skip) skip[turn] = true;
            if (!mv.again) { const nx = m.nextTurn(Array(n).fill(true), skip, turn); skip = nx.skip; turn = nx.turn; assert.ok(turn >= 0 && turn < n); }
        }
        assert.ok(won >= 0 && pos[won] === m.GOAL, `game ${g} did not finish`);
    }
    ok('board-race solo: 2-4 player games always finish with legal positions');
}

// ---- 終極井字棋 ----
{
    const m = load('mini-games/ultimate-ttt.html', 'newGame, play, canPlay, legalMoves, cpuMove, cloneG');
    const r = seededRand(4);
    const game = (lv1, lv2, first = 1, depth) => {
        const s = m.newGame(first), lv = { 1: lv1, 2: lv2 }; let n = 0;
        while (!s.winner && !s.draw) {
            const mv = m.cpuMove(s, lv[s.turn], r, depth), legal = m.legalMoves(s);
            assert.ok(mv && legal.some(([b, c]) => b === mv[0] && c === mv[1]), '電腦出的步一定合法');
            assert.ok(m.canPlay(s, s.turn, mv[0], mv[1]));
            assert.ok(m.play(s, s.turn, mv[0], mv[1]));
            assert.ok(++n <= 81);
        }
        return s.winner;
    };
    // 三種難度隨機對局都能打完、不違規
    for (const lv of ['easy', 'normal', 'hard']) assert.ok([0, 1, 2].includes(game(lv, 'easy', 1, 2)));
    // 一步致勝：電腦必須下出贏棋（普通 / 困難）
    const setup = () => { const s = m.newGame(2); s.small[0] = 2; s.small[4] = 2; s.cells[8][0] = 2; s.cells[8][4] = 2; s.next = 8; return s; };
    for (const lv of ['normal', 'hard']) { const s = setup(); const [b, c] = m.cpuMove(s, lv, r, 3); assert.deepStrictEqual([b, c], [8, 8], lv + ' 應下 8-8 贏整局'); }
    // 能贏小棋盤就贏、對手有兩連就擋
    { const s = m.newGame(2); s.cells[3][0] = 2; s.cells[3][1] = 2; s.cells[3][4] = 1; s.next = 3; assert.deepStrictEqual(m.cpuMove(s, 'normal', r), [3, 2]); }
    { const s = m.newGame(2); s.cells[3][0] = 1; s.cells[3][1] = 1; s.next = 3; assert.deepStrictEqual(m.cpuMove(s, 'normal', r), [3, 2]); }
    // 難度排序：普通 > 簡單、困難 > 簡單（兩邊各執先後手）
    const vs = (lv, n, depth) => {        // lv 對 easy，奇偶局交換先後手；回傳 lv 贏的場數
        let w = 0;
        for (let i = 0; i < n; i++) {
            const mySide = 1 + (i % 2), s = m.newGame(mySide), lvs = { [mySide]: lv, [3 - mySide]: 'easy' };
            while (!s.winner && !s.draw) { const mv = m.cpuMove(s, lvs[s.turn], r, depth); m.play(s, s.turn, mv[0], mv[1]); }
            if (s.winner === mySide) w++;
        }
        return w;
    };
    assert.ok(vs('normal', 20) >= 15, 'normal 應明顯贏過 easy');
    assert.ok(vs('hard', 4, 3) >= 3, 'hard 應贏過 easy');
    ok('ultimate-ttt solo: cpu moves legal; takes the win, blocks; normal/hard beat easy');
}

// ---- 翻牌記憶 ----
{
    const m = load('mini-games/memory-match.html', 'createGame, flip, resolve, remember, cpuFirst, cpuSecond, CPU_CAP, makeDeck');
    const r = seededRand(5);
    // 兩個電腦互打（不同記憶力）：每步都合法、一定打完；記憶好的平均配對更多
    const play = (capA, capB, pairs) => {
        const g = m.createGame(m.makeDeck(pairs), 2), caps = [capA, capB]; let mem = [], guard = 0;
        while (!g.over && guard++ < 2000) {
            const cap = caps[g.turn];
            const see = (i) => { mem = m.remember(mem, i, g.deck[i], Math.max(capA, capB)); };    // 全場共用「看見過的牌」，各自的容量在選牌時截取
            const view = () => mem.slice(-Math.max(2, cap));
            const a = m.cpuFirst(g.status, view(), r);
            assert.strictEqual(g.status[a], 'down'); assert.ok(m.flip(g, a, g.turn)); see(a);
            const b = m.cpuSecond(g.status, view(), a, r);
            assert.ok(b !== a && g.status[b] === 'down'); assert.ok(m.flip(g, b, g.turn)); see(b);
            m.resolve(g);
        }
        assert.ok(g.over && g.status.every(s => s === 'matched') && g.scores[0] + g.scores[1] === pairs);
        return g.scores;
    };
    let hard = 0, easy = 0;
    for (let i = 0; i < 20; i++) { const [a, b] = play(m.CPU_CAP.hard, m.CPU_CAP.easy, 8); hard += a; easy += b; }
    assert.ok(hard > easy + 20, `hard ${hard} vs easy ${easy}`);
    // 已知一對時：第一張一定翻那一對，第二張一定翻到另一張
    const status = Array(8).fill('down'), mem = [[1, 'A'], [4, 'B'], [6, 'A']];
    assert.ok([1, 6].includes(m.cpuFirst(status, mem, r)));
    assert.strictEqual(m.cpuSecond(status, [...mem], 1, r), 6);
    // 配對完成的牌不會再被選；記憶超過容量會忘掉最舊的
    status[1] = status[6] = 'matched';
    assert.ok(![1, 6].includes(m.cpuFirst(status, mem, r)));
    assert.deepStrictEqual(m.remember([[0, 'a'], [1, 'b'], [2, 'c']], 3, 'd', 3), [[1, 'b'], [2, 'c'], [3, 'd']]);
    ok('memory solo: cpu picks legal cards, uses memory, hard remembers better than easy');
}
