// arcade（迷你街機）：六款遊戲可開始 / 操作 / 結束、最高分存取與壞資料、每日種子、頁面隱藏暫停、reduced-motion、手機版面
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/arcade.html');
const ev = (f, ...a) => page.evaluate(f, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ptr = (type, x, y) => ev((t, x, y) => { const c = document.querySelector('#cv'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent(t, { clientX: r.left + x * r.width / 360, clientY: r.top + y * r.height / 480, pointerId: 1, bubbles: true, cancelable: true })); }, type, x, y);
const key = async (k, down = true) => { await page.keyboard[down ? 'down' : 'up'](k); };
const tab = (id) => ev((i) => document.querySelector(`#tabs button[data-g="${i}"]`).click(), id);
const go = () => ev(() => document.querySelector('#go').click());
const st = () => ev(() => state);
const noScroll = async (tag) => assert.ok(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動');
const finish = async (score) => { await ev((s) => { G.score = s; G.over = true; }, score); await page.waitForFunction(() => state === 'over'); };
const cvScroll = () => ev(() => getComputedStyle(document.querySelector('#cv')).touchAction);
await ev(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });

// 版面
await noScroll('選單');
assert.strictEqual(await ev(() => document.querySelectorAll('#tabs button').length), 6);
assert.ok(await ev(() => [...document.querySelectorAll('select,input:not([type=checkbox]),textarea')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16)), '輸入字級');
assert.ok(await ev(() => document.querySelector('#cv').getBoundingClientRect().width <= innerWidth), 'canvas 溢出');
assert.strictEqual(await cvScroll(), 'auto', '選單時 canvas 不鎖手勢');
assert.ok(await ev(() => document.querySelector('#cv').width >= 390), 'canvas 依 DPR 縮放');

// 打地鼠
await tab('mole'); await go(); assert.strictEqual(await st(), 'play');
assert.strictEqual(await cvScroll(), 'none', '遊戲中鎖手勢');
await ev(() => { document.querySelector('#panMode').click(); }); assert.strictEqual(await cvScroll(), 'pan-y', '捲動模式'); await ev(() => document.querySelector('#panMode').click());
await page.waitForFunction(() => G.holes.some(h => h.up > 0));
const hp = await ev(() => { const i = G.holes.findIndex(h => h.up > 0); return G.pos(i); });
await ptr('pointerdown', hp.x, hp.y); await ptr('pointerup', hp.x, hp.y);
assert.strictEqual(await ev(() => G.score), 10, '打中地鼠 +10');
await noScroll('遊戲中');
await finish(70);
assert.ok((await ev(() => document.querySelector('#ovP').textContent)).includes('新紀錄'));
assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best).mole), 70);
assert.strictEqual(await cvScroll(), 'auto', '結束後可捲動');
await go(); assert.strictEqual(await st(), 'over', '剛結束時防誤觸再玩');
await sleep(700); await go(); assert.strictEqual(await st(), 'play', '再玩一次');
await finish(30); assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best).mole), 70, '較低分不覆蓋');

// 接水果
await tab('fruit'); await go();
await ptr('pointerdown', 300, 300); await ptr('pointermove', 300, 300); await sleep(100);
assert.ok(await ev(() => G.bx > 250), '拖曳籃子');
await key('ArrowLeft'); await sleep(250); await key('ArrowLeft', false);
assert.ok(await ev(() => G.tx < 280), '鍵盤移動');
await ev(() => { G.items.push({ x: G.bx, y: 430, vy: 10, type: 'fruit', kind: 0 }); }); await sleep(120);
assert.ok(await ev(() => G.score >= 1), '接到水果');
await finish(12); assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best).fruit), 12);

// 打磚塊
await tab('brick'); await go();
await ptr('pointerdown', 100, 300); await ptr('pointerup', 100, 300); await sleep(100);
assert.ok(await ev(() => G.balls.some(b => !b.stuck)), '點一下發球'); assert.ok(await ev(() => G.px < 150));
await key(' '); await key(' ', false);
await ev(() => { G.bricks.length = 1; G.balls = [{ x: G.bricks[0].x + 19, y: G.bricks[0].y + 30, vx: 0, vy: -260, stuck: false }]; }); await sleep(300);
assert.ok(await ev(() => G.level === 2 && G.score >= 60), '打碎最後一塊進下一關');
await finish(5); assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best).brick), 5);

// 恐龍跳
await tab('dino'); await go();
await key(' '); await sleep(60); assert.ok(await ev(() => G.y > 0), '跳躍'); await key(' ', false);
await ev(() => { G.over = false; }); await sleep(800);
await ptr('pointerdown', 180, 450); assert.ok(await ev(() => G.duck), '按住下方蹲下'); await ptr('pointerup', 180, 450);
await ev(() => { G.obs = [{ x: 62, kind: 'c1', w: 18, h: 36, y: 0 }]; G.y = 0; G.vy = 0; }); await sleep(200);
assert.strictEqual(await st(), 'over', '撞到仙人掌結束');
await tab('dino'); await go(); await finish(900);
assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best).dino), 900);

// Flappy
await tab('flappy'); await go();
await key(' '); await key(' ', false); assert.ok(await ev(() => G.started && G.vy < 0), '拍翅');
await sleep(300); await ev(() => { G.y = 600; }); await page.waitForFunction(() => state === 'over'); // 落地結束
await tab('flappy'); await go(); await finish(40);
assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best).flappy), 40);

// 切水果
await tab('slice'); await go();
await ev(() => { G.items.push({ x: 180, y: 240, vx: 0, vy: 0, r: 24, type: 'fruit', kind: 0, cut: false }); });
await ptr('pointerdown', 100, 240); await ptr('pointermove', 260, 240); await ptr('pointerup', 260, 240);
assert.ok(await ev(() => G.score >= 1), '切到水果');
await ev(() => { G.items.push({ x: 180, y: 300, vx: 0, vy: 0, r: 24, type: 'bomb', kind: 0, cut: false }); });
await ptr('pointerdown', 100, 300); await ptr('pointermove', 260, 300); await ptr('pointerup', 260, 300);
await page.waitForFunction(() => state === 'over'); // 切到炸彈結束
await tab('slice'); await go(); await finish(8);
assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best).slice), 8);

// 最高分顯示與重新載入
await page.reload({ waitUntil: 'load' }); await tab('mole'); assert.strictEqual(await ev(() => document.querySelector('#best').textContent), '70');

// 壞資料容錯
for (const bad of ['[1,2]', '{"mole":-5,"dino":"x","fruit":1e30}', 'null', '{oops', '"s"']) {
    await ev((b) => localStorage.setItem('arcade_best', b), bad); await page.reload({ waitUntil: 'load' });
    await tab('mole'); assert.strictEqual(await ev(() => document.querySelector('#best').textContent), '0', bad);
    await go(); assert.strictEqual(await st(), 'play'); await finish(3);
    assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best).mole), 3, bad + ' 結束後寫回乾淨資料');
}
await tab('fruit'); await ev(() => { localStorage.setItem('arcade_best', '{"fruit":1e30}'); }); await page.reload({ waitUntil: 'load' }); await tab('fruit');
assert.strictEqual(await ev(() => document.querySelector('#best').textContent), '1000000000', '過大截斷');

// 每日種子：同日同序列、每日最高分、只留 30 筆
await ev(() => { for (let i = 1; i <= 40; i++) localStorage.setItem('arcade_daily_2025-01-' + String(i).padStart(2, '0'), '{"dino":1}'); localStorage.setItem('arcade_daily_junk', '1'); });
await page.reload({ waitUntil: 'load' }); await tab('dino'); assert.ok(await ev(() => !document.querySelector('#dailyL').hidden));
await tab('mole'); assert.ok(await ev(() => document.querySelector('#dailyL').hidden)); await tab('dino');
await ev(() => document.querySelector('#daily').click()); await go();
const s1 = await ev(() => ({ seed: G.seed, obs: G.obs.map(o => [Math.round(o.x), o.kind]) })); await finish(11);
const day = await ev(() => taipeiDay());
assert.strictEqual(s1.seed, day); assert.strictEqual(await ev((d) => JSON.parse(localStorage['arcade_daily_' + d]).dino, day), 11);
assert.ok((await ev(() => Object.keys(localStorage).filter(k => k.startsWith('arcade_daily_')).length)) <= 30, '每日鍵上限 30');
assert.ok(await ev(() => localStorage.getItem('arcade_daily_junk') === null && localStorage.getItem('arcade_daily_2025-01-01') === null));
assert.strictEqual(await ev(() => JSON.parse(localStorage.arcade_best || '{}').dino), undefined, '每日分數不混進一般最高分');
await sleep(700); await go();
const s2 = await ev(() => ({ seed: G.seed, obs: G.obs.map(o => [Math.round(o.x), o.kind]) }));
assert.deepStrictEqual(s2, s1, '同日同障礙序列'); await finish(2);
assert.strictEqual(await ev((d) => JSON.parse(localStorage['arcade_daily_' + d]).dino, day), 11, '每日較低分不覆蓋');

// 頁面隱藏自動暫停與繼續
await tab('mole'); await go(); await sleep(150);
await ev(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
assert.ok(await ev(() => paused && !document.querySelector('#ov').hidden), '隱藏時暫停');
const t1 = await ev(() => G.info()); await sleep(400); assert.strictEqual(await ev(() => G.info()), t1, '暫停時不前進');
await ev(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
await go(); assert.ok(await ev(() => !paused), '繼續');
await ev(() => document.querySelector('#pauseBtn').click()); assert.ok(await ev(() => paused), '暫停鈕');
await key('p'); await key('p', false); assert.ok(await ev(() => !paused), 'P 鍵繼續');
await finish(0);

// 清除最高分
await ev(() => { window.confirm = () => true; localStorage.setItem('arcade_best', '{"mole":5}'); localStorage.setItem('arcade_daily_2026-10-01', '{"dino":5}'); localStorage.setItem('other', '1'); });
await ev(() => document.querySelector('#clearBest').click());
await page.waitForFunction(() => localStorage.getItem('arcade_best') === null);
assert.ok(await ev(() => localStorage.getItem('arcade_daily_2026-10-01') === null && localStorage.getItem('other') === '1'), '只清自己的鍵');

// reduced-motion：照常可玩
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.reload({ waitUntil: 'load' }); assert.ok(await ev(() => rm()));
for (const id of ['mole', 'slice']) { await tab(id); await go(); await sleep(150); assert.strictEqual(await st(), 'play'); await finish(0); }

await noScroll('結束');
assert.deepStrictEqual(errors, []);
await browser.close();
console.log('ok   arcade e2e');
