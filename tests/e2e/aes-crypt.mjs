// aes-crypt：既有加解密仍可用、金鑰對 / 憑證解析 / PEM 轉換分頁
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/aes-crypt.html');
const ev = (f, ...a) => page.evaluate(f, ...a);
const click = (s) => ev((s) => document.querySelector(s).click(), s);
const set = (s, v) => ev((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, s, v);
const txt = (s) => ev((s) => document.querySelector(s).textContent, s);
// 既有文字加解密
await set('#pw', 'correct-horse-battery'); await set('#in', '你好 hello'); await click('#enc');
await page.waitForFunction(() => document.querySelector('#out').value.startsWith('v1.'), { timeout: 20000 });
await click('#swap'); await click('#dec'); await page.waitForFunction(() => document.querySelector('#out').value === '你好 hello', { timeout: 20000 });
// 金鑰對
await click('[data-t=key]');
await set('#kpKind', 'ecdsa'); await click('#kpGen');
await page.waitForFunction(() => document.querySelectorAll('#kpOut textarea').length === 4, { timeout: 20000 });
const pem = await ev(() => document.querySelector('#kpOut textarea').value);
assert.ok(pem.startsWith('-----BEGIN PRIVATE KEY-----'));
assert.equal(await ev(() => document.querySelector('#kpWarn').hidden), false);
// PEM 轉換：貼公鑰 PEM，辨識為公鑰
const pub = await ev(() => document.querySelectorAll('#kpOut textarea')[1].value);
await set('#cvIn', pub); await click('#cvGo');
assert.ok((await txt('#cvType')).includes('公鑰'));
assert.equal(await ev(() => document.querySelectorAll('#cvOut textarea').length), 3);
await set('#cvIn', '!!!'); await click('#cvGo'); assert.ok((await txt('#cvErr')).length > 0);
// 憑證解析：貼公鑰會得到「不是憑證」（真正的憑證解析在 tests/new-g6.test.js 用 openssl 對照）
await set('#certIn', pub); await click('#certGo'); assert.ok((await txt('#certErr')).includes('不是'));
assert.equal(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), true);
assert.deepEqual(errors, []);
await browser.close();
console.log('aes-crypt OK');
