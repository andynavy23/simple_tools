// image-fx：程式產生測試圖 → 各分頁渲染不出錯、ASCII 輸出、對比滑桿、漸層尺寸、日期水印、無橫向溢出；color-tools 圖片主色
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/image-fx.html');
    const put = (sel, w, h) => page.evaluate(async (sel, w, h) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
        x.fillStyle = '#f00'; x.fillRect(0, 0, w / 2, h); x.fillStyle = '#00f'; x.fillRect(w / 2, 0, w / 2, h);
        const b = await new Promise(r => c.toBlob(r, 'image/png')), dt = new DataTransfer(); dt.items.add(new File([b], 't.png', { type: 'image/png' }));
        const i = document.querySelector(sel); i.files = dt.files; i.dispatchEvent(new Event('change'));
    }, sel, w, h);
    const tab = (k) => page.evaluate((k) => { document.querySelector(`[data-t=${k}]`).click(); }, k);
    const wait = () => new Promise(r => setTimeout(r, 250));
    const overflow = async (where) => assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), '橫向溢出：' + where);
    await put('#file', 300, 200);
    await page.waitForFunction(() => document.querySelector('#info').textContent.includes('300×200'));
    for (const k of ['adjust', 'film', 'sketch', 'poster', 'mark']) { await tab(k); await wait(); assert.ok(await page.evaluate(() => !document.querySelector('#fxOut').hidden && document.querySelector('#cv').width === 300), k); await overflow(k); }
    // 色調分離：2 階 → 左半紅(255,0,0) 右半藍
    await tab('poster'); await page.evaluate(() => { const r = document.querySelector('#ctl input[type=range]'); r.value = 2; r.dispatchEvent(new Event('input')); }); await wait();
    assert.deepStrictEqual(await page.evaluate(() => [...document.querySelector('#cv').getContext('2d').getImageData(10, 10, 1, 1).data]), [255, 0, 0, 255]);
    // 日期水印：沒有 EXIF → 提示；手動日期後左上/右下有印記像素（橘色）
    await tab('mark'); await wait(); assert.ok((await page.evaluate(() => document.querySelector('#msg').textContent)).includes('日期'));
    await page.evaluate(() => { const d = document.querySelector('#ctl input[type=date]'); d.value = '2024-05-03'; d.dispatchEvent(new Event('input')); }); await wait();
    assert.ok(await page.evaluate(() => { const c = document.querySelector('#cv'), d = c.getContext('2d').getImageData(c.width / 2, c.height - 40, c.width / 2, 40).data; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 120 && d[i + 1] < 190 && d[i + 2] < 80) return true; return false; }), '右下應有橘色日期');
    // ASCII
    await tab('ascii'); await wait();
    const asc = await page.evaluate(() => document.querySelector('#pre').textContent); assert.ok(asc.split('\n').length > 5 && asc.split('\n')[0].length === 80);
    await overflow('ascii');
    // 對比
    await tab('compare'); await put('#fA', 200, 100); await put('#fB', 100, 200); await wait();
    assert.ok(await page.evaluate(() => document.querySelector('#cmpSave').disabled === false && document.querySelector('#cA').width === 200));
    await page.evaluate(() => { const p = document.querySelector('#pos'); p.value = 20; p.dispatchEvent(new Event('input')); });
    assert.equal(await page.evaluate(() => document.querySelector('#cB').style.clipPath), 'inset(0px 0px 0px 20%)');
    await overflow('compare');
    // 漸層：尺寸驗證與匯出
    await tab('grad'); await wait(); await overflow('grad');
    assert.ok(await page.evaluate(() => !document.querySelector('#fxOut').hidden && document.querySelector('#cv').height > document.querySelector('#cv').width));
    await page.evaluate(() => { const s = document.querySelector('#ctl select'); s.value = 'custom'; s.dispatchEvent(new Event('change')); }); await wait();
    await page.evaluate(() => { const n = document.querySelector('#ctl input[type=number]'); n.value = 9000; n.dispatchEvent(new Event('input')); }); await wait();
    assert.ok((await page.evaluate(() => document.querySelector('#msg').textContent)).includes('64–8000'));
    await page.evaluate(() => document.querySelector('#rand').click()); await wait();
    assert.deepStrictEqual(errors, []);

    // 色彩工具：圖片主色
    const { page: p2, errors: e2 } = await openPage(browser, 'utils/color-tools.html');
    await p2.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 40; c.height = 40; const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 40, 30); x.fillStyle = '#0000ff'; x.fillRect(0, 30, 40, 10);
        const b = await new Promise(r => c.toBlob(r, 'image/png')), dt = new DataTransfer(); dt.items.add(new File([b], 'a.png', { type: 'image/png' }));
        const i = document.querySelector('#domFile'); i.files = dt.files; i.dispatchEvent(new Event('change'));
    });
    await p2.waitForFunction(() => document.querySelectorAll('#domOut .val').length === 2);
    assert.ok((await p2.evaluate(() => document.querySelector('#domOut .val span').textContent)).startsWith('#ff0000'));
    await p2.evaluate(() => document.querySelector('#domOut .val .sm').click());
    assert.equal(await p2.evaluate(() => document.querySelector('#color').value), '#ff0000');
    assert.ok(!(await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
    assert.deepStrictEqual(e2, []);
    console.log('ok  image-fx e2e');
} finally { await browser.close(); }
