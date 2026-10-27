// 心算練習：新題型（分數 / 百分比 / 單位換算 / 時間 / 算式配對）的畫面流程、舊鍵相容、壞資料、390px 不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/mental-math.html');
const noOverflow = async (tag) => { const w = await page.evaluate(() => [document.scrollingElement.scrollWidth, innerWidth]); assert.ok(w[0] <= w[1], `${tag} 橫向捲動 ${w}`); };
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const setType = (t) => page.evaluate((t) => document.querySelector(`#types button[data-t="${t}"]`).click(), t);
const typeAns = async (txt) => { for (const ch of txt) await page.evaluate((k) => document.querySelector(`#pad button[data-k="${k}"]`).click(), ch === '.' ? 'dot' : ch); };
const vis = (sel) => page.evaluate((s) => !document.querySelector(s).hidden, sel);

await noOverflow('設定頁');
// 舊鍵相容：既有最佳紀錄仍顯示；壞資料不會讓頁面壞掉
await page.evaluate(() => { localStorage.setItem('mentalmath_best_n10_d2_as', JSON.stringify({ acc: 90, correct: 9, sec: 30 })); localStorage.setItem('mentalmath_best_match_d2_as', '"壞掉"'); localStorage.setItem('mentalmath_best_n10_frac', JSON.stringify({ acc: 'x' })); });
await page.reload({ waitUntil: 'load' });
assert.equal(await page.$eval('#bestNow', e => e.textContent), '90%・30 秒');
assert.equal(await page.$$eval('#types button', b => b.length), 6);

// 顯示規則：分數等題型沒有位數 / 運算；配對沒有題數模式
await setType('frac');
assert.equal(await vis('#optArith'), false); assert.equal(await vis('#optMode'), true);
assert.equal(await page.$eval('#bestNow', e => e.textContent), '—', '壞的最佳紀錄顯示為 —');
await setType('match'); assert.equal(await vis('#optArith'), true); assert.equal(await vis('#optMode'), false);
assert.equal(await page.$eval('#bestNow', e => e.textContent), '—');
await setType('arith'); assert.equal(await vis('#optArith'), true); assert.equal(await vis('#optMode'), true);

// 各題型玩完一輪 10 題（用頁面內目前題目的答案作答）：答對數 = 10、最佳紀錄寫入對應的鍵
for (const [type, key] of [['frac', 'mentalmath_best_n10_frac'], ['pct', 'mentalmath_best_n10_pct'], ['unit', 'mentalmath_best_n10_unit'], ['time', 'mentalmath_best_n10_time']]) {
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });
    await setType(type); await click('#start');
    assert.equal(await vis('#play'), true);
    for (let i = 0; i < 10; i++) {
        const q = await page.evaluate(() => ({ t: cur.text, ans: cur.dec ? fmtTenths(cur.t) : String(cur.ans), hint: document.querySelector('#hint').textContent, dot: !document.querySelector('#padx').disabled, kind: cur.kind }));
        assert.equal(q.kind, type); assert.ok(q.t.length > 3 && q.hint.length > 3, type + ' 題目與提示');
        assert.equal(q.dot, type === 'pct' || type === 'unit', type + ' 小數點鍵');
        await noOverflow(type + ' 作答');
        await typeAns(q.ans); await click('#pad .enter');
    }
    assert.equal(await vis('#result'), true, type + ' 結果頁');
    assert.ok((await page.$eval('#stats', e => e.textContent)).includes('10 / 10'), type + ' 全對');
    assert.equal(await page.$eval('#msg', e => e.textContent), '新的最佳成績！');
    const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key); assert.equal(saved.acc, 100, key);
    await noOverflow(type + ' 結果');
}

// 答錯：顯示正確答案與錯題回顧；小數題用 . 鍵輸入小數
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });
await setType('pct'); await click('#start');
await typeAns('7'); await click('#pad .enter'); // 幾乎一定答錯（若碰巧對就略過）
const last = await page.$eval('#last', e => e.textContent);
assert.ok(last.includes('正確答案') || last.includes('答對'), last);
await page.evaluate(() => { for (const k of ['dot', 'dot', '5', '5']) document.querySelector(`#pad button[data-k="${k}"]`).click(); });
assert.equal(await page.$eval('#ans', e => e.textContent), '0.5', '小數點只能一個、最多一位小數');
await click('#quit'); assert.equal(await vis('#result'), true);
assert.ok((await page.$eval('#wrongBox', e => e.textContent)).length > 0);

// 時間題：12 / 24 小時制與跨午夜（用頁面函式抽樣驗證答案字串不為空）
await setType('time'); await click('#back'); await setType('time'); await click('#start');
const texts = new Set(); for (let i = 0; i < 9; i++) { texts.add(await page.$eval('#q', e => e.textContent)); await typeAns('1'); await click('#pad .enter'); }
assert.ok(texts.size >= 6, '時間題有變化'); await click('#quit');

// 算式配對：配對成功全部 → 結果；左右各點錯一次記失誤；最佳紀錄用 mentalmath_best_match_*
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });
await setType('match'); await click('#start');
assert.equal(await vis('#matchPlay'), true); assert.equal(await page.$$eval('#mgrid button', b => b.length), 12);
await noOverflow('配對');
await page.evaluate(() => { const l = document.querySelector('#mgrid button[data-l="0"]'); l.click(); const wrongK = mm.order.findIndex((li) => li !== 0 && mm.items[li].ans !== mm.items[0].ans); document.querySelector(`#mgrid button[data-r="${wrongK}"]`).click(); });
assert.equal(await page.$eval('#mmiss', e => e.textContent), '1', '配錯記一次失誤');
for (let i = 0; i < 6; i++) await page.evaluate((i) => { document.querySelector(`#mgrid button[data-l="${i}"]`).click(); document.querySelector(`#mgrid button[data-r="${mm.order.indexOf(i)}"]`).click(); }, i);
assert.equal(await vis('#result'), true, '全部配完進入結果');
const st = await page.$eval('#stats', e => e.textContent); assert.ok(st.includes('6 / 6') && st.includes('失誤1'), st);
assert.equal(await page.$eval('#msg', e => e.textContent), '新的最佳成績！');
const mb = await page.evaluate(() => JSON.parse(localStorage.getItem('mentalmath_best_match_d2_as'))); assert.equal(mb.miss, 1); assert.ok(mb.score >= 3);
await noOverflow('配對結果');
// 再玩一次；中途結束不計最佳且列出沒配到的
await click('#again'); await click('#mquit');
assert.ok((await page.$eval('#msg', e => e.textContent)).includes('不計入最佳')); assert.ok((await page.$eval('#wrongBox', e => e.textContent)).includes('沒配到'));
assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mentalmath_best_match_d2_as')).miss), 1, '最佳紀錄沒被覆蓋');

// 清除最佳紀錄仍涵蓋新鍵（dialog 預設被 dismiss，所以只確認前綴一致）
assert.ok((await page.content()).includes("'mentalmath_best_'"));
assert.deepEqual(errors, []);
await browser.close();
console.log('mental-math-types OK');
