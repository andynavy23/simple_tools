// 首頁：我的最愛可置頂 / 上移（改 home_fav 順序）、搜尋字串 reload 後保留（sessionStorage st_home_q）、Esc 清除
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'index.html');
    const favLS = () => page.evaluate(() => JSON.parse(localStorage.getItem('home_fav') || '[]'));
    const favDom = () => page.$$eval('#favsec + .rows a.item', l => l.map(a => a.getAttribute('href')));
    const hrefs = await page.$$eval('#view .tile ~ * a.item, #view a.item', l => [...new Set(l.map(a => a.getAttribute('href')))].slice(0, 3));
    await page.evaluate((hs) => { localStorage.setItem('home_fav', JSON.stringify(hs)); location.reload(); }, hrefs);
    await page.waitForSelector('#favsec');
    assert.deepStrictEqual(await favDom(), hrefs);
    const sz = await page.$eval('#favsec + .rows .mv button', b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; });
    assert.ok(sz[0] >= 44 && sz[1] >= 44, '按鈕尺寸 ' + sz);
    assert.ok(await page.$eval('#favsec + .rows .mv button', b => /置頂|上移/.test(b.getAttribute('aria-label'))));
    await page.evaluate(() => document.querySelectorAll('#favsec + .rows .row')[2].querySelector('[data-mv=top]').click());
    const want = [hrefs[2], hrefs[0], hrefs[1]];
    assert.deepStrictEqual(await favDom(), want); assert.deepStrictEqual(await favLS(), want);
    await page.evaluate(() => document.querySelectorAll('#favsec + .rows .row')[1].querySelector('[data-mv=up]').click());
    assert.deepStrictEqual(await favLS(), [hrefs[0], hrefs[2], hrefs[1]]);
    // 搜尋字串保留
    await page.type('#q', '倒數');
    const n = await page.$$eval('#view a.item', l => l.length);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.$eval('#q', e => e.value), '倒數');
    assert.equal(await page.$$eval('#view a.item', l => l.length), n);
    await page.focus('#q'); await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.$eval('#q', e => e.value), '');
    await page.evaluate(() => localStorage.removeItem('home_fav'));
    assert.deepStrictEqual(errors, []);
} finally { await browser.close(); }
