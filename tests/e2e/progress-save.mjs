// 進行中存檔 / 草稿（2048、數獨、數織、心情日記）、空狀態（便條紙、寵物記錄）與一批小 UI 修正的驗收
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const all = [];
const open = async (rel, pre) => {
    const { page, errors } = await openPage(browser, rel);
    all.push(errors);
    if (pre) { await page.evaluate(pre); await page.reload({ waitUntil: 'load' }); }
    return page;
};
const reload = (page) => page.reload({ waitUntil: 'load' });
const ls = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const noScrollX = (page, msg) => page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1).then(v => assert.ok(v, msg + '：橫向捲動'));
// 可見文字的最小字級（只看有直接文字的元素）
const minFont = (page, sel) => page.evaluate((sel) => {
    let min = 99, who = '';
    for (const el of document.querySelectorAll(sel + ', ' + sel + ' *')) {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const f = parseFloat(getComputedStyle(el).fontSize); if (f < min) { min = f; who = el.className + ':' + el.textContent.trim().slice(0, 8); }
    }
    return { min, who };
}, sel);

// ---- 2048 ----
{
    const p = await open('mini-games/game-2048.html');
    for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { await p.keyboard.press(k); await new Promise(r => setTimeout(r, 160)); }
    const s1 = await p.evaluate(() => JSON.stringify({ b: board, s: score }));
    assert.ok(await ls(p, 'g2048_cur'), '2048 移動後有存檔');
    await reload(p);
    assert.strictEqual(await p.evaluate(() => JSON.stringify({ b: board, s: score })), s1, '2048 reload 後盤面與分數相同');
    await p.evaluate(() => document.querySelector('#new').click());
    assert.strictEqual(await ls(p, 'g2048_cur'), null, '2048 新遊戲清掉存檔');
    for (const bad of ['"x"', '{"board":[[2,3,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],"score":0}', '{"board":5,"score":1}', 'not json', '{"board":[[2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],"score":1,"daily":"2000-01-01"}']) {
        await p.evaluate((v) => localStorage.setItem('g2048_cur', v), bad); await reload(p);
        assert.strictEqual(await p.evaluate(() => board.flat().filter(Boolean).length), 2, '壞資料開新局 ' + bad);
    }
}
// ---- 數獨 ----
{
    const p = await open('mini-games/sudoku.html');
    await p.waitForFunction(() => typeof puzzle !== 'undefined' && puzzle);
    const idx = await p.evaluate(() => puzzle.findIndex(v => !v));
    await p.evaluate((i) => { document.querySelectorAll('#grid button')[i].click(); document.querySelector('#pad button').click(); }, idx);
    const s1 = await p.evaluate(() => JSON.stringify({ p: puzzle, b: board }));
    assert.ok(await ls(p, 'sudoku_cur'), '數獨填數後有存檔');
    await new Promise(r => setTimeout(r, 2200));
    await reload(p);
    assert.strictEqual(await p.evaluate(() => JSON.stringify({ p: puzzle, b: board })), s1, '數獨 reload 後相同');
    assert.ok(await p.evaluate(() => Math.floor((Date.now() - start) / 1000)) >= 2, '計時延續');
    await p.evaluate(() => document.querySelector('#new').click());
    await p.waitForFunction((s) => JSON.stringify({ p: puzzle, b: board }) !== s, {}, s1);
    for (const bad of ['"x"', '{"lv":40,"puzzle":[1],"board":[1],"notes":[],"sec":1,"daily":null}', 'not json', '{"lv":40,"puzzle":null}']) {
        await p.evaluate((v) => localStorage.setItem('sudoku_cur', v), bad); await reload(p);
        await p.waitForFunction(() => typeof puzzle !== 'undefined' && puzzle);
        assert.strictEqual(await p.evaluate(() => board.length), 81, '數獨壞資料開新局');
    }
}
// ---- 數織 ----
{
    const p = await open('mini-games/nonogram.html');
    await p.waitForFunction(() => P);
    await p.evaluate(() => { for (const [i, j] of [[0, 0], [1, 1], [2, 2]]) paint(document.querySelector(`#board .c[data-i="${i}"][data-j="${j}"]`), 1); });
    const s1 = await p.evaluate(() => JSON.stringify({ g: P.grid, c: cells }));
    assert.ok(await ls(p, 'nono_cur'), '數織塗格後有存檔');
    await reload(p);
    assert.strictEqual(await p.evaluate(() => JSON.stringify({ g: P.grid, c: cells })), s1, '數織 reload 後相同');
    await p.evaluate(() => document.querySelector('#newBtn').click());
    assert.strictEqual(await ls(p, 'nono_cur'), null, '數織新題清掉存檔');
    for (const bad of ['"x"', '{"n":10,"grid":[[1]],"cells":[[0]],"sec":0}', 'not json', '{"n":10,"grid":null}']) {
        await p.evaluate((v) => localStorage.setItem('nono_cur', v), bad); await reload(p);
        await p.waitForFunction(() => P);
        assert.strictEqual(await p.evaluate(() => cells.length), 10, '數織壞資料開新局');
    }
}
// ---- 心情日記草稿 ----
{
    const p = await open('fun/mood-journal.html');
    await p.evaluate(() => { const t = document.querySelector('#text'); t.value = '寫到一半'; t.dispatchEvent(new Event('input', { bubbles: true })); document.querySelectorAll('#moods button')[3].click(); });
    await new Promise(r => setTimeout(r, 700));
    assert.ok((await ls(p, 'mood_draft')).includes('寫到一半'), '草稿已存');
    await reload(p);
    assert.strictEqual(await p.$eval('#text', e => e.value), '寫到一半');
    assert.ok(await p.$eval('#draftNote', e => !e.hidden), '顯示還原提示');
    assert.strictEqual(await p.evaluate(() => curMood), 4);
    await p.evaluate(() => document.querySelector('#save').click());
    assert.strictEqual(await ls(p, 'mood_draft'), null, '儲存後草稿清掉');
    await reload(p);
    assert.strictEqual(await p.$eval('#text', e => e.value) === '寫到一半', true, '已儲存的當天文字仍在（來自日記本身）');
    await p.evaluate(() => { const t = document.querySelector('#text'); t.value = '另一段'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await new Promise(r => setTimeout(r, 700)); await reload(p);
    await p.evaluate(() => document.querySelector('#draftDrop').click());
    assert.strictEqual(await ls(p, 'mood_draft'), null, '捨棄後草稿清掉');
    assert.ok(await p.$eval('#draftNote', e => e.hidden));
    await p.evaluate(() => localStorage.setItem('mood_draft', JSON.stringify({ date: '2026-01-01', text: { x: 1 }, mood: 'a' }))); await reload(p);
    assert.ok(await p.$eval('#draftNote', e => e.hidden), '壞草稿不還原');
}
// ---- 空狀態 ----
{
    const p = await open('fun/sticky-notes.html');
    assert.ok(await p.$eval('#empty', e => !e.hidden && e.textContent.includes('新增便條')), '便條空狀態');
    await p.evaluate(() => document.querySelector('#add').click());
    assert.ok(await p.$eval('#empty', e => e.hidden), '新增後引導消失');
}
{
    const p = await open('fun/pet-log.html');
    assert.ok(await p.$eval('#petEmpty', e => !e.hidden), '寵物空狀態');
    await p.evaluate(() => { document.querySelector('#addPetBtn').click(); const n = document.querySelector('#p_name'); n.value = '小白'; n.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#savePet').click(); });
    assert.ok(await p.$eval('#petEmpty', e => e.hidden), '新增後引導消失');
}
// ---- UI ----
{
    const p = await open('fun/workout-log.html');
    await p.evaluate(() => document.querySelector('#sets input').scrollIntoView());
    const w = await p.$$eval('#sets .setrow:first-child input', els => els.map(e => e.getBoundingClientRect().width));
    assert.ok(w.every(x => x >= 60), '重訓輸入欄寬度 ' + w);
    await noScrollX(p, 'workout-log');
}
{
    const p = await open('utils/split-bill.html');
    assert.ok(await p.$eval('#payer', e => e.getBoundingClientRect().width >= 120 && e.options[0].disabled), 'split-bill 空 select');
}
{
    const p = await open('fun/flashcards.html');
    assert.ok(await p.$eval('#deck', e => e.getBoundingClientRect().width >= 120), 'flashcards 空 select 寬度');
}
{
    const p = await open('utils/periodic-table.html');
    assert.ok(await p.$eval('#q', e => e.placeholder.length <= 20), 'periodic-table placeholder 短');
    const f = await minFont(p, 'body');
    assert.ok(f.min >= 12, 'periodic-table 最小字級 ' + JSON.stringify(f));
    await noScrollX(p, 'periodic-table');
}
{
    const p = await open('utils/tw-holidays.html');
    for (const i of [0, 1, 2, 3]) {
        await p.evaluate((i) => { const b = document.querySelectorAll('.tabs button')[i]; if (b) b.click(); }, i);
        const f = await minFont(p, 'body');
        assert.ok(f.min >= 12, 'tw-holidays 分頁 ' + i + ' 最小字級 ' + JSON.stringify(f));
        await noScrollX(p, 'tw-holidays ' + i);
    }
}
{
    const p = await open('utils/qr-scan.html');
    assert.ok(await p.$eval('#camBtn', e => !/[\u{1F300}-\u{1FAFF}]/u.test(e.textContent)) && await p.$eval('#pick', e => !/[\u{1F300}-\u{1FAFF}]/u.test(e.textContent)), 'qr-scan 按鈕無 emoji');
}
{
    const gap = (p, a, b) => p.evaluate((a, b) => { const x = document.querySelector(a).getBoundingClientRect(), y = document.querySelector(b).getBoundingClientRect(); return y.top >= x.bottom - 2 ? y.top - x.bottom : y.left - x.right; }, a, b);
    const p = await open('utils/markdown-preview.html');
    await p.evaluate(() => { document.querySelector('#tblBox').open = true; });
    for (const [a, b] of [['#tAddRow', '#tAddCol'], ['#tAddCol', '#tDelRow'], ['#tDelRow', '#tDelCol']]) assert.ok(await gap(p, a, b) >= 10, `markdown-preview ${a}-${b} 間距`);
    const q = await open('utils/mind-map.html');
    for (const [a, b] of [['#mnew', '#mdup']]) assert.ok(await gap(q, a, b) >= 10, `mind-map ${a}-${b} 間距`);
    assert.ok(await q.evaluate(() => { const d = document.querySelector('#mdup').getBoundingClientRect(), e = document.querySelector('#mdel').getBoundingClientRect(); return e.left - d.right >= 40 || e.top > d.bottom; }), 'mind-map 刪除鈕與其他鈕隔開');
}
for (const e of all) assert.deepEqual(e, []);
await browser.close();
console.log('progress-save OK');
