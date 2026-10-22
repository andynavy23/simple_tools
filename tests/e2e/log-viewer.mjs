// log-viewer：貼上 / 載入日誌、篩選、展開、折疊、JSON Lines 表格、Stack trace 整理
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { launchEdge, openPage } from './lib.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st-lv-'));
const LOG = ['2024-05-01 10:00:01,123 INFO  [main] c.a.App - started', '2024-05-01 10:00:02,000 ERROR [main] c.a.Svc - failed', 'java.lang.IllegalStateException: bad', '\tat com.a.Svc.run(Svc.java:10)', '2024-05-01 10:00:03,000 WARN c.a.X - slow', '2024-05-01 10:00:04,000 WARN c.a.X - slow', '2024-05-01 10:00:05,000 WARN c.a.X - slow'].join('\n');
const file = path.join(tmp, 'app.log'); fs.writeFileSync(file, LOG + '\n');
const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/log-viewer.html');
    const txt = (sel) => page.$eval(sel, e => e.textContent);
    const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
    const type = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
    const wait = (ms = 450) => new Promise(r => setTimeout(r, ms));
    const count = (sel) => page.$$eval(sel, l => l.length);
    const overflow = () => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);

    // 檔案載入
    await (await page.$('#file')).uploadFile(file); await wait(500);
    assert.ok((await txt('#lInfo')).includes('Java') && (await txt('#lInfo')).includes('共 5 筆'), await txt('#lInfo'));
    assert.equal(await count('#list .ent'), 5);
    assert.ok(await page.$eval('#src', e => e.disabled), '載入檔案後文字框停用');
    await click('#clear'); await wait(100);
    assert.equal(await count('#list .ent'), 0);

    // 貼上
    await type('#src', LOG); await wait();
    assert.equal(await count('#list .ent'), 5);
    assert.ok((await txt('#stat')).includes('ERROR 1') && (await txt('#stat')).includes('WARN 3'));
    assert.ok(await page.$('#stat svg rect'), '每分鐘圖有長條');
    // 展開多行
    await page.evaluate(() => document.querySelectorAll('#list .hd')[1].click());
    assert.ok((await txt('#list pre')).includes('Svc.java:10'));
    // 等級篩選
    await click('#lvs input[data-l="INFO"]'); await click('#lvs input[data-l="WARN"]'); await click('#lvs input[data-l="DEBUG"]'); await click('#lvs input[data-l="?"]');
    assert.equal(await count('#list .ent'), 1); assert.ok((await txt('#list')).includes('failed'));
    for (const l of ['INFO', 'WARN', 'DEBUG', '?']) await click(`#lvs input[data-l="${l}"]`);
    // 折疊與關鍵字
    await click('#fold'); assert.equal(await count('#list .ent'), 3); assert.equal(await txt('#list .cnt'), '×3'); await click('#fold');
    await type('#q', 'slow'); assert.equal(await count('#list .ent'), 3); assert.equal(await count('#list mark'), 3);
    await type('#q', '(sl'); await click('#isRe'); assert.ok(await page.$eval('#lErr', e => !e.hidden), '壞正則要提示'); await click('#isRe'); await type('#q', '');
    await type('#tFrom', '2024-05-01 10:00:03'); await type('#tTo', 'xx'); assert.ok((await txt('#lErr')).includes('時間格式')); await type('#tTo', ''); assert.equal(await count('#list .ent'), 3);
    await type('#tFrom', '');

    // JSON Lines
    await type('#src', '{"a":1,"b":"x"}\nbroken {\n{"a":3,"b":"y"}\n{"a":2}'); await click('#tabs button[data-i="1"]'); await wait();
    assert.equal(await count('#jTab tbody tr'), 3); assert.equal(await count('#jBad pre'), 1); assert.ok((await txt('#jBad')).includes('第 2 行'));
    await page.evaluate(() => document.querySelector('#jTab th[data-c="a"]').click()); await page.evaluate(() => document.querySelector('#jTab th[data-c="a"]').click());
    assert.equal(await page.$eval('#jTab tbody tr td:nth-child(2)', e => e.textContent), '3');
    await type('#jCol', 'b'); await type('#jOp', 'eq'); await type('#jVal', 'x'); assert.equal(await count('#jTab tbody tr'), 1);

    // Stack trace
    await click('#tabs button[data-i="2"]'); assert.ok(await page.$eval('#srcCard', e => e.hidden));
    await type('#stk', 'java.lang.RuntimeException: wrap\n\tat com.my.App.main(App.java:1)\n\tat org.springframework.A.b(A.java:2)\n\tat org.springframework.A.c(A.java:3)\nCaused by: java.io.IOException: disk\n\tat com.my.Dao.read(Dao.java:5)');
    await type('#pfx', 'com.my'); await wait(100);
    assert.equal(await count('#sOut .blk'), 2); assert.equal(await count('#sOut .fr.mine'), 2); assert.ok((await txt('#sOut')).includes('根因') && (await txt('#sOut')).includes('2 個框架庫呼叫'));
    assert.ok((await txt('#sText')).includes('Caused by: java.io.IOException') && !(await txt('#sText')).includes('springframework'));
    await click('#showLib'); assert.ok((await txt('#sText')).includes('springframework'));
    assert.ok(await overflow() <= 0, '手機版不可橫向捲動：' + await overflow());
    assert.deepEqual(errors, []);
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
