// game-tools：每日任務新增 / 勾選 / 刪除 / 上限 / 清除、DPS 比較與配置上下限、強化解析與模擬、390px 不溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'game-assist/game-tools.html');
const ev = (fn, ...a) => page.evaluate(fn, ...a);
const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
const text = (sel) => ev((s) => document.querySelector(s).textContent, sel);
await ev(() => { window.confirm = () => true; window.alert = () => { window.__alert = (window.__alert || 0) + 1; }; });
const tab = (t) => click(`#tabs [data-t=${t}]`);
const noOverflow = async (m) => assert.ok(await ev(() => document.documentElement.scrollWidth <= innerWidth), m + ' 橫向溢出');

// 每日
await ev(() => { document.querySelector('#gName').value = '遊戲A'; }); await click('#gAdd');
await ev(() => { const i = document.querySelector('#games .add input'); i.value = '打王'; }); await click('#games .add button');
await ev(() => { const i = document.querySelector('#games .add input'); i.value = '週任務'; document.querySelector('#games .add select').value = 'w'; }); await click('#games .add button');
assert.ok((await text('#dSum')).includes('0 / 1'));
await click('.tk input'); assert.ok((await text('#dSum')).includes('1 / 1'));
assert.ok((await text('#dSum')).includes('1 天'));
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('gametools_daily')).games[0].tasks.length), 2);
// 過了重置：把完成時間改成兩天前，重算後未完成
await ev(() => { const d = JSON.parse(localStorage.getItem('gametools_daily')); d.games[0].tasks[0].done = Date.now() - 2 * 86400e3; localStorage.setItem('gametools_daily', JSON.stringify(d)); });
await page.reload(); await ev(() => { window.confirm = () => true; });
assert.ok((await text('#dSum')).includes('0 / 1'));
await click('.tk .sm'); assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('gametools_daily')).games[0].tasks.length), 1);
// 上限
await ev(() => { window.__alert = 0; const d = JSON.parse(localStorage.getItem('gametools_daily')); d.games[0].tasks = Array.from({ length: 30 }, (_, i) => ({ id: 't' + i, name: 'x', kind: 'd', done: 0 })); localStorage.setItem('gametools_daily', JSON.stringify(d)); });
await page.reload(); await ev(() => { window.confirm = () => true; window.alert = () => { window.__alert = 1; }; });
await ev(() => { document.querySelector('#games .add input').value = '第31項'; }); await click('#games .add button');
assert.ok(await ev(() => window.__alert === 1 && JSON.parse(localStorage.getItem('gametools_daily')).games[0].tasks.length === 30), '滿了要拒絕');
await noOverflow('每日');
await click('#dClear'); assert.strictEqual(await ev(() => localStorage.getItem('gametools_daily')), null);

// DPS
await tab('pDps');
assert.ok((await text('#cmp')).includes('DPS 最高'));
await ev(() => { const i = document.querySelectorAll('#cfgs input[type=number]'); });
await click('#cAdd'); await click('#cAdd'); await click('#cAdd');
assert.strictEqual(await ev(() => document.querySelectorAll('#cfgs .gm').length), 5);
assert.ok(await ev(() => document.querySelector('#cAdd').hidden), '5 組後隱藏新增');
assert.ok((await text('#cfgs .gm')).includes('300'), '預設 DPS 300');
for (let i = 0; i < 3; i++) await click('#cfgs .gm .rm');
assert.strictEqual(await ev(() => document.querySelectorAll('#cfgs .gm').length), 2);
await click('#cfgs .gm .rm'); assert.strictEqual(await ev(() => document.querySelectorAll('#cfgs .gm').length), 2, '至少 2 組');
assert.strictEqual(await ev(() => JSON.parse(localStorage.getItem('gametools_opts')).dps.cfgs.length), 2);
await noOverflow('DPS');

// 強化
await tab('pEnh');
await ev(() => { const s = (id, v) => { const e = document.querySelector(id); e.value = v; e.oninput && e.oninput(); }; s('#eT', 1); s('#eP', 50); s('#eC', 100); });
assert.ok((await text('#eOut')).includes('200'), '解析 200');
await ev(() => { const e = document.querySelector('#eR'); e.value = 5000; }); await click('#eGo');
assert.ok(!(await ev(() => document.querySelector('#eSim').hidden)));
assert.ok((await text('#eSim')).includes('P99'));
assert.ok((await ev(() => document.querySelectorAll('#eSim .bar i').length)) === 20);
await noOverflow('強化');
assert.deepStrictEqual(errors.filter(e => !/favicon/.test(String(e))), []);
await browser.close();
console.log('ok  game-tools e2e');
