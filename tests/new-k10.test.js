// 批次 k10：fun/party-hub.html 純邏輯（計分、承諾、引擎、傳遞）
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('fun/party-hub.html', 'KINDS, QS, WAVES, TABOO, LOCS, cleanOpts, resolveRounds, commitStr, verifyCommit, deckOf, seedRand, tabooTeams, tabooGiver, canFoul, rank, voteTally, waveScore, waveRound, truthsScore, thisThatScore, priceWinners, spyScore, newGame, nextRound, setAbsent, act, view, pending, validView, soloSetup');
const rnd = (n) => Math.floor(Math.random() * n);
const mk = (kind, n, o = {}) => { const G = m.newGame(kind, Array.from({ length: n }, (_, i) => 'P' + i), o, rnd); return G; };
let now = 1000;
const ctx = () => ({ rand: rnd, now, salt: () => 'abcd1234' });

(async () => {
    // 題庫
    assert.ok(m.QS.length >= 55 && m.QS.every(q => q.length === 2 && q[0] && q[1]));
    assert.ok(m.WAVES.length >= 40 && m.TABOO.length >= 75 && m.TABOO.every(t => t.ban.length >= 3 && t.ban.length <= 5 && !t.ban.some(b => t.w.includes(b))));
    assert.ok(m.LOCS.length >= 25 && m.LOCS.every(l => l.roles.length === 8));
    // 種子可重現
    const a = m.deckOf(10, m.seedRand('x')), b = m.deckOf(10, m.seedRand('x')), c = m.deckOf(10, m.seedRand('y'));
    assert.deepStrictEqual(a, b); assert.notDeepStrictEqual(a, c); assert.deepStrictEqual([...a].sort((x, y) => x - y), [...Array(10).keys()]);
    // 選項
    assert.deepStrictEqual(m.cleanOpts('spy', { rounds: '99', secs: '300' }), { rounds: '2', secs: '300' });
    assert.strictEqual(m.cleanOpts('truths', null).rounds, 'm1');
    assert.strictEqual(m.resolveRounds('m2', 5), 10); assert.strictEqual(m.resolveRounds('8', 5), 8); assert.strictEqual(m.resolveRounds('zzz', 3), 1);
    // 承諾
    const h1 = await Util.sha256(m.commitStr('wave', 2, 40, 'salt'));
    assert.ok(await m.verifyCommit(h1, 'wave', 2, 40, 'salt'));
    assert.ok(!await m.verifyCommit(h1, 'wave', 2, 41, 'salt'));
    assert.ok(!await m.verifyCommit(h1, 'wave', 2, 40, 'salT'));
    assert.ok(!await m.verifyCommit(h1, 'wave', 3, 40, 'salt'));
    assert.ok(!await m.verifyCommit(h1, 'spy', 2, 40, 'salt'));
    assert.ok(!await m.verifyCommit('', 'wave', 2, 40, 'salt') && !await m.verifyCommit(undefined, 'wave', 2, 40, 'salt'));
    // 計分邊界
    assert.deepStrictEqual([0, 4, 5, 8, 9, 14, 15, 22, 23, 100].map(m.waveScore), [4, 4, 3, 3, 2, 2, 1, 1, 0, 0]);
    assert.deepStrictEqual(m.waveRound(50, { 1: 50, 2: 60 }), { pts: { 1: 4, 2: 2 }, giver: 3 });
    assert.strictEqual(m.waveRound(50, {}).giver, 0);
    assert.deepStrictEqual(m.truthsScore(1, { 1: 1, 2: 0, 3: 1 }), { pts: { 1: 2, 2: 0, 3: 2 }, author: -1 });
    assert.strictEqual(m.truthsScore(0, {}).author, 0);
    assert.deepStrictEqual(m.thisThatScore('minority', { 0: 0, 1: 0, 2: 1 }), { count: [2, 1], pts: { 2: 1 } });
    assert.deepStrictEqual(m.thisThatScore('majority', { 0: 0, 1: 0, 2: 1 }).pts, { 0: 1, 1: 1 });
    assert.deepStrictEqual(m.thisThatScore('minority', { 0: 0, 1: 1 }).pts, {});           // 平手
    assert.deepStrictEqual(m.thisThatScore('minority', { 0: 1, 1: 1 }).pts, {});           // 全同邊：少數派 0 人
    assert.deepStrictEqual(m.thisThatScore('majority', { 0: 1, 1: 1 }).pts, { 0: 1, 1: 1 });
    assert.deepStrictEqual(m.thisThatScore('none', { 0: 0, 1: 1, 2: 1 }).pts, {});
    assert.deepStrictEqual(m.priceWinners(100, { 1: 90, 2: 110, 3: 99 }, 'under'), [3]);
    assert.deepStrictEqual(m.priceWinners(100, { 1: 110, 2: 120 }, 'under'), []);
    assert.deepStrictEqual(m.priceWinners(100, { 1: 110, 2: 95 }, 'near'), [2]);
    assert.deepStrictEqual(m.priceWinners(100, { 1: 90, 2: 110 }, 'near'), [1, 2]);            // 同分
    assert.deepStrictEqual(m.priceWinners(100, {}, 'near'), []);
    assert.deepStrictEqual(m.spyScore('spy', 2, [true, true, true]), { 2: 4 });
    assert.deepStrictEqual(m.spyScore('players', 1, [true, true, false, true]), { 0: 2, 3: 2 });
    assert.deepStrictEqual(m.rank([3, 5, 5, 1]).map(r => [r.seat, r.rank]), [[1, 1], [2, 1], [0, 3], [3, 4]]);
    assert.strictEqual(m.voteTally({ 0: 2, 1: 2, 3: 1 }), 2); assert.strictEqual(m.voteTally({ 0: 1, 1: 2 }), -1); assert.strictEqual(m.voteTally({}), -1);
    // 隊伍 / 說明者
    for (let n = 4; n <= 12; n++) { const t = m.tabooTeams(n, rnd); assert.ok(Math.abs(t.filter(x => x).length - t.filter(x => !x).length) <= 1); }
    const team = [0, 1, 0, 1, 0]; const gv = [0, 1, 2, 3, 4, 5].map(t => m.tabooGiver(team, t)); assert.deepStrictEqual(gv, [0, 1, 2, 3, 4, 1]);
    // 人數邊界
    for (const [k, min] of [['truths', 2], ['thatthis', 2], ['wave', 2], ['price', 2], ['taboo', 4], ['spy', 3]]) {
        assert.strictEqual(m.newGame(k, Array(min - 1).fill('a'), {}, rnd), null, k);
        assert.ok(m.newGame(k, Array.from({ length: min }, (_, i) => 'p' + i), {}, rnd), k);
        assert.ok(m.newGame(k, Array.from({ length: 12 }, (_, i) => 'p' + i), {}, rnd), k);
        assert.strictEqual(m.newGame(k, Array.from({ length: 13 }, (_, i) => 'p' + i), {}, rnd), null, k);
    }
    // 兩真一假完整一輪 + 非法
    let G = mk('truths', 3); m.nextRound(G, ctx());
    assert.strictEqual(G.phase, 'write'); const au = G.actor;
    const other = [0, 1, 2].find(i => i !== au);
    assert.ok(m.act(G, other, { t: 'write', s: ['a', 'b', 'c'], lie: 0 }, ctx()));      // 非出題者
    assert.ok(m.act(G, au, { t: 'write', s: ['a', 'a', 'c'], lie: 0 }, ctx()));          // 重複
    assert.ok(m.act(G, au, { t: 'write', s: ['a', 'b', 'c'], lie: 3 }, ctx()));
    assert.strictEqual(m.act(G, au, { t: 'write', s: ['a', 'b', 'c'], lie: 1 }, ctx()), null);
    assert.strictEqual(m.view(G, other, 0).g.lie, -1); assert.strictEqual(m.view(G, au, 0).g.lie, 1);
    assert.ok(!JSON.stringify(m.view(G, other, 0)).includes('"lie":1'));
    assert.ok(m.act(G, au, { t: 'vote', v: 0 }, ctx()));
    assert.strictEqual(m.act(G, other, { t: 'vote', v: 1 }, ctx()), null); assert.ok(m.act(G, other, { t: 'vote', v: 0 }, ctx()));
    const o2 = [0, 1, 2].find(i => i !== au && i !== other);
    assert.strictEqual(G.phase, 'vote'); m.act(G, o2, { t: 'vote', v: 2 }, ctx());
    assert.strictEqual(G.phase, 'reveal'); assert.deepStrictEqual([G.scores[other], G.scores[o2], G.scores[au]], [2, 0, 0]);
    assert.ok(m.act(G, other, { t: 'next' }, ctx()));          // 越權
    assert.ok(m.act(G, 1, { t: 'force' }, ctx()));
    assert.strictEqual(m.act(G, 0, { t: 'next' }, ctx()), null); assert.strictEqual(G.round, 2);
    // force 與離線
    m.act(G, 0, { t: 'force' }, ctx()); assert.strictEqual(G.phase, 'reveal'); assert.ok(G.res.skip);
    G = mk('truths', 2); m.nextRound(G, ctx()); m.setAbsent(G, G.actor, true, ctx()); assert.strictEqual(G.phase, 'reveal');
    // 全部回合後結束
    G = mk('thatthis', 2, { rounds: '5', score: 'minority' }); m.nextRound(G, ctx());
    for (let r = 0; r < 5; r++) { m.act(G, 0, { t: 'pick', v: 0 }, ctx()); m.act(G, 1, { t: 'pick', v: 1 }, ctx()); assert.strictEqual(G.phase, 'reveal'); m.act(G, 0, { t: 'next' }, ctx()); }
    assert.strictEqual(G.phase, 'over'); assert.ok(m.act(G, 0, { t: 'next' }, ctx()));
    // 出題模式
    G = mk('thatthis', 3, { src: 'host' }); m.nextRound(G, ctx()); assert.strictEqual(G.phase, 'ask');
    assert.ok(m.act(G, 1, { t: 'ask', a: 'x', b: 'y' }, ctx())); assert.ok(m.act(G, 0, { t: 'ask', a: 'x', b: 'x' }, ctx()));
    assert.strictEqual(m.act(G, 0, { t: 'ask', a: 'x', b: 'y' }, ctx()), null); assert.strictEqual(G.phase, 'pick');
    // 頻率猜心：目標不洩漏、承諾
    G = mk('wave', 4); m.nextRound(G, ctx()); const ac = G.actor, gs = [0, 1, 2, 3].filter(i => i !== ac);
    assert.ok(G.commitSrc.includes(String(G.target)) && G.commitSrc.includes('abcd1234'));
    assert.ok(m.view(G, gs[0], 0).g.target === -1 && m.view(G, ac, 0).g.target === G.target);
    assert.ok(!JSON.stringify(m.view(G, gs[0], 0)).includes('abcd1234'));
    assert.ok(m.act(G, gs[0], { t: 'clue', text: 'x' }, ctx())); m.act(G, ac, { t: 'clue', text: '提示' }, ctx());
    assert.ok(m.act(G, ac, { t: 'guess', v: 5 }, ctx())); assert.ok(m.act(G, gs[0], { t: 'guess', v: 101 }, ctx())); assert.ok(m.act(G, gs[0], { t: 'guess', v: 1.5 }, ctx()));
    gs.forEach(s => m.act(G, s, { t: 'guess', v: G.target }, ctx()));
    assert.strictEqual(G.phase, 'reveal'); assert.strictEqual(G.res.secret, String(G.target)); assert.strictEqual(G.scores[ac], 4);
    // 猜價格
    G = mk('price', 3, { mode: 'under' }); m.nextRound(G, ctx()); const pa = G.actor, pg = [0, 1, 2].filter(i => i !== pa);
    assert.ok(m.act(G, pa, { t: 'set', item: 'x', price: -1 }, ctx())); assert.ok(m.act(G, pa, { t: 'set', item: 'x', price: NaN }, ctx())); assert.ok(m.act(G, pa, { t: 'set', item: 'x', price: '5' }, ctx()));
    m.act(G, pa, { t: 'set', item: '茶', price: 100 }, ctx());
    assert.strictEqual(m.view(G, pg[0], 0).g.price, null); assert.strictEqual(m.view(G, pa, 0).g.price, 100);
    m.act(G, pg[0], { t: 'guess', v: 99 }, ctx()); m.act(G, pg[1], { t: 'guess', v: 101 }, ctx());
    assert.deepStrictEqual(G.res.winners, [pg[0]]); assert.strictEqual(G.scores[pg[0]], 3);
    // 禁語
    G = mk('taboo', 4, { secs: '45' }); m.nextRound(G, ctx()); const gi = G.giver;
    const mate = [0, 1, 2, 3].find(i => i !== gi && G.team[i] === G.team[gi]), opp = [0, 1, 2, 3].find(i => G.team[i] !== G.team[gi]);
    assert.strictEqual(G.phase, 'ready'); assert.ok(m.act(G, mate, { t: 'go' }, ctx()));
    m.act(G, gi, { t: 'go' }, ctx()); assert.strictEqual(G.phase, 'turn');
    assert.strictEqual(m.view(G, mate, now).g.card, null); assert.ok(m.view(G, opp, now).g.card && m.view(G, gi, now).g.card);
    assert.ok(m.canFoul(G, opp) && !m.canFoul(G, mate) && !m.canFoul(G, gi));
    const cid = G.cid; assert.ok(m.act(G, mate, { t: 'foul', c: cid }, ctx())); assert.ok(m.act(G, gi, { t: 'ok', c: cid - 1 }, ctx()));
    assert.strictEqual(m.act(G, gi, { t: 'ok', c: cid }, ctx()), null); assert.strictEqual(G.tscore[G.team[gi]], 1);
    assert.strictEqual(m.act(G, opp, { t: 'foul', c: cid }, ctx()), 'x'.length && m.act(G, opp, { t: 'foul', c: cid }, ctx()));   // 同一張只能處理一次
    assert.strictEqual(m.act(G, opp, { t: 'foul', c: G.cid }, ctx()), null); assert.strictEqual(G.tscore[G.team[gi]], 0);
    for (let i = 0; i < 3; i++) assert.strictEqual(m.act(G, gi, { t: 'skip', c: G.cid }, ctx()), null);
    assert.ok(m.act(G, gi, { t: 'skip', c: G.cid }, ctx()));
    assert.ok(m.act(G, opp, { t: 'timeup' }, ctx())); // 時間未到
    now += 46000; assert.strictEqual(m.act(G, opp, { t: 'timeup' }, ctx()), null); assert.strictEqual(G.phase, 'reveal'); now = 1000;
    // 間諜
    G = mk('spy', 5, { rounds: '1' }); m.nextRound(G, ctx());
    const sp = G.spy, civ = [0, 1, 2, 3, 4].find(i => i !== sp);
    const vs = m.view(G, sp, now), vc = m.view(G, civ, now);
    assert.ok(vs.g.isSpy && vs.g.li === -1 && !vs.g.role); assert.ok(!vc.g.isSpy && vc.g.li >= 0 && vc.g.role);
    assert.ok(!JSON.stringify(vc).includes('"spy":') && !JSON.stringify(vc).includes('abcd1234'));
    assert.ok(m.act(G, civ, { t: 'guess', loc: 0 }, ctx()));
    // 指控：一人不同意即失敗
    const acc = civ, tg = sp;
    assert.strictEqual(m.act(G, acc, { t: 'accuse', target: tg }, ctx()), null); assert.ok(m.act(G, acc, { t: 'accuse', target: tg }, ctx()));
    const vt = [0, 1, 2, 3, 4].filter(i => i !== acc && i !== tg);
    m.act(G, vt[0], { t: 'avote', y: false }, ctx()); assert.strictEqual(G.phase, 'play');
    assert.ok(m.act(G, acc, { t: 'accuse', target: tg }, ctx()));         // 每人一次
    const acc2 = vt[0]; m.act(G, acc2, { t: 'accuse', target: tg }, ctx());
    [0, 1, 2, 3, 4].filter(i => i !== acc2 && i !== tg).forEach(i => m.act(G, i, { t: 'avote', y: true }, ctx()));
    assert.strictEqual(G.phase, 'reveal'); assert.strictEqual(G.res.winner, 'players'); assert.strictEqual(G.scores[sp], 0); assert.strictEqual(G.scores[civ], 2);
    // 間諜猜地點 / 時間到投票
    G = mk('spy', 3, { rounds: '1' }); m.nextRound(G, ctx()); m.act(G, G.spy, { t: 'guess', loc: G.li }, ctx()); assert.strictEqual(G.res.winner, 'spy'); assert.strictEqual(G.scores[G.spy], 4);
    G = mk('spy', 3, { rounds: '1' }); m.nextRound(G, ctx()); assert.ok(m.act(G, 1, { t: 'timeup' }, ctx())); assert.ok(m.act(G, 1, { t: 'timeup', force: true }, ctx()));
    m.act(G, 0, { t: 'timeup', force: true }, ctx()); assert.strictEqual(G.phase, 'final');
    [0, 1, 2].forEach(i => m.act(G, i, { t: 'fvote', target: (i + 1) % 3 }, ctx())); assert.strictEqual(G.res.winner, 'spy');   // 平手間諜贏
    G = mk('spy', 3, { rounds: '1' }); m.nextRound(G, ctx()); m.setAbsent(G, G.spy === 0 ? 1 : 0, true, ctx()); assert.strictEqual(G.phase, 'play'); m.setAbsent(G, G.spy, true, ctx()); assert.ok(G.res.skip);
    // 各人數開局不丟例外
    for (const k of Object.keys(m.KINDS)) for (let n = m.KINDS[k].min; n <= 12; n++) { const g = mk(k, n); m.nextRound(g, ctx()); for (let s = 0; s < n; s++) JSON.stringify(m.view(g, s, now)); assert.ok(m.validView(JSON.parse(JSON.stringify(m.view(g, 0, now))))); }
    assert.ok(!m.validView(null) && !m.validView({ kind: 'x' }));
    // 單機名單
    assert.ok(m.soloSetup('a\nb', 'truths').names.length === 2); assert.ok(m.soloSetup('a', 'truths').err); assert.ok(m.soloSetup('a,a', 'truths').err);
    assert.ok(m.soloSetup('a,b,c,d', 'taboo').err); assert.ok(m.soloSetup('a,b', 'spy').err); assert.ok(m.soloSetup('abcdefghijk,b', 'truths').err);
    assert.ok(m.soloSetup(Array.from({ length: 13 }, (_, i) => 'p' + i).join(','), 'wave').err);
    ok('k10 party-hub');
})().catch(e => { console.error(e); process.exit(1); });
