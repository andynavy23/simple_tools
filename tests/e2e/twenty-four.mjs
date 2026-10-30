// 24 點 E2E：點牌組算式、驗證、提示、無解、每日挑戰統計、清除統計、390px 不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const PAGE = 'mini-games/twenty-four.html';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const enter = (page, expr) => page.evaluate((expr) => {
    for (const t of expr.match(/\d+|[-+*/()]/g)) {
        const b = /\d/.test(t) ? [...document.querySelectorAll('#cards button')].find(x => !x.disabled && x.textContent === t) : document.querySelector(`#ops [data-o="${t}"]`);
        if (!b) throw new Error('找不到按鈕 ' + t); b.click();
    }
}, expr);
const setCards = (page, c) => page.evaluate((c) => { cards = c; tok = []; hinted = false; done = false; say(''); render(); }, c);
const status = (page) => page.evaluate(() => document.querySelector('#status').textContent);
const stats = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('tf24_stats')));

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, PAGE);
    // 排版
    const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, minH: Math.min(...[...document.querySelectorAll('.wrap button:not(.sm)')].map(b => b.getBoundingClientRect().height)) }));
    assert.ok(w.sw <= w.iw, '不橫向溢出'); assert.ok(w.minH >= 44, '按鈕夠大 ' + w.minH);
    // 解對
    await setCards(page, [3, 3, 8, 8]);
    await enter(page, '8/(3-8/3)');
    assert.ok((await page.evaluate(() => document.querySelector('#expr').textContent)).includes('÷'));
    await page.evaluate(() => document.querySelector('#chk').click());
    assert.ok((await status(page)).includes('答對'));
    let st = await stats(page); assert.strictEqual(st.n, 1); assert.ok(st.best >= 1);
    // 答錯 / 沒用完牌 / 退一格
    await setCards(page, [3, 3, 8, 8]); await enter(page, '3+3+8+8'); await page.evaluate(() => document.querySelector('#chk').click());
    assert.ok((await status(page)).includes('22'));
    await setCards(page, [3, 3, 8, 8]); await enter(page, '3*8'); await page.evaluate(() => document.querySelector('#chk').click());
    assert.ok((await status(page)).includes('每張牌'));
    await page.evaluate(() => document.querySelector('#back').click());
    assert.strictEqual(await page.evaluate(() => tok.length), 2);
    assert.strictEqual(await page.evaluate(() => [...document.querySelectorAll('#cards button')].filter(b => !b.disabled).length), 3);
    // 提示不計入統計
    await setCards(page, [4, 1, 8, 7]); await page.evaluate(() => document.querySelector('#hint').click());
    const hintText = await status(page); assert.ok(hintText.startsWith('提示：'));
    await enter(page, hintText.slice(3).replace(' ＝ 24', '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'));
    await page.evaluate(() => document.querySelector('#chk').click());
    assert.ok((await status(page)).includes('不計入')); assert.strictEqual((await stats(page)).n, 1);
    // 無解
    await setCards(page, [1, 1, 1, 1]); await page.evaluate(() => document.querySelector('#none').click());
    assert.ok((await status(page)).includes('確實無解'));
    await setCards(page, [3, 3, 8, 8]); await page.evaluate(() => document.querySelector('#none').click());
    assert.ok((await status(page)).includes('其實有解'));
    // 每日挑戰：同一題、解開後連續天數 1
    await page.evaluate(() => document.querySelector('#modes [data-m=d]').click());
    const c1 = await page.evaluate(() => cards.slice()); await page.evaluate(() => document.querySelector('#modes [data-m=d]').click());
    assert.deepStrictEqual(await page.evaluate(() => cards.slice()), c1);
    assert.ok(await page.evaluate(() => document.querySelector('#none').hidden));
    await enter(page, await page.evaluate(() => solve24(cards))); await page.evaluate(() => document.querySelector('#chk').click());
    assert.ok((await status(page)).includes('連續 1 天'), await status(page));
    st = await stats(page); assert.strictEqual(st.d.streak, 1); assert.strictEqual(st.d.last, await page.evaluate(() => twDay())); assert.strictEqual(st.n, 2);
    // 壞資料載入不當機
    await page.evaluate(() => localStorage.setItem('tf24_stats', '{"n":"x","d":5}')); await page.reload(); await sleep(200);
    assert.ok((await page.evaluate(() => document.querySelector('#statBox').textContent)).includes('解開題數'));
    // 清除統計
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
    await page.evaluate(() => { stats = { n: 3, best: 5, d: { last: '', streak: 0, best: 0 } }; Util.store.set('tf24_stats', stats); document.querySelector('#clearStats').click(); });
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('tf24_stats')), null);
    assert.deepStrictEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('ok  twenty-four e2e');
