// 批次 n10：health-log 症狀 / 問題、countdown 戒除計數、workout-log 菜單 + 每組 RPE、timezone 出差版、health-calc 四區塊、mood-journal 感恩、pace-calc 越野
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const get = (page, k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const set = (page, sel, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const noScroll = (page) => page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1);
const autoAccept = (page) => { page.removeAllListeners('dialog'); page.on('dialog', d => d.accept()); };

{ // health-log
    const { page, errors } = await openPage(browser, 'utils/health-log.html');
    autoAccept(page);
    await click(page, '#symCard summary'); await click(page, '#qCard summary');
    await set(page, '#s_sym', '頭痛'); await set(page, '#s_sev', '11'); await click(page, '#s_add');
    assert.ok((await text(page, '#s_msg')).includes('1–10'));
    await set(page, '#s_sev', '7'); await set(page, '#s_trig', '熬夜'); await click(page, '#s_add');
    assert.strictEqual((await get(page, 'healthlog_symptoms')).length, 1);
    assert.ok((await text(page, '#s_list')).includes('頭痛') && (await text(page, '#s_sum')).includes('平均 7'));
    await set(page, '#q_q', '要吃多久？'); await click(page, '#q_add');
    await set(page, '#q_list input[type=text]', '吃七天');
    const q = await get(page, 'healthlog_questions'); assert.strictEqual(q.length, 1); assert.strictEqual(q[0].a, '吃七天');
    await click(page, '#q_list input[type=checkbox]');
    assert.strictEqual((await get(page, 'healthlog_questions'))[0].done, true);
    // 壞資料載入不壞頁面
    await page.evaluate(() => { localStorage.setItem('healthlog_symptoms', '{"x":1}'); localStorage.setItem('healthlog_questions', '[null,5,{"q":""}]'); location.reload(); });
    await page.waitForSelector('#s_count');
    await click(page, '#symCard summary'); await click(page, '#qCard summary');
    assert.ok((await text(page, '#s_count')).includes('0 /'));
    await set(page, '#s_sym', '咳嗽'); await set(page, '#s_sev', '3'); await click(page, '#s_add');
    await click(page, '#s_list .rec button'); assert.strictEqual((await get(page, 'healthlog_symptoms')).length, 0);
    await set(page, '#q_q', 'a'); await click(page, '#q_add'); await click(page, '#q_clear'); assert.strictEqual((await get(page, 'healthlog_questions')).length, 0);
    assert.ok(await noScroll(page), '橫向捲動'); assert.deepStrictEqual(errors, []);
}
{ // countdown：戒除計數與行前待辦
    const { page, errors } = await openPage(browser, 'utils/countdown.html');
    autoAccept(page);
    await set(page, '#qName', '戒菸'); await set(page, '#qDate', '2020-01-01'); await set(page, '#qCost', '100'); await click(page, '#qAdd');
    const ev = await get(page, 'countdown_events'); assert.strictEqual(ev.length, 1); assert.deepStrictEqual(ev[0].quit, { perDay: 100 });
    const t = await text(page, '#list'); assert.ok(t.includes('已持續') && t.includes('省下約 NT$') && t.includes('下個里程碑'), t);
    await click(page, '#list details summary');
    await page.evaluate(() => [...document.querySelectorAll('#list button')].find(b => b.textContent === '加入行前待辦範本').click());
    assert.ok((await get(page, 'countdown_events'))[0].items.length >= 10);
    await page.evaluate(() => [...document.querySelectorAll('#list button')].find(b => b.textContent.startsWith('重新起算')).click());
    assert.ok((await get(page, 'countdown_events'))[0].date > '2020-01-01');
    await page.evaluate(() => { localStorage.setItem('countdown_events', JSON.stringify([{ name: 'x', date: '2026-01-01', yearly: false, quit: 'bad' }])); location.reload(); });
    await page.waitForSelector('#list .ev');
    assert.ok(await noScroll(page), '橫向捲動'); assert.deepStrictEqual(errors, []);
}
{ // workout-log：菜單與每組 RPE
    const { page, errors } = await openPage(browser, 'fun/workout-log.html');
    autoAccept(page);
    await set(page, '#pgDays', '4'); await click(page, '#pgGen'); assert.ok((await text(page, '#pgDraft')).includes('上肢 A'));
    await click(page, '#pgApply');
    const plan = await get(page, 'workout_plan'); assert.strictEqual(plan.days.length, 4);
    await click(page, '#pgPlan .mv button');
    assert.strictEqual(await page.$$eval('#sets .setrow', r => r.length), 4);   // 上肢 A 第一個動作 = 臥推 4 組
    await page.evaluate(() => {
        const ev = (i, v) => { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
        document.querySelectorAll('#sets .setrow').forEach((row, k) => { const ins = row.querySelectorAll('input'); ev(ins[0], '60'); if (k === 0) ev(ins[2], '8'); });
    });
    await click(page, '#save');
    const log = await get(page, 'workout_log'); assert.strictEqual(log.length, 1); assert.deepStrictEqual(log[0].s[0], [60, 8, 8]); assert.deepStrictEqual(log[0].s[1], [60, 8]);
    assert.ok((await text(page, '#load')).includes('平均 RPE 8'));
    await click(page, '#pgClear'); assert.strictEqual(await get(page, 'workout_plan'), null);
    await page.evaluate(() => { localStorage.setItem('workout_plan', '{"days":"x"}'); location.reload(); });
    await page.waitForSelector('#pgPlan'); assert.ok((await text(page, '#pgPlan')).includes('還沒有計畫'));
    assert.ok(await noScroll(page), '橫向捲動'); assert.deepStrictEqual(errors, []);
}
{ // timezone：出差版
    const { page, errors } = await openPage(browser, 'utils/timezone.html');
    await click(page, '#tabTrip');
    await set(page, '#trFrom', 'Asia/Taipei'); await set(page, '#trTo', 'America/New_York'); await set(page, '#trStart', '2026-03-07'); await set(page, '#trEnd', '2026-03-09'); await set(page, '#trTime', '21:00');
    const t = await text(page, '#trOut'); assert.ok(t.includes('08:00') && t.includes('時差變動'), t);
    await set(page, '#trEnd', '2026-05-30'); assert.ok((await text(page, '#trMsg')).includes('31'));
    assert.ok(await noScroll(page), '橫向捲動'); assert.deepStrictEqual(errors, []);
}
{ // health-calc：四個新區塊
    const { page, errors } = await openPage(browser, 'utils/health-calc.html');
    await page.evaluate(() => document.querySelectorAll('#protCard,#gfCard,#whrCard,#bgCard').forEach(d => { d.open = true; }));
    assert.ok((await text(page, '#prOut')).includes('分 3 餐'));
    await set(page, '#gfTgt', '60'); assert.ok((await text(page, '#gfOut')).includes('預計達標'));
    await set(page, '#whW', '90'); await set(page, '#whH', '100'); assert.ok((await text(page, '#whOut')).includes('腹部肥胖'));
    await set(page, '#bgA', 'AO'); await set(page, '#bgB', 'BO'); assert.strictEqual((await text(page, '#bgOut')).match(/25%/g).length, 4);
    assert.ok(await noScroll(page), '橫向捲動'); assert.deepStrictEqual(errors, []);
}
{ // mood-journal：感恩
    const { page, errors } = await openPage(browser, 'fun/mood-journal.html');
    autoAccept(page);
    await click(page, '#moods button:nth-child(4)');
    await page.evaluate(() => document.querySelectorAll('#gInputs .g').forEach((i, k) => { i.value = k < 2 ? '感謝' + k : ''; }));
    await click(page, '#save');
    const e = await get(page, 'mood_entries'); assert.deepStrictEqual(e[0].g, ['感謝0', '感謝1']);
    assert.ok((await text(page, '#gStats')).includes('1 天'));
    await click(page, '#gClear'); assert.ok(!('g' in (await get(page, 'mood_entries'))[0]));
    assert.ok(await noScroll(page), '橫向捲動'); assert.deepStrictEqual(errors, []);
}
{ // pace-calc：越野
    const { page, errors } = await openPage(browser, 'utils/pace-calc.html');
    await set(page, '#trD', '25'); await set(page, '#trA', '1200'); await set(page, '#trV', '6:00');
    const t = await text(page, '#trOut'); assert.ok(t.includes('3:42:00') && t.includes('37.0 km'), t);
    assert.ok(await noScroll(page), '橫向捲動'); assert.deepStrictEqual(errors, []);
}
await browser.close();
