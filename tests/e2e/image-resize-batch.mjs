// image-resize：批次縮圖 / 轉檔 ZIP（3 張 JPEG → WebP 寬 800、長寬比不變；31 張提示上限；單張壞檔只標示該張）（頁名：image-resize）
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';

function unzip(b) {
    const out = {}; let o = 0;
    while (b.readUInt32LE(o) === 0x04034b50) {
        const cs = b.readUInt32LE(o + 18), nl = b.readUInt16LE(o + 26), name = b.toString('utf8', o + 30, o + 30 + nl);
        out[name] = b.subarray(o + 30 + nl, o + 30 + nl + cs); o += 30 + nl + cs;
    }
    return out;
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-batch-'));
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/image-resize.html');
    await page.evaluate(() => { window.__b = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__b.push(b); return o(b); }; });
    const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
    const mk = async (w, h, name) => {
        const b64 = await page.evaluate((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, w, h); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; }, w, h);
        const f = path.join(tmp, name); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f;
    };
    const fs3 = [await mk(1600, 1200, 'a.jpg'), await mk(2000, 1000, 'b.jpg'), await mk(1200, 1600, 'a.jpg.jpeg')];
    await (await page.$('#file')).uploadFile(...fs3);
    await page.waitForFunction(() => !document.querySelector('#batchBox').hidden && !document.querySelector('#panel').hidden, { timeout: 8000 });
    await set('#fmt', 'image/webp'); await set('#maxw', '800');
    await page.evaluate(() => { window.__b.length = 0; document.querySelector('#batchZip').click(); });
    await page.waitForFunction(() => window.__b.some(b => b.type === 'application/zip'), { timeout: 15000 });
    const zip = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await window.__b.filter(b => b.type === 'application/zip').at(-1).arrayBuffer()))));
    const files = unzip(zip), names = Object.keys(files).sort();
    assert.deepEqual(names, ['a-800x600.webp', 'a.jpg-800x1067.webp', 'b-800x400.webp']);
    // 逐張解碼確認寬皆 800 或（直式 600）且長寬比不變
    for (const n of names) {
        const dims = await page.evaluate(async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)], { type: 'image/webp' })); return [bm.width, bm.height]; }, Array.from(files[n]));
        const m = /-(\d+)x(\d+)\./.exec(n); assert.deepEqual(dims, [+m[1], +m[2]], n);
    }
    // 31 張：提示上限
    const many = []; for (let i = 0; i < 31; i++) many.push(await mk(8, 8, 'm' + i + '.jpg'));
    await (await page.$('#file')).uploadFile(...many);
    await page.waitForFunction(() => document.querySelector('#batchInfo').textContent.includes('最多 30 張'), { timeout: 8000 });
    // 壞檔只標示該張
    const bad = path.join(tmp, 'bad.jpg'); fs.writeFileSync(bad, 'not an image');
    await (await page.$('#file')).uploadFile(fs3[0], bad);
    await page.waitForFunction(() => !document.querySelector('#batchBox').hidden && document.querySelector('#batchInfo').textContent.includes('已選 2 張'), { timeout: 8000 });
    await page.evaluate(() => { window.__b.length = 0; document.querySelector('#batchZip').click(); });
    await page.waitForFunction(() => document.querySelector('#batchInfo').textContent.includes('完成'), { timeout: 15000 });
    assert.match(await page.evaluate(() => document.querySelector('#batchInfo').textContent), /成功 1 張、失敗 1 張/);
    assert.ok(await page.evaluate(() => document.querySelector('#batchList').textContent.includes('無法讀取')));
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
    assert.deepEqual(errors, []);
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
