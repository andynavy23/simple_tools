// chart-maker：直方圖 / 盒鬚圖 / 趨勢線（畫面控制項、說明文字、畫布有內容、選項記住）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/chart-maker.html');
    const txt = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const hidden = (s) => page.evaluate((s) => document.querySelector(s).hidden, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
    const type = (t) => page.evaluate((t) => document.querySelector(`#types [data-t="${t}"]`).click(), t);
    const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    // 畫布上與背景不同的像素數（確認真的畫了東西）
    const ink = () => page.evaluate(() => { const c = document.querySelector('#cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) n++; return n; });

    await set('#data', '期,營收,成本\n1,100,60\n2,120,70\n3,130,72\n4,150,80\n5,148,85\n6,170,90\n7,400,95\n8,185,100');
    assert.equal((await page.$$('#types button')).length, 11);
    // 直方圖
    await type('hist'); await settle(); assert.equal(await hidden('#xhist'), false); assert.equal(await hidden('#xtrend'), true);
    assert.match(await txt('#xnote'), /8 筆，組距 .*建議 .*左閉右開/); assert.ok(await ink() > 500);
    await set('#binw', '50'); await settle(); assert.match(await txt('#xnote'), /組距 50（建議/);
    await set('#binw', '0.0001'); await settle(); assert.match(await txt('#xnote'), /組距太小/); await set('#binw', '');
    // 盒鬚圖
    await type('box'); await settle(); assert.equal(await hidden('#xhist'), true);
    const bn = await txt('#xnote'); assert.ok(bn.includes('營收：') && bn.includes('成本：') && bn.includes('離群值 1 個') && bn.includes('QUARTILE.INC'), bn); assert.ok(await ink() > 500);
    // 趨勢線
    await type('trend'); await settle(); assert.equal(await hidden('#xtrend'), false);
    let tn = await txt('#xnote'); assert.match(tn, /營收：y = .*R² = 0\.\d+；3 期移動平均；虛線與空心圓是往後延伸 3 期的預測/); assert.ok(await ink() > 500);
    await set('#maN', '0'); await set('#fcN', '0'); await settle(); tn = await txt('#xnote'); assert.ok(!tn.includes('移動平均') && !tn.includes('預測'), tn);
    await set('#fcN', '999'); await settle(); assert.match(await txt('#xnote'), /延伸 100 期/);   // 夾在上限內
    assert.match(await txt('#warn'), /只畫第一個選取的數值欄/);
    // 資料不足
    await set('#data', '期,值\n1,5'); await settle(); assert.match(await txt('#xnote'), /資料點不足/);
    // 記住圖表類型（既有行為），重開後仍是趨勢線，且新控制項狀態一致
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('chartm_opts')));
    assert.deepEqual(Object.keys(stored).sort(), ['labels', 'legend', 'palette', 'type']); assert.equal(stored.type, 'trend');
    await page.reload({ waitUntil: 'load' }); await settle(); assert.equal(await page.evaluate(() => document.querySelector('#types [data-t="trend"]').getAttribute('aria-pressed')), 'true'); assert.equal(await hidden('#xtrend'), false);
    // 既有類型仍正常
    await set('#data', '月,營收\n1月,120\n2月,150\n3月,170'); await type('bar'); await settle(); assert.equal(await txt('#xnote'), ''); assert.equal(await hidden('#xtrend'), true); assert.ok(await ink() > 500);
    // 重置圖表設定
    await page.evaluate(() => { window.confirm = () => true; document.querySelector('#reset').click(); }); await settle();
    assert.equal(await page.evaluate(() => document.querySelector('#types [data-t="bar"]').getAttribute('aria-pressed')), 'true');
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('chart-maker OK');
