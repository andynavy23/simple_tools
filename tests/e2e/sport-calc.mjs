// sport-calc：每個分頁都能算出結果、無例外、不橫向溢出；輸入會記住；壞資料不會壞頁；籤表名單不存檔
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/sport-calc.html');
const tabs = await page.$$eval('#tabs button', bs => bs.length);
assert.equal(tabs, 12);
for (let i = 0; i < tabs; i++) {
    await page.evaluate((i) => document.querySelectorAll('#tabs button')[i].click(), i);
    const r = await page.evaluate(() => ({ err: document.querySelector('#err').textContent, rows: document.querySelectorAll('#res .li').length, w: document.scrollingElement.scrollWidth }));
    assert.equal(r.err, '', '分頁 ' + i + ' 預設值應可計算：' + r.err);
    assert.ok(r.rows > 0 && r.w <= 390, `分頁 ${i}：無結果或橫向溢出 ${r.w}`);
}
// 記住：改 ELO 的 K 值，重新載入後仍在
await page.evaluate(() => { document.querySelectorAll('#tabs button')[8].click(); const k = document.querySelector('#f_k'); k.value = '20'; k.dispatchEvent(new Event('input')); });
const saved = await page.evaluate(() => localStorage.getItem('sportc_opts'));
assert.ok(saved.includes('"elo_k":"20"') && !saved.includes('bracket_names'), '應記住 K 值、不存名單');
// 壞資料
await page.evaluate(() => localStorage.setItem('sportc_opts', '{"tab":"zzz","v":{"elo_k":5,"plate_unit":"x"}}'));
await page.reload({ waitUntil: 'load' });
assert.equal(await page.evaluate(() => document.querySelector('#err').textContent), '');
assert.deepEqual(errors, []);
await browser.close();
console.log('sport-calc OK');
