// home-calc：分頁、即時輸出、記住輸入、壞資料、重置、手機不橫向溢出；fuel-log 輪胎規格解讀
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/home-calc.html');
const txt = (sel) => page.$eval(sel, e => e.textContent);
const type = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const tab = (i) => page.evaluate((n) => document.querySelector(`#tabs button[data-i="${n}"]`).click(), i);
const noScroll = async (tag) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });

assert.ok((await txt('#o_g_fert')).includes('200 / 200 / 200'), await txt('#o_g_fert'));
await type('#fe_n', '0'); await type('#fe_p', '0'); await type('#fe_k', '0'); assert.ok((await txt('#o_g_fert')).includes('至少一項'));
await type('#fe_n', '20'); await type('#fe_p', '20'); await type('#fe_k', '20');
assert.ok((await txt('#o_g_pot')).includes('每盆土量'));
assert.ok((await txt('#o_g_comp2')).includes('2 : 1') && (await txt('#o_g_comp2')).includes('10 kg'), await txt('#o_g_comp2'));
await noScroll('園藝');
for (let i = 1; i < 7; i++) { await tab(i); assert.ok(await page.$eval('#p' + i, e => !e.hidden)); await noScroll('分頁' + i); }
await tab(2);
assert.ok((await txt('#o_g_dew')).includes('16.7'), await txt('#o_g_dew'));
assert.ok((await txt('#o_g_dew')).includes('會結露'));
assert.ok((await txt('#o_g_aqi')).includes('87'), await txt('#o_g_aqi'));
await page.select('#aq_std', 'us'); await type('#aq_v', '9'); assert.ok((await txt('#o_g_aqi')).includes('50'));
await type('#fl_t', '-10'); await type('#fl_v', '20'); assert.ok((await txt('#o_g_feel')).includes('-17.9'), await txt('#o_g_feel'));
await tab(3); assert.ok((await txt('#o_g_ac')).includes('3.96') || (await txt('#o_g_ac')).includes('4.1'), await txt('#o_g_ac'));
await tab(4); await type('#fu_m', '0'); assert.ok((await txt('#o_g_door')).includes('可直放通過'), await txt('#o_g_door'));
await type('#fu_a', '300'); await type('#fu_b', '100'); await type('#fu_c', '100'); assert.ok((await txt('#o_g_door')).includes('無法通過'));
assert.ok((await txt('#o_g_corner')).includes('轉不過') || (await txt('#o_g_corner')).includes('尺寸需'));
await tab(5); assert.ok((await txt('#o_g_pet')).includes('180'), await txt('#o_g_pet'));
await tab(6); assert.ok((await txt('#o_g_dia')).includes('240') || (await txt('#o_g_dia')).includes('270'), await txt('#o_g_dia'));
// 記住
await page.reload({ waitUntil: 'load' });
assert.ok(await page.$eval('#p6', e => !e.hidden), '記住分頁'); assert.strictEqual(await page.$eval('#fu_a', e => e.value), '300');
// 壞資料
await page.evaluate(() => localStorage.setItem('homec_opts', '{"tab":99,"v":{"fe_n":5,"fu_a":null}}'));
await page.reload({ waitUntil: 'load' });
assert.ok(await page.$eval('#p0', e => !e.hidden)); assert.strictEqual(await page.$eval('#fe_n', e => e.value), '20');
// 重置
await page.evaluate(() => { window.confirm = () => true; });
await type('#fe_n', '33'); await page.evaluate(() => document.querySelector('#reset').click());
await page.waitForFunction(() => document.querySelector('#fe_n').value === '20');
assert.strictEqual(await page.evaluate(() => localStorage.getItem('homec_opts')), null);
assert.deepStrictEqual(errors, []);

// fuel-log 輪胎
const f = await openPage(browser, 'utils/fuel-log.html'), fp = f.page;
await fp.evaluate(() => { document.querySelector('#dTire').open = true; });
let o = await fp.$eval('#tireOut', e => e.textContent);
assert.ok(o.includes('615 kg') && o.includes('240 km/h') && o.includes('631.9'), o);
await fp.evaluate(() => { const e = document.querySelector('#tireB'); e.value = '215/50R17'; e.dispatchEvent(new Event('input', { bubbles: true })); });
o = await fp.$eval('#tireOut', e => e.textContent); assert.ok(o.includes('+14.9') && o.includes('102.4'), o);
await fp.evaluate(() => { const e = document.querySelector('#tireA'); e.value = 'xyz'; e.dispatchEvent(new Event('input', { bubbles: true })); });
assert.ok((await fp.$eval('#tireOut', e => e.textContent)).includes('無法解析'));
assert.ok(await fp.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), '輪胎：橫向捲動');
assert.deepStrictEqual(f.errors, []);
await browser.close();
