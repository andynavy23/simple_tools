// 批次 j1：finance-calc（存款利率 / 信用卡回饋比較）、biz-calc（新創股權）、stock-cost（加密貨幣損益）、unit-converter（黃金）、packing-list（搬家 / 過戶）純邏輯
const assert = require('assert');
const { load, ok, near } = require('./_load');

// ---------- finance-calc ----------
{
    const F = load('utils/finance-calc.html', 'depositValue, depositEarly, parseDeposits, compareDeposits, parseCards, compareCards');
    // 已知答案
    near(F.depositValue(1000000, 's', [1.6], 2), 1032000);
    near(F.depositValue(1000000, 'c', [1.6], 2), 1000000 * 1.016 ** 2);
    near(F.depositValue(1000000, 'f', [1.5, 1.7], 2), 1000000 * 1.015 * 1.017);
    near(F.depositValue(1000, 'f', [2], 3), 1000 * 1.02 ** 3);              // 機動只給一個利率 = 逐年複利
    near(F.depositValue(1000, 'f', [2, 4], 1.5), 1000 * 1.02 * 1.02);       // 最後半年按單利：4% × 0.5
    // 往返：由本利和反推年化
    for (const [k, r] of [['c', [3]], ['f', [1, 2, 3]], ['s', [2]]]) {
        const v = F.depositValue(5000, k, r, 3), annual = Math.pow(v / 5000, 1 / 3) - 1;
        near(5000 * Math.pow(1 + annual, 3), v, 1e-12);
    }
    assert.strictEqual(F.depositValue(0, 's', [1], 1), null); assert.strictEqual(F.depositValue(1, 's', [], 1), null); assert.strictEqual(F.depositValue(1, 's', [NaN], 1), null);
    near(F.depositEarly(120000, 2, 6, 80), 120000 * (1 + 0.02 * 0.5 * 0.8));
    // 解析與排序
    const p = F.parseDeposits('A,單利,1.6,2\nB,複利,1.6,2\nC，機動，1.0/2.0，2');
    assert.strictEqual(p.plans.length, 3); assert.deepStrictEqual(p.plans[2].rates, [1, 2]);
    const r = F.compareDeposits(1e6, p.plans, 6, 80);
    assert.deepStrictEqual(r.map(x => x.name), ['B', 'A', 'C']);              // 複利 1.6 > 單利 1.6 > 機動 1/2（=1.02×1.02）
    near(r[0].annual, 0.016, 1e-9); near(r[1].early, 1e6 * (1 + 0.016 * 0.5 * 0.8));
    assert.strictEqual(F.compareDeposits(1e6, p.plans, 0, 80)[0].early, null);
    for (const bad of ['', 'A,單利,1.6', 'A,雙利,1,1', 'A,單利,x,1', 'A,單利,1,0', 'A,機動,1//2,1', 'A,單利,1,60', Array(11).fill('A,單利,1,1').join('\n')]) assert.ok(F.parseDeposits(bad).err, bad);

    // 信用卡：手算 —— 每月 一般 20000 / 海外 5000 / 網購 8000 / 加油 2000 / 餐飲 6000，總 41000，年 492000
    const sp = [20000, 5000, 8000, 2000, 6000];
    const cs = F.parseCards('甲,1800,100000,500,1,3,2,1,1\n乙,0,0,0,0.5,0.5,0.5,0.5,0.5');
    assert.strictEqual(cs.cards.length, 2);
    const rk = F.compareCards(sp, cs.cards);
    // 甲：200+150+160+20+60 = 590，月上限 500 → 年 6000，年消費 ≥ 10 萬免年費 → 淨 6000
    // 乙：41000 × 0.5% = 205 → 年 2460
    assert.deepStrictEqual(rk.map(x => x.name), ['甲', '乙']);
    near(rk[0].year, 6000); assert.ok(rk[0].capped && rk[0].waived); near(rk[0].net, 6000); near(rk[0].rate, 6000 / 492000);
    near(rk[1].net, 2460); assert.ok(!rk[1].capped);
    // 年費未達門檻：年費照收，淨回饋變負 → 排到最後
    const low = F.compareCards([1000, 0, 0, 0, 0], F.parseCards('貴,1800,100000,0,1\n免,0,0,0,0.5').cards);
    assert.deepStrictEqual(low.map(x => x.name), ['免', '貴']); near(low[1].net, 120 - 1800); assert.ok(!low[1].waived);
    // 回饋率少填視為 0；無上限（0）不截斷
    const nc = F.parseCards('丙,0,0,0,2').cards[0]; assert.deepStrictEqual(nc.rates, [2, 0, 0, 0, 0]);
    near(F.compareCards([1e6, 0, 0, 0, 0], [nc])[0].month, 20000);
    // 排名與卡片順序無關
    assert.deepStrictEqual(F.compareCards(sp, [...cs.cards].reverse()).map(x => x.name), ['甲', '乙']);
    for (const bad of ['', '甲,1800', '甲,x,0,0,1', '甲,0,0,0,101', '甲,-1,0,0,1', Array(11).fill('甲,0,0,0,1').join('\n')]) assert.ok(F.parseCards(bad).err, bad);
    ok('j1 finance-calc: 存款利率 / 信用卡回饋');
}

// ---------- biz-calc ----------
{
    const B = load('utils/biz-calc.html', 'dilution, parseRounds, valSens, esop, normOpts');
    // 創辦人 100%、投前 400 萬募 100 萬 → 投資人 20%、創辦人 80%；再一輪 → 64%
    let st = B.dilution(100, 0, [{ name: 'A', raise: 1e6, pre: 4e6, poolTarget: 0 }, { name: 'B', raise: 1e6, pre: 4e6, poolTarget: 0 }]);
    near(st[0].founder, 80); near(st[0].inv, 20); near(st[1].founder, 64); near(st[1].inv, 36); near(st[0].post, 5e6); near(st[0].founderValue, 4e6);
    // 池 10% 目標（投後）：d = 10%，創辦人 100% × (1 − 0.2 − 0.1) = 70%
    st = B.dilution(100, 0, [{ name: 'A', raise: 1e6, pre: 4e6, poolTarget: 10 }]);
    near(st[0].founder, 70); near(st[0].pool, 10); near(st[0].poolAdd, 10); near(st[0].inv, 20); near(st[0].effPre, 4e6 - 0.1 * 5e6);
    // 已有池 10%（創辦人 90%）：新投資人 20% → 池稀釋成 8%；目標 10% → d = (0.1 − 0.08) ÷ 0.9 = 2.222%
    st = B.dilution(90, 10, [{ name: 'A', raise: 1e6, pre: 4e6, poolTarget: 10 }]);
    near(st[0].pool, 10); near(st[0].poolAdd, 100 * (0.1 - 0.08) / 0.9, 1e-9);
    // 池目標已達（目標低於稀釋後）→ 不擴充
    st = B.dilution(90, 10, [{ name: 'A', raise: 1e6, pre: 4e6, poolTarget: 5 }]);
    near(st[0].poolAdd, 0); near(st[0].pool, 8); near(st[0].founder, 72);
    // 守恆：各方合計 100%
    st = B.dilution(60, 10, [{ name: 'a', raise: 2e6, pre: 8e6, poolTarget: 12 }, { name: 'b', raise: 2e7, pre: 6e7, poolTarget: 15 }, { name: 'c', raise: 1e8, pre: 4e8, poolTarget: 0 }]);
    for (const x of st) near(x.founder + x.pool + x.others + x.inv, 100, 1e-9);
    near(st[0].others, 30 * 0.8 - 0 - 0, 1) ; // 其他股東 30% × (1 − 20% − 池擴充)
    assert.strictEqual(B.dilution(80, 30, []), null); assert.strictEqual(B.dilution(80, 10, [{ raise: 0, pre: 1 }]), null); assert.strictEqual(B.dilution(80, 10, [{ raise: 1e6, pre: 4e6, poolTarget: 90 }]), null);
    assert.deepStrictEqual(B.dilution(80, 10, []), []);
    // 解析
    const pr = B.parseRounds('種子,2000000,8000000,10\nA 輪，20000000，60000000\n');
    assert.strictEqual(pr.rounds.length, 2); assert.strictEqual(pr.rounds[1].poolTarget, 0); assert.strictEqual(pr.rounds[0].pre, 8e6);
    for (const bad of ['', 'x,1', 'x,0,1', 'x,1,1,100', 'x,a,1', Array(11).fill('x,1,1').join('\n')]) assert.ok(B.parseRounds(bad).err, bad);
    // 估值
    const v = B.valSens(1e7, 1.5e6, 3, 12);
    near(v[2].byRev, 3e7); near(v[2].byPe, 1.8e7); near(v[0].byRev, 1.5e7); near(v[4].byPe, 1.8e7 * 1.5); near(v[0].mRev, 1.5);
    assert.ok(isNaN(B.valSens(1e7, NaN, 3, 12)[2].byPe) && isNaN(B.valSens(0, 1, 3, 12)[2].byRev));
    // 認股權：行使價 10、市價 50、1 萬股、行使稅 20%：成本 10 萬、價差 40 萬、稅 8 萬
    let e = B.esop(10, 50, 10000, 20, NaN, 0);
    near(e.cost, 1e5); near(e.spread, 4e5); near(e.taxEx, 8e4); near(e.cashNeed, 1.8e5); near(e.paperNet, 3.2e5); assert.strictEqual(e.net, null); assert.ok(!e.underwater);
    e = B.esop(10, 50, 10000, 20, 80, 10);   // 賣 80：賣出價差 (80−50)×1 萬 = 30 萬 × 10% = 3 萬；淨 = 70 萬 − 8 萬 − 3 萬 = 59 萬
    near(e.taxCg, 3e4); near(e.net, 5.9e5);
    e = B.esop(10, 50, 10000, 0, 40, 10);    // 賣得比行使日低：無價差稅，淨 = 30 萬
    near(e.taxCg, 0); near(e.net, 3e5);
    e = B.esop(50, 30, 100, 20, NaN, 0); assert.ok(e.underwater && e.taxEx === 0 && e.paperNet < 0);
    assert.strictEqual(B.esop(10, 50, 0, 20, NaN, 0), null); assert.strictEqual(B.esop(10, 50, 1, 120, NaN, 0), null);
    assert.strictEqual(B.normOpts({ tab: 3 }, []).tab, 3); assert.strictEqual(B.normOpts({ tab: 4 }, []).tab, 0);
    ok('j1 biz-calc: 新創股權');
}

// ---------- stock-cost ----------
{
    const S = load('utils/stock-cost.html', 'cryptoPnl');
    // 買 1 個 @100、手續費 0.1%、無滑價：均價 100.1；賣 110、手續費 0.1% → 收入 109.89、損益 9.79、平衡價 100.1 ÷ 0.999
    let r = S.cryptoPnl({ q1: 1, p1: 100, buyFee: 0.1, sellFee: 0.1, sell: 110 });
    near(r.avg, 100.1); near(r.proceeds, 109.89); near(r.pnl, 9.79); near(r.bePrice, 100.1 / 0.999); near(r.roi, 9.79 / 100.1 * 100);
    near(S.cryptoPnl({ q1: 1, p1: 100, buyFee: 0.1, sellFee: 0.1, sell: 100.1 / 0.999 }).pnl, 0, 1e-9);   // 賣在平衡價 → 損益 0
    // 滑價：買貴 1%、賣便宜 1%：成本 101，賣 110 → 108.9
    r = S.cryptoPnl({ q1: 1, p1: 100, slip: 1, sell: 110 }); near(r.avg, 101); near(r.proceeds, 108.9); near(r.pnl, 7.9);
    // 加碼平均：原 2 個均價 50 + 買 2 個 @100（無費）→ 均價 75；賣一半（2 個）@80 → 損益 (80−75)×2 = 10
    r = S.cryptoPnl({ q0: 2, c0: 50, q1: 2, p1: 100, sell: 80, sq: 2 }); near(r.avg, 75); near(r.pnl, 10); near(r.sold, 2);
    r = S.cryptoPnl({ q0: 2, c0: 50, q1: 2, p1: 100, sell: 80 }); near(r.pnl, 20);   // 0 = 全部
    assert.strictEqual(S.cryptoPnl({ q1: 1, p1: 100, sell: 80, sq: 2 }), null);       // 賣超過持有
    assert.strictEqual(S.cryptoPnl({ q1: 0, p1: 0, sell: 80 }), null); assert.strictEqual(S.cryptoPnl({ q1: 1, p1: 100, sell: NaN }), null);
    assert.strictEqual(S.cryptoPnl({ q1: 1, p1: 100, sellFee: 100, sell: 1 }), null);
    ok('j1 stock-cost: 加密貨幣損益');
}

// ---------- unit-converter ----------
{
    const U = load('utils/unit-converter.html', 'CATS, convertAll, goldValue, PURITY');
    const val = (v, from, to) => U.convertAll('黃金', v, from).find(x => x.unit === to).value;
    near(val(1, '台兩', '錢'), 10); near(val(1, '台兩', '公克'), 37.5); near(val(1, '錢', '公克'), 3.75); near(val(1, '金衡盎司', '公克'), 31.1034768);
    near(val(1, '台斤', '台兩'), 16); near(val(1, '台斤', '公克'), 600); near(val(1, '金衡盎司', '錢'), 31.1034768 / 3.75);
    near(val(1, '金衡盎司', '台兩'), 31.1034768 / 37.5);
    // 往返
    for (const a of Object.keys(U.CATS.黃金)) for (const b of Object.keys(U.CATS.黃金)) near(val(val(7.3, a, b), b, a), 7.3, 1e-12);
    // 與既有「重量」類別一致（台兩、台斤、公克）
    near(U.convertAll('重量', 1, '台兩').find(x => x.unit === '公克').value, 37.5);
    // 價值：1 錢 999 純度、每錢 8000 → 3.75 × 0.999 × (8000/3.75) = 7992
    let g = U.goldValue(3.75, 0.999, 8000, 'qian'); near(g.value, 7992); near(g.pure, 3.75 * 0.999); near(g.pureQian, 0.999); near(g.perQian, 8000);
    g = U.goldValue(10, 0.9999, 2000, 'g'); near(g.value, 19998); near(g.perQian, 7500);
    g = U.goldValue(3.75, 18 / 24, 8000, 'qian'); near(g.value, 6000); near(U.PURITY['18K'], 0.75);
    assert.strictEqual(U.goldValue(1, 0, 1, 'g'), null); assert.strictEqual(U.goldValue(1, 1.1, 1, 'g'), null); assert.strictEqual(U.goldValue(1, 1, NaN, 'g'), null);
    ok('j1 unit-converter: 黃金');
}

// ---------- packing-list ----------
{
    const P = load('utils/packing-list.html', 'PK, TYPES, MOVES, defaultItems, addList, normLists, toText');
    assert.ok(P.TYPES.includes('搬家') && P.TYPES.includes('入住 / 過戶 / 通知'));
    const m = P.defaultItems('搬家', 3, 'mild', 4), t = (a, re) => a.find(x => re.test(x.t));
    assert.ok(t(m, /^紙箱 × 32/) && t(m, /^膠帶 × 4$/) && t(m, /台電/) && t(m, /戶政/) && t(m, /郵局/) && t(m, /銀行/) && t(m, /行照|車籍/) && t(m, /管理費/) && t(m, /垃圾/));
    assert.strictEqual(m.filter(x => /^房間 \d+：打包與貼標$/.test(x.t)).length, 4);
    assert.ok(t(m, /預留打包 3 天（每天約 2 個房間）/) && t(m, /搬家公司/));
    assert.strictEqual(P.defaultItems('搬家', 3, 'mild', 20).filter(x => /^房間 \d+：/.test(x.t)).length, 10);   // 房間標示最多 10 間
    assert.ok(t(P.defaultItems('搬家', 3, 'mild', 20), /^紙箱 × 160/));
    const g = P.defaultItems('入住 / 過戶 / 通知', 2, 'mild', 5);
    assert.ok(t(g, /台電/) && t(g, /戶政/) && !t(g, /紙箱/) && !t(g, /搬家公司/));
    // 法規性項目不寫具體天數
    assert.ok(![...m, ...g].some(x => /\d+\s*(日內|天內|個月內)/.test(x.t)));
    for (const x of [...m, ...g]) assert.ok(x.t.length <= P.PK.TEXT && x.g && x.g.length <= 12, x.t);
    // 既有類型不受影響
    assert.ok(t(P.defaultItems('出國', 4, 'mild'), /^內衣褲 × 5$/));
    // addList：房間數驗證、不分季節、持久化結構不變
    let r = P.addList([], { name: '新家', type: '搬家', days: 5, season: 'mild', rooms: 3 });
    assert.ok(!r.err && r.lists[0].type === '搬家' && r.lists[0].items.length > 20 && r.lists[0].items.length <= P.PK.ITEMS && Object.keys(r.lists[0]).sort().join() === 'days,id,items,name,season,type');
    assert.ok(P.addList([], { name: 'x', type: '搬家', days: 5, season: 'mild', rooms: 0 }).err && P.addList([], { name: 'x', type: '搬家', days: 5, season: 'mild', rooms: 21 }).err && P.addList([], { name: 'x', type: '搬家', days: 5, season: 'mild' }).err);
    assert.ok(!P.addList([], { name: 'x', type: '出國', days: 5, season: 'mild' }).err);          // 其他類型不需要房間數
    assert.ok(P.addList([], { name: 'x', type: '入住 / 過戶 / 通知', days: 1, season: 'hot', rooms: 2 }).lists[0].items.length > 10);
    // 載入與文字輸出
    assert.strictEqual(P.normLists(JSON.parse(JSON.stringify(r.lists)))[0].type, '搬家');
    assert.ok(P.toText(r.lists[0]).startsWith('新家（搬家・5 天）0/') && !P.toText(r.lists[0]).includes('春秋'));
    assert.ok(P.toText({ ...r.lists[0], type: '出國' }).includes('春秋'));
    ok('j1 packing-list: 搬家 / 入住過戶');
}
