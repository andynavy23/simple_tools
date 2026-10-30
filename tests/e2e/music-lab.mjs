// music-lab：分頁切換、ABC 錯誤行號、簡譜、MIDI 檔載入、記住輸入與清除；並順帶檢查 metronome 複節奏分頁、tone-generator 麥克風分頁、audio-recorder EQ 按鈕存在
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/music-lab.html');
const set = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
const click = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
const tab = (n) => page.evaluate((i) => document.querySelectorAll('#tabs button')[i].click(), n);
const visible = () => page.evaluate(() => [...document.querySelectorAll('.pane')].filter(p => !p.hidden).map(p => p.dataset.t));

assert.deepEqual(await visible(), ['chord']);
assert.ok((await text('#cOut')).includes('C') && (await text('#cOut')).includes('Am'));
await set('#cKey', '7'); assert.ok((await text('#cOut')).startsWith('G'));
await set('#cMode', 'min'); assert.ok((await page.evaluate(() => document.querySelector('#cStyle').options.length)) >= 3);

await tab(1); assert.deepEqual(await visible(), ['melody']);
const m1 = await text('#mOut'); await set('#mSeed', 'zzz'); const m2 = await text('#mOut'); await set('#mSeed', 'hello');
assert.notEqual(m1, m2); await set('#mSeed', 'zzz'); assert.equal(await text('#mOut'), m2);

await tab(2); assert.ok((await text('#aJp')).includes('1'));
await set('#abc', 'K:C\nC D\nC ? D');
assert.ok((await text('#aErr')).includes('第 3 行'));
assert.equal(await page.evaluate(() => document.querySelector('#aPlay').disabled), true);
await click('#aSample'); assert.equal(await text('#aErr'), '');

// MIDI：用瀏覽器內建 DataTransfer 塞一個最小 SMF
await tab(3);
await page.evaluate(() => {
    const b = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 0x0d, 0, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0, 0, 0xff, 0x2f, 0]);
    const dt = new DataTransfer(); dt.items.add(new File([b], 't.mid')); const i = document.querySelector('#mFile'); i.files = dt.files; i.dispatchEvent(new Event('change'));
});
await page.waitForFunction(() => document.querySelector('#fInfo').innerText.includes('音符 1'), { timeout: 3000 });
assert.equal(await page.evaluate(() => document.querySelector('#fPlay').disabled), false);
await page.evaluate(() => { const i = document.querySelector('#mFile'); const dt = new DataTransfer(); dt.items.add(new File([new Uint8Array([1, 2, 3, 4])], 'bad.mid')); i.files = dt.files; i.dispatchEvent(new Event('change')); });
await page.waitForFunction(() => document.querySelector('#fErr').innerText.includes('MIDI'), { timeout: 3000 });

await tab(4); assert.ok((await text('#jTbl')).includes('G4') && (await text('#jTbl')).includes('第 2 線'));
await set('#jText', '1 9'); assert.ok((await text('#jErr')).includes('第 1 行'));

await tab(5); assert.ok((await text('#dTbl')).includes('500.0'));
await tab(6); assert.ok((await text('#rTbl')).includes('34.3'));
await tab(7); assert.ok((await text('#sOut')).includes('4 Ω'));

// 記住輸入：重新載入後保留分頁與欄位；清除後回預設
await set('#rL', '6');
await page.reload({ waitUntil: 'load' });
assert.deepEqual(await visible(), ['spk']); assert.equal(await page.evaluate(() => document.querySelector('#rL').value), '6');
page.removeAllListeners('dialog'); page.once('dialog', d => d.accept());
await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), click('#reset')]);
assert.equal(await page.evaluate(() => document.querySelector('#rL').value), '5'); assert.deepEqual(await visible(), ['chord']);
assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1), '頁面出現橫向捲動');
assert.deepEqual(errors, []);

// 其他頁面的擴充
const a = await openPage(browser, 'fun/metronome.html');
await a.page.evaluate(() => document.querySelector('[data-t=poly]').click());
assert.ok(await a.page.evaluate(() => !document.querySelector('.pane[data-t=poly]').hidden && document.querySelector('#pinfo').textContent.includes('3 對 4')));
await a.page.evaluate(() => document.querySelector('[data-p="5,4"]').click());
assert.ok(await a.page.evaluate(() => document.querySelector('#pinfo').textContent.includes('5 對 4') && document.querySelectorAll('#pdots i').length === 9));
assert.deepEqual(a.errors, []);
const t = await openPage(browser, 'utils/tone-generator.html');
await t.page.evaluate(() => document.querySelector('[data-t=mic]').click());
assert.ok(await t.page.evaluate(() => !document.querySelector('#pg-mic').hidden && document.querySelector('#pg-gen').hidden));
assert.deepEqual(t.errors, []);
const r = await openPage(browser, 'utils/audio-recorder.html');
assert.ok(await r.page.evaluate(() => ['#opStretch', '#opPitch', '#opEq'].every(s => document.querySelector(s))));
assert.deepEqual(r.errors, []);
await browser.close();
console.log('music-lab OK');
