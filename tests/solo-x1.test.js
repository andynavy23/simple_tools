const { load, ok } = require('./_load'); const assert = require('assert');
const m = load('mini-games/battleship.html', 'key, cellsOf, shotResult, sunkCells, applyResult, markSunk');
const { key, cellsOf, shotResult, sunkCells, applyResult, markSunk } = m;

// 兩艘相鄰的船：長 2 橫放 (0,0)-(0,1)，長 3 橫放 (1,0)-(1,2)；長 2 沉在 (0,0)，附近 (1,0) 已命中但還沒沉
const fleet = [{ r: 0, c: 0, len: 2, h: 1 }, { r: 1, c: 0, len: 3, h: 1 }];
const shots = new Set([key(1, 0), key(1, 1), key(0, 1)]);          // 打過長 3 的兩格 + 長 2 的一格
const res = shotResult(fleet, shots, 0, 0);
assert.deepStrictEqual(res, { hit: true, sunk: 2 });
const cells = sunkCells(fleet, 0, 0);
assert.deepStrictEqual(cells, [[0, 0], [0, 1]]);

const mk = () => new Map([[key(1, 0), 1], [key(1, 1), 1], [key(0, 1), 1]]);
// 精準：只有長 2 那艘標成已沉，長 3 的命中仍是 1（電腦還會繼續追）
const exact = mk(); applyResult(exact, { r: 0, c: 0, hit: true, sunk: 2, cells });
assert.strictEqual(exact.get(key(0, 0)), 2); assert.strictEqual(exact.get(key(0, 1)), 2);
assert.strictEqual(exact.get(key(1, 0)), 1); assert.strictEqual(exact.get(key(1, 1)), 1);
// 沒帶 cells（連線格式）：走原本的推測，結果可能不同，但不得拋錯且至少標到被打的格
const guess = mk(); applyResult(guess, { r: 0, c: 0, hit: true, sunk: 2 });
assert.strictEqual(guess.get(key(0, 0)), 2);
ok('battleship solo: adjacent ships — exact sunk cells (guess path unchanged)');

// 隨機艦隊：每次沉船精準標的格 = 該船所有格
const fleet2 = [{ r: 2, c: 2, len: 5, h: 0 }, { r: 2, c: 3, len: 4, h: 0 }];
const sh = new Set(); let last;
for (const [r, c] of cellsOf(fleet2[1])) { last = shotResult(fleet2, sh, r, c); sh.add(key(r, c)); }
assert.strictEqual(last.sunk, 4);
assert.deepStrictEqual(sunkCells(fleet2, 5, 3), cellsOf(fleet2[1]));
ok('battleship solo: sunkCells equals whole ship');
