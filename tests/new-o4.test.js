// 批次 o4：design-kit（稿紙 / vCard / SVG 轉義 / 排版）、qr-code Logo 容錯判定、css-gen keyframes
const { load, ok } = require('./_load');
const assert = require('assert');

{ // ---------- design-kit ----------
    const m = load('utils/design-kit.html', 'wrapLines, svgEsc, logoSvg, vcardEsc, vcard, safeUrl, cardHtml, comicLayout, rainbowStops, rainbowCss, paperLayout');
    assert.deepStrictEqual(m.wrapLines('abcdefg', 30, s => s.length * 10), ['abc', 'def', 'g']);
    assert.deepStrictEqual(m.wrapLines('ab\ncd', 100, s => s.length * 10), ['ab', 'cd']);
    assert.strictEqual(m.svgEsc('<a&"b\'>'), '&lt;a&amp;&quot;b&apos;&gt;');
    assert.strictEqual(m.svgEsc('x\u0001y'), 'xy');
    const svg = m.logoSvg({ text: '<&>', sub: '"x"', bg: 'red"onload="x', shape: 'nope' });
    assert.ok(svg.includes('&lt;&amp;&gt;') && svg.includes('&quot;x&quot;') && !svg.includes('onload') && svg.includes('<circle'));
    assert.ok(m.logoSvg({ shape: 'hexagon', bg: '#ff0000' }).includes('<polygon points="256,16'));
    // vCard 轉義已知案例
    assert.strictEqual(m.vcardEsc('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
    assert.strictEqual(m.vcardEsc('x\r\ny'), 'x\\ny');
    assert.strictEqual(m.vcard({ name: '王小明', tel: '0912', note: 'a,b;c' }), 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:王小明;;;;\r\nFN:王小明\r\nTEL;TYPE=CELL:0912\r\nNOTE:a\\,b\\;c\r\nEND:VCARD');
    assert.throws(() => m.vcard({ name: ' ' }));
    assert.strictEqual(m.safeUrl('example.com'), 'https://example.com'); assert.strictEqual(m.safeUrl('javascript:alert(1)'), '');
    assert.strictEqual(m.safeUrl('http://a.b'), 'http://a.b'); assert.strictEqual(m.safeUrl('a.com:8080'), 'https://a.com:8080');
    const h = m.cardHtml({ name: '<script>alert(1)</script>', url: 'javascript:x', tel: '02-1234"', ac: 'zzz' });
    assert.ok(!h.includes('<script>') && !h.includes('javascript:') && h.includes('&lt;script&gt;') && h.includes('href="tel:021234"'));
    // 漫畫版面
    let c = m.comicLayout('2x2'); assert.strictEqual(c.H, 900); assert.deepStrictEqual(c.rects[3], [456, 456, 432, 432]);
    c = m.comicLayout('1x3'); assert.strictEqual(c.H, 1668); assert.strictEqual(c.rects.length, 3); assert.strictEqual(m.comicLayout('bad').rects.length, 4);
    // 彩虹
    assert.strictEqual(m.rainbowStops('rainbow').length, 7); assert.deepStrictEqual(m.rainbowStops('custom', '#FF0000', 'bad'), ['#ff0000', '#7928ca']);
    assert.ok(m.rainbowCss(['#f00', '#00f'], 999).startsWith('background: linear-gradient(360deg, #f00, #00f);'));
    // 稿紙
    let p = m.paperLayout('ab\ncd', 0); assert.strictEqual(p.count, 4); assert.strictEqual(p.cells.length, 40); assert.strictEqual(p.cells[20], 'c'); assert.strictEqual(p.pages, 1);
    p = m.paperLayout('ab', 2); assert.deepStrictEqual(p.cells.slice(0, 4), ['', '', 'a', 'b']);
    assert.strictEqual(m.paperLayout('字'.repeat(400), 0).pages, 1); assert.strictEqual(m.paperLayout('字'.repeat(401), 0).pages, 2);
    assert.strictEqual(m.paperLayout('字'.repeat(400), 2).pages, 2);   // 空兩格後多出 2 格
    p = m.paperLayout(' a b\r\n\r\n　c ', 0); assert.strictEqual(p.count, 3);
    assert.deepStrictEqual([m.paperLayout('').count, m.paperLayout('').pages, m.paperLayout(null).cells.length], [0, 1, 0]);
    ok('design-kit');
}
{ // ---------- qr-code Logo 容錯 ----------
    const m = load('utils/qr-code.html', 'ECC_RATE, logoCover, logoVerdict');
    assert.deepStrictEqual(m.ECC_RATE, { L: 0.07, M: 0.15, Q: 0.25, H: 0.30 });
    assert.ok(Math.abs(m.logoCover(20) - 0.04) < 1e-9); assert.strictEqual(m.logoCover(150), 1); assert.strictEqual(m.logoCover('x'), 0);
    assert.strictEqual(m.logoVerdict(20, 'H').level, 'ok');      // 4% ≤ 15%
    assert.strictEqual(m.logoVerdict(40, 'H').level, 'warn');    // 16% ∈ (15%, 30%]
    assert.strictEqual(m.logoVerdict(40, 'M').level, 'bad');     // 16% > 15%
    assert.strictEqual(m.logoVerdict(30, 'L').level, 'bad');     // 9% > 7%
    assert.strictEqual(m.logoVerdict(25, 'Q').level, 'ok');      // 6.25% ≤ 12.5%
    assert.throws(() => m.logoVerdict(10, 'X'));
    ok('qr-code logo');
}
{ // ---------- css-gen keyframes ----------
    const m = load('utils/css-gen.html', 'clamp, hexToRgba, animNorm, animShort, animKeyframes, animCss, ANIM_KF', '// --- pure ---', '// --- /pure ---');
    const a = m.animNorm(null); assert.deepStrictEqual(a, { type: 'bounce', ease: 'ease', dur: 1, delay: 0, iter: 'infinite', dir: 'normal' });
    const b = m.animNorm({ type: 'x;}', ease: 'evil', dur: 99, delay: -3, iter: 7, dir: 'q' }); assert.deepStrictEqual(b, { ...a, dur: 10 });
    assert.strictEqual(m.animNorm({ iter: 3, dur: 0.05 }).iter, '3'); assert.strictEqual(m.animNorm({ dur: 0.05 }).dur, 0.2);
    assert.strictEqual(m.animCss({ type: 'fade', dur: 2, ease: 'linear', iter: 1 }), '@keyframes fade {\n  0% { opacity: 0; }\n  100% { opacity: 1; }\n}\n\n.animated {\n  animation: fade 2s linear 0s 1 normal;\n}');
    for (const t of Object.keys(m.ANIM_KF)) assert.ok(m.animCss({ type: t }).includes('@keyframes ' + t));
    ok('css-gen anim');
}
