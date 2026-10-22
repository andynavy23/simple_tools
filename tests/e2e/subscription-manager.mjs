// subscription-manager：新增 / 總覽 / 扣款提醒 / 很久沒用 / 編輯 / 刪除 / 清除 / 載入驗證（畫面行為）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/subscription-manager.html');
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
    const txt = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const hidden = (s) => page.evaluate((s) => document.querySelector(s).hidden, s);
    const count = (s) => page.evaluate((s) => document.querySelectorAll(s).length, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('subs_items') || '[]'));
    const add = async (o) => { for (const [k, v] of Object.entries(o)) await set('#f_' + k, v); await click('#save'); };
    const today = await page.evaluate(() => new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10));
    const inDays = (n) => new Date(Date.parse(today) + n * 864e5).toISOString().slice(0, 10);

    await click('#save'); assert.match(await txt('#formMsg'), /請填服務名稱/);
    await add({ name: 'Netflix', amt: '390', next: inDays(3), cat: '影音串流' });
    await add({ name: 'Adobe', amt: '7200', cycle: 'year', next: inDays(10), cat: '軟體工具' });
    await add({ name: '家庭雲端', amt: '300', share: '4', next: inDays(0), cat: '雲端儲存' });
    await add({ name: 'ChatX', amt: '20', cur: 'OTHER', cc: 'usd', rate: '32', next: inDays(45) });
    await add({ name: '舊服務', amt: '999', status: 'cancelled', next: inDays(5) });
    assert.equal((await stored()).length, 5); assert.equal(await count('#list .item'), 5);
    // 總覽：390 + 600 + 75 + 640 = 1705 / 月（取消的不算）
    assert.match(await txt('#stats'), /1,705/); assert.match(await txt('#stats'), /20,460/);
    assert.match(await txt('#cats'), /軟體工具/);
    // 未來 30 天：Netflix、Adobe、家庭雲端 三筆；ChatX（45 天後）與已取消不列
    const up = await txt('#upcoming'); assert.ok(up.includes('Netflix') && up.includes('Adobe') && up.includes('家庭雲端') && !up.includes('ChatX') && !up.includes('舊服務'), up);
    assert.equal(await count('#upcoming .li'), 3);
    // 外幣、分攤顯示
    assert.match(await txt('#list'), /USD 20/); assert.match(await txt('#list'), /4 人分攤/);
    // 很久沒用標記
    await page.evaluate(() => [...document.querySelectorAll('#list .item button')].find(b => b.textContent === '標記很久沒用').click());
    assert.equal((await stored()).filter(x => x.idle).length, 1); assert.match(await txt('#list'), /很久沒用/); assert.match(await txt('#stats'), /4 \/ 1/);
    // 篩選
    await set('#stFilter', 'cancelled'); assert.equal(await count('#list .item'), 1); await set('#stFilter', '');
    await set('#q', 'adobe'); assert.equal(await count('#list .item'), 1); await set('#q', '');
    // 自訂天數表單與預覽
    await set('#f_cycle', 'days'); assert.equal(await hidden('#daysBox'), false); await set('#f_amt', '100'); await set('#f_days', '10');
    assert.match(await txt('#fPrev'), /約每月 304/);
    // 編輯（用 id）
    await page.evaluate(() => [...document.querySelectorAll('#list .item button')].find(b => b.textContent === '編輯').click());
    assert.equal(await txt('#formTitle'), '編輯訂閱'); await set('#f_note', '改過'); await click('#save');
    assert.equal((await stored()).length, 5); assert.ok((await stored()).some(x => x.note === '改過'));
    // 單筆刪除
    await page.evaluate(() => [...document.querySelectorAll('#list .item button')].find(b => b.textContent === '刪除').click());
    assert.equal((await stored()).length, 4);
    await click('#csv'); assert.match(await txt('#dataMsg'), /已匯出/);
    // 壞資料
    await page.evaluate(() => localStorage.setItem('subs_items', '"oops"')); await page.reload({ waitUntil: 'load' }); assert.equal(await count('#list .item'), 0);
    await page.evaluate(() => localStorage.setItem('subs_items', JSON.stringify([null, { name: 'a', next: '2026-01-31', amt: 10 }, { name: 'bad', next: 'x', amt: 10 }, { name: 'usd', next: '2026-01-31', amt: 1, cur: 'USD' }]))); await page.reload({ waitUntil: 'load' });
    assert.equal(await count('#list .item'), 1);
    await click('#clearAll'); assert.equal((await stored()).length, 0);
    assert.equal(await page.evaluate(() => document.querySelector('meta[name="st-keys"]').content), 'subs_items');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
