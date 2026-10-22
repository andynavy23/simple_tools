// doc-templates：選範本、帶入範例、表格列增刪、草稿保存、清空 / 重置
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/doc-templates.html');
await page.evaluate(() => { window.confirm = () => true; });
const ev = (f, ...a) => page.evaluate(f, ...a);
const click = (s) => ev((s) => document.querySelector(s).click(), s);
const set = (s, v) => ev((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, s, v);
const out = () => ev(() => document.querySelector('#tOut').textContent);
const btn = (txt) => ev((t) => [...document.querySelectorAll('#tFields button')].find(b => b.textContent.includes(t)).click(), txt);
assert.equal(await ev(() => document.querySelectorAll('#tSel option').length), 13);
await set('#f_title', '週會'); assert.ok((await out()).startsWith('# 週會'));
await click('#tEx'); assert.ok((await out()).includes('產品週會'));
// 表格列：新增、輸入含 |、刪除
await btn('新增一列');
assert.equal(await ev(() => document.querySelectorAll('#tFields .row').length), 3);
await ev(() => { const i = document.querySelectorAll('#tFields .row')[2].querySelector('input'); i.value = 'a|b'; i.dispatchEvent(new Event('input', { bubbles: true })); });
assert.ok((await out()).includes('a\\|b'));
await ev(() => document.querySelectorAll('#tFields .row')[2].querySelector('button').click());
assert.equal(await ev(() => document.querySelectorAll('#tFields .row').length), 2);
// 純文字切換
await click('#fTx'); assert.ok(!(await out()).includes('##'));
await click('#fMd');
// 簡報：平均分配與檢查
await set('#tSel', 'slides'); await set('#f_total', '10');
await ev(() => { const i = document.querySelector('#tFields .row input'); i.value = 'A'; i.dispatchEvent(new Event('input', { bubbles: true })); });
await btn('平均分配');
assert.ok((await out()).includes('與總時間相符'));
// 重新載入後草稿仍在
await page.reload({ waitUntil: 'load' });
await ev(() => { window.confirm = () => true; });
assert.equal(await ev(() => document.querySelector('#tSel').value), 'slides');
assert.equal(await ev(() => document.querySelector('#f_total').value), '10');
await set('#tSel', 'meeting'); assert.equal(await ev(() => document.querySelector('#f_title').value), '產品週會');
// 清空此範本草稿只清目前範本
await click('#tClear'); assert.equal(await ev(() => document.querySelector('#f_title').value), '');
await set('#tSel', 'slides'); assert.equal(await ev(() => document.querySelector('#f_total').value), '10');
// 全部重置
await click('#tReset'); assert.equal(await ev(() => localStorage.getItem('doct_opts')), null);
assert.equal(await ev(() => document.querySelector('#tSel').value), 'meeting');
// 壞資料容錯
await ev(() => localStorage.setItem('doct_opts', '{"type":5,"drafts":{"meeting":{"actions":7}}}'));
await page.reload({ waitUntil: 'load' });
await ev(() => { window.confirm = () => true; }); assert.ok((await out()).startsWith('# 會議記錄'));
assert.equal(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), true);
assert.deepEqual(errors, []);
await browser.close();
console.log('doc-templates OK');
