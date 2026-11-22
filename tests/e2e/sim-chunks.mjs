// 抽獎 / 機率類工具的「模擬」：lottery-check（分批、可中止、種子可重現、期數上限）、artale-calc、骰子、轉盤；頁面在模擬中仍可回應
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();

// ---- lottery-check ----
{
    const { page, errors } = await openPage(browser, 'utils/lottery-check.html');
    const q = (s) => page.evaluate((s) => document.querySelector(s)?.textContent ?? '', s);
    await page.evaluate(() => document.querySelector('.tabs [data-t=sim]').click());
    assert.ok(await page.evaluate(() => document.querySelector('#check').hidden), '模擬分頁隱藏對獎鈕');
    // 上限檢查
    await page.evaluate(() => { document.querySelector('#smN').value = '1000001'; document.querySelector('#smGo').click(); });
    assert.ok((await q('#err')).includes('1,000,000'), '超過上限要提示');
    // 一百萬期：進度出現、頁面不被卡住（計時器持續觸發）、可中止
    await page.evaluate(() => { document.querySelector('#smG').value = 'big'; document.querySelector('#smN').value = '1000000'; document.querySelector('#smSeed').value = 'e2e'; document.querySelector('#smGo').click(); window.__ticks = 0; window.__gap = 0; let last = performance.now(); window.__iv = setInterval(() => { const n = performance.now(); window.__gap = Math.max(window.__gap, n - last); last = n; window.__ticks++; }, 20); });
    await new Promise(r => setTimeout(r, 70));
    const mid = await page.evaluate(() => ({ prog: document.querySelector('#smProg').textContent, stopShown: !document.querySelector('#smStop').hidden, goHidden: document.querySelector('#smGo').hidden, ticks: window.__ticks, gap: window.__gap }));
    assert.ok(mid.prog.includes('模擬中') && mid.stopShown && mid.goHidden, JSON.stringify(mid));
    assert.ok(mid.ticks >= 1 && mid.gap < 400, `頁面被卡住：ticks=${mid.ticks} gap=${mid.gap}`);
    await page.evaluate(() => document.querySelector('#smStop').click());
    const stopped = await page.evaluate(() => { clearInterval(window.__iv); return { sum: document.querySelector('#smSum').textContent, rows: document.querySelectorAll('#smOut .res').length, warn: document.querySelector('#smOut').textContent.includes('長期必虧'), go: !document.querySelector('#smGo').hidden, card: !document.querySelector('#simCard').hidden }; });
    assert.ok(stopped.sum.includes('已中止') && stopped.rows >= 10 && stopped.warn && stopped.go && stopped.card, JSON.stringify(stopped));
    const nDone = Number(stopped.sum.match(/([\d,]+) 期/)[1].replace(/,/g, ''));
    assert.ok(nDone > 0 && nDone < 1000000, '中止時只跑了一部分：' + nDone);
    // 同種子同期數 → 結果文字完全相同
    const runOnce = async () => {
        await page.evaluate(() => { document.querySelector('#smG').value = 'd5'; document.querySelector('#smG').onchange(); document.querySelector('#smN').value = '20000'; document.querySelector('#smSeed').value = 'same'; document.querySelector('#smGo').click(); });
        await page.waitForFunction(() => document.querySelector('#smSum').textContent.startsWith('完成'), { timeout: 20000 });
        return page.evaluate(() => document.querySelector('#smOut').textContent + document.querySelector('#smSum').textContent);
    };
    const a = await runOnce(), b = await runOnce();
    assert.equal(a, b, '同種子應重現');
    assert.ok(a.includes('報酬率') && a.includes('理論') && a.includes('淨損益'));
    // 發票：免費
    await page.evaluate(() => { document.querySelector('#smG').value = 'inv'; document.querySelector('#smG').onchange(); document.querySelector('#smN').value = '5000'; document.querySelector('#smGo').click(); });
    await page.waitForFunction(() => document.querySelector('#smSum').textContent.includes('5,000'), { timeout: 20000 });
    assert.ok((await q('#smOut')).includes('平均每張獎金'));
    // 不存 localStorage
    assert.ok(await page.evaluate(() => Object.keys(localStorage).every(k => k === 'lc_tab')), '模擬不應寫入 localStorage');
    const ov = await page.evaluate(() => document.scrollingElement.scrollWidth <= document.scrollingElement.clientWidth);
    assert.ok(ov, '橫向溢出');
    assert.deepEqual(errors, []);
}

// ---- artale-calc ----
{
    const { page, errors } = await openPage(browser, 'game-assist/artale-calc.html');
    for (const [id, tab] of [['sim1', 'pScroll'], ['sim3', 'pGacha']]) {
        await page.evaluate((t) => document.querySelector(`#tabs [data-t=${t}]`).click(), tab);
        await page.evaluate((id) => { const h = document.querySelector('#' + id); h.querySelector('.n').value = '5000'; h.querySelector('.seed').value = 's'; h.querySelector('.go').click(); }, id);
        await page.waitForFunction((id) => document.querySelector('#' + id + ' .msg').textContent.startsWith('完成'), { timeout: 20000 }, id);
        const t = await page.evaluate((id) => document.querySelector('#' + id + ' .res').textContent, id);
        assert.ok(t.includes('理論') && t.includes('平均'), t.slice(0, 80));
    }
    assert.deepEqual(errors, []);
}

// ---- 骰子 / 轉盤 ----
for (const [file, go, msg] of [['fun/dice.html', '#simGo', '#simMsg'], ['fun/wheel.html', '#simGo', '#simMsg']]) {
    const { page, errors } = await openPage(browser, file);
    await page.evaluate(() => { document.querySelector('#simCnt').value = '30000'; document.querySelector('#simGo').click(); });
    await page.waitForFunction((m) => /完成|平均總和/.test(document.querySelector(m).textContent), { timeout: 20000 }, msg);
    const t = await page.evaluate(() => document.querySelector('#simMsg').textContent + document.body.innerText.includes('理論'));
    assert.ok(t.length > 3, file);
    assert.deepEqual(errors, []);
}
await browser.close();
console.log('sim-chunks OK');
