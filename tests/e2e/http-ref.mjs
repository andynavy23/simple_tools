// http-ref 畫面測試：既有速查仍可用；安全標頭（CORS / CSP 產生、檢查）與 Cookie 解析分頁
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/http-ref.html');
    const setv = (sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    const click = (sel) => page.$eval(sel, e => e.click());
    const text = (sel) => page.$eval(sel, e => e.textContent);
    // 既有速查
    await setv('#q', '429');
    assert.ok((await text('#list')).includes('Too Many Requests'));
    // 安全標頭
    await click('#modes [data-m=sec]');
    assert.equal(await page.$eval('#paneRef', e => e.hidden), true); assert.equal(await page.$eval('#paneSec', e => e.hidden), false);
    await setv('#coOrigin', 'https://app.example.com'); await click('#coCred');
    let out = await text('#coOut');
    assert.ok(out.includes('Access-Control-Allow-Origin: https://app.example.com') && out.includes('Allow-Credentials: true') && out.includes('Vary: Origin'), out);
    await setv('#coOrigin', '*'); assert.ok((await text('#coWarn')).includes('不能同時'));
    await click('#cspPreset'); await setv('#csp_script-src', 'self unsafe-inline');
    out = await text('#cspOut'); assert.ok(out.includes("script-src 'self' 'unsafe-inline'") && out.includes("object-src 'none'"), out);
    await click('#chkSample');
    const chk = await text('#chkOut');
    assert.ok(chk.includes('錯誤') && chk.includes('* 搭配') && chk.includes('unsafe-inline') && chk.includes('max-age'), chk);
    // Cookie
    await click('#modes [data-m=cookie]');
    await click('#ckSample');
    const ck = await text('#ckOut');
    assert.ok(ck.includes('HttpOnly') && ck.includes('SameSite') && ck.includes('必須同時有 Secure') && ck.includes('解碼：你好'), ck);
    assert.equal(await page.$eval('#paneCookie', e => e.scrollWidth <= e.clientWidth + 1), true);
    assert.ok(!errors.length, errors.join('\n'));
} finally { await browser.close(); }
console.log('ok  http-ref e2e');
