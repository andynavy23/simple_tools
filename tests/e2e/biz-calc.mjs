// biz-calc：分頁、輸出、記住輸入、壞資料、重置、手機不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/biz-calc.html');
const txt = (sel) => page.$eval(sel, e => e.textContent);
const type = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const tab = (i) => page.evaluate((n) => document.querySelector(`#tabs button[data-i="${n}"]`).click(), i);
const noScroll = async (tag) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });

let t = await txt('#o_price');
assert.ok(t.includes('166.67') && t.includes('175') && t.includes('66.67%'), t);
await type('#p_pct', '100'); assert.ok((await txt('#o_price')).includes('請填入'));
await page.select('#p_mode', 'price'); await type('#p_price', '200'); await type('#p_cost', '150'); assert.ok((await txt('#o_price')).includes('25%'));
assert.ok((await txt('#o_bep')).includes('250 件') && (await txt('#o_bep')).includes('125,000'));
assert.ok(await page.evaluate(() => { const c = document.querySelector('#cv'); return c.width > 0 && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(x => x); }), 'BEP 圖未繪製');
await type('#b_price', '300'); assert.ok((await txt('#o_bep')).includes('單價要大於'));
assert.ok((await txt('#o_tax')).includes('1,000') && (await txt('#o_tax')).includes('50'));
await noScroll('利潤');
await tab(1); assert.ok(await page.$eval('#p1', e => !e.hidden));
assert.ok((await txt('#o_shop')).includes('151'), await txt('#o_shop'));
await type('#s_plat', '60'); await type('#s_pay', '40'); assert.ok((await txt('#o_shop')).includes('小於 100%'));
assert.ok((await txt('#o_dlv')).includes('45'));
assert.ok((await txt('#o_vol')).includes('4 kg') && (await txt('#o_vol')).includes('體積重'));
assert.ok((await txt('#o_spec')).includes('超商取貨符合') || (await txt('#o_spec')).includes('符合'));
await type('#c_l', '60'); assert.ok((await txt('#o_spec')).includes('不符：最長邊 60 超過 45 cm'));
await noScroll('電商');
await tab(2);
assert.ok((await txt('#o_ads')).includes('2%') && (await txt('#o_ads')).includes('3 倍'));
assert.ok((await txt('#o_fun')).includes('流失最多'));
assert.ok((await txt('#o_ab')).includes('差異顯著') && (await txt('#o_ab')).includes('0.0355'), await txt('#o_ab'));
assert.ok((await txt('#o_ss')).includes('3,841'));
assert.ok((await txt('#o_nl')).includes('24.24%'), await txt('#o_nl'));
await type('#a_ca', '2000'); assert.ok((await txt('#o_ab')).includes('不可超過'));
await type('#fun', 'a,1'); assert.ok((await txt('#o_fun')).includes('至少需要兩個階段'));
await noScroll('行銷');
// 記住
await page.reload({ waitUntil: 'load' });
assert.ok(await page.$eval('#p2', e => !e.hidden), '記住分頁'); assert.strictEqual(await page.$eval('#fun', e => e.value), 'a,1');
// 壞資料
await page.evaluate(() => localStorage.setItem('bizcalc_opts', '{"tab":9,"v":{"p_cost":5,"fun":null}}'));
await page.reload({ waitUntil: 'load' });
assert.ok(await page.$eval('#p0', e => !e.hidden)); assert.strictEqual(await page.$eval('#p_cost', e => e.value), '100');
// 重置
await page.evaluate(() => { window.confirm = () => true; });
await type('#p_cost', '999'); await page.evaluate(() => document.querySelector('#reset').click());
await page.waitForFunction(() => document.querySelector('#p_cost').value === '100');
assert.strictEqual(await page.evaluate(() => localStorage.getItem('bizcalc_opts')), null);
assert.deepStrictEqual(errors, []);
await browser.close();
