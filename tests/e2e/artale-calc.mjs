// Artale 計算機：三個分頁各算出結果、無例外、390px 不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'game-assist/artale-calc.html');
for (const [t, out, want] of [['pScroll', 'out1', '166.67'], ['pExp', 'out2', '250'], ['pGacha', 'out3', '期望抽數']]) {
    await page.evaluate((t) => document.querySelector(`#tabs [data-t=${t}]`).click(), t);
    const r = await page.evaluate((t, out) => ({ shown: !document.querySelector('#' + t).hidden, txt: document.querySelector('#' + out).textContent, sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth }), t, out);
    assert.ok(r.shown && r.txt.includes(want), `${t}：${r.txt.slice(0, 80)}`);
    assert.ok(r.sw <= r.cw, `${t}：橫向溢出 ${r.sw} > ${r.cw}`);
}
assert.deepEqual(errors, []);
await browser.close();
console.log('artale-calc OK');
