// unit-converter：壓力 / 能量 / 功率 / 油耗分頁（頁名：unit-converter）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/unit-converter.html');
    const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
    const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
    const cat = (name) => page.evaluate((n) => [...document.querySelectorAll('#cats button')].find(b => b.textContent === n).click(), name);
    await cat('壓力'); await set('#val', '1'); await set('#from', 'atm');
    let t = await text('#out'); assert.ok(t.includes('101.325') && t.includes('14.69'), t);
    await cat('油耗'); await set('#val', '10'); t = await text('#out'); assert.ok(t.includes('23.52') && t.includes('28.248'), t);
    await set('#val', '0'); t = await text('#out'); assert.ok(t.includes('無效') && !t.includes('Infinity'), t);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
