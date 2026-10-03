const { load, ok } = require('./_load'); const assert = require('assert');
const ms = load('mini-games/minesweeper.html', 'cellSizeFor, isTap');
assert.strictEqual(ms.cellSizeFor(346, 30, true), 40);
assert.strictEqual(ms.cellSizeFor(346, 9, false), 34);        // 初級：上限 34
assert.strictEqual(ms.cellSizeFor(346, 30, false), 18);       // 高級縮全貌：下限 18
assert.ok(ms.cellSizeFor(346, 16, false) < 34 && ms.cellSizeFor(346, 16, false) >= 18);
ok('minesweeper zoom: cellSizeFor');
assert.ok(ms.isTap(2, 3, 120)); assert.ok(!ms.isTap(20, 0, 100)); assert.ok(!ms.isTap(0, -15, 100)); assert.ok(!ms.isTap(1, 1, 800));
ok('minesweeper zoom: isTap');
const u = load('mini-games/ultimate-ttt.html', 'newGame, play, focusBoard');
const s = u.newGame(1);
assert.strictEqual(u.focusBoard(s, -1), -1); assert.strictEqual(u.focusBoard(s, 4), 4);
u.play(s, 1, 0, 4);
assert.strictEqual(u.focusBoard(s, 7), 4);                    // 必須下的優先
s.next = -1; s.small[3] = 1;
assert.strictEqual(u.focusBoard(s, 3), -1);                   // 已結束的小棋盤不能當焦點
assert.strictEqual(u.focusBoard(s, 9), -1);
ok('ultimate-ttt focus: focusBoard');
