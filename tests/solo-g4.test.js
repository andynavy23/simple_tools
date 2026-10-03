const { load, ok } = require('./_load'); const assert = require('assert');

const lp = load('fun/live-poll.html', 'soloPoints, simWeights, simVotes, tally');
assert.strictEqual(lp.soloPoints(false, 0, 30000), 0);
assert.strictEqual(lp.soloPoints(true, 0, 30000), 150);
assert.strictEqual(lp.soloPoints(true, 15000, 30000), 125);
assert.strictEqual(lp.soloPoints(true, 99999, 30000), 100);
assert.strictEqual(lp.soloPoints(true, 5000, 0), 100);
const rnd = Util.seeded(7);
const w = lp.simWeights(4, rnd);
assert.ok(w.length === 4 && w.every(x => x >= 0.1));
const v = lp.simVotes(w, 500, rnd);
assert.strictEqual(v.length, 500);
assert.ok(v.every(o => Number.isInteger(o) && o >= 0 && o < 4));
assert.strictEqual(lp.tally(v, 4).reduce((a, b) => a + b, 0), 500);
const top = w.indexOf(Math.max(...w)), c = lp.tally(v, 4);
assert.ok(c[top] >= Math.max(...c) * 0.8, 'heaviest weight should lead (loose)');
assert.deepStrictEqual(lp.simVotes([1, 1], 0), []);
ok('live-poll solo: points, weights, simulated votes');

const pp = load('fun/planning-poker.html', 'soloNext, soloSeats, stats');
assert.strictEqual(pp.soloNext([null, '3', null], 1), 2);
assert.strictEqual(pp.soloNext([null, '3', null], 3), 0);
assert.strictEqual(pp.soloNext(['1', '3'], 0), -1);
assert.deepStrictEqual(pp.soloSeats(['a', 'b'], ['5', null], false), [{ n: 'a', voted: true, v: null }, { n: 'b', voted: false, v: null }]);
assert.strictEqual(pp.soloSeats(['a'], ['5'], true)[0].v, '5');
const st = pp.stats('fib', ['3', '8', '8']);
assert.strictEqual(st.median, 8); assert.strictEqual(st.avg, 6.3); assert.strictEqual(st.agree, false);
ok('planning-poker solo: hot-seat turn order and reveal stats');
