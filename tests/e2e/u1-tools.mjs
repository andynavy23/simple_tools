// u1：手把分頁（假 Gamepad）、計分板的計數器 / 羽球、21 點策略練習 的畫面行為與 390px 不溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const noOverflow = (page) => ev(page, () => document.documentElement.scrollWidth <= innerWidth + 1);

// ---- 手把 ----
{
    const { page, errors } = await openPage(browser, 'utils/screen-test.html');
    await ev(page, () => {
        window.__pad = { index: 0, id: 'Fake Pad (Vendor: 1)', mapping: 'standard', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0.05, 0, 0.8, -0.8] };
        navigator.getGamepads = () => [window.__pad, null, null, null];
    });
    await click(page, '.tabs button[data-t=pad]'); await sleep(200);
    assert.ok(await ev(page, () => document.querySelector('#gpBox').hidden === false), '偵測到手把後顯示面板');
    await ev(page, () => { __pad.buttons[0] = { pressed: true, value: 1 }; __pad.buttons[7] = { pressed: false, value: 0.5 }; });
    await sleep(200);
    assert.ok(await ev(page, () => document.querySelector('#gpBtns').children[0].classList.contains('hit')), 'A 鍵亮起');
    assert.ok((await ev(page, () => document.querySelector('#gpAxes').textContent)).includes('0: 0.00'), '死區內軸值顯示 0');
    assert.ok(await ev(page, () => document.querySelector('#gpVib').disabled), '無震動器時停用');
    assert.ok(await noOverflow(page), '手把分頁不橫向溢出');
    await ev(page, () => { navigator.getGamepads = () => [null, null, null, null]; }); await sleep(200);
    assert.ok(await ev(page, () => document.querySelector('#gpBox').hidden), '拔除後回到說明');
    assert.deepStrictEqual(errors, []); await page.close();
}

// ---- 計分板：計數器 / 羽球 ----
{
    const { page, errors } = await openPage(browser, 'fun/scoreboard.html');
    await ev(page, () => { window.confirm = () => true; window.alert = () => { }; });
    await click(page, '[data-m=count]');
    await click(page, '.cgrp .acts button:nth-child(2)'); await click(page, '.cgrp .acts button:nth-child(2)');
    assert.strictEqual(await ev(page, () => document.querySelector('.cgrp .cn').textContent), '2');
    await ev(page, () => { document.querySelector('#cname').value = '女生'; }); await click(page, '#cadd');
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.cgrp').length), 2);
    for (let i = 0; i < 15; i++) { await ev(page, (i) => { document.querySelector('#cname').value = 'g' + i; }, i); await click(page, '#cadd'); }
    assert.strictEqual(await ev(page, () => document.querySelectorAll('.cgrp').length), 12, '上限 12 組');
    assert.ok(await noOverflow(page));
    await page.reload(); await ev(page, () => { window.confirm = () => true; });
    await click(page, '[data-m=count]');
    assert.strictEqual(await ev(page, () => document.querySelector('.cgrp .cn').textContent), '2', '重新載入保留數值');
    await click(page, '#cclear'); assert.strictEqual(await ev(page, () => document.querySelectorAll('.cgrp').length), 1);

    await click(page, '[data-m=bad]');
    for (let i = 0; i < 21; i++) await click(page, '#bp0');
    assert.ok((await ev(page, () => document.querySelector('#binfo').textContent)).includes('換邊'));
    await click(page, '#bundo'); assert.strictEqual(await ev(page, () => document.querySelector('#bp0').firstChild.textContent), '20');
    assert.ok(await noOverflow(page));
    assert.deepStrictEqual(errors, []); await page.close();
}

// ---- 21 點策略練習 ----
{
    const { page, errors } = await openPage(browser, 'mini-games/blackjack.html');
    await ev(page, () => { window.confirm = () => true; });
    await click(page, '#drillBtn');
    for (let i = 0; i < 6; i++) {
        const right = await ev(page, () => bjStrategy(drHand, drUp, document.querySelector('#dSurr').checked));
        await ev(page, (a) => document.querySelector(`#dAct button[data-a=${a}]`).click(), right);
        assert.ok((await ev(page, () => document.querySelector('#dMsg').textContent)).startsWith('答對'));
        await click(page, '#dNext');
    }
    assert.deepStrictEqual(await ev(page, () => DR.all), [6, 6]);
    assert.ok(await noOverflow(page));
    await click(page, '#dClear'); assert.deepStrictEqual(await ev(page, () => DR.all), [0, 0]);
    assert.deepStrictEqual(errors, []); await page.close();
}
await browser.close();
console.log('ok u1-tools');
