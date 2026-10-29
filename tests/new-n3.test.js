// n3 批次：utils/pantry.html（採買與冰箱）純邏輯 + utils/recipe-scaler.html 食譜本（標籤 / 成本 / 搜尋 / 匯出）
const { load, ok } = require('./_load');
const assert = require('assert');

const P = load('utils/pantry.html', 'PT, CATS, SHELF, todayTW, validDate, cleanShop, addShop, mergeShop, toggleShop, removeById, clearDone, shopText, cleanFridge, addFridge, expiryOf, sortFridge, eatFirst, suggestExp, emptyMenu, cleanMenu, setDish, cleanRecipePicks, menuToShop, cleanFerment, addFerment, nextFeed, feedStatus, markFed');
{ // 日期（UTC+8）與驗證
    assert.strictEqual(P.todayTW(Date.UTC(2026, 9, 28, 15, 59)), '2026-10-28'); assert.strictEqual(P.todayTW(Date.UTC(2026, 9, 28, 16, 0)), '2026-10-29');
    assert.ok(P.validDate('2026-02-28')); assert.ok(!P.validDate('2026-02-30')); assert.ok(!P.validDate('2026-13-01')); assert.ok(!P.validDate('abc')); assert.ok(!P.validDate(null)); assert.ok(!P.validDate('1999-01-01'));
    // 到期邊界
    const t = '2026-10-28', lv = (e) => P.expiryOf(e, t);
    assert.deepStrictEqual(lv('2026-10-27'), { days: -1, level: 'expired' }); assert.strictEqual(lv('2026-10-28').level, 'd3'); assert.strictEqual(lv('2026-10-31').level, 'd3');
    assert.strictEqual(lv('2026-11-01').level, 'd7'); assert.strictEqual(lv('2026-11-04').level, 'd7'); assert.strictEqual(lv('2026-11-05').level, 'ok');
    assert.strictEqual(lv('').level, 'none'); assert.strictEqual(lv('bad').days, null); assert.strictEqual(P.expiryOf('2026-10-28', 'x').level, 'none');
    assert.strictEqual(P.expiryOf('2027-01-01', '2026-12-31').days, 1);   // 跨年
    // 保存天數建議：月底進位
    const [cooked, meat, frozen] = P.SHELF;
    assert.strictEqual(P.suggestExp('2026-10-28', cooked), '2026-10-31'); assert.strictEqual(P.suggestExp('2026-10-31', cooked), '2026-11-03'); assert.strictEqual(P.suggestExp('2026-12-30', meat), '2027-01-01');
    assert.strictEqual(P.suggestExp('2026-11-30', frozen), '2027-02-28'); assert.strictEqual(P.suggestExp('2023-11-30', frozen), '2024-02-29'); assert.strictEqual(P.suggestExp('2026-10-31', frozen), '2027-01-31');
    assert.strictEqual(P.suggestExp('', cooked), ''); assert.strictEqual(P.suggestExp('2026-10-28', null), '');
    for (const s of P.SHELF) assert.ok(s.days > 0 || s.months > 0);
    ok('pantry: dates / expiry boundaries / shelf suggestions');
}
{ // 購物清單
    assert.deepStrictEqual(P.cleanShop(null), []); assert.deepStrictEqual(P.cleanShop('x'), []);
    const c = P.cleanShop([null, 1, { id: 'a', name: ' 牛奶 ', qty: 2, cat: '乳品', done: 'yes' }, { id: 'a', name: 'dup' }, { id: 'b', name: '' }, { name: 'noid' }, { id: 'c', name: 'x'.repeat(100), cat: '亂', done: true }]);
    assert.deepStrictEqual(c.map(x => [x.id, x.name.length, x.qty, x.cat, x.done]), [['a', 2, '2', '乳品', false], ['c', 60, '', '其他', true]]);
    assert.strictEqual(P.cleanShop(Array.from({ length: 600 }, (_, i) => ({ id: '' + i, name: 'n' }))).length, 500);
    let r = P.addShop([], ' 高麗菜 ', '1 顆', '蔬果'); assert.ok(!r.err && !r.merged); const l = r.list; assert.deepStrictEqual([l[0].name, l[0].qty, l[0].cat, l[0].done], ['高麗菜', '1 顆', '蔬果', false]);
    assert.ok(P.addShop([], '  ').err); assert.strictEqual(P.addShop([], 'a', 'q'.repeat(50)).list[0].qty.length, 20); assert.strictEqual(P.addShop([], 'a', '', 'bad').list[0].cat, '其他');
    r = P.addShop(l, '高麗 菜', '2 顆'); assert.ok(r.merged); assert.strictEqual(r.list.length, 1); assert.strictEqual(r.list[0].qty, '1 顆+2 顆');
    assert.strictEqual(P.addShop(l, '高麗菜', '1 顆').list[0].qty, '1 顆'); assert.strictEqual(P.addShop(l, '高麗菜').list[0].qty, '1 顆');
    assert.strictEqual(P.addShop(P.addShop([], 'A').list, 'a', '3').list[0].qty, '3');
    const done = P.toggleShop(l, l[0].id); assert.ok(done[0].done); r = P.addShop(done, '高麗菜'); assert.strictEqual(r.list.length, 2);   // 已勾選的不合併
    const full = Array.from({ length: 500 }, (_, i) => ({ id: '' + i, name: 'n' + i, qty: '', cat: '其他', done: false }));
    r = P.addShop(full, '新的'); assert.ok(r.err); assert.strictEqual(r.list.length, 500); assert.ok(!P.addShop(full, 'n3').err);   // 滿了仍可合併
    const m = P.mergeShop(full.slice(0, 499), [{ name: 'n1' }, { name: 'x1' }, { name: 'x2' }, { name: '' }]); assert.deepStrictEqual([m.added, m.merged, m.skipped, m.list.length], [1, 1, 2, 500]);
    assert.strictEqual(P.removeById(l, l[0].id).length, 0); assert.strictEqual(P.removeById(l, 'zz').length, 1);
    const mix = [{ id: '1', name: 'a', qty: '', cat: '蔬果', done: true }, { id: '2', name: 'b', qty: '2', cat: '乳品', done: false }, { id: '3', name: 'c', qty: '', cat: '蔬果', done: false }];
    assert.strictEqual(P.clearDone(mix).length, 2);
    assert.strictEqual(P.shopText(mix), '【購物清單】\n▸蔬果\n□ c\n▸乳品\n□ b 2'); assert.strictEqual(P.shopText([]), ''); assert.strictEqual(P.shopText([mix[0]]), '');
    ok('pantry: shopping list');
}
{ // 冰箱
    const c = P.cleanFridge([null, { id: 'a', name: '蛋', qty: 10, loc: '冷凍', buy: '2026-10-01', exp: '2026-02-30' }, { id: 'a', name: 'dup' }, { id: 'b', name: '', exp: '2026-10-01' }, { id: 'c', name: 'c', loc: 'x', exp: '2026-10-05' }]);
    assert.deepStrictEqual(c, [{ id: 'a', name: '蛋', qty: '10', loc: '冷凍', buy: '2026-10-01', exp: '' }, { id: 'c', name: 'c', qty: '', loc: '冷藏', buy: '', exp: '2026-10-05' }]);
    assert.deepStrictEqual(P.cleanFridge({}), []); assert.strictEqual(P.cleanFridge(Array.from({ length: 700 }, (_, i) => ({ id: '' + i, name: 'n' }))).length, 500);
    assert.ok(P.addFridge([], { name: '' }).err); assert.ok(P.addFridge([], { name: 'a', exp: '2026-02-30' }).err); assert.ok(P.addFridge([], { name: 'a', buy: '2026-10-05', exp: '2026-10-04' }).err);
    assert.ok(!P.addFridge([], { name: 'a', buy: '2026-10-05', exp: '2026-10-05' }).err); assert.strictEqual(P.addFridge([], { name: 'a', loc: 'zz' }).list[0].loc, '冷藏');
    const fullF = Array.from({ length: 500 }, (_, i) => ({ id: '' + i, name: 'n', qty: '', loc: '冷藏', buy: '', exp: '' })); assert.ok(P.addFridge(fullF, { name: 'x' }).err);
    const L = [{ id: '1', name: 'z無期限', exp: '' }, { id: '2', name: 'b', exp: '2026-11-10' }, { id: '3', name: 'a', exp: '2026-10-27' }, { id: '4', name: 'd', exp: '2026-10-30' }, { id: '5', name: 'c', exp: '2026-10-30' }];
    assert.deepStrictEqual(P.sortFridge(L).map(x => x.id), ['3', '5', '4', '2', '1']); assert.strictEqual(L[0].id, '1');   // 不改動原陣列
    assert.deepStrictEqual(P.eatFirst(L, '2026-10-28').map(x => x.id), ['3', '5', '4']);
    assert.deepStrictEqual(P.eatFirst(L, '2026-11-07').map(x => x.id), ['3', '5', '4', '2']);
    ok('pantry: fridge');
}
{ // 菜單
    assert.deepStrictEqual(P.cleanMenu(null), P.emptyMenu()); assert.strictEqual(P.emptyMenu().length, 7);
    const m = P.cleanMenu([['a', 'b'], 'x', [1, null, 'extra'], ...Array(9).fill(['q', 'r'])]); assert.strictEqual(m.length, 7); assert.deepStrictEqual(m[0], ['a', 'b']); assert.deepStrictEqual(m[1], ['', '']); assert.deepStrictEqual(m[2], ['1', '']);
    assert.strictEqual(P.cleanMenu([['x'.repeat(99)]])[0][0].length, 30);
    const s = P.setDish(P.emptyMenu(), 2, 1, ' 咖哩 '); assert.strictEqual(s[2][1], '咖哩'); assert.strictEqual(P.emptyMenu()[2][1], '');
    // 食譜唯讀驗證
    assert.deepStrictEqual(P.cleanRecipePicks(null), []);
    const rc = P.cleanRecipePicks([null, 1, { id: 'a', name: '咖哩', text: '- 馬鈴薯 2 顆\n2. 洋蔥 1 顆\n\n咖哩塊' }, { id: 'a', name: 'dup', text: 'x' }, { id: 'b', name: '', text: 'x' }, { id: 'c', name: 'C', text: '   ' }, { id: 'd', name: 'D', text: 5 }, { id: 'e', name: '煎蛋', text: '蛋 2 顆' }]);
    assert.deepStrictEqual(rc.map(r => r.id), ['a', 'e']);
    const menu = P.setDish(P.setDish(P.setDish(P.emptyMenu(), 0, 0, '咖哩'), 1, 1, '咖哩'), 2, 0, '神秘料理');
    assert.deepStrictEqual(P.menuToShop(menu, rc).map(x => x.name), ['馬鈴薯 2 顆', '洋蔥 1 顆', '咖哩塊', '備料：神秘料理']);
    assert.deepStrictEqual(P.menuToShop(P.emptyMenu(), rc), []);
    const big = [{ id: 'x', name: '大', text: Array.from({ length: 100 }, (_, i) => '料' + i).join('\n') }]; assert.strictEqual(P.menuToShop(P.setDish(P.emptyMenu(), 0, 0, '大'), big).length, 30);
    const added = P.mergeShop([], P.menuToShop(menu, rc).concat(P.menuToShop(menu, rc))); assert.strictEqual(added.list.length, 4); assert.strictEqual(added.merged, 4);
    ok('pantry: menu / recipe picks / menu to shopping');
}
{ // 發酵
    const c = P.cleanFerment([null, { id: 'a', name: '酸種', kind: '酸種', start: '2026-10-01', ratio: '1:1:1', note: 'n', every: '2', last: '2026-10-05' }, { id: 'b', name: 'x', start: 'bad' }, { id: 'c', name: 'y', start: '2026-10-10', last: '2026-10-01', every: 999, kind: 'zz' }, { id: 'a', name: 'dup', start: '2026-10-01' }, { id: 'd', name: '', start: '2026-10-01' }]);
    assert.deepStrictEqual(c.map(x => [x.id, x.kind, x.every, x.last]), [['a', '酸種', 2, '2026-10-05'], ['c', '其他', 0, '2026-10-10']]);
    assert.deepStrictEqual(P.cleanFerment({}), []); assert.strictEqual(P.cleanFerment(Array.from({ length: 80 }, (_, i) => ({ id: '' + i, name: 'n', start: '2026-10-01' }))).length, 50);
    assert.ok(P.addFerment([], { name: '', start: '2026-10-01' }).err); assert.ok(P.addFerment([], { name: 'a', start: '' }).err);
    const a = P.addFerment([], { name: 'a', kind: '優格', start: '2026-10-01', every: '-3' }); assert.ok(!a.err); assert.strictEqual(a.list[0].every, 0); assert.strictEqual(a.list[0].last, '2026-10-01');
    assert.ok(P.addFerment(Array.from({ length: 50 }, (_, i) => ({ id: '' + i })), { name: 'a', start: '2026-10-01' }).err);
    const it = { id: '1', start: '2026-12-30', last: '2026-12-30', every: 3 }; assert.strictEqual(P.nextFeed(it), '2027-01-02'); assert.strictEqual(P.nextFeed({ ...it, every: 0 }), null);
    const st = (today) => P.feedStatus(it, today); assert.strictEqual(st('2027-01-03').level, 'overdue'); assert.strictEqual(st('2027-01-03').days, -1); assert.strictEqual(st('2027-01-02').level, 'today'); assert.strictEqual(st('2027-01-01').level, 'soon'); assert.strictEqual(st('2026-12-30').level, 'ok');
    assert.strictEqual(P.feedStatus({ ...it, every: 0 }, '2027-01-01').level, 'none');
    const f = P.markFed([it], '1', '2027-01-05'); assert.strictEqual(f[0].last, '2027-01-05'); assert.strictEqual(P.nextFeed(f[0]), '2027-01-08'); assert.strictEqual(P.markFed([it], '1', '2020-01-01')[0].last, '2026-12-30'); assert.strictEqual(P.markFed([it], '1', 'bad')[0].last, '2026-12-30'); assert.strictEqual(P.markFed([it], 'zz', '2027-01-05')[0].last, '2026-12-30');
    ok('pantry: ferment');
}

// ---------- recipe-scaler 食譜本 ----------
const R = load('utils/recipe-scaler.html', 'RS, TAG, COST, cleanRecipes, addRecipe, removeRecipe, cleanTags, cleanCost, costCalc, allTags, filterRecipes, updateRecipe, recipeToText');
{
    // 舊資料遷移：沒有 tags / cost 的食譜補預設
    const old = R.cleanRecipes([{ id: 'a', name: '舊', text: '麵粉 100g' }]);
    assert.deepStrictEqual(old[0], { id: 'a', name: '舊', text: '麵粉 100g', tags: [], cost: { servings: 1, sell: 0, items: [] } });
    assert.deepStrictEqual(R.cleanTags(' a, b，b、c  d e f g'), ['a', 'b', 'c', 'd', 'e']); assert.deepStrictEqual(R.cleanTags(['x'.repeat(20), 5, null, ' ']), ['x'.repeat(10)]); assert.deepStrictEqual(R.cleanTags(null), []); assert.deepStrictEqual(R.cleanTags(5), []);
    const c = R.cleanCost({ servings: '4', sell: '80', items: [{ n: '麵粉', p: '0.03', q: 250 }, { n: '', p: 1, q: 1 }, null, { n: 'x'.repeat(50), p: -5, q: 'abc' }, { n: 'y', p: 1e12, q: Infinity }] });
    assert.strictEqual(c.servings, 4); assert.strictEqual(c.sell, 80); assert.strictEqual(c.items.length, 3); assert.deepStrictEqual(c.items[1], { n: 'x'.repeat(30), p: 0, q: 0 }); assert.deepStrictEqual(c.items[2], { n: 'y', p: 1e6, q: 0 });
    assert.deepStrictEqual(R.cleanCost(null), { servings: 1, sell: 0, items: [] }); assert.strictEqual(R.cleanCost({ servings: 0 }).servings, 1); assert.strictEqual(R.cleanCost({ servings: 5000 }).servings, 1); assert.strictEqual(R.cleanCost({ items: 'x' }).items.length, 0);
    assert.strictEqual(R.cleanCost({ items: Array.from({ length: 50 }, () => ({ n: 'a' })) }).items.length, 30);
    // 成本計算：7.5 + 12 = 19.5；每份 4.875 → 4.88；毛利 75.125 → 75.13
    let k = R.costCalc({ servings: 4, sell: 80, items: [{ n: '麵粉', p: 0.03, q: 250 }, { n: '蛋', p: 6, q: 2 }] });
    assert.deepStrictEqual(k, { total: 19.5, per: 4.88, profit: 75.13, margin: 93.91 });
    k = R.costCalc({ servings: 2, items: [{ n: 'a', p: 10, q: 3 }] }); assert.deepStrictEqual(k, { total: 30, per: 15, profit: null, margin: null });
    k = R.costCalc({ servings: 1, sell: 10, items: [{ n: 'a', p: 15, q: 1 }] }); assert.strictEqual(k.profit, -5); assert.strictEqual(k.margin, -50);   // 虧損
    assert.deepStrictEqual(R.costCalc(null), { total: 0, per: 0, profit: null, margin: null }); assert.strictEqual(R.costCalc({ items: [{ n: 'a', p: 0.1, q: 3 }] }).total, 0.3);
    // 新增 / 搜尋 / 篩選 / 更新 / 匯出
    let l = R.addRecipe([], '番茄炒蛋', '番茄 2 顆\n蛋 3 顆', '家常, 快速').list; l = R.addRecipe(l, '咖哩飯', '馬鈴薯 2 顆', ['家常', '便當']).list; l = R.addRecipe(l, '提拉米蘇', '起司 250g').list;
    assert.deepStrictEqual(l[0].tags, ['家常', '快速']); assert.deepStrictEqual(l[2].tags, []); assert.deepStrictEqual(R.allTags(l).sort(), ['便當', '快速', '家常'].sort());
    assert.deepStrictEqual(R.filterRecipes(l, '', '家常').map(r => r.name), ['番茄炒蛋', '咖哩飯']); assert.deepStrictEqual(R.filterRecipes(l, '馬鈴薯', '').map(r => r.name), ['咖哩飯']); assert.deepStrictEqual(R.filterRecipes(l, ' 便當 ', '').map(r => r.name), ['咖哩飯']);
    assert.strictEqual(R.filterRecipes(l, '', '').length, 3); assert.strictEqual(R.filterRecipes(l, 'zzz', '').length, 0); assert.strictEqual(R.filterRecipes(l, '', '不存在').length, 0); assert.strictEqual(R.filterRecipes(l, null, null).length, 3);
    const u = R.updateRecipe(l, l[0].id, { tags: 'x,y', cost: { servings: 2, sell: 50, items: [{ n: '番茄', p: 5, q: 2 }] } }); assert.deepStrictEqual(u[0].tags, ['x', 'y']); assert.strictEqual(u[0].cost.servings, 2); assert.deepStrictEqual(u[1], l[1]); assert.deepStrictEqual(R.updateRecipe(l, l[0].id, {})[0], l[0]); assert.strictEqual(R.updateRecipe(l, 'zz', { tags: 'q' })[0].tags[0], '家常');
    assert.strictEqual(R.recipeToText(l[2]), '提拉米蘇\n\n食材\n起司 250g');
    assert.strictEqual(R.recipeToText(u[0]), '番茄炒蛋\n標籤：x、y\n\n食材\n番茄 2 顆\n蛋 3 顆\n\n成本（2 份）\n番茄：單價 5 × 用量 2 = 10\n總成本 10，每份 5，售價 50，毛利 45（90%）');
    // 刪除整筆移除（標籤與成本跟著走）；上限不變
    assert.strictEqual(R.removeRecipe(u, u[0].id).length, 2); assert.ok(R.addRecipe(Array.from({ length: 100 }, (_, i) => ({ id: '' + i, name: 'n', text: 'x', tags: [], cost: R.cleanCost(null) })), 'n', 'x').err);
    ok('recipe-scaler: 食譜本 tags / cost / search / export / migration');
}
