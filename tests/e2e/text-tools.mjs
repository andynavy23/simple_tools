// text-tools 新分頁（Unicode / 換行符 / 千分位 / SQL IN / 陣列 / 路徑 / emoji 搜尋）：手機尺寸下可操作、不橫向捲動、沒有例外
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/text-tools.html');
const $ = (s) => page.evaluate((q) => { const e = document.querySelector(q); return e.value ?? e.textContent; }, s);
const set = (s, v) => page.evaluate((q, val) => { const e = document.querySelector(q); if (e.type === 'checkbox') { e.checked = val; e.dispatchEvent(new Event('change')); } else { e.value = val; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); } }, s, v);
const click = (s) => page.evaluate((q) => document.querySelector(q).click(), s);
const noHScroll = async (label) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), `${label}：橫向捲動`);
const visible = (s) => page.evaluate((q) => !document.querySelector(q).hidden, s);
const PANES = ['Text', 'Sym', 'Case', 'Uni', 'Eol', 'Num', 'Sql', 'Arr', 'Path'];

// 分頁切換：每次只有一個 pane 可見，原本三個分頁仍可用
for (const tab of PANES) {
    await click('#tab' + tab);
    for (const p of PANES) assert.equal(await visible('#pane' + p), p === tab, `${tab} 分頁：#pane${p}`);
    await noHScroll(tab);
}

// emoji 搜尋（符號表）
await click('#tabSym');
await set('#symQ', '貓'); await click('[data-cat=""]');
assert.ok(await page.evaluate(() => [...document.querySelectorAll('#symGrid .sym')].some(b => b.textContent === '🐈')), '搜尋「貓」找不到 🐈');
await set('#symQ', 'birthday cake');
assert.ok(await page.evaluate(() => [...document.querySelectorAll('#symGrid .sym')].some(b => b.textContent === '🎂')), '搜尋 birthday cake 找不到 🎂');
await set('#symQ', '');

// Unicode
await click('#tabUni');
await set('#uniIn', 'U+1F600');
let t = await $('#uniOut');
assert.ok(t.includes('GRINNING FACE') && t.includes('F0 9F 98 80') && t.includes('\\uD83D\\uDE00') && t.includes('Emoticons'), 'Unicode 資訊：' + t.slice(0, 80));
await set('#uniIn', '中');
assert.ok((await $('#uniOut')).includes('E4 B8 AD'));
await set('#uniIn', 'U+378');
assert.ok((await $('#uniOut')).includes('未收錄'));
await set('#uniRange', 'arrows');
assert.ok(await page.evaluate(() => document.querySelectorAll('#uniRangeGrid .sym').length > 50), '區塊反查沒有字元');
await click('#uniRangeGrid .sym');
assert.ok((await $('#uniIn')).length > 0 && (await $('#uniOut')).includes('ARROW'), '點字元後沒有顯示詳細資料：' + await $('#uniOut'));
await set('#uniRange', 'U+4E00-U+9FFF');
assert.ok((await $('#uniRangeMsg')).includes('範圍太大'));
await noHScroll('Unicode');

// 換行符：用真實檔案（CRLF 與 LF 混用）
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-eol-'));
try {
    const f = path.join(tmp, 'mixed.txt');
    fs.writeFileSync(f, 'a\r\nb\r\nc\nd\r\n');
    await click('#tabEol');
    await (await page.$('#eolFile')).uploadFile(f);
    await page.waitForFunction(() => document.querySelector('#eolMsg').textContent.includes('混用'), { timeout: 5000 });
    assert.ok((await $('#eolMsg')).includes('第 3 行'), await $('#eolMsg'));
    await click('#eolLF');
    assert.ok((await $('#eolMsg')).includes('全部都是 LF'), await $('#eolMsg'));
    await click('#eolCRLF');
    assert.ok((await $('#eolMsg')).includes('全部都是 CRLF'));
    await noHScroll('換行符');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// 千分位
await click('#tabNum');
await set('#numIn', '1234567.891\nabc\n-9876543');
assert.equal(await $('#numOut'), '1,234,567.891\nabc\n-9,876,543');
await set('#numDec', '2'); assert.equal((await $('#numOut')).split('\n')[0], '1,234,567.89');
await set('#numMode', 'strip'); assert.equal((await $('#numOut')).split('\n')[2], '-9876543.00');
assert.ok(await page.evaluate(() => document.querySelectorAll('#numLoc .cell').length >= 5), '沒有語系預覽');
assert.ok((await $('#numHint')).includes('不是數字'));
await noHScroll('千分位');

// SQL IN
await click('#tabSql');
await set('#sqlIn', "1\n2\nO'Brien\n2"); await set('#sqlCol', 'id');
assert.equal(await $('#sqlOut'), "id IN (1, 2, 'O''Brien')");
await set('#sqlNot', true); assert.ok((await $('#sqlOut')).startsWith('id NOT IN'));
await set('#sqlIn', ''); assert.equal(await $('#sqlOut'), '');
await noHScroll('SQL IN');

// 陣列
await click('#tabArr');
await set('#arrIn', 'a\nb\n3');
assert.equal(await $('#arrOut'), '["a", "b", 3]');
await set('#arrLang', 'go'); assert.equal(await $('#arrOut'), '[]string{"a", "b", "3"}');
await noHScroll('陣列');

// 路徑
await click('#tabPath');
await set('#pathIn', 'C:\\Users\\me\\a.txt\n/mnt/d/x');
assert.equal(await $('#pathOut'), 'C:\\Users\\me\\a.txt\nD:\\x');
await set('#pathTo', 'wsl'); assert.equal(await $('#pathOut'), '/mnt/c/Users/me/a.txt\n/mnt/d/x');
await noHScroll('路徑');

assert.deepEqual(errors, []);
await browser.close();
console.log('text-tools OK');
