// 批次 h9：css-gen（字型比例 / 單位 / 毛玻璃 / 字型偵測）、code-minify（SVG path 視覺化）、color-tools（近似 Tailwind）、image-resize（佔位圖 / 圖片轉 PDF）、image-mark（金句卡）
const { load, ok } = require('./_load');
const assert = require('assert');

// ---------- css-gen ----------
{
    const m = load('utils/css-gen.html', 'RATIOS, UNITS, tsNorm, typeScale, typeScaleCss, unitsNorm, convertUnits, unitsText, glassNorm, hexMix, glassRules, neuRules, glassCss, contrastRatio, glassNotes, fontsNorm, fontInstalled, fontStack, fontsCss');
    // 字型比例
    assert.deepEqual(m.tsNorm(null), { ratio: 1.25, base: 16, up: 6, down: 2 });
    for (const junk of [5, 'x', [], { ratio: 'a', base: -3, up: 99, down: 'z' }]) { const t = m.tsNorm(junk); assert.ok(m.RATIOS.includes(t.ratio) && t.base >= 8 && t.base <= 40 && t.up >= 1 && t.up <= 10 && t.down >= 0 && t.down <= 3); }
    assert.equal(m.tsNorm({ ratio: '1.5' }).ratio, 1.5); assert.equal(m.tsNorm({ ratio: 1.3 }).ratio, 1.25); assert.equal(m.tsNorm({ base: 99 }).base, 40);
    let sc = m.typeScale({ ratio: 1.25, base: 16, up: 3, down: 2 });
    assert.deepEqual(sc.map(r => r.step), [3, 2, 1, 0, -1, -2]);
    assert.deepEqual(sc.map(r => r.px), [31.25, 25, 20, 16, 12.8, 10.24]);
    assert.deepEqual(sc.map(r => r.rem), [1.953, 1.563, 1.25, 1, 0.8, 0.64]);
    sc = m.typeScale({ ratio: 1.618, base: 20, up: 2, down: 0 }); assert.deepEqual(sc.map(r => r.px), [52.36, 32.36, 20]);
    assert.equal(m.typeScale({}).length, 9);
    assert.equal(m.typeScaleCss({ up: 1, down: 1 }), ':root {\n  --step-1: 1.25rem;\n  --step-0: 1rem;\n  --step-n1: 0.8rem;\n}');
    // 單位
    assert.deepEqual(m.unitsNorm({ from: 'cm', base: 0, vw: 'x' }), { v: '16', from: 'px', base: 1, vw: 390, vh: 844 });
    assert.equal(m.unitsNorm({ v: 'x'.repeat(50) }).v.length, 20);
    let u = m.convertUnits({ v: '16', from: 'px' }); assert.deepEqual(u, { px: 16, rem: 1, em: 1, pt: 12, vw: 4.10256, vh: 1.89573 });
    u = m.convertUnits({ v: '1', from: 'rem', base: 20 }); assert.equal(u.px, 20); assert.equal(u.pt, 15);
    u = m.convertUnits({ v: '50', from: 'vw', vw: 400 }); assert.equal(u.px, 200); assert.equal(u.rem, 12.5);
    u = m.convertUnits({ v: '12', from: 'pt' }); assert.equal(u.px, 16);
    assert.equal(m.convertUnits({ v: 'abc' }), null); assert.equal(m.unitsText({ v: '' }), ''); assert.equal(m.unitsText({ v: '16' }).split('\n')[1], '1rem');
    assert.equal(m.convertUnits({ v: '-8' }).rem, -0.5);
    // 毛玻璃 / 新擬態
    const g = m.glassNorm(null); assert.equal(g.mode, 'glass'); assert.equal(g.blur, 12); assert.equal(g.base, '#e0e5ec');
    for (const junk of [1, 'x', [], { mode: 'x', blur: 999, alpha: 9, color: 'red', base: '#zzzzzz', shape: 'q', dist: 0 }]) { const x = m.glassNorm(junk); assert.ok(['glass', 'neu'].includes(x.mode) && x.blur <= 40 && x.alpha <= 1 && /^#[0-9a-f]{6}$/.test(x.color) && /^#[0-9a-f]{6}$/.test(x.base) && x.dist >= 1); }
    assert.equal(m.hexMix('#808080', 255, 100), '#ffffff'); assert.equal(m.hexMix('#808080', 0, 100), '#000000'); assert.equal(m.hexMix('#808080', 255, 0), '#808080'); assert.equal(m.hexMix('#000000', 255, 50), '#808080');
    const gr = m.glassRules({ blur: 10, alpha: 0.2, sat: 180, border: 0.3, radius: 16 });
    assert.deepEqual(gr.slice(0, 3), ['background: rgba(255, 255, 255, 0.2);', 'backdrop-filter: blur(10px) saturate(180%);', '-webkit-backdrop-filter: blur(10px) saturate(180%);']);
    assert.ok(gr.includes('border: 1px solid rgba(255, 255, 255, 0.3);') && gr.includes('border-radius: 16px;'));
    const gc = m.glassCss({}); assert.ok(gc.startsWith('.glass {') && gc.includes('@supports not') && gc.includes('rgba(255, 255, 255, 0.85)'));
    const ng = (o) => m.neuRules({ mode: 'neu', base: '#e0e0e0', dist: 6, nblur: 12, inten: 20, ...o });
    assert.match(ng({ shape: 'flat' })[2], /^box-shadow: 6px 6px 12px #[0-9a-f]{6}, -6px -6px 12px #[0-9a-f]{6};$/);
    assert.ok(ng({ shape: 'pressed' })[2].startsWith('box-shadow: inset 6px 6px 12px') && ng({ shape: 'pressed' })[2].includes(', inset -6px -6px'));
    assert.equal(ng({ shape: 'flat' })[0], 'background: #e0e0e0;'); assert.ok(ng({ shape: 'convex' })[0].startsWith('background: linear-gradient(145deg, #')); assert.notEqual(ng({ shape: 'convex' })[0], ng({ shape: 'concave' })[0]);
    assert.ok(m.glassCss({ mode: 'neu' }).startsWith('.neu {\n  background:'));
    assert.ok(Math.abs(m.contrastRatio('#000000', '#ffffff') - 21) < 1e-9); assert.equal(m.contrastRatio('#777777', '#777777'), 1);
    assert.ok(m.glassNotes({ mode: 'neu' })[0].includes('3:1')); assert.ok(m.glassNotes({}).join().includes('Firefox 103')); assert.ok(m.glassNotes({ alpha: 0.05 }).join().includes('透明度偏低'));
    // 字型
    assert.equal(m.fontsNorm(null).weight, '400'); assert.equal(m.fontsNorm({ text: 'x'.repeat(200), size: 999, weight: '123' }).text.length, 80); assert.equal(m.fontsNorm({ text: 5 }).text, '永字八法 Aa Bb 123');
    assert.equal(m.fontsNorm({ size: 999, weight: '123' }).size, 72); assert.equal(m.fontsNorm({ weight: '700' }).weight, '700');
    assert.equal(m.fontInstalled([100, 200, 300], [100, 200, 300]), false); assert.equal(m.fontInstalled([100, 210, 300], [100, 200, 300]), true); assert.equal(m.fontInstalled([100.001, 200, 300], [100, 200, 300]), false);
    assert.equal(m.fontStack(['Segoe UI', 'sans-serif']), '"Segoe UI", sans-serif'); assert.equal(m.fontsCss(['Arial']), 'font-family: "Arial", sans-serif;'); assert.equal(m.fontsCss([]), 'font-family: sans-serif;');
    ok('h9 css-gen: type scale / units / glass / neu / fonts');
}

// ---------- code-minify：SVG path 視覺化 ----------
{
    const m = load('utils/code-minify.html', 'parsePathD, absolutize, layoutPath, segsToD, setPoint, describeSeg, fitView, toScreen, toWorld, hitTest, pf, PATH_MAX_D, PATH_MAX_SEG');
    const P = (d) => m.parsePathD(d);
    // 解析
    let r = P('M10 20L30,40 50 60z'); assert.equal(r.error, null); assert.deepEqual(r.cmds.map(c => c.c), ['M', 'L', 'L', 'z']);
    r = P('M 0 0 10 10 20 20'); assert.deepEqual(r.cmds.map(c => c.c), ['M', 'L', 'L']);                // M 後多的座標對是 L
    r = P('m 0 0 10 10'); assert.deepEqual(r.cmds.map(c => c.c), ['m', 'l']);
    r = P('M0 0c1 2 3 4 5 6 7 8 9 10 11 12'); assert.equal(r.cmds.length, 3); assert.deepEqual(r.cmds[2].a, [7, 8, 9, 10, 11, 12]);
    r = P('M0 0a5 5 0 1010 10'); assert.equal(r.error, null); assert.deepEqual(r.cmds[1].a, [5, 5, 0, 1, 0, 10, 10]);   // 旗標緊貼
    r = P('M0 0 A 5 5 0 0 1 10 10'); assert.deepEqual(r.cmds[1].a, [5, 5, 0, 0, 1, 10, 10]);
    r = P('M-1.5.5L1e2-3e-1'); assert.deepEqual(r.cmds[0].a, [-1.5, 0.5]); assert.deepEqual(r.cmds[1].a, [100, -0.3]);
    r = P('M1 1H5V6'); assert.deepEqual(r.cmds.map(c => c.a.length), [2, 1, 1]);
    // 錯誤
    for (const bad of ['L 1 2', 'M 1', 'M 1 2 X 3', 'M 1 2 L', 'M 1 2 L 3', 'M 1 2 z 3 4', 'M 1 2 A 1 1 0 2 0 5 5']) { const e = P(bad); assert.ok(e.error, bad); }
    assert.equal(P('M 1 2 L 3').cmds.length, 1);                                                          // 保留出錯前的部分
    assert.equal(P('').error, null); assert.equal(P('').cmds.length, 0); assert.equal(P(null).cmds.length, 0);
    assert.ok(P('M0 0' + ' L1 1'.repeat(m.PATH_MAX_SEG + 5)).error.includes('指令太多'));
    assert.ok(P('M0 0' + ' '.repeat(m.PATH_MAX_D)).error.includes('太長'));
    // 絕對化
    let segs = m.absolutize(P('m 10 10 l 5 5 h 5 v -5 c 1 1 2 2 3 3 z m 1 1 l 2 2').cmds);
    assert.deepEqual(segs.map(s => s.c), ['M', 'L', 'H', 'V', 'C', 'Z', 'M', 'L']);
    assert.deepEqual(segs[1].p, [15, 15]); assert.deepEqual(segs[2].p, [20]); assert.deepEqual(segs[3].p, [10]); assert.deepEqual(segs[4].p, [21, 11, 22, 12, 23, 13]);
    assert.deepEqual(segs[6].p, [11, 11]);                                                               // z 之後回到子路徑起點 (10,10) 再相對移動
    assert.equal(m.segsToD(m.absolutize(P('M 1 1 L 2 2.123456 Z').cmds)), 'M1 1 L2 2.12 Z');
    assert.equal(m.segsToD(m.absolutize(P('M 1 1 A 5 5 0 1 0 10 10').cmds)), 'M1 1 A5 5 0 1 0 10 10');
    // 版面：端點 / 控制點 / 隱含控制點
    let lay = m.layoutPath(m.absolutize(P('M 0 0 C 0 10 10 10 10 0 S 20 -10 20 0 Q 25 5 30 0 T 40 0').cmds));
    assert.deepEqual(lay[1].pts.map(p => p.kind), ['ctrl', 'ctrl', 'end']); assert.deepEqual(lay[1].pts.map(p => p.idx), [0, 2, 4]);
    assert.deepEqual(lay[2].pts[0], { kind: 'ictrl', x: 10, y: -10, idx: -1 });                          // 反射 (10,10) 對 (10,0)
    assert.deepEqual([lay[2].pts[1].x, lay[2].pts[1].y, lay[2].end], [20, -10, [20, 0]]);
    assert.deepEqual(lay[4].pts[0], { kind: 'ictrl', x: 35, y: -5, idx: -1 });                           // T：反射 Q 控制點 (25,5) 對 (30,0)
    assert.equal(lay[3].lines.length, 2);
    lay = m.layoutPath(m.absolutize(P('M 5 5 S 10 10 20 20 T 30 30').cmds));                             // 前面不是曲線：控制點 = 目前點
    assert.deepEqual([lay[1].pts[0].x, lay[1].pts[0].y, lay[2].pts[0].x, lay[2].pts[0].y], [5, 5, 20, 20]);
    lay = m.layoutPath(m.absolutize(P('M 1 2 H 5 V 9 Z').cmds));
    assert.deepEqual(lay.map(l => l.end), [[1, 2], [5, 2], [5, 9], [1, 2]]); assert.equal(lay[3].pts.length, 0);
    assert.deepEqual(m.layoutPath([]), []);
    // 說明
    const D = (d, i) => { const c = P(d).cmds; return m.describeSeg(c[i], m.layoutPath(m.absolutize(c))[i]); };
    assert.equal(D('M 1 2', 0), '移動到 (1, 2)，開始新的子路徑'); assert.equal(D('M0 0 H 7', 1), '水平線到 x=7'); assert.equal(D('M0 0 v 7', 1), '相對（以目前點 (0, 0) 為原點），垂直線到 y=7（絕對座標，原寫法 v7）');
    assert.ok(D('M0 0 A 5 6 30 1 0 10 10', 1).includes('半徑 5 × 6、旋轉 30°、大弧、逆時針、終點 (10, 10)'));
    assert.ok(D('M0 0 C 1 1 2 2 3 3', 1).includes('控制點 1 (1, 1)、控制點 2 (2, 2)、終點 (3, 3)')); assert.ok(D('M0 0 S 1 1 2 2', 1).includes('由上一段反射 (0, 0)'));
    assert.ok(D('M 3 4 Z', 1).includes('閉合路徑') && D('M 3 4 Z', 1).includes('(3, 4)'));
    assert.ok(D('M0 0 q 1 1 2 2', 1).includes('控制點 (1, 1)、終點 (2, 2)'));
    for (const c of 'MLHVCSQTAZ') assert.ok(D('M0 0 L1 1 ' + { M: 'M 2 2', L: 'L 3 3', H: 'H 3', V: 'V 3', C: 'C 1 1 2 2 3 3', S: 'S 1 1 2 2', Q: 'Q 1 1 2 2', T: 'T 2 2', A: 'A 1 1 0 0 0 2 2', Z: 'Z' }[c], 2).length > 0);
    // 拖曳改寫
    segs = m.absolutize(P('M 0 0 C 0 10 10 10 10 0 H 20 L 5 5').cmds);
    let s2 = m.setPoint(segs, 1, 2, 3, 4); assert.deepEqual(s2[1].p, [0, 10, 3, 4, 10, 0]); assert.deepEqual(segs[1].p, [0, 10, 10, 10, 10, 0]);   // 不改原陣列
    assert.equal(m.segsToD(s2), 'M0 0 C0 10 3 4 10 0 H20 L5 5');
    s2 = m.setPoint(segs, 1, 4, 11.2345, 0.5); assert.equal(m.segsToD(s2), 'M0 0 C0 10 10 10 11.23 0.5 H20 L5 5');
    s2 = m.setPoint(segs, 2, 0, 20, 7); assert.equal(s2[2].c, 'L'); assert.deepEqual(s2[2].p, [20, 7]);                  // H 被拖斜 → L
    assert.deepEqual(m.setPoint(segs, 1, -1, 5, 5), segs); assert.deepEqual(m.setPoint(segs, 9, 0, 5, 5).length, segs.length); assert.deepEqual(m.setPoint(segs, 1, 5, 1, 1)[1].p, segs[1].p);
    // 相對寫法拖曳後變絕對，且後面的絕對位置不變
    segs = m.absolutize(P('m 10 10 l 10 0 l 0 10').cmds); s2 = m.setPoint(segs, 1, 0, 30, 10); assert.equal(m.segsToD(s2), 'M10 10 L30 10 L20 20');
    // 輸出再解析一致（冪等）
    const d1 = m.segsToD(m.absolutize(P('M 1.5 2 c 1 2 3 4 5 6 s 1 1 2 2 q 1 1 2 2 t 3 3 a 2 3 10 1 1 4 5 h 1 v 2 z').cmds));
    assert.equal(m.segsToD(m.absolutize(P(d1).cmds)), d1);
    // 檢視與命中
    const v = m.fitView(lay, 300, 300); assert.ok(v.s > 0 && Number.isFinite(v.ox));
    const [sx, sy] = m.toScreen(v, 5, 9), [wx, wy] = m.toWorld(v, sx, sy); assert.ok(Math.abs(wx - 5) < 1e-9 && Math.abs(wy - 9) < 1e-9);
    assert.deepEqual(m.fitView([], 300, 300), { s: 1, ox: 24, oy: 24 });
    assert.ok(m.fitView(m.layoutPath(m.absolutize(P('M 5 5 L 5 5').cmds)), 300, 300).s > 0);              // 退化路徑不得出現 Infinity
    const lays = m.layoutPath(m.absolutize(P('M 0 0 L 100 0').cmds)), vw = { s: 1, ox: 0, oy: 0 };
    assert.deepEqual(m.hitTest(lays, vw, 98, 3, 10), { si: 1, idx: 0 }); assert.equal(m.hitTest(lays, vw, 50, 50, 10), null);
    assert.equal(m.hitTest(m.layoutPath(m.absolutize(P('M 0 0 T 100 0').cmds)), vw, 0, 0, 5)?.si, 0);       // 隱含控制點 (idx -1) 不能被選到
    ok('h9 code-minify: svg path parse / abs / layout / describe / drag');
}

// ---------- color-tools：近似 Tailwind 色 ----------
{
    const m = load('utils/color-tools.html', 'parseColor, TW_SHADES, twPalette, nearestTailwind, deltaE');
    const pal = m.twPalette(); assert.equal(pal.length, 2 + 22 * 11);
    assert.equal(new Set(pal.map(p => p.name)).size, pal.length); assert.ok(pal.every(p => /^#[0-9a-f]{6}$/.test(p.hex) && p.rgb));
    const by = (n) => pal.find(p => p.name === n).hex;
    for (const [n, h] of [['blue-500', '#3b82f6'], ['red-500', '#ef4444'], ['slate-50', '#f8fafc'], ['slate-950', '#020617'], ['emerald-600', '#059669'], ['rose-900', '#881337'], ['amber-400', '#fbbf24'], ['gray-900', '#111827'], ['white', '#ffffff'], ['black', '#000000']]) assert.equal(by(n), h, n);
    assert.deepEqual(['slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'].every(f => m.TW_SHADES.every(s => by(f + '-' + s))), true);
    let r = m.nearestTailwind('#3b82f6'); assert.equal(r[0].name, 'blue-500'); assert.equal(r[0].de, 0); assert.equal(r.length, 5);
    assert.ok(r.every((x, i) => i === 0 || r[i - 1].de <= x.de));
    assert.equal(m.nearestTailwind('#fff')[0].name, 'white'); assert.equal(m.nearestTailwind('rgb(0,0,0)')[0].name, 'black');
    assert.equal(m.nearestTailwind({ r: 239, g: 68, b: 68 })[0].name, 'red-500');
    assert.equal(m.nearestTailwind('#3b82f7')[0].name, 'blue-500'); assert.ok(m.nearestTailwind('#3b82f7')[0].de < 1);
    assert.deepEqual(m.nearestTailwind('not a color'), []); assert.deepEqual(m.nearestTailwind(''), []);
    assert.equal(m.nearestTailwind('#0071e3', 3).length, 3); assert.equal(m.nearestTailwind('#0071e3', 0).length, 1);
    // 與暴力解一致
    const c = m.parseColor('#12a4b8'), best = pal.map(p => [m.deltaE(c, p.rgb), p.name]).sort((a, b) => a[0] - b[0])[0]; assert.equal(m.nearestTailwind('#12a4b8')[0].name, best[1]);
    ok('h9 color-tools: nearest tailwind');
}

// ---------- image-resize：佔位圖 / 圖片轉 PDF ----------
{
    const { parsePdf } = require('./h9-pdfparse');
    const m = load('utils/image-resize.html', 'PH_MAX_SIZES, PH_MAX_DIM, parseSizes, phLabel, phFontSize, placeholderSvg, phDataUri, phName, PDF_MAX_PAGES, PDF_MAX_BYTES, PAPERS, pdfLayout, pdfBuild, crc32, zipStore');
    // 尺寸解析
    assert.deepEqual(m.parseSizes('300x200, 640×480 128').sizes, [{ w: 300, h: 200 }, { w: 640, h: 480 }, { w: 128, h: 128 }]);
    assert.deepEqual(m.parseSizes(' 300 x 200;300X200，50*60 ').sizes, [{ w: 300, h: 200 }, { w: 50, h: 60 }]);      // 去重、空白、全形逗號
    for (const bad of ['abc', '300x', 'x200', '0x5', '5000x10', '10x4097', '1.5x2', '300x200x100', '-5']) { const r = m.parseSizes(bad); assert.ok(r.error && !r.sizes.length, bad); }
    assert.ok(m.parseSizes('').error); assert.ok(m.parseSizes(null).error); assert.equal(m.parseSizes('4096x4096').error, null);
    assert.equal(m.parseSizes(Array.from({ length: 20 }, (_, i) => i + 1).join(',')).sizes.length, 20); assert.ok(m.parseSizes(Array.from({ length: 21 }, (_, i) => i + 1).join(',')).error.includes('最多'));
    assert.equal(m.parseSizes('5 5 5').sizes.length, 1);
    // 文字與字級
    assert.equal(m.phLabel('', 300, 200), '300×200'); assert.equal(m.phLabel('  ', 1, 2), '1×2'); assert.equal(m.phLabel('{w}×{h} Hero', 9, 8), '9×8 Hero'); assert.equal(m.phLabel('x'.repeat(100), 1, 1).length, 60);
    const fs1 = m.phFontSize(300, 200, '300×200'), fs2 = m.phFontSize(300, 200, '一二三四五六七八九十一二三四五六'), fs3 = m.phFontSize(20, 10, '300×200');
    assert.ok(fs1 <= 80 && fs1 >= 8); assert.ok(fs2 < fs1); assert.equal(fs3, 8); assert.ok(m.phFontSize(100, 100, '') >= 8);
    // SVG
    const svg = m.placeholderSvg({ w: 300, h: 200, bg: '#112233', fg: '#abcdef', text: 'A<B>&"\'' });
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">') && svg.includes('fill="#112233"') && svg.includes('fill="#abcdef"'));
    assert.ok(svg.includes('A&lt;B&gt;&amp;&quot;&#39;') && !svg.includes('A<B'));
    assert.ok(m.placeholderSvg({ w: 5, h: 5, bg: 'red" onload="x', fg: 5, text: 'a' }).includes('fill="#cccccc"'));          // 色碼不合法 → 預設，不能注入屬性
    assert.ok(m.placeholderSvg({ w: 5, h: 5, bg: '#ABCDEF' }).includes('fill="#abcdef"'));
    assert.equal(m.phDataUri('<svg a="#"/>'), 'data:image/svg+xml,%3Csvg%20a%3D%22%23%22%2F%3E'); assert.equal(m.phName(3, 4, 'png'), 'placeholder-3x4.png');
    // PDF 版面
    let L = m.pdfLayout({ iw: 1000, ih: 500, paper: 'a4', margin: 0 }); assert.deepEqual([L.pw, L.ph], [841.89, 595.28]);        // 橫圖 → 自動橫式
    assert.ok(Math.abs(L.w - 841.89) < 1e-9 && Math.abs(L.h - 420.945) < 1e-9 && Math.abs(L.x) < 1e-9 && Math.abs(L.y - (595.28 - 420.945) / 2) < 1e-9);
    L = m.pdfLayout({ iw: 500, ih: 1000, paper: 'a4', margin: 10 }); const mg = 10 * 72 / 25.4; assert.deepEqual([L.pw, L.ph], [595.28, 841.89]);
    assert.ok(L.x >= mg - 1e-9 && L.y >= mg - 1e-9 && L.x + L.w <= L.pw - mg + 1e-9 && L.y + L.h <= L.ph - mg + 1e-9); assert.ok(Math.abs(L.w / L.h - 0.5) < 1e-9);
    L = m.pdfLayout({ iw: 100, ih: 100, paper: 'letter', orient: 'landscape', margin: 0, up: false }); assert.deepEqual([L.pw, L.ph], [792, 612]); assert.equal(L.w, 75); assert.equal(L.x, (792 - 75) / 2);
    L = m.pdfLayout({ iw: 100, ih: 100, paper: 'letter', orient: 'portrait', margin: 0, up: true }); assert.deepEqual([L.pw, L.ph], [612, 792]); assert.equal(L.w, 612);
    L = m.pdfLayout({ iw: 400, ih: 200, paper: 'orig', margin: 0 }); assert.deepEqual([L.pw, L.ph, L.x, L.y, L.w, L.h], [300, 150, 0, 0, 300, 150]);
    L = m.pdfLayout({ iw: 400, ih: 200, paper: 'orig', margin: 25.4 }); assert.deepEqual([L.pw, L.ph, L.x], [444, 294, 72]);
    L = m.pdfLayout({ iw: 40000, ih: 100, paper: 'orig', margin: 0 }); assert.ok(L.pw <= 14400 + 1e-9);                          // 超大尺寸不超過 PDF 上限
    L = m.pdfLayout({ iw: 10, ih: 10, paper: 'a4', margin: 9999 }); assert.ok(L.w > 0 && L.h > 0);                                  // 邊界過大不會讓圖消失
    L = m.pdfLayout({ iw: 10, ih: 10, paper: 'nope', margin: 'x' }); assert.equal(L.pw, 595.28);
    assert.throws(() => m.pdfLayout({ iw: 0, ih: 5 })); assert.throws(() => m.pdfLayout({ iw: 5, ih: NaN }));
    // PDF 結構
    const fakeJpeg = (n, seed) => { const a = new Uint8Array(n); a[0] = 0xff; a[1] = 0xd8; for (let i = 2; i < n - 2; i++) a[i] = (i * 31 + seed) & 255; a[n - 2] = 0xff; a[n - 1] = 0xd9; return a; };
    const mk = (n, iw, ih, o = {}) => Array.from({ length: n }, (_, i) => { const w = iw + i, h = ih; return { jpeg: fakeJpeg(50 + i * 37, i), iw: w, ih: h, ...m.pdfLayout({ iw: w, ih: h, ...o }) }; });
    for (const n of [1, 2, 3, 10]) {
        const pages = mk(n, 640, 480, { paper: 'a4', margin: 12 }), pdf = m.pdfBuild(pages), r = parsePdf(pdf);
        assert.equal(r.pages.length, n); assert.equal(r.objCount, 2 + 3 * n); assert.equal(r.size, 3 + 3 * n);
        r.pages.forEach((p, i) => { assert.equal(p.w, Number(pages[i].pw.toFixed(2))); assert.equal(p.h, Number(pages[i].ph.toFixed(2))); assert.equal(p.iw, 640 + i); assert.equal(p.ih, 480); assert.deepEqual(Array.from(p.jpeg), Array.from(pages[i].jpeg), 'JPEG 位元組被改動'); assert.ok(Math.abs(p.place.w - pages[i].w) < 0.01); });
    }
    let r = parsePdf(m.pdfBuild([{ jpeg: fakeJpeg(30, 1), iw: 600, ih: 300, ...m.pdfLayout({ iw: 600, ih: 300, paper: 'orig', margin: 0 }) }])); assert.deepEqual([r.pages[0].w, r.pages[0].h], [450, 225]);
    r = parsePdf(m.pdfBuild([{ jpeg: fakeJpeg(30, 1), iw: 100, ih: 100, ...m.pdfLayout({ iw: 100, ih: 100, paper: 'letter', orient: 'portrait' }) }])); assert.deepEqual([r.pages[0].w, r.pages[0].h], [612, 792]);
    assert.throws(() => m.pdfBuild([]));
    assert.equal(parsePdf(m.pdfBuild(mk(100, 100, 100))).pages.length, 100);                                                      // 頁數上限本身可用
    assert.equal(m.PDF_MAX_PAGES, 100); assert.equal(m.PDF_MAX_BYTES, 104857600);
    // 有 python + pypdf 時，再用外部程式交叉驗證（沒有就略過）
    {
        const cp = require('child_process'), fsx = require('fs'), os = require('os'), path = require('path');
        const t = cp.spawnSync('python', ['-I', '-c', 'import pypdf'], { encoding: 'utf8' });
        if (t.status === 0) {
            const dir = fsx.mkdtempSync(path.join(os.tmpdir(), 'h9pdf-')), f = path.join(dir, 'a.pdf');
            try {
                fsx.writeFileSync(f, m.pdfBuild(mk(3, 640, 480, { paper: 'a4' })));
                const o = cp.spawnSync('python', ['-I', '-c', 'import sys,pypdf;r=pypdf.PdfReader(sys.argv[1]);print(len(r.pages),*[round(float(p.mediabox.width),2) for p in r.pages])', f], { encoding: 'utf8' });
                assert.equal(o.stdout.trim(), '3 841.89 841.89 841.89');
            } finally { fsx.rmSync(dir, { recursive: true, force: true }); }
        }
    }
    ok('h9 image-resize: placeholder + pdf writer');
}

// ---------- image-mark：文字轉圖片金句卡 ----------
{
    const m = load('utils/image-mark.html', 'QUOTE_SIZES, QUOTE_FONTS, QUOTE_MAX_TEXT, quoteNorm, gradientPoints, authorLine, wrapText, fitText, placeImage');
    // 設定驗證
    const d = m.quoteNorm(null); assert.equal(d.preset, 'sq'); assert.equal(d.text, ''); assert.equal(d.bgType, 'grad'); assert.equal(d.align, 'center');
    for (const junk of [5, 'x', [], { text: 5, preset: 'zz', font: {}, align: 'up', bgType: 'x', c1: 'red', c2: '#12', color: 3, dim: 'a', dir: 9 }]) { const q = m.quoteNorm(junk); assert.ok(m.QUOTE_SIZES[q.preset] && m.QUOTE_FONTS[q.font] && /^#[0-9a-f]{6}$/.test(q.c1 + '') && /^#[0-9a-f]{6}$/.test(q.c2) && /^#[0-9a-f]{6}$/.test(q.color) && q.dim >= 0 && q.dim <= 80 && ['left', 'center', 'right'].includes(q.align) && ['v', 'h', 'd'].includes(q.dir) && typeof q.text === 'string'); }
    assert.equal(m.quoteNorm({ text: 'x'.repeat(2000) }).text.length, 600); assert.equal(m.quoteNorm({ author: 'y'.repeat(99) }).author.length, 40); assert.equal(m.quoteNorm({ dim: 999 }).dim, 80); assert.equal(m.quoteNorm({ c1: '#ABCDEF' }).c1, '#abcdef');
    const q1 = m.quoteNorm({ text: 'a', preset: 'p916', align: 'left' }); assert.deepEqual(m.quoteNorm(JSON.parse(JSON.stringify(q1))), q1);
    for (const s of Object.values(m.QUOTE_SIZES)) assert.ok(s.w <= 4096 && s.h <= 4096);
    assert.deepEqual(m.gradientPoints(100, 50, 'h'), { x0: 0, y0: 0, x1: 100, y1: 0 }); assert.deepEqual(m.gradientPoints(100, 50, 'v'), { x0: 0, y0: 0, x1: 0, y1: 50 }); assert.deepEqual(m.gradientPoints(100, 50, 'd'), { x0: 0, y0: 0, x1: 100, y1: 50 });
    assert.equal(m.authorLine(''), ''); assert.equal(m.authorLine('  某某 '), '— 某某'); assert.equal(m.authorLine('— 某某'), '— 某某'); assert.equal(m.authorLine(null), '');
    // 斷行：每個字寬 10（中英同寬，方便推算）
    const W = (s) => [...s].length * 10;
    assert.deepEqual(m.wrapText('一二三四五六七八九十', 50, W), ['一二三四五', '六七八九十']);
    assert.deepEqual(m.wrapText('一二三四五六', 50, W), ['一二三四五', '六']);
    assert.deepEqual(m.wrapText('', 50, W), []); assert.deepEqual(m.wrapText('   \n  ', 50, W), []);
    assert.deepEqual(m.wrapText('甲\n乙\n\n丙', 50, W), ['甲', '乙', '', '丙']);                           // 保留換行與空行
    assert.deepEqual(m.wrapText('甲\r\n乙', 50, W), ['甲', '乙']);
    assert.deepEqual(m.wrapText('hello world foo', 110, W), ['hello world', 'foo']);                      // 英文以單字為單位
    assert.deepEqual(m.wrapText('abcdefghij', 50, W), ['abcde', 'fghij']);                                // 超長單字逐字拆
    assert.deepEqual(m.wrapText('一二三四五，六', 50, W), ['一二三四五，', '六']);                          // 標點不出現在行首（懸在行尾）
    assert.deepEqual(m.wrapText('一二三四。。。', 50, W), ['一二三四。。。']);
    assert.ok(m.wrapText('一二三四五六七八九十'.repeat(30), 100, W).every(l => W(l) <= 100));
    assert.deepEqual(m.wrapText('🙂🙃🙂🙃🙂🙃', 30, W), ['🙂🙃🙂', '🙃🙂🙃']);                              // 代理對（emoji）不被拆開
    assert.deepEqual(m.wrapText('甲 乙', 100, W), ['甲 乙']); assert.deepEqual(m.wrapText('一二三四五 六', 50, W), ['一二三四五', '六']);   // 行尾空白被丟掉
    // 自動縮放：字寬 = 字數 × size
    const M = (s, size) => [...s].length * size;
    let r = m.fitText({ text: '一二三四五', boxW: 1000, boxH: 1000, minSize: 20, maxSize: 100, lh: 1.5, measure: M });
    assert.equal(r.size, 100); assert.equal(r.truncated, false); assert.deepEqual(r.lines, ['一二三四五']);
    r = m.fitText({ text: '一二三四五六七八九十', boxW: 300, boxH: 300, minSize: 20, maxSize: 200, lh: 1.5, measure: M });
    assert.ok(r.size >= 20 && r.size < 200 && !r.truncated); assert.ok(r.lines.length * r.size * 1.5 <= 300); assert.ok(r.lines.every(l => M(l, r.size) <= 300));
    const bigger = m.fitText({ text: '一二三四五六七八九十', boxW: 300, boxH: 300, minSize: 20, maxSize: 200, lh: 1.5, measure: M }).size + 1;
    assert.ok(m.wrapText('一二三四五六七八九十', 300, s => M(s, bigger)).length * bigger * 1.5 > 300);       // 再大一級就放不下（確實是最大值）
    r = m.fitText({ text: '字'.repeat(500), boxW: 300, boxH: 200, minSize: 20, maxSize: 100, lh: 1.5, measure: M });
    assert.equal(r.truncated, true); assert.equal(r.size, 20); assert.equal(r.lines.length, 6); assert.ok(r.lines[5].endsWith('…') && M(r.lines[5], 20) <= 300);
    r = m.fitText({ text: '', boxW: 300, boxH: 200, minSize: 20, maxSize: 100, measure: M }); assert.deepEqual(r.lines, []); assert.equal(r.truncated, false);
    r = m.fitText({ text: 'x', boxW: 5, boxH: 5, minSize: 20, maxSize: 10, measure: M }); assert.ok(r.lines.length >= 1);        // 退化輸入不崩潰
    r = m.fitText({ text: '一二三', boxW: 1, boxH: 1, minSize: 10, maxSize: 20, measure: M }); assert.ok(r.truncated || r.lines.length);
    // 截斷時最後一行可以縮到只剩「…」
    r = m.fitText({ text: '字'.repeat(50), boxW: 15, boxH: 30, minSize: 20, maxSize: 20, measure: M }); assert.deepEqual(r.lines, ['…']); assert.equal(r.truncated, true);
    // 背景圖鋪滿
    const pi = m.placeImage(200, 100, { x: 0, y: 0, w: 100, h: 100 }, 'fill'); assert.deepEqual([pi.sx, pi.sy, pi.sw, pi.sh], [50, 0, 100, 100]);
    ok('h9 image-mark: quote card');
}
