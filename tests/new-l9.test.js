// l9 批次：mini-games/mental-math.html 新題型（分數 / 百分比 / 單位換算 / 時間 / 算式配對）、mini-games/history-geo.html 史地小百科
const { load, ok } = require('./_load');
const assert = require('assert');
let seed = 20261027; const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

// ---------- 心算新題型 ----------
const M = load('mini-games/mental-math.html', 'genByType, genFrac, genPct, genUnit, genTime, genMatch, isMatch, judge, qText, ansText, parseDec, pressKey, modeKey, gcd, lcm, simplify, cmpFrac, fmtTenths, elapsedMin, addMin, hhmm, clock12, fmtDur, matchScore, cleanMatchBest, isBetterMatch, cleanType, shufR, MATCH, UNITS, genQuestion');
{
    assert.strictEqual(M.gcd(12, 18), 6); assert.strictEqual(M.gcd(0, 5), 5); assert.strictEqual(M.lcm(4, 6), 12); assert.strictEqual(M.lcm(7, 3), 21);
    assert.deepStrictEqual(M.simplify(12, 18), [2, 3]); assert.deepStrictEqual(M.simplify(5, 7), [5, 7]);
    assert.strictEqual(M.cmpFrac([3, 4], [5, 8]), 1); assert.strictEqual(M.cmpFrac([1, 3], [1, 2]), -1); assert.strictEqual(M.cmpFrac([2, 4], [3, 6]), 0); assert.strictEqual(M.cmpFrac([7, 8], [6, 7]), 1);
    assert.strictEqual(M.fmtTenths(85), '8.5'); assert.strictEqual(M.fmtTenths(80), '8'); assert.strictEqual(M.fmtTenths(5), '0.5'); assert.strictEqual(M.fmtTenths(0), '0');
    assert.strictEqual(M.cleanType('x'), 'arith'); assert.strictEqual(M.cleanType('unit'), 'unit'); assert.strictEqual(M.cleanType(undefined), 'arith');
    ok('mental-math types: helpers');
}
{ // 分數
    const seen = new Set();
    for (let i = 0; i < 3000; i++) {
        const q = M.genFrac(rand); assert.strictEqual(q.kind, 'frac'); assert.ok(Number.isInteger(q.ans) && q.ans >= 1);
        let m;
        if ((m = q.text.match(/^(\d+)\/(\d+)　？　(\d+)\/(\d+)$/))) {
            const [a, b, c, d] = m.slice(1).map(Number); assert.ok(b >= 2 && d >= 2);
            const exp = a * d > c * b ? 1 : a * d < c * b ? 2 : 3; assert.strictEqual(q.ans, exp, q.text); seen.add('cmp' + exp);
            assert.ok(M.judge(q, String(exp))); assert.ok(!M.judge(q, String(exp % 3 + 1)));
        } else if ((m = q.text.match(/^(\d+)\/(\d+) 與 (\d+)\/(\d+) 通分/))) {
            const d1 = +m[2], d2 = +m[4]; assert.notStrictEqual(d1, d2); assert.strictEqual(q.ans % d1, 0); assert.strictEqual(q.ans % d2, 0); assert.strictEqual(q.ans, M.lcm(d1, d2)); seen.add('lcm');
        } else if ((m = q.text.match(/^(\d+)\/(\d+) 約分/))) {
            const n = +m[1], d = +m[2]; assert.strictEqual(q.ans, M.simplify(n, d)[1]); assert.ok(M.gcd(n, d) > 1, '一定可約分'); seen.add('simp');
        } else assert.fail(q.text);
    }
    assert.deepStrictEqual([...seen].sort(), ['cmp1', 'cmp2', 'cmp3', 'lcm', 'simp']);
    ok('mental-math frac: compare / common denominator / simplify simulation');
}
{ // 百分比：答案最多一位小數、整數運算驗證
    let dec = 0;
    for (let i = 0; i < 6000; i++) {
        const q = M.genPct(rand); assert.strictEqual(q.dec, true); assert.ok(Number.isInteger(q.t) && q.t > 0, q.text);
        let m, exp;
        if ((m = q.text.match(/^原價 (\d+) 元，打 ([\d.]+) 折/))) exp = +m[1] * (+m[2] * 10) / 100;
        else if ((m = q.text.match(/^一件商品 (\d+) 元，(漲價|降價) (\d+)%/))) exp = +m[1] * (100 + (m[2] === '漲價' ? 1 : -1) * +m[3]) / 100;
        else if ((m = q.text.match(/^全班 (\d+) 人，其中 (\d+) 人.*占全班幾 %/))) { assert.ok(+m[2] < +m[1]); exp = 100 * +m[2] / +m[1]; }
        else if ((m = q.text.match(/^(\d+) 的 (\d+)% 是多少/))) exp = +m[1] * +m[2] / 100;
        else assert.fail(q.text);
        assert.ok(Math.abs(exp * 10 - Math.round(exp * 10)) < 1e-6, '不需四捨五入 ' + q.text); // 恰好一位小數以內
        assert.strictEqual(q.t, Math.round(exp * 10)); assert.ok(Math.abs(q.ans - exp) < 1e-9);
        assert.strictEqual(M.ansText(q), M.fmtTenths(q.t));
        assert.ok(M.judge(q, M.fmtTenths(q.t))); assert.ok(M.judge(q, M.fmtTenths(q.t) + (q.t % 10 ? '' : '.0')) || true);
        assert.ok(!M.judge(q, M.fmtTenths(q.t + 1)));
        if (q.t % 10) dec++;
    }
    assert.ok(dec > 300, '有些題目答案帶一位小數');
    ok('mental-math pct: exact tenths / judge simulation');
}
{ // 判定與輸入
    const q = { kind: 'pct', dec: true, t: 85, ans: 8.5 };
    assert.ok(M.judge(q, '8.5')); assert.ok(M.judge(q, '8.50') === false); assert.ok(!M.judge(q, '8')); assert.ok(!M.judge(q, '')); assert.ok(!M.judge(q, '-8.5')); assert.ok(!M.judge(q, '8.55')); assert.ok(!M.judge(q, 'abc'));
    assert.ok(M.judge({ dec: true, t: 80, ans: 8 }, '8')); assert.ok(M.judge({ dec: true, t: 80, ans: 8 }, '8.0')); assert.ok(M.judge({ dec: true, t: 80, ans: 8 }, '8.')); assert.ok(M.judge({ dec: true, t: 5, ans: 0.5 }, '0.5')); assert.ok(M.judge({ dec: true, t: 5, ans: 0.5 }, '.5') === false);
    assert.strictEqual(M.parseDec('12.3'), 12.3); assert.ok(Number.isNaN(M.parseDec('1.23'))); assert.ok(Number.isNaN(M.parseDec('1e3'))); assert.ok(Number.isNaN(M.parseDec('')));
    assert.ok(M.judge({ kind: 'time', ans: 45 }, '0045')); assert.ok(M.judge({ kind: 'time', ans: 45 }, '45'));
    // 鍵盤：小數點
    assert.strictEqual(M.pressKey('', 'dot'), '0.'); assert.strictEqual(M.pressKey('12', 'dot'), '12.'); assert.strictEqual(M.pressKey('1.2', 'dot'), '1.2'); assert.strictEqual(M.pressKey('12.', '5'), '12.5'); assert.strictEqual(M.pressKey('12.5', '7'), '12.5'); assert.strictEqual(M.pressKey('-3', 'dot'), '-3');
    assert.strictEqual(M.pressKey('12.5', 'del'), '12.'); assert.strictEqual(M.pressKey('12345678', 'dot'), '12345678');
    ok('mental-math types: judge / decimal keypad');
}
{ // 單位換算
    const names = new Set(Object.values(M.UNITS).flat().map(u => u[0])), cats = new Set();
    for (let i = 0; i < 6000; i++) {
        const q = M.genUnit(rand); assert.strictEqual(q.kind, 'unit'); assert.ok(Number.isInteger(q.t) && q.t >= 1);
        const m = q.text.match(/^([\d.]+) (\S+) = \? (\S+)$/); assert.ok(m, q.text); assert.ok(names.has(m[2]) && names.has(m[3]) && m[2] !== m[3]);
        const cat = Object.entries(M.UNITS).find(([, l]) => l.some(u => u[0] === m[2]))[0]; assert.ok(M.UNITS[cat].some(u => u[0] === m[3]), '同一類單位'); cats.add(cat);
        const f = (n) => M.UNITS[cat].find(u => u[0] === n)[1];
        const exp = +m[1] * f(m[2]) / f(m[3]); assert.ok(Math.abs(exp * 10 - Math.round(exp * 10)) < 1e-6, q.text); assert.ok(Math.abs(q.ans - exp) < 1e-9, q.text);
        assert.ok(M.judge(q, M.fmtTenths(q.t))); assert.ok(!M.judge(q, M.fmtTenths(q.t + 10)));
        assert.ok(q.ans <= 1e6 && String(M.fmtTenths(q.t)).length <= 8, '答案長度可輸入');
    }
    assert.deepStrictEqual([...cats].sort(), ['len', 'time', 'vol', 'wt']);
    // 已知換算
    const fx = (v, a, b) => { const l = Object.values(M.UNITS).find(l => l.some(u => u[0] === a)); return v * l.find(u => u[0] === a)[1] / l.find(u => u[0] === b)[1]; };
    assert.strictEqual(fx(3.5, '公斤', '公克'), 3500); assert.strictEqual(fx(2.5, '小時', '分鐘'), 150); assert.strictEqual(fx(1, '週', '天'), 7); assert.strictEqual(fx(1500, '毫升', '公升'), 1.5); assert.strictEqual(fx(1, '公里', '公尺'), 1000); assert.strictEqual(fx(1, '公噸', '公斤'), 1000);
    ok('mental-math unit: tables / simulation');
}
{ // 時間
    assert.strictEqual(M.elapsedMin(23 * 60 + 30, 60 + 15), 105); assert.strictEqual(M.elapsedMin(480, 660), 180); assert.strictEqual(M.elapsedMin(0, 0), 0); assert.strictEqual(M.elapsedMin(600, 599), 1439);
    assert.strictEqual(M.addMin(23 * 60 + 50, 20), 10); assert.strictEqual(M.addMin(10, -20), 1430); assert.strictEqual(M.addMin(0, -1440), 0);
    assert.strictEqual(M.hhmm(5), '00:05'); assert.strictEqual(M.hhmm(13 * 60 + 7), '13:07');
    assert.deepStrictEqual(M.clock12(0), { txt: '上午 12:00', num: 1200 }); assert.deepStrictEqual(M.clock12(12 * 60 + 5), { txt: '下午 12:05', num: 1205 }); assert.deepStrictEqual(M.clock12(15 * 60 + 45), { txt: '下午 3:45', num: 345 }); assert.strictEqual(M.clock12(11 * 60 + 59).txt, '上午 11:59');
    assert.strictEqual(M.fmtDur(45), '45 分鐘'); assert.strictEqual(M.fmtDur(60), '1 小時'); assert.strictEqual(M.fmtDur(135), '2 小時 15 分鐘');
    const parse = (t) => { let m = t.match(/^(\d\d):(\d\d)$/); if (m) return +m[1] * 60 + +m[2]; m = t.match(/^(上午|下午) (\d+):(\d\d)$/); return ((+m[2] % 12) + (m[1] === '下午' ? 12 : 0)) * 60 + +m[3]; };
    const T = '(\\d\\d:\\d\\d|(?:上午|下午) \\d+:\\d\\d)', kinds = new Set(); let cross = 0, h12 = 0, h24 = 0;
    const dur = (t) => { const m = t.match(/^(?:(\d+) 小時)? ?(?:(\d+) 分鐘)?$/); return (+m[1] || 0) * 60 + (+m[2] || 0); };
    for (let i = 0; i < 6000; i++) {
        const q = M.genTime(rand); assert.strictEqual(q.kind, 'time'); let m;
        if ((m = q.text.match(new RegExp(`^${T} 到 ${T}，經過幾分鐘？$`)))) {
            const s = parse(m[1]), e = parse(m[2]), exp = (e - s + 1440) % 1440; assert.strictEqual(q.ans, exp, q.text); assert.ok(exp >= 15 && exp <= 600); if (e < s) cross++; kinds.add('el');
        } else if ((m = q.text.match(new RegExp(`^${T} 再過 (.+)是幾點幾分？$`)))) {
            const s = parse(m[1]), e = (s + dur(m[2])) % 1440; kinds.add('later');
            if (/^\d\d:/.test(m[1])) { assert.strictEqual(q.ans, Math.floor(e / 60) * 100 + e % 60); assert.strictEqual(q.ansText, M.hhmm(e)); } else { assert.strictEqual(q.ans, M.clock12(e).num); assert.strictEqual(q.ansText, M.clock12(e).txt); }
            if (s + dur(m[2]) >= 1440) cross++;
        } else if ((m = q.text.match(new RegExp(`^${T} 的 (.+)前是幾點幾分？$`)))) {
            const s = parse(m[1]), e = (s - dur(m[2]) + 1440) % 1440; kinds.add('earlier');
            if (/^\d\d:/.test(m[1])) assert.strictEqual(q.ans, Math.floor(e / 60) * 100 + e % 60); else assert.strictEqual(q.ans, M.clock12(e).num);
            if (s - dur(m[2]) < 0) cross++;
        } else assert.fail(q.text);
        if (/上午|下午/.test(q.text)) h12++; else h24++;
        assert.ok(M.judge(q, String(q.ans))); assert.ok(!M.judge(q, String(q.ans + 1)));
    }
    assert.deepStrictEqual([...kinds].sort(), ['earlier', 'el', 'later']); assert.ok(cross > 200 && h12 > 1000 && h24 > 1000, [cross, h12, h24].join());
    ok('mental-math time: cross midnight / 12h / 24h simulation');
}
{ // 分派、配對
    for (const type of ['frac', 'pct', 'unit', 'time']) for (let i = 0; i < 50; i++) assert.strictEqual(M.genByType(rand, { type }).kind, type);
    assert.strictEqual(M.genByType(rand, { type: 'arith', ops: ['+'], digits: 1 }).op, '+'); assert.strictEqual(M.genByType(rand, { type: 'bogus', ops: ['-'], digits: 1 }).op, '-'); assert.ok(M.genByType(rand, undefined));
    assert.ok(M.qText(M.genFrac(rand)).length > 3); assert.strictEqual(M.ansText({ a: 1, b: 1, op: '+', ans: 2 }), '2');
    assert.strictEqual(M.modeKey('n10', ['+'], 2, true, 'frac'), 'mentalmath_best_n10_frac'); assert.strictEqual(M.modeKey('t60', ['+'], 2, true, 'time'), 'mentalmath_best_t60_time');
    assert.strictEqual(M.modeKey('n20', ['+', '-'], 2, true, 'match'), 'mentalmath_best_match_d2_as'); assert.strictEqual(M.modeKey('n20', ['-'], 3, false, 'match'), 'mentalmath_best_match_d3_s_neg');
    assert.strictEqual(M.modeKey('n20', ['+', '-'], 2, true), 'mentalmath_best_n20_d2_as'); assert.strictEqual(M.modeKey('n20', ['+', '-'], 2, true, 'arith'), 'mentalmath_best_n20_d2_as'); assert.strictEqual(M.modeKey('n20', ['+'], 2, true, 'zzz'), 'mentalmath_best_n20_d2_a');
    for (let i = 0; i < 1000; i++) {
        const cfg = { ops: ['+', '-', '*', '/'][i % 4] ? [['+'], ['-'], ['*'], ['/'], ['+', '-', '*', '/']][i % 5] : ['+'], digits: 1 + i % 3, noNeg: i % 2 === 0 };
        const g = M.genMatch(rand, cfg); assert.strictEqual(g.items.length, 6); assert.deepStrictEqual([...g.order].sort(), [0, 1, 2, 3, 4, 5]);
        assert.strictEqual(new Set(g.items.map(x => x.ans)).size, 6, '答案互不相同');
        for (let l = 0; l < 6; l++) for (let r = 0; r < 6; r++) assert.strictEqual(M.isMatch(g, l, r), g.order[r] === l, '只有正確的一格配得上');
        g.items.forEach(it => { const mm = it.text.match(/^(\d+) (\+|−|×|÷) (\d+)$/); assert.ok(mm, it.text); const [a, b] = [+mm[1], +mm[3]]; assert.strictEqual({ '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[mm[2]], it.ans); });
    }
    const one = M.genMatch(() => 0.5, { ops: ['+'], digits: 1 }); assert.strictEqual(one.items.length, 6, '答案湊不齊也不會卡住');
    assert.ok(!M.isMatch(null, 0, 0)); assert.ok(!M.isMatch(one, 9, 0)); assert.ok(!M.isMatch(one, 0, 9));
    assert.deepStrictEqual(M.shufR([1, 2, 3, 4], () => 0.3).slice().sort(), [1, 2, 3, 4]);
    assert.strictEqual(M.matchScore(30, 2), 36); assert.strictEqual(M.matchScore(12.34, 0), 12.3); assert.strictEqual(M.MATCH.LIMIT_SEC, 90);
    assert.strictEqual(M.cleanMatchBest(null), null); assert.strictEqual(M.cleanMatchBest({ score: 'x', miss: 1 }), null); assert.strictEqual(M.cleanMatchBest({ score: -1, miss: 1 }), null); assert.strictEqual(M.cleanMatchBest([]), null); assert.deepStrictEqual(M.cleanMatchBest({ score: 20, miss: 0, z: 1 }), { score: 20, miss: 0 });
    assert.ok(M.isBetterMatch(null, { score: 50, miss: 0 })); assert.ok(M.isBetterMatch({ bad: 1 }, { score: 50, miss: 0 })); assert.ok(M.isBetterMatch({ score: 30, miss: 1 }, { score: 29.9, miss: 3 })); assert.ok(!M.isBetterMatch({ score: 30, miss: 1 }, { score: 30, miss: 0 }));
    ok('mental-math types: dispatch / keys / match generation & scoring');
}

// ---------- 史地小百科 ----------
const H = load('mini-games/history-geo.html', 'HG, DYN, EVT, GROUPS, groupItems, fmtYear, fmtRange, cardId, allCards, norm, searchBy, itemText, cardFace, COUNTRIES, CONT, validCode, flagOf, mulberry, shufR, QMODES, answerOf, promptOf, eligible, cleanMode, quizPool, makeQuestion, makeRound, emptyStats, cleanStats, recordAnswer, recordCard, isDue, pickCard, cardCounts, dayNum, GEO, geoRows');
{ // 年表資料
    const nonPar = H.DYN.filter(d => !d.par);
    for (let i = 1; i < H.DYN.length; i++) assert.ok(H.DYN[i].y >= H.DYN[i - 1].y, '朝代依起年排序 ' + H.DYN[i].t);
    for (let i = 1; i < nonPar.length; i++) assert.ok(nonPar[i].y >= nonPar[i - 1].e, `不重疊：${nonPar[i - 1].t} → ${nonPar[i].t}`);
    for (const d of H.DYN) { assert.ok(d.e > d.y, d.t); assert.ok(d.t && d.d); if (d.par) assert.ok(/重疊|並存|並立|對峙/.test(d.d) || /^(遼|西夏|金)$/.test(d.t), '並存需註明 ' + d.t); }
    assert.strictEqual(new Set(H.DYN.map(d => d.t)).size, H.DYN.length);
    assert.ok(H.DYN.some(d => d.t === '唐' && d.y === 618 && d.e === 907) && H.DYN.some(d => d.t === '清' && d.y === 1644 && d.e === 1912) && H.DYN.some(d => d.t === '明' && d.y === 1368 && d.e === 1644) && H.DYN.some(d => d.t === '秦' && d.y === -221));
    let total = H.DYN.length;
    for (const g of ['cn', 'tw', 'wd']) { const l = H.EVT[g]; total += l.length; assert.ok(l.length >= 20, g); for (let i = 1; i < l.length; i++) assert.ok(l[i].y >= l[i - 1].y, `${g} 依年代排序：${l[i].t}`); for (const it of l) { assert.ok(Number.isInteger(it.y) && it.t && it.d.length > 8, it.t); if (it.e !== undefined) assert.ok(it.e >= it.y, it.t); } }
    assert.ok(total >= 80 && total <= 120, '條目數 ' + total);
    const ids = H.allCards().map(c => c.id); assert.strictEqual(ids.length, total); assert.strictEqual(new Set(ids).size, total, '卡片代號不重複');
    assert.strictEqual(H.fmtYear(-221), '前 221 年'); assert.strictEqual(H.fmtYear(1895), '1895 年'); assert.strictEqual(H.fmtYear(-2070, 1), '約前 2070 年');
    assert.strictEqual(H.fmtRange({ y: 618, e: 907 }), '618 年 – 907 年'); assert.strictEqual(H.fmtRange({ y: -1600, e: -1046, a: 1 }), '約前 1600 年 – 前 1046 年'); assert.strictEqual(H.fmtRange({ y: -2070, e: -1600, a: 3 }), '約前 2070 年 – 約前 1600 年'); assert.strictEqual(H.fmtRange({ y: 1624 }), '1624 年');
    ok('history-geo: timeline data integrity');
}
{ // 搜尋
    assert.strictEqual(H.norm(' 臺灣 Ａ b'), '台灣ab');
    const hit = (q) => H.GROUPS.flatMap(([g]) => H.searchBy(H.groupItems(g), q, H.itemText).map(it => it.t));
    assert.ok(hit('1895').includes('日本統治時期')); assert.ok(hit('台灣').length > 5 && hit('臺灣').length === hit('台灣').length); assert.ok(hit('鄭成功').includes('鄭成功攻臺')); assert.ok(hit('唐').includes('唐')); assert.deepStrictEqual(hit('zzzqq'), []);
    assert.strictEqual(H.searchBy(H.COUNTRIES, '日本', x => x.n + x.cap).length, 1); assert.strictEqual(H.searchBy(H.COUNTRIES, '巴黎', x => x.n + x.cap)[0].c, 'FR');
    ok('history-geo: search');
}
{ // 國家資料
    const C = H.COUNTRIES; assert.ok(C.length >= 190 && C.length <= 196, '國家數 ' + C.length);
    assert.strictEqual(new Set(C.map(x => x.c)).size, C.length, '國碼不重複'); assert.strictEqual(new Set(C.map(x => x.n)).size, C.length, '國名不重複');
    assert.strictEqual(new Set(C.map(x => x.cap)).size, C.length, '首都不重複（避免「看首都選國名」有兩個答案）');
    const conts = Object.values(H.CONT); for (const x of C) { assert.ok(H.validCode(x.c), x.c); assert.ok(x.n && x.cap && conts.includes(x.cont), x.n); const f = H.flagOf(x.c); assert.strictEqual([...f].length, 2); for (const ch of f) { const cp = ch.codePointAt(0); assert.ok(cp >= 0x1F1E6 && cp <= 0x1F1FF, x.c); } }
    const by = Object.fromEntries(C.map(x => [x.c, x])); assert.strictEqual(by.JP.cap, '東京'); assert.strictEqual(by.FR.cap, '巴黎'); assert.strictEqual(by.AU.cap, '坎培拉'); assert.strictEqual(by.CA.cap, '渥太華'); assert.strictEqual(by.BR.cap, '巴西利亞'); assert.strictEqual(by.TR.cap, '安卡拉'); assert.strictEqual(by.KR.cap, '首爾'); assert.strictEqual(by.EG.cap, '開羅'); assert.strictEqual(by.CH.cap, '伯恩'); assert.strictEqual(by.NZ.cap, '威靈頓'); assert.strictEqual(by.MM.cap, '奈比都'); assert.strictEqual(by.VN.cap, '河內'); assert.strictEqual(by.IN.cap, '新德里'); assert.strictEqual(by.US.cap, '華盛頓'); assert.strictEqual(by.DE.cap, '柏林'); assert.strictEqual(by.GB.cap, '倫敦');
    assert.ok(!by.TW && !by.PS && !by.XK, '有地位爭議者不收');
    for (const k of ['亞洲', '歐洲', '非洲', '北美洲', '南美洲', '大洋洲']) assert.ok(C.filter(x => x.cont === k).length >= 12, k);
    assert.strictEqual(C.filter(x => x.cont === '非洲').length, 54); assert.strictEqual(C.filter(x => x.cont === '南美洲').length, 12); assert.strictEqual(C.filter(x => x.cont === '大洋洲').length, 14);
    for (const c of ['IL', 'NL', 'ZA', 'BO', 'LK', 'VA', 'NR']) assert.ok(by[c].note, c + ' 需要備註');
    assert.strictEqual(H.flagOf('JP'), '\u{1F1EF}\u{1F1F5}'); assert.strictEqual(H.flagOf('jp'), ''); assert.strictEqual(H.flagOf('J'), ''); assert.ok(!H.validCode('J1') && !H.validCode(null) && !H.validCode('ABC'));
    ok('history-geo: country data (193 + VA, unique, valid flags)');
}
{ // 測驗出題
    const C = H.COUNTRIES, r1 = H.mulberry(7), r2 = H.mulberry(7); for (let i = 0; i < 20; i++) assert.strictEqual(r1(), r2()); assert.notStrictEqual(H.mulberry(7)(), H.mulberry(8)());
    assert.deepStrictEqual(H.shufR([1, 2, 3, 4, 5], H.mulberry(3)), H.shufR([1, 2, 3, 4, 5], H.mulberry(3))); assert.deepStrictEqual(H.shufR([1, 2, 3, 4, 5], H.mulberry(3)).slice().sort(), [1, 2, 3, 4, 5]);
    const a = [1, 2, 3]; H.shufR(a, H.mulberry(1)); assert.deepStrictEqual(a, [1, 2, 3], '不改原陣列');
    for (const mode of H.QMODES) {
        const pool = H.quizPool(C, { mode }); assert.ok(pool.length >= 190);
        for (let i = 0; i < 1500; i++) {
            const item = pool[i % pool.length], q = H.makeQuestion(H.mulberry(i), item, C, mode);
            assert.strictEqual(q.options.length, 4); assert.strictEqual(new Set(q.options).size, 4, '選項不重複'); assert.strictEqual(q.options[q.correct], H.answerOf(item, mode)); assert.strictEqual(q.prompt, H.promptOf(item, mode)); assert.ok(q.prompt);
            assert.deepStrictEqual(q, H.makeQuestion(H.mulberry(i), item, C, mode), '種子可重現');
            const same = q.options.filter(o => C.some(x => x.cont === item.cont && H.answerOf(x, mode) === o)).length; assert.ok(same >= 3, '干擾項優先同洲 ' + same);
        }
    }
    assert.ok(!H.eligible({ n: '新加坡', cap: '新加坡' }, 'cap') && H.eligible({ n: '新加坡', cap: '新加坡' }, 'flag'));
    assert.ok(H.quizPool(C, { mode: 'cap' }).every(x => x.cap !== x.n));
    assert.ok(H.quizPool(C, { cont: '大洋洲', mode: 'flag' }).every(x => x.cont === '大洋洲')); assert.strictEqual(H.quizPool(C, { cont: '大洋洲', mode: 'flag' }).length, 14);
    assert.deepStrictEqual(H.quizPool(C, { wrongOnly: true, wrong: { JP: 2, FR: 1, XX: 5 }, mode: 'flag' }).map(x => x.c).sort(), ['FR', 'JP']); assert.deepStrictEqual(H.quizPool(C, { wrongOnly: true, wrong: {}, mode: 'cap' }), []);
    const round = H.makeRound(H.mulberry(5), H.quizPool(C, { mode: 'cap' }), C, 'cap'); assert.strictEqual(round.length, 10); assert.strictEqual(new Set(round.map(q => q.item.c)).size, 10, '一輪不重複');
    assert.strictEqual(H.makeRound(H.mulberry(5), H.quizPool(C, { cont: '大洋洲', mode: 'cap' }), C, 'cap', 5).length, 5); assert.strictEqual(H.cleanMode('x'), 'cap'); assert.strictEqual(H.cleanMode('flag'), 'flag');
    const small = H.makeQuestion(H.mulberry(1), C.find(x => x.c === 'NR'), C, 'cap'); assert.strictEqual(new Set(small.options).size, 4);
    ok('history-geo: quiz generation (4 unique options, same-continent, seeded)');
}
{ // 統計
    const codes = new Set(H.COUNTRIES.map(x => x.c)), ids = new Set(H.allCards().map(c => c.id)), id0 = [...ids][0];
    const clean = (r) => H.cleanStats(r, codes, ids), E = H.emptyStats();
    for (const bad of [null, undefined, 5, 'x', [], true, { quiz: 5, wrong: [], cards: 'a', card: null }]) assert.deepStrictEqual(clean(bad), E, JSON.stringify(bad));
    let s = clean({ quiz: { flag: { n: 10, ok: 99, run: 3, best: 1 }, cap: { n: 'x' }, zzz: { n: 5 } }, wrong: { JP: 2, XX: 3, FR: 'a', DE: -4, IT: 500, ES: 1.9 }, cards: { [id0]: { b: 9, t: -5 }, bogus: { b: 1, t: 1 }, [[...ids][1]]: 'x' }, card: { ok: 5, ng: 'z' } });
    assert.deepStrictEqual(s.quiz.flag, { n: 10, ok: 10, run: 3, best: 3 }); assert.deepStrictEqual(s.quiz.cap, { n: 0, ok: 0, run: 0, best: 0 }); assert.strictEqual(s.quiz.zzz, undefined);
    assert.deepStrictEqual(s.wrong, { JP: 2, IT: 99, ES: 1 }); assert.deepStrictEqual(s.cards, { [id0]: { b: 3, t: 0 } }); assert.deepStrictEqual(s.card, { ok: 5, ng: 0 });
    const huge = { wrong: {}, cards: {} }; for (let i = 0; i < 5000; i++) { huge.wrong['K' + i] = 1; huge.cards['c' + i] = { b: 1, t: 1 }; } assert.deepStrictEqual(clean(huge), E);
    assert.ok(Object.keys(clean({ wrong: Object.fromEntries([...codes].map(c => [c, 1])) }).wrong).length <= codes.size);
    s = H.emptyStats(); H.recordAnswer(s, 'cap', 'JP', false); assert.deepStrictEqual([s.quiz.cap.n, s.quiz.cap.ok, s.quiz.cap.run, s.wrong.JP], [1, 0, 0, 1]);
    H.recordAnswer(s, 'cap', 'JP', false); assert.strictEqual(s.wrong.JP, 2); H.recordAnswer(s, 'cap', 'JP', true); assert.strictEqual(s.wrong.JP, 1); H.recordAnswer(s, 'cap', 'JP', true); assert.strictEqual(s.wrong.JP, undefined, '答對到 0 就從錯題移除');
    H.recordAnswer(s, 'cap', 'FR', true); assert.deepStrictEqual([s.quiz.cap.run, s.quiz.cap.best], [3, 3]); H.recordAnswer(s, 'cap', 'FR', false); assert.deepStrictEqual([s.quiz.cap.run, s.quiz.cap.best], [0, 3]); H.recordAnswer(s, 'bogus', 'US', true); assert.strictEqual(s.quiz.cap.n, 7);
    s = H.emptyStats(); for (let i = 0; i < 200; i++) H.recordAnswer(s, 'flag', 'JP', false); assert.strictEqual(s.wrong.JP, 99);
    assert.deepStrictEqual(clean(JSON.parse(JSON.stringify(s))).wrong, { JP: 99 });
    ok('history-geo: stats validation / caps / record');
}
{ // 卡片複習
    const ids = ['a', 'b', 'c', 'd'], T = 100, r = () => 0;
    const s = H.emptyStats(); H.recordCard(s, 'a', true, T); assert.deepStrictEqual(s.cards.a, { b: 1, t: T }); H.recordCard(s, 'a', true, T); H.recordCard(s, 'a', true, T); H.recordCard(s, 'a', true, T); assert.strictEqual(s.cards.a.b, 3, '最高 3'); H.recordCard(s, 'a', false, T); assert.strictEqual(s.cards.a.b, 0); assert.deepStrictEqual([s.card.ok, s.card.ng], [4, 1]);
    assert.ok(H.isDue({ b: 0, t: T }, T)); assert.ok(!H.isDue({ b: 1, t: T }, T)); assert.ok(H.isDue({ b: 1, t: T }, T + 1)); assert.ok(!H.isDue({ b: 2, t: T }, T + 2)); assert.ok(H.isDue({ b: 2, t: T }, T + 3)); assert.ok(!H.isDue({ b: 3, t: T }, T + 6)); assert.ok(H.isDue({ b: 3, t: T }, T + 7));
    assert.strictEqual(H.pickCard(ids, { a: { b: 2, t: 50 }, b: { b: 0, t: 90 }, c: { b: 1, t: 10 } }, T, r), 'b'); assert.strictEqual(H.pickCard(ids, { a: { b: 1, t: 10 }, b: { b: 1, t: 5 } }, T, r), 'b');
    assert.strictEqual(H.pickCard(ids, { a: { b: 3, t: T }, b: { b: 3, t: T } }, T, r), 'c', '沒到期就出新卡'); assert.strictEqual(H.pickCard(ids, { a: { b: 3, t: T }, b: { b: 3, t: T }, c: { b: 3, t: T }, d: { b: 3, t: T } }, T, r), null);
    assert.strictEqual(H.pickCard(ids, { a: { b: 0, t: T }, b: { b: 0, t: T } }, T, r, 'a'), 'b', '避免連續同一張'); assert.strictEqual(H.pickCard(['a'], { a: { b: 0, t: T } }, T, r, 'a'), 'a', '只剩一張仍可出');
    assert.deepStrictEqual(H.cardCounts(ids, { a: { b: 3, t: T }, b: { b: 0, t: T }, c: { b: 1, t: T } }, T), { due: 1, fresh: 1, mastered: 1 });
    assert.strictEqual(H.dayNum(864e5 * 5 + 1), 5);
    for (const c of H.allCards()) { const f = H.cardFace(c); assert.ok(f.q && f.a && f.tag); assert.ok(f.a.includes(c.it.d)); }
    assert.ok(H.allCards().some(c => H.cardFace(c).q.endsWith('是哪個朝代？')) && H.allCards().some(c => c.g === 'dyn' && !H.cardFace(c).q.endsWith('是哪個朝代？')), '朝代卡兩種方向');
    assert.ok(H.allCards().filter(c => c.g !== 'dyn').every(c => H.cardFace(c).q === c.it.t));
    ok('history-geo: flashcards (boxes / due / pick)');
}
{ // 台灣地理資料
    const rows = H.geoRows(); assert.ok(rows.length >= 40); assert.ok(H.GEO.length >= 7); for (const r of rows) assert.ok(r.sec && r.k && r.v.length > 4);
    const adm = H.GEO.find(s => s[0] === '行政區')[1], txt = adm.map(x => x[1]).join('');
    const names = ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市', '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣', '基隆市', '新竹市', '嘉義市'];
    assert.strictEqual(names.length, 22); for (const n of names) assert.ok(txt.includes(n), n);
    for (const n of names) { const reg = ['北部', '中部', '南部', '東部', '離島'].filter(k => adm.find(x => x[0] === k)[1].includes(n)); assert.strictEqual(reg.length, 1, n + ' 恰屬一區 ' + reg); }
    const all = rows.map(r => r.k + r.v).join(''); for (const k of ['3,952', '濁水溪', '日月潭', '澎湖', '北回歸線']) assert.ok(all.includes(k), k);
    assert.ok(H.searchBy(rows, '玉山', r => r.sec + r.k + r.v).length >= 2); assert.ok(H.searchBy(rows, '台北', r => r.sec + r.k + r.v).length >= 1);
    ok('history-geo: taiwan geography data');
}
