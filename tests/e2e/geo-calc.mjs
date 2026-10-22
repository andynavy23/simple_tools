// geo-calc：座標貼上解析 / 兩點距離 / 日出日落表 / 月相與節氣 / 記住分頁與地點 / 定位失敗訊息
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/geo-calc.html');
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const set = (sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);

await set('#pasteA', '25°01′58.8″N 121°33′55.4″E');
assert.equal(await page.evaluate(() => Math.round(Number(document.querySelector('#latA').value) * 1e3)), 25033);
assert.ok((await text('#fmtA')).includes('25°01′58.80″ N'));
await set('#pasteA', '亂寫'); assert.ok((await text('#msgA')).includes('看不懂'));
await set('#pasteB', '35.6762, 139.6503');
const res = await text('#resB'); const km = Number(res.match(/([\d,]+) km/)[1].replace(',', ''));
assert.ok(km > 2050 && km < 2150, res); assert.ok(res.includes('方位角') && res.includes('中點'));
assert.ok(await page.evaluate(() => [...document.querySelectorAll('#linkB a')].every(a => a.href.startsWith('https://'))));
// 日出日落
await click('#tabs [data-t=sun]');
await set('#dateS', '2026-06-21');
assert.ok(await page.evaluate(() => document.querySelectorAll('#sunTable tr').length >= 8));
const t = await text('#sunTable'); assert.ok(/日出05:0\d/.test(t) && /日落18:4\d/.test(t), t);
await set('#city', '10'); assert.ok(/22\.6273/.test(await page.evaluate(() => document.querySelector('#latS').value)));
await set('#latS', '99'); assert.ok((await text('#msgS')).includes('有效'));
// 定位失敗要說明
await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (ok, err) => err({ code: 1 }); });
await click('#geo'); assert.ok((await text('#msgS')).includes('沒有定位權限'));
// 月相與節氣
await click('#tabs [data-t=moon]'); await set('#dateM', '2024-01-11');
assert.ok((await text('#moonBox')).includes('新月') && (await text('#termBox')).includes('小寒'));
assert.equal(await page.evaluate(() => document.querySelectorAll('#termTable tr').length), 24);
assert.ok(await page.evaluate(() => !document.querySelector('#lunarCard').hidden && /月/.test(document.querySelector('#lunar').textContent)));
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
// 記住分頁與地點
await click('#tabs [data-t=sun]'); await set('#city', '4');
await page.reload({ waitUntil: 'load' });
assert.equal(await page.evaluate(() => document.querySelector('#p-sun').hidden), false);
assert.equal(await page.evaluate(() => document.querySelector('#latS').value), '24.8138');
// 壞資料
await page.evaluate(() => localStorage.setItem('geocalc_opts', '{"tab":9,"lat":"x","tz":99}')); await page.reload({ waitUntil: 'load' });
assert.equal(await page.evaluate(() => document.querySelector('#latA').value), '25.033');
assert.deepEqual(errors, []);
await browser.close();
console.log('geo-calc OK');
