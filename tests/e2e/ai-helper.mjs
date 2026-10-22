// ai-helper：分頁、費用、範本存取 / 上限 / 刪除、壞資料容錯、Schema 可 parse
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/ai-helper.html');
const ev = (f, ...a) => page.evaluate(f, ...a);
const click = (s) => ev((s) => document.querySelector(s).click(), s);
const set = (s, v) => ev((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, s, v);
const txt = (s) => ev((s) => document.querySelector(s).textContent, s);
const val = (s) => ev((s) => document.querySelector(s).value, s);
await page.evaluate(() => { localStorage.setItem('aihelp_prompts', '{"壞":1}'); localStorage.setItem('aihelp_opts', '[1,2]'); });
await page.reload({ waitUntil: 'load' });
assert.equal(await ev(() => document.querySelectorAll('#tabs button[aria-pressed=true]').length), 1);
assert.equal(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), true, '不可橫向捲動');
// token
await set('#tokIn', 'Hello world '.repeat(10));
assert.ok((await txt('#tokOut')).includes('約'));
// 費用
await click('[data-t=cost]');
await set('#c-inTok', '2000'); await set('#c-outTok', '500'); await set('#c-pIn', '3'); await set('#c-pOut', '15'); await set('#c-calls', '30000');
assert.ok((await txt('#costOut')).includes('0.0135') && (await txt('#costOut')).includes('405'));
await page.reload({ waitUntil: 'load' });
assert.equal(await val('#c-pOut'), '15', '費用輸入應保留'); assert.equal(await ev(() => document.querySelector('#t-cost').hidden), false, '分頁應保留');
// 上下文表
await click('[data-t=ctx]'); await click('#ctxAdd');
await ev(() => { const i = document.querySelector('#ctxRows input'); i.value = 'X'; i.dispatchEvent(new Event('input')); });
assert.equal(await ev(() => JSON.parse(localStorage.getItem('aihelp_opts')).ctx[0].name), 'X');
for (let i = 0; i < 60; i++) await click('#ctxAdd');
assert.equal(await ev(() => JSON.parse(localStorage.getItem('aihelp_opts')).ctx.length), 50); assert.ok((await txt('#ctxMsg')).includes('50'));
// Schema
await click('[data-t=fn]'); await set('#fnName', 'get_weather');
assert.equal(await ev(() => JSON.parse(document.querySelector('#fnOut').value).function.name), 'get_weather');
await set('#fnName', 'bad name'); assert.ok((await txt('#fnErr')).length > 0);
// 範本
await click('[data-t=prompt]');
await set('#pTitle', '測試'); await set('#pCat', '甲'); await set('#pBody', '你是助理。任務：幫我寫 {{x}}。限制：不要太長。輸出格式：條列。');
await click('#pSave');
assert.equal(await ev(() => JSON.parse(localStorage.getItem('aihelp_prompts')).length), 1);
assert.equal(await ev(() => document.querySelectorAll('#pCheck .ok').length), 4);
await set('#pVars input', '詩'); assert.ok((await val('#pOut')).includes('寫 詩。'));
await set('#pCsv', 'x\na\nb'); await click('#pBatch'); assert.equal((await val('#pBatchOut')).split('==========').length, 2);
// 上限：塞滿 200 筆後新增被拒
await ev(() => { localStorage.setItem('aihelp_prompts', JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ id: 'i' + i, title: 't' + i, cat: '', body: 'b' })))); });
await page.reload({ waitUntil: 'load' }); await click('[data-t=prompt]');
await click('#pNew'); await set('#pBody', '新的'); await click('#pSave');
assert.ok((await txt('#pMsg')).includes('200')); assert.equal(await ev(() => JSON.parse(localStorage.getItem('aihelp_prompts')).length), 200);
// 刪除單筆用 id（lib 預設 dismiss 對話框，這裡改成接受）
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
await ev(() => document.querySelectorAll('#pList button')[5].click()); await click('#pDel');
const left = await ev(() => JSON.parse(localStorage.getItem('aihelp_prompts')).map(p => p.id));
assert.equal(left.length, 199); assert.ok(!left.includes('i5'));
await click('#pClear'); assert.equal(await ev(() => JSON.parse(localStorage.getItem('aihelp_prompts')).length), 0);
// 向量
await click('[data-t=vec]'); await set('#vA', '1,2,3'); await set('#vB', '2,4,6'); assert.ok((await txt('#vOut')).includes('餘弦相似度1'));
await set('#vB', '1,2'); assert.ok((await txt('#vErr')).includes('維度'));
assert.equal(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), true);
assert.deepEqual(errors, []);
await browser.close();
console.log('ai-helper OK');
