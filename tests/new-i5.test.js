// 批次 i5：台灣稅費試算（utils/tw-tax-calc.html）純函式，手算案例
const { load, ok } = require('./_load');
const assert = require('assert');
const m = load('utils/tw-tax-calc.html', 'sanitize, houseValue, calcHouse, calcLand, calcLvt, calcTrade, calcEstate, calcGift, calcImport, calcCarry, calcVat, parseLines, calcInvoice, calcSmall, calcCorp, toNum');
const S = (v = {}, c = {}) => m.sanitize({ v, c });
const run = (f, v = {}, c = {}) => { const s = S(v, c); return m[f](s.v, s.c); };

// sanitize：壞資料
for (const bad of [null, 5, [], 'x', { v: null, c: 3, tab: 9 }, { v: { hVal: -5, hKind: 'zz', tSelf: 1, bLines: 7 }, c: { gU: 'a', dRate: -1, hSelf: Infinity } }]) {
    const s = m.sanitize(bad);
    assert.equal(s.tab, 'house'); assert.equal(s.v.hVal, 0); assert.equal(s.v.hKind, 'self'); assert.equal(s.v.tSelf, false); assert.equal(s.v.bLines, '');
    assert.equal(s.c.dRate, 6); assert.equal(s.c.gU, 10000000); assert.equal(s.c.hSelf, 1.2);
}
assert.equal(S({ hVal: 1e30 }).v.hVal, 1e12); assert.equal(S({}, { dRate: 500 }).c.dRate, 100); assert.equal(S({ tab: 'x' }).tab, 'house');
assert.equal(m.sanitize({ tab: 'vat' }).tab, 'vat');
assert.ok(Number.isNaN(m.toNum('abc'))); assert.equal(m.toNum('1,234'), 1234);

// 房屋稅（財政部案例：2450 × 250 × (1 − 1%×30) × 290% = 1,243,375；× 1.2%）
assert.equal(m.houseValue(S({ hUnit: 2450, hArea: 250, hDep: 1, hYears: 30, hStreet: 290 }).v), 1243375);
assert.equal(run('calcHouse', { hUnit: 2450, hArea: 250, hDep: 1, hYears: 30, hStreet: 290 }).tax, 14921); // 14920.5 四捨五入
assert.equal(run('calcHouse', { hVal: 1000000 }).tax, 12000);
assert.equal(run('calcHouse', { hVal: 1000000, hKind: 'one' }).tax, 10000);
assert.equal(run('calcHouse', { hVal: 1000000, hKind: 'non' }).tax, 24000);
assert.equal(run('calcHouse', { hVal: 500000, hUnit: 9, hKind: 'biz' }).tax, 15000);
assert.equal(run('calcHouse', {}).tax, 0);
assert.equal(m.houseValue(S({ hUnit: 1000, hArea: 10, hDep: 2, hYears: 60, hStreet: 100 }).v), 0);
assert.equal(run('calcHouse', { hVal: 1e12 }).tax, 1.2e10);

// 地價稅：U = 1,000,000
const U = { gU: 1000000 };
assert.equal(run('calcLand', { gVal: 1000000 }, U).tax, 10000);
assert.equal(run('calcLand', { gVal: 1000000 }, U).level, 1);
assert.equal(run('calcLand', { gVal: 3000000 }, U).tax, 40000);              // 3,000,000 × 15‰ − 5,000
assert.equal(run('calcLand', { gVal: 3000000 }, U).level, 2);
assert.equal(run('calcLand', { gVal: 4999999 }, U).level, 2);
assert.equal(run('calcLand', { gVal: 5000000 }, U).level, 3);
assert.equal(run('calcLand', { gVal: 5000000 }, U).tax, 60000);              // 5,000,000 × 25‰ − 65,000
assert.equal(run('calcLand', { gVal: 10000000 }, U).tax, 175000);           // 第 4 級：350,000 − 175,000
assert.equal(run('calcLand', { gVal: 10000000 }, U).level, 4);
assert.equal(run('calcLand', { gVal: 20000000 }, U).level, 6);
assert.equal(run('calcLand', { gVal: 20000000 }, U).tax, 555000);            // 1,100,000 − 545,000
assert.equal(run('calcLand', { gVal: 15000000 }, U).tax, 340000);            // 第 5 級：675,000 − 335,000
assert.equal(run('calcLand', { gVal: 3000000, gMode: 'self' }, U).tax, 6000);
assert.equal(run('calcLand', { gVal: 0 }, U).tax, 0);
assert.equal(run('calcLand', { gVal: 2000000 }, { gU: 0 }).noU, true);

// 土增稅：財政部頁面範例 5,920,000 / 296% / 持有 35 年 → 1,592,800；自用 592,000
const lv = { tDecl: 7920000, tOrig: 2000000, tYears: 35 };
assert.equal(run('calcLvt', lv).tax, 1592800); assert.equal(run('calcLvt', lv).level, 3);
assert.equal(run('calcLvt', { ...lv, tSelf: true }).tax, 592000);
assert.equal(run('calcLvt', { tDecl: 1900000, tOrig: 1000000 }).tax, 180000);   // 倍數 90% → 20%
assert.equal(run('calcLvt', { tDecl: 2000000, tOrig: 1000000 }).level, 2);       // 剛好 100%
assert.equal(run('calcLvt', { tDecl: 2000000, tOrig: 1000000 }).tax, 200000);    // 1,000,000×30% − 1,000,000×10%
assert.equal(run('calcLvt', { tDecl: 2999999, tOrig: 1000000 }).level, 2);
assert.equal(run('calcLvt', { tDecl: 3000000, tOrig: 1000000 }).level, 3);
assert.equal(run('calcLvt', { tDecl: 3000000, tOrig: 1000000 }).tax, 500000);    // 2,000,000×40% − 1,000,000×30%
assert.equal(run('calcLvt', { tDecl: 3000000, tOrig: 1000000, tYears: 20 }).tax, 500000);
assert.equal(run('calcLvt', { tDecl: 3000000, tOrig: 1000000, tYears: 21 }).tax, 480000); // 2,000,000×36% − 1,000,000×24%
assert.equal(run('calcLvt', { tDecl: 2000000, tOrig: 1000000, tYears: 41 }).tax, 200000);
assert.equal(run('calcLvt', { tDecl: 1000000, tOrig: 1000000 }).tax, 0);
assert.equal(run('calcLvt', { tDecl: 500000, tOrig: 1000000 }).tax, 0);
assert.equal(run('calcLvt', { tDecl: 2000000, tOrig: 1000000, tCpi: 120 }).gain, 800000);
assert.equal(run('calcLvt', { tDecl: 2000000, tOrig: 1000000, tImp: 300000 }).gain, 700000);
assert.equal(run('calcLvt', { tDecl: 1000000, tOrig: 0 }).tax, 400000);          // 無原地價：第 3 級
assert.equal(run('calcLvt', { tDecl: 1000000, tOrig: 100, tCpi: 0 }).adj, 100);  // 指數 0 視為 100
assert.ok(Number.isFinite(run('calcLvt', { tDecl: 1e12, tOrig: 1 }).tax));

// 交易合計：成交價 1,000 萬、契價 30 萬、申報現值 500 萬、原地價 300 萬
const tr = run('calcTrade', { tPrice: 10000000, tDeedVal: 300000, tDecl: 5000000, tOrig: 3000000, tAgB: 1, tAgS: 2, tScrB: 20000, tScrS: 10000 });
assert.equal(tr.deed, 18000); assert.equal(tr.stamp, 5300);
assert.equal(tr.lvt.gain, 2000000); assert.equal(tr.lvt.tax, 400000);            // 倍數 66.7% → 20%
assert.equal(tr.agB, 100000); assert.equal(tr.agS, 200000);
assert.equal(tr.buyerFees, 143300); assert.equal(tr.buyerTotal, 10143300);
assert.equal(tr.sellerFees, 610000); assert.equal(tr.sellerNet, 9390000);
assert.equal(run('calcTrade', {}).buyerTotal, 0);

// 遺產稅
let e = run('calcEstate', { eGross: 30000000, eSpouse: true, eChild: 2, eFuneral: true });
assert.equal(e.deduct, 13330000 + 5530000 + 1120000 + 1380000); assert.equal(e.net, 8640000); assert.equal(e.tax, 864000);
e = run('calcEstate', { eGross: 13330000, eFuneral: false }); assert.equal(e.net, 0); assert.equal(e.tax, 0);
e = run('calcEstate', { eGross: 13330001, eFuneral: false }); assert.equal(e.net, 1); assert.equal(e.tax, 0);
e = run('calcEstate', { eGross: 63330000, eFuneral: false }); assert.equal(e.net, 50000000); assert.equal(e.tax, 5000000);
e = run('calcEstate', { eGross: 63330001, eFuneral: false }); assert.equal(e.net, 50000001); assert.equal(e.tax, 5000000); // 0.15×50,000,001 − 2,500,000 = 5,000,000.15
e = run('calcEstate', { eGross: 113330000, eFuneral: false }); assert.equal(e.net, 100000000); assert.equal(e.tax, 12500000);
e = run('calcEstate', { eGross: 213330000, eFuneral: false }); assert.equal(e.tax, 32500000);   // 200,000,000×20% − 7,500,000
e = run('calcEstate', { eGross: 1e12, eFuneral: false }); assert.ok(Number.isFinite(e.tax) && e.tax > 0);
e = run('calcEstate', { eGross: 50000000, eFuneral: false, eParent: 5, eMinor: 10, eDis: 1, eSib: 1, eOther: 1000000 });
assert.equal(e.deduct, 13330000 + 2 * 1380000 + 10 * 560000 + 6930000 + 560000 + 1000000);
assert.equal(run('calcEstate', { eGross: 0 }).tax, 0);

// 贈與稅（244 萬免稅）
assert.equal(run('calcGift', { gGift: 2440000 }).tax, 0); assert.equal(run('calcGift', { gGift: 2440000 }).net, 0);
assert.equal(run('calcGift', { gGift: 2440001 }).net, 1);
assert.equal(run('calcGift', { gGift: 5000000 }).tax, 256000);
assert.equal(run('calcGift', { gGift: 27440000 }).net, 25000000); assert.equal(run('calcGift', { gGift: 27440000 }).tax, 2500000);
assert.equal(run('calcGift', { gGift: 27440001 }).tax, 2500000);                 // 0.15×25,000,001 − 1,250,000 = 2,500,000.15
assert.equal(run('calcGift', { gGift: 52440000 }).tax, 6250000);
assert.equal(run('calcGift', { gGift: 102440000 }).tax, 16250000);               // 100,000,000×20% − 3,750,000
assert.equal(run('calcGift', { gGift: 5000000, gOther: 3000000 }).net, 0);
assert.ok(Number.isFinite(run('calcGift', { gGift: 1e12 }).tax));

// 進口
let im = run('calcImport', { iGoods: 1500, iShip: 500 });
assert.equal(im.exempt, true); assert.equal(im.total, 0);                        // 2,000 剛好免稅
assert.equal(run('calcImport', { iGoods: 1500, iShip: 501 }).exempt, false);
im = run('calcImport', { iGoods: 1500, iShip: 600, iDuty: 10 });                 // 完稅 2,100；關稅 210；營業稅 2,310×5% = 115.5 → 116
assert.equal(im.dutiable, 2100); assert.equal(im.duty, 210); assert.equal(im.vat, 116); assert.equal(im.total, 326);
im = run('calcImport', { iGoods: 10000, iShip: 1000, iIns: 200, iDuty: 5, iExc: 13 }); // 11,200；關稅 560；貨物稅 11,760×13% = 1,528.8 → 1,529；營業稅 13,289×5% = 664.45 → 664
assert.equal(im.duty, 560); assert.equal(im.excise, 1529); assert.equal(im.vat, 664); assert.equal(im.total, 2753);
assert.equal(run('calcImport', { iGoods: 1000, iTob: true }).exempt, false);
assert.equal(run('calcImport', { iGoods: 1000, iCount: 6 }).exempt, false);
assert.equal(run('calcImport', { iGoods: 1000, iCount: 5 }).exempt, true);
assert.equal(run('calcImport', {}).total, 0);
assert.ok(Number.isFinite(run('calcImport', { iGoods: 1e12, iDuty: 100, iExc: 100 }).total));

// 出國免稅
const st = (v) => Object.fromEntries(run('calcCarry', v).map(x => [x[0], x[1]]));
assert.deepStrictEqual(st({ pLiq: 1.5 }), { 酒類: 'ok' }); assert.deepStrictEqual(st({ pLiq: 1.6 }), { 酒類: 'declare' });
assert.deepStrictEqual(st({ pLiq: 5 }), { 酒類: 'declare' }); assert.deepStrictEqual(st({ pLiq: 5.1 }), { 酒類: 'over' });
assert.deepStrictEqual(st({ pLiq: 1, pAge: 17 }), { 酒類: 'bad' }); assert.deepStrictEqual(st({ pLiq: 1, pAge: 18 }), { 酒類: 'ok' });
assert.deepStrictEqual(st({ pCig: 200 }), { 菸品: 'ok' }); assert.deepStrictEqual(st({ pCig: 201 }), { 菸品: 'declare' });
assert.deepStrictEqual(st({ pCig: 1000 }), { 菸品: 'declare' }); assert.deepStrictEqual(st({ pCig: 1001 }), { 菸品: 'over' });
assert.deepStrictEqual(st({ pCigar: 25 }), { 菸品: 'ok' }); assert.deepStrictEqual(st({ pTob: 1 }), { 菸品: 'ok' });
assert.deepStrictEqual(st({ pCig: 100, pCigar: 10 }), { 菸品: 'declare' });
assert.deepStrictEqual(st({ pCig: 10, pAge: 19 }), { 菸品: 'bad' }); assert.deepStrictEqual(st({ pCig: 10, pAge: 20 }), { 菸品: 'ok' });
assert.deepStrictEqual(st({ pGoods: 35000 }), { 行李物品: 'ok' }); assert.deepStrictEqual(st({ pGoods: 35001 }), { 行李物品: 'declare' });
assert.deepStrictEqual(st({}), {});

// 營業稅換算
assert.deepStrictEqual(m.calcVat(105, 'g2n', 5, 'round'), { net: 100, tax: 5, gross: 105 });
assert.deepStrictEqual(m.calcVat(100, 'n2g', 5, 'round'), { net: 100, tax: 5, gross: 105 });
assert.deepStrictEqual(m.calcVat(100, 'g2n', 5, 'floor'), { net: 95, tax: 5, gross: 100 });
assert.deepStrictEqual(m.calcVat(100, 'g2n', 5, 'ceil'), { net: 96, tax: 4, gross: 100 });
assert.deepStrictEqual(m.calcVat(10, 'n2g', 5, 'round'), { net: 10, tax: 1, gross: 11 });
assert.deepStrictEqual(m.calcVat(10, 'n2g', 5, 'floor'), { net: 10, tax: 0, gross: 10 });
assert.deepStrictEqual(m.calcVat(10, 'n2g', 5, 'ceil'), { net: 10, tax: 1, gross: 11 });
assert.deepStrictEqual(m.calcVat(999, 'n2g', 0, 'round'), { net: 999, tax: 0, gross: 999 });
assert.deepStrictEqual(m.calcVat(0, 'g2n', 5, 'round'), { net: 0, tax: 0, gross: 0 });
assert.deepStrictEqual(m.calcVat(1155, 'g2n', 5, 'floor'), { net: 1100, tax: 55, gross: 1155 });   // 浮點：1155/1.05 不得變 1099
assert.deepStrictEqual(m.calcVat(210, 'g2n', 5, 'ceil'), { net: 200, tax: 10, gross: 210 });      // 浮點：不得變 201
assert.ok(Number.isFinite(m.calcVat(1e12, 'n2g', 5, 'round').gross));
// 發票拆分
assert.deepStrictEqual(m.parseLines('10\n20\n30 abc -5 0 1500'), [10, 20, 30, 1500]);
assert.equal(m.parseLines(Array.from({ length: 300 }, () => '5').join('\n')).length, 200); assert.deepStrictEqual(m.parseLines(null), []);
let iv = m.calcInvoice([10, 10, 10], 'net', 5, 'round');          // 逐筆 0.5→1 共 3；合計 30×5% = 1.5→2
assert.equal(iv.eachTax, 3); assert.equal(iv.total.tax, 2); assert.equal(iv.diff, 1); assert.equal(iv.total.gross, 32);
iv = m.calcInvoice([105, 105], 'gross', 5, 'round'); assert.equal(iv.diff, 0); assert.equal(iv.total.net, 200);
iv = m.calcInvoice([], 'net', 5, 'round'); assert.equal(iv.n, 0); assert.equal(iv.total.tax, 0);

// 小規模營業人（起徵點 10 萬 / 5 萬，1%）
assert.equal(run('calcSmall', { mGoods: 99999 }).taxable, false); assert.equal(run('calcSmall', { mGoods: 99999 }).total, 0);
assert.equal(run('calcSmall', { mGoods: 100000 }).taxable, true); assert.equal(run('calcSmall', { mGoods: 100000, mMonths: 3 }).total, 3000);
assert.equal(run('calcSmall', { mSvc: 50000, mMonths: 3 }).taxable, true);
assert.equal(run('calcSmall', { mGoods: 50000, mSvc: 25000 }).taxable, true);                      // 50% + 50% = 100%
assert.equal(run('calcSmall', { mGoods: 50000, mSvc: 24999 }).taxable, false);
assert.equal(run('calcSmall', { mGoods: 50000, mSvc: 25000, mMonths: 1 }).total, 750);
assert.equal(run('calcSmall', {}).total, 0);

// 營所稅
assert.equal(run('calcCorp', { yIncome: 120000 }).tax, 0);
assert.equal(run('calcCorp', { yIncome: 120001 }).tax, 1);                                         // 半數上限 0.5 → 1
assert.equal(run('calcCorp', { yIncome: 180000 }).tax, 30000);
assert.equal(run('calcCorp', { yIncome: 200000 }).tax, 40000);
assert.equal(run('calcCorp', { yIncome: 300000 }).tax, 60000);
assert.equal(run('calcCorp', { yRev: 5000000, yMargin: 6 }).income, 300000);
assert.equal(run('calcCorp', { yRev: 5000000, yMargin: 6, yIncome: 150000 }).income, 150000);
assert.equal(run('calcCorp', { yRev: 30000001 }).bookOver, true); assert.equal(run('calcCorp', { yRev: 30000000 }).bookOver, false);
assert.equal(run('calcCorp', {}).tax, 0);
assert.ok(Number.isFinite(run('calcCorp', { yIncome: 1e12 }).tax));
ok('tw-tax-calc');
