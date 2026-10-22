// text-diff「套用 patch」畫面：選項切換、套用結果、部分失敗、不支援的 patch；手機不橫向捲動
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/text-diff.html');
const set = (sel, v) => page.evaluate((s, x) => { document.querySelector(s).value = x; }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const hidden = (sel) => page.evaluate((s) => document.querySelector(s).hidden, sel);

await page.select('#unit', 'patch');
assert.equal(await text('#go'), '套用 patch'); assert.equal(await text('label[for=b]'), 'patch（unified diff）');
assert.ok(await page.evaluate(() => document.querySelector('#ws').closest('label').hidden) && await hidden('#jsonOpts'));
const orig = 'a\nb\nc\nd\ne\nf\ng\nh\n';
await set('#a', 'x\n' + orig);           // 原文比 patch 預期的多一行 → 偏移 +1
await set('#b', '--- a/f\n+++ b/f\n@@ -2,3 +2,3 @@\n b\n-c\n+C\n d\n@@ -7,2 +7,2 @@\n g\n-hh\n+H\n');
await click('#go');
assert.ok(/套用 1 個 hunk、1 個套不上/.test(await text('#sum')), await text('#sum'));
const rows = await page.evaluate(() => [...document.querySelectorAll('#out .ln')].map(d => d.textContent.replace(/\s+/g, ' ').trim()));
assert.ok(/^✓ ?Hunk 1 @@ -2,3 \+2,3 @@ → 第 3 行（偏移 \+1 行）/.test(rows[0]) && /^✗ ?Hunk 2 .*「hh」，但原文是「h」/.test(rows[1]), rows.join('|'));
assert.equal(await page.evaluate(() => document.querySelector('#out pre').textContent), 'x\na\nb\nC\nd\ne\nf\ng\nh\n');
assert.ok(!(await hidden('#pCopy')));
// 全部成功
await set('#a', orig); await set('#b', '@@ -2,3 +2,3 @@\n b\n-c\n+C\n d\n'); await click('#go');
assert.equal(await text('#sum'), '✓ 1 個 hunk 全部套用');
// 新增檔案、不是 patch
await set('#b', 'diff --git a/n b/n\nnew file mode 100644\n--- /dev/null\n+++ b/n\n@@ -0,0 +1 @@\n+x\n'); await click('#go');
assert.ok(/新增檔案/.test(await text('#sum')) && await hidden('#pCopy'));
await set('#b', 'hello'); await click('#go'); assert.ok(/找不到 hunk/.test(await text('#sum')));
// 切回逐行：標籤與按鈕還原、原本比對照常
await page.select('#unit', 'line');
assert.equal(await text('#go'), '比對'); assert.equal(await text('label[for=b]'), '修改後文字');
assert.ok(!(await page.evaluate(() => document.querySelector('#ws').closest('label').hidden)));
await set('#a', 'p\nq'); await set('#b', 'p\nr'); await click('#go'); assert.equal(await text('#sum'), '新增 1 行、刪除 1 行');
const w = await page.evaluate(() => ({ s: document.scrollingElement.scrollWidth, c: document.scrollingElement.clientWidth }));
assert.ok(w.s <= w.c, `橫向捲動 ${w.s} > ${w.c}`);
assert.deepEqual(errors, []);
await browser.close();
console.log('text-diff-patch OK');
