// lottery-check：今彩 539 分頁（頁名：lottery-check）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/lottery-check.html');
    const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
    const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
    const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
    await click('[data-t=d5]');
    await set('#d5W', '01 05 12 20 39'); await set('#d5T', '01 05 12 20 38\n01 01 2 3 4\n50 1 2 3 4\n9 8 7 6 5');
    await click('#check');
    const out = await text('#out');
    assert.ok(out.includes('貳獎（中 4 個）'), out); assert.ok(out.includes('號碼不能重複') && out.includes('號碼要在 1–39') && out.includes('沒中'), out);
    await set('#d5W', '01 01 12 20 39'); await click('#check'); assert.ok((await text('#err')).includes('不能重複'));
    await set('#d5W', '01 05 12 20 40'); await click('#check'); assert.ok((await text('#err')).includes('1–39'));
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
