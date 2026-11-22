// itx 批次：IDEAS 131 / 145 / 146 loan-calculator 的寬限期、分段利率、記住輸入與逐期表匯出（其餘頁面的純函式測試續寫在下方）
const { load, ok, near } = require('./_load');
const assert = require('assert');
{
    const L = load('utils/loan-calculator.html', 'amortize, amortizePlan, checkLoanPlan, loanTable, cleanOpts');
    // 145：不寬限、不分段 → 與 amortize 完全一致；第二段與第一段同利率也一致
    for (const type of ['annuity', 'principal']) {
        const a = L.amortize(1e6, 2.2, 240, type), b = L.amortizePlan(1e6, 2.2, 240, type), c = L.amortizePlan(1e6, 2.2, 240, type, 0, 2.2, 61);
        assert.deepStrictEqual(b.rows, a.rows); assert.deepStrictEqual(c.rows, a.rows); assert.strictEqual(b.totalInterest, a.totalInterest);
    }
    // 寬限 12 期：前 12 期付款 = 本金 × 月利率、餘額不變；最後一期餘額 0
    const g = L.amortizePlan(1e6, 2.2, 240, 'annuity', 12);
    g.rows.slice(0, 12).forEach(r => { near(r.payment, 1e6 * 2.2 / 1200); assert.strictEqual(r.balance, 1e6); assert.strictEqual(r.principal, 0); });
    assert.strictEqual(g.rows.length, 240); assert.strictEqual(g.rows[239].balance, 0);
    assert.ok(g.totalInterest > L.amortize(1e6, 2.2, 240).totalInterest);
    near(g.rows[12].payment, L.amortize(1e6, 2.2, 228).rows[0].payment, 1e-9);
    const gp = L.amortizePlan(1e6, 2.2, 240, 'principal', 12); near(gp.rows[12].principal, 1e6 / 228); assert.strictEqual(gp.rows[239].balance, 0);
    // 分段利率：前 24 期 1.5%、之後 2.2%；第 25 期起月付以剩餘本金重算，最後餘額 0
    const s = L.amortizePlan(1e6, 1.5, 240, 'annuity', 0, 2.2, 25);
    near(s.rows[0].payment, L.amortize(1e6, 1.5, 240).rows[0].payment, 1e-9);
    near(s.rows[24].payment, L.amortize(s.rows[23].balance, 2.2, 216).rows[0].payment, 1e-9);
    assert.ok(s.rows[24].payment > s.rows[23].payment); assert.strictEqual(s.rows[239].balance, 0);
    assert.ok(s.totalInterest < L.amortize(1e6, 2.2, 240).totalInterest && s.totalInterest > L.amortize(1e6, 1.5, 240).totalInterest);
    // 欄位檢查
    assert.strictEqual(L.checkLoanPlan(240, 0, null, null), ''); assert.strictEqual(L.checkLoanPlan(240, 12, 2, 25), '');
    for (const a of [[240, 240, null, null], [240, -1, null, null], [240, 1.5, null, null], [240, 0, 2, null], [240, 0, null, 5], [240, 0, -1, 5], [240, 0, 2, 241], [240, 0, 2, 2.5]])
        assert.ok(L.checkLoanPlan(...a), 'plan ' + a);
    ok('loan-calculator 寬限期與分段利率');
    // 146：360 期 → 標題 + 360 列、5 欄，最後餘額 0
    const t = L.loanTable(L.amortizePlan(8e6, 2.2, 360).rows);
    assert.strictEqual(t.length, 361); assert.ok(t.every(r => r.length === 5)); assert.strictEqual(t[360][4], 0); assert.strictEqual(t[0][0], '期');
    assert.strictEqual(t[1].join('\t').split('\t').length, 5);
    ok('loan-calculator 逐期表匯出');
    // 131：還原驗證
    const defs = { p: '1000000', rate2: '', type: 'annuity', paid: '2026-03-15', nm: '信用卡' }, modes = ['loan', 'invest'];
    const good = L.cleanOpts({ mode: 'invest', v: { p: '500', rate2: '1.5', type: 'principal', paid: '2025-01-02', nm: 'x' }, sub: { debt: 'cc' } }, defs, modes);
    assert.deepStrictEqual(good.v, { p: '500', rate2: '1.5', type: 'principal', paid: '2025-01-02', nm: 'x' }); assert.strictEqual(good.mode, 'invest'); assert.strictEqual(good.sub.debt, 'cc');
    for (const bad of [null, 5, 'x', [], {}, { v: null }, { v: 5 }, { mode: 'zz', v: { p: 'abc', rate2: 'NaN', type: 5, paid: 'x', nm: 'x'.repeat(41) } }, { v: { p: '1e99', rate2: null, paid: '2025-13-99x' } }]) {
        const r = L.cleanOpts(bad, defs, modes);
        assert.strictEqual(r.mode, 'loan'); assert.deepStrictEqual(r.v, defs, JSON.stringify(bad));
    }
    assert.strictEqual(L.cleanOpts({ v: { p: '' } }, defs, modes).v.p, '');
    ok('loan-calculator cleanOpts');
}
{ // 132 / 147 split-bill 結算文字
    const S = load('utils/split-bill.html', 'settle, settleText, toCents');
    const people = ['小明', '小華', '阿美'], exps = [{ payer: '小明', amount: 90000, shares: people }];
    const r = S.settle(people, exps), t = S.settleText(people, r.net, r.transfers, 90000, (c) => (c / 100).toLocaleString('zh-TW')), L = t.split(String.fromCharCode(10));
    assert.deepStrictEqual(L.filter(l => l.includes('→')), ['小華 → 小明：NT$ 300', '阿美 → 小明：NT$ 300']);
    assert.ok(L[0].includes('900') && t.includes('小明 可收回 NT$ 600') && t.includes('小華 應付 NT$ 300'));
    const z = S.settle(['a', 'b'], []); assert.ok(S.settleText(['a', 'b'], z.net, z.transfers, 0, String).includes('已結清') && !S.settleText(['a', 'b'], z.net, z.transfers, 0, String).includes('→'));
    ok('split-bill settleText');
}
{ // 133 / 144 income-tax
    const T = load('utils/income-tax.html', 'TAX, sanitize, computeTax, taxSummary');
    const base = { salary: 900000 }, a = T.computeTax(base), b = T.computeTax({ ...base, preschool: 1 });
    assert.strictEqual(a.net - b.net, 150000); assert.strictEqual(a.tax - b.tax, Math.round(150000 * a.marginal));
    assert.strictEqual(T.computeTax({ ...base, preschool: 2 }).net, a.net - 150000 - 225000);
    const l = T.computeTax({ ...base, ltc: 1 }); assert.strictEqual(a.net - l.net, 180000);
    const r = T.computeTax({ ...base, rent: 300000 }); assert.strictEqual(a.net - r.net, 180000);          // 上限 18 萬
    assert.strictEqual(a.net - T.computeTax({ ...base, rent: 100000 }).net, 100000);
    const rich = T.computeTax({ salary: 3000000, rent: 100000, ltc: 1 }), rich0 = T.computeTax({ salary: 3000000 });
    assert.ok(rich.rlOut && rich.net === rich0.net && rich.rentDed === 0 && rich.ltcDed === 0);                // 排富
    assert.deepStrictEqual(T.sanitize({ salary: 5 }).rent, 0); assert.strictEqual(T.sanitize({ rent: 'x', preschool: -1, ltc: 1e9 }).ltc, 30);
    assert.strictEqual(T.computeTax({ salary: 900000, dedMode: 'std' }).tax, 22700);
    const s = T.taxSummary(T.sanitize({ salary: 900000 }), a);
    assert.ok(s.includes('應納稅額（概算）：22,700') && s.includes('免責') && s.includes('薪資 900,000'));
    ok('income-tax 三項特別扣除與摘要');
}
{ // 134 regex-tester 錯誤中文化
    const R = load('utils/regex-tester.html', 'findMatches, zhRegexError');
    const err = (src, fl = '') => R.findMatches(src, fl, 'x').error;
    assert.ok(err('([a-').includes('字元集合') && !err('([a-').startsWith('Invalid'), err('([a-'));
    assert.ok(err('(a').includes('括號'), err('(a')); assert.ok(err('*a').includes('沒有可以重複'), err('*a'));
    assert.ok(err('a', 'gz').includes('旗標'), err('a', 'gz')); assert.ok(err('a)').includes('右括號'), err('a)'));
    assert.ok(err('a', 'gg').includes('旗標'));
    assert.strictEqual(R.zhRegexError('Something else'), 'Something else');
    ok('regex-tester zhRegexError');
}
{ // 151 lottery-check 今彩 539
    const Lc = load('utils/lottery-check.html', 'prize539, parse539');
    const w = Lc.parse539('01 05 12 20 39').nums;
    assert.strictEqual(Lc.prize539(Lc.parse539('01 05 12 20 38').nums, w).name, '貳獎');
    assert.strictEqual(Lc.prize539(w, w).name, '頭獎'); assert.strictEqual(Lc.prize539([1, 5, 12, 30, 31], w).name, '參獎');
    assert.strictEqual(Lc.prize539([1, 5, 30, 31, 32], w).name, '肆獎'); assert.strictEqual(Lc.prize539([1, 30, 31, 32, 33], w), null);
    for (const bad of ['', 'a b c d e', '1 1 2 3 4', '0 1 2 3 4', '1 2 3 4 40', '1 2 3 4', '1 2 3 4 5 6']) assert.ok(Lc.parse539(bad).err, bad);
    ok('lottery-check 539');
}
{ // 152 / 153 unit-converter 壓力 / 能量 / 功率 / 油耗
    const U = load('utils/unit-converter.html', 'convertAll');
    const g = (cat, v, from, u) => U.convertAll(cat, v, from).find(r => r.unit === u).value, near2 = (a, b, e) => assert.ok(Math.abs(a - b) <= e, a + ' ' + b);
    near2(g('壓力', 1, 'atm', 'kPa'), 101.325, 1e-9); near2(g('壓力', 1, 'atm', 'psi'), 14.696, 0.001); near2(g('壓力', 1, 'bar', 'kPa'), 100, 1e-9);
    near2(g('能量', 1, 'kcal', 'kJ'), 4.184, 1e-9); near2(g('能量', 1, 'kWh', 'Wh'), 1000, 1e-9);
    near2(g('功率', 1, 'kW', '英制馬力'), 1.341, 0.001); near2(g('功率', 1, '公制馬力', 'W'), 735.49875, 1e-6);
    near2(g('油耗', 10, 'km/L', 'L/100km'), 10, 1e-9); near2(g('油耗', 10, 'km/L', 'mpg(US)'), 23.52, 0.005); near2(g('油耗', 10, 'km/L', 'mpg(UK)'), 28.25, 0.005);
    near2(g('油耗', 23.52, 'mpg(US)', 'km/L'), 10, 0.001); near2(g('油耗', 5, 'L/100km', 'km/L'), 20, 1e-9);
    for (const v of [0, -3, NaN]) U.convertAll('油耗', v, 'km/L').forEach(r => assert.ok(Number.isNaN(r.value) && r.value !== Infinity, '無效 ' + v));
    ok('unit-converter 壓力能量功率油耗');
}
{ // 154 image-resize 批次
    const I = load('utils/image-resize.html', 'batchPick, uniqueNames, BATCH_MAX');
    const mk = (n, size = 1000) => Array.from({ length: n }, (_, i) => ({ name: 'f' + i + '.jpg', size }));
    assert.strictEqual(I.batchPick(mk(30)).ok.length, 30); assert.deepStrictEqual(I.batchPick(mk(30)).notes, []);
    const r31 = I.batchPick(mk(31)); assert.strictEqual(r31.ok.length, 30); assert.ok(r31.notes[0].includes('最多 30 張'));
    const big = I.batchPick([{ name: 'big.jpg', size: 31 * 1048576 }, ...mk(1)]); assert.strictEqual(big.ok.length, 1); assert.ok(big.notes[0].includes('30 MB'));
    const tot = I.batchPick(mk(20, 20 * 1048576)); assert.strictEqual(tot.ok.length, 15); assert.ok(tot.notes[0].includes('300 MB'));
    assert.deepStrictEqual(I.uniqueNames(['a.webp', 'A.webp', 'b.webp', 'a.webp', 'c']), ['a.webp', 'A-2.webp', 'b.webp', 'a-3.webp', 'c']);
    ok('image-resize batchPick');
}
{ // 168 net-calc VLSM
    const N = load('utils/net-calc.html', 'parseCidr, cidrInfo, vlsm, parseVlsm, ipv4Str');
    const c = N.parseCidr('192.168.1.0/24'), r = N.vlsm(c, N.parseVlsm('A 100\nB 50\nC 20\nD 2').items);
    assert.strictEqual(r.error, ''); assert.deepStrictEqual(r.rows.map(x => x.prefix), [25, 26, 27, 30]); assert.deepStrictEqual(r.rows.map(x => x.name), ['A', 'B', 'C', 'D']);
    const I = N.cidrInfo(c);
    r.rows.forEach((x, k) => { assert.ok(x.net >= I.net && x.net + x.size - 1n <= I.last, '在母網段內'); if (k) { const p = r.rows[k - 1]; assert.ok(p.net + p.size <= x.net, '不重疊'); } });
    assert.strictEqual(r.rows[0].net, I.net); assert.strictEqual(r.free, 256n - 128n - 64n - 32n - 4n);
    assert.strictEqual(N.ipv4Str(Number(r.rows[3].net)), '192.168.1.224'); assert.strictEqual(N.ipv4Str(Number(r.rows[3].last)), '192.168.1.226');
    // 輸入順序不影響（由大到小），同大小維持輸入順序
    assert.deepStrictEqual(N.vlsm(c, N.parseVlsm('D 2\nC 20\nA 100\nB 50').items).rows.map(x => x.name), ['A', 'B', 'C', 'D']);
    // 空間不足
    const big = N.vlsm(c, N.parseVlsm('A 100\nB 100\nC 10').items); assert.ok(big.error.includes('空間不足'), big.error);
    assert.ok(N.vlsm(c, N.parseVlsm('A 300').items).error.includes('空間不足'));
    assert.ok(N.vlsm(N.parseCidr('2001:db8::/32'), [{ name: 'a', hosts: 1 }]).error.includes('IPv4'));
    // 解析
    assert.strictEqual(N.parseVlsm('abc').error.includes('第 1 行'), true); assert.ok(N.parseVlsm('x 0').error); assert.ok(N.parseVlsm('x 5000000000').error);
    assert.ok(N.parseVlsm(Array.from({ length: 51 }, () => '2').join('\n')).error.includes('最多')); assert.strictEqual(N.parseVlsm('10').items[0].name, '子網 1');
    assert.strictEqual(N.parseVlsm('/30 sub, 4').items[0].hosts, 4);
    ok('net-calc vlsm');
}
