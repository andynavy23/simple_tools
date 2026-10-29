// n2 批次：廚房計算（utils/kitchen-calc.html）與計時器的烹飪（fun/timers.html）純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');

{
    const K = load('utils/kitchen-calc.html', 'doughTime, partyFood, hotpot, bbq, brewAbv, tinsethIbu, brewWater, cure, brine, sousHeat, sousTable, airFry, riceWater, parseDrink, cocktail, hydration, recovery, electrolyte, formulaCalc, normOpts');
    // 發酵
    near(K.doughTime(1, 25, 'instant').h, 3); near(K.doughTime(1, 35, 'instant').h, 1.5); near(K.doughTime(1, 15, 'instant').h, 6);
    near(K.doughTime(2, 25, 'instant').h, 3 * Math.pow(2, -0.7)); near(K.doughTime(3, 25, 'fresh').h, 3);
    assert.strictEqual(K.doughTime(1, 50, 'instant'), null); assert.strictEqual(K.doughTime(NaN, 25, 'instant'), null); assert.strictEqual(K.doughTime(1, 25, 'x'), null);
    ok('kitchen dough');
    // 份量
    const p = K.partyFood(10, 'friends', 'm'); near(p.rice, 1500); near(p.dish, 3500); assert.strictEqual(p.dishes, 8); near(p.drink, 6000);
    assert.strictEqual(K.partyFood(2.5, 'friends', 'm'), null); assert.strictEqual(K.partyFood(0, 'home', 'm'), null);
    const h = K.hotpot(4, 'm'); near(h.meat, 600); assert.strictEqual(h.soup, 1600); assert.strictEqual(K.hotpot(2, 'm').soup, 1500);
    const b = K.bbq(10, 'm', 2.5, false); near(b.meat, 2500); near(b.charcoal, 4); near(b.drink, 8000); near(K.bbq(10, 'm', 2.5, true).drink, 10400);
    assert.strictEqual(K.bbq(1, 'm', 1, false).charcoal, 1); assert.strictEqual(K.bbq(5, 'm', 0, false), null);
    ok('kitchen party / hotpot / bbq');
    // 啤酒
    near(K.brewAbv(1.05, 1.01).abv, 5.25); near(K.brewAbv(1.05, 1.01).att, 80); assert.strictEqual(K.brewAbv(1.05, 1.06), null);
    const ibu = K.tinsethIbu(28.35, 10, 60, 18.93, 1.05); assert.ok(ibu > 34 && ibu < 35.2, ibu);
    assert.ok(Number.isNaN(K.tinsethIbu(0, 10, 60, 20, 1.05)));
    const w = K.brewWater(20, 5, 60, 3); near(w.pre, 24); near(w.total, 29); near(w.mash, 15); near(w.sparge, 14); assert.strictEqual(K.brewWater(20, 0, 60, 3), null);
    ok('kitchen brew');
    // 醃製 / 泡菜
    let c = K.cure('veg', 500, 0); near(c.salt, 10); near(c.sugar, 5); c = K.cure('brine', 1000, 1); near(c.salt, 50); near(c.sugar, 25); near(c.water, 1000);
    near(K.cure('dry', 1000, 2).salt, 10); assert.strictEqual(K.cure('x', 100, 0), null); assert.strictEqual(K.cure('veg', 5, 0), null);
    const br = K.brine(1000, 1000, 3); near(br.salt, 1000 * 3 / 97); near(br.salt / br.total * 100, 3); assert.strictEqual(br.flag, '');
    assert.strictEqual(K.brine(1000, 700, 1.5).flag, 'low'); assert.strictEqual(K.brine(1000, 700, 6).flag, 'high'); assert.strictEqual(K.brine(1000, 700, 0), null);
    ok('kitchen cure / brine');
    // 低溫烹調：3 cm、冷藏起始、60°C 約 54 分鐘（板狀傳導）
    const sh = K.sousHeat(3, 60, 5); assert.ok(sh > 53 && sh < 55, sh);
    assert.ok(K.sousHeat(6, 60, 4) > 3.5 * K.sousHeat(3, 60, 4));                 // 厚度加倍 → 約 4 倍
    assert.ok(Number.isNaN(K.sousHeat(3, 60, 60))); assert.ok(Number.isNaN(K.sousHeat(11, 60, 4)));
    const st = K.sousTable('poultry', 3, false); assert.deepStrictEqual(st.map(r => r.t), [63, 65, 70]); assert.ok(st.every(r => r.hold >= 10 && r.total > r.hold));
    near(K.sousTable('poultry', 3, true)[1].heat, st[1].heat * 1.5);
    assert.ok(K.sousTable('beef', 8, false)[0].long); assert.ok(!K.sousTable('fish', 1, false)[0].long);
    assert.strictEqual(K.sousTable('ground', 3, false), null); assert.strictEqual(K.sousTable('beef', 9, false), null);
    // 保守性：任何食材的保溫時間都隨溫度升高而不增加
    for (const t of ['poultry', 'pork', 'beef', 'fish']) { const rows = K.sousTable(t, 3, false); for (let i = 1; i < rows.length; i++) assert.ok(rows[i].hold <= rows[i - 1].hold && rows[i].t > rows[i - 1].t, t); }
    ok('kitchen sous-vide');
    // 氣炸鍋 / 電鍋
    const af = K.airFry(200, 30); assert.strictEqual(af.t, 180); near(af.min, 24); near(af.lo, 21); near(af.hi, 27); assert.strictEqual(K.airFry(50, 30), null);
    const rw = K.riceWater(2, 'cup', 'white'); near(rw.ml, 396); assert.strictEqual(rw.outer, 1); near(K.riceWater(300, 'g', 'white').cups, 2);
    assert.strictEqual(K.riceWater(5, 'cup', 'brown').outer, 2); near(K.riceWater(1, 'cup', 'brown').ml, 270); assert.strictEqual(K.riceWater(0, 'cup', 'white'), null); assert.strictEqual(K.riceWater(2, 'cup', 'x'), null);
    ok('kitchen airfry / rice');
    // 調酒
    const pd = K.parseDrink('琴酒 60 40\n香艾酒 30ml 15%\n壞行\n\n水 abc 0'); assert.strictEqual(pd.items.length, 2); assert.deepStrictEqual(pd.errors, [3, 5]);
    let ck = K.cocktail(pd.items, 0); near(ck.abv, 28.5 / 90 * 100); ck = K.cocktail(pd.items, 25); near(ck.abv, 28.5 / 112.5 * 100); near(ck.grams, 28.5 * 0.789); near(ck.drinks, 28.5 * 0.789 / 10);
    assert.strictEqual(K.cocktail([], 0), null); assert.strictEqual(K.parseDrink(Array(20).fill('a 10 5').join('\n')).items.length, 12);
    assert.strictEqual(K.parseDrink('a 10 150').items.length, 0);
    ok('kitchen cocktail');
    // 水分 / 補給 / 電解質 / 配方奶
    near(K.hydration(60, 20, 0).ml, 1980); near(K.hydration(60, 32, 60).ml, 60 * 33 * 1.1 + 420); assert.strictEqual(K.hydration(5, 20, 0), null);
    let rc = K.recovery(60, 60, 'mid', NaN); near(rc.cLo, 36); near(rc.cHi, 54); near(rc.pLo, 15); near(rc.pHi, 18); near(rc.fluid, 1050); assert.ok(rc.est);
    rc = K.recovery(60, 60, 'high', 1); near(rc.fluid, 1500); assert.ok(!rc.est); near(rc.cHi, 72); near(K.recovery(60, 20, 'high', NaN).cHi, 30);
    assert.strictEqual(K.recovery(60, 60, 'x', NaN), null); assert.strictEqual(K.recovery(60, 60, 'mid', 20), null);
    const el = K.electrolyte('sport', 500); near(el.salt, 0.75); near(el.sugar, 20); near(K.electrolyte('oral', 1000).salt, 3); assert.strictEqual(K.electrolyte('x', 500), null);
    const fm = K.formulaCalc(4, 1, 30); near(fm.dLo, 480); near(fm.dHi, 600); assert.strictEqual(fm.feeds, 7); near(fm.fLo, 480 / 7); near(fm.sLo, 480 / 7 / 30);
    assert.strictEqual(K.formulaCalc(10, 8, 30).dHi, 960); assert.strictEqual(K.formulaCalc(4, 13, 30), null); assert.strictEqual(K.formulaCalc(4, 1.5, 30), null);
    ok('kitchen hydration / recovery / electrolyte / formula');
    // 備份還原容錯
    const ids = ['a', 'b'];
    assert.deepStrictEqual(K.normOpts(null, ids, 3), { tab: 0, v: {} }); assert.deepStrictEqual(K.normOpts('x', ids, 3), { tab: 0, v: {} });
    assert.deepStrictEqual(K.normOpts({ tab: 2, v: { a: '1', b: 5, z: 'x' } }, ids, 3), { tab: 2, v: { a: '1' } });
    assert.strictEqual(K.normOpts({ tab: 3 }, ids, 3).tab, 0); assert.strictEqual(K.normOpts({ tab: 1.5, v: [] }, ids, 3).tab, 0);
    ok('kitchen normOpts');
}

{
    const T = load('fun/timers.html', 'cdOrder, eggMin, pastaTime, pastaWater, cleanDefs, EGG_YOLK');
    // 水煮蛋（Williams）：單調：越大越久、越熟越久、室溫較快
    const e1 = T.eggMin(57, 4, 63); assert.ok(e1 > 4.3 && e1 < 4.8, e1);
    const soft = T.eggMin(60, 4, T.EGG_YOLK.soft), jam = T.eggMin(60, 4, T.EGG_YOLK.jammy), hard = T.eggMin(60, 4, T.EGG_YOLK.hard);
    assert.ok(soft < jam && jam < hard && hard > 6 && hard < 11, [soft, jam, hard]);
    assert.ok(T.eggMin(68, 4, 70) > T.eggMin(45, 4, 70)); assert.ok(T.eggMin(60, 20, 70) < T.eggMin(60, 4, 70));
    assert.ok(Number.isNaN(T.eggMin(60, 4, 100))); assert.ok(Number.isNaN(T.eggMin(5, 4, 70))); assert.ok(Number.isNaN(T.eggMin(60, 70, 70)));
    // 義大利麵
    assert.strictEqual(T.pastaTime(10, 'aldente', false), 9); assert.strictEqual(T.pastaTime(10, 'hard', false), 8); assert.strictEqual(T.pastaTime(10, 'std', true), 8);
    assert.strictEqual(T.pastaTime(3, 'hard', true), 1); assert.ok(Number.isNaN(T.pastaTime(0, 'std', false))); assert.ok(Number.isNaN(T.pastaTime(10, 'x', false)));
    assert.deepStrictEqual(T.pastaWater(200), { waterL: 2, saltG: 20 }); assert.strictEqual(T.pastaWater(0), null);
    // 倒數排序：進行中依結束時間，其餘維持原順序
    const ts = [{ running: false }, { running: true, endAt: 300 }, { running: true, endAt: 100 }, { running: false }];
    assert.deepStrictEqual(T.cdOrder(ts), [2, 1, 0, 3]); assert.deepStrictEqual(T.cdOrder([]), []);
    // 倒數清單保留 mute（只在 true 時）
    assert.deepStrictEqual(T.cleanDefs([{ name: 'a', total: 1000, mute: true }, { name: 'b', total: 1000, mute: 'x' }]), [{ name: 'a', total: 1000, mute: true }, { name: 'b', total: 1000 }]);
    ok('timers cooking');
}
