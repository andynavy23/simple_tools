import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/dev-cheatsheets.html');
const n = () => page.$$eval('details.t', d => d.length);
const all = await n(); assert.ok(all >= 40, 'topics ' + all + ' ' + errors);
await page.evaluate(() => document.querySelector('#cats button[data-c="資料庫"]').click());
assert.equal(await n(), 3);
await page.evaluate(() => document.querySelector('#cats button[data-c=""]').click());
await page.evaluate(() => { const q = document.querySelector('#q'); q.value = 'linux'; q.dispatchEvent(new Event('input')); });
const lin = await page.$eval('details.t[data-id="linux"]', d => ({ open: d.open, red: d.querySelectorAll('.ln.d').length, lv: [...d.querySelectorAll('.lv')].map(x => x.textContent).join('') }));
assert.ok(lin.red >= 4 && lin.lv.includes('🟢') && lin.lv.includes('🟡') && lin.lv.includes('🔴'));
// 複製鈕不會丟例外
await page.evaluate(() => document.querySelector('details.t .ln button').click());
await page.evaluate(() => { const q = document.querySelector('#q'); q.value = 'zzzqq'; q.dispatchEvent(new Event('input')); });
assert.equal(await n(), 0);
// 不橫向捲動
await page.evaluate(() => { const q = document.querySelector('#q'); q.value = ''; q.dispatchEvent(new Event('input')); document.querySelectorAll('details.t').forEach(d => d.open = true); });
const w = await page.evaluate(() => [document.scrollingElement.scrollWidth, innerWidth]);
assert.ok(w[0] <= w[1], '橫向捲動 ' + w);
assert.deepEqual(errors, []);
await browser.close();
console.log('dev-cheatsheets OK');
