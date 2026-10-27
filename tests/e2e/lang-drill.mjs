// 語言練習：每個主題開局答題、輸入題、錯題加強、限時、統計與清除、壞資料容錯、390px 無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/lang-drill.html');
const click = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error('找不到 ' + s); e.click(); }, sel);
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const reload = async () => { await page.reload({ waitUntil: 'load' }); };
const clickOk = () => page.evaluate(() => document.querySelectorAll('#choices button')[G.q.choices.findIndex(o => o.ok)].click());

// 壞資料容錯
await page.evaluate(() => { localStorage.setItem('langd_stats', '{"s":{"x":[1,2],"__proto__":[1,1]},"best":"x"}'); localStorage.setItem('langd_opts', '[1,2]'); });
await reload();
assert.strictEqual(await page.evaluate(() => Object.keys(stats.s).length), 0);
await page.evaluate(() => { localStorage.setItem('langd_stats', 'null'); localStorage.setItem('langd_opts', '{"topic":"zzz","mode":"constructor","count":"7"}'); });
await reload();
assert.strictEqual(await page.evaluate(() => S.topic + S.mode + S.count), 'tenseseq20');
assert.ok(await overflow() <= 0, '設定頁橫向溢出');

// 每個主題：選擇題答 3 題（答對 2 題、故意答錯 1 題），確認回饋、解說與統計
const ids = await page.evaluate(() => TOPICS.map(t => t.id));
for (const id of ids) {
    await click(`#topics [data-topic="${id}"]`);
    await click('#sAll'); await click('#start');
    for (let i = 0; i < 3; i++) {
        await page.waitForFunction('G && !G.locked && G.q', { timeout: 3000 });
        assert.ok(await overflow() <= 0, id + ' 作答畫面橫向溢出');
        await page.evaluate((wrong) => { const idx = G.q.choices.findIndex(o => o.ok !== wrong); document.querySelectorAll('#choices button')[idx].click(); }, i === 2);
        assert.ok((await page.$eval('#fb', e => e.textContent)).length > 0, id + ' 沒有回饋');
        assert.ok((await page.$eval('#exp', e => e.textContent)).length > 0, id + ' 沒有解說');
        assert.ok(await overflow() <= 0, id + ' 回饋後橫向溢出');
        await click('#nextBtn');
    }
    await page.waitForFunction('G && !G.locked', { timeout: 3000 });
    await click('#endBtn');
    assert.ok(await page.$eval('#result', e => !e.hidden), id + ' 沒有顯示結果');
    assert.ok((await page.$eval('#rWrong', e => e.textContent)).includes('答錯'), id + ' 結果沒有列出答錯的題目');
    await click('#toSetup');
}
assert.deepStrictEqual(await page.evaluate(() => totals(stats)), [ids.length * 2, ids.length], '統計累計');
assert.ok(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('langd_stats')).s).length > 0), '統計有存檔');

// 輸入題：不規則動詞（輸入對與錯）；不支援輸入的主題要停用輸入題型
await click('#topics [data-topic="irv"]'); await click('#typBtn'); await click('#sAll'); await click('#start');
await page.waitForFunction('G && G.q && G.q.typed');
await page.evaluate(() => { document.querySelector('#ans').value = G.q.item.a[0]; }); await click('#ansGo');
assert.strictEqual(await page.$eval('#fb', e => e.className), 'ok', '輸入正確答案要判對');
await click('#nextBtn'); await page.waitForFunction('G && !G.locked');
await page.evaluate(() => { document.querySelector('#ans').value = 'zzzz'; }); await click('#ansGo');
assert.strictEqual(await page.$eval('#fb', e => e.className), 'bad', '輸入錯誤答案要判錯');
await click('#endBtn'); await click('#toSetup');
await click('#topics [data-topic="tense"]');
assert.ok(await page.$eval('#typBtn', e => e.disabled), '不支援輸入的主題要停用輸入題型');

// 循序：答滿題數就結束
await click('#topics [data-topic="art"]'); await click('[data-seg="mode"] [data-v="seq"]'); await click('[data-seg="count"] [data-v="10"]'); await click('#start');
for (let i = 0; i < 10; i++) { await page.waitForFunction('G && !G.locked', { timeout: 3000 }); await clickOk(); await click('#nextBtn'); }
assert.ok(await page.$eval('#result', e => !e.hidden), '循序答滿題數要結束');
assert.strictEqual(await page.$eval('#rScore', e => e.textContent), '10 / 10');
await click('#toSetup');

// 錯題加強：把一題標成很常錯，開局後該題應頻繁出現
await page.evaluate(() => {
    const L = ITEMS.filter(i => i.topic === 'prep' && i.sub.startsWith('時間'));
    stats = { s: { [L[0].key]: [0, 50] }, best: {} }; L.slice(1).forEach(i => stats.s[i.key] = [50, 0]); window.__k = L[0].key;
    S.sub.prep = new Set(L.map(i => i.sub));
});
await click('#topics [data-topic="prep"]'); await page.evaluate(() => { S.sub.prep = new Set(subsOf('prep').filter(s => s.startsWith('時間'))); });
await click('[data-seg="mode"] [data-v="weak"]'); await click('[data-seg="count"] [data-v="0"]'); await click('#start');
let hits = 0;
for (let i = 0; i < 30; i++) { await page.waitForFunction('G && !G.locked'); hits += await page.evaluate(() => G.q.item.key === window.__k ? 1 : 0); await clickOk(); await click('#nextBtn'); }
assert.ok(hits >= 5, '錯題加強：常答錯的題出現 ' + hits + ' / 30');
await click('#endBtn'); await click('#toSetup');

// 限時：顯示倒數、最佳紀錄寫入
await click('[data-seg="mode"] [data-v="timed"]');
assert.ok(await page.$eval('#cntBox', e => e.hidden), '限時模式不顯示題數');
await click('#start'); await page.waitForFunction('G && G.q');
assert.ok((await page.$eval('#hTime', e => e.textContent)).includes('秒'));
await clickOk(); await click('#endBtn');
assert.ok((await page.$eval('#rLine', e => e.textContent)).includes('最佳紀錄'));
assert.ok(await page.evaluate(() => stats.best.prep > 0), '限時分數要記錄在該主題');
await click('#toSetup');

// 統計頁：最弱 10 個、各子分類、練習最弱、清除（confirm 說明、取消不清、確定才清）
await click('[data-tab="stat"]');
assert.ok(await page.$eval('#weakList', e => e.querySelectorAll('.weak').length) >= 1, '最弱清單');
assert.ok(await page.$eval('#allRates', e => e.querySelectorAll('.srow').length) >= 1, '子分類正確率');
assert.ok(await overflow() <= 0, '統計頁橫向溢出');
await click('#weakGo'); assert.ok(await page.$eval('#game', e => !e.hidden), '練習最弱 10 個');
await click('#endBtn'); await click('[data-tab="stat"]');
let asked = '';
page.removeAllListeners('dialog'); page.on('dialog', d => { asked = d.message(); d.dismiss(); });
await click('#clr'); assert.ok(asked.includes('無法復原') && asked.includes('清除'), 'confirm 說明');
assert.ok(await page.evaluate(() => Object.keys(stats.s).length) > 0, '取消不應清除');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
await click('#clr');
assert.strictEqual(await page.evaluate(() => Object.keys(stats.s).length + Object.keys(stats.best).length), 0);
assert.strictEqual(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('langd_stats')).s).length), 0);
assert.ok(await page.evaluate(() => !!localStorage.getItem('langd_opts')), '清除統計不影響選項設定');

assert.deepStrictEqual(errors, [], errors.join('\n'));
await browser.close();
console.log('ok lang-drill e2e');
