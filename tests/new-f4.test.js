const { load, ok, near } = require('./_load');
const assert = require('assert');
const m = load('utils/power-cost.html', 'RATES, itemKwh, meterKwh, periodDays, tierCost, calcBill, acSaving, normOpts, LIMITS');
const { RATES, itemKwh, meterKwh, periodDays, tierCost, calcBill, acSaving, normOpts, LIMITS } = m;

// 級距邊界（非夏月，1 個月）
near(tierCost(0, 'n', 1).cost, 0);
near(tierCost(120, 'n', 1).cost, 213.6);
near(tierCost(121, 'n', 1).cost, 213.6 + 2.26);
near(tierCost(330, 's', 1).cost, 120 * 1.78 + 210 * 2.55);
near(tierCost(331, 's', 1).cost, 120 * 1.78 + 210 * 2.55 + 3.80);
near(tierCost(700, 'n', 1).cost, 120 * 1.78 + 210 * 2.26 + 170 * 3.13 + 200 * 4.24);
near(tierCost(1000, 's', 1).cost, 120 * 1.78 + 210 * 2.55 + 170 * 3.80 + 200 * 5.14 + 300 * 6.44);
near(tierCost(1001, 's', 1).cost, tierCost(1000, 's', 1).cost + 8.46);
// 兩個月級距加倍
near(tierCost(240, 'n', 2).cost, 427.2);
near(tierCost(241, 'n', 2).cost, 427.2 + 2.26);
// 零、負、NaN、極大
assert.equal(tierCost(-5, 'n', 1).cost, 0); assert.equal(tierCost(NaN, 'n', 1).cost, 0); assert.equal(tierCost(10, 'n', 0).cost, 0);
const big = tierCost(1e9, 'n', 1); assert.ok(Number.isFinite(big.cost) && big.cost > 1e9 * 6.6 * 0.99 - 1e5);
ok('power-cost: tierCost boundaries / scale / zero / huge');

// 級距費率單調、夏月 >= 非夏月
for (let i = 1; i < RATES.tiers.length; i++) assert.ok(RATES.tiers[i].s >= RATES.tiers[i - 1].s && RATES.tiers[i].n >= RATES.tiers[i - 1].n);
RATES.tiers.forEach(t => assert.ok(t.s >= t.n));
ok('power-cost: rate table sane');

// calcBill 分段
near(calcBill(120, 0, 1).cost, 213.6); near(calcBill(330, 1, 1).cost, 749.1);
assert.equal(calcBill(0, 0.5, 2).cost, 0); assert.equal(calcBill(0, 0.5, 2).avg, 0);
// 一半夏月：度數對半，級距對半（2 個月，各 1 個月級距）
const half = calcBill(200, 0.5, 2); near(half.cost, tierCost(100, 's', 1).cost + tierCost(100, 'n', 1).cost); near(half.summerKwh, 100);
// 夏月比例夾在 0..1
near(calcBill(100, 5, 1).cost, calcBill(100, 1, 1).cost); near(calcBill(100, -1, 1).cost, calcBill(100, 0, 1).cost);
// 單調：度數越多費用越高
let prev = -1; for (let k = 0; k <= 2500; k += 7) { const c = calcBill(k, 0.3, 2).cost; assert.ok(c >= prev); prev = c; }
assert.ok(Number.isFinite(calcBill(1e12, 0.5, 2).cost));
ok('power-cost: calcBill split / clamp / monotone');

// 期間天數
let p = periodDays('2025-06-01', 2); assert.deepEqual(p, { summer: 61, total: 61 });
p = periodDays('2025-10-01', 2); assert.deepEqual(p, { summer: 0, total: 61 });
p = periodDays('2025-05-01', 2); assert.deepEqual(p, { summer: 30, total: 61 });   // 5/1–6/30：6 月 30 天
p = periodDays('2025-09-01', 2); assert.equal(p.summer, 30);                       // 9 月 30 天
p = periodDays('2025-01-01', 1); assert.deepEqual(p, { summer: 0, total: 31 });
p = periodDays('2025-12-15', 2); assert.equal(p.total, 62);
ok('power-cost: periodDays');

// 電器度數 / 電表
near(itemKwh({ w: 900, h: 6, d: 30 }, 1), 162); near(itemKwh({ w: 900, h: 6, d: 30 }, 2), 324);
assert.equal(itemKwh({ w: 'x', h: null }, 2), 0); near(itemKwh({ w: 1e9, h: 99, d: 99 }, 1), 20 * 24 * 31);
assert.equal(meterKwh(100, 350), 250); assert.equal(meterKwh('12345', '12815'), 470);
assert.equal(meterKwh('', 5), null); assert.equal(meterKwh(10, 5), null); assert.equal(meterKwh('a', 5), null); assert.equal(meterKwh(0, 0), 0);
assert.equal(meterKwh(0, 1e12), LIMITS.kwh);
ok('power-cost: itemKwh / meterKwh');

// 冷氣節電
const s = acSaving(400, 200, 0, 1); near(s.kwh, 12); near(s.money, calcBill(400, 0, 1).cost - calcBill(388, 0, 1).cost);
assert.ok(s.money > 12 * 2.2 && s.money < 12 * 3.2);
assert.equal(acSaving(0, 0, 0, 1).money, 0); near(acSaving(100, 500, 0, 1).kwh, 6);
ok('power-cost: acSaving');

// normOpts 容錯
const d = normOpts(null, '2025-07-15'); assert.equal(d.start, '2025-07-01'); assert.equal(d.months, 2); assert.equal(d.mode, 'items'); assert.deepEqual(d.items, []);
for (const bad of [undefined, 5, 'x', [], { items: 'x' }, { items: [null, 3, 'a'] }]) { const r = normOpts(bad, '2025-07-15'); assert.ok(Array.isArray(r.items)); assert.equal(r.start, '2025-07-01'); }
const r = normOpts({ start: '2025-02-30', months: 1, mode: 'meter', prev: '12.5', cur: 'abc', items: [{ name: 'x'.repeat(99), w: '9999999', h: -3, d: null }, { w: 5 }] }, '2025-07-15');
assert.equal(r.start, '2025-07-01'); assert.equal(r.months, 1); assert.equal(r.mode, 'meter'); assert.equal(r.prev, '12.5'); assert.equal(r.cur, '');
assert.equal(r.items[0].name.length, LIMITS.name); assert.equal(r.items[0].w, LIMITS.w); assert.equal(r.items[0].h, 0); assert.equal(r.items[0].d, 30); assert.deepEqual(r.items.map(i => i.id), [1, 2]);
assert.equal(normOpts({ items: Array.from({ length: 200 }, () => ({ name: 'a' })) }, '2025-07-15').items.length, LIMITS.items);
assert.equal(normOpts({ start: '2025-03-10' }, '2025-07-15').start, '2025-03-10');
ok('power-cost: normOpts');
