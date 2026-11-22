// 首頁搜尋：用白話說法（同義詞）在真實畫面上也能找到對的工具；亂打時顯示「你可能想找」而不是空白
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'index.html');
    const search = async (q) => {
        await page.evaluate((q) => { const i = document.querySelector('#q'); i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); }, q);
        await new Promise(r => setTimeout(r, 150));
        return page.evaluate(() => ({ hrefs: [...document.querySelectorAll('#view a.item')].map(a => a.getAttribute('href')), empty: !!document.querySelector('#empty'), text: document.querySelector('#view').textContent }));
    };
    for (const q of ['兩個時間相減', '兩個日期差幾天', '日期相減', '相減', '算天數']) {
        const r = await search(q); assert.ok(r.hrefs.slice(0, 3).includes('utils/date-calc.html'), `「${q}」前 3 名應有日期計算機：${r.hrefs.slice(0, 3)}`);
    }
    let r = await search('zzzz不存在的東西');
    assert.equal(r.hrefs.length, 0); assert.ok(r.empty, '完全找不到時要顯示說明');
    // 打錯字：沒有直接結果，但有「你可能想找」
    r = await search('發漂'); assert.ok(r.hrefs.includes('utils/lottery-check.html'), '打錯字的建議：' + r.hrefs.slice(0, 4));
    assert.match((await page.evaluate(() => document.querySelector('#q').placeholder)), /日期相減/);
    assert.deepEqual(errors, []);
    console.log('home-search-natural ok');
} finally { await browser.close(); }
