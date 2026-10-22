import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/classic-ciphers.html');
const txt = (s) => page.$eval(s, e => e.textContent);
const click = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
const fill = (s, v) => page.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); }, s, v);
// 摩斯
assert.equal(await txt('#mOut'), '... --- ... / .... . .-.. .-.. ---');
await fill('#mIn', '... --- ...'); await click('#c2m');
assert.equal(await txt('#mOut'), 'SOS');
await click('#mPlay');                         // 播放（靜音環境也不可丟例外）
await click('#mStop');
assert.ok(!await page.$eval('#lamp', e => e.classList.contains('on')));
await click('#pNew');
const bad = await page.evaluate(() => { document.querySelector('#pAns').value = '??'; document.querySelector('#pChk').click(); return document.querySelector('#pRes').textContent; });
assert.ok(bad.includes('答案是'), bad);
await click('#mStop');
// 點字
await page.evaluate(() => document.querySelector('#tabs [data-t=braille]').click());
assert.ok(await txt('#bOut').then(t => t.startsWith('⠠⠓')));
assert.equal(await page.$$eval('#bCells .g', g => g.length), await page.evaluate(() => document.querySelectorAll('#bCells > div').length));
// 密碼
await page.evaluate(() => document.querySelector('#tabs [data-t=cipher]').click());
await fill('#cIn', 'Hello'); await click('#cEnc');
assert.equal(await txt('#cOut'), 'Khoor');
await click('#cBrute');
assert.equal(await page.$$eval('table.bf tr', r => r.length), 25);
await page.select('#cType', 'vig'); await fill('#cIn', 'ATTACKATDAWN'); await fill('#cKey', 'lemon'); await click('#cEnc');
assert.equal(await txt('#cOut'), 'LXFOPVEFRNHR');
await page.select('#cType', 'rail'); await fill('#cIn', 'WEAREDISCOVEREDFLEEATONCE'); await click('#cEnc');
assert.equal(await txt('#cOut'), 'WECRLTEERDSOEEFEAOCAIVDEN');
await click('#cFreq');
assert.ok((await txt('#aOut')).includes('太少') || (await txt('#aOut')).includes('建議金鑰長度'));
// NATO
await page.evaluate(() => document.querySelector('#tabs [data-t=nato]').click());
assert.equal(await page.$$eval('#nOut > div', d => d.length), 9);       // Taipei 101
await click('#nSay');
// 不橫向捲動
const w = await page.evaluate(() => [document.scrollingElement.scrollWidth, innerWidth]);
assert.ok(w[0] <= w[1], '橫向捲動 ' + w);
assert.deepEqual(errors, []);
await browser.close();
console.log('classic-ciphers OK');
