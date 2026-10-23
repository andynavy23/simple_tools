// 抽象棋類：每種棋開局、落子、電腦回應、悔棋；壞存檔容錯；390px 無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/abstract-boards.html');
const tap = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error('找不到 ' + s); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, sel);
const idle = () => page.waitForFunction('S && !busy && (cfg.mode === "two" || S.p === human)', { timeout: 15000 });
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

// 壞存檔
await page.evaluate(() => { localStorage.setItem('abstractb_stats', '{"nmm|easy":"x","man|hard":{"w":-3,"l":"a","d":1e99},"__proto__":1}'); localStorage.setItem('abstractb_opts', '[1,2]'); });
await page.reload({ waitUntil: 'load' });
assert.ok((await page.$eval('#stats', e => e.textContent)).includes('0 / 0 / 0'));
await page.evaluate(() => { localStorage.setItem('abstractb_stats', 'null'); localStorage.setItem('abstractb_opts', '{"g":"zzz","level":"constructor","first":5}'); });
await page.reload({ waitUntil: 'load' });
assert.strictEqual(await page.evaluate(() => cfg.g + cfg.level), 'nmmnormal');

// 每種棋：第一手 -> 電腦回應 -> 悔棋
const moves = {
    nmm: ['[data-i="0"]'], man: ['[data-i="0"]'], dab: ['[data-i="0"]'], hex: ['[data-i="40"]', '[data-i="40"]'],
    fg: ['[data-i="30"]', '[data-i="23"]'], c6: ['[data-i="112"]', '[data-i="112"]'], rj: ['[data-i="112"]', '[data-i="112"]'],
};
for (const k of Object.keys(moves)) {
    await tap(`#tabs [data-g="${k}"]`);
    await page.select('#level', 'easy'); await page.select('#first', 'me');
    await tap('#start'); await idle();
    assert.ok(await overflow() <= 0, k + ' 開局橫向溢出');
    for (const s of moves[k]) await tap('#boardBox ' + s);
    await page.waitForFunction('hist.length >= 1', { timeout: 5000 });
    await idle();
    const n = await page.evaluate(() => hist.length);
    assert.ok(n >= 2, k + ' 電腦沒有回應 hist=' + n);
    assert.ok(await overflow() <= 0, k + ' 落子後橫向溢出');
    await tap('#undo');
    assert.strictEqual(await page.evaluate(() => hist.length), 0, k + ' 悔棋未回到開局');
    await tap('#hint'); // 提示不應丟例外
}
// 縮放 / 同機雙人 / 點格 7×7
await tap('#tabs [data-g="hex"]'); await page.select('#hexN', '11'); await tap('#start'); await tap('#zoom');
assert.ok(await overflow() <= 0, 'Hex 放大後橫向溢出');
await tap('#tabs [data-g="dab"]'); await page.select('#dabN', '7'); await page.select('#mode', 'two'); await tap('#start');
assert.ok(await overflow() <= 0, '點格 7×7 溢出');
await tap('#boardBox [data-i="0"]'); assert.strictEqual(await page.evaluate(() => S.p), 1);
await tap('#undo'); assert.strictEqual(await page.evaluate(() => S.p), 0);
assert.deepStrictEqual(errors, []);
await browser.close();
console.log('ok abstract-boards e2e');
