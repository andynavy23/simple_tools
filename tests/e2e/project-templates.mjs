// project-templates（專案樣板產生器）與 git-helper 新分頁的畫面行為：切換、產生、持久化、重置、無橫向捲動
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const set = (page, sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); if (e.type === 'checkbox') e.checked = x; else e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const text = (page, sel) => page.evaluate(s => document.querySelector(s).textContent, sel);
const noScroll = (page, tag) => page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth).then(ok => assert.ok(ok, tag + '：橫向捲動'));

{
    const { page, errors } = await openPage(browser, 'utils/project-templates.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    assert.ok((await text(page, '#pOut')).includes('# ===== Node.js ====='), '預設產生 gitignore');
    await set(page, '#p_macos', true);
    assert.ok((await text(page, '#pOut')).includes('.DS_Store'));
    // 切到 workflow，改語言，內容更新
    await set(page, '#pType', 'actions');
    assert.ok((await text(page, '#pOut')).includes('actions/setup-node@v4'));
    await set(page, '#p_lang', 'python');
    assert.ok((await text(page, '#pOut')).includes('actions/setup-python@v5'));
    // 錯誤時顯示紅字並停用複製
    await set(page, '#p_branch', 'a b');
    assert.ok((await text(page, '#pErr')).includes('分支'));
    assert.ok(await page.evaluate(() => document.querySelector('#pCopy').disabled));
    await set(page, '#p_branch', 'main');
    // 授權
    await set(page, '#pType', 'license'); await set(page, '#p_holder', 'Andy'); await set(page, '#p_pick', 'mit');
    assert.ok((await text(page, '#pOut')).includes('Copyright (c) ' + new Date().getFullYear() + ' Andy'));
    await noScroll(page, '授權');
    // 記住上次選項：重新載入後仍在 license 且 holder 保留
    await page.reload({ waitUntil: 'load' });
    assert.strictEqual(await page.evaluate(() => document.querySelector('#pType').value), 'license');
    assert.strictEqual(await page.evaluate(() => document.querySelector('#p_holder').value), 'Andy');
    // 壞資料回到預設
    await page.evaluate(() => localStorage.setItem('projt_opts', '{"type":5,"vals":[1]}'));
    await page.reload({ waitUntil: 'load' });
    assert.strictEqual(await page.evaluate(() => document.querySelector('#pType').value), 'gitignore');
    // 重置（confirm 接受）
    await page.evaluate(() => { localStorage.setItem('projt_opts', '{"type":"license","vals":{}}'); window.confirm = () => true; });
    await page.evaluate(() => document.querySelector('#pReset').click());
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('projt_opts')), null);
    assert.strictEqual(await page.evaluate(() => document.querySelector('#pType').value), 'gitignore');
    // 每個類型都不橫向捲動
    for (const t of await page.evaluate(() => [...document.querySelectorAll('#pType option')].map(o => o.value))) { await set(page, '#pType', t); await noScroll(page, t); }
    assert.deepEqual(errors, []);
    await page.close();
}
{
    const { page, errors } = await openPage(browser, 'utils/git-helper.html');
    await set(page, '#gType', 'cc'); await set(page, '#g_desc', '新增深色模式'); await set(page, '#g_scope', 'ui');
    assert.strictEqual(await text(page, '#gOut'), "git commit -m 'feat(ui): 新增深色模式'");
    await set(page, '#g_desc', 'x'.repeat(80));
    assert.ok((await text(page, '#gRisk')).includes('72'));
    await page.evaluate(() => document.querySelector('#tabTxt').click());
    await set(page, '#t_commits', 'a1b2c3d feat(ui): 新增深色模式\nfix: 修正崩潰\nchore: x');
    const out = await text(page, '#tOut');
    assert.ok(out.includes('### Added\n- **ui:** 新增深色模式') && out.includes('### Fixed\n- 修正崩潰'));
    await set(page, '#tType', 'hook');
    assert.ok((await text(page, '#tOut')).startsWith('#!/bin/sh'));
    await set(page, '#t_hook', 'commit-msg');
    assert.ok((await text(page, '#tOut')).includes('Conventional Commits'));
    await noScroll(page, 'git-helper hooks');
    // 既有分頁仍可用
    await page.evaluate(() => document.querySelector('#tabSc').click());
    assert.ok(await page.evaluate(() => !document.querySelector('#pgSc').hidden && document.querySelector('#pgTxt').hidden));
    assert.deepEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('project-templates OK');
