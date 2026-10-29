import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/food-ref.html');
const set = (v) => page.evaluate((v) => { const q = document.querySelector('#q'); q.value = v; q.dispatchEvent(new Event('input')); }, v);
const n = () => page.$$eval('details.t', d => d.length);
assert.ok(await n() >= 25);
await page.evaluate(() => document.querySelector('#cats button[data-c="飲品酒類"]').click());
const nb = await n(); assert.ok(nb >= 5 && nb < 25);
await page.evaluate(() => document.querySelector('#cats button[data-c=""]').click());
await set('發煙點'); assert.ok(await n() >= 1);
await page.evaluate(() => document.querySelector('details.t .ln button').click());
await set('zzzqq'); assert.equal(await n(), 0);
await set('');
// 酒精計算
await page.evaluate(() => { for (const [id, v] of [['ml', '250'], ['abv', '5']]) { const e = document.querySelector('#' + id); e.value = v; e.dispatchEvent(new Event('input')); } });
assert.match(await page.$eval('#calcOut', e => e.textContent), /約 1\.0 標準杯/);
// 全部展開也不橫向捲動
await page.evaluate(() => document.querySelectorAll('details.t').forEach(d => d.open = true));
const w = await page.evaluate(() => [document.scrollingElement.scrollWidth, innerWidth]);
assert.ok(w[0] <= w[1], '橫向捲動 ' + w);
assert.deepEqual(errors, []);
await browser.close();
console.log('food-ref OK');
