// json-formatter 畫面行為：查詢、鍵整理、欄位選取與改名、設定檔轉換、i18n、新型別輸出；手機寬度不能橫向捲動
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/json-formatter.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input')); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const status = () => text('#status');

await set('#in', '{"items":[{"name":"a","price":5},{"name":"b","price":15}],"x":null,"b":1.0,"a":{"z":null}}');

// 查詢
await set('#qExpr', '$.items[?(@.price>10)].name'); await click('#qGo');
assert.deepEqual(JSON.parse(await text('#outText')), ['b']);
await set('#qExpr', '.items | map(.name)'); await click('#qGo');
assert.deepEqual(JSON.parse(await text('#outText')), ['a', 'b']);
await set('#qExpr', '.items | foo'); await click('#qGo');
assert.ok(/✗/.test(await status()) && /不支援/.test(await status()), await status());
assert.ok(await page.evaluate(() => document.querySelector('#outCard').hidden));
await page.evaluate(() => document.querySelector('#qEg button').click());           // 範例鈕帶入並查詢
assert.ok(/完成/.test(await status()));

// 鍵整理
await click('#nNull'); await click('#nGo');
const norm = JSON.parse(await text('#outText'));
assert.deepEqual(Object.keys(norm), ['a', 'b', 'items']); assert.ok(!('x' in norm) && /提醒/.test(await status()));
await set('#nDec', 'x'); await click('#nGo');
assert.ok(/小數位數/.test(await status()));
await set('#nDec', '');

// 欄位選取與改名
await set('#in', '[{"userName":"a","age":1,"tmp":0},{"userName":"b","age":2}]');
await click('#fpLoad');
assert.equal(await page.evaluate(() => document.querySelectorAll('#fpList .bar').length), 3);
await page.evaluate(() => { const rows = document.querySelectorAll('#fpList .bar'); rows[2].querySelector('input[type=checkbox]').click(); const t = rows[1].querySelector('input[type=text]'); t.value = 'years'; });
await page.select('#fpCase', 'snake'); await click('#fpGo');
assert.deepEqual(JSON.parse(await text('#outText')), [{ user_name: 'a', years: 1 }, { user_name: 'b', years: 2 }]);
await page.evaluate(() => { const rows = document.querySelectorAll('#fpList .bar'); rows[0].querySelector('input[type=text]').value = 'years'; });
await click('#fpGo'); assert.ok(/重複/.test(await status()));
await set('#in', '[1,2]'); await click('#fpLoad'); assert.ok(/✗/.test(await status()) && await page.evaluate(() => document.querySelector('#fpList').hidden));

// 設定檔
await set('#in', '# c\nname=app\nport=80\n[db]\nhost = h ; x\nbad line');
await page.select('#cfgKind', 'ini'); await click('#cfgInfer'); await click('#cfgToJson');
assert.deepEqual(JSON.parse(await text('#outText')), { name: 'app', port: 80, db: { host: 'h' } });
assert.ok(/1 項提醒/.test(await status()), await status());
await set('#in', '{"a":{"b":1},"n":null}'); await page.select('#cfgKind', 'env'); await click('#cfgFromJson');
assert.equal(await text('#outText'), 'A_B=1\nN=\n'); assert.ok(/提醒/.test(await status()));
await set('#in', '{"a":1}'); await page.select('#cfgKind', 'properties'); await click('#cfgFromJson'); assert.equal(await text('#outText'), 'a=1\n');

// i18n
await set('#in', '{"nav":{"home":"首頁"},"ok":"好","only":"x"}'); await page.select('#i18nTo', 'csv'); await click('#i18nGo');
assert.equal(await text('#outText'), 'key,value\r\nnav.home,首頁\r\nok,好\r\nonly,x\r\n');
await set('#i18nB', '{"nav":{"home":"Home"},"ok":"","extra":"e"}'); await click('#i18nCheck');
const rep = await text('#outText');
assert.ok(/缺少的鍵（1）\n {2}only/.test(rep) && /多出的鍵.*（1）\n {2}extra/.test(rep) && /值是空的（1）\n {2}ok/.test(rep), rep);
await set('#i18nB', ''); await click('#i18nCheck'); assert.ok(/對照檔/.test(await status()));
await set('#i18nB', '{"nav":{"home":"H"},"ok":"o","only":"x"}'); await click('#i18nCheck'); assert.ok(/沒有缺漏/.test(await text('#outText')));

// 新型別輸出
await set('#in', '[{"id":1,"name":"a","big":5000000000},{"id":2,"name":"b","big":1,"opt":true}]');
for (const [lang, re] of [['graphql', /type \w+ \{\n {2}id: ID!/], ['proto', /syntax = "proto3";[\s\S]*int64 big = 3;/], ['sql', /CREATE TABLE "root" \(/]]) {
    await page.select('#tyLang', lang); await click('#tyGo');
    assert.ok(re.test(await text('#tyOut')), lang + '\n' + await text('#tyOut'));
}
assert.ok(await page.evaluate(() => !document.querySelector('#tyOpts [data-for=sql]').hidden));
await page.select('#tyDialect', 'mysql');                                   // 切換方言會自動重新產生
assert.ok(/`id` INT NOT NULL PRIMARY KEY/.test(await text('#tyOut')));
await page.select('#tyLang', 'ts'); assert.ok(/interface/.test(await text('#tyOut')));

// 手機不橫向捲動
const w = await page.evaluate(() => ({ s: document.scrollingElement.scrollWidth, c: document.scrollingElement.clientWidth }));
assert.ok(w.s <= w.c, `橫向捲動 ${w.s} > ${w.c}`);
assert.deepEqual(errors, []);
await browser.close();
console.log('json-formatter OK');
