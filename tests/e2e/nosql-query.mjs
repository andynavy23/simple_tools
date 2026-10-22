// nosql-query：Redis 表單 → 指令、危險警告；Elasticsearch 條件 → DSL；只存上次選項（nosqlq_opts）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/nosql-query.html');
    const txt = (sel) => page.$eval(sel, e => e.textContent);
    const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
    const type = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
    const overflow = () => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);

    // Redis
    assert.ok((await txt('#errs')).includes('鍵名'), '空表單要提示必填');
    await type('#r_key', 'session:1'); assert.equal(await txt('#out'), 'GET session:1');
    await type('#rg', 'string'); await type('#rc', 'SET');
    await type('#r_key', 'k'); await type('#r_value', 'a b'); await type('#r_ex', '60');
    assert.equal(await txt('#out'), 'SET k "a b" EX 60');
    await click('#fmtTabs button[data-f="python"]'); assert.ok((await txt('#out')).endsWith('r.execute_command("SET", "k", "a b", "EX", 60)'));
    await click('#fmtTabs button[data-f="node"]'); assert.ok((await txt('#out')).includes('redis.set("k", "a b", "EX", 60)'));
    await type('#rg', 'keys'); await type('#rc', 'KEYS'); await type('#r_pattern', 'user:*');
    assert.ok(await page.$eval('#warns .alert', e => !e.classList.contains('info') && !e.classList.contains('warn')), 'KEYS 要紅色警告');
    assert.ok((await txt('#rInfo')).includes('O(N)'));
    await type('#rc', 'DEL'); assert.ok((await txt('#warns')).includes('UNLINK'));

    // Elasticsearch
    await click('#tabs button[data-t="es"]');
    await type('#eIdx', 'Bad'); assert.ok((await txt('#errs')).includes('索引名稱')); await type('#eIdx', 'logs-*');
    await page.evaluate(() => { const i = document.querySelectorAll('#eQ .crow input[type=text]'); const set = (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set(i[0], 'status'); set(i[1], '200'); });
    await page.evaluate(() => { const s = document.querySelectorAll('#eQ .crow select'); s[0].value = 'term'; s[0].dispatchEvent(new Event('change', { bubbles: true })); });
    await page.evaluate(() => { const s = document.querySelectorAll('#eQ .crow select')[1]; s.value = 'number'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.deepEqual(JSON.parse(await txt('#out')), { query: { term: { status: 200 } }, size: 10 });
    await click('#fmtTabs button[data-f="curl"]'); assert.ok((await txt('#out')).includes("/logs-*/_search?pretty"));
    await click('#fmtTabs button[data-f="kibana"]'); assert.ok((await txt('#out')).startsWith('GET /logs-*/_search'));
    await type('#eP input:nth-of-type(1)', '9999'); // size 輸入框仍在 eP 內
    assert.ok(await overflow() <= 0, '手機版不可橫向捲動：' + await overflow());

    // 只存上次選項
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nosqlq_opts')));
    assert.deepEqual(saved, { tab: 'es', cmd: 'DEL', fmt: 'node', efmt: 'kibana' });
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['nosqlq_opts']);
    await page.evaluate(() => localStorage.setItem('nosqlq_opts', '[1,"x"]')); await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => localStorage.setItem('nosqlq_opts', '{"tab":"redis","cmd":"KEYS","fmt":"python"}')); await page.reload({ waitUntil: 'load' });
    assert.equal(await page.$eval('#rc', e => e.value), 'KEYS');
    assert.deepEqual(errors, []);
} finally { await browser.close(); }
