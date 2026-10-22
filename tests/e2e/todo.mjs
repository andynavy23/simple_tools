// todo：匯出 Markdown / .ics（下載到暫存資料夾）
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/todo.html');
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const waitFile = async (name) => {
    const f = path.join(browser.downloadDir, name);
    for (let i = 0; i < 50 && !fs.existsSync(f); i++) await new Promise(r => setTimeout(r, 100));
    return fs.readFileSync(f, 'utf8');
};
await click('#expIcs');
assert.ok((await page.evaluate(() => document.querySelector('#sub').textContent)).includes('沒有'));
await page.evaluate(() => {
    localStorage.setItem('todo_items', JSON.stringify([{ id: 'x1', t: '繳費', due: '2026-03-10', done: false }, { id: 'x2', t: '買菜', due: '', done: true }]));
    location.reload();
});
await page.waitForFunction(() => document.querySelector('.it'));
await click('#expMd');
const md = await waitFile('todo.md');
assert.ok(md.includes('- [ ] 繳費（2026-03-10）') && md.includes('- [x] 買菜'));
await click('#expIcs');
const ics = await waitFile('todo.ics');
assert.ok(ics.includes('DTSTART;VALUE=DATE:20260310') && ics.includes('DTEND;VALUE=DATE:20260311') && !ics.includes('買菜'));
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('todo OK');
