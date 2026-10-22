// code-minify：SVG 優化與預覽（防 XSS）、CSS ⇄ SCSS
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/code-minify.html');
    const val = (s) => page.evaluate((s) => document.querySelector(s).value, s);
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const lang = (v) => page.evaluate((v) => document.querySelector(`#langs [data-v=${v}]`).click(), v);
    const mode = (v) => page.evaluate((v) => document.querySelector(`#modes [data-v=${v}]`).click(), v);
    const setSrc = (t) => page.evaluate((t) => { const s = document.querySelector('#src'); s.value = t; s.dispatchEvent(new Event('input')); }, t);
    const settle = () => new Promise(r => setTimeout(r, 500));                       // 輸入有 250ms 防抖
    const imgs = () => page.evaluate(() => ['#svgA', '#svgB'].map(s => { const i = document.querySelector(s); return { ok: i.complete && i.naturalWidth > 0, src: i.src.slice(0, 30) }; }));

    // SVG：範例 → 預覽兩張圖載入成功、大小縮小、驗證通過
    await lang('svg'); await page.evaluate(() => document.querySelector('#sample').click()); await settle();
    assert.ok(await page.evaluate(() => !document.querySelector('#svgBox').hidden));
    assert.deepEqual((await page.evaluate(() => [...document.querySelectorAll('#modes button')].map(b => b.textContent))), ['優化', '美化']);
    const out = await val('#dst'); assert.ok(out.startsWith('<svg') && !out.includes('metadata') && !out.includes('inkscape') && out.includes('cx="24"'), out);
    assert.match(await text('#stat'), /縮小 \d+(\.\d+)?%/); assert.match(await text('#ver'), /驗證通過：繪圖元素數 2→2/);
    await page.waitForFunction(() => ['#svgA', '#svgB'].every(s => { const i = document.querySelector(s); return i.complete && i.naturalWidth > 0; }), { timeout: 5000 });
    assert.deepEqual((await imgs()).map(i => i.ok), [true, true]); assert.ok((await imgs())[0].src.startsWith('data:image/svg+xml'));
    // 小數位數：0 位時座標取整，仍然驗證通過
    await page.evaluate(() => { const s = document.querySelector('#svgPrec'); s.value = '0'; s.dispatchEvent(new Event('change')); });
    assert.ok((await val('#dst')).includes('r="20"'));
    // 複製 data URI / CSS（剪貼簿權限在無頭模式不一定可用，只確認不丟例外）
    await page.evaluate(() => { document.querySelector('#svgUri').click(); document.querySelector('#svgCss').click(); });
    // 美化模式
    await mode('beautify'); assert.ok((await val('#dst')).split('\n').length > 3);
    // 惡意 SVG：腳本 / 事件 / 外部載入都不得執行或進入頁面 DOM
    const before = await page.evaluate(() => ({ scripts: document.scripts.length, svgs: document.querySelectorAll('svg').length, all: document.getElementsByTagName('*').length }));
    await mode('minify');
    await setSrc('<svg xmlns="http://www.w3.org/2000/svg" onload="window.__pwn=1"><script>window.__pwn=2</script><image href="http://127.0.0.1:9/x.png" onerror="window.__pwn=3"/><foreignObject><iframe srcdoc="&lt;script&gt;parent.__pwn=4&lt;/script&gt;"/></foreignObject><a href="javascript:window.__pwn=5"><rect width="9" height="9"/></a></svg>');
    await settle();
    assert.equal(await page.evaluate(() => window.__pwn), undefined);
    const after = await page.evaluate(() => ({ scripts: document.scripts.length, svgs: document.querySelectorAll('svg').length, all: document.getElementsByTagName('*').length }));
    assert.deepEqual(after, before);
    assert.ok((await val('#dst')).includes('<script>'), '腳本只被當文字處理，不該被默默移除');
    // 壞掉的 SVG：提示、不丟例外
    await setSrc('<svg><path d="M0 0"></svg'); await settle(); assert.match(await text('#err'), /XML 有誤/);
    await setSrc(''); await settle(); assert.equal(await val('#dst'), '');

    // 貼上時自動猜語言
    await page.evaluate(() => document.querySelector('#clear').click());
    await setSrc('<?xml version="1.0"?>\n<svg width="1"><path d="M0 0L1.00 1"/></svg>'); await settle();
    assert.equal(await page.evaluate(() => document.querySelector('#langs [aria-pressed=true]').dataset.v), 'svg');

    // CSS ⇄ SCSS
    await lang('scss'); assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#modes button')].map(b => b.textContent)), ['展平（SCSS → CSS）', '巢狀化（CSS → SCSS）']);
    assert.ok(await page.evaluate(() => document.querySelector('#svgBox').hidden));
    await page.evaluate(() => document.querySelector('#sample').click()); await settle();
    const flat = await val('#dst'); assert.ok(flat.includes('.nav ul li:hover {') && flat.includes('.nav-item {') && flat.includes('@media (min-width: 600px) {\n  .nav {'), flat);
    assert.match(await text('#ver'), /驗證通過：宣告數 \d+→\d+，宣告內容一致/);
    await mode('nest'); await setSrc('.a { x: 1 }\n.a:hover { y: 2 }\n.a .b { z: 3 }'); await settle();
    assert.equal(await val('#dst'), '.a {\n  x: 1;\n  &:hover {\n    y: 2;\n  }\n  .b {\n    z: 3;\n  }\n}');
    await setSrc('.a { x: 1 '); await settle(); assert.match(await text('#err'), /大括號/); assert.equal(await val('#dst'), '');
    // 回到既有語言：動作按鈕恢復「壓縮 / 美化」，原功能照常
    await lang('css'); assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#modes button')].map(b => b.textContent)), ['壓縮', '美化']);
    await setSrc('a { color : red ; }'); await settle(); assert.equal(await val('#dst'), 'a{color:red}');
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('code-minify OK');
