// child-growth：孩子 / 疫苗 / 里程碑 / 閱讀 / 故事 / 紀念卡 / 交接表 / 刪除連帶 / 手機不溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/child-growth.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const ls = (k) => page.evaluate((x) => JSON.parse(localStorage.getItem(x) || 'null'), k);
const noOverflow = async (tag) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + tag);
const tab = (t) => click(`#tabs [data-t=${t}]`);
const today = await page.evaluate(() => twToday());
const shift = (n) => page.evaluate((x) => Util.day.shift(twToday(), x), n);

// 新增孩子（驗證錯誤 → 成功）
await click('#addKidBtn'); await set('#k_name', ''); await set('#k_birth', '2025-06-15'); await click('#k_save');
assert.ok((await text('#kMsg')).includes('名字'));
await set('#k_name', '小明'); await click('#k_save');
assert.equal((await ls('childg_kids')).length, 1); await noOverflow('vax');

// 疫苗
await set('#v_name', '五合一'); await set('#v_dose', '第 2 劑'); await set('#v_date', await shift(-30)); await set('#v_next', await shift(5)); await click('#v_save');
assert.equal((await ls('childg_kids'))[0].vax.length, 1);
assert.ok((await text('#vaxDueList')).includes('快到了'));
assert.ok((await text('#vaxList')).includes('五合一'));
await set('#v_name', 'X'); await set('#v_date', ''); await set('#v_next', ''); await click('#v_save'); assert.ok((await text('#vMsg')).includes('接種日'));
await noOverflow('vax-list');

// 里程碑
await tab('mil'); await noOverflow('mil');
await page.evaluate(() => document.querySelector('#milList input[type=checkbox]').click());
let miles = await ls('childg_miles'); assert.equal(Object.values(miles).flatMap(Object.keys).length, 1);
assert.ok((await text('#milProg')).includes('已勾 1'));
await page.evaluate(() => document.querySelector('#milList input[type=checkbox]').click());
assert.deepEqual(Object.keys((await ls('childg_miles')) || {}), []);

// 閱讀
await tab('bk'); await set('#b_title', '好餓的毛毛蟲'); await set('#b_min', '15'); await click('#b_save');
assert.equal((await ls('childg_books')).length, 1); assert.ok((await text('#bStats')).includes('1 次'));
await set('#b_title', '晚安月亮'); await set('#b_min', '0'); await click('#b_save'); assert.ok((await text('#bMsg')).includes('分鐘'));
await noOverflow('bk');

// 故事
await tab('st'); await set('#s_max', '30'); await click('#s_rnd');
assert.ok((await text('#s_title')).length > 0 && (await text('#s_body')).length > 20);
assert.equal(await page.evaluate(() => document.querySelectorAll('#s_list .ent').length), 20); await noOverflow('story');

// 紀念卡
await tab('cd'); assert.equal(await page.evaluate(() => document.querySelector('#c_name').value), '小明');
await click('#c_make'); assert.ok((await text('#cMsg')).includes('照片'));
await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#9cf'; g.fillRect(0, 0, 300, 200);
    const b = await new Promise(r => c.toBlob(r, 'image/png')), dt = new DataTransfer(); dt.items.add(new File([b], 'a.png', { type: 'image/png' })); document.querySelector('#c_photo').files = dt.files;
});
await click('#c_make'); await page.waitForFunction(() => !document.querySelector('#c_dl').disabled, { timeout: 5000 });
assert.ok(await page.evaluate(() => !document.querySelector('#cv').hidden)); await noOverflow('cd');

// 交接表
await tab('sit'); await set('#sit_child', '小明'); await set('#sit_allergy', '花生過敏');
assert.equal((await ls('childg_sitter')).allergy, '花生過敏'); assert.ok((await text('#sitTable')).includes('花生過敏')); await noOverflow('sit');
// 重新載入仍在
await page.reload({ waitUntil: 'load' }); await tab('sit'); assert.equal(await page.evaluate(() => document.querySelector('#sit_child').value), '小明');

// 刪孩子連帶刪（里程碑 / 閱讀）
await tab('mil'); await page.evaluate(() => document.querySelector('#milList input[type=checkbox]').click());
await tab('vax'); await page.evaluate(() => [...document.querySelectorAll('#vaxHead button')].find(b => b.textContent.includes('刪除這位孩子')).click());
assert.equal((await ls('childg_kids')).length, 0); assert.deepEqual(await ls('childg_books'), []); assert.deepEqual(Object.keys((await ls('childg_miles')) || {}), []);
assert.equal((await ls('childg_sitter')).child, '小明');          // 交接表是單份，不跟孩子走

// 清除全部
await click('#clrAll'); assert.equal((await ls('childg_sitter')).child, '');
assert.deepEqual(errors, []);
await browser.close();
console.log('child-growth OK');
