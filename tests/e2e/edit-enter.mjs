// IDEAS 122–125、142、143、155：health-log / fuel-log / subscription-manager / my-lists 的 Enter 送出與失敗聚焦；health-log / fuel-log / expense-tracker 的單筆編輯（id 覆蓋、筆數不變）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const open = async (rel) => {
        const { page, errors } = await openPage(browser, rel);
        page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
        const h = {
            page, errors,
            set: (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, s, v),
            click: (s) => page.evaluate((s) => document.querySelector(s).click(), s),
            enter: async (s) => { await page.focus(s); await page.keyboard.press('Enter'); },
            active: () => page.evaluate(() => document.activeElement && document.activeElement.id),
            ls: (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k),
            text: (s) => page.evaluate((s) => document.querySelector(s).textContent, s),
            btn: (scope, label) => page.evaluate((sc, l) => [...document.querySelectorAll(sc + ' button')].find(b => b.textContent === l).click(), scope, label),
        };
        return h;
    };

    // ---- health-log ----
    {
        const t = await open('utils/health-log.html');
        await t.enter('#f_sys'); assert.equal(await t.active(), 'f_sys', '空白送出聚焦 #f_sys');
        assert.equal(await t.page.evaluate(() => document.querySelector('#f_sys').getAttribute('aria-invalid')), 'true');
        await t.set('#f_sys', '120'); await t.enter('#f_dia'); assert.equal(await t.active(), 'f_dia', '舒張壓空白聚焦 #f_dia');
        await t.set('#f_dia', '80'); await t.enter('#f_dia');
        assert.equal((await t.ls('healthlog_items')).length, 1, 'Enter 新增一筆'); assert.equal(await t.active(), 'f_sys');
        const old = (await t.ls('healthlog_items'))[0];
        // 編輯
        await t.btn('#list', '編輯'); assert.equal(await t.text('#save'), '儲存'); assert.equal(await t.page.evaluate(() => document.querySelector('#f_sys').value), '120');
        await t.set('#f_sys', '130'); await t.click('#save');
        const L = await t.ls('healthlog_items');
        assert.equal(L.length, 1); assert.equal(L[0].id, old.id); assert.equal(L[0].sys, 130); assert.equal(L[0].time, old.time); assert.equal(L[0].date, old.date);
        assert.ok((await t.text('#list')).includes('130 / 80')); assert.equal(await t.text('#save'), '新增');
        // 編輯時同樣驗證
        await t.btn('#list', '編輯'); await t.set('#f_sys', '60'); await t.click('#save'); // 60 <= 舒張壓 80
        assert.equal((await t.ls('healthlog_items'))[0].sys, 130, '驗證失敗不覆蓋');
        assert.deepEqual(t.errors, []);
    }
    // ---- fuel-log ----
    {
        const t = await open('utils/fuel-log.html');
        await t.set('#date', ''); await t.enter('#liters'); assert.equal(await t.active(), 'date', '空白送出聚焦第一個空必填欄');
        await t.set('#date', '2025-01-01'); await t.enter('#liters'); assert.equal(await t.active(), 'odo');
        await t.set('#odo', '11000'); await t.set('#liters', '30'); await t.enter('#liters');
        assert.equal((await t.ls('fuel_entries')).length, 1, 'Enter 新增一筆');
        await t.page.evaluate(() => localStorage.setItem('fuel_entries', JSON.stringify([11000, 12000, 13000].map((o, i) => ({ id: 'e' + i, d: '2025-01-0' + (i + 1), odo: o, l: 30, p: 30, full: true })))));
        await t.page.reload({ waitUntil: 'load' });
        const before = await t.text('#stats');
        await t.page.evaluate(() => [...document.querySelectorAll('#list .it')].find(r => r.textContent.includes('12,000')).querySelector('button').click());
        assert.equal(await t.page.evaluate(() => document.querySelector('#odo').value), '12000');
        await t.set('#odo', '12100'); await t.click('#add');
        const L = await t.ls('fuel_entries');
        assert.equal(L.length, 3); assert.equal(L.find(e => e.id === 'e1').odo, 12100);
        assert.notEqual(await t.text('#stats'), before, '油耗重算');
        // 里程重複被拒
        await t.page.evaluate(() => [...document.querySelectorAll('#list .it')].find(r => r.textContent.includes('12,100')).querySelector('button').click());
        await t.set('#odo', '13000'); await t.click('#add');
        assert.equal((await t.ls('fuel_entries')).find(e => e.id === 'e1').odo, 12100);
        assert.deepEqual(t.errors, []);
    }
    // ---- subscription-manager ----
    {
        const t = await open('utils/subscription-manager.html');
        await t.enter('#f_amt'); assert.equal(await t.active(), 'f_name', '失敗聚焦名稱欄');
        await t.set('#f_name', 'Netflix'); await t.enter('#f_amt'); assert.equal(await t.active(), 'f_amt', '金額錯聚焦金額');
        await t.set('#f_amt', '390'); await t.enter('#f_amt');
        assert.equal((await t.ls('subs_items')).length, 1); assert.equal(await t.active(), 'f_name');
        assert.deepEqual(t.errors, []);
    }
    // ---- my-lists ----
    {
        const t = await open('utils/my-lists.html');
        await t.set('#b_url', 'example.com'); await t.enter('#b_url');
        assert.equal((await t.ls('mylists_bookmarks')).length, 1); assert.equal(await t.page.evaluate(() => document.querySelector('#b_url').value), ''); assert.equal(await t.active(), 'b_url');
        await t.click('[data-t=ac]'); await t.set('#a_name', 'Google'); await t.enter('#a_name');
        assert.equal((await t.ls('mylists_accounts')).length, 1); assert.equal(await t.active(), 'a_name');
        assert.deepEqual(t.errors, []);
    }
    // ---- expense-tracker ----
    {
        const t = await open('utils/expense-tracker.html');
        await t.page.evaluate(() => localStorage.setItem('expenses', JSON.stringify([{ id: 'x1', d: '2025-02-10', type: 'out', cat: '餐飲', amt: 960, note: 'n', fx: 30, cur: 'USD', rate: 32 }, { id: 'x2', d: '2025-02-11', type: 'out', cat: '交通', amt: 100, note: '' }])));
        await t.page.reload({ waitUntil: 'load' });
        await t.set('#date', '2025-02-10'); await t.click('#next'); await t.click('#prev');
        await t.page.evaluate(() => { document.querySelector('#date').value = '2025-02-10'; });
        // 切到 2025-02：重複按上個月直到顯示
        for (let i = 0; i < 400 && !(await t.text('#ym')).includes('2025 年 02'); i++) await t.click('#prev');
        await t.page.evaluate(() => [...document.querySelectorAll('#list .item')].find(r => r.textContent.includes('USD') || r.textContent.includes('$30') || r.textContent.includes('餐飲')).querySelector('button:not(.del)').click());
        assert.equal(await t.page.evaluate(() => document.querySelector('#rate').value), '32'); assert.equal(await t.page.evaluate(() => document.querySelector('#amt').value), '30');
        await t.set('#date', '2025-02-20'); await t.set('#cat', '購物'); await t.click('#add');
        const L = await t.ls('expenses');
        assert.equal(L.length, 2); const e = L.find(x => x.id === 'x1');
        assert.equal(e.rate, 32); assert.equal(e.fx, 30); assert.equal(e.amt, 960); assert.equal(e.d, '2025-02-20'); assert.equal(e.cat, '購物');
        assert.ok((await t.text('#cats')).includes('購物'));
        assert.deepEqual(t.errors, []);
    }
} finally { await browser.close(); }
console.log('edit-enter OK');
