// collections：四分頁新增 / +1 集 / 價格 / 匯入拒絕 / 壞資料載入 / 清除
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/collections.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const tab = (i) => page.evaluate((n) => document.querySelectorAll('#tabs button')[n].click(), i);
const stored = (k) => page.evaluate((x) => JSON.parse(localStorage.getItem(x)), k);
await page.evaluate(() => { window.confirm = () => true; });

// 壞資料載入不當掉
await page.evaluate(() => { localStorage.setItem('collect_movies', '{"x":1}'); localStorage.setItem('collect_series', JSON.stringify([null, 3, { title: 'ok', eps: 'a,b', season: 'x' }])); localStorage.setItem('collect_wishes', 'nope'); location.reload(); });
await page.waitForSelector('#tabs button'); await page.evaluate(() => { window.confirm = () => true; });
await tab(1); assert.strictEqual(await page.$$eval('.item', e => e.length), 1);
await click('.item .acts button'); assert.strictEqual((await stored('collect_series'))[0].ep, 1);

// 電影
await tab(0); await set('#f_title', '星際效應'); await set('#f_status', 'done'); await set('#f_rating', '4.5'); await set('#f_tags', '科幻, 太空'); await click('#save');
let mv = (await stored('collect_movies'))[0]; assert.deepStrictEqual([mv.title, mv.rating, mv.status, mv.tags.length], ['星際效應', 4.5, 'done', 2]); assert.ok(mv.date);
// 遊戲
await tab(2); await set('#f_title', '薩爾達'); await set('#f_platform', 'Switch'); await click('#save');
await set('.acts input', '2.5'); await click('.acts button'); assert.strictEqual((await stored('collect_games'))[0].hours, 2.5);
// 願望
await tab(3); await set('#f_title', '耳機'); await set('#f_target', '2000'); await set('#f_price', '2500'); await set('#f_url', 'javascript:alert(1)'); await click('#save');
assert.ok((await page.$eval('#formNote', e => e.textContent)).includes('http'));
await set('#f_url', 'https://example.com/a'); await click('#save');
await set('.acts input', '1890'); await click('.acts button');
let w = (await stored('collect_wishes'))[0]; assert.strictEqual(w.history.length, 1); assert.strictEqual(w.price, 1890);
assert.ok((await page.$eval('#list', e => e.textContent)).includes('低於目標價'));
// 匯入壞資料被拒、不動原資料
await set('#io', '[{"title":"a","url":"javascript:1"}]'); await click('#imp');
assert.ok((await page.$eval('#ioNote', e => e.textContent)).includes('匯入失敗')); assert.strictEqual((await stored('collect_wishes')).length, 1);
await click('#exp'); const exported = await page.$eval('#io', e => e.value); await click('#clearAll'); assert.strictEqual((await stored('collect_wishes')).length, 0);
await set('#io', exported); await click('#imp'); assert.strictEqual((await stored('collect_wishes')).length, 1);
// 單筆刪除只動該分頁
await click('.acts button:last-child'); assert.strictEqual((await stored('collect_wishes')).length, 0); assert.strictEqual((await stored('collect_games')).length, 1);
assert.deepEqual(errors, []);
await browser.close();
