// l3：flashcards（CSV 匯入 / 聽寫 / 多益字庫）、periodic-table（記憶測驗）、time-tracker（學習時數）的畫面行為
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const noScroll = async (page, what) => assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), what + ' 出現橫向捲動');

// ---- 單字閃卡 ----
{
    const { page, errors } = await openPage(browser, 'fun/flashcards.html');
    await set(page, '#newName', 'T'); await click(page, '#addDeck');
    await page.evaluate(() => { document.querySelector('#csvCard').open = true; });
    await set(page, '#csv', 'word,meaning,example\napple,蘋果,I eat an apple.\nbad line only\n"x,y",兩欄');
    await click(page, '#csvPreview');
    const prev = await text(page, '#csvPrev');
    assert.ok(prev.includes('新增 2') && prev.includes('格式錯誤 1') && prev.includes('第 3 行'), prev);
    await click(page, '#csvGo');
    assert.ok((await text(page, '#deck')).includes('（2）'));
    // 重複：略過 / 覆蓋
    await set(page, '#csv', 'apple,新解釋'); await click(page, '#csvPreview');
    assert.ok((await text(page, '#csvPrev')).includes('略過重複 1'));
    await set(page, '#csvDup', 'overwrite'); await click(page, '#csvPreview');
    assert.ok((await text(page, '#csvPrev')).includes('覆蓋 1')); await click(page, '#csvGo');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('flash_decks')).T.find(c => c.f === 'apple'));
    assert.equal(saved.b, '新解釋'); assert.equal(saved.ex, 'I eat an apple.');
    // 內建字庫：加入兩次
    await page.evaluate(() => { document.querySelector('#builtinCard').open = true; });
    await click(page, '#addToeic'); const n1 = await page.evaluate(() => JSON.parse(localStorage.getItem('flash_decks'))['多益核心字'].length);
    assert.ok(n1 >= 280, '多益 ' + n1);
    await click(page, '#addToeic'); assert.ok((await text(page, '#toeicInfo')).includes('都已經在'));
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('flash_decks'))['多益核心字'].length), n1);
    // 例句顯示在背面
    await page.evaluate(() => { document.querySelector('#flip').click(); });
    assert.ok((await page.evaluate(() => document.querySelector('#face small') && document.querySelector('#face small').textContent)).length > 5);
    // 聽寫（無語音也能玩：自動顯示解釋）
    await page.evaluate(() => { document.querySelector('#dictCard').open = true; });
    await click(page, '#dictStart');
    assert.ok(await page.evaluate(() => !document.querySelector('#dictBox').hidden));
    await set(page, '#dIn', 'zzzzzz'); await click(page, '#dGo');
    assert.ok((await text(page, '#dictBox')).includes('錯了') || (await text(page, '#dictBox')).includes('差一點'));
    await click(page, '#dGo'); assert.ok((await text(page, '#dictBox')).includes('第 2 / 20'));
    await noScroll(page, 'flashcards');
    assert.deepEqual(errors, []); await page.close();
}

// ---- 週期表 ----
{
    const { page, errors } = await openPage(browser, 'utils/periodic-table.html');
    await page.evaluate(() => { document.querySelector('#quizCard').open = true; });
    await set(page, '#qFrom', 'sym'); await set(page, '#qTo', 'name'); await set(page, '#qMode', 'choice'); await set(page, '#qRange', 'g17');
    await click(page, '#qStart');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#qBox .qopts button').length), 4);
    // 答案是 g17 的元素；點選正確選項
    const ok1 = await page.evaluate(() => {
        const prompt = document.querySelector('.qbig').textContent;
        const el = ['F', 'Cl', 'Br', 'I', 'At', 'Ts'].includes(prompt);
        return el;
    });
    assert.ok(ok1, '第 17 族題目應是鹵素符號');
    // 用輸入題答對（符號 → 原子序）
    await set(page, '#qFrom', 'sym'); await set(page, '#qTo', 'z'); await set(page, '#qMode', 'input'); await set(page, '#qRange', 'first20'); await click(page, '#qStart');
    const sym = await text(page, '.qbig'); const z = await page.evaluate((s) => E.findIndex(e => e[0] === s) + 1, sym);
    await set(page, '#qIn', String(z)); await click(page, '#qOk');
    assert.ok((await text(page, '#qBox')).includes('正確'));
    let st = await page.evaluate(() => JSON.parse(localStorage.getItem('pt_quiz')));
    assert.deepEqual(st.s[z], { a: 1, c: 1, l: 1 });
    // 答錯 → 進錯題
    await click(page, '#qNext'); const sym2 = await text(page, '.qbig'); const z2 = await page.evaluate((s) => E.findIndex(e => e[0] === s) + 1, sym2);
    await set(page, '#qIn', String(z2 + 1)); await click(page, '#qOk');
    assert.ok((await text(page, '#qBox')).includes('答錯'));
    st = await page.evaluate(() => JSON.parse(localStorage.getItem('pt_quiz'))); assert.equal(st.s[z2].l, 0);
    await set(page, '#qRange', 'wrong'); await click(page, '#qStart');
    assert.equal(await text(page, '.qbig'), sym2, '錯題範圍只出答錯過的');
    // 壞資料載入容錯 + 清除
    await page.evaluate(() => localStorage.setItem('pt_quiz', '{"s":{"999":{"a":1,"c":1},"5":"x"}}'));
    await page.reload(); await page.evaluate(() => { document.querySelector('#quizCard').open = true; });
    assert.ok((await text(page, '#qStats')).includes('累計答題 0'));
    await noScroll(page, 'periodic-table');
    assert.deepEqual(errors, []); await page.close();
}

// ---- 工時紀錄：學習時數 ----
{
    const { page, errors } = await openPage(browser, 'utils/time-tracker.html');
    await set(page, '#sName', '英文'); await set(page, '#sGoal', '5'); await click(page, '#sAdd');
    assert.ok((await text(page, '#studyRows')).includes('英文') && (await text(page, '#studyRows')).includes('0:00 / 5:00'));
    // 補登 1.5 小時 → 進度 30%
    const d = await page.evaluate(() => document.querySelector('#mDate').value);
    await set(page, '#mDate', d); await set(page, '#mStart', '09:00'); await set(page, '#mEnd', '10:30'); await click(page, '#mSave');
    assert.ok((await text(page, '#studyRows')).includes('1:30 / 5:00（30%）'), await text(page, '#studyRows'));
    await click(page, '#sper-month'); assert.ok((await text(page, '#studyRows')).includes('1:30'));
    // 既有專案設為科目
    await set(page, '#pName', '工作'); await click(page, '#addProject');
    await set(page, '#sName', '工作'); await set(page, '#sGoal', ''); await click(page, '#sAdd');
    const ps = await page.evaluate(() => JSON.parse(localStorage.getItem('tt_projects')));
    assert.equal(ps.length, 2); assert.deepEqual(ps.map(p => p.study), [true, true]);
    // 取消科目（confirm 預設被 dismiss → 不動；改成接受）
    page.removeAllListeners('dialog'); page.on('dialog', (x) => x.accept());
    await page.evaluate(() => document.querySelector('#studyRows [data-act=unstudy]').click());
    await new Promise(r => setTimeout(r, 200));
    const ps2 = await page.evaluate(() => JSON.parse(localStorage.getItem('tt_projects')));
    assert.equal(ps2.filter(p => p.study).length, 1); assert.equal(ps2.length, 2, '專案保留');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('tt_logs')).length), 1, '紀錄保留');
    await noScroll(page, 'time-tracker');
    assert.deepEqual(errors, []); await page.close();
}
await browser.close();
console.log('l3 pages OK');
