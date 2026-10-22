// base-converter：g10 批次新增功能的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/base-converter.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);

await click('.tabs button[data-t=str]');
assert.ok((await text('#sout')).includes('48 65 6C 6C 6F'));
await set('#smode', 'dec'); await set('#sin', 'E4 BD A0');
assert.ok((await text('#sout')).includes('你'));
await set('#sin', 'FF');
assert.ok((await text('#serr')).includes('UTF-8'));
await click('.tabs button[data-t=conv]');
assert.ok((await text('#cout')).includes('377'));

assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('base-converter OK');
