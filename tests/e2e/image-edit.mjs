// image-edit：載入程式產生的測試圖 → 馬賽克破壞像素、九宮格 ZIP、證件照排版、貼圖檢查、無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/image-edit.html');
    await page.evaluate(() => { window.__b = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__b.push(b); return o(b); }; });
    const put = (sel, w, h) => page.evaluate(async (sel, w, h) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
        for (let i = 0; i < w; i += 2) { x.fillStyle = i % 4 ? '#f00' : '#00f'; x.fillRect(i, 0, 2, h); }       // 直條紋：馬賽克後會變平均色
        const b = await new Promise(r => c.toBlob(r, 'image/png')), f = new File([b], 't.png', { type: 'image/png' }), dt = new DataTransfer(); dt.items.add(f);
        const inp = document.querySelector(sel); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
    }, sel, w, h);
    await put("#file", 400, 300); await page.evaluate(() => { if (scrollMode) document.querySelector("#mkScroll").click(); });
    await page.waitForFunction(() => document.querySelector('#fileMsg').textContent.includes('已載入'));
    // 馬賽克：直接推一個 op 後重畫，檢查區域像素
    const px = (x, y) => page.evaluate((x, y) => [...document.querySelector('#mkCv').getContext('2d').getImageData(x, y, 1, 1).data], x, y);
    const before = await px(11, 11);
    await page.evaluate(() => { ops.push({ t: 'black', x: 0, y: 0, x2: 50, y2: 50, c: '#f00', v: 10, text: '' }); drawMark(); });
    assert.deepStrictEqual((await px(11, 11)).slice(0, 3), [0, 0, 0]); assert.notDeepStrictEqual(before.slice(0, 3), [0, 0, 0]);
    await page.evaluate(() => { ops = [{ t: 'mosaic', x: 0, y: 0, x2: 100, y2: 100, c: '#f00', v: 40, text: '' }]; drawMark(); });
    const a = await px(0, 0), b = await px(2, 0);
    assert.deepStrictEqual(a, b, '馬賽克後相鄰條紋應同色');
    // 九宮格 ZIP
    await page.evaluate(() => document.querySelector('[data-t=gr]').click());
    await page.evaluate(() => document.querySelector('#grZip').click());
    await page.waitForFunction(() => window.__b.length > 0, { timeout: 8000 });
    const z = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await window.__b.at(-1).arrayBuffer()))));
    assert.equal(z.readUInt16LE(z.length - 22 + 10), 9); assert.equal(z.readUInt32LE(0), 0x04034b50);
    // 證件照
    await page.evaluate(() => document.querySelector('[data-t=id]').click());
    assert.match(await page.evaluate(() => document.querySelector('#idMsg').textContent), /可排 8 張/);
    // 貼圖檢查（隨機條紋圖：不透明 → 應不通過）
    await page.evaluate(() => document.querySelector('[data-t=st]').click());
    await put('#stFile', 370, 320);
    await page.waitForFunction(() => document.querySelector('#stOut').textContent.includes('不通過'), { timeout: 5000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '橫向溢出');
    assert.deepStrictEqual(errors, []);
} finally { await browser.close(); }
