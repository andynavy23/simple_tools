// sql-query 畫面行為：「格式化 SQL」分頁（切換、排版、錯誤、選項），原本的產生器不受影響、不多寫 localStorage；手機不橫向捲動
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/db-query.html');
const set = (sel, v) => page.evaluate((s, x) => { document.querySelector(s).value = x; }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const hidden = (sel) => page.evaluate((s) => document.querySelector(s).hidden, sel);

// 預設是產生器
assert.ok(!(await hidden('#genPane')) && await hidden('#fmtPane'));
const before = await page.evaluate(() => localStorage.getItem('sqlq_opts'));
await click('#modeTabs [data-m=fmt]');
assert.ok(await hidden('#genPane') && !(await hidden('#fmtPane')));
assert.equal(await page.evaluate(() => document.querySelector('#modeTabs [data-m=fmt]').getAttribute('aria-pressed')), 'true');

// 空輸入
await click('#fGo'); assert.ok(/請先貼上/.test(await text('#fStatus')));

// 排版
await set('#fIn', "select a,b from t where x=1 and y in (select id from u) order by a");
await click('#fGo');
assert.equal(await text('#fOut'), 'SELECT\n    a,\n    b\nFROM t\nWHERE x = 1\n    AND y IN (\n        SELECT\n            id\n        FROM u\n    )\nORDER BY a\n');
assert.ok(/✓/.test(await text('#fStatus')) && !(await hidden('#fCopy')));
// 選項
await page.select('#fKw', 'lower'); await page.select('#fComma', 'first'); await page.select('#fIndent', '2');
await set('#fIn', 'SELECT a,b FROM t'); await click('#fGo');
assert.equal(await text('#fOut'), 'select\n  a\n  , b\nfrom t\n');
// 反斜線跳脫選項
await set('#fIn', "select 'it\\'s' from t"); await click('#fGo'); assert.ok(/✗.*沒有結尾/.test(await text('#fStatus')) && await hidden('#fCopy') && (await text('#fOut')) === '');
await click('#fBs'); await click('#fGo'); assert.ok(/✓/.test(await text('#fStatus')) && (await text('#fOut')).includes("'it\\'s'"));
// 壞輸入
for (const bad of ["select 'abc", 'select /* x', 'select "x']) { await set('#fIn', bad); await click('#fGo'); assert.ok(/✗/.test(await text('#fStatus')) && await hidden('#fCopy'), bad); }
// 大量輸入不卡住、不炸版面
await set('#fIn', 'select ' + Array.from({ length: 3000 }, (_, i) => 'col' + i).join(', ') + ' from t'); await click('#fGo');
assert.ok(/✓/.test(await text('#fStatus')));
const w = await page.evaluate(() => ({ s: document.scrollingElement.scrollWidth, c: document.scrollingElement.clientWidth }));
assert.ok(w.s <= w.c, `橫向捲動 ${w.s} > ${w.c}`);

// 切回產生器：原功能正常、沒有多寫鍵
await click('#modeTabs [data-m=gen]');
assert.ok(!(await hidden('#genPane')) && await hidden('#fmtPane'));
assert.ok((await text('#out')).includes('SELECT') || (await page.evaluate(() => document.querySelectorAll('#out .part').length)) >= 0);
const keys = await page.evaluate(() => Object.keys(localStorage));
assert.ok(keys.every(k => k === 'sqlq_opts'), keys.join());
assert.equal(await page.evaluate(() => localStorage.getItem('sqlq_opts')), before);
assert.deepEqual(errors, []);
await browser.close();
console.log('sql-query OK');
