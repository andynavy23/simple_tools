// json-formatter：JSON 展平與還原、XML ⇄ JSON（真實 DOMParser）；手機寬度不橫向捲動
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/json-formatter.html');
const set = (sel, v) => page.evaluate((s, x) => { document.querySelector(s).value = x; }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
const out = () => text('#outText');
const run = async (btn, input) => { await set('#in', input); await click(btn); };

// 展平 / 還原
const src = '{"a":{"b":[1,{"c":2}],"d.e":3},"x":[],"y":{}}';
await run('#flGo', src);
assert.equal(await out(), '{\n  "a.b[0]": 1,\n  "a.b[1].c": 2,\n  "a[\\"d.e\\"]": 3,\n  "x": [],\n  "y": {}\n}');
const flat = await out();
await run('#flBack', flat);
assert.deepEqual(JSON.parse(await out()), JSON.parse(src));
await page.select('#flFmt', 'table');
await run('#flGo', src);
const tbl = await out(); assert.ok(tbl.startsWith('鍵\t型別\t值\n') && tbl.includes('a.b[0]\tnumber\t1'));
await run('#flBack', tbl);
assert.deepEqual(JSON.parse(await out()), JSON.parse(src));
await run('#flBack', '{"a":1,"a.b":2}'); assert.ok(/衝突/.test(await text('#status')), await text('#status'));
await run('#flGo', '5'); assert.ok(/根節點/.test(await text('#status')));

// XML → JSON
await run('#xmlToJson', '<?xml version="1.0"?><!-- c --><root xmlns:n="urn:x" id="7"><n:item k="1">a</n:item><n:item k="2"><![CDATA[<b> & c]]></n:item><empty/><t> x </t></root>');
assert.deepEqual(JSON.parse(await out()), { root: { '@xmlns:n': 'urn:x', '@id': '7', 'n:item': [{ '@k': '1', '#text': 'a' }, { '@k': '2', '#text': '<b> & c' }], empty: null, t: ' x ' } });
await page.evaluate(() => { document.querySelector('#xmlInfer').checked = true; });
await run('#xmlToJson', '<r a="5"><n>42</n><s>007</s><b>true</b></r>');
assert.deepEqual(JSON.parse(await out()), { r: { '@a': 5, n: 42, s: '007', b: true } });
await page.evaluate(() => { document.querySelector('#xmlInfer').checked = false; });
await run('#xmlToJson', '<p>hello <b>bold</b> world</p>');
assert.deepEqual(JSON.parse(await out()), { p: { '#text': ['hello', 'world'], b: 'bold' } });
assert.ok(/混合內容/.test(await text('#status')), await text('#status'));
// 錯誤位置
await run('#xmlToJson', '<a>\n  <b>text</c>\n</a>');
let st = await text('#status');
assert.ok(/✗ XML → JSON 失敗：不是有效的 XML/.test(st) && /第 2 行、第 \d+ 欄/.test(st) && st.includes('<b>text</c>') && st.includes('^'), st);
await run('#xmlToJson', '<a>'); assert.ok(/第 \d+ 行/.test(await text('#status')), await text('#status'));
await run('#xmlToJson', ''); assert.ok(/請先貼上/.test(await text('#status')));
// 不會執行：含 script 與外部實體的 XML 只是文字，沒有副作用
await run('#xmlToJson', '<!DOCTYPE r [<!ENTITY e SYSTEM "file:///etc/passwd">]><r><script>window.__pwn=1</script>&e;</r>');
assert.equal(await page.evaluate(() => window.__pwn), undefined);

// JSON → XML 與往返
const xml = '<root id="1"><a>text</a><b>1</b><b>2</b><c/><d x="y">hi</d></root>';
await run('#xmlToJson', xml); const j = await out();
await page.evaluate(() => { document.querySelector('#xmlDecl').checked = false; });
await page.select('#xmlInd', '');
await run('#jsonToXml', j); assert.equal(await out(), xml);
await page.select('#xmlInd', '  '); await page.evaluate(() => { document.querySelector('#xmlDecl').checked = true; });
await run('#jsonToXml', '{"a":{"@k":"v","b":[1,2]}}');
assert.equal(await out(), '<?xml version="1.0" encoding="UTF-8"?>\n<a k="v">\n  <b>1</b>\n  <b>2</b>\n</a>');
await run('#jsonToXml', '{"a b":1}'); assert.ok(/不是合法的 XML 名稱/.test(await text('#status')));
await run('#jsonToXml', '{"x":1,"y":2}'); assert.ok(/已包上 <root>/.test(await text('#status')) || /1 項提醒/.test(await text('#status')), await text('#status'));
await run('#jsonToXml', '{oops'); assert.ok(/不是有效的 JSON/.test(await text('#status')));
// 轉出的 XML 能再被 DOMParser 讀回（含需要跳脫的字元）
await run('#jsonToXml', JSON.stringify({ r: { '@q': 'a"b<&', v: ['x < y & z', "it's"] } }));
const back = await out();
await run('#xmlToJson', back);
assert.deepEqual(JSON.parse(await out()), { r: { '@q': 'a"b<&', v: ['x < y & z', "it's"] } });

// 版面
const w = await page.evaluate(() => ({ s: document.scrollingElement.scrollWidth, c: document.scrollingElement.clientWidth }));
assert.ok(w.s <= w.c, `橫向捲動 ${w.s} > ${w.c}`);
assert.deepEqual(errors, []);
await browser.close();
console.log('json-formatter-flat-xml OK');
