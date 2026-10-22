// http-request 畫面測試：curl 轉換、帶到請求測試、送請求（本機 CORS 伺服器）、失敗解說、WebSocket 連線失敗與關閉碼、只存選項
import http from 'http';
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    let b = ''; req.on('data', d => b += d); req.on('end', () => res.end(JSON.stringify({ method: req.method, body: b, cookie: req.headers.cookie || null })));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/http-request.html');
    const setv = (sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    const click = (sel) => page.$eval(sel, e => e.click());
    const text = (sel) => page.$eval(sel, e => e.textContent);
    // A：curl -> 各語言
    await setv('#src', "curl -X POST 'https://api.example.com/x' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{\"a\":1}' -o out.txt");
    assert.ok((await text('#aOut')).includes('await fetch("https://api.example.com/x"'));
    assert.ok((await text('#aMsg')).includes('-o out.txt'), '不認得的旗標要列出');
    await click('#langTabs [data-l=python]'); assert.ok((await text('#aOut')).includes('requests.post('));
    await click('#langTabs [data-l=go]'); assert.ok((await text('#aOut')).includes('http.NewRequest("POST"'));
    // 帶到請求測試，改成本機網址
    await click('#toTest');
    assert.equal(await page.$eval('#pb', e => e.hidden), false);
    assert.equal(await page.$eval('#bUrl', e => e.value), 'https://api.example.com/x');
    await setv('#bMethod', 'POST'); await setv('#bUrl', `http://127.0.0.1:${port}/j`); await setv('#bHeaders', 'Content-Type: text/plain\nCookie: a=1'); await setv('#bBody', 'hello');
    await click('#send');
    await page.waitForFunction(() => /200/.test(document.querySelector('#bRes').textContent), { timeout: 8000 });
    const res = await text('#bRes');
    assert.ok(res.includes('"method": "POST"') && res.includes('"body": "hello"'), res);
    assert.ok(res.includes('"cookie": null'), '不可帶 Cookie');
    assert.ok(res.includes('Cookie'), '要提示 Cookie 不會送出');
    // 失敗解說
    await setv('#bUrl', 'http://127.0.0.1:1/'); await click('#send');
    await page.waitForFunction(() => /失敗/.test(document.querySelector('#bRes').textContent), { timeout: 8000 });
    assert.ok((await text('#bRes')).includes('CORS'));
    await setv('#bUrl', 'ftp://x'); await click('#send');
    assert.ok((await text('#bRes')).includes('http://'));
    // WebSocket
    await click('#tabs [data-t=c]');
    await setv('#wsUrl', 'ws://127.0.0.1:1/'); await click('#wsGo');
    await page.waitForFunction(() => /關閉碼 1006/.test(document.querySelector('#logBox').textContent), { timeout: 8000 });
    assert.equal(await page.$eval('#wsSend', e => e.disabled), true);
    await setv('#wsUrl', 'http://x'); await click('#wsGo'); assert.ok((await text('#wsMsg')).includes('ws://'));
    await click('#wsClear'); assert.equal(await text('#wsCount'), '0 / 500');
    // 只存選項，不存網址 / 標頭 / 本體
    const st = await page.evaluate(() => localStorage.getItem('httpreq_opts'));
    assert.ok(st && !/127\.0\.0\.1|hello|Cookie|example/.test(st), st);
    assert.ok(!errors.length, errors.join('\n'));
} finally { await browser.close(); server.close(); }
console.log('ok  http-request e2e');
