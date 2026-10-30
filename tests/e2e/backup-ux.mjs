// 備份提醒（首頁）與還原前差異預覽（備份視窗）的畫面行為
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-bk-'));
try {
    // ---- 備份提醒 ----
    const { page, errors } = await openPage(browser, 'index.html');
    const vis = () => page.evaluate(() => !document.querySelector('#bkremind').hidden);
    const reload = async () => { await page.reload({ waitUntil: 'load' }); };
    await page.evaluate(() => localStorage.clear()); await reload();
    assert.equal(await vis(), false, '沒有資料時不提醒');
    await page.evaluate(() => localStorage.setItem('todo_items', '[]')); await reload();
    assert.equal(await vis(), true, '有資料且沒備份過要提醒');
    assert.match(await page.evaluate(() => document.querySelector('#bkmsg').textContent), /還沒有備份過/);
    await page.evaluate(() => document.querySelector('#bklater').click());
    assert.equal(await vis(), false, '延後後隱藏');
    await reload(); assert.equal(await vis(), false, '延後期內重新載入仍隱藏');
    await page.evaluate(() => localStorage.removeItem('st_backup_pref')); await reload();
    assert.equal(await vis(), true);
    await page.evaluate(() => localStorage.setItem('st_last_backup', new Date().toISOString())); await reload();
    assert.equal(await vis(), false, '剛備份過不提醒');
    await page.evaluate(() => localStorage.setItem('st_last_backup', new Date(Date.now() - 20 * 864e5).toISOString())); await reload();
    assert.match(await page.evaluate(() => document.querySelector('#bkmsg').textContent), /已 20 天/);
    await page.evaluate(() => localStorage.setItem('st_backup_pref', 'garbage{')); await reload();     // 壞偏好不能讓頁面壞
    assert.equal(await vis(), true);
    await page.evaluate(() => document.querySelector('#bkoff').click());                              // 測試的 dialog 會被 dismiss（confirm 回 false）
    assert.equal(await vis(), true, '取消確認後不應關閉提醒');
    await page.evaluate(() => localStorage.setItem('st_backup_pref', JSON.stringify({ off: true }))); await reload();
    assert.equal(await vis(), false, '永久關閉');
    assert.deepEqual(errors, []);

    // ---- 還原前差異預覽（以 fun/todo.html 為例）----
    const t = await openPage(browser, 'fun/todo.html');
    await t.page.evaluate(() => { localStorage.setItem('todo_items', '[{"id":"a"}]'); localStorage.removeItem('pomo_tasks'); });
    await t.page.evaluate(() => Chrome.openData());
    const bk = path.join(tmp, 'b.json');
    fs.writeFileSync(bk, JSON.stringify({ app: 'simple_tools', v: 1, scope: 'fun/todo.html', exportedAt: '2026-10-01T00:00:00Z', data: { todo_items: '[{"id":"a"},{"id":"b"}]', pomo_tasks: '[]', other_tool: 'x' } }));
    const input = await t.page.$('.st-data input[type=file]');
    await input.uploadFile(bk);
    await t.page.waitForSelector('.st-prev ul', { timeout: 5000 });
    const text = await t.page.evaluate(() => document.querySelector('.st-prev').textContent);
    assert.match(text, /新增 1 項、會覆蓋 1 項/); assert.match(text, /todo_items/); assert.match(text, /pomo_tasks/); assert.match(text, /略過/);
    assert.equal(await t.page.evaluate(() => localStorage.getItem('todo_items')), '[{"id":"a"}]', '確認前不能寫入');
    await t.page.evaluate(() => [...document.querySelectorAll('.st-prev button')].find(b => b.textContent === '取消').click());
    assert.equal(await t.page.evaluate(() => document.querySelector('.st-prev').children.length), 0);
    assert.equal(await t.page.evaluate(() => localStorage.getItem('pomo_tasks')), null, '取消後不能寫入');
    await (await t.page.$('.st-data input[type=file]')).uploadFile(bk);
    await t.page.waitForSelector('.st-prev ul');
    await Promise.all([t.page.waitForNavigation({ timeout: 8000 }), t.page.evaluate(() => [...document.querySelectorAll('.st-prev button')].find(b => /確認載入/.test(b.textContent)).click())]);
    assert.equal(await t.page.evaluate(() => localStorage.getItem('todo_items')), '[{"id":"a"},{"id":"b"}]');
    assert.equal(await t.page.evaluate(() => localStorage.getItem('pomo_tasks')), '[]');
    assert.equal(await t.page.evaluate(() => localStorage.getItem('other_tool')), null, '不屬於這頁的鍵不能寫入');
    assert.deepEqual(t.errors, []);
    console.log('backup-ux ok');
} finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
}
