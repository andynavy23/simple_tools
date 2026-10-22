// packing-list：建立 / 勾選 / 新增 / 重排 / 重置 / 複製 / 刪除 / 清除全部
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/packing-list.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const set = (sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('pack_lists') || '[]'));

await click('#create');
assert.ok((await page.evaluate(() => document.querySelector('#newMsg').textContent)).includes('名稱'));
await set('#n_name', '東京五日'); await set('#n_type', '出國'); await set('#n_days', '4'); await set('#n_season', 'cold'); await click('#create');
let s = await stored();
assert.equal(s.length, 1); assert.ok(s[0].items.some(i => i.t === '內衣褲 × 5') && s[0].items.some(i => i.t.includes('護照')) && s[0].items.some(i => i.t === '厚外套'));
const n0 = s[0].items.length;
await page.evaluate(() => document.querySelector('#items input[type=checkbox]').click());
s = await stored(); assert.equal(s[0].items[0].c, true);
assert.ok((await page.evaluate(() => document.querySelector('#prog').textContent)).includes('已打包 1 / ' + n0));
const first = s[0].items[0].t, second = s[0].items[1].t;
await page.evaluate(() => document.querySelectorAll('#items .it')[0].querySelectorAll('button')[1].click());      // 第一項下移
s = await stored(); assert.equal(s[0].items[1].t, first); assert.equal(s[0].items[0].t, second);
await set('#newItem', '行動電源線'); await click('#addItem');
s = await stored(); assert.equal(s[0].items.at(-1).t, '行動電源線'); assert.equal(s[0].items.length, n0 + 1);
await page.evaluate((n) => document.querySelectorAll('#items .it')[n].querySelectorAll('button')[2].click(), n0);       // 刪最後一項
s = await stored(); assert.equal(s[0].items.length, n0);
await click('#resetChecks'); s = await stored(); assert.ok(s[0].items.every(i => !i.c));
await click('#copyList'); s = await stored(); assert.equal(s.length, 2); assert.ok(s[1].name.endsWith('（複製）'));
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
await click('#delList'); s = await stored(); assert.equal(s.length, 1);
await click('#clearAll'); s = await stored(); assert.deepEqual(s, []);
assert.ok(await page.evaluate(() => document.querySelector('#detail').hidden));
// 壞資料不會讓頁面壞掉
await page.evaluate(() => { localStorage.setItem('pack_lists', '{"x":1}'); location.reload(); });
await page.waitForFunction(() => document.querySelector('#create'));
assert.deepEqual(errors, []);
await browser.close();
console.log('packing-list OK');
