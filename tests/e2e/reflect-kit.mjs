// reflect-kit：OKR 新增 / 更新 / 刪除、每週回顧儲存與搜尋、決策矩陣輸入後即時算分；time-tracker 上下班工時；390px 不橫向溢出、無例外
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const noOverflow = (page) => ev(page, () => document.documentElement.scrollWidth <= innerWidth);

{
    const { page, errors } = await openPage(browser, 'utils/reflect-kit.html');
    await ev(page, () => { window.confirm = () => true; window.prompt = (m, d) => '7'; });
    // OKR
    await ev(page, () => { document.querySelector('#oTitle').value = '體能'; });
    await click(page, '#oAdd');
    await ev(page, () => { const c = document.querySelector('#oList .card'); c.querySelector('.kn').value = '跑步'; c.querySelector('.kt').value = '10'; c.querySelector('[data-act=kradd]').click(); });
    await ev(page, () => document.querySelector('#oList [data-act=upd]').click()); // prompt → 7
    assert.ok((await ev(page, () => document.querySelector('#oList').textContent)).includes('70%'));
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.reflect_okr)[0].krs[0].hist.length), 1);
    await ev(page, () => document.querySelector('#oList [data-act=odel]').click());
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.reflect_okr).length), 0);
    // 每週回顧
    await click(page, '#tabs [data-t=weekly]');
    await ev(page, () => { document.querySelector('#wq-done').value = '完成測試'; document.querySelector('#wEn').value = '4'; });
    await click(page, '#wSave');
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.reflect_weekly).entries.length), 1);
    await ev(page, () => { const q = document.querySelector('#wQ'); q.value = '完成'; q.oninput(); });
    assert.ok((await ev(page, () => document.querySelector('#wHist').textContent)).includes('完成測試'));
    await ev(page, () => { const q = document.querySelector('#wQ'); q.value = 'zzz'; q.oninput(); });
    assert.ok((await ev(page, () => document.querySelector('#wHist').textContent)).includes('沒有符合'));
    await click(page, '#wDel');
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.reflect_weekly).entries.length), 0);
    // 決策矩陣
    await click(page, '#tabs [data-t=dec]');
    await click(page, '#dNew');
    await ev(page, () => { document.querySelector('#dOpt').value = 'A'; document.querySelector('#dOptAdd').click(); document.querySelector('#dOpt').value = 'B'; document.querySelector('#dOptAdd').click(); document.querySelector('#dCrit').value = '薪水'; document.querySelector('#dCritAdd').click(); });
    await ev(page, () => {
        for (const [i, v] of [[0, 9], [1, 4]]) { const el = document.querySelectorAll('#dMx input[data-f=s]')[i]; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    const res = await ev(page, () => document.querySelector('#dRes').textContent);
    assert.ok(res.includes('A（最佳）'), res);
    assert.ok(await noOverflow(page), '橫向溢出');
    await click(page, '#dDel');
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.reflect_decision).length), 0);
    assert.deepStrictEqual(errors, []);
}
{
    const { page, errors } = await openPage(browser, 'utils/time-tracker.html');
    await ev(page, () => { window.confirm = () => true; });
    await ev(page, () => { document.querySelector('#wIn').value = '09:00'; document.querySelector('#wOut').value = '19:00'; });
    await click(page, '#wSave');
    const txt = await ev(page, () => document.querySelector('#wStats').textContent);
    assert.ok(txt.includes('9:00') && txt.includes('1:00'), txt); // 工時 9:00、加班 1:00
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.tt_workdays).days.length), 1);
    assert.ok(await noOverflow(page), '橫向溢出');
    await ev(page, () => document.querySelector('#wList [data-act=wdel]').click());
    assert.strictEqual(await ev(page, () => JSON.parse(localStorage.tt_workdays).days.length), 0);
    assert.deepStrictEqual(errors, []);
}
await browser.close();
console.log('ok  reflect-kit e2e');
