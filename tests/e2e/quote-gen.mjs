// quote-gen：品項增刪排序、金額與大寫、類型切換、CSV、只存抬頭設定、清除、列印樣式、手機不溢出
import assert from 'assert';
import fs from 'fs';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/quote-gen.html');
const txt = (sel) => page.$eval(sel, e => e.textContent);
const val = (sel) => page.$eval(sel, e => e.value);
const type = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate(s => document.querySelector(s).click(), sel);
const noScroll = async (tag) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });

await type('#iname0', '網站設計'); await type('#iprice0', '30000');
await click('#add'); await type('#iname1', '維護費'); await type('#iqty1', '3'); await type('#iunit1', '月'); await type('#iprice1', '2000');
const doc = await txt('#doc');
assert.ok(doc.includes('36,000') && doc.includes('1,800') && doc.includes('37,800') && doc.includes('參萬柒仟捌佰元整'), doc);
assert.strictEqual(await txt('#amt1'), '6,000');
// 排序：下移第一列
await click('#items .item:first-child .bar button:nth-child(2)');
assert.strictEqual(await val('#iname0'), '維護費');
// 刪除
await click('#items .item:first-child .bar button:last-child');
assert.ok(!(await txt('#doc')).includes('維護費') && (await txt('#doc')).includes('31,500'));
// 含稅與折扣
await type('#taxMode', 'incl'); assert.ok((await txt('#doc')).includes('30,000') && (await txt('#doc')).includes('內含'));
await type('#disc', '10'); await type('#discKind', 'pct'); assert.ok((await txt('#doc')).includes('-3,000'));
// 切換文件類型
await click('#types button[data-t="收據"]');
assert.ok((await txt('#doc')).includes('實收金額') && (await txt('#doc')).includes('收　據'));
assert.ok(await page.$eval('#wValid', e => e.hidden));
await click('#types button[data-t="請款單"]');
assert.ok((await txt('#doc')).includes('應付總額') && (await txt('#doc')).includes('付款期限'));
assert.ok(await page.$eval('#wValid', e => !e.hidden));
// 只存抬頭設定，不存品項 / 買方
await type('#seller', '甲公司 12345678'); await type('#buyer', '乙客戶');
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quote_opts')));
assert.strictEqual(saved.type, '請款單'); assert.strictEqual(saved.seller, '甲公司 12345678'); assert.strictEqual(saved.taxMode, 'incl');
assert.ok(!JSON.stringify(saved).includes('網站設計') && !JSON.stringify(saved).includes('乙客戶'));
await page.reload({ waitUntil: 'load' });
assert.strictEqual(await val('#seller'), '甲公司 12345678'); assert.strictEqual(await val('#iname0'), ''); assert.strictEqual(await val('#buyer'), '');
assert.ok((await txt('#doc')).includes('請款單'));
// 上限 200
await page.evaluate(() => { for (let i = 0; i < 205; i++) document.querySelector('#add').click(); });
assert.strictEqual(await page.$$eval('#items .item', x => x.length), 200); assert.ok((await txt('#msg')).includes('200'));
await noScroll('200 列');
// 列印樣式：只剩 #doc，單列不切斷
await page.emulateMediaFeatures([{ name: 'media', value: 'print' }]).catch(() => { });
await page.emulateMediaType('print');
assert.ok(await page.evaluate(() => [...document.querySelectorAll('.wrap>*')].every(e => e.id === 'doc' || getComputedStyle(e).display === 'none')));
assert.strictEqual(await page.evaluate(() => getComputedStyle(document.querySelector('#doc tr')).breakInside), 'avoid');
await page.emulateMediaType('screen');
// 壞資料
await page.evaluate(() => localStorage.setItem('quote_opts', '{"type":{},"rate":"x","taxMode":5}'));
await page.reload({ waitUntil: 'load' });
assert.strictEqual(await val('#rate'), '5'); assert.strictEqual(await val('#taxMode'), 'excl');
// CSV
await type('#iname0', '=SUM(1)'); await type('#iprice0', '100'); await type('#no', 'Q-1');
await click('#csv');
let f; for (let i = 0; i < 30 && !f; i++) { await new Promise(r => setTimeout(r, 200)); f = fs.existsSync(browser.downloadDir) && fs.readdirSync(browser.downloadDir).find(x => x.endsWith('.csv')); }
assert.ok(f, '沒有下載 CSV');
const csv = fs.readFileSync(browser.downloadDir + '/' + f, 'utf8');
assert.ok(csv.includes("'=SUM(1)") && csv.includes('總計,105'), csv);
// 清除
await page.evaluate(() => { window.confirm = () => true; });
await type('#seller', 'X'); await click('#clear');
await page.waitForFunction(() => document.querySelector('#seller').value === '');
assert.strictEqual(await page.evaluate(() => localStorage.getItem('quote_opts')), null);
await noScroll('清除後');
assert.deepStrictEqual(errors, []);
await browser.close();
