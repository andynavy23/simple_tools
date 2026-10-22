// stock-cost 進階試算、income-tax 進階估算的畫面行為（頁名：stock-cost、income-tax）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
{
    const { page, errors } = await openPage(browser, 'utils/stock-cost.html');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#advBox details').length), 9);
    assert.ok((await text(page, '#advBox details:nth-child(1)')).includes('88.18'));
    assert.ok((await text(page, '#advBox details:nth-child(3)')).includes('78.00'));
    await set(page, '#x_long_price', '200');
    assert.ok((await text(page, '#advBox details:nth-child(3)')).includes('156.00'));
    await set(page, '#x_val_r', '2');
    assert.ok((await text(page, '#advBox details:nth-child(8)')).includes('本益比法'));
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
    assert.deepEqual(errors, []);
}
{
    const { page, errors } = await openPage(browser, 'utils/income-tax.html');
    await set(page, '#salary', '900000'); await set(page, '#pWage', '50000'); await set(page, '#pRate', '6');
    assert.ok((await text(page, '#pOut')).includes('1,800'));
    await set(page, '#dDiv', '100000'); assert.ok((await text(page, '#dOut')).includes('合併計稅較省'));
    await set(page, '#bBonus', '100000'); assert.ok((await text(page, '#bOut')).includes('95,000'));
    await set(page, '#fAge', '65'); assert.ok((await text(page, '#fOut')).includes('97,000'));
    assert.deepEqual(errors, []);
}
await browser.close();
