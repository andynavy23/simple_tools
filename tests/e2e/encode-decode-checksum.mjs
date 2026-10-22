// encode-decode：校驗碼計算（文字、十六進位、分塊讀檔、Luhn / ISBN / EAN）
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-ck-'));
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/encode-decode.html');
    const txt = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);

    await set('#ckIn', '123456789'); await click('#ckGo'); let t = await txt('#ckSum');
    assert.ok(t.includes('CBF43926') && t.includes('29B1') && t.includes('4B37'), t);
    // 十六進位位元組：Modbus 報文 01 03 00 00 00 0A，CRC 低位在前 C5 CD
    await page.evaluate(() => { document.querySelector('#ckHex').click(); }); await set('#ckIn', '01 03 00 00 00 0A'); await click('#ckGo'); t = await txt('#ckSum'); assert.ok(t.includes('C5CD'), t);
    await set('#ckIn', 'zz'); await click('#ckGo'); assert.match(await txt('#ckSum'), /處理失敗/);
    // 檔案（分塊讀取；超過 4MB 的檔案跨多塊）：與一次算完的結果一致
    const f1 = path.join(tmp, 'w.txt'); fs.writeFileSync(f1, 'Wikipedia');
    await (await page.$('#ckFile')).uploadFile(f1); await click('#ckFileGo');
    await page.waitForFunction(() => document.querySelector('#ckSum').textContent.includes('11E60398'), { timeout: 5000 });
    const big = Buffer.alloc(9 * 1024 * 1024 + 123); for (let i = 0; i < big.length; i++) big[i] = (i * 31 + (i >> 5)) & 255;
    const f2 = path.join(tmp, 'big.bin'); fs.writeFileSync(f2, big);
    await (await page.$('#ckFile')).uploadFile(f2); await click('#ckFileGo');
    await page.waitForFunction(() => document.querySelector('#ckSum').textContent.includes('big.bin'), { timeout: 30000 });
    const fileSum = await txt('#ckSum');
    const want = await page.evaluate((n) => { const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = (i * 31 + (i >> 5)) & 255; return ckAll(u).map(x => `${x.name}：${x.hex}`).join('|'); }, big.length);
    for (const part of want.split('|')) assert.ok(fileSum.includes(part), part + ' / ' + fileSum);
    // 沒選檔案
    await page.evaluate(() => { document.querySelector('#ckFile').value = ''; }); await click('#ckFileGo'); assert.match(await txt('#ckSum'), /請先選擇檔案/);
    // 號碼檢查碼
    const num = async (kind, v, btn) => { await page.select('#ckKind', kind); await set('#ckNum', v); await click(btn); return txt('#ckRes'); };
    assert.match(await num('luhn', '4111 1111 1111 1111', '#ckVerify'), /通過/); assert.match(await num('luhn', '4111111111111112', '#ckVerify'), /未通過.*1/);
    assert.match(await num('luhn', '7992739871', '#ckCalc'), /79927398713/);
    assert.match(await num('isbn', '0-306-40615-2', '#ckVerify'), /9780306406157/); assert.match(await num('isbn', '9780306406157', '#ckConv'), /0306406152/);
    assert.match(await num('gtin', '4006381333931', '#ckVerify'), /EAN-13.*正確/); assert.match(await num('gtin', '03600029145', '#ckCalc'), /UPC-A/);
    assert.match(await num('gtin', '12ab', '#ckVerify'), /只能是數字/);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('encode-decode-checksum OK');
