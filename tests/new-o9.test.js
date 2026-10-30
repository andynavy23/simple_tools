// 批次 o9：手作工坊（utils/craft-kit.html）純邏輯
const { load, ok, near } = require('./_load');
const assert = require('assert');
const m = load('utils/craft-kit.html', 'printCost, knitCalc, hex2rgb, quantize, limitColors, usage, gridSize, cutPlan, parseCuts, candleCalc, parseOils, soapCalc, loadOpts, SAP, parseNum');

{ // 3D 列印成本：50g、600/kg、10% 耗損 → 33；電 0.12kW×4h×3=1.44；折舊 10000/2000×4=20；成本 54.44；報價 +30%
    const r = m.printCost({ grams: 50, pricePerKg: 600, wastePct: 10, hours: 4, watts: 120, kwhPrice: 3, machinePrice: 10000, lifeHours: 2000, other: 0, marginPct: 30 });
    near(r.material, 33); near(r.energy, 1.44); near(r.dep, 20); near(r.cost, 54.44); near(r.quote, 54.44 * 1.3);
    assert.ok(m.printCost({ grams: 0, pricePerKg: 1, wastePct: 0, hours: 1, watts: 1, kwhPrice: 1, machinePrice: 1, lifeHours: 1, other: 0, marginPct: 0 }).err);
    ok('craft 成本公式');
}
{ // 編織：10cm 20 針 28 段 → 50×150 cm = 100 針、420 段；循環 8 + 邊 2
    const r = m.knitCalc({ sst: 20, srow: 28, sw: 10, sh: 10, tw: 50, th: 150, mult: 1, extra: 0 });
    assert.strictEqual(r.stitches, 100); assert.strictEqual(r.rows, 420);
    const c = m.knitCalc({ sst: 20, srow: 28, sw: 10, sh: 10, tw: 50, th: 150, mult: 8, extra: 2 });
    assert.strictEqual((c.stitches - 2) % 8, 0); assert.strictEqual(c.stitches, 98);
    assert.ok(m.knitCalc({ sst: 0, srow: 1, sw: 1, sh: 1, tw: 1, th: 1, mult: 1, extra: 0 }).err);
    ok('craft 編織針數');
}
{ // 色板量化：決定性、透明、限色
    const pal = ['#FFFFFF', '#000000', '#FF0000', '#00FF00'];
    const px = [250, 250, 250, 255, 10, 10, 10, 255, 240, 20, 20, 255, 0, 0, 0, 0, 20, 230, 20, 255];
    const a = m.quantize(px, 5, pal), b = m.quantize(px, 5, pal);
    assert.deepStrictEqual(a, [0, 1, 2, -1, 3]); assert.deepStrictEqual(a, b);
    assert.deepStrictEqual(m.usage(a, 4), [1, 1, 1, 1]);
    const lim = m.limitColors(a, pal, 2);
    assert.ok(new Set(lim.filter(i => i >= 0)).size <= 2); assert.strictEqual(lim[3], -1);
    assert.deepStrictEqual(m.limitColors(a, pal, 4), a);
    assert.deepStrictEqual(m.gridSize(100, 50, 20), { c: 20, r: 10 }); assert.strictEqual(m.gridSize(10, 100, 100), null); assert.strictEqual(m.gridSize(1, 1, 3), null);
    ok('craft 色板量化');
}
{ // 裁切：不超長、無遺漏、與暴力最優對照
    const exact = (stock, kerf, lens) => { // 最少根數（件 = len+kerf，箱 = stock+kerf）
        const w = lens.map(l => l + kerf).sort((x, y) => y - x), cap = stock + kerf + 1e-9; let best = w.length;
        const go = (i, bins) => { if (bins.length >= best) return; if (i === w.length) { best = bins.length; return; } for (let j = 0; j < bins.length; j++) if (bins[j] + w[i] <= cap) { bins[j] += w[i]; go(i + 1, bins); bins[j] -= w[i]; } bins.push(w[i]); go(i + 1, bins); bins.pop(); };
        go(0, []); return best;
    };
    let seed = 7; const rnd = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
    for (let t = 0; t < 60; t++) {
        const stock = 100, kerf = [0, 0.5, 3][rnd(3)], lens = Array.from({ length: 1 + rnd(9) }, () => 5 + rnd(80));
        const p = m.cutPlan(stock, kerf, lens), opt = exact(stock, kerf, lens);
        assert.deepStrictEqual(p.bars.flatMap(b => b.cuts).sort((a, b) => a - b), [...lens].sort((a, b) => a - b), '遺漏或多出');
        p.bars.forEach(b => assert.ok(b.used <= stock + 1e-9 && b.left >= -1e-9, '超長'));
        assert.ok(p.count >= opt && p.lower <= opt, `下限/最優 ${p.lower}/${opt}/${p.count}`);
        assert.ok(p.count <= Math.floor(11 / 9 * opt + 1), `FFD 保證 ${p.count} vs ${opt}`);
    }
    assert.ok(m.cutPlan(50, 0, [60]).err);
    assert.deepStrictEqual(m.parseCuts('80 3\n60\nabc\n5 x').lens, [80, 80, 80, 60]);
    assert.strictEqual(m.parseCuts('80 3\n60\nabc').bad.length, 1);
    ok('craft 裁切');
}
{ // 蠟燭
    const r = m.candleCalc(200, 90, 8, 0.9); near(r.total, 162); near(r.frag, 12.96); near(r.wax, 149.04);
    assert.ok(m.candleCalc(200, 90, 5, 0.9).err); assert.ok(m.candleCalc(200, 90, 11, 0.9).err);
    ok('craft 蠟燭');
}
{ // 皂：橄欖油 500g、鹼折扣 5% → 63.65 g、水 127.3 g
    const p = m.parseOils('橄欖油 500'); assert.strictEqual(p.items[0].sap, 0.134);
    const r = m.soapCalc(p.items, 5, 2); near(r.full, 67); near(r.lye, 63.65); near(r.water, 127.3); near(r.conc, 1 / 3);
    assert.strictEqual(m.parseOils('未知油 100').bad.length, 1);
    assert.strictEqual(m.parseOils('未知油 100 0.15').items[0].sap, 0.15);
    assert.ok(m.soapCalc(p.items, 50, 2).err); assert.ok(m.soapCalc([], 5, 2).err);
    ok('craft 皂化');
}
{ const o = m.loadOpts({ tab: 'x', v: { print_grams: 5, soap_oils: '橄欖油 1' } }); assert.strictEqual(o.tab, 'print'); assert.strictEqual(o.v.print_grams, '50'); assert.strictEqual(o.v.soap_oils, '橄欖油 1'); assert.strictEqual(m.loadOpts(null).tab, 'print'); ok('craft 載入容錯'); }
