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
assert.deepStrictEqual(await page.evaluate(() => Object.keys(localStorage)), ['loan_opts'], '只存 loan_opts');

// 390px 不橫向溢出；輸入框字級 >= 16
for (const m of ['debt', 'house']) {
    await click(`[data-mode=${m}]`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), m + ' 橫向溢出');
}
await click('[data-mode=buyrent]'); assert.ok((await text('#out')).includes('損益平衡'), '買房 vs 租房照舊');

// 131 / 145 / 146：記住輸入、複製、逐期表匯出、重設、壞資料
await page.evaluate(() => { window.__clip = ''; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__clip = t; } }, configurable: true }); });
await click('[data-mode=loan]'); await set('#p', '2000000'); await set('#grace', '12');
let t = await text('#out'); assert.ok(t.includes('寬限期後首期應繳') && t.includes('比單一利率'), '寬限期結果');
await set('#grace', '0'); await set('#rate2', '3'); assert.ok((await text('#out')).includes('第二段年利率與'), '只填一半要提示');
await set('#from2', '61'); assert.ok((await text('#out')).includes('第 61 期起應繳'));
await set('#rate2', ''); await set('#from2', '');
await click('#copyBtn'); await new Promise(r => setTimeout(r, 100));
let clip = await page.evaluate(() => window.__clip); assert.ok(clip.includes('每月應繳：') && /每月應繳：\d/.test(clip), '複製含月付：' + clip.slice(0, 60));
await click('#tsvBtn'); await new Promise(r => setTimeout(r, 100));
clip = await page.evaluate(() => window.__clip); const lines = clip.split(String.fromCharCode(10)), TAB = String.fromCharCode(9);
assert.strictEqual(lines.length, 241); assert.ok(lines.every(l => l.split(TAB).length === 5)); assert.ok(lines[240].endsWith(TAB + '0'), '最後餘額 0');
await page.reload({ waitUntil: 'load' });
assert.strictEqual(await page.evaluate(() => document.querySelector('#p').value), '2000000', 'reload 保留');
await click('[data-mode=debt]'); await pick('refi'); await page.reload({ waitUntil: 'load' });
assert.strictEqual(await page.evaluate(() => document.querySelector('#sub').value), 'refi', '分頁與試算項目保留');
await page.evaluate(() => { window.confirm = () => true; }); await click('#resetBtn');
assert.deepStrictEqual(await page.evaluate(() => [localStorage.getItem('loan_opts'), document.querySelector('#p').value]), [null, '1000000'], '重設');
await page.evaluate(() => localStorage.setItem('loan_opts', JSON.stringify({ mode: 5, v: { p: 'abc', rate: '1e99', years: null }, sub: 7 })));
await page.reload({ waitUntil: 'load' });
assert.strictEqual(await page.evaluate(() => document.querySelector('#p').value), '1000000', '壞資料補預設');
await page.evaluate(() => localStorage.setItem('loan_opts', '{壞掉'));
await page.reload({ waitUntil: 'load' }); assert.ok((await text('#out')).includes('每月應繳'));
assert.deepStrictEqual(errors, []);
await browser.close();
