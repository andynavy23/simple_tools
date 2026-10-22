// web-meta 畫面測試：各分頁產生 / 預覽 / 檢查，只存分頁選項
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/web-meta.html');
    const setv = (sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    const click = (sel) => page.$eval(sel, e => e.click());
    const text = (sel) => page.$eval(sel, e => e.textContent);
    const tab = async (t) => { await click(`#tabs [data-t=${t}]`); assert.equal(await page.$eval('#p_' + t, e => e.hidden), false); };
    // 社群卡片
    await setv('#sm_title', '我的網站'); await setv('#sm_url', 'https://example.com/a'); await setv('#sm_image', '/rel.jpg');
    assert.ok((await text('#p_social')).includes('圖片網址要是完整網址'));
    await setv('#sm_image', 'https://example.com/c.jpg');
    const og = await text('#p_social');
    assert.ok(og.includes('og:title') && og.includes('twitter:card') && og.includes('LINE') && og.includes('Facebook'), og.slice(0, 300));
    // JSON-LD
    await tab('jsonld'); assert.ok((await text('#p_jsonld')).includes('為必填'));
    await setv('#ld_headline', 'H'); await setv('#ld_author', 'A'); await setv('#ld_datePublished', '2026-10-22'); await setv('#ld_image', 'https://example.com/1.jpg');
    assert.ok((await text('#p_jsonld')).includes('必填欄位齊全') && (await text('#p_jsonld')).includes('"@type": "Article"'));
    await setv('#ld_type', 'FAQ'); assert.ok((await text('#p_jsonld')).includes('至少填一組'));
    // robots / sitemap
    await tab('robots'); await setv('#rb_policy', 'custom'); await setv('#rb_dis', '/admin/');
    assert.ok((await text('#p_robots')).includes('Disallow: /admin/'));
    await setv('#rb_in', 'User-agent: *\nDisallow: /admin/'); await setv('#rb_path', '/admin/x');
    assert.ok((await text('#p_robots')).includes('不能抓取'));
    await tab('sitemap'); await setv('#sm2_urls', 'https://example.com/\nhttps://example.com/b');
    assert.ok((await text('#p_sitemap')).includes('<loc>https://example.com/b</loc>'));
    // 搜尋預覽 / slug / UTM
    await tab('serp'); await setv('#sp_title', '你'.repeat(40)); assert.ok((await text('#p_serp')).includes('被截斷') && (await text('#p_serp')).includes('…'));
    await tab('slug'); await setv('#sl_in', 'Hello World & 你好'); assert.ok((await text('#p_slug')).includes('hello-world-and-你好'));
    await setv('#sl_cjk', 'drop'); assert.ok(!(await text('#p_slug')).includes('你好'.repeat(1) + '\n'));
    await tab('utm'); await setv('#ut_pre', 'line|social'); await setv('#ut_campaign', 'Spring'); await setv('#ut_urls', 'https://a.com/p?id=1#top\nbad');
    const u = await text('#p_utm');
    assert.ok(u.includes('https://a.com/p?id=1&utm_source=line&utm_medium=social&utm_campaign=spring#top') && u.includes('第 2 行'), u);
    // 無橫向溢出、只存分頁
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), true);
    const st = await page.evaluate(() => localStorage.getItem('webmeta_opts'));
    assert.equal(st, '{"tab":"utm"}');
    assert.ok(!errors.length, errors.join('\n'));
} finally { await browser.close(); }
console.log('ok  web-meta e2e');
