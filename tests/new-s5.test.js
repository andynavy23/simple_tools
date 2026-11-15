// 批次 s5：arcade 新增「吃豆人」「彈珠台」純邏輯（迷宮、鬼魂決策、碰撞與反彈、固定步長模擬；全部用固定步數，不跑真實時間）
const assert = require('assert');
const { load, ok } = require('./_load');
const A = load('mini-games/arcade.html', 'PM_MAZE, PM_W, PM_H, PM_START, PM_DIRS, pmCell, pmOkPac, pmOkGhost, pmBfs, pmMove, pmGhostDir, pmGhostTarget, pmMake, pmStep, pmPlace, pmSpeed, pmFright, PB, PB_WALLS, PB_BUMP, PB_TGT, pbSeg, pbCirc, pbIntegrate, pbMake, pbStep, pbFlipSeg, GAME_IDS, cleanMap');
const DT = 1 / 60;

// ---- 吃豆人：迷宮 ----
const M = A.PM_MAZE;
assert.strictEqual(M.length, A.PM_H); assert.ok(M.every(r => r.length === A.PM_W));
assert.ok(M.every(r => r === [...r].reverse().join('')), '左右對稱');
{
    const seen = new Set(['7,16']), q = [[7, 16]];
    while (q.length) { const [x, y] = q.shift(); for (const d of A.PM_DIRS) { const nx = (x + d[0] + A.PM_W) % A.PM_W, ny = y + d[1]; if (A.pmOkPac(nx, ny) && !seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); q.push([nx, ny]); } } }
    for (let y = 0; y < A.PM_H; y++) for (let x = 0; x < A.PM_W; x++) {
        if (A.pmOkPac(x, y)) {
            assert.ok(seen.has(x + ',' + y), `(${x},${y}) 到不了`);
            assert.ok(A.PM_DIRS.filter(d => A.pmOkPac((x + d[0] + A.PM_W) % A.PM_W, y + d[1])).length >= 2, `(${x},${y}) 死路`);
        }
    }
    assert.ok(A.pmOkPac(-1, 10) && A.pmOkPac(15, 10) && A.pmCell(-1, 10) === ' ', '隧道');
    assert.ok(!A.pmOkPac(7, 7) && A.pmOkGhost(7, 7, 'leave') && !A.pmOkGhost(7, 7, 'out'), '鬼屋門');
}
// 最短路
assert.deepStrictEqual(A.pmBfs(7, 6, 7, 8, (x, y) => A.pmOkGhost(x, y, 'eaten')), [0, 1]);
assert.deepStrictEqual(A.pmBfs(7, 8, 7, 6, (x, y) => A.pmOkGhost(x, y, 'leave')), [0, -1]);
assert.deepStrictEqual(A.pmBfs(7, 8, 7, 8, A.pmOkPac), [0, 0]);
assert.deepStrictEqual(A.pmBfs(7, 16, 7, 8, A.pmOkPac), [0, 0], '吃豆人進不了鬼屋');
assert.deepStrictEqual(A.pmBfs(1, 10, 13, 10, A.pmOkPac), [-1, 0], '走隧道比較近');

// 移動：走過整格會到下一格、撞牆停住
{
    const e = { x: 1, y: 3, dx: 1, dy: 0, t: 0 }, calls = [];
    A.pmMove(e, 2.5, (c) => { calls.push(c.x); return [1, 0]; });
    assert.strictEqual(e.x, 3); assert.ok(Math.abs(e.t - .5) < 1e-9); assert.deepStrictEqual(calls, [2, 3]);
    const w = { x: 1, y: 1, dx: 0, dy: 0, t: 0 }; A.pmMove(w, 5, () => [0, 0]); assert.deepStrictEqual([w.x, w.y, w.dx, w.dy], [1, 1, 0, 0]);
}

// 鬼魂決策
const R = (seed) => Util.seeded(seed);
const mkS = (over = {}) => Object.assign(A.pmMake(1, 0, 3, 't'), over);
{
    const s = mkS(), g = s.gh[0];
    // 追擊：紅鬼選擇離玩家最近的方向，且不回頭
    s.mode = 'chase'; s.pac.x = 13; s.pac.y = 3; Object.assign(g, { x: 1, y: 3, dx: 1, dy: 0, st: 'out' });
    assert.deepStrictEqual(A.pmGhostDir(s, g), [1, 0]);
    Object.assign(g, { x: 5, y: 3, dx: 1, dy: 0 }); s.pac.x = 5; s.pac.y = 1;
    assert.deepStrictEqual(A.pmGhostDir(s, g), [0, -1], '往玩家方向');
    // 不回頭：玩家在後方也不能直接掉頭
    Object.assign(g, { x: 7, y: 3, dx: 1, dy: 0 }); s.pac.x = 1; s.pac.y = 3;
    assert.notDeepStrictEqual(A.pmGhostDir(s, g), [-1, 0]);
    // 模式切換 rev：強制回頭一次
    g.rev = true; assert.deepStrictEqual(A.pmGhostDir(s, g), [-1, 0]); assert.strictEqual(g.rev, false);
    // 散開：去自己的角落
    s.mode = 'scatter'; Object.assign(g, { x: 13, y: 3, dx: 0, dy: -1, rev: false }); s.pac.x = 1; s.pac.y = 18;
    assert.deepStrictEqual(A.pmGhostDir(s, g), [0, -1], '紅鬼角落在右上');
    // 目標：紅追人、粉在玩家前 4 格、藍無目標（隨機）、橙近時回角落
    s.mode = 'chase'; s.pac.x = 5; s.pac.y = 5; s.pac.fx = 1; s.pac.fy = 0;
    assert.deepStrictEqual(A.pmGhostTarget(s, { id: 0 }), [5, 5]); assert.deepStrictEqual(A.pmGhostTarget(s, { id: 1 }), [9, 5]); assert.strictEqual(A.pmGhostTarget(s, { id: 2 }), null);
    assert.deepStrictEqual(A.pmGhostTarget(s, { id: 3, x: 5, y: 6 }), [0, 19]); assert.deepStrictEqual(A.pmGhostTarget(s, { id: 3, x: 5, y: 17 }), [5, 5]);
    // 驚嚇時隨機（同種子可重現）且合法
    const a = [], b = [];
    for (const out of [a, b]) { const t = mkS(); t.rand = R('f'); const h = t.gh[0]; Object.assign(h, { x: 3, y: 3, dx: 1, dy: 0, st: 'out', fr: true }); for (let i = 0; i < 20; i++) { const d = A.pmGhostDir(t, h); assert.ok(A.pmOkGhost(h.x + d[0], h.y + d[1], 'out')); out.push(d.join()); } }
    assert.deepStrictEqual(a, b);
}
// 被吃的鬼：從各處都能走最短路回到鬼屋並重生離巢
for (const [x, y] of [[1, 1], [13, 18], [10, 12], [5, 5], [1, 10]]) {
    const s = mkS({ ready: 0 }), g = s.gh[0]; Object.assign(g, { x, y, dx: 0, dy: 0, t: 0, st: 'eaten', fr: false });
    s.pac.want = [0, 0]; s.pac.x = 7; s.pac.y = 16; let n = 0;
    while (g.st !== 'out' && n++ < 60 * 20) { A.pmMove(g, 2.4 * 5 * DT, (e) => A.pmGhostDir(s, e)); }
    assert.strictEqual(g.st, 'out', `(${x},${y}) 回不了巢`); assert.ok(n < 60 * 20);
}

// 玩家：不能穿牆、轉向要等到路口、半格可掉頭
{
    const s = mkS({ ready: 0 }); s.gh.forEach(g => { g.wait = 1e9; }); s.pac.want = [-1, 0];
    for (let i = 0; i < 60 * 8; i++) { A.pmStep(s, DT); assert.ok(A.pmOkPac(s.pac.x, s.pac.y)); }
    const mid = mkS({ ready: 0 }); mid.gh.forEach(g => { g.wait = 1e9; }); mid.pac.want = [1, 0]; A.pmStep(mid, DT); A.pmStep(mid, DT);
    mid.pac.want = [-1, 0]; A.pmStep(mid, DT); assert.strictEqual(mid.pac.dx, -1, '可以立刻掉頭');
}
// 吃豆 / 大力丸 / 吃鬼連續加分 / 水果 / 死亡 / 過關
{
    const s = mkS({ ready: 0 }); s.gh.forEach(g => { g.wait = 1e9; }); const d0 = s.dots;
    s.pac.want = [-1, 0]; for (let i = 0; i < 60; i++) A.pmStep(s, DT);
    assert.ok(s.dots < d0 && s.score === (d0 - s.dots) * 10 && s.ev.includes('dot'));
    // 大力丸
    const p = mkS({ ready: 0 }); p.gh.forEach(g => { g.wait = 1e9; }); Object.assign(p.pac, { x: 2, y: 1, dx: 0, dy: 0, t: 0, want: [-1, 0] }); p.grid[1][1] = 2;
    for (let i = 0; i < 20; i++) A.pmStep(p, DT);
    assert.ok(p.fright > 0 && p.ev.includes('power') && p.gh[0].fr, '吃大力丸後鬼驚嚇');
    // 吃鬼：200 / 400 / 800
    const q = mkS({ ready: 0 }); q.gh.forEach(g => { g.wait = 1e9; }); q.pac.want = [0, 0]; q.fright = 5;
    q.gh[0].fr = q.gh[1].fr = q.gh[2].fr = true; q.gh[0].x = q.gh[1].x = q.gh[2].x = 7; q.gh[0].y = q.gh[1].y = q.gh[2].y = 16; Object.assign(q.gh[0], { st: 'out' }); Object.assign(q.gh[1], { st: 'out' }); Object.assign(q.gh[2], { st: 'out' });
    A.pmStep(q, DT); assert.strictEqual(q.score, 200 + 400 + 800); assert.ok(q.gh.slice(0, 3).every(g => g.st === 'eaten'));
    // 驚嚇結束
    const f = mkS({ ready: 0 }); f.gh.forEach(g => { g.wait = 1e9; }); f.pac.want = [0, 0]; f.fright = .05; f.gh[0].fr = true; for (let i = 0; i < 5; i++) A.pmStep(f, DT);
    assert.strictEqual(f.fright, 0); assert.strictEqual(f.gh[0].fr, false);
    // 水果
    const fr = mkS({ ready: 0 }); fr.gh.forEach(g => { g.wait = 1e9; }); fr.eaten = 70; Object.assign(fr.pac, { x: 7, y: 11, dx: 0, dy: 0, t: 0, want: [0, -1] }); fr.grid[10][7] = 0;
    for (let i = 0; i < 20; i++) A.pmStep(fr, DT); assert.ok(fr.ev.includes('fruit') && fr.score >= 100 && fr.fruit === 0);
    // 死亡 → 重置位置 → 沒命就結束
    const d = mkS({ ready: 0 }); d.gh.forEach(g => { g.wait = 1e9; }); d.pac.want = [0, 0]; Object.assign(d.gh[0], { x: 7, y: 16, dx: 0, dy: 0, st: 'out' });
    A.pmStep(d, DT); assert.strictEqual(d.lives, 2); assert.ok(d.dead > 0);
    for (let i = 0; i < 60 * 2; i++) A.pmStep(d, DT); assert.ok(!d.over && d.dead === 0 && d.pac.y === 16 && d.ready > 0, '重置');
    d.lives = 1; d.ready = 0; Object.assign(d.gh[0], { x: 7, y: 16, dx: 0, dy: 0, st: 'out', t: 0 }); d.pac.want = [0, 0]; A.pmStep(d, DT); for (let i = 0; i < 60 * 2; i++) A.pmStep(d, DT); assert.ok(d.over && d.lives === 0);
    // 過關：關卡數 +1、分數與命保留、加速
    const c = mkS({ ready: 0 }); c.gh.forEach(g => { g.wait = 1e9; }); c.score = 500; c.grid.forEach(r => r.fill(0)); c.grid[16][6] = 1; c.dots = 1; c.pac.want = [-1, 0];
    for (let i = 0; i < 30; i++) A.pmStep(c, DT);
    assert.strictEqual(c.level, 2); assert.ok(c.score >= 510 && c.lives === 3 && c.ev.includes('clear') && c.dots > 100);
    assert.ok(A.pmSpeed(2) > A.pmSpeed(1) && A.pmSpeed(99) <= 8.0001 && A.pmFright(9) >= 1.5 && A.pmFright(2) < A.pmFright(1));
}
// 長時間模擬不變式（同種子 = 同結果；鬼不穿牆、外面的鬼不進鬼屋）
{
    const sim = () => {
        const s = A.pmMake(1, 0, 3, 'sim'), w = R('wander'); let n = 0;
        for (; n < 60 * 150 && !s.over; n++) {
            if (n % 12 === 0) s.pac.want = A.PM_DIRS[w.int(4)];
            A.pmStep(s, DT); s.ev.length = 0;
            for (const g of s.gh) { const c = A.pmCell(g.x, g.y); assert.ok(c !== '#', '鬼在牆裡'); if (g.st === 'out') assert.ok(c !== 'H' && c !== '-', '外面的鬼進了鬼屋'); }
            assert.ok(A.pmOkPac(s.pac.x, s.pac.y));
        }
        return [n, s.score, s.lives, s.dots, s.gh.map(g => g.x + ',' + g.y + g.st).join('|')].join(';');
    };
    assert.strictEqual(sim(), sim(), '同種子可重現');
}

// ---- 彈珠台 ----
const ball = (o) => Object.assign({ x: 0, y: 0, vx: 0, vy: 0 }, o);
{
    // 撞牆反彈：法線分量依恢復係數反向，切線分量不變，球被推出牆外
    const b = ball({ x: 50, y: 4, vx: 30, vy: -100 }); const hit = A.pbSeg(b, 0, 0, 100, 0, 0, .5);
    assert.ok(hit > 0 && Math.abs(b.vy - 50) < 1e-9 && b.vx === 30 && b.y >= A.PB.r - 1e-9 && b.y <= A.PB.r + 1e-9);
    const away = ball({ x: 50, y: 4, vy: 100 }); assert.ok(A.pbSeg(away, 0, 0, 100, 0, 0, .5) === 0 && away.vy === 100, '離開時不再反彈');
    assert.strictEqual(A.pbSeg(ball({ x: 50, y: 20, vy: -100 }), 0, 0, 100, 0, 0, .5), 0, '沒碰到');
    const end = ball({ x: 105, y: 0, vx: -50 }); assert.ok(A.pbSeg(end, 0, 0, 100, 0, 0, .5) > 0 && end.vx > 0, '線段端點');
    // 保險桿：沿法線彈開且至少有 kick 速度
    const k = ball({ x: 100, y: 100 - 18 - 6, vy: 50 }); assert.ok(A.pbCirc(k, 100, 100, 18, .6, 380) > 0 && -k.vy >= 380 - 1e-9 && Math.abs(k.vx) < 1e-9);
    const ob = ball({ x: 100, y: 200 }); assert.strictEqual(A.pbCirc(ob, 100, 100, 18, .6, 380), 0);
    // 固定步長積分：自由落體 = 重力 × 時間；同樣的總時間分不同子步結果接近
    const f = ball({ y: 0 }); for (let i = 0; i < 60; i++) A.pbIntegrate(f, 700, DT);
    assert.ok(Math.abs(f.vy - 700) < 1e-6 && Math.abs(f.y - 700 * .5 * (1 + 1 / 60)) < 1);
    const sp = ball({ vx: 5000, vy: 0 }); A.pbIntegrate(sp, 0, DT); assert.ok(Math.hypot(sp.vx, sp.vy) <= A.PB.vmax + 1e-9, '速度上限');
    // 球不會穿過最薄的牆：以最高速度撞每面牆
    for (const w of A.PB_WALLS) {
        const mx = (w[0] + w[2]) / 2, my = (w[1] + w[3]) / 2, nx = -(w[3] - w[1]), ny = w[2] - w[0], l = Math.hypot(nx, ny);
        const b = ball({ x: mx + nx / l * 30, y: my + ny / l * 30, vx: -nx / l * A.PB.vmax, vy: -ny / l * A.PB.vmax }), side = Math.sign((b.x - mx) * nx + (b.y - my) * ny);
        for (let i = 0; i < 20; i++) { A.pbIntegrate(b, 0, DT / 4); A.pbSeg(b, w[0], w[1], w[2], w[3], 0, .5); }
        assert.strictEqual(Math.sign((b.x - mx) * nx + (b.y - my) * ny), side, '穿牆 ' + w);
    }
}
{
    // 擋板：靜止的球停在擋板上；按下擋板會把球往上打
    const s = A.pbMake(); s.b = { x: 150, y: 400, vx: 0, vy: 0, lane: false };
    for (let i = 0; i < 90; i++) A.pbStep(s, DT);
    assert.ok(s.b && s.b.y > 380 && Math.abs(s.b.vy) < 120, '球停在擋板上 ' + s.b.y);
    const tip = A.pbFlipSeg(s.f[0], 0), tip2 = A.pbFlipSeg(s.f[1], 1); assert.ok(tip2[2] - tip[2] < 2 * A.PB.r, '休息時兩擋板間隙小於球');
    s.L = true; let minVy = 0; for (let i = 0; i < 30; i++) { A.pbStep(s, DT); if (s.b) minVy = Math.min(minVy, s.b.vy); }
    assert.ok(minVy < -250, '擋板打球 ' + minVy);
    // 擋板有上下限
    assert.ok(s.f[0].a >= A.PB.up - 1e-9 && s.f[0].a <= A.PB.rest + 1e-9);
    // 沒按時回到休息位置
    s.L = false; for (let i = 0; i < 30; i++) A.pbStep(s, DT); assert.ok(Math.abs(s.f[0].a - A.PB.rest) < 1e-9);
}
{
    // 彈簧：蓄力越久射得越快；沒蓄力不發射；射出後離開發射道
    const s = A.pbMake(); for (let i = 0; i < 10; i++) A.pbStep(s, DT); assert.ok(s.b.lane && s.b.y === 463, '沒按不動');
    const a = A.pbMake(), z = A.pbMake(); a.pull = z.pull = true; for (let i = 0; i < 30; i++) A.pbStep(a, DT); for (let i = 0; i < 70; i++) A.pbStep(z, DT);
    assert.ok(a.charge > .45 && a.charge < .55 && z.charge === 1); a.pull = z.pull = false; A.pbStep(a, DT); A.pbStep(z, DT);
    assert.ok(a.b.vy > z.b.vy && -z.b.vy > 900 && !z.b.lane && z.ev.includes('launch') && z.charge === 0);
    // 滿蓄力能到達上方球檯
    let top = 999; for (let i = 0; i < 90; i++) { A.pbStep(z, DT); top = Math.min(top, z.b.y); } assert.ok(top < 100, '飛到頂 ' + top);
}
{
    // 保險桿與目標計分、倍率
    const s = A.pbMake(); s.b = { x: 100, y: 160 - 18 - 6, vx: 0, vy: 100, lane: false }; A.pbStep(s, DT);
    assert.strictEqual(s.score, 100); assert.ok(s.ev.includes('bump') && s.bf[0] > 0);
    const t = A.pbMake(); t.lit = [1, 1, 1, 0]; t.b = { x: 262, y: 90 - 8 - 6, vx: 0, vy: 100, lane: false }; A.pbStep(t, DT);
    assert.strictEqual(t.score, 50 * 1 + 500 * 1); assert.strictEqual(t.mult, 2); assert.deepStrictEqual(t.lit, [0, 0, 0, 0]);
    const m = A.pbMake(); m.mult = 5; m.lit = [1, 1, 1, 0]; m.b = { x: 262, y: 90 - 8 - 6, vx: 0, vy: 100, lane: false }; A.pbStep(m, DT); assert.strictEqual(m.mult, 5, '倍率上限 5');
}
{
    // 掉球：球數遞減、等待後重發、沒球結束；不再輸入就不會繼續動
    const s = A.pbMake(2); s.b = { x: 166, y: 495, vx: 0, vy: 50, lane: false }; A.pbStep(s, DT);
    assert.ok(s.balls === 1 && !s.b && s.wait > 0 && s.ev.includes('drain') && !s.over);
    for (let i = 0; i < 60; i++) A.pbStep(s, DT); assert.ok(s.b && s.b.lane, '重發');
    s.b = { x: 166, y: 495, vx: 0, vy: 50, lane: false }; A.pbStep(s, DT); assert.ok(s.over && s.balls === 0);
    const before = s.score; A.pbStep(s, DT); assert.strictEqual(s.score, before);
}
{
    // 長時間模擬：用固定步數、交替擋板，三顆球打完會結束，球座標永遠有限且在球檯內，同輸入 = 同結果
    const sim = () => {
        const s = A.pbMake(); let n = 0, pc = 0;
        for (; n < 60 * 240 && !s.over; n++) {
            const ph = Math.floor(n / 9) % 2; s.L = ph === 0; s.R = ph === 1;
            s.pull = !!(s.b && s.b.lane) && pc < 60; if (s.b && s.b.lane) pc++; else pc = 0;
            A.pbStep(s, DT); s.ev.length = 0;
            if (s.b) { assert.ok(Number.isFinite(s.b.x) && Number.isFinite(s.b.y)); assert.ok(s.b.x > -5 && s.b.x < 365 && s.b.y > -5, `球跑出球檯 ${s.b.x},${s.b.y}`); }
        }
        return [n, s.score, s.balls, s.mult, s.over, s.lit.join('')].join(';');
    };
    const r1 = sim(); assert.strictEqual(r1, sim(), '同輸入可重現'); assert.ok(+r1.split(';')[1] > 0, '有得分');
}
// 最高分鍵：新遊戲 id 被接受，壞資料仍清成 0
assert.ok(A.GAME_IDS.includes('pacman') && A.GAME_IDS.includes('pinball') && A.GAME_IDS.length === 8);
assert.deepStrictEqual(A.cleanMap({ pacman: 1200, pinball: -5, junk: 3 }), { pacman: 1200 });
ok('s5 arcade: 吃豆人迷宮 / 鬼魂決策 / 計分 / 死亡過關 + 彈珠台碰撞 / 擋板 / 彈簧 / 固定步長模擬');
