// tw-tax-calc：分頁、輸入即時結果、記住與重置、不橫向捲動
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/tw-tax-calc.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const chk = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.checked = x; e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const noScroll = async () => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');

// 房屋與土地
await set('#f_hVal', '1,000,000');
assert.ok((await text('#o_house')).includes('12,000'));
await set('#f_tPrice', '10000000'); await set('#f_tDeedVal', '300000'); await set('#f_tDecl', '5000000'); await set('#f_tOrig', '3000000');
assert.ok((await text('#o_house')).includes('400,000'), '土增稅');
await noScroll();

// 遺產 / 進口 / 營業稅
await click('#t_estate'); assert.ok(await page.evaluate(() => !document.querySelector('#p_estate').hidden && document.querySelector('#p_house').hidden));
await set('#f_eGross', '30000000'); await chk('#f_eSpouse', true); await set('#f_eChild', '2');
assert.ok((await text('#o_estate')).includes('864,000'));
await set('#k_eExempt', '0');                                           // 常數可改
assert.ok(!(await text('#o_estate')).includes('864,000'));
await click('#t_import'); await set('#f_iGoods', '1500'); await set('#f_iShip', '600');
assert.ok((await text('#o_import')).includes('326'));
await set('#f_pLiq', '2'); assert.ok((await text('#o_import')).includes('需申報'));
await click('#t_vat'); await set('#f_bAmt', '105');
assert.ok((await text('#o_vat')).includes('100'));
await set('#f_bLines', '10\n10\n10'); assert.ok((await text('#o_vat')).includes('+1'));
await noScroll();

// 記住（重新載入）→ 重置
await page.reload();
assert.equal(await page.evaluate(() => document.querySelector('#p_vat').hidden), false);
assert.equal(await page.evaluate(() => document.querySelector('#k_eExempt').value), '0');
assert.equal(await page.evaluate(() => document.querySelector('#f_iGoods').value), '1500');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
await click('#reset');
assert.equal(await page.evaluate(() => localStorage.getItem('twtax_opts')), null);
assert.equal(await page.evaluate(() => document.querySelector('#k_eExempt').value), '13330000');
assert.equal(await page.evaluate(() => document.querySelector('#f_iGoods').value), '');

// 壞資料容錯
await page.evaluate(() => localStorage.setItem('twtax_opts', '{"tab":5,"v":[1],"c":{"gU":"x"}}'));
await page.reload();
assert.equal(await page.evaluate(() => document.querySelector('#k_gU').value), '10000000');
assert.deepEqual(errors, []);
await browser.close();
console.log('tw-tax-calc OK');
