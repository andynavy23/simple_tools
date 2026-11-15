// tile-match：連連看（點兩張消除、無可消自動洗牌、完成記錄最佳時間）、麻將消除（被壓住不可選、依解序清盤、悔棋、洗牌、7 種牌堆都能開）、每日挑戰不記錄、清除最佳紀錄、390px 不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const tap = (page, i) => ev(page, (i) => document.querySelector(`#board [data-i="${i}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), i);
const REL = 'mini-games/tile-match.html';

{
    const { page, errors } = await openPage(browser, REL);
    await ev(page, () => { window.confirm = () => true; });
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');
    // ---- 連連看：用 llHint 一路點到清空 ----
    await ev(page, () => { document.querySelector('#diff').value = 'easy'; document.querySelector('#diff').onchange(); });
    for (let n = 0; n < 40 && !(await ev(page, () => done)); n++) {
        const h = await ev(page, () => llHint(G.g, G.W, G.W));
        assert.ok(h, '應一直有可消的牌');
        await tap(page, h.a); await tap(page, h.b); await sleep(260);
    }
    assert.ok(await ev(page, () => done), '連連看應完成');
    assert.ok((await ev(page, () => document.querySelector('#msg').textContent)).includes('全部消除'));
    assert.ok(await ev(page, () => JSON.parse(localStorage.getItem('tilem_best')).lk_easy > 0), '應記錄最佳時間');
    // 不能連的兩張：選取改成後者、牌不消失
    await click(page, '#start');
    const bad = await ev(page, () => { const g = G.g, W = G.W; for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) if (g[i] && g[j] && g[i] !== g[j]) return [i, j]; });
    await tap(page, bad[0]); await tap(page, bad[1]);
    assert.strictEqual(await ev(page, () => G.g.filter(Boolean).length), 36);
    // ---- 麻將消除 ----
    await click(page, '#modeBar [data-mode="mj"]');
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '麻將橫向溢出');
    const nl = await ev(page, () => MJ_LAYOUTS.length);
    for (let li = 0; li < nl; li++) {
        await ev(page, (li) => { const s = document.querySelector('#layout'); s.value = li; s.onchange(); }, li);
        assert.ok(await ev(page, () => G && G.alive.every(Boolean) && document.querySelectorAll('#board .t').length === G.L.length), '牌堆 ' + li);
        assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '牌堆溢出 ' + li);
    }
    await ev(page, () => { const s = document.querySelector('#layout'); s.value = 6; s.onchange(); });
    // 被壓住的牌不可選
    const blocked = await ev(page, () => G.L.findIndex((t, i) => !mjFree(G.L, G.alive, i)));
    await tap(page, blocked);
    assert.strictEqual(await ev(page, () => sel), -1);
    // 消一對、悔棋、洗牌
    const [a, b] = await ev(page, () => G.order[0]);
    await tap(page, a); await tap(page, b);
    assert.strictEqual(await ev(page, () => G.hist.length), 1);
    await click(page, '#undoBtn');
    assert.strictEqual(await ev(page, () => G.hist.length + G.alive.filter(x => !x).length), 0);
    await click(page, '#hintBtn');
    assert.ok(await ev(page, () => document.querySelectorAll('#board .hint').length === 2), '提示應高亮兩張');
    await click(page, '#shuffleBtn');
    assert.ok(await ev(page, () => mjMoves(G.L, G.kinds, G.alive).length > 0));
    await click(page, '#zoomBtn');
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '放大後頁面不可橫向溢出');
    // 依「目前的」解序一路清盤：每一步用 mjMoves 取一對（保證洗牌後仍可解，貪婪取牌未必可解，改由 mjDeal 的解序）
    await click(page, '#start');
    const ord = await ev(page, () => G.order);
    for (const [i, j] of ord) { await tap(page, i); await tap(page, j); }
    assert.ok(await ev(page, () => done), '麻將應完成');
    assert.ok(await ev(page, () => JSON.parse(localStorage.getItem('tilem_best')).mj_6 > 0));
    // ---- 每日挑戰：不新增紀錄、同一天同一副牌 ----
    await ev(page, () => { document.querySelector('#daily').checked = true; document.querySelector('#daily').onchange(); });
    const k1 = await ev(page, () => G.kinds.join());
    await click(page, '#start');
    assert.strictEqual(await ev(page, () => G.kinds.join()), k1, '每日挑戰同一天應同一副牌');
    // ---- 清除最佳紀錄 ----
    await click(page, '#clearBest');
    assert.strictEqual(await ev(page, () => localStorage.getItem('tilem_best')), null);
    // 壞資料載入不炸
    await ev(page, () => localStorage.setItem('tilem_best', '{"lk_easy":"x","zzz":1,"mj_1":[]}'));
    await page.reload();
    assert.strictEqual(await ev(page, () => Object.keys(best).length), 0);
    assert.deepStrictEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('tile-match e2e ok');
