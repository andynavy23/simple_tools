// l6 批次：kids-learn（兒童學習樂園）的純邏輯
const { load, ok } = require('./_load');
const assert = require('assert');
const K = load('mini-games/kids-learn.html', 'UNITS, UNIT_IDS, GEN, WORDS, ZY, ZY_ALL, TONE_SETS, TONE_MARK, ANIMALS, SPELL_WORDS, spellOf, DEN, mkChoices, makeQuestion, validQ, spellNext, makeGate, checkGate, calcStars, cleanOpts, cleanStats, recordStat, STAT_CAP, breakdown, minCount, timeLabel, timeWords, handAngles, angleToMin, angleToHour, hAdd, wdAdd, monAdd, WD, MON, EMO, EMO_SIT, qKey');

// 題庫完整性：每單元 × 難度 × 200 個種子，題目都合法（選擇題恰 1 個正解且選項不重複）
for (const u of K.UNIT_IDS) for (const lv of [1, 2, 3]) for (const ctx of [{ canSpeak: true }, { canSpeak: false }]) for (let s = 0; s < 200; s++) {
    const q = K.makeQuestion(u, lv, Util.seeded(`${u}${lv}${s}`), ctx);
    assert.ok(K.validQ(q), `${u} lv${lv} seed${s} 不合法`);
}
ok('l6 每題都合法（13 單元 × 3 難度）');

// 種子可重現
const a = K.makeQuestion('animal', 2, Util.seeded('x')), b = K.makeQuestion('animal', 2, Util.seeded('x'));
assert.deepStrictEqual(a, b);
assert.notDeepStrictEqual(K.makeQuestion('count', 1, Util.seeded('p1')), K.makeQuestion('count', 3, Util.seeded('p2')));
// 連續不重複
const r = Util.seeded('rep'); let last = '';
for (let i = 0; i < 100; i++) { const q = K.makeQuestion('count', 1, r, {}, last); assert.notStrictEqual(K.qKey(q), last); last = K.qKey(q); }
ok('l6 種子可重現與不連續重複');

// 數數 / 加減 / 乘法的答案正確
for (let s = 0; s < 300; s++) {
    let q = K.GEN.count(3, Util.seeded('c' + s)); assert.strictEqual([...q.big].length, +q.ans); assert.ok(+q.ans >= 1 && +q.ans <= 20);
    q = K.GEN.count(1, Util.seeded('c' + s)); assert.ok(+q.ans <= 5);
    for (const lv of [1, 2, 3]) {
        q = K.GEN.add(lv, Util.seeded('a' + lv + s)); const max = [5, 10, 20][lv - 1], { a, b, sub } = q.add;
        assert.strictEqual(+q.ans, sub ? a - b : a + b); assert.ok(a <= max && b <= max && +q.ans >= (sub ? 1 : 2) && +q.ans <= max, `add lv${lv}`);
        q.choices.forEach(c => assert.ok(+c.t >= 0 && +c.t <= max));
        q = K.GEN.mul(lv, Util.seeded('m' + lv + s)); const m = q.text.match(/(\d+)/g).map(Number);
        if (lv === 1) { assert.strictEqual(+q.ans, q.arr.rows * q.arr.cols); assert.strictEqual(m[0], q.arr.rows); assert.strictEqual(m[1], q.arr.cols); }
        if (lv === 2) { assert.strictEqual(+q.ans, m[0] * m[1]); assert.strictEqual(q.arr.rows * q.arr.cols, m[0] * m[1]); }
        if (lv === 3) assert.strictEqual(m[0] * +q.ans, m[1]);
    }
}
ok('l6 數數 / 加減 / 乘法答案');

// 題庫：英文單字 ≥ 60 且不重複；拼字用單字都是純字母；各長度夠多
assert.ok(K.WORDS.length >= 60);
assert.strictEqual(new Set(K.WORDS.map(x => x[0])).size, K.WORDS.length); assert.strictEqual(new Set(K.WORDS.map(x => x[1])).size, K.WORDS.length);
K.WORDS.forEach(x => assert.ok(x[0] && x[1] && x[2]));
for (const lv of [1, 2, 3]) assert.ok(K.spellOf(lv).length >= 8, 'spell lv' + lv);
K.SPELL_WORDS.forEach(x => assert.ok(/^[a-z]+$/.test(x[1])));
// 動物：emoji / 名稱不重複；有叫聲的擬聲詞彼此不同
assert.strictEqual(new Set(K.ANIMALS.map(x => x[0])).size, K.ANIMALS.length); assert.strictEqual(new Set(K.ANIMALS.map(x => x[1])).size, K.ANIMALS.length);
const snd = K.ANIMALS.filter(x => x[2]).map(x => x[2]); assert.strictEqual(new Set(snd).size, snd.length); assert.ok(snd.length >= 10);
ok('l6 單字 / 動物題庫');

// 注音：37 個符號、不重複；示例字的注音以該符號開頭；符號唯一；聲調組合的聲調符號對應
assert.strictEqual([...K.ZY_ALL].length, 37); assert.strictEqual(new Set(K.ZY_ALL).size, 37);
assert.strictEqual(new Set(K.ZY.map(x => x[0])).size, K.ZY.length); assert.strictEqual(new Set(K.ZY.map(x => x[3])).size, K.ZY.length);
K.ZY.forEach(([z, w, py, e]) => { assert.ok(K.ZY_ALL.includes(z), z); assert.ok(py.startsWith(z), `${w} ${py}`); assert.ok(w && e); });
K.TONE_SETS.forEach(s => assert.strictEqual(s.length, 5));
for (let s = 0; s < 100; s++) { const q = K.GEN.zhuyin(3, Util.seeded('z' + s)); const tn = q.choices.findIndex(c => c.ok); assert.ok(q.ans.includes(q.text.match(/ㄇㄚ|ㄊㄤ|ㄕ|ㄧ/)[0])); assert.ok(tn >= 0); }
ok('l6 注音題庫');

// 日曆
assert.strictEqual(K.wdAdd(0, -1), 6); assert.strictEqual(K.wdAdd(6, 1), 0); assert.strictEqual(K.wdAdd(3, -10), 0); assert.strictEqual(K.monAdd(11, 1), 0); assert.strictEqual(K.monAdd(0, -1), 11);
assert.strictEqual(K.WD[0], '星期日'); assert.strictEqual(K.MON[11], '十二月'); assert.strictEqual(K.MON.length, 12);
for (let s = 0; s < 200; s++) {
    let q = K.GEN.cal(1, Util.seeded('w' + s)), m = q.text.match(/今天是(星期.)，(明天|昨天)/); assert.strictEqual(q.ans, K.WD[K.wdAdd(K.WD.indexOf(m[1]), m[2] === '明天' ? 1 : -1)]);
    q = K.GEN.cal(3, Util.seeded('w' + s)); m = q.text.match(/今天是(星期.)，(\d) 天(後|前)/); assert.strictEqual(q.ans, K.WD[K.wdAdd(K.WD.indexOf(m[1]), (m[3] === '後' ? 1 : -1) * +m[2])]);
    q = K.GEN.cal(2, Util.seeded('w' + s)); m = q.text.match(/^(.+月)的(下一個|上一個)月/); assert.strictEqual(q.ans, K.MON[K.monAdd(K.MON.indexOf(m[1]), m[2] === '下一個' ? 1 : -1)]);
}
ok('l6 日曆');

// 時鐘：角度與 12 小時邊界
assert.deepStrictEqual(K.handAngles(12, 0), { hour: 0, min: 0 }); assert.deepStrictEqual(K.handAngles(3, 0), { hour: 90, min: 0 });
assert.deepStrictEqual(K.handAngles(12, 30), { hour: 15, min: 180 }); assert.deepStrictEqual(K.handAngles(11, 55), { hour: 357.5, min: 330 }); assert.deepStrictEqual(K.handAngles(6, 30), { hour: 195, min: 180 });
assert.strictEqual(K.angleToMin(0), 0); assert.strictEqual(K.angleToMin(359), 0); assert.strictEqual(K.angleToMin(14), 0); assert.strictEqual(K.angleToMin(16), 5); assert.strictEqual(K.angleToMin(180), 30); assert.strictEqual(K.angleToMin(-30), 55); assert.strictEqual(K.angleToMin(345), 0);
assert.strictEqual(K.angleToHour(0), 12); assert.strictEqual(K.angleToHour(359), 12); assert.strictEqual(K.angleToHour(30), 1); assert.strictEqual(K.angleToHour(90), 3); assert.strictEqual(K.angleToHour(-30), 11); assert.strictEqual(K.angleToHour(345), 12); assert.strictEqual(K.angleToHour(344), 11);
for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) { assert.strictEqual(K.angleToMin(K.handAngles(h, m).min), m); assert.strictEqual(K.angleToHour(Math.round(K.handAngles(h, 0).hour)), h); }
assert.strictEqual(K.hAdd(12, 1), 1); assert.strictEqual(K.hAdd(1, -1), 12); assert.strictEqual(K.hAdd(12, -1), 11);
assert.strictEqual(K.timeLabel(3, 5), '3:05'); assert.strictEqual(K.timeWords(3, 0), '3 點整'); assert.strictEqual(K.timeWords(12, 30), '12 點半'); assert.strictEqual(K.timeWords(7, 25), '7 點 25 分');
for (let s = 0; s < 300; s++) for (const lv of [1, 2, 3]) {
    const q = K.GEN.clock(lv, Util.seeded('k' + lv + s)), t = q.target || q.clock;
    if (lv === 1) assert.strictEqual(t.m, 0); if (lv === 2) assert.ok([0, 30].includes(t.m));
    if (q.choices) assert.strictEqual(q.choices.find(c => c.ok).t, K.timeLabel(t.h, t.m));
}
ok('l6 時鐘');

// 錢幣：面額、湊額、找錢
assert.deepStrictEqual(K.DEN, [1, 5, 10, 50, 100, 200, 500, 1000]);
assert.deepStrictEqual(K.breakdown(63), [[50, 1], [10, 1], [1, 3]]); assert.deepStrictEqual(K.breakdown(0), []); assert.deepStrictEqual(K.breakdown(1000), [[1000, 1]]); assert.deepStrictEqual(K.breakdown(40, [10, 1]), [[10, 4]]);
assert.strictEqual(K.breakdown(5, [10, 50]), null);
// 最少張數：貪婪法與動態規劃一致，且湊出的總額正確
{
    const dp = [0]; for (let v = 1; v <= 1500; v++) dp[v] = Math.min(...K.DEN.filter(d => d <= v).map(d => dp[v - d] + 1));
    for (let v = 0; v <= 1500; v++) { assert.strictEqual(K.minCount(v), dp[v], 'min ' + v); assert.strictEqual(K.breakdown(v).reduce((s, [d, n]) => s + d * n, 0), v); }
}
for (let s = 0; s < 400; s++) for (const lv of [2, 3]) {
    const q = K.GEN.money(lv, Util.seeded('$' + lv + s));
    if (q.type === 'pay') { assert.ok(q.target > 0 && (lv === 2 ? q.target <= 99 : q.target <= 999)); assert.strictEqual(K.breakdown(q.target, q.denoms).reduce((x, [d, n]) => x + d * n, 0), q.target); }
    else if (q.coins && q.coins.length > 1) { assert.strictEqual(+q.choices.find(c => c.ok).t, q.coins.reduce((x, y) => x + y, 0)); assert.ok(q.coins.reduce((x, y) => x + y, 0) <= 100); }
    else if (q.coins) { const m = q.text.match(/買 (\d+) 元.*付 (\d+) 元/); assert.strictEqual(+q.choices.find(c => c.ok).t, m[2] - m[1]); assert.ok(m[2] - m[1] > 0); }
}
ok('l6 錢幣');

// 拼字
assert.ok(K.spellNext('cat', 0, 'c')); assert.ok(!K.spellNext('cat', 0, 'a')); assert.ok(!K.spellNext('cat', 3, 't'));
for (let s = 0; s < 100; s++) { const q = K.GEN.spell(3, Util.seeded('sp' + s)); assert.strictEqual(q.tiles.length, q.word.length + 2); assert.ok(q.word.length >= 5); }
ok('l6 拼字');

// 家長關卡、星星、設定、統計
for (let s = 0; s < 50; s++) { const g = K.makeGate(Util.seeded('g' + s)); const [x, y] = g.q.match(/\d+/g).map(Number); assert.strictEqual(g.a, x + y); assert.ok(K.checkGate(g, String(g.a))); assert.ok(K.checkGate(g, ' ' + g.a + ' ')); assert.ok(!K.checkGate(g, String(g.a + 1))); assert.ok(!K.checkGate(g, '')); }
assert.strictEqual(K.calcStars(10, 10), 3); assert.strictEqual(K.calcStars(6, 10), 2); assert.strictEqual(K.calcStars(0, 10), 1); assert.strictEqual(K.calcStars(0, 0), 1);
assert.deepStrictEqual(K.cleanOpts(null), { q: 10, lv: 1, speak: false, beep: false }); assert.deepStrictEqual(K.cleanOpts([1]), { q: 10, lv: 1, speak: false, beep: false });
assert.deepStrictEqual(K.cleanOpts({ q: 5, lv: 3, speak: true, beep: 'yes' }), { q: 5, lv: 3, speak: true, beep: false }); assert.strictEqual(K.cleanOpts({ q: 7, lv: 9 }).q, 10); assert.strictEqual(K.cleanOpts({ lv: 9 }).lv, 1);
let st = K.cleanStats(null);
assert.deepStrictEqual(Object.keys(st), K.UNIT_IDS); assert.ok(Object.values(st).every(v => v.length === 3 && v.every(p => p[0] === 0 && p[1] === 0)));
for (const bad of ['x', 5, [], [1, 2], { count: 'x' }, { count: [null, 'a', [1]] }, { count: [[5, 2]] }, { count: [[-1, 1e99], [NaN, 3]], extra: [[1, 1]] }]) { const c = K.cleanStats(bad); assert.deepStrictEqual(Object.keys(c), K.UNIT_IDS); assert.ok(Object.values(c).every(v => v.length === 3 && v.every(p => p[0] <= p[1] && p[1] <= K.STAT_CAP))); }
assert.deepStrictEqual(K.cleanStats({ count: [[5, 2]] }).count[0], [2, 2]);                 // 答對不得超過答題
assert.strictEqual(K.cleanStats({ count: [[-1, 1e99]] }).count[0][1], K.STAT_CAP);
assert.ok(!('extra' in K.cleanStats({ extra: [[1, 1]] })));                              // 未知單元丟掉（大小固定）
st = K.recordStat(st, 'count', 2, true); st = K.recordStat(st, 'count', 2, false);
assert.deepStrictEqual(st.count[1], [1, 2]); assert.deepStrictEqual(st.count[0], [0, 0]);
assert.strictEqual(K.recordStat(st, 'nope', 1, true), st); assert.strictEqual(K.recordStat(st, 'count', 4, true), st);
const full = K.cleanStats({ add: [[K.STAT_CAP, K.STAT_CAP]] }); assert.strictEqual(K.recordStat(full, 'add', 1, true), full);
ok('l6 關卡 / 設定 / 統計');
