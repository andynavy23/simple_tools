// color-tools：近似 Tailwind 色
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/color-tools.html');
    const rows = () => page.evaluate(() => [...document.querySelectorAll('#twList .li')].map(r => r.textContent));
    assert.equal((await rows()).length, 5);
    await page.evaluate(() => { const t = document.querySelector('#color'); t.value = '#3b82f6'; t.dispatchEvent(new Event('input')); });
    let r = await rows(); assert.match(r[0], /blue-500 #3b82f6 · ΔE 0\.0（相同）/); assert.match(r[0], /bg-blue-500.*text-blue-500.*border-blue-500/);
    await page.evaluate(() => { const t = document.querySelector('#color'); t.value = 'rgb(255,255,255)'; t.dispatchEvent(new Event('input')); });
    assert.match((await rows())[0], /^white #ffffff/);
    // 無效色碼不更新、不報錯
    await page.evaluate(() => { const t = document.querySelector('#color'); t.value = 'zzz'; t.dispatchEvent(new Event('input')); });
    assert.equal((await rows()).length, 5);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('color-tools-tw OK');
