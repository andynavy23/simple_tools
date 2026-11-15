// r7 批次：hearts-games 純邏輯（發牌、換牌、合法出牌、墩贏家、紅心 / 拱豬計分、射月 / 賣牌 / 全收、電腦、驗證）
const { load, ok } = require('./_load');
const assert = require('assert');
const H = load('mini-games/hearts-games.html', 'newRound, submit, legalCards, trickWinner, playCard, heartsDelta, pigScore, gameEnd, cpuPlay, cpuPass, cpuSell, cleanOpts, cleanStats, validPublic, passTo, PASS_DIRS, heartPts, roundScore, suitOf, rankOf, PIG, SHEEP, TRANS, HA, SELLABLE');
const { newRound, submit, legalCards, trickWinner, playCard, pigScore, heartsDelta, gameEnd, cpuPlay, cpuPass, cpuSell, cleanOpts, cleanStats, validPublic, passTo, PASS_DIRS, heartPts, suitOf, rankOf, PIG, SHEEP, TRANS, HA } = H;
const shuf = (a) => Util.shuffle(a);
const O = (x) => cleanOpts(x);
const card = (s, r) => s * 13 + r;       // 花色 0♣ 1♦ 2♥ 3♠；點數 0=2 … 12=A

{   // 發牌：52 張各一、每人 13 張；♣2 持有人先出
    const g = newRound(O({ mode: 'pig', sell: false }), 0, shuf);
    assert.deepStrictEqual(g.hands.flat().sort((a, b) => a - b), Array.from({ length: 52 }, (_, i) => i));
    assert.ok(g.hands.every(h => h.length === 13));
    assert.strictEqual(g.phase, 'play'); assert.ok(g.hands[g.turn].includes(0));
    assert.strictEqual(newRound(O({ mode: 'pig' }), 0, shuf).phase, 'sell');
    assert.strictEqual(newRound(O({ mode: 'hearts' }), 3, shuf).phase, 'play');      // 第 4 局不傳牌
    assert.strictEqual(newRound(O({ mode: 'hearts' }), 0, shuf).phase, 'pass');
    assert.deepStrictEqual([0, 1, 2, 3].map(i => passTo(i, 'left')), [1, 2, 3, 0]);
    assert.deepStrictEqual([0, 1, 2, 3].map(i => passTo(i, 'across')), [2, 3, 0, 1]);
    assert.deepStrictEqual([0, 1, 2, 3].map(i => passTo(i, 'right')), [3, 0, 1, 2]);
}
{   // 換牌：驗證 + 套用
    const g = newRound(O({ mode: 'hearts' }), 0, shuf), before = g.hands.map(h => h.slice());
    assert.ok(!submit(g, 0, [before[1][0], before[1][1], before[1][2]]));           // 別人的牌
    assert.ok(!submit(g, 0, before[0].slice(0, 2)));                                // 張數不對
    assert.ok(!submit(g, 0, [before[0][0], before[0][0], before[0][1]]));           // 重複
    assert.ok(!submit(g, 0, ['a', 1, 2]) && !submit(g, 9, before[0].slice(0, 3)));
    for (let i = 0; i < 4; i++) assert.ok(submit(g, i, before[i].slice(0, 3)));
    assert.ok(!submit(g, 0, before[0].slice(0, 3)));                                // 階段已過
    assert.strictEqual(g.phase, 'play');
    for (let i = 0; i < 4; i++) { assert.strictEqual(g.hands[i].length, 13); before[(i + 3) % 4].slice(0, 3).forEach(c => assert.ok(g.hands[i].includes(c))); }
    assert.ok(g.hands[g.turn].includes(0));
}
{   // 賣牌：只能賣 豬 / 羊 / 變壓器 / 紅心 A，且要在手上
    const g = newRound(O({ mode: 'pig' }), 0, shuf);
    g.hands[0] = [PIG, SHEEP, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; g.hands[1] = [1, 2, 3, 4, 16, 17, 18, 19, 20, 21, 23, 24, 25]; g.hands[2] = [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38]; g.hands[3] = [39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 50, 51, 0].sort((a, b) => a - b);
    assert.ok(!submit(g, 0, [5]) && !submit(g, 1, [PIG]));
    assert.ok(submit(g, 0, [PIG]) && submit(g, 1, []) && submit(g, 2, [HA]) && submit(g, 3, []));
    assert.deepStrictEqual(g.sold, [[PIG], [], [HA], []]); assert.strictEqual(g.phase, 'play');
}
{   // 合法出牌：首墩 ♣2、跟花色、紅心未破、首墩不墊分（紅心大戰）、賣出的牌被領出花色時必須打出
    const base = (mode) => ({ mode, opts: O({ mode }), hands: [[], [], [], []], trick: [], nTrick: 0, broken: false, sold: [[], [], [], []], taken: [[], [], [], []] });
    let g = base('hearts'); g.hands[0] = [0, 5, 20, 30, 49];
    assert.deepStrictEqual(legalCards(g, 0), [0]);
    g.nTrick = 1; assert.deepStrictEqual(legalCards(g, 0), [0, 5, 20, 49]);          // 紅心未破：不能領紅心（30 是紅心）
    g.broken = true; assert.strictEqual(legalCards(g, 0).length, 5);
    g.hands[0] = [30, 31]; g.broken = false; assert.strictEqual(legalCards(g, 0).length, 2);   // 只剩紅心
    g = base('hearts'); g.hands[1] = [3, 4, 30, 49]; g.trick = [{ p: 0, c: 0 }];
    assert.deepStrictEqual(legalCards(g, 1), [3, 4]);                                 // 有梅花必須跟
    g.hands[1] = [30, 49, 20]; assert.deepStrictEqual(legalCards(g, 1), [20]);        // 首墩沒梅花：不能墊分數牌
    g.hands[1] = [30, 49]; assert.deepStrictEqual(legalCards(g, 1), [30, 49]);        // 只有分數牌：都能墊
    g.nTrick = 2; g.hands[1] = [30, 49, 20]; assert.strictEqual(legalCards(g, 1).length, 3);
    g = base('pig'); g.nTrick = 3; g.hands[2] = [40, 41, 49, 5]; g.trick = [{ p: 0, c: 42 }]; g.sold[2] = [49];
    assert.deepStrictEqual(legalCards(g, 2), [49]);                                   // 賣豬：黑桃被領出必須出豬
    g.sold[2] = []; assert.deepStrictEqual(legalCards(g, 2), [40, 41, 49]);
    g = base('pig'); g.nTrick = 3; g.hands[0] = [30, 5]; assert.strictEqual(legalCards(g, 0).length, 2);   // 拱豬沒有紅心未破限制
}
{   // 墩贏家：只有領出花色比大小
    assert.strictEqual(trickWinner([{ p: 0, c: card(0, 5) }, { p: 1, c: card(3, 12) }, { p: 2, c: card(0, 9) }, { p: 3, c: card(0, 2) }]), 2);
    assert.strictEqual(trickWinner([{ p: 3, c: 1 }, { p: 0, c: 2 }, { p: 1, c: 40 }, { p: 2, c: 0 }]), 0);
    // playCard 流程：非輪到 / 不合法被拒、收墩後贏家領出
    const g = newRound(O({ mode: 'pig', sell: false }), 0, shuf), s = g.turn;
    assert.ok(!playCard(g, (s + 1) % 4, g.hands[(s + 1) % 4][0]) && !playCard(g, s, 5));
    assert.ok(playCard(g, s, 0));
    for (let k = 1; k < 4; k++) { const p = (s + k) % 4; assert.ok(playCard(g, p, legalCards(g, p)[0])); }
    assert.strictEqual(g.trick.length, 0); assert.strictEqual(g.nTrick, 1); assert.strictEqual(g.taken.flat().length, 4); assert.strictEqual(g.turn, g.last.w);
}
{   // 紅心大戰計分與射月
    const none = [[], [], [], []], t = (a) => { const x = [[], [], [], []]; x[0] = a; return x; };
    const hearts = Array.from({ length: 13 }, (_, i) => 26 + i);
    assert.strictEqual(heartPts([PIG]), 13); assert.strictEqual(heartPts([26, 27, PIG]), 15);
    assert.deepStrictEqual(heartsDelta([[26, 27], [PIG], [28], []], O({})), [2, 13, 1, 0]);
    assert.deepStrictEqual(heartsDelta(t([...hearts, PIG]), O({ shoot: 'add' })), [0, 26, 26, 26]);
    assert.deepStrictEqual(heartsDelta(t([...hearts, PIG]), O({ shoot: 'sub' })), [-26, 0, 0, 0]);
    assert.deepStrictEqual(heartsDelta(none, O({})), [0, 0, 0, 0]);
    // 結束條件：達標、最低分勝（並列）
    assert.strictEqual(gameEnd('hearts', [10, 99, 40, 20], 5, O({})), null);
    assert.deepStrictEqual(gameEnd('hearts', [10, 100, 40, 10], 5, O({})), [0, 3]);
    assert.strictEqual(gameEnd('pig', [1, 2, 3, 4], 3, O({ rounds: 4 })), null);
    assert.deepStrictEqual(gameEnd('pig', [100, -50, 100, 0], 4, O({ rounds: 4 })), [0, 2]);
}
{   // 拱豬計分
    const o = O({});
    assert.strictEqual(pigScore([PIG], [], o), -100); assert.strictEqual(pigScore([SHEEP], [], o), 100);
    assert.strictEqual(pigScore([PIG], [PIG], o), -200);                               // 賣豬 ×2
    assert.strictEqual(pigScore([card(2, 12), card(2, 11), card(2, 10), card(2, 9), card(2, 5)], [], o), -(50 + 40 + 30 + 20 + 10));
    assert.strictEqual(pigScore([card(2, 12), card(2, 0)], [], O({ blood: 'flat' })), -20);
    assert.strictEqual(pigScore([card(2, 12)], [HA], o), -100);                         // 賣紅心 A
    assert.strictEqual(pigScore([TRANS], [], o), 50);                                   // 只有變壓器 +50
    assert.strictEqual(pigScore([TRANS], [TRANS], o), 100);
    assert.strictEqual(pigScore([TRANS, PIG], [], o), -200);                            // 變壓器 ×2
    assert.strictEqual(pigScore([TRANS, SHEEP], [], o), 200);
    assert.strictEqual(pigScore([TRANS, PIG], [TRANS], o), -400);
    assert.strictEqual(pigScore([PIG, SHEEP], [], o), 0);
    assert.strictEqual(pigScore([5, 6, 7], [], o), 0);
    const all = [PIG, SHEEP, TRANS, ...Array.from({ length: 13 }, (_, i) => 26 + i)];
    assert.strictEqual(pigScore(all, [], O({ sweep: true })), 460);                     // (-100+100-230)×2 = -460，全收顛倒
    assert.strictEqual(pigScore(all, [], O({ sweep: false })), -460);
    assert.strictEqual(pigScore(all, [], O({ sweep: true, pig: 200, sheep: 50 })), (200 - 50 + 230) * 2);
}
{   // 電腦：永遠合法，整局打完；兩種玩法 × 兩種強度 × 多局；所有牌都被收走、分數合理
    for (const mode of ['hearts', 'pig']) for (const level of [0, 1]) for (let n = 0; n < 12; n++) {
        const opts = O({ mode, level, sell: true });
        const g = newRound(opts, n, shuf);
        for (let guard = 0; guard < 200 && g.phase !== 'play'; guard++) for (let s = 0; s < 4; s++) if (g.picks[s] === null && g.phase !== 'play') {
            const pick = g.phase === 'pass' ? cpuPass(g.hands[s], level) : cpuSell(g.hands[s], level);
            assert.ok(submit(g, s, pick), '換牌 / 賣牌被拒');
        }
        assert.strictEqual(g.phase, 'play');
        for (let k = 0; k < 52; k++) { const p = g.turn, c = cpuPlay(g, p, level); assert.ok(legalCards(g, p).includes(c)); assert.ok(playCard(g, p, c)); }
        assert.strictEqual(g.phase, 'over'); assert.strictEqual(g.taken.flat().length, 52); assert.strictEqual(new Set(g.taken.flat()).size, 52);
        if (mode === 'hearts') { assert.ok([26, 78].includes(g.delta.reduce((a, b) => a + b, 0)) || g.delta.reduce((a, b) => a + b, 0) === 26); }
        else assert.ok(g.delta.every(Number.isInteger));
    }
    // 普通電腦不偷看：只改對手手牌，決策不變
    const g = newRound(O({ mode: 'hearts' }), 3, shuf), p = g.turn, a = cpuPlay(g, p, 1, () => 0.5);
    const g2 = JSON.parse(JSON.stringify(g)); g2.hands = g2.hands.map((h, i) => i === p ? h : h.map(() => -1));
    assert.strictEqual(cpuPlay(g2, p, 1, () => 0.5), a);
    // 傳牌：普通電腦會送出 ♠Q
    assert.ok(cpuPass([PIG, 0, 1, 2, 3, 4, 5, 13, 14, 15, 16, 17, 18], 1).includes(PIG));
    // 賣牌：普通電腦只在方塊很長時賣羊
    assert.deepStrictEqual(cpuSell([PIG, TRANS, HA, 0, 1], 1), []);
    assert.deepStrictEqual(cpuSell([SHEEP, card(1, 10), card(1, 11), card(1, 0), card(1, 1), card(1, 2)], 1), [SHEEP]);
}
{   // 設定 / 統計 / 公開狀態驗證：壞資料都能容錯
    for (const bad of [null, undefined, 5, 'x', [], { mode: 'x', level: 9, target: 'a', timer: -1, sell: 3, rounds: {} }]) { const o = cleanOpts(bad); assert.ok(['hearts', 'pig'].includes(o.mode) && [0, 1].includes(o.level) && [50, 100, 150].includes(o.target) && [0, 30, 60, 90].includes(o.timer) && typeof o.sell === 'boolean'); }
    assert.strictEqual(cleanOpts({ mode: 'pig', sell: false }).sell, false);
    for (const bad of [null, 3, [], { hearts: null, pig: { p: 'x', w: -1 } }, { hearts: { p: 3, w: 9 } }, { pig: { p: 1e12, w: 1e12 } }]) { const s = cleanStats(bad); for (const m of ['hearts', 'pig']) assert.ok(Number.isInteger(s[m].p) && s[m].p >= 0 && s[m].p <= 99999 && s[m].w >= 0 && s[m].w <= s[m].p); }
    assert.deepStrictEqual(cleanStats({ hearts: { p: 3, w: 9 } }).hearts, { p: 3, w: 3 });
    const pub = { phase: 'play', mode: 'pig', opts: O({}), names: ['a', 'b', 'c', 'd'], auto: [false, true, true, true], picked: [false, false, false, false], counts: [13, 13, 13, 13], scores: [0, 0, 0, 0], turn: 0, round: 0, nTrick: 0, gid: 1, mv: 0, tl: 0, dir: 'none', broken: false, log: '', trick: [], last: null, taken: [[], [], [], []], sold: [[], [], [], []], delta: null, final: null, commit: '', reveal: null };
    assert.ok(validPublic(pub)); assert.ok(validPublic({ ...pub, commit: 'a'.repeat(64), final: [0, 2] }));
    for (const bad of [null, {}, { ...pub, phase: 'x' }, { ...pub, counts: [1, 2, 3] }, { ...pub, trick: [{ p: 9, c: 1 }] }, { ...pub, taken: [[99], [], [], []] }, { ...pub, commit: 'zz' }, { ...pub, final: [7] }, { ...pub, reveal: { salt: 1, deal: [] } }, { ...pub, turn: 4 }, { ...pub, scores: [0, 0, 0, 'x'] }]) assert.ok(!validPublic(bad));
}
ok('hearts-games');
