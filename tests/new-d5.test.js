// 批次 d5：猜字遊戲、俄羅斯方塊 / 貪吃蛇最佳紀錄驗證、骰子賽跑 / 猜拳動畫純計算
const assert = require('assert');
const { load, ok } = require('./_load');
{
    const m = load('mini-games/word-guess.html', 'ZH_WORDS, EN_ANSWERS, EN_EXTRA, EN_SET, MODES, TRIES, shapeOk, validWord, scoreGuess, keyStates, twDate, pickDaily, trimGuesses, isWon, isDone, cleanDaily, dailyKeysToDelete, cleanStat, cleanStats, applyResult, winRate, shareText, flipPlan, CAP, FLIP_MS');
    // 詞庫
    assert.ok(m.ZH_WORDS.length >= 300 && new Set(m.ZH_WORDS).size === m.ZH_WORDS.length);
    assert.ok(m.ZH_WORDS.every(w => /^[一-鿿]{4}$/.test(w)));
    assert.ok(m.EN_ANSWERS.length >= 300 && new Set(m.EN_ANSWERS).size === m.EN_ANSWERS.length);
    assert.ok(m.EN_SET.size >= 800 && m.EN_SET.size === m.EN_ANSWERS.length + m.EN_EXTRA.length);
    assert.ok([...m.EN_SET].every(w => /^[a-z]{5}$/.test(w)));
    assert.ok(m.EN_ANSWERS.every(w => m.EN_SET.has(w)));
    assert.ok(m.validWord('zh', '一心一意') && !m.validWord('zh', '一心一二') && !m.validWord('zh', '一心') && !m.validWord('zh', 'abcd'));
    assert.ok(m.validWord('en', 'crane') && !m.validWord('en', 'zzzzz') && !m.validWord('en', 'CRANE') && !m.validWord('en', 'cran') && !m.validWord('en', null) && !m.validWord('xx', 'crane'));
    ok('word-guess word lists / validWord');

    // 比對（含重複字母的正確規則）
    const S = (g, a) => m.scoreGuess(g, a).join('');
    assert.strictEqual(S('crane', 'crane'), 'ccccc');
    assert.strictEqual(S('cares', 'crane'), 'cpppa');            // C 綠；A R E 在答案裡但位置不同；S 沒有
    assert.strictEqual(S('speed', 'abide'), 'aapap');            // 答案只有一個 e：先出現的 e（第 3 格）黃，第 4 格的 e 灰
    assert.strictEqual(S('speed', 'erase'), 'pappa');       // 答案有兩個 e：兩個都黃
    assert.strictEqual(S('allee', 'apple'), 'cpaac');            // 綠色優先吃掉 e；第一個 l 黃、第二個 l 灰
    assert.strictEqual(S('aaaaa', 'abcde'), 'caaaa');            // 只有一個 a
    assert.strictEqual(S('xaaaa', 'abcde'), 'apaaa');
    assert.strictEqual(S('一帆風順', '一心一意'), 'caaa');
    assert.strictEqual(S('三心二意', '一心一意'), 'acac');
    assert.strictEqual(S('一二一二', '一一二三'), 'cppa');
    // 一般性質：綠 + 黃的總數不會超過答案裡該字的出現次數；答案本身全綠
    const pool = m.EN_ANSWERS.slice(0, 120);
    for (let i = 0; i < pool.length; i++) {
        const a = pool[i], g = pool[(i * 7 + 3) % pool.length], r = m.scoreGuess(g, a);
        assert.strictEqual(m.scoreGuess(a, a).join(''), 'ccccc');
        for (const ch of new Set(g)) {
            const hit = [...g].filter((c, j) => c === ch && r[j] !== 'a').length, cnt = [...a].filter(c => c === ch).length;
            assert.ok(hit <= cnt, g + ' vs ' + a);
        }
        [...g].forEach((c, j) => { if (c === a[j]) assert.strictEqual(r[j], 'c'); });
    }
    ok('word-guess scoreGuess (duplicates)');

    // 鍵盤 / 字表狀態：綠 > 黃 > 灰
    assert.deepStrictEqual(m.keyStates(['cares'], 'crane'), { c: 'c', a: 'p', r: 'p', e: 'p', s: 'a' });
    assert.deepStrictEqual(m.keyStates(['allee', 'apple'], 'apple'), { a: 'c', l: 'c', e: 'c', p: 'c' });
    const ks = m.keyStates(['allee'], 'apple'); assert.strictEqual(ks.l, 'p'); assert.strictEqual(ks.e, 'c'); assert.strictEqual(ks.a, 'c');
    assert.deepStrictEqual(m.keyStates([], 'apple'), {});
    ok('word-guess keyStates');

    // 台灣時間日期與每日題目
    assert.strictEqual(m.twDate(Date.UTC(2026, 0, 1, 16, 0, 0)), '2026-01-02');
    assert.strictEqual(m.twDate(Date.UTC(2026, 0, 1, 15, 59, 59)), '2026-01-01');
    assert.strictEqual(m.twDate(Date.UTC(2026, 11, 31, 20, 0, 0)), '2027-01-01');
    for (const mode of ['zh', 'en']) {
        const seen = new Set();
        for (let d = 1; d <= 60; d++) {
            const date = '2026-06-' + String(d % 30 + 1).padStart(2, '0') + (d > 30 ? 'x' : ''), a = m.pickDaily(mode, date);
            assert.strictEqual(a, m.pickDaily(mode, date)); assert.ok(m.MODES[mode].answers.includes(a)); seen.add(a);
        }
        assert.ok(seen.size > 20, mode + ' 每天不同題 ' + seen.size);
    }
    assert.notStrictEqual(m.pickDaily('zh', '2026-10-10') + '|' + m.pickDaily('en', '2026-10-10'), '');
    ok('word-guess daily pick / twDate');

    // 存檔整理與完成判斷
    assert.deepStrictEqual(m.trimGuesses(['slate', 'slate', 'CRANE', 'abc', 'crane', 'about'], 'crane', 'en'), ['slate', 'crane']);
    assert.deepStrictEqual(m.trimGuesses(['aaaaa', 'bbbbb', 'ccccc', 'ddddd', 'eeeee', 'fffff', 'ggggg'], 'crane', 'en').length, 6);
    assert.deepStrictEqual(m.trimGuesses(null, 'crane', 'en'), []); assert.deepStrictEqual(m.trimGuesses('crane', 'crane', 'en'), []);
    assert.deepStrictEqual(m.trimGuesses([1, null, {}, '一心一意'], '一心一意', 'zh'), ['一心一意']);
    assert.ok(m.isWon(['slate', 'crane'], 'crane') && !m.isWon([], 'crane') && !m.isWon(['crane', 'slate'], 'crane'));
    assert.ok(m.isDone(['a', 'b', 'c', 'd', 'e', 'f'], 'crane') && m.isDone(['crane'], 'crane') && !m.isDone(['slate'], 'crane'));
    assert.deepStrictEqual(m.cleanDaily(null), { zh: [], en: [] });
    assert.deepStrictEqual(m.cleanDaily([1, 2]), { zh: [], en: [] });
    assert.deepStrictEqual(m.cleanDaily({ zh: 'x', en: ['crane', 5, 'toolong', null] }), { zh: [], en: ['crane'] });
    assert.deepStrictEqual(m.cleanDaily({ zh: ['一心一意', 'abcd', '一心'], en: [] }), { zh: ['一心一意'], en: [] });
    assert.strictEqual(m.cleanDaily({ en: Array(20).fill('crane') }).en.length, 6);
    ok('word-guess trimGuesses / cleanDaily');

    // 每日進度鍵修剪：只留最近 30 天，格式不對的前綴鍵也刪，別人的鍵不動
    const keys = ['other', 'st_style', 'wordg_stats', 'wordg_daily_junk', 'wordg_daily_2026-1-1'];
    for (let i = 0; i < 40; i++) keys.push('wordg_daily_' + new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
    const del = m.dailyKeysToDelete(keys);
    assert.strictEqual(del.length, 12); assert.ok(del.includes('wordg_daily_junk') && del.includes('wordg_daily_2026-1-1'));
    assert.ok(del.includes('wordg_daily_2026-01-01') && del.includes('wordg_daily_2026-01-10') && !del.includes('wordg_daily_2026-01-11') && !del.includes('wordg_daily_2026-02-09'));
    assert.ok(!del.includes('other') && !del.includes('wordg_stats'));
    assert.deepStrictEqual(m.dailyKeysToDelete(['wordg_daily_2026-01-01']), []);
    assert.deepStrictEqual(m.dailyKeysToDelete([]), []);
    ok('word-guess dailyKeysToDelete (keep 30)');

    // 統計：驗證容錯、更新規則
    assert.deepStrictEqual(m.cleanStat(null), { p: 0, w: 0, s: 0, m: 0, d: [0, 0, 0, 0, 0, 0] });
    assert.deepStrictEqual(m.cleanStat('x'), m.cleanStat(undefined));
    const bad = m.cleanStat({ p: 'a', w: -3, s: 1.5, m: NaN, d: 'zz' }); assert.deepStrictEqual(bad, m.cleanStat(null));
    const fix = m.cleanStat({ p: 5, w: 9, s: 20, m: 1, d: [1, 2, null, 'x', -1, 7, 99] });
    assert.strictEqual(fix.p, 5); assert.strictEqual(fix.w, 5); assert.strictEqual(fix.s, 5); assert.strictEqual(fix.m, 5); assert.deepStrictEqual(fix.d, [1, 2, 0, 0, 0, 7]);
    assert.strictEqual(m.cleanStat({ p: 1e12, w: 1e12 }).p, m.CAP);
    assert.deepStrictEqual(m.cleanStats(null), { zh: m.cleanStat(null), en: m.cleanStat(null) });
    assert.deepStrictEqual(m.cleanStats({ zh: { p: 2, w: 1 }, en: 7 }).en, m.cleanStat(null));
    let s = m.cleanStat(null);
    s = m.applyResult(s, true, 3); assert.deepStrictEqual([s.p, s.w, s.s, s.m, s.d[2]], [1, 1, 1, 1, 1]);
    s = m.applyResult(s, true, 1); assert.deepStrictEqual([s.p, s.w, s.s, s.m, s.d[0]], [2, 2, 2, 2, 1]);
    s = m.applyResult(s, false, 0); assert.deepStrictEqual([s.p, s.w, s.s, s.m], [3, 2, 0, 2]);
    s = m.applyResult(s, true, 6); assert.deepStrictEqual([s.p, s.w, s.s, s.m, s.d[5]], [4, 3, 1, 2, 1]);
    const before = JSON.stringify(s); m.applyResult(s, true, 2); assert.strictEqual(JSON.stringify(s), before);                // 不改動輸入
    assert.strictEqual(m.applyResult(s, true, 9).w, s.w); assert.strictEqual(m.applyResult(s, true, 9).s, 0);                       // 次數超出範圍不算猜中
    assert.strictEqual(m.applyResult({ p: m.CAP, w: m.CAP, s: m.CAP, m: m.CAP, d: [m.CAP, 0, 0, 0, 0, 0] }, true, 1).p, m.CAP);   // 到上限不再增加
    assert.strictEqual(m.winRate({ p: 0, w: 0 }), 0); assert.strictEqual(m.winRate({ p: 3, w: 2 }), 67);
    ok('word-guess stats');

    // 分享文字
    assert.strictEqual(m.shareText('en', true, '2026-10-10', ['cares', 'crane'], 'crane'), '猜字遊戲 英文 2026-10-10 2/6\n🟩🟨🟨🟨⬛\n🟩🟩🟩🟩🟩');
    assert.strictEqual(m.shareText('zh', false, '2026-10-10', ['三心二意'], '一心一意'), '猜字遊戲 成語（練習） X/6\n⬛🟩⬛🟩');
    assert.strictEqual(m.shareText('zh', true, '2026-10-10', ['一心一意'], '一心一意'), '猜字遊戲 成語 2026-10-10 1/6\n🟩🟩🟩🟩');
    const lose = m.shareText('en', true, '2026-10-10', Array(6).fill(0).map((_, i) => ['slate', 'about', 'cares', 'aback', 'dogma', 'fuzzy'][i]), 'crane');
    assert.ok(lose.startsWith('猜字遊戲 英文 2026-10-10 X/6') && lose.split('\n').length === 7);
    ok('word-guess shareText');

    // 翻牌時間表
    const p = m.flipPlan(5);
    assert.deepStrictEqual(p.starts, [0, 200, 400, 600, 800]); assert.strictEqual(p.half, m.FLIP_MS / 2); assert.strictEqual(p.total, 800 + m.FLIP_MS);
    assert.strictEqual(m.flipPlan(4).total, 600 + m.FLIP_MS);
    ok('word-guess flipPlan');
}
{
    const t = load('mini-games/tetris.html', 'cleanBest'), n = load('mini-games/snake.html', 'cleanBest');
    for (const f of [t.cleanBest, n.cleanBest]) {
        assert.strictEqual(f(120), 120); assert.strictEqual(f(0), 0); assert.strictEqual(f(12.7), 12);
        for (const v of [null, undefined, 'abc', '50', -5, NaN, Infinity, {}, [], [3], true]) assert.strictEqual(f(v), 0, String(v));
    }
    ok('tetris / snake cleanBest');
}
{
    const m = load('fun/board-race.html', 'GOAL, EVENTS, move, animPlan, evLabel, validMv, DIE_MS, HOP_MS, EV_PAUSE, SLIDE_MS');
    for (let from = 0; from < m.GOAL; from++) for (let roll = 1; roll <= 6; roll++) {
        const r = m.move(from, roll), p = m.animPlan(from, roll);
        assert.strictEqual(p.final, r.pos); assert.strictEqual(p.landed, r.landed);
        assert.strictEqual(p.steps[p.steps.length - 1].to, r.pos);                                    // 動畫終點 = 實際位置
        let t = 0, cur = from;
        for (const s of p.steps) {                                                                    // 連續、時間遞增、逐格或一次滑動
            assert.strictEqual(s.from, cur); assert.strictEqual(s.t0, t); assert.ok(s.t1 > s.t0);
            if (s.kind === 'hop') assert.strictEqual(s.to, s.from + 1); else if (s.kind === 'wait') assert.strictEqual(s.to, s.from); else { assert.strictEqual(s.kind, 'slide'); assert.ok(s.to < s.from); }
            t = s.t1; cur = s.to;
        }
        assert.strictEqual(p.total, t);
        assert.strictEqual(p.evAt >= 0, !!r.ev); assert.strictEqual(p.ev, r.ev);
        assert.ok(p.total <= 12 * Math.max(m.HOP_MS, m.SLIDE_MS) + m.EV_PAUSE);
    }
    const a = m.animPlan(2, 2);                                                                       // 第 4 格（綠 +3）→ 第 7 格
    assert.deepStrictEqual(a.steps.map(s => [s.kind, s.to]), [['hop', 3], ['hop', 4], ['wait', 4], ['hop', 5], ['hop', 6], ['hop', 7]]);
    assert.strictEqual(a.evAt, 2 * m.HOP_MS); assert.strictEqual(a.final, 7);
    const b = m.animPlan(5, 3);                                                                       // 第 8 格（紅 −3）→ 第 5 格，一次滑回
    assert.deepStrictEqual(b.steps.map(s => [s.kind, s.to]), [['hop', 6], ['hop', 7], ['hop', 8], ['wait', 8], ['slide', 5]]);
    const w = m.animPlan(28, 6); assert.strictEqual(w.final, 30); assert.deepStrictEqual(w.steps.map(s => s.to), [29, 30]);   // 超過終點只走到終點
    const sk = m.animPlan(9, 2); assert.deepStrictEqual(sk.steps.map(s => s.kind), ['hop', 'hop', 'wait']); assert.strictEqual(sk.final, 11);
    assert.ok(m.evLabel(null) === '' && /前進 3/.test(m.evLabel(m.EVENTS[4])) && /後退 5/.test(m.evLabel(m.EVENTS[27])) && /暫停/.test(m.evLabel(m.EVENTS[11])) && /再擲/.test(m.evLabel(m.EVENTS[17])));
    assert.ok(m.validMv({ p: 0, f: 0, r: 6, seq: 1 }) && m.validMv({ p: 5, f: 29, r: 1, seq: 0 }));
    for (const bad of [null, undefined, 5, {}, { p: 6, f: 0, r: 1, seq: 1 }, { p: 0, f: 30, r: 1, seq: 1 }, { p: 0, f: 0, r: 7, seq: 1 }, { p: 0, f: 0, r: 0, seq: 1 }, { p: 0, f: 0, r: 1 }, { p: '0', f: 0, r: 1, seq: 1 }, { p: 0, f: 1.5, r: 1, seq: 1 }]) assert.ok(!m.validMv(bad), JSON.stringify(bad));
    ok('board-race animPlan / validMv');
}
{
    const m = load('fun/rps.html', 'beats, outcomeFx, SHAKE_MS, POP_MS, CHOICES');
    assert.deepStrictEqual(m.outcomeFx(1), ['win', 'lose']); assert.deepStrictEqual(m.outcomeFx(-1), ['lose', 'win']); assert.deepStrictEqual(m.outcomeFx(0), ['tie', 'tie']);
    for (const a of m.CHOICES) for (const b of m.CHOICES) {                                          // 每一種出拳組合：恰一方 win 或雙方 tie，與 beats 一致
        const [x, y] = m.outcomeFx(m.beats(a, b));
        assert.ok(a === b ? x === 'tie' && y === 'tie' : (x === 'win') !== (y === 'win') && (x === 'lose') !== (y === 'lose'));
    }
    assert.ok(m.SHAKE_MS > 0 && m.POP_MS > 0 && m.SHAKE_MS + m.POP_MS < 1200);                       // 單機揭曉後 1200ms 進下一局，動畫要在這之前結束
    ok('rps outcomeFx');
}
