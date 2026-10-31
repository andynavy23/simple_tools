// 「工具箱」鈕：沒有任何回首頁連結的獨立風格頁（楓之谷風格等）由 chrome.js 在右上角補一顆；有連結的頁面不重複；偽裝用的摸魚閱讀器不顯示
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    for (const rel of ['game-assist/lucky-channel.html', 'game-assist/papulatus.html', 'game-assist/party.html', 'game-assist/rjpq.html', 'mini-games/gobang.html']) {
        const { page, errors } = await openPage(browser, rel);
        assert.equal(await page.evaluate(() => document.querySelectorAll('.st-homebtn').length), 1, rel + ' 應有一顆工具箱鈕');
        const box = await page.evaluate(() => { const r = document.querySelector('.st-homebtn').getBoundingClientRect(); return [r.width, r.height]; });
        assert.ok(box[0] >= 38 && box[1] >= 38, rel + ' 按鈕太小');
        await Promise.all([page.waitForNavigation(), page.evaluate(() => document.querySelector('.st-homebtn').click())]);
        assert.ok(/index\.html(#.*)?$/.test(page.url()), rel + ' 點了要回首頁：' + page.url());
        assert.deepEqual(errors, [], rel);
        await page.close();
    }
    for (const rel of ['utils/sport-calc.html', 'game-assist/artale-calc.html', 'reading/stealth-reader.html']) {
        const { page } = await openPage(browser, rel);
        assert.equal(await page.evaluate(() => document.querySelectorAll('.st-homebtn').length), 0, rel + ' 不應再多一顆');
        await page.close();
    }
    console.log('home-button ok');
} finally { await browser.close(); }
