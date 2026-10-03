// 資料清理與刪除稽核（批次 f2）：fun/ 頁面的上限、驗證與級聯清除
const assert = require('assert');
const { load, ok } = require('./_load');

// alarm：貪睡鬧鐘響過就移除，標籤不疊加且不超過 20 字
{
    const { isSnooze, dropDoneSnooze, snoozeLabel, validAlarm } = load('fun/alarm.html', 'isSnooze, dropDoneSnooze, snoozeLabel, validAlarm');
    const a = (id, on) => ({ id, time: '07:00', label: '', days: [], on });
    assert.ok(isSnooze(a('zabc', true)) && !isSnooze(a('mabc', true)));
    assert.deepEqual(dropDoneSnooze([a('m1', false), a('z1', false), a('z2', true)]).map(x => x.id), ['m1', 'z2']);
    assert.equal(snoozeLabel(''), '鬧鐘（貪睡）');
    assert.equal(snoozeLabel('起床（貪睡）'), '起床（貪睡）');
    const long = snoozeLabel('一二三四五六七八九十一二三四五六七八九十');
    assert.ok(long.length <= 20 && long.endsWith('（貪睡）'));
    assert.ok(validAlarm({ ...a('z1', true), label: long }));
    ok('alarm snooze cleanup');
}

// flashcards：牌組 / 卡片上限、壞資料
{
    const { parseCards, cleanDecks, MAX_DECKS, MAX_CARDS } = load('fun/flashcards.html', 'parseCards, cleanDecks, MAX_DECKS, MAX_CARDS');
    const text = Array.from({ length: 10 }, (_, i) => `w${i} | ${i}`).join('\n');
    assert.equal(parseCards(text, [], 3).length, 3);
    assert.equal(parseCards(text, [], 0).length, 0);
    assert.equal(parseCards(text).length, 10);
    for (const bad of [null, [], 'x', 5]) assert.deepEqual(cleanDecks(bad), {});
    const good = { f: 'a', b: 'b', ease: 2.5, iv: 0, reps: 0, due: '', seen: false };
    const d = cleanDecks({ A: [good, null, { f: 1 }], B: 'oops' });
    assert.deepEqual(d, { A: [good], B: [] });
    const many = Object.fromEntries(Array.from({ length: MAX_DECKS + 5 }, (_, i) => ['d' + i, []]));
    assert.equal(Object.keys(cleanDecks(many)).length, MAX_DECKS);
    assert.equal(cleanDecks({ A: Array(MAX_CARDS + 10).fill(good) }).A.length, MAX_CARDS);
    ok('flashcards limits');
}

// lottery：中獎紀錄驗證與上限
{
    const { cleanWon, MAX_DRAWS } = load('fun/lottery.html', 'cleanWon, MAX_DRAWS');
    assert.deepEqual(cleanWon(null), []);
    assert.deepEqual(cleanWon([['a', 1], 'x', [], [null], ['b']]), [['a'], ['b']]);
    const w = cleanWon(Array.from({ length: MAX_DRAWS + 20 }, (_, i) => ['n' + i]));
    assert.equal(w.length, MAX_DRAWS); assert.equal(w[0][0], 'n20'); // 留最近的
    ok('lottery cleanWon');
}

// dice：歷史驗證與上限
{
    const { cleanHistory, MAX_HIST } = load('fun/dice.html', 'cleanHistory, MAX_HIST');
    const h = { n: 2, sides: 6, mod: 0, faces: [3, 6] };
    assert.deepEqual(cleanHistory(null), []);
    assert.deepEqual(cleanHistory([h, null, { ...h, faces: [3] }, { ...h, faces: [3, 7] }, { ...h, sides: 7 }, { ...h, n: 'x' }]), [h]);
    assert.equal(cleanHistory(Array(MAX_HIST + 50).fill(h)).length, MAX_HIST);
    ok('dice cleanHistory');
}

// divination：統計驗證
{
    const { cleanStats } = load('fun/divination.html', 'cleanStats');
    const z = { n: 0, 聖筊: 0, 笑筊: 0, 陰筊: 0, best: 0 };
    assert.deepEqual(cleanStats(null), z); assert.deepEqual(cleanStats({ n: 'x' }), z); assert.deepEqual(cleanStats({ ...z, n: -1 }), z);
    assert.deepEqual(cleanStats({ n: 3, 聖筊: 1, 笑筊: 1, 陰筊: 1, best: 1, junk: 1 }), { n: 3, 聖筊: 1, 笑筊: 1, 陰筊: 1, best: 1 });
    ok('divination cleanStats');
}

// timers：倒數清單驗證與上限
{
    const { cleanDefs, MAX_TIMERS } = load('fun/timers.html', 'cleanDefs, MAX_TIMERS');
    assert.deepEqual(cleanDefs('x'), []);
    assert.deepEqual(cleanDefs([null, { name: 1, total: 5 }, { name: 'a', total: 0 }, { name: 'a', total: 'x' }, { name: 'b', total: 1000 }]), [{ name: 'b', total: 1000 }]);
    assert.equal(cleanDefs(Array(MAX_TIMERS + 5).fill({ name: 'a', total: 1000 })).length, MAX_TIMERS);
    ok('timers cleanDefs');
}

// habit-tracker：刪除習慣即整筆移除（打卡 dates / 數量 logs 都在習慣物件內），上限常數存在
{
    const { normHabit, MAX_HABITS } = load('fun/habit-tracker.html', 'normHabit, MAX_HABITS');
    assert.ok(MAX_HABITS >= 20);
    const h = normHabit({ id: 'x', name: 'n', type: 'count', goal: 5, unit: 'ml', logs: { '2024-01-01': 3 } });
    assert.deepEqual(Object.keys(h).sort(), ['dates', 'goal', 'id', 'logs', 'name', 'type', 'unit']); // 沒有掛在習慣外的資料
    ok('habit self-contained');
}

// todo / pomodoro：既有上限常數
{
    const { MAX_ITEMS } = load('fun/todo.html', 'MAX_ITEMS');
    assert.equal(MAX_ITEMS, 500);
    const { trim } = load('fun/pomodoro.html', 'trim');
    const between = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    const hist = { '2020-01-01': { count: 1, minutes: 25 }, '2024-01-01': { count: 1, minutes: 25 } };
    assert.deepEqual(Object.keys(trim(hist, 400, '2024-01-10', between)), ['2024-01-01']);
    ok('todo/pomodoro limits');
}
