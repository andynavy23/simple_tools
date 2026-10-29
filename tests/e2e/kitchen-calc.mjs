// kitchen-calc：每個分頁有輸出、記住輸入、壞資料、重置、手機不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/kitchen-calc.html');
    const txt = (sel) => page.$eval(sel, e => e.textContent);
    const type = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    const n = await page.$$eval('#tabs button', b => b.length);
    assert.strictEqual(n, 15);
    for (let i = 0; i < n; i++) {
        await page.evaluate((k) => document.querySelector(`#tabs button[data-i="${k}"]`).click(), i);
        assert.ok(await page.$eval('#p' + i, e => !e.hidden), '分頁 ' + i);
        const t = await txt('#o' + i);
        assert.ok(t.length > 5 && !t.includes('請填入有效'), `分頁 ${i} 預設值沒有輸出：${t}`);
        assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), `分頁 ${i} 橫向捲動`);
    }
    // 數值
    await page.evaluate(() => document.querySelector('#tabs button[data-i="0"]').click());
    assert.ok((await txt('#o0')).includes('3 小時'), await txt('#o0'));
    await type('#y_pct', '0'); assert.ok((await txt('#o0')).includes('請填入'));
    await page.evaluate(() => document.querySelector('#tabs button[data-i="10"]').click());
    assert.ok((await txt('#o10')).includes('25.3%'), await txt('#o10'));
    await type('#m_list', '亂寫'); assert.ok((await txt('#o10')).includes('請至少填一行'));
    // 記住分頁與輸入
    await type('#y_pct', '2');
    await page.reload({ waitUntil: 'load' });
    assert.ok(await page.$eval('#p10', e => !e.hidden), '記住分頁'); assert.strictEqual(await page.$eval('#m_list', e => e.value), '亂寫'); assert.strictEqual(await page.$eval('#y_pct', e => e.value), '2');
    // 壞資料
    await page.evaluate(() => localStorage.setItem('kitchenc_opts', '{"tab":99,"v":{"y_pct":5,"m_list":null,"y_type":"zzz"}}'));
    await page.reload({ waitUntil: 'load' });
    assert.ok(await page.$eval('#p0', e => !e.hidden)); assert.strictEqual(await page.$eval('#y_pct', e => e.value), '1'); assert.strictEqual(await page.$eval('#y_type', e => e.value), 'instant');
    // 重置
    await page.evaluate(() => { window.confirm = () => true; });
    await type('#y_pct', '3'); await page.evaluate(() => document.querySelector('#reset').click());
    await page.waitForFunction(() => document.querySelector('#y_pct').value === '1');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('kitchenc_opts')), null);
    assert.deepStrictEqual(errors, []);
} finally { await browser.close(); }
