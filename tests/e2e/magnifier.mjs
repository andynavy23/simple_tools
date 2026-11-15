import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/magnifier.html');
// 沒有相機 / 權限：點開啟要顯示說明、不丟例外
await page.evaluate(() => document.querySelector('#start').click());
await new Promise(r => setTimeout(r, 800));
const t = await page.evaluate(() => document.querySelector('#msg').textContent);
assert.ok(t.length > 4, '應顯示說明：' + t);
assert.ok(await page.evaluate(() => document.querySelector('#freeze').disabled), '無相機時定格應停用');
const w = await page.evaluate(() => [document.scrollingElement.scrollWidth, innerWidth]);
assert.ok(w[0] <= w[1], '橫向捲動 ' + w);
assert.deepEqual(errors, []);
await browser.close();
console.log('magnifier OK');
