const { load, ok } = require('./_load'); const assert = require('assert');
const sh = (r) => (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = r.int(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ---------- UNO ----------
{
    const m = load('mini-games/uno.html', 'makeDeck, newGame, playCard, drawCard, passTurn, cpuMove, applyMove, canPlayCard');
    // 規則：電腦每一步都合法、對局都能打完、牌總數不變
    const play = (n, levels, seed) => {
        const r = Util.seeded(seed), g = m.newGame(n, sh(r)); let steps = 0;
        while (g.winner < 0 && steps++ < 3000) {
            const p = g.turn, d = m.cpuMove(g, p, levels[p], r);
            assert.ok(m.applyMove(g, p, d), 'cpu move must be legal: ' + JSON.stringify(d));
            if (steps % 50 === 0) assert.strictEqual(g.hands.reduce((s, h) => s + h.length, 0) + g.deck.length + g.discard.length, 108);
        }
        assert.ok(g.winner >= 0, 'game must finish'); assert.strictEqual(g.hands[g.winner].length, 0);
        return g.winner;
    };
    for (let n = 2; n <= 6; n++) for (let lv = 0; lv <= 2; lv++) for (let s = 0; s < 4; s++) play(n, Array(n).fill(lv), `u${n}${lv}${s}`);
    ok('uno solo: cpu plays only legal moves, 2-6 players x 3 levels finish');
    // 困難 vs 簡單（雙人，固定種子，交換座位）：困難勝率應明顯過半（寬鬆門檻）
    let hardWins = 0, N = 60;
    for (let s = 0; s < N; s++) { const hardFirst = s % 2 === 0, w = play(2, hardFirst ? [2, 0] : [0, 2], 'h' + s); if ((w === 0) === hardFirst) hardWins++; }
    assert.ok(hardWins >= N * 0.5, 'hard should not lose to easy, got ' + hardWins + '/' + N);
    ok('uno solo: hard >= easy (' + hardWins + '/' + N + ')');
    // 下一位只剩 2 張時，困難優先出攻擊牌（+2）而不是數字牌
    const g = { hands: [['R5', 'RD', 'G5'], ['R1', 'Y2'], ['B1', 'B2', 'B3']], deck: [], discard: ['R3'], color: 'R', turn: 0, dir: 1, drew: false, drawnIdx: -1, winner: -1, shuffleFn: (a) => a };
    for (let i = 0; i < 10; i++) assert.strictEqual(m.cpuMove(g, 0, 2).i, 1);
    // 沒牌可出：先抽；抽完還不能出（drew 為真時）則過
    const g2 = { ...g, hands: [['B5'], ['R1'], ['R2']], dir: 1 };
    assert.strictEqual(m.cpuMove(g2, 0, 1).t, 'DRAW');
    ok('uno solo: hard prioritises attack when next player has <=2 cards; draws when stuck');
    // 萬用牌：一定附合法顏色
    const g3 = { ...g, hands: [['WW', 'G1', 'G2'], ['R1', 'Y2'], ['R1']], discard: ['R3'] };
    for (let lv = 0; lv <= 2; lv++) { const d = m.cpuMove(g3, 0, lv, Util.seeded(lv)); if (d.i === 0) assert.ok('RYGB'.includes(d.color)); }
}

// ---------- 21 點 ----------
{
    const m = load('mini-games/blackjack.html', 'handValue, bjAction, cpuBet, newDeck, dealerShouldHit, settle, BETS');
    assert.strictEqual(m.bjAction(['10S', '6H'], '10D', true), 'hit');       // 硬 16 vs 10
    assert.strictEqual(m.bjAction(['10S', '6H'], '5D', true), 'stand');      // 硬 16 vs 5
    assert.strictEqual(m.bjAction(['6S', '5H'], '6D', true), 'double');      // 11 vs 6
    assert.strictEqual(m.bjAction(['6S', '5H'], '6D', false), 'hit');        // 不能加倍就要牌
    assert.strictEqual(m.bjAction(['AS', '7H'], '3D', true), 'double');      // 軟 18 vs 3
    assert.strictEqual(m.bjAction(['AS', '7H'], '3D', false), 'stand');
    assert.strictEqual(m.bjAction(['AS', '7H'], '10D', true), 'hit');        // 軟 18 vs 10
    assert.strictEqual(m.bjAction(['10S', '7H'], 'AD', true), 'stand');
    assert.strictEqual(m.bjAction(['10S', '2H'], '4D', true), 'stand');      // 12 vs 4
    assert.strictEqual(m.bjAction(['10S', '2H'], '2D', true), 'hit');
    ok('blackjack solo: basic strategy spot checks');
    // 整張表：任何手牌 × 任何明牌都回傳合法動作；多張牌不會被叫加倍（呼叫端 canDouble=false）
    const r = Util.seeded(5);
    for (let k = 0; k < 2000; k++) {
        const deck = Util.shuffle(m.newDeck()), n = 2 + Math.floor(r() * 3), hand = deck.slice(0, n), up = deck[n];
        if (m.handValue(hand).total >= 21) continue;
        const a = m.bjAction(hand, up, n === 2);
        assert.ok(['hit', 'stand', 'double'].includes(a)); if (n > 2) assert.notStrictEqual(a, 'double');
    }
    // 模擬一手：照基本策略 + 莊家 17 停牌，長期輸贏應接近莊家優勢（EV 大於 -10%），且動作序列一定收斂
    let net = 0, hands = 6000;
    for (let k = 0; k < hands; k++) {
        const d = Util.shuffle(m.newDeck()), p = [d.pop(), d.pop()], dl = [d.pop(), d.pop()], bet = 10; let b = bet;
        while (!m.handValue(p).bust && !m.handValue(p).blackjack) {
            const a = m.bjAction(p, dl[0], p.length === 2);
            if (a === 'stand') break; p.push(d.pop()); if (a === 'double') { b *= 2; break; }
        }
        while (m.dealerShouldHit(dl)) dl.push(d.pop());
        net += m.settle(p, dl, b).delta;
    }
    assert.ok(net / (hands * 10) > -0.1, 'basic strategy EV too low: ' + net / (hands * 10));
    ok('blackjack solo: basic strategy EV ' + (net / (hands * 10)).toFixed(3) + ' per unit bet');
    for (const chips of [0, 5, 10, 24, 25, 50, 100, 500]) { const b = m.cpuBet(chips, Util.seeded(chips)); assert.ok(b === 0 ? chips < 10 : m.BETS.includes(b) && b <= chips); }
    ok('blackjack solo: cpu bets are valid and affordable');
}

// ---------- 終極密碼 ----------
{
    const m = load('mini-games/ultimate-code.html', 'aiGuess, judge, validGuess');
    const r = Util.seeded(11);
    // 電腦的猜測永遠落在合法範圍內（含範圍只剩 1～2 個數字的邊界）
    for (let k = 0; k < 3000; k++) {
        const lo = Math.floor(r() * 200), hi = lo + 2 + Math.floor(r() * 300), lv = k % 3, g = m.aiGuess(lo, hi, lv, r);
        assert.ok(m.validGuess(lo, hi, g), `${lo},${hi},${lv} -> ${g}`);
    }
    assert.strictEqual(m.aiGuess(4, 6, 2), 5);
    // 對固定密碼自己猜到中（沒偷看密碼，只靠 judge 回報縮小範圍）：每個難度都會收斂；困難平均次數最少
    const avg = (lv) => {
        let tot = 0, N = 300;
        for (let k = 0; k < N; k++) {
            const secret = 1 + Math.floor(r() * 1000); let lo = 0, hi = 1001, n = 0;
            for (; ;) { const g = m.aiGuess(lo, hi, lv, r); n++; const j = m.judge(lo, hi, g, secret); if (j.hit) break; lo = j.lo; hi = j.hi; assert.ok(n < 2000); }
            tot += n;
        }
        return tot / N;
    };
    const [e, n, h] = [0, 1, 2].map(avg);
    assert.ok(h < n + 1 && n < e && h < 12, `avg guesses easy ${e} normal ${n} hard ${h}`);
    ok(`ultimate solo: ai guesses always valid; avg guesses to hit 1-1000: easy ${e.toFixed(1)} / normal ${n.toFixed(1)} / hard ${h.toFixed(1)}`);
    // aiGuess 不接收密碼，簽名只有 (lo, hi, level, rand)
    assert.ok(m.aiGuess.length <= 4);
}

// ---------- 海戰 ----------
{
    const m = load('mini-games/battleship.html', 'randomFleet, validFleet, shotResult, allSunk, aiShot, markSunk, LENS, SIZE, cellsOf');
    const r = Util.seeded(21), ri = (n) => Math.floor(r() * n);
    // 電腦艦隊隨機擺放一定合法
    for (let k = 0; k < 200; k++) assert.ok(m.validFleet(m.randomFleet(ri)));
    // markSunk：擊沉的船歸入已沉，相鄰另一艘船的命中格仍是 1
    { const kn = new Map([[0, 1], [1, 1], [2, 1], [11, 1]]); m.markSunk(kn, 0, 2, 3); assert.deepStrictEqual([0, 1, 2].map(k => kn.get(k)), [2, 2, 2]); assert.strictEqual(kn.get(11), 1); }
    // 整局模擬：電腦打一支隨機艦隊，只靠回報的結果；每一槍都合法（不重複、在棋盤內）且最後一定打完
    const game = (lv) => {
        const fleet = m.randomFleet(ri), shots = new Set(), known = new Map(), lens = [...m.LENS]; let n = 0;
        while (!m.allSunk(fleet, shots)) {
            const k = m.aiShot(known, lens, lv, r); n++;
            assert.ok(Number.isInteger(k) && k >= 0 && k < 100 && !shots.has(k), 'shot must be new & in board'); assert.ok(n <= 100);
            const rr = Math.floor(k / 10), cc = k % 10, res = m.shotResult(fleet, shots, rr, cc); shots.add(k);
            known.set(k, res.hit ? 1 : 0);
            if (res.sunk) { m.markSunk(known, rr, cc, res.sunk); lens.splice(lens.indexOf(res.sunk), 1); }
        }
        return n;
    };
    const avg = (lv, N = 60) => { let t = 0; for (let i = 0; i < N; i++) t += game(lv); return t / N; };
    const [e, nm, h] = [0, 1, 2].map(lv => avg(lv));
    assert.ok(h < nm && nm < e - 10, `avg shots easy ${e} normal ${nm} hard ${h}`);
    ok(`battleship solo: fleets valid, ai never repeats a shot; avg shots to win easy ${e.toFixed(0)} / normal ${nm.toFixed(0)} / hard ${h.toFixed(0)}`);
}
