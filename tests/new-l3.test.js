// l3 批次：fun/flashcards.html（CSV 匯入 / 聽寫判分 / 多益字庫）、utils/periodic-table.html（記憶測驗）、utils/time-tracker.html（學習時數）
const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- 單字閃卡 ----------
{
    const m = load('fun/flashcards.html', 'MAX_CARDS, LIM, parseCsvCards, mergeCards, spellNorm, judgeSpell, cleanDecks, validCard, TOEIC, TOEIC_RAW, mkCard');

    // CSV：兩欄 / 三欄 / Tab / 引號 / 標題 / 錯誤行號
    let r = m.parseCsvCards('apple,蘋果\nbanana,香蕉,I like bananas.\n"hello, world",哈囉世界,"She said ""hi"""\n');
    assert.deepStrictEqual(r.cards.map(c => [c.f, c.b, c.ex]), [['apple', '蘋果', undefined], ['banana', '香蕉', 'I like bananas.'], ['hello, world', '哈囉世界', 'She said "hi"']]);
    assert.ok(r.cards.every(c => m.validCard(c) && !c.seen) && r.errors.length === 0);
    r = m.parseCsvCards('word\tmeaning\nlibrary\t圖書館\tI go to the library.\nbook\t書\t\n');
    assert.deepStrictEqual(r.cards.map(c => [c.f, c.b, c.ex]), [['library', '圖書館', 'I go to the library.'], ['book', '書', undefined]], 'Tab 分隔、標題略過、空第三欄');
    r = m.parseCsvCards('單字,解釋\ncat,貓');
    assert.strictEqual(r.cards.length, 1);
    r = m.parseCsvCards('a，甲\nb|乙');                                   // 第一行決定分隔符號：全形逗號
    assert.deepStrictEqual(r.cards.map(c => c.f), ['a']); assert.strictEqual(r.errors.length, 1);
    r = m.parseCsvCards('a|甲\nb|乙|丙\n\nonly\nx|y|z|w\n|空單字\nnoback|\n"bad,x\nlong|' + 'x'.repeat(201) + '\n' + 'f'.repeat(81) + '|x\nok|ok|' + 'e'.repeat(201));
    assert.deepStrictEqual(r.cards.map(c => c.f), ['a', 'b']);
    assert.deepStrictEqual(r.errors.map(e => e.line), [4, 5, 6, 7, 8, 9, 10, 11]);        // 第 3 行空白也算行號
    assert.ok(r.errors[0].why.includes('欄') && r.errors[3].why.includes('解釋') && r.errors[4].why.includes('引號'));
    assert.deepStrictEqual(m.parseCsvCards(''), { cards: [], errors: [] }); assert.deepStrictEqual(m.parseCsvCards(null).cards, []);
    assert.strictEqual(m.parseCsvCards('﻿a,b').cards[0].f, 'a', 'BOM');
    assert.strictEqual(m.parseCsvCards('a,b,,').cards.length, 1, '尾端空欄');

    // 合併：略過 / 覆蓋 / 上限
    const old = [{ ...m.mkCard('apple', '舊'), reps: 3, iv: 8, seen: true, due: '2026-01-01', ex: '舊例句' }];
    const add = m.parseCsvCards('apple,新\npear,梨\npear,梨2\nplum,李子,Plum.').cards;
    let g = m.mergeCards(old, add, 'skip');
    assert.deepStrictEqual([g.added, g.updated, g.skipped, g.full, g.list.length], [2, 0, 2, 0, 3]); assert.strictEqual(g.list[0].b, '舊');
    g = m.mergeCards(old, add, 'overwrite');
    assert.deepStrictEqual([g.added, g.updated, g.skipped], [2, 2, 0]);
    assert.strictEqual(g.list[0].b, '新'); assert.strictEqual(g.list[0].reps, 3, '覆蓋保留進度'); assert.strictEqual(g.list[0].ex, '舊例句', '沒給例句就保留舊的');
    assert.strictEqual(g.list.find(c => c.f === 'pear').b, '梨2'); assert.strictEqual(old[0].b, '舊', '不改動原陣列');
    g = m.mergeCards(old, add, 'skip', 1); assert.deepStrictEqual([g.added, g.full, g.list.length], [1, 1, 2]);
    g = m.mergeCards([], add, 'skip', 0); assert.deepStrictEqual([g.added, g.full], [0, 4]);
    const full = Array.from({ length: m.MAX_CARDS }, (_, i) => m.mkCard('w' + i, 'x'));
    g = m.mergeCards(full, [m.mkCard('new', 'x'), m.mkCard('w1', 'y')], 'overwrite'); assert.deepStrictEqual([g.added, g.updated, g.full, g.list.length], [0, 1, 1, m.MAX_CARDS], '滿了：新卡拒絕、覆蓋仍可');
    ok('flashcards: CSV import / merge');

    // 聽寫判分
    const J = m.judgeSpell;
    assert.strictEqual(J('Apple', 'apple').ok, true); assert.strictEqual(J('  apple  ', 'Apple').ok, true); assert.strictEqual(J('ａｐｐｌｅ', 'apple').ok, true, '全形');
    assert.strictEqual(J('apple.', 'apple').ok, true, '結尾標點'); assert.strictEqual(J("don’t", "don't").ok, true, '弧形撇號');
    assert.strictEqual(J('well-known', 'well known').ok, true); assert.strictEqual(J('well–known', 'well-known').ok, true, '連字號變體'); assert.strictEqual(J('ice  cream', 'ice cream').ok, true);
    assert.strictEqual(J('colour', 'color / colour').ok, true); assert.strictEqual(J('color', 'color / colour').ok, true); assert.strictEqual(J('color / colour', 'color / colour').ok, true);
    assert.deepStrictEqual(J('aple', 'apple'), { ok: false, near: true }); assert.strictEqual(J('appel', 'apple').near, true, '對調');
    assert.strictEqual(J('applee', 'apple').near, true); assert.strictEqual(J('aplle', 'apple').ok, false);
    assert.deepStrictEqual(J('xyz', 'apple'), { ok: false, near: false }); assert.deepStrictEqual(J('', 'apple'), { ok: false, near: false }); assert.deepStrictEqual(J(null, 'apple'), { ok: false, near: false });
    assert.strictEqual(J('cta', 'cat').near, false, '太短不提示'); assert.strictEqual(J('ca', 'cat').ok, false);
    assert.strictEqual(m.spellNorm('  Hello,  WORLD! '), 'hello, world');
    ok('flashcards: dictation judging');

    // cleanDecks 與例句欄位
    const good = m.mkCard('a', 'b', 'ex');
    let d = m.cleanDecks({ A: [good, { ...good, f: 'x', ex: 5 }, { ...good, f: 'y', ex: '' }, { ...good, f: 'z', ex: 'e'.repeat(500) }] });
    assert.strictEqual(d.A[0].ex, 'ex'); assert.ok(!('ex' in d.A[1]) && !('ex' in d.A[2])); assert.strictEqual(d.A[3].ex.length, 200);
    const noex = { f: 'a', b: 'b', ease: 2.5, iv: 0, reps: 0, due: '', seen: false };
    assert.deepStrictEqual(m.cleanDecks({ A: [noex] }), { A: [noex] }, '舊卡片沒有例句也不變');

    // 多益字庫
    const lines = m.TOEIC_RAW.split('\n').filter(Boolean), fs = lines.map(l => l.split('|'));
    assert.ok(lines.length >= 280 && lines.length <= 420, '300–420 字：' + lines.length);
    assert.ok(fs.every(p => p.length === 4 && p.every(x => x.trim() === x && x)), '每行 4 欄、無空欄');
    assert.strictEqual(new Set(fs.map(p => p[0])).size, fs.length, '單字不重複');
    assert.ok(fs.every(p => /^[a-zé]+$/.test(p[0])) && fs.every(p => /^(n|v|adj|adv|prep)\.$/.test(p[1])), '單字與詞性格式');
    assert.ok(fs.every(p => /[一-鿿]/.test(p[2]) && /^[A-Z].*[.?!]$/.test(p[3])), '中文意思與完整例句');
    assert.strictEqual(m.TOEIC.length, fs.length); assert.ok(m.TOEIC.every(c => m.validCard(c) && c.b.startsWith('(') && c.ex && c.f.length <= m.LIM.f && c.b.length <= m.LIM.b && c.ex.length <= m.LIM.ex));
    assert.ok(m.TOEIC.length <= m.MAX_CARDS);
    const once = m.mergeCards([], m.TOEIC), twice = m.mergeCards(once.list, m.TOEIC);
    assert.deepStrictEqual([once.added, twice.added, twice.skipped], [m.TOEIC.length, 0, m.TOEIC.length], '重複加入檢查');
    const prog = once.list.map((c, i) => (i === 0 ? { ...c, reps: 4, seen: true } : c));
    assert.strictEqual(m.mergeCards(prog.slice(1), m.TOEIC).list.find(c => c.f === prog[0].f).reps, 0);
    assert.strictEqual(m.mergeCards(prog, m.TOEIC).list[0].reps, 4, '補字不動既有進度');
    ok('flashcards: TOEIC deck');
}

// ---------- 週期表記憶測驗 ----------
{
    const m = load('utils/periodic-table.html', 'E, cleanQuiz, recordAnswer, quizSummary, quizPool, pickZ, makeQuestion, checkAnswer, periodOf, groupOf, qLabel, elName');
    assert.deepStrictEqual(m.cleanQuiz(null), { s: {} }); assert.deepStrictEqual(m.cleanQuiz('x'), { s: {} }); assert.deepStrictEqual(m.cleanQuiz({ s: [] }), { s: {} });
    const q = m.cleanQuiz({ s: { 1: { a: 5, c: 9, l: 0 }, 118: { a: '3', c: '2' }, 0: { a: 1, c: 1 }, 119: { a: 1, c: 1 }, x: { a: 1, c: 1 }, 2: null, 3: { a: -1, c: 0 }, 4: { a: 'q', c: 1 }, 5: { a: 2, c: 'bad', l: 'x' }, 6: 5 } });
    assert.deepStrictEqual(q.s, { 1: { a: 5, c: 5, l: 0 }, 118: { a: 3, c: 2, l: 1 }, 5: { a: 2, c: 0, l: 1 } });
    const huge = m.cleanQuiz({ s: Object.fromEntries(Array.from({ length: 500 }, (_, i) => [i, { a: 1, c: 1 }])) }); assert.strictEqual(Object.keys(huge.s).length, 118, '上限 118 項');

    let s = { s: {} };
    s = m.recordAnswer(s, 26, true); s = m.recordAnswer(s, 26, false); s = m.recordAnswer(s, 8, true);
    assert.deepStrictEqual(s.s[26], { a: 2, c: 1, l: 0 }); assert.deepStrictEqual(m.quizSummary(s), { answered: 3, correct: 2, pct: 67, seen: 2, weak: 1 });
    assert.deepStrictEqual(m.quizSummary({ s: {} }), { answered: 0, correct: 0, pct: 0, seen: 0, weak: 0 });
    const s0 = { s: {} }; m.recordAnswer(s0, 1, true); assert.deepStrictEqual(s0, { s: {} }, '不改動原物件');

    // 範圍
    assert.strictEqual(m.quizPool('all', s).length, 118); assert.strictEqual(m.quizPool('xxx', s).length, 118);
    assert.deepStrictEqual(m.quizPool('first20', s), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.deepStrictEqual(m.quizPool('p1', s), [1, 2]); assert.strictEqual(m.quizPool('p2', s).length, 8); assert.strictEqual(m.quizPool('p6', s).length, 32); assert.strictEqual(m.quizPool('p7', s).length, 32);
    assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7].map(n => m.quizPool('p' + n, s).length).reduce((a, b) => a + b), 118);
    assert.deepStrictEqual(m.quizPool('g1', s), [1, 3, 11, 19, 37, 55, 87]); assert.deepStrictEqual(m.quizPool('g18', s), [2, 10, 18, 36, 54, 86, 118]); assert.deepStrictEqual(m.quizPool('g17', s), [9, 17, 35, 53, 85, 117]);
    assert.strictEqual(m.quizPool('gf', s).length, 28, 'f 區 = 鑭系 14 + 錒系 14');
    assert.strictEqual([...Array.from({ length: 18 }, (_, i) => 'g' + (i + 1)), 'gf'].map(k => m.quizPool(k, s).length).reduce((a, b) => a + b), 118, '族別涵蓋全部且不重疊');
    assert.deepStrictEqual(m.quizPool('wrong', s), [26]); assert.deepStrictEqual(m.quizPool('wrong', { s: {} }), []);
    assert.deepStrictEqual(m.quizPool('wrong', m.recordAnswer(s, 26, true)), [], '最近答對就移出錯題');

    // 抽題
    assert.strictEqual(m.pickZ([5], s, 5), 5); assert.strictEqual(m.pickZ([], s, 0), 0);
    for (let i = 0; i < 20; i++) assert.strictEqual(m.pickZ([1, 2], s, 1, Math.random), 2);
    assert.strictEqual(m.pickZ([1, 26], s, 0, () => 0.99), 26); assert.strictEqual(m.pickZ([1, 26], s, 0, () => 0), 1);
    assert.strictEqual(m.pickZ([1, 26], s, 0, () => 0.3), 26, '錯題權重 3：1/4 以上就落在錯題');
    assert.strictEqual(m.pickZ([1, 26], s, 0, () => 0.2), 1);

    // 出題 / 判分
    for (const [from, to] of [['sym', 'name'], ['name', 'sym'], ['z', 'sym'], ['sym', 'z'], ['name', 'z'], ['z', 'name']]) {
        for (const z of [1, 26, 79, 104, 118]) {
            const k = m.makeQuestion(z, from, to, 'choice');
            assert.strictEqual(k.options.length, 4); assert.strictEqual(new Set(k.options).size, 4); assert.ok(k.options.includes(k.answer));
            assert.strictEqual(k.prompt, m.qLabel(z, from)); assert.ok(m.checkAnswer(k, k.answer));
        }
    }
    assert.strictEqual(m.makeQuestion(26, 'sym', 'name', 'input').options, undefined);
    const Q = (z, to) => ({ z, to });
    assert.ok(m.checkAnswer(Q(26, 'name'), '鐵') && m.checkAnswer(Q(26, 'name'), ' IRON ') && !m.checkAnswer(Q(26, 'name'), '銅'));
    assert.ok(m.checkAnswer(Q(13, 'name'), 'aluminum') && m.checkAnswer(Q(13, 'name'), 'Aluminium') && m.checkAnswer(Q(55, 'name'), 'Cesium') && m.checkAnswer(Q(16, 'name'), 'sulphur'));
    assert.ok(m.checkAnswer(Q(104, 'name'), 'rutherfordium') && !m.checkAnswer(Q(104, 'name'), ''), '無中文名時英文名');
    assert.strictEqual(m.elName(105), 'Dubnium'); assert.strictEqual(m.elName(26), '鐵');
    assert.ok(m.checkAnswer(Q(26, 'sym'), 'fe') && m.checkAnswer(Q(26, 'sym'), ' Fe ') && !m.checkAnswer(Q(26, 'sym'), 'F'));
    assert.ok(m.checkAnswer(Q(26, 'z'), '26') && m.checkAnswer(Q(26, 'z'), ' 026 ') && !m.checkAnswer(Q(26, 'z'), '26.5') && !m.checkAnswer(Q(26, 'z'), '2') && !m.checkAnswer(Q(26, 'z'), 'x') && !m.checkAnswer(Q(26, 'z'), null));
    // 名稱題的選項：每個元素的名稱標籤彼此不同（否則選項會重複）
    assert.strictEqual(new Set(Array.from({ length: 118 }, (_, i) => m.qLabel(i + 1, 'name'))).size, 118);
    ok('periodic-table: quiz');
}

// ---------- 工時紀錄：學習時數 ----------
{
    const T = load('utils/time-tracker.html', 'cleanProjects, cleanGoal, addProject, setStudy, studyReport, studyWeeks, removeProject, TT');
    const at = (y, mo, d, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime(), H = 36e5;
    // 舊資料補預設
    let ps = T.cleanProjects([{ id: 'a', name: 'A' }, { id: 'b', name: 'B', study: true, goal: '5' }, { id: 'c', name: 'C', study: 'yes', goal: 999 }, { id: 'd', name: 'D', study: true, goal: -1 }, { id: 'e', name: 'E', goal: 7.26 }]);
    assert.deepStrictEqual(ps.map(p => [p.study, p.goal]), [[false, 0], [true, 5], [false, 0], [true, 0], [false, 7.3]]);
    assert.strictEqual(T.cleanGoal('abc'), 0); assert.strictEqual(T.cleanGoal(168), 168); assert.strictEqual(T.cleanGoal(168.1), 0); assert.strictEqual(T.cleanGoal(0), 0);
    // 新增 / 設定
    let r = T.addProject([], '英文', '#112233', 0, { study: true, goal: '3.5' }); assert.deepStrictEqual([r.list[0].study, r.list[0].goal], [true, 3.5]);
    r = T.addProject([], 'X', '#112233', 0); assert.deepStrictEqual([r.list[0].study, r.list[0].goal], [false, 0], '一般專案不是科目');
    assert.ok(T.addProject(r.list, 'X', '', 0, { study: true }).err, '同名仍拒絕');
    const full = Array.from({ length: T.TT.PROJ_MAX }, (_, i) => ({ id: 'p' + i, name: 'n' + i })); assert.ok(T.addProject(full, 'new', '', 0, { study: true }).err, '科目也受 50 個上限');
    let q = T.setStudy(ps, 'a', true, 4); assert.deepStrictEqual([q[0].study, q[0].goal], [true, 4]); assert.strictEqual(ps[0].study, false, '不改動原陣列');
    q = T.setStudy(q, 'a', false, 4); assert.deepStrictEqual([q[0].study, q[0].goal], [false, 0], '取消科目清掉目標');
    assert.deepStrictEqual(T.setStudy(ps, 'zzz', true, 1), ps);
    assert.strictEqual(T.setStudy(ps, 'a', true, 'oops')[0].goal, 0);
    // 彙總：2026-10-07（週三）；本週一 = 10/05
    const now = at(2026, 10, 7, 12), P = [{ id: 'm', name: '數學', color: '#111111', study: true, goal: 10 }, { id: 'e', name: '英文', color: '#222222', study: true, goal: 0 }, { id: 'w', name: '工作', color: '#333333', study: false, goal: 0 }];
    const L = [
        { id: '1', p: 'm', s: at(2026, 10, 5, 9), e: at(2026, 10, 5, 11), note: '' },        // 本週 2h
        { id: '2', p: 'm', s: at(2026, 10, 6, 9), e: at(2026, 10, 6, 10, 30), note: '' },    // 本週 1.5h
        { id: '3', p: 'e', s: at(2026, 10, 1, 9), e: at(2026, 10, 1, 12), note: '' },        // 上週 3h、本月
        { id: '4', p: 'w', s: at(2026, 10, 6, 9), e: at(2026, 10, 6, 17), note: '' },        // 非科目
        { id: '5', p: 'm', s: at(2026, 9, 28, 9), e: at(2026, 9, 28, 10), note: '' },        // 上月 / 上週 1h
        { id: '6', p: 'm', s: at(2026, 10, 4, 23), e: at(2026, 10, 5, 1), note: '' },        // 跨週：週日 23–24 屬上週，週一 0–1 屬本週
    ];
    let w = T.studyReport(P, L, null, now, 'week');
    assert.deepStrictEqual(w.rows.map(x => [x.id, x.ms / H, x.goalMs / H, x.pct]), [['m', 4.5, 10, 45], ['e', 0, 0, null]]);
    assert.strictEqual(w.total / H, 4.5); assert.strictEqual(w.goalTotal / H, 10);
    const mo = T.studyReport(P, L, null, now, 'month');
    assert.deepStrictEqual(mo.rows.map(x => [x.id, x.ms / H]), [['m', 5.5], ['e', 3]]);
    assert.ok(Math.abs(mo.rows[0].goalMs / H - 10 * 31 / 7) < 1e-6, '月目標 = 週目標 × 31 天 / 7'); assert.strictEqual(mo.rows[0].pct, Math.round(5.5 / (10 * 31 / 7) * 100));
    // 進行中的計時併入
    w = T.studyReport(P, L, { p: 'm', s: now - H }, now, 'week'); assert.strictEqual(w.rows[0].ms / H, 5.5);
    assert.deepStrictEqual(T.studyReport([{ id: 'w', name: 'w', study: false, goal: 0 }], L, null, now, 'week'), { rows: [], total: 0, goalTotal: 0 });
    assert.deepStrictEqual(T.studyReport([], [], null, now, 'month'), { rows: [], total: 0, goalTotal: 0 });
    // 近 8 週
    const wk = T.studyWeeks(P, L, null, now);
    assert.strictEqual(wk.length, 8); assert.strictEqual(wk[7].ms / H, 4.5); assert.strictEqual(wk[7].start, at(2026, 10, 5));
    assert.strictEqual(wk[6].ms / H, 3 + 1 + 1, '上週：英文 3 + 數學 9/28 1 + 週日 23 點 1'); assert.ok(wk.every(x => x.goalMs === 10 * H));
    assert.ok(wk.every((x, i) => i === 0 || x.start > wk[i - 1].start));
    // 刪專案連帶：科目隨專案一起消失
    const rm = T.removeProject(P, L, 'm', true); assert.ok(!rm.projects.some(p => p.id === 'm') && !rm.logs.some(l => l.p === 'm'));
    ok('time-tracker: study hours');
}
