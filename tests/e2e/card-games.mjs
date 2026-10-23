// card-games（牌類小遊戲）：七個遊戲單機打完一局、動畫與 reduced-motion、390px 無橫向溢出、壞存檔容錯、統計
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/card-games.html');
const noScroll = async (m) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + m);
const GAMES = ['oldmaid', 'crazy8', 'gofish', 'war', 'sevens', 'half', 'pick'];

// 壞存檔：頁面仍可載入、使用預設
await page.evaluate(() => { localStorage.setItem('cardg_stats', '{"oldmaid":{"p":"x","w":-5},"war":null,"zzz":1}'); localStorage.setItem('cardg_opts', '{"game":"nope","cpu":99,"o":5'); });
await page.reload({ waitUntil: 'load' });
assert.strictEqual(await page.$$eval('#tabs button', b => b.length), 7);
assert.strictEqual(await page.$eval('#stats', e => e.innerText.includes('尚無紀錄')), true);
await noScroll('選單');

// 加速電腦
const fast = () => page.evaluate(() => { window.cardgDelay = [0, 0]; });
// 通用玩家：按鈕優先，其次金框牌（要選取的遊戲會自動在下一輪出現按鈕）
async function playOut(label) {
    for (let i = 0; i < 4000; i++) {
        const st = await page.evaluate(() => {
            if (!document.querySelector('#result').hidden) return 'done';
            const b = [...document.querySelectorAll('#ctrl button')].find(x => !x.disabled);
            if (b) { b.click(); return 'btn'; }
            const c = document.querySelector('#mine .card-c.ok, #center .card-c.ok');
            if (c) { c.click(); return 'card'; }
            return 'wait';
        });
        if (st === 'done') return;
        await new Promise(r => setTimeout(r, st === 'wait' ? 20 : 2));
    }
    throw new Error(label + ' 沒打完');
}
const startGame = async (id, set = {}) => {
    await page.evaluate(() => document.querySelector('#toMenu').click());
    await page.evaluate((id) => document.querySelector(`#tabs [data-g="${id}"]`).click(), id);
    for (const [k, v] of Object.entries(set)) await page.evaluate((k, v) => { const e = document.querySelector('#' + k); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event('change')); }, k, v);
    await page.evaluate(() => document.querySelector('#startBtn').click());
};
await page.evaluate(() => document.querySelector('#startBtn').click()); await fast();   // 先開一局讓 toMenu 存在
await page.evaluate(() => document.querySelector('#menuBtn').click());                  // confirm 被自動 dismiss → 留在牌局
await page.evaluate(() => { window.confirm = () => true; document.querySelector('#menuBtn').click(); });

for (const id of GAMES) {
    const set = id === 'war' ? { opt_limit: 'short' } : id === 'crazy8' ? { opt_fn: true } : id === 'half' ? { optCpu: '2' } : { optCpu: '3' };
    await startGame(id, set);
    await page.evaluate(() => { window.confirm = () => true; });
    await noScroll(id + ' 開局');
    await playOut(id);
    assert.ok(await page.$eval('#rTitle', e => e.textContent.length > 0), id + ' 結果');
    await noScroll(id + ' 終局');
}
assert.deepStrictEqual(errors, []);
const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('cardg_stats')));
GAMES.forEach(id => assert.strictEqual(stats[id].p, 1, id + ' 場數'));

// 手牌 13 張以上（排七 2 人 26 張）重疊收納：390px 不溢出、點選先放大
await startGame('sevens', { optCpu: '1' });
await page.evaluate(() => { window.confirm = () => true; window.cardgDelay = [60000, 60000]; });
await noScroll('排七 26 張');
// 牌多時，輪到我才會有金框；先確認手牌兩列
assert.ok(await page.$$eval('#mine .fan', f => f.length) >= 2);
const ok1 = await page.$('#mine .card-c.ok');
if (ok1) { await page.evaluate(() => document.querySelector('#mine .card-c.ok').click()); assert.ok(await page.$('#mine .card-c.sel'), '第一下只放大'); assert.ok(await page.$('#ctrl button'), '出牌鈕'); }

// reduced-motion：不產生動畫；一般模式開局有發牌動畫
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await new Promise(r => setTimeout(r, 800));
await startGame('crazy8');
assert.strictEqual(await page.evaluate(() => document.getAnimations().length), 0, 'reduced-motion 仍有動畫');
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await startGame('crazy8');
assert.ok(await page.evaluate(() => document.getAnimations().length) > 0, '沒有發牌動畫');

// 電腦出牌有延遲：預設 600–1000ms，回合不會瞬間跑完
await page.evaluate(() => { window.cardgDelay = [600, 1000]; });
await startGame('oldmaid');
const t0 = await page.evaluate(() => window.CG.S.steps);
await new Promise(r => setTimeout(r, 300));
assert.strictEqual(await page.evaluate(() => window.CG.S.steps), t0, '電腦太快');

// 清除統計（confirm 通過）
await page.evaluate(() => { window.confirm = () => true; document.querySelector('#toMenu').click(); });
await page.evaluate(() => { window.confirm = () => true; document.querySelector('#menuBtn').click(); });
await page.evaluate(() => document.querySelector('#clrStats').click());
assert.ok(await page.$eval('#stats', e => e.innerText.includes('尚無紀錄')));
assert.deepStrictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cardg_stats')).oldmaid), { p: 0, w: 0 });
assert.deepStrictEqual(errors, []);
await browser.close();
console.log('card-games OK');
