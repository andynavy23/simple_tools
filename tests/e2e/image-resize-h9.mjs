// image-resize：佔位圖產生、圖片轉 PDF（真的下載 PDF 再解析結構）
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { launchEdge, openPage } from './lib.mjs';
const { parsePdf } = createRequire(import.meta.url)('../h9-pdfparse.js');

const browser = await launchEdge();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-h9-'));
try {
    const { page, errors } = await openPage(browser, 'utils/image-resize.html');
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, s, v);
    const waitFile = async (re) => { for (let i = 0; i < 60; i++) { const f = fs.existsSync(browser.downloadDir) ? fs.readdirSync(browser.downloadDir).find(x => re.test(x) && !x.endsWith('.crdownload')) : null; if (f) return path.join(browser.downloadDir, f); await new Promise(r => setTimeout(r, 200)); } throw new Error('沒有下載到檔案 ' + re); };
    const clearDl = () => { if (fs.existsSync(browser.downloadDir)) for (const f of fs.readdirSync(browser.downloadDir)) fs.rmSync(path.join(browser.downloadDir, f), { force: true }); };

    // ---- 佔位圖 ----
    await page.evaluate(() => { document.querySelector('#phCard').open = true; });
    assert.equal(await page.evaluate(() => document.querySelectorAll('#phList img').length), 1);
    await set('#phSizes', '300x200, 64'); assert.equal(await page.evaluate(() => document.querySelectorAll('#phList img').length), 2);
    assert.ok(await page.evaluate(() => document.querySelector('#phList img').src.startsWith('data:image/svg+xml,')));
    await set('#phSizes', '5000x20'); assert.match(await text('#phErr'), /1–4096/); assert.equal(await page.evaluate(() => document.querySelectorAll('#phList img').length), 0);
    await set('#phSizes', '300x200'); await set('#phText', 'Hero {w}');
    clearDl(); await page.evaluate(() => document.querySelector('#phList button').click());
    const png = fs.readFileSync(await waitFile(/placeholder-300x200\.png$/));
    assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), 300); assert.equal(png.readUInt32BE(20), 200);
    const pix = await page.evaluate(async () => { const r = await fetch(document.querySelector('#phList img').src), t = await r.text(); return t.includes('Hero 300'); }); assert.ok(pix);

    // ---- 圖片轉 PDF ----
    const makePng = async (w, h, color, name) => {
        const b64 = await page.evaluate((w, h, color) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h / 2); g.clearRect(0, h / 2, w, h / 2); return c.toDataURL('image/png').split(',')[1]; }, w, h, color);
        const f = path.join(tmp, name); fs.writeFileSync(f, Buffer.from(b64, 'base64')); return f;
    };
    const f1 = await makePng(800, 400, '#d00', 'a.png'), f2 = await makePng(300, 600, '#0a0', 'b.png'), f3 = await makePng(500, 500, '#00d', 'c.png');
    await page.evaluate(() => { document.querySelector('#pdfCard').open = true; });
    await (await page.$('#pdfFile')).uploadFile(f1, f2, f3);
    await page.waitForFunction(() => document.querySelectorAll('#pdfList .row').length === 3);
    const names = () => page.evaluate(() => [...document.querySelectorAll('#pdfList span')].map(s => s.textContent.replace(/^\d+\. /, '').replace(/（.*/, '')));
    assert.deepEqual(await names(), ['a.png', 'b.png', 'c.png']);
    await page.evaluate(() => document.querySelectorAll('#pdfList .row')[2].querySelectorAll('button')[0].click());      // c 上移
    assert.deepEqual(await names(), ['a.png', 'c.png', 'b.png']);
    assert.equal(await page.evaluate(() => document.querySelector('#pdfList .row button').disabled), true);               // 第一張不能再上移
    await page.evaluate(() => document.querySelectorAll('#pdfList .row')[1].querySelectorAll('button')[2].click());      // 刪除 c
    assert.deepEqual(await names(), ['a.png', 'b.png']);
    await (await page.$('#pdfFile')).uploadFile(f3); await page.waitForFunction(() => document.querySelectorAll('#pdfList .row').length === 3);
    assert.deepEqual(await names(), ['a.png', 'b.png', 'c.png']);

    await set('#pdfMargin', '10'); clearDl(); await click('#pdfGo');
    const pdf = parsePdf(fs.readFileSync(await waitFile(/^images-.*\.pdf$/)));
    assert.equal(pdf.pages.length, 3); assert.equal(pdf.objCount, 2 + 9);
    assert.deepEqual([pdf.pages[0].w, pdf.pages[0].h], [841.89, 595.28]);      // 800×400 橫圖 → A4 橫式
    assert.deepEqual([pdf.pages[1].w, pdf.pages[1].h], [595.28, 841.89]);      // 300×600 直圖 → A4 直式
    assert.deepEqual([pdf.pages[0].iw, pdf.pages[0].ih], [800, 400]);
    for (const p of pdf.pages) { assert.equal(p.jpeg[0], 0xff); assert.equal(p.jpeg[1], 0xd8); assert.equal(p.jpeg[p.jpeg.length - 2], 0xff); assert.equal(p.jpeg[p.jpeg.length - 1], 0xd9); }
    // 原圖尺寸 + 刪除 + 清空
    await set('#pdfPaper', 'orig'); await set('#pdfMargin', '0'); clearDl(); await click('#pdfGo');
    const pdf2 = parsePdf(fs.readFileSync(await waitFile(/^images-.*\.pdf$/))); assert.deepEqual([pdf2.pages[0].w, pdf2.pages[0].h], [600, 300]);
    assert.match(await text('#pdfMsg'), /完成：3 頁/);
    // 壞檔：指出檔名並中止，不產生 PDF
    const bad = path.join(tmp, 'bad.png'); fs.writeFileSync(bad, 'not an image');
    await (await page.$('#pdfFile')).uploadFile(bad); await page.waitForFunction(() => document.querySelectorAll('#pdfList .row').length === 4);
    clearDl(); await click('#pdfGo'); await page.waitForFunction(() => document.querySelector('#pdfErr').textContent.length > 0);
    assert.match(await text('#pdfErr'), /bad\.png/); assert.ok(!fs.readdirSync(browser.downloadDir).some(f => f.endsWith('.pdf')));
    // 上限：加到 100 頁後拒絕新增並提示
    await page.evaluate(() => { const f = new File([new Uint8Array(10)], 'x.png', { type: 'image/png' }); pdfAdd(Array.from({ length: 120 }, () => f)); });
    assert.equal(await page.evaluate(() => pdfItems.length), 100); assert.match(await text('#pdfErr'), /100 頁上限/);
    await page.evaluate(() => { window.confirm = () => true; }); await click('#pdfClear');
    assert.equal(await page.evaluate(() => pdfItems.length), 0);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('image-resize-h9 OK');
