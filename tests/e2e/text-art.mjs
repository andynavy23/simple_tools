// 程式碼截圖 / ASCII 文字：畫面有畫出來、輸出尺寸合理、手機不橫向溢出、PNG 能產生
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/text-art.html');
    const over = () => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    // 截圖：預設有畫出內容（不是全透明）
    const px = await page.evaluate(() => { const c = document.querySelector('#shotView'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return [c.width, c.height, n]; });
    assert.ok(px[0] === 760 && px[1] > 100 && px[2] > px[0] * px[1] / 2, '截圖有畫出來 ' + px);
    assert.ok(await page.evaluate(() => document.querySelector('#shotMsg').textContent.includes('JavaScript')), '自動偵測語言');
    assert.ok((await over()) <= 1, '截圖頁溢出');
    // 超長程式碼：提示而不是壞掉
    await page.evaluate(() => { const t = document.querySelector('#code'); t.value = 'x\n'.repeat(450); t.dispatchEvent(new Event('input')); document.querySelector('#fs').value = 24; document.querySelector('#fs').dispatchEvent(new Event('input')); });
    assert.ok(await page.evaluate(() => /太大|500/.test(document.querySelector('#shotMsg').textContent)), '超大提示');
    // 純色 / 透明背景不丟例外
    await page.evaluate(() => { document.querySelector('#code').value = 'a'; for (const v of ['solid', 'none']) { const s = document.querySelector('#bg'); s.value = v; s.dispatchEvent(new Event('input')); } });
    // ASCII
    await page.evaluate(() => document.querySelector('#tabAscii').click());
    const out = await page.evaluate(() => document.querySelector('#asciiOut').textContent);
    assert.ok(out.includes('#') && out.split('\n').length === 7, 'Banner 7 行');
    await page.evaluate(() => { const s = document.querySelector('#afont'); s.value = 'small'; s.dispatchEvent(new Event('input')); });
    assert.equal(await page.evaluate(() => document.querySelector('#asciiOut').textContent.split('\n').length), 3);
    await page.evaluate(() => { const t = document.querySelector('#atext'); t.value = 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(3); t.dispatchEvent(new Event('input')); });
    assert.ok((await over()) <= 1, 'ASCII 長文字溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('ok  text-art e2e');
