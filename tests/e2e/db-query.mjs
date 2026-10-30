// db-query：三個分頁（SQL / MongoDB / Redis 與 ES）都能切換並產出指令；分頁選擇存 dbquery_tab；390px 不橫向溢出；無例外
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/db-query.html');
    const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
    const type = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
    const txt = (sel) => page.$eval(sel, e => e.textContent);
    const shown = () => page.evaluate(() => ['sql', 'mongo', 'nosql'].filter(k => !document.getElementById('p_' + k).hidden));
    const overflow = () => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
    const keys = () => page.evaluate(() => Object.keys(localStorage));

    assert.deepEqual(await shown(), ['sql']);
    assert.deepEqual(await keys(), [], '預設進入不寫任何鍵');
    await type('#tbl', 'users'); assert.ok((await txt('#p_sql #out')).includes('SELECT'), 'SQL 要產出 SELECT');
    assert.ok(await overflow() <= 0, 'SQL 橫向溢出');

    await click('#dbTabs [data-t=mongo]'); assert.deepEqual(await shown(), ['mongo']);
    await type('#mo_coll', 'users'); assert.ok((await txt('#mo_out')).includes('db.users.find'), 'Mongo 要產出 find');
    assert.ok(await overflow() <= 0, 'Mongo 橫向溢出');

    await click('#dbTabs [data-t=nosql]'); assert.deepEqual(await shown(), ['nosql']);
    await type('#r_key', 'k1'); assert.equal(await txt('#no_out'), 'GET k1');
    assert.ok(await overflow() <= 0, 'Redis 橫向溢出');

    // 分頁選擇會記住；壞資料回到 SQL；回到 SQL 時各分頁互不影響
    assert.equal(await page.evaluate(() => localStorage.getItem('dbquery_tab')), '"nosql"');
    await page.reload({ waitUntil: 'load' }); assert.deepEqual(await shown(), ['nosql']);
    await page.evaluate(() => localStorage.setItem('dbquery_tab', '{"x":1}')); await page.reload({ waitUntil: 'load' });
    assert.deepEqual(await shown(), ['sql']);
    assert.deepEqual(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(e => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); }), [], 'id 不可重複');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
