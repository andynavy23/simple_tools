// logic-puzzles（邏輯謎題）：五種謎題開局→填入求解器答案→勝利與最佳紀錄、每日挑戰、壞存檔容錯、清除、手機版面
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/logic-puzzles.html');
const ev = (f, ...a) => page.evaluate(f, ...a);
const ready = () => page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 20000 });
const noScroll = async (tag) => assert.ok(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動');
const reload = async () => { await page.reload({ waitUntil: 'load' }); await ready(); };
await ev(() => { localStorage.clear(); window.confirm = () => true; }); await reload();
await ev(() => { window.confirm = () => true; });

// 依求解器的答案用真實點擊填完
const solve = () => ev(() => {
    const click = (s) => document.querySelector(s).click();
    const p = G.puz, T = G.t, n = p.n;
    if (T === 'lightsout') loBest(G.board, n).forEach((v, i) => { if (v) click(`[data-i="${i}"]`); });
    else if (T === 'akari') p.sol.forEach((v, i) => { if (v) click(`[data-i="${i}"]`); });
    else p.sol.forEach((v, i) => { if (!p.g[i]) { click(`[data-i="${i}"]`); click(`#pad [data-d="${v}"]`); } });
});
const pick = async (t) => {
    await ev((t) => document.querySelector(`#tabs [data-t="${t}"]`).click(), t); await ready();
    const min = await ev(() => Math.min(...[...document.querySelectorAll('#size option')].map(o => +o.value)));
    await page.select('#size', String(min)); await ready();
};
for (const t of ['takuzu', 'futoshiki', 'skyscrapers', 'lightsout', 'akari']) {
    await pick(t);
    await noScroll(t);
    assert.ok(await ev(() => document.querySelector('#board').getBoundingClientRect().width <= innerWidth), t + ' 盤面溢出');
    assert.ok(await ev(() => [...document.querySelectorAll('#pad button,#acts button,#tabs button')].every(b => b.getBoundingClientRect().height >= 44)), t + ' 按鍵高度');
    assert.ok(await ev(() => [...document.querySelectorAll('select')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16)), '字級');
    // 悔棋 / 重做
    if (t !== 'akari') await ev(() => { const T = G.t; if (T === 'lightsout') document.querySelector('[data-i="0"]').click(); else { const i = G.board.findIndex((v, k) => !G.puz.g[k]); document.querySelector(`[data-i="${i}"]`).click(); document.querySelector('#pad [data-d="1"]').click(); } });
    else await ev(() => document.querySelector('[data-i="' + G.puz.sol.indexOf(1) + '"]').click());
    assert.strictEqual(await ev(() => G.hist.length), 1);
    await ev(() => document.querySelector('#undo').click()); assert.strictEqual(await ev(() => G.hist.length), 0);
    await ev(() => document.querySelector('#redo').click()); assert.strictEqual(await ev(() => G.hist.length), 1);
    await ev(() => document.querySelector('#hint').click());
    assert.ok(await ev(() => document.querySelector('#msg').textContent.length > 0), t + ' 提示訊息');
    await ev(() => document.querySelector('#check').click());
    await ev(() => document.querySelector('#restart').click());
    assert.strictEqual(await ev(() => G.hist.length), 0);
    await solve();
    assert.ok(await ev(() => G.done), t + ' 未完成');
    assert.ok(await ev(() => document.querySelector('#msg').textContent.includes('完成')));
    const key = await ev(() => keyOf());
    assert.ok(await ev((k) => JSON.parse(localStorage.getItem('logicp_best'))[k] >= 0, key), t + ' 最佳紀錄');
    await noScroll(t + ' 完成後');
}

// 重新整理接續進行中的題目
await pick('takuzu');
const seed = await ev(() => { const i = G.board.findIndex((v, k) => !G.puz.g[k]); document.querySelector(`[data-i="${i}"]`).click(); document.querySelector('#pad [data-d="2"]').click(); return G.seed; });
await reload();
assert.strictEqual(await ev(() => G.seed), seed); assert.strictEqual(await ev(() => G.board.filter(v => v).length > G.puz.g.filter(v => v).length), true);

// 每日挑戰
await ev(() => document.querySelector('#daily').click()); await ready();
const day = await ev(() => G.daily); assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(day));
const sol1 = await ev(() => G.puz.sol.join(''));
await ev(() => document.querySelector('#daily').click()); await ready();
await ev(() => document.querySelector('#daily').click()); await ready();
assert.strictEqual(await ev(() => G.puz.sol.join('')), sol1, '同一天同一題');
await solve();
assert.ok(await ev(() => G.done));
assert.ok(await ev((d) => !!localStorage.getItem('logicp_daily_' + d), day), '每日完成鍵');
// 舊的每日鍵只留最近 30 筆
await ev(() => { for (let i = 1; i <= 40; i++) localStorage.setItem('logicp_daily_2020-01-' + String(i % 28 + 1).padStart(2, '0') + (i > 28 ? '' : ''), '{}'); for (let m = 2; m <= 4; m++) for (let d = 1; d <= 20; d++) localStorage.setItem(`logicp_daily_2020-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, '{}'); });
await reload();
assert.ok(await ev(() => Object.keys(localStorage).filter(k => k.startsWith('logicp_daily_')).length <= 30), '每日鍵上限');

// 壞存檔 / 壞最佳紀錄容錯
for (const bad of ['{bad', 'null', '[]', '{"t":"akari","level":1,"size":5,"seed":"x","sig":"z","daily":null,"board":[1],"notes":[],"secs":1,"done":false}', '{"t":"takuzu","level":1,"size":6,"seed":"x","sig":"nope","daily":null,"board":' + JSON.stringify(Array(36).fill(0)) + ',"notes":' + JSON.stringify(Array(36).fill(0)) + ',"secs":1,"done":false}']) {
    await ev((b) => { localStorage.setItem('logicp_game', b); localStorage.setItem('logicp_best', '[1,"x"]'); }, bad);
    await reload();
    assert.ok(await ev(() => !!G && G.board.length === G.size * G.size), '壞存檔應重新開局：' + bad.slice(0, 20));
}
await ev(() => localStorage.setItem('logicp_best', '{"takuzu|1|6":"abc","akari|1|5":-3,"zzz":1}')); await reload();
assert.strictEqual(await ev(() => document.querySelector('#best').textContent), '—');

// 清除
await ev(() => { localStorage.setItem('logicp_best', '{"takuzu|1|6":50}'); localStorage.setItem('other_key', '1'); });
await ev(() => { window.confirm = () => true; window.__m = 1; document.getElementById('clearBest').click(); });
await page.waitForFunction(() => !window.__m && document.body.dataset.ready === '1', { timeout: 20000 });
assert.ok(await ev(() => !localStorage.getItem('logicp_best') && localStorage.getItem('other_key') === '1'), '清除只動 logicp_*');
assert.deepStrictEqual(errors, []);
await browser.close();
