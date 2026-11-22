// 批次 u1：手把（screen-test）、計數器 / 羽球（scoreboard）、21 點基本策略（blackjack）純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');

{
    const m = load('utils/screen-test.html', 'deadzone, gpBtnName, stickPos, TABS, validTab');
    assert.strictEqual(m.deadzone(0.05, 0.1), 0); assert.strictEqual(m.deadzone(-0.5, 0.1), -0.5); assert.strictEqual(m.deadzone(NaN, 0.1), 0); assert.strictEqual(m.deadzone(undefined, 0.1), 0);
    assert.strictEqual(m.gpBtnName(0, 'standard'), 'A'); assert.strictEqual(m.gpBtnName(0, ''), '按鈕 0'); assert.strictEqual(m.gpBtnName(40, 'standard'), '按鈕 40');
    const s = m.stickPos(0.05, 1, 0.1); assert.strictEqual(s.x, 0); assert.strictEqual(s.y, 1); assert.strictEqual(s.mag, 1);
    assert.ok(m.stickPos(1, 1, 0).mag === 1 && m.stickPos(0.05, -0.05, 0.1).mag === 0);
    assert.strictEqual(m.validTab('pad'), 'pad');
    ok('screen-test gamepad');
}

{
    const m = load('fun/scoreboard.html', 'validCounter, cntAdd, cntTotal, cntPct, cntNewGroup, CNT_MAX, CNT_CAP, badGameDone, badCourt, badReplay');
    assert.strictEqual(m.validCounter(null).groups.length, 1); assert.strictEqual(m.validCounter({ groups: 'x' }).groups.length, 1);
    const bad = m.validCounter({ groups: [{ id: 1, name: 'a', n: -5 }, { id: 1, name: 'b', n: 1e9 }, null, { name: 5 }, { id: 'x', name: '  ', n: 'z' }], sound: 1 });
    assert.deepStrictEqual(bad.groups.map(g => g.n), [0, m.CNT_CAP, 0]); assert.strictEqual(new Set(bad.groups.map(g => g.id)).size, 3); assert.strictEqual(bad.sound, false); assert.strictEqual(bad.groups[2].name, '計數');
    assert.strictEqual(m.validCounter({ groups: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: 'g', n: 1 })) }).groups.length, m.CNT_MAX);
    let c = { groups: [{ id: 1, name: 'm', n: 0 }, { id: 2, name: 'f', n: 3 }], sound: false, vib: false };
    c = m.cntAdd(c, 1, -1); assert.strictEqual(c.groups[0].n, 0); c = m.cntAdd(c, 1, 1); assert.strictEqual(m.cntTotal(c), 4); assert.strictEqual(m.cntPct(c, c.groups[1]), 75);
    c = m.cntNewGroup(c, '新'); assert.strictEqual(c.groups.length, 3); assert.strictEqual(c.groups[2].id, 3); assert.strictEqual(m.cntNewGroup(c, '  ').groups.length, 3);
    let full = c; for (let i = 0; i < 20; i++) full = m.cntNewGroup(full, 'x' + i); assert.strictEqual(full.groups.length, m.CNT_MAX);

    assert.ok(m.badGameDone(21, 19) && !m.badGameDone(21, 20) && m.badGameDone(22, 20) && !m.badGameDone(29, 29) && m.badGameDone(30, 29) && !m.badGameDone(20, 10));
    assert.strictEqual(m.badCourt(0), '右'); assert.strictEqual(m.badCourt(7), '左');
    const rep = (arr) => m.badReplay(arr.flatMap(([w, n]) => Array(n).fill(w)));
    let r = m.badReplay([]); assert.strictEqual(r.srv, 0); assert.strictEqual(r.court, '右');
    r = m.badReplay([1]); assert.strictEqual(r.srv, 1); assert.deepStrictEqual(r.cur, [0, 1]); assert.strictEqual(r.court, '左');
    assert.strictEqual(m.badReplay([], 1).srv, 1);
    r = rep([[0, 21]]); assert.deepStrictEqual(r.games, [[21, 0]]); assert.deepStrictEqual(r.cur, [0, 0]); assert.strictEqual(r.note, 'game'); assert.strictEqual(r.srv, 0);
    // 20 平後領先 2 分才贏
    const seq = [...Array(20).fill(0), ...Array(20).fill(1), 0, 1, 0, 0]; r = m.badReplay(seq); assert.deepStrictEqual(r.games, [[23, 21]]);
    // 29 平 → 30 分封頂
    r = m.badReplay([...Array.from({ length: 29 }, () => [0, 1]).flat(), 1]); assert.deepStrictEqual(r.games, [[29, 30]]);
    // 三戰兩勝，之後的球不計
    r = rep([[0, 21], [1, 21], [0, 11]]); assert.strictEqual(r.note, 'mid'); assert.deepStrictEqual(r.wins, [1, 1]);
    r = rep([[0, 21], [1, 21], [0, 21], [1, 5]]); assert.ok(r.over); assert.deepStrictEqual(r.wins, [2, 1]); assert.strictEqual(r.note, 'over'); assert.strictEqual(r.games.length, 3);
    // 第 2 局不會出現決勝局中場換邊
    r = rep([[0, 21], [1, 11]]); assert.strictEqual(r.note, null);
    // 悔棋 = 去掉最後一球
    const log = [0, 0, 1]; assert.deepStrictEqual(m.badReplay(log.slice(0, -1)).cur, [2, 0]);
    ok('scoreboard counter + badminton');
}

{
    const m = load('mini-games/blackjack.html', 'bjStrategy, handType, validDrill, drillAdd, drillFull, drillRate, defDrill, DRILL_CAP');
    const S = (a, b, up, sur) => m.bjStrategy([a, b], up, sur);
    assert.strictEqual(S('10S', '6H', '10D'), 'surrender'); assert.strictEqual(S('10S', '6H', '10D', false), 'hit');
    assert.strictEqual(S('AS', '7H', '9D'), 'hit'); assert.strictEqual(S('AS', '7H', '6D'), 'double'); assert.strictEqual(S('AS', '7H', '7D'), 'stand');
    assert.strictEqual(S('6S', '5H', '6D'), 'double'); assert.strictEqual(S('6S', '5H', 'AD'), 'hit');
    for (const up of ['2D', '6D', '10D', 'AD']) { assert.strictEqual(S('8S', '8H', up), 'split'); assert.strictEqual(S('10S', 'KH', up), 'stand'); assert.strictEqual(S('AS', 'AH', up), 'split'); assert.notStrictEqual(S('5S', '5H', up), 'split'); }
    assert.strictEqual(S('5S', '5H', '6D'), 'double'); assert.strictEqual(S('9S', '9H', '7D'), 'stand'); assert.strictEqual(S('9S', '9H', '8D'), 'split');
    assert.strictEqual(S('10S', '2H', '3D'), 'hit'); assert.strictEqual(S('10S', '2H', '4D'), 'stand'); assert.strictEqual(S('10S', '7H', 'AD'), 'stand');
    assert.strictEqual(S('2S', '2H', '8D'), 'hit'); assert.strictEqual(S('4S', '4H', '5D'), 'split');
    assert.strictEqual(m.handType(['AS', '6H']), 'soft'); assert.strictEqual(m.handType(['5S', '5H']), 'hard'); assert.strictEqual(m.handType(['KS', 'QH']), 'pair'); assert.strictEqual(m.handType(['AS', 'AH']), 'pair');
    // 全表：每種兩張牌 × 莊家明牌都要查得到合法動作
    const R = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10']; const okA = new Set(['hit', 'stand', 'double', 'split', 'surrender']);
    for (const a of R) for (const b of R) { if (a === 'A' && b === '10' || a === '10' && b === 'A') continue; for (const u of [...R.slice(1), 'A']) assert.ok(okA.has(S(a + 'S', b + 'H', u + 'D')), a + b + u); }
    // 黃金表：由精確計算得出（8 副牌有限牌堆、S17、DAS、莊家偷看、晚投降、可再分牌至 4 手、分 A 只拿一張；8 副牌逐格 EV 取最佳動作）。欄 = 莊家 2..10,A
    const GOLD = {
        hard: { 8: 'HHHHHHHHHH', 9: 'HDDDDHHHHH', 10: 'DDDDDDDDHH', 11: 'DDDDDDDDDH', 12: 'HHSSSHHHHH', 13: 'SSSSSHHHHH', 14: 'SSSSSHHHHH', 15: 'SSSSSHHHRH', 16: 'SSSSSHHRRR', 17: 'SSSSSSSSSS' },
        soft: { 13: 'HHHDDHHHHH', 14: 'HHHDDHHHHH', 15: 'HHDDDHHHHH', 16: 'HHDDDHHHHH', 17: 'HDDDDHHHHH', 18: 'SDDDDSSHHH', 19: 'SSSSSSSSSS' },
        pair: { 2: 'PPPPPPHHHH', 3: 'PPPPPPHHHH', 4: 'HHHPPHHHHH', 6: 'PPPPPHHHHH', 7: 'PPPPPPHHHH', 8: 'PPPPPPPPPP', 9: 'PPPPPSPPSS', 10: 'SSSSSSSSSS', 11: 'PPPPPPPPPP' },
    };
    const NAMEC = { H: 'hit', S: 'stand', D: 'double', P: 'split', R: 'surrender' }, UPS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
    const cardsFor = (kind, k) => kind === 'hard' ? (k >= 12 ? ['10S', (k - 10) + 'H'] : [k === 8 ? '2S' : k === 9 ? '3S' : k === 10 ? '4S' : '5S', '6H']) : kind === 'soft' ? ['AS', (k - 11) + 'H'] : (k === 11 ? ['AS', 'AH'] : [k + 'S', k + 'H']);
    for (const kind of Object.keys(GOLD)) for (const k of Object.keys(GOLD[kind])) for (let i = 0; i < 10; i++) {
        const want = NAMEC[GOLD[kind][k][i]], cs = cardsFor(kind, +k), up = UPS[i] + 'D';
        assert.strictEqual(S(cs[0], cs[1], up), want, `${kind} ${k} vs ${UPS[i]}`);
        assert.strictEqual(S(cs[0], cs[1], up, false), want === 'surrender' ? 'hit' : want, `${kind} ${k} vs ${UPS[i]} 不可投降`);
    }
    // 統計
    assert.deepStrictEqual(m.validDrill(null), m.defDrill()); assert.deepStrictEqual(m.validDrill({ all: [5, 3], hard: 'x', soft: [1, 2.5], pair: [-1, 4] }), m.defDrill());
    assert.deepStrictEqual(m.validDrill({ all: [3, 5], hard: [1, 2] }).all, [3, 5]);
    let d = m.drillAdd(null, 'soft', true); d = m.drillAdd(d, 'soft', false); assert.deepStrictEqual(d.all, [1, 2]); assert.deepStrictEqual(d.soft, [1, 2]); assert.deepStrictEqual(d.hard, [0, 0]);
    assert.strictEqual(m.drillRate([1, 2]), '50%（1/2）'); assert.strictEqual(m.drillRate([0, 0]), '—');
    assert.ok(!m.drillFull(d) && m.drillFull({ ...d, all: [0, m.DRILL_CAP] }));
    ok('blackjack strategy drill');
}
