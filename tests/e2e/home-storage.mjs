// home-storage：首頁頁尾「本機儲存空間」列出鍵、大小、百分比，單獨刪除（先 confirm），不顯示內容值
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'index.html');
    const text = (sel) => page.$eval(sel, e => e.textContent);
    await page.evaluate(() => {
        localStorage.setItem('zz_fake_big', 'x'.repeat(10000)); localStorage.setItem('zz_fake_small', 'SECRETVALUE');
        window.__confirms = []; window.confirm = (m) => { window.__confirms.push(m); return window.__answer !== false; };
        document.querySelector('#storage').open = true;
    });
    await page.waitForFunction(() => document.querySelectorAll('#stglist li').length >= 2, { timeout: 8000 });
    const keys = await page.$$eval('#stglist li code', els => els.map(e => e.textContent));
    assert.ok(keys.indexOf('zz_fake_big') >= 0 && keys.indexOf('zz_fake_big') < keys.indexOf('zz_fake_small'), '依大小排序：' + keys);
    assert.ok(!(await text('#stglist')).includes('SECRETVALUE') && !(await text('#stglist')).includes('xxxxx'), '不顯示內容');
    const sum = await text('#stgsum'); assert.ok(/估算/.test(sum) && /%/.test(sum), sum);
    const bigRow = await page.$$eval('#stglist li', ls => ls.find(l => l.textContent.includes('zz_fake_big')).textContent);
    assert.ok(bigRow.includes('19.6 KB'), bigRow);               // (11 + 10000) × 2 = 20022 B
    // 取消 → 不刪
    await page.evaluate(() => { window.__answer = false; [...document.querySelectorAll('#stglist li')].find(l => l.textContent.includes('zz_fake_big')).querySelector('button').click(); });
    assert.ok(await page.evaluate(() => localStorage.getItem('zz_fake_big') !== null && window.__confirms[0].includes('無法復原')));
    // 確認 → 刪除並即時更新
    await page.evaluate(() => { window.__answer = true; [...document.querySelectorAll('#stglist li')].find(l => l.textContent.includes('zz_fake_big')).querySelector('button').click(); });
    assert.equal(await page.evaluate(() => localStorage.getItem('zz_fake_big')), null);
    assert.ok(!(await text('#stglist')).includes('zz_fake_big'));
    assert.ok((await text('#stglist')).includes('zz_fake_small'), '只刪指定的鍵');
    assert.ok(!errors.length, errors.join('\n'));
    await page.evaluate(() => { localStorage.removeItem('zz_fake_big'); localStorage.removeItem('zz_fake_small'); });
} finally { await browser.close(); }
console.log('ok  home-storage e2e');
