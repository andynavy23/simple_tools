// writing-helper：地址即時英譯、引用加入 / 刪除 / 上限、片段儲存 / 搜尋 / 清除、壞資料載入、390px 不溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/writing-helper.html');
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
const val = (sel, v) => ev((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
await ev(() => { window.confirm = () => true; });
const noOverflow = async (m) => assert.ok(await ev(() => document.documentElement.scrollWidth <= innerWidth), m + ' 橫向溢出');

await val('#addrIn', '台北市信義區市府路1號3樓');
assert.ok((await ev(() => document.querySelector('#addrOut').textContent)).includes('3F., No. 1, Shifu Rd., Xinyi Dist., Taipei City 110'));
await noOverflow('地址');

await click('[data-tab=cite]');
await val('#f_au', 'John A. Smith'); await val('#f_yr', '2020'); await val('#f_ti', 'Deep learning'); await val('#f_pb', 'MIT Press');
assert.ok((await ev(() => document.querySelector('#cPrev').textContent)).includes('Smith, J. A. (2020).'));
await click('#cAdd');
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('writing_refs')).length), 1);
await click('#cList [data-del]');
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('writing_refs')).length), 0);
await noOverflow('引用');

await click('[data-tab=snip]');
await val('#s_ti', '地址'); await val('#s_tx', '台北市…'); await val('#s_tg', '家, 常用');
await click('#sAdd');
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('writing_snippets')).length), 1);
await val('#sQ', '不存在'); assert.ok((await ev(() => document.querySelector('#sList').textContent)).includes('沒有符合'));
await val('#sQ', '');
await click('#sTags [data-tag]'); assert.ok((await ev(() => document.querySelector('#sList').textContent)).includes('地址'));
await click('#sExp'); assert.ok((await ev(() => document.querySelector('#sIO').value)).includes('台北市'));
await click('#sImp'); assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('writing_snippets')).length), 1, '重複不會再加');
await noOverflow('片段');
await click('#sClear'); assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('writing_snippets')).length), 0);

// 壞資料載入不會壞頁
await ev(() => { localStorage.setItem('writing_refs', '{"x":1}'); localStorage.setItem('writing_snippets', '[null,5,{"content":1}]'); });
await page.reload();
assert.ok(await ev(() => !!document.querySelector('#sList')));
assert.deepStrictEqual(errors.filter((e) => !/favicon/i.test(String(e))), []);
await browser.close();
