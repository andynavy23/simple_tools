// pet-log：新增寵物 / 疫苗到期提醒 / 體重圖 / 編輯刪除 / CSV / 刪寵物連帶刪事件 / 清除全部
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/pet-log.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const set = (sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('pet_log') || 'null'));
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);

await click('#addPetBtn'); await click('#savePet');
assert.ok((await text('#petMsg')).includes('名字'));
await set('#p_name', '小黑'); await set('#p_sp', '狗'); await set('#p_birth', '2022-01-15'); await click('#savePet');
let d = await stored(); assert.equal(d.pets.length, 1);
assert.ok((await text('#petInfo')).includes('歲') && (await text('#petInfo')).includes('人類'));
// 疫苗：間隔 12 個月 → 到期提醒
await set('#e_type', '疫苗'); await set('#e_date', '2026-03-01'); await set('#e_name', '狂犬病'); await set('#e_cyc', '12');
assert.ok((await text('#duePrev')).includes('2027-03-01'));
await click('#saveEv'); d = await stored(); assert.equal(d.events.length, 1);
assert.ok(await page.evaluate(() => !document.querySelector('#dueCard').hidden && document.querySelector('#dues').textContent.includes('2027-03-01')));
// 體重趨勢圖
for (const [dt, kg] of [['2026-01-01', '4.0'], ['2026-02-01', '4.3'], ['2026-03-01', '4.1']]) { await set('#e_type', '體重'); await set('#e_date', dt); await set('#e_val', kg); await set('#e_cyc', '0'); await click('#saveEv'); }
d = await stored(); assert.equal(d.events.length, 4);
const px = await page.evaluate(() => { const c = document.querySelector('#cv'); if (c.closest('#wCard').hidden || c.width < 100) return -1; const g = c.getContext('2d'); const a = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < a.length; i += 4) if (a[i]) n++; return n; });
assert.ok(px > 500, '體重圖有畫出內容 ' + px);
// 體重缺值要擋
await set('#e_type', '體重'); await set('#e_val', ''); await click('#saveEv'); assert.ok((await text('#evMsg')).includes('體重'));
// 編輯
await page.evaluate(() => [...document.querySelectorAll('#events .card')].find(c => c.textContent.includes('疫苗')).querySelector('button').click());
await set('#e_name', '狂犬病加強'); await click('#saveEv'); d = await stored(); assert.ok(d.events.some(e => e.name === '狂犬病加強')); assert.equal(d.events.length, 4);
// CSV
await click('#csv');
const f = path.join(browser.downloadDir, `寵物記錄_${new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10)}.csv`);
for (let i = 0; i < 50 && !fs.existsSync(f); i++) await new Promise(r => setTimeout(r, 100));
assert.ok(fs.readFileSync(f, 'utf8').includes('狂犬病加強'));
// 單筆刪除
await page.evaluate(() => [...document.querySelectorAll('#events .card')][0].querySelectorAll('button')[1].click()); d = await stored(); assert.equal(d.events.length, 3);
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
// 刪寵物連帶刪事件
await page.evaluate(() => [...document.querySelectorAll('#petInfo button')].find(b => b.textContent === '刪除寵物').click()); d = await stored(); assert.deepEqual(d, { pets: [], events: [] });
await click('#addPetBtn'); await set('#p_name', 'B'); await click('#savePet'); await click('#clearAll'); d = await stored(); assert.deepEqual(d, { pets: [], events: [] });
assert.deepEqual(errors, []);
await browser.close();
console.log('pet-log OK');
