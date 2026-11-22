// 分頁圖示：首頁有宣告；工具頁沒宣告就由 chrome.js 補上（各種資料夾深度）；所有圖示都載得到
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    for (const rel of ['index.html', 'utils/sport-calc.html', 'fun/todo.html', 'mini-games/chess.html', 'game-assist/party.html', 'reading/epub-reader.html']) {
        const { page, errors } = await openPage(browser, rel);
        const icons = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"]')].map(l => l.href));
        assert.ok(icons.length >= 1, rel + ' 沒有 icon 連結');
        assert.ok(icons.some(h => h.endsWith('.svg')) && icons.some(h => h.endsWith('.png') || h.endsWith('.ico')), rel + ' 缺 SVG 或 PNG / ICO：' + icons);
        const ok = await page.evaluate(async (urls) => Promise.all(urls.map(u => new Promise(r => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = u; }))), icons);
        assert.ok(ok.every(Boolean), rel + ' 有圖示載不到：' + icons.filter((_, i) => !ok[i]));
        assert.ok(await page.evaluate(() => !!document.querySelector('link[rel~="apple-touch-icon"]')), rel + ' 缺 apple-touch-icon');
        assert.equal(await page.evaluate(() => document.querySelectorAll('link[rel~="icon"][href$="favicon.svg"]').length), 1, rel + ' SVG 圖示重複注入');
        assert.deepEqual(errors, [], rel); await page.close();
    }
    console.log('favicon ok');
} finally { await browser.close(); }
