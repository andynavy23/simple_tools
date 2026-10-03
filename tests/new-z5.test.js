// 批次 z5：stock-cost 股票成本試算、workout-log 重訓記錄、sleep-log 睡眠記錄
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- stock-cost ----------
    const m = load('utils/stock-cost.html', 'DEFAULTS, MODES, cleanOpts, withMode, roundBy, feeOf, taxOf, trade, breakEven, dividend, avgCost, MAX_BATCH');
    const D = m.DEFAULTS, fl = D, rd = { ...D, round: 'round' };
    // 手算：買 100 × 1000 股 = 100,000；手續費 142.5 → 捨去 142 / 四捨五入 143；賣 110,000 → 156.75 → 156 / 157；稅 330
    let t = m.trade(100, 110, 1, fl);
    assert.deepStrictEqual([t.buyAmt, t.buyFee, t.sellAmt, t.sellFee, t.tax, t.net], [100000, 142, 110000, 156, 330, 10000 - 142 - 156 - 330]);
    assert.equal(t.net, 9372); assert.equal(t.costs, 628); assert.equal(t.invested, 100142);
    t = m.trade(100, 110, 1, rd);
    assert.deepStrictEqual([t.buyFee, t.sellFee, t.tax, t.net], [143, 157, 330, 9370]);
    assert.ok(Math.abs(t.roi - 9370 / 100143 * 100) < 1e-9);
    // 最低手續費：買 10 元 100 股 = 1000 元 → 1.4 元 → 現股最低 20；零股最低 1
    const odd = m.withMode(D, 'odd');
    assert.deepStrictEqual([odd.minFee, odd.unit, odd.taxRate], [1, 'share', 0.3]);
    assert.equal(m.feeOf(1000, fl), 20); assert.equal(m.feeOf(1000, odd), 1);
    assert.equal(m.feeOf(0, fl), 0);
    t = m.trade(10, 12, 100, odd); // 零股 100 股：買 1000 賣 1200；手續費 1 / 1；稅 3.6 → 3
    assert.deepStrictEqual([t.shares, t.buyFee, t.sellFee, t.tax, t.net], [100, 1, 1, 3, 1200 - 1 - 3 - 1001]);
    // 當沖稅 0.15%、ETF 0.1%
    const day = m.withMode(D, 'day'), etf = m.withMode(D, 'etf');
    assert.equal(m.taxOf(110000, day), 165); assert.equal(m.taxOf(110000, etf), 110); assert.equal(m.taxOf(110000, fl), 330);
    // 折扣：2.8 折 → 142.5 × 0.28 = 39.9（捨去 39；四捨五入 40）；高於最低 20
    assert.equal(m.feeOf(100000, { ...fl, discount: 2.8 }), 39); assert.equal(m.feeOf(100000, { ...rd, discount: 2.8 }), 40);
    // 折扣後低於最低：10 萬 × 0.1425% × 1 折 = 14.25 → 20
    assert.equal(m.feeOf(100000, { ...fl, discount: 1 }), 20);
    // 浮點雜訊：142.49999999 不可因此少 1 或多 1
    assert.equal(m.roundBy(142.5, 'round'), 143); assert.equal(m.roundBy(0.1425 * 1000, 'floor'), 142);
    // 虧損與無效輸入
    t = m.trade(100, 90, 1, fl); assert.ok(t.net < 0 && t.roi < 0);
    assert.equal(m.trade(0, 1, 1, fl), null); assert.equal(m.trade(100, 1, 0, fl), null); assert.equal(m.trade(NaN, 1, 1, fl), null); assert.equal(m.trade(100, -1, 1, fl), null);
    // 損益平衡價：代回淨損益必須 ≥ 0 且 ≤ 1 元左右（金額四捨五入造成的上跳）；再小一點就必為負
    let n = 0;
    for (const base of [fl, rd, odd, day, etf, { ...fl, discount: 2.8 }, { ...rd, discount: 6, minFee: 0 }, { ...fl, feeRate: 0, taxRate: 0, minFee: 0 }])
        for (const [buy, qty] of [[100, 1], [28.35, 3], [550, 1], [12.4, 7], [1.5, 100], [3000, 0.2], [45.6, 10], [19.9, 2]])
            for (const unit of ['lot', 'share']) {
                const o = { ...base, unit }, shares = unit === 'lot' ? qty * 1000 : qty;
                if (!(shares >= 1)) continue;
                const be = m.breakEven(buy, shares, o), r = m.trade(buy, be, qty, o);
                assert.ok(r.net >= 0 && r.net <= 1.0001, `net=${r.net} buy=${buy} qty=${qty} ${unit}`);
                const below = m.trade(buy, be - 1e-6 * Math.max(1, 1000 / shares), qty, o);
                assert.ok(below.net < 0 || be - 1e-6 < 1e-6, 'below be is negative');
                n++;
            }
    assert.ok(n > 50);
    // 損益平衡價手算：100 元 1000 股（捨去）：成本 100142；賣 p：p×1000 − 手續費 − 0.3% ≥ 100142 → 約 100.57 附近
    const be = m.breakEven(100, 1000, fl); assert.ok(be > 100.5 && be < 100.6, be);
    const rt = m.trade(100, Math.ceil(be * 100) / 100, 1, fl); assert.ok(rt.net >= 0);
    // 股利：3 元 × 10000 股 = 30000 ≥ 20000 → 補充保費 633（30000 × 2.11% = 633）；殖利率以買價
    let d = m.dividend(3, 10000, 100, fl);
    assert.deepStrictEqual([d.cash, d.nhi, d.net], [30000, 633, 29367]); assert.equal(d.yieldPct, 3);
    d = m.dividend(1.9, 10000, 100, fl); assert.equal(d.cash, 19000); assert.equal(d.nhi, 0); // 未達 20000
    d = m.dividend(2, 10000, 100, fl); assert.equal(d.nhi, 422); // 剛好 20000：20000 × 2.11% = 422
    d = m.dividend(2, 10000, 100, { ...fl, nhiRate: 5, nhiMin: 30000 }); assert.equal(d.nhi, 0);
    assert.equal(m.dividend(2, 10000, 0, fl).yieldPct, null); assert.equal(m.dividend(-1, 10, 1, fl), null); assert.equal(m.dividend(1, 0, 1, fl), null);
    // 平均成本：100×1000 + 90×1000 + 手續費 142 + 128（90000×0.001425=128.25 → 128）
    const a = m.avgCost([{ price: 100, qty: 1 }, { price: 90, qty: 1 }], fl);
    assert.equal(a.shares, 2000); assert.equal(a.total, 100000 + 142 + 90000 + 128); assert.equal(a.avg, 190270 / 2000); assert.equal(a.count, 2);
    assert.equal(m.avgCost([{ price: NaN, qty: 1 }, { price: 10, qty: 0 }], fl), null);
    assert.equal(m.avgCost([{ price: 10, qty: 100 }, { price: 'x', qty: 1 }], odd).count, 1);
    // 上限 20 批：超過的不算
    const many = Array.from({ length: 30 }, () => ({ price: 10, qty: 1000 }));
    assert.equal(m.avgCost(many, odd).count, 20); assert.equal(m.MAX_BATCH, 20);
    // 偏好設定載入驗證
    assert.deepStrictEqual(m.cleanOpts(null), D); assert.deepStrictEqual(m.cleanOpts('x'), D); assert.deepStrictEqual(m.cleanOpts([]), D);
    const c = m.cleanOpts({ mode: 'etf', unit: 'share', discount: 99, feeRate: '0.1', minFee: -1, taxRate: 0.1, round: 'ceil', nhiRate: NaN, nhiMin: 5000 });
    assert.deepStrictEqual(c, { ...D, mode: 'etf', unit: 'share', taxRate: 0.1, nhiMin: 5000 });
    assert.equal(m.cleanOpts({ mode: 'bad' }).mode, 'stock');
    assert.equal(m.cleanOpts({ discount: 0 }).discount, 10); assert.equal(m.cleanOpts({ discount: 2.8 }).discount, 2.8);
    ok('stock-cost: 手續費 / 稅 / 零股 / 當沖 / ETF / 折扣 / 進位 / 損益平衡 / 股利 / 平均成本 / 載入驗證');
}

{ // ---------- workout-log ----------
    const m = load('fun/workout-log.html', 'BUILTIN, e1rm, entryStats, chrono, prFlags, bests, trend, weeklyVolume, cleanEntry, cleanLog, cleanMoves, cleanPrefs, pruneOlder, dispW, toKg, entryText, MAX_LOG, MAX_SETS, MAX_CUSTOM');
    assert.equal(m.BUILTIN.length, 30); assert.equal(new Set(m.BUILTIN.map(b => b.id)).size, 30);
    assert.ok(m.BUILTIN.every(b => b.zh && b.en)); assert.ok(['深蹲', '硬舉', '臥推', '肩推', '划船機', '引體向上'].every(z => m.BUILTIN.some(b => b.zh === z)));
    // 1RM：Epley 100×5 = 116.666…；Brzycki 100×5 = 3600/32 = 112.5；reps=1 取實際重量
    assert.ok(Math.abs(m.e1rm(100, 5) - 116.6666667) < 1e-6); assert.equal(m.e1rm(100, 5, 'brzycki'), 112.5);
    assert.equal(m.e1rm(140, 1), 140); assert.equal(m.e1rm(140, 1, 'brzycki'), 140);
    assert.equal(m.e1rm(100, 10), 100 * (1 + 10 / 30)); assert.equal(m.e1rm(0, 5), 0); assert.equal(m.e1rm(100, 0), 0); assert.equal(m.e1rm(NaN, 3), 0);
    assert.equal(m.e1rm(100, 50, 'brzycki'), 3600);
    const E = (id, d, mv, s) => ({ id, d, m: mv, s, n: '', rpe: null });
    // entryStats：100×5 + 110×3 → maxW 110、maxR 5、volume 500+330；e1rm = 110×1.1 = 121 > 116.67
    const st = m.entryStats(E('a', '2026-01-01', 'squat', [[100, 5], [110, 3]]), 'epley');
    assert.deepStrictEqual([st.maxW, st.maxR, st.vol], [110, 5, 830]); assert.ok(Math.abs(st.e1rm - 121) < 1e-9, st.e1rm);
    // PR：第一筆不標；之後嚴格超越才標；別的動作不互相影響
    const log = [E('3', '2026-01-10', 'squat', [[100, 5]]), E('1', '2026-01-01', 'squat', [[100, 5]]), E('2', '2026-01-05', 'squat', [[100, 6]]), E('x', '2026-01-06', 'bench', [[200, 1]]), E('4', '2026-01-20', 'squat', [[90, 12]])];
    const fl = m.prFlags(log, 'squat', 'epley');
    assert.deepStrictEqual(Object.keys(fl).sort(), ['2', '4']); assert.deepStrictEqual(fl['2'], { w: false, e: true, r: true });
    assert.deepStrictEqual(fl['4'], { w: false, e: true, r: true }); // 90×12：e1rm 126 > 120
    const b = m.bests(log, 'squat', 'epley'); assert.deepStrictEqual([b.w, b.r, b.count], [100, 12, 4]);
    // 重量 PR：更重才標 w；持平不標
    const l2 = [E('a', '2026-02-01', 'dl', [[100, 5]]), E('b', '2026-02-02', 'dl', [[100, 5]]), E('c', '2026-02-03', 'dl', [[120, 1]])];
    assert.deepStrictEqual(m.prFlags(l2, 'dl', 'epley'), { c: { w: true, e: true, r: false } });
    // 趨勢：最近 12 次、由舊到新
    const many = Array.from({ length: 15 }, (_, i) => E('t' + i, `2026-03-${String(i + 1).padStart(2, '0')}`, 'squat', [[100 + i, 5]]));
    const tr = m.trend(many, 'squat', 'epley'); assert.equal(tr.length, 12); assert.equal(tr[0].d, '2026-03-04'); assert.equal(tr[11].d, '2026-03-15');
    // 週統計：週一起算。2026-10-03 是週六 → 本週一 2026-09-28
    const wk = m.weeklyVolume([E('a', '2026-09-28', 'squat', [[100, 5]]), E('b', '2026-10-03', 'squat', [[50, 10]]), E('c', '2026-09-27', 'squat', [[10, 10]]), E('d', '2026-10-01', 'bench', [[99, 9]]), E('e', '2020-01-01', 'squat', [[1, 1]])], '2026-10-03', 'squat', 8);
    assert.equal(wk.length, 8); assert.equal(wk[7].wk, '2026-09-28'); assert.equal(wk[7].vol, 1000); assert.equal(wk[6].wk, '2026-09-21'); assert.equal(wk[6].vol, 100);
    assert.equal(m.weeklyVolume([E('d', '2026-10-01', 'bench', [[99, 9]])], '2026-10-03', '', 2)[1].vol, 891);
    assert.equal(m.weeklyVolume([], '2026-10-04', '', 1)[0].wk, '2026-09-28'); // 週日仍屬同一週
    // 清理
    assert.equal(m.cleanEntry(null), null); assert.equal(m.cleanEntry({ id: 'a', d: '2026-1-1', m: 'x', s: [[1, 1]] }), null);
    assert.equal(m.cleanEntry({ id: 'a', d: '2026-01-01', m: 'x', s: [[1, 1.5], [-1, 1], ['a', 1], null, [5, 0]] }), null, '全是壞組 → 丟棄');
    const ce = m.cleanEntry({ id: 'a', d: '2026-01-01', m: 'x', s: [[1.23456, 3], null, [5, 0], [60, 8]], n: 'y'.repeat(500), rpe: 11 });
    assert.deepStrictEqual(ce.s, [[1.235, 3], [60, 8]]); assert.equal(ce.n.length, 200); assert.equal(ce.rpe, null);
    assert.equal(m.cleanEntry({ id: 'a', d: '2026-01-01', m: 'x', s: [[1, 1]], rpe: 8.5 }).rpe, 8.5);
    assert.equal(m.cleanEntry({ id: 'a', d: '2026-01-01', m: 'x', s: Array.from({ length: 60 }, () => [10, 5]) }).s.length, 40);
    assert.equal(m.cleanLog([E('a', '2026-01-01', 'x', [[1, 1]]), E('a', '2026-01-02', 'x', [[1, 1]]), null, 5, { id: 1 }]).length, 1);
    assert.deepStrictEqual(m.cleanLog('bad'), []); assert.deepStrictEqual(m.cleanLog(null), []);
    assert.equal(m.cleanLog(Array.from({ length: 5100 }, (_, i) => E('i' + i, '2026-01-01', 'x', [[1, 1]]))).length, 5000);
    // 自訂動作：不可與內建 id 重複、名稱必填、上限 50
    const cm = m.cleanMoves([{ id: 'squat', zh: '假深蹲' }, { id: 'c1', zh: ' 啞鈴划船 ', en: 5 }, { id: 'c1', zh: '重複' }, { id: 'c2', zh: '  ' }, null, { id: 'c3', zh: 'z'.repeat(80), en: 'Q' }]);
    assert.deepStrictEqual(cm.map(x => x.id), ['c1', 'c3']); assert.equal(cm[0].zh, '啞鈴划船'); assert.equal(cm[0].en, ''); assert.equal(cm[1].zh.length, 30);
    assert.equal(m.cleanMoves(Array.from({ length: 80 }, (_, i) => ({ id: 'c' + i, zh: 'n' + i }))).length, 50); assert.deepStrictEqual(m.cleanMoves({}), []);
    assert.deepStrictEqual(m.cleanPrefs(null), { lb: false, formula: 'epley' }); assert.deepStrictEqual(m.cleanPrefs({ lb: 1, formula: 'brzycki' }), { lb: true, formula: 'brzycki' }); assert.equal(m.cleanPrefs({ formula: 'x' }).formula, 'epley');
    // 一年前：2026-10-03 起算，保留 2025-10-03（含）之後
    assert.deepStrictEqual(m.pruneOlder([E('a', '2025-10-02', 'x', [[1, 1]]), E('b', '2025-10-03', 'x', [[1, 1]])], '2026-10-03').map(e => e.id), ['b']);
    // kg / lb
    assert.equal(m.dispW(100, true), 220.5); assert.equal(m.dispW(100, false), 100); assert.equal(m.toKg(220.462, true), 100); assert.equal(m.toKg(80, false), 80);
    assert.equal(m.entryText({ d: '2026-01-01', s: [[100, 5], [60, 8]], rpe: 8, n: '好' }, '深蹲', false), '2026-01-01 深蹲\n1. 100kg × 5\n2. 60kg × 8\nRPE 8\n好');
    ok('workout-log: 1RM / PR / 趨勢 / 週統計 / 清理驗證 / 上限 / 單位');
}

{ // ---------- sleep-log ----------
    const m = load('fun/sleep-log.html', 'toMin, fmtMin, bedDate, durMin, cleanEntry, cleanSleep, cleanGoal, circMean, circSd, recent, summary, regularity, sleepDebt, lastDays, pruneOlder, MAX_LOG');
    // 時長：跨午夜、同日、整夜
    assert.equal(m.durMin('2026-10-03', '23:00', '07:00'), 480); assert.equal(m.bedDate('2026-10-03', '23:00', '07:00'), '2026-10-02');
    assert.equal(m.durMin('2026-10-03', '00:30', '07:30'), 420); assert.equal(m.bedDate('2026-10-03', '00:30', '07:30'), '2026-10-03');
    assert.equal(m.durMin('2026-10-03', '23:30', '06:30'), 420); assert.equal(m.durMin('2026-10-03', '07:00', '07:00'), 0);
    assert.equal(m.durMin('2026-10-03', '14:00', '15:30'), 90); assert.equal(m.durMin('2026-01-01', '23:59', '00:00'), 1);
    // 跨月跨年與夏令切換日不受影響（純字串運算）：美國 2026-03-08 夏令開始、歐洲 2026-10-25 結束，睡 8 小時仍是 480
    assert.equal(m.durMin('2026-03-08', '23:00', '07:00'), 480); assert.equal(m.durMin('2026-10-25', '23:00', '07:00'), 480);
    assert.equal(m.bedDate('2026-01-01', '23:00', '07:00'), '2025-12-31'); assert.equal(m.bedDate('2026-03-01', '23:00', '07:00'), '2026-02-28');
    // 圓周平均
    assert.equal(m.circMean([m.toMin('23:30'), m.toMin('00:30')]), 0); assert.equal(m.fmtMin(m.circMean([1410, 30])), '00:00');
    assert.equal(m.fmtMin(m.circMean([m.toMin('23:00'), m.toMin('01:00'), m.toMin('00:00')])), '00:00');
    assert.equal(m.fmtMin(m.circMean([m.toMin('22:00'), m.toMin('23:00')])), '22:30'); assert.equal(m.fmtMin(m.circMean([m.toMin('07:00')])), '07:00');
    assert.equal(m.fmtMin(m.circMean([m.toMin('23:50'), m.toMin('00:10'), m.toMin('00:20')])), '00:07');
    assert.equal(m.circMean([0, 720]), null); assert.equal(m.circMean([]), null);
    // 標準差：23:30 / 00:30 → 30；全相同 → 0；單筆 0；空 null
    assert.ok(Math.abs(m.circSd([1410, 30]) - 30) < 1e-9); assert.equal(m.circSd([420, 420, 420]), 0); assert.equal(m.circSd([420]), 0); assert.equal(m.circSd([]), null);
    assert.ok(Math.abs(m.circSd([60, 120, 180]) - Math.sqrt(2 / 3 * 3600)) < 1e-9);
    assert.equal(m.regularity(10), '規律'); assert.equal(m.regularity(30), '規律'); assert.equal(m.regularity(45), '普通'); assert.equal(m.regularity(90), '不規律'); assert.equal(m.regularity(null), '—');
    // 統計與睡眠債：今天 2026-10-03
    const R = (d, bt, wt, q = 3) => ({ d, bt, wt, q, n: '' });
    const recs = [R('2026-10-03', '23:30', '06:30'), R('2026-10-02', '00:30', '07:30'), R('2026-09-30', '23:00', '07:00', 5), R('2026-09-26', '23:00', '05:00'), R('2026-09-20', '22:00', '06:00')];
    assert.equal(m.recent(recs, '2026-10-03', 7).length, 3, '7 天：10/3 ~ 9/27'); assert.equal(m.recent(recs, '2026-10-03', 14).length, 5, '14 天：10/3 ~ 9/20');
    assert.equal(m.recent(recs, '2026-10-03', 30).length, 5);
    assert.equal(m.recent([R('2026-10-05', '23:00', '07:00')], '2026-10-03', 7).length, 0, '未來日期不算');
    const s7 = m.summary(recs, '2026-10-03', 7);
    assert.equal(s7.count, 3); assert.ok(Math.abs(s7.avgDur - (420 + 420 + 480) / 3) < 1e-9); assert.equal(s7.avgQ, 11 / 3);
    assert.equal(m.fmtMin(s7.avgWake), '07:00'); assert.equal(m.fmtMin(s7.avgBed), '23:40'); // 23:30、00:30、23:00 → 離午夜 -30、+30、-60 分，平均 -20
    assert.equal(m.summary(recs, '2026-01-01', 7), null);
    // 睡眠債（目標 8 小時 = 480）：420 + 420 + 480 → 60 + 60 + 0 = 120 分
    assert.deepStrictEqual(m.sleepDebt(recs, '2026-10-03', 8), { debt: 120, nights: 3 });
    assert.deepStrictEqual(m.sleepDebt(recs, '2026-10-03', 7), { debt: -60, nights: 3 }); // 盈餘
    assert.deepStrictEqual(m.sleepDebt([], '2026-10-03', 8), { debt: 0, nights: 0 });
    // 近 14 天
    const ld = m.lastDays(recs, '2026-10-03'); assert.equal(ld.length, 14); assert.equal(ld[13].d, '2026-10-03'); assert.equal(ld[13].mins, 420); assert.equal(ld[0].d, '2026-09-20'); assert.equal(ld[0].mins, 480); assert.equal(ld[12].d, '2026-10-02'); assert.equal(ld[1].mins, null);
    // 清理驗證：壞時間、同日重複（留最後）、品質補預設、截到上限
    assert.equal(m.cleanEntry(null), null); assert.equal(m.cleanEntry({ d: '2026-10-03', bt: '25:00', wt: '07:00' }), null); assert.equal(m.cleanEntry({ d: '2026-10-03', bt: '7:00', wt: '07:00' }), null);
    assert.equal(m.cleanEntry({ d: '2026-10-03', bt: '07:00', wt: '07:00' }), null, '時長 0 無效'); assert.equal(m.cleanEntry({ d: 'x', bt: '23:00', wt: '07:00' }), null);
    assert.deepStrictEqual(m.cleanEntry({ d: '2026-10-03', bt: '23:00', wt: '07:00', q: 9, n: 5 }), { d: '2026-10-03', bt: '23:00', wt: '07:00', q: 3, n: '' });
    assert.equal(m.cleanEntry({ d: '2026-10-03', bt: '23:00', wt: '07:00', q: 4, n: 'z'.repeat(300) }).n.length, 200);
    const cs = m.cleanSleep([R('2026-10-01', '23:00', '07:00'), R('2026-10-03', '23:00', '07:00'), R('2026-10-01', '22:00', '06:00'), null, 7, { d: '2026-10-02' }]);
    assert.deepStrictEqual(cs.map(e => e.d), ['2026-10-03', '2026-10-01']); assert.equal(cs[1].bt, '22:00');
    assert.deepStrictEqual(m.cleanSleep('x'), []); assert.deepStrictEqual(m.cleanSleep(null), []);
    const big = Array.from({ length: 4000 }, (_, i) => R(require('../shared/js/util.js').day.shift('2026-10-03', -i), '23:00', '07:00'));
    const cb = m.cleanSleep(big); assert.equal(cb.length, 3650); assert.equal(cb[0].d, '2026-10-03'); assert.equal(m.MAX_LOG, 3650);
    assert.equal(m.cleanGoal(8), 8); assert.equal(m.cleanGoal(5), 5); assert.equal(m.cleanGoal(12), 12); assert.equal(m.cleanGoal(4.5), 8); assert.equal(m.cleanGoal(13), 8); assert.equal(m.cleanGoal('9'), 8); assert.equal(m.cleanGoal(NaN), 8); assert.equal(m.cleanGoal(null), 8); assert.equal(m.cleanGoal(7.5), 7.5);
    assert.deepStrictEqual(m.pruneOlder([R('2025-10-02', '23:00', '07:00'), R('2025-10-03', '23:00', '07:00')], '2026-10-03').map(e => e.d), ['2025-10-03']);
    ok('sleep-log: 跨午夜時長 / 圓周平均 / 標準差 / 睡眠債 / 近 14 天 / 清理驗證 / 上限');
}
