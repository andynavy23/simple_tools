// hearts-games：單機打完紅心大戰（含換牌）與拱豬（含賣牌）、房主驗證拒絕亂序出牌、統計與壞存檔容錯、390px 無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/hearts-games.html');
const noScroll = async (m) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向捲動：' + m);
const ev = (f, ...a) => page.evaluate(f, ...a);

// 壞存檔：頁面仍可載入、使用預設
await ev(() => { localStorage.setItem('hearts_stats', '{"hearts":{"p":"x","w":-5},"pig":null}'); localStorage.setItem('hearts_opts', '{"mode":"zzz","target":7'); });
await page.reload({ waitUntil: 'load' });
assert.ok(await ev(() => document.querySelector('#stats').textContent.includes('尚無紀錄')));
await noScroll('選單');
await ev(() => { const st = window.setTimeout; window.setTimeout = (f, d, ...a) => st(f, Math.min(d || 0, 4), ...a); });   // 加速電腦

async function playOut(label) {
    for (let i = 0; i < 6000; i++) {
        const st = await ev(() => {
            if (V.phase === 'over') return 'done';
            const go = document.querySelector('#goBtn');
            if (V.phase === 'pass' && !V.picked[my]) { [...document.querySelectorAll('#hand .bc')].slice(0, 3).forEach(b => b.click()); document.querySelector('#goBtn').click(); return 'pass'; }
            if (V.phase === 'sell' && !V.picked[my]) { go.click(); return 'sell'; }
            if (V.phase === 'play' && V.turn === my) { const b = [...document.querySelectorAll('#hand .bc')].find(x => !x.classList.contains('dim')); b.click(); document.querySelector('#goBtn').click(); return 'play'; }
            return 'wait';
        });
        if (st === 'done') return;
        await new Promise(r => setTimeout(r, st === 'wait' ? 8 : 2));
    }
    throw new Error(label + ' 沒打完');
}

// 紅心大戰
await ev(() => document.querySelector('#soloBtn').click());
assert.strictEqual(await ev(() => V.phase), 'pass');
assert.strictEqual(await ev(() => document.querySelectorAll('#hand .bc').length), 13);
await noScroll('紅心大戰 換牌');
assert.ok(await ev(() => document.querySelector('#goBtn').disabled), '沒選 3 張不能傳');
// 房主驗證：亂序出牌 / 重複換牌被拒，狀態不變
await ev(() => { hostAct(1, { t: 'PLAY', c: 0 }); hostAct(1, { t: 'SUBMIT', cards: [999, 1, 2] }); hostAct(2, { t: 'PLAY', c: 'x' }); hostAct(0, { t: 'SUBMIT', cards: [0] }); });
assert.ok(await ev(() => G.phase === 'pass' && G.picks[0] === null && G.hands[0].length === 13), '不合法的動作要被拒絕');
await playOut('hearts');
assert.ok(await ev(() => document.querySelector('#reveal').textContent.includes('本局')));
assert.ok(await ev(() => !document.querySelector('#again').hidden));
await noScroll('紅心大戰 結果');
assert.strictEqual(await ev(() => G.taken.flat().length), 52);
await ev(() => document.querySelector('#again').click());      // 下一局
assert.strictEqual(await ev(() => [V.round, V.phase]).then(r => r[0]), 1);

// 拱豬（1 局即結束，驗證統計）
await page.reload({ waitUntil: 'load' });
await ev(() => { const st = window.setTimeout; window.setTimeout = (f, d, ...a) => st(f, Math.min(d || 0, 4), ...a); });
await ev(() => { document.querySelector('[data-m="pig"]').click(); const r = document.querySelector('#rRounds'); r.value = '1'; r.dispatchEvent(new Event('change', { bubbles: true })); });
assert.ok(await ev(() => !document.querySelector('#rPigBox').hidden && document.querySelector('#rHearts').hidden));
await ev(() => document.querySelector('#soloBtn').click());
assert.strictEqual(await ev(() => V.phase), 'sell');
await noScroll('拱豬 賣牌');
await playOut('pig');
assert.ok(await ev(() => document.querySelector('#status').textContent.includes('遊戲結束')));
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('hearts_stats')).pig.p), 1);
await noScroll('拱豬 結果');
// 清除統計：confirm 取消不動、確認後清空
await ev(() => document.querySelector('#leave').click());
await page.reload({ waitUntil: 'load' });
assert.ok(await ev(() => document.querySelector('#stats').textContent.includes('玩 1 場')));
await ev(() => { window.confirm = () => false; document.querySelector('#clrStats').click(); });
assert.ok(await ev(() => document.querySelector('#stats').textContent.includes('玩 1 場')));
await ev(() => { window.confirm = () => true; document.querySelector('#clrStats').click(); });
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('hearts_stats')).pig.p), 0);

assert.deepStrictEqual(errors.filter(e => !e.includes('hearts-games.html')), []);       // reload 會中止上一次導覽
await browser.close();
console.log('ok  hearts-games e2e');
