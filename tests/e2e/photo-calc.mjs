// 攝影與影片計算：分頁計算、分鏡表、燈位圖拖曳與儲存
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const ls = (page, k) => page.evaluate((x) => JSON.parse(localStorage.getItem(x) || 'null'), k);
const tab = (page, name) => page.evaluate((n) => [...document.querySelectorAll('#tabs button')].find(b => b.textContent === n).click(), name);

const { page, errors } = await openPage(browser, 'utils/photo-calc.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
const noOverflow = async (t) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + t);

assert.ok((await text(page, '#res')).includes('240'));          // 預設縮時 → 240 張
await tab(page, 'ND 濾鏡'); assert.ok((await text(page, '#res')).includes('8 秒'));
await set(page, '#f_v', '8'); assert.ok((await text(page, '#res')).includes('3'));
assert.equal((await ls(page, 'photoc_opts')).tab, 'nd');
await tab(page, '景深'); assert.ok((await text(page, '#res')).includes('10.47'));
await tab(page, '色溫'); await noOverflow('色溫表');
await tab(page, '星軌'); await noOverflow('星軌');

// 分鏡表
await tab(page, '分鏡表');
await set(page, '#sNote', '開場'); await click(page, '#sAdd'); await set(page, '#sNote', '特寫'); await click(page, '#sAdd');
assert.equal((await ls(page, 'photoc_shots')).length, 2); assert.ok((await text(page, '#sCount')).includes('2 / 200'));
await page.evaluate(() => document.querySelector('#sTbl tbody button').click());
assert.deepEqual((await ls(page, 'photoc_shots')).map(x => x.id), [2]);
await page.evaluate(() => localStorage.setItem('photoc_shots', JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ id: i + 1, no: String(i) })))));
await page.reload(); await tab(page, '分鏡表'); assert.ok((await text(page, '#sCount')).includes('200 / 200'));
await click(page, '#sAdd'); assert.ok((await text(page, '#sMsg')).includes('已滿')); assert.equal((await ls(page, 'photoc_shots')).length, 200);
await noOverflow('分鏡表');
await click(page, '#sClear'); assert.equal(await ls(page, 'photoc_shots'), null);

// 燈位圖
await tab(page, '燈位圖');
await page.evaluate(() => { [...document.querySelectorAll('#lAddRow button')].find(b => b.textContent.includes('主角')).click(); });
await page.evaluate(() => { [...document.querySelectorAll('#lAddRow button')].find(b => b.textContent.includes('主燈')).click(); });
assert.equal((await ls(page, 'photoc_light')).length, 2);
assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#cv')).touchAction), 'pan-y');   // 預設可捲動
await click(page, '#lDrag'); assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#cv')).touchAction), 'none');
const box = await page.evaluate(() => { const r = document.querySelector('#cv').getBoundingClientRect(); return [r.left, r.top, r.width]; });
await page.mouse.move(box[0] + box[2] * .5, box[1] + box[2] * .5); await page.mouse.down();
await page.mouse.move(box[0] + box[2] * .8, box[1] + box[2] * .3, { steps: 4 }); await page.mouse.up();
const L = await ls(page, 'photoc_light'); assert.ok(Math.abs(L[0].x - .8) < .02 && Math.abs(L[0].y - .3) < .02, JSON.stringify(L[0]));
await noOverflow('燈位圖');
await page.evaluate(() => document.querySelector('#lList button').click()); assert.equal((await ls(page, 'photoc_light')).length, 1);
await click(page, '#lClear'); assert.equal(await ls(page, 'photoc_light'), null);
// 壞資料
await page.evaluate(() => { localStorage.setItem('photoc_opts', '{"tab":5,"v":[]}'); localStorage.setItem('photoc_light', '"x"'); localStorage.setItem('photoc_shots', '{"a":1}'); });
await page.reload(); assert.ok((await text(page, '#res')).includes('240'));
assert.deepEqual(errors, []);
await browser.close();
