// 批次 sim：抽獎 / 機率類工具的「模擬」純邏輯（lottery-check、artale-calc、dice、wheel）與 Util.runChunks
const { load, ok, near } = require('./_load');
const assert = require('assert');
const seeded = Util.seeded;

(async () => {
    // ---- Util.runChunks：分批、可中止、不重複、中止後不再執行 ----
    {
        let seen = 0, calls = 0, ticks = 0;
        await new Promise(res => Util.runChunks(5000, (a, b) => { assert.equal(a, seen); seen = b; calls++; }, { onProgress: () => ticks++, onDone: (c) => { assert.equal(c, false); res(); } }));
        assert.equal(seen, 5000); assert.ok(calls >= 25 && ticks >= 1);
        let n = 0, doneFlag = null;
        const h = Util.runChunks(1e9, (a, b) => { n = b; }, { ms: 5, onDone: (c) => { doneFlag = c; } });
        await new Promise(r => setTimeout(r, 40)); h.cancel(); const at = n; await new Promise(r => setTimeout(r, 40));
        assert.equal(doneFlag, true); assert.equal(n, at); assert.ok(at > 0 && at < 1e9);
    }

    // ---- lottery-check ----
    {
        const m = load('utils/lottery-check.html', 'SIM_GAMES, simProbs, simOnce, newSim, simSummary, parseTicket, bigPrize, bigTier, powerPrize, powerTier, choose, tier539, sampleK');
        // 理論機率加總為 1（發票為近似，只檢查小於 1）
        for (const k of ['big', 'pw', 'd5']) {
            const pr = m.simProbs(k), tierSum = Object.values(pr).reduce((a, b) => a + b, 0);
            assert.ok(tierSum > 0 && tierSum < 1, k);
            assert.deepEqual(Object.keys(pr).sort(), Object.keys(m.SIM_GAMES[k].amt).sort(), k + ' 獎項名稱與獎金表一致');
        }
        near(m.simProbs('big')['頭獎'], 1 / 13983816);
        near(m.simProbs('pw')['頭獎'], 1 / (2760681 * 8)); near(m.simProbs('d5')['頭獎'], 1 / 575757);
        near(m.simProbs('d5')['肆獎'], 10 * 5984 / 575757);
        // 拆出的 tier 函式與原本的判定一致
        assert.equal(m.bigPrize([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6], 7), '頭獎'); assert.equal(m.bigPrize([1, 2, 3, 4, 5, 7], [1, 2, 3, 4, 5, 6], 7), '貳獎'); assert.equal(m.bigTier(2, true), '柒獎'); assert.equal(m.bigTier(1, true), null);
        assert.equal(m.powerPrize([1, 2, 3, 4, 5, 6], 3, [1, 2, 3, 4, 5, 6], 3), '頭獎'); assert.equal(m.powerTier(1, true), '普獎'); assert.equal(m.powerTier(1, false), null);
        // 固定種子可重現、不同種子不同
        const run = (k, seed, n, fixed) => { const s = m.newSim(k, seeded(seed), fixed || null, NaN); s.step(n); return JSON.stringify([s.counts, s.prize]); };
        assert.equal(run('d5', 'abc', 20000), run('d5', 'abc', 20000)); assert.notEqual(run('d5', 'abc', 20000), run('d5', 'abd', 20000));
        // 分批執行與一次執行結果相同
        { const a = m.newSim('big', seeded('x'), null, NaN); a.step(3000); const b = m.newSim('big', seeded('x'), null, NaN); b.step(1000); b.step(2000); assert.equal(JSON.stringify(a.counts), JSON.stringify(b.counts)); }
        // 539 十萬期：各獎次數落在理論值 ±5 標準差內（隨機、小次數驗證分布合理）
        {
            const N = 100000, s = m.newSim('d5', seeded('dist'), null, NaN); s.step(N); const r = m.simSummary(s);
            assert.equal(r.n, N); assert.equal(r.cost, N * 50);
            for (const x of r.rows.slice(1)) { const sd = Math.sqrt(N * x.p * (1 - x.p)); assert.ok(Math.abs(x.count - x.expected) <= 5 * sd + 1, `${x.name} ${x.count} vs ${x.expected}`); }
            assert.equal(r.prize, r.rows.reduce((a, x) => a + x.count * x.amount, 0));
            assert.ok(r.rtp < 1 && r.theoryRtp > 0.3 && r.theoryRtp < 0.9, '539 長期報酬率低於 100%：' + r.theoryRtp);
            assert.equal(r.net, r.prize - r.cost);
        }
        // 大樂透 / 威力彩：固定號碼模擬、頭獎假設值可調、理論報酬率低於 100%
        {
            const fx = m.parseTicket('big', '03 12 18 25 33 47'); assert.deepEqual(fx.nums, [3, 12, 18, 25, 33, 47]);
            const s = m.newSim('big', seeded('f'), fx, 123456789); assert.equal(s.amt['頭獎'], 123456789); s.step(50000);
            const r = m.simSummary(s); assert.ok(r.theoryRtp < 1); assert.equal(r.cost, 50000 * 50);
            assert.equal(m.newSim('d5', seeded('f'), null, 5).amt['頭獎'], 8000000, '539 頭獎固定，不受假設值影響');
            const w = m.newSim('pw', seeded('p'), m.parseTicket('pw', '05 11 20 27 33 38 / 04'), NaN); w.step(20000); assert.ok(m.simSummary(w).theoryRtp < 1);
        }
        // 固定號碼解析：格式錯誤回 null
        for (const [k, s] of [['big', '1 2 3 4 5'], ['big', '1 1 2 3 4 5'], ['big', '1 2 3 4 5 50'], ['pw', '1 2 3 4 5 6'], ['pw', '1 2 3 4 5 6 / 9'], ['pw', '1 2 3 4 5 39 / 1'], ['d5', '1 2 3 4 40'], ['d5', '1 1 2 3 4'], ['inv', '1']]) assert.equal(m.parseTicket(k, s), null, k + s);
        assert.deepEqual(m.parseTicket('pw', '05 11 20 27 33 38 + 04'), { nums: [5, 11, 20, 27, 33, 38], z: 4 });
        // 發票：免費、只看平均獎金；三十萬張的平均接近理論值（~0.2 元量級，寬鬆檢查）
        {
            const s = m.newSim('inv', seeded('inv'), null, NaN); s.step(100000); const r = m.simSummary(s);
            assert.equal(r.cost, 0); assert.equal(r.rtp, null); assert.ok(r.theoryPerBet > 0.5 && r.theoryPerBet < 2);
            assert.ok(r.prize / r.n < 5, '平均每張獎金不會離譜');
        }
        assert.equal(m.choose(49, 6), 13983816); assert.equal(new Set(m.sampleK(seeded('k'), 49, 6)).size, 6);
    }

    // ---- artale-calc ----
    {
        const m = load('game-assist/artale-calc.html', 'expected, pullRates, firstHitPmf, upPmf, expectation, simScrollOnce, simGachaOnce, sampleStats');
        const r = seeded('scroll'), N = 20000; let sum = 0, lost = 0;
        for (let i = 0; i < N; i++) { const x = m.simScrollOnce(r, 1, 0.6, 0, 20000); sum += x.n; lost += x.lost; }
        assert.equal(lost, 0); assert.ok(Math.abs(sum / N - 1 / 0.6) < 0.05, '平均張數接近 1/p：' + sum / N);
        // 含損毀：模擬平均花費接近理論 expected()
        { const r2 = seeded('dmg'); let tot = 0; for (let i = 0; i < N; i++) { const x = m.simScrollOnce(r2, 3, 0.5, 0.3); tot += x.n * 10 + x.lost * 500; } const th = m.expected(3, 0.5, 0.3, 10, 500); assert.ok(Math.abs(tot / N - th) / th < 0.05, `${tot / N} vs ${th}`); }
        // 撞到上限會標記
        assert.ok(m.simScrollOnce(seeded('cap'), 50, 0.0001, 0, 100).capped);
        // 抽卡：模擬平均抽數接近 pmf 期望值；同種子可重現
        const rates = m.pullRates(0.006, 90, 74, 0.06), pmf = m.firstHitPmf(rates), g = seeded('gacha'); let a = 0, u = 0;
        for (let i = 0; i < N; i++) { const [x, y] = m.simGachaOnce(g, rates, 0.5, true); a += x; u += y; assert.ok(y >= x); }
        assert.ok(Math.abs(a / N - m.expectation(pmf)) / m.expectation(pmf) < 0.03, `any ${a / N} vs ${m.expectation(pmf)}`);
        assert.ok(Math.abs(u / N - m.expectation(m.upPmf(pmf, 0.5, true))) / m.expectation(m.upPmf(pmf, 0.5, true)) < 0.03);
        assert.deepEqual(m.simGachaOnce(seeded('s'), rates, 0.5, true), m.simGachaOnce(seeded('s'), rates, 0.5, true));
        for (let i = 0; i < 200; i++) assert.ok(m.simGachaOnce(seeded('h' + i), rates, 1, false)[1] <= 90, '硬保底內必出');
        const st = m.sampleStats([5, 1, 3, 2, 4, 10, 9, 8, 7, 6]); assert.equal(st.min, 1); assert.equal(st.max, 10); assert.equal(st.mean, 5.5); assert.equal(st.q50, 5); assert.equal(st.q99, 10);
    }

    // ---- dice / wheel ----
    {
        const d = load('fun/dice.html', 'simDice, simMean');
        const acc = {}; d.simDice(seeded('dice'), acc, 2, 6, 60000);
        const mm = d.simMean(acc, 2, 6); assert.equal(mm.count, 60000); assert.equal(mm.theory, 7); assert.ok(Math.abs(mm.mean - 7) < 0.05);
        assert.ok(Object.keys(acc).every(k => k >= 2 && k <= 12)); assert.ok(Math.abs(acc[7] / 60000 - 6 / 36) < 0.01);
        const w = load('fun/wheel.html', 'parseItems, pickIndex, simPick');
        const items = w.parseItems('拉麵\n便當*2\n燒肉*3'), counts = [0, 0, 0]; w.simPick(items, seeded('wheel'), counts, 60000);
        assert.equal(counts.reduce((a, b) => a + b), 60000);
        [1 / 6, 2 / 6, 3 / 6].forEach((p, i) => assert.ok(Math.abs(counts[i] / 60000 - p) < 0.01, `${i}: ${counts[i]}`));
        assert.equal(w.pickIndex(items, 0), 0); assert.equal(w.pickIndex(items, 0.999999), 2);
    }
    ok('sim');
})().catch(e => { console.error(e); process.exit(1); });
