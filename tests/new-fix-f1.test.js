const assert = require('assert');
const { load, ok } = require('./_load');

// minesweeper：每日挑戰鍵只留最近 30 天
{
    const { staleDailyKeys } = load('mini-games/minesweeper.html', 'staleDailyKeys');
    const keys = ['mines_daily_2026-01-01_9,9,10', 'mines_daily_2026-09-03_9,9,10', 'mines_daily_2026-09-02_16,16,40', 'mines_daily_2026-10-03_9,9,10', 'mines_best_9,9,10', 'other_2020-01-01_x', 'mines_daily_bad_x'];
    // 今天 2026-10-03，往前 30 天 = 2026-09-03（含當天保留）
    assert.deepStrictEqual(staleDailyKeys(keys, '2026-10-03'), ['mines_daily_2026-01-01_9,9,10', 'mines_daily_2026-09-02_16,16,40']);
    assert.deepStrictEqual(staleDailyKeys([], '2026-10-03'), []);
    assert.deepStrictEqual(staleDailyKeys(['mines_daily_2026-03-01_a'], '2026-03-31'), []);       // 剛好 30 天保留
    ok('minesweeper staleDailyKeys');
}

// stealth-reader：閱讀進度上限
{
    const { staleProgress, progTime } = load('reading/stealth-reader.html', 'staleProgress, progTime');
    assert.strictEqual(progTime('12'), 0); assert.strictEqual(progTime('12@500'), 500);
    const es = [['a', '3'], ['b', '5@300'], ['c', '1@100'], ['d', '2@200']];
    assert.deepStrictEqual(staleProgress(es, 2).sort(), ['a', 'c']);       // 保留 b、d；舊格式 a 與最舊的 c 被丟
    assert.deepStrictEqual(staleProgress(es, 10), []);
    assert.strictEqual(parseInt('12@500', 10), 12);                          // 相容舊讀法
    ok('stealth-reader staleProgress');
}

// cooldown-board：載入驗證與上限
{
    const { cleanSkills, MAX_SKILLS } = load('game-assist/cooldown-board.html', 'cleanSkills, MAX_SKILLS');
    assert.deepStrictEqual(cleanSkills(null), []); assert.deepStrictEqual(cleanSkills('x'), []);
    assert.deepStrictEqual(cleanSkills([null, { name: 'a', sec: 5 }, { name: '', sec: 3 }, { name: 'b', sec: -1 }, { name: 'c' }, 7, { name: 'd', sec: '2.5' }]), [{ name: 'a', sec: 5 }, { name: 'd', sec: 2.5 }]);
    assert.strictEqual(cleanSkills(Array.from({ length: 99 }, (_, i) => ({ name: 'n' + i, sec: 1 }))).length, MAX_SKILLS);
    ok('cooldown cleanSkills');
}

// party：掉落明細上限、單人存檔驗證
{
    const { lootAdd, cleanSolo, MAX_LOOT, MAX_LOGS } = load('game-assist/party.html', 'lootAdd, cleanSolo, MAX_LOOT, MAX_LOGS');
    const loot = { items: [], playerStats: {} };
    for (let i = 0; i < MAX_LOOT + 20; i++) lootAdd(loot, 'p', 'P', '武器');
    assert.strictEqual(loot.items.length, MAX_LOOT); assert.strictEqual(loot.playerStats.p['武器'], MAX_LOOT + 20);
    assert.strictEqual(cleanSolo(null), null); assert.strictEqual(cleanSolo({ exp: {} }), null); assert.strictEqual(cleanSolo('x'), null);
    const c = cleanSolo({ exp: { target: 'x', current: null, contributions: [] }, loot: { items: [null, { type: '武器' }, { type: 5 }], playerStats: 3 }, logs: [null, { msg: 'a' }, ...Array.from({ length: 80 }, () => ({ msg: 'b' }))] });
    assert.deepStrictEqual(c.exp, { target: 100, current: 0, contributions: {}, finished: false });
    assert.deepStrictEqual(c.loot, { items: [{ type: '武器' }], playerStats: {} });
    assert.strictEqual(c.logs.length, MAX_LOGS);
    const good = { exp: { target: 50, current: 7, contributions: { a: 7 }, finished: false }, loot: { items: [], playerStats: {} }, logs: [] };
    assert.deepStrictEqual(cleanSolo(good), good);
    ok('party lootAdd cap / cleanSolo');
}

// rjpq：單人標記驗證
{
    const { cleanMarkers } = load('game-assist/rjpq.html', 'cleanMarkers');
    assert.deepStrictEqual(cleanMarkers(null), []);
    assert.deepStrictEqual(cleanMarkers([null, { f: 1, d: 2 }, { f: 1, d: 2 }, { f: 10, d: 0 }, { f: 0, d: 4 }, { f: '1', d: 1 }, { f: 9, d: 3 }]), [{ f: 1, d: 2 }, { f: 9, d: 3 }]);
    ok('rjpq cleanMarkers');
}
