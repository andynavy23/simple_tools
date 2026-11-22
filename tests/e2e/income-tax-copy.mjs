// income-tax：複製摘要（133）、三項特別扣除（144）、舊資料相容（頁名：income-tax）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/income-tax.html');
    const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
    const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
    const tax = async () => Number((await text('#tax')).replace(/[^\d]/g, ''));
    // 舊資料（沒有新欄位）載入不壞
    await page.evaluate(() => localStorage.setItem('itax_opts', JSON.stringify({ salary: 900000, married: false, dedMode: 'std' })));
    await page.reload({ waitUntil: 'load' });
    assert.equal(await tax(), 22700);
    await set('#preschool', '1');
    assert.equal(await tax(), 22700 - 7500, '幼兒學前 15 萬 × 5%');
    assert.ok((await text('#out')).includes('幼兒學前特別扣除額'));
    await set('#preschool', ''); await set('#rent', '300000');
    assert.ok((await text('#out')).includes('房屋租金支出特別扣除額'));
    await set('#dedMode', 'item'); assert.ok((await text('#out')).includes('房貸利息'), '房租與房貸互斥提示');
    await set('#dedMode', 'std'); await set('#rent', ''); await set('#ltc', '1');
    assert.ok((await text('#out')).includes('長期照顧特別扣除額'));
    await set('#ltc', '');
    assert.ok((await text('.card:has(#tbl)')).includes('2026-11-22'), '稅制表註明查證日');
    // 複製摘要
    await page.evaluate(() => { window.__clip = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip = t; } }, configurable: true }); });
    await page.evaluate(() => document.querySelector('#copy').click()); await new Promise(r => setTimeout(r, 100));
    const clip = await page.evaluate(() => window.__clip);
    assert.ok(clip.includes('應納稅額') && clip.includes('22,700') && clip.includes('免責'), clip);
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
