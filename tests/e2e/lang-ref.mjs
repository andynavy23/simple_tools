import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/lang-ref.html');
const set = (v) => page.evaluate((v) => { const q = document.querySelector('#q'); q.value = v; q.dispatchEvent(new Event('input')); }, v);
const n = () => page.$$eval('details.t', d => d.length);
assert.ok(await n() >= 15);
await page.evaluate(() => document.querySelector('#cats button[data-c="韓文"]').click());
assert.equal(await n(), await page.evaluate(() => TOPICS.filter(t => t.cat === '韓文').length));
for (const c of ['其他語言', '中文與公文']) {
    await page.evaluate((c) => document.querySelector(`#cats button[data-c="${c}"]`).click(), c);
    assert.ok(await n() >= 2, c);
}
await page.evaluate(() => document.querySelector('#cats button[data-c=""]').click());
await set('廁所');
assert.ok(await n() >= 4);
await set('召し上がる');
const copyAll = await page.evaluate(() => document.querySelectorAll('details.t .ln button').length);
assert.ok(copyAll >= 1);
await page.evaluate(() => document.querySelector('details.t .ln button').click());   // 複製鈕不會丟例外
await set('zzzqq');
assert.equal(await n(), 0);
await set('');
await page.evaluate(() => document.querySelectorAll('details.t').forEach(d => d.open = true));
const w = await page.evaluate(() => [document.scrollingElement.scrollWidth, innerWidth]);
assert.ok(w[0] <= w[1], '橫向捲動 ' + w);
assert.deepEqual(errors, []);
await browser.close();
console.log('lang-ref OK');
