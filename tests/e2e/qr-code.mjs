// qr-code：條碼分頁（Code 128 / EAN-13 / Code 39，PNG 與 SVG 輸出、高度）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/qr-code.html');
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const set = (id, v) => page.evaluate((id, v) => { const e = document.querySelector('#' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, id, v);
    await page.evaluate(() => { window.__b = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__b.push(b); return o(b); }; document.querySelector('[data-t=bar]').click(); });
    const canvas = () => page.evaluate(() => { const c = document.querySelector('#bc'); return { w: c.width, h: c.height }; });
    const lastText = () => page.evaluate(async () => window.__b.at(-1).text());

    // Code 39
    await set('btype', 'c39'); await set('bin', 'abc-123');
    assert.match(await text('#binfo'), /Code 39：7 個字元/);
    const c1 = await canvas();
    assert.ok(c1.w > 100 && c1.h > 100);
    await page.evaluate(() => document.querySelector('#bsvg').click());
    const svg = await lastText();
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && svg.includes('<path d="M') && svg.includes('>ABC-123</text>'), svg.slice(0, 200));
    // 高度與顯示文字：畫布與 SVG 都跟著變
    await set('bh', 200); const c2 = await canvas(); assert.equal(c2.h - c1.h, 90); assert.equal(c2.w, c1.w);
    await page.evaluate(() => { const e = document.querySelector('#btext'); e.checked = false; e.dispatchEvent(new Event('change')); document.querySelector('#bsvg').click(); });
    const svg2 = await lastText(); assert.ok(!svg2.includes('<text') && svg2.includes('v200h'), svg2.slice(0, 200));
    assert.equal((await canvas()).h, 220);
    // 不支援的字元：顯示錯誤、隱藏預覽
    await set('bin', 'ab*c'); assert.match(await text('#binfo'), /Code 39 不支援/); assert.ok(await page.evaluate(() => document.querySelector('#bstage').hidden));
    // PNG 下載
    await set('bin', 'HELLO'); await page.evaluate(() => document.querySelector('#bsave').click());
    await page.waitForFunction(() => window.__b.some(b => b.type === 'image/png'), { timeout: 5000 });
    // 既有的 Code 128 / EAN-13 不受影響
    await page.evaluate(() => { const t = document.querySelector('#btext'); t.checked = true; t.dispatchEvent(new Event('change')); });
    await set('btype', 'ean13'); await set('bin', '590123412345'); assert.match(await text('#binfo'), /EAN-13：5901234123457（檢查碼 7）/);
    await page.evaluate(() => { document.querySelector('#bsvg').click(); }); const e = await lastText(); assert.ok(e.includes('>5  901234  123457</text>'));
    await set('bin', '5901234123458'); assert.match(await text('#binfo'), /檢查碼不正確/);
    await set('btype', 'c128'); await set('bin', 'HELLO-123'); assert.match(await text('#binfo'), /Code 128 B/);
    await set('bin', '123456'); assert.match(await text('#binfo'), /Code 128 C/);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('qr-code OK');
