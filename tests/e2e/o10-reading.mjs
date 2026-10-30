// o10：EPUB 閱讀器（記憶體建的 EPUB：STORE + DEFLATE、清除 script / 外部資源、進度記憶 / 修剪 / 刪除、壞檔）、卡片盒筆記、RSVP 閃讀
import assert from 'assert';
import { createRequire } from 'module';
import { launchEdge, openPage } from './lib.mjs';
const { buildEpub, buildZip } = createRequire(import.meta.url)('../_epubgen.js');
const browser = await launchEdge();

// ---------- EPUB ----------
{
    const { page, errors } = await openPage(browser, 'reading/epub-reader.html');
    const feed = (buf, name) => page.evaluate((b64, n) => {
        const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), dt = new DataTransfer();
        dt.items.add(new File([u], n, { type: 'application/epub+zip' }));
        const f = document.querySelector('#file'); f.files = dt.files; f.dispatchEvent(new Event('change'));
    }, Buffer.from(buf).toString('base64'), name);
    const msg = () => page.$eval('#msg', e => e.textContent);
    await feed(buildEpub({ chapters: 3 }), 'a.epub');
    await page.waitForFunction(() => document.querySelector('#reader h1'));
    assert.ok((await page.$eval('#reader', e => e.textContent)).includes('第1章標題'));
    assert.strictEqual(await page.evaluate(() => window.hacked), undefined, 'script 不可執行');
    assert.strictEqual(await page.$$eval('#reader img, #reader a[href], #reader script, #reader link', l => l.length), 0);
    assert.strictEqual(await page.$$eval('#toc option', o => o.length), 3);
    // 翻章 + 捲動 → 存進度
    await page.evaluate(() => document.querySelector('#next').click());
    await page.waitForFunction(() => document.querySelector('#pos').textContent === '2 / 3');
    await page.evaluate(() => { const r = document.querySelector('#reader'); r.scrollTop = (r.scrollHeight - r.clientHeight) / 2; });
    await new Promise(r => setTimeout(r, 700));
    const keys = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('epub_prog_')));
    assert.strictEqual((await keys()).length, 1);
    const p = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), (await keys())[0]);
    assert.strictEqual(p.ch, 1); assert.ok(p.pos > 0.3 && p.pos < 0.7, 'pos ' + p.pos); assert.strictEqual(p.name, '測試書');
    // 重新載入同一個檔案 → 回到第 2 章
    await feed(buildEpub({ chapters: 3 }), 'a.epub');
    await page.waitForFunction(() => document.querySelector('#pos').textContent === '2 / 3');
    assert.strictEqual((await keys()).length, 1, '同書不重複記');
    // EPUB3 nav
    await feed(buildEpub({ chapters: 2, nav: 'nav', title: '第二本' }), 'b.epub');
    await page.waitForFunction(() => document.querySelector('#toc option')?.textContent === '導覽1');
    assert.strictEqual((await keys()).length, 2);
    // 壞檔 / 不是 zip
    await feed(Buffer.from('not a zip at all, definitely not'), 'c.epub');
    await page.waitForFunction(() => document.querySelector('#msg').className.includes('err'));
    assert.ok((await msg()).includes('無法開啟'));
    assert.ok(await page.$eval('#book', e => e.hidden));
    // 缺 container.xml
    await feed(buildZip([{ name: 'x.txt', data: 'hi' }]), 'd.epub');
    await page.waitForFunction(() => document.querySelector('#msg').textContent.includes('container.xml'));
    // 修剪：塞 60 筆舊進度（含壞資料）後再存 → 最多 50 筆
    await page.evaluate(() => {
        for (let i = 0; i < 60; i++) localStorage.setItem('epub_prog_old' + i, JSON.stringify({ name: 'o' + i, ch: 0, pos: 0, at: i + 1 }));
        localStorage.setItem('epub_prog_bad', 'null');
    });
    await feed(buildEpub({ chapters: 3 }), 'a.epub');
    await page.waitForFunction(() => document.querySelector('#pos').textContent === '2 / 3');
    assert.ok((await keys()).length <= 51, '修剪後數量 ' + (await keys()).length);
    assert.ok((await page.$$eval('#progList .prog', l => l.length)) <= 50);
    // 單筆刪除 / 全部清除（confirm 預設被 dismiss，這裡接受）
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
    const n0 = (await keys()).length;
    await page.evaluate(() => document.querySelector('#progList .prog button').click());
    assert.strictEqual((await keys()).length, n0 - 1);
    await page.evaluate(() => document.querySelector('#progClear').click());
    assert.ok((await keys()).every(k => k === 'epub_prog_bad'));
    // 設定存取 + 壞資料容錯
    await page.evaluate(() => { const s = document.querySelector('#size'); s.value = 24; s.dispatchEvent(new Event('input')); });
    assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('epub_settings')).size), 24);
    await page.evaluate(() => { localStorage.setItem('epub_settings', '"oops"'); location.reload(); });
    await page.waitForSelector('#file');
    assert.strictEqual(await page.$eval('#size', e => e.value), '18');
    assert.deepStrictEqual(errors, []);
    await page.close();
}

// ---------- 卡片盒筆記 ----------
{
    const { page, errors } = await openPage(browser, 'utils/zettel.html');
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, s, v);
    const click = (s) => page.evaluate(s => document.querySelector(s).click(), s);
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('zettel_cards') || '[]'));
    const mk = async (t, body, tags = '') => { await click('#add'); await set('#title', t); await set('#tags', tags); await set('#body', body); await click('#save'); };
    await mk('A', '', '#x');
    await mk('B', '連到 [[A]] 與 [[未建]]');
    assert.strictEqual((await saved()).length, 2);
    // 反向連結出現在 A
    await page.evaluate(() => [...document.querySelectorAll('#list .item')].find(b => b.textContent.startsWith('A')).click());
    assert.deepStrictEqual(await page.$$eval('#bl button', l => l.map(b => b.textContent)), ['B']);
    // 同名被拒
    await click('#add'); await set('#title', 'a'); await click('#save');
    assert.ok((await page.$eval('#msg', e => e.textContent)).includes('同名'));
    // 預覽裡紅色連結 → 建立卡片
    await page.evaluate(() => [...document.querySelectorAll('#list .item')].find(b => b.textContent.startsWith('B')).click());
    await click('#preview .lk.miss');
    assert.strictEqual((await saved()).length, 3);
    // 改名連帶更新連結
    await page.evaluate(() => [...document.querySelectorAll('#list .item')].find(b => b.textContent.startsWith('A')).click());
    await set('#title', 'A2'); await click('#save');
    assert.ok((await saved()).find(c => c.title === 'B').body.includes('[[A2]]'));
    // 刪除清理連結
    await click('#del');
    const s = await saved();
    assert.strictEqual(s.length, 2); assert.strictEqual(s.find(c => c.title === 'B').body, '連到 A2 與 [[未建]]');
    // 搜尋與標籤、匯出
    await set('#q', '未建'); assert.strictEqual(await page.$$eval('#list .item', l => l.length), 2); await set('#q', '');
    await click('#export');
    // 壞資料載入不崩潰
    await page.evaluate(() => { localStorage.setItem('zettel_cards', JSON.stringify([null, { id: 1 }, { id: 'a', title: 'ok', body: 7, tags: 3 }])); location.reload(); });
    await page.waitForSelector('#list .item');
    assert.strictEqual(await page.$$eval('#list .item', l => l.length), 1);
    await click('#clear'); assert.strictEqual((await saved()).length, 0);
    assert.deepStrictEqual(errors, []);
    await page.close();
}

// ---------- RSVP ----------
{
    const { page, errors } = await openPage(browser, 'reading/rsvp-reader.html');
    await page.evaluate(() => { const s = document.querySelector('#src'); s.value = '今天天氣很好，我們去公園散步。 Hello world'; const w = document.querySelector('#wpm'); w.value = 1000; w.dispatchEvent(new Event('input')); document.querySelector('#go').click(); });
    await page.waitForFunction(() => document.querySelector('#msg').textContent.startsWith('7 / 7'), { timeout: 8000 });
    assert.ok((await page.$eval('#stage', e => e.textContent)).includes('world'));
    assert.strictEqual(await page.$eval('#go', e => e.textContent), '再讀一次');
    assert.deepStrictEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('ok  o10 e2e');
