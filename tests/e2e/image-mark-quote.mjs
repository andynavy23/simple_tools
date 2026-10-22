// image-mark：文字轉圖片金句卡
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-h9q-'));
try {
    const { page, errors } = await openPage(browser, 'utils/image-mark.html');
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, s, v);
    const dims = () => page.evaluate(() => [document.querySelector('#q_cv').width, document.querySelector('#q_cv').height]);
    const pix = (x, y) => page.evaluate((x, y) => [...document.querySelector('#q_cv').getContext('2d').getImageData(x, y, 1, 1).data], x, y);
    const waitFile = async (re) => { for (let i = 0; i < 60; i++) { const f = fs.existsSync(browser.downloadDir) ? fs.readdirSync(browser.downloadDir).find(x => re.test(x) && !x.endsWith('.crdownload')) : null; if (f) return path.join(browser.downloadDir, f); await new Promise(r => setTimeout(r, 200)); } throw new Error('沒有下載到 ' + re); };

    await page.evaluate(() => { document.querySelector('#qCard').open = true; });
    assert.deepEqual(await dims(), [1080, 1080]); assert.match(await text('#q_msg'), /字級自動縮放為 \d+px/);
    // 純色背景：角落像素 = 顏色 1；文字有畫出來（中央附近有非背景像素）
    await set('#q_bgType', 'solid'); await set('#q_c1', '#102030');
    assert.deepEqual((await pix(2, 2)).slice(0, 3), [16, 32, 48]);
    assert.ok(await page.evaluate(() => { const c = document.querySelector('#q_cv'), d = c.getContext('2d').getImageData(0, 300, c.width, 480).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200) return true; return false; }), '沒有畫出文字');
    // 漸層：左上與右下不同
    await set('#q_bgType', 'grad'); await set('#q_c1', '#ff0000'); await set('#q_c2', '#0000ff');
    const a = await pix(1, 1), b = await pix(1078, 1078); assert.ok(a[0] > 200 && b[2] > 200, JSON.stringify([a, b]));
    // 版型改變 → 畫布尺寸
    await set('#q_preset', 'l169'); assert.deepEqual(await dims(), [1920, 1080]);
    await set('#q_preset', 'p916'); assert.deepEqual(await dims(), [1080, 1920]);
    // 長文截斷提示；字數上限
    await set('#q_text', '字\n'.repeat(300)); assert.match(await text('#q_msg'), /已截斷/);
    assert.equal(await page.evaluate(() => document.querySelector('#q_text').maxLength), 600);
    await set('#q_text', '短短一句'); assert.doesNotMatch(await text('#q_msg'), /已截斷/);
    await set('#q_text', '   '); assert.match(await text('#q_msg'), /請輸入文字/);
    await set('#q_text', '長長的英文 sentence that has to wrap across several lines properly, with 中文 mixed in.');
    assert.match(await text('#q_msg'), /字級自動縮放/);
    // 載入圖片背景
    const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const g = c.getContext('2d'); g.fillStyle = '#00ff00'; g.fillRect(0, 0, 200, 100); return c.toDataURL('image/png').split(',')[1]; });
    const img = path.join(tmp, 'bg.png'); fs.writeFileSync(img, Buffer.from(b64, 'base64'));
    await set('#q_bgType', 'image'); await set('#q_dim', '0'); assert.match(await text('#q_msg'), /尚未選擇背景圖片/);
    await (await page.$('#q_file')).uploadFile(img); await page.waitForFunction(() => !/尚未選擇/.test(document.querySelector('#q_msg').textContent));
    assert.deepEqual((await pix(3, 3)).slice(0, 3), [0, 255, 0]);
    await set('#q_dim', '50'); assert.ok((await pix(3, 3))[1] < 140);
    await page.evaluate(() => document.querySelector('#q_noimg').click()); assert.match(await text('#q_msg'), /尚未選擇背景圖片/);
    // 下載 PNG
    await set('#q_preset', 'og'); await set('#q_text', '下載測試'); await page.evaluate(() => document.querySelector('#q_dl').click());
    const png = fs.readFileSync(await waitFile(/^quote-1200x630\.png$/)); assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
    // 原本的浮水印 / 拼貼仍可用（設定鍵不受影響）
    assert.equal(await page.evaluate(() => document.querySelector('#markOpts').hidden), false);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('image-mark-quote OK');
