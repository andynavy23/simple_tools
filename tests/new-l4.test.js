// 批次 l4：utils/study-hub.html 純邏輯（題庫解析、出題、錯題、成績、讀書計畫、課表、GPA）
const assert = require('assert');
const { load, ok } = require('./_load');
const m = load('utils/study-hub.html', 'SH, validDate, isRight, normQ, normBank, checkQ, parseBank, importBank, pickQuiz, normWrong, recordWrong, patchWrong, removeWrong, viewWrong, weakStats, normExam, normExams, addExam, removeExam, trendOf, warnsCrossed, clock, checkDates, normPlan, setPlanDates, addPlanItem, removePlanItem, setDone, doneOf, planSchedule, timeMin, normTT, addPeriod, removePeriod, setPeriodTime, setCell, classesOn, nextClass, DEFAULT_GP, normGP, lookupGP, weightedAvg, gpaOf, needFinal');
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} !~ ${b}`);

// --- CSV 題庫 ---
let r = m.parseBank('題目,正確答案,選項A,選項B,選項C,選項D,解說,單元\n最高的山?,B,雪山,玉山,阿里山,,3952 公尺,地理\n"2+3, 等於?",5,,,,,,數學\n2+3=?,5');
assert.strictEqual(r.items.length, 3); assert.deepStrictEqual(r.items[0].opts, ['雪山', '玉山', '阿里山']);
assert.strictEqual(r.items[0].a, '玉山'); assert.strictEqual(r.items[0].exp, '3952 公尺'); assert.strictEqual(r.items[1].q, '2+3, 等於?'); assert.strictEqual(r.items[1].opts.length, 0);
// 無標題：位置對應；答案可寫選項文字
r = m.parseBank('Q1,甲,甲,乙\nQ2,丙');
assert.strictEqual(r.items.length, 2); assert.strictEqual(r.items[0].a, '甲');
// 標題順序不同 + 別名
r = m.parseBank('answer,question,unit\nx,y,u');
assert.strictEqual(r.items[0].q, 'y'); assert.strictEqual(r.items[0].unit, 'u');
r = m.parseBank('題目,答案\nq,a'); assert.strictEqual(r.items.length, 1);
assert.strictEqual(m.parseBank('題目,解說\nq,e').errors[0].row, 1);
// TSV
assert.strictEqual(m.parseBank('題目\t正確答案\nq\ta').items[0].a, 'a');
// 錯誤列
r = m.parseBank('題目,正確答案,選項A,選項B\n,a\nq,\nq,Z,x,y\nq,C,x,y\nq,A,x\nq,A,x,x\nok,A,x,y');
assert.deepStrictEqual(r.errors.map(e => e.msg), ['缺題目', '缺正確答案', '答案不在選項中', '答案不在選項中', '選項至少要 2 個', '選項重複']);
assert.strictEqual(r.items.length, 1);
// 單題過長
r = m.parseBank('題目,正確答案\n' + 'x'.repeat(2000) + ',a');
assert.ok(/超過 2000/.test(r.errors[0].msg));
assert.strictEqual(m.parseBank('題目,正確答案\n' + 'x'.repeat(1990) + ',a').items.length, 1);
// 壞引號 / 空白 / 重複
assert.ok(m.parseBank('題目,正確答案\n"abc,d').errors[0].msg.includes('引號'));
assert.deepStrictEqual(m.parseBank('  \n\n'), { items: [], errors: [] });
assert.strictEqual(m.parseBank('q,a\nq,a\nq,a').items.length, 1);
ok('l4 parseBank');

// --- 匯入上限 ---
let bank = []; let res = m.importBank(bank, 'q1,a\nq2,b');
assert.strictEqual(res.added, 2); bank = res.bank;
res = m.importBank(bank, 'q1,a\nq3,c'); assert.strictEqual(res.added, 1); assert.strictEqual(res.dups, 1); bank = res.bank;
assert.ok(m.importBank(bank, '').err);
assert.ok(m.importBank(bank, ',').err);
const big = Array.from({ length: 2000 }, (_, i) => `題${i},答`).join('\n');
res = m.importBank([], big); assert.strictEqual(res.added, 2000); assert.strictEqual(res.err, '');
const full = res.bank;
res = m.importBank(full, 'new,a'); assert.ok(/最多 2000 題/.test(res.err)); assert.strictEqual(res.bank, full); assert.strictEqual(res.added, 0);
assert.ok(m.importBank([], big + '\n多一題,答').err);
// 載入：壞資料
assert.deepStrictEqual(m.normBank(null), []); assert.deepStrictEqual(m.normBank('x'), []);
const nb = m.normBank([null, 3, { q: 'a' }, { q: 'a', a: 'b', id: 'x' }, { q: 'c', a: 'd', id: 'x' }, { q: 'e', a: 'z', opts: ['a', 'b'], id: 'y' }, { q: 'f', a: 'g', opts: 'oops', exp: 5, unit: null }]);
assert.deepStrictEqual(nb.map(q => q.q), ['a', 'f']); assert.deepStrictEqual(nb[1].opts, []); assert.strictEqual(nb[1].exp, '');
assert.strictEqual(m.normBank(Array.from({ length: 2100 }, (_, i) => ({ q: 'q' + i, a: 'a', id: 'i' + i }))).length, 2000);
ok('l4 import/limits');

// --- 出題與判分 ---
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'q' + i, q: 'Q' + i, a: 'A', opts: i % 2 ? ['A', 'B', 'C'] : [], exp: '', unit: i < 4 ? 'U1' : i < 8 ? 'U2' : '' }));
const B = mk(10); let seed = 1; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let pk = m.pickQuiz(B, { count: 5 }, rand); assert.strictEqual(pk.length, 5); assert.strictEqual(new Set(pk.map(x => x.id)).size, 5);
assert.ok(pk.every(x => x.fill === !B.find(q => q.id === x.id).opts.length));
assert.ok(pk.filter(x => !x.fill).every(x => x.opts.slice().sort().join() === 'A,B,C'));
assert.strictEqual(m.pickQuiz(B, { count: 99 }).length, 10); assert.strictEqual(m.pickQuiz(B, { count: 0 }).length, 0); assert.strictEqual(m.pickQuiz(B, { count: 'x' }).length, 0);
assert.deepStrictEqual(m.pickQuiz(B, { unit: 'U1', count: 99, ordered: true }).map(x => x.id), ['q0', 'q1', 'q2', 'q3']);
assert.strictEqual(m.pickQuiz(B, { unit: '*none', count: 99 }).length, 2); assert.strictEqual(m.pickQuiz(B, { unit: 'nope', count: 9 }).length, 0);
assert.ok(m.pickQuiz(B, { count: 10, fill: true }).every(x => x.fill && !x.opts.length));
assert.deepStrictEqual(m.pickQuiz(B, { count: 10 }, () => 0).map(x => x.id).sort(), B.map(q => q.id).sort());
const fillQ = { a: 'Taipei|台北', opts: [] }, mcQ = { a: '玉山', opts: ['玉山', '雪山'] };
assert.ok(m.isRight(fillQ, ' taipei ', true) && m.isRight(fillQ, '台北', true) && !m.isRight(fillQ, '', true) && !m.isRight(fillQ, 'tp', true));
assert.ok(m.isRight(mcQ, '玉山', false) && !m.isRight(mcQ, '雪山', false) && m.isRight(mcQ, '玉山', true) && !m.isRight(mcQ, '', true));
assert.ok(m.isRight({ a: 'ＡＢ', opts: [] }, 'ab', true));   // 全形 / 大小寫
ok('l4 quiz');

// --- 錯題 ---
let w = [];
w = m.recordWrong(w, 'q1', '2026-10-01'); w = m.recordWrong(w, 'q1', '2026-10-02'); w = m.recordWrong(w, 'q5', '2026-10-03');
assert.deepStrictEqual(w.map(x => [x.id, x.n, x.last]), [['q1', 2, '2026-10-02'], ['q5', 1, '2026-10-03']]);
w = m.patchWrong(w, 'q1', { mastered: true, tag: '粗心' }); w = m.recordWrong(w, 'q1', '2026-10-04'); assert.strictEqual(w[0].mastered, false); assert.strictEqual(w[0].n, 3); assert.strictEqual(w[0].tag, '粗心');
w = m.recordWrong(w, 'q9', '2026-10-04'); w = m.patchWrong(w, 'q9', { tag: '觀念' });
assert.deepStrictEqual(m.viewWrong(w, B, {}).map(x => x.id), ['q1', 'q5', 'q9']);
assert.deepStrictEqual(m.viewWrong(w, B, { sort: 'recent' }).map(x => x.id), ['q1', 'q9', 'q5']);   // 10-04 的 q1、q9（次數多者在前），再 10-03
assert.deepStrictEqual(m.viewWrong(w, B, { sort: 'unit' }).map(x => x.id), ['q9', 'q1', 'q5']);
assert.deepStrictEqual(m.viewWrong(w, B, { min: 2 }).map(x => x.id), ['q1']);
assert.deepStrictEqual(m.viewWrong(w, B, { unit: 'U2' }).map(x => x.id), ['q5']);
assert.deepStrictEqual(m.viewWrong(w, B, { unit: '*none' }).map(x => x.id), ['q9']);
assert.deepStrictEqual(m.viewWrong(w, B, { tag: '觀念' }).map(x => x.id), ['q9']); assert.deepStrictEqual(m.viewWrong(w, B, { tag: '*none' }).map(x => x.id), ['q5']);
w = m.patchWrong(w, 'q5', { mastered: true });
assert.deepStrictEqual(m.viewWrong(w, B, { state: 'done' }).map(x => x.id), ['q5']); assert.strictEqual(m.viewWrong(w, B, { state: 'all' }).length, 3); assert.strictEqual(m.viewWrong(w, B, { state: 'open' }).length, 2);
let st = m.weakStats(w, B, 'unit'); assert.deepStrictEqual(st, [{ k: 'U1', n: 3, cnt: 1 }, { k: '(未分類)', n: 1, cnt: 1 }]);
st = m.weakStats(w, B, 'tag'); assert.deepStrictEqual(st.map(s => [s.k, s.n]), [['粗心', 3], ['觀念', 1]]);
assert.deepStrictEqual(m.weakStats([], B, 'unit'), []);
assert.deepStrictEqual(m.removeWrong(w, 'q1').map(x => x.id), ['q5', 'q9']);
assert.deepStrictEqual(m.viewWrong(w, B.filter(q => q.id !== 'q1'), {}).map(x => x.id), ['q9']);   // 題庫刪掉就不顯示
// 載入驗證：孤兒、壞型別、重複
const nw = m.normWrong([null, { id: 'zzz' }, { id: 'q1', n: 'x', last: 'bad', mastered: 'yes', tag: 5 }, { id: 'q1', n: 5 }, { id: 'q2', n: 5000000 }], B);
assert.deepStrictEqual(nw, [{ id: 'q1', n: 1, last: '', mastered: false, tag: '' }, { id: 'q2', n: 1, last: '', mastered: false, tag: '' }]);
assert.deepStrictEqual(m.normWrong('x', B), []);
ok('l4 wrong');

// --- 考試成績 ---
let ex = []; let e = m.addExam(ex, { subject: '數學', date: '2026-10-01', score: '80', full: '100', mins: '60', note: '' });
assert.strictEqual(e.err, ''); ex = e.list;
for (const [bad, msg] of [[{ subject: '' }, '科目'], [{ date: '2026-02-30' }, '日期'], [{ score: '101' }, '分數'], [{ score: '' }, '分數'], [{ full: '0' }, '滿分'], [{ mins: '1.5' }, '用時'], [{ score: '-1' }, '分數'], [{ note: 'x'.repeat(101) }, '備註']]) {
    e = m.addExam(ex, { subject: 'a', date: '2026-10-02', score: '5', full: '100', mins: '', note: '', ...bad }); assert.ok(e.err.includes(msg), msg + ' / ' + e.err); assert.strictEqual(e.list, ex);
}
ex = m.addExam(ex, { subject: '數學', date: '2026-10-10', score: '90', full: '100' }).list; ex = m.addExam(ex, { subject: '英文', date: '2026-10-05', score: '30', full: '50' }).list;
let t = m.trendOf(ex, '數學'); assert.deepStrictEqual(t.pts.map(p => p.pct), [80, 90]); assert.strictEqual(t.avg, 85); assert.strictEqual(t.best, 90); assert.strictEqual(t.diff, 10);
t = m.trendOf(ex, ''); assert.deepStrictEqual(t.pts.map(p => p.date), ['2026-10-01', '2026-10-05', '2026-10-10']); assert.strictEqual(t.pts[1].pct, 60);
t = m.trendOf([], ''); assert.deepStrictEqual([t.n, t.avg, t.diff], [0, 0, null]);
assert.strictEqual(m.removeExam(ex, ex[0].id).length, 2);
const many = Array.from({ length: 500 }, (_, i) => ({ id: 'e' + i, subject: 's', date: '2026-01-01', score: 1, full: 2 }));
assert.strictEqual(m.normExams(many.concat(many.map(x => ({ ...x, id: x.id + 'b' })))).length, 500);
assert.ok(m.addExam(m.normExams(many), { subject: 's', date: '2026-01-01', score: '1', full: '2' }).err.includes('最多 500'));
assert.deepStrictEqual(m.normExams([null, { subject: 'a' }, { subject: 'a', date: '2026-01-01', score: 5, full: 3 }, { id: 'k', subject: 'a', date: '2026-01-01', score: '7', full: '10', mins: 'x' }]).map(x => [x.id, x.mins]), [['k', 0]]);
assert.deepStrictEqual(m.normExams('bad'), []);
// 提醒門檻
assert.deepStrictEqual(m.warnsCrossed(601, 599, 3600), [600]); assert.deepStrictEqual(m.warnsCrossed(3600, 3599, 3600), []);
assert.deepStrictEqual(m.warnsCrossed(400, 50, 3600), [300, 60]); assert.deepStrictEqual(m.warnsCrossed(400, 290, 300), []); assert.deepStrictEqual(m.warnsCrossed(61, 59, 120), [60]);
assert.strictEqual(m.clock(3599.2), '60:00'); assert.strictEqual(m.clock(-5), '00:00'); assert.strictEqual(m.clock(65), '01:05');
ok('l4 exams');

// --- 讀書計畫 ---
assert.ok(m.checkDates('2026-10-01', '2026-10-01')); assert.ok(m.checkDates('2026-10-01', '2026-09-01')); assert.ok(m.checkDates('', '2026-10-01'));
assert.strictEqual(m.checkDates('2026-10-01', '2026-10-02'), ''); assert.strictEqual(m.checkDates('2026-01-01', '2027-02-05'), '');   // 400 天
assert.ok(m.checkDates('2026-01-01', '2027-02-06').includes('400'));
let p = m.setPlanDates(null, '2026-10-01', '2026-10-11').plan;
assert.ok(m.setPlanDates(null, '2026-10-01', '2026-10-01').err);
assert.deepStrictEqual(p.items, []);
p = m.addPlanItem(p, '微積分', '10', 'a').plan; p = m.addPlanItem(p, '英文', '5', 'b').plan;
for (const [n, h] of [['', '1'], ['x', ''], ['x', '0'], ['x', '1001'], ['x', 'abc'], ['x'.repeat(41), '1']]) assert.ok(m.addPlanItem(p, n, h).err, n + h);
let s = m.planSchedule(p, '2026-10-01');   // 10 天，15 小時，每天 1.5
assert.strictEqual(s.days.length, 10); near(s.perDay, 1.5);
near(s.days.reduce((x, d) => x + d.segs.reduce((y, g) => y + g.h, 0), 0), 15, 0.05);
assert.deepStrictEqual(s.days[0].segs, [{ id: 'a', name: '微積分', h: 1.5 }]);
assert.deepStrictEqual(s.days[6].segs.map(g => [g.id, g.h]), [['a', 1], ['b', 0.5]]);
assert.strictEqual(s.pct, 0); assert.strictEqual(s.state, 'run');
// 勾選今天 → 進度；隔天重新分配（沒念完分攤）
p = m.setDone(p, '2026-10-01', 'a', 1.5, true); s = m.planSchedule(p, '2026-10-01'); assert.strictEqual(s.pct, 10); assert.strictEqual(s.days[0].segs[0].h, 1.5);
p = m.setDone(p, '2026-10-01', 'a', 1.5, false); assert.deepStrictEqual(p.log, {});
s = m.planSchedule(m.setDone(p, '2026-10-01', 'a', 1.5, true), '2026-10-03');   // 跳過一天：剩 13.5 小時、8 天
assert.strictEqual(s.days.length, 8); near(s.perDay, 1.69, 0.01); assert.strictEqual(s.from, '2026-10-03');
// 開始日在未來 / 考試日已到 / 沒項目
s = m.planSchedule(p, '2026-09-20'); assert.strictEqual(s.from, '2026-10-01'); assert.strictEqual(s.days.length, 10);
assert.strictEqual(m.planSchedule(p, '2026-10-11').state, 'over'); assert.strictEqual(m.planSchedule(p, '2026-11-01').days.length, 0);
assert.strictEqual(m.planSchedule(m.setPlanDates(null, '2026-10-01', '2026-10-05').plan, '2026-10-01').state, 'empty');
// 全部完成
let pp = m.setDone(m.setDone(p, '2026-10-01', 'a', 10, true), '2026-10-01', 'b', 5, true); assert.strictEqual(m.planSchedule(pp, '2026-10-01').pct, 100);
// 刪除項目連帶清掉完成記錄
pp = m.removePlanItem(pp, 'a'); assert.deepStrictEqual(pp.items.map(i => i.id), ['b']); assert.deepStrictEqual(pp.log, { '2026-10-01': { b: 5 } });
pp = m.removePlanItem(pp, 'b'); assert.deepStrictEqual(pp.log, {});
// 改日期：範圍外記錄被丟棄
let q2 = m.setDone(p, '2026-10-02', 'a', 1, true); q2 = m.setPlanDates(q2, '2026-10-03', '2026-10-20').plan; assert.deepStrictEqual(q2.log, {}); assert.strictEqual(q2.items.length, 2);
// 上限 50
let big50 = m.setPlanDates(null, '2026-10-01', '2026-10-11').plan;
for (let i = 0; i < 50; i++) big50 = m.addPlanItem(big50, 'n' + i, '1', 'i' + i).plan;
assert.strictEqual(big50.items.length, 50); assert.ok(m.addPlanItem(big50, 'x', '1').err.includes('最多 50'));
// 載入驗證
assert.strictEqual(m.normPlan(null), null); assert.strictEqual(m.normPlan('x'), null); assert.strictEqual(m.normPlan({ start: '2026-10-05', exam: '2026-10-01' }), null);
assert.strictEqual(m.normPlan({ start: '2020-01-01', exam: '2026-10-01', items: [] }), null);   // 超過 400 天
const np = m.normPlan({ start: '2026-10-01', exam: '2026-10-11', items: [null, { name: 'a', hours: 'x' }, { id: 'k', name: 'ok', hours: 2 }, { id: 'k', name: 'dup', hours: 2 }, ...Array.from({ length: 80 }, (_, i) => ({ id: 'z' + i, name: 'n', hours: 1 }))], log: { '2026-10-02': { k: 1, gone: 3, z1: -2 }, bad: { k: 1 }, '2027-01-01': { k: 1 }, '2026-10-03': 'x' } });
assert.strictEqual(np.items.length, 50); assert.deepStrictEqual(np.log, { '2026-10-02': { k: 1 } });
assert.deepStrictEqual(m.normPlan({ start: '2026-10-01', exam: '2026-10-11', items: 'x', log: [] }).items, []);
ok('l4 plan');

// --- 課表 ---
assert.strictEqual(m.timeMin('08:10'), 490); assert.ok(Number.isNaN(m.timeMin('25:00'))); assert.ok(Number.isNaN(m.timeMin('')));
let tt = m.normTT(null); assert.deepStrictEqual(tt, { periods: [] });
tt = m.addPeriod(tt, 'p1').tt; tt = m.addPeriod(tt, 'p2').tt; assert.strictEqual(tt.periods[0].cells.length, 7);
assert.ok(m.setPeriodTime(tt, 'p1', '10:00', '09:00').err); assert.ok(m.setPeriodTime(tt, 'p1', 'xx', '').err);
tt = m.setPeriodTime(tt, 'p1', '08:10', '09:00').tt; tt = m.setPeriodTime(tt, 'p2', '09:10', '10:00').tt;
tt = m.setCell(tt, 'p1', 0, { n: '微積分', r: 'A101', m: '帶計算機' }); tt = m.setCell(tt, 'p2', 0, { n: '英文', r: 'B2', m: '' }); tt = m.setCell(tt, 'p2', 2, { n: '體育' });
assert.deepStrictEqual(m.classesOn(tt, 0).map(c => [c.idx, c.n, c.r]), [[1, '微積分', 'A101'], [2, '英文', 'B2']]);
assert.strictEqual(m.setCell(tt, 'p1', 9, { n: 'x' }), tt); assert.strictEqual(m.setCell(tt, 'p1', -1, { n: 'x' }), tt);
let nc = m.nextClass(tt, 0, 8 * 60); assert.strictEqual(nc.cur, null); assert.strictEqual(nc.next.n, '微積分'); assert.strictEqual(nc.off, 0);
nc = m.nextClass(tt, 0, 8 * 60 + 30); assert.strictEqual(nc.cur.n, '微積分'); assert.strictEqual(nc.next.n, '英文');
nc = m.nextClass(tt, 0, 12 * 60); assert.strictEqual(nc.cur, null); assert.strictEqual(nc.next.n, '體育'); assert.strictEqual(nc.off, 2);   // 週三
nc = m.nextClass(tt, 4, 12 * 60); assert.strictEqual(nc.next.n, '微積分'); assert.strictEqual(nc.off, 3);   // 週五 → 下週一
assert.strictEqual(m.nextClass(m.normTT(null), 0, 0).next, null);
assert.strictEqual(m.nextClass(tt, 0, 9 * 60 + 59).cur.n, '英文'); assert.strictEqual(m.nextClass(tt, 0, 10 * 60).cur, null);
tt = m.removePeriod(tt, 'p1'); assert.deepStrictEqual(tt.periods.map(p => p.id), ['p2']);
let t14 = { periods: [] }; for (let i = 0; i < 14; i++) t14 = m.addPeriod(t14).tt; assert.ok(m.addPeriod(t14).err.includes('14'));
// 載入驗證
const nt = m.normTT({ periods: [null, 3, { id: 'a', start: '99:99', end: '09:00', cells: [{ n: 'x'.repeat(50), r: 5 }, 'bad', null] }, { id: 'a' }, ...Array.from({ length: 20 }, (_, i) => ({ id: 'q' + i }))] });
assert.strictEqual(nt.periods.length, 14); assert.strictEqual(nt.periods[0].start, ''); assert.strictEqual(nt.periods[0].end, '09:00');
assert.ok(nt.periods.every(p => p.cells.length === 7 && p.cells.every(c => typeof c.n === 'string'))); assert.strictEqual(nt.periods[0].cells[0].n.length, 30); assert.strictEqual(nt.periods[0].cells[0].r, '');
assert.deepStrictEqual(m.normTT({ periods: 'x' }), { periods: [] });
ok('l4 timetable');

// --- 成績與 GPA ---
const T = m.normGP(m.DEFAULT_GP);
assert.strictEqual(m.lookupGP(T, 95).l, 'A+'); assert.strictEqual(m.lookupGP(T, 90).l, 'A+'); assert.strictEqual(m.lookupGP(T, '89.9').l, 'A'); assert.strictEqual(m.lookupGP(T, 60).l, 'C-'); assert.strictEqual(m.lookupGP(T, 59).l, 'F'); assert.strictEqual(m.lookupGP(T, 0).l, 'F');
assert.strictEqual(m.lookupGP(T, 'a-').g43, 3.7); assert.strictEqual(m.lookupGP(T, ' B ').g40, 3); assert.strictEqual(m.lookupGP(T, 101), null); assert.strictEqual(m.lookupGP(T, -1), null); assert.strictEqual(m.lookupGP(T, 'Z'), null); assert.strictEqual(m.lookupGP(T, ''), null);
assert.strictEqual(m.lookupGP(T, 'A+').g43, 4.3); assert.strictEqual(m.lookupGP(T, 'A+').g40, 4);
let a = m.weightedAvg([{ s: '80', w: '3' }, { s: 90, w: 2 }, { s: 'A', w: 5 }, { s: '70', w: 0 }, { s: '', w: 1 }, { s: '-5', w: 1 }]);
near(a.avg, 84); assert.strictEqual(a.n, 2); assert.ok(Number.isNaN(m.weightedAvg([]).avg));
let g = m.gpaOf([{ s: 95, w: 3 }, { s: 'B', w: 1 }, { s: 'zz', w: 2 }, { s: 80, w: 0 }], T, 'g43'); near(g.gpa, (4.3 * 3 + 3) / 4, 0.006); assert.strictEqual(g.skip, 1);
g = m.gpaOf([{ s: 95, w: 3 }], T, 'g40'); assert.strictEqual(g.gpa, 4);
assert.ok(Number.isNaN(m.gpaOf([], T, 'g40').gpa));
// 反推期末
let nf = m.needFinal([{ s: 80, w: 30 }, { s: 90, w: 20 }], 50, 60); near(nf.need, 36);
nf = m.needFinal([{ s: 80, w: 30 }, { s: 90, w: 20 }], 50, 90); near(nf.need, 96);
nf = m.needFinal([{ s: 50, w: 50 }], 50, 100); near(nf.need, 150);
nf = m.needFinal([{ s: 100, w: 50 }], 50, 40); assert.ok(nf.need <= 0);
near(m.needFinal([], 100, 60).need, 60);
assert.ok(Number.isNaN(m.needFinal([], 0, 60).need)); assert.ok(Number.isNaN(m.needFinal([], 'x', 60).need));
// 對照表可編輯與容錯
const T2 = m.normGP([{ min: 50, l: 'P', g43: 4, g40: 4 }, { min: 0, l: 'X', g43: 0, g40: 0 }, { min: 'x', l: 'bad' }, null, { min: 10, l: '', g43: 1, g40: 1 }]);
assert.deepStrictEqual(T2.map(r => r.l), ['P', 'X']); assert.strictEqual(m.lookupGP(T2, 70).l, 'P');
assert.strictEqual(m.normGP(null).length, 10); assert.strictEqual(m.normGP([]).length, 10);
assert.strictEqual(m.normGP(Array.from({ length: 30 }, (_, i) => ({ min: i, l: 'L' + i, g43: 1, g40: 1 }))).length, 20);
ok('l4 grade');
