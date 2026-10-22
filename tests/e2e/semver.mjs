// semver：g10 批次新增功能的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/semver.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);

await page.evaluate(() => { document.querySelector('#secBump').open = true; });
let t = await text('#bumpOut');
assert.ok(t.includes('2.0.0') && t.includes('major'));
await set('#cm', 'fix: a');
assert.ok((await text('#bumpOut')).includes('1.4.3'));
await set('#preid', 'beta');
assert.ok((await text('#bumpOut')).includes('1.4.3-beta.0'));
await set('#cm', 'docs: x');
assert.ok((await text('#bumpOut')).includes('不需要發版'));

assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('semver OK');
