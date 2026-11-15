// 批次 r8：fun/party-hub.html 狼人殺 / 阿瓦隆 純邏輯（角色配置、夜晚結算、投票、勝負、任務表、完整對局模擬、隱藏資訊）
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('fun/party-hub.html', 'KINDS, cleanOpts, wolfRoles, wolfWin, wolfTarget, nightResolve, avalonRoles, avSees, avTeamSize, avFails, avApproved, isEvil, newGame, nextRound, act, view, pending, setAbsent, soloSetup, validView, voteTally');
const rnd = (n) => Math.floor(Math.random() * n);
const ctx = () => ({ rand: rnd, now: 1000, salt: () => 'abcd1234' });
const mk = (kind, n, o = {}, solo = false) => { const G = m.newGame(kind, Array.from({ length: n }, (_, i) => 'P' + i), o, rnd); G.solo = solo; m.nextRound(G, ctx()); return G; };
const cnt = (a, x) => a.filter(y => y === x).length;
const pick = (a) => a[rnd(a.length)];

// ---- 狼人殺：配置 ----
for (let n = 6; n <= 12; n++) {
    const r = m.wolfRoles(n, 'auto', 'on'), w = cnt(r, 'wolf');
    assert.strictEqual(r.length, n);
    assert.strictEqual(w, n <= 8 ? 2 : n <= 11 ? 3 : 4, 'n=' + n);
    ['seer', 'witch', 'hunter'].forEach(x => assert.strictEqual(cnt(r, x), 1));
    assert.ok(cnt(r, 'vil') >= 1 && w * 2 < n);
    assert.strictEqual(cnt(m.wolfRoles(n, 'auto', 'off'), 'hunter'), 0);
}
assert.strictEqual(cnt(m.wolfRoles(6, '4', 'on'), 'wolf'), 2);          // 上限：不到一半
assert.strictEqual(cnt(m.wolfRoles(9, '1', 'on'), 'wolf'), 1);
assert.deepStrictEqual(m.cleanOpts('wolf', { wolves: '9', hunter: 'x' }), { wolves: 'auto', hunter: 'on' });
// 勝負
assert.strictEqual(m.wolfWin(['wolf', 'vil', 'vil'], [false, true, true]), 'good');
assert.strictEqual(m.wolfWin(['wolf', 'wolf', 'vil', 'vil', 'seer'], [true, true, true, true, false]), 'wolf');   // 2 狼 2 好
assert.strictEqual(m.wolfWin(['wolf', 'vil', 'vil'], [true, true, true]), '');
assert.strictEqual(m.wolfWin(['wolf', 'vil'], [true, true]), 'wolf');
// 夜晚結算
assert.deepStrictEqual(m.nightResolve(2, false, -1), [{ seat: 2, by: 'wolf' }]);
assert.deepStrictEqual(m.nightResolve(2, true, -1), []);
assert.deepStrictEqual(m.nightResolve(2, false, 4), [{ seat: 2, by: 'wolf' }, { seat: 4, by: 'poison' }]);
assert.deepStrictEqual(m.nightResolve(-1, false, 4), [{ seat: 4, by: 'poison' }]);
assert.deepStrictEqual(m.nightResolve(2, false, 2), [{ seat: 2, by: 'wolf' }]);
// 狼人共同選擇與放逐統計
assert.strictEqual(m.wolfTarget({ 1: 3, 2: 3, 4: 5 }, rnd), 3);
assert.strictEqual(m.wolfTarget({}, rnd), -1);
assert.ok([3, 5].includes(m.wolfTarget({ 1: 3, 2: 5 }, rnd)));
assert.strictEqual(m.wolfTarget({ 1: 3, 2: 5 }, () => 1), 5);
assert.strictEqual(m.voteTally({ 0: 2, 1: 2, 3: 1 }), 2);
assert.strictEqual(m.voteTally({ 0: 2, 1: 1 }), -1);

// ---- 阿瓦隆：配置 / 任務表 / 可見資訊 ----
const good = { 5: 3, 6: 4, 7: 4, 8: 5, 9: 6, 10: 6 };
for (let n = 5; n <= 10; n++) {
    for (const o of [{}, { mordred: 'on' }, { oberon: 'on' }, { mordred: 'on', oberon: 'on', percival: 'on' }, { percival: 'off' }]) {
        const r = m.avalonRoles(n, o);
        assert.strictEqual(r.length, n); assert.strictEqual(r.filter(x => !m.isEvil(x)).length, good[n], `n=${n}`);
        assert.strictEqual(cnt(r, 'merlin'), 1); assert.strictEqual(cnt(r, 'assassin'), 1);
        assert.strictEqual(cnt(r, 'percival'), cnt(r, 'morgana'));     // 成對
    }
}
assert.ok(!m.avalonRoles(5, { mordred: 'on', oberon: 'on' }).includes('oberon'));
assert.ok(m.avalonRoles(10, { mordred: 'on', oberon: 'on' }).includes('oberon'));
assert.strictEqual(m.avalonRoles(4, {}), null);
assert.deepStrictEqual([5, 6, 7, 8, 9, 10].map(n => [0, 1, 2, 3, 4].map(k => m.avTeamSize(n, k))), [[2, 3, 2, 3, 3], [2, 3, 4, 3, 4], [2, 3, 3, 4, 4], [3, 4, 4, 5, 5], [3, 4, 4, 5, 5], [3, 4, 4, 5, 5]]);
assert.deepStrictEqual([5, 6, 7, 8].map(n => m.avFails(n, 3)), [1, 1, 2, 2]);
assert.strictEqual(m.avFails(9, 2), 1);
assert.ok(m.avApproved({ 0: true, 1: true, 2: false }, 3) && !m.avApproved({ 0: true, 1: false }, 2) && !m.avApproved({ 0: true, 1: true }, 5));
{
    const R = ['merlin', 'percival', 'loyal', 'assassin', 'morgana', 'mordred', 'oberon'];
    assert.deepStrictEqual(m.avSees(R, 0).seats, [3, 4, 6]);       // 梅林看不到莫德雷德
    assert.deepStrictEqual(m.avSees(R, 1).seats, [0, 4]);
    assert.deepStrictEqual(m.avSees(R, 2).seats, []);
    assert.deepStrictEqual(m.avSees(R, 3).seats, [4, 5]);          // 看不到奧伯倫
    assert.deepStrictEqual(m.avSees(R, 6).seats, []);              // 奧伯倫誰都看不到
}
assert.ok(m.soloSetup('a\nb\nc\nd\ne', 'avalon').names && m.soloSetup('a\nb\nc\nd', 'avalon').err);
assert.ok(m.soloSetup(Array.from({ length: 11 }, (_, i) => 'p' + i).join('\n'), 'avalon').err);
assert.ok(m.soloSetup(Array.from({ length: 12 }, (_, i) => 'p' + i).join('\n'), 'wolf').names && m.soloSetup('a\nb\nc\nd\ne', 'wolf').err);
assert.strictEqual(m.newGame('avalon', Array(11).fill(0).map((_, i) => 'p' + i), {}, rnd), null);
assert.strictEqual(m.newGame('wolf', ['a', 'b', 'c', 'd', 'e'], {}, rnd), null);

// ---- 完整對局模擬（隨機機器人）----
const alive = (G) => G.alive.map((a, i) => (a ? i : -1)).filter(i => i >= 0);
function wolfBot(G, s) {
    const ph = G.phase, r = G.role[s], v = m.view(G, s).g;
    if (ph === 'night') { if (r === 'wolf') return { t: 'kill', target: pick(alive(G).filter(i => G.role[i] !== 'wolf')) }; if (r === 'seer') return G.sk ? { t: 'ack' } : { t: 'check', target: pick(alive(G).filter(i => i !== s)) }; return { t: 'sleep' }; }
    if (ph === 'witch') { if (r === 'witch' && v.w) { const q = rnd(3); return q === 0 && v.w.heal && v.w.victim >= 0 ? { t: 'witch', save: true, poison: -1 } : q === 1 && v.w.poison ? { t: 'witch', save: false, poison: pick(alive(G).filter(i => i !== s)) } : { t: 'witch', save: false, poison: -1 }; } return { t: 'sleep' }; }
    if (ph === 'hunter') return { t: 'shoot', target: rnd(2) ? pick(alive(G)) : -1 };
    if (ph === 'vote') return { t: 'vote', target: rnd(5) ? pick(alive(G).filter(i => i !== s)) : -1 };
}
function playWolf(n, solo, o = {}) {
    const G = mk('wolf', n, o, solo);
    for (let i = 0; i < 400 && G.phase !== 'reveal'; i++) {
        if (G.phase === 'day' || G.phase === 'vres') { assert.strictEqual(m.act(G, 0, { t: 'go' }, ctx()), null); continue; }
        const p = m.pending(G); assert.ok(p.length, 'stuck in ' + G.phase);
        const s = pick(p), e = m.act(G, s, wolfBot(G, s), ctx()); assert.strictEqual(e, null, G.phase + ' ' + e);
    }
    assert.strictEqual(G.phase, 'reveal');
    assert.ok(['wolf', 'good'].includes(G.res.winner) && G.res.roles.length === n && G.res.secret === G.res.roles.join(','));
    assert.strictEqual(m.wolfWin(G.role, G.alive), G.res.winner);
    assert.ok(G.scores.every(x => x === 0 || x === 1));
    assert.strictEqual(m.act(G, 0, { t: 'next' }, ctx()), null); assert.strictEqual(G.phase, 'over');
    return G;
}
for (let k = 0; k < 40; k++) { const n = 6 + rnd(7); playWolf(n, k % 2 === 0); }
playWolf(6, false, { wolves: '1', hunter: 'off' });

function avBot(G, s) {
    const ph = G.phase, r = G.role[s];
    if (ph === 'team') { const ids = [...Array(G.n).keys()].sort(() => rnd(3) - 1).slice(0, m.avTeamSize(G.n, G.mission)); return { t: 'team', seats: ids }; }
    if (ph === 'tvote') return { t: 'tvote', y: rnd(4) > 0 };
    if (ph === 'mission') return { t: 'card', fail: m.isEvil(r) && rnd(2) === 0 };
    if (ph === 'assassin') return { t: 'stab', target: pick([...Array(G.n).keys()].filter(i => i !== s)) };
}
function playAv(n, o = {}) {
    const G = mk('avalon', n, o);
    for (let i = 0; i < 600 && G.phase !== 'reveal'; i++) {
        if (G.phase === 'tres' || G.phase === 'mres') { assert.strictEqual(m.act(G, 0, { t: 'go' }, ctx()), null); continue; }
        const p = m.pending(G); assert.ok(p.length, 'stuck in ' + G.phase);
        const s = pick(p), e = m.act(G, s, avBot(G, s), ctx()); assert.strictEqual(e, null, G.phase + ' ' + e);
    }
    assert.strictEqual(G.phase, 'reveal');
    assert.ok(['good', 'evil'].includes(G.res.winner) && G.res.secret === G.res.roles.join(','));
    assert.ok(G.rej <= 5 && G.wins[0] <= 3 && G.wins[1] <= 3);
    return G;
}
const wins = { good: 0, evil: 0 };
for (let k = 0; k < 60; k++) wins[playAv(5 + rnd(6), pick([{}, { mordred: 'on' }, { oberon: 'on', mordred: 'on' }, { percival: 'off' }])).res.winner]++;
assert.ok(wins.good > 0 && wins.evil > 0, JSON.stringify(wins));

// ---- 規則細節：阿瓦隆 ----
{
    const G = mk('avalon', 7, {});
    const L = G.leader, goodSeat = G.role.findIndex(r => !m.isEvil(r)), evilSeat = G.role.findIndex(r => m.isEvil(r));
    assert.ok(m.act(G, (L + 1) % 7, { t: 'team', seats: [0, 1] }, ctx()), '非隊長不能組隊');
    assert.ok(m.act(G, L, { t: 'team', seats: [0, 0] }, ctx()), '重複隊員');
    assert.ok(m.act(G, L, { t: 'team', seats: [0, 1, 2] }, ctx()), '人數不符');
    assert.strictEqual(m.act(G, L, { t: 'team', seats: [0, 1] }, ctx()), null);
    assert.strictEqual(G.phase, 'tvote');
    assert.ok(!JSON.stringify(m.view(G, goodSeat)).includes(G.role.join(',')));
    for (let i = 0; i < 7; i++) assert.strictEqual(m.act(G, i, { t: 'tvote', y: false }, ctx()), null);
    assert.strictEqual(G.phase, 'tres'); assert.strictEqual(G.rej, 1);
    assert.strictEqual(m.act(G, 1, { t: 'go' }, ctx()), '只有房主可以進行下一步');
    m.act(G, 0, { t: 'go' }, ctx()); assert.strictEqual(G.phase, 'team');
    // 連續 5 次否決
    for (let k = 1; k < 5; k++) {
        assert.strictEqual(G.phase, 'team');
        assert.strictEqual(m.act(G, G.leader, { t: 'team', seats: [0, 1] }, ctx()), null);
        for (let i = 0; i < 7; i++) m.act(G, i, { t: 'tvote', y: false }, ctx());
        if (G.phase === 'tres') m.act(G, 0, { t: 'go' }, ctx());
    }
    assert.strictEqual(G.phase, 'reveal'); assert.strictEqual(G.res.winner, 'evil'); assert.ok(G.res.why.includes('5'));
}
{   // 好人只能出成功；第 4 輪 7 人要 2 張失敗；三勝後刺殺
    const G = mk('avalon', 7, {});
    const gs = G.role.map((r, i) => (!m.isEvil(r) ? i : -1)).filter(i => i >= 0), es = G.role.map((r, i) => (m.isEvil(r) ? i : -1)).filter(i => i >= 0);
    const play = (team, fails) => {
        assert.strictEqual(m.act(G, G.leader, { t: 'team', seats: team }, ctx()), null);
        for (let i = 0; i < 7; i++) m.act(G, i, { t: 'tvote', y: true }, ctx());
        m.act(G, 0, { t: 'go' }, ctx()); assert.strictEqual(G.phase, 'mission');
        const bad = team.filter(s => m.isEvil(G.role[s]));
        if (bad.length) assert.strictEqual(m.act(G, team.find(s => !m.isEvil(G.role[s])) ?? -1, { t: 'card', fail: true }, ctx()) !== null, true);
        const nonMember = [...Array(7).keys()].find(i => !team.includes(i)); assert.ok(m.act(G, nonMember, { t: 'card', fail: false }, ctx()));
        team.forEach((s, i) => assert.strictEqual(m.act(G, s, { t: 'card', fail: i < fails && m.isEvil(G.role[s]) }, ctx()), null));
        const r = G.phase; m.act(G, 0, { t: 'go' }, ctx()); return r;
    };
    play(gs.slice(0, 2), 0); play(gs.slice(0, 3), 0);             // 好人兩勝
    play([es[0], gs[0], gs[1]], 1);                                 // 第 3 輪失敗
    assert.strictEqual(G.mission, 3);
    const ok4 = play([es[0], es[1], gs[0], gs[1]], 1);              // 第 4 輪：只 1 張失敗仍成功（需 2 張）
    assert.strictEqual(ok4, 'mres'); assert.deepStrictEqual(G.wins, [3, 1]);
    assert.strictEqual(G.phase, 'assassin');
    const mer = G.role.indexOf('merlin'), ass = G.role.indexOf('assassin');
    assert.ok(m.act(G, gs[0] === ass ? 0 : gs[0], { t: 'stab', target: mer }, ctx()));
    assert.strictEqual(m.act(G, ass, { t: 'stab', target: mer }, ctx()), null);
    assert.strictEqual(G.phase, 'reveal'); assert.strictEqual(G.res.winner, 'evil');
}
// 斷線：刺客離線好人贏；缺席視為反對
{
    const G = mk('avalon', 5, {}); const ass = G.role.indexOf('assassin');
    G.wins = [3, 0]; G.hist = [{ m: 2, team: [0, 1], fails: 0, ok: true, leader: 0 }];
    G.phase = 'mres'; m.setAbsent(G, ass, true, ctx());
    const host = 0; if (!G.absent[host]) { m.act(G, host, { t: 'go' }, ctx()); assert.strictEqual(G.phase, 'reveal'); assert.strictEqual(G.res.winner, 'good'); }
}

// ---- 規則細節：狼人殺 ----
function setup(roles) {   // 指定角色的 6 人局
    const G = mk('wolf', roles.length, {}); G.role = roles.slice(); return G;
}
{   // 夜晚：狼人只能選好人；預言家查驗；女巫用藥；獵人
    const G = setup(['wolf', 'wolf', 'seer', 'witch', 'hunter', 'vil']);
    assert.strictEqual(G.phase, 'night');
    assert.ok(m.act(G, 5, { t: 'kill', target: 4 }, ctx()), '村民不能殺人');
    assert.ok(m.act(G, 0, { t: 'kill', target: 1 }, ctx()), '不能殺狼同伴');
    assert.ok(m.act(G, 0, { t: 'kill', target: 9 }, ctx()));
    assert.strictEqual(m.act(G, 0, { t: 'kill', target: 4 }, ctx()), null);
    assert.ok(m.act(G, 0, { t: 'kill', target: 4 }, ctx()), '不能重複');
    assert.strictEqual(G.phase, 'night');
    assert.strictEqual(m.act(G, 2, { t: 'check', target: 1 }, ctx()), null); assert.strictEqual(G.sk.wolf, true);
    assert.ok(m.act(G, 2, { t: 'check', target: 5 }, ctx()), '一晚只能查一次');
    assert.strictEqual(G.phase, 'night');       // 預言家還沒確認、狼 1 還沒選
    assert.strictEqual(m.act(G, 1, { t: 'kill', target: 4 }, ctx()), null);
    m.act(G, 2, { t: 'ack' }, ctx());
    assert.strictEqual(G.phase, 'witch'); assert.strictEqual(G.victim, 4);
    assert.ok(m.act(G, 3, { t: 'witch', save: true, poison: 0 }, ctx()), '同晚不能兩瓶');
    assert.strictEqual(m.act(G, 3, { t: 'witch', save: false, poison: 1 }, ctx()), null);   // 毒狼 1，獵人被刀
    assert.strictEqual(G.phase, 'hunter');          // 獵人被狼刀 → 開槍
    assert.deepStrictEqual(G.alive, [true, false, true, true, false, true]);
    assert.ok(m.act(G, 5, { t: 'shoot', target: 0 }, ctx()), '非獵人不能開槍');
    assert.strictEqual(m.act(G, 4, { t: 'shoot', target: 0 }, ctx()), null);
    assert.strictEqual(G.phase, 'reveal'); assert.strictEqual(G.res.winner, 'good');   // 狼全滅
}
{   // 解藥救人、毒藥一次性、被毒的獵人不開槍
    const G = setup(['wolf', 'wolf', 'seer', 'witch', 'hunter', 'vil', 'vil']);
    m.act(G, 0, { t: 'kill', target: 5 }, ctx()); m.act(G, 1, { t: 'kill', target: 5 }, ctx()); m.act(G, 2, { t: 'check', target: 0 }, ctx()); m.act(G, 2, { t: 'ack' }, ctx());
    assert.strictEqual(m.act(G, 3, { t: 'witch', save: true, poison: -1 }, ctx()), null);
    assert.strictEqual(G.phase, 'day'); assert.ok(G.alive.every(Boolean)); assert.ok(G.log[0].includes('平安夜'));
    m.act(G, 0, { t: 'go' }, ctx()); assert.strictEqual(G.phase, 'vote');
    G.votes = {}; for (let i = 0; i < 7; i++) m.act(G, i, { t: 'vote', target: -1 }, ctx());     // 全棄權
    assert.strictEqual(G.phase, 'vres'); assert.strictEqual(G.vres.out, -1);
    m.act(G, 0, { t: 'go' }, ctx()); assert.strictEqual(G.phase, 'night'); assert.strictEqual(G.night, 2);
    m.act(G, 0, { t: 'kill', target: 6 }, ctx()); m.act(G, 1, { t: 'kill', target: 6 }, ctx()); m.act(G, 2, { t: 'check', target: 1 }, ctx()); m.act(G, 2, { t: 'ack' }, ctx());
    assert.ok(m.act(G, 3, { t: 'witch', save: true, poison: -1 }, ctx()), '解藥用完了');
    assert.strictEqual(m.act(G, 3, { t: 'witch', save: false, poison: 4 }, ctx()), null);   // 毒獵人
    assert.strictEqual(G.phase, 'day'); assert.strictEqual(G.alive[4], false); assert.strictEqual(G.alive[6], false);   // 獵人被毒不開槍
}
{   // 放逐獵人：開槍；平票無人出局；棄權；死人不能投票
    const G = setup(['wolf', 'wolf', 'seer', 'witch', 'hunter', 'vil', 'vil']);
    m.act(G, 0, { t: 'kill', target: 6 }, ctx()); m.act(G, 1, { t: 'kill', target: 6 }, ctx()); m.act(G, 2, { t: 'check', target: 0 }, ctx()); m.act(G, 2, { t: 'ack' }, ctx());
    m.act(G, 3, { t: 'witch', save: false, poison: -1 }, ctx());
    assert.strictEqual(G.phase, 'day'); assert.strictEqual(G.alive[6], false);
    assert.ok(m.act(G, 6, { t: 'vote', target: 0 }, ctx()));
    m.act(G, 0, { t: 'go' }, ctx());
    assert.ok(m.act(G, 6, { t: 'vote', target: 0 }, ctx()), '死人不能投');
    assert.ok(m.act(G, 0, { t: 'vote', target: 0 }, ctx()), '不能投自己');
    assert.ok(m.act(G, 0, { t: 'vote', target: 6 }, ctx()), '不能投死人');
    [0, 1, 2, 3, 5].forEach(i => m.act(G, i, { t: 'vote', target: 4 }, ctx())); assert.strictEqual(G.phase, 'vote');
    m.act(G, 4, { t: 'vote', target: 0 }, ctx());
    assert.strictEqual(G.phase, 'hunter'); assert.strictEqual(G.hunter, 4);
    m.act(G, 4, { t: 'shoot', target: 1 }, ctx());
    assert.strictEqual(G.phase, 'vres'); assert.strictEqual(G.alive[4], false); assert.strictEqual(G.alive[1], false);
    assert.ok(G.log.some(t => t.includes('獵人')));
}
{   // 狼人數 >= 好人數 → 狼人贏（夜晚刀完直接結算）
    const G = setup(['wolf', 'wolf', 'seer', 'vil', 'witch', 'vil']);
    G.alive = [true, true, true, false, false, true];
    m.act(G, 0, { t: 'kill', target: 2 }, ctx()); m.act(G, 1, { t: 'kill', target: 2 }, ctx()); m.act(G, 2, { t: 'check', target: 0 }, ctx()); m.act(G, 2, { t: 'ack' }, ctx());
    assert.strictEqual(G.phase, 'reveal'); assert.strictEqual(G.res.winner, 'wolf');   // 女巫已死，直接結算：2 狼 vs 1 好
}
// 斷線：狼人全離線 → 平安夜；離線者不卡住流程
{
    const G = setup(['wolf', 'wolf', 'seer', 'witch', 'hunter', 'vil']);
    m.setAbsent(G, 0, true, ctx()); m.setAbsent(G, 1, true, ctx()); m.setAbsent(G, 2, true, ctx());
    assert.strictEqual(G.phase, 'witch'); assert.strictEqual(G.victim, -1);
    m.act(G, 3, { t: 'witch', save: false, poison: -1 }, ctx());
    assert.strictEqual(G.phase, 'day');
}
// 單機：每個活人都要「睡」，才不會從誰拿手機看出身分；hide：夜晚 pend 不外洩
{
    const G = setup(['wolf', 'wolf', 'seer', 'witch', 'hunter', 'vil']); G.solo = true;
    assert.strictEqual(m.pending(G).length, 6);
    assert.deepStrictEqual(m.view(G, 5).pend, []);                   // 夜晚不公開誰還沒行動
    assert.ok(m.view(G, 0).g.force === true && m.view(G, 1).g.force === false);
    G.solo = false; assert.deepStrictEqual(m.pending(G).sort(), [0, 1, 2]);
    G.solo = true; assert.ok(m.act(G, 0, { t: 'sleep' }, ctx()), '狼人不能睡');
    assert.strictEqual(m.act(G, 5, { t: 'sleep' }, ctx()), null);
}
// 隱藏資訊：別人的 view 不含角色分配
{
    const G = mk('wolf', 8, {}); const roles = G.role;
    for (let s = 0; s < 8; s++) {
        const j = JSON.stringify(m.view(G, s)); assert.ok(!j.includes(roles.join(',')) && !j.includes('"role":[') && j.includes(`"role":"${roles[s]}"`));
        assert.ok(m.validView(JSON.parse(j)));
        if (roles[s] !== 'wolf') assert.deepStrictEqual(m.view(G, s).g.mates, []);
    }
    const A = mk('avalon', 7, { mordred: 'on' });
    for (let s = 0; s < 7; s++) { const j = JSON.stringify(m.view(A, s)); assert.ok(!j.includes(A.role.join(',')) && m.validView(JSON.parse(j))); }
}
ok('r8 party-hub 狼人殺 / 阿瓦隆');
