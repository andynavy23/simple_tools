const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- 大老二 ----------
{
    const m = load('mini-games/big-two.html', 'RANKS, SUITS, rankOf, suitOf, validId, cardName, KIND_NAME, cleanRules, ruleText, classify, beats, combos, candidates, legalPlays, newGame, playCards, passTurn, scoreRound, autoMove, rankedPlays, cpuMove, hintList, validPublic, viewOf, straightKey');
    const R = (o) => m.cleanRules(o);
    const rules = R({}), all = R({ straight: 'all', triple: true }), none = R({ straight: 'none' });
    // 牌：點數 + 花色（C 梅花 D 方塊 H 紅心 S 黑桃）
    const card = (s) => { const su = 'CDHS'.indexOf(s.slice(-1)), r = m.RANKS.indexOf(s.slice(0, -1)); assert.ok(su >= 0 && r >= 0, s); return r * 4 + su; };
    const cs = (s) => s.split(' ').map(card).sort((a, b) => a - b);
    const cl = (s, r = rules) => m.classify(cs(s), r);
    const kind = (s, r = rules) => (cl(s, r) || {}).kind || null;

    // --- 牌的編碼與大小 ---
    assert.strictEqual(card('3C'), 0); assert.strictEqual(card('2S'), 51);
    assert.ok(card('3S') < card('4C') && card('KS') < card('AC') && card('AS') < card('2C'), '點數優先：2 最大、3 最小');
    assert.ok(card('5C') < card('5D') && card('5D') < card('5H') && card('5H') < card('5S'), '花色 ♣ < ♦ < ♥ < ♠');
    assert.strictEqual(m.cardName(0), '♣3'); assert.strictEqual(m.cardName(51), '♠2'); assert.strictEqual(m.cardName(card('10H')), '♥10');
    assert.ok(!m.validId(-1) && !m.validId(52) && !m.validId(1.5) && !m.validId('3') && m.validId(0) && m.validId(51));
    ok('big-two: card encoding (3 lowest, 2 highest, suits C<D<H<S)');

    // --- 規則容錯 ---
    assert.deepStrictEqual(R(null), { straight: 'low', triple: false, must3: true, dbl10: true, timer: 60 });
    assert.deepStrictEqual(R({ straight: 'x', triple: 'yes', must3: 0, dbl10: 'no', timer: 7 }), { straight: 'low', triple: false, must3: true, dbl10: true, timer: 60 });
    assert.deepStrictEqual(R({ straight: 'all', triple: true, must3: false, dbl10: false, timer: 0 }), { straight: 'all', triple: true, must3: false, dbl10: false, timer: 0 });
    for (const bad of [undefined, 5, 'a', [], [1], NaN]) assert.deepStrictEqual(R(bad), R({}));
    assert.ok(m.ruleText(rules).includes('A2345') && m.ruleText(R({ timer: 0 })).includes('不限時'));
    ok('big-two: cleanRules tolerates broken data');

    // --- 牌型 ---
    assert.strictEqual(kind('3C'), 'single'); assert.strictEqual(kind('5C 5H'), 'pair'); assert.strictEqual(kind('5C 6H'), null);
    assert.strictEqual(kind('5C 5D 5H'), null, '預設不能單出三條'); assert.strictEqual(kind('5C 5D 5H', all), 'triple'); assert.strictEqual(kind('5C 5D 6H', all), null);
    assert.strictEqual(kind('5C 5D 5H 5S'), null, '四張不是牌型'); assert.strictEqual(m.classify([], rules), null); assert.strictEqual(m.classify(cs('3C 4C 5C 6C 7C 8C'), rules), null);
    assert.strictEqual(m.classify([0, 0], rules), null, '重複的牌'); assert.strictEqual(m.classify([0, 99], rules), null); assert.strictEqual(m.classify('x', rules), null); assert.strictEqual(m.classify([1.5], rules), null);
    assert.strictEqual(kind('3C 4D 5H 6S 7C'), 'straight'); assert.strictEqual(kind('10C JD QH KS AC'), 'straight');
    assert.strictEqual(kind('3C 4C 5C 6C 7C'), 'sf'); assert.strictEqual(kind('3C 4C 5C 6C 9C'), 'flush');
    assert.strictEqual(kind('3C 3D 3H 9S 9C'), 'full'); assert.strictEqual(kind('3C 3D 3H 3S 9C'), 'quad');
    assert.strictEqual(kind('3C 3D 4H 4S 9C'), null, '兩對不是牌型'); assert.strictEqual(kind('3C 3D 3H 4S 5C'), null);
    // 順子規則：A2345 / 23456 / JQKA2 / QKA23（永遠不行）
    for (const [mode, a2345, s23456, jqka2] of [['none', 0, 0, 0], ['low', 1, 1, 0], ['all', 1, 1, 1]]) {
        const r = R({ straight: mode });
        assert.strictEqual(kind('AC 2D 3H 4S 5C', r) === 'straight', !!a2345, mode + ' A2345');
        assert.strictEqual(kind('2C 3D 4H 5S 6C', r) === 'straight', !!s23456, mode + ' 23456');
        assert.strictEqual(kind('JC QD KH AS 2C', r) === 'straight', !!jqka2, mode + ' JQKA2');
        assert.strictEqual(kind('QC KD AH 2S 3C', r), null, mode + ' QKA23'); assert.strictEqual(kind('KC AD 2H 3S 4C', r), null, mode + ' KA234');
        assert.strictEqual(kind('10C JD QH KS AC', r), 'straight'); assert.strictEqual(kind('3C 4D 5H 6S 7C', r), 'straight');
    }
    assert.strictEqual(kind('AC 2C 3C 4C 5C'), 'sf'); assert.strictEqual(kind('AC 2C 3C 4C 5C', none), 'flush');
    ok('big-two: classify (single/pair/triple option/5-card kinds/straight modes)');

    // --- 大小 ---
    const pw = (s, r = rules) => cl(s, r).power, gt = (a, b, r = rules) => assert.ok(pw(a, r) > pw(b, r), `${a} 應大於 ${b}`);
    gt('3S', '3H'); gt('4C', '3S'); gt('2C', 'AS'); gt('5H 5S', '5C 5D'); gt('6C 6D', '5H 5S'); gt('2C 2D', 'AH AS');
    // 五張牌型：順子 < 同花 < 葫蘆 < 鐵支 < 同花順
    gt('3C 4C 5C 6C 9C', '10C JD QH KS AC'); gt('3C 3D 3H 9S 9C', 'AS KS QS JS 9S');
    gt('4C 4D 4H 4S 3C', '2C 2D 2H 9S 9C'); gt('3C 4C 5C 6C 7C', '2C 2D 2H 2S AC');
    // 順子：比最大那張，同點比花色；預設 A2345 < 23456 < 34567
    gt('4C 5D 6H 7S 8C', '3C 4D 5H 6S 7C'); gt('3C 4D 5H 6S 7S', '3D 4C 5H 6S 7H'); gt('10C JD QH KS AC', '9C 10D JH QS KC');
    gt('3C 4D 5H 6S 7C', '2C 3D 4H 5S 6C'); gt('2C 3D 4H 5S 6C', 'AC 2D 3H 4S 5C'); gt('JC QD KH AS 2C', '10C JD QH KS AC', all);
    gt('2C 3D 4H 5S 6S', '2C 3D 4H 5S 6C');       // 同為 23456：比 6 的花色
    gt('3C 4D 5H 6S 7C', 'AC 2D 3H 4S 5C');
    // 同花：先比花色，再由大到小比點數
    gt('3S 4S 5S 6S 8S', 'AH KH QH JH 9H'); gt('3H 4H 5H 6H 9H', 'AD KD QD JD 9D'); gt('3C 4C 5C 6C 9C', '3C 4C 5C 7C 8C'); gt('3C 4C 5C 7C 9C', '3C 4C 6C 7C 8C');
    // 葫蘆比三條點數；鐵支比四條點數；同花順比順子規則
    gt('5C 5D 5H 3S 3C', '4C 4D 4H AS AC'); gt('5C 5D 5H 5S 3C', '4C 4D 4H 4S AC'); gt('4C 5C 6C 7C 8C', '3C 4C 5C 6C 7C'); gt('3D 4D 5D 6D 7D', '3C 4C 5C 6C 7C');
    gt('2S 3S 4S 5S 6S', 'AS 2S 3S 4S 5S'); gt('3C 4C 5C 6C 7C', 'AS 2S 3S 4S 5S');
    assert.ok(m.beats(cl('4C'), cl('3S')) && !m.beats(cl('3S'), cl('4C')) && !m.beats(cl('5C 5D'), cl('3S')), '張數不同不能比');
    assert.ok(!m.beats(cl('4C'), cl('4C')), '不能壓自己');
    ok('big-two: ordering of every kind (suit, rank, straight keys, flush by suit-first)');

    // --- 發牌 ---
    const shuf = (seed) => { const r = Util.seeded(seed); return (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = r.int(i + 1);[x[i], x[j]] = [x[j], x[i]]; } return x; }; };
    for (let i = 0; i < 5000; i++) {
        const g = m.newGame(i % 2 ? shuf('d' + i) : (a) => Util.shuffle(a), rules), flat = g.hands.flat();
        assert.strictEqual(flat.length, 52); assert.strictEqual(new Set(flat).size, 52); assert.ok(flat.every(m.validId));
        assert.ok(g.hands.every(h => h.length === 13 && h.every((c, k) => k === 0 || h[k - 1] < c)), 'each hand 13 cards, ascending');
        assert.ok(g.hands[g.turn].includes(0), '梅花 3 先手'); assert.strictEqual(g.first, true); assert.strictEqual(g.last, null);
    }
    assert.strictEqual(m.newGame(shuf('x'), R({ must3: false })).first, false);
    ok('big-two: 5000 deals = 52 unique cards, 13 each, ♣3 holder leads');

    // --- 合法出牌列舉：和暴力法逐一比對 ---
    const brute = (hand, last, first, r) => {
        const out = new Set();
        for (const k of [1, 2, 3, 5]) for (const c of m.combos(hand.slice().sort((a, b) => a - b), k)) {
            const x = m.classify(c, r); if (!x) continue;
            if (last ? (x.n === last.n && x.power > last.power) : (!(first && r.must3) || c.includes(0))) out.add(c.join());
        }
        return out;
    };
    const rr = Util.seeded('brute');
    for (let i = 0; i < 400; i++) {
        const r = R({ straight: ['none', 'low', 'all'][i % 3], triple: i % 2 === 0, must3: i % 4 < 2 }), g = m.newGame(shuf('b' + i), r), p = i % 4;
        if (i % 5) { const q = (p + 1) % 4; const plays = m.candidates(g.hands[q], r); const pl = plays[rr.int(plays.length)]; g.last = { p: q, cards: pl.cards, n: pl.n, kind: pl.kind, power: pl.power }; g.first = false; }
        else if (i % 10 === 0) g.first = true; else g.first = false;
        const fast = m.legalPlays(g, p), fk = new Set(fast.map(x => x.cards.join()));
        assert.strictEqual(fk.size, fast.length, '列舉沒有重複');
        assert.deepStrictEqual([...fk].sort(), [...brute(g.hands[p], g.last, g.first, r)].sort(), `第 ${i} 手：列舉與暴力法一致`);
    }
    ok('big-two: legalPlays == brute-force over all 1/2/3/5-card subsets (400 hands, all rule combos)');

    // --- 隨機對局 5000 手：每個列舉出的出牌都合法、被 playCards 接受；非法出牌被拒且不動牌局 ---
    {
        let checked = 0;
        const snap = (g) => JSON.stringify([g.hands, g.turn, g.last, g.passed, g.first, g.winner, g.pile, g.moves]);
        for (let i = 0; i < 5000; i++) {
            const r = R({ straight: ['none', 'low', 'all'][i % 3], triple: i % 2 === 0 }), g = m.newGame(shuf('s' + i), r), rnd = Util.seeded('sr' + i);
            for (let step = 0; step < 4 && g.winner < 0; step++) {   // 每手牌打幾步
                const p = g.turn, legal = m.legalPlays(g, p);
                // 非法：別人的回合、不在手上的牌、重複的牌、牌型不成立、超長陣列、非陣列
                const before = snap(g), other = (p + 1) % 4;
                assert.ok(!m.playCards(g, other, [g.hands[other][0]]), 'not your turn');
                assert.ok(!m.playCards(g, p, [g.hands[other][0]]), 'card not in my hand');
                assert.strictEqual(snap(g), before, 'illegal moves leave the game untouched');
                for (const bad of [[], [-1], [0, 0], [99], 'x', null, { length: 1 }, [g.hands[p][0], g.hands[p][0]], Array(6).fill(0).map((_, k) => k), [1.5], ['3']]) {
                    assert.ok(!m.playCards(g, p, bad), 'bad payload ' + JSON.stringify(bad)); assert.strictEqual(snap(g), before);
                }
                if (!g.last) assert.ok(legal.length > 0 && !m.passTurn(g, p), '領出的人一定有牌可出、不能過牌');
                assert.strictEqual(snap(g), before);
                // 每個列舉出的合法出牌都真的被接受（在複本上試）
                for (const pl of legal.slice(0, 6)) {
                    assert.ok(pl.cards.every(c => g.hands[p].includes(c)) && m.classify(pl.cards, r), 'listed play is real');
                    if (g.last) assert.ok(m.beats(m.classify(pl.cards, r), g.last), 'listed play beats table');
                    const g2 = JSON.parse(JSON.stringify(g)); g2.rules = r; assert.ok(m.playCards(g2, p, pl.cards)); checked++;
                }
                // 不在列舉裡的牌型（用壓不過的）被拒
                if (g.last) { const weak = m.candidates(g.hands[p], r).filter(x => x.n === g.last.n && x.power <= g.last.power); for (const w of weak.slice(0, 5)) assert.ok(!m.playCards(g, p, w.cards)); assert.strictEqual(snap(g), before); }
                if (legal.length && (!g.last || rnd() < 0.7)) assert.ok(m.playCards(g, p, legal[rnd.int(legal.length)].cards)); else assert.ok(m.passTurn(g, p));
            }
        }
        assert.ok(checked > 8000);
        ok(`big-two: 5000 random deals x 4 plies: every listed play legal & accepted (${checked}), illegal ones rejected without side effects`);
    }

    // --- 全序與傳遞性 ---
    {
        const r = Util.seeded('order');
        for (let i = 0; i < 5000; i++) {
            const g = m.newGame(shuf('o' + i), i % 2 ? all : rules), pls = [0, 1, 2, 3].map(p => m.candidates(g.hands[p], g.rules));
            // 不同手牌（卡片不重複）的同張數牌型：嚴格全序，沒有平手
            for (const n of [1, 2, 3, 5]) {
                const pool = pls.flatMap((c, p) => c.filter(x => x.n === n).slice(0, 12).map(x => ({ ...x, p })));
                for (let t = 0; t < 8 && pool.length > 2; t++) {
                    const a = pool[r.int(pool.length)], b = pool[r.int(pool.length)], c = pool[r.int(pool.length)];
                    if (a.p !== b.p) assert.ok((a.power > b.power) !== (b.power > a.power), `不同家的牌沒有平手 ${a.cards} vs ${b.cards}`);
                    const lt = (x, y) => x.power < y.power;       // 傳遞性
                    if (lt(a, b) && lt(b, c)) assert.ok(lt(a, c));
                    assert.ok(!(m.beats(a, b) && m.beats(b, a)), '反對稱');
                }
            }
        }
        // 同一手牌內：power 完全由 (kind tier, key) 決定，kind 排序固定
        const tier = { straight: 1, flush: 2, full: 3, quad: 4, sf: 5 };
        for (let i = 0; i < 1000; i++) {
            const g = m.newGame(shuf('t' + i), all), five = m.candidates(g.hands[i % 4], all).filter(x => x.n === 5);
            for (let t = 0; t < 30 && five.length > 1; t++) {
                const a = five[r.int(five.length)], b = five[r.int(five.length)];
                if (tier[a.kind] !== tier[b.kind]) assert.strictEqual(a.power > b.power, tier[a.kind] > tier[b.kind], '牌型等級決定大小');
            }
        }
        ok('big-two: comparison is antisymmetric, transitive, and a strict total order across disjoint hands (5000 deals)');
    }

    // --- 流程：先手限制、過牌鎖定、重新領出、勝負與計分 ---
    {
        const mk = (hands, turn, r = rules) => ({ hands: hands.map(h => cs(h).sort((a, b) => a - b)), turn, last: null, passed: [false, false, false, false], first: false, winner: -1, rules: r, pile: [], moves: 0, log: '' });
        // 第一手必須含 ♣3
        let g = mk(['3C 4C 9D', '5C 6C', '7C 8C', '10C JC'], 0); g.first = true;
        assert.ok(!m.playCards(g, 0, cs('4C')), '第一手不含 ♣3 被拒'); assert.ok(m.playCards(g, 0, cs('3C')) && g.first === false && g.turn === 1);
        g = mk(['3C 4C 9D', '5C 6C', '7C 8C', '10C JC'], 0, R({ must3: false })); g.first = false;
        assert.ok(m.playCards(g, 0, cs('9D')), '關閉規則後第一手可出任意牌');
        // 過牌鎖定：B 過牌後不能再出，直到新的一輪
        g = mk(['5C 5D 9H KS', '6C 6D 7H', '7C 7D 8H', '8C 8D 9S'], 0);
        assert.ok(!m.passTurn(g, 0), '領出者不能過牌'); assert.ok(m.playCards(g, 0, cs('5C')) && g.turn === 1);
        assert.ok(!m.passTurn(g, 2), '沒輪到不能過'); assert.ok(m.passTurn(g, 1) && g.passed[1] && g.turn === 2);
        assert.ok(m.playCards(g, 2, cs('7C')) && g.turn === 3, '2 出牌後換 3');
        assert.ok(m.passTurn(g, 3) && g.turn === 0, '3 過牌後輪到 0（1 已過牌被跳過）');
        assert.ok(m.playCards(g, 0, cs('9H')) && g.turn === 2, '0 出牌後直接輪到 2（1 與 3 已過牌，被跳過）');
        assert.ok(m.passTurn(g, 2) && g.turn === 0 && g.last === null && g.passed.every(x => !x), '其他人都過牌：最後出牌的 0 重新領出');
        assert.ok(m.playCards(g, 0, cs('5D')) && g.turn === 1, '新一輪所有人恢復可出');
        // 贏家：出完手牌；之後不能再動
        g = mk(['3C', '4C 5C', '6C 7C', '8C 9C 10C'], 0); assert.ok(m.playCards(g, 0, cs('3C')) && g.winner === 0);
        assert.ok(!m.playCards(g, 1, cs('4C')) && !m.passTurn(g, 1));
        assert.deepStrictEqual(m.scoreRound(g), [2 + 2 + 3, -2, -2, -3]);
        // 計分：剩 10 張以上加倍（可關）
        g = mk(['3C', 'AC AD AH AS 2C 2D 2H 2S KC KD', '4C 5C', '6C 7C 8C'], 0); g.winner = 0; g.hands[0] = [];
        assert.deepStrictEqual(m.scoreRound(g), [20 + 2 + 3, -20, -2, -3]);
        g.rules = R({ dbl10: false }); assert.deepStrictEqual(m.scoreRound(g), [10 + 2 + 3, -10, -2, -3]);
        for (let i = 0; i < 200; i++) { const h = m.newGame(shuf('sc' + i), rules); h.winner = i % 4; h.hands[h.winner] = []; assert.strictEqual(m.scoreRound(h).reduce((a, b) => a + b, 0), 0, '計分總和為零'); }
        // 逾時自動
        g = mk(['3C 9D', '4C', '5C', '6C'], 0); assert.deepStrictEqual(m.autoMove(g, 0), { t: 'PLAY', cards: [0] });
        g.last = { p: 1, cards: cs('4C'), n: 1, kind: 'single', power: card('4C') }; assert.deepStrictEqual(m.autoMove(g, 0), { t: 'PASS' });
        for (let i = 0; i < 300; i++) { const h = m.newGame(shuf('au' + i), rules); const mv = m.autoMove(h, h.turn); assert.ok(m.playCards(h, h.turn, mv.cards), '自動出牌一定合法（含第一手）'); }
        ok('big-two: first-move rule, pass lock, trick reset, win, scoring, timeout auto-move');
    }

    // --- 電腦玩家 ---
    const play = (levels, seed, r = rules, spy) => {
        const g = m.newGame(shuf(seed), r), rand = Util.seeded('cpu' + seed); let plays = 0, passes = 0;
        for (let n = 0; n < 1500 && g.winner < 0; n++) {
            const p = g.turn, mv = m.cpuMove(g, p, levels[p], rand);
            if (spy) spy(g, p, mv);
            const okk = mv.t === 'PLAY' ? m.playCards(g, p, mv.cards) : m.passTurn(g, p);
            assert.ok(okk, `電腦（${levels[p]}）出了非法的一步 ${JSON.stringify(mv)}`);
            mv.t === 'PLAY' ? plays++ : passes++;
        }
        assert.ok(g.winner >= 0, '對局必須打完'); assert.strictEqual(g.hands[g.winner].length, 0);
        const left = g.hands.flat().concat(g.pile); assert.strictEqual(new Set(left).size, 52); assert.strictEqual(left.length, 52, '牌的總數不變');
        return { g, plays, passes, winner: g.winner };
    };
    {
        // 每一步都合法、打得完（三種程度混打、三種順子規則、三條規則）
        let totalPlays = 0, games = 0, maxSteps = 0;
        const t0 = Date.now();
        for (let i = 0; i < 1000; i++) {
            const lv = [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], [2, 1, 0, 1]][i % 4], r = R({ straight: ['none', 'low', 'all'][i % 3], triple: i % 5 === 0, must3: i % 7 !== 0 });
            const res = play(lv, 'sp' + i, r); totalPlays += res.plays; games++; maxSteps = Math.max(maxSteps, res.plays + res.passes);
        }
        const avg = totalPlays / games;
        assert.ok(avg > 8 && avg < 80, `平均每局出牌手數合理（${avg.toFixed(1)}）`); assert.ok(maxSteps < 700, '沒有卡死的長局 ' + maxSteps);
        ok(`big-two: 1000 CPU self-play games all finish legally (avg ${avg.toFixed(1)} plays/game, longest ${maxSteps} steps, ${Date.now() - t0}ms)`);
    }
    {
        // 電腦不偷看：把別人的牌換成占位後，決策完全相同
        for (let i = 0; i < 300; i++) {
            const r = R({ triple: i % 2 === 0 }), g = m.newGame(shuf('pk' + i), r), lv = i % 3;
            for (let step = 0; step < 20 && g.winner < 0; step++) {
                const p = g.turn, pub = { counts: g.hands.map(h => h.length), last: g.last && { p: g.last.p, cards: g.last.cards }, passed: g.passed, first: g.first, rules: r, winner: g.winner };
                const view = m.viewOf(pub, p, g.hands[p]);
                assert.ok(view.hands.every((h, q) => q === p || h.every(c => c === -1)), '視圖不含別人的牌');
                const a = m.cpuMove(g, p, lv, Util.seeded('pk' + i + step)), b = m.cpuMove(view, p, lv, Util.seeded('pk' + i + step));
                assert.deepStrictEqual(a, b, '電腦的決策只依賴公開資訊');
                const hl = m.hintList(view, p); assert.ok(hl.plays.every(pl => m.classify(pl, r)));
                a.t === 'PLAY' ? m.playCards(g, p, a.cards) : m.passTurn(g, p);
            }
        }
        ok('big-two: CPU decisions identical on a redacted view (no peeking) and hints are legal');
    }
    {
        // 強度：困難 / 普通明顯贏過簡單（隨機基準 25%）；領出時電腦不會讓人「一手出完」之外的非法行為
        const wins = (lv, n, base) => { let w = 0; for (let i = 0; i < n; i++) { const seat = i % 4, L = [0, 0, 0, 0]; L[seat] = lv; if (play(L, base + i).winner === seat) w++; } return w / n; };
        const w2 = wins(2, 400, 'str2-'), w1 = wins(1, 400, 'str1-');
        assert.ok(w2 > 0.4, `困難對 3 位簡單的勝率 ${w2}`); assert.ok(w1 > 0.4, `普通對 3 位簡單的勝率 ${w1}`);
        ok(`big-two: CPU strength — hard wins ${(w2 * 100).toFixed(0)}%, normal ${(w1 * 100).toFixed(0)}% vs three easy (random = 25%)`);
        // 行為：對手剩 1 張時，困難跟單張會出最大的；領出時不先出單張
        const g = { hands: [cs('4C 9D KS'), Array(1).fill(-1), Array(8).fill(-1), Array(8).fill(-1)], turn: 0, last: { p: 1, cards: cs('3D'), n: 1, kind: 'single', power: card('3D') }, passed: [false, false, false, false], first: false, rules, winner: -1 };
        assert.deepStrictEqual(m.cpuMove(g, 0, 2, () => 0.5), { t: 'PLAY', cards: cs('KS') }, '對手剩 1 張 → 出最大單張壓制');
        assert.deepStrictEqual(m.cpuMove(g, 0, 1, () => 0.5), { t: 'PLAY', cards: cs('4C') }, '普通：能小就出小');
        g.last = null; g.hands[0] = cs('4C 4D 9D'); assert.deepStrictEqual(m.cpuMove(g, 0, 2, () => 0.5), { t: 'PLAY', cards: cs('4C 4D') }, '對手剩 1 張 → 領出避開單張，改出對子');
        g.hands[0] = cs('4C 5D 9H'); assert.deepStrictEqual(m.cpuMove(g, 0, 2, () => 0.5), { t: 'PLAY', cards: cs('9H') }, '只有單張可出時出最大的');
        // 保留大牌：手牌多、只有 2 可壓過 → 普通 / 困難過牌；手牌少則會出
        const g2 = { hands: [cs('3C 4C 5D 6H 8S 9C 10D 2S'), Array(10).fill(-1), Array(10).fill(-1), Array(10).fill(-1)], turn: 0, last: { p: 1, cards: cs('KC'), n: 1, kind: 'single', power: card('KC') }, passed: [false, false, false, false], first: false, rules, winner: -1 };
        assert.deepStrictEqual(m.cpuMove(g2, 0, 1, () => 0.5), { t: 'PASS' }, '手牌多：不浪費 2'); g2.hands[0] = cs('9C 2S'); assert.strictEqual(m.cpuMove(g2, 0, 1, () => 0.5).t, 'PLAY');
        // 不拆對子：領出時先出單張 3 而不是拆 5 5 的牌；保留鐵支
        const g3 = { hands: [cs('3C 5C 5D 9H JS QS KD AD 2C 2D'), Array(8).fill(-1), Array(8).fill(-1), Array(8).fill(-1)], turn: 0, last: null, passed: [false, false, false, false], first: false, rules, winner: -1 };
        assert.deepStrictEqual(m.cpuMove(g3, 0, 2, () => 0.5), { t: 'PLAY', cards: cs('3C') });
        const g4 = { hands: [cs('3C 4D 5H 6S 7C 8D 8H 8S 8C KD AD'), Array(8).fill(-1), Array(8).fill(-1), Array(8).fill(-1)], turn: 0, last: null, passed: [false, false, false, false], first: false, rules, winner: -1 };
        const mv4 = m.cpuMove(g4, 0, 2, () => 0.5); assert.ok(mv4.t === 'PLAY' && m.classify(mv4.cards, rules).kind !== 'quad', '手牌還多時不先丟鐵支');
        // 一手出完就出
        g4.hands[0] = cs('5C 5D 5H 9S 9C'); assert.deepStrictEqual(m.cpuMove(g4, 0, 1, () => 0.5), { t: 'PLAY', cards: cs('5C 5D 5H 9S 9C') });
        // 無牌可壓：過牌
        g2.hands[0] = cs('3C 4C'); assert.deepStrictEqual(m.cpuMove(g2, 0, 2, () => 0.5), { t: 'PASS' });
        ok('big-two: CPU behaviour (small first, keeps 2s/bombs/pairs, suppresses near-out opponent, goes out)');
    }

    // --- 公開狀態驗證 / 視圖 ---
    {
        const good = { phase: 'play', names: ['a', 'b', 'c', 'd'], auto: [false, true, true, true], counts: [13, 13, 13, 13], turn: 0, last: null, passed: [false, false, false, false], first: true, winner: -1, log: '', rules, tl: 0, mv: 0, scores: [0, 0, 0, 0], rest: null, delta: null };
        assert.ok(m.validPublic(good));
        const bad = (f) => { const s = JSON.parse(JSON.stringify(good)); f(s); assert.ok(!m.validPublic(s), f.toString()); };
        bad(s => { s.phase = 'x'; }); bad(s => { s.names = ['a']; }); bad(s => { s.names[0] = 5; }); bad(s => { s.names[0] = 'x'.repeat(13); }); bad(s => { s.auto = [1, 0, 0, 0]; });
        bad(s => { s.counts[0] = 14; }); bad(s => { s.counts[0] = -1; }); bad(s => { s.counts[1] = 1.5; }); bad(s => { s.turn = 4; }); bad(s => { s.winner = 9; });
        bad(s => { s.last = { p: 4, cards: [0] }; }); bad(s => { s.last = { p: 0, cards: [] }; }); bad(s => { s.last = { p: 0, cards: [52] }; }); bad(s => { s.last = { p: 0, cards: [0, 1, 2, 3, 4, 5] }; });
        bad(s => { s.tl = -1; }); bad(s => { s.mv = 'x'; }); bad(s => { s.scores = [0, 0, 0]; }); bad(s => { s.rest = [[], [], []]; }); bad(s => { s.rest = [[99], [], [], []]; }); bad(s => { s.delta = [1, 2, 3, 'x']; }); bad(s => { s.log = 'x'.repeat(61); });
        assert.ok(!m.validPublic(null) && !m.validPublic('x') && !m.validPublic([]));
        assert.ok(m.validPublic({ ...good, last: { p: 1, cards: [4, 5] }, rest: [[0], [], [], [1, 2]], delta: [3, -1, -1, -1], tl: 30, mv: 5 }));
        // viewOf：壞規則 / 壞的桌面牌容錯
        const v = m.viewOf({ ...good, last: { p: 1, cards: [4, 5] }, rules: { straight: 'bogus' } }, 0, [0, 1, 2]);
        assert.strictEqual(v.rules.straight, 'low'); assert.strictEqual(v.last.kind, 'pair'); assert.deepStrictEqual(v.hands[0], [0, 1, 2]); assert.strictEqual(v.hands[1].length, 13);
        assert.strictEqual(m.viewOf({ ...good, last: { p: 1, cards: [4, 8] } }, 0, [0]).last, null, '桌面牌不成牌型 → 當作沒有');
        ok('big-two: validPublic rejects malformed host messages; viewOf is tolerant');
    }
}
