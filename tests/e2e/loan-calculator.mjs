// loan-calculator：債務 / 購屋與租屋分頁的畫面行為（切換、各項目出結果、壞輸入、390px 不橫向溢出、舊分頁不受影響）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/loan-calculator.html');
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
const pick = (v) => set('#sub', v);

assert.ok((await text('#out')).includes('每月應繳'), '貸款分頁照舊');
await click('[data-mode=debt]');
assert.strictEqual(await page.evaluate(() => document.querySelector('#subCard').hidden), false);
assert.ok((await text('#out')).includes('還清需要'), '信用卡預設');
await set('#cc_pct', '0.5'); assert.ok((await text('#out')).includes('永遠還不完'));
await set('#cc_pct', '5');
for (const [k, expect] of [['inst', '實質年利率'], ['snow', '雪崩比雪球'], ['pre', '縮短年限'], ['refi', '費用回收期'], ['stu', '之後每月應繳']]) {
    await pick(k);
    const t = await text('#out'); assert.ok(t.includes(expect) && !t.includes('NaN') && !t.includes('Infinity'), k + '：' + t.slice(0, 80));
    assert.ok(t.includes('非財務建議'));
}
await pick('inst'); await set('#inst_fee', ''); assert.ok((await text('#out')).includes('請填入'));
await set('#inst_fee', '600');
await pick('snow'); await set('#snow_x', '0'); await set('#snow_a_m', '10'); await set('#snow_b_m', '10'); await set('#snow_c_m', '10');
assert.ok((await text('#out')).includes('不足以還清'));
await pick('pre'); await set('#pre_x', '99999999'); assert.ok((await text('#out')).includes('要小於目前餘額'));

await click('[data-mode=house]');
assert.ok((await text('#out')).includes('房價範圍'), '購屋能力預設');
await pick('yld'); assert.ok((await text('#out')).includes('淨投報率'));
await pick('lease'); assert.ok((await text('#out')).includes('房東應退還'));
await set('#lease_dep', '60000'); assert.ok((await text('#out')).includes('超過 2 個月'));
await set('#lease_out', ''); assert.ok((await text('#out')).includes('請選擇'));
assert.strictEqual(await page.evaluate(() => localStorage.length), 0, '不存資料');

// 390px 不橫向溢出；輸入框字級 >= 16
for (const m of ['debt', 'house']) {
    await click(`[data-mode=${m}]`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), m + ' 橫向溢出');
}
await click('[data-mode=buyrent]'); assert.ok((await text('#out')).includes('損益平衡'), '買房 vs 租房照舊');
assert.deepStrictEqual(errors, []);
await browser.close();
