// timestamp h10：批次轉換的民國年 / 中文日期，與 Intl 格式預覽分頁
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/timestamp.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const noOverflow = async (m) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + m);

await noOverflow('tabs');
await click('#tabs button[data-t=batch]');
await set('#bIn', '113/05/20 08:30\n民國113年5月20日 08:30\n2024年5月20日 08:30\n五月二十日');
let t = await text('#bOut');
assert.equal((t.match(/2024-05-20T00:30:00\.000Z/g) || []).length, 3, t);
assert.ok(t.includes('民國年日期') && t.includes('中文日期') && t.includes('無法辨識：中文數字日期不處理'));
assert.ok(!t.includes('民國113年05月20日 08:30:00'), '未勾選時不輸出民國年欄');
await click('#bRoc');
t = await text('#bOut'); assert.ok(t.includes('民國年') && t.includes('民國113年05月20日 08:30:00'), t);
assert.equal(await page.evaluate(() => document.querySelectorAll('#bOut thead th').length), 8);
await click('#bCopy');
await noOverflow('batch');

// Intl
await click('#tabs button[data-t=intl]');
assert.equal(await page.evaluate(() => document.querySelector('#pgIntl').hidden), false);
assert.equal(await page.evaluate(() => document.querySelector('#pgBatch').hidden), true);
await set('#iDt', '2024-05-20T08:30:00');
t = await text('#iLocOut'); assert.ok(t.includes('zh-TW') && t.includes('ja-JP') && t.includes('en-US') && t.includes('2024'), t);
assert.ok((await text('#iNote')).includes('2024-05-20T00:30:00.000Z'));
await set('#iDs', 'short'); await set('#iTs', 'none');
assert.ok((await text('#iLocOut')).includes('20/05/2024'), await text('#iLocOut'));       // en-GB
await set('#iLoc', 'ja-JP');
t = await text('#iZoneOut'); assert.ok(t.includes('Asia/Taipei') && t.includes('UTC+08:00') && t.includes('America/New_York'), t);
assert.equal(await page.evaluate(() => document.querySelectorAll('#iMatrixOut tr').length), 24);
// 時區切換會更新預覽
await set('#tz', 'UTC');
assert.ok((await text('#iNote')).includes('2024-05-20T08:30:00.000Z'));
for (const id of ['iLocCopy', 'iZoneCopy', 'iMatrixCopy']) await click('#' + id);
await set('#iDs', 'none');
assert.ok((await text('#iLocOut')).includes('都選了'));
await noOverflow('intl');

// 回到既有分頁仍正常
await click('#tabs button[data-t=ts]');
assert.equal(await page.evaluate(() => document.querySelector('#pgTs').hidden), false);
assert.deepEqual(errors, []);
await browser.close();
console.log('timestamp h10 OK');
