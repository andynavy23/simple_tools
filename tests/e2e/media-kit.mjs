// media-kit：影片轉音訊（程式合成 WAV）、播放器、視覺化、章節、GIF、規格表、無例外
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/media-kit.html');
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    // 在頁面內合成 1 秒 440Hz 立體聲 WAV，塞進 file input
    const feed = (id, name, kind) => page.evaluate(async (id, name, kind) => {
        let f;
        if (kind === 'wav') {
            const n = 44100, l = new Float32Array(n), r = new Float32Array(n);
            for (let i = 0; i < n; i++) l[i] = r[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
            f = new File([wavEncode([l, r], 44100)], name, { type: 'audio/wav' });
        } else if (kind === 'gif') {
            const b = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
            f = new File([b], name, { type: 'image/gif' });
        } else f = new File(['WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n字幕一\n'], name, { type: 'text/vtt' });
        const dt = new DataTransfer(); dt.items.add(f); const e = document.getElementById(id); e.files = dt.files; e.dispatchEvent(new Event('change'));
    }, id, name, kind);
    const wait = (fn, arg) => page.waitForFunction(fn, { timeout: 8000 }, arg);

    // 影片轉音訊
    await feed('v2aFile', 't.wav', 'wav');
    await wait(() => !document.getElementById('v2aGo').disabled);
    assert.match(await text('#v2aInfo'), /記憶體/);
    await click('#v2aGo');
    await wait(() => !document.getElementById('v2aDl').disabled);
    assert.match(await text('#v2aInfo'), /完成：00:01、44100 Hz、2 聲道/);
    await page.evaluate(() => document.getElementById('v2aMono').click()); await click('#v2aGo');
    await wait(() => /1 聲道/.test(document.getElementById('v2aInfo').textContent));

    // 播放器
    await click('[data-t=play]');
    await feed('plFile', 't.wav', 'wav'); await feed('plSub', 's.vtt', 'vtt');
    await wait(() => /已載入 1 行/.test(document.getElementById('plSubT').textContent));
    await wait(() => document.getElementById('plV').duration > 0);
    await page.evaluate(() => { const v = document.getElementById('plV'); v.currentTime = 0.5; });
    await click('#plA'); await page.evaluate(() => { document.getElementById('plV').currentTime = 0.8; });
    await click('#plB');
    assert.match(await text('#plABt'), /A 00:00　B 00:00/);
    await page.evaluate(() => { const r = document.getElementById('plRate'); r.value = 0.5; r.dispatchEvent(new Event('input')); });
    assert.equal(await page.evaluate(() => document.getElementById('plV').playbackRate), 0.5);
    assert.equal(await text('#plRateT'), '0.50×');
    const t0 = await page.evaluate(() => document.getElementById('plV').currentTime);
    await click('#plNext');
    assert.ok(await page.evaluate((t0) => Math.abs(document.getElementById('plV').currentTime - t0 - 1 / 30) < 0.005, t0));
    await click('#plMirror');
    assert.equal(await page.evaluate(() => document.getElementById('plV').style.transform), 'scaleX(-1)');
    await page.evaluate(() => { document.getElementById('plV').currentTime = 1; });
    await wait(() => document.getElementById('cue').textContent === '字幕一');

    // 視覺化（不播放，只確認載入與樣式切換不出錯）
    await click('[data-t=viz]');
    await feed('vzFile', 't.wav', 'wav');
    await wait(() => document.getElementById('vzA').src.startsWith('blob:'));

    // 語音轉文字：依支援度顯示控制項或僅說明
    await click('[data-t=stt]');
    const sup = await page.evaluate(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    assert.equal(await page.evaluate(() => document.getElementById('sttCtl').hidden), !sup);
    assert.ok((await text('#sttInfo')).length > 10);

    // 章節
    await click('[data-t=chap]');
    await page.evaluate(() => { const t = document.getElementById('chIn'); t.value = '0:05 a\n0:08 b'; t.dispatchEvent(new Event('input')); });
    assert.match(await text('#chIssues'), /00:00/);
    await page.evaluate(() => { const t = document.getElementById('chIn'); t.value = '0:00 開場\n0:45 第一章\n3:10 第二章'; t.dispatchEvent(new Event('input')); });
    assert.match(await text('#chIssues'), /檢查通過/);
    assert.equal(await text('#chOut'), '00:00 開場\n00:45 第一章\n03:10 第二章');

    // GIF
    await click('[data-t=gif]');
    await feed('gifFile', 'a.gif', 'gif');
    const hasDec = await page.evaluate(() => 'ImageDecoder' in window);
    if (hasDec) { await wait(() => /共 1 格/.test(document.getElementById('gifInfo').textContent)); await wait(() => /第 1 \/ 1 格/.test(document.getElementById('gifFr').textContent)); }
    else assert.match(await text('#gifInfo'), /不支援 ImageDecoder/);

    // 規格
    await click('[data-t=spec]');
    assert.ok(await page.evaluate(() => document.querySelectorAll('#specTb tr').length) > 10);
    assert.equal(await text('#rOut'), '16:9');
    assert.match(await text('#sOut'), /57\.2 MB/);

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '橫向溢出');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
