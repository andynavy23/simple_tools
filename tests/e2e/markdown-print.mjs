// markdown-preview：列印 / 存 PDF（頁名：markdown-preview）— 列印樣式只剩預覽區，程式碼區塊與表格不被切斷
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    for (const mobile of [true, false]) {
        const { page, errors } = await openPage(browser, 'utils/markdown-preview.html', { mobile });
        await page.evaluate(() => { window.__p = 0; window.print = () => { window.__p++; }; document.querySelector('#printBtn').click(); });
        assert.equal(await page.evaluate(() => window.__p), 1, '按鈕呼叫 window.print');
        await page.emulateMediaType('print');
        const r = await page.evaluate(() => {
            const d = (s) => getComputedStyle(document.querySelector(s)).display, pv = document.querySelector('#preview').getBoundingClientRect();
            return { src: d('#src'), srcCard: d('#src').length && getComputedStyle(document.querySelector('#src').closest('.card')).display, tabs: d('.mtabs'), tools: d('#tblCard'), back: d('.back'), pvH: pv.height, pvW: pv.width, pvOverflow: getComputedStyle(document.querySelector('#preview')).overflow,
                pre: getComputedStyle(document.querySelector('#preview pre') || document.body).breakInside, table: getComputedStyle(document.querySelector('#preview table') || document.body).breakInside, bar: d('.two .bar') };
        });
        assert.equal(r.src, 'none', JSON.stringify(r)); assert.equal(r.srcCard, 'none'); assert.equal(r.tabs, 'none'); assert.equal(r.tools, 'none'); assert.equal(r.back, 'none'); assert.equal(r.bar, 'none');
        assert.ok(r.pvH > 50 && r.pvW > 100, '預覽區可見：' + JSON.stringify(r)); assert.equal(r.pvOverflow, 'visible');
        assert.equal(r.pre, 'avoid'); assert.equal(r.table, 'avoid');
        await page.emulateMediaType('screen');
        assert.deepEqual(errors, []);
    }
} finally { await browser.close(); }
