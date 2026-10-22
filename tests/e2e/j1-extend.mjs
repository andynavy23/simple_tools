// 批次 j1 畫面：finance-calc 存款 / 信用卡比較、biz-calc 新創股權、stock-cost 加密貨幣、unit-converter 黃金、packing-list 搬家
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const noScroll = async (page, tag) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), tag + '：橫向捲動');

{   // finance-calc
    const { page, errors } = await openPage(browser, 'utils/finance-calc.html');
    await page.evaluate(() => [...document.querySelectorAll('#tabs button')].find(b => b.textContent === '存款與卡片').click());
    let t = await text(page, '[data-c=dep] .out');
    assert.ok(t.includes('#1 C 銀行') && t.includes('1,032,000'), t);
    await set(page, '#dep_em', '6'); assert.ok((await text(page, '[data-c=dep] .out')).includes('提前解約'));
    await set(page, '#dep_plans', 'A,單利,x,1'); assert.ok((await text(page, '[data-c=dep] .out')).includes('第 1 行格式不對'));
    t = await text(page, '[data-c=cc] .out'); assert.ok(t.includes('#1 範例甲卡') && t.includes('已達月上限'), t);
    await set(page, '#cc_g', '1000'); await set(page, '#cc_a', '0'); await set(page, '#cc_w', '0'); await set(page, '#cc_o', '0'); await set(page, '#cc_d', '0');
    t = await text(page, '[data-c=cc] .out'); assert.ok(t.startsWith('#1 範例乙卡'), t);   // 小額消費：年費卡淨回饋為負、免年費卡第一
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.fincalc_opts).tab), 'cmp');
    await noScroll(page, 'finance-calc');
    assert.deepEqual(errors, []);
    await page.close();
}
{   // biz-calc
    const { page, errors } = await openPage(browser, 'utils/biz-calc.html');
    await page.evaluate(() => document.querySelector('#tabs button[data-i="3"]').click());
    assert.ok(await page.$eval('#p3', e => !e.hidden));
    let t = await text(page, '#o_cap'); assert.ok(t.includes('種子輪') && t.includes('A 輪'), t);
    await set(page, '#rounds', 'X,1000000,4000000'); await set(page, '#k_f', '100'); await set(page, '#k_p', '0');
    assert.ok((await text(page, '#o_cap')).includes('80%'), await text(page, '#o_cap'));
    await set(page, '#rounds', 'X'); assert.ok((await text(page, '#o_cap')).includes('格式不對'));
    assert.ok((await text(page, '#o_val')).includes('營收法'));
    await set(page, '#x_s', '80'); await set(page, '#x_c', '10'); t = await text(page, '#o_esop'); assert.ok(t.includes('賣出後淨損益') && t.includes('590,000'), t);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.bizcalc_opts).tab), 3);
    await page.reload(); assert.ok(await page.$eval('#p3', e => !e.hidden));
    await noScroll(page, 'biz-calc');
    assert.deepEqual(errors, []);
    await page.close();
}
{   // stock-cost
    const { page, errors } = await openPage(browser, 'utils/stock-cost.html');
    const t = await page.evaluate(() => { const d = [...document.querySelectorAll('#advBox details')].find(x => x.querySelector('summary').textContent.includes('加密貨幣')); d.open = true; return d.innerText; });
    assert.ok(t.includes('損益平衡賣價') && t.includes('非投資建議'), t);
    await set(page, '#x_crypto_q1', '1'); await set(page, '#x_crypto_p1', '100'); await set(page, '#x_crypto_bf', '0.1'); await set(page, '#x_crypto_sf', '0.1'); await set(page, '#x_crypto_slip', '0'); await set(page, '#x_crypto_sell', '110');
    assert.ok((await page.evaluate(() => document.querySelector('#x_crypto_q1').closest('details').innerText)).includes('100.1'));
    await noScroll(page, 'stock-cost');
    assert.deepEqual(errors, []);
    await page.close();
}
{   // unit-converter
    const { page, errors } = await openPage(browser, 'utils/unit-converter.html');
    await page.evaluate(() => [...document.querySelectorAll('#cats button')].find(b => b.textContent === '黃金').click());
    assert.ok(await page.$eval('#gold', e => !e.hidden));
    await set(page, '#from', '台兩'); await set(page, '#val', '1');
    let t = await text(page, '#out'); assert.ok(t.includes('37.5') && t.includes('金衡盎司'), t);
    await set(page, '#from', '錢'); await set(page, '#purity', String(0.999)); await set(page, '#gper', 'qian'); await set(page, '#gprice', '8000');
    assert.ok((await text(page, '#gout')).includes('7,992'), await text(page, '#gout'));
    await page.evaluate(() => [...document.querySelectorAll('#cats button')].find(b => b.textContent === '長度').click());
    assert.ok(await page.$eval('#gold', e => e.hidden));
    await noScroll(page, 'unit-converter');
    assert.deepEqual(errors, []);
    await page.close();
}
{   // packing-list
    const { page, errors } = await openPage(browser, 'utils/packing-list.html');
    assert.ok(await page.$eval('#roomsBox', e => e.hidden));
    await set(page, '#n_type', '搬家');
    assert.ok(await page.$eval('#roomsBox', e => !e.hidden) && await page.$eval('#seasonBox', e => e.hidden));
    await set(page, '#n_name', '新家'); await set(page, '#n_days', '4'); await set(page, '#n_rooms', '3');
    await page.evaluate(() => document.querySelector('#create').click());
    const t = await text(page, '#items'); assert.ok(t.includes('紙箱 × 24') && t.includes('戶政事務所') && t.includes('房間 3：打包與貼標'), t);
    assert.equal(await text(page, '#meta'), '搬家・4 天');
    await set(page, '#n_name', '甲'); await set(page, '#n_rooms', '0'); await page.evaluate(() => document.querySelector('#create').click());
    assert.ok((await text(page, '#newMsg')).includes('房間數'));
    await set(page, '#n_type', '出國'); assert.ok(await page.$eval('#roomsBox', e => e.hidden));
    await noScroll(page, 'packing-list');
    assert.deepEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('j1-extend OK');
