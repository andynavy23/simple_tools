// i8 批次畫面行為：fuel-log / power-cost / warranty-log / recipe-scaler / health-calc 的新增區塊
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const open = (page, ...ids) => page.evaluate((a) => a.forEach(i => { document.getElementById(i).open = true; }), ids);
const noScroll = async (page, errors, n) => { assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), n + ' 橫向捲動'); assert.deepEqual(errors, [], n); };

// ---- fuel-log ----
{
    const { page, errors } = await openPage(browser, 'utils/fuel-log.html');
    await open(page, 'dTaxi', 'dPark', 'dTco', 'dTax', 'dMaint');
    assert.ok((await text(page, '#taxiOut')).includes('195'));
    await set(page, '#xKm', '1'); await set(page, '#xSlow', '0');
    assert.ok((await text(page, '#taxiOut')).includes('85'));
    await click(page, '#tNight'); assert.ok((await text(page, '#taxiOut')).includes('105'));
    await set(page, '#pDur', '3.5'); assert.ok((await text(page, '#parkOut')).includes('90'));
    assert.ok((await text(page, '#tcoOut')).length > 0);
    await set(page, '#cc', '1800'); assert.ok((await text(page, '#taxOut')).includes('7,120'));
    await set(page, '#ccUse', 'b'); assert.ok((await text(page, '#taxOut')).includes('3,060'));
    // 提醒：新增 / 狀態 / 完成 / 刪除 / 清除
    await set(page, '#mKind', '機油'); await set(page, '#mDate', '2020-01-01'); await set(page, '#mDays', '30'); await set(page, '#mKm', '0');
    await click(page, '#mAdd');
    assert.ok((await text(page, '#mList')).includes('已逾期'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('fuel_maint')).length), 1);
    await click(page, '#mList button:nth-of-type(1)');           // 已完成
    assert.ok(!(await text(page, '#mList')).includes('已逾期'));
    await click(page, '#mAdd'); assert.ok((await text(page, '#mCount')).includes('2 /'));
    await page.evaluate(() => { window.confirm = () => true; });
    await click(page, '#mList .it:last-child button:last-child');
    assert.ok((await text(page, '#mCount')).includes('1 /'));
    await click(page, '#mClear');
    assert.ok((await text(page, '#mCount')).includes('0 /'));
    await set(page, '#mDays', '0'); await click(page, '#mAdd'); assert.ok((await text(page, '#mMsg')).length > 0);
    await noScroll(page, errors, 'fuel-log'); await page.close();
}
// ---- power-cost ----
{
    const { page, errors } = await openPage(browser, 'utils/power-cost.html');
    await open(page, 'dWater', 'dGas');
    await set(page, '#wMonths', '1'); await set(page, '#wUse', '30');
    assert.ok((await text(page, '#wCost')).includes('263'));            // 73.5 + 189 = 262.5
    await set(page, '#wRt0', '10'); assert.ok((await text(page, '#wCost')).includes('289'));
    assert.ok((await text(page, '#gDays')).includes('天'));
    await noScroll(page, errors, 'power-cost'); await page.close();
}
// ---- warranty-log ----
{
    const { page, errors } = await openPage(browser, 'utils/warranty-log.html');
    await page.evaluate(() => { window.confirm = () => true; });
    await set(page, '#f_name', '空氣清淨機'); await click(page, '#save');
    await click(page, '.item details summary');
    await page.evaluate(() => { const i = document.querySelectorAll('.item details input'); i[0].value = '濾網'; i[1].value = '90'; i[2].value = '2020-01-01'; });
    await click(page, '.item details > button');
    assert.ok((await text(page, '#consDue')).includes('濾網'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('warranty_items'))[0].cons.length), 1);
    await page.evaluate(() => { document.querySelector('.item details').open = true; });
    await page.evaluate(() => [...document.querySelectorAll('.item details button')].find(b => b.textContent === '已更換').click());
    assert.ok(!(await page.evaluate(() => !document.getElementById('consCard').hidden)));
    await page.evaluate(() => { document.querySelector('.item details').open = true; [...document.querySelectorAll('.item details button')].find(b => b.textContent === '刪除').click(); });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('warranty_items'))[0].cons.length), 0);
    await noScroll(page, errors, 'warranty-log'); await page.close();
}
// ---- recipe-scaler ----
{
    const { page, errors } = await openPage(browser, 'utils/recipe-scaler.html');
    await open(page, 'dBake', 'dCoffee');
    await set(page, '#bIng', '5'); await set(page, '#bAmt', '1'); await set(page, '#bUnit', 'cup');
    assert.ok((await text(page, '#bOut')).includes('250'));
    await set(page, '#tC', '180'); assert.ok((await text(page, '#tGas')).includes('4'));
    assert.equal(await page.evaluate(() => document.querySelector('#tF').value), '356');
    await set(page, '#yAmt', '4'); await set(page, '#yKind', 'bp'); assert.ok((await text(page, '#yOut')).includes('1'));
    assert.equal(await page.evaluate(() => document.querySelector('#cfG').value), '20');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#cfSteps .stp').length), 3);
    await click(page, '#cfStart'); await new Promise(r => setTimeout(r, 600));
    assert.ok((await text(page, '#cfNow')).includes('現在'));
    await click(page, '#cfReset');
    await page.evaluate(() => { window.confirm = () => true; });
    await set(page, '#cfName', '日常'); await click(page, '#cfSave');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee_recipes')).length), 1);
    await set(page, '#cfW', '500'); await click(page, '#cfList [data-act=load]'); assert.equal(await page.evaluate(() => document.querySelector('#cfW').value), '300');
    await click(page, '#cfList [data-act=del]'); assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee_recipes')).length), 0);
    await set(page, '#cfName', 'a'); await click(page, '#cfSave'); await click(page, '#cfClear');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('coffee_recipes')).length), 0);
    await noScroll(page, errors, 'recipe-scaler'); await page.close();
}
// ---- health-calc ----
{
    const { page, errors } = await openPage(browser, 'utils/health-calc.html');
    await open(page, 'metCard', 'pregCard');
    await set(page, '#mSel', '4'); await set(page, '#mMin', '60'); await set(page, '#mKg', '70');
    assert.ok((await text(page, '#mOut')).includes('490'));
    await set(page, '#pLmp', '2099-01-01'); assert.ok((await text(page, '#pOut')).includes('未來'));
    await set(page, '#pLmp', '2026-01-01'); assert.ok((await text(page, '#pOut')).includes('2026-10-08'));
    await noScroll(page, errors, 'health-calc'); await page.close();
}
await browser.close();
console.log('i8-utils OK');
