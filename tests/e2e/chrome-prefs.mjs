// 外觀偏好：字級（zoom）、高對比、加密備份往返
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-prefs-'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
try {
    // ---- 字級：各級都不橫向溢出，且偏好會保留 ----
    for (const rel of ['utils/sport-calc.html', 'fun/todo.html', 'index.html']) {
        const { page, errors } = await openPage(browser, rel);
        for (const [lv, z] of [['s', .92], ['l', 1.12], ['xl', 1.28]]) {
            await page.evaluate((v) => Chrome.setFont(v), lv); await sleep(200);
            assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-ui-font')), lv);
            assert.equal(+(await page.evaluate(() => getComputedStyle(document.body).zoom)), z, rel + ' zoom ' + lv);
            const over = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
            assert.ok(over <= 1, `${rel} 字級 ${lv} 橫向溢出 ${over}px`);
        }
        await page.reload({ waitUntil: 'load' });
        assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-ui-font')), 'xl', rel + ' 偏好要保留');
        await page.evaluate(() => Chrome.setFont('m'));
        assert.deepEqual(errors, [], rel); await page.close();
    }
    // 外觀面板有字級與對比的按鈕
    const t = await openPage(browser, 'fun/todo.html');
    await t.page.evaluate(() => document.querySelector('.st-theme').click());
    const labels = await t.page.evaluate(() => [...document.querySelectorAll('.st-panel .st-md')].map(b => b.textContent));
    for (const x of ['小', '中', '大', '特大', '標準', '高對比']) assert.ok(labels.includes(x), '面板缺少 ' + x);

    // ---- 高對比：淺 / 深色、各風格都有效（文字、次要文字、主色與底色的對比 ≥ 7:1）----
    const ratio = (page) => page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
        const rgb = (h) => { let m = h.replace('#', ''); if (m.length === 3) m = [...m].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16) / 255); };
        const lum = (c) => { const f = (x) => x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
        const r = (a, b) => { const x = lum(rgb(a)) + .05, y = lum(rgb(b)) + .05; return Math.max(x, y) / Math.min(x, y); };
        return Math.min(r(v('--text'), v('--bg')), r(v('--muted'), v('--bg')), r(v('--blue'), v('--bg')), r(v('--on-blue'), v('--blue')));
    });
    await t.page.evaluate(() => Chrome.setContrast('high'));
    for (const style of ['apple', 'neon', 'paper', 'forest', 'pixel']) for (const mode of ['light', 'dark']) {
        await t.page.evaluate((s, m) => { Chrome.setStyle(s); Chrome.setMode(m); }, style, mode); await sleep(120);
        assert.ok(await t.page.evaluate(() => document.documentElement.getAttribute('data-ui-contrast') === 'high'));
        const x = await ratio(t.page); assert.ok(x >= 7, `${style}/${mode} 高對比只有 ${x.toFixed(2)}:1`);
    }
    await t.page.evaluate(() => { Chrome.setContrast('std'); Chrome.setStyle('apple'); Chrome.setMode('auto'); });
    assert.equal(await t.page.evaluate(() => document.documentElement.hasAttribute('data-ui-contrast')), false);

    // ---- 加密備份往返（首頁全站備份視窗）----
    const h = await openPage(browser, 'index.html');
    await h.page.evaluate(() => { localStorage.clear(); localStorage.setItem('todo_items', '[{"id":"secret-1"}]'); });
    await h.page.evaluate(() => Chrome.openData());
    await h.page.evaluate(() => { document.querySelector('#st-enc-chk').click(); document.querySelector('#st-enc-pw').value = '12'; });
    await h.page.evaluate(() => document.querySelector('.st-data .primary').click());
    await sleep(250);
    assert.match(await h.page.evaluate(() => document.querySelector('.st-msg').textContent), /至少 4 個字/);
    const cdp = await h.page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: tmp });
    await h.page.evaluate(() => { document.querySelector('#st-enc-pw').value = 'pass1234'; document.querySelector('.st-data .primary').click(); });
    for (let i = 0; i < 40 && !fs.readdirSync(tmp).some(f => f.endsWith('.json')); i++) await sleep(100);
    const file = fs.readdirSync(tmp).find(f => f.endsWith('.json')); assert.ok(file && /-enc\.json$/.test(file), '應下載 -enc.json：' + file);
    const body = fs.readFileSync(path.join(tmp, file), 'utf8');
    assert.ok(!body.includes('secret-1') && body.includes('"enc"'), '加密檔不能含明文');
    // 清掉資料 → 載入加密檔：先要密碼，錯誤密碼不寫入，正確密碼才進差異預覽、確認後才寫入
    await h.page.evaluate(() => localStorage.removeItem('todo_items'));
    await (await h.page.$('.st-data input[type=file]')).uploadFile(path.join(tmp, file));
    await h.page.waitForSelector('.st-prev input[type=password]', { timeout: 5000 });
    await h.page.evaluate(() => { document.querySelector('.st-prev input[type=password]').value = 'nope-nope'; [...document.querySelectorAll('.st-prev button')].find(b => b.textContent === '解密').click(); });
    await sleep(500);
    assert.match(await h.page.evaluate(() => document.querySelector('.st-msg').textContent), /密碼不對/);
    assert.equal(await h.page.evaluate(() => localStorage.getItem('todo_items')), null);
    await h.page.evaluate(() => { document.querySelector('.st-prev input[type=password]').value = 'pass1234'; [...document.querySelectorAll('.st-prev button')].find(b => b.textContent === '解密').click(); });
    await h.page.waitForSelector('.st-prev ul', { timeout: 5000 });
    assert.equal(await h.page.evaluate(() => localStorage.getItem('todo_items')), null, '解密後仍要先預覽，確認前不能寫入');
    await Promise.all([h.page.waitForNavigation({ timeout: 8000 }), h.page.evaluate(() => [...document.querySelectorAll('.st-prev button')].find(b => /確認載入/.test(b.textContent)).click())]);
    assert.equal(await h.page.evaluate(() => localStorage.getItem('todo_items')), '[{"id":"secret-1"}]');
    console.log('chrome-prefs ok');
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
