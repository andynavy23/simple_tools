// logic-puzzles 新增的 Kakuro 數和 / Flow 連線：真實點擊 / 拖曳完成題目、最佳紀錄、提示、悔棋、捲動切換、存檔接續、手機版面
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/logic-puzzles.html');
const ev = (f, ...a) => page.evaluate(f, ...a);
const ready = () => page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 30000 });
const noScroll = async (tag) => assert.ok(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動');
const reload = async () => { await page.reload({ waitUntil: 'load' }); await ready(); await ev(() => { window.confirm = () => true; }); };
await ev(() => { localStorage.clear(); window.confirm = () => true; }); await reload();
await ev(() => { window.confirm = () => true; });
const pick = async (t, size) => {
    await ev((t) => document.querySelector(`#tabs [data-t="${t}"]`).click(), t); await ready();
    if (size) { await page.select('#size', String(size)); await ready(); }
};

const rerollFlow = async () => { for (let i = 0; i < 30 && (await ev(() => G.puz.paths[0].length)) <= 2; i++) { await ev(() => document.querySelector('#new').click()); await ready(); } assert.ok((await ev(() => G.puz.paths[0].length)) > 2, '找不到第一條路徑有中間格的題目'); };

// 7 個分頁都在、按鈕夠大、不橫向溢出
assert.strictEqual(await ev(() => document.querySelectorAll('#tabs button').length), 7);

// ---- Kakuro ----
for (const n of [5, 9]) {
    await pick('kakuro', n);
    await noScroll('kakuro ' + n);
    assert.ok(await ev(() => document.querySelector('#board').getBoundingClientRect().width <= innerWidth), '盤面溢出');
    assert.ok(await ev(() => [...document.querySelectorAll('#pad button,#acts button,#tabs button')].every(b => b.getBoundingClientRect().height >= 44)), '按鍵高度');
    assert.strictEqual(await ev(() => document.querySelectorAll('#pad button').length), 10, '1–9 + 清除');
    assert.ok(await ev(() => document.querySelectorAll('#board .kc').length > 0 && document.querySelector('#board .kc .ka, #board .kc .kd') !== null), '線索格');
    assert.ok(await ev(() => document.querySelector('#flowbar').hidden && !document.querySelector('#mark').hidden));
    // 填一格 → 悔棋 / 重做 → 筆記
    await ev(() => { const i = G.board.findIndex((v, k) => !G.puz.g[k]); document.querySelector(`[data-i="${i}"]`).click(); document.querySelector('#pad [data-d="9"]').click(); });
    assert.strictEqual(await ev(() => G.hist.length), 1);
    await ev(() => document.querySelector('#undo').click()); assert.strictEqual(await ev(() => G.hist.length), 0);
    await ev(() => { document.querySelector('#mark').click(); document.querySelector('#pad [data-d="3"]').click(); document.querySelector('#pad [data-d="5"]').click(); });
    assert.strictEqual(await ev(() => document.querySelectorAll('#board .nt i:not(:empty)').length), 2, '筆記 3 與 5');
    await ev(() => document.querySelector('#mark').click());
    await ev(() => document.querySelector('#hint').click());
    assert.ok(await ev(() => document.querySelector('#msg').textContent.length > 0));
    await ev(() => document.querySelector('#check').click());
    await ev(() => document.querySelector('#restart').click());
    await ev(() => { const p = G.puz; p.sol.forEach((v, i) => { if (!p.g[i]) { document.querySelector(`[data-i="${i}"]`).click(); document.querySelector(`#pad [data-d="${v}"]`).click(); } }); });
    assert.ok(await ev(() => G.done), 'kakuro ' + n + ' 未完成');
    assert.ok(await ev((k) => JSON.parse(localStorage.getItem('logicp_best'))[k] >= 0, await ev(() => keyOf())), '最佳紀錄');
    await noScroll('kakuro 完成後');
}
// Kakuro 存檔接續
await pick('kakuro', 7);
const kseed = await ev(() => { const i = G.board.findIndex((v, k) => !G.puz.g[k]); document.querySelector(`[data-i="${i}"]`).click(); document.querySelector('#pad [data-d="4"]').click(); document.querySelector('#mark').click(); return G.seed; });
await reload();
assert.strictEqual(await ev(() => G.seed), kseed); assert.strictEqual(await ev(() => G.t), 'kakuro');
assert.ok(await ev(() => G.board.some((v, i) => v === 4 && !G.puz.g[i])), '接續進度');

// ---- Flow ----
const draw = async (paths) => {
    for (const pa of paths) {
        const pts = await ev((pa) => { const r = document.querySelector('#board').getBoundingClientRect(), n = G.puz.n; return pa.map(i => [r.left + (i % n + .5) * r.width / n, r.top + ((i / n | 0) + .5) * r.height / n]); }, pa);
        await page.mouse.move(...pts[0]); await page.mouse.down();
        for (const q of pts.slice(1)) await page.mouse.move(...q, { steps: 2 });
        await page.mouse.up();
    }
};
await pick('flow', 5);
await rerollFlow();
await noScroll('flow');
assert.ok(await ev(() => getComputedStyle(document.querySelector('#board')).touchAction === 'none'), '盤面 touch-action:none');
assert.ok(await ev(() => !document.querySelector('#flowbar').hidden && document.querySelector('#mark').hidden && document.querySelector('#pad').hidden));
assert.ok(await ev(() => [...document.querySelectorAll('#flowbar button,#acts button,#tabs button')].filter(b => !b.hidden).every(b => b.getBoundingClientRect().height >= 44)), '按鍵高度');
assert.ok(await ev(() => document.querySelectorAll('#board .dot').length === 2 * G.puz.k), '端點圓點');
// 捲動切換：開啟後 touch-action 還原且拖曳不畫線
await ev(() => document.querySelector('#scroll').click());
assert.ok(await ev(() => getComputedStyle(document.querySelector('#board')).touchAction !== 'none'), '捲動模式 touch-action');
await draw(await ev(() => [G.puz.paths[0]]));
assert.strictEqual(await ev(() => G.board.filter(Boolean).length), await ev(() => 2 * G.puz.k), '捲動模式不畫線');
await ev(() => document.querySelector('#scroll').click());
assert.ok(await ev(() => getComputedStyle(document.querySelector('#board')).touchAction === 'none'));
// 畫第一條 → 一步悔棋 / 重做
await draw(await ev(() => [G.puz.paths[0]]));
const hs = await ev(() => ({ hist: G.hist.length, len: G.puz.paths[0].length, n: G.puz.n, k: G.puz.k, cells: G.board.filter(Boolean).length, path: G.puz.paths[0].join(',') }));
assert.strictEqual(hs.hist, 1, '畫第一條後歷史應為 1：' + JSON.stringify(hs));
assert.strictEqual(await ev(() => G.board.filter(v => v === 1).length), await ev(() => G.puz.paths[0].length));
await ev(() => document.querySelector('#undo').click()); assert.strictEqual(await ev(() => G.board.filter(v => v === 1).length), 2);
await ev(() => document.querySelector('#redo').click()); assert.strictEqual(await ev(() => G.board.filter(v => v === 1).length), await ev(() => G.puz.paths[0].length));
// 壓到別色 = 切斷：用顏色 2 的端點拖過顏色 1 的格子
const cutOk = await ev(() => G.puz.paths.length > 1);
assert.ok(cutOk);
// 提示：第一條不同的顏色，畫出前半段（綠框）；再按悔棋回到提示前
await ev(() => document.querySelector('#restart').click());
await ev(() => document.querySelector('#hint').click());
assert.ok(await ev(() => document.querySelectorAll('#board .c.hint').length >= 3), '提示高亮');
assert.ok(await ev(() => document.querySelector('#msg').textContent.includes('提示')));
await ev(() => document.querySelector('#undo').click());
assert.strictEqual(await ev(() => G.board.filter(Boolean).length), await ev(() => 2 * G.puz.k));
await ev(() => document.querySelector('#check').click());
assert.ok(await ev(() => document.querySelector('#msg').textContent.includes('已連通')));
// 完整解：依答案拖曳
await ev(() => document.querySelector('#restart').click());
await draw(await ev(() => G.puz.paths));
assert.ok(await ev(() => G.done), 'flow 未完成');
assert.ok(await ev(() => document.querySelector('#msg').textContent.includes('完成')));
assert.ok(await ev(() => JSON.parse(localStorage.getItem('logicp_best'))['flow|1|5'] >= 0), 'flow 最佳紀錄');
await noScroll('flow 完成後');
// 其他尺寸排版
for (const n of [7, 9]) {
    await pick('flow', n); await noScroll('flow ' + n);
    assert.ok(await ev(() => { const r = document.querySelector('#board').getBoundingClientRect(); return r.width <= innerWidth && Math.abs(r.width - r.height) < 2; }), '盤面為正方形');
}
// 存檔接續（畫一條後重新整理）
await pick('flow', 6);
await rerollFlow();
const fseed = await ev(() => G.seed);
await draw(await ev(() => [G.puz.paths[0]]));
await reload();
assert.strictEqual(await ev(() => G.seed), fseed);
assert.strictEqual(await ev(() => G.board.filter(v => v === 1).length), await ev(() => G.puz.paths[0].length), '接續畫好的路徑');
// 每日挑戰同一題
await ev(() => document.querySelector('#daily').click()); await ready();
const s1 = await ev(() => G.puz.sol.join(''));
await ev(() => document.querySelector('#daily').click()); await ready();
await ev(() => document.querySelector('#daily').click()); await ready();
assert.strictEqual(await ev(() => G.puz.sol.join('')), s1, '同一天同一題');
// 壞存檔容錯：Flow 盤面值超出範圍
await ev(() => localStorage.setItem('logicp_game', JSON.stringify({ t: 'flow', level: 1, size: 5, seed: 'x', sig: 'z', daily: null, board: Array(25).fill(99), notes: Array(25).fill(0), secs: 1, done: false })));
await reload();
assert.ok(await ev(() => !!G && G.board.length === G.size * G.size));
assert.deepStrictEqual(errors, []);
await browser.close();
