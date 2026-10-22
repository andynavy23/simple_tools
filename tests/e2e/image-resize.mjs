// image-resize：App 圖示 / Favicon 尺寸包（PNG 尺寸、maskable 填色、ICO、ZIP 結構與 CRC）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const crc = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xFFFFFFFF) >>> 0; };
function unzip(b) {
    const out = {}; let o = 0;
    while (b.readUInt32LE(o) === 0x04034b50) {
        const cs = b.readUInt32LE(o + 18), nl = b.readUInt16LE(o + 26), name = b.toString('utf8', o + 30, o + 30 + nl), data = b.subarray(o + 30 + nl, o + 30 + nl + cs);
        assert.equal(b.readUInt16LE(o + 8), 0, name + ' 應為 store'); assert.equal(crc(data), b.readUInt32LE(o + 14), name + ' CRC'); out[name] = data; o += 30 + nl + cs;
    }
    assert.equal(b.readUInt32LE(o), 0x02014b50, '中央目錄');
    return out;
}
const png = (b) => { assert.equal(b.toString('latin1', 1, 4), 'PNG'); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/image-resize.html');
    await page.evaluate(() => { window.__b = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__b.push(b); return o(b); }; });
    const grab = async () => Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await window.__b.at(-1).arrayBuffer()))));
    assert.ok(await page.evaluate(() => document.querySelector('#iconCard').hidden), '沒有圖片時不該顯示圖示包');
    // 用貼上的 SVG（紅色方塊、四邊留白）當來源，讓像素可預測
    await page.evaluate(() => { document.querySelector('#svgText').value = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="25" y="25" width="50" height="50" fill="#ff0000"/></svg>'; document.querySelector('#svgGo').click(); });
    await page.waitForFunction(() => !document.querySelector('#iconCard').hidden, { timeout: 5000 });
    await page.evaluate(() => { document.querySelector('#icBg').value = '#0000ff'; document.querySelector('#icGo').click(); });
    await page.waitForFunction(() => !document.querySelector('#icOut').hidden, { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.querySelectorAll('#icList img').length), 8);
    assert.equal(await page.evaluate(() => document.querySelector('#icErr').textContent), '');
    assert.match(await page.evaluate(() => document.querySelector('#icSnip').textContent), /apple-touch-icon[\s\S]*"icons"/);

    // ZIP：結構、CRC、PNG 尺寸、ICO
    await page.evaluate(() => document.querySelector('#icZip').click());
    const files = unzip(await grab());
    assert.deepEqual(Object.keys(files).sort(), ['favicon.ico', 'icon-16.png', 'icon-180.png', 'icon-192.png', 'icon-32.png', 'icon-48.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png', 'manifest-icons.json']);
    for (const [name, size] of [['icon-16.png', 16], ['icon-32.png', 32], ['icon-48.png', 48], ['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-192.png', 192], ['icon-maskable-512.png', 512]]) assert.deepEqual(png(files[name]), { w: size, h: size }, name);
    const ico = files['favicon.ico']; assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 3);
    [16, 32, 48].forEach((s, i) => { const o = 6 + 16 * i; assert.equal(ico[o], s); const len = ico.readUInt32LE(o + 8), off = ico.readUInt32LE(o + 12); assert.deepEqual(png(ico.subarray(off, off + len)), { w: s, h: s }); });
    assert.equal(JSON.parse(files['manifest-icons.json'].toString()).icons.length, 4);
    // 像素：用瀏覽器解碼 PNG 檢查（透明 / 背景色 / maskable 縮小）
    const pxb = (buf, x, y) => page.evaluate(async (b64, x, y) => {
        const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
        return Array.from(g.getImageData(x, y, 1, 1).data);
    }, buf.toString('base64'), x, y);
    const px = (name, x, y) => pxb(files[name], x, y);
    assert.deepEqual(await px('icon-512.png', 5, 5), [0, 0, 0, 0]);                 // 一般圖示：角落透明
    assert.deepEqual(await px('icon-512.png', 256, 256), [255, 0, 0, 255]);         // 中央是紅色方塊
    assert.deepEqual(await px('icon-180.png', 2, 2), [0, 0, 255, 255]);             // 180 一律填背景色
    assert.deepEqual(await px('icon-maskable-512.png', 5, 5), [0, 0, 255, 255]);    // maskable 填背景色
    assert.deepEqual(await px('icon-maskable-512.png', 256, 256), [255, 0, 0, 255]);
    assert.deepEqual(await px('icon-maskable-512.png', 120, 256), [0, 0, 255, 255]); // 紅方塊縮小後，原本 120px 的位置已是背景

    // 單張與 ICO 下載
    await page.evaluate(() => document.querySelector('#icIco').click());
    assert.equal((await grab()).readUInt16LE(4), 3);
    await page.evaluate(() => document.querySelector('#icList button').click());
    assert.equal(png(await grab()).w, 16);
    // 填滿模式 + 全部填背景色
    const before = await page.evaluate(() => window.__b.length);
    await page.evaluate(() => { document.querySelector('#icMode').value = 'cover'; document.querySelector('#icFill').checked = true; document.querySelector('#icGo').click(); });
    await page.waitForFunction((n) => window.__b.length >= n + 8, {}, before);   // 縮圖會各建一個 blob URL：等重新產生完
    await page.evaluate(() => document.querySelector('#icZip').click());
    const f2 = unzip(await grab()); assert.deepEqual(await pxb(f2['icon-32.png'], 0, 0), [0, 0, 255, 255]); assert.deepEqual(await pxb(f2['icon-512.png'], 256, 256), [255, 0, 0, 255]);   // 全部填背景色、中央仍是紅方塊
    // 「換一張」後圖示包收起
    await page.evaluate(() => document.querySelector('#reset').click());
    assert.ok(await page.evaluate(() => document.querySelector('#iconCard').hidden && document.querySelector('#icOut').hidden));
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('image-resize OK');
