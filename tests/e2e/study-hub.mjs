// study-hub：匯入題庫 → 作答 → 錯題進錯題本 → 重做；模擬考（假時鐘）；讀書計畫與課表增刪；壞資料容錯；390px 無橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/study-hub.html');
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
    const val = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, s, v);
    const text = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const count = (s) => page.evaluate((s) => document.querySelectorAll(s).length, s);
    const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
    const tab = (t) => click(`#tabs [data-t=${t}]`);
    const overflow = async (name) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '橫向溢出：' + name);
    const accept = () => { page.removeAllListeners('dialog'); page.on('dialog', d => d.accept().catch(() => { })); };
    const dismiss = () => { page.removeAllListeners('dialog'); page.on('dialog', d => d.dismiss().catch(() => { })); };

    // ===== 匯入 =====
    await val('#csvIn', '題目,正確答案,選項A,選項B,選項C,選項D,解說,單元\n最高的山?,B,雪山,玉山,阿里山,合歡山,玉山 3952 公尺,地理\n2+3=?,5,,,,,,數學\n首都?,台北|Taipei,,,,,,地理\n,缺題目');
    await click('#impBtn');
    assert.ok((await text('#impMsg')).includes('已匯入 3 題') && (await text('#impMsg')).includes('第 5 列'), await text('#impMsg'));
    assert.equal((await ls('studyhub_bank')).length, 3);
    assert.equal(await count('#bankList .item'), 3);
    await overflow('quiz');

    // ===== 作答（依順序：單選答錯、填空答對、填空答錯）=====
    await val('#qCount', '10'); await click('#qOrd'); await click('#qStart');
    assert.ok(await page.evaluate(() => !document.querySelector('#qRun').hidden));
    assert.equal(await text('#qText'), '最高的山?');
    await click('#qAns button[data-o="雪山"]');               // 答錯
    assert.ok((await text('#qFb')).includes('玉山 3952'));
    assert.equal(await page.evaluate(() => document.querySelector('#qAns button.right').dataset.o), '玉山');
    await click('#qNext');
    await val('#qIn', '5'); await click('#qAns .primary'); await click('#qNext');   // 答對
    await val('#qIn', '高雄'); await click('#qAns .primary');                         // 答錯
    assert.ok((await text('#qFb')).includes('台北 / Taipei'));
    await click('#qNext');
    assert.ok((await text('#qScore')).startsWith('1 / 3'), await text('#qScore'));
    let wr = await ls('studyhub_wrong');
    assert.equal(wr.length, 2); assert.ok(wr.every(w => w.n === 1 && !w.mastered));
    await overflow('quiz done');
    await click('#qBack');

    // ===== 錯題本 =====
    await tab('wrong');
    assert.equal(await count('#wList .item'), 2);
    assert.equal(await count('#weak .li'), 1);        // 都是「地理」
    await val('#wUnit', '地理'); assert.equal(await count('#wList .item'), 2);
    // 標籤
    await page.evaluate(() => { const i = document.querySelector('#wList .item input'); i.value = '粗心'; i.dispatchEvent(new Event('change')); });
    assert.ok((await ls('studyhub_wrong')).some(w => w.tag === '粗心'));
    await click('[data-by=tag]'); assert.equal(await count('#weak .li'), 2);
    await overflow('wrong');
    // 重做：答對「首都」不影響錯題；再答錯會 +1
    await val('#wUnit', ''); await click('#wRedo');
    assert.ok(await page.evaluate(() => !document.querySelector('#qRun').hidden));
    const first = await text('#qText');
    if (first === '首都?') { await val('#qIn', 'taipei'); await click('#qAns .primary'); } else { await click('#qAns button:not([data-o="玉山"])'); }
    await click('#qNext');
    const second = await text('#qText');
    if (second === '首都?') { await val('#qIn', 'taipei'); await click('#qAns .primary'); } else { await click('#qAns button:not([data-o="玉山"])'); }
    await click('#qNext');
    await click('#qWrongGo');
    wr = await ls('studyhub_wrong');
    assert.equal(wr.length, 2); assert.equal(wr.filter(w => w.n === 2).length, 1);   // 只有答錯的那題 +1
    // 已掌握：不再列入「未掌握」
    await click('#wList .item .row button:nth-of-type(1)');
    assert.ok((await ls('studyhub_wrong')).some(w => w.mastered));
    assert.equal(await count('#wList .item'), 1);
    // 單題刪除（用 id）
    const idBefore = (await ls('studyhub_wrong')).map(w => w.id);
    await click('#wList .item .row button.del');
    assert.equal((await ls('studyhub_wrong')).length, 1);
    // 刪題庫題目 → 對應錯題一併消失
    await tab('quiz'); await val('#bankQ', '');
    await page.evaluate(() => [...document.querySelectorAll('#bankList .item')].find(d => d.textContent.includes('最高的山')).querySelector('button.del').click());
    assert.equal((await ls('studyhub_bank')).length, 2);
    assert.ok((await ls('studyhub_wrong')).every(w => idBefore.includes(w.id)));
    // 清除錯題本：先取消，再確認
    await tab('wrong'); dismiss(); await click('#wClear'); assert.ok((await ls('studyhub_wrong')).length >= 0);
    accept(); await click('#wClear'); assert.equal((await ls('studyhub_wrong')).length, 0);

    // ===== 限時測驗（假時鐘）=====
    await tab('quiz'); await val('#qMin', '1'); await click('#qStart');
    await page.evaluate(() => { const o = Date.now; window.__k = 0; Date.now = () => o() + window.__k; });
    await page.evaluate(() => { window.__k = 61000; });
    await page.waitForFunction(() => !document.querySelector('#qDone').hidden, { timeout: 4000 });
    assert.ok((await text('#qScore')).startsWith('0 / 2'));
    assert.equal((await ls('studyhub_wrong')).length, 2);        // 未作答算答錯
    await click('#qBack'); await val('#qMin', '0');
    await page.evaluate(() => { window.__k = 0; });

    // ===== 模擬考 =====
    await tab('mock');
    await page.evaluate(() => { window.__b = 0; Util.beep = () => { window.__b++; }; });
    await page.evaluate(() => { const s = document.querySelector('#mRows input'); s.value = '數學'; s.dispatchEvent(new Event('input')); const m = document.querySelectorAll('#mRows input')[1]; m.value = '30'; m.dispatchEvent(new Event('input')); });
    await click('#mAdd');
    await page.evaluate(() => { const i = document.querySelectorAll('#mRows input'); i[2].value = '英文'; i[2].dispatchEvent(new Event('input')); i[3].value = '2'; i[3].dispatchEvent(new Event('input')); });
    await click('#mStart');
    assert.equal(await text('#mWho'), '數學'); assert.equal(await text('#mClock'), '30:00');
    await page.evaluate(() => { window.__k = 20.5 * 60000; });      // 剩約 9.5 分鐘：越過 10 分鐘
    await page.waitForFunction(() => document.querySelector('#mWarn').textContent.includes('10 分鐘'), { timeout: 4000 });
    assert.ok(await page.evaluate(() => window.__b >= 1));
    await page.evaluate(() => { window.__k = 26 * 60000; });        // 剩 4 分鐘：5 分鐘提醒
    await page.waitForFunction(() => document.querySelector('#mWarn').textContent.includes('5 分鐘'), { timeout: 4000 });
    await click('#mSubmit');                                        // 交卷第一科
    assert.equal(await text('#mWho'), '英文'); assert.equal(await page.evaluate(() => document.querySelector('#eSubj').value), '數學');
    assert.equal(await page.evaluate(() => document.querySelector('#eMins').value), '26');
    await page.evaluate(() => { window.__b = 0; window.__k += 3 * 60000; });   // 第二科只有 2 分鐘：過期 → 時間到
    await page.waitForFunction(() => document.querySelector('#mWarn').textContent.includes('時間到'), { timeout: 4000 });
    assert.ok(await page.evaluate(() => window.__b >= 1));
    await click('#mSubmit');
    assert.ok(await page.evaluate(() => document.querySelector('#mRun').hidden && !document.querySelector('#mSetup').hidden));
    // 記錄成績
    await val('#eSubj', '數學'); await val('#eScore', '80'); await click('#eAdd');
    await val('#eSubj', '數學'); await val('#eScore', '90'); await val('#eDate', '2030-01-01'); await click('#eAdd');
    await val('#eScore', '150'); await click('#eAdd'); assert.ok((await text('#eMsg')).includes('分數'));
    assert.equal((await ls('studyhub_exams')).length, 2);
    assert.equal(await count('#tChart svg polyline'), 1);
    assert.ok((await text('#tStats')).includes('85%'));
    await overflow('mock');
    await page.evaluate(() => { document.querySelector('#eList button.del').click(); });
    assert.equal((await ls('studyhub_exams')).length, 1);
    accept(); await click('#eClear'); assert.equal((await ls('studyhub_exams')).length, 0);

    // ===== 讀書計畫 =====
    await tab('plan');
    const today = await page.evaluate(() => twToday());
    const exam = await page.evaluate((t) => Util.day.shift(t, 10), today);
    await val('#pStart', today); await val('#pExam', today); await click('#pSet'); assert.ok((await text('#pMsg')).includes('晚於'));
    await val('#pExam', exam); await click('#pSet');
    assert.ok(await page.evaluate(() => !document.querySelector('#pItemsCard').hidden));
    await val('#piName', '微積分'); await val('#piHours', '10'); await click('#piAdd');
    await val('#piName', '英文'); await val('#piHours', '5'); await click('#piAdd');
    assert.equal(await count('#piList .li'), 2);
    assert.ok((await text('#pSum')).includes('完成 0%') && (await text('#pSum')).includes('1.5'), await text('#pSum'));
    await page.evaluate(() => document.querySelector('#pDays input[type=checkbox]').click());
    assert.ok((await text('#pSum')).includes('完成 10%'), await text('#pSum'));
    assert.equal(Object.keys((await ls('studyhub_plan')).log).length, 1);
    await overflow('plan');
    accept();
    await page.evaluate(() => document.querySelector('#piList button.del').click());
    assert.equal((await ls('studyhub_plan')).items.length, 1);
    assert.equal(Object.keys((await ls('studyhub_plan')).log).length, 0);   // 完成記錄連帶清掉
    await click('#pClear'); assert.equal(await ls('studyhub_plan'), null);

    // ===== 課表 =====
    await tab('tt');
    await click('#ttAdd'); await click('#ttAdd');
    assert.equal(await count('table.tt tr'), 3);
    await page.evaluate(() => document.querySelector('table.tt tr:nth-child(2) td:nth-child(2) button').click());
    await val('#cN', '微積分'); await val('#cR', 'A101'); await click('#ttSave');
    assert.equal((await ls('studyhub_timetable')).periods[0].cells[0].n, '微積分');
    await page.evaluate(() => document.querySelector('table.tt tr:nth-child(2) td:nth-child(1) button').click());
    await val('#pS', '10:00'); await val('#pE', '09:00'); await click('#ttSave'); assert.ok((await text('#ttMsg')).includes('晚於'));
    await val('#pS', '08:10'); await val('#pE', '09:00'); await click('#ttSave');
    assert.equal((await ls('studyhub_timetable')).periods[0].start, '08:10');
    await overflow('tt');
    await page.evaluate(() => document.querySelector('#ttWE').click()); await overflow('tt weekend');
    // 今天的課與下一堂：把課放在「今天」的星期，時間設為整天
    await page.evaluate(() => { const tw = new Date(Date.now() + 8 * 36e5); window.__dow = (tw.getUTCDay() + 6) % 7; });
    const dow = await page.evaluate(() => window.__dow);
    await page.evaluate(() => document.querySelector('#ttWE').textContent === '隱藏週末' || document.querySelector('#ttWE').click());
    await page.evaluate((d) => document.querySelector(`table.tt tr:nth-child(3) td:nth-child(${d + 2}) button`).click(), dow);
    await val('#cN', '今日課'); await click('#ttSave');
    await page.evaluate(() => document.querySelector('table.tt tr:nth-child(3) td:nth-child(1) button').click());
    await val('#pS', '00:00'); await val('#pE', '23:59'); await click('#ttSave');
    assert.ok((await text('#ttToday')).includes('今日課') && (await text('#ttToday')).includes('現在'), await text('#ttToday'));
    // 刪除一節
    await page.evaluate(() => document.querySelector('table.tt tr:nth-child(3) td:nth-child(1) button').click());
    dismiss(); await click('#ttDel'); assert.equal((await ls('studyhub_timetable')).periods.length, 2);
    accept(); await click('#ttDel'); assert.equal((await ls('studyhub_timetable')).periods.length, 1);
    await click('#ttClear'); assert.equal((await ls('studyhub_timetable')).periods.length, 0);

    // ===== 成績計算 =====
    await tab('grade');
    await page.evaluate(() => {
        const rows = document.querySelectorAll('#gRows .grow');
        const set = (i, a, b) => { const x = rows[i].querySelectorAll('input'); x[1].value = a; x[1].dispatchEvent(new Event('input')); x[2].value = b; x[2].dispatchEvent(new Event('input')); };
        set(0, '80', '30'); set(1, '90', '20'); set(2, 'A', '2');
    });
    assert.ok((await text('#gOut')).includes('84'), await text('#gOut'));    // 百分制只算數字列：(80*30+90*20)/50 = 84
    await val('#fW', '50');
    assert.ok((await text('#fOut')).includes('至少要考'), await text('#fOut'));
    await overflow('grade');
    assert.equal(errors.length, 0, errors.join('|'));
    await page.close();

    // ===== 壞資料容錯 =====
    const bad = await openPage(browser, 'utils/study-hub.html');
    await bad.page.evaluate(() => {
        localStorage.setItem('studyhub_bank', JSON.stringify([null, 5, { q: 'x' }, { q: 'ok', a: 'a', id: 'z' }]));
        localStorage.setItem('studyhub_wrong', '{"a":1}');
        localStorage.setItem('studyhub_exams', JSON.stringify([null, { subject: 's', date: 'xx', score: 1, full: 2 }]));
        localStorage.setItem('studyhub_plan', JSON.stringify({ start: 5, exam: null, items: 3 }));
        localStorage.setItem('studyhub_timetable', '"zzz"');
    });
    await bad.page.reload({ waitUntil: 'load' });
    await bad.page.evaluate(() => document.querySelector('#tabs [data-t=tt]').click());
    assert.equal(await bad.page.evaluate(() => document.querySelectorAll('#bankList .item').length), 1);
    for (const t of ['wrong', 'mock', 'plan', 'tt', 'grade']) await bad.page.evaluate((t) => document.querySelector(`#tabs [data-t=${t}]`).click(), t);
    await bad.page.evaluate(() => localStorage.setItem('studyhub_bank', 'not json{'));
    await bad.page.reload({ waitUntil: 'load' });
    assert.equal(await bad.page.evaluate(() => document.querySelectorAll('#bankList .item').length), 0);
    assert.equal(bad.errors.length, 0, bad.errors.join('|'));

    // ===== 匯入超過上限被拒絕；全部清除 =====
    bad.page.removeAllListeners('dialog'); bad.page.on('dialog', d => d.accept().catch(() => { }));
    await bad.page.evaluate(() => {
        localStorage.setItem('studyhub_bank', JSON.stringify(Array.from({ length: 2000 }, (_, i) => ({ id: 'i' + i, q: 'q' + i, a: 'a' }))));
    });
    await bad.page.reload({ waitUntil: 'load' });
    await bad.page.evaluate(() => { const t = document.querySelector('#csvIn'); t.value = 'new,a'; document.querySelector('#impBtn').click(); });
    assert.ok((await bad.page.evaluate(() => document.querySelector('#impMsg').textContent)).includes('最多 2000'));
    assert.equal(await bad.page.evaluate(() => JSON.parse(localStorage.getItem('studyhub_bank')).length), 2000);
    await Promise.all([bad.page.waitForNavigation({ waitUntil: 'load' }), bad.page.evaluate(() => document.querySelector('#clearAll').click())]);
    assert.equal(await bad.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('studyhub_')).length), 0);
    await bad.page.close();
} finally { await browser.close(); }
console.log('ok study-hub e2e');
