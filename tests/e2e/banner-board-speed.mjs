// 迷你看板跑馬燈：速度以「每秒幾個字」計，可微調、有預設鈕、有字級；舊設定自動換算；實際動畫時間與設定一致
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/banner-board.html');
    const ev = (fn, ...a) => page.evaluate(fn, ...a);
    const setText = (t) => ev((t) => { const i = document.querySelector('#text'); i.value = t; i.dispatchEvent(new Event('input', { bubbles: true })); }, t);
    await ev(() => document.querySelector('#tabs [data-m=marquee]').click());
    await setText('歡迎光臨歡迎光臨歡迎光臨');
    const info = () => ev(() => { const t = document.querySelector('#txt'), cs = getComputedStyle(t); return { dur: parseFloat(cs.animationDuration), textW: t.offsetWidth, boxW: document.querySelector('#board').getBoundingClientRect().width, font: parseFloat(cs.fontSize), label: document.querySelector('#speedV').textContent, fs: document.querySelector('#fsV').textContent }; });
    const cps = (m) => (m.boxW + m.textW) / m.dur / m.font;                              // 實際每秒走幾個字寬

    // 預設值與 UI 範圍
    assert.deepEqual(await ev(() => { const r = document.querySelector('#speed'); return [r.min, r.max, r.step]; }), ['0.1', '10', '0.1']);
    const names = await ev(() => [...document.querySelectorAll('#spdPresets button')].map(b => b.textContent));
    assert.deepEqual(names, ['極慢 0.3', '慢 0.6', '普通 1', '快 2', '很快 4']);
    let m = await info(); assert.match(m.label, /0\.8 字\/秒/); assert.ok(Math.abs(cps(m) - 0.8) < 0.02, '預設實際速度 ' + cps(m));

    // 預設鈕：實際動畫速度與設定一致，且越快時間越短
    const durs = [];
    for (const [i, v] of [[0, 0.3], [1, 0.6], [2, 1], [3, 2], [4, 4]]) {
        await ev((i) => document.querySelectorAll('#spdPresets button')[i].click(), i); await new Promise(r => setTimeout(r, 150));
        m = await info(); assert.ok(Math.abs(cps(m) - v) < v * 0.03 + 0.01, `預設 ${v} 實際 ${cps(m).toFixed(3)}`); durs.push(m.dur);
    }
    assert.ok(durs.every((d, i) => i === 0 || d < durs[i - 1]), '速度越快整段時間越短：' + durs);

    // 微調 −0.1 / +0.1，上下限
    await ev(() => document.querySelectorAll('#spdPresets button')[0].click());           // 0.3
    for (let i = 0; i < 5; i++) await ev(() => document.querySelector('#spdDn').click());
    assert.match((await info()).label, /^0\.1 字\/秒/, '下限 0.1');
    await ev(() => document.querySelector('#spdUp').click()); assert.match((await info()).label, /^0\.2 字\/秒/);
    await ev(() => { const r = document.querySelector('#speed'); r.value = 10; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await ev(() => document.querySelector('#spdUp').click()); assert.match((await info()).label, /^10 字\/秒/, '上限 10');

    // 字級：調小後字變小，同樣的每秒字數下整段時間仍符合設定
    await ev(() => document.querySelectorAll('#spdPresets button')[2].click());
    const big = await info();
    await ev(() => { const r = document.querySelector('#fscale'); r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise(r => setTimeout(r, 200));
    const small = await info(); assert.match(small.fs, /30%/); assert.ok(small.font < big.font * 0.7, '字級變小');
    assert.ok(Math.abs(cps(small) - 1) < 0.03, '字級改變後每秒字數仍是 1：' + cps(small));

    // 重新載入：設定記住；舊版 speed 設定自動換算（speed 5 → 0.9 字/秒）
    await page.reload({ waitUntil: 'load' });
    await ev(() => document.querySelector('#tabs [data-m=marquee]').click());
    m = await info(); assert.match(m.label, /^1 字\/秒/); assert.match(m.fs, /30%/);
    await ev(() => localStorage.setItem('banner_opts', JSON.stringify({ mode: 'marquee', text: '舊設定', speed: 5 })));
    await page.reload({ waitUntil: 'load' });
    m = await info(); assert.match(m.label, /^0\.9 字\/秒/, '舊 speed 5 → 0.9：' + m.label);
    // 壞資料不壞頁
    await ev(() => localStorage.setItem('banner_opts', '{"cps":"abc","fs":null,"speed":{}}'));
    await page.reload({ waitUntil: 'load' });
    m = await info(); assert.match(m.label, /0\.8 字\/秒/);
    assert.deepEqual(errors, []);
    console.log('banner-board-speed ok');
} finally { await browser.close(); }
