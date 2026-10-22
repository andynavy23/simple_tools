// split-bill 擴充：租屋水電瓦斯分攤（新增室友 / 月份 / 累計 / 刪除 / 清除 / 舊資料相容）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/split-bill.html');
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
    const txt = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const count = (s) => page.evaluate((s) => document.querySelectorAll(s).length, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);

    // 舊資料：只有 bill_state，水電區是空的
    await page.evaluate(() => localStorage.setItem('bill_state', JSON.stringify({ people: ['A', 'B'], expenses: [{ desc: 'x', payer: 'A', amount: 1000, shares: ['A', 'B'] }] })));
    await page.reload({ waitUntil: 'load' });
    assert.equal(await count('#list .li'), 1); assert.match(await txt('#u_months'), /還沒有月份記錄/);

    // 沒有室友不能記
    await set('#u_elec', '1000'); await click('#u_madd'); assert.match(await txt('#u_msg'), /先新增室友/);
    // 室友（A 房 8 坪、B 房 6 坪）
    await set('#u_pname', 'A'); await set('#u_pping', '8'); await click('#u_padd'); await set('#u_pname', 'B'); await set('#u_pping', '6'); await click('#u_padd');
    assert.equal((await ls('bill_util')).members.length, 2); assert.equal(await count('#u_kwh input'), 2);
    // 依坪數：1000 → 571.43 / 428.57；水費平均 301（餘 1 分歸 A 不會出現，這裡整除）
    await set('#u_ym', '2026-09'); await set('#u_elec', '1000'); await set('#u_elec_m', 'ping'); await click('#u_madd');
    let u = await ls('bill_util'); assert.equal(u.months.length, 1); assert.equal(u.months[0].items.elec.total, 100000);
    let mt = await txt('#u_months'); assert.ok(mt.includes('571.43') && mt.includes('428.57'), mt);
    // 重複月份拒絕
    await set('#u_elec', '5'); await click('#u_madd'); assert.match(await txt('#u_msg'), /已經記錄過/); assert.equal((await ls('bill_util')).months.length, 1);
    // 度數法 + 只填電價（總額 = 150 度 × 5.5 = 825），瓦斯平均 100.01 → 餘 1 分歸前面的人
    await set('#u_ym', '2026-10'); await set('#u_elec', ''); await set('#u_rate', '5.5'); await set('#u_elec_m', 'kwh');
    await page.evaluate(() => { const i = [...document.querySelectorAll('#u_kwh input')]; i[0].value = '100'; i[1].value = '50'; });
    await set('#u_gas', '100.01'); await click('#u_madd');
    u = await ls('bill_util'); assert.equal(u.months.length, 2); const m2 = u.months.find(m => m.ym === '2026-10'); assert.equal(m2.items.elec.total, 82500); assert.equal(m2.items.gas.total, 10001);
    mt = await txt('#u_months'); assert.ok(mt.includes('600.01') && mt.includes('325') && mt.includes('實際每度電 5.50 元'), mt);
    // 累計：A = 571.43 + 550 + 50.01 = 1171.44；B = 428.57 + 275 + 50 = 753.57
    const tt = await txt('#u_total'); assert.ok(tt.includes('1,171.44') && tt.includes('753.57'), tt);
    // 有月份記錄時不能移除室友
    await click('#u_people button'); assert.match(await txt('#u_msg'), /先刪除相關月份/); assert.equal((await ls('bill_util')).members.length, 2);
    // 單筆刪月份（用 id）
    await click('#u_months .del'); assert.equal((await ls('bill_util')).months.length, 1);
    // 清除水電瓦斯只動自己的資料
    await click('#u_clear'); u = await ls('bill_util'); assert.equal(u.members.length, 0); assert.equal(u.months.length, 0);
    assert.equal((await ls('bill_state')).people.length, 2);
    // 壞資料不壞頁
    await page.evaluate(() => localStorage.setItem('bill_util', '{"members":"x","months":[null]}')); await page.reload({ waitUntil: 'load' }); assert.equal(await count('#u_people .chip'), 0);
    assert.equal(await page.evaluate(() => document.querySelector('meta[name="st-keys"]').content), 'bill_state,bill_util');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
