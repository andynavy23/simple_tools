// random-data：依 JSON Schema 產生（真實瀏覽器：畫面、種子重現、不支援關鍵字提示、筆數上限）
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';

const browser = await launchEdge();
try {
    const { page, errors } = await openPage(browser, 'utils/random-data.html');
    const val = (s) => page.evaluate((s) => document.querySelector(s).value, s);
    const txt = (s) => page.evaluate((s) => document.querySelector(s).textContent, s);
    const set = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, s, v);
    const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);

    // 預設範例：一載入就有結果並通過驗證
    assert.match(await txt('#jsinfo'), /5 筆.*全部符合/);
    assert.equal(JSON.parse(await val('#jsout')).length, 5);
    // 種子重現
    await set('#jsn', '30'); await set('#jsseed', 'demo'); await click('#jsgen'); const a = await val('#jsout');
    await click('#jsgen'); assert.equal(await val('#jsout'), a);
    await set('#jsseed', 'other'); await click('#jsgen'); assert.notEqual(await val('#jsout'), a);
    // JSON Lines
    await page.select('#jsfmt', 'jsonl'); await click('#jsgen'); const lines = (await val('#jsout')).split('\n'); assert.equal(lines.length, 30); lines.forEach(l => JSON.parse(l));
    // 範例 JSON 推論
    await set('#jsin', '{"mail":"a@b.co","n":3}'); await click('#jsgen'); assert.match(await txt('#jsinfo'), /依範例推論/); assert.ok(JSON.parse(lines.length ? (await val('#jsout')).split('\n')[0] : '{}').mail.includes('@'));
    // 不支援的關鍵字：列出而不是默默忽略
    await set('#jsin', '{"type":"object","properties":{"a":{"anyOf":[{"type":"string"}]}},"required":["a"]}'); await click('#jsgen');
    assert.match(await txt('#jsinfo'), /不支援而未處理：\$\.a\.anyOf/);
    // 壞輸入與上限
    await set('#jsin', '{bad'); await click('#jsgen'); assert.match(await txt('#jsinfo'), /不是有效的 JSON/); assert.equal(await val('#jsout'), '');
    await click('#jssample'); await set('#jsn', '5001'); await click('#jsgen'); assert.match(await txt('#jsinfo'), /5000/);
    await set('#jsn', '5000'); await page.select('#jsfmt', 'json'); await click('#jsgen'); assert.match(await txt('#jsinfo'), /5000 筆/);
    // 既有功能沒壞：假資料表格仍可產生
    await click('#tgen'); assert.ok((await val('#tout')).length > 0);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '橫向溢出');
    assert.deepEqual(errors, []);
    await page.close();
} finally { await browser.close(); }
console.log('random-data-schema OK');
