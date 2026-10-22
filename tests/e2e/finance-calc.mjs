// finance-calc：分頁切換、即時計算、現金流草稿（上限 / 刪除 / 清除 / 壞資料載入）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/finance-calc.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const tab = (n) => page.evaluate((i) => document.querySelectorAll('#tabs button')[i].click(), n);

assert.ok((await text('[data-c=tvm] .out')).includes('162,889'));
await set('#tvm_which', 'n'); await set('#tvm_fv', '200000'); await set('#tvm_pv', '100000'); await set('#tvm_pmt', '0');
assert.ok((await text('[data-c=tvm] .out')).includes('14.21'));
await tab(1);
assert.ok((await text('[data-c=irr] .out')).includes('8.896'));
assert.ok((await text('[data-c=xirr] .out')).includes('37.33'));
await tab(2);
assert.ok(await page.evaluate(() => !document.querySelector('[data-c=dca] canvas').hidden && document.querySelector('[data-c=dca] canvas').width > 0));
assert.ok((await text('[data-c=fire] .out')).includes('撐得住'));
await tab(3); await set('#bond_which', 'ytm'); await set('#bond_p', '100000'); await set('#bond_c', '2');
assert.ok((await text('[data-c=bond] .out')).includes('2.000%'));

// 現金流
await tab(4);
await set('#cf_open', '10000'); await set('#cf_name', '薪水'); await set('#cf_amt', '30000'); await click('#cf_add');
await set('#cf_dir', '-1'); await set('#cf_name', '房租'); await set('#cf_amt', '40000'); await click('#cf_add');
assert.ok((await text('#cf_out')).includes('第 2 月'));
assert.equal(await page.evaluate(() => JSON.parse(localStorage.fincalc_cf).items.length), 2);
assert.equal(await page.evaluate(() => JSON.parse(localStorage.fincalc_opts).tab), 'cf');
await click('#cf_list .li button');
assert.equal(await page.evaluate(() => JSON.parse(localStorage.fincalc_cf).items.length), 1);
assert.ok(!(await text('#cf_list')).includes('薪水'));
await set('#cf_amt', '-5'); await click('#cf_add'); assert.ok((await text('#cf_msg')).includes('金額'));

// 壞資料與上限：載入時修正
await page.evaluate(() => localStorage.setItem('fincalc_cf', JSON.stringify({ open: 'x', months: 99, items: Array.from({ length: 150 }, (_, i) => ({ id: i + 1, kind: 'm', amt: 1, from: 1 })).concat([null, 7]) })));
await page.reload();
assert.equal(await page.evaluate(() => document.querySelectorAll('#cf_list .li').length), 100);
await set('#cf_amt', '5'); await click('#cf_add'); assert.ok((await text('#cf_msg')).includes('100'));
await page.evaluate(() => localStorage.setItem('fincalc_cf', '{壞掉'));
await page.evaluate(() => localStorage.setItem('fincalc_opts', '"x"'));
await page.reload();
assert.ok((await text('#cards')).includes('時間價值'));

// 清除全部（對話框預設被 dismiss，要改成接受）
await tab(4);
await set('#cf_amt', '5'); await click('#cf_add');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
await click('#cf_clear');
assert.equal(await page.evaluate(() => JSON.parse(localStorage.fincalc_cf).items.length), 0);

assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('finance-calc OK');
