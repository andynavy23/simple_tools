// 快速搜尋：首頁 Ctrl+K / "/" 聚焦、↑↓ 選取、Enter 開啟、Esc 清空；工具頁 Ctrl+K 回首頁並聚焦搜尋框
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'index.html', { mobile: false });
    await page.setViewport({ width: 1280, height: 800 });
    const focused = () => page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control');
    assert.equal(await focused(), 'q', 'Ctrl+K 要聚焦搜尋框');
    await page.keyboard.press('Escape'); await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('/');
    assert.equal(await focused(), 'q', '"/" 要聚焦搜尋框');
    await page.keyboard.type('計時');
    const n = await page.evaluate(() => document.querySelectorAll('#view a.item').length);
    assert.ok(n >= 2, '搜尋「計時」至少要有 2 個結果');
    await page.keyboard.press('ArrowDown');
    const sel = await page.evaluate(() => [...document.querySelectorAll('#view .row')].map(r => r.classList.contains('kbsel')));
    assert.equal(sel.filter(Boolean).length, 1); assert.ok(sel[0], '第一次 ↓ 選第一個');
    await page.keyboard.press('ArrowDown'); assert.ok((await page.evaluate(() => [...document.querySelectorAll('#view .row')].map(r => r.classList.contains('kbsel'))))[1]);
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');                  // 回到第一個再往上 → 繞到最後
    assert.ok((await page.evaluate(() => [...document.querySelectorAll('#view .row')].map(r => r.classList.contains('kbsel')))).at(-1) === true, '↑ 要繞到最後一個');
    const href = await page.evaluate(() => document.querySelector('#view .row.kbsel a.item').getAttribute('href'));
    await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
    assert.ok(page.url().endsWith(href), 'Enter 要開啟選取的工具：' + page.url() + ' vs ' + href);
    // 工具頁 Ctrl+K → 首頁且聚焦搜尋
    await page.keyboard.down('Control');
    await Promise.all([page.waitForNavigation(), page.keyboard.press('k')]);
    await page.keyboard.up('Control');
    assert.ok(/index\.html(#.*)?$/.test(page.url()), '應回到首頁：' + page.url());
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'q', { timeout: 3000 });
    // Esc 清空
    await page.keyboard.type('abc'); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.querySelector('#q').value), '');
    assert.deepEqual(errors, []);
    console.log('quick-search ok');
} finally { await browser.close(); }
