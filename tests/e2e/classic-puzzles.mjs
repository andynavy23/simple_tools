// classic-puzzles：每個分頁可開局、做一步、悔棋、提示；進度 / 最佳紀錄存取與清除；壞資料容錯；390px 不橫向溢出
import assert from 'assert';
import { launchEdge, openPage } from './lib.mjs';
const browser = await launchEdge();
const { page, errors } = await openPage(browser, 'mini-games/classic-puzzles.html');
const ev = (f, ...a) => page.evaluate(f, ...a);
const click = (s) => ev((s) => document.querySelector(s).dispatchEvent(new MouseEvent('click', { bubbles: true })), s);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const noOverflow = async (tag) => assert.equal(await ev(() => document.scrollingElement.scrollWidth <= innerWidth), true, '橫向溢出：' + tag);

// 手動玩河內塔 3 層過關，檢查進度 / 最佳紀錄
await ev(() => { window.confirm = () => true; });
for (const [f, t] of [[0, 2], [0, 1], [2, 1], [0, 2], [1, 0], [1, 2], [0, 2]]) { await click(`[data-a=peg][data-i="${f}"]`); await click(`[data-a=peg][data-i="${t}"]`); }
assert.ok((await ev(() => document.querySelector('#msg').textContent)).includes('完成'));
let st = await ev(() => [localStorage.getItem('classicp_progress'), localStorage.getItem('classicp_best')]);
assert.deepEqual(JSON.parse(st[0]), { hanoi: { 3: 1 }, klotski: {}, peg: {}, water: {}, queens: {}, knight: {}, magic: {}, jugs: {}, river: {} });
assert.equal(JSON.parse(st[1]).hanoi[3], 7);
assert.ok((await ev(() => document.querySelector('#lvls').textContent)).includes('✓'));

// 每個分頁：提示、自動走幾步、悔棋到底、不溢出
const tabs = await ev(() => [...document.querySelectorAll('#tabs [data-p]')].map(b => b.dataset.p));
assert.equal(tabs.length, 9);
for (const k of tabs) {
    await click(`#tabs [data-p=${k}]`); await noOverflow(k + ' 開局');
    await click('#hint');
    assert.ok((await ev(() => document.querySelector('#msg').textContent)).startsWith('💡'), k + ' 提示');
    if (k === 'magic') { await click('[data-a=cell][data-i="0"]'); await click('[data-a=num][data-v="5"]'); assert.equal(await ev(() => document.querySelector('[data-a=cell][data-i="0"]').textContent), '5'); }
    else { await click('#auto'); await wait(k === 'klotski' ? 900 : 1300); await click('#auto'); }
    assert.equal(await ev(() => document.querySelector('#undo').disabled), false, k + ' 有走步');
    await noOverflow(k + ' 走步後');
    for (let i = 0; i < 80 && !(await ev(() => document.querySelector('#undo').disabled)); i++) await click('#undo');
    assert.equal(await ev(() => document.querySelector('#undo').disabled), true, k + ' 悔棋到底');
    await click('#reset');
}
// 各等級切換不出錯（河內塔 10 層、皇后 12、幻方 5、倒水 10 色）
for (const [k, l] of [['hanoi', '10'], ['queens', '12'], ['magic', '5'], ['water', '10'], ['jugs', '4'], ['river', 'mc4'], ['peg', 'eur'], ['knight', '8']]) {
    await click(`#tabs [data-p=${k}]`); await click(`#lvls [data-l="${l}"]`); await noOverflow(k + l);
}
// 華容道 8 關都能開
await click('#tabs [data-p=klotski]');
for (let i = 1; i <= 8; i++) await click(`#lvls [data-l="${i}"]`);
assert.equal(await ev(() => document.querySelectorAll('#kb .p').length) >= 8, true);

// 清除最佳紀錄 / 重置進度
await click('#clearBest');
st = await ev(() => JSON.parse(localStorage.getItem('classicp_best')));
assert.deepEqual(Object.values(st).map(o => Object.keys(o).length), Array(9).fill(0));
await click('#clearProg');
st = await ev(() => JSON.parse(localStorage.getItem('classicp_progress')));
assert.deepEqual(Object.values(st).map(o => Object.keys(o).length), Array(9).fill(0));

// 壞資料容錯
for (const [a, b] of [['[1,"x"]', '{"hanoi":{"3":"a","4":-1,"5":1.5,"zz":3}}'], ['null', '"oops"'], ['{"hanoi":5,"queens":[1]}', '{"peg":null}'], ['{{{', '{{{']]) {
    await ev((a, b) => { localStorage.setItem('classicp_progress', a); localStorage.setItem('classicp_best', b); }, a, b);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await ev(() => document.querySelectorAll('#tabs button').length), 9);
    assert.equal(await ev(() => document.querySelector('#lvls').textContent.includes('✓')), false);
    assert.equal(await ev(() => document.querySelector('#best').textContent), '');
}
await noOverflow('final');
assert.deepEqual(errors, []);
await browser.close();
console.log('classic-puzzles OK');
