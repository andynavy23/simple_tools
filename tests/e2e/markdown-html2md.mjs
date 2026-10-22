// markdown-preview：HTML → Markdown（真實 DOMParser；輸入的 HTML 不得被執行或插進頁面）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/markdown-preview.html');
    const conv = (html) => page.evaluate((h) => { const r = htmlToMd(h); return { md: r.md, skipped: r.skipped.map(s => s.tag + ':' + s.n) }; }, html);
    const eq = async (html, md, skipped = []) => { const r = await conv(html); assert.equal(r.md, md, html); assert.deepEqual(r.skipped, skipped, html); };

    await eq('<h1>標題</h1><p>內容 <b>粗</b> <i>斜</i> <del>刪</del> <code>x</code></p>', '# 標題\n\n內容 **粗** *斜* ~~刪~~ `x`\n');
    await eq('<h2> A\n  B </h2><h6>six</h6>', '## A B\n\n###### six\n');
    await eq('<p>a<br>b</p><hr><p>c</p>', 'a  \nb\n\n---\n\nc\n');
    await eq('<p>1 &lt; 2 &amp; *x* _y_ `z` [w]</p>', '1 \\< 2 & \\*x\\* \\_y\\_ \\`z\\` \\[w\\]\n');
    await eq('<p><b> 前後空白 </b>後</p>', '**前後空白** 後\n');
    await eq('<p>x<code>a`b</code></p>', 'x``a`b``\n'); await eq('<p><code>`</code></p>', '`` ` ``\n');
    // 連結 / 圖片
    await eq('<a href="https://x.com/a b(c)">連結</a>', '[連結](https://x.com/a%20b%28c%29)\n'); await eq('<a href="/rel">r</a> <a href="mailto:a@b.c">m</a> <a href="#top">t</a>', '[r](/rel) [m](mailto:a@b.c) [t](#top)\n');
    await eq('<a href="javascript:alert(1)">壞</a>', '壞\n', ['a:1']); await eq('<a href=" JaVa\nScRiPt:alert(1)">壞</a>', '壞\n', ['a:1']); await eq('<a href="data:text/html,x">壞</a>', '壞\n', ['a:1']);
    await eq('<a href="https://x.com"><img src="https://x.com/i.png" alt="圖 [1]"></a>', '[![圖 1](https://x.com/i.png)](https://x.com)\n');
    await eq('<img src="data:image/png;base64,AAAA" alt="內嵌">', '內嵌\n', ['img:1']); await eq('<img alt="沒網址">', '沒網址\n', ['img:1']);
    // 清單
    await eq('<ul><li>一</li><li>二<ul><li>二之一</li><li>二之二<ol><li>x</li></ol></li></ul></li><li>三</li></ul>', '- 一\n- 二\n  - 二之一\n  - 二之二\n    1. x\n- 三\n');
    await eq('<ol start="3"><li>c</li><li>d</li></ol>', '3. c\n4. d\n'); await eq('<ul><li><input type="checkbox" checked> 完成</li><li><input type="checkbox"> 待辦</li></ul>', '- [x] 完成\n- [ ] 待辦\n');
    await eq('<ul>\n  <li>\n    <p>段落</p>\n  </li>\n</ul>', '- 段落\n');
    // 引用、程式碼
    await eq('<blockquote><p>引</p><p>用</p><blockquote>內</blockquote></blockquote>', '> 引\n>\n> 用\n>\n> > 內\n');
    await eq('<pre><code class="language-js">const a = 1;\n  if (a) {}\n</code></pre>', '```js\nconst a = 1;\n  if (a) {}\n```\n'); await eq('<pre>line1\n\n  line3</pre>', '```\nline1\n\n  line3\n```\n');
    await eq('<pre><code>a ``` b</code></pre>', '````\na ``` b\n````\n'); await eq('<ul><li>項目<pre>code\n\nx</pre></li></ul>', '- 項目\n\n  ```\n  code\n\n  x\n  ```\n');
    // 表格
    await eq('<table><thead><tr><th>名</th><th align="right">數</th></tr></thead><tbody><tr><td>蘋果 | 梨</td><td style="text-align:center">1</td></tr><tr><td><b>b</b></td><td></td></tr></tbody></table>', '| 名 | 數 |\n| --- | --: |\n| 蘋果 \\| 梨 | 1 |\n| **b** |  |\n');
    await eq('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>', '| a | b |\n| --- | --- |\n| c |  |\n');
    await eq('<table><tr><td colspan="2">a</td></tr></table>', '| a |\n| --- |\n', ['table:1']);
    // 略過與保留
    await eq('<p>a</p><script>alert(1)</script><style>p{}</style><iframe src="x"></iframe><p>b</p>', 'a\n\nb\n', ['script:1', 'style:1', 'iframe:1']);
    await eq('<p>x<u>u</u><sup>2</sup> <span style="color:red">s</span> <foo-bar>fb</foo-bar></p>', 'xu2 s fb\n', ['u:1', 'sup:1', 'foo-bar:1']);
    await eq('<form><label>名 <input type="text"></label><button>送出</button></form>', '名\n', ['input:1', 'button:1']);
    await eq('<div>a<div>b</div>c</div>', 'a\n\nb\n\nc\n'); await eq('', ''); await eq('   ', ''); await eq('純文字 *不是* 標籤', '純文字 \\*不是\\* 標籤\n');
    await eq('<p>a&nbsp;&nbsp;b</p>', 'a b\n');
    assert.deepEqual(await page.evaluate(() => { try { htmlToMd('x'.repeat(1e6 + 1)); return 'no'; } catch (e) { return e.message; } }), 'HTML 太長（上限 1,000,000 字元）');

    // 安全：腳本、事件處理器、圖片都不能執行或載入，也不能進到頁面 DOM
    const before = await page.evaluate(() => ({ imgs: document.images.length, scripts: document.scripts.length, all: document.getElementsByTagName('*').length }));
    await page.evaluate(() => htmlToMd('<img src="http://127.0.0.1:9/x.png" onerror="window.__pwn=1"><script>window.__pwn=2</script><svg onload="window.__pwn=3"></svg><iframe srcdoc="<script>parent.__pwn=4</script>"></iframe><a href="javascript:window.__pwn=5">x</a><style>@import url(http://127.0.0.1:9/a.css)</style>'));
    await new Promise(r => setTimeout(r, 300));
    assert.equal(await page.evaluate(() => window.__pwn), undefined);
    assert.deepEqual(await page.evaluate(() => ({ imgs: document.images.length, scripts: document.scripts.length, all: document.getElementsByTagName('*').length })), before);

    // UI：展開 → 轉換 → 訊息 → 插入編輯區 → 複製
    await page.evaluate(() => { document.querySelector('#h2mBox').open = true; document.querySelector('#src').value = '開頭\n\n結尾'; document.querySelector('#src').dispatchEvent(new Event('input')); document.querySelector('#src').setSelectionRange(3, 3); });
    await page.evaluate(() => document.querySelector('#h2mGo').click());
    assert.match(await page.evaluate(() => document.querySelector('#h2mMsg').textContent), /請先貼上/);
    await page.evaluate(() => { const t = document.querySelector('#h2mIn'); t.value = '<h2>新增</h2><p>段 <a href="https://e.com">連</a></p><script>x</script>'; document.querySelector('#h2mGo').click(); });
    assert.equal(await page.evaluate(() => document.querySelector('#h2mOut').value), '## 新增\n\n段 [連](https://e.com)\n');
    assert.match(await page.evaluate(() => document.querySelector('#h2mMsg').textContent), /無法完整轉換：<script> ×1/);
    await page.evaluate(() => document.querySelector('#h2mInsert').click());
    assert.equal(await page.evaluate(() => document.querySelector('#src').value), '開頭\n\n## 新增\n\n段 [連](https://e.com)\n\n結尾');
    assert.match(await page.evaluate(() => document.querySelector('#preview').innerHTML), /<h2>新增<\/h2>/);
    await page.evaluate(() => { document.querySelector('#h2mIn').value = '<p>ok</p>'; document.querySelector('#h2mGo').click(); });
    assert.match(await page.evaluate(() => document.querySelector('#h2mMsg').textContent), /沒有無法轉換/);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('markdown-html2md OK');
