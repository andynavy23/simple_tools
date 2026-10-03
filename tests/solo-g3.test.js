// g3 單機模式：成語接龍（電腦）、誰是臥底（傳遞模式）、你畫我猜（練習）、畫圖接力（練習）
const { load, ok } = require('./_load');
const assert = require('assert');
const seeded = Util.seeded;
const rndOf = (seed) => { const r = seeded(seed); return (n) => r.int(n); };

// ---- 成語接龍 ----
{
    const m = load('fun/idiom-chain.html', 'IDIOMS, successors, lastChar, firstChar, cpuPick, hintFor, checkAnswer, startPool');
    const { IDIOMS, successors, lastChar, firstChar, cpuPick, hintFor, checkAnswer, startPool } = m;
    for (const level of ['easy', 'normal', 'hard']) {
        // 隨機對局：電腦出的每一手都合法（接得上、沒重複、在詞庫內）；對局能打完
        for (let g = 0; g < 20; g++) {
            const rng = seeded(level + g), pool = startPool(), first = pool[rng.int(pool.length)];
            let last = first; const used = new Set([first]); let steps = 0;
            for (; steps < 500; steps++) {
                const w = cpuPick(last, used, level, rng);
                if (w === null) break;
                assert.ok(checkAnswer(last, used, w).ok && IDIOMS.includes(w), `${level} 非法: ${last}→${w}`);
                used.add(w); last = w;
            }
            assert.ok(steps < 500);
        }
    }
    ok('idiom solo: cpu moves always legal on all levels; games terminate');
    // 簡單：有成語可接時偶爾認輸；普通 / 困難：有得接就不認輸
    const used0 = new Set(['一心一意']);
    let giveUps = 0; const r1 = seeded('gu');
    for (let i = 0; i < 400; i++) if (cpuPick('一心一意', used0, 'easy', r1) === null) giveUps++;
    assert.ok(giveUps > 20 && giveUps < 120, '簡單偶爾認輸 ' + giveUps);
    for (let i = 0; i < 100; i++) { assert.ok(cpuPick('一心一意', used0, 'normal'), 'normal 有得接'); assert.ok(cpuPick('一心一意', used0, 'hard'), 'hard 有得接'); }
    assert.strictEqual(cpuPick('龘龘龘龘', new Set(), 'normal'), null, '沒得接就認輸');
    ok('idiom solo: easy sometimes gives up; normal/hard never do when a move exists');
    // 困難：選的成語，其尾字可接數量是所有候選中最少的
    const cnt = (w, used) => successors(lastChar(w), new Set([...used, w])).length;
    for (const last of ['一心一意', '天長地久', '風和日麗', '花好月圓'].filter(l => successors(lastChar(l), new Set([l])).length)) {
        const used = new Set([last]), c = successors(lastChar(last), used), min = Math.min(...c.map(w => cnt(w, used)));
        for (let i = 0; i < 10; i++) assert.strictEqual(cnt(cpuPick(last, used, 'hard'), used), min, 'hard 選最冷門');
    }
    // 困難平均讓玩家可接的數量 <= 普通
    const avg = (level) => { const r = seeded('avg' + level); let t = 0, n = 0; for (const last of IDIOMS.slice(0, 300)) { const used = new Set([last]), w = cpuPick(last, used, level, r); if (w) { t += cnt(w, used); n++; } } return t / n; };
    assert.ok(avg('hard') <= avg('normal'), `hard ${avg('hard')} vs normal ${avg('normal')}`);
    ok('idiom solo: hard picks the words that are hardest to follow');
    // 提示給的是可接的成語
    const h = hintFor('一心一意', used0); assert.ok(checkAnswer('一心一意', used0, h).ok);
    assert.strictEqual(hintFor('龘龘龘龘', new Set()), null);
    ok('idiom solo: hints are valid');
}

// ---- 誰是臥底 ----
{
    const m = load('fun/spy-game.html', 'PAIRS, assign, tally, outcome, descOk, voteOk, soloSetup, cpuLine, cpuVote, CPU_LINES, MIN_PLAYERS, MAX_PLAYERS');
    const { PAIRS, assign, tally, outcome, descOk, voteOk, soloSetup, cpuLine, cpuVote, CPU_LINES } = m;
    assert.deepStrictEqual(soloSetup('甲\n乙, 丙', 0).names, ['甲', '乙', '丙']);
    assert.deepStrictEqual(soloSetup('甲\n乙', 1), { names: ['甲', '乙', '電腦A'], cpu: [false, false, true] });
    assert.ok(soloSetup('甲\n乙', 0).err, '2 人不夠');
    assert.ok(soloSetup('甲\n甲\n乙', 0).err, '名字重複');
    assert.ok(soloSetup('一二三四五六七八九十一', 2).err, '名字太長');
    assert.ok(soloSetup('a,b,c,d,e,f,g,h,i', 2).err, '超過 10 人');
    assert.ok(soloSetup('a,b,c,d,e,f,g,h,i', 1).names.length === 10);
    assert.ok(soloSetup('電腦A,乙', 1).err, '不能與電腦名重複');
    ok('spy solo: roster validation (3–10 players, no duplicates)');
    // 電腦描述句：永遠合法（不含任何詞庫的詞）、盡量不重複
    for (const l of CPU_LINES) for (const [a, b] of PAIRS) assert.ok(descOk(l, a) && descOk(l, b), l);
    const used = []; const r = rndOf('lines'); for (let i = 0; i < CPU_LINES.length; i++) used.push(cpuLine(r, used));
    assert.strictEqual(new Set(used).size, CPU_LINES.length);
    assert.ok(CPU_LINES.includes(cpuLine(r, CPU_LINES)), '全用過仍可重複');
    ok('spy solo: cpu descriptions never contain the words');
    // 電腦投票：只投活著的其他人
    for (let t = 0; t < 200; t++) { const alive = [true, false, true, true, false], me = [0, 2, 3][t % 3], v = cpuVote(me, alive, rndOf('v' + t)); assert.ok(voteOk(me, v, alive), 'cpu 投票合法'); }
    assert.strictEqual(cpuVote(0, [true, false], rndOf('x')), -1);
    ok('spy solo: cpu votes are always legal');
    // 模擬整局（全電腦）：一定能在人數耗盡前分出勝負，且淘汰的規則與房主端一致
    for (let g = 0; g < 100; g++) {
        const n = 3 + (g % 8), rand = rndOf('game' + g), a = assign(n, rand), alive = Array(n).fill(true); let rounds = 0, o = null;
        while (!(o = outcome(a.roles, alive))) {
            const votes = []; alive.forEach((x, i) => { if (x) votes.push([i, cpuVote(i, alive, rand)]); });
            const e = tally(votes); if (e >= 0) alive[e] = false; assert.ok(++rounds < 30);
        }
        assert.ok(o === 'civ' || o === 'spy');
    }
    ok('spy solo: simulated cpu-only games always finish');
}

// ---- 你畫我猜 ----
{
    const m = load('mini-games/draw-guess.html', 'canvasPos, addPractice, fmtPractice, pickWord, WORDS');
    const { canvasPos, addPractice, fmtPractice, pickWord, WORDS } = m;
    // 畫布縮小成 345px 寬（手機）：座標要按比例還原；超出邊界要夾住
    const r = { left: 20, top: 100, width: 345, height: 220.8 };
    assert.deepStrictEqual(canvasPos(20, 100, r), [0, 0]);
    assert.deepStrictEqual(canvasPos(20 + 345, 100 + 220.8, r), [1000, 640]);
    assert.deepStrictEqual(canvasPos(20 + 172.5, 100 + 110.4, r), [500, 320]);
    assert.deepStrictEqual(canvasPos(-50, 9999, r), [0, 640]);
    ok('draw-guess solo: canvasPos maps CSS-scaled touch coordinates');
    let st = {}; st = addPractice(st, true); st = addPractice(st, false); st = addPractice(st, true);
    assert.deepStrictEqual(st, { n: 3, can: 2, cant: 1 });
    assert.ok(fmtPractice(st).includes('67%')); assert.ok(fmtPractice({}).startsWith('0 題'));
    // 題目不重複直到用完
    const used = new Set(), rand = rndOf('dg'); for (let i = 0; i < WORDS.length; i++) used.add(pickWord(used, rand));
    assert.strictEqual(used.size, WORDS.length);
    ok('draw-guess solo: practice stats + no repeated topics');
}

// ---- 畫圖接力 ----
{
    const m = load('fun/art-relay.html', 'canvasPos, THEMES, pickTheme, wallLayout');
    const { canvasPos, THEMES, pickTheme, wallLayout } = m;
    const r = { left: 10, top: 50, width: 300, height: 200 };
    assert.deepStrictEqual(canvasPos(160, 150, r), [600, 400]);
    assert.deepStrictEqual(canvasPos(10 + 300, 50 + 200, r), [1200, 800]);
    assert.deepStrictEqual(canvasPos(0, 0, r), [0, 0]);
    ok('art-relay solo: canvasPos maps CSS-scaled touch coordinates');
    const rand = rndOf('th'); for (let i = 0; i < 50; i++) assert.ok(pickTheme(rand, '一隻貓的一天') !== '一隻貓的一天' && THEMES.includes(pickTheme(rand)));
    for (const [n, c, rw] of [[3, 3, 1], [4, 2, 2], [5, 3, 2], [6, 3, 2]]) assert.deepStrictEqual(wallLayout(n), { cols: c, rows: rw });
    ok('art-relay solo: theme picking + wall layout');
}
