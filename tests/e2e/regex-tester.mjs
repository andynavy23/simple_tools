// regex-tester：g10 批次新增功能的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/regex-tester.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);

await page.evaluate(() => document.querySelectorAll('details.card').forEach(d => d.open = true));
assert.ok((await text('#explain')).includes('群組'));
assert.ok((await text('#langOut')).includes('Pattern.compile'));
await click('#recipes button');
assert.ok((await page.evaluate(() => document.querySelector('#re').value)).includes('@'));
await click('#infGo');
assert.ok((await text('#infOut')).includes('^[A-Z]'));
await set('#re', '(');
assert.ok((await text('#err')).length > 0);

const noHScroll = await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1);
assert.ok(noHScroll, '頁面出現橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('regex-tester OK');
