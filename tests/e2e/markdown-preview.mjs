// markdown-preview：目錄（插入游標處）、預覽錨點捲動、匯出獨立 HTML
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/markdown-preview.html');
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const doc = '# 簡介\n\n開頭\n\n## 安裝\n\n' + '填充\n\n'.repeat(60) + '## 安裝\n\n結尾 <script>alert(1)</script>\n';
await page.evaluate((t) => { const s = document.querySelector('#src'); s.value = t; s.dispatchEvent(new Event('input')); s.setSelectionRange(0, 0); }, doc);
assert.ok(await page.$eval('#preview', e => !!e.querySelector('h2[id="安裝-1"]')));
await click('#tocBox summary');
assert.ok((await page.$eval('#tocOut', e => e.value)).includes('- [簡介](#簡介)\n  - [安裝](#安裝)\n  - [安裝](#安裝-1)'));
await click('#tocInsert');
assert.ok((await page.$eval('#src', e => e.value)).startsWith('- [簡介](#簡介)'));
assert.ok((await page.$eval('#tocMsg', e => e.textContent)).includes('已插入'));
// 預覽中點目錄連結：預覽區內捲動，不開新分頁、不改網址
await page.evaluate(() => document.querySelector('#tPrev').click());
const before = await page.$eval('#preview', e => e.scrollTop);
const pages = (await browser.pages()).length;
await page.evaluate(() => [...document.querySelectorAll('#preview a')].find(a => a.getAttribute('href') === '#安裝-1').click());
assert.ok(await page.$eval('#preview', (e, b) => e.scrollTop > b, before), '預覽沒有捲動');
assert.strictEqual((await browser.pages()).length, pages);
assert.ok(!page.url().includes('安裝'));
// 匯出獨立 HTML
await click('#expHtml');
const f = path.join(browser.downloadDir, 'markdown.html');
for (let i = 0; i < 50 && !fs.existsSync(f); i++) await new Promise(r => setTimeout(r, 100));
const html = fs.readFileSync(f, 'utf8');
assert.ok(html.startsWith('<!DOCTYPE html>') && html.includes('<title>簡介</title>') && html.includes('&lt;script&gt;') && !/<script/i.test(html) && html.includes('<a href="#安裝-1">'));
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動');
assert.deepEqual(errors, []);
await browser.close();
console.log('markdown-preview OK');
