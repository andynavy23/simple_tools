// reading-list：摘錄新增 / 搜尋 / 單筆刪除 / 編輯書不丟摘錄 / 刪書連帶 / 舊資料相容
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/reading-list.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('books_list')));

// 舊版資料（沒有 quotes 欄位）
await page.evaluate(() => { localStorage.setItem('books_list', JSON.stringify([{ id: 'o1', title: '舊書', author: '', total: 100, page: 10, status: 'reading', rating: 0, review: '', start: '', finish: '' }])); location.reload(); });
await page.waitForSelector('.book');
assert.ok((await page.$eval('.quotes summary', e => e.textContent)).includes('（0）'));
await page.evaluate(() => { document.querySelector('.quotes').open = true; });
await set('.qform .qp', '42'); await set('.qform textarea', '這是一句好話'); await set('.qform input[type=text]', '很有感');
await click('.qform button.primary');
let b = (await stored())[0];
assert.deepEqual(b.quotes.map(q => [q.page, q.text, q.note]), [[42, '這是一句好話', '很有感']]);
assert.ok(await page.$eval('.quotes', e => e.open), '新增後應保持展開');
// 空內容被拒
await click('.qform button.primary');
assert.ok((await page.$eval('.qn', e => e.textContent)).includes('請輸入'));
// 搜尋命中摘錄 → 自動展開
await page.evaluate(() => { document.querySelector('.quotes').open = false; });
await set('#q', '好話');
assert.ok(await page.$eval('.quotes', e => e.open));
await set('#q', '');
// 編輯書（改心得）不丟摘錄
await click('.acts button:nth-of-type(2)'); await set('#review', '整體不錯'); await click('#save');
b = (await stored())[0]; assert.strictEqual(b.review, '整體不錯'); assert.strictEqual(b.quotes.length, 1);
// 單筆刪除
await page.evaluate(() => { window.confirm = () => true; });
await page.evaluate(() => { document.querySelector('.quotes').open = true; });
await click('.qt button');
assert.strictEqual((await stored())[0].quotes.length, 0);
// 加摘錄再刪書
await page.evaluate(() => { document.querySelector('.quotes').open = true; });
await set('.qform textarea', 'x'); await click('.qform button.primary');
await click('.acts button:nth-of-type(3)');
assert.strictEqual((await stored()).length, 0);
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('reading-list OK');
