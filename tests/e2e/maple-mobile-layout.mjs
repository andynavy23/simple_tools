// 楓之谷風格頁（rjpq / party / gobang / lucky-channel / papulatus / level-puzzles / stealth-reader / tetris）390px 版面：
// 不被右上角圓鈕蓋住、觸控高度 >= 44、小字 >= 12
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const rect = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map(e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, h: r.height }; }), sel);
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const circles = (page) => rect(page, '.st-homebtn, .st-helpbtn, .st-databtn, .st-btn');

    // rjpq：標題不與圓鈕相交；門格小字 >= 12
    let { page, errors } = await openPage(browser, 'game-assist/rjpq.html');
    assert.ok((await circles(page)).length >= 2, '找不到圓鈕');
    const hd = await page.evaluate(() => { const t = document.querySelector('.header .title'), r = document.createRange(); r.selectNodeContents(t); const b = r.getBoundingClientRect(); return { r: b.right, top: b.top }; });
    assert.ok(hd.r <= 390 - 104 + 4 || hd.top > 56, 'rjpq 標題被圓鈕蓋住');
    assert.deepEqual(errors, []);

    // party：日誌鈕不與圓鈕相交；底部列有 safe-area
    ({ page, errors } = await openPage(browser, 'game-assist/party.html'));
    const log = (await rect(page, '.header-btns .btn'))[0], cs = await circles(page);
    assert.ok(log && cs.every(c => !hit(log, c)), 'party 日誌鈕與圓鈕相交');
    assert.match(await page.evaluate(() => document.querySelector('meta[name=viewport]').content), /viewport-fit=cover/);

    // gobang：標題區徽章單行；觸控下拉 >= 44
    ({ page, errors } = await openPage(browser, 'mini-games/gobang.html'));
    const g = (await rect(page, '.header .guild'))[0]; assert.ok(g.h < 30, 'gobang 徽章折行');
    for (const s of ['#cpu-level', '#cpu-first']) assert.ok((await rect(page, s))[0].h >= 44, s + ' < 44');

    // lucky-channel：輸入框 >= 44
    ({ page, errors } = await openPage(browser, 'game-assist/lucky-channel.html'));
    for (const r of await rect(page, 'input')) assert.ok(r.h >= 44, 'lucky input ' + r.h);

    // papulatus：勾選 label >= 44
    ({ page, errors } = await openPage(browser, 'game-assist/papulatus.html'));
    for (const r of await rect(page, '.switch-row label')) assert.ok(r.h >= 44, 'papulatus label ' + r.h);

    // level-puzzles：有返回連結、副標 >= 12
    ({ page, errors } = await openPage(browser, 'mini-games/level-puzzles.html'));
    assert.ok((await rect(page, 'a.back')).length === 1);
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.lv button small')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 12)));

    // stealth-reader：頂欄內容不與圓鈕相交
    ({ page, errors } = await openPage(browser, 'reading/stealth-reader.html'));
    const sc = await circles(page), items = await rect(page, 'body > div:first-of-type > div > *, body > div:first-of-type > div > div > *');
    assert.ok(items.every(i => i.t > 60 || sc.every(c => !hit(i, c))), 'stealth-reader 頂欄與圓鈕相交');

    // tetris：七顆鈕都是 svg
    ({ page, errors } = await openPage(browser, 'mini-games/tetris.html'));
    assert.equal(await page.evaluate(() => document.querySelectorAll('#touch button svg').length), 7);
    assert.deepEqual(errors, []);
    console.log('ok maple-mobile-layout');
} finally { await browser.close(); }
