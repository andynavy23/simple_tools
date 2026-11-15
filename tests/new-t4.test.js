// 批次 t4：electronics-calc 純邏輯、home-calc 磁磚油漆、unit-converter 紙張尺寸
const assert = require('assert');
const { load, ok, near } = require('./_load');

{   // electronics-calc
    const E = load('utils/electronics-calc.html', 'parseSI, fmtSI, decodeBands, encodeBands, ohmLaw, seriesR, parallelR, parseList, E12, E24, E96, nearestE, ledResistor, divider, dividerR2, rcCalc, normOpts');
    near(E.parseSI('4.7k'), 4700); near(E.parseSI('100n'), 1e-7); near(E.parseSI('2.2u'), 2.2e-6); near(E.parseSI('4k7'), 4700);
    near(E.parseSI('1M'), 1e6); near(E.parseSI('10mA'), 0.01); near(E.parseSI('1e3'), 1000); near(E.parseSI('5V'), 5);
    assert.ok(isNaN(E.parseSI('abc')) && isNaN(E.parseSI('')) && isNaN(E.parseSI(null)));
    assert.strictEqual(E.fmtSI(4700, 'Ω'), '4.7 kΩ'); assert.strictEqual(E.fmtSI(0.001, 's'), '1 ms');
    // 色碼：黃紫紅金 = 4.7k ±5%
    assert.deepStrictEqual(E.decodeBands(['4', '7', '2', 'g']), { ohms: 4700, tol: 5, tc: null });
    assert.deepStrictEqual(E.decodeBands(['1', '0', '0', '2', '1']), { ohms: 10000, tol: 1, tc: null });
    assert.deepStrictEqual(E.decodeBands(['1', '0', '0', '2', '1', '3']), { ohms: 10000, tol: 1, tc: 15 });
    assert.strictEqual(E.decodeBands(['2', '2', 'g', 'g']).ohms, 2.2);
    assert.strictEqual(E.decodeBands(['4', '7', '2']), null);
    assert.strictEqual(E.decodeBands(['4', '7', 'g', 'x']), null);
    assert.deepStrictEqual(E.encodeBands(4700, 4, 'g').keys, ['4', '7', '2', 'g']);
    assert.deepStrictEqual(E.encodeBands(4.7, 4, 'g').keys, ['4', '7', 'g', 'g']);
    assert.deepStrictEqual(E.encodeBands(10000, 5, '1').keys, ['1', '0', '0', '2', '1']);
    assert.deepStrictEqual(E.encodeBands(1e6, 4, 'g').keys, ['1', '0', '5', 'g']);
    assert.strictEqual(E.encodeBands(4700, 4).exact, true);
    assert.strictEqual(E.encodeBands(4730, 4).exact, false); assert.strictEqual(E.encodeBands(4730, 4).value, 4700);
    assert.strictEqual(E.encodeBands(0, 4), null); assert.strictEqual(E.encodeBands(1e12, 4), null);
    for (const r of [1, 10, 33, 220, 4700, 1e5, 2.2e6]) for (const n of [4, 5]) { const e = E.encodeBands(r, n); assert.strictEqual(E.decodeBands(e.keys).ohms, r, r + '/' + n); }
    // 歐姆定律
    let o = E.ohmLaw(12, 2, NaN, NaN); near(o.R, 6); near(o.P, 24);
    o = E.ohmLaw(NaN, NaN, 6, 24); near(o.V, 12); near(o.I, 2);
    o = E.ohmLaw(12, NaN, NaN, 24); near(o.I, 2); near(o.R, 6);
    o = E.ohmLaw(NaN, 2, 6, NaN); near(o.V, 12); near(o.P, 24);
    o = E.ohmLaw(NaN, 2, NaN, 24); near(o.V, 12); near(o.R, 6);
    assert.strictEqual(E.ohmLaw(12, 2, 6, NaN), null); assert.strictEqual(E.ohmLaw(12, NaN, NaN, NaN), null);
    near(E.seriesR([100, 220, 330]), 650); near(E.parallelR([10000, 10000]), 5000); near(E.parallelR([100, 100, 100]), 100 / 3); assert.strictEqual(E.parallelR([0, 5]), 0);
    assert.strictEqual(E.seriesR([]), null);
    const pl = E.parseList('100 220, 4.7k\nabc -5'); assert.deepStrictEqual(pl.vals, [100, 220, 4700]); assert.strictEqual(pl.bad, 2);
    assert.strictEqual(E.parseList(Array(80).fill('1').join(' ')).vals.length, 50);
    // E 系列
    assert.strictEqual(E.E12.length, 12); assert.strictEqual(E.E24.length, 24); assert.strictEqual(E.E96.length, 96);
    for (const S of [E.E12, E.E24, E.E96]) assert.ok(S.every((x, i) => i === 0 || x > S[i - 1]) && S[0] === 100 && S[S.length - 1] < 1000);
    assert.strictEqual(E.nearestE(4700, 'E24').nearest, 4700); assert.strictEqual(E.nearestE(4800, 'E24').nearest, 4700);
    assert.strictEqual(E.nearestE(5000, 'E12').nearest, 4700); assert.strictEqual(E.nearestE(4700, 'E96').nearest, 4750);
    assert.strictEqual(E.nearestE(9800, 'E24').nearest, 10000); assert.strictEqual(E.nearestE(0.5, 'E24').nearest, 0.51);
    assert.strictEqual(E.nearestE(350, 'E24').upper, 360); assert.strictEqual(E.nearestE(350, 'E24').lower, 330);
    assert.strictEqual(E.nearestE(-1, 'E24'), null); assert.strictEqual(E.nearestE(5, 'E5'), null);
    // LED
    let l = E.ledResistor(5, 2, 20); near(l.R, 150); near(l.P, 0.06); assert.strictEqual(l.up, 150); assert.strictEqual(l.rating, 0.125);
    l = E.ledResistor(9, 2, 20); near(l.R, 350); assert.strictEqual(l.up, 360); assert.strictEqual(l.nearest, 360); assert.ok(l.Iactual < 0.02);
    l = E.ledResistor(9, 2, 20, 3); near(l.R, 150);
    assert.strictEqual(E.ledResistor(2, 2, 20), null); assert.strictEqual(E.ledResistor(5, 2, 0), null);
    // 分壓
    near(E.divider(10, 1000, 1000).Vout, 5); near(E.divider(5, 10000, 20000).Vout, 10 / 3);
    near(E.dividerR2(12, 5, 10000), 50000 / 7); assert.strictEqual(E.dividerR2(5, 6, 1000), null);
    // RC
    const rc = E.rcCalc(10000, 100e-9); near(rc.tau, 1e-3); near(rc.fc, 159.1549, 1e-5); near(rc.rise, 2.2e-3);
    near(E.rcCalc(10000, 1e-7, 1000).cFor, 1 / (2 * Math.PI * 1e4 * 1000));
    assert.strictEqual(E.rcCalc(0, 1e-7), null);
    assert.deepStrictEqual(E.normOpts({ tab: 99, v: { oh_v: '5', x: '1', oh_r: 3 } }, ['oh_v', 'oh_r']), { tab: 0, v: { oh_v: '5' } });
    assert.deepStrictEqual(E.normOpts(null, ['a']), { tab: 0, v: {} });
    assert.strictEqual(E.normOpts({ tab: 6, v: [] }, ['a']).tab, 6);
    ok('t4 electronics-calc');
}

{   // home-calc 磁磚與油漆
    const H = load('utils/home-calc.html', 'roomAreas, tilePlan, paintPlan, normOpts');
    let r = H.roomAreas(4, 3.5, 2.6, 3.5); near(r.wall, 35.5); near(r.floor, 14); near(r.ceil, 14);
    near(H.roomAreas(4, 3, 2.5, NaN).wall, 35); assert.strictEqual(H.roomAreas(4, 3, 2.5, 100), null); assert.strictEqual(H.roomAreas(0, 3, 2.5, 0), null);
    // 1 m² 用 50×50、無縫、無損耗 = 4 片
    let t = H.tilePlan(1, 50, 50, 0, 0, NaN, NaN); assert.strictEqual(t.net, 4); assert.strictEqual(t.tiles, 4); assert.ok(isNaN(t.boxes) && isNaN(t.cost));
    // 10% 損耗：4.4 → 5
    assert.strictEqual(H.tilePlan(1, 50, 50, 0, 10).tiles, 5);
    // 14 m²、60×60、縫 2mm、10%、每箱 4、每片 100
    t = H.tilePlan(14, 60, 60, 2, 10, 4, 100); assert.strictEqual(t.net, 39); assert.strictEqual(t.tiles, 43); assert.strictEqual(t.boxes, 11); assert.strictEqual(t.buy, 44); assert.strictEqual(t.extra, 5); near(t.cost, 4400);
    assert.strictEqual(H.tilePlan(14, 60, 60, 2, 15).tiles, 45);
    assert.strictEqual(H.tilePlan(0, 60, 60, 2, 10), null); assert.strictEqual(H.tilePlan(10, 0, 60, 2, 10), null); assert.strictEqual(H.tilePlan(10, 60, 60, 2, 500), null);
    // 油漆：35.5 m² × 2 層 ÷ 10 = 7.1 L → 每桶 5 L = 2 桶
    let p = H.paintPlan(35.5, 2, 10, 5, 800); near(p.liters, 7.1); assert.strictEqual(p.cans, 2); assert.strictEqual(p.cost, 1600);
    assert.strictEqual(H.paintPlan(10, 1, 10, 1, NaN).cans, 1); assert.ok(isNaN(H.paintPlan(10, 1, 10, NaN).cans));
    assert.strictEqual(H.paintPlan(10, 0, 10, 5), null); assert.strictEqual(H.paintPlan(10, 2, 0, 5), null);
    assert.strictEqual(H.normOpts({ tab: 7, v: {} }, []).tab, 7); assert.strictEqual(H.normOpts({ tab: 8 }, []).tab, 0);
    ok('t4 home-calc tile/paint');
}

{   // unit-converter 紙張尺寸
    const U = load('utils/unit-converter.html', 'seriesDims, PAPERS, PAPER_DPI, paperPx, paperArea, paperRows');
    const get = (n) => U.PAPERS.find(p => p.name === n);
    const A = Array.from({ length: 11 }, (_, i) => get('A' + i)), B = Array.from({ length: 11 }, (_, i) => get('B' + i)), J = Array.from({ length: 11 }, (_, i) => get('JIS B' + i));
    assert.deepStrictEqual([A[0].w, A[0].h], [841, 1189]); assert.deepStrictEqual([A[4].w, A[4].h], [210, 297]); assert.deepStrictEqual([A[10].w, A[10].h], [26, 37]);
    assert.deepStrictEqual([A[5].w, A[5].h], [148, 210]); assert.deepStrictEqual([A[8].w, A[8].h], [52, 74]);
    assert.deepStrictEqual([B[0].w, B[0].h], [1000, 1414]); assert.deepStrictEqual([B[4].w, B[4].h], [250, 353]); assert.deepStrictEqual([B[5].w, B[5].h], [176, 250]);
    assert.deepStrictEqual([J[0].w, J[0].h], [1030, 1456]); assert.deepStrictEqual([J[4].w, J[4].h], [257, 364]); assert.deepStrictEqual([J[5].w, J[5].h], [182, 257]);
    assert.deepStrictEqual([get('C4').w, get('C4').h], [229, 324]); assert.deepStrictEqual([get('C5').w, get('C5').h], [162, 229]);
    // 每級：長邊 = 上一級短邊，短邊 = 上一級長邊的一半（捨去）；面積約為一半
    for (const S of [A, B, J]) for (let i = 1; i < 11; i++) { assert.strictEqual(S[i].h, S[i - 1].w); assert.strictEqual(S[i].w, Math.floor(S[i - 1].h / 2)); if (i <= 6) { const q = U.paperArea(S[i]) / U.paperArea(S[i - 1]); assert.ok(Math.abs(q - 0.5) < 0.02, `${S[i].name} ${q}`); } }
    near(U.paperArea(A[0]) / 1e6, 1, 0.01);
    assert.strictEqual(U.PAPERS.filter(p => /^(A|B|JIS B)\d+$/.test(p.name)).length, 33);
    // 像素：A4 @ 300 DPI = 2480 × 3508、@72 = 595 × 842
    assert.strictEqual(U.paperPx(210, 300), 2480); assert.strictEqual(U.paperPx(297, 300), 3508); assert.strictEqual(U.paperPx(210, 72), 595); assert.strictEqual(U.paperPx(297, 72), 842);
    assert.deepStrictEqual(U.PAPER_DPI, [72, 96, 150, 300, 600]);
    assert.deepStrictEqual([get('Letter（8.5×11 in）').w, get('Letter（8.5×11 in）').h], [215.9, 279.4]); assert.strictEqual(U.paperPx(215.9, 300), 2550);
    near(U.paperArea(A[4]) / U.paperArea(A[3]), 0.5, 0.01);
    const rows = U.paperRows(A[4], A[4]); assert.strictEqual(rows.length, 9); assert.ok(rows[0][1].includes('210 × 297') && rows[8][1].includes('1 倍'), JSON.stringify(rows));
    assert.ok(U.PAPERS.every(p => p.w > 0 && p.h >= p.w));
    ok('t4 unit-converter paper');
}
