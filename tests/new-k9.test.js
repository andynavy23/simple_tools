// 批次 k9：德州撲克（mini-games/texas-holdem.html）純邏輯：牌型、邊池、盲注、下注規則、自對弈守恆、電腦不偷看
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('mini-games/texas-holdem.html', 'evalHand, handName, catOf, makeDeck, newTable, startHand, applyAct, legal, buildPots, distribute, botDecide, viewOf, publicOf, validPublic, checkReveal, cleanOpts, cleanStats, cleanAct, autoAct, blindAt, commitText, equity');
const OPTS = (o = {}) => m.cleanOpts({ seats: 4, level: 1, chips: 1000, blind: 1, up: 0, timer: 0, ...o });
const C = (s) => { const r = '23456789TJQKA'.indexOf(s[0]), u = 'shdc'.indexOf(s[1]); return u * 13 + r; };
const H = (s) => s.split(' ').map(C);

{ // 牌型：全部 C(52,5) 的各牌型次數
    const cnt = new Array(9).fill(0);
    for (let a = 0; a < 48; a++) for (let b = a + 1; b < 49; b++) for (let c = b + 1; c < 50; c++) for (let d = c + 1; d < 51; d++) for (let e = d + 1; e < 52; e++) cnt[m.catOf(m.evalHand([a, b, c, d, e]))]++;
    assert.deepStrictEqual(cnt, [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
    const E = (s) => m.evalHand(H(s));
    assert.ok(E('Ah Kh Qh Jh Th 2c 3d') > E('9h 8h 7h 6h 5h Ac Ad'));
    assert.strictEqual(m.handName(E('Ah Kh Qh Jh Th 2c 3d')), '皇家同花順');
    assert.strictEqual(m.catOf(E('Ah 2d 3c 4s 5h 9c Kd')), 4);                       // A2345 順子
    assert.ok(E('6h 2d 3c 4s 5h 9c Kd') > E('Ah 2d 3c 4s 5h 9c Kd'));
    assert.ok(E('Ah Ad Ac Kd Ks 2c 3d') > E('Ah Ad Ac Kd Qs 2c 3d'));
    assert.strictEqual(E('Ah Kd 7c 5s 3h 2c 9d'), E('Ac Ks 7d 5h 3s 2d 9c'));       // 花色不分大小
    ok('k9 evalHand 全部 C(52,5)');
}

{ // 邊池與平分
    const T = m.newTable(OPTS(), 4, 0), tot = [100, 300, 300, 50];
    T.seats.forEach((s, i) => { s.total = tot[i]; });
    T.seats[3].folded = true;
    assert.deepStrictEqual(m.buildPots(T).map(p => [p.amt, p.elig.join()]), [[350, '0,1,2'], [400, '1,2']]);
    // 三人不同額度 + 一人棄牌的死錢；最大注沒人跟 → 單人池退還
    const U = m.newTable(OPTS(), 4, 0), t2 = [50, 200, 500, 80]; U.seats.forEach((s, i) => { s.total = t2[i]; }); U.seats[3].folded = true;
    const p2 = m.buildPots(U);
    assert.deepStrictEqual(p2.map(p => p.elig.join('')), ['012', '12', '2']);
    assert.deepStrictEqual(p2.map(p => p.amt), [200, 330, 300]);
    // 牌力：0 號最大只贏主池，1 號贏邊池，2 號拿回沒人跟的部分
    assert.deepStrictEqual(m.distribute(p2, [9, 5, 1, 0], 0, 4).won, [200, 330, 300, 0]);
    // 平分與餘數：101 分給 1、3 號，按鈕在 0 → 1 號多 1；按鈕在 1 → 3 號多 1
    assert.deepStrictEqual(m.distribute([{ amt: 101, elig: [1, 3] }], [0, 5, 0, 5], 0, 4).won, [0, 51, 0, 50]);
    assert.deepStrictEqual(m.distribute([{ amt: 101, elig: [1, 3] }], [0, 5, 0, 5], 1, 4).won, [0, 50, 0, 51]);
    assert.deepStrictEqual(m.distribute([{ amt: 7, elig: [0, 1, 2] }], [3, 3, 3], 2, 3).won, [3, 2, 2]);
    ok('k9 邊池 / 平分 / 餘數');
}

const mk = (n, o = {}, seed = 'a') => { const T = m.newTable(OPTS({ seats: n, ...o }), n, 0), rng = Util.seeded(seed); return { T, rng, deal() { return m.startHand(T, m.makeDeck(rng)); } }; };

{ // 盲注與輪莊
    let g = mk(4); g.deal(); let T = g.T;
    assert.strictEqual(T.button, 0); assert.deepStrictEqual([T.sbSeat, T.bbSeat, T.turn], [1, 2, 3]);
    assert.deepStrictEqual([T.seats[1].bet, T.seats[2].bet, T.sb, T.bb], [10, 20, 10, 20]);
    g = mk(2); g.deal(); T = g.T;                    // 單挑：按鈕 = 小盲且先行動
    assert.deepStrictEqual([T.button, T.sbSeat, T.bbSeat, T.turn], [0, 0, 1, 0]);
    assert.ok(m.applyAct(T, 0, { t: 'CALL' })); assert.strictEqual(T.turn, 1);   // 大盲還有選擇權
    assert.ok(m.applyAct(T, 1, { t: 'CHECK' })); assert.strictEqual(T.phase, 'flop'); assert.strictEqual(T.turn, 1);   // 翻牌後大盲先行動
    // 按鈕順移並跳過淘汰者
    g = mk(4); g.deal(); T = g.T; T.seats[1].out = true; T.seats[1].chips = 0; T.phase = 'done'; m.startHand(T, m.makeDeck(g.rng));
    assert.strictEqual(T.button, 2); assert.deepStrictEqual([T.sbSeat, T.bbSeat], [3, 0]);
    const o = OPTS({ up: 5, blind: 0 }); assert.deepStrictEqual([m.blindAt(o, 1), m.blindAt(o, 5), m.blindAt(o, 6), m.blindAt(o, 9999)], [[5, 10], [5, 10], [10, 20], [500, 1000]]);
    g = mk(2, { chips: 1000 }); T = g.T; T.seats[1].chips = 7; m.startHand(T, m.makeDeck(g.rng)); assert.ok(T.seats[1].allIn && T.seats[1].bet === 7);   // 盲注不夠：全下
    ok('k9 盲注 / 輪莊 / 單挑');
}

{ // 最小加注、不足額全下不重開下注、非法動作不動牌桌
    const g = mk(3, { chips: 1000 }); g.deal(); const T = g.T;     // 按鈕 0，SB 1，BB 2，先行動 0
    const snap = () => JSON.stringify([T.seats, T.curBet, T.minRaise, T.turn, T.mv, T.log.length]);
    const bad = (p, a) => { const s = snap(); assert.strictEqual(m.applyAct(T, p, a), false); assert.strictEqual(snap(), s); };
    bad(1, { t: 'CALL' }); bad(0, { t: 'CHECK' }); bad(0, { t: 'RAISE', to: 39 }); bad(0, { t: 'RAISE', to: 20 }); bad(0, { t: 'RAISE', to: 1e9 }); bad(0, { t: 'RAISE', to: 40.5 });
    bad(0, { t: 'RAISE', to: NaN }); bad(0, { t: 'RAISE', to: '60' }); bad(0, { t: 'X' }); bad(0, null); bad(0, { t: 'RAISE' }); bad(5, { t: 'FOLD' }); bad(-1, { t: 'FOLD' });
    assert.ok(m.applyAct(T, 0, { t: 'RAISE', to: 60 })); assert.strictEqual(T.minRaise, 40);
    bad(1, { t: 'RAISE', to: 99 }); assert.ok(m.applyAct(T, 1, { t: 'RAISE', to: 100 })); assert.strictEqual(T.minRaise, 40);
    assert.strictEqual(m.legal(T, 2).minTo, 140);
    T.seats[2].chips = 110;                                           // 2 號：bet 20 + 110 = 全下到 130（< 140，不足額）
    assert.ok(m.applyAct(T, 2, { t: 'ALLIN' })); assert.strictEqual(T.curBet, 130); assert.strictEqual(T.minRaise, 40);
    assert.strictEqual(T.turn, 0); assert.ok(m.legal(T, 0).canRaise);  // 0 號在 1 號的完整加注後還沒行動過 → 可以加注
    assert.ok(m.applyAct(T, 0, { t: 'CALL' })); assert.strictEqual(T.turn, 1);
    assert.strictEqual(m.legal(T, 1).canRaise, false); bad(1, { t: 'RAISE', to: 400 }); bad(1, { t: 'ALLIN' });   // 1 號已行動過：只能跟注 / 棄牌
    assert.ok(m.applyAct(T, 1, { t: 'CALL' })); assert.strictEqual(T.phase, 'flop');
    ok('k9 最小加注 / 不重開 / 非法動作');
}

{ // 全下跑完公共牌、結算守恆
    const g = mk(3, { chips: 1000 }, 'b'); g.deal(); const T = g.T;
    m.applyAct(T, 0, { t: 'ALLIN' }); m.applyAct(T, 1, { t: 'ALLIN' }); m.applyAct(T, 2, { t: 'CALL' });
    assert.strictEqual(T.phase, 'done'); assert.strictEqual(T.board.length, 5);
    assert.strictEqual(T.seats.reduce((a, s) => a + s.chips, 0), 3000); assert.ok(T.result.showdown);
    ok('k9 全下攤牌');
}

{ // 自對弈 500 手：每步合法、籌碼守恆；混合電腦與隨機亂按
    const rand = Util.seeded('k9-selfplay'), rng = { int: (n) => Math.floor(rand() * n) };
    let hands = 0, games = 0;
    while (hands < 500) {
        const n = 2 + rand.int(7), start = [1000, 2000, 5000][rand.int(3)], T = m.newTable(OPTS({ seats: n, chips: start, blind: rand.int(6), up: [0, 5][rand.int(2)] }), n, rand.int(n)), total = n * start;
        games++;
        while (!T.over && hands < 500) {
            assert.ok(m.startHand(T, m.makeDeck(rng))); hands++;
            let steps = 0;
            while (T.phase !== 'done') {
                assert.ok(++steps < 300, '一手不該超過 300 步');
                const p = T.turn, s = T.seats[p]; assert.ok(p >= 0 && !s.out && !s.folded && !s.allIn);
                let a; const r = rand(), L = m.legal(T, p);
                if (r < .6) a = m.botDecide(T, p, rand.int(3), rand);
                else if (r < .8) a = m.autoAct(T, p);
                else {
                    a = [{ t: 'ALLIN' }, { t: 'CALL' }, L.canRaise ? { t: 'RAISE', to: L.minTo + rand.int(L.maxTo - L.minTo + 1) } : { t: 'FOLD' }, { t: 'FOLD' }][rand.int(4)];
                    if (a.t === 'CALL' && L.canCheck) a = { t: 'CHECK' };
                    if (a.t === 'ALLIN' && !L.canRaise && L.maxTo > T.curBet) a = { t: 'CALL' };
                }
                assert.ok(m.applyAct(T, p, a), `非法動作 ${JSON.stringify(a)} ${JSON.stringify(L)}`);
                if (T.phase !== 'done') {
                    assert.strictEqual(T.seats.reduce((x, q) => x + q.chips + q.total, 0), total);
                    T.seats.forEach(q => { assert.ok(q.chips >= 0 && q.bet <= q.total && q.bet >= 0); });
                }
            }
            assert.strictEqual(T.seats.reduce((x, q) => x + q.chips, 0), total);
            assert.strictEqual(T.result.won.reduce((x, y) => x + y, 0), T.seats.reduce((x, q) => x + q.total, 0));
            T.seats.forEach(q => { if (q.chips === 0) assert.ok(q.out); });
        }
    }
    assert.ok(games >= 3);
    ok('k9 自對弈 500 手（籌碼守恆、每步合法）');
}

{ // 電腦：不偷看、運算量、回傳一定合法
    const g = mk(8, {}, 'peek'); g.deal(); const T = g.T, p = T.turn;
    const v = m.viewOf(T, p); assert.ok(!('deck' in v) && !JSON.stringify(v.seats).includes('hole'));
    for (const lv of [0, 1, 2]) {
        const a1 = m.botDecide(T, p, lv, Util.seeded('x')), T2 = JSON.parse(JSON.stringify(T));
        T2.seats.forEach((s, i) => { if (i !== p) s.hole = [-1, -1]; }); T2.deck = [];
        assert.deepStrictEqual(m.botDecide(T2, p, lv, Util.seeded('x')), a1);
    }
    const t0 = Date.now(); for (let i = 0; i < 10; i++) m.botDecide(T, p, 2, Math.random); assert.ok((Date.now() - t0) / 10 < 200, '單次決策應 < 200ms');
    const rr = Util.seeded('eq'); assert.ok(m.equity(H('Ah Ad'), [], 3, 400, rr) > m.equity(H('7h 2d'), [], 3, 400, rr) + .2);
    assert.strictEqual(m.botDecide(T, (p + 1) % 8, 1), null);
    ok('k9 電腦不偷看 / 運算量');
}

{ // 公開狀態、驗證、承諾核對、容錯
    const g = mk(3, {}, 'pub'); g.deal(); const T = g.T;
    const pub = (o = {}) => ({ ...m.publicOf(T), phase: 'play', names: ['a', 'b', 'c'], auto: [false, true, true], human: [true, false, false], gid: 'g', opts: OPTS(), tl: 0, commit: '', reveal: null, ...o });
    assert.ok(m.validPublic(pub())); assert.ok(!JSON.stringify(pub()).includes('"hole"') && !JSON.stringify(pub()).includes('"deck"'));
    for (const bad of [null, {}, pub({ names: ['a'] }), pub({ turn: 9 }), pub({ board: [1, 1] }), pub({ hs: 'x' }), pub({ seats: [] }), pub({ shown: { 7: [1, 2] } }), pub({ reveal: { salt: 'a', deck: [1] } }), pub({ pot: -1 }), pub({ log: 'x' })]) assert.ok(!m.validPublic(bad));
    assert.ok(m.validPublic({ phase: 'lobby', names: ['a'], opts: {} })); assert.ok(!m.validPublic({ phase: 'lobby', names: 'a', opts: {} }));
    assert.deepStrictEqual(pub().shown, {});                                        // 攤牌前沒有任何亮牌
    const salt = 'abc', deck = T.deck.slice();
    for (let i = 0; i < 20 && T.phase !== 'done'; i++) { const p = T.turn; m.applyAct(T, p, m.legal(T, p).canCheck ? { t: 'CHECK' } : { t: 'CALL' }); }
    assert.strictEqual(T.phase, 'done');
    const P = pub({ commit: 'H', reveal: { salt, deck } }); assert.ok(m.validPublic(P) && Object.keys(P.shown).length === 3);
    assert.ok(m.checkReveal(P, 'H', 1, T.seats[1].hole)); assert.ok(!m.checkReveal(P, 'X', 1, T.seats[1].hole));
    assert.ok(!m.checkReveal(P, 'H', 1, T.seats[0].hole));
    assert.ok(!m.checkReveal({ ...P, board: P.board.slice(0, 4).concat((P.board[4] + 1) % 52) }, 'H', -1, []));
    assert.strictEqual(m.commitText('s', [1, 2]), 's:1,2');
    assert.deepStrictEqual(m.cleanOpts(null), { seats: 4, level: 1, chips: 1000, blind: 1, up: 10, timer: 30 });
    assert.strictEqual(m.cleanOpts({ seats: 99, chips: 7, blind: -1, level: 'x' }).seats, 4); assert.strictEqual(m.cleanOpts({ seats: 8 }).seats, 8);
    assert.deepStrictEqual(m.cleanStats('zzz'), { hands: 0, wins: 0, games: 0, titles: 0 });
    assert.deepStrictEqual(m.cleanStats({ hands: 5.7, wins: -1, games: NaN, titles: 1e12 }), { hands: 5, wins: 0, games: 0, titles: 0 });
    assert.deepStrictEqual(m.cleanAct({ t: 'RAISE', to: 5, x: 1 }), { t: 'RAISE', to: 5 }); assert.strictEqual(m.cleanAct({ t: 'RAISE', to: Infinity }), null);
    assert.deepStrictEqual(m.makeDeck(Util.seeded('s')), m.makeDeck(Util.seeded('s'))); assert.strictEqual(new Set(m.makeDeck(Util.seeded('s'))).size, 52);
    ok('k9 公開狀態 / 驗證 / 承諾 / 容錯');
}
