// excel-formula：g10 批次新增功能的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/excel-formula.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);

await click('#pgTabs button[data-p=keys]');
assert.ok(await page.evaluate(() => !document.querySelector('#pgKeys').hidden && document.querySelector('#pgFn').hidden));
const n0 = await page.evaluate(() => document.querySelectorAll('#klist .sk').length);
assert.ok(n0 >= 40);
await set('#kq', 'ctrl+d');
assert.equal(await page.evaluate(() => document.querySelectorAll('#klist .sk').length) < n0, true);
await set('#kq', 'zzzzzz');
assert.ok((await text('#klist')).includes('找不到'));
await click('#pgTabs button[data-p=fn]');
assert.ok(await page.evaluate(() => document.querySelector('#pgKeys').hidden && !document.querySelector('#pgFn').hidden));

assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('excel-formula OK');
