// music-lab 鋼琴與鼓機：鍵盤按下 / 錄音 / 匯入、鼓機格子 / 播放 / 儲存 / 載入 / 刪除 / 上限 / 清除、壞資料載入
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'utils/music-lab.html');
page.removeAllListeners('dialog'); page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'beat' : undefined));
const ev = (f, ...a) => page.evaluate(f, ...a);
const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
const text = (sel) => ev((s) => document.querySelector(s).innerText, sel);
const tab = (id) => ev((i) => [...document.querySelectorAll('#tabs button')].find(b => b.dataset.t === i).click(), id);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 鋼琴 ----
await tab('piano');
assert.equal(await ev(() => document.querySelectorAll('#kb .wk').length), 15);
assert.equal(await ev(() => document.querySelectorAll('#kb .bk').length), 10);
const fire = (type, key) => ev((t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true })), type, key);
await fire('keydown', 'a');
assert.equal(await ev(() => document.querySelectorAll('#kb .on').length), 1);
await fire('keyup', 'a'); await wait(50);
assert.equal(await ev(() => document.querySelectorAll('#kb .on').length), 0);
// 多指：兩個 pointer 同時按
await ev(() => { const k = [...document.querySelectorAll('#kb [data-m]')]; k[0].dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true })); k[2].dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, bubbles: true })); });
assert.equal(await ev(() => document.querySelectorAll('#kb .on').length), 2);
await ev(() => { window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 })); window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2 })); });
assert.equal(await ev(() => document.querySelectorAll('#kb .on').length), 0);
// 延音：踏板按住時放開的鍵仍亮，踏板放開才熄
await fire('keydown', ' '); await fire('keydown', 'd'); await fire('keyup', 'd');
assert.equal(await ev(() => document.querySelectorAll('#kb .on').length), 1);
await fire('keyup', ' '); assert.equal(await ev(() => document.querySelectorAll('#kb .on').length), 0);
// 錄音
await click('#pRec'); await fire('keydown', 'a'); await wait(120); await fire('keyup', 'a'); await fire('keydown', 'g'); await wait(80); await fire('keyup', 'g'); await click('#pRec');
const rt = await ev(() => document.querySelector('#pText').value);
assert.match(rt, /^60@\d+\+\d+ 67@\d+\+\d+$/); assert.equal(await ev(() => document.querySelector('#pPlay').disabled), false);
await click('#pClr'); assert.equal(await ev(() => document.querySelector('#pText').value), '');
await ev(() => { document.querySelector('#pText').value = '60@0+100 oops'; }); await click('#pImp');
assert.ok((await text('#pInfo')).includes('匯入失敗'));
await ev(() => { document.querySelector('#pText').value = '60@0+100 64@100+100'; }); await click('#pImp');
assert.ok((await text('#pInfo')).includes('已匯入'));
// 切分頁會停止並放開
await fire('keydown', 'a'); await tab('drum'); assert.equal(await ev(() => document.querySelectorAll('#kb .on').length), 0);

// ---- 鼓機 ----
assert.equal(await ev(() => document.querySelectorAll('#dmGrid .c').length), 128);
await ev(() => { document.querySelector('#dmGrid .c').click(); }); assert.equal(await ev(() => document.querySelectorAll('#dmGrid .c.on').length), 1);
await click('#dmPlay'); await wait(700);
assert.equal(await text('#dmPlay'), '■ 停止'); if (await ev(() => actx.state === 'running' && actx.currentTime > 0.3)) assert.ok(await ev(() => document.querySelectorAll('#dmGrid .cur').length) > 0); // 無頭環境音訊時鐘可能不走
await click('#dmPlay'); assert.equal(await ev(() => document.querySelectorAll('#dmGrid .cur').length), 0);
await ev(() => { const b = document.querySelector('#dmBpm'); b.value = 9999; b.dispatchEvent(new Event('change', { bubbles: true })); }); assert.equal(await ev(() => document.querySelector('#dmBpm').value), '240');
// 儲存 / 載入 / 刪除
await click('#dmSave'); assert.equal(await ev(() => JSON.parse(localStorage.getItem('musiclab_drum')).pats.length), 1);
await click('#dmClr'); assert.equal(await ev(() => document.querySelectorAll('#dmGrid .c.on').length), 0);
await ev(() => document.querySelector('#dmList .dmrow button').click()); assert.equal(await ev(() => document.querySelectorAll('#dmGrid .c.on').length), 1);
await click('#dmExp'); const tx = await ev(() => document.querySelector('#dmText').value); assert.ok(tx.startsWith('beat|240|0|1'));
await ev(() => { document.querySelector('#dmText').value = 'bad'; }); await click('#dmImp'); assert.ok((await text('#dmMsg')).includes('格式錯誤'));
await ev(() => document.querySelectorAll('#dmList .dmrow button')[1].click()); assert.equal(await ev(() => JSON.parse(localStorage.getItem('musiclab_drum')).pats.length), 0);
// 上限 20
for (let i = 0; i < 21; i++) await click('#dmSave');
assert.equal(await ev(() => JSON.parse(localStorage.getItem('musiclab_drum')).pats.length), 20);
await click('#dmDelAll'); assert.equal(await ev(() => localStorage.getItem('musiclab_drum')), null);
// 壞資料載入
await ev(() => localStorage.setItem('musiclab_drum', '{"pats":[1,null,{"tr":"x"},{"name":"ok","bpm":90,"swing":10,"tr":["1000100010001000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"]}]}'));
await page.reload(); await tab('drum');
assert.equal(await ev(() => document.querySelectorAll('#dmList .dmrow').length), 1);
await ev(() => localStorage.setItem('musiclab_drum', 'not json')); await page.reload(); await tab('drum');
assert.equal(await ev(() => document.querySelectorAll('#dmList .dmrow').length), 0);
await ev(() => localStorage.removeItem('musiclab_drum'));
assert.deepEqual(errors, []);
await browser.close();
console.log('music-lab-instruments OK');
