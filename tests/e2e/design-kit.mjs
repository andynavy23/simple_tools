// design-kit：分頁切換、稿紙統計與列印版面、Logo SVG、名片預覽、漫畫與海報畫布；qr-code Logo 判定
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/design-kit.html');
    const set = (id, v) => page.evaluate((id, v) => { const e = document.querySelector('#' + id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, id, v);
    const tab = (t) => page.evaluate((t) => document.querySelector(`[data-t=${t}]`).click(), t);
    const q = (fn, ...a) => page.evaluate(fn, ...a);

    await tab('paper'); await set('gText', '字'.repeat(420));
    assert.match(await q(() => document.querySelector('#gStat').textContent), /字數 420.*共 2 頁/);
    assert.equal(await q(() => document.querySelectorAll('.sheet').length), 2);
    assert.equal(await q(() => document.querySelectorAll('.cell').length), 800);
    // 稿紙格子是正方形且不撐寬整頁
    const r = await q(() => { const c = document.querySelector('.cell').getBoundingClientRect(); return { w: c.width, h: c.height, sw: document.documentElement.scrollWidth, iw: innerWidth }; });
    assert.ok(Math.abs(r.w - r.h) < 1 && r.sw <= r.iw, JSON.stringify(r));
    assert.equal(await q(() => localStorage.getItem('designkit_tab')), '"paper"');

    await tab('logo'); await set('lText', '<&>');
    const svg = await q(() => document.querySelector('#lPrev').innerHTML);
    assert.ok(svg.includes('&lt;&amp;&gt;') && !svg.includes('<&>'));

    await tab('card');
    assert.match(await q(() => document.querySelector('#cVc').textContent), /^BEGIN:VCARD/);
    await set('cName', ''); assert.match(await q(() => document.querySelector('#msg').textContent), /請輸入姓名/);

    await tab('comic'); await set('mTpl', '1x4');
    assert.equal(await q(() => document.querySelectorAll('#mPanels input[type=file]').length), 4);
    assert.equal(await q(() => document.querySelector('#mCv').height), 2220);
    await tab('poster');
    assert.deepEqual(await q(() => [document.querySelector('#pCv').width, document.querySelector('#pCv').height]), [1080, 1440]);
    await tab('rainbow'); assert.match(await q(() => document.querySelector('#rCss').textContent), /linear-gradient\(90deg, #ff0000/);

    // qr-code Logo 判定
    const { page: p2, errors: e2 } = await openPage(browser, 'utils/qr-code.html');
    await p2.evaluate(() => { document.querySelector('[data-t=logo]').click(); const t = document.querySelector('#lText'); t.value = 'https://a.b'; t.dispatchEvent(new Event('input')); });
    assert.match(await p2.evaluate(() => document.querySelector('#lInfo').textContent), /容錯 H 為 30%：足夠/);
    await p2.evaluate(() => { const s = document.querySelector('#lEcc'); s.value = 'L'; s.dispatchEvent(new Event('change')); });
    assert.match(await p2.evaluate(() => document.querySelector('#lInfo').textContent), /容錯 L 為 7%：勉強/);
    assert.deepEqual([...errors, ...e2], []);
} finally { await browser.close(); }
