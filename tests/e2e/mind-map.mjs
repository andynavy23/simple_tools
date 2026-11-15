// mind-map：新增 / 編輯 / 刪除 / 折疊 / 拖曳改父層 / 撤銷 / 多張 / 匯入大綱 / 存檔重載 / 壞資料 / 捲動切換
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const ev = (page, fn, ...a) => page.evaluate(fn, ...a);
const click = (page, sel) => ev(page, (s) => document.querySelector(s).click(), sel);
const count = (page) => ev(page, () => document.querySelectorAll('#mm .n').length);
const txt = (page) => ev(page, () => [...document.querySelectorAll('#mm .n')].map(g => g.textContent).join('|'));
const parentIs = async (page, t) => { for (let i = 0; i < 50; i++) { if (await ev(page, (t) => { const ns = JSON.parse(localStorage.mindmap_maps)[0].nodes; return (ns.find(n => n.t === 'A1') || {}).p === (ns.find(n => n.t === t) || {}).id; }, t)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('A1 的父層不是 ' + t); };
const rename = async (page, t) => { await ev(page, (t) => { document.querySelector('#dtxt').value = t; document.querySelector('#dform').requestSubmit(); }, t); };

{
    const { page, errors } = await openPage(browser, 'utils/mind-map.html');
    assert.ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), '橫向溢出');
    assert.equal(await count(page), 1);
    // 觸控預設不攔截捲動
    assert.equal(await ev(page, () => document.querySelector('#mm').style.touchAction), 'auto');
    await click(page, '#bPan');
    assert.equal(await ev(page, () => document.querySelector('#mm').style.touchAction), 'none');
    await click(page, '#bPan');

    // 子節點 ×2、改名
    await click(page, '#bChild'); await rename(page, 'A');
    await click(page, '#bSib'); await rename(page, 'B');
    assert.equal(await count(page), 3);
    // 選 A 加孫節點
    await ev(page, () => { [...document.querySelectorAll('#mm .n')].find(g => g.textContent === 'A').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await click(page, '#bChild'); await rename(page, 'A1');
    assert.equal(await count(page), 4);
    // 折疊 A：A1 消失
    await ev(page, () => { [...document.querySelectorAll('#mm .n')].find(g => g.textContent.startsWith('A') && g.textContent !== 'A1').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await click(page, '#bFold'); assert.equal(await count(page), 3);
    await click(page, '#bFold'); assert.equal(await count(page), 4);
    // 撤銷 / 重做
    await click(page, '#bUndo'); assert.equal(await count(page), 3);
    await click(page, '#bRedo'); assert.equal(await count(page), 4);

    // 移到…：A1 移到 B 底下；不能把 A 移到自己的後代
    await ev(page, () => { [...document.querySelectorAll('#mm .n')].find(g => g.textContent === 'A1').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await click(page, '#bMove');
    await ev(page, () => { [...document.querySelectorAll('#mm .n')].find(g => g.textContent === 'B').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await parentIs(page, 'B');   // 存檔為 debounced

    // 真正的指標拖曳（panMode 開）：把 A1 拖到 A 上
    await click(page, '#bPan');
    const pt = (t) => ev(page, (t) => { const g = [...document.querySelectorAll('#mm .n')].find(g => g.textContent === t), r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, t);
    await click(page, '#bFit'); await ev(page, () => document.querySelector('#mm').scrollIntoView({ block: 'center' }));
    const a = await pt('A1'), b = await pt('A');
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
    await parentIs(page, 'A');
    await click(page, '#bPan'); await new Promise(r => setTimeout(r, 150));   // 等拖曳後的 click 抑制結束

    // 刪除 A（子樹 2 個節點，不需確認）；根不能刪
    await ev(page, () => { [...document.querySelectorAll('#mm .n')].find(g => g.textContent === 'A').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await click(page, '#bDel'); assert.equal(await count(page), 2);
    await click(page, '#bUndo'); assert.equal(await count(page), 4);

    // 匯入大綱 → 新圖
    await ev(page, () => { document.querySelector('#md').value = '- 旅行\n  - 交通\n    - 高鐵\n  - 住宿'; });
    await click(page, '#xImp');
    assert.equal(await count(page), 4); assert.ok((await txt(page)).includes('高鐵'));
    await click(page, '#xGen');
    assert.equal(await ev(page, () => document.querySelector('#md').value), '# 旅行\n- 交通\n  - 高鐵\n- 住宿');
    // 多張：新增、複製，共 3 張
    await click(page, '#mdup');
    assert.equal(await ev(page, () => document.querySelectorAll('#msel option').length), 3);
    // 上限 30
    await ev(page, () => { for (let i = 0; i < 40; i++) document.querySelector('#mnew').click(); });
    assert.equal(await ev(page, () => document.querySelectorAll('#msel option').length), 30);

    // PNG 下載（不報錯即可）
    await click(page, '#xPng'); await new Promise(r => setTimeout(r, 600));
    assert.deepEqual(errors, []);
    await page.close();
}

// 壞資料不會讓頁面壞掉
{
    const { page, errors } = await openPage(browser, 'utils/mind-map.html');
    await ev(page, () => { localStorage.mindmap_maps = JSON.stringify([null, { id: 'x', nodes: [{ id: 'a', p: 'b' }, { id: 'b', p: 'a' }, 5] }, { nodes: 1 }]); localStorage.mindmap_cur = '{{'; });
    await page.reload({ waitUntil: 'load' });
    assert.ok(await ev(page, () => document.querySelectorAll('#mm .n').length >= 2));
    assert.deepEqual(errors, []);
    await page.close();
}
await browser.close();
