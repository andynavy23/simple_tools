// writing-desk（寫作工作台）：手機尺寸下四個分頁可操作、無退格、專注模式、草稿自動存、筆記上限 / 刪除 / 清除、壞資料容錯、劇本預覽
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/writing-desk.html');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const $ = (s) => page.evaluate((q) => { const e = document.querySelector(q); return e.value ?? e.textContent; }, s);
const set = (s, v) => page.evaluate((q, val) => { const e = document.querySelector(q); if (e.type === 'checkbox') { e.checked = val; e.dispatchEvent(new Event('change')); } else { e.value = val; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); } }, s, v);
const click = (s) => page.evaluate((q) => document.querySelector(q).click(), s);
const count = (s) => page.evaluate((q) => document.querySelectorAll(q).length, s);
const ls = (k) => page.evaluate((key) => localStorage.getItem(key), k);
const yes = () => page.evaluate(() => { window.confirm = () => true; });
const noHScroll = async (label) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), `${label}：橫向捲動`);
const visible = (s) => page.evaluate((q) => !document.querySelector(q).hidden, s);
const reload = async () => { await page.reload({ waitUntil: 'load' }); await yes(); };
await yes();

// 分頁
for (const t of ['Write', 'Idea', 'Notes', 'Script']) {
    await click('#tab' + t);
    for (const p of ['Write', 'Idea', 'Notes', 'Script']) assert.equal(await visible('#pane' + p), p === t, `${t}：#pane${p}`);
    await noHScroll(t);
}
await click('#tabWrite');

// 專注寫作：字數、進度、自動存
await page.focus('#draft');
await page.keyboard.type('你好 world');
assert.equal(await $('#fStat'), '3 / 500 字');
await sleep(700);
assert.equal(JSON.parse(await ls('wdesk_draft')).text, '你好 world');
await set('#optGoal', '6');
assert.equal(await page.evaluate(() => document.querySelector('#fBar').style.width), '50%');

// 無退格：Backspace / Delete 不能刪，關掉後可以
await set('#optNoBack', true);
await page.focus('#draft');
await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
assert.equal(await $('#draft'), '你好 world', '無退格模式不該能刪除');
await page.keyboard.type('!');
assert.equal(await $('#draft'), '你好 world!');
await set('#optNoBack', false);
await page.focus('#draft');
await page.keyboard.press('Backspace');
assert.equal(await $('#draft'), '你好 world');
assert.equal(JSON.parse(await ls('wdesk_opts')).goal, 6);

// 專注模式：滿版、Esc 結束、顯示摘要
await set('#optMins', '1');
await click('#fStart');
assert.ok(await page.evaluate(() => document.querySelector('#editorBox').classList.contains('full')));
await noHScroll('專注模式');
assert.ok(await page.evaluate(() => { const r = document.querySelector('#draft').getBoundingClientRect(); return r.height > 400 && r.width <= innerWidth; }), '專注模式編輯區要夠大');
await sleep(1100);
assert.ok((await $('#fTime')).startsWith('剩'), await $('#fTime'));
await page.keyboard.press('Escape');
assert.ok(!(await page.evaluate(() => document.querySelector('#editorBox').classList.contains('full'))));
assert.ok((await $('#fSum')).includes('用時'));

// 草稿上限提示與清除（確認 → 清空）
await page.evaluate(() => { const t = document.querySelector('#draft'); t.value = 'a'.repeat(200000); t.dispatchEvent(new Event('input')); });
assert.ok((await $('#dMsg')).includes('上限'));
await click('#dClear');
assert.equal(await $('#draft'), '');
assert.equal(await $('#dMsg'), '');

// 靈感
await click('#tabIdea');
await click('#pDraw');
assert.ok((await $('#pOut')).startsWith('【'));
await set('#pSeed', 'abc'); await click('#pDraw'); const p1 = await $('#pOut'); await click('#pDraw');
assert.equal(await $('#pOut'), p1, '同種子要同題');
await set('#pCat', '對話'); await click('#pDraw'); assert.ok((await $('#pOut')).startsWith('【對話】'));
// 角色鎖定
const field = (i) => page.evaluate((n) => document.querySelectorAll('#cList .kv span')[n].textContent, i);
await click('#cList .kv button');                         // 鎖背景
const bg = await field(0);
for (let i = 0; i < 5; i++) { await click('#cRoll'); assert.equal(await field(0), bg, '鎖定的欄位不該變'); }
assert.notEqual(await field(1), '');
// 名言與標語
assert.ok((await $('#qDaily')).startsWith('「'));
await set('#qCat', '寫作'); await click('#qNext'); assert.ok((await $('#qOut')).startsWith('「'));
await click('#sGo'); assert.ok((await $('#sOut')).includes('關鍵字'));
await set('#sKw', '咖啡'); await click('#sGo'); assert.equal(await count('#sOut .slg'), 5);
assert.ok((await $('#sOut')).includes('咖啡'));
await noHScroll('靈感');

// 設定筆記：新增 / 搜尋 / 篩選 / 編輯 / 刪除
await click('#tabNotes');
await set('#nType', '人物'); await set('#nTitle', '林小海'); await set('#nBody', '燈塔看守人的女兒'); await set('#nTags', '主角 海');
await click('#nSave');
await set('#nType', '伏筆'); await set('#nTitle', '黃銅鑰匙'); await set('#nBody', '第三章回收'); await set('#nTags', '道具');
await click('#nSave');
assert.equal(await count('#nList .note'), 2);
assert.equal(await $('#nInfo'), '2 / 500 筆');
await set('#nQ', '燈塔'); assert.equal(await count('#nList .note'), 1);
await set('#nQ', ''); await set('#nFType', '伏筆'); assert.equal(await count('#nList .note'), 1);
await set('#nFType', ''); await set('#nFTag', '海'); assert.equal(await count('#nList .note'), 1);
await set('#nFTag', '');
await click('#nSave'); assert.ok((await $('#nMsg')).includes('至少'), '空白筆記要拒絕');
// 編輯
await page.evaluate(() => [...document.querySelectorAll('#nList .note button')].find(b => b.textContent === '編輯').click());
assert.equal(await $('#nFormTitle'), '編輯筆記');
await set('#nTitle', '黃銅鑰匙（改）'); await click('#nSave');
assert.equal(await $('#nFormTitle'), '新增筆記');
assert.equal(await count('#nList .note'), 2);
assert.ok(JSON.parse(await ls('wdesk_notes')).some(n => n.title === '黃銅鑰匙（改）'));
// 伏筆回收標記
await page.evaluate(() => [...document.querySelectorAll('#nList .note button')].find(b => b.textContent === '標記已回收').click());
assert.equal(await count('#nList .note.done'), 1);
// 刪除單筆（用 id）
await page.evaluate(() => [...document.querySelectorAll('#nList .note button')].find(b => b.textContent === '刪除').click());
assert.equal(await count('#nList .note'), 1);
assert.equal(JSON.parse(await ls('wdesk_notes')).length, 1);
await noHScroll('筆記');

// 上限：500 筆時拒絕新增
await page.evaluate(() => localStorage.setItem('wdesk_notes', JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ id: 'n' + i, type: '人物', title: '角色' + i, body: '', tags: [], done: false, at: i })))));
await reload(); await click('#tabNotes');
assert.equal(await $('#nInfo'), '500 / 500 筆');
await set('#nTitle', '第 501 筆'); await click('#nSave');
assert.ok((await $('#nMsg')).includes('500'));
assert.equal(JSON.parse(await ls('wdesk_notes')).length, 500);
// 清除全部筆記
await click('#nClear');
assert.equal(await count('#nList .note'), 0);
assert.equal(JSON.parse(await ls('wdesk_notes')).length, 0);

// 壞資料：不會讓整頁壞掉
await page.evaluate(() => { localStorage.setItem('wdesk_draft', '{壞掉'); localStorage.setItem('wdesk_notes', '{"a":1}'); localStorage.setItem('wdesk_opts', '[1,2]'); });
await reload();
assert.equal(await $('#draft'), ''); assert.equal(await $('#nInfo'), '0 / 500 筆');
await page.evaluate(() => { localStorage.setItem('wdesk_notes', JSON.stringify([null, 5, { id: 'k', type: 'zzz', title: 'ok' }, { id: 'k' }, { title: '無 id' }])); localStorage.setItem('wdesk_draft', JSON.stringify({ text: 123, script: ['x'] })); localStorage.setItem('wdesk_opts', JSON.stringify({ goal: 'x', tab: 'nope' })); });
await reload(); await click('#tabNotes');
assert.equal(await count('#nList .note'), 1);
assert.equal(await $('#draft'), '');

// 劇本
await click('#tabScript');
await set('#scriptIn', '# 內 咖啡店 - 夜\n小明坐著。\n\n@小明\n（低聲）\n她還沒回。\n\n> 切至：');
assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#scriptOut > div')].map(d => d.className)), ['sc-scene', 'sc-action', 'sc-character', 'sc-paren', 'sc-dialogue', 'sc-transition']);
assert.ok((await $('#scStat')).includes('1 場景') && (await $('#scStat')).includes('小明'));
const align = await page.evaluate(() => getComputedStyle(document.querySelector('.sc-transition')).textAlign);
assert.equal(align, 'right');
await noHScroll('劇本');
await sleep(600);
assert.ok(JSON.parse(await ls('wdesk_draft')).script.includes('咖啡店'));
await click('#scSample'); assert.ok((await $('#scriptIn')).includes('外 街道'));

// 清除全部資料（會重新載入）
await page.evaluate(() => { window.confirm = () => true; });
const nav = page.waitForNavigation();
await click('#wipe'); await nav;
assert.deepEqual(await page.evaluate(() => ['wdesk_draft', 'wdesk_notes', 'wdesk_opts'].map(k => localStorage.getItem(k))), [null, null, null]);

assert.deepEqual(errors, []);
await browser.close();
console.log('ok writing-desk');
