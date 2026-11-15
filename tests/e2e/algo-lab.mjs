// algo-lab：生命遊戲（點畫、單步、圖樣、規則、捲動切換）、排序（單步計數、完成）、數字記憶廣度（simon.html）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const waitFor = (page, fn, ...a) => page.waitForFunction(fn, { timeout: 15000, polling: 100 }, ...a);

{
    const { page, errors } = await openPage(browser, 'utils/algo-lab.html');
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');
    // 點畫一個細胞（真正的 pointer 事件）
    await ev(page, () => {
        const c = document.querySelector('#lfc'), b = c.getBoundingClientRect();
        c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2, pointerId: 1 }));
        c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    });
    assert.equal(await ev(page, () => document.querySelector('#lfPop').textContent), '1');
    await click(page, '#lfStep');   // 單細胞孤立死亡
    assert.equal(await ev(page, () => [document.querySelector('#lfGen').textContent, document.querySelector('#lfPop').textContent].join()), '1,0');
    // 圖樣：閃爍器 3 格，單步後仍 3 格
    await ev(page, () => { const s = document.querySelector('#lfPat'); s.value = '閃爍器'; });
    await click(page, '#lfPlace'); await click(page, '#lfStep');
    assert.equal(await ev(page, () => document.querySelector('#lfPop').textContent), '3');
    // 壞規則被拒、好規則接受
    await ev(page, () => { const r = document.querySelector('#lfRule'); r.value = 'xx'; r.onchange(); });
    assert.ok(await ev(page, () => document.querySelector('#lfErr').textContent.length > 0));
    // 捲動頁面切換
    assert.equal(await ev(page, () => document.querySelector('#lfc').style.touchAction), 'auto');
    await click(page, '#lfScroll');
    assert.equal(await ev(page, () => document.querySelector('#lfc').style.touchAction), 'none');
    // 播放會前進、暫停會停
    await click(page, '#lfScroll'); await click(page, '#lfPlay');
    await waitFor(page, () => +document.querySelector('#lfGen').textContent >= 4);
    await click(page, '#lfPlay');

    // 排序：切分頁、單步計數、跑完
    await click(page, '[data-t=so]');
    assert.ok(await ev(page, () => document.querySelector('#soc').getBoundingClientRect().height > 100));
    await click(page, '#soStep'); await click(page, '#soStep');
    assert.equal(await ev(page, () => +document.querySelector('#soC').textContent + +document.querySelector('#soS').textContent + +document.querySelector('#soW').textContent), 2);
    await ev(page, () => { document.querySelector('#soSpeed').value = 100; });
    await click(page, '#soPlay');
    await waitFor(page, () => document.querySelector('#soPlay').textContent === '開始' && +document.querySelector('#soC').textContent > 20);
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
}

{
    const { page, errors } = await openPage(browser, 'mini-games/simon.html');
    await click(page, '[data-m=digit]');
    assert.ok(await ev(page, () => document.querySelector('#colorGame').hidden && !document.querySelector('#digitGame').hidden));
    await click(page, '#dStart');
    await waitFor(page, () => !document.querySelector('#dIn').hidden);
    // 答錯兩次結束（用確定不對的答案）
    await ev(page, () => { document.querySelector('#dAns').value = 'zzz'; });
    await click(page, '#dOk');
    assert.equal(await ev(page, () => document.querySelector('#dLife').textContent), '1');
    await waitFor(page, () => !document.querySelector('#dIn').hidden);
    await ev(page, () => { document.querySelector('#dAns').value = 'zzz'; });
    await click(page, '#dOk');
    assert.ok(await ev(page, () => !document.querySelector('#dStart').hidden && document.querySelector('#dStart').textContent === '再來一次'));
    // 答對一次後最佳長度寫入並可清除
    await click(page, '#dStart');
    await waitFor(page, () => !document.querySelector('#dIn').hidden);
    await ev(page, () => { document.querySelector('#dAns').value = '0'; }); // 先看答案：用頁面內 dSeq
    await ev(page, () => { document.querySelector('#dAns').value = dSeq.join(''); });
    await click(page, '#dOk');
    assert.equal(await ev(page, () => localStorage.getItem('simon_digit_digit')), '3');
    await ev(page, () => { window.confirm = () => true; });
    await Promise.all([page.waitForNavigation(), click(page, '#clearBest')]);
    assert.equal(await ev(page, () => localStorage.getItem('simon_digit_digit')), null);
    assert.deepEqual(errors, []);
}
await browser.close();
