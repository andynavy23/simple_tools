// cron-parser：g10 批次新增功能的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/cron-parser.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);

await page.evaluate(() => { document.querySelector('#secSched').open = true; });
await set('#schedIn', 'Mon..Fri *-*-* 09:00:00');
let t = await text('#schedOut');
assert.ok(t.includes('0 9 * * 1-5') && t.includes('UTC'));
await set('#schedIn', '0 0 1 * 1');
t = await text('#schedOut');
assert.ok(t.includes('無法轉換'));
await set('#schedIn', 'garbage');
assert.ok((await text('#schedOut')).length > 0);

assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('cron-parser OK');
