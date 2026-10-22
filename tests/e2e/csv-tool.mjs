// csv-tool：CSV ⇄ XLSX（以真實瀏覽器的 DecompressionStream 讀取 deflate 版與 store 版）
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { launchEdge, openPage } from './lib.mjs';

const crc = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xFFFFFFFF) >>> 0; };
function deflatedZip(files) {
    const parts = [], cd = []; let off = 0;
    for (const [name, text] of files) {
        const data = Buffer.from(text), comp = zlib.deflateRawSync(data), n = Buffer.from(name), h = Buffer.alloc(30), c = Buffer.alloc(46);
        h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc(data), 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
        c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc(data), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
        parts.push(h, n, comp); cd.push(c, n); off += 30 + n.length + comp.length;
    }
    const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
    return Buffer.concat([...parts, cdb, e]);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-csv-'));
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/csv-tool.html');
    const $v = (s) => page.evaluate((s) => document.querySelector(s).value, s);
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    await page.evaluate(() => { window.__b = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__b.push(b); return o(b); }; });
    const setSrc = (t) => page.evaluate((t) => { const s = document.querySelector('#src'); s.value = t; s.dispatchEvent(new Event('input')); }, t);

    // 寫出：目前表格 → XLSX（含篩選）
    await setSrc('姓名,年資,備註\n小明,3,"a,b"\n王小華,5.5,007\nAmy,1,x');
    await page.evaluate(() => document.querySelector('#xsave').click());
    const x = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await window.__b.at(-1).arrayBuffer()))));
    assert.equal(x.toString('latin1', 0, 2), 'PK'); assert.ok(x.includes(Buffer.from('xl/worksheets/sheet1.xml')));
    assert.equal(await text('#err'), '');
    const xf = path.join(tmp, 'a.xlsx'); fs.writeFileSync(xf, x);
    // 讀回（store 版）：csv 文字與原本的表格一致
    await setSrc('');
    await (await page.$('#xfile')).uploadFile(xf);
    await page.waitForFunction(() => document.querySelector('#src').value.length > 0, { timeout: 5000 });
    assert.equal(await $v('#src'), '姓名,年資,備註\n小明,3,"a,b"\n王小華,5.5,007\nAmy,1,x');
    assert.match(await text('#info'), /3 \/ 3 列 × 3 欄/);
    // 篩選後只寫出符合的列
    await page.evaluate(() => { const f = document.querySelector('#filter'); f.value = 'Amy'; f.dispatchEvent(new Event('input')); document.querySelector('#xsave').click(); });
    const y = Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await window.__b.at(-1).arrayBuffer()))));
    fs.writeFileSync(xf, y); await setSrc(''); await page.evaluate(() => { const f = document.querySelector('#filter'); f.value = ''; f.dispatchEvent(new Event('input')); });
    await (await page.$('#xfile')).uploadFile(xf); await page.waitForFunction(() => document.querySelector('#src').value.length > 0);
    assert.equal(await $v('#src'), '姓名,年資,備註\nAmy,1,x');

    // 讀取 deflate 壓縮、共用字串的 XLSX（Excel 實際產出的樣子）
    const z = deflatedZip([
        ['xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>'],
        ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Type="t" Target="worksheets/sheet1.xml"/></Relationships>'],
        ['xl/sharedStrings.xml', '<sst><si><t>名稱</t></si><si><t>數量</t></si><si><t>蘋果 &amp; 梨</t></si></sst>'],
        ['xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>12</v></c></row></sheetData></worksheet>'.repeat(1)],
    ]);
    const zf = path.join(tmp, 'b.xlsx'); fs.writeFileSync(zf, z);
    await setSrc('');
    await (await page.$('#xfile')).uploadFile(zf);
    await page.waitForFunction(() => document.querySelector('#src').value.length > 0, { timeout: 5000 });
    assert.equal(await $v('#src'), '名稱,數量\n蘋果 & 梨,12');

    // 壞檔：顯示錯誤、不丟例外、不清掉現有內容
    const bf = path.join(tmp, 'c.xlsx'); fs.writeFileSync(bf, 'not a zip at all, just text '.repeat(20));
    await (await page.$('#xfile')).uploadFile(bf);
    await page.waitForFunction(() => document.querySelector('#err').textContent.includes('讀取失敗'), { timeout: 5000 });
    assert.equal(await $v('#src'), '名稱,數量\n蘋果 & 梨,12');
    // 空表格：不能匯出
    await setSrc(''); await page.evaluate(() => document.querySelector('#xsave').click());
    assert.match(await text('#err'), /還沒有表格資料/);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('csv-tool OK');
