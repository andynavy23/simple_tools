import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/travel-calc.html');
const text = () => page.evaluate(() => document.querySelector('#cards .card:not([hidden])').textContent);
const tab = (i) => page.evaluate((i) => document.querySelectorAll('#tabs button')[i].click(), i);
const set = (sel, v) => page.evaluate((sel, v) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('travelc_opts') || 'null'));

// 出發倒推
assert.ok((await text()).includes('07:30'), await text());
await set('#dep_t', '01:00');
assert.ok((await text()).includes('前 1 天'));

// 申根
await tab(3);
await set('#sch_stays', '2025-01-01 2025-03-31');
await set('#sch_ref', '2025-06-30');
assert.ok((await text()).includes('89 天'), await text());
await set('#sch_stays', 'oops');
assert.ok((await text()).includes('第 1 行'));
assert.equal((await stored()).tab, 'sch');

// 速查：搜尋、分類、上限
await tab(4);
const rows = () => page.$$eval('#list .rw', d => d.length);
assert.ok(await rows() >= 100);
await set('#q', 'NRT'); assert.equal(await rows(), 1);
await set('#q', 'zzzqq'); assert.equal(await rows(), 0);
await set('#q', '');
await page.evaluate(() => [...document.querySelectorAll('#cats button')].find(b => b.textContent === '國碼撥號').click());
assert.ok(await rows() >= 30);
await set('#lug', 'x\n'.repeat(40));
assert.equal((await stored()).lug.split('\n').length, 30);
const w = await page.evaluate(() => [document.scrollingElement.scrollWidth, innerWidth]);
assert.ok(w[0] <= w[1], '橫向捲動 ' + w);

// 重新載入：還原分頁與輸入；壞資料不會讓頁面壞掉
await page.reload({ waitUntil: 'load' });
assert.equal(await page.evaluate(() => document.querySelector('#tabs [aria-pressed=true]').textContent), '速查');
await page.evaluate(() => localStorage.setItem('travelc_opts', '{"tab":5,"v":[1],"lug":9}'));
await page.reload({ waitUntil: 'load' });
assert.ok((await text()).includes('提前量'));
await tab(1);
assert.ok((await text()).includes('預計抵達'));
for (const i of [1, 2]) { await tab(i); const w2 = await page.evaluate(() => [document.scrollingElement.scrollWidth, innerWidth]); assert.ok(w2[0] <= w2[1], '橫向捲動 ' + w2); }
assert.deepEqual(errors, []);
await browser.close();
console.log('travel-calc OK');
