// encoding-fixer「位元組並排」分頁：輸入文字後顯示各編碼位元組與亂碼提示；原本兩個分頁仍可切換
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/encoding-fixer.html');
const click = (s) => page.evaluate((q) => document.querySelector(q).click(), s);
const set = (s, v) => page.evaluate((q, x) => { const e = document.querySelector(q); e.value = x; e.dispatchEvent(new Event('input')); }, s, v);
const hidden = (s) => page.evaluate((q) => document.querySelector(q).hidden, s);

await click('#tabPaste'); assert.equal(await hidden('#panePaste'), false); assert.equal(await hidden('#paneBytes'), true); assert.equal(await hidden('#paneFile'), true);
await click('#tabBytes'); assert.equal(await hidden('#paneBytes'), false); assert.equal(await hidden('#panePaste'), true);
assert.equal(await hidden('#bytCard'), true);
await set('#bytIn', '中A😀');
const cells = await page.evaluate(() => [...document.querySelectorAll('#bytTbl tr')].map(tr => [...tr.children].map(c => c.textContent)));
assert.deepEqual(cells[0], ['字', '碼位', 'UTF-8', 'UTF-16LE', 'UTF-16BE', 'Big5', 'GBK']);
assert.deepEqual(cells[1], ['中', 'U+4E2D', 'E4 B8 AD', '2D 4E', '4E 2D', 'A4 A4', 'D6 D0']);
assert.deepEqual(cells[2], ['A', 'U+0041', '41', '41 00', '00 41', '41', '41']);
assert.deepEqual(cells[3].slice(2), ['F0 9F 98 80', '3D D8 00 DE', 'D8 3D DE 00', '—', '—']);
const hints = await page.evaluate(() => document.querySelector('#bytHint').textContent);
assert.ok(hints.includes('Windows-1252') && hints.includes('ä¸'), hints);
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), '頁面橫向捲動（表格應在自己的容器內捲動）');
await set('#bytIn', ''); assert.equal(await hidden('#bytCard'), true);
await click('#tabFile'); assert.equal(await hidden('#paneFile'), false); assert.equal(await hidden('#paneBytes'), true);
assert.deepEqual(errors, []);
await browser.close();
console.log('encoding-fixer OK');
