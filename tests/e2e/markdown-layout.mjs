// markdown-preview 版面回歸：原文再長、有超寬內容時，整頁寬度與高度都不能變（編輯區與預覽固定高度，內容在裡面捲動）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const huge = ['# 標題', '', 'x'.repeat(6000), '', '| ' + Array.from({ length: 40 }, (_, i) => '欄位' + i).join(' | ') + ' |', '| ' + Array.from({ length: 40 }, () => '---').join(' | ') + ' |', '| ' + Array.from({ length: 40 }, () => '內容內容內容').join(' | ') + ' |', '', '```', 'y'.repeat(3000), '```', '', ...Array.from({ length: 3000 }, (_, i) => `第 ${i} 行 一些文字`)].join('\n');
const browser = await launchEdge();
for (const [label, mobile, w, h] of [['手機 390', true, 390, 844], ['桌機 1280', false, 1280, 900]]) {
    const { page, errors } = await openPage(browser, 'utils/markdown-preview.html', { mobile });
    if (!mobile) await page.setViewport({ width: w, height: h });
    const size = () => page.evaluate(() => ({ w: document.scrollingElement.scrollWidth, h: document.scrollingElement.scrollHeight }));
    await page.evaluate(() => { document.querySelector('#src').value = ''; document.querySelector('#src').dispatchEvent(new Event('input')); });
    if (mobile) await page.evaluate(() => document.querySelector('#tPrev').click());
    const empty = await size();
    await page.evaluate((t) => { const s = document.querySelector('#src'); s.value = t; s.dispatchEvent(new Event('input')); }, huge);
    const full = await size();
    assert.equal(full.w, empty.w, `${label}：頁面寬度被撐開 ${empty.w} → ${full.w}`);
    assert.ok(Math.abs(full.h - empty.h) <= 4, `${label}：頁面高度改變 ${empty.h} → ${full.h}`);
    const inner = await page.evaluate(() => { const p = document.querySelector('#preview'), s = document.querySelector('#src'); return { pv: p.scrollHeight > p.clientHeight, src: s.scrollHeight > s.clientHeight }; });
    assert.ok(inner.pv && (inner.src || mobile), `${label}：內容沒有在面板內捲動`);
    assert.deepEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('markdown-layout OK');
