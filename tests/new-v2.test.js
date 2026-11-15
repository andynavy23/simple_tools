// 批次 v2：game-assist/game-tools.html 純邏輯（每日重置、全勤、DPS、強化馬可夫與模擬、載入驗證）
const assert = require('assert');
const { load, ok, near } = require('./_load');
const m = load('game-assist/game-tools.html', 'dayKey, weekKey, isDone, cleanDaily, streakStep, streakShow, dpsCalc, cleanOpts, parseProbs, enhExpect, enhSim, summarize, histogram, DAILY_CAP');
const H = 3600e3, T0 = Date.UTC(2026, 0, 5, 0, 0) - 8 * H; // 2026-01-05 (週一) 台灣 00:00

// 每日重置：05:00 前算前一天
assert.strictEqual(m.dayKey(T0 + 4 * H, 5), m.dayKey(T0 - 1 * H, 5));
assert.strictEqual(m.dayKey(T0 + 5 * H, 5), m.dayKey(T0 + 4 * H, 5) + 1);
const set = { dh: 5, wd: 1, wh: 5 };
const dt = { kind: 'd', done: T0 + 6 * H };
assert.ok(m.isDone(dt, T0 + 20 * H, set));
assert.ok(!m.isDone(dt, T0 + 24 * H + 6 * H, set));
assert.ok(!m.isDone({ kind: 'd', done: 0 }, T0, set));
// 每週：週一 05:00 重置；週日仍同一週、下週一 05:00 後換週
const wt = { kind: 'w', done: T0 + 6 * H };
assert.ok(m.isDone(wt, T0 + 6 * 24 * H + 3 * H, set));
assert.ok(!m.isDone(wt, T0 + 7 * 24 * H + 6 * H, set));
assert.ok(m.isDone(wt, T0 + 7 * 24 * H + 4 * H, set));
assert.strictEqual(new Date(m.weekKey(T0 + 6 * H, 1, 5) * 86400e3).getUTCDay(), 1);

// 全勤連續
let st = { last: 0, n: 0, pl: 0, pn: 0 };
st = m.streakStep(st, 100, true); assert.strictEqual(st.n, 1);
assert.strictEqual(m.streakStep(st, 100, true), st);
st = m.streakStep(st, 100, false); assert.strictEqual(st.n, 0);
st = m.streakStep(st, 100, true); st = m.streakStep(st, 101, true); assert.strictEqual(st.n, 2);
st = m.streakStep(st, 103, true); assert.strictEqual(st.n, 1);
assert.strictEqual(m.streakShow({ last: 100, n: 5 }, 102), 0);
assert.strictEqual(m.streakShow({ last: 101, n: 5 }, 102), 5);

// 載入驗證與上限
for (const bad of [null, 5, 'x', [], { games: 'x' }, { games: [null, 3, { id: 1 }, { id: 'a', tasks: [null, { id: 't', name: 5, kind: 'z', done: 'x' }] }], set: { dh: 99 }, streak: null }]) {
    const d = m.cleanDaily(bad);
    assert.ok(Array.isArray(d.games) && d.set.dh >= 0 && d.set.dh <= 23);
}
const d1 = m.cleanDaily({ games: [{ id: 'a', tasks: [null, { id: 't', name: 5, kind: 'z', done: 'x' }] }], set: { dh: 99 } });
assert.strictEqual(d1.set.dh, 5); assert.strictEqual(d1.games[0].tasks.length, 1); assert.strictEqual(d1.games[0].tasks[0].kind, 'd');
const big = m.cleanDaily({ games: Array.from({ length: 50 }, (_, i) => ({ id: 'g' + i, tasks: Array.from({ length: 50 }, (_, j) => ({ id: 't' + j, name: 'x' })) })) });
assert.strictEqual(big.games.length, m.DAILY_CAP.games); assert.strictEqual(big.games[0].tasks.length, m.DAILY_CAP.tasks);
const o = m.cleanOpts({ dps: { cfgs: [{ min: 'x' }] }, enh: { f: 'zzz', t: null } });
assert.strictEqual(o.dps.cfgs.length, 2); assert.strictEqual(o.enh.f, 'none'); assert.ok(m.cleanOpts(null).dps.cfgs.length === 2);

// DPS：暴擊率 50%、倍率 2 → 期望倍率 1.5
const r = m.dpsCalc({ min: 100, max: 100, crit: 50, mult: 2, mode: 'speed', speed: 2 });
near(r.critMult, 1.5); near(r.perHit, 150); near(r.dps, 300); near(r.critShare, 2 / 3);
near(m.dpsCalc({ min: 100, max: 200, crit: 0, mult: 2, mode: 'speed', speed: 1 }).dps, 150);
near(m.dpsCalc({ min: 100, max: 100, crit: 0, mult: 2, flat: 20, red: 50, pen: 50, mode: 'cd', cd: 3, cast: 1, hits: 2 }).dps, 120 * 0.75 * 0.5);
assert.ok(m.dpsCalc({ min: 200, max: 100, crit: 0, mult: 1, mode: 'speed', speed: 1 }).error);
assert.ok(m.dpsCalc({ min: 1, max: 1, crit: 150, mult: 1, mode: 'speed', speed: 1 }).error);

// 強化解析：成功率 100% → 次數 = 級數；單級無懲罰 1/p；歸零 p=.5 兩級 = 6；掉級單級 = 1/p
near(m.enhExpect(m.parseProbs('', 7, 100), 'reset', 1, 0).attempts, 7);
near(m.enhExpect([0.25], 'none', 10, 0).attempts, 4);
near(m.enhExpect([0.25], 'none', 10, 0).cost, 40);
near(m.enhExpect([0.5, 0.5], 'reset', 1, 0).attempts, 6);
near(m.enhExpect([0.2], 'drop', 1, 0).attempts, 5);
near(m.enhExpect([0.5], 'destroy', 10, 100).cost, 2 * 10 + 1 * 100); // 期望失敗 1 次
near(m.enhExpect([0.5, 0.5], 'drop', 1, 0).attempts, 6); // E0=2+E1... E1=1+.5E0+... 已知 6
assert.ok(m.enhExpect([0, 0.5], 'none', 1, 0).error);
assert.deepStrictEqual(m.parseProbs('90, 80', 3, 50), [0.9, 0.8, 0.5]);

// 模擬：固定種子可重現、與解析解接近、統計與直方圖
const probs = [0.5, 0.5, 0.5];
const a = m.enhSim(probs, 'drop', 10, 0, 20000, 7), b = m.enhSim(probs, 'drop', 10, 0, 20000, 7);
assert.deepStrictEqual(Array.from(a.att.slice(0, 50)), Array.from(b.att.slice(0, 50)));
const ex = m.enhExpect(probs, 'drop', 10, 0), s = m.summarize(a.cst);
assert.ok(Math.abs(s.mean / ex.cost - 1) < 0.05, `${s.mean} vs ${ex.cost}`);
assert.ok(s.median <= s.p90 && s.p90 <= s.p99);
assert.strictEqual(m.enhSim([1, 1], 'none', 5, 0, 1000, 1).cst.every(v => v === 10), true);
assert.strictEqual(m.enhSim(probs, 'none', 1, 0, 1000, 1, 100).n < 1000, true);
assert.strictEqual(m.histogram([1, 2, 3, 100], 4, 4).reduce((x, y) => x + y), 4);
ok('game-tools');
