// level-puzzles：推箱子（照解答走完 → 過關、存紀錄、悔棋、點格走位）、塞車（點車點格移動、提示、過關）、清除進度、壞資料、390px 無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const REL = 'mini-games/level-puzzles.html';
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);

{
    const { page, errors } = await openPage(browser, REL);
    await ev(page, () => { window.confirm = () => true; });
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');
    // 推箱子：第 1 關照解答走（方向鍵按鈕）
    const sol = await ev(page, () => SOK[0].s);
    for (const ch of sol) await ev(page, (d) => document.querySelector(`#pad [data-d="${d}"]`).click(), ch.toLowerCase());
    assert.ok((await ev(page, () => document.querySelector('#msg').textContent)).includes('過關'));
    assert.deepStrictEqual(await ev(page, () => JSON.parse(localStorage.lvlp_progress).s[0][0]), sol.length);
    // 悔棋回到上一步後可再走回
    await click(page, '#undo');
    assert.ok(await ev(page, () => !done));
    // 點格走位：點玩家旁邊的空格 → 玩家移動、一次悔棋退回
    await click(page, '#reset');
    const moved = await ev(page, () => { const o = []; for (let i = 0; i < L.W * L.H; i++) { const p = sokWalk(L, S, i); if (p && p.length === 1) o.push(i); } if (!o.length) return -1; document.querySelector(`#sk [data-i="${o[0]}"]`).click(); return 0; });
    assert.strictEqual(moved, 0, '點相鄰格應移動');
    assert.strictEqual(await ev(page, () => moves), 1);
    await click(page, '#undo'); assert.strictEqual(await ev(page, () => moves), 0);
    // 塞車：切換後用提示一步步解到過關
    await ev(page, () => document.querySelector('#tabs [data-g="r"]').click());
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '塞車橫向溢出');
    const n = await ev(page, () => RH[0].n);
    for (let k = 0; k < n; k++) {
        await click(page, '#hint');
        await ev(page, () => document.querySelector('#rh [data-i="' + tgt + '"]').click());
    }
    assert.ok((await ev(page, () => document.querySelector('#msg').textContent)).includes('過關'), '塞車第 1 關照提示應過關');
    assert.ok(await ev(page, () => JSON.parse(localStorage.lvlp_progress).r[0] === RH[0].n));
    // 清除進度
    await click(page, '#clear');
    assert.ok(await ev(page, () => { const p = JSON.parse(localStorage.lvlp_progress); return !Object.keys(p.s).length && !Object.keys(p.r).length; }));
    assert.deepStrictEqual(errors, []);
    await page.close();
}
// 壞資料不會讓頁面壞掉
{
    const { page, errors } = await openPage(browser, REL);
    for (const bad of ['null', '"x"', '{"s":5,"r":[1]}', '{"s":{"0":[null,2]},"r":{"0":"a"}}', '{bad']) {
        await ev(page, (b) => localStorage.setItem('lvlp_progress', b), bad);
        await page.reload();
        assert.ok(await ev(page, () => document.querySelectorAll('#lv button').length >= 30), bad);
    }
    assert.deepStrictEqual(errors, []);
}
console.log('level-puzzles e2e ok');
await browser.close();
