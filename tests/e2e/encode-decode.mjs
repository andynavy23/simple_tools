// encode-decode 新增項目：Base32 / Base58 / URL 批次（下拉格式）、HTML 實體查表、Base58Check、檔案 → data URI、雜湊辨識
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/encode-decode.html');
const val = (s) => page.evaluate((q) => document.querySelector(q).value, s);
const txt = (s) => page.evaluate((q) => document.querySelector(q).textContent, s);
const set = (s, v) => page.evaluate((q, x) => { const e = document.querySelector(q); if (e.type === 'checkbox') e.checked = x; else e.value = x; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
const click = (s) => page.evaluate((q) => document.querySelector(q).click(), s);
const run = async (type, input, dir) => { await set('#type', type); await set('#in', input); await click(dir === 'dec' ? '#dec' : '#enc'); await new Promise(r => setTimeout(r, 80)); return val('#out'); };

assert.equal(await run('Base32', 'foobar', 'enc'), 'MZXW6YTBOI======');
assert.equal(await run('Base32', 'MZXW6YTBOI======', 'dec'), 'foobar');
assert.equal(await run('Base58（比特幣字母表）', 'Hello World!', 'enc'), '2NEpo7TZRRrLZSi2U');
assert.equal(await run('Base58（比特幣字母表）', '2NEpo7TZRRrLZSi2U', 'dec'), 'Hello World!');
assert.equal(await run('URL 編碼批次・每行（component）', 'a b\n中&x', 'enc'), 'a%20b\n%E4%B8%AD%26x');
assert.equal(await run('URL 編碼批次・每行（整串 encodeURI）', 'https://x.com/a b?q=中', 'enc'), 'https://x.com/a%20b?q=%E4%B8%AD');
await run('URL 編碼批次・每行（component）', 'ok\n%E4%B8', 'dec');
assert.ok((await txt('#err')).includes('第 2 行'), await txt('#err'));

// 實體查表
await set('#entQ', 'copy');
assert.equal(await page.evaluate(() => document.querySelectorAll('#entGrid button').length), 1);
await set('#entQ', '');
assert.ok(await page.evaluate(() => document.querySelectorAll('#entGrid button').length > 100));
await set('#entQ', 'zzzqq'); assert.ok(await page.evaluate(() => document.querySelector('#entNone').style.display !== 'none'));
await set('#entConv', '&copy; &#8364; &amp;'); await click('#entNum');
assert.equal(await val('#entConv'), '&#169; &#8364; &#38;');
await click('#entName'); assert.equal(await val('#entConv'), '&copy; &euro; &amp;');

// Base58Check
await set('#b58In', '00010966776006953D5567439E5E39F86A0D273BEE'); await click('#b58Enc');
await page.waitForFunction(() => document.querySelector('#b58Res').textContent.includes('16UwLL9'), { timeout: 5000 });
assert.equal(await txt('#b58Res'), '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM');
await set('#b58In', '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvM'); await click('#b58Dec');
await page.waitForFunction(() => document.querySelector('#b58Res').textContent.includes('檢查碼正確'), { timeout: 5000 });
await set('#b58In', '16UwLL9Risc3QfPqBUvKofHmBQ7wMtjvN'); await click('#b58Dec');
await page.waitForFunction(() => document.querySelector('#b58Res').textContent.includes('檢查碼不符'), { timeout: 5000 });

// 雜湊辨識
await set('#hidIn', '5d41402abc4b2a76b9719d911017c592');
assert.ok((await txt('#hidRes')).includes('MD5') && (await txt('#hidRes')).includes('推測'));
await set('#hidIn', 'hello'); assert.ok((await txt('#hidRes')).includes('看不出'));

// 檔案 → data URI（1x1 PNG）
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-uri-'));
try {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    const f = path.join(tmp, 'dot.png'); fs.writeFileSync(f, png);
    await (await page.$('#uriFile')).uploadFile(f);
    await page.waitForFunction(() => document.querySelector('#uriOut').value.startsWith('data:image/png;base64,'), { timeout: 5000 });
    assert.equal(await page.evaluate(() => document.querySelector('#uriImg').hidden), false, '圖片沒有預覽');
    await set('#uriRaw', true);
    assert.ok((await val('#uriOut')).startsWith('iVBOR'));
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// 併入的 JWT 解碼與檢查、網址拆解與重組
await click('#jwSample'); await set('#jwSecret', 'your-256-bit-secret'); await new Promise(r => setTimeout(r, 200));
assert.ok((await txt('#jwVOut')).startsWith('簽章相符'), 'JWT 驗簽');
assert.ok((await txt('#jwPl')).includes('John Doe'));
await set('#jwGs', 'k'); await click('#jwGen'); await new Promise(r => setTimeout(r, 200));
assert.equal((await txt('#jwGOut')).split('.').length, 3, 'JWT 產生');
await set('#urIn', 'https://a.com/p?utm_source=x&id=1&id=2#h'); await click('#urQTrack');
assert.equal(await val('#urOut'), 'https://a.com/p?id=1&id=2#h', '網址移除追蹤參數');
await set('#urBin', 'https://a.com/?id=1 https://b.com/?id=3'); await set('#urBKey', 'id');
assert.ok((await txt('#urBOut')).includes('2 個網址，找到 2 個值'));

assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), '橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('encode-decode OK');
