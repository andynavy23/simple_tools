// text-diff 畫面行為：JSON 結構模式（選項顯示切換、路徑與前後值、依鍵比對、錯誤）；原本的逐行比對不受影響；手機不橫向捲動
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/text-diff.html');
const set = (sel, v) => page.evaluate((s, x) => { document.querySelector(s).value = x; }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const hidden = (sel) => page.evaluate((s) => document.querySelector(s).hidden, sel);

// 原本逐行
await set('#a', 'line2\nline3'); await set('#b', 'line2\nline4'); await click('#go');
assert.equal(await text('#sum'), '新增 1 行、刪除 1 行');
assert.ok(await hidden('#jsonOpts'));

// JSON 模式
await page.select('#unit', 'json');
assert.ok(!(await hidden('#jsonOpts')) && await hidden('#arrKeyL'));
assert.ok(await page.evaluate(() => document.querySelector('#ws').closest('label').hidden));
await set('#a', '{"a":1,"b":[1,2],"items":[{"id":1,"p":5},{"id":2,"p":6}]}');
await set('#b', '{"b":[1,2,3],"a":2,"items":[{"id":2,"p":9},{"id":1,"p":5}]}');
await click('#go');
assert.equal(await text('#sum'), '新增 1 處、刪除 0 處、變更 5 處', await text('#sum'));
let rows = await page.evaluate(() => [...document.querySelectorAll('#out .ln')].map(d => d.textContent.replace(/\s+/g, ' ').trim()));
assert.ok(rows.includes('-$.a: 1') && rows.includes('+$.a: 2') && rows.includes('+$.b[2]: 3'), rows.join('|'));
await page.select('#arrMode', 'key');
assert.ok(!(await hidden('#arrKeyL')));
await click('#go');
assert.equal(await text('#sum'), '新增 1 處、刪除 0 處、變更 2 處', await text('#sum'));
rows = await page.evaluate(() => [...document.querySelectorAll('#out .ln')].map(d => d.textContent.replace(/\s+/g, ' ').trim()));
assert.ok(rows.includes('-$.items[id=2].p: 6') && rows.includes('+$.items[id=2].p: 9'), rows.join('|'));
await set('#arrKey', ' '); await click('#go'); assert.ok(/鍵名/.test(await text('#sum')));
await set('#arrKey', 'id');
await set('#b', '{oops'); await click('#go'); assert.ok(/✗ 修改後文字不是有效的 JSON/.test(await text('#sum')));
await set('#b', await page.evaluate(() => document.querySelector('#a').value)); await click('#go'); assert.equal(await text('#sum'), '兩份 JSON 的結構與值相同');
// 切回逐行：選項還原
await page.select('#unit', 'line'); assert.ok(await hidden('#jsonOpts') && !(await page.evaluate(() => document.querySelector('#ws').closest('label').hidden)));

const w = await page.evaluate(() => ({ s: document.scrollingElement.scrollWidth, c: document.scrollingElement.clientWidth }));
assert.ok(w.s <= w.c, `橫向捲動 ${w.s} > ${w.c}`);
assert.deepEqual(errors, []);
await browser.close();
console.log('text-diff OK');
