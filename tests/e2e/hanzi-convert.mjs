// hanzi-convert：簡繁轉換的畫面行為（方向、台灣用詞、歧義點選、選項記憶與重設、壞資料容錯）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/hanzi-convert.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const wait = () => new Promise(r => setTimeout(r, 250));
const opts = () => page.evaluate(() => localStorage.getItem('hanzi_opts'));

await set('#src', '我的头发很长，干净的面条，软件。\n后天');
await wait();
assert.strictEqual(await text('#out'), '我的頭髮很長，乾淨的麵條，軟件。\n後天');
assert.ok((await text('#stat')).includes('共 '), '統計列');
assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.amb').length), 0);

// 台灣用詞
await click('#tw'); await wait();
assert.strictEqual(await text('#out'), '我的頭髮很長，乾淨的麵條，軟體。\n後天');
assert.deepStrictEqual(JSON.parse(await opts()), { dir: 's2t', tw: true });

// 歧義：黃色底、點一下換候選
await set('#src', '台');
await wait();
assert.strictEqual(await page.evaluate(() => document.querySelectorAll('.amb').length), 1);
assert.ok((await text('#stat')).includes('可能有歧義 1 處'));
const seen = [await text('#out')];
for (let i = 0; i < 4; i++) { await click('.amb'); seen.push(await text('#out')); }
assert.deepStrictEqual(seen, ['台', '臺', '檯', '颱', '台'], '候選輪流切換');
assert.ok((await text('#info')).includes('可選'));

// 方向：繁 → 簡；結果當輸入並換方向
await click('#dT2s'); await set('#src', '頭髮、後面、裡面、軟體'); await wait();
assert.strictEqual(await text('#out'), '头发、后面、里面、软件');   // 台灣用詞仍勾著：軟體 → 軟件 → 软件
assert.deepStrictEqual(JSON.parse(await opts()), { dir: 't2s', tw: true });
await click('#swap'); await wait();
assert.strictEqual(await page.evaluate(() => document.querySelector('#src').value), '头发、后面、里面、软件');
assert.strictEqual(await page.evaluate(() => document.querySelector('#dS2t').getAttribute('aria-pressed')), 'true');

// 重新載入：記住方向與開關
await page.reload({ waitUntil: 'load' });
assert.strictEqual(await page.evaluate(() => document.querySelector('#dS2t').getAttribute('aria-pressed')), 'true');
assert.strictEqual(await page.evaluate(() => document.querySelector('#tw').checked), true);

// 壞資料容錯
for (const bad of ['null', '[1,2]', '"x"', '{"dir":"zz","tw":"yes"}', '{oops']) {
    await page.evaluate((b) => localStorage.setItem('hanzi_opts', b), bad);
    await page.reload({ waitUntil: 'load' });
    assert.strictEqual(await page.evaluate(() => document.querySelector('#dS2t').getAttribute('aria-pressed')), 'true', bad);
    assert.strictEqual(await page.evaluate(() => document.querySelector('#tw').checked), false, bad);
}

// 重設選項：先 confirm（測試預設 dismiss，不會動）；接受後清掉鍵
await click('#dT2s');
assert.ok(await opts());
await click('#reset');                                  // dialog 被 dismiss
assert.ok(await opts(), 'confirm 取消不能清掉');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
await click('#reset');
assert.strictEqual(await opts(), null);
assert.strictEqual(await page.evaluate(() => document.querySelector('#dS2t').getAttribute('aria-pressed')), 'true');

// 上限與大量文字
await page.evaluate(() => { const e = document.querySelector('#src'); e.value = '头发'.repeat(100000); e.dispatchEvent(new Event('input', { bubbles: true })); });
await wait();
assert.strictEqual(await page.evaluate(() => document.querySelector('#limit').hidden), false);
assert.ok((await text('#cnt')).startsWith('200,000'));

// 手機版面：沒有橫向捲動；按鈕與輸入框字級
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#src')).fontSize) >= 16), '輸入框字級 < 16px');
assert.deepEqual(errors, []);
await browser.close();
console.log('hanzi-convert OK');
