// mahjong（麻將）：算台計算機輸入 / 手動勾選、單機打完整局並進下一局、390px 無橫向溢出、壞存檔容錯、戰績與台數表自訂
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/mahjong.html');
const noScroll = async (m) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + m);
const txt = (s) => page.$eval(s, e => e.innerText);

// 壞存檔：頁面仍可載入，使用預設
await page.evaluate(() => { localStorage.setItem('mj_opts', '{"base":"x","unit":-3,"rounds":9'); localStorage.setItem('mj_tai', '{"pinghu":"a","menqing":500}'); localStorage.setItem('mj_stats', '[1,2]'); });
await page.reload({ waitUntil: 'load' });
assert.strictEqual(await page.$eval('#oBase', e => e.value), '50'); assert.strictEqual(await page.$eval('#oUnit', e => e.value), '20');
assert.ok((await txt('#stats')).includes('還沒有紀錄')); await noScroll('選單');

// 算台計算機（手牌自動判斷）
await page.evaluate(() => document.querySelector('#mainTabs [data-t=calc]').click());
const type = async (s) => { await page.$eval('#cHand', (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, s); };
await type('123m456m789m345s55p234p');
let out = await txt('#cOut'); assert.ok(out.includes('平胡') && out.includes('門清') && out.includes('3 台'), out);
assert.ok(out.includes('點炮：放槍者付') && out.includes('110'), out);                      // 50 + 3 × 20
await page.click('#cZimo'); out = await txt('#cOut'); assert.ok(out.includes('不求人') && out.includes('5 台') && out.includes('自摸：每家付'), out);
await page.click('#cZimo');
await type('123m456m789m345s55p23p'); out = await txt('#cOut'); assert.ok(out.includes('手上要 17 張'), out);
await type('123m456m789m345s55p235p'); out = await txt('#cOut'); assert.ok(out.includes('還沒胡牌'), out);
await type('12x'); out = await txt('#cOut'); assert.ok(out.includes('看不懂'), out);
await type('111z222z333z444z55m[123p]'); out = await txt('#cOut'); assert.ok(out.includes('大四喜') && out.includes('22 台'), out);
await noScroll('計算機');
// 改台數表 → 立即反映；重新整理後仍在
await page.evaluate(() => document.querySelector('#setBox').open = true);
await page.$eval('#taiEd input[data-id=dsx]', e => { e.value = '30'; e.dispatchEvent(new Event('change', { bubbles: true })); });
out = await txt('#cOut'); assert.ok(out.includes('36 台'), out);
assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mj_tai')).dsx), 30);
// 手動勾選
await page.evaluate(() => document.querySelector('#calcTabs [data-m=manual]').click());
await page.$eval('#mRows input[data-id=qingyise]', e => e.click()); await page.$eval('#mRows input[data-id=hua]', e => { e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true })); });
out = await txt('#cOut'); assert.ok(out.includes('11 台') && out.includes('清一色') && out.includes('花牌'), out);
await noScroll('手動勾選');
// 還原台數表（confirm 會被 openPage 的 dialog 處理器取消 → 不還原；改接受）
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
await page.click('#taiReset'); assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mj_tai')).dsx), 16);

// 單機：加速電腦，自己用「能自摸 / 胡就胡，否則過牌 / 打剛摸的牌」打到一局結束
await page.evaluate(() => { window.mjDelay = [0, 0]; document.querySelector('#mainTabs [data-t=play]').click(); document.querySelector('#soloLevel').value = '1'; });
await page.click('#soloBtn');
assert.ok(await page.waitForSelector('#game:not([hidden])', { timeout: 5000 }));
const hand = await page.$$eval('#hand .mt', t => t.map(x => x.getBoundingClientRect().width));
assert.ok(hand.length === 17 || hand.length === 16, '手牌 ' + hand.length); assert.ok(hand.every(w => w >= 16), '牌太窄 ' + hand);
await noScroll('對局');
async function playRound() {
    for (let i = 0; i < 3000; i++) {
        const st = await page.evaluate(() => {
            if (!document.querySelector('#result').hidden) return 'done';
            const bs = [...document.querySelectorAll('#acts button')].filter(b => !b.disabled);
            const pick = (re) => bs.find(b => re.test(b.textContent));
            const b = pick(/胡/) || pick(/^過$/);
            if (b) { b.click(); return 'btn'; }
            const d = document.querySelector('#hand .mt.dr') || document.querySelector('#hand .mt:last-child');
            if ([...document.querySelectorAll('#acts button')].some(b => b.textContent === '打出') && d) { d.click(); d.click(); return 'discard'; }
            return 'wait';
        });
        if (st === 'done') return;
        await new Promise(r => setTimeout(r, st === 'wait' ? 15 : 3));
    }
    throw new Error('一局沒打完');
}
await playRound();
await noScroll('結果');
assert.ok((await txt('#result')).match(/台|流局/), await txt('#result'));
assert.ok(await page.$eval('#nextBtn', e => !e.hidden));
assert.ok((await txt('#score')).includes('累計'));
const s1 = await page.evaluate(() => JSON.parse(localStorage.getItem('mj_stats'))); assert.strictEqual(s1.rounds, 1);
await page.click('#nextBtn'); await playRound();
const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mj_stats'))); assert.strictEqual(s2.rounds, 2);
// 清除戰績
await page.evaluate(() => document.querySelector('#leave').click()); await page.waitForNavigation({ waitUntil: 'load' }).catch(() => { });
await page.click('#statsClear'); assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mj_stats')).rounds), 0);
assert.deepStrictEqual(errors, []);
await browser.close();
console.log('ok  mahjong e2e');
