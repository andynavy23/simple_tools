// kids-routine：刷牙計時（縮短）/ 睡前打勾與換日 / 家長解鎖 / 存錢增刪 / 作息編輯 / 小朋友上限與連帶刪除 / 壞資料容錯 / 390px 版面
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'fun/kids-routine.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const set = (sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const stored = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
const wait = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (await page.evaluate(fn)) return; await new Promise(r => setTimeout(r, 100)); } throw new Error('逾時：' + fn); };
const tab = (t) => click(`[data-tab=${t}]`);
const unlock = async () => {
    await click('#lock');
    const [a, b] = (await text('#q')).match(/\d+/g).map(Number);
    await set('#ans', String(a + b + 1)); await click('#gok');                       // 先答錯
    assert.ok((await text('#gmsg')).includes('不對')); assert.ok(await page.evaluate(() => !document.body.classList.contains('par')));
    const [c, d] = (await text('#q')).match(/\d+/g).map(Number);
    await set('#ans', String(c + d)); await click('#gok');
    assert.ok(await page.evaluate(() => document.body.classList.contains('par')));
};
const noOverflow = () => page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1);
const TWDAY = (off = 0) => new Date(Date.now() + 8 * 36e5 + off * 864e5).toISOString().slice(0, 10);

// ---- 版面：每個分頁都不橫向捲動，可見按鈕 ≥ 44px，大按鈕 ≥ 56px ----
for (const t of ['brush', 'wash', 'bed', 'sched', 'bank', 'safe']) {
    await tab(t);
    assert.ok(await noOverflow(), t + ' 橫向捲動');
    const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && b.closest('.wrap') && (b.getBoundingClientRect().height < 43.5 || b.classList.contains('big') && b.getBoundingClientRect().height < 55.5)).map(b => b.textContent.trim() + ':' + Math.round(b.getBoundingClientRect().height)));
    assert.deepEqual(small, [], t + ' 按鈕太小');
}
await unlock();
for (const t of ['bed', 'sched', 'bank']) { await tab(t); assert.ok(await noOverflow(), t + ' 家長模式橫向捲動'); }
await click('#lock'); assert.ok(await page.evaluate(() => !document.body.classList.contains('par')));

// ---- 刷牙計時（縮短到約 2.4 秒）----
await tab('brush');
await page.evaluate(() => { SCALE = 0.02; });
await click('#bBtn');
await wait(() => document.querySelector('#bName').textContent === '上排左邊');
assert.equal(await text('#bBtn'), '停止');
await wait(() => document.querySelector('#bMsg').textContent.includes('星'));
assert.equal(await text('#bBtn'), '開始刷牙');
let st = await stored('kidsr_stars');
const ids = Object.keys(st); assert.equal(ids.length, 1);
assert.equal(st[ids[0]][TWDAY()].b, 1);
// 中途按停止：不貼星星
await click('#bBtn'); await new Promise(r => setTimeout(r, 300)); await click('#bBtn');
assert.equal(await text('#bBtn'), '開始刷牙'); assert.equal((await stored('kidsr_stars'))[ids[0]][TWDAY()].b, 1);
// 洗手
await tab('wash'); await click('#wBtn');
await wait(() => document.querySelector('#wMsg').textContent.includes('星'));
assert.equal((await stored('kidsr_stars'))[ids[0]][TWDAY()].w, 1);
await page.evaluate(() => { SCALE = 1; });

// ---- 睡前打勾、每日重置與連續天數 ----
await tab('bed');
await click('[data-act=stepTog]');
assert.equal(await page.evaluate(() => document.querySelectorAll('#bedList [aria-pressed=true]').length) >= 1, true);
const stepIds = await page.evaluate(() => [...document.querySelectorAll('#bedList [data-act=stepTog]')].map(b => b.dataset.id));
assert.equal(stepIds.length, 4);
await page.evaluate((ids, y, y2) => {
    const k = 'k1';
    localStorage.setItem('kidsr_stars', JSON.stringify({ [k]: { [y]: { b: 0, w: 0, s: ids }, [y2]: { b: 0, w: 0, s: ids } } }));
}, stepIds, TWDAY(-1), TWDAY(-2));
await page.reload();
assert.equal(await page.evaluate(() => document.querySelectorAll('#bedList [aria-pressed=true]').length), 0);   // 新的一天：全部未打勾
await tab('bed');
assert.ok((await text('#bedStars')).includes('連續 2 天'), await text('#bedStars'));
for (const id of stepIds) await click(`[data-act=stepTog][data-id=${id}]`);
assert.ok((await text('#bedMsg')).includes('晚安')); assert.ok((await text('#bedStars')).includes('連續 3 天'));
// 家長：新增 / 刪除步驟（刪除連帶清掉打勾）
await unlock();
await set('#stN', '收玩具'); await set('#stE', '🧸'); await click('[data-act=stepAdd]');
assert.equal((await stored('kidsr_bedtime')).length, 5);
await page.evaluate(() => [...document.querySelectorAll('#bedList [data-act=stepDel]')].find(b => b.getAttribute('aria-label').includes('洗澡')).click());
const bed = await stored('kidsr_bedtime'); assert.equal(bed.length, 4);
const k0 = 'k1'; assert.ok(!(await stored('kidsr_stars'))[k0][TWDAY()].s.includes('bs0'));
for (let i = 0; i < 16; i++) { await set('#stN', 'x' + i); await click('[data-act=stepAdd]'); }
assert.equal((await stored('kidsr_bedtime')).length, 20);
await set('#stN', '第21個'); await click('[data-act=stepAdd]'); assert.ok((await text('#stErr')).includes('最多')); assert.equal((await stored('kidsr_bedtime')).length, 20);

// ---- 存錢筒 ----
await tab('bank');
await set('#bkAmt', '100'); await set('#bkNote', '紅包'); await click('[data-act=dep]');
await set('#bkAmt', '30'); await click('[data-act=wd]');
assert.ok((await text('#bkBal')).includes('70'));
await set('#bkAmt', '500'); await click('[data-act=wd]'); assert.ok((await text('#bkErr')).includes('不夠'));
await set('#gN', '樂高'); await set('#gT', '140'); await set('#gR', '吃冰'); await click('[data-act=goalSave]');
assert.ok((await text('#bkGoal')).includes('50%')); assert.equal(await page.evaluate(() => document.querySelector('#bkBar').style.width), '50%');
await set('#bkAmt', '70'); await click('[data-act=dep]'); assert.ok((await text('#bkGoal')).includes('達成') && (await text('#bkGoal')).includes('吃冰'));
const bk = await stored('kidsr_bank'); assert.equal(bk[k0].recs.length, 3);
await page.evaluate(() => document.querySelectorAll('#bkList [data-act=recDel]')[2].click());          // 刪最舊的存入 → 會讓提領不夠 → 拒絕
assert.ok((await text('#bkErr')).includes('不夠')); assert.equal((await stored('kidsr_bank'))[k0].recs.length, 3);
await page.evaluate(() => document.querySelectorAll('#bkList [data-act=recDel]')[0].click());
assert.equal((await stored('kidsr_bank'))[k0].recs.length, 2);
assert.ok(await noOverflow());

// ---- 作息編輯 ----
await tab('sched');
assert.equal(await page.evaluate(() => document.querySelectorAll('#clock path').length), 7);
assert.ok((await text('#schedNow')).includes('現在'));
await set('#sgN', '看書'); await set('#sgE', '📖'); await set('#sgS', '23:00'); await set('#sgT', '23:30'); await click('[data-act=segSave]');
let sg = await stored('kidsr_schedule'); assert.equal(sg.length, 8);
await set('#sgN', '同時間'); await set('#sgT', '23:00'); await click('[data-act=segSave]'); assert.ok((await text('#sgErr')).includes('不同'));
await page.evaluate(() => [...document.querySelectorAll('#segList [data-act=segEdit]')].find(b => b.closest('.li').textContent.includes('看書')).click());
await set('#sgN', '看書書'); await set('#sgT', '23:45'); await set('#sgC', '#ff0000'); await click('[data-act=segSave]');
sg = await stored('kidsr_schedule'); assert.equal(sg.length, 8); const e = sg.find(x => x.name === '看書書'); assert.ok(e && e.end === 1425 && e.color === '#ff0000');
await page.evaluate(() => [...document.querySelectorAll('#segList [data-act=segDel]')].find(b => b.closest('.li').textContent.includes('看書書')).click());
assert.equal((await stored('kidsr_schedule')).length, 7);
// 跨午夜時段：預設「睡覺」21:00–07:00 要畫出來
assert.ok(await page.evaluate(() => document.querySelector('#segList').textContent.includes('21:00–07:00')));

// ---- 小朋友上限與連帶刪除 ----
for (let i = 0; i < 5; i++) { await set('#kidN', '孩' + i); await click('[data-act=kidAdd]'); }
assert.equal((await stored('kidsr_opts')).kids.length, 6);
await set('#kidN', '第七'); await click('[data-act=kidAdd]'); assert.ok((await text('#kidErr')).includes('最多')); assert.equal((await stored('kidsr_opts')).kids.length, 6);
await set('#kid', (await stored('kidsr_opts')).kids[1].id);
await tab('bank'); await set('#bkAmt', '5'); await click('[data-act=dep]');
const k1 = (await stored('kidsr_opts')).kids[1].id; assert.equal((await stored('kidsr_bank'))[k1].recs.length, 1);
await page.evaluate((id) => document.querySelector(`#kidList [data-id="${id}"]`).click(), k1);
const o = await stored('kidsr_opts'); assert.equal(o.kids.length, 5); assert.ok(!(k1 in (await stored('kidsr_bank')))); assert.ok(o.cur !== k1);

// ---- 各自清除 ----
await click('[data-act=clr][data-w=bank]'); assert.ok(Object.values(await stored('kidsr_bank')).every(x => x.recs.length === 0 && x.goal === null));
await click('[data-act=clr][data-w=stars]'); assert.ok(Object.values(await stored('kidsr_stars')).every(x => Object.keys(x).length === 0));
await click('[data-act=clr][data-w=bed]'); assert.equal((await stored('kidsr_bedtime')).length, 4);
await click('[data-act=clr][data-w=sched]'); assert.equal((await stored('kidsr_schedule')).length, 7);

// ---- 壞資料容錯 ----
for (const bad of ['null', '"x"', '[1,2]', '{"kids":5,"cur":{}}', '123', '{']) {
    await page.evaluate((b) => { for (const k of ['kidsr_opts', 'kidsr_stars', 'kidsr_bedtime', 'kidsr_schedule', 'kidsr_bank']) localStorage.setItem(k, b); }, bad);
    await page.reload();
    for (const t of ['bed', 'sched', 'bank']) await tab(t);
    assert.ok((await page.evaluate(() => document.querySelectorAll('#kid option').length)) >= 1, '壞資料 ' + bad);
}
await page.evaluate(() => {
    localStorage.setItem('kidsr_opts', JSON.stringify({ kids: [{ id: 'a', name: 5 }], cur: 'a' }));
    localStorage.setItem('kidsr_stars', JSON.stringify({ a: { '2026-01-01': 'x', zzz: { b: 'q' } } }));
    localStorage.setItem('kidsr_bedtime', JSON.stringify([null, { id: 'q', name: 7 }, { id: 'ok', name: '好' }]));
    localStorage.setItem('kidsr_schedule', JSON.stringify([{ id: 's', name: 'x', start: 'a', end: 5 }, { id: 't', name: 'ok', start: 60, end: 120 }]));
    localStorage.setItem('kidsr_bank', JSON.stringify({ a: { goal: 'x', recs: 'y' } }));
});
await page.reload(); await tab('bank'); await tab('sched');
assert.equal(await page.evaluate(() => document.querySelectorAll('#clock path').length), 1);
assert.equal(await page.evaluate(() => document.querySelectorAll('#bedList .step').length), 1);

// ---- 全部清除（重新載入）----
await unlock();
const nav = page.waitForNavigation({ waitUntil: 'load' });
await click('[data-act=clr][data-w=all]'); await nav;
assert.deepEqual(await page.evaluate(() => ['kidsr_opts', 'kidsr_stars', 'kidsr_bedtime', 'kidsr_schedule', 'kidsr_bank'].map(k => localStorage.getItem(k))), [null, null, null, null, null]);
assert.deepEqual(errors, []);
await browser.close();
console.log('kids-routine OK');
