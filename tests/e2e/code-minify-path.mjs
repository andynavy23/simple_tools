// code-minify：SVG path 視覺化（解析清單、畫布、拖曳改寫 d、捲動頁面切換）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/code-minify.html');
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const val = (s) => page.evaluate((s) => document.querySelector(s).value, s);
    await page.evaluate(() => { document.querySelector('#pathBox').open = true; });
    await click('#pSample');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#pList li').length), 9);
    assert.match(await page.evaluate(() => document.querySelector('#pList li:nth-child(2)').textContent), /C .*三次貝茲曲線/);
    assert.equal(await page.evaluate(() => document.querySelector('#pErr').textContent), '');
    // 畫布有畫出東西
    assert.ok(await page.evaluate(() => { const c = document.querySelector('#pCv'); return c.width > 100 && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0); }));
    // 拖曳第 2 條（C）的終點：d 即時改寫，且變成絕對座標
    const before = await val('#pD');
    await page.evaluate(() => document.querySelector('#pCv').scrollIntoView({ block: 'center' }));
    const pos2 = await page.evaluate(() => { const r = document.querySelector('#pCv').getBoundingClientRect(), v = pv.view, q = pv.lays[1].pts.find(p => p.kind === 'end'); return { x: r.left + q.x * v.s + v.ox, y: r.top + q.y * v.s + v.oy }; });
    await page.mouse.move(pos2.x, pos2.y); await page.mouse.down(); await page.mouse.move(pos2.x + 20, pos2.y + 15, { steps: 4 }); await page.mouse.up();
    const after = await val('#pD');
    assert.notEqual(after, before); assert.match(after, /^M20 80 C/);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#pList li').length), 9);          // 指令數不變
    // 「捲動頁面」模式：拖曳不改 d，畫布 touch-action 恢復
    await click('#pMode');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#pCv')).touchAction), 'auto');
    await page.mouse.move(pos2.x + 20, pos2.y + 15); await page.mouse.down(); await page.mouse.move(pos2.x + 60, pos2.y + 40, { steps: 3 }); await page.mouse.up();
    assert.equal(await val('#pD'), after);
    await click('#pMode'); assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#pCv')).touchAction), 'none');
    // 錯誤輸入
    await page.evaluate(() => { const t = document.querySelector('#pD'); t.value = 'M 0 0 L 10 10 X 5'; t.dispatchEvent(new Event('input')); });
    assert.match(await page.evaluate(() => document.querySelector('#pErr').textContent), /不是路徑指令/);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#pList li').length), 2);
    await page.evaluate(() => { const t = document.querySelector('#pD'); t.value = ''; t.dispatchEvent(new Event('input')); });
    assert.equal(await page.evaluate(() => document.querySelectorAll('#pList li').length), 0);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('code-minify-path OK');
