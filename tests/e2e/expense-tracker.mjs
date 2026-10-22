// expense-tracker 擴充：50/30/20 預算、財務自由進度（資產快照）、旅行 / 專案預算（畫面行為與舊資料相容）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/expense-tracker.html');
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
    const txt = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const hidden = (s) => page.evaluate((s) => document.querySelector(s).hidden, s);
    const count = (s) => page.evaluate((s) => document.querySelectorAll(s).length, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
    const entry = async (type, cat, amt) => { await set('#type', type); await set('#cat', cat); await set('#amt', String(amt)); await click('#add'); };

    // 舊資料（沒有 trip / 預算 / 快照）照常載入
    await page.evaluate(() => localStorage.setItem('expenses', JSON.stringify([{ id: 'o1', d: new Date().toLocaleDateString('sv'), type: 'out', cat: '餐飲', amt: 100, note: 'old' }])));
    await page.reload({ waitUntil: 'load' });
    assert.equal(await count('#list .item'), 1); assert.equal(await hidden('#tripRow'), true);

    // 50/30/20：收入 50000、居住 14000、餐飲 12000、娛樂 16000（另有舊的餐飲 100）
    await entry('in', '薪資', 50000); await entry('out', '居住', 14000); await entry('out', '餐飲', 12000); await entry('out', '娛樂', 16000);
    let res = await txt('#b_res');
    assert.ok(res.includes('需要 50%') && res.includes('預算 25,000') && res.includes('預算 15,000') && res.includes('預算 10,000'), res);
    assert.ok(res.includes('實際 26,100') && res.includes('超支'), res);
    await set('#bm_餐飲', 'want'); assert.ok((await txt('#b_res')).includes('實際 14,000'));      // 對應改成想要 → 需要 14000
    assert.equal((await ls('expense_budget')).map['餐飲'], 'want');
    await set('#b_need', '60'); assert.match(await txt('#b_msg'), /加起來 100/);                       // 不合法不存
    await set('#b_want', '20'); assert.equal((await ls('expense_budget')).pct.need, 60);
    await set('#b_inc', '100000'); assert.ok((await txt('#b_res')).includes('預算 60,000'));
    await click('#b_reset'); assert.equal((await ls('expense_budget')).pct.need, 50); assert.equal((await ls('expense_budget')).income, 0);

    // 財務自由進度
    assert.ok((await txt('#f_stats')).includes('尚無快照'));
    await set('#s_cash', '1000000'); await set('#s_invest', '500000'); await set('#s_debt', '100000'); await click('#s_add');
    assert.equal((await ls('expense_assets')).length, 1); assert.ok((await txt('#f_stats')).includes('1,400,000'));
    await click('#s_add'); assert.match(await txt('#s_msg'), /至少填一項/);                            // 全空拒絕
    await entry('in', '投資', 6000);
    assert.ok((await txt('#f_stats')).includes('被動 6,000'));
    await page.evaluate(() => [...document.querySelectorAll('#s_list button')][0].click()); assert.equal((await ls('expense_assets')).length, 0);
    await set('#s_cash', '5'); await click('#s_add'); await click('#s_clear'); assert.equal((await ls('expense_assets')).length, 0);

    // 專案
    await set('#t_name', '日本'); await set('#t_budget', '30000'); await click('#t_add');
    assert.equal((await ls('expense_trips')).length, 1); assert.equal(await hidden('#tripRow'), false);
    await set('#t_name', '日本'); await click('#t_add'); assert.match(await txt('#t_msg'), /同名/);
    const tid = (await ls('expense_trips'))[0].id;
    await set('#type', 'out'); await set('#cat', '購物'); await set('#cur', 'JPY'); await set('#rate', '0.2'); await set('#amt', '5000'); await set('#trip', tid); await click('#add');
    let ex = await ls('expenses'); const t1 = ex.find(e => e.trip === tid);
    assert.ok(t1 && t1.cur === 'JPY' && t1.amt === 1000 && t1.fx === 5000);
    assert.ok((await txt('#t_list')).includes('合計 NT$1,000') && (await txt('#t_list')).includes('¥5,000') && (await txt('#t_list')).includes('剩 29,000'), await txt('#t_list'));
    assert.ok((await txt('#list')).includes('專案：日本'));
    // 收入不歸專案
    await set('#cur', 'TWD'); await entry('in', '獎金', 10); ex = await ls('expenses'); assert.ok(!ex.find(e => e.cat === '獎金').trip);
    // 刪專案：明細保留、標記拿掉
    const before = ex.length; await click('#t_list button'); ex = await ls('expenses');
    assert.equal((await ls('expense_trips')).length, 0); assert.equal(ex.length, before); assert.ok(ex.every(e => !e.trip)); assert.ok(ex.some(e => e.fx === 5000));
    assert.equal(await hidden('#tripRow'), true);

    // 壞資料不會壞頁
    await page.evaluate(() => { localStorage.setItem('expense_budget', '"x"'); localStorage.setItem('expense_assets', '{"a":1}'); localStorage.setItem('expense_trips', '[null,5]'); });
    await page.reload({ waitUntil: 'load' }); assert.equal(await count('#b_map select'), 8); assert.ok((await txt('#f_stats')).includes('尚無快照'));
    assert.equal(await page.evaluate(() => document.querySelector('meta[name="st-keys"]').content), 'expenses,expense_fixed,fx_cache,expense_budget,expense_assets,expense_trips');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
