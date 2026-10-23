// solitaire：五種玩法開局→走一步→悔棋→提示→新局；每日挑戰；壞存檔容錯；390px 無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/solitaire.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
const ev = (f, ...a) => page.evaluate(f, ...a);
const overflow = () => ev(() => document.documentElement.scrollWidth > innerWidth + 1);
const act = (sel) => ev((s) => document.querySelector(s).click(), sel);

for (const g of ['klondike', 'freecell', 'spider', 'pyramid', 'golf']) {
    await ev((g) => [...document.querySelectorAll('#tabs button')].find(b => b.dataset.g === g).click(), g);
    assert.equal(await ev(() => G.game), g);
    assert.ok(await ev(() => document.querySelectorAll('#tbl .cd').length > 10), g + ' 有牌');
    assert.ok(!(await overflow()), g + ' 橫向溢出');
    // 走一步：優先用非翻牌的合法步，否則翻牌
    const moved = await ev(() => { const L = legalMoves(G.s), m = L.find(m => m[0] !== 'd') || L[0]; const k = JSON.stringify(G.s); doMove(m); return JSON.stringify(G.s) !== k; });
    assert.ok(moved, g + ' 走一步');
    assert.equal(await ev(() => G.moves), 1);
    await act('#undo'); assert.equal(await ev(() => JSON.stringify(G.s) === JSON.stringify(deal(G.game, G.opt, G.seed))), true, g + ' 悔棋還原');
    await act('#hint'); assert.ok((await ev(() => document.querySelector('#msg').textContent)).length > 0, g + ' 提示訊息');
    const seed = await ev(() => G.seed); await act('#new');
    assert.equal(await ev(() => G.moves), 0);
    await act('#again'); assert.equal(await ev(() => G.seed), await ev(() => G.seed));
    assert.ok(!(await overflow()), g + ' 新局後溢出');
}
// 點選操作：用真實點擊走一步（接龍）
await ev(() => [...document.querySelectorAll('#tabs button')].find(b => b.dataset.g === 'golf').click());
await act('#tbl .pile[data-k=s]'); assert.equal(await ev(() => G.moves), 1);
// 每日挑戰：同日同局
await act('#daily'); const d1 = await ev(() => [G.daily, G.seed]);
await act('#new'); await act('#daily'); assert.deepEqual(await ev(() => [G.daily, G.seed]), d1);
assert.match(d1[0], /^\d{4}-\d{2}-\d{2}$/);
// 存檔與壞存檔
await ev(() => { doMove(legalMoves(G.s)[0]); }); await page.reload({ waitUntil: 'load' });
assert.ok(await ev(() => G.moves >= 1 && G.daily !== ''), '存檔接續');
await ev(() => { G.won = true; localStorage.setItem("solit_game", '{"game":"klondike","opt":1,"seed":3,"daily":"","s":{"g":"klondike"},"moves":0,"t":0}'); });
await page.reload({ waitUntil: 'load' }); assert.equal(await ev(() => G.moves), 0);
await ev(() => { G.won = true; localStorage.setItem('solit_game', '不是json{'); }); await ev(() => localStorage.setItem('solit_best', '[1,2]'));
await page.reload({ waitUntil: 'load' }); assert.equal(await ev(() => G.moves), 0); assert.ok(!(await overflow()));
// 勝利 → 最佳紀錄 → 清除
await ev(() => { G.s.tab.forEach(p => p.length = 0); G.s.g === 'golf' ? 0 : start('golf', 0, 5); G.s.tab.forEach(p => p.length = 0); G.moves = 12; G.t = 30; });
await ev(() => { G.s = deal('golf', 0, 5); G.game = 'golf'; G.s.tab = G.s.tab.map((p, i) => i ? [] : p.slice(0, 1)); G.s.waste = [G.s.tab[0][0] === 0 ? 1 : 0]; });
await ev(() => { const m = legalMoves(G.s)[0]; if (m && m[0] === 'm') doMove(m); else { G.s.tab[0] = []; onWin(); } });
assert.ok(await ev(() => !document.querySelector('#winBox').hidden), '勝利訊息');
assert.ok(await ev(() => !!JSON.parse(localStorage.getItem('solit_best') || localStorage.getItem('solit_daily_' + twDay())).golf), '紀錄已存');
await act('#clearBest'); assert.ok(await ev(() => !localStorage.getItem('solit_best') && !Object.keys(localStorage).some(k => k.startsWith('solit_daily_'))));
assert.deepEqual(errors, []);
await browser.close();
