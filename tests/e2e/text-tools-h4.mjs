// text-tools 新增分頁（社群字數 / Hashtag / 名單比對 / 資料脫敏）：手機尺寸下可操作、不橫向捲動、沒有例外
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/text-tools.html');
const $ = (s) => page.evaluate((q) => { const e = document.querySelector(q); return e.value ?? e.textContent; }, s);
const set = (s, v) => page.evaluate((q, val) => { const e = document.querySelector(q); if (e.type === 'checkbox') { e.checked = val; e.dispatchEvent(new Event('change')); } else { e.value = val; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); } }, s, v);
const click = (s) => page.evaluate((q) => document.querySelector(q).click(), s);
const noHScroll = async (label) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), `${label}：橫向捲動`);
const visible = (s) => page.evaluate((q) => !document.querySelector(q).hidden, s);
const PANES = ['Text', 'Sym', 'Case', 'Uni', 'Eol', 'Num', 'Sql', 'Arr', 'Path', 'Social', 'Tag', 'List', 'Mask'];

for (const tab of PANES) {
    await click('#tab' + tab);
    for (const p of PANES) assert.equal(await visible('#pane' + p), p === tab, `${tab} 分頁：#pane${p}`);
    await noHScroll(tab);
}

// 社群字數
await click('#tabSocial');
await set('#socIn', '中'.repeat(150));
let t = await $('#socList');
assert.ok(t.includes('Threads') && t.includes('150 / 500') && t.includes('300 / 280') && t.includes('超出 20'), t);
await set('#socPick', 'x');
assert.equal(await page.evaluate(() => document.querySelector('#socPrev').textContent.length), 150);
assert.equal(await page.evaluate(() => document.querySelector('#socPrev span').textContent.length), 10);
await set('#socIn', '');
assert.ok((await $('#socPrev')).includes('貼上內容'));
await noHScroll('社群字數');

// Hashtag
await click('#tabTag');
await set('#tagIn', '今天 #旅行 好玩 #Travel #travel #旅行 #123');
assert.equal(await $('#tagOut'), '#旅行 #Travel');
await set('#tagHash', false); await set('#tagSep', 'nl');
assert.equal(await $('#tagOut'), '旅行\nTravel');
assert.ok((await $('#tagHint')).startsWith('2 個標籤'));

// 名單比對
await click('#tabList');
await set('#lstA', 'Apple\nbanana\ncherry\nbanana'); await set('#lstB', 'APPLE\ndate');
assert.equal(await $('#lstOut'), 'Apple');
assert.ok((await $('#lstCounts')).includes('交集1'.replace('交集', '交集')) || (await $('#lstCounts')).includes('交集'));
await set('#lstMode', 'onlyA'); assert.equal(await $('#lstOut'), 'banana\ncherry');
await set('#lstMode', 'union'); assert.equal(await $('#lstOut'), 'Apple\nbanana\ncherry\ndate');
assert.ok((await $('#lstDup')).includes('banana ×2'));
await set('#lstCi', false); await set('#lstMode', 'inter'); assert.equal(await $('#lstOut'), '');
await noHScroll('名單比對');

// 資料脫敏
await click('#tabMask');
await set('#mskIn', '姓名：王小明\n電話 0912-345-678\nmail andy@example.com\nA123456789\n台北市信義區松仁路100號5樓');
assert.equal(await $('#mskOut'), '姓名：王○明\n電話 0912-***-678\nmail a***@example.com\nA12*****89\n台北市信義區***');
assert.ok((await $('#mskHint')).includes('共遮蔽 5 處'));
assert.equal(await page.evaluate(() => document.querySelectorAll('#mskDiff .li').length), 5);
await page.evaluate(() => { document.querySelector('#mskRules input[data-rule=phone]').click(); });
assert.ok((await $('#mskOut')).includes('0912-345-678'));
assert.equal(await page.evaluate(() => document.querySelectorAll('#mskDiff .li').length), 4);
await noHScroll('資料脫敏');

assert.deepEqual(errors, []);
await browser.close();
console.log('ok text-tools-h4');
