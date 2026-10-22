// i7 批次：人情簿（gift-ledger）、訂閱服務管理（subscription-manager）、記帳本擴充（expense-tracker：50/30/20、財務自由、專案）、分帳計算擴充（split-bill：租屋水電瓦斯）
const { load, ok, near } = require('./_load');
const assert = require('assert');
const eq = assert.deepStrictEqual;

// ---------- 人情簿 ----------
const G = load('fun/gift-ledger.html', 'GL, EVENTS, twToday, validDate, normItem, normList, checkForm, addItem, updateItem, removeItem, markReturned, filterItems, totals, byPerson, lookup, reminders, csvGuard, toCsv');
const gf = (o = {}) => ({ dir: 'in', name: '王小明', rel: '同事', event: '結婚', kind: '現金', amt: '2200', date: '2024-05-01', remind: '', note: '', ...o });
{
    assert.strictEqual(G.twToday(Date.UTC(2026, 0, 31, 16, 30)), '2026-02-01');   // UTC+8
    assert.ok(G.validDate('2024-02-29') && !G.validDate('2023-02-29') && !G.validDate('1989-01-01') && !G.validDate(5));
    ok('gift: twToday / validDate');
}
{
    assert.strictEqual(G.normItem(null), null); assert.strictEqual(G.normItem({ name: '', date: '2024-01-01', amt: 1 }), null);
    assert.strictEqual(G.normItem({ name: 'a', date: '2024-13-01', amt: 1 }), null); assert.strictEqual(G.normItem({ name: 'a', date: '2024-01-01', amt: -1 }), null);
    assert.strictEqual(G.normItem({ name: 'a', date: '2024-01-01', amt: 'x' }), null);
    const it = G.normItem({ name: ' 阿美 ', date: '2024-01-01', amt: '1000.4', dir: 'zzz', event: '亂寫', kind: null, remind: '2024-02-01', note: 'x'.repeat(500) });
    assert.strictEqual(it.name, '阿美'); assert.strictEqual(it.dir, 'in'); assert.strictEqual(it.event, '其他'); assert.strictEqual(it.kind, '現金'); assert.strictEqual(it.amt, 1000);
    assert.strictEqual(it.remind, '2024-02-01'); assert.strictEqual(it.note.length, 200); assert.ok(it.id);
    assert.strictEqual(G.normItem({ name: 'a', date: '2024-01-01', amt: 1, dir: 'out', remind: '2024-02-01' }).remind, '');   // 送出沒有回禮提醒
    assert.strictEqual(G.normItem({ name: 'a', date: '2024-01-01', amt: 1, remind: '壞掉' }).remind, '');
    eq(G.normList('bad'), []); eq(G.normList(null), []);
    const l = G.normList([{ id: 'x', name: 'a', date: '2024-01-01', amt: 1 }, { id: 'x', name: 'b', date: '2024-01-01', amt: 1 }, 5, null, { name: '', date: '2024-01-01', amt: 1 }]);
    eq(l.map(x => x.name), ['a']);
    const big = Array.from({ length: 3100 }, (_, i) => ({ id: 'i' + i, name: 'n', date: '2024-01-01', amt: 1 }));
    assert.strictEqual(G.normList(big).length, 3000);
    ok('gift: normItem / normList validation, cap 3000');
}
{
    assert.ok(G.checkForm(gf({ name: ' ' }))); assert.ok(G.checkForm(gf({ name: 'x'.repeat(31) }))); assert.ok(G.checkForm(gf({ note: 'x'.repeat(201) })));
    assert.ok(G.checkForm(gf({ date: '' }))); assert.ok(G.checkForm(gf({ amt: '' }))); assert.ok(G.checkForm(gf({ amt: '-1' }))); assert.ok(G.checkForm(gf({ amt: '2e9' }))); assert.ok(G.checkForm(gf({ remind: '2024-99-99' })));
    assert.strictEqual(G.checkForm(gf()), ''); assert.strictEqual(G.checkForm(gf({ amt: '0', kind: '禮物' })), ''); assert.strictEqual(G.checkForm(gf({ note: 'x'.repeat(200) })), '');
    let list = []; let r = G.addItem(list, gf(), 'a'); list = r.list; assert.strictEqual(list.length, 1); assert.strictEqual(list[0].id, 'a');
    r = G.addItem(list, gf({ name: '李' }), 'b'); list = r.list;
    const full = Array.from({ length: 3000 }, (_, i) => ({ id: 'i' + i, dir: 'in', name: 'n', rel: '', event: '其他', kind: '現金', amt: 1, date: '2024-01-01', remind: '', note: '' }));
    const rf = G.addItem(full, gf()); assert.ok(rf.err.includes('3000')); assert.strictEqual(rf.list.length, 3000);       // 滿了拒絕、不刪舊資料
    const u = G.updateItem(list, 'b', gf({ name: '李2', amt: '500' })); eq(u.list.map(x => x.name), ['王小明', '李2']); assert.strictEqual(u.list[1].id, 'b'); assert.strictEqual(u.list[1].amt, 500);
    assert.ok(G.updateItem(list, 'zzz', gf()).err); assert.ok(G.updateItem(list, 'a', gf({ name: '' })).err);
    eq(G.removeItem(list, 'a').map(x => x.id), ['b']); assert.strictEqual(G.removeItem(list, 'nope').length, 2);
    ok('gift: form check / add / cap / update / remove by id');
}
{
    const mk = (id, dir, name, amt, date, extra = {}) => G.normItem({ id, dir, name, amt, date, event: '結婚', rel: '', ...extra });
    const items = [mk('1', 'in', '王', 2200, '2024-05-01', { rel: '同事', remind: '2026-10-20' }), mk('2', 'out', '王', 2600, '2026-03-01'), mk('3', 'out', '李', 1000, '2025-01-01', { event: '滿月' }), mk('4', 'in', '張', 600, '2025-06-01', { remind: '2026-10-30' })];
    const t = G.totals(items); assert.strictEqual(t.in, 2800); assert.strictEqual(t.out, 3600); assert.strictEqual(t.diff, 800); assert.strictEqual(t.nIn, 2); assert.strictEqual(t.nOut, 2);
    const ps = G.byPerson(items); eq(ps.map(p => p.name), ['王', '張', '李']);                      // 最近往來在前
    const w = ps[0]; assert.strictEqual(w.in, 2200); assert.strictEqual(w.out, 2600); assert.strictEqual(w.diff, 400); assert.strictEqual(w.rel, '同事'); assert.strictEqual(w.last, '2026-03-01');
    const lk = G.lookup(items, ' 王 '); assert.strictEqual(lk.nIn, 1); assert.strictEqual(lk.latest.id, '2'); assert.strictEqual(G.lookup(items, '不存在'), null); assert.strictEqual(G.lookup(items, ''), null); assert.strictEqual(G.lookup(items, '王小'), null);
    eq(G.filterItems(items, '', 'in', '').map(x => x.id), ['1', '4']); eq(G.filterItems(items, '', '', '滿月').map(x => x.id), ['3']); eq(G.filterItems(items, '同事', '', '').map(x => x.id), ['1']); eq(G.filterItems(items, '李', 'in', '').length, 0);
    const rm = G.reminders(items, '2026-10-22'); eq(rm.map(r => [r.it.id, r.days]), [['1', -2], ['4', 8]]);
    eq(G.reminders(G.markReturned(items, '1'), '2026-10-22').map(r => r.it.id), ['4']); assert.strictEqual(G.markReturned(items, '1')[0].amt, 2200);
    ok('gift: totals / byPerson / lookup / filter / reminders');
}
{
    assert.strictEqual(G.csvGuard('=A1'), "'=A1"); assert.strictEqual(G.csvGuard('@x'), "'@x"); assert.strictEqual(G.csvGuard('ok'), 'ok');
    const it = G.normItem({ id: '1', name: '=evil, "q"', rel: '+1', date: '2025-10-15', amt: 100, note: '@n\nx' });
    const rows = Util.parseCSV(G.toCsv([it]));
    eq(rows[0], ['日期', '收/送', '對象', '關係', '事由', '形式', '金額', '回禮提醒日', '備註']);
    eq(rows[1], ['2025-10-15', '收到', "'=evil, \"q\"", "'+1", '其他', '現金', '100', '', "'@n\nx"]);
    assert.strictEqual(G.toCsv([]).split('\r\n').length, 1);
    ok('gift: CSV escaping / formula guard');
}

// ---------- 訂閱服務管理 ----------
const S = load('utils/subscription-manager.html', 'SB, CATS, twToday, validDate, occAt, nextOccurrence, dueDates, yearlyOf, monthlyOf, overview, upcoming, next12, normItem, normList, checkForm, addItem, updateItem, removeItem, toggleIdle, filterItems, sortItems, csvGuard, toCsv');
const sf = (o = {}) => ({ name: 'Netflix', amt: '390', cycle: 'month', days: '30', cur: 'TWD', cc: '', rate: '', next: '2026-10-25', cat: '影音串流', share: '1', status: 'active', note: '', ...o });
const sm = (o) => S.normItem({ id: 'x' + Math.random(), name: 'n', amt: 100, cycle: 'month', cur: 'TWD', next: '2026-01-31', cat: '其他', share: 1, status: 'active', ...o });
{
    // 月底進位：1/31 每月 → 2/28、3/31（不會因 2/28 就一路變 28）
    const it = sm({ next: '2026-01-31' });
    eq([0, 1, 2, 3, 4].map(k => S.occAt(it, k)), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    assert.strictEqual(S.nextOccurrence(it, '2026-02-01'), '2026-02-28'); assert.strictEqual(S.nextOccurrence(it, '2026-02-28'), '2026-02-28'); assert.strictEqual(S.nextOccurrence(it, '2026-03-01'), '2026-03-31');
    assert.strictEqual(S.nextOccurrence(it, '2020-01-01'), '2026-01-31');                          // 還沒到第一次
    assert.strictEqual(S.nextOccurrence(it, '2030-02-15'), '2030-02-28');                          // 過期很久自動往後推
    const lp = sm({ next: '2024-02-29', cycle: 'year' }); eq([0, 1, 2, 4].map(k => S.occAt(lp, k)), ['2024-02-29', '2025-02-28', '2026-02-28', '2028-02-29']);
    const q = sm({ next: '2026-11-30', cycle: 'quarter' }); eq([0, 1, 2].map(k => S.occAt(q, k)), ['2026-11-30', '2027-02-28', '2027-05-30']);
    const dy = sm({ next: '2026-10-01', cycle: 'days', days: 10 }); eq([0, 1, 2].map(k => S.occAt(dy, k)), ['2026-10-01', '2026-10-11', '2026-10-21']);
    assert.strictEqual(S.nextOccurrence(dy, '2026-10-12'), '2026-10-21'); assert.strictEqual(S.nextOccurrence(dy, '2026-10-21'), '2026-10-21'); assert.strictEqual(S.nextOccurrence(dy, '2027-10-12'), '2027-10-16');
    const y1 = sm({ next: '2025-12-31', cycle: 'year' }); assert.strictEqual(S.nextOccurrence(y1, '2026-12-31'), '2026-12-31'); assert.strictEqual(S.nextOccurrence(y1, '2027-01-01'), '2027-12-31');
    ok('subs: 月底進位 / 年 / 季 / 自訂天數 / 過期推算');
}
{
    eq(S.dueDates(sm({ next: '2026-01-31' }), '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30']);
    eq(S.dueDates(sm({ next: '2026-10-01', cycle: 'days', days: 10 }), '2026-10-01', '2026-10-31'), ['2026-10-01', '2026-10-11', '2026-10-21', '2026-10-31']);
    eq(S.dueDates(sm({ next: '2027-01-01' }), '2026-10-01', '2026-10-31'), []);
    near(S.monthlyOf(sm({ amt: 390 })), 390); near(S.yearlyOf(sm({ amt: 390 })), 4680);
    near(S.monthlyOf(sm({ amt: 7200, cycle: 'year' })), 600); near(S.yearlyOf(sm({ amt: 900, cycle: 'quarter' })), 3600); near(S.monthlyOf(sm({ amt: 900, cycle: 'quarter' })), 300);
    near(S.yearlyOf(sm({ amt: 100, cycle: 'days', days: 10 })), 3650);
    near(S.monthlyOf(sm({ amt: 300, share: 4 })), 75); near(S.monthlyOf(sm({ amt: 10, cur: 'USD', rate: 32 })), 320); near(S.monthlyOf(sm({ amt: 10, cur: 'usd', rate: 32, share: 2 })), 160);
    ok('subs: dueDates / 週期換算 / 分攤 / 匯率');
}
{
    const a = sm({ id: 'a', name: 'Netflix', amt: 390, cat: '影音串流', next: '2026-10-25' }), b = sm({ id: 'b', name: 'Adobe', amt: 7200, cycle: 'year', cat: '軟體工具', next: '2026-11-15' }),
        c = sm({ id: 'c', name: '雲端', amt: 300, share: 4, cat: '雲端儲存', next: '2026-10-22' }), d = sm({ id: 'd', name: '舊的', amt: 999, status: 'cancelled', cat: '遊戲' }), e = sm({ id: 'e', name: '暫停', amt: 500, status: 'paused', cat: '遊戲' });
    const all = [a, b, c, d, e], ov = S.overview(all);
    assert.strictEqual(ov.count, 3); near(ov.monthly, 1065); near(ov.yearly, 12780); assert.strictEqual(ov.idle, 0);
    eq(ov.cats.map(x => [x.cat, x.monthly, x.pct]), [['軟體工具', 600, 56], ['影音串流', 390, 37], ['雲端儲存', 75, 7]]);
    eq(S.overview([d, e]), { count: 0, monthly: 0, yearly: 0, idle: 0, cats: [] }); eq(S.overview([]).cats, []);
    assert.strictEqual(S.overview([{ ...a, idle: true }, b]).idle, 1);
    const up = S.upcoming(all, '2026-10-22', 30);
    eq(up.map(x => [x.it.id, x.date, x.days, x.charge, x.mine]), [['c', '2026-10-22', 0, 300, 75], ['a', '2026-10-25', 3, 390, 390], ['b', '2026-11-15', 24, 7200, 7200]]);
    eq(S.upcoming(all, '2026-10-22', 30).some(x => x.it.id === 'd' || x.it.id === 'e'), false);                // 暫停 / 取消不列
    assert.strictEqual(S.upcoming(all, '2026-10-22', 31).length, 4);                                       // 30 天後的 11/22 在 31 天窗口內
    near(S.next12([a], '2026-10-22'), 390 * 12); near(S.next12([b], '2026-10-22'), 7200); near(S.next12([c], '2026-10-22'), 900);
    ok('subs: overview / upcoming / 年度');
}
{
    assert.strictEqual(S.normItem(null), null); assert.strictEqual(S.normItem({ name: '', next: '2026-01-01', amt: 1 }), null); assert.strictEqual(S.normItem({ name: 'a', next: '2026-02-30', amt: 1 }), null);
    assert.strictEqual(S.normItem({ name: 'a', next: '2026-01-01', amt: 0 }), null); assert.strictEqual(S.normItem({ name: 'a', next: '2026-01-01', amt: 'x' }), null);
    assert.strictEqual(S.normItem({ name: 'a', next: '2026-01-01', amt: 1, cur: 'USD' }), null);               // 外幣沒匯率 → 丟掉，避免算錯
    assert.strictEqual(S.normItem({ name: 'a', next: '2026-01-01', amt: 1, cur: 'USD', rate: -3 }), null);
    const it = S.normItem({ name: ' X ', next: '2026-01-31', amt: '12.346', cycle: '???', days: 'x', cur: 'USD', rate: 31.5, cat: '亂', share: 0, status: 'bad', idle: 'yes', note: 'n'.repeat(300) });
    assert.strictEqual(it.name, 'X'); assert.strictEqual(it.amt, 12.35); assert.strictEqual(it.cycle, 'month'); assert.strictEqual(it.days, 30); assert.strictEqual(it.cat, '其他'); assert.strictEqual(it.share, 1);
    assert.strictEqual(it.status, 'active'); assert.strictEqual(it.idle, false); assert.strictEqual(it.note.length, 100); assert.strictEqual(it.cur, 'USD'); assert.strictEqual(it.rate, 31.5);
    const t = S.normItem({ name: 'a', next: '2026-01-01', amt: 1, cur: 'twd', rate: 99 }); assert.strictEqual(t.cur, 'TWD'); assert.strictEqual(t.rate, 1);   // 台幣匯率固定 1
    assert.strictEqual(S.normItem({ name: 'a', next: '2026-01-01', amt: 1, cur: 'TOOLONGCUR', rate: 2 }).cur, 'TWD');
    eq(S.normList('x'), []); eq(S.normList([{ id: 'x', name: 'a', next: '2026-01-01', amt: 1 }, { id: 'x', name: 'b', next: '2026-01-01', amt: 1 }, null]).map(x => x.name), ['a']);
    assert.strictEqual(S.normList(Array.from({ length: 400 }, (_, i) => ({ id: 'i' + i, name: 'n', next: '2026-01-01', amt: 1 }))).length, 300);
    ok('subs: normItem / normList validation, cap 300');
}
{
    assert.ok(S.checkForm(sf({ name: '' }))); assert.ok(S.checkForm(sf({ name: 'x'.repeat(41) }))); assert.ok(S.checkForm(sf({ amt: '0' }))); assert.ok(S.checkForm(sf({ amt: '' }))); assert.ok(S.checkForm(sf({ next: '' })));
    assert.ok(S.checkForm(sf({ cycle: 'days', days: '0' }))); assert.ok(S.checkForm(sf({ cycle: 'days', days: '3651' }))); assert.strictEqual(S.checkForm(sf({ cycle: 'days', days: '14' })), '');
    assert.ok(S.checkForm(sf({ cur: 'X', cc: 'USD', rate: '' }))); assert.ok(S.checkForm(sf({ cur: 'X', cc: '美元', rate: '30' }))); assert.strictEqual(S.checkForm(sf({ cur: 'X', cc: 'usd', rate: '32' })), '');
    assert.ok(S.checkForm(sf({ share: '0' }))); assert.ok(S.checkForm(sf({ share: '51' }))); assert.ok(S.checkForm(sf({ share: '1.5' }))); assert.strictEqual(S.checkForm(sf()), '');
    let list = S.addItem([], sf(), 'a').list; list = S.addItem(list, sf({ name: 'B', cur: 'X', cc: 'usd', rate: '32', amt: '10', status: 'paused' }), 'b').list;
    assert.strictEqual(list[1].cur, 'USD'); assert.strictEqual(list[1].rate, 32); assert.strictEqual(list[1].status, 'paused');
    const full = Array.from({ length: 300 }, (_, i) => ({ ...list[0], id: 'i' + i })); const rf = S.addItem(full, sf()); assert.ok(rf.err.includes('300')); assert.strictEqual(rf.list.length, 300);
    const idleList = S.toggleIdle(list, 'a'); assert.strictEqual(idleList[0].idle, true); assert.strictEqual(S.toggleIdle(idleList, 'a')[0].idle, false);
    const u = S.updateItem(idleList, 'a', sf({ name: 'N2', amt: '100' })); assert.strictEqual(u.list[0].name, 'N2'); assert.strictEqual(u.list[0].id, 'a'); assert.strictEqual(u.list[0].idle, true);   // 編輯不洗掉「很久沒用」
    assert.ok(S.updateItem(list, 'zzz', sf()).err); assert.ok(S.updateItem(list, 'a', sf({ amt: '' })).err);
    eq(S.removeItem(list, 'a').map(x => x.id), ['b']); assert.strictEqual(S.removeItem(list, 'nope').length, 2);
    ok('subs: form check / add / cap / update / toggle idle / remove');
}
{
    const a = sm({ id: 'a', name: 'Zed', status: 'cancelled', next: '2026-10-23', note: '備註' }), b = sm({ id: 'b', name: 'Bee', next: '2026-11-30' }), c = sm({ id: 'c', name: 'Cee', next: '2026-10-25', cat: '音樂' }), d = sm({ id: 'd', name: 'Dee', status: 'paused' });
    eq(S.sortItems([a, b, c, d], '2026-10-22').map(x => x.id), ['c', 'b', 'd', 'a']);
    eq(S.filterItems([a, b, c, d], '', 'active', '').map(x => x.id), ['b', 'c']); eq(S.filterItems([a, b, c, d], 'bee', '', '').map(x => x.id), ['b']); eq(S.filterItems([a, b, c, d], '', '', '音樂').map(x => x.id), ['c']); eq(S.filterItems([a, b], '備註', '', '').map(x => x.id), ['a']);
    assert.strictEqual(S.csvGuard('=1+1'), "'=1+1");
    const it = sm({ id: 'z', name: '=evil, "q"', amt: 390, note: '@x', next: '2026-10-25', idle: true });
    const rows = Util.parseCSV(S.toCsv([it], '2026-10-22'));
    eq(rows[0].slice(0, 3), ['名稱', '每期金額', '幣別']); eq(rows[1].slice(0, 12), ["'=evil, \"q\"", '390', 'TWD', '1', '每月', '', '2026-10-25', '其他', '1', '使用中', '是', '390']); assert.strictEqual(rows[1][13], "'@x");
    assert.strictEqual(S.toCsv([], '2026-10-22').split('\r\n').length, 1);
    ok('subs: sort / filter / CSV');
}

// ---------- 記帳本擴充 ----------
const E = load('utils/expense-tracker.html', 'OUT_CATS, validEntry, cleanFx, summarize, toCSV, shiftMonth, validDate, normBudget, budgetPlan, budgetCompare, DEFAULT_MAP, DEFAULT_PCT, normSnap, normSnaps, snapNet, addSnap, removeSnap, sortSnaps, passiveOf, avgMonthlyExpense, fireStats, normTrips, cleanTrips, addTrip, removeTrip, tripSummary, MAX_SNAPS, MAX_TRIPS');
{
    // 舊資料完全相容：預算 / 快照 / 專案缺了都補預設，明細沒有 trip 欄位照常
    eq(E.normBudget(null), { map: E.DEFAULT_MAP, pct: { need: 50, want: 30, save: 20 }, income: 0 }); eq(E.normBudget('x').pct, E.DEFAULT_PCT);
    const b = E.normBudget({ map: { 餐飲: 'want', 交通: 'zzz', 亂: 'need' }, pct: { need: 60, want: 20, save: 20 }, income: '45000' });
    assert.strictEqual(b.map['餐飲'], 'want'); assert.strictEqual(b.map['交通'], 'need'); assert.ok(!('亂' in b.map)); eq(b.pct, { need: 60, want: 20, save: 20 }); assert.strictEqual(b.income, 45000);
    eq(E.normBudget({ pct: { need: 60, want: 30, save: 20 } }).pct, E.DEFAULT_PCT);                    // 加起來不是 100 → 回預設
    eq(E.normBudget({ pct: { need: 50.5, want: 29.5, save: 20 } }).pct, E.DEFAULT_PCT); eq(E.normBudget({ pct: { need: -10, want: 90, save: 20 } }).pct, E.DEFAULT_PCT);
    assert.strictEqual(E.normBudget({ income: -5 }).income, 0); assert.strictEqual(E.normBudget({ income: 'abc' }).income, 0);
    ok('expense: normBudget 驗證與預設');
}
{
    eq(E.budgetPlan(50000, { need: 50, want: 30, save: 20 }), { need: 25000, want: 15000, save: 10000 });
    // 餘數歸「需要」：33333.33 元 → 想要 / 儲蓄各捨去，其餘給需要，總和不變
    const p = E.budgetPlan(100.01, { need: 34, want: 33, save: 33 }); assert.strictEqual(Math.round((p.need + p.want + p.save) * 100), 10001); assert.strictEqual(p.want, 33); assert.strictEqual(p.save, 33); near(p.need, 34.01);
    const p2 = E.budgetPlan(0.07, { need: 50, want: 30, save: 20 }); assert.strictEqual(Math.round((p2.need + p2.want + p2.save) * 100), 7);
    eq(E.budgetPlan(0, E.DEFAULT_PCT), { need: 0, want: 0, save: 0 });
    const bud = E.normBudget(null);
    const entries = [{ id: '1', d: '2026-10-02', type: 'in', cat: '薪資', amt: 50000, note: '' }, { id: '2', d: '2026-10-03', type: 'out', cat: '居住', amt: 14000, note: '' }, { id: '3', d: '2026-10-04', type: 'out', cat: '餐飲', amt: 12000, note: '' }, { id: '4', d: '2026-10-05', type: 'out', cat: '娛樂', amt: 16000, note: '' }];
    const s = E.summarize(entries, '2026-10'), rows = E.budgetCompare(s.byCat, bud, s.income, s.balance);
    eq(rows.map(r => [r.key, r.plan, r.actual, r.over]), [['need', 25000, 26000, true], ['want', 15000, 16000, true], ['save', 10000, 8000, true]]);
    const ok2 = E.budgetCompare([['居住', 10000]], bud, 50000, 40000); eq(ok2.map(r => r.over), [false, false, false]);
    const none = E.budgetCompare([], bud, 0, 0); eq(none.map(r => r.plan), [0, 0, 0]);
    ok('expense: 50/30/20 分配、餘數歸屬、對照實際');
}
{
    assert.ok(E.validDate('2026-02-28') && !E.validDate('2026-02-30') && !E.validDate('x'));
    const a = { cash: 100000, invest: 500000, prop: 0, other: 0, debt: 20000 };
    assert.strictEqual(E.snapNet({ a }), 580000);
    let r = E.addSnap([], '2026-10-01', a, 's1'); assert.strictEqual(r.err, ''); assert.strictEqual(r.list[0].id, 's1');
    assert.ok(E.addSnap([], '', a).err); assert.ok(E.addSnap([], '2026-10-01', { ...a, cash: -1 }).err); assert.ok(E.addSnap([], '2026-10-01', { cash: 0, invest: 0, prop: 0, other: 0, debt: 0 }).err); assert.ok(E.addSnap([], '2026-10-01', { ...a, cash: 'abc' }).err);
    const partial = E.addSnap([], '2026-10-01', { cash: 5 }, 'p'); assert.strictEqual(partial.err, ''); assert.strictEqual(partial.list[0].a.invest, 0);          // 沒填的欄位補 0
    const full = Array.from({ length: 600 }, (_, i) => ({ id: 'i' + i, d: '2026-01-01', a })); const rf = E.addSnap(full, '2026-10-01', a); assert.ok(rf.err.includes('600')); assert.strictEqual(rf.list.length, 600);
    assert.strictEqual(E.normSnaps(Array.from({ length: 700 }, (_, i) => ({ id: 'i' + i, d: '2026-01-01', a }))).length, 600);
    eq(E.normSnaps('x'), []); eq(E.normSnaps([null, 5, { id: 'a', d: 'bad', a }, { id: 'b', d: '2026-01-01' }, { id: 'c', d: '2026-01-01', a: { cash: 'x' } }, { id: 'd', d: '2026-01-01', a: { cash: 1 } }, { id: 'd', d: '2026-01-02', a: { cash: 2 } }]).map(x => x.id), ['d']);
    eq(E.removeSnap(r.list, 's1'), []); assert.strictEqual(E.removeSnap(r.list, 'zz').length, 1);
    eq(E.sortSnaps([{ id: 'a', d: '2026-01-01' }, { id: 'b', d: '2026-03-01' }, { id: 'c', d: '2026-02-01' }]).map(x => x.id), ['b', 'c', 'a']);
    ok('expense: 資產快照驗證 / 上限 600 / 單筆刪除');
}
{
    const e = (d, type, cat, amt) => ({ id: d + cat + amt, d, type, cat, amt, note: '' });
    const ents = [e('2026-10-01', 'in', '投資', 8000), e('2026-10-02', 'in', '薪資', 50000), e('2026-10-03', 'out', '居住', 20000), e('2026-09-03', 'out', '居住', 10000), e('2025-10-03', 'out', '居住', 999999), e('2026-09-10', 'in', '投資', 5000)];
    assert.strictEqual(E.passiveOf(ents, '2026-10'), 8000); assert.strictEqual(E.passiveOf(ents, '2026-09'), 5000); assert.strictEqual(E.passiveOf(ents, '2026-01'), 0);
    // 近 12 個月：2026-10 往前 11 個月 = 2025-11，之前的 2025-10 不計；只除以「有支出的月份」
    assert.strictEqual(E.avgMonthlyExpense(ents, '2026-10'), 15000); assert.strictEqual(E.avgMonthlyExpense(ents, '2026-01'), 999999); assert.strictEqual(E.avgMonthlyExpense([], '2026-10'), 0);
    const f0 = E.fireStats([], 8000, 20000, 15000); assert.strictEqual(f0.net, null); assert.strictEqual(f0.progress, null); assert.strictEqual(f0.target, 15000 * 300); near(f0.coverage, 0.4);
    const a = { cash: 1e6, invest: 0, prop: 0, other: 0, debt: 0 };
    const f1 = E.fireStats([{ id: 'a', d: '2026-01-01', a }, { id: 'b', d: '2026-06-01', a: { ...a, cash: 2e6 } }], 0, 0, 10000); assert.strictEqual(f1.net, 2e6); assert.strictEqual(f1.latest.id, 'b'); near(f1.progress, 2e6 / 3e6); assert.strictEqual(f1.coverage, null);
    assert.strictEqual(E.fireStats([{ id: 'a', d: '2026-01-01', a }], 0, 0, 0).progress, null);        // 沒有支出 → 目標 0 → 不給進度
    ok('expense: 被動收入覆蓋率 / 平均月支出 / 財務自由進度');
}
{
    // 專案
    eq(E.normTrips('x'), []); eq(E.normTrips([null, { id: 'a', name: ' 日本 ', budget: '30000' }, { id: 'a', name: 'dup' }, { id: 'b', name: '' }, { id: 'c', name: 'C', budget: -5 }, { name: 'noid' }]), [{ id: 'a', name: '日本', budget: 30000 }, { id: 'c', name: 'C', budget: 0 }]);
    assert.strictEqual(E.normTrips(Array.from({ length: 80 }, (_, i) => ({ id: 'i' + i, name: 'n' + i }))).length, 50);
    let r = E.addTrip([], ' 日本 ', '30000', 't1'); assert.strictEqual(r.err, ''); eq(r.trips, [{ id: 't1', name: '日本', budget: 30000 }]);
    assert.ok(E.addTrip(r.trips, '日本', '').err); assert.ok(E.addTrip([], '', '').err); assert.ok(E.addTrip([], 'x'.repeat(21), '').err); assert.ok(E.addTrip([], 'a', '-1').err); assert.ok(E.addTrip([], 'a', 'abc').err);
    assert.strictEqual(E.addTrip([], 'a', '').trips[0].budget, 0);
    const many = Array.from({ length: 50 }, (_, i) => ({ id: 'i' + i, name: 'n' + i, budget: 0 })); assert.ok(E.addTrip(many, 'new', '').err.includes('50')); assert.strictEqual(E.addTrip(many, 'new', '').trips.length, 50);
    const trips = [{ id: 't1', name: '日本', budget: 30000 }, { id: 't2', name: '韓國', budget: 0 }];
    const en = [
        { id: '1', d: '2026-10-01', type: 'out', cat: '餐飲', amt: 260, note: '', trip: 't1', cur: 'JPY', fx: 1200, rate: 0.2167 },
        { id: '2', d: '2026-10-02', type: 'out', cat: '購物', amt: 1000, note: '', trip: 't1' },
        { id: '3', d: '2026-10-03', type: 'out', cat: '餐飲', amt: 500, note: '', trip: 't1', cur: 'JPY', fx: 2300, rate: 0.2174 },
        { id: '4', d: '2026-10-04', type: 'out', cat: '餐飲', amt: 80, note: '' }, { id: '5', d: '2026-10-05', type: 'in', cat: '其他', amt: 70, note: '', trip: 't1' }, { id: '6', d: '2026-10-06', type: 'out', cat: '交通', amt: 7, note: '', trip: 'ghost' }];
    const sm1 = E.tripSummary(en, trips[0]); assert.strictEqual(sm1.count, 3); assert.strictEqual(sm1.total, 1760); eq(sm1.byCur, [['JPY', 3500]]); eq(sm1.byCat, [['購物', 1000], ['餐飲', 760]]); assert.strictEqual(sm1.left, 28240);
    const sm2 = E.tripSummary(en, trips[1]); assert.strictEqual(sm2.count, 0); assert.strictEqual(sm2.left, null); eq(sm2.byCur, []);
    assert.strictEqual(E.tripSummary(en, { id: 't1', name: 'x', budget: 1000 }).left, -760);              // 超支為負
    // 載入清理：孤兒 / 壞型別的 trip 拿掉，明細保留
    const cl = E.cleanTrips(en.concat([{ id: '7', d: '2026-10-07', type: 'out', cat: '其他', amt: 1, note: '', trip: 5 }]), trips);
    assert.strictEqual(cl.length, 7); assert.strictEqual(cl[0].trip, 't1'); assert.ok(!('trip' in cl[5])); assert.ok(!('trip' in cl[6])); assert.ok(!('trip' in cl[3]));
    // 刪專案：明細保留、只拿掉標記，其他專案不動
    const rm = E.removeTrip(trips, en, 't1'); eq(rm.trips.map(t => t.id), ['t2']); assert.strictEqual(rm.entries.length, 6); assert.ok(rm.entries.every(x => x.trip !== 't1')); assert.strictEqual(rm.entries[5].trip, 'ghost'); assert.strictEqual(rm.entries[0].fx, 1200);
    ok('expense: 專案 normTrips / addTrip 上限 / 彙總 / 孤兒清理 / 刪除乾淨');
}
{
    // 舊資料（沒有 trip）完全相容：validEntry / cleanFx 不動；CSV 沒專案時欄位與舊版一樣
    const old = { id: '1', d: '2026-10-01', type: 'out', cat: '餐飲', amt: 100, note: 'n' };
    assert.ok(E.validEntry(old)); assert.deepStrictEqual(E.cleanFx(old), old); assert.ok(E.validEntry({ ...old, trip: 't1' })); assert.strictEqual(E.cleanFx({ ...old, trip: 't1', cur: 'JPY', fx: 10, rate: 0.2 }).trip, 't1');
    assert.strictEqual(E.toCSV([old]).split('\r\n')[0], '日期,收支,分類,金額,備註'); assert.strictEqual(E.toCSV([old], true).split('\r\n')[0], '日期,收支,分類,金額,備註,幣別,外幣金額,匯率');
    const csv = E.toCSV([old, { ...old, id: '2', trip: 't1' }, { ...old, id: '3', trip: 'gone' }], true, [{ id: 't1', name: '=日本', budget: 0 }]).split('\r\n');
    assert.strictEqual(csv[0], '日期,收支,分類,金額,備註,幣別,外幣金額,匯率,專案'); assert.strictEqual(csv[1], '2026-10-01,支出,餐飲,100,n,TWD,,,'); assert.strictEqual(csv[2], "2026-10-01,支出,餐飲,100,n,TWD,,,'=日本"); assert.strictEqual(csv[3], '2026-10-01,支出,餐飲,100,n,TWD,,,');
    ok('expense: 舊資料相容 / CSV 專案欄');
}

// ---------- 分帳計算：租屋水電瓦斯 ----------
const B = load('utils/split-bill.html', 'MAX_UMEMBERS, MAX_MONTHS, UKINDS, UMETHODS, validYm, apportion, monthShares, cumulative, elecRate, elecFromRate, checkMethods, normUtil, addMember, removeMember, addMonth, removeMonth, normBill, settle');
const sum = (a) => a.reduce((x, y) => x + y, 0);
{
    eq(B.apportion(1000, [1, 1]), [500, 500]); eq(B.apportion(100, [1, 1, 1]), [34, 33, 33]);      // 餘數先給前面的人
    eq(B.apportion(100, [8, 6]), [57, 43]); assert.strictEqual(sum(B.apportion(100, [8, 6])), 100);
    // 小數餘數最大者優先：100 分 → 權重 1:2:2 ；q = 20, 40, 40 剛好；101 分 → 20.2, 40.4, 40.4，剩 1 分給第一個餘數最大（並列取前面）
    eq(B.apportion(101, [1, 2, 2]), [20, 41, 40]);
    eq(B.apportion(10, [1, 1, 1]), [4, 3, 3]); eq(B.apportion(2, [1, 1, 1]), [1, 1, 0]); eq(B.apportion(0, [3, 4]), [0, 0]);
    eq(B.apportion(100, [0, 0]), [50, 50]); eq(B.apportion(101, [0, 0, 0]), [34, 34, 33]);              // 權重總和 0 → 平均
    eq(B.apportion(100, [0, 5]), [0, 100]);                                                              // 權重 0 的人不分
    for (const [t, w] of [[99999, [7.5, 6.3, 12.1]], [1, [1, 1]], [12345, [1, 2, 3, 4]], [777, [0.1, 0.2, 0.3]], [1000000007, [9, 8, 7, 6, 5]]]) { const r = B.apportion(t, w); assert.strictEqual(sum(r), t); assert.ok(r.every(x => x >= 0)); }
    ok('split-bill 水電: apportion 餘數歸屬（總和恆等於帳單）');
}
{
    const mem = [{ id: 'a', name: 'A', ping: 8 }, { id: 'b', name: 'B', ping: 6 }, { id: 'c', name: 'C', ping: 6 }];
    const month = { id: 'm', ym: '2026-10', items: { elec: { total: 100000, method: 'kwh' }, water: { total: 30001, method: 'equal' }, gas: { total: 20000, method: 'ping' } }, kwh: { a: 100, b: 50, c: 50 } };
    const sh = B.monthShares(month, mem);
    assert.strictEqual(sh.a.elec, 50000); assert.strictEqual(sh.b.elec, 25000); assert.strictEqual(sh.c.elec, 25000);
    eq([sh.a.water, sh.b.water, sh.c.water], [10001, 10000, 10000]);                  // 30001 / 3 = 10000.33 → 餘 1 分給第一位
    eq([sh.a.gas, sh.b.gas, sh.c.gas], [8000, 6000, 6000]);
    assert.strictEqual(sh.a.total + sh.b.total + sh.c.total, 150001);
    near(B.elecRate(month), 1000 / 200); assert.strictEqual(B.elecRate({ items: { elec: { total: 0 } }, kwh: {} }), null); assert.strictEqual(B.elecRate({ items: { elec: { total: 100 } }, kwh: {} }), null);
    assert.strictEqual(B.elecFromRate({ a: 100, b: 50, c: 50 }, 5.5), 110000); assert.strictEqual(B.elecFromRate({ a: 33.3 }, 4.28), Math.round(33.3 * 4.28 * 100));
    const u = { members: mem, months: [month, { ...month, id: 'm2', ym: '2026-11', items: { ...month.items, elec: { total: 0, method: 'equal' } } }] };
    const cu = B.cumulative(u); assert.strictEqual(cu.all, 150001 + 50001); assert.strictEqual(sum(Object.values(cu.per)), cu.all);
    assert.ok(B.checkMethods({ gas: { total: 1, method: 'ping' } }, {}, [{ id: 'a', ping: 0 }])); assert.ok(B.checkMethods({ elec: { total: 1, method: 'kwh' } }, {}, mem)); assert.strictEqual(B.checkMethods({ elec: { total: 1, method: 'kwh' } }, { a: 1 }, mem), '');
    assert.strictEqual(B.checkMethods({ elec: { total: 0, method: 'kwh' } }, {}, mem), '');
    ok('split-bill 水電: monthShares / 度數 / 坪數 / 電價 / 累計');
}
{
    let U = B.normUtil(null); eq(U, { members: [], months: [] }); eq(B.normUtil('x'), { members: [], months: [] });
    assert.ok(B.addMonth(U, { ym: '2026-10', items: { elec: { total: 100, method: 'equal' } }, kwh: {} }).err.includes('室友'));
    let r = B.addMember(U, ' A ', '8', 'a'); assert.strictEqual(r.err, ''); U = r.util; U = B.addMember(U, 'B', '', 'b').util; eq(U.members, [{ id: 'a', name: 'A', ping: 8 }, { id: 'b', name: 'B', ping: 0 }]);
    assert.ok(B.addMember(U, 'A', '').err); assert.ok(B.addMember(U, '', '').err); assert.ok(B.addMember(U, 'x'.repeat(13), '').err); assert.ok(B.addMember(U, 'C', '-1').err); assert.ok(B.addMember(U, 'C', 'abc').err);
    const ten = { members: Array.from({ length: 10 }, (_, i) => ({ id: 'i' + i, name: 'n' + i, ping: 0 })), months: [] }; assert.ok(B.addMember(ten, 'new', '').err.includes('10'));
    const items = (o = {}) => ({ elec: { total: 10000, method: 'equal' }, water: { total: 0, method: 'equal' }, gas: { total: 0, method: 'equal' }, ...o });
    assert.ok(B.addMonth(U, { ym: '', items: items(), kwh: {} }).err); assert.ok(B.addMonth(U, { ym: '2026-13', items: items(), kwh: {} }).err);
    assert.ok(B.addMonth(U, { ym: '2026-10', items: items({ elec: { total: 0, method: 'equal' } }), kwh: {} }).err);        // 全 0 拒絕
    assert.ok(B.addMonth(U, { ym: '2026-10', items: items({ elec: { total: -5, method: 'equal' } }), kwh: {} }).err); assert.ok(B.addMonth(U, { ym: '2026-10', items: items({ elec: { total: 1.5, method: 'equal' } }), kwh: {} }).err);
    assert.ok(B.addMonth(U, { ym: '2026-10', items: items({ elec: { total: 100, method: 'ping' } }), kwh: {} }).err);          // B 沒坪數
    assert.ok(B.addMonth(U, { ym: '2026-10', items: items({ elec: { total: 100, method: 'kwh' } }), kwh: {} }).err);
    r = B.addMonth(U, { ym: '2026-10', items: items({ elec: { total: 100, method: 'kwh' } }), kwh: { a: 3, b: 1, zzz: 9 } }, 'm1'); assert.strictEqual(r.err, ''); eq(r.util.months[0].kwh, { a: 3, b: 1 });   // 非成員度數丟掉
    U = r.util;
    assert.ok(B.addMonth(U, { ym: '2026-10', items: items(), kwh: {} }).err.includes('已經'));                              // 同月重複
    assert.ok(B.removeMember(U, 'a').err); eq(B.removeMember(U, 'a').util, U);                                             // 有月份時不能移除室友
    U = B.removeMonth(U, 'm1'); assert.strictEqual(U.months.length, 0); eq(B.removeMember(U, 'a').util.members.map(m => m.id), ['b']); assert.strictEqual(B.removeMonth(U, 'nope').months.length, 0);
    // 60 個月上限
    let big = { members: [{ id: 'a', name: 'A', ping: 0 }], months: [] };
    for (let i = 0; i < 60; i++) big = B.addMonth(big, { ym: `${2000 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`, items: items(), kwh: {} }, 'k' + i).util;
    assert.strictEqual(big.months.length, 60); const rb = B.addMonth(big, { ym: '2030-01', items: items(), kwh: {} }); assert.ok(rb.err.includes('60')); assert.strictEqual(rb.util.months.length, 60);
    ok('split-bill 水電: addMember / addMonth 驗證、重複月、上限 60、刪除');
}
{
    assert.ok(B.validYm('2026-10') && !B.validYm('2026-00') && !B.validYm('2026-13') && !B.validYm('26-10') && !B.validYm(5));
    // 載入驗證：壞資料、舊備份
    const raw = {
        members: [{ id: 'a', name: 'A', ping: 8 }, { id: 'a', name: 'dup', ping: 1 }, { id: 'b', name: ' B ', ping: 'x' }, null, { id: 'c', name: '', ping: 1 }, { name: 'noid' }, { id: 'd', name: 'x'.repeat(13) }],
        months: [
            { id: 'm1', ym: '2026-10', items: { elec: { total: 100, method: 'kwh' }, water: { total: 50, method: 'ping' }, gas: { total: 'x', method: 'zzz' } }, kwh: { a: 2, b: 'x', ghost: 5 } },
            { id: 'm2', ym: '2026-10', items: { elec: { total: 100, method: 'equal' } }, kwh: {} },
            { id: 'm3', ym: 'bad', items: { elec: { total: 100 } } }, { id: 'm4', ym: '2026-09', items: {}, kwh: {} }, null, { ym: '2026-08', items: { elec: { total: 100 } } },
            { id: 'm5', ym: '2026-07', items: { elec: { total: 100, method: 'ping' } }, kwh: null },
        ],
    };
    const n = B.normUtil(raw);
    eq(n.members, [{ id: 'a', name: 'A', ping: 8 }, { id: 'b', name: 'B', ping: 0 }]);
    eq(n.months.map(m => m.id), ['m1', 'm5']); eq(n.months[0].kwh, { a: 2 }); assert.strictEqual(n.months[0].items.elec.method, 'kwh'); assert.strictEqual(n.months[0].items.water.method, 'equal');    // 沒人有坪數資料（B 沒坪數）→ 降為平均
    assert.strictEqual(n.months[0].items.gas.total, 0); assert.strictEqual(n.months[1].items.elec.method, 'equal');
    const many = { members: [{ id: 'a', name: 'A' }], months: Array.from({ length: 100 }, (_, i) => ({ id: 'i' + i, ym: `${2000 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`, items: { elec: { total: 100, method: 'equal' } } })) };
    assert.strictEqual(B.normUtil(many).months.length, 60); assert.strictEqual(B.normUtil({ members: Array.from({ length: 20 }, (_, i) => ({ id: 'i' + i, name: 'n' + i })) }).members.length, 10);
    // 舊資料遷移：沒有 bill_util（舊使用者）→ 空；既有 bill_state 行為不變
    eq(B.normUtil(undefined), { members: [], months: [] });
    eq(B.normBill({ people: ['A', 'B'], expenses: [{ payer: 'A', amount: 100, shares: ['A', 'B'], desc: 'x' }] }).expenses.length, 1);
    ok('split-bill 水電: normUtil 驗證 / 降級 / 上限 / 舊資料');
}
