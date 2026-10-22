// css-gen：「版面」分頁（Flexbox / Grid 視覺化）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/css-gen.html');
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const set = (id, v) => page.evaluate((id, v) => { const e = document.querySelector('#f_' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, id, v);

    await click('[data-t=layout]');
    assert.ok(await page.evaluate(() => !document.querySelector('#lay').hidden && document.querySelector('#box').hidden), '版面預覽沒有顯示');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#lay .li').length), 5);
    assert.match(await text('#css'), /display: flex;[\s\S]*flex-direction: row;/);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#lay')).display), 'flex');

    // 改 flex 屬性：預覽的實際樣式與輸出文字一起變
    await set('dir', 'column'); await set('jc', 'center');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#lay')).flexDirection), 'column');
    assert.match(await text('#css'), /flex-direction: column;[\s\S]*justify-content: center;/);
    await set('wrap', 'wrap');                                                 // 換行後才有 align-content
    assert.match(await text('#css'), /align-content: stretch;/);
    assert.ok(await page.evaluate(() => !!document.querySelector('#f_ac')));

    // 項目數與選取項目
    await set('n', 8); assert.equal(await page.evaluate(() => document.querySelectorAll('#lay .li').length), 8);
    await page.evaluate(() => document.querySelectorAll('#lay .li')[2].click());                      // 點預覽方塊選第 3 個
    assert.equal(await page.evaluate(() => document.querySelector('#f_sel').value), '3');
    await set('i_grow', 2); await set('i_order', -1);
    assert.match(await text('#css'), /\.item:nth-child\(3\) \{\n  flex-grow: 2;\n  order: -1;\n\}/);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelectorAll('#lay .li')[2]).flexGrow), '2');
    await set('n', 2);                                                          // 項目數縮到 2：選取項目跟著夾到 2，第 3 項的設定不再輸出
    assert.equal(await page.evaluate(() => document.querySelector('#f_sel').value), '2');
    assert.ok(!(await text('#css')).includes('nth-child(3)'));

    // 切到 Grid
    await set('mode', 'grid');
    assert.match(await text('#css'), /display: grid;\n  grid-template-columns: repeat\(3, 1fr\);/);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#lay')).display), 'grid');
    await set('n', 6); await set('cols', '1fr 2fr');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#lay')).gridTemplateColumns.split(' ').length), 2);
    await page.evaluate(() => document.querySelectorAll('#lay .li')[0].click()); await set('i_cs', 2);
    assert.match(await text('#css'), /\.item:nth-child\(1\) \{\n  grid-column: span 2;\n\}/);
    // 不合法的欄值（想夾帶其他宣告）退回預設，預覽與輸出都不受影響
    await set('cols', '1fr; background: red');
    assert.ok(!(await text('#css')).includes('background'));
    assert.ok(await page.evaluate(() => document.querySelector('#lay').style.background === ''));

    // 設定會存在 cssgen：重新載入後還在版面分頁、Grid 模式；壞資料不會讓整頁壞掉
    await page.reload({ waitUntil: 'load' });
    assert.ok(await page.evaluate(() => !document.querySelector('#lay').hidden));
    assert.match(await text('#css'), /display: grid;/);
    await page.evaluate(() => localStorage.setItem('cssgen', JSON.stringify({ tab: 'layout', layout: { mode: 'x', n: 'abc', items: [1, null], cols: 5 } })));
    await page.reload({ waitUntil: 'load' });
    assert.match(await text('#css'), /display: flex;/);
    await page.evaluate(() => localStorage.setItem('cssgen', 'not json'));
    await page.reload({ waitUntil: 'load' });
    assert.ok((await text('#css')).length > 0);
    // 舊分頁照常運作
    await click('[data-t=shadow]'); assert.match(await text('#css'), /box-shadow:/);
    assert.ok(await page.evaluate(() => !document.querySelector('#box').hidden && document.querySelector('#lay').hidden));
    await click('[data-t=layout]');
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('css-gen OK');
