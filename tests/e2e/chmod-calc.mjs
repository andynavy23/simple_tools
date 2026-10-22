// chmod-calc：g10 批次新增功能的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/chmod-calc.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);

await set('#rvPerm', '644'); await set('#rvKind', 'file');
assert.ok((await text('#rvOut')).includes('022'));
await set('#rvKind', 'dir'); await set('#rvPerm', '644');
assert.ok((await text('#rvOut')).includes('133'));
await set('#rvKind', 'file'); await set('#rvPerm', '755');
assert.ok((await text('#rvErr')).length > 0);
await click('#umChips button:nth-child(3)');
assert.equal(await page.evaluate(() => document.querySelector('#um').value), '077');
assert.ok((await text('#umNote')).includes('600') || (await text('#umNote')).includes('只有自己'));

assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('chmod-calc OK');
