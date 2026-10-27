// kids-play（兒童遊樂）：五個遊戲各開局操作一次、著色匯出 PNG、家長設定、壞資料容錯、390px 無橫向溢出與捲動切換
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/kids-play.html');
const ev = (f, ...a) => page.evaluate(f, ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
const tab = (g) => click(`#tabs button[data-g="${g}"]`);
const noScroll = async (tag) => assert.ok(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), tag + '：橫向捲動');
const KEY = 'kidsp_progress';
const prog = () => ev((k) => JSON.parse(localStorage.getItem(k)), KEY);
await ev(() => localStorage.clear()); await page.reload({ waitUntil: 'load' });

// 版面
await noScroll('找不同');
assert.ok(await ev(() => [...document.querySelectorAll('select,input:not([type=checkbox]),textarea')].every(e => parseFloat(getComputedStyle(e).fontSize) >= 16)), '輸入字級');
assert.ok(await ev(() => [...document.querySelectorAll('#tabs button')].every(b => b.getBoundingClientRect().height >= 44)), '分頁鈕 ≥44');

// 找不同：點出全部差異（先點一個錯的不扣分）、提示、存進度
let sc = await ev(() => SP.scene);
const miss = [...Array(sc.a.length).keys()].find(i => !sc.diffs.includes(i));
await ev((i) => document.querySelectorAll('#spA button')[i].click(), miss);
assert.ok((await ev(() => document.querySelector('#spotMsg').textContent)).includes('再找找看'));
await click('#spotHint');
assert.strictEqual(await ev(() => document.querySelectorAll('#spA .hint').length), 1);
for (const i of sc.diffs) await ev((i) => document.querySelectorAll('#spB button')[i].click(), i);
assert.ok((await ev(() => document.querySelector('#spotMsg').textContent)).includes('全部找到'));
let p = await prog(); assert.strictEqual(p.spot[0][0], 1); assert.ok(p.spot[0][1] >= 1);
await noScroll('找不同完成');
await click('#spotNew'); assert.strictEqual(await ev(() => SP.found.length), 0);

// 點點連線：依序點（用 DOM 座標換算的 pointer 事件）、拖曳、捲動切換
await tab('dots');
await noScroll('點點連線');
const dptr = (type, x, y) => ev((t, x, y) => { const s = document.querySelector('#dSvg'), r = s.getBoundingClientRect(); s.dispatchEvent(new PointerEvent(t, { clientX: r.left + x * r.width / 100, clientY: r.top + y * r.height / 100, pointerId: 1, bubbles: true })); }, type, x, y);
assert.strictEqual(await ev(() => getComputedStyle(document.querySelector('#dSvg')).touchAction), 'none');
await click('#dPan'); assert.strictEqual(await ev(() => getComputedStyle(document.querySelector('#dSvg')).touchAction), 'pan-y', '捲動切換'); await click('#dPan');
const dp = await ev(() => DOTS[0].pts);
await dptr('pointerdown', ...dp[0]); await dptr('pointerup', ...dp[0]);
await dptr('pointerdown', ...dp[2]); await dptr('pointerup', ...dp[2]);    // 跳點無效
assert.strictEqual(await ev(() => DP.cur), 1);
await dptr('pointerdown', ...dp[1]);                                       // 之後用拖曳走完
for (let i = 2; i < dp.length; i++) await dptr('pointermove', ...dp[i]);
await dptr('pointerup', ...dp.at(-1));
assert.ok((await ev(() => document.querySelector('#dMsg').textContent)).includes('畫好了'));
assert.strictEqual((await prog()).dots[0], 1);
assert.ok(await ev(() => !!document.querySelector('#dSvg .done')));
await click('#dReset'); assert.strictEqual(await ev(() => DP.cur), 0);

// 著色：點區域上色、不影響其他區域、匯出 PNG
await tab('color');
await noScroll('著色');
assert.strictEqual(await ev(() => document.querySelectorAll('#cChips button').length), 10);
await ev(() => document.querySelectorAll('#cPal button')[5].click());
await ev(() => document.querySelector('#cSvg [data-i="1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
assert.strictEqual(await ev(() => document.querySelector('#cSvg [data-i="1"]').getAttribute('fill')), '#0a84ff');
assert.strictEqual(await ev(() => document.querySelector('#cSvg [data-i="0"]').getAttribute('fill')), '#ffffff');
await click('#cSave');
const dl = () => fs.existsSync(browser.downloadDir) ? fs.readdirSync(browser.downloadDir).filter(f => f.endsWith('.png')) : [];
for (let i = 0; i < 30 && !dl().length; i++) await sleep(200);
assert.strictEqual(dl().length, 1, '著色匯出 PNG');
const png = fs.readFileSync(path.join(browser.downloadDir, dl()[0]));
assert.strictEqual(png.subarray(1, 4).toString(), 'PNG'); assert.ok(png.length > 1000);
// confirm 預設被 dismiss：有顏色時按清除不會清掉
await click('#cClear'); assert.strictEqual(await ev(() => document.querySelector('#cSvg [data-i="1"]').getAttribute('fill')), '#0a84ff');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
await click('#cClear'); assert.strictEqual(await ev(() => document.querySelector('#cSvg [data-i="1"]').getAttribute('fill')), '#ffffff');

// 拼貼：新增、拖曳、旋轉 / 縮放 / 換色 / 刪除、上限、匯出
await tab('shape');
await noScroll('拼貼');
await ev(() => document.querySelectorAll('#tAdd button')[3].click());
assert.strictEqual(await ev(() => CL.items.length), 1);
const it0 = await ev(() => ({ ...CL.items[0] }));
await ev(() => { const s = document.querySelector('#tSvg'), g = s.querySelector('g'), r = g.getBoundingClientRect(); const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, bubbles: true }; g.dispatchEvent(new PointerEvent('pointerdown', o)); s.dispatchEvent(new PointerEvent('pointermove', { ...o, clientX: o.clientX + 40 })); s.dispatchEvent(new PointerEvent('pointerup', o)); });
assert.ok((await ev(() => CL.items[0].x)) > it0.x + 5, '拖曳移動');
await ev(() => document.querySelector('#tTools [data-a=rr]').click()); await ev(() => document.querySelector('#tTools [data-a=big]').click());
await ev(() => document.querySelectorAll('#tPal button')[2].click());
const it1 = await ev(() => CL.items[0]); assert.strictEqual(it1.r, 15); assert.ok(it1.s > 1.1); assert.strictEqual(it1.c, '#ffd60a');
await ev(() => { for (let i = 0; i < 45; i++) document.querySelectorAll('#tAdd button')[i % 6].click(); });
assert.strictEqual(await ev(() => CL.items.length), 40, '上限 40');
assert.ok((await ev(() => document.querySelector('#tMsg').textContent)).includes('放滿'));
await ev(() => document.querySelector('#tTools [data-a=del]').click()); assert.strictEqual(await ev(() => CL.items.length), 39);
await noScroll('拼貼滿載');
for (const f of dl()) fs.rmSync(path.join(browser.downloadDir, f));
await click('#tSave'); for (let i = 0; i < 30 && !dl().length; i++) await sleep(200);
assert.strictEqual(dl().length, 1, '拼貼匯出 PNG');
await click('#tClear'); assert.strictEqual(await ev(() => CL.items.length), 0);

// 節奏：預備後依目標時間拍手 → 高分並存最高分；校正
await tab('rhythm');
await noScroll('節奏');
await click('#rStart');
const pct = await ev(async () => {
    const t = RS.targets.slice();
    for (const x of t) { while (performance.now() < x) await new Promise(r => setTimeout(r, 4)); rhythmTap(performance.now()); }
    while (!RS.done) await new Promise(r => setTimeout(r, 50));
    return RS.result.pct;
});
assert.ok(pct >= 80, '準時拍手分數 ' + pct);
p = await prog(); assert.strictEqual(p.rhy[0], pct);
assert.ok((await ev(() => document.querySelector('#rMsg').textContent)).includes('分'));
await click('#latP'); assert.strictEqual((await prog()).lat, 10);
await click('#calib'); assert.ok((await ev(() => document.querySelector('#rMsg').textContent)).includes('聲音'), '沒開聲音時提示');
await click('#snd'); await click('#calib');
await ev(async () => { for (const c of CB.clicks) { while (performance.now() < c + 50) await new Promise(r => setTimeout(r, 4)); rhythmTap(performance.now()); } });
await page.waitForFunction(() => document.querySelector('#rMsg').textContent.includes('校正完成'), { timeout: 8000 });
const lat = (await prog()).lat; assert.ok(lat >= 20 && lat <= 120, '校正延遲 ' + lat);
await noScroll('節奏後');

// 家長設定：答錯換題、答對進入、改難度、清除紀錄（confirm）
await click('#parentBtn');
assert.strictEqual(await ev(() => document.querySelector('#pset').hidden), true);
await ev(() => { document.querySelector('#ga').value = '1'; document.querySelector('#gok').click(); });
assert.strictEqual(await ev(() => document.querySelector('#pset').hidden), true, '答錯不能進入');
await ev(() => { document.querySelector('#ga').value = String(GQ.ans); document.querySelector('#gok').click(); });
assert.strictEqual(await ev(() => document.querySelector('#pset').hidden), false);
await ev(() => { const s = document.querySelector('#lv'); s.value = '3'; s.dispatchEvent(new Event('change')); });
assert.strictEqual((await prog()).lv, 3); assert.strictEqual(await ev(() => SP.scene.diffs.length), 5);
await noScroll('家長設定');
page.removeAllListeners('dialog'); page.on('dialog', d => d.dismiss().catch(() => { }));
await click('#clr'); assert.ok((await prog()).spot[0][0] === 1, '取消不清除');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { }));
await click('#clr');
assert.strictEqual(await ev((k) => localStorage.getItem(k), KEY), null, '清除後鍵移除');
assert.deepStrictEqual(await ev(() => prog), await ev(() => defProg()));

// 壞資料容錯
for (const bad of ['not json', 'null', '[1,2]', '{"lv":"x","lat":1e9,"spot":"no","rhy":[999],"dots":5}', '{"spot":[[1,2,3],null]}']) {
    await ev((k, b) => localStorage.setItem(k, b), KEY, bad);
    await page.reload({ waitUntil: 'load' });
    assert.ok(await ev(() => prog.lv >= 1 && prog.lv <= 3 && prog.lat >= -300 && prog.lat <= 300 && prog.dots.length === 10 && prog.spot.length === 3 && prog.rhy.length === 3), '壞資料：' + bad);
    assert.ok(await ev(() => document.querySelectorAll('#spA button').length >= 12), '壞資料仍可玩：' + bad);
}
await noScroll('壞資料後');

assert.deepStrictEqual(errors, []);
await browser.close();
console.log('ok kids-play');
