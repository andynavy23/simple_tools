// 批次 l7：mini-games/kids-learn.html 純邏輯（找不同、點點連線、著色區域、拼貼、節奏、進度、家長驗證）
const assert = require('assert');
const { load, read, ok } = require('./_load');
const m = load('mini-games/kids-learn.html', 'EM, SPOT_LV, spotScene, spotHit, spotHint, DOTS, DOT_TOL, validDots, dotsStep, TPL, validColoring, inRegion, colorInner, svgDoc, CL_SHAPES, CL_MAX, addItem, xform, removeItem, collageInner, WIN, RH, rhythmTargets, judge, matchRhythm, calibrate, nearest, defProg, cleanProgress, gateQ, gateOk', '// --- pure-play ---', '// --- /pure-play ---');

// 找不同：差異數正確、位置不重複、確實不同、同種子可重現
for (let lv = 1; lv <= 3; lv++) for (let s = 0; s < 150; s++) {
    const sc = m.spotScene('seed' + s, lv), L = m.SPOT_LV[lv - 1];
    assert.strictEqual(sc.a.length, L.c * L.r); assert.strictEqual(sc.b.length, sc.a.length);
    assert.strictEqual(sc.diffs.length, L.n); assert.strictEqual(new Set(sc.diffs).size, L.n);
    const real = sc.a.map((x, i) => x !== sc.b[i] ? i : -1).filter(i => i >= 0);
    assert.deepStrictEqual(real, sc.diffs);
    assert.ok(sc.diffs.every(i => i >= 0 && i < sc.a.length));
}
assert.deepStrictEqual(m.spotScene('x', 2), m.spotScene('x', 2));
assert.notDeepStrictEqual(m.spotScene('x', 2).a, m.spotScene('y', 2).a);
assert.strictEqual(m.spotScene('x', 99).diffs.length, 3);   // 壞難度退回簡單
assert.strictEqual(m.spotHit([2, 5], [], 2), 'hit');
assert.strictEqual(m.spotHit([2, 5], [2], 2), 'again');
assert.strictEqual(m.spotHit([2, 5], [], 3), 'miss');
assert.strictEqual(m.spotHint([2, 5], [2]), 5); assert.strictEqual(m.spotHint([2, 5], [2, 5]), -1);
ok('l7 spot');

// 點點連線：10 個圖案都合法、順序容錯距離
assert.strictEqual(m.DOTS.length, 10);
m.DOTS.forEach(d => assert.ok(m.validDots(d.pts), d.name));
assert.ok(!m.validDots([[1, 1], [2, 2], [50, 50], [60, 60], [80, 80]]));   // 點太近
assert.ok(!m.validDots([[1, 1], [50, 50]]) && !m.validDots(null) && !m.validDots([[1, 1], [20, 20], [40, 40], [60, 60], [101, 5]]));
const pts = m.DOTS[1].pts;
assert.strictEqual(m.dotsStep(pts, 0, pts[0][0], pts[0][1]), 1);
assert.strictEqual(m.dotsStep(pts, 0, pts[0][0] + m.DOT_TOL, pts[0][1]), 1);          // 剛好在邊界
assert.strictEqual(m.dotsStep(pts, 0, pts[0][0] + m.DOT_TOL + .5, pts[0][1]), 0);     // 差一點
assert.strictEqual(m.dotsStep(pts, 0, pts[2][0], pts[2][1]), 0);                       // 跳點不算
assert.strictEqual(m.dotsStep(pts, pts.length, 0, 0), pts.length);                     // 完成後不再前進
ok('l7 dots');

// 著色：每份資料合法（封閉、互不重疊）；壞資料被擋；填色只影響指定區域
assert.strictEqual(m.TPL.length, 10);
m.TPL.forEach(t => assert.ok(m.validColoring(t.g), t.name));
const sq = { t: 'r', x: 10, y: 10, w: 30, h: 30 };
assert.ok(!m.validColoring([sq, { t: 'r', x: 30, y: 30, w: 30, h: 30 }, { t: 'c', x: 80, y: 80, r: 5 }]));              // 重疊
assert.ok(!m.validColoring([sq, { t: 'p', p: [[50, 50], [60, 50]] }, { t: 'c', x: 80, y: 80, r: 5 }]));                // 多邊形不到 3 點
assert.ok(!m.validColoring([sq, { t: 'p', p: [[50, 50], [70, 70], [70, 50], [50, 70]] }, { t: 'c', x: 90, y: 20, r: 5 }])); // 蝴蝶結（自交）
assert.ok(!m.validColoring([sq, { t: 'c', x: 95, y: 95, r: 10 }, { t: 'c', x: 60, y: 60, r: 5 }]));                    // 超出畫布
assert.ok(!m.validColoring([sq, { t: 'x' }, { t: 'c', x: 60, y: 60, r: 5 }]) && !m.validColoring(null) && !m.validColoring([sq]));
const svg = m.colorInner(m.TPL[0].g, [, '#ff0000']);
assert.ok(svg.includes('fill="#ff0000"') && (svg.match(/data-i=/g) || []).length === m.TPL[0].g.length);
assert.ok(m.svgDoc(svg).startsWith('<svg xmlns') && !m.svgDoc(svg).includes('var('));   // 匯出檔不含 CSS 變數
ok('l7 coloring');

// 拼貼
let items = [];
for (let i = 0; i < m.CL_MAX; i++) items = m.addItem(items, 'star', '#ff0000', i + 1);
assert.strictEqual(items.length, m.CL_MAX);
assert.strictEqual(m.addItem(items, 'star', '#f00', 99), null);        // 滿了：拒絕新增
assert.strictEqual(m.addItem([], 'nope', '#f00', 1), null);
const it = m.addItem([], 'heart', '#f00', 1)[0];
assert.deepStrictEqual([it.x, it.y, it.s, it.r], [50, 50, 1, 0]);
assert.strictEqual(m.xform(it, { dx: 999, dy: -999 }).x, 100); assert.strictEqual(m.xform(it, { dx: 999, dy: -999 }).y, 0);
assert.strictEqual(m.xform(it, { rot: -15 }).r, 345); assert.strictEqual(m.xform(m.xform(it, { rot: 350 }), { rot: 20 }).r, 10);
assert.strictEqual(m.xform({ ...it, s: 2.9 }, { f: 1.5 }).s, 3); assert.strictEqual(m.xform({ ...it, s: .41 }, { f: .5 }).s, .4);
assert.deepStrictEqual(m.removeItem(items, 5).map(i => i.id).includes(5), false); assert.strictEqual(m.removeItem(items, 5).length, m.CL_MAX - 1);
assert.ok(m.collageInner([it], 1).includes('stroke-dasharray') && !m.collageInner([it], null).includes('stroke-dasharray'));
ok('l7 collage');

// 節奏：時間窗邊界、early / late、配對、延遲校正
assert.deepStrictEqual(m.WIN, [70, 140, 230]);
const J = (dt) => (m.judge(dt) || {}).k;
assert.strictEqual(J(0), 'perfect'); assert.strictEqual(J(70), 'perfect'); assert.strictEqual(J(-70), 'perfect');
assert.strictEqual(J(71), 'good'); assert.strictEqual(J(-140), 'good'); assert.strictEqual(J(141), 'late'); assert.strictEqual(J(-141), 'early');
assert.strictEqual(J(230), 'late'); assert.strictEqual(J(-230), 'early'); assert.strictEqual(J(231), undefined); assert.strictEqual(J(-231), undefined);
assert.deepStrictEqual([3, 2, 1].map((_, i) => m.judge([0, 100, 200][i]).pts), [3, 2, 1]);
RH_CHECK: for (let lv = 1; lv <= 3; lv++) {
    const t = m.rhythmTargets(lv, 1000), bm = 60000 / m.RH[lv - 1].bpm;
    assert.strictEqual(t.length, m.RH[lv - 1].beats.length * m.RH[lv - 1].bars);
    assert.strictEqual(t[0], 1000); assert.ok(t.every((x, i) => i === 0 || x > t[i - 1]));
    assert.ok(Math.min(...t.slice(1).map((x, i) => x - t[i])) >= .5 * bm - 1e-6);
}
const tg = m.rhythmTargets(1, 0);
let r = m.matchRhythm(tg, tg);
assert.strictEqual(r.pct, 100); assert.strictEqual(r.score, r.max);
r = m.matchRhythm(tg, []); assert.strictEqual(r.pct, 0); assert.ok(r.res.every(x => x === null));
r = m.matchRhythm(tg, tg.map(t => t + 200)); assert.strictEqual(r.pct, 33); assert.ok(r.res.every(x => x.k === 'late'));
r = m.matchRhythm(tg, tg.map(t => t + 200), 200); assert.strictEqual(r.pct, 100);               // 延遲校正抵銷
r = m.matchRhythm(tg, [...tg, ...tg.map(t => t + 40)]); assert.strictEqual(r.pct, 100);          // 多按不扣分
r = m.matchRhythm(tg, tg.map(t => t - 300)); assert.strictEqual(r.pct, 0);                       // 差太多不算
assert.strictEqual(m.matchRhythm([], [1, 2]).pct, 0);
const cl = [1000, 1800, 2600, 3400];
assert.strictEqual(m.calibrate(cl, cl.map(c => c + 60)), 60);
assert.strictEqual(m.calibrate(cl, cl.map((c, i) => c + [50, 60, 70, 900][i])), 60);   // 離群值被忽略（900 超出 450 窗，不配對）
assert.strictEqual(m.calibrate(cl, [1000]), null); assert.strictEqual(m.calibrate(cl, cl.map(c => c - 5000)), null);
const far = [1000, 3000, 5000, 7000]; assert.strictEqual(m.calibrate(far, far.map(c => c + 449)), 300);   // 夾在 ±300
assert.deepStrictEqual(m.nearest([100, 500], 480), { i: 1, dt: -20 });
ok('l7 rhythm');

// 進度：壞資料容錯、截斷到上限
assert.deepStrictEqual(m.cleanProgress(null), m.defProg());
assert.deepStrictEqual(m.cleanProgress('x'), m.defProg()); assert.deepStrictEqual(m.cleanProgress([1, 2]).spot, m.defProg().spot);
const bad = m.cleanProgress({ lv: 'a', lat: 9999, spot: [null, [5, 99999], 'z', [1, 2, 3]], rhy: [101, -4, 'x'], dots: 'no' });
assert.strictEqual(bad.lv, 1); assert.strictEqual(bad.lat, 300);
assert.deepStrictEqual(bad.spot, [[0, 0], [5, 3600], [0, 0]]); assert.deepStrictEqual(bad.rhy, [100, 0, 0]); assert.strictEqual(bad.dots.length, 10);
const good = m.cleanProgress({ lv: 3, lat: -20, spot: [[2, 30], [0, 0], [1, 9]], rhy: [10, 20, 30], dots: [1, 0, 1, 'x', null, 1, 1, 1, 1, 1, 1, 1] });
assert.strictEqual(good.lv, 3); assert.strictEqual(good.lat, -20); assert.deepStrictEqual(good.rhy, [10, 20, 30]);
assert.deepStrictEqual(good.dots, [1, 0, 1, 1, 0, 1, 1, 1, 1, 1]);   // 長度固定 10
ok('l7 progress');

// 家長驗證
for (let i = 0; i < 100; i++) { const q = m.gateQ((n) => Math.floor(Math.random() * n)); assert.ok(q.ans >= 6 && q.ans <= 18 && /^\d \+ \d = \?$/.test(q.text)); }
const q = { text: '4 + 5 = ?', ans: 9 };
assert.ok(m.gateOk(q, '9') && m.gateOk(q, ' 9 ')); assert.ok(!m.gateOk(q, '') && !m.gateOk(q, '8') && !m.gateOk(q, '9.0') && !m.gateOk(q, null) && !m.gateOk(q, '0x9'));
ok('l7 gate');

// 頁面靜態：鍵宣告、說明、不用 CDN
const html = read('mini-games/kids-learn.html');
assert.ok(html.includes('<meta name="st-keys" content="kidsl_stats,kidsl_opts,kidsl_tab,kidsp_progress">') && html.includes('<template id="help">'));
assert.ok(!/https?:\/\/(?!andynavy23)[^"' )]*\.(js|css)/.test(html));
ok('l7 page');
