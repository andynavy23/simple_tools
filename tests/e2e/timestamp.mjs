// timestamp：g10 批次新增功能的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/timestamp.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);

await click('#tabs button[data-t=batch]');
await set('#bIn', '1700000000\n2023-11-15 06:13:20\nabc');
const t = await text('#bOut');
assert.ok(t.includes('2023-11-14T22:13:20.000Z') && t.includes('無法辨識'));
assert.equal(await page.evaluate(() => document.querySelectorAll('#bOut tbody tr').length), 3);
assert.equal(await page.evaluate(() => document.querySelectorAll('#bOut tr.bad').length), 1);
await set('#tz', 'UTC');
assert.ok((await text('#bOut')).includes('2023-11-15 06:13:20（UTC+00:00）'));

assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('timestamp OK');
