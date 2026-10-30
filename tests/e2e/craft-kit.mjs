// craft-kit：分頁切換、圖案轉換（程式產生測試圖）、手機不溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/craft-kit.html');
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const noOverflow = async (t) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + t);
for (const t of ['print', 'knit', 'cut', 'candle', 'soap', 'ref', 'bead', 'cross']) { await click(`#tabs [data-t=${t}]`); await noOverflow(t); }
await click('#tabs [data-t=soap]'); assert.ok(await page.evaluate(() => !document.querySelector('#warn').hidden));
assert.ok((await text('#res')).includes('NaOH'));
await click('#tabs [data-t=ref]'); assert.ok((await page.$$('#refList .ref')).length >= 10);
await click('#tabs [data-t=cross]');
await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 20; const x = c.getContext('2d'); x.fillStyle = '#f00'; x.fillRect(0, 0, 20, 20); x.fillStyle = '#00f'; x.fillRect(20, 0, 20, 20); bmp = await createImageBitmap(c); drawGrid(); });
assert.ok(await page.evaluate(() => !document.querySelector('#cv').hidden));
assert.ok((await text('#usage')).includes('合計'));
await noOverflow('cross-img');
await click('#tabs [data-t=bead]'); assert.ok(await page.evaluate(() => !document.querySelector('#png').hidden));
assert.deepStrictEqual(errors.slice(), []);
await browser.close();
