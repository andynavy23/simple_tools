// home-keeper：五個分頁的建立 / 勾選 / 刪除 / 清除，與不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/home-keeper.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const set = (sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const get = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
const tab = (t) => click(`[data-tab=${t}]`);
const noScroll = async (w) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + w);

// 檢查表
await set('#l_tpl', 'house'); await click('#l_create');
let L = await get('homek_lists'); assert.equal(L.length, 1); assert.equal(L[0].items.length, 10);
await page.evaluate(() => document.querySelector('#l_items input[type=checkbox]').click());
await set('#l_items .note', '客廳偏暗');
L = await get('homek_lists'); assert.ok(L[0].items[0].c); assert.equal(L[0].items[0].n, '客廳偏暗');
await click('#l_copy'); L = await get('homek_lists'); assert.equal(L.length, 2); assert.ok(L[1].items.every(i => !i.c && !i.n));
assert.ok(!(await page.evaluate(() => document.querySelector('#l_cmpCard').hidden)), '兩份看屋應出現比較');
await set('#l_new', '陽台'); await click('#l_add'); L = await get('homek_lists'); assert.equal(L[1].items.length, 11);
await page.evaluate(() => document.querySelector('#l_items .it button').click()); L = await get('homek_lists'); assert.equal(L[1].items.length, 10);
await click('#l_del'); L = await get('homek_lists'); assert.equal(L.length, 1);
await noScroll('檢查表');

// 效期
await tab('expiry'); await set('#e_name', '護照'); await set('#e_cat', '證件'); await set('#e_date', '2020-01-01'); await click('#e_add');
let E = await get('homek_expiry'); assert.equal(E.length, 1);
assert.ok((await page.evaluate(() => document.querySelector('#e_list').textContent)).includes('已過期'));
await set('#e_name', '感冒藥'); await set('#e_cat', '藥箱'); await set('#e_date', '2099-01-01'); await click('#e_add');
E = await get('homek_expiry'); assert.equal(E.length, 2);
await page.evaluate(() => document.querySelector('#e_list button').click()); E = await get('homek_expiry'); assert.equal(E.length, 1);
await noScroll('效期');

// 家事
await tab('chores'); await page.evaluate(() => document.querySelector('#c_items input[type=checkbox]').click());
let C = await get('homek_chores'); assert.equal(C.length, 12); assert.ok(C.some(m => m.some(c => c.y > 2000)));
await set('#c_new', '擦玻璃'); await click('#c_add'); await page.evaluate(() => document.querySelector('#c_items .it button').click());
await noScroll('家事');

// 抄表
await tab('meters');
for (const [ym, v] of [['2026-01', 100], ['2026-02', 200], ['2026-03', 300], ['2026-04', 600]]) { await set('#m_ym', ym); await set('#m_k', 'e'); await set('#m_v', String(v)); await click('#m_add'); }
let M = await get('homek_meters'); assert.equal(M.rows.length, 4);
assert.ok((await page.evaluate(() => document.querySelector('#m_out').textContent)).includes('異常'));
await page.evaluate(() => document.querySelector('#m_out .urow button').click()); M = await get('homek_meters'); assert.equal(M.rows.length, 3);
await noScroll('抄表');

// 垃圾
await tab('trash'); await page.evaluate(() => document.querySelector('#t_days input[type=checkbox]').click());
let T = await get('homek_trash'); assert.equal(T.length, 7); assert.ok(T[1].g);
await noScroll('垃圾');

// 全部清除
await click('#allClear');
assert.deepEqual(await get('homek_lists'), []); assert.deepEqual(await get('homek_expiry'), []); assert.deepEqual((await get('homek_meters')).rows, []);
assert.ok((await get('homek_trash')).every(x => !x.g));
assert.deepEqual(errors, []);
await browser.close();
