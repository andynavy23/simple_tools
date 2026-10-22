// gift-ledger：新增 / 查往來 / 回禮提醒 / 彙總 / 編輯 / 刪除 / 清除 / 備份鍵（畫面行為）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'fun/gift-ledger.html');
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
    const txt = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const hidden = (s) => page.evaluate((s) => document.querySelector(s).hidden, s);
    const count = (s) => page.evaluate((s) => document.querySelectorAll(s).length, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('giftl_items') || '[]'));
    const add = async (o) => { for (const [k, v] of Object.entries(o)) await set('#f_' + k, v); await click('#save'); };

    // 驗證訊息
    await click('#save'); assert.match(await txt('#formMsg'), /請填對象/);
    // 新增：收到（有回禮提醒、已逾期）、送出
    await add({ dir: 'in', name: '王小明', rel: '同事', event: '結婚', amt: '2200', date: '2024-05-01', remind: '2020-01-01' });
    assert.equal((await stored()).length, 1); assert.equal(await count('#list .item'), 1);
    assert.equal(await hidden('#remBox'), false); assert.match(await txt('#remList'), /已逾期/);
    await add({ dir: 'out', name: '王小明', event: '結婚', amt: '2600', date: '2026-03-01' });
    await add({ dir: 'out', name: '李美', event: '滿月', kind: '禮物', amt: '1000', date: '2025-01-01', note: '=evil' });
    assert.equal((await stored()).length, 3);
    // 查往來
    await set('#f_name', '王小明'); assert.equal(await hidden('#hist'), false); assert.match(await txt('#hist'), /收 2,200（1 次）.*送 2,600（1 次）/);
    await set('#f_name', '路人'); assert.equal(await hidden('#hist'), true);
    // 統計與篩選
    assert.match(await txt('#stats'), /\+1,400/);
    await set('#dirFilter', 'in'); assert.equal(await count('#list .item'), 1); await set('#dirFilter', '');
    await set('#q', '李'); assert.equal(await count('#list .item'), 1); await set('#q', '');
    // 依對象彙總
    await click('#tabWho'); assert.equal(await count('#list .who'), 2); assert.match(await txt('#list'), /你多送 400/);
    await click('#tabList');
    // 已回禮 → 提醒消失
    await page.evaluate(() => [...document.querySelectorAll('#remList button')][0].click());
    assert.equal(await hidden('#remBox'), true); assert.equal((await stored()).find(x => x.amt === 2200).remind, '');
    // 編輯（用 id）
    await page.evaluate(() => [...document.querySelectorAll('#list .item button')].find(b => b.textContent === '編輯').click());
    assert.equal(await txt('#formTitle'), '編輯記錄'); await set('#f_amt', '3000'); await click('#save');
    assert.equal((await stored()).length, 3); assert.ok((await stored()).some(x => x.amt === 3000));
    // 單筆刪除
    await page.evaluate(() => [...document.querySelectorAll('#list .item button')].find(b => b.textContent === '刪除').click());
    assert.equal((await stored()).length, 2);
    // 匯出 CSV（下載導到暫存資料夾，結束時整個刪除）
    await click('#csv'); assert.match(await txt('#dataMsg'), /已匯出/);
    // 載入壞資料不會壞頁
    await page.evaluate(() => localStorage.setItem('giftl_items', '{"x":1}')); await page.reload({ waitUntil: 'load' }); assert.equal(await count('#list .item'), 0);
    await page.evaluate(() => localStorage.setItem('giftl_items', JSON.stringify([null, 5, { name: 'ok', date: '2024-01-01', amt: 5 }, { name: '', date: '2024-01-01', amt: 5 }]))); await page.reload({ waitUntil: 'load' }); assert.equal(await count('#list .item'), 1);
    // 清除全部
    await click('#clearAll'); assert.equal((await stored()).length, 0); assert.equal(await count('#list .item'), 0);
    // 備份宣告
    assert.equal(await page.evaluate(() => document.querySelector('meta[name="st-keys"]').content), 'giftl_items');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
