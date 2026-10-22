// screen-test：「瀏覽器環境」分頁與舊版 screentest_tab 值相容
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/screen-test.html');
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
await click('.tabs button[data-t=env]');
let t = await text('#envOut');
for (const k of ['User-Agent', '螢幕解析度', '像素比', 'WebGL', 'Web Audio', 'Clipboard', 'WebRTC', '觸控點數', '時區']) assert.ok(t.includes(k), k + ' 不在環境清單');
assert.ok(!/undefined|NaN/.test(t));
assert.equal(await page.evaluate(() => document.querySelector('.pane[data-t=env]').hidden), false);
// 複製按鈕不得丟例外，且整個流程不得發出網路請求
const reqs = [];
page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) reqs.push(r.url()); });
await click('#envRefresh'); await click('#envCopy');
assert.deepEqual(reqs, []);
// 舊版儲存值仍有效、新值能還原
for (const [v, shown] of [['mic', 'mic'], ['env', 'env'], ['bogus', 'screen']]) {
    await page.evaluate((x) => localStorage.setItem('screentest_tab', JSON.stringify(x)), v);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.evaluate(() => document.querySelector('.tabs button[aria-pressed=true]').dataset.t), shown, v);
}
await page.evaluate(() => localStorage.removeItem('screentest_tab'));
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('screen-test OK');
