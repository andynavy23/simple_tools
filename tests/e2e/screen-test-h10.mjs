// screen-test h10：剪貼簿 / 通知 / 色域 / 多點觸控 / 輪詢率 / 裝置速查 六個新分頁
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/screen-test.html');
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const tab = async (t) => { await click(`.tabs button[data-t=${t}]`); assert.equal(await page.evaluate((x) => document.querySelector(`.pane[data-t=${x}]`).hidden, t), false, t); };
const noOverflow = async (m) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + m);

// 分頁列在 390px 不溢出
await noOverflow('tabs');

// 剪貼簿：用假的 ClipboardEvent 貼上 HTML + 純文字；HTML 只能當文字顯示
await tab('clip');
await page.evaluate(() => {
    const dt = new DataTransfer(); dt.setData('text/plain', 'hello'); dt.setData('text/html', '<img src=x onerror="window.__xss=1"><b>bold</b>');
    document.querySelector('#clipIn').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
let t = await text('#clipOut');
assert.ok(t.includes('text/plain') && t.includes('text/html') && t.includes('hello') && t.includes('<b>bold</b>'), t);
assert.equal(await page.evaluate(() => document.querySelectorAll('#clipOut img, #clipOut b').length), 0, 'HTML 不得插入頁面');
assert.equal(await page.evaluate(() => window.__xss), undefined);
assert.equal(await page.evaluate(() => document.querySelector('#clipIn').value), '');
await noOverflow('clip');

// 通知
await tab('notify');
t = await text('#notifyOut'); assert.ok(t.includes('通知 API') && t.includes('權限狀態'), t);
await click('#notifySend'); // 未允許時只提示，不丟例外
await noOverflow('notify');

// 色域
await tab('gamut');
t = await text('#gamutOut'); assert.ok(t.includes('color-gamut: p3') && t.includes('dynamic-range: high') && t.includes('結論'), t);
assert.equal(await page.evaluate(() => document.querySelectorAll('#gmChart div').length), 6);
await noOverflow('gamut');

// 多點觸控：兩根手指同時按下
await tab('touch');
await page.evaluate(() => {
    const p = document.querySelector('#tpad'), r = p.getBoundingClientRect();
    for (const [id, dx] of [[11, 40], [12, 120]]) p.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, pointerType: 'touch', clientX: r.left + dx, clientY: r.top + 60, width: 20, height: 20, pressure: .5, bubbles: true }));
});
assert.ok((await text('#tNow')).includes('2'), await text('#tNow'));
assert.ok((await text('#tList')).includes('#2'));
await page.evaluate(() => document.querySelector('#tpad').dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, pointerType: 'touch', bubbles: true })));
assert.ok((await text('#tNow')).includes('1') && (await text('#tMax')).includes('2'));
await click('#tScroll');
assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#tpad')).touchAction), 'pan-y');
assert.ok((await text('#tNow')).includes('0'));
await click('#tScroll');
assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#tpad')).touchAction), 'none');
await noOverflow('touch');

// 輪詢率：假的 1 ms 間隔滑鼠事件
await tab('rate');
await page.evaluate(() => {
    const p = document.querySelector('#rpad');
    for (let i = 0; i < 60; i++) { const e = new PointerEvent('pointermove', { pointerType: 'mouse', bubbles: true }); Object.defineProperty(e, 'timeStamp', { value: i * 1 }); p.dispatchEvent(e); }
});
t = await text('#rateOut'); assert.ok(t.includes('1000 Hz'), t);
await click('#rateReset'); assert.ok((await text('#rateOut')).includes('尚未'));
await noOverflow('rate');

// 裝置尺寸：模擬 iPhone 12/13/14 螢幕尺寸應高亮
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await tab('dev');
assert.ok((await text('#devList')).includes('iPhone 12 / 13 / 13 Pro / 14'));
assert.ok(await page.evaluate(() => document.querySelectorAll('#devList .devrow').length >= 20));
const hl = await page.evaluate(() => [...document.querySelectorAll('#devList .devrow.cur')].map(x => x.innerText));
assert.ok(hl.length <= 1 && (hl.length === 0 || hl[0].includes('目前裝置')), JSON.stringify(hl));
await click('#devList .devrow button');
await noOverflow('dev');

// 新分頁值可還原；舊值、壞值照舊
for (const [v, shown] of [['clip', 'clip'], ['dev', 'dev'], ['rate', 'rate'], ['bogus', 'screen']]) {
    await page.evaluate((x) => localStorage.setItem('screentest_tab', JSON.stringify(x)), v);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.evaluate(() => document.querySelector('.tabs button[aria-pressed=true]').dataset.t), shown, v);
}
await page.evaluate(() => localStorage.removeItem('screentest_tab'));

// 鍵盤：顯示修飾鍵
await tab('kb');
await page.keyboard.down('Shift'); await page.keyboard.press('KeyA'); await page.keyboard.up('Shift');
t = await text('#last'); assert.ok(t.includes('code=KeyA') && t.includes('keyCode=65') && t.includes('修飾鍵=Shift'), t);

assert.deepEqual(errors, []);
await browser.close();
console.log('screen-test h10 OK');
