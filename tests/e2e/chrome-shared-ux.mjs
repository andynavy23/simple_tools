// theme.css / chrome.js 共用 UX：檔案鈕、勾選 label、range 觸控尺寸、分頁列淡出、記住分頁、toast 動作、備份還原前下載與密碼 Enter
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-cux-'));
try {
    // ---- 94 檔案選擇鈕 ----
    let o = await openPage(browser, 'utils/subtitle-tool.html');
    const fb = await o.page.evaluate(() => {
        const i = document.querySelector('input[type=file]'), cs = getComputedStyle(i, '::file-selector-button'), b = getComputedStyle(document.querySelector('button'));
        return { coarse: matchMedia('(pointer:coarse)').matches, h: parseFloat(cs.height) || i.getBoundingClientRect().height, minH: parseFloat(cs.minHeight), font: cs.fontFamily === b.fontFamily, size: cs.fontSize === b.fontSize, mr: parseFloat(cs.marginRight) };
    });
    assert.ok(fb.coarse, '測試環境需為觸控');
    assert.ok(fb.minH >= 44 && fb.h >= 44, '檔案按鈕高度 ≥ 44：' + JSON.stringify(fb));
    assert.ok(fb.font && fb.size && fb.mr >= 8, '檔案按鈕字體與一般按鈕相同：' + JSON.stringify(fb));
    assert.deepEqual(o.errors, []);

    // ---- 95 勾選 label、96 range ----
    o = await openPage(browser, 'fun/metronome.html');
    const lr = await o.page.evaluate(() => {
        const c = document.querySelector('#acc'), l = c.closest('label'), r = document.querySelector('#bpm');
        const lb = l.getBoundingClientRect(), cb = c.getBoundingClientRect();
        return { lh: lb.height, off: Math.abs((lb.top + lb.height / 2) - (cb.top + cb.height / 2)), rh: r.getBoundingClientRect().height };
    });
    assert.ok(lr.lh >= 44, 'label 高 ≥ 44：' + lr.lh);
    assert.ok(lr.off <= 2, 'checkbox 與 label 垂直置中：' + lr.off);
    assert.ok(lr.rh >= 44, 'range 高 ≥ 44：' + lr.rh);
    assert.deepEqual(o.errors, []);

    // ---- 114 記住分頁、102 淡出（media-kit 有 6 個分頁鈕 → st-scroll）----
    o = await openPage(browser, 'utils/media-kit.html');
    const pressed = () => o.page.evaluate(() => [...document.querySelectorAll('.tabs>button')].findIndex(b => b.getAttribute('aria-pressed') === 'true'));
    assert.equal(await pressed(), 0);
    const fade = () => o.page.evaluate(() => { const t = document.querySelector('.tabs'); return { sc: t.classList.contains('st-scroll'), end: t.classList.contains('st-end'), mask: getComputedStyle(t).maskImage || getComputedStyle(t).webkitMaskImage, over: t.scrollWidth > t.clientWidth }; });
    await o.page.waitForFunction(() => document.querySelector('.tabs').classList.contains('st-scroll'));
    let f = await fade();
    assert.ok(f.sc && f.over && !f.end && /gradient/.test(f.mask), '分頁列右緣淡出：' + JSON.stringify(f));
    await o.page.evaluate(() => { const t = document.querySelector('.tabs'); t.scrollLeft = t.scrollWidth; });
    await o.page.waitForFunction(() => document.querySelector('.tabs').classList.contains('st-end'), { timeout: 5000 }).catch(() => { });
    f = await fade(); assert.ok(f.end && f.mask === 'none', '捲到最右後取消淡出：' + JSON.stringify(f));
    await o.page.evaluate(() => document.querySelectorAll('.tabs>button')[2].click());
    assert.equal(await pressed(), 2);
    await o.page.reload({ waitUntil: 'load' });
    await o.page.waitForFunction(() => document.querySelectorAll('.tabs>button')[2].getAttribute('aria-pressed') === 'true', { timeout: 5000 }).catch(() => { });
    assert.equal(await pressed(), 2, 'reload 後仍在第 3 分頁');
    assert.equal(await o.page.evaluate(() => { sessionStorage.setItem('st_tab:' + location.pathname, 'garbage{'); return 1; }), 1);
    await o.page.reload({ waitUntil: 'load' }); await new Promise(r => setTimeout(r, 300));
    assert.equal(await pressed(), 0, '壞資料回第 1 分頁');
    assert.deepEqual(o.errors, []);
    const fresh = await openPage(browser, 'utils/media-kit.html');      // 同一瀏覽器的新分頁 = 新 session
    assert.equal(await fresh.page.evaluate(() => [...document.querySelectorAll('.tabs>button')].findIndex(b => b.getAttribute('aria-pressed') === 'true')), 0, '新分頁從第 1 個開始');
    // 頁面自己記分頁的（date-calc）：不受影響、無例外
    const dc = await openPage(browser, 'utils/date-calc.html');
    const dcTab = () => dc.page.evaluate(() => [...document.querySelectorAll('.tabs>button,[role=tablist]>button')].findIndex(b => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-selected') === 'true' || b.classList.contains('on') || b.classList.contains('active')));
    const before = await dcTab();
    await dc.page.reload({ waitUntil: 'load' }); await new Promise(r => setTimeout(r, 300));
    assert.equal(await dcTab(), before);
    assert.deepEqual(dc.errors, []);

    // ---- 119 toast 動作 ----
    o = await openPage(browser, 'fun/todo.html');
    await o.page.evaluate(() => { window.__u = 0; Chrome.toast('一般', 5000); });
    assert.equal(await o.page.evaluate(() => document.querySelector('.st-toast button')), null, '無 action 時沒有按鈕');
    assert.equal(await o.page.evaluate(() => document.querySelector('.st-toast').textContent), '一般');
    await o.page.evaluate(() => Chrome.toast('已刪除', 5000, '', { label: '復原', onClick: () => { window.__u++; } }));
    assert.equal(await o.page.evaluate(() => document.querySelector('.st-toast button').textContent), '復原');
    assert.ok(await o.page.evaluate(() => document.querySelector('.st-toast button').getBoundingClientRect().height >= 44), '復原鈕可點');
    await o.page.evaluate(() => document.querySelector('.st-toast button').click());
    assert.deepEqual(await o.page.evaluate(() => [window.__u, document.querySelector('.st-toast').hidden]), [1, true]);
    await o.page.evaluate(() => Chrome.toast('再一般'));
    assert.equal(await o.page.evaluate(() => document.querySelector('.st-toast button')), null, '下一則無 action 不殘留按鈕');
    assert.deepEqual(o.errors, []);

    // ---- 120 還原前先下載、121 密碼 Enter ----
    const t = await openPage(browser, 'fun/todo.html');
    await t.page.evaluate(() => { localStorage.setItem('todo_items', '[{"id":"a"}]'); localStorage.removeItem('pomo_tasks'); Chrome.openData(); });
    const mk = (data) => { const f = path.join(tmp, Math.random().toString(36).slice(2) + '.json'); fs.writeFileSync(f, JSON.stringify({ app: 'simple_tools', v: 1, scope: 'fun/todo.html', exportedAt: '2026-10-01T00:00:00Z', data })); return f; };
    const prevBtns = () => t.page.evaluate(() => [...document.querySelectorAll('.st-prev button')].map(b => [b.textContent, b.disabled]));
    // 有覆蓋：有「先下載」鈕、確認載入先停用
    await (await t.page.$('.st-data input[type=file]')).uploadFile(mk({ todo_items: '[{"id":"b"}]' }));
    await t.page.waitForSelector('.st-prev ul');
    let bs = await prevBtns();
    assert.ok(bs.some(([x]) => /先下載目前資料/.test(x)), '有覆蓋時有先下載鈕');
    assert.ok(bs.find(([x]) => /確認載入/.test(x))[1], '下載前確認載入停用');
    const n0 = fs.existsSync(browser.downloadDir) ? fs.readdirSync(browser.downloadDir).length : 0;
    await t.page.evaluate(() => document.querySelector('.st-before').click());
    let dl = []; for (let i = 0; i < 30 && !dl.some(x => /before-restore\.json$/.test(x)); i++) { await new Promise(r => setTimeout(r, 200)); dl = fs.existsSync(browser.downloadDir) ? fs.readdirSync(browser.downloadDir) : []; }
    assert.ok(dl.some(x => /before-restore\.json$/.test(x)), '產生 before-restore 下載檔：' + dl);
    assert.ok(dl.length > n0);
    const saved = JSON.parse(fs.readFileSync(path.join(browser.downloadDir, dl.find(x => /before-restore/.test(x))), 'utf8'));
    assert.equal(saved.data.todo_items, '[{"id":"a"}]', '下載的是目前資料');
    bs = await prevBtns(); assert.equal(bs.find(([x]) => /確認載入/.test(x))[1], false, '下載後啟用確認載入');
    // 無覆蓋：不出現
    await t.page.evaluate(() => [...document.querySelectorAll('.st-prev button')].find(b => b.textContent === '取消').click());
    await (await t.page.$('.st-data input[type=file]')).uploadFile(mk({ pomo_tasks: '[]' }));
    await t.page.waitForSelector('.st-prev ul');
    assert.equal(await t.page.evaluate(() => !!document.querySelector('.st-before')), false, '無覆蓋時不出現');
    await t.page.evaluate(() => [...document.querySelectorAll('.st-prev button')].find(b => b.textContent === '取消').click());
    // 加密檔：密碼欄 Enter 進入差異預覽
    // 以頁面自己的匯出產生加密檔：勾選加密、輸入密碼、Enter 匯出
    await t.page.evaluate(() => { const c = document.querySelector('#st-enc-chk'); c.click(); });
    assert.equal(await t.page.evaluate(() => document.querySelector('#st-enc-pw').getAttribute('enterkeyhint')), 'go');
    await t.page.type('#st-enc-pw', 'pw1234');
    await t.page.keyboard.press('Enter');
    let encf; for (let i = 0; i < 40 && !encf; i++) { await new Promise(r => setTimeout(r, 250)); encf = fs.readdirSync(browser.downloadDir).find(x => /-enc\.json$/.test(x)); }
    assert.ok(encf, '加密欄 Enter 觸發匯出');
    await (await t.page.$('.st-data input[type=file]')).uploadFile(path.join(browser.downloadDir, encf));
    await t.page.waitForSelector('.st-prev input[type=password]');
    assert.equal(await t.page.evaluate(() => document.querySelector('.st-prev input').getAttribute('enterkeyhint')), 'go');
    await t.page.type('.st-prev input[type=password]', 'pw1234');
    await t.page.keyboard.press('Enter');
    await t.page.waitForFunction(() => /備份裡有 \d+ 項/.test(document.querySelector('.st-prev').textContent), { timeout: 8000 });     // 進入差異預覽
    assert.deepEqual(t.errors, []);
    console.log('chrome-shared-ux ok');
} finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
}
