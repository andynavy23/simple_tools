// config-gen 畫面行為：預設輸出、切換範本與類型、記憶與壞資料容錯、重置、危險標紅
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
{
    const { page, errors } = await openPage(browser, 'utils/config-gen.html');
    const out = () => page.evaluate(() => document.querySelector('#out').textContent);
    assert.ok((await out()).includes('server {'));
    // 切換類型 → 欄位重畫、輸出更新
    await page.evaluate(() => { const s = document.querySelector('#f_kind'); s.value = 'redirect'; s.dispatchEvent(new Event('change')); });
    assert.ok((await out()).includes('return 301'));
    assert.equal(await page.evaluate(() => !!document.querySelector('#f_upstream')), false);
    // 切換範本 + 危險標紅
    await page.evaluate(() => { const s = document.querySelector('#tpl'); s.value = 'shell'; s.dispatchEvent(new Event('change')); });
    await page.evaluate(() => { const s = document.querySelector('#f_kind'); s.value = 'rm'; s.dispatchEvent(new Event('change')); });
    await page.evaluate(() => { const c = document.querySelector('#f_rf'); c.checked = true; c.dispatchEvent(new Event('change')); });
    assert.ok((await out()).startsWith('rm -rf'));
    assert.ok(await page.evaluate(() => !!document.querySelector('.ex.bad')));
    // 記憶：重新載入後還原
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.evaluate(() => document.querySelector('#tpl').value), 'shell');
    assert.ok((await out()).startsWith('rm -rf'));
    // 沒有橫向捲動
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth));
    // 重置（confirm 預設會被 openPage 的 dialog handler 取消，這裡改成接受）
    page.removeAllListeners('dialog'); page.on('dialog', d => d.accept());
    await page.evaluate(() => document.querySelector('#reset').click());
    assert.ok(!(await out()).includes('-rf'));
    await page.evaluate(() => document.querySelector('#resetAll').click());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cfgen_opts')).vals && Object.keys(JSON.parse(localStorage.getItem('cfgen_opts')).vals).length), 0);
    // 壞資料：不能讓頁面壞掉
    await page.evaluate(() => localStorage.setItem('cfgen_opts', '{"tpl":5,"vals":{"nginx":{"kind":{"x":1},"domain":7}}}'));
    await page.reload({ waitUntil: 'load' });
    assert.ok((await out()).includes('server {'));
    await page.evaluate(() => localStorage.setItem('cfgen_opts', 'not json'));
    await page.reload({ waitUntil: 'load' });
    assert.ok((await out()).includes('server {'));
    assert.deepEqual(errors, []);
    await page.close();
}
await browser.close();
console.log('config-gen OK');
