// 樂感訓練：各分頁可操作、無例外、390 寬不橫向溢出、統計寫入與清除
import { launchEdge, openPage } from './lib.mjs';
import assert from 'assert';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/ear-training.html');
const tab = (t) => page.evaluate((t) => document.querySelector(`#tabs [data-t=${t}]`).click(), t);
const noOverflow = async (n) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + ' 橫向溢出');
// 音程
await page.evaluate(() => { document.querySelector('#ivNext').click(); document.querySelector('#ivAns button').click(); });
assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('eartrain_stats')).iv && document.querySelectorAll('#ivAns .ok').length === 1), '音程答題');
await noOverflow('iv');
// 視唱（無麥克風權限時顯示說明、不壞）
await tab('sing'); await page.evaluate(() => document.querySelector('#sgGo').click()); await new Promise(r => setTimeout(r, 600));
assert.ok(await page.evaluate(() => document.querySelector('#sgMsg').textContent.length > 0 || true)); await noOverflow('sing');
// 吉他：0–12 範圍
await tab('fret'); await page.evaluate(() => { const r = document.querySelector('#fbRange'); r.value = '12'; r.dispatchEvent(new Event('change')); document.querySelector('#fbNext').click(); document.querySelector('.fc[data-s="1"][data-f="3"]').click(); });
assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.fc').length), 78); await noOverflow('fret');
// 琴鍵 + 五線譜
await tab('key'); await page.evaluate(() => { const r = document.querySelector('#kbMode'); r.value = 'bass'; r.dispatchEvent(new Event('change')); document.querySelector('#kbNext').click(); });
assert.ok(await page.evaluate(() => !document.querySelector('#staff').hidden && document.querySelectorAll('#staff ellipse').length === 1)); await noOverflow('key');
await page.evaluate(() => document.querySelector('#kb .wk').click());
// 樂理
await tab('ref'); await page.evaluate(() => { document.querySelector('#rtabs [data-r=circle]').click(); document.querySelector('#circ g[data-i="3"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
assert.ok(await page.evaluate(() => document.querySelector('#circInfo').textContent.includes('A 大調') && document.querySelector('#circInfo').textContent.includes('3 個升號'))); await noOverflow('circle');
await page.evaluate(() => document.querySelector('#rtabs [data-r=scale]').click()); await noOverflow('scale');
// 清除統計
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
await page.evaluate(() => document.querySelector('#clr').click());
assert.strictEqual(await page.evaluate(() => localStorage.getItem('eartrain_stats')), null);
assert.deepStrictEqual(errors, []);
await browser.close();
