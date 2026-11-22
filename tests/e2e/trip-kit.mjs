// trip-kit：建立旅行與項目（依時間排序、預算、單筆刪除）、停車開始 / 結束進歷史、路線排序、390px 不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const set = (page, sel, v) => ev(page, (s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const tab = (page, t) => click(page, `.tabs button[data-t="${t}"]`);

{
    const { page, errors } = await openPage(browser, 'utils/trip-kit.html');
    await ev(page, () => { window.confirm = () => true; window.alert = () => { }; });
    // 行程
    await set(page, '#tName', '花蓮'); await set(page, '#tStart', '2026-12-01'); await set(page, '#tEnd', '2026-12-03'); await click(page, '#tAdd');
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('trip_plans')).length), 1);
    for (const [time, place, cost] of [['14:00', '午後', '200'], ['09:00', '早上', '100']]) {
        await set(page, '#iTime', time); await set(page, '#iPlace', place); await set(page, '#iCost', cost); await click(page, '#iAdd');
    }
    const txt = await ev(page, () => document.querySelector('#planBody').innerText);
    assert.ok(txt.indexOf('早上') < txt.indexOf('午後') && txt.includes('預算合計 NT$ 300'), txt);
    await click(page, '[data-del]');
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('trip_plans'))[0].items.length), 1);
    // 路線
    await tab(page, 'route'); await click(page, '#rEg'); await click(page, '#rGo');
    const out = await ev(page, () => document.querySelector('#rOut').innerText);
    assert.ok(out.includes('精確最短') && out.includes('直線距離'), out);
    await click(page, '#rAddT');
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('trip_plans'))[0].items.length), 6);
    // 停車
    await tab(page, 'park');
    await set(page, '#pFloor', 'B2'); await set(page, '#pSlot', '88'); await set(page, '#pLL', '25.0478,121.5170'); await click(page, '#pStart');
    assert.ok((await ev(page, () => document.querySelector('#parkBody').innerText)).includes('B2 88'));
    assert.ok(await ev(page, () => document.querySelector('a[href^="https://www.google.com/maps/search/?api=1&query=25.0478,121.517"]') !== null));
    await click(page, '#pEnd');
    const s = await ev(page, () => JSON.parse(localStorage.getItem('trip_parking')));
    assert.ok(s.cur === null && s.hist.length === 1);
    await click(page, '[data-hdel]');
    assert.equal(await ev(page, () => JSON.parse(localStorage.getItem('trip_parking')).hist.length), 0);
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');
    assert.deepEqual(errors, []);
}
{ // 137：提示改頁內 toast，不再跳 alert
    const { page, errors } = await openPage(browser, 'utils/trip-kit.html');
    let dialogs = 0; page.removeAllListeners('dialog'); page.on('dialog', d => { dialogs++; d.dismiss().catch(() => { }); });
    await ev(page, () => localStorage.setItem('trip_plans', JSON.stringify([{ id: 't1', name: '滿', start: '2026-12-01', end: '2026-12-03', cur: 'TWD', tz: 8, items: Array.from({ length: 300 }, (_, i) => ({ id: 'i' + i, date: '2026-12-01', time: '', place: '地點' + i, note: '', mode: '', cost: 0 })) }])));
    await page.reload({ waitUntil: 'load' });
    await set(page, '#iPlace', '第 301 個'); await click(page, '#iAdd');
    const t = await ev(page, () => { const e = document.querySelector('.st-toast'); return e && { text: e.textContent, cls: e.className, hidden: e.hidden }; });
    assert.ok(t && !t.hidden && t.cls.includes('bad') && t.text.includes('300'), JSON.stringify(t)); assert.equal(dialogs, 0, '不該有 alert 視窗');
    assert.deepEqual(errors, []);
}
await browser.close();
console.log('ok  trip-kit e2e');
