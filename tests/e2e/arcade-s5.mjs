// arcade 新增的吃豆人 / 彈珠台：開始 / 鍵盤與滑動操控 / 左右擋板與發射 / 暫停 / 結束記錄最高分 / 手機版面
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/arcade.html');
const ev = (f, ...a) => page.evaluate(f, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ptr = (type, x, y, id = 1) => ev((t, x, y, id) => { const c = document.querySelector('#cv'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent(t, { clientX: r.left + x * r.width / 360, clientY: r.top + y * r.height / 480, pointerId: id, bubbles: true, cancelable: true })); }, type, x, y, id);
const tab = (id) => ev((i) => document.querySelector(`#tabs button[data-g="${i}"]`).click(), id);
const go = () => ev(() => document.querySelector('#go').click());
const noScroll = async (tag) => assert.ok(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動');
await ev(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });

// 吃豆人
await tab('pacman'); await noScroll('吃豆人選單'); await go();
assert.strictEqual(await ev(() => state), 'play');
assert.strictEqual(await ev(() => getComputedStyle(document.querySelector('#cv')).touchAction), 'none');
await page.waitForFunction(() => G.s.ready <= 0, { timeout: 5000 });
await page.keyboard.down('ArrowRight'); await page.keyboard.up('ArrowRight');
await page.waitForFunction(() => G.s.score > 0, { timeout: 6000 });
// 滑動手勢轉向（只在畫布上）：往上滑
await ptr('pointerdown', 180, 300); await ptr('pointermove', 180, 250); await ptr('pointerup', 180, 250);
assert.deepStrictEqual(await ev(() => G.s.pac.want), [0, -1]);
await ptr('pointerdown', 180, 300); await ptr('pointermove', 230, 302); await ptr('pointerup', 230, 302);
assert.deepStrictEqual(await ev(() => G.s.pac.want), [1, 0]);
// 暫停：頁面隱藏時自動暫停，遊戲狀態不再前進
const t0 = await ev(() => G.s.t);
await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
assert.ok(await ev(() => paused), '隱藏頁面自動暫停');
await sleep(300); assert.strictEqual(await ev(() => G.s.t), t0);
await ev(() => { delete document.hidden; }); await go(); assert.ok(!(await ev(() => paused)));
// 結束 → 記錄最高分
await ev(() => { G.s.score = 1230; G.s.over = true; }); await page.waitForFunction(() => state === 'over');
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('arcade_best')).pacman), 1230);
await noScroll('吃豆人結束');

// 彈珠台
await tab('pinball'); await noScroll('彈珠台選單'); await go();
assert.strictEqual(await ev(() => state), 'play');
// 觸控：左 / 右半邊 = 擋板，最右側 = 蓄力；多指不互相放開
await ptr('pointerdown', 60, 300, 1); assert.deepStrictEqual(await ev(() => [G.s.L, G.s.R, G.s.pull]), [true, false, false]);
await ptr('pointerdown', 250, 300, 2); assert.deepStrictEqual(await ev(() => [G.s.L, G.s.R]), [true, true]);
await ptr('pointerup', 60, 300, 1); assert.deepStrictEqual(await ev(() => [G.s.L, G.s.R]), [false, true], '放開一指只放那一邊');
await ptr('pointerup', 250, 300, 2);
await ptr('pointerdown', 340, 400, 3); await page.waitForFunction(() => G.s.charge > .3, { timeout: 4000 });
await ptr('pointerup', 340, 400, 3); await page.waitForFunction(() => !G.s.b || !G.s.b.lane, { timeout: 2000 });
// 鍵盤
await page.keyboard.down('ArrowLeft'); assert.ok(await ev(() => G.s.L)); await page.keyboard.up('ArrowLeft'); assert.ok(!(await ev(() => G.s.L)));
await page.keyboard.down('/'); assert.ok(await ev(() => G.s.R)); await page.keyboard.up('/');
await page.keyboard.down('z'); assert.ok(await ev(() => G.s.L)); await page.keyboard.up('z');
// 暫停會放開所有按鍵
await page.keyboard.down('ArrowRight'); await ev(() => document.querySelector('#pauseBtn').click()); assert.ok(!(await ev(() => G.s.R)));
await ev(() => document.querySelector('#go').click());
// 三顆球打完結束
await ev(() => { G.s.balls = 1; G.s.b.lane = false; G.s.b.y = 495; G.s.score = 777; });
await page.waitForFunction(() => state === 'over', { timeout: 3000 });
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('arcade_best')).pinball), 777);
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('arcade_best')).pacman), 1230, '舊紀錄保留');
// 清除最高分涵蓋新遊戲
await ev(() => { window.confirm = () => true; });
await Promise.all([page.waitForNavigation(), ev(() => document.querySelector('#clearBest').click())]);
assert.strictEqual(await ev(() => localStorage.getItem('arcade_best')), null);
await noScroll('清除後');
assert.deepStrictEqual(errors, []);
await browser.close();
console.log('ok   arcade-s5 e2e');
