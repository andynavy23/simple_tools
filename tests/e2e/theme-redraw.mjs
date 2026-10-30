// 切換明暗後 canvas 圖表要以新顏色重畫，且 Chrome 會派發 st-themechange
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);

async function check(page, sel, tag) {
    await page.evaluate(() => { window.__tc = 0; addEventListener('st-themechange', () => window.__tc++); Chrome.setMode('light'); });
    await sleep(300);
    const snap = () => page.$eval(sel, c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) | 0; return h; });
    const before = await snap();
    await page.evaluate(() => Chrome.setMode('dark'));
    await sleep(300);
    assert.ok(await page.evaluate(() => window.__tc >= 1), tag + '：未派發 st-themechange');
    assert.notEqual(await snap(), before, tag + '：畫布像素未變');
}

{
    const { page, errors } = await openPage(browser, 'utils/finance-calc.html');
    await page.evaluate(() => document.querySelectorAll('#tabs button')[4].click());
    await set(page, '#cf_open', '10000'); await set(page, '#cf_name', '薪水'); await set(page, '#cf_amt', '30000');
    await page.evaluate(() => document.querySelector('#cf_add').click());
    await check(page, '#cf_cv', 'finance-calc');
    assert.deepEqual(errors, []);
}
{
    const { page, errors } = await openPage(browser, 'utils/biz-calc.html');
    await set(page, '#b_fix', '50000'); await set(page, '#b_var', '100'); await set(page, '#b_price', '300');
    await check(page, '#cv', 'biz-calc');
    assert.deepEqual(errors, []);
}
await browser.close();
