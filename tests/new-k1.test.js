// 批次 k1：踩地雷小地圖計算、碼表圈數上限
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- minesweeper 小地圖 ----------
    const m = load('mini-games/minesweeper.html', 'miniCellPx, miniViewRect, miniScrollTarget');
    assert.equal(m.miniCellPx(30, 16), 5); assert.equal(m.miniCellPx(16, 16), 9); assert.equal(m.miniCellPx(9, 9), 16);
    assert.equal(m.miniCellPx(200, 200), 2);                                 // 下限 2px
    const v = { sl: 0, st: 0, cw: 300, ch: 400, sw: 600, sh: 800 };
    assert.deepEqual(m.miniViewRect(v, 150, 200), { x: 0, y: 0, w: 75, h: 100 });
    assert.deepEqual(m.miniViewRect({ ...v, sl: 300, st: 400 }, 150, 200), { x: 75, y: 100, w: 75, h: 100 });
    const r = m.miniViewRect({ ...v, sl: 450, st: 0 }, 150, 200); assert.ok(r.x + r.w <= 150);   // 不超出小地圖
    assert.deepEqual(m.miniViewRect({ sl: 0, st: 0, cw: 100, ch: 100, sw: 100, sh: 100 }, 80, 80), { x: 0, y: 0, w: 80, h: 80 });
    // 點擊 → 捲動：點中央 = 視窗中心對到該點；邊緣夾住
    assert.deepEqual(m.miniScrollTarget(75, 100, 150, 200, v), { left: 150, top: 200 });
    assert.deepEqual(m.miniScrollTarget(0, 0, 150, 200, v), { left: 0, top: 0 });
    assert.deepEqual(m.miniScrollTarget(150, 200, 150, 200, v), { left: 300, top: 400 });
    assert.deepEqual(m.miniScrollTarget(10, 10, 150, 200, { sl: 0, st: 0, cw: 500, ch: 500, sw: 400, sh: 400 }), { left: 0, top: 0 });   // 不可捲
    // 往返：點視窗方框中心 → 方框不動
    const t = m.miniScrollTarget(75, 100, 150, 200, v), r2 = m.miniViewRect({ ...v, sl: t.left, st: t.top }, 150, 200);
    assert.equal(r2.x + r2.w / 2, 75); assert.equal(r2.y + r2.h / 2, 100);
    ok('minesweeper minimap: cell px, view rect, click -> scroll');
}

{ // ---------- timers 圈數上限 ----------
    const m = load('fun/timers.html', 'addLap, lapsFull, MAX_LAPS, lapTimes');
    assert.equal(m.MAX_LAPS, 500);
    let t = [];
    for (let i = 1; i <= 600; i++) t = m.addLap(t, i * 1000);
    assert.equal(t.length, 500); assert.equal(t[499], 500000); assert.ok(m.lapsFull(t));
    assert.ok(!m.lapsFull(t.slice(0, 499)));
    const before = [1000]; assert.deepEqual(m.addLap(before, 2500), [1000, 2500]); assert.deepEqual(before, [1000]);   // 不改動輸入
    assert.equal(m.lapTimes(t).reduce((a, b) => a + b, 0), 500000);
    ok('timers: lap cap 500');
}
