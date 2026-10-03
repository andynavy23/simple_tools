// z1 批次：utils/time-tracker.html（工時）、utils/recipe-scaler.html（食譜縮放）、mini-games/mental-math.html（心算）
const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- 工時紀錄 ----------
const T = load('utils/time-tracker.html', 'TT, cleanProjects, cleanLogs, cleanActive, dayStart, addDays, weekStart, monthStart, periodRange, overlap, withActive, totals, chartData, fmtHM, fmtHMS, money, parseManual, addProject, addLog, removeProject, pruneOlder, csvGuard, toCsv, dateStr, timeStr');
const at = (y, m, d, h = 0, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s).getTime();
{
    const now = at(2026, 10, 3, 12);
    assert.deepStrictEqual(T.cleanProjects(null), []); assert.deepStrictEqual(T.cleanProjects('x'), []);
    const ps = T.cleanProjects([null, 1, { id: 'a', name: ' A ', color: 'red', rate: '300' }, { id: 'a', name: 'dup' }, { id: 'b', name: '' }, { name: 'noid' }, { id: 'c', name: 'C', rate: -5 }]);
    assert.deepStrictEqual(ps.map(p => [p.id, p.name, p.color, p.rate]), [['a', 'A', '#4f8cff', 300], ['c', 'C', '#4f8cff', 0]]);
    assert.strictEqual(T.cleanProjects(Array.from({ length: 80 }, (_, i) => ({ id: 'p' + i, name: 'n' + i }))).length, 50);
    const ls = T.cleanLogs([null, { id: 'x', p: 'a', s: 1000, e: 500 }, { id: 'y', p: 'a', s: 'z', e: 5 }, { id: 'ok', p: 'a', s: 1000, e: 2000, note: 5 }, { id: 'ok', p: 'a', s: 1000, e: 3000 }, { id: 'n', p: 'a', s: 1000, e: 2000, note: 'x'.repeat(500) }]);
    assert.strictEqual(ls.length, 2); assert.strictEqual(ls[0].note, ''); assert.strictEqual(ls[1].note.length, 100);
    assert.deepStrictEqual(T.cleanLogs({}), []);
    assert.strictEqual(T.cleanActive(null, ps, now), null); assert.strictEqual(T.cleanActive({ p: 'zzz', s: now - 5 }, ps, now), null);
    assert.strictEqual(T.cleanActive({ p: 'a', s: now + 1e7 }, ps, now), null); assert.strictEqual(T.cleanActive({ p: 'a', s: 'x' }, ps, now), null);
    assert.deepStrictEqual(T.cleanActive({ p: 'a', s: now - 5000, extra: 1 }, ps, now), { p: 'a', s: now - 5000 });
    ok('time-tracker: load validation / caps');
}
{
    const s = at(2026, 10, 2, 23, 30), e = at(2026, 10, 3, 0, 45), logs = [{ id: '1', p: 'a', s, e, note: '' }];
    const d2 = T.totals(logs, at(2026, 10, 2), at(2026, 10, 3)), d3 = T.totals(logs, at(2026, 10, 3), at(2026, 10, 4));
    assert.strictEqual(d2.a, 30 * 60000); assert.strictEqual(d3.a, 45 * 60000);
    const act = { p: 'a', s: at(2026, 10, 2, 23, 50) }, nowM = at(2026, 10, 3, 0, 10), all = T.withActive([], act, nowM);
    assert.strictEqual(T.totals(all, at(2026, 10, 3), at(2026, 10, 4)).a, 10 * 60000); assert.strictEqual(T.totals(all, at(2026, 10, 2), at(2026, 10, 3)).a, 10 * 60000);
    assert.strictEqual(T.withActive([], null, nowM).length, 0);
    assert.strictEqual(T.dateStr(T.weekStart(at(2026, 10, 3, 15))), '2026-09-28'); assert.strictEqual(T.dateStr(T.weekStart(at(2026, 9, 28))), '2026-09-28'); assert.strictEqual(T.dateStr(T.weekStart(at(2026, 10, 4, 23))), '2026-09-28');
    const [wa, wb] = T.periodRange('week', at(2026, 10, 3)); assert.strictEqual(T.dateStr(wb), '2026-10-05'); assert.strictEqual(T.dateStr(wa), '2026-09-28');
    const [ma, mb] = T.periodRange('month', at(2026, 12, 31, 23)); assert.strictEqual(T.dateStr(ma), '2026-12-01'); assert.strictEqual(T.dateStr(mb), '2027-01-01');
    const [da, db] = T.periodRange('day', at(2026, 10, 3, 18)); assert.strictEqual(T.dateStr(da), '2026-10-03'); assert.strictEqual(T.dateStr(db), '2026-10-04');
    const cd = T.chartData(logs, at(2026, 10, 3, 12)); assert.strictEqual(cd.length, 14); assert.strictEqual(cd[13].label, 3); assert.strictEqual(cd[12].t.a, 30 * 60000); assert.strictEqual(cd[13].t.a, 45 * 60000); assert.strictEqual(cd[0].label, 20);
    ok('time-tracker: midnight split / week-month ranges / chart');
}
{
    assert.strictEqual(T.fmtHM(0), '0:00'); assert.strictEqual(T.fmtHM(90 * 60000), '1:30'); assert.strictEqual(T.fmtHM(59.6 * 60000), '1:00'); assert.strictEqual(T.fmtHMS(3661000), '1:01:01'); assert.strictEqual(T.fmtHMS(-5), '0:00:00');
    assert.strictEqual(T.money(90 * 60000, 300), 450); assert.strictEqual(T.money(1000, 100), 0.03);
    const ok1 = T.parseManual('2026-10-03', '09:00', '10:30'); assert.strictEqual(ok1.e - ok1.s, 90 * 60000);
    for (const bad of [['', '09:00', '10:00'], ['2026-10-03', '10:00', '09:00'], ['2026-10-03', '10:00', '10:00'], ['2026-02-30', '09:00', '10:00'], ['2026-10-03', '', '10:00'], ['1999-01-01', '09:00', '10:00'], ['2026-10-03', '9:00', '10:00']]) assert.ok(T.parseManual(...bad).err, bad.join('|'));
    ok('time-tracker: format / money / manual entry validation');
}
{
    let r = T.addProject([], '  ', '#fff', 0); assert.ok(r.err);
    r = T.addProject([], 'A', '#112233', '250'); assert.strictEqual(r.list[0].rate, 250); assert.strictEqual(r.list[0].color, '#112233');
    assert.ok(T.addProject(r.list, 'A', '', 0).err, '同名');
    const full = Array.from({ length: T.TT.PROJ_MAX }, (_, i) => ({ id: 'p' + i, name: 'n' + i, color: '#000000', rate: 0 })); assert.ok(T.addProject(full, 'new').err); assert.strictEqual(full.length, 50);
    const fullL = Array.from({ length: T.TT.LOG_MAX }, (_, i) => ({ id: 'l' + i, p: 'a', s: 1000, e: 2000, note: '' })); const lr = T.addLog(fullL, 'a', 1, 2, ''); assert.ok(lr.err); assert.strictEqual(lr.list.length, 20000);
    assert.strictEqual(T.addLog([], 'a', 1000, 2000, 'x'.repeat(300)).list[0].note.length, 100);
    const logs = [{ id: '1', p: 'a', s: 1000, e: 2000, note: '' }, { id: '2', p: 'b', s: 1000, e: 2000, note: '' }];
    const ps = [{ id: 'a' }, { id: 'b' }];
    let d = T.removeProject(ps, logs, 'a', true); assert.deepStrictEqual([d.projects.length, d.logs.map(l => l.id)], [1, ['2']]);
    d = T.removeProject(ps, logs, 'a', false); assert.deepStrictEqual([d.projects.length, d.logs.length], [1, 2]);
    const now = at(2026, 10, 3), old = { id: 'o', p: 'a', s: at(2025, 9, 1), e: at(2025, 9, 1, 2), note: '' }, edge = { id: 'e', p: 'a', s: at(2025, 10, 3, 1), e: at(2025, 10, 3, 2), note: '' }, nw = { id: 'n', p: 'a', s: now, e: now + 1000, note: '' };
    assert.deepStrictEqual(T.pruneOlder([old, edge, nw], T.addDays(T.dayStart(now), -365)).map(l => l.id), ['e', 'n']);
    ok('time-tracker: caps / delete cascade / prune');
}
{
    assert.strictEqual(T.csvGuard('=SUM(A1)'), "'=SUM(A1)"); assert.strictEqual(T.csvGuard('+1'), "'+1"); assert.strictEqual(T.csvGuard('-1'), "'-1"); assert.strictEqual(T.csvGuard('@x'), "'@x"); assert.strictEqual(T.csvGuard('normal'), 'normal'); assert.strictEqual(T.csvGuard(null), '');
    const ps = [{ id: 'a', name: '=evil, "q"', color: '#000000', rate: 100 }], logs = [{ id: '1', p: 'a', s: at(2026, 10, 2, 23, 30), e: at(2026, 10, 3, 0, 45), note: '@note\nline2' }, { id: '2', p: 'gone', s: at(2026, 10, 1, 9), e: at(2026, 10, 1, 10), note: '' }];
    const csv = T.toCsv(logs, ps), lines = csv.split('\r\n');
    assert.strictEqual(lines[0], '專案,日期,開始,結束,時數,金額,備註'); assert.ok(lines[1].startsWith('（已刪除的專案）,2026-10-01,09:00,10:00,1.00,,'), lines[1]);
    assert.ok(csv.includes('"\'=evil, ""q"""'), csv); assert.ok(csv.includes('2026-10-03 00:45,1.25,125.00,"\'@note\nline2"'), csv);
    ok('time-tracker: CSV export + formula guard');
}

// ---------- 食譜縮放 ----------
const R = load('utils/recipe-scaler.html', 'RS, parseNum, parseLine, scaleLine, scaleRecipe, recipeText, fracStr, niceStr, countStr, factorOf, cleanRecipes, addRecipe, removeRecipe');
const sc = (line, f, mode = 'keep') => R.scaleLine(R.parseLine(line), f, mode).text;
{
    assert.strictEqual(R.parseNum('250'), 250); assert.strictEqual(R.parseNum('0.5'), 0.5); assert.strictEqual(R.parseNum('.5'), 0.5); assert.strictEqual(R.parseNum('1/2'), 0.5); assert.strictEqual(R.parseNum('1 1/2'), 1.5); assert.strictEqual(R.parseNum('1½'), 1.5); assert.strictEqual(R.parseNum('½'), 0.5);
    assert.ok(Number.isNaN(R.parseNum('1/0'))); assert.ok(Number.isNaN(R.parseNum('abc'))); assert.ok(Number.isNaN(R.parseNum('')));
    const p = R.parseLine('麵粉 250g'); assert.deepStrictEqual([p.ok, p.pre, p.lo, p.hi, p.unit, p.post], [true, '麵粉 ', 250, null, 'g', '']);
    assert.strictEqual(R.parseLine('牛奶 1 杯').unit, 'cup'); assert.strictEqual(R.parseLine('糖 1/2 湯匙').lo, 0.5); assert.strictEqual(R.parseLine('糖 1/2 湯匙').unit, 'tbsp');
    assert.strictEqual(R.parseLine('奶油 1 1/2 湯匙').lo, 1.5); const rg = R.parseLine('雞蛋 2-3 顆'); assert.deepStrictEqual([rg.lo, rg.hi, rg.unit], [2, 3, 'pc']);
    assert.strictEqual(R.parseLine('雞蛋 2～3 顆').hi, 3); assert.strictEqual(R.parseLine('蛋 2 到 3 顆').hi, 3);
    for (const [t, u] of [['a 1 kg', 'kg'], ['a 1 ml', 'ml'], ['a 1 l', 'l'], ['a 1 L', 'l'], ['a 2 cups', 'cup'], ['a 1 tsp', 'tsp'], ['a 1 Tbsp', 'tbsp'], ['a 1 茶匙', 'tsp'], ['a 1 匙', 'tbsp'], ['a 1 個', 'pc'], ['a 2 片', 'pc'], ['a 1 隻', 'pc'], ['a 3 公斤', 'kg'], ['a 3 毫升', 'ml'], ['a 3 oz', 'oz']]) assert.strictEqual(R.parseLine(t).unit, u, t);
    assert.strictEqual(R.parseLine('2 large eggs').unit, '', '2 l 不能誤判為公升'); assert.strictEqual(R.parseLine('1 1/2 cup flour').post, ' flour');
    for (const t of ['鹽 適量', '烤箱預熱 180°C', '烤 25 分鐘', '[麵團]', '']) assert.strictEqual(R.parseLine(t).ok, false, t);
    assert.strictEqual(R.parseLine('1. 麵粉 100g').pre, '1. 麵粉 '); assert.strictEqual(R.parseLine('- 水 200ml').lo, 200);
    ok('recipe-scaler: parseNum / parseLine (fractions, mixed, range, units, unparseable)');
}
{
    assert.strictEqual(sc('麵粉 250g', 1.5), '麵粉 375g'); assert.strictEqual(sc('牛奶 1 杯', 1.5), '牛奶 1 1/2 杯'); assert.strictEqual(sc('糖 1/2 湯匙', 2), '糖 1 湯匙');
    assert.strictEqual(sc('水 0.33 杯', 1), '水 1/3 杯'); assert.strictEqual(sc('水 1 杯', 0.33), '水 1/3 杯'); assert.strictEqual(sc('水 1 杯', 2 / 3), '水 2/3 杯');
    assert.strictEqual(sc('雞蛋 2 顆', 1.985), '雞蛋 4 顆'); assert.strictEqual(sc('雞蛋 3.97 顆', 1), '雞蛋 4 顆'); assert.strictEqual(sc('雞蛋 2-3 顆', 2), '雞蛋 4–6 顆');
    assert.strictEqual(sc('雞蛋 2 顆', 1.25), '雞蛋 2 1/2 顆');
    assert.ok(R.scaleLine(R.parseLine('雞蛋 2 顆'), 1.25).note.includes('1/2')); assert.ok(R.scaleLine(R.parseLine('雞蛋 2 顆'), 1.2).note.includes('2.4')); assert.strictEqual(sc('雞蛋 2 顆', 1.2), '雞蛋 2 顆');
    assert.strictEqual(R.scaleLine(R.parseLine('雞蛋 2 顆'), 2).note, '');
    assert.strictEqual(sc('雞蛋 1 顆', 0.1), '雞蛋 1 顆', '至少 1');
    assert.strictEqual(sc('雞蛋 2', 3), '雞蛋 6'); assert.strictEqual(sc('香草精 2-3 滴', 2), '香草精 4–6 滴');
    assert.strictEqual(sc('1. 麵粉 100g', 2), '1. 麵粉 200g'); assert.strictEqual(sc('flour 2 cups', 0.5), 'flour 1 cups'); assert.strictEqual(sc('250g 麵粉', 2), '500g 麵粉');
    assert.strictEqual(sc('鹽 適量', 3), '鹽 適量'); assert.strictEqual(sc('烤箱 180°C', 3), '烤箱 180°C');
    assert.strictEqual(sc('牛奶 1 杯', 1, 'metric'), '牛奶 250ml'); assert.strictEqual(sc('牛奶 4 杯', 1, 'metric'), '牛奶 1L'); assert.strictEqual(sc('糖 1 湯匙', 1, 'metric'), '糖 15ml'); assert.strictEqual(sc('糖 1 茶匙', 1, 'metric'), '糖 5ml');
    assert.strictEqual(sc('麵粉 1 磅', 1, 'metric'), '麵粉 455g'); assert.strictEqual(sc('麵粉 1500 g', 1, 'metric'), '麵粉 1.5kg'); assert.strictEqual(sc('奶油 4 盎司', 1, 'metric'), '奶油 115g');
    assert.strictEqual(sc('牛奶 250 ml', 1, 'common'), '牛奶 1 杯'); assert.strictEqual(sc('牛奶 30 ml', 1, 'common'), '牛奶 2 湯匙'); assert.strictEqual(sc('牛奶 5 ml', 1, 'common'), '牛奶 1 茶匙'); assert.strictEqual(sc('牛奶 1 公升', 1, 'common'), '牛奶 4 杯');
    assert.strictEqual(sc('糖 4 湯匙', 1, 'common'), '糖 1/4 杯'); assert.strictEqual(sc('麵粉 250g', 1, 'common'), '麵粉 250g', '重量不轉杯'); assert.strictEqual(sc('雞蛋 2 顆', 1, 'metric'), '雞蛋 2 顆');
    assert.strictEqual(sc('水 1-2 杯', 1, 'metric'), '水 250–500ml');
    ok('recipe-scaler: scaling / rounding / count units / unit modes');
}
{
    assert.strictEqual(R.fracStr(0.33), '1/3'); assert.strictEqual(R.fracStr(0.67), '2/3'); assert.strictEqual(R.fracStr(1.26), '1 1/4'); assert.strictEqual(R.fracStr(1.97), '2'); assert.strictEqual(R.fracStr(0.02), '0.02'); assert.strictEqual(R.fracStr(12.2), '12');
    assert.strictEqual(R.niceStr(247.5), '250'); assert.strictEqual(R.niceStr(1.04), '1'); assert.strictEqual(R.niceStr(7.3), '7.5'); assert.strictEqual(R.niceStr(82.5), '83');
    assert.strictEqual(R.factorOf(2, 3), 1.5); assert.strictEqual(R.factorOf(0, 3), null); assert.strictEqual(R.factorOf(2, -1), null); assert.strictEqual(R.factorOf('x', 3), null); assert.strictEqual(R.factorOf(1, 5000), null);
    const rows = R.scaleRecipe('麵粉 250g\n\n鹽 適量\r\n雞蛋 2 顆', 2, 'keep');
    assert.deepStrictEqual(rows.map(r => r.text), ['麵粉 500g', '', '鹽 適量', '雞蛋 4 顆']); assert.deepStrictEqual(rows.map(r => r.ok), [true, true, false, true]);
    assert.strictEqual(R.recipeText(rows), '麵粉 500g\n\n鹽 適量\n雞蛋 4 顆'); assert.strictEqual(R.scaleRecipe('x\n'.repeat(1000), 1, 'keep').length, R.RS.LINES_MAX);
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; const pieces = ['麵粉', '1', '2', '1/2', '0', '1/0', '3-5', '杯', 'g', 'kg', '顆', '湯匙', ' ', '.', '/', '-', '½', 'ml', '°C', '分鐘', 'cup', '1 1/2', '-'];
    for (let i = 0; i < 3000; i++) { const line = Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => pieces[Math.floor(rnd() * pieces.length)]).join(''); for (const m of ['keep', 'metric', 'common']) { const t = R.scaleLine(R.parseLine(line), 0.37 + rnd() * 5, m).text; assert.ok(!/NaN|Infinity|undefined/.test(t), line + ' → ' + t); } }
    ok('recipe-scaler: rounding helpers / whole recipe / fuzz');
}
{
    assert.deepStrictEqual(R.cleanRecipes(null), []); assert.deepStrictEqual(R.cleanRecipes([null, 1, { id: 'a', name: 'A', text: '麵粉 1g' }, { id: 'a', name: 'dup', text: 'x' }, { id: 'b', name: '', text: 'x' }, { id: 'c', name: 'C', text: '   ' }, { id: 'd', name: 'D', text: 5 }]).map(r => r.id), ['a']);
    assert.strictEqual(R.cleanRecipes([{ id: 'a', name: 'n', text: 'x'.repeat(5000) }])[0].text.length, 3000);
    assert.strictEqual(R.cleanRecipes(Array.from({ length: 150 }, (_, i) => ({ id: '' + i, name: 'n', text: 'x' }))).length, 100);
    assert.ok(R.addRecipe([], '', 'x').err); assert.ok(R.addRecipe([], 'n', '  ').err); assert.ok(R.addRecipe([], 'n', 'x'.repeat(3001)).err); assert.ok(!R.addRecipe([], 'n', 'x'.repeat(3000)).err);
    const full = Array.from({ length: 100 }, (_, i) => ({ id: '' + i, name: 'n', text: 'x' })); const fr = R.addRecipe(full, 'n', 'x'); assert.ok(fr.err); assert.strictEqual(fr.list.length, 100);
    const one = R.addRecipe([], 'A', '麵粉 1g').list; assert.strictEqual(one.length, 1); assert.strictEqual(R.removeRecipe(one, one[0].id).length, 0); assert.strictEqual(R.removeRecipe(one, 'zzz').length, 1);
    ok('recipe-scaler: saved list validation / caps / delete');
}

// ---------- 心算 ----------
const M = load('mini-games/mental-math.html', 'MM, rng, genQuestion, qText, parseAnswer, judge, summarize, modeKey, cleanBest, isBetter, pressKey, cleanOps, cleanDigits');
{
    let seed = 99; const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const digits of [1, 2, 3]) {
        const [lo, hi] = M.rng(digits);
        for (let i = 0; i < 4000; i++) {
            const q = M.genQuestion(rand, { ops: ['+', '-', '*', '/'], digits, noNeg: true });
            assert.ok(Number.isInteger(q.a) && Number.isInteger(q.b) && Number.isInteger(q.ans));
            if (q.op === '+') assert.strictEqual(q.ans, q.a + q.b);
            if (q.op === '-') { assert.strictEqual(q.ans, q.a - q.b); assert.ok(q.ans >= 0, '不出負數'); }
            if (q.op === '*') { assert.strictEqual(q.ans, q.a * q.b); assert.ok(q.a >= lo && q.a <= hi); }
            if (q.op === '/') { assert.strictEqual(q.a % q.b, 0, '整除'); assert.strictEqual(q.a / q.b, q.ans); assert.ok(q.b >= 2); }
            if (q.op === '+' || q.op === '-') assert.ok(q.a >= lo && q.a <= hi && q.b >= lo && q.b <= hi);
            assert.ok(M.judge(q, String(q.ans))); assert.ok(!M.judge(q, String(q.ans + 1)));
        }
    }
    let neg = 0; for (let i = 0; i < 2000; i++) { const q = M.genQuestion(rand, { ops: ['-'], digits: 1, noNeg: false }); assert.strictEqual(q.ans, q.a - q.b); if (q.ans < 0) neg++; } assert.ok(neg > 300, '允許時會出負數');
    const seen = new Set(); for (let i = 0; i < 400; i++) seen.add(M.genQuestion(rand, { ops: ['+', '*'], digits: 2 }).op); assert.deepStrictEqual([...seen].sort(), ['*', '+']);
    assert.strictEqual(M.genQuestion(rand, { ops: [], digits: 9 }).op, '+', '壞參數有預設');
    assert.strictEqual(M.qText({ a: 6, b: 3, op: '/' }), '6 ÷ 3'); assert.deepStrictEqual(M.cleanOps(['/', '+', 'x']), ['+', '/']); assert.strictEqual(M.cleanDigits(7), 2);
    ok('mental-math: question generation simulation (divisible / correct / non-negative / ranges)');
}
{
    assert.strictEqual(M.parseAnswer('12'), 12); assert.strictEqual(M.parseAnswer('-5'), -5); for (const b of ['', '-', 'a', '1.5', '1e3', '12345678901']) assert.ok(Number.isNaN(M.parseAnswer(b)), b);
    assert.ok(M.judge({ ans: -5 }, '-5')); assert.ok(M.judge({ ans: 0 }, '-0')); assert.ok(!M.judge({ ans: 5 }, ''));
    const q = (ans) => ({ a: 1, b: 1, op: '+', ans });
    const s = M.summarize([{ q: q(2), user: 2, ok: true, ms: 2000 }, { q: q(3), user: 9, ok: false, ms: 4000 }, { q: q(4), user: 4, ok: true, ms: 3000 }]);
    assert.deepStrictEqual([s.total, s.correct, s.acc, s.avgSec, s.totalSec, s.wrong.length], [3, 2, 66.7, 3, 9, 1]); assert.strictEqual(M.summarize([]).acc, 0);
    assert.strictEqual(M.modeKey('n20', ['+', '-'], 2, true), 'mentalmath_best_n20_d2_as'); assert.strictEqual(M.modeKey('t60', ['*', '/', '-'], 3, false), 'mentalmath_best_t60_d3_smd_neg'); assert.strictEqual(M.modeKey('n10', [], 9, true), 'mentalmath_best_n10_d2_a');
    assert.strictEqual(M.cleanBest(null), null); assert.strictEqual(M.cleanBest({ acc: 'x' }), null); assert.deepStrictEqual(M.cleanBest({ acc: 90, correct: 9, sec: 30, junk: 1 }), { acc: 90, correct: 9, sec: 30 });
    const o = { acc: 90, correct: 9, sec: 30 };
    assert.ok(M.isBetter('n10', null, o)); assert.ok(M.isBetter('n10', { acc: 'bad' }, o)); assert.ok(M.isBetter('n10', o, { ...o, acc: 100 })); assert.ok(M.isBetter('n10', o, { ...o, sec: 20 })); assert.ok(!M.isBetter('n10', o, { ...o, sec: 40 })); assert.ok(!M.isBetter('n10', o, { ...o, acc: 80, sec: 1 }));
    assert.ok(M.isBetter('t60', o, { acc: 80, correct: 12, sec: 60 })); assert.ok(!M.isBetter('t60', o, { acc: 80, correct: 9, sec: 60 })); assert.ok(M.isBetter('t60', o, { acc: 95, correct: 9, sec: 60 }));
    assert.strictEqual(M.pressKey('', '5'), '5'); assert.strictEqual(M.pressKey('0', '7'), '7'); assert.strictEqual(M.pressKey('-0', '7'), '-7'); assert.strictEqual(M.pressKey('12', 'del'), '1'); assert.strictEqual(M.pressKey('', 'del'), ''); assert.strictEqual(M.pressKey('12', 'neg'), '-12'); assert.strictEqual(M.pressKey('-12', 'neg'), '12'); assert.strictEqual(M.pressKey('12345678', '9'), '12345678'); assert.strictEqual(M.pressKey('1', 'x'), '1');
    ok('mental-math: judge / summary / best-record rules / keypad');
}
