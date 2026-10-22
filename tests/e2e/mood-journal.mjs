// mood-journal：年度回顧（熱度圖、分布、標籤統計、換年份）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/mood-journal.html');
await page.evaluate(() => {
    localStorage.setItem('mood_entries', JSON.stringify([
        { date: '2025-06-01', mood: 5, tags: ['旅行'], text: '' }, { date: '2026-01-01', mood: 4, tags: ['運動'], text: '' }, { date: '2026-01-02', mood: 2, tags: ['運動', '工作'], text: '' }]));
    location.reload();
});
await page.waitForSelector('#heat i');
assert.deepEqual(await page.$$eval('#ryear option', o => o.map(x => x.value)), ['2026', '2025']);
assert.strictEqual(await page.$$eval('#heat i', c => c.length), 12 * 31);
assert.strictEqual(await page.$$eval('#heat i[style]', c => c.length), 2);
assert.ok((await page.$eval('#yrSum', e => e.innerText)).includes('2 天'));
assert.ok((await page.$eval('#topTags', e => e.innerText)).includes('運動'));
await page.select('#ryear', '2025');
assert.strictEqual(await page.$$eval('#heat i[style]', c => c.length), 1);
assert.ok((await page.$eval('#topTags', e => e.innerText)).includes('旅行'));
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('mood-journal OK');
