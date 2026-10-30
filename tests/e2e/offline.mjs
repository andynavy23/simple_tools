// 離線下載端到端：用本機 http 伺服器（Service Worker 只能在 http(s) 運作）開首頁，按「下載全部工具供離線使用」，
// 完成後把瀏覽器切成離線，驗證幾個頁面（含新近合併 / 新增、與沒被點開過的）仍能完整開啟，且下載訊息沒有「失敗」。
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { launchEdge, repo } from './lib.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const f = path.join(repo, p);
    if (!f.startsWith(repo) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await launchEdge();
try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(base + 'index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null || true);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10000 });

    await page.evaluate(() => { document.querySelector('#offline').open = true; });
    await page.evaluate(() => document.querySelector('#offdl').click());
    await page.waitForFunction(() => /^(完成|已取消|下載中斷)/.test(document.querySelector('#offmsg').textContent), { timeout: 120000 });
    const msg = await page.evaluate(() => document.querySelector('#offmsg').textContent);
    assert.match(msg, /^完成：/, '下載訊息：' + msg);
    assert.ok(!/失敗/.test(msg), '下載訊息有失敗：' + msg);
    const nCards = await page.evaluate(() => document.querySelectorAll('#src a.card').length);
    const nCached = await page.evaluate(async () => (await (await caches.open('st-v1')).keys()).length);
    assert.ok(nCached >= nCards, `快取 ${nCached} 個檔案，少於 ${nCards} 張卡片`);

    // 切成離線後逐頁開：每頁要有 chrome.js 套用的外觀屬性與頁面主體（而不是離線錯誤頁）
    server.closeAllConnections(); await new Promise(r => server.close(r));       // 真正離線：伺服器關掉（page.setOfflineMode 管不到 Service Worker 自己的請求）
    const hrefs = ['utils/db-query.html', 'game-assist/artale-calc.html', 'mini-games/kids-learn.html', 'utils/sport-calc.html', 'utils/date-calc.html', 'utils/encode-decode.html', 'reading/epub-reader.html', 'fun/art-studio.html'];
    for (const h of hrefs) {
        const p2 = await browser.newPage();
        const errors = [];
        p2.on('pageerror', e => errors.push(String(e.message).slice(0, 80)));
        await p2.goto(base + h, { waitUntil: 'load', timeout: 15000 });
        const ok = await p2.evaluate(() => !!document.documentElement.getAttribute('data-ui-style') && document.body.children.length > 2 && !!document.querySelector('h1'));
        assert.ok(ok, h + ' 離線時沒有正常開啟');
        assert.deepEqual(errors, [], h + ' 離線時有例外');
        await p2.close();
    }
    // 沒下載過的頁面（不存在）在離線時要給說明頁而不是瀏覽器錯誤
    const p3 = await browser.newPage();
    await p3.goto(base + 'utils/not-exist.html', { waitUntil: 'load', timeout: 15000 }).catch(() => { });
    const body = await p3.evaluate(() => document.body ? document.body.textContent : '');
    assert.ok(/離線|網路|尚未/.test(body), '不存在 / 未下載的頁面離線時沒有說明頁：' + body.slice(0, 40));
    console.log('offline ok', nCards, 'cards,', nCached, 'cached');
} finally {
    await browser.close();
    if (server.listening) server.close();
}
