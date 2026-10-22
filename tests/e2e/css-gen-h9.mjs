// css-gen：字型比例 / 單位換算 / 毛玻璃與新擬態 / 字型偵測
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/css-gen.html');
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const set = (id, v) => page.evaluate((id, v) => { const e = document.querySelector('#f_' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, id, v);

    await click('[data-t=scale]');
    assert.match(await text('#css'), /--step-0: 1rem;/);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#x .ts').length), 9);
    await set('ratio', '1.5'); await set('up', 2); await set('down', 0);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#x .ts').length), 3);
    assert.match(await text('#css'), /--step-2: 2.25rem;/);

    await click('[data-t=units]');
    await set('v', '24'); await set('from', 'px');
    assert.match(await text('#css'), /^24px\n1.5rem\n1.5em\n18pt/);
    await set('v', 'abc'); assert.equal(await text('#css'), ''); assert.match(await text('#x'), /請輸入數字/);

    await click('[data-t=glass]');
    assert.match(await text('#css'), /backdrop-filter: blur\(12px\)/);
    assert.ok(await page.evaluate(() => /blur/.test(document.querySelector('#box').style.cssText + document.querySelector('#box').style.backdropFilter)));
    await set('blur', 20); assert.match(await text('#css'), /blur\(20px\)/);
    await set('mode', 'neu');
    assert.match(await text('#css'), /^\.neu \{/); assert.match(await text('#note'), /3:1/);
    await set('shape', 'pressed'); assert.match(await text('#css'), /inset/);

    await click('[data-t=fonts]');
    assert.ok(await page.evaluate(() => document.querySelectorAll('#x .fr').length >= 10));
    assert.match(await text('#note'), /偵測限制/);
    assert.match(await text('#css'), /^font-family: .*sans-serif;$/);
    await set('text', 'Hello 你好'); assert.ok((await text('#x')).includes('Hello 你好'));

    // 設定存進 cssgen，重新載入後還原；壞資料退回預設
    await page.reload({ waitUntil: 'load' });
    assert.match(await text('#x'), /Hello 你好/);
    await page.evaluate(() => localStorage.setItem('cssgen', JSON.stringify({ tab: 'glass', glass: { mode: 'x', blur: 'zzz', color: 5 }, scale: 7, units: [], fonts: null })));
    await page.reload({ waitUntil: 'load' });
    assert.match(await text('#css'), /blur\(12px\)/);
    for (const t of ['scale', 'units', 'fonts']) { await click(`[data-t=${t}]`); assert.ok((await text('#x')).length > 0); }
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('css-gen-h9 OK');
