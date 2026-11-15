import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
// 列印日曆
{
    const { page, errors } = await openPage(browser, 'utils/tw-holidays.html');
    const ev = (f, ...a) => page.evaluate(f, ...a);
    await ev(() => document.querySelector('.tabs button[data-t="print"]').click());
    assert.equal(await ev(() => document.querySelector('#pArea').hidden), false);
    assert.equal(await ev(() => document.querySelectorAll('#pArea .pm').length), 12);
    await ev(() => { const s = document.querySelector('#pscope'); s.value = 'month'; s.dispatchEvent(new Event('change')); });
    assert.equal(await ev(() => document.querySelectorAll('#pArea .pm').length), 1);
    await ev(() => { const c = document.querySelector('#plun'); c.checked = true; c.dispatchEvent(new Event('change')); });
    assert.ok(await ev(() => document.querySelectorAll('#pArea .c i').length) > 20, '農曆日');
    await ev(() => {
        const d = document.querySelector('#mDate'), t = document.querySelector('#mText');
        const m = document.querySelector('#pmo').value, y = document.querySelector('#py').value;
        d.value = y + '-' + String(m).padStart(2, '0') + '-10'; t.value = '測試標記';
        document.querySelector('#mAdd').click();
    });
    assert.equal(await ev(() => document.querySelectorAll('#mList .li2').length), 1);
    assert.ok(await ev(() => document.querySelector('#pArea').textContent.includes('測試標記')));
    assert.equal(await ev(() => JSON.parse(localStorage.getItem('twhol_marks')).length), 1);
    await ev(() => document.querySelector('#mList .li2 button').click());
    assert.equal(await ev(() => document.querySelectorAll('#mList .li2').length), 0);
    const w = await ev(() => [document.scrollingElement.scrollWidth, innerWidth]);
    assert.ok(w[0] <= w[1], '橫向捲動 ' + w);
    assert.deepEqual(errors, []);
}
// 會議成本
{
    const { page, errors } = await openPage(browser, 'utils/biz-calc.html');
    const ev = (f, ...a) => page.evaluate(f, ...a);
    await ev(() => document.querySelector('#tabs button[data-i="4"]').click());
    assert.equal(await ev(() => document.querySelector('#p4').hidden), false);
    assert.ok((await ev(() => document.querySelector('#o_mtg').textContent)).includes('每小時總成本'));
    await ev(() => document.querySelector('#tkGo').click());
    await new Promise(r => setTimeout(r, 1300));
    await ev(() => document.querySelector('#tkGo').click());
    const t = await ev(() => document.querySelector('#tkTime').textContent);
    assert.ok(t !== '00:00:00', '計時應前進 ' + t);
    await ev(() => document.querySelector('#tkRst').click());
    assert.equal(await ev(() => document.querySelector('#tkTime').textContent), '00:00:00');
    assert.deepEqual(errors, []);
}
await browser.close();
console.log('v4-extensions OK');
