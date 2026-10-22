// health-log：血壓 / 血糖 / 體重新增、判讀、統計、趨勢圖、CSV、單筆刪除、清除全部
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/health-log.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const set = (sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('healthlog_items') || '[]'));
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);

await set('#f_sys', '80'); await set('#f_dia', '90'); await click('#save'); assert.ok((await text('#formMsg')).includes('收縮壓應大於'));
assert.equal((await stored()).length, 0);
for (const [s, dia, hr] of [[120, 80, '70'], [142, 92, '88'], [126, 82, '']]) { await set('#f_sys', s); await set('#f_dia', dia); await set('#f_hr', hr); await click('#save'); }
let L = await stored(); assert.equal(L.length, 3);
const list = await text('#list'); assert.ok(list.includes('在一般參考範圍') && list.includes('超出（血壓偏高）'));
assert.ok((await text('#stats')).includes('筆數') && (await text('#stats')).includes('1 筆'));
const px = await page.evaluate(() => { const c = document.querySelector('#cv'); if (c.hidden || c.width < 100) return -1; const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < a.length; i += 4) if (a[i]) n++; return n; });
assert.ok(px > 500, '趨勢圖有內容 ' + px);
// 血糖、體重
await click('#tabs [data-k=bg]'); await set('#f_glu', '105'); await set('#f_ctx', '空腹'); await click('#save');
assert.ok((await text('#list')).includes('105 mg/dL') && (await text('#list')).includes('超出（偏高）'));
await set('#f_glu', '10'); await click('#save'); assert.ok((await text('#formMsg')).includes('20–800'));
await click('#tabs [data-k=wt]'); await set('#f_kg', '60.5'); await click('#save'); assert.ok((await text('#list')).includes('60.5 公斤'));
L = await stored(); assert.equal(L.length, 5);
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
// CSV
await click('#csv');
const ymd = await page.evaluate(() => { const d = new Date(); return Util.day.ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); });
const f = path.join(browser.downloadDir, `健康數值記錄_${ymd}.csv`);
for (let i = 0; i < 50 && !fs.existsSync(f); i++) await new Promise(r => setTimeout(r, 100));
const csv = fs.readFileSync(f, 'utf8'); assert.ok(csv.includes('收縮壓') && csv.includes('142,92,88') && csv.includes('105'));
// 單筆刪除、清除全部
await page.evaluate(() => document.querySelector('#list .rec button').click()); L = await stored(); assert.equal(L.length, 4);
await click('#clearAll'); L = await stored(); assert.deepEqual(L, []);
// 壞資料
await page.evaluate(() => { localStorage.setItem('healthlog_items', JSON.stringify([null, { k: 'bp', sys: 5 }, 'x'])); location.reload(); });
await page.waitForFunction(() => document.querySelector('#save'));
assert.ok((await text('#list')).includes('還沒有記錄'));
assert.deepEqual(errors, []);
await browser.close();
console.log('health-log OK');
