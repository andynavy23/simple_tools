// art-studio：各分頁可用、不橫向溢出、存檔上限、壞資料不讓頁面壞
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
{
    const { page, errors } = await openPage(browser, 'fun/art-studio.html');
    await page.evaluate(() => localStorage.setItem('artstudio_pixel', '{"items":[null,{"w":8,"h":8,"d":"x"}]}'));
    await page.reload();
    const ev = (f, ...a) => page.evaluate(f, ...a);
    const tab = (t) => ev((t) => document.querySelector(`#tabs [data-t=${t}]`).click(), t);
    const ovf = () => ev(() => document.scrollingElement.scrollWidth - innerWidth);
    // 像素：在畫布上點一下 → 儲存 → 31 次後被拒
    await ev(() => { const c = document.querySelector('#pCv'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 5, clientY: r.top + 5, pointerId: 1, bubbles: true })); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true })); });
    assert.ok(await ev(() => document.querySelector('#pCv').getContext('2d').getImageData(2, 2, 1, 1).data[3] > 0), '點一下沒有上色');
    await ev(() => { window.confirm = () => true; });
    for (let i = 0; i < 31; i++) await ev(() => { document.querySelector('#pNew').click(); document.querySelector('#pSave').click(); });
    assert.ok((await ev(() => JSON.parse(localStorage.artstudio_pixel).items.length)) <= 30, '作品超過上限');
    assert.equal(await ev(() => document.querySelectorAll('#pGal .gal>div, #pGal>div').length), 30);
    await ev(() => { window.confirm = () => false; document.querySelector('#pGal [data-d]').click(); });   // 取消就不應刪除
    assert.equal(await ev(() => JSON.parse(localStorage.artstudio_pixel).items.length), 30);
    // 動畫：幀數上限
    await tab('flip');
    for (let i = 0; i < 65; i++) await ev(() => document.querySelector('#fDup').click());
    assert.equal(await ev(() => document.querySelectorAll('#fStrip button').length), 60);
    await ev(() => document.querySelector('#fSave').click());
    assert.equal(await ev(() => JSON.parse(localStorage.artstudio_flip).items[0].frames.length), 60);
    // 曼陀羅 / 生成 / 文字雲
    await tab('man'); await tab('gen');
    assert.ok(await ev(() => document.querySelector('#gCv').getContext('2d').getImageData(400, 400, 1, 1).data[3] === 255));
    await tab('cloud');
    await ev(() => { document.querySelector('#cText').value = '程式設計 程式設計 很有趣 hello world hello'; document.querySelector('#cGo').click(); });
    assert.match(await ev(() => document.querySelector('#cInfo').textContent), /共 \d+ 個詞/);
    assert.ok((await ovf()) <= 0, '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('art-studio OK');
