// file-inspector：載入檔案後的 Hexdump / 搜尋 / 類型 / ZIP 預覽 / 隱寫，以及 50MB 上限
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { launchEdge, openPage } from './lib.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-fi-'));
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, body) => { const b = Buffer.alloc(12 + body.length); b.writeUInt32BE(body.length, 0); b.write(t, 4, 'latin1'); body.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + body.length)), 8 + body.length); return b; };
// 8x8 RGB 圖，每個像素的 R 最低位元放 1（讓 LSB 平面有內容）
const w = 8, raw = Buffer.alloc((w * 3 + 1) * w); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) raw[y * (w * 3 + 1) + 1 + x * 3] = 201;
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(w, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), chunk('IHDR', ihdr), chunk('tEXt', Buffer.from('Comment\0hidden-note')), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const trailer = Buffer.from('SECRET-TRAILER-DATA');
const mk = (name, buf) => { const f = path.join(tmp, name); fs.writeFileSync(f, buf); return f; };
function zipOf(name, data) {
    const nb = Buffer.from(name), d = zlib.deflateRawSync(data), c = crc(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(c, 14); lh.writeUInt32LE(d.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(c, 16); ch.writeUInt32LE(d.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28);
    const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(1, 8); eo.writeUInt16LE(1, 10); eo.writeUInt32LE(46 + nb.length, 12); eo.writeUInt32LE(30 + nb.length + d.length, 16);
    return Buffer.concat([lh, nb, d, ch, nb, eo]);
}

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/file-inspector.html');
    const txt = (sel) => page.$eval(sel, e => e.textContent);
    const html = (sel) => page.$eval(sel, e => e.innerHTML);
    const tab = (i) => page.evaluate((n) => document.querySelector(`#tabs button[data-i="${n}"]`).click(), i);
    const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
    const type = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
    const load = async (f) => { await (await page.$('#file')).uploadFile(f); await page.waitForFunction(() => document.querySelector('#fname').textContent.length > 0 && !document.querySelector('#main').hidden); await new Promise(r => setTimeout(r, 300)); };
    const overflow = () => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);

    assert.ok(await page.$eval('#main', e => e.hidden), '未載入檔案前不顯示分頁');
    // PNG + 附加資料，檔名故意寫錯
    await load(mk('photo.jpg', Buffer.concat([png, trailer])));
    assert.ok((await txt('#hOut')).includes('89 50 4e 47') || (await txt('#hOut')).includes('89 50 4e 47 0d'), 'hexdump 檔頭');
    assert.ok((await txt('#hOut')).includes('|.PNG'), 'ASCII 欄');
    await type('#hQ', 'IEND'); await click('#hFind'); await page.waitForFunction(() => document.querySelector('#hInfo').textContent.includes('命中'));
    assert.ok((await txt('#hInfo')).includes('命中'));
    await page.select('#hQm', 'hex'); await type('#hQ', '53 45 43 52'); await click('#hFind'); await page.waitForFunction(() => document.querySelector('#hInfo').textContent.includes('命中 0x' + (document.querySelector('#hOut').textContent.slice(0, 8).replace(/^0+/, '') || '0')) || true);
    await new Promise(r => setTimeout(r, 300)); assert.ok((await txt('#hOut')).includes('SECR'), '搜尋後視窗要含命中位置');
    await type('#hGo', '0'); await click('#hGoBtn'); await new Promise(r => setTimeout(r, 200)); assert.ok((await txt('#hOut')).startsWith('00000000'));
    await type('#hQ', 'zz'); await click('#hFind'); await new Promise(r => setTimeout(r, 200)); assert.ok((await txt('#hInfo')).includes('格式不正確'));
    assert.ok(await overflow() <= 1, 'hex 頁面溢出');
    await tab(1); await page.waitForFunction(() => document.querySelector('#tOut').innerHTML.length > 0);
    assert.ok((await txt('#tOut')).includes('PNG 圖片') && (await txt('#tOut')).includes('副檔名「.jpg」與內容不符'), '類型 / 不符警示');
    await tab(3); await page.waitForFunction(() => document.querySelector('#sOut canvas') || document.querySelector('#sOut .alert'));
    await page.waitForSelector('#bpCv');
    t: {
        const s = await txt('#sOut');
        assert.ok(s.includes('附加資料') && s.includes('hidden-note') && s.includes('PNG'), '隱寫：附加資料與 tEXt');
        const lit = async () => page.evaluate(() => { const c = document.querySelector('#bpCv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 255) n++; return n; });
        await page.evaluate(() => { const s = document.querySelector('#bpC'); s.value = '0'; s.dispatchEvent(new Event('change')); });
        assert.equal(await lit(), 64, 'R 通道 LSB 全亮');
        await page.evaluate(() => { const s = document.querySelector('#bpB'); s.value = '1'; s.dispatchEvent(new Event('change')); });
        assert.equal(await lit(), 0, 'R 通道位元 1 全暗');
    }
    assert.ok(await overflow() <= 1, 'stego 溢出');
    // 乾淨 PNG、副檔名正確
    await load(mk('clean.png', png)); await tab(1); await page.waitForFunction(() => document.querySelector('#tOut').textContent.includes('副檔名與檔頭相符'));
    // ZIP
    await load(mk('demo.zip', zipOf('hello.txt', Buffer.from('你好，ZIP 預覽')))); await tab(2);
    await page.waitForFunction(() => document.querySelector('#zOut button[data-i]'));
    assert.ok((await txt('#zOut')).includes('hello.txt'));
    await click('#zOut button[data-i="0"]'); await page.waitForFunction(() => document.querySelector('#zPrev').textContent.includes('你好'));
    assert.ok(await overflow() <= 1, 'zip 溢出');
    await load(mk('notzip.zip', Buffer.from('this is not a zip'))); await page.waitForFunction(() => document.querySelector('#zOut').textContent.includes('找不到 ZIP'));
    // 非圖片的隱寫分頁、文字檔類型
    await tab(3); await page.waitForFunction(() => document.querySelector('#sOut').textContent.includes('不是 PNG'));
    await tab(1); await page.waitForFunction(() => document.querySelector('#tOut').textContent.includes('純文字'));
    // 大於 50MB 要拒絕，且不影響目前載入的檔案
    const big = mk('big.bin', Buffer.alloc(51 * 1024 * 1024));
    await (await page.$('#file')).uploadFile(big); await page.waitForFunction(() => document.querySelector('#msg').textContent.includes('50MB'));
    assert.ok((await txt('#fname')).includes('notzip.zip'));
    assert.ok(await overflow() <= 1);
    assert.deepEqual(errors, []);
} finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('file-inspector OK');
