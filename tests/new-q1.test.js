// 批次 q1：24 點（twenty-four）、1A2B 猜數字（guess-ab）的純函式
const assert = require('assert');
const { load, ok } = require('./_load');

// ---------- 24 點 ----------
{
    const { solve24, parseExpr, check24, dailyCards, cleanStats, bumpDaily, liveStreak, twDay } =
        load('mini-games/twenty-four.html', 'solve24, parseExpr, check24, dailyCards, cleanStats, bumpDaily, liveStreak, twDay', '// --- pure ---', '// --- /pure ---');
    // 已知題目：3 3 8 8 要用分數；1 1 1 1 無解；1 1 1 1 以外也有幾組著名無解
    const s = solve24([3, 3, 8, 8]); assert.ok(s, '3388 有解'); assert.ok(check24(s, [3, 3, 8, 8]).ok, '解法本身要通過驗證：' + s);
    assert.strictEqual(solve24([1, 1, 1, 1]), null);
    assert.strictEqual(solve24([1, 1, 1, 2]), null); assert.strictEqual(solve24([13, 13, 13, 13]), null);
    assert.ok(solve24([4, 1, 8, 7]) && solve24([5, 5, 5, 1]) && solve24([1, 5, 5, 5]));   // 5×(5−1/5)
    // 求值：有理數、無浮點誤差
    assert.deepStrictEqual(parseExpr('8/(3-8/3)').value, [24, 1]);
    assert.deepStrictEqual(parseExpr('1/3+1/3+1/3').value, [1, 1]);
    assert.deepStrictEqual(parseExpr('2 × (3 + 9)').value, [24, 1]); assert.deepStrictEqual(parseExpr('10 − 4 ÷ 8').value, [19, 2]);
    // 運算式驗證
    for (const bad of ['', '1+', '(1+2', '1+2)', '1++2', '-1+2', '1/0', '1/(2-2)', 'abc', '1 2', '123+1', '2**3', '1+2 3']) assert.strictEqual(parseExpr(bad).ok, false, '應判錯：' + bad);
    assert.strictEqual(parseExpr('((((1))))').ok, true);
    assert.strictEqual(check24('8/(3-8/3)', [3, 3, 8, 8]).ok, true);
    assert.strictEqual(check24('8/(3-8/3)', [3, 3, 8, 9]).ok, false);       // 牌不符
    assert.strictEqual(check24('3*8', [3, 3, 8, 8]).ok, false);              // 沒用完
    assert.strictEqual(check24('3*8*8*3', [3, 3, 8, 8]).ok, false);         // 用完但不是 24
    assert.ok(check24('3+3+8+8', [3, 3, 8, 8]).msg.includes('22'));
    assert.ok(check24('1+1+1+1', [1, 1, 1, 1]).msg.includes('4'));
    // 驗算：1–13 四張牌的組合共 1820 種，可解 1362 種（74.8%）；加上排列次數權重（13^4 = 28561 種有序抽法）約 79.2%
    let ms = 0, okN = 0, tot = 0, okTot = 0;
    for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) for (let d = c; d <= 13; d++) {
        const cnt = {}; [a, b, c, d].forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
        let w = 24; Object.values(cnt).forEach(v => { for (let i = 2; i <= v; i++) w /= i; });
        const sol = solve24([a, b, c, d]); ms++; tot += w;
        if (sol) { okN++; okTot += w; assert.ok(check24(sol, [a, b, c, d]).ok, '解法驗證 ' + [a, b, c, d]); }
    }
    assert.strictEqual(ms, 1820); assert.strictEqual(okN, 1362); assert.strictEqual(tot, 28561);
    assert.ok(Math.abs(okTot / tot - 0.7918) < 0.001);
    // 每日挑戰：同一天同一題、一定有解、不同天通常不同
    assert.deepStrictEqual(dailyCards('2026-11-01'), dailyCards('2026-11-01'));
    for (let i = 1; i <= 30; i++) { const c = dailyCards('2026-11-' + String(i).padStart(2, '0')); assert.ok(c.length === 4 && c.every(x => x >= 1 && x <= 13) && solve24(c)); }
    assert.notDeepStrictEqual(dailyCards('2026-11-01'), dailyCards('2026-11-02'));
    // 台灣時間：UTC 16:00 就已經是隔天
    assert.strictEqual(twDay(Date.UTC(2026, 0, 1, 15, 59)), '2026-01-01'); assert.strictEqual(twDay(Date.UTC(2026, 0, 1, 16, 0)), '2026-01-02');
    // 統計：驗證與連續天數
    assert.deepStrictEqual(cleanStats(null), { n: 0, best: 0, d: { last: '', streak: 0, best: 0 } });
    assert.deepStrictEqual(cleanStats({ n: -3, best: 'x', d: { last: 5, streak: 2.5, best: null } }), { n: 0, best: 0, d: { last: '', streak: 0, best: 0 } });
    assert.deepStrictEqual(cleanStats({ n: 5, best: 12, d: { last: '2026-01-02', streak: 3, best: 1 } }), { n: 5, best: 12, d: { last: '2026-01-02', streak: 3, best: 3 } });
    let d = { last: '', streak: 0, best: 0 };
    d = bumpDaily(d, '2026-02-28'); assert.strictEqual(d.streak, 1);
    d = bumpDaily(d, '2026-02-28'); assert.strictEqual(d.streak, 1);            // 同一天不重複
    d = bumpDaily(d, '2026-03-01'); assert.strictEqual(d.streak, 2);            // 跨月
    d = bumpDaily(d, '2026-03-03'); assert.strictEqual(d.streak, 1); assert.strictEqual(d.best, 2);   // 中斷
    assert.strictEqual(liveStreak(d, '2026-03-03'), 1); assert.strictEqual(liveStreak(d, '2026-03-04'), 1); assert.strictEqual(liveStreak(d, '2026-03-05'), 0);
    ok('24 點');
}

// ---------- 1A2B ----------
{
    const { validCode, score, allCodes, filterCands, aiGuess, verifyHist, validNetState, cleanBest } =
        load('mini-games/guess-ab.html', 'validCode, score, allCodes, filterCands, aiGuess, verifyHist, validNetState, cleanBest');
    assert.deepStrictEqual(score('1234', '1243'), { a: 2, b: 2 }); assert.deepStrictEqual(score('1234', '1234'), { a: 4, b: 0 });
    assert.deepStrictEqual(score('1234', '5678'), { a: 0, b: 0 }); assert.deepStrictEqual(score('1234', '4321'), { a: 0, b: 4 });
    // 重複數字：答案 1122 猜 2211 → 0A4B；答案 1123 猜 1111 → 2A0B；答案 1000 猜 0100 → 2A... 位置 3,4 的 0 都對 = 2A、1 與 0 互換 = 0B 多
    assert.deepStrictEqual(score('1122', '2211'), { a: 0, b: 4 }); assert.deepStrictEqual(score('1123', '1111'), { a: 2, b: 0 });
    assert.deepStrictEqual(score('1000', '0100'), { a: 2, b: 2 }); assert.deepStrictEqual(score('0123', '0321'), { a: 2, b: 2 });
    assert.strictEqual(validCode('0123', 4, false), true); assert.strictEqual(validCode('0113', 4, false), false); assert.strictEqual(validCode('0113', 4, true), true);
    assert.strictEqual(validCode('012', 4, true), false); assert.strictEqual(validCode('01a3', 4, true), false); assert.strictEqual(validCode(1234, 4, true), false);
    assert.strictEqual(allCodes(4, false).length, 5040); assert.strictEqual(allCodes(3, false).length, 720); assert.strictEqual(allCodes(4, true).length, 10000); assert.strictEqual(allCodes(5, false).length, 30240);
    // 候選過濾：答案本身一定留在候選裡；1234 猜 1243 = 2A2B 留下的候選恰好 ... 全部都和 1243 評分為 2A2B
    const all4 = allCodes(4, false);
    const f = filterCands(all4, '1243', 2, 2); assert.ok(f.includes('1234') && f.every(c => { const r = score(c, '1243'); return r.a === 2 && r.b === 2; }));
    // 電腦策略：記憶化（候選清單相同時結果相同），對全部 5040 個答案驗證最大步數 <= 7，且從不用答案本身
    const memo = new Map(), pick = (c, n, dup, first) => { const k = first ? 'F' : c.join(','); if (!memo.has(k)) memo.set(k, aiGuess(c, n, dup, first)); return memo.get(k); };
    const play = (secret, len, dup, all) => {
        let cands = all, steps = 0;
        for (; ;) {
            const g = pick(cands, len, dup, steps === 0); steps++;
            const r = score(secret, g); if (r.a === len) return steps;
            cands = filterCands(cands, g, r.a, r.b); assert.ok(cands.includes(secret), '答案不能被排除'); assert.ok(steps < 12, '步數過多');
        }
    };
    let max = 0, sum = 0; for (const s of all4) { const n = play(s, 4, false, all4); max = Math.max(max, n); sum += n; }
    assert.ok(max <= 7, '4 位不重複最大步數 ' + max); assert.ok(sum / 5040 < 5.5, '平均步數 ' + sum / 5040);
    const all3 = allCodes(3, false); let max3 = 0; for (const s of all3) max3 = Math.max(max3, play(s, 3, false, all3)); assert.ok(max3 <= 6, '3 位最大步數 ' + max3);
    const allD = allCodes(4, true); let maxD = 0; for (let i = 0; i < allD.length; i += 1009) maxD = Math.max(maxD, play(allD[i], 4, true, allD)); assert.ok(maxD <= 9, '4 位可重複（抽樣）最大步數 ' + maxD);
    // 核對承諾後的歷史
    const secrets = ['1234', '5678'], hist = [{ p: 0, g: '5671', ...score('5678', '5671') }, { p: 1, g: '1243', ...score('1234', '1243') }];
    assert.strictEqual(verifyHist(secrets, hist), true); hist[1].a = 4; assert.strictEqual(verifyHist(secrets, hist), false);
    // 連線狀態驗證
    const st = { phase: 'play', len: 4, dup: false, names: ['a', 'b'], active: [true, true], set: [true, true], wins: [0, 0], commits: ['x', 'y'], turn: 0, winner: -1, why: '', hist: [{ p: 0, g: '1234', a: 1, b: 0 }], reveal: null };
    assert.strictEqual(validNetState(st), true);
    for (const bad of [null, { ...st, phase: 'x' }, { ...st, len: 9 }, { ...st, hist: [{ p: 2, g: '1', a: 0, b: 0 }] }, { ...st, names: ['a', 'b', 'c'] }, { ...st, reveal: { secrets: [1, 2], salts: [] } }, { ...st, wins: [0] }]) assert.strictEqual(validNetState(bad), false);
    assert.strictEqual(cleanBest(7), 7); assert.strictEqual(cleanBest('7'), 0); assert.strictEqual(cleanBest(-1), 0); assert.strictEqual(cleanBest(null), 0);
    ok('1A2B');
}
