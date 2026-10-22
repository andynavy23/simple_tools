// ics-gen：填表 → 加入清單 → 輸出 ICS；驗證、重複規則、提醒、選項記憶與重置
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/ics-gen.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const out = () => page.evaluate(() => document.querySelector('#out').value.split(String.fromCharCode(13)).join(''));

await click('#add');
assert.ok((await text('#err')).includes('標題'));
await set('#mode', 'tzid'); await set('#tz', 'Asia/Taipei');
await set('#title', '週會,例行'); await set('#sd', '2026-03-02'); await set('#st', '10:00'); await set('#et', '11:00');
await set('#freq', 'WEEKLY'); await page.evaluate(() => document.querySelector('#wdBox input[value=WE]').click());
await set('#rend', 'count'); await set('#count', '12');
await set('#alm', '15'); await click('#almAdd');
await click('#add');
let o = await out();
assert.ok(o.includes('SUMMARY:週會\\,例行\n') &&o.includes('DTSTART;TZID=Asia/Taipei:20260302T100000') && o.includes('RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=12') && o.includes('TRIGGER:-PT15M'), o);
assert.ok(!(await page.evaluate(() => document.querySelector('#dl').disabled)));
// 全天活動、第二個活動
await set('#title', '假期'); await page.evaluate(() => { const c = document.querySelector('#allday'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
await set('#freq', ''); await set('#ed', '2026-03-04'); await click('#add');
o = await out();
assert.ok(o.includes('DTSTART;VALUE=DATE:20260302') && o.includes('DTEND;VALUE=DATE:20260305'));
assert.strictEqual((o.match(/BEGIN:VEVENT/g) || []).length, 2);
// 錯誤：結束早於開始
await set('#ed', '2026-03-01'); await set('#title', 'x'); await click('#add');
assert.ok((await text('#err')).includes('結束'));
// 轉 UTC
await set('#mode', 'utc'); assert.ok((await out()).includes('DTSTART:20260302T020000Z'));
// 選項記憶 / 重置
assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('icsgen_opts'))), { mode: 'utc', tz: 'Asia/Taipei', alarms: [15], allDay: true });
await page.evaluate(() => { window.confirm = () => true; }); await click('#reset');
assert.strictEqual(await page.evaluate(() => localStorage.getItem('icsgen_opts')), null);
// 刪除清單項目
await click('#evList .ev button'); assert.strictEqual((await out()).match(/BEGIN:VEVENT/g).length, 1);
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('ics-gen OK');
